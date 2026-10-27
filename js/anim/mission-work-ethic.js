// Mission · Work ethic: steady, precise ticks build a structure one block at a time.
import { seg, ease } from './kit.js';

const COLS = 9;
const HEIGHTS = [3, 5, 4, 6, 5, 7, 6, 8, 7];
export default {
  duration: 9,
  still: 7.6,
  draw(api) {
    const { w, h, t, pal } = api;
    const total = HEIGHTS.reduce((a, b) => a + b, 0);
    const tick = 7 / total; // seconds per block
    const placed = Math.floor(seg(t, 0.2, 7.2) * total);
    const fade = 1 - seg(t, 8.3, 9);
    const gx = w * 0.12;
    const gw = w * 0.76;
    const base = h * 0.84;
    const bw = gw / COLS;
    const bh = Math.min(bw * 0.62, h * 0.085);
    let n = 0;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < HEIGHTS[c]; r++) {
        if (n < placed) {
          const age = t - 0.2 - n * tick;
          const drop = ease.out(seg(age, 0, 0.25));
          const y = base - (r + 1) * (bh + 2) - (1 - drop) * api.s(10);
          api.rect(gx + c * bw + 2, y, bw - 4, bh, { fill: n === placed - 1 ? api.accent : pal.ink2, r: api.s(2), alpha: fade * (0.4 + 0.6 * drop) });
        }
        n++;
      }
    }
    api.line([[gx - api.s(4), base], [gx + gw + api.s(4), base]], { color: pal.line, width: 1 });
    // Metronome tick
    const beat = (t / tick) % 1;
    api.circle(w * 0.9, h * 0.16, api.s(4), { fill: api.accent, alpha: fade * (beat < 0.25 ? 1 : 0.25) });
  },
};
