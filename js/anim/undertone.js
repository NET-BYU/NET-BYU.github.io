// UnderTone: Frequency Lock Encoding on COTS Wi-Fi Hardware (MobiCom 2026 WiP).
// A stock ESP32-C5 retunes its fractional-N synthesizer so that every frame the MAC
// happens to send during a symbol slot carries +Δf or −Δf. MAC timing is bursty, so
// some slots go out with no frame at all: the receiver marks those symbols as erasures
// and Reed-Solomon coding fills them back in before the message is read.
import { seg, ease, lerp, clamp } from './kit.js';

const D = 14;
const MSG = 'Hi';
const PARITY = [0xd, 0x2]; // synthetic parity symbols
const CELLS = [...[...MSG].flatMap((ch) => [ch.charCodeAt(0) >> 4, ch.charCodeAt(0) & 15]), ...PARITY];
const PER = 4; // FLE slots per Reed-Solomon symbol
// Frames the MAC happens to send in each symbol slot (bursty; zeros are idle windows).
const COUNTS = [2, 1, 1, 2, 1, 0, 0, 1, 2, 2, 1, 1, 1, 1, 2, 1, 2, 0, 1, 1, 1, 2, 1, 1];
const NS = COUNTS.length;
const SLOT = 0.34; // seconds per symbol slot
const T0 = 0.7;
const T_END = T0 + NS * SLOT;
const DEC = [9.1, 10.3];
const MSG_T = 10.45;

