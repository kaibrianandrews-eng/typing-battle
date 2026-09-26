import { CHARACTERS, charById, avatarSVG } from './characters.js';
import { LANGS } from './words.js';
import { Battle, NpcOpponent, NetOpponent, NPC_LEVELS } from './battle.js';
import { sfx, setSound } from './audio.js';
import { firebaseEnabled } from './firebase.js';
import * as net from './net.js';
import * as social from './social.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===== 設定 =====
const settings = Object.assign(
  { lang: 'ja', timeLimit: 90, ignoreAccents: true, sound: true, custom: '', char: 'akari', npcChar: 'random' },
  JSON.parse(localStorage.getItem('tb-settings') || '{}'));
const defaultName = () => 'Player' + Math.floor(1000 + Math.random() * 9000);
const saveSettings = () => localStorage.setItem('tb-settings', JSON.stringify(settings));
setSound(settings.sound);

// ===== 状態 =====
let profile = null;
let battle = null;
let session = null;       // オンライン対戦中の接続
let pending = null;       // マッチング・申し込み中のハンドル
let profileError = '';
let hbTimer = null, unsubInvites = null, unsubFriends = null;
const friendWatch = new Map();
const friendInfo = {};
let friendState = { incoming: [], outgoing: [], friends: [] };
let current = 'home';

const ONLINE = ['random', 'pid', 'friends'];

// ===== 画面遷移 =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
  current = name;
  document.body.dataset.screen = name;
}

function go(name) {
  if (current === 'battle' && battle?.running) {
    if (!confirm('バトルを中断しますか？（負け扱いになります）')) return;
    battle.surrender();
    closeModal();
  }
  if (ONLINE.includes(name)) {
    if (!firebaseEnabled) { toast('オンライン機能を使うには Firebase の設定が必要です（README 参照）'); return; }
    if (!profile) { toast(profileError || 'オンラインに接続中です。少し待ってからもう一度押してください'); return; }
  }
  if (current === 'battle' || name === 'home') leaveSession();
  if (pending && name !== current) { pending.cancel(); pending = null; }
  showScreen(name);
  ({ home: renderHome, chars: renderChars, settings: renderSettings, npc: renderNpc, pid: renderPid, friends: renderFriends, random: resetRandom })[name]?.();
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (t) go(t.dataset.go);
});

