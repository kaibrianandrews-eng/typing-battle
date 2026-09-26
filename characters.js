// オリジナルのアニメ風キャラクター（既存作品のキャラクターではありません）
export const CHARACTERS = [
  { id: 'akari', name: '焔堂アカリ', title: '紅蓮の剣士', element: '炎', hp: 150, atk: 1.1,
    color: '#ff5a3c', hair: '#d8322a', eye: '#ffb000', acc: 'headband',
    quote: 'この炎、止められるものなら止めてみな！',
    special: { name: '紅蓮焔舞', desc: '炎の連撃で 40 ダメージ', dmg: 40 } },
  { id: 'setsuna', name: '氷室セツナ', title: '氷晶の魔導士', element: '氷', hp: 140, atk: 1.0,
    color: '#58c6ff', hair: '#cdeeff', eye: '#2b7bff', acc: 'crystal',
    quote: '凍てつきなさい。…静かにね。',
    special: { name: '絶対零度', desc: '22 ダメージ＋相手を 3 秒凍結（入力不能）', dmg: 22, freeze: 3000 } },
  { id: 'raika', name: '雷丸ライカ', title: '迅雷の忍', element: '雷', hp: 130, atk: 1.15,
    color: '#ffd21f', hair: '#2a2a3a', eye: '#ffd21f', acc: 'scarf',
    quote: '一瞬で終わらせる。',
    special: { name: '轟雷連閃', desc: 'シールドを貫通する 35 ダメージ', dmg: 35, pierce: true } },
  { id: 'miko', name: '桜咲ミコ', title: '桜花の巫女', element: '桜', hp: 160, atk: 0.9,
    color: '#ff8fc7', hair: '#ff9fcf', eye: '#c02a6a', acc: 'bow',
    quote: '桜よ、みんなを守って！',
    special: { name: '桜花結界', desc: 'HP を 35 回復＋3 回分のシールド', dmg: 0, heal: 35, shield: 3 } },
  { id: 'jin', name: '黒鉄ジン', title: '鋼鉄の機兵使い', element: '鋼', hp: 170, atk: 0.95,
    color: '#9aa5b1', hair: '#44505c', eye: '#35e0c0', acc: 'goggles',
    quote: '出力最大…撃てぇっ！',
    special: { name: '機神砲・零式', desc: '50 ダメージ（反動で自分に 8 ダメージ）', dmg: 50, recoil: 8 } },
  { id: 'luna', name: '星野ルナ', title: '流星の魔法少女', element: '星', hp: 135, atk: 1.0,
    color: '#b77dff', hair: '#ffe066', eye: '#9b4dff', acc: 'star',
    quote: 'アンコールはまだまだこれから♪',
    special: { name: 'スターライト・アンコール', desc: '25 ダメージ＋相手の必殺ゲージを 0 に', dmg: 25, drain: true } },
  { id: 'sora', name: '風間ソラ', title: '疾風の弓使い', element: '風', hp: 145, atk: 1.05,
    color: '#3fd68a', hair: '#2e8b57', eye: '#7cffb2', acc: 'feather',
    quote: '風向き、よし！',
    special: { name: '天翔疾風矢', desc: '25 ダメージ＋8 秒間攻撃力 1.6 倍', dmg: 25, boost: 8000 } },
  { id: 'kurou', name: '闇月クロウ', title: '月影の影使い', element: '闇', hp: 140, atk: 1.05,
    color: '#8a6cff', hair: '#1b1330', eye: '#ff3b6b', acc: 'horns',
    quote: '影に呑まれろ。',
    special: { name: '月蝕・影縫い', desc: '28 ダメージ＋相手の文字を 5 秒間隠す', dmg: 28, blind: 5000 } },
];

export const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

function accessory(c) {
  switch (c.acc) {
    case 'headband': return `<rect x="20" y="30" width="60" height="7" rx="3" fill="${c.color}"/>
      <path d="M80 33 L94 28 L90 38 Z M80 35 L96 40 L88 44 Z" fill="${c.color}"/>`;
    case 'crystal': return `<polygon points="72,14 78,24 72,34 66,24" fill="#e8fbff" stroke="${c.color}" stroke-width="2"/>`;
    case 'scarf': return `<path d="M24 74 Q50 90 76 74 L78 92 Q50 100 22 92 Z" fill="#23233a"/>
      <path d="M70 84 L92 92 L84 98 Z" fill="#23233a"/>`;
    case 'bow': return `<path d="M64 14 L80 4 L80 24 Z M64 14 L48 4 L48 24 Z" fill="#ff4f8b"/><circle cx="64" cy="14" r="4" fill="#ffd6e7"/>`;
    case 'goggles': return `<rect x="22" y="26" width="56" height="5" fill="#333"/>
      <circle cx="38" cy="28" r="8" fill="#35e0c0" stroke="#333" stroke-width="3" opacity=".9"/>
      <circle cx="62" cy="28" r="8" fill="#35e0c0" stroke="#333" stroke-width="3" opacity=".9"/>`;
    case 'star': return `<polygon points="76,10 79,18 88,18 81,23 84,31 76,26 68,31 71,23 64,18 73,18" fill="#fff36b" stroke="#ff9f1c" stroke-width="1.5"/>`;
    case 'feather': return `<path d="M18 40 Q6 20 20 6 Q24 24 22 40 Z" fill="#9dffc8" stroke="#2e8b57" stroke-width="1.5"/>`;
    case 'horns': return `<path d="M28 22 L20 4 L36 16 Z M72 22 L80 4 L64 16 Z" fill="#2a1a40" stroke="#8a6cff" stroke-width="1.5"/>`;
    default: return '';
  }
}

export function avatarSVG(c, cls = '') {
  const skin = '#ffe1cf';
  const eye = (x) => `
    <ellipse cx="${x}" cy="58" rx="7" ry="9" fill="#fff"/>
    <ellipse cx="${x}" cy="59" rx="5.5" ry="7.5" fill="${c.eye}"/>
    <ellipse cx="${x}" cy="60" rx="2.6" ry="3.8" fill="#1a1022"/>
    <circle cx="${x - 2}" cy="55.5" r="2" fill="#fff"/>
    <path d="M${x - 8} 49 Q${x} 45 ${x + 8} 49" stroke="#1a1022" stroke-width="2" fill="none"/>`;
  return `<svg class="avatar ${cls}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}">
    <defs><radialGradient id="bg-${c.id}" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="${c.color}" stop-opacity=".55"/><stop offset="1" stop-color="${c.color}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="50" cy="50" r="50" fill="url(#bg-${c.id})"/>
    <ellipse cx="50" cy="50" rx="38" ry="42" fill="${c.hair}"/>
    <ellipse cx="50" cy="58" rx="28" ry="29" fill="${skin}"/>
    <path d="M20 50 Q22 14 50 13 Q78 14 80 50 L73 36 L65 46 L57 32 L48 45 L40 32 L32 46 L26 38 Z" fill="${c.hair}"/>
    ${eye(39)}${eye(61)}
    <ellipse cx="32" cy="70" rx="5" ry="2.5" fill="#ff8fa8" opacity=".55"/>
    <ellipse cx="68" cy="70" rx="5" ry="2.5" fill="#ff8fa8" opacity=".55"/>
    <path d="M45 74 Q50 78 55 74" stroke="#a0404f" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${accessory(c)}
  </svg>`;
}
