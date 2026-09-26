// ===== WebRTC P2P 接続（シグナリングは Firestore） =====
import { fb } from './firebase.js';
import { extraIceServers } from './firebase-config.js';

const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ...extraIceServers,
  ],
};

export class Conn {
  constructor(pc, dc) {
    this.pc = pc; this.dc = dc; this.closed = false;
    this._q = []; this._h = null;
    dc.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      this._h ? this._h(m) : this._q.push(m); // ハンドラ設定前に届いたメッセージは保持
    };
    const lost = () => { if (!this.closed) { this.closed = true; this.onclose?.(); } };
    dc.onclose = lost;
    pc.addEventListener('connectionstatechange', () => {
      if (['failed', 'closed'].includes(pc.connectionState)) lost();
    });
  }
  set onmessage(h) { this._h = h; while (h && this._q.length) h(this._q.shift()); }
  get onmessage() { return this._h; }
  send(m) { if (this.dc.readyState === 'open') this.dc.send(JSON.stringify(m)); }
  close() {
    this.closed = true;
    try { this.dc.close(); } catch {}
    try { this.pc.close(); } catch {}
  }
}

function waitOpen(pc, dc, ms, extraFail) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('接続がタイムアウトしました。ネットワーク環境によっては TURN サーバーが必要です。')), ms);
    const done = fn => v => { clearTimeout(t); fn(v); };
    if (dc.readyState === 'open') return done(resolve)();
    dc.addEventListener('open', done(resolve), { once: true });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed') done(reject)(new Error('P2P 接続に失敗しました。'));
    });
    extraFail?.(done(reject));
  });
}

function remoteCandidateQueue(pc) {
  const pending = [];
  return {
    add(c) { pc.remoteDescription ? pc.addIceCandidate(c).catch(() => {}) : pending.push(c); },
    flush() { while (pending.length) pc.addIceCandidate(pending.shift()).catch(() => {}); },
  };
}

// 部屋を作る側（オファー側）
export async function createRoom({ calleeUid, status, meta = {}, roomId = null, timeout = 30000 }) {
  const { db, auth, F } = await fb();
  const me = auth.currentUser.uid;
  const roomRef = roomId ? F.doc(db, 'rooms', roomId) : F.doc(F.collection(db, 'rooms'));
  const pc = new RTCPeerConnection(ICE);
  const dc = pc.createDataChannel('battle', { ordered: true });
  const unsubs = [];
  let roomCreated = false;
  const localCands = [];
  const pushCand = c => F.addDoc(F.collection(roomRef, 'callerCandidates'), c).catch(() => {});
  pc.onicecandidate = e => {
    if (!e.candidate) return;
    const c = e.candidate.toJSON();
    roomCreated ? pushCand(c) : localCands.push(c);
  };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await F.setDoc(roomRef, {
    caller: me, callee: calleeUid, status,
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: F.serverTimestamp(), ...meta,
  });
  roomCreated = true;
  localCands.splice(0).forEach(pushCand);

  const rq = remoteCandidateQueue(pc);
  let failStatus = null;
  unsubs.push(F.onSnapshot(roomRef, snap => {
    const d = snap.data();
    if (!d) return;
    if (d.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(d.answer).then(() => rq.flush()).catch(() => {});
    }
    if (d.status === 'declined') failStatus?.(new Error('対戦を断られました。'));
  }));
  unsubs.push(F.onSnapshot(F.collection(roomRef, 'calleeCandidates'), snap => {
    snap.docChanges().forEach(ch => { if (ch.type === 'added') rq.add(ch.doc.data()); });
  }));

  const cleanup = (removeRoom) => {
    unsubs.splice(0).forEach(u => u());
    if (removeRoom) F.deleteDoc(roomRef).catch(() => {});
  };
  let cancelled = false;
  const ready = waitOpen(pc, dc, timeout, fail => { failStatus = fail; })
    .then(() => {
      cleanup(false);
      setTimeout(() => F.deleteDoc(roomRef).catch(() => {}), 5000); // シグナリング情報を片付ける
      return new Conn(pc, dc);
    })
    .catch(err => {
      cleanup(true);
      try { pc.close(); } catch {}
      throw cancelled ? new Error('キャンセルしました') : err;
    });
  return {
    roomId: roomRef.id, ready,
    cancel() { cancelled = true; F.updateDoc(roomRef, { status: 'cancelled' }).catch(() => {}); try { pc.close(); } catch {} cleanup(true); },
  };
}

