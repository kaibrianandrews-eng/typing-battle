// ===== 日本語ローマ字入力エンジン =====
// shi/si, tsu/tu, chi/ti, ja/jya/zya, っ の子音重ね、ん の n/nn などの揺れに対応

const T = {
  'あ':['a'],'い':['i','yi'],'う':['u','wu','whu'],'え':['e'],'お':['o'],
  'か':['ka','ca'],'き':['ki'],'く':['ku','cu','qu'],'け':['ke'],'こ':['ko','co'],
  'さ':['sa'],'し':['si','shi','ci'],'す':['su'],'せ':['se','ce'],'そ':['so'],
  'た':['ta'],'ち':['ti','chi'],'つ':['tu','tsu'],'て':['te'],'と':['to'],
  'な':['na'],'に':['ni'],'ぬ':['nu'],'ね':['ne'],'の':['no'],
  'は':['ha'],'ひ':['hi'],'ふ':['hu','fu'],'へ':['he'],'ほ':['ho'],
  'ま':['ma'],'み':['mi'],'む':['mu'],'め':['me'],'も':['mo'],
  'や':['ya'],'ゆ':['yu'],'よ':['yo'],
  'ら':['ra'],'り':['ri'],'る':['ru'],'れ':['re'],'ろ':['ro'],
  'わ':['wa'],'を':['wo'],
  'が':['ga'],'ぎ':['gi'],'ぐ':['gu'],'げ':['ge'],'ご':['go'],
  'ざ':['za'],'じ':['zi','ji'],'ず':['zu'],'ぜ':['ze'],'ぞ':['zo'],
  'だ':['da'],'ぢ':['di'],'づ':['du'],'で':['de'],'ど':['do'],
  'ば':['ba'],'び':['bi'],'ぶ':['bu'],'べ':['be'],'ぼ':['bo'],
  'ぱ':['pa'],'ぴ':['pi'],'ぷ':['pu'],'ぺ':['pe'],'ぽ':['po'],
  'ぁ':['xa','la'],'ぃ':['xi','li'],'ぅ':['xu','lu'],'ぇ':['xe','le'],'ぉ':['xo','lo'],
  'ゃ':['xya','lya'],'ゅ':['xyu','lyu'],'ょ':['xyo','lyo'],'ゎ':['xwa','lwa'],
  'っ':['xtu','ltu','xtsu','ltsu'],
  'ゔ':['vu'],
  'ー':['-'],'、':[','],'。':['.'],'！':['!'],'？':['?'],'　':[' '],' ':[' '],
  '・':['/'],'「':['['],'」':[']'],'〜':['~'],
};

const Y = {
  'きゃ':['kya'],'きゅ':['kyu'],'きょ':['kyo'],'きぇ':['kye'],
  'しゃ':['sya','sha'],'しゅ':['syu','shu'],'しょ':['syo','sho'],'しぇ':['she','sye'],
  'ちゃ':['tya','cha','cya'],'ちゅ':['tyu','chu','cyu'],'ちょ':['tyo','cho','cyo'],'ちぇ':['tye','che','cye'],
  'にゃ':['nya'],'にゅ':['nyu'],'にょ':['nyo'],
  'ひゃ':['hya'],'ひゅ':['hyu'],'ひょ':['hyo'],
  'みゃ':['mya'],'みゅ':['myu'],'みょ':['myo'],
  'りゃ':['rya'],'りゅ':['ryu'],'りょ':['ryo'],
  'ぎゃ':['gya'],'ぎゅ':['gyu'],'ぎょ':['gyo'],
  'じゃ':['ja','zya','jya'],'じゅ':['ju','zyu','jyu'],'じょ':['jo','zyo','jyo'],'じぇ':['je','zye','jye'],
  'ぢゃ':['dya'],'ぢゅ':['dyu'],'ぢょ':['dyo'],
  'びゃ':['bya'],'びゅ':['byu'],'びょ':['byo'],
  'ぴゃ':['pya'],'ぴゅ':['pyu'],'ぴょ':['pyo'],
  'ふぁ':['fa'],'ふぃ':['fi'],'ふぇ':['fe'],'ふぉ':['fo'],
  'てぃ':['thi'],'でぃ':['dhi'],'でゅ':['dhu'],'とぅ':['twu'],'どぅ':['dwu'],
  'うぃ':['wi'],'うぇ':['we'],'ゔぁ':['va'],'ゔぃ':['vi'],'ゔぇ':['ve'],'ゔぉ':['vo'],
  'つぁ':['tsa'],
};
// 拗音は「き」+「ゃ」のように分けて打っても OK
for (const k of Object.keys(Y)) {
  const a = T[k[0]], b = T[k[1]];
  if (a && b) for (const x of a) for (const y of b) if (!Y[k].includes(x + y)) Y[k].push(x + y);
}