export default {
  duration: D,
  still: 11.6,
  scene: false,

  init(api) {
    const r = api.rng('undertone');
    const bits = CELLS.flatMap((v) => [3, 2, 1, 0].map((b) => (v >> b) & 1));
    const frames = [];
    COUNTS.forEach((c, i) => {
      const spots = c === 1 ? [r.range(0.28, 0.72)] : c === 2 ? [r.range(0.12, 0.32), r.range(0.58, 0.86)] : [];
      for (const u of spots) frames.push({ slot: i, u, t: T0 + (i + u) * SLOT, wf: r.range(0.2, 0.3) });
    });
    const erased = CELLS.map((_, c) => COUNTS.slice(c * PER, c * PER + PER).some((n) => n === 0));
    return { bits, frames, erased };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const onAccent = pal.dark ? '#0A0B0F' : '#fff';

    // ---- Geometry ----
    const bw = compact ? w * 0.085 : w * 0.075;
    const bh = compact ? h * 0.2 : h * 0.18;
    const bx = w * (compact ? 0.04 : 0.06);
    const x0 = compact ? w * 0.19 : w * 0.215;
    const x1 = w * 0.94;
    const slotW = (x1 - x0) / NS;
    const sx = (i) => x0 + i * slotW;
    const cfoY = h * (compact ? 0.15 : 0.25);
    const amp = h * (compact ? 0.075 : 0.05);
    const base = h * (compact ? 0.47 : 0.5);
    const fH = h * (compact ? 0.14 : 0.1);
    const by = base - bh; // the board sits on the frames lane it feeds
    const pos = (t - T0) / SLOT; // playhead in slots
    const slotNow = Math.floor(clamp(pos, 0, NS - 1e-6));

    // ---- Lanes ----
    if (compact) lab('CFO', x0 - api.s(8), cfoY + api.fs(10) * 0.35, { align: 'right' });
    else lab('CFO OF EACH FRAME', x0, cfoY - amp - api.s(16));
    api.line([[x0, cfoY], [x1, cfoY]], { color: pal.line, width: 1, dash: [api.s(3), api.s(4)] });
    if (!compact) {
      lab('+Δf', x1 + api.s(6), cfoY - amp + api.s(4));
      lab('−Δf', x1 + api.s(6), cfoY + amp + api.s(4));
    }
    // Slot grid (the virtual symbol clock) and RS symbol groups.
    for (let i = 0; i <= NS; i++) {
      const g = i % PER === 0;
      api.line([[sx(i), cfoY - amp - api.s(4)], [sx(i), base]], { color: g ? pal.line : pal.grid, width: 1 });
    }
    api.line([[x0, base], [x1, base]], { color: pal.ink3, width: 1 });
    if (!compact) lab('WI-FI FRAMES · BURSTY MAC', x0, base + api.s(16));

    // ---- Frames and their frequency nudges ----
    const tick = Math.max(1.8, api.s(3.1));
    for (const f of st.frames) {
      const p = seg(t, f.t, f.t + 0.16);
      if (p <= 0) continue;
      const fx = sx(f.slot + f.u);
      const fw = Math.max(2, slotW * f.wf);
      const hh = fH * ease.out(p);
      api.rect(fx - fw / 2, base - hh, fw, hh, { fill: pal.ink2, r: Math.min(api.s(2), fw / 2), alpha: 0.85 });
      const b = st.bits[f.slot];
      const ty = cfoY + (b ? -amp : amp) * ease.out(p);
      api.line([[fx, cfoY], [fx, ty]], { color: api.accent, width: api.s(1.6) });
      api.circle(fx, ty, tick, { fill: api.accent });
    }
    // Empty slots: the expected frame never went out, so this symbol is erased.
    for (let i = 0; i < NS; i++) {
      if (COUNTS[i] !== 0) continue;
      const a = ease.out(seg(t, T0 + (i + 1) * SLOT, T0 + (i + 1) * SLOT + 0.25));
      if (a <= 0) continue;
      const ew = slotW * 0.56;
      api.rect(sx(i + 0.5) - ew / 2, base - fH, ew, fH, { stroke: pal.ink2, width: 1, dash: [api.s(3), api.s(2.5)], r: api.s(2), alpha: a });
      api.circle(sx(i + 0.5), cfoY, api.s(2.4), { stroke: pal.ink3, width: 1, dash: [2, 2], alpha: a });
    }
    // Playhead.
    const playA = Math.min(seg(t, T0 - 0.3, T0), 1 - seg(t, T_END, T_END + 0.4));
    if (playA > 0) {
      const px = sx(clamp(pos, 0, NS));
      api.line([[px, cfoY - amp - api.s(8)], [px, base + api.s(3)]], { color: pal.ink, width: 1, alpha: playA * 0.7 });
    }

    // ---- ESP32-C5 board ----
    drawBoard(api, bx, by, bw, bh, st.bits[slotNow], seg(t, T0 - 0.2, T0), compact);
    // Radio arcs from the antenna for each frame sent.
    const ax = bx + bw * 0.8;
    const ay = by - api.s(compact ? 12 : 17);
    for (const f of st.frames) {
      const age = t - f.t;
      if (age < 0 || age > 0.55) continue;
      const q = age / 0.55;
      ctx.save();
      ctx.globalAlpha = (1 - q) * 0.8;
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = Math.max(1, api.s(1.3));
      ctx.beginPath();
      ctx.arc(ax, ay, api.s(5) + q * api.s(18), -0.75, 0.75);
      ctx.stroke();
      ctx.restore();
    }
    const labY = by + bh + api.s(compact ? 18 : 17);
    api.text('ESP32-C5', bx + bw / 2, labY, { size: api.fs(compact ? 10 : 11), color: pal.ink2, weight: 600, align: 'center' });
    if (!compact) lab('frac-N → ±Δf', bx + bw / 2, labY + api.s(15), { align: 'center', color: api.accentInk });

    // ---- Reed-Solomon codeword: one symbol per group of slots ----
    const cy = h * (compact ? 0.69 : 0.7);
    const cH = h * (compact ? 0.11 : 0.085);
    const gap = Math.max(2, api.s(5));
    const decX = lerp(x0 - api.s(8), x1 + api.s(8), ease.inOut(seg(t, DEC[0], DEC[1])));
    lab(compact ? 'RS CODEWORD' : 'REED-SOLOMON CODEWORD', x0, cy - cH / 2 - api.s(compact ? 9 : 10));
    CELLS.forEach((v, c) => {
      const cx0 = sx(c * PER) + gap / 2;
      const cw = slotW * PER - gap;
      const done = T0 + (c + 1) * PER * SLOT; // group finished
      const ready = ease.out(seg(t, done, done + 0.3));
      // Bracket from the slot group down to its symbol.
      const bkY = base + (compact ? h * 0.045 : api.s(26));
      api.line([[cx0, bkY - api.s(3)], [cx0, bkY], [cx0 + cw, bkY], [cx0 + cw, bkY - api.s(3)]], { color: pal.line, width: 1 });
      const fixed = st.erased[c] && t >= DEC[0] && decX > cx0 + cw / 2;
      const fixA = fixed ? ease.out(clamp((decX - (cx0 + cw / 2)) / api.s(30))) : 0;
      let fill = 'transparent';
      let stroke = pal.line;
      let dash;
      let txt = null;
      let tc = pal.ink;
      if (ready > 0 && !st.erased[c]) {
        fill = pal.surface;
        stroke = pal.ink3;
        txt = v.toString(16).toUpperCase();
      } else if (ready > 0 && st.erased[c] && !fixed) {
        stroke = pal.ink2;
        dash = [api.s(3), api.s(2.5)];
        txt = '?';
        tc = pal.ink3;
      } else if (fixed) {
        fill = api.accent;
        stroke = api.accent;
        txt = v.toString(16).toUpperCase();
        tc = onAccent;
      }
      api.rect(cx0, cy - cH / 2, cw, cH, { fill, stroke, width: 1, dash, r: api.s(3) });
      if (txt) {
        const pop = fixed ? 0.85 + 0.15 * ease.back(fixA) : 0.9 + 0.1 * ready;
        api.text(txt, cx0 + cw / 2, cy + api.fs(15) * 0.36 * pop, { size: api.fs(15) * pop, weight: 650, align: 'center', color: tc, alpha: fixed ? 1 : ready });
      }
    });
    if (decX > x0 && t < DEC[1] + 0.2) {
      const a = 1 - seg(t, DEC[1] - 0.1, DEC[1] + 0.2);
      api.line([[decX, cy - cH * 0.9], [decX, cy + cH * 0.9]], { color: pal.ink, width: api.s(2), alpha: a });
    }
    // Data / parity labels, then the decoded characters under their symbol pairs.
    const subY = cy + cH / 2 + api.s(16);
    if (!compact) {
      lab('data', (sx(0) + sx(4 * PER)) / 2, subY, { align: 'center' });
      lab('parity', (sx(4 * PER) + sx(6 * PER)) / 2, subY, { align: 'center' });
    }
    const msgY = h * (compact ? 0.935 : 0.895);
    const msgSize = compact ? Math.max(14, h * 0.08) : api.fs(23);
    [...MSG].forEach((ch, k) => {
      const a = ease.out(seg(t, MSG_T + k * 0.25, MSG_T + k * 0.25 + 0.45));
      if (a <= 0) return;
      const l = sx(k * 2 * PER) + gap;
      const r = sx((k * 2 + 2) * PER) - gap;
      const top = cy + cH / 2 + (compact ? h * 0.035 : api.s(26));
      api.line([[l, top], [l, top + api.s(4)], [r, top + api.s(4)], [r, top]], { color: api.accent, width: 1, alpha: a });
      const yy = msgY + (1 - a) * api.s(6);
      api.text(`"${ch}"`, (l + r) / 2, yy, { size: msgSize, weight: 650, align: 'center', color: api.accentInk, alpha: a });
    });

    // ---- Captions ----
    if (!compact) api.caption('each slot: carrier +Δf or −Δf', sx(15.5), cfoY - amp - api.s(16), 1.05, 2.6, { color: api.accentInk, border: api.accent, size: api.fs(11) });
    const e0 = T0 + 2 * PER * SLOT; // first erased symbol is known when its slot group ends
    api.caption(compact ? 'empty slot → erasure' : 'empty slot → erased symbol', clamp(sx(PER * 1.5), x0 + api.s(compact ? 70 : 100), x1), msgY - api.s(compact ? 4 : 7), e0, e0 + 1.9, { color: pal.ink, border: pal.ink3, size: api.fs(11) });
    api.caption(compact ? 'RS fills the erasures' : 'Reed-Solomon fills the erasures', x1, cy - cH / 2 - api.s(compact ? 13 : 15), DEC[0] - 0.05, DEC[1] + 0.9, { align: 'right', color: api.accentInk, border: api.accent, size: api.fs(11) });

    // ---- Loop fade ----
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};

// A small dev board: PCB, module can, pin headers and a stick antenna. The chip shows the
// synthesizer's current offset (an arrow up for +Δf, down for −Δf).
function drawBoard(api, x, y, bw, bh, bit, on, compact) {
  const { pal } = api;
  api.rect(x, y, bw, bh, { fill: pal.surface, stroke: pal.ink3, width: 1, r: api.s(3) });
  const pins = compact ? 5 : 7;
  for (let i = 0; i < pins; i++) {
    const yy = y + bh * (0.36 + (i * 0.56) / (pins - 1));
    api.circle(x + bw * 0.13, yy, api.s(1.1), { fill: pal.ink3 });
    api.circle(x + bw * 0.87, yy, api.s(1.1), { fill: pal.ink3 });
  }
  // Module can.
  const mx = x + bw * 0.24;
  const my = y + bh * 0.08;
  const mw = bw * 0.52;
  const mh = bh * 0.5;
  api.rect(mx, my, mw, mh, { fill: pal.line, stroke: pal.ink3, width: 1, r: api.s(1.5) });
  // Antenna.
  const ax = x + bw * 0.8;
  const top = y - api.s(compact ? 12 : 17);
  api.line([[ax, y], [ax, top]], { color: pal.ink2, width: api.s(1.6) });
  api.circle(ax, top, api.s(2), { fill: pal.ink2 });
  // Offset arrow on the module.
  if (on > 0) {
    const cx = mx + mw / 2;
    const cy = my + mh / 2;
    const L = mh * 0.32;
    const d = bit ? -1 : 1;
    api.arrow(cx, cy - d * L, cx, cy + d * L, { color: api.accent, width: api.s(1.8), head: api.s(compact ? 5 : 6), alpha: on });
  }
}
