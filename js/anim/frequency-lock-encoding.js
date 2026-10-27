// Frequency Lock Encoding (MILCOM 2026).
// The transmitter nudges its carrier up or down (±Δf) to send secondary bits.
// The primary receiver's loop absorbs the nudges and stays locked; an FLE-aware
// receiver reads the same loop's frequency estimate and recovers the bits.
import { TAU, clamp, lerp, seg, smooth, ease, noise2 } from './kit.js';

const BITS = [1, 0, 1, 1, 0, 1, 0, 0];
const TS = 1.5; // seconds per secondary symbol
const LOOP = BITS.length * TS;
const TAU_PLL = 0.16; // loop settling time constant (s)

function offsetAt(t) {
  const tt = ((t % LOOP) + LOOP) % LOOP;
  const k = Math.floor(tt / TS);
  const cur = BITS[k] ? 1 : -1;
  const prev = BITS[(k + BITS.length - 1) % BITS.length] ? 1 : -1;
  return lerp(prev, cur, smooth(seg(tt - k * TS, 0, 0.24)));
}

export default {
  duration: LOOP,
  still: 3 * TS + 1.1,

  init(api) {
    // Simulate the loop's frequency estimate over two periods; keep the second (steady state).
    const step = 1 / 120;
    const n = Math.round(LOOP / step);
    const est = new Float32Array(n);
    let e = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const target = offsetAt(i * step);
        e += (target - e) * (step / TAU_PLL);
        if (pass === 1) est[i] = e;
      }
    }
    const r = api.rng('fle');
    const cloud = [];
    for (let q = 0; q < 4; q++) {
      for (let i = 0; i < 26; i++) cloud.push({ q, dx: r.gauss() * 0.075, dy: r.gauss() * 0.075, ph: r() * TAU });
    }
    return { est, step, n, cloud };
  },

  draw(api, s) {
    const { w, h, t, pal } = api;
    const estAt = (tt) => {
      const i = Math.floor((((tt % LOOP) + LOOP) % LOOP) / s.step) % s.n;
      return s.est[i];
    };
    const k = Math.floor(t / TS) % BITS.length;
    const delta = offsetAt(t);
    const e = estAt(t);
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });

    // ---- Left: transmitted spectrum ----
    const L = { x: w * 0.06, y: h * 0.16, w: w * 0.47, h: h * 0.6 };
    lab('TX SPECTRUM', L.x, L.y - api.s(14));
    const base = L.y + L.h;
    const cx = L.x + L.w / 2;
    const span = L.w * 0.12; // ±Δf in px
    const c = cx + delta * span;
    const sig = L.w * 0.2;
    // Nominal carrier.
    api.line([[cx, L.y + api.s(8)], [cx, base]], { color: pal.ink3, width: 1, dash: [api.s(3), api.s(4)] });
    lab('fc', cx, base + api.s(16), { align: 'center' });
    // Spectrum: flat-topped hump over a boiling noise floor.
    const pts = [];
    for (let x = L.x; x <= L.x + L.w; x += Math.max(1, api.s(2))) {
      const u = (x - c) / sig;
      const hump = Math.exp(-Math.pow(Math.abs(u), 5));
      const n = noise2(x * 0.06, t * 1.7, 3) * 0.035 + noise2(x * 0.21, t * 2.3, 5) * 0.02;
      const v = 0.07 + 0.78 * hump + n;
      pts.push([x, base - clamp(v, 0, 1) * L.h * 0.86]);
    }
    api.line([...pts, [L.x + L.w, base], [L.x, base]], { color: 'none', fill: api.pal.dark ? 'rgba(233,235,239,0.07)' : 'rgba(20,22,28,0.06)', close: true });
    api.line(pts, { color: pal.ink2, width: api.s(1.6) });
    api.line([[L.x, base], [L.x + L.w, base]], { color: pal.line, width: 1 });
    // The shift: the lab's contribution, in the area color.
    const shiftY = L.y + L.h * 0.1;
    if (Math.abs(delta) > 0.02) api.arrow(cx, shiftY, c, shiftY, { color: api.accent, width: api.s(2), head: api.s(8) });
    api.circle(c, shiftY, api.s(3.2), { fill: api.accent });
    const bit = BITS[k];
    api.text(String(bit), c, L.y - api.s(2) + (compact ? api.s(4) : 0), { size: api.fs(26), color: api.accentInk, align: 'center', weight: 600 });
    api.caption(bit ? '+Δf sends a 1' : '−Δf sends a 0', c, base - L.h * 0.5, k * TS + 0.25, k * TS + 1.3, { color: api.accentInk, border: api.accent, size: api.fs(11) });

    // Bit tape under the spectrum.
    const tapeY = base + api.s(compact ? 34 : 40);
    const cell = Math.min(api.s(22), L.w / (BITS.length + 1));
    const tape0 = cx - (cell * BITS.length) / 2;
    BITS.forEach((b, i) => {
      const x = tape0 + i * cell;
      const active = i === k;
      const done = i < k;
      api.rect(x + 1, tapeY - cell * 0.42, cell - 2, cell * 0.84, { fill: active ? api.accent : 'transparent', stroke: active ? api.accent : pal.line, width: 1, r: api.s(3) });
      api.text(String(b), x + cell / 2, tapeY + api.fs(11) * 0.36, { size: api.fs(11.5), weight: 600, align: 'center', color: active ? (api.pal.dark ? '#0A0B0F' : '#fff') : done ? pal.ink2 : pal.ink3 });
    });
    if (!compact) lab('SECONDARY BITS', tape0 - api.s(8), tapeY + api.fs(10.5) * 0.36, { align: 'right' });

    // ---- Right top: primary receiver constellation (stays locked) ----
    const R = { x: w * 0.6, w: w * 0.34 };
    const C = { cx: R.x + R.w * 0.3, cy: h * 0.31, r: Math.min(R.w * 0.27, h * 0.16) };
    lab(compact ? 'PRIMARY RX' : 'PRIMARY RX · DATA', R.x, h * 0.1);
    api.line([[C.cx - C.r * 1.25, C.cy], [C.cx + C.r * 1.25, C.cy]], { color: pal.line, width: 1 });
    api.line([[C.cx, C.cy - C.r * 1.25], [C.cx, C.cy + C.r * 1.25]], { color: pal.line, width: 1 });
    const err = delta - e; // tracking error: brief wobble at each transition
    const rot = err * 0.55;
    const pos = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (const p of s.cloud) {
      const [qx, qy] = pos[p.q];
      const jitter = 0.012 * Math.sin(t * 3 + p.ph);
      const x0 = qx * 0.62 + p.dx + jitter;
      const y0 = qy * 0.62 + p.dy;
      const x = x0 * Math.cos(rot) - y0 * Math.sin(rot);
      const y = x0 * Math.sin(rot) + y0 * Math.cos(rot);
      api.circle(C.cx + x * C.r, C.cy - y * C.r, api.s(1.7), { fill: pal.ink, alpha: 0.6 });
    }
    // Lock indicator, kept inside the right column.
    api.label('LOCKED', R.x + R.w, C.cy - C.r * 1.05, { size: api.fs(10.5), align: 'right', color: pal.ink, border: pal.line });
    if (!compact) {
      lab('primary data', R.x + R.w, C.cy + api.s(4), { align: 'right' });
      lab('decodes as usual', R.x + R.w, C.cy + api.s(18), { align: 'right' });
    }

    // ---- Right bottom: FLE receiver reads the loop's frequency estimate ----
    const F = { x: R.x, y: h * 0.6, w: R.w, h: h * 0.22 };
    lab(compact ? 'FLE RX' : 'FLE RX · FREQUENCY ESTIMATE', F.x, F.y - api.s(12));
    const midY = F.y + F.h / 2;
    api.line([[F.x, midY], [F.x + F.w, midY]], { color: pal.line, width: 1, dash: [api.s(2), api.s(4)] });
    const winS = 4 * TS;
    const tx = (tt) => F.x + ((tt - (t - winS)) / winS) * F.w;
    const fy = (v) => midY - v * F.h * 0.42;
    const truth = [];
    const trace = [];
    for (let i = 0; i <= 140; i++) {
      const tt = t - winS + (i / 140) * winS;
      truth.push([tx(tt), fy(offsetAt(tt))]);
      trace.push([tx(tt), fy(estAt(tt))]);
    }
    api.line(truth, { color: pal.ink3, width: 1, alpha: 0.7 });
    api.line(trace, { color: api.accent, width: api.s(2) });
    api.circle(tx(t), fy(e), api.s(3), { fill: api.accent });
    // Decoded bits at the end of each finished symbol in view.
    const firstSym = Math.ceil((t - winS) / TS);
    for (let j = firstSym; j * TS + TS <= t + 1e-6; j++) {
      const tc = j * TS + TS * 0.5;
      const xb = tx(tc);
      if (xb < F.x) continue;
      const b = estAt(j * TS + TS * 0.95) > 0 ? 1 : 0;
      const a = ease.out(seg(t, j * TS + TS, j * TS + TS + 0.3));
      api.text(String(b), xb, F.y + F.h + api.s(20), { size: api.fs(14), color: api.accentInk, align: 'center', weight: 600, alpha: a });
    }
    if (!compact) lab('+Δf', F.x + F.w + api.s(6), fy(1) + api.s(4));
    if (!compact) lab('−Δf', F.x + F.w + api.s(6), fy(-1) + api.s(4));
  },
};
