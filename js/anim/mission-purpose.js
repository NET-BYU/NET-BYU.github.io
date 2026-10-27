// Mission · Purpose: a signal leaves its transmitter and lands exactly on its receiver.
import { TAU, seg, ease, lerp } from './kit.js';

export default {
  duration: 6,
  still: 4.2,
  draw(api) {
    const { w, h, t, pal } = api;
    const y = h * 0.52;
    const x0 = w * 0.14;
    const x1 = w * 0.86;
    const fly = ease.inOut(seg(t, 0.6, 3.4));
    const land = seg(t, 3.4, 3.9);
    const fade = 1 - seg(t, 5.4, 6);
    api.line([[x0, y], [x1, y]], { color: pal.line, width: 1, dash: [api.s(3), api.s(5)] });
    // Transmitter
    api.rect(x0 - api.s(9), y - api.s(9), api.s(18), api.s(18), { fill: pal.ink, r: api.s(4) });
    api.line([[x0, y - api.s(9)], [x0, y - api.s(26)]], { color: pal.ink, width: api.s(2) });
    // Receiver ring that fills when the signal lands
    const rr = api.s(15);
    api.circle(x1, y, rr, { stroke: api.accent, width: api.s(2) });
    api.circle(x1, y, rr * 0.62 * ease.back(land), { fill: api.accent, alpha: fade });
    if (land > 0) api.circle(x1, y, rr + api.s(18) * land, { stroke: api.accent, width: 1, alpha: (1 - land) * 0.8 });
    // The wave packet
    if (fly > 0 && fly < 1) {
      const cx = lerp(x0 + api.s(14), x1 - rr, fly);
      const len = api.s(70);
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const x = cx - len / 2 + u * len;
        const env = Math.sin(Math.PI * u);
        pts.push([x, y - Math.sin(u * TAU * 3 - t * 9) * api.s(13) * env]);
      }
      api.line(pts, { color: api.accent, width: api.s(2.2) });
    }
  },
};