// 部屋に参加する側（アンサー側）
export async function joinRoom(roomId, timeout = 30000) {
  const { db, F } = await fb();
  const roomRef = F.doc(db, 'rooms', roomId);
  // オファーが書き込まれるまで待つ
  const room = await new Promise((resolve, reject) => {
    const t = setTimeout(() => { un(); reject(new Error('部屋が見つかりませんでした。')); }, 15000);
    const un = F.onSnapshot(roomRef, snap => {
      const d = snap.data();
      if (d?.offer) { clearTimeout(t); un(); resolve(d); }
    }, err => { clearTimeout(t); reject(err); });
  });
  const pc = new RTCPeerConnection(ICE);
  const dcP = new Promise(r => { pc.ondatachannel = e => r(e.channel); });
  pc.onicecandidate = e => {
    if (e.candidate) F.addDoc(F.collection(roomRef, 'calleeCandidates'), e.candidate.toJSON()).catch(() => {});
  };
  await pc.setRemoteDescription(room.offer);
  const rq = remoteCandidateQueue(pc);
  const unCand = F.onSnapshot(F.collection(roomRef, 'callerCandidates'), snap => {
    snap.docChanges().forEach(ch => { if (ch.type === 'added') rq.add(ch.doc.data()); });
  });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await F.updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp }, status: 'connected' });
  try {
    const dc = await Promise.race([dcP, new Promise((_, rej) => setTimeout(() => rej(new Error('接続がタイムアウトしました。')), timeout))]);
    await waitOpen(pc, dc, timeout);
    unCand();
    return new Conn(pc, dc);
  } catch (e) {
    unCand(); try { pc.close(); } catch {}
    throw e;
  }
}

// ===== ランダムマッチ =====
export function randomMatch(onStatus = () => {}) {
  let cancelled = false, busy = false;
  let hb, poll, unsubQ, myQ, Fm;
  const cleanupQueue = () => {
    clearInterval(hb); clearInterval(poll); unsubQ?.();
    if (myQ) Fm.deleteDoc(myQ).catch(() => {});
  };
  let rejectOuter;
  const promise = new Promise(async (resolve, reject) => {
    rejectOuter = reject;
    try {
      const { db, auth, F } = await fb();
      Fm = F;
      const me = auth.currentUser.uid;
      myQ = F.doc(db, 'queue', me);
      await F.setDoc(myQ, { uid: me, matched: false, roomId: null, by: null, ts: Date.now() });
      if (cancelled) return cleanupQueue();
      onStatus('対戦相手を探しています…');
      hb = setInterval(() => F.updateDoc(myQ, { ts: Date.now() }).catch(() => {}), 8000);
      window.addEventListener('beforeunload', cleanupQueue, { once: true });

      // 誰かにマッチされた → 参加側
      unsubQ = F.onSnapshot(myQ, async snap => {
        const d = snap.data();
        if (!d || !d.matched || d.by === me || !d.roomId || busy || cancelled) return;
        busy = true; cleanupQueue();
        onStatus('相手が見つかりました！接続中…');
        try { resolve(await joinRoom(d.roomId)); } catch (e) { reject(e); }
      });

      // 自分から相手を探す → 部屋を作る側
      const tryMatch = async () => {
        if (busy || cancelled) return;
        const qs = await F.getDocs(F.query(F.collection(db, 'queue'), F.where('matched', '==', false), F.limit(20))).catch(() => null);
        if (!qs) return;
        const cands = qs.docs.map(d => d.data()).filter(d => d.uid !== me && Date.now() - d.ts < 25000);
        for (const c of cands) {
          if (busy || cancelled) return;
          const roomRef = F.doc(F.collection(db, 'rooms'));
          const ok = await F.runTransaction(db, async tx => {
            const a = await tx.get(myQ);
            const b = await tx.get(F.doc(db, 'queue', c.uid));
            if (!a.exists() || a.data().matched || !b.exists() || b.data().matched) return false;
            tx.update(b.ref, { matched: true, roomId: roomRef.id, by: me });
            tx.update(myQ, { matched: true, roomId: roomRef.id, by: me });
            return true;
          }).catch(() => false);
          if (ok) {
            busy = true; cleanupQueue();
            onStatus('相手が見つかりました！接続中…');
            try {
              const r = await createRoom({ calleeUid: c.uid, status: 'matched', roomId: roomRef.id });
              resolve(await r.ready);
            } catch (e) { reject(e); }
            return;
          }
        }
      };
      tryMatch();
      poll = setInterval(tryMatch, 3000);
    } catch (e) { reject(e); }
  });
  return {
    promise,
    cancel() { cancelled = true; if (!busy) { cleanupQueue(); rejectOuter?.(new Error('キャンセルしました')); } },
  };
}

// ===== プレイヤーID / フレンドへの対戦申し込み =====
export async function challenge(targetUid, meta) {
  return createRoom({ calleeUid: targetUid, status: 'invite', meta, timeout: 90000 });
}

export async function listenInvites(onAdd, onRemove) {
  const { db, auth, F } = await fb();
  const q = F.query(F.collection(db, 'rooms'), F.where('callee', '==', auth.currentUser.uid), F.where('status', '==', 'invite'));
  return F.onSnapshot(q, snap => {
    snap.docChanges().forEach(ch => {
      const d = ch.doc.data();
      const age = d.createdAt?.toMillis ? Date.now() - d.createdAt.toMillis() : 0;
      if (ch.type === 'added' && age < 90000) onAdd({ id: ch.doc.id, ...d });
      if (ch.type === 'removed') onRemove(ch.doc.id);
    });
  }, () => {});
}

export async function declineInvite(roomId) {
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'rooms', roomId), { status: 'declined' }).catch(() => {});
}