// ===== トースト・モーダル =====
function toast(msg, { actions = [], timeout = 4000 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${msg}</span>`;
  const close = () => el.remove();
  if (actions.length) {
    const box = document.createElement('div');
    box.className = 'toast-actions';
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'small ' + (a.cls || '');
      b.textContent = a.label;
      b.onclick = () => { close(); a.fn(); };
      box.appendChild(b);
    }
    el.appendChild(box);
  }
  $('toasts').appendChild(el);
  if (timeout) setTimeout(() => { if (el.isConnected) { close(); actions.find(a => a.onTimeout)?.onTimeout(); } }, timeout);
  return close;
}

function openModal(html, { closable = true } = {}) {
  $('modalBox').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('modal').dataset.closable = closable ? '1' : '';
}
function closeModal() { $('modal').classList.add('hidden'); $('modalBox').innerHTML = ''; }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal' && $('modal').dataset.closable) closeModal(); });

// ===== ホーム =====
function renderHome() {
  const c = charById(settings.char);
  $('myChar').innerHTML = `${avatarSVG(c)}<div><small>使用キャラ（クリックで変更）</small><b>${esc(c.name)}</b><span>${esc(c.title)}・必殺技「${esc(c.special.name)}」</span></div>`;
  $('myChar').style.setProperty('--c', c.color);
  $('onlineNote').textContent = firebaseEnabled ? '' : '※ オンライン機能（ランダム / プレイヤーID / フレンド / ログイン）は Firebase を設定すると使えます。NPCモードはそのまま遊べます。';
  document.querySelectorAll('.big.online').forEach(b => b.classList.toggle('disabled', !firebaseEnabled));
}

function renderUser() {
  const box = $('userBox');
  if (!firebaseEnabled) { box.innerHTML = '<span class="pill">オフライン</span>'; return; }
  if (!profile) { box.innerHTML = `<span class="pill">${profileError ? 'オフライン' : '接続中…'}</span>`; return; }
  box.innerHTML = `
    <div class="u-meta"><b>${esc(profile.username)}</b><small>ID: ${esc(profile.playerId)}・${profile.wins || 0}勝${profile.losses || 0}敗</small></div>`;
}

// ===== エラー表示 =====
const ERR = {
  'permission-denied': '権限エラー（firestore.rules を確認してください）',
  'auth/operation-not-allowed': 'Firebase コンソールで「匿名」ログインが有効になっていません',
  'auth/admin-restricted-operation': 'Firebase コンソールで「匿名」ログインが有効になっていません',
};
const errMsg = e => ERR[e?.code] || e?.message || String(e);

async function startOnlineFeatures() {
  renderUser();
  clearInterval(hbTimer);
  social.heartbeat();
  hbTimer = setInterval(social.heartbeat, 60000);
  unsubInvites?.();
  unsubInvites = await net.listenInvites(onInvite, id => inviteToasts.get(id)?.());
  unsubFriends?.();
  unsubFriends = await social.listenFriends(profile.uid, st => { friendState = st; syncFriendWatch(); renderFriends(); updateFriendBadge(); });
}

function teardownOnline() {
  clearInterval(hbTimer);
  unsubInvites?.(); unsubInvites = null;
  unsubFriends?.(); unsubFriends = null;
  friendWatch.forEach(u => u()); friendWatch.clear();
  friendState = { incoming: [], outgoing: [], friends: [] };
}

// ===== キャラクター =====
function renderChars() {
  $('charGrid').innerHTML = CHARACTERS.map(c => `
    <button class="char-card ${c.id === settings.char ? 'sel' : ''}" data-char="${c.id}" style="--c:${c.color}">
      ${avatarSVG(c)}
      <b>${esc(c.name)}</b><small>${esc(c.title)}・${c.element}属性</small>
      <div class="stats"><span>HP ${c.hp}</span><span>攻撃 ×${c.atk}</span></div>
      <div class="sp-name">必殺技「${esc(c.special.name)}」</div>
      <p>${esc(c.special.desc)}</p>
      <q>${esc(c.quote)}</q>
    </button>`).join('');
  $('charGrid').querySelectorAll('[data-char]').forEach(b => b.onclick = () => {
    settings.char = b.dataset.char; saveSettings(); sfx.ready(); renderChars();
  });
}

// ===== 設定 =====
function renderSettings() {
  $('setLang').innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
  $('setName').value = settings.name || profile?.username || '';
  $('setLang').value = settings.lang;
  $('setTime').value = String(settings.timeLimit);
  $('setAccent').checked = settings.ignoreAccents;
  $('setSound').checked = settings.sound;
  $('setCustom').value = settings.custom;
}
$('setName').onchange = async e => {
  const n = social.cleanName(e.target.value);
  if (!n) { e.target.value = settings.name || ''; return; }
  settings.name = n; e.target.value = n; saveSettings();
  if (profile) {
    try { await social.setName(n); profile.username = n; renderUser(); toast('名前を変更しました'); }
    catch (err) { toast(errMsg(err)); }
  }
};
$('setLang').onchange = e => { settings.lang = e.target.value; saveSettings(); };
$('setTime').onchange = e => { settings.timeLimit = +e.target.value; saveSettings(); };
$('setAccent').onchange = e => { settings.ignoreAccents = e.target.checked; saveSettings(); };
$('setSound').onchange = e => { settings.sound = e.target.checked; setSound(settings.sound); saveSettings(); };
$('setCustom').oninput = e => { settings.custom = e.target.value; saveSettings(); };

// ===== NPC =====
function renderNpc() {
  $('npcChar').innerHTML = `<option value="random">ランダム</option>` +
    CHARACTERS.map(c => `<option value="${c.id}">${esc(c.name)}（${esc(c.title)}）</option>`).join('');
  $('npcChar').value = settings.npcChar;
  const desc = { easy: '初めての人向け', normal: 'ちょうどいい手応え', hard: '速さと正確さが必要', oni: '上級者への挑戦状' };
  $('npcLevels').innerHTML = Object.entries(NPC_LEVELS).map(([k, v]) =>
    `<button class="level lv-${k}" data-lv="${k}"><b>${v.name}</b><small>${desc[k]}</small></button>`).join('');
  $('npcLevels').querySelectorAll('[data-lv]').forEach(b => b.onclick = () => startNpc(b.dataset.lv));
}
$('npcChar').onchange = e => { settings.npcChar = e.target.value; saveSettings(); };

function startNpc(level) {
  let ch;
  if (settings.npcChar === 'random') {
    const others = CHARACTERS.filter(c => c.id !== settings.char);
    ch = others[Math.floor(Math.random() * others.length)];
  } else ch = charById(settings.npcChar);
  startBattle({ opp: { ch, name: `CPU（${NPC_LEVELS[level].name}）` }, opponent: new NpcOpponent(level), npcLevel: level });
}

// ===== バトル共通 =====
function startBattle({ opp, opponent, online = false, npcLevel = null }) {
  battle?.destroy();
  closeModal();
  showScreen('battle');
  const b = battle = new Battle({
    me: { ch: charById(settings.char), name: profile?.username || settings.name || 'あなた' },
    opp, opponent, settings: { ...settings },
    onEnd: r => showResult(r, { online, npcLevel }),
  });
  $('bHint').className = 'hint';
  $('bHint').textContent = b.hintText();
  b.mount();
  countdown(() => { if (battle === b && b.running) b.go(); });
}

function countdown(done) {
  const el = $('countdown');
  el.classList.remove('hidden');
  let n = 3;
  const step = () => {
    if (n > 0) { el.textContent = n; sfx.count(); }
    else { el.textContent = 'FIGHT!'; sfx.go(); }
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    if (n-- > 0) setTimeout(step, 800);
    else setTimeout(() => { el.classList.add('hidden'); done(); }, 600);
  };
  step();
}

$('bQuit').onclick = () => { if (battle?.running && confirm('降参しますか？')) battle.surrender(); };

function showResult(r, { online, npcLevel }) {
  const title = { win: 'WIN!', lose: 'LOSE…', draw: 'DRAW' }[r.result];
  const sub = r.note || (r.timeUp ? '時間切れ（残りHPの割合で判定）' : r.result === 'win' ? '相手を倒した！' : r.result === 'lose' ? 'やられてしまった…' : '');
  if (online) {
    social.recordResult(r.result).then(async () => { if (profile) { profile = await social.getProfile(profile.uid) || profile; renderUser(); } });
  }
  const canRematch = online && session && !session.closed;
  openModal(`
    <div class="result r-${r.result}">
      <h2>${title}</h2><p>${esc(sub)}</p>
      <div class="result-stats">
        <div><b>${r.kpm}</b><small>打鍵/分</small></div>
        <div><b>${r.accuracy}%</b><small>正確率</small></div>
        <div><b>${r.maxCombo}</b><small>最大コンボ</small></div>
        <div><b>${r.dealt}</b><small>与ダメージ</small></div>
      </div>
      <p id="rmStatus" class="note"></p>
      <div class="row center">
        ${online ? (canRematch ? '<button id="rsRematch" class="primary">再戦を申し込む</button>' : '')
                 : '<button id="rsAgain" class="primary">もう一度</button><button id="rsChars">キャラ変更</button>'}
        <button id="rsMenu" class="ghost">メニューへ</button>
      </div>
    </div>`, { closable: false });
  $('rsMenu').onclick = () => { closeModal(); go('home'); };
  if ($('rsAgain')) $('rsAgain').onclick = () => startNpc(npcLevel);
  if ($('rsChars')) $('rsChars').onclick = () => { closeModal(); go('chars'); };
  if ($('rsRematch')) $('rsRematch').onclick = () => {
    const s = session;
    if (!s || s.closed) return;
    s.my = true;
    s.conn.send({ t: 'rematch', charId: settings.char });
    if (s.opp) beginOnline(s); else updateRematchUI();
  };
  updateRematchUI();
}

function updateRematchUI() {
  const st = $('rmStatus');
  if (!st || !session) return;
  if (session.closed) { st.textContent = '相手との接続が切れました'; $('rsRematch')?.remove(); return; }
  if (session.my && !session.opp) st.textContent = '相手の返事を待っています…';
  else if (session.opp && !session.my) st.textContent = '相手が再戦を希望しています！';
  if (session.my && $('rsRematch')) $('rsRematch').disabled = true;
}

// ===== オンライン対戦セッション =====
function startOnline(conn) {
  leaveSession();
  const s = session = { conn, oppHello: null, my: false, opp: false, battle: null, closed: false };
  conn.onmessage = m => {
    if (session !== s) return;
    if (m.t === 'hello') { s.oppHello = m; if (!s.battle) beginOnline(s); }
    else if (m.t === 'rematch') {
      if (m.charId) s.oppHello.charId = m.charId;
      s.opp = true;
      if (s.my) beginOnline(s); else updateRematchUI();
    }
    else if (m.t === 'bye') { conn.close(); onClose(); }
    else s.battle?.opponent.onMsg(m);
  };
  const onClose = () => {
    if (session !== s || s.closed) return;
    s.closed = true;
    if (s.battle?.running) s.battle.opponentLeft();
    else { toast('相手との接続が切れました'); updateRematchUI(); }
  };
  conn.onclose = onClose;
  conn.send({ t: 'hello', name: profile.username, charId: settings.char, pid: profile.playerId });
  toast('接続しました！バトル開始！');
}

function beginOnline(s) {
  s.my = s.opp = false;
  startBattle({
    opp: { ch: charById(s.oppHello.charId), name: s.oppHello.name || '???' },
    opponent: new NetOpponent(s.conn), online: true,
  });
  s.battle = battle;
}

function leaveSession() {
  if (!session) return;
  const s = session;
  session = null;
  if (!s.closed) { s.conn.send({ t: 'bye' }); setTimeout(() => s.conn.close(), 200); }
}

// ===== ランダムモード =====
function resetRandom() {
  $('randStatus').textContent = 'オンラインの誰かとランダムに対戦します。';
  setRandBusy(false);
}
function setRandBusy(b) {
  $('randSpin').classList.toggle('hidden', !b);
  $('randStart').classList.toggle('hidden', b);
  $('randCancel').classList.toggle('hidden', !b);
}
$('randStart').onclick = async () => {
  setRandBusy(true);
  const h = pending = net.randomMatch(s => { $('randStatus').textContent = s; });
  try { const conn = await h.promise; if (pending === h) pending = null; startOnline(conn); }
  catch (e) { if (pending === h) pending = null; $('randStatus').textContent = errMsg(e); setRandBusy(false); }
};
$('randCancel').onclick = () => { pending?.cancel(); pending = null; resetRandom(); };

// ===== プレイヤーIDモード =====
function renderPid() {
  $('myPid').textContent = profile?.playerId || '--------';
}
function setPidBusy(b, msg) {
  $('pidSpin').classList.toggle('hidden', !b);
  $('pidCancel').classList.toggle('hidden', !b);
  $('pidGo').disabled = b;
  $('pidStatus').textContent = msg;
}
$('copyPid').onclick = async () => {
  try { await navigator.clipboard.writeText(profile.playerId); toast('コピーしました'); } catch { toast('コピーできませんでした'); }
};
$('pidGo').onclick = async () => {
  try { doChallenge(await social.findPlayer($('pidInput').value)); }
  catch (e) { setPidBusy(false, errMsg(e)); }
};
$('pidInput').onkeydown = e => { if (e.key === 'Enter') $('pidGo').click(); };
$('pidCancel').onclick = () => { pending?.cancel(); pending = null; setPidBusy(false, '申し込みを取り消しました'); };

async function doChallenge(target) {
  if (current !== 'pid') { showScreen('pid'); renderPid(); }
  if (target.uid === profile.uid) return setPidBusy(false, '自分自身とは対戦できません');
  setPidBusy(true, `${target.username}（${target.playerId}）に申し込み中…相手の承認を待っています`);
  let h;
  try {
    h = pending = await net.challenge(target.uid, { callerName: profile.username, callerPid: profile.playerId, callerChar: settings.char });
    const conn = await h.ready;
    if (pending === h) pending = null;
    setPidBusy(false, '');
    startOnline(conn);
  } catch (e) {
    if (pending === h) pending = null;
    if (current === 'pid') setPidBusy(false, errMsg(e));
  }
}

// ===== 対戦の申し込みを受け取る =====
const inviteToasts = new Map();
function onInvite(inv) {
  if (battle?.running || session) { net.declineInvite(inv.id); return; }
  sfx.ready();
  const c = charById(inv.callerChar);
  const close = toast(`⚔️ <b>${esc(inv.callerName)}</b>（${esc(inv.callerPid)}・${esc(c.name)}）から対戦の申し込み！`, {
    timeout: 60000,
    actions: [
      { label: '受ける', cls: 'primary', fn: () => acceptInvite(inv) },
      { label: '断る', fn: () => net.declineInvite(inv.id), onTimeout: () => net.declineInvite(inv.id) },
    ],
  });
  inviteToasts.set(inv.id, () => { close(); inviteToasts.delete(inv.id); });
}
async function acceptInvite(inv) {
  if (pending) { pending.cancel(); pending = null; }
  const closeT = toast('接続中…', { timeout: 0 });
  try { const conn = await net.joinRoom(inv.id); closeT(); startOnline(conn); }
  catch (e) { closeT(); toast('接続できませんでした: ' + errMsg(e)); }
}

// ===== フレンド =====
function syncFriendWatch() {
  const ids = new Set(friendState.friends.map(f => f.uid));
  for (const [uid, un] of friendWatch) if (!ids.has(uid)) { un(); friendWatch.delete(uid); }
  for (const uid of ids) if (!friendWatch.has(uid)) {
    friendWatch.set(uid, () => {});
    social.watchUser(uid, p => { friendInfo[uid] = p; renderFriends(); }).then(un => {
      if (friendWatch.has(uid)) friendWatch.set(uid, un); else un();
    });
  }
}

function updateFriendBadge() {
  const btn = document.querySelector('.big[data-go="friends"] b');
  if (btn) btn.dataset.badge = friendState.incoming.length || '';
}

function renderFriends() {
  if (current !== 'friends') return;
  const empty = t => `<li class="empty">${t}</li>`;
  $('frIncoming').innerHTML = friendState.incoming.map(r => `
    <li><span class="dot"></span><b>${esc(r.fromName)}</b>
      <span class="grow"></span><button class="small primary" data-acc="${r.id}">承認</button><button class="small ghost" data-del="${r.id}">拒否</button></li>`).join('') || empty('申請はありません');
  $('frOutgoing').innerHTML = friendState.outgoing.map(r => `
    <li><span class="dot"></span><b>${esc(r.toName)}</b><small>承認待ち</small>
      <span class="grow"></span><button class="small ghost" data-del="${r.id}">取り消す</button></li>`).join('') || empty('ありません');
  const now = Date.now();
  $('frList').innerHTML = friendState.friends.map(f => {
    const p = friendInfo[f.uid];
    const on = p && now - (p.lastSeen || 0) < 150000;
    return `<li><span class="dot ${on ? 'on' : ''}" title="${on ? 'オンライン' : 'オフライン'}"></span>
      <b>${esc(p?.username || f.username)}</b><small>${p ? `ID: ${esc(p.playerId)}・${p.wins || 0}勝${p.losses || 0}敗` : ''}</small>
      <span class="grow"></span>
      <button class="small primary" data-fight="${f.uid}" ${on ? '' : 'title="オフラインの可能性があります"'}>⚔️ 対戦</button>
      <button class="small ghost" data-del="${f.reqId}" data-confirm="1">削除</button></li>`;
  }).join('') || empty('まだフレンドがいません。プレイヤーIDで追加しよう！');
}

$('scr-friends').addEventListener('click', async e => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.acc) { await social.acceptFriend(t.dataset.acc); toast('フレンドになりました！'); }
    else if (t.dataset.del) {
      if (t.dataset.confirm && !confirm('フレンドを削除しますか？')) return;
      await social.removeFriendRequest(t.dataset.del);
    } else if (t.dataset.fight) {
      const p = friendInfo[t.dataset.fight] || await social.getProfile(t.dataset.fight);
      if (p) doChallenge(p);
    }
  } catch (err) { toast(errMsg(err)); }
});

$('frAdd').onclick = async () => {
  const msg = $('frMsg');
  try {
    const target = await social.findPlayer($('frInput').value);
    const r = await social.sendFriendRequest(profile, target);
    msg.textContent = { sent: `${target.username} さんに申請しました`, accepted: `${target.username} さんとフレンドになりました！`,
      already: 'すでにフレンドです', pending: '申請済みです' }[r];
    $('frInput').value = '';
  } catch (e) { msg.textContent = errMsg(e); }
};
$('frInput').onkeydown = e => { if (e.key === 'Enter') $('frAdd').click(); };

// ===== 起動 =====
renderHome();
renderUser();
if (firebaseEnabled) {
  social.startPlayer(settings.name || defaultName())
    .then(p => {
      profile = p;
      if (!settings.name) { settings.name = p.username; saveSettings(); }
      startOnlineFeatures();
    })
    .catch(e => { profileError = 'オンラインに接続できませんでした: ' + errMsg(e); renderUser(); toast(profileError, { timeout: 8000 }); });
}
