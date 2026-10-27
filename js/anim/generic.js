// Fallback animation for any paper or project without its own module.
// Packets stream along a few links; a receiver window slides across and reads
// a hidden bit out of each packet's timing. Each paper gets a different layout
// because the layout is seeded from its id.
import { clamp, seg, ease, TAU } from './kit.js';

export default {
  duration: 12,
  still: 6.5,

  init(api) {
    const r = api.rng();
    const lanes = 3 + Math.floor(r() * 2);
    const packets = [];
    for (let l = 0; l < lanes; l++) {
      const gap = 0.07 + r() * 0.05;
      for (let x = r() * gap; x < 1.2; x += gap * (0.8 + r() * 0.4)) {
        packets.push({ lane: l, x, bit: r() < 0.5 ? 0 : 1, len: 0.018 + r() * 0.02 });
      }
    }
    return { lanes, packets, phase: r() * TAU };
  },

  draw(api, s) {
    const { w, h, t, pal } = api;
    const padX = w * 0.07;
    const top = h * 0.2;
    const bottom = h * 0.8;
    const laneY = (l) => top + ((l + 0.5) / s.lanes) * (bottom - top);
    const speed = 0.045;
    const lensX = padX + (0.5 + 0.38 * Math.sin((t / 12) * TAU + s.phase)) * (w - padX * 2);
    const lensW = Math.max(api.s(70), w * 0.12);

    for (let l = 0; l < s.lanes; l++) {
      api.line([[padX, laneY(l)], [w - padX, laneY(l)]], { color: pal.line, width: 1 });
    }

    // Receiver window.
    api.rect(lensX - lensW / 2, top - api.s(18), lensW, bottom - top + api.s(36), { fill: api.pal.dark ? 'rgba(255,255,255,0.03)' : 'rgba(10,11,15,0.03)', stroke: api.accent, width: 1, r: api.s(10), alpha: 0.9 });
    api.text('RX', lensX, top - api.s(26), { size: api.fs(11), color: api.accentInk, align: 'center', weight: 600 });

    let decoded = 0;
    for (const p of s.packets) {
      const x0 = (((p.x - t * speed) % 1.2) + 1.2) % 1.2;
      const x = padX + x0 * (w - padX * 2) / 1.0;
      if (x < padX - 20 || x > w - padX) continue;
      const y = laneY(p.lane);
      const inLens = Math.abs(x - lensX) < lensW / 2;
      const off = (p.bit ? 1 : -1) * api.s(4) * (inLens ? 1 : 0.35);
      const pw = Math.max(api.s(10), p.len * w);
      api.rect(x - pw / 2 + off, y - api.s(7), pw, api.s(14), { fill: inLens ? api.accent : pal.ink2, r: api.s(3), alpha: inLens ? 1 : 0.55 });
      if (inLens) {
        decoded++;
        api.line([[x, y - api.s(12)], [x, y + api.s(12)]], { color: pal.ink3, width: 1, dash: [2, 3] });
        api.text(String(p.bit), x + off, y - api.s(14), { size: api.fs(11), color: api.accentInk, align: 'center', weight: 600 });
      }
    }

    const fadeIn = ease.out(seg(t, 0, 1));
    api.text('packets as sent', padX, h * 0.93, { size: api.fs(11), color: pal.ink3, alpha: fadeIn });
    api.text(`${clamp(decoded, 0, 99)} hidden bits in view`, w - padX, h * 0.93, { size: api.fs(11), color: api.accentInk, align: 'right', alpha: fadeIn });
  },
};