export function toHiragana(s) {
  return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function optsOf(u) {
  if (Y[u]) return Y[u];
  if (T[u]) return T[u];
  return [u.toLowerCase()]; // 英数字などはそのまま
}

export function buildUnits(kana) {
  const s = toHiragana(kana);
  const base = [];
  for (let i = 0; i < s.length;) {
    const two = s.slice(i, i + 2);
    if (Y[two]) { base.push(two); i += 2; } else { base.push(s[i]); i++; }
  }
  const units = [];
  for (let i = 0; i < base.length; i++) {
    const u = base[i];
    if (u === 'っ' && i + 1 < base.length && base[i + 1] !== 'っ' && base[i + 1] !== 'ん') {
      const next = base[i + 1];
      const set = new Set();
      for (const o of optsOf(next)) {
        if (/^[bcdfghjklmpqrstvwxyz]/.test(o)) set.add(o[0] + o);
        if (o.startsWith('ch')) set.add('t' + o);
      }
      for (const x of T['っ']) for (const o of optsOf(next)) set.add(x + o);
      units.push({ kana: u + next, opts: [...set] });
      i++;
      continue;
    }
    units.push({ kana: u, opts: optsOf(u).slice() });
  }
  for (let i = 0; i < units.length; i++) {
    if (units[i].kana === 'ん') {
      const next = units[i + 1];
      const o = ['nn', 'xn'];
      if (next && next.opts.every(p => !/^[aiueony]/.test(p))) o.unshift('n');
      units[i].opts = o;
    }
  }
  return units;
}

export class KanaTyper {
  constructor(kana) {
    this.units = buildUnits(kana);
    this.i = 0; this.buf = ''; this.committed = '';
  }
  get done() { return this.i >= this.units.length; }
  input(k) {
    if (this.done) return { ok: false };
    k = k.toLowerCase();
    const u = this.units[this.i];
    const ext = u.opts.filter(o => o.startsWith(this.buf + k));
    if (ext.length) {
      this.buf += k;
      if (ext.length === 1 && ext[0] === this.buf) this.commit();
      return { ok: true, done: this.done };
    }
    // 「ん」を n 1回で確定させて次の文字として解釈する
    if (this.buf && u.opts.includes(this.buf)) {
      const saved = [this.i, this.buf, this.committed];
      this.commit();
      if (!this.done) {
        const r = this.input(k);
        if (r.ok) return r;
      }
      [this.i, this.buf, this.committed] = saved;
    }
    return { ok: false };
  }
  commit() { this.committed += this.buf; this.i++; this.buf = ''; }
  typed() { return this.committed + this.buf; }
  remaining() {
    if (this.done) return '';
    const cur = this.units[this.i].opts.find(o => o.startsWith(this.buf)) ?? '';
    let s = cur.slice(this.buf.length);
    for (let j = this.i + 1; j < this.units.length; j++) s += this.units[j].opts[0];
    return s;
  }
}

export class TextTyper {
  constructor(text, { ignoreAccents = true } = {}) {
    this.t = [...text]; this.i = 0; this.ia = ignoreAccents;
  }
  norm(c) { return this.ia ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : c; }
  get done() { return this.i >= this.t.length; }
  input(k) {
    if (this.done) return { ok: false };
    const want = this.t[this.i];
    if (k === want || this.norm(k) === this.norm(want)) { this.i++; return { ok: true, done: this.done }; }
    return { ok: false };
  }
  typed() { return this.t.slice(0, this.i).join(''); }
  remaining() { return this.t.slice(this.i).join(''); }
}
