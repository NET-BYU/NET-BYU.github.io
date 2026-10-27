// Mission · Faith: noisy samples average together until the true signal underneath appears.
import { TAU, seg, rng } from './kit.js';

const N = 90;
export default {
  duration: 9,
  still: 7.5,
  init() {
    const r = rng('faith');
    return Array.from({ length: N * 6 }, () => r.gauss());
  },
  draw(api, noise) {
    const { w, h, t, pal } = api;
    const x0 = w * 0.08;
    const x1 = w * 0.92;
    const mid = h * 0.5;
    const amp = h * 0.24;
    const truth = (u) => Math.sin(u * TAU * 1.5) * 0.8;
    const passes = Math.min(6, Math.floor(seg(t, 0.3, 7.2) * 6.999) + 1);
    const fade = 1 - seg(t, 8.3, 9);
    // Raw samples from the latest pass
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const v = truth(u) + noise[(passes - 1) * N + i] * 0.55;
      api.circle(x0 + u * (x1 - x0), mid - v * amp, api.s(1.6), { fill: pal.ink3, alpha: 0.75 * fade });
    }
    // Running average across passes so far
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      let sum = 0;
      for (let p = 0; p < passes; p++) sum += truth(u) + noise[p * N + i] * 0.55;
      pts.push([x0 + u * (x1 - x0), mid - (sum / passes) * amp]);
    }
    api.line(pts, { color: api.accent, width: api.s(2.2), alpha: fade });
    api.text(`average of ${passes}`, x1, h * 0.92, { size: api.fs(11), color: api.accentInk, align: 'right', alpha: fade });
  },
};
