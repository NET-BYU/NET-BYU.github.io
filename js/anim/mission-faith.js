// Mission · Faith: noisy samples average together until the true signal underneath appears.
import { TAU, seg, ease, rng } from './kit.js';

const N = 96; // samples across the figure
const PASSES = 40;

export default {
  duration: 10,
  still: 8.6,
  init() {
    const r = rng('faith');
    const truth = Array.from({ length: N }, (_, i) => Math.sin((i / (N - 1)) * TAU * 1.5) * 0.8);
    const noise = Array.from({ length: PASSES }, () => Array.from({ length: N }, () => r.gauss() * 0.6));
    // Running averages after 1..PASSES passes.
    const avg = [];
    const sum = new Float32Array(N);
    for (let p = 0; p < PASSES; p++) {
      for (let i = 0; i < N; i++) sum[i] += truth[i] + noise[p][i];
      avg.push(Array.from(sum, (v) => v / (p + 1)));
    }
    return { truth, noise, avg };
  },
  draw(api, s) {
    const { w, h, t, pal } = api;
    const x0 = w * 0.08;
    const x1 = w * 0.92;
    const mid = h * 0.5;
    const amp = h * 0.24;
    // Passes arrive slowly at first, then faster.
    const p = ease.in(seg(t, 0.4, 8.2));
    const n = Math.max(1, Math.min(PASSES, Math.round(1 + p * (PASSES - 1))));
    const fade = 1 - seg(t, 9.3, 10);
    const X = (i) => x0 + (i / (N - 1)) * (x1 - x0);
    // The latest pass of raw samples.
    for (let i = 0; i < N; i++) {
      api.circle(X(i), mid - (s.truth[i] + s.noise[n - 1][i]) * amp, api.s(1.6), { fill: pal.ink3, alpha: 0.6 * fade });
    }
    // The average so far.
    api.line(s.avg[n - 1].map((v, i) => [X(i), mid - v * amp]), { color: api.accent, width: api.s(2.2), alpha: fade });
    api.text(`average of ${n}`, x1, h * 0.93, { size: api.fs(11), color: api.accentInk, align: 'right', alpha: fade });
  },
};
