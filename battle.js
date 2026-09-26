import { avatarSVG } from './characters.js';
import { makeWordSource } from './words.js';
import { sfx } from './audio.js';

export const MAX_SP = 100;
const now = () => performance.now();
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function newFighter(ch) {
  return { ch, hp: ch.hp, maxHp: ch.hp, sp: 0, shield: 0, frozenUntil: 0, blindUntil: 0, boostUntil: 0, progress: 0 };
}

export function wordDamage(keys, combo, f) {
  const base = 3 + keys * 0.55;
  const comboMult = 1 + Math.min(combo, 20) * 0.04;
  const boost = f.boostUntil > now() ? 1.6 : 1;
  return Math.max(1, Math.round(base * comboMult * f.ch.atk * boost));
}

// 必殺技を発動: 自分への効果を適用し、相手に送る攻撃を返す
export function useSpecial(f) {
  const s = f.ch.special;
  if (s.heal) f.hp = Math.min(f.maxHp, f.hp + s.heal);
  if (s.shield) f.shield = s.shield;
  if (s.boost) f.boostUntil = now() + s.boost;
  if (s.recoil) f.hp = Math.max(1, f.hp - s.recoil);
  f.sp = 0;
  return { dmg: s.dmg || 0, pierce: !!s.pierce, freeze: s.freeze || 0, blind: s.blind || 0, drain: !!s.drain, special: f.ch.id };
}

export function receiveAttack(f, atk) {
  let dmg = atk.dmg || 0, blocked = false;
  if (dmg > 0 && f.shield > 0 && !atk.pierce) { f.shield--; dmg = Math.round(dmg * 0.3); blocked = true; }
  f.hp = Math.max(0, f.hp - dmg);
  if (atk.freeze) f.frozenUntil = now() + atk.freeze;
  if (atk.blind) f.blindUntil = now() + atk.blind;
  if (atk.drain) f.sp = 0; else f.sp = Math.min(MAX_SP, f.sp + dmg * 0.4);
  return { dmg, blocked };
}

// ===== NPC =====
export const NPC_LEVELS = {
  easy:   { name: 'かんたん',   kps: 2.2, acc: 0.90 },
  normal: { name: 'ふつう',     kps: 3.6, acc: 0.94 },
  hard:   { name: 'むずかしい', kps: 5.2, acc: 0.97 },
  oni:    { name: '鬼',         kps: 7.5, acc: 0.99 },
};

export class NpcOpponent {
  constructor(level) { this.lv = NPC_LEVELS[level] || NPC_LEVELS.normal; }
  attach(b) { this.b = b; this.f = b.opp; }
  start() { this.combo = 0; this.newWord(); this.loop(); }
  newWord() { this.total = 5 + Math.floor(Math.random() * 9); this.left = this.total; }
  loop() {
    let delay = 1000 / this.lv.kps * (0.6 + Math.random() * 0.8);
    if (this.f.blindUntil > now()) delay *= 1.8;
    this.timer = setTimeout(() => { if (!this.b.running) return; this.step(); this.loop(); }, delay);
  }
  step() {
    const f = this.f;
    if (!this.b.inputReady || f.frozenUntil > now()) return;
    if (f.sp >= MAX_SP && Math.random() < 0.35) {
      const atk = useSpecial(f);
      this.b.renderFighter('opp');
      this.b.applyIncoming(atk);
      return;
    }
    if (Math.random() > this.lv.acc) { this.combo = 0; this.b.flash('opp', 'miss'); return; }
    f.sp = Math.min(MAX_SP, f.sp + 0.7);
    this.left--;
    if (this.left <= 0) {
      this.combo++;
      f.sp = Math.min(MAX_SP, f.sp + 3);
      this.b.applyIncoming({ dmg: wordDamage(this.total, this.combo, f) });
      this.newWord();
    }
    f.progress = 1 - this.left / this.total;
    this.b.renderFighter('opp');
  }
  sendAttack(atk) {
    if (atk.special) this.b.showSpecial(this.b.me.ch, 'me');
    const r = receiveAttack(this.f, atk);
    this.b.popDamage('opp', r);
    this.b.renderFighter('opp');
    if (this.f.hp <= 0) this.b.finish('win');
  }
  notifyState() {}
  notifyKO() {}
  stop() { clearTimeout(this.timer); }
}

