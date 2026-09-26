// ===== プレイヤー（ログインなし: 端末ごとに匿名IDを自動発行）・フレンド =====
import { fb } from './firebase.js';

export const NAME_MAX = 16;
const PID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genPid = () => Array.from({ length: 8 }, () => PID_CHARS[Math.floor(Math.random() * PID_CHARS.length)]).join('');

export function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
}

// 匿名サインインしてプロフィールを返す（なければ作成）
export async function startPlayer(defaultName) {
  const { auth, A } = await fb();
  if (!auth.currentUser) {
    await new Promise(resolve => { const un = A.onAuthStateChanged(auth, () => { un(); resolve(); }); });
  }
  if (!auth.currentUser) await A.signInAnonymously(auth);
  return (await getProfile(auth.currentUser.uid)) || createProfile(defaultName);
}

export async function getProfile(uid) {
  const { db, F } = await fb();
  const s = await F.getDoc(F.doc(db, 'users', uid));
  return s.exists() ? { uid, ...s.data() } : null;
}

async function createProfile(name) {
  const { auth, db, F } = await fb();
  const uid = auth.currentUser.uid;
  for (let attempt = 0; attempt < 5; attempt++) {
    const pid = genPid();
    const res = await F.runTransaction(db, async tx => {
      const pd = await tx.get(F.doc(db, 'playerIds', pid));
      if (pd.exists()) return null;
      const profile = {
        username: cleanName(name) || 'Player', playerId: pid, wins: 0, losses: 0,
        createdAt: F.serverTimestamp(), lastSeen: Date.now(),
      };
      tx.set(F.doc(db, 'users', uid), profile);
      tx.set(F.doc(db, 'playerIds', pid), { uid });
      return profile;
    });
    if (res) return { uid, ...res };
  }
  throw new Error('プレイヤーIDの発行に失敗しました。再読み込みしてください');
}

export async function setName(name) {
  const { auth, db, F } = await fb();
  const n = cleanName(name);
  if (!n || !auth.currentUser) return;
  await F.updateDoc(F.doc(db, 'users', auth.currentUser.uid), { username: n });
}

export async function heartbeat() {
  const { auth, db, F } = await fb();
  if (auth.currentUser) F.updateDoc(F.doc(db, 'users', auth.currentUser.uid), { lastSeen: Date.now() }).catch(() => {});
}

export async function recordResult(result) {
  if (result !== 'win' && result !== 'lose') return;
  const { auth, db, F } = await fb();
  if (!auth.currentUser) return;
  await F.updateDoc(F.doc(db, 'users', auth.currentUser.uid), { [result === 'win' ? 'wins' : 'losses']: F.increment(1) }).catch(() => {});
}

// プレイヤーIDから相手を探す
export async function findPlayer(query) {
  const { db, F } = await fb();
  const q = query.trim().toUpperCase();
  if (!q) throw new Error('プレイヤーIDを入力してください');
  const byPid = await F.getDoc(F.doc(db, 'playerIds', q));
  if (!byPid.exists()) throw new Error('プレイヤーが見つかりません');
  return getProfile(byPid.data().uid);
}

// ===== フレンド =====
export async function sendFriendRequest(me, target) {
  const { db, F } = await fb();
  if (target.uid === me.uid) throw new Error('自分自身は追加できません');
  const reverse = await F.getDoc(F.doc(db, 'friendRequests', `${target.uid}_${me.uid}`));
  if (reverse.exists()) {
    if (reverse.data().status === 'pending') { await acceptFriend(reverse.id); return 'accepted'; }
    return 'already';
  }
  const ref = F.doc(db, 'friendRequests', `${me.uid}_${target.uid}`);
  const cur = await F.getDoc(ref);
  if (cur.exists()) return cur.data().status === 'accepted' ? 'already' : 'pending';
  await F.setDoc(ref, {
    from: me.uid, to: target.uid, fromName: me.username, toName: target.username,
    status: 'pending', createdAt: F.serverTimestamp(),
  });
  return 'sent';
}

export async function acceptFriend(id) {
  const { db, F } = await fb();
  await F.updateDoc(F.doc(db, 'friendRequests', id), { status: 'accepted' });
}

export async function removeFriendRequest(id) {
  const { db, F } = await fb();
  await F.deleteDoc(F.doc(db, 'friendRequests', id));
}

export async function listenFriends(uid, cb) {
  const { db, F } = await fb();
  const col = F.collection(db, 'friendRequests');
  const state = { fromMe: [], toMe: [] };
  const emit = () => {
    const all = [...state.fromMe, ...state.toMe];
    cb({
      incoming: state.toMe.filter(r => r.status === 'pending'),
      outgoing: state.fromMe.filter(r => r.status === 'pending'),
      friends: all.filter(r => r.status === 'accepted').map(r => ({
        reqId: r.id,
        uid: r.from === uid ? r.to : r.from,
        username: r.from === uid ? r.toName : r.fromName,
      })),
    });
  };
  const map = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  const u1 = F.onSnapshot(F.query(col, F.where('from', '==', uid)), s => { state.fromMe = map(s); emit(); }, () => {});
  const u2 = F.onSnapshot(F.query(col, F.where('to', '==', uid)), s => { state.toMe = map(s); emit(); }, () => {});
  return () => { u1(); u2(); };
}

export async function watchUser(uid, cb) {
  const { db, F } = await fb();
  return F.onSnapshot(F.doc(db, 'users', uid), s => cb(s.exists() ? { uid, ...s.data() } : null), () => {});
}
