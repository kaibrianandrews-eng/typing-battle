import { KanaTyper, TextTyper } from './romaji.js';

// 日本語: [表示, よみ(ひらがな)]
const JA = [
  ['必殺技','ひっさつわざ'],['勇者','ゆうしゃ'],['魔法使い','まほうつかい'],['伝説の剣','でんせつのけん'],
  ['竜の咆哮','りゅうのほうこう'],['雷鳴','らいめい'],['冒険の始まり','ぼうけんのはじまり'],['友情パワー','ゆうじょうぱわー'],
  ['限界突破','げんかいとっぱ'],['覚醒','かくせい'],['桜吹雪','さくらふぶき'],['星空','ほしぞら'],['放課後','ほうかご'],
  ['秘密基地','ひみつきち'],['最終決戦','さいしゅうけっせん'],['宿命のライバル','しゅくめいのらいばる'],['異世界転生','いせかいてんせい'],
  ['ラーメン','らーめん'],['お弁当','おべんとう'],['夏祭り','なつまつり'],['花火大会','はなびたいかい'],
  ['猫の手も借りたい','ねこのてもかりたい'],['一期一会','いちごいちえ'],['七転び八起き','ななころびやおき'],
  ['キーボード','きーぼーど'],['タイピング','たいぴんぐ'],['早起きは三文の徳','はやおきはさんもんのとく'],
  ['ちょっと待って','ちょっとまって'],['準備完了','じゅんびかんりょう'],['全力疾走','ぜんりょくしっそう'],['天空の城','てんくうのしろ'],
  ['月光','げっこう'],['水しぶき','みずしぶき'],['風を切る','かぜをきる'],['炎の拳','ほのおのこぶし'],['氷の結晶','こおりのけっしょう'],
  ['新幹線','しんかんせん'],['富士山','ふじさん'],['コンビニ','こんびに'],['チョコレート','ちょこれーと'],['ゲームセンター','げーむせんたー'],
  ['勝利のポーズ','しょうりのぽーず'],['諦めない心','あきらめないこころ'],['仲間を信じろ','なかまをしんじろ'],['行くぞ！','いくぞ！'],
  ['負けないよ','まけないよ'],['本気を出す','ほんきをだす'],['修行の成果','しゅぎょうのせいか'],['ファンタジー','ふぁんたじー'],
  ['パーティー','ぱーてぃー'],['ヴァイオリン','ゔぁいおりん'],['きっと勝てる','きっとかてる'],['宝箱','たからばこ'],
  ['隠しボス','かくしぼす'],['経験値','けいけんち'],['回復魔法','かいふくまほう'],['会心の一撃','かいしんのいちげき'],
];

export const LANGS = {
  ja: { name: '日本語（ローマ字入力）', kana: true, items: JA },
  en: { name: 'English', items: [
    'attack','shield','dragon','phoenix','lightning','combo','victory','keyboard','special move','level up',
    'critical hit','final boss','power up','game over','never give up','speed','legend','hero','magic',
    'thunder strike','ice storm','shadow','galaxy','warrior','ninja','samurai','quest','adventure','treasure',
    'battle royale','practice makes perfect','press start','high score','boost','counter','dodge','energy',
    'spirit','destiny','rival','friendship','courage','storm','blaze','frost','spark','wind blade','moonlight',
    'starfall','the quick brown fox','hidden power','ultimate','respawn','checkpoint','side quest'] },
  es: { name: 'Español', items: [
    'espada','dragón','batalla','victoria','amistad','corazón','relámpago','estrella','fuego','hielo','guerrero',
    'magia','tormenta','leyenda','héroe','poder','valiente','sombra','luna','viento','nunca te rindas',
    'golpe crítico','ataque especial','mañana','canción','montaña','música','rápido','teclado','campeón'] },
  fr: { name: 'Français', items: [
    'épée','dragon','combat','victoire','amitié','éclair','étoile','feu','glace','guerrier','magie','tempête',
    'légende','héros','pouvoir','courageux','ombre','lune','vent','ne jamais abandonner','attaque spéciale',
    'clavier','rapide','aventure','trésor','sorcier','tonnerre','champion','château','rêve'] },
  de: { name: 'Deutsch', items: [
    'Schwert','Drache','Kampf','Sieg','Freundschaft','Blitz','Stern','Feuer','Eis','Krieger','Magie','Sturm',
    'Legende','Held','Kraft','mutig','Schatten','Mond','Wind','niemals aufgeben','Spezialangriff','Tastatur',
    'schnell','Abenteuer','Schatz','Zauberer','Donner','Glück','Übung','Meister'] },
  code: { name: 'プログラミング（JavaScript）', items: [
    'const','let','function','return','async','await','console.log()','addEventListener','querySelector',
    'Promise.all()','JSON.parse(data)','for (let i = 0; i < n; i++)','if (hp <= 0)','export default',
    "import { useState } from 'react'",'arr.map(x => x * 2)','new Map()','Object.keys(obj)','setTimeout(fn, 1000)',
    'class Hero extends Fighter','this.hp -= damage',"value ?? 'default'",'typeof value','Math.random()',
    'arr.filter(Boolean)','await fetch(url)','try { attack() } catch (e) {}'] },
  custom: { name: 'カスタム（自分の単語）', items: [] },
};

const KANA_ONLY = /^[ぁ-ゖァ-ヺー、。！？ 　]+$/;

// カスタム単語: 1行1語。「表示|よみ」形式、またはひらがな/カタカナのみなら日本語入力扱い
export function parseCustom(text) {
  return text.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    if (line.includes('|')) { const [d, k] = line.split('|'); return { display: d.trim(), kana: k.trim() }; }
    if (KANA_ONLY.test(line)) return { display: line, kana: line };
    return { display: line };
  });
}

export function makeWordSource(lang, settings) {
  let pool;
  if (lang === 'custom') {
    pool = parseCustom(settings.custom || '');
    if (!pool.length) pool = LANGS.en.items.map(w => ({ display: w }));
  } else if (LANGS[lang]?.kana) {
    pool = LANGS[lang].items.map(([d, k]) => ({ display: d, kana: k }));
  } else {
    pool = (LANGS[lang] || LANGS.en).items.map(w => ({ display: w }));
  }
  let last = -1;
  return () => {
    let i;
    do { i = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && i === last);
    last = i;
    const item = pool[i];
    const typer = item.kana ? new KanaTyper(item.kana) : new TextTyper(item.display, { ignoreAccents: settings.ignoreAccents !== false });
    return { ...item, typer };
  };
}