// ===== オンライン相手（WebRTC DataChannel 経由） =====
export class NetOpponent {
  constructor(conn) { this.conn = conn; this.lastSent = 0; }
  attach(b) { this.b = b; }
  start() {}
  onMsg(m) {
    const b = this.b;
    if (!b) return;
    if (m.t === 'atk') b.applyIncoming(m.atk);
    else if (m.t === 'state') {
      const o = b.opp, s = m.s, t = now();
      Object.assign(o, { hp: s.hp, maxHp: s.maxHp, sp: s.sp, shield: s.shield, progress: s.progress,
        frozenUntil: t + (s.fz || 0), blindUntil: t + (s.bl || 0), boostUntil: t + (s.bo || 0) });
      b.renderFighter('opp');
      if (s.miss) b.flash('opp', 'miss');
    } else if (m.t === 'ko') b.finish('win');
  }
  sendAttack(atk) {
    if (atk.special) this.b.showSpecial(this.b.me.ch, 'me');
    this.conn.send({ t: 'atk', atk });
  }
  notifyState(f, extra = {}) {
    const t = now();
    this.conn.send({ t: 'state', s: {
      hp: f.hp, maxHp: f.maxHp, sp: Math.round(f.sp), shield: f.shield, progress: f.progress,
      fz: Math.max(0, f.frozenUntil - t), bl: Math.max(0, f.blindUntil - t), bo: Math.max(0, f.boostUntil - t), ...extra } });
  }
  notifyKO() { this.conn.send({ t: 'ko' }); }
  stop() {}
}

// ===== バトル本体 =====
export class Battle {
  constructor({ me, opp, settings, opponent, onEnd }) {
    this.me = newFighter(me.ch); this.me.name = me.name;
    this.opp = newFighter(opp.ch); this.opp.name = opp.name;
    this.settings = settings;
    this.opponent = opponent;
    this.onEnd = onEnd;
    this.nextWord = makeWordSource(settings.lang, settings);
    this.combo = 0; this.maxCombo = 0;
    this.stats = { keys: 0, miss: 0, words: 0, dealt: 0 };
    this.running = false; this.inputReady = false;
    this.onKey = this.onKey.bind(this);
    opponent.attach(this);
  }

  mount() {
    this.buildFighter('me'); this.buildFighter('opp');
    this.word = this.nextWord();
    this.renderWord(); this.renderAll();
    $('bTimer').textContent = this.settings.timeLimit;
    $('bCombo').textContent = '';
    this.running = true;
    document.addEventListener('keydown', this.onKey);
    this.tickTimer = setInterval(() => this.tick(), 200);
  }

  go() {
    this.inputReady = true;
    this.startAt = now();
    this.opponent.start();
  }

  buildFighter(side) {
    const f = side === 'me' ? this.me : this.opp;
    $(side === 'me' ? 'fMe' : 'fOpp').innerHTML = `
      <div class="f-avatar" style="--c:${f.ch.color}">${avatarSVG(f.ch)}</div>
      <div class="f-info">
        <div class="f-name">${esc(f.name)}<small>${esc(f.ch.name)}</small></div>
        <div class="bar hp"><div class="fill"></div><span class="val"></span></div>
        <div class="bar sp"><div class="fill"></div><span class="val"></span></div>
        <div class="bar prog"><div class="fill"></div></div>
        <div class="f-status"></div>
      </div>
      <div class="pops"></div>`;
  }

  renderAll() { this.renderFighter('me'); this.renderFighter('opp'); }

