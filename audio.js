let ctx = null;
let enabled = true;
export function setSound(v) { enabled = v; }

function tone(freq, dur = 0.06, type = 'square', vol = 0.05, slide = 0) {
  if (!enabled) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* 音が出せない環境は無視 */ }
}

const seq = (notes, gap, dur, type, vol) => notes.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * gap));

export const sfx = {
  key: () => tone(900, 0.025, 'square', 0.015),
  miss: () => tone(150, 0.12, 'sawtooth', 0.04),
  hit: () => tone(320, 0.15, 'triangle', 0.08, -200),
  hurt: () => tone(120, 0.2, 'sawtooth', 0.06, -60),
  ready: () => seq([660, 990], 80, 0.1, 'square', 0.04),
  special: () => seq([440, 660, 880, 1320], 90, 0.25, 'sawtooth', 0.05),
  count: () => tone(520, 0.12, 'square', 0.05),
  go: () => tone(1040, 0.3, 'square', 0.05),
  win: () => seq([523, 659, 784, 1047], 130, 0.25, 'triangle', 0.08),
  lose: () => seq([392, 330, 262, 196], 160, 0.3, 'triangle', 0.07),
};
