// Mission · Collaboration: several weak waves line up and add into one strong signal.
import { TAU, seg, ease, lerp } from './kit.js';

export default {
  duration: 8,
  still: 5.5,
  draw(api) {
    const { w, h, t, pal } = api;
    const x0 = w * 0.06;
    const x1 = w * 0.94;
    const align = ease.inOut(seg(t, 1, 4.5)) * (1 - ease.inOut(seg(t, 6.8, 8)));
    const phases = [2.1, -1.4, 0.7];
    const k = TAU * 2.2 / (x1 - x0);
    const row = h * 0.2;
    const sumY = h * 0.72;
    phases.forEach((ph, i) => {
      const p = lerp(ph, 0, align);
      const y = row + i * h * 0.085;
      api.wave(x0, x1, (x) => y - Math.sin((x - x0) * k - t * 2 + p) * h * 0.035, { color: pal.ink3, width: api.s(1.3) });
    });
    api.wave(x0, x1, (x) => {
      let s = 0;
      phases.forEach((ph) => { s += Math.sin((x - x0) * k - t * 2 + lerp(ph, 0, align)); });
      return sumY - s * h * 0.05;
    }, { color: api.accent, width: api.s(2.4) });
    api.text('together', x0, h * 0.95, { size: api.fs(11), color: api.accentInk, alpha: 0.4 + 0.6 * align });
  },
};