  renderFighter(side) {
    const f = side === 'me' ? this.me : this.opp;
    const el = $(side === 'me' ? 'fMe' : 'fOpp');
    if (!el.firstElementChild) return;
    const hpPct = Math.max(0, f.hp / f.maxHp * 100);
    const hp = el.querySelector('.hp');
    hp.querySelector('.fill').style.width = hpPct + '%';
    hp.classList.toggle('low', hpPct < 30);
    hp.querySelector('.val').textContent = `HP ${Math.ceil(f.hp)} / ${f.maxHp}`;
    const sp = el.querySelector('.sp');
    sp.querySelector('.fill').style.width = Math.min(100, f.sp) + '%';
    const full = f.sp >= MAX_SP;
    sp.classList.toggle('full', full);
    sp.querySelector('.val').textContent = full ? (side === 'me' ? '必殺技OK！ Enter' : '必殺技OK！') : `SP ${Math.floor(f.sp)}%`;
    el.querySelector('.prog .fill').style.width = ((f.progress || 0) * 100) + '%';
    const t = now(), st = [];
    if (f.shield > 0) st.push(`<span class="tag shield">🛡×${f.shield}</span>`);
    if (f.frozenUntil > t) st.push('<span class="tag freeze">❄凍結</span>');
    if (f.blindUntil > t) st.push('<span class="tag blind">🌑暗闇</span>');
    if (f.boostUntil > t) st.push('<span class="tag boost">⚡攻撃UP</span>');
    el.querySelector('.f-status').innerHTML = st.join('');
    el.classList.toggle('frozen', f.frozenUntil > t);
    el.classList.toggle('sp-ready', full);
  }

  renderWord() {
    const w = this.word;
    $('wDisp').textContent = w.display;
    $('wKana').textContent = w.kana && w.kana !== w.display ? w.kana : '';
    $('wTyped').textContent = w.typer.typed();
    $('wRemain').textContent = w.typer.remaining();
  }

  onKey(e) {
    if (!this.running) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.isComposing || e.key === 'Process') { this.imeWarn(); return; }
    if (e.key === 'Enter') { e.preventDefault(); this.trySpecial(); return; }
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (!this.inputReady) return;
    const t = now();
    if (this.me.frozenUntil > t) { this.flash('me', 'miss'); return; }
    const r = this.word.typer.input(e.key);
    if (r.ok) {
      sfx.key();
      this.stats.keys++;
      this.me.sp = Math.min(MAX_SP, this.me.sp + 0.7);
      const typedLen = this.word.typer.typed().length;
      this.me.progress = typedLen / (typedLen + this.word.typer.remaining().length);
      if (r.done) this.completeWord();
      this.renderWord();
    } else {
      sfx.miss();
      this.stats.miss++;
      this.combo = 0;
      $('bCombo').textContent = '';
      this.flash('me', 'miss');
      $('wordBox').classList.remove('shake'); void $('wordBox').offsetWidth; $('wordBox').classList.add('shake');
    }
    const wasFull = this._wasFull;
    this._wasFull = this.me.sp >= MAX_SP;
    if (this._wasFull && !wasFull) sfx.ready();
    this.renderFighter('me');
    this.sendState(!r.ok);
  }

  imeWarn() {
    const h = $('bHint');
    h.classList.add('warn');
    h.textContent = '⚠ IME（日本語入力）がオンです。半角英数に切り替えてください';
    clearTimeout(this._imeT);
    this._imeT = setTimeout(() => { h.classList.remove('warn'); h.textContent = this.hintText(); }, 3000);
  }
  hintText() { return 'ゲージが MAX になったら Enter で必殺技！　IME はオフ（半角英数）で'; }

  sendState(miss = false) {
    const t = now();
    if (miss || t - (this.opponent.lastSent || 0) > 60) {
      this.opponent.lastSent = t;
      this.opponent.notifyState(this.me, miss ? { miss: true } : {});
    }
  }

  completeWord() {
    const keys = this.word.typer.typed().length;
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.stats.words++;
    this.me.sp = Math.min(MAX_SP, this.me.sp + 3);
    const dmg = wordDamage(keys, this.combo, this.me);
    this.stats.dealt += dmg;
    sfx.hit();
    this.opponent.sendAttack({ dmg });
    $('bCombo').textContent = this.combo >= 2 ? `${this.combo} COMBO!` : '';
    this.word = this.nextWord();
    this.me.progress = 0;
  }

  trySpecial() {
    if (!this.inputReady || this.me.sp < MAX_SP || this.me.frozenUntil > now()) return;
    const atk = useSpecial(this.me);
    this.stats.dealt += atk.dmg;
    this._wasFull = false;
    this.opponent.sendAttack(atk);
    this.renderFighter('me');
    this.opponent.notifyState(this.me);
  }

  applyIncoming(atk) {
    if (!this.running) return;
    if (atk.special) this.showSpecial(this.opp.ch, 'opp');
    const r = receiveAttack(this.me, atk);
    this.popDamage('me', r);
    if (r.dmg > 0) sfx.hurt();
    if (atk.freeze || atk.blind) this.renderWord();
    this.renderFighter('me');
    this.opponent.notifyState(this.me);
    if (this.me.hp <= 0) { this.opponent.notifyKO(); this.finish('lose'); }
  }

  popDamage(side, { dmg, blocked }) {
    const el = $(side === 'me' ? 'fMe' : 'fOpp');
    const pops = el.querySelector('.pops');
    if (!pops) return;
    const p = document.createElement('span');
    p.className = 'pop' + (dmg >= 25 ? ' big' : '');
    p.textContent = blocked ? `🛡 -${dmg}` : (dmg > 0 ? `-${dmg}` : '');
    if (!p.textContent) return;
    p.style.left = (20 + Math.random() * 50) + '%';
    pops.appendChild(p);
    setTimeout(() => p.remove(), 1000);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }

  flash(side, cls) {
    const el = $(side === 'me' ? 'fMe' : 'fOpp');
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  showSpecial(ch, side) {
    sfx.special();
    const o = $('specialCut');
    o.style.setProperty('--c', ch.color);
    o.className = 'special-cut ' + side;
    o.innerHTML = `<div class="sc-band"><div class="sc-av">${avatarSVG(ch)}</div>
      <div class="sc-text"><small>${esc(ch.name)}</small><b>${esc(ch.special.name)}</b><em>${esc(ch.special.desc)}</em></div></div>`;
    clearTimeout(this._scT);
    this._scT = setTimeout(() => { o.className = 'special-cut hidden'; }, 1500);
  }

  tick() {
    const t = now();
    $('wordBox').classList.toggle('blind', this.me.blindUntil > t);
    $('wordBox').classList.toggle('frozen', this.me.frozenUntil > t);
    this.renderAll();
    if (!this.inputReady) return;
    const left = Math.max(0, this.settings.timeLimit - (t - this.startAt) / 1000);
    $('bTimer').textContent = Math.ceil(left);
    $('bTimer').classList.toggle('urgent', left <= 10);
    if (left <= 0) {
      const a = this.me.hp / this.me.maxHp, b = this.opp.hp / this.opp.maxHp;
      this.finish(Math.abs(a - b) < 0.005 ? 'draw' : a > b ? 'win' : 'lose', true);
    }
  }

  opponentLeft() {
    if (this.running) this.finish('win', false, '相手が退出しました');
  }

  surrender() {
    if (!this.running) return;
    this.me.hp = 0;
    this.opponent.notifyState(this.me);
    this.opponent.notifyKO();
    this.finish('lose', false, '降参しました');
  }

  finish(result, timeUp = false, note = '') {
    if (!this.running) return;
    this.running = false; this.inputReady = false;
    clearInterval(this.tickTimer);
    document.removeEventListener('keydown', this.onKey);
    this.opponent.stop();
    this.renderAll();
    result === 'win' ? sfx.win() : result === 'lose' ? sfx.lose() : null;
    const secs = Math.max(1, (now() - (this.startAt || now())) / 1000);
    const total = this.stats.keys + this.stats.miss;
    this.onEnd?.({
      result, timeUp, note,
      kpm: Math.round(this.stats.keys / secs * 60),
      accuracy: total ? Math.round(this.stats.keys / total * 1000) / 10 : 100,
      maxCombo: this.maxCombo, words: this.stats.words, dealt: this.stats.dealt,
    });
  }

  destroy() {
    this.running = false;
    clearInterval(this.tickTimer);
    document.removeEventListener('keydown', this.onKey);
    this.opponent.stop();
  }
}
