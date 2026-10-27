// If You Build It, Will They Connect? 6 GHz WiFi in a Stadium (ICCCN 2026).
// A measurement study of a WiFi 6E stadium. Phase 1: Passpoint steering sends about
// half of all clients to 5 GHz only, an estimated 20% of them 6 GHz-capable (ringed;
// accent is kept for clients actually on 6 GHz).
// Phase 2: OWE transition mode lifts 6 GHz adoption among non-steered clients from
// near zero to 21%. Then the abstract's per-band medians: throughput and utilization.
import { seg, ease, clamp, mix } from './kit.js';

const D = 16;
const NDOTS = 1200;
const POP = [0.4, 2.0];
const STEER = [2.4, 5.4];
const OWE = [6.0, 9.0];
const STATS = [9.5, 11.5];
const NE = 2.6; // superellipse exponent for the bowl

const inside = (x, y, a, b) => Math.pow(Math.abs(x / a), NE) + Math.pow(Math.abs(y / b), NE) <= 1;

export default {
  duration: D,
  still: 12.6,
  scene: false,

  init(api) {
    const r = api.rng('stadium');
    // Seats between the field edge (inner) and the rim (outer), in bowl units (-1..1).
    const pts = [];
    while (pts.length < NDOTS) {
      const x = r.range(-1, 1);
      const y = r.range(-1, 1);
      if (!inside(x, y, 1, 1) || inside(x, y, 0.56, 0.5)) continue;
      pts.push({ x, y });
    }
    // Exact proportions: 50% steered; 20% of steered capable; 21% of non-steered on 6 GHz after OWE.
    const idx = pts.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const half = NDOTS / 2;
    idx.forEach((pi, n) => {
      const p = pts[pi];
      p.steered = n < half;
      p.capable = p.steered && n < half * 0.2;
      p.owe = !p.steered && n - half < half * 0.21;
      p.early = !p.steered && n - half >= half * 0.21 && n - half < half * 0.21 + 6; // near-zero 6 GHz before OWE
      // Sweep order: clockwise from the top.
      let a = Math.atan2(p.y, p.x) + Math.PI / 2;
      if (a < 0) a += Math.PI * 2;
      p.ang = a / (Math.PI * 2);
      p.jit = r() * 0.06;
      p.cmp = pi % 2 === 0; // drawn at phone size
    });
    // Reused every frame (no per-frame allocation): x, y, r triples per style, plus rings.
    const buf = [0, 1, 2, 3].map(() => new Float32Array(NDOTS * 3));
    return { pts, buf, n: [0, 0, 0, 0] };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const acEdge = pal.dark ? api.accent : mix(api.accent, api.accentInk, 0.45);

    // ---- Bowl ----
    const bc = [w * (compact ? 0.3 : 0.33), h * (compact ? 0.52 : 0.56)];
    const A = w * (compact ? 0.27 : 0.275);
    const B = h * (compact ? 0.43 : 0.37);
    const P = (x, y) => [bc[0] + x * A, bc[1] + y * B];
    const ring = (a, b) => {
      const out = [];
      for (let i = 0; i <= 96; i++) {
        const th = (i / 96) * Math.PI * 2;
        const c = Math.cos(th);
        const s = Math.sin(th);
        out.push(P(Math.sign(c) * Math.pow(Math.abs(c), 2 / NE) * a, Math.sign(s) * Math.pow(Math.abs(s), 2 / NE) * b));
      }
      return out;
    };
    api.line(ring(1.04, 1.04), { color: pal.line, width: 1, close: true });
    api.line(ring(0.53, 0.47), { color: pal.line, width: 1, close: true });
    // Field with yard lines.
    const fw = A * 0.62;
    const fh = B * 0.5;
    api.rect(bc[0] - fw / 2, bc[1] - fh / 2, fw, fh, { stroke: pal.grid, width: 1, r: api.s(3) });
    for (let i = 1; i < 10; i++) {
      const x = bc[0] - fw / 2 + (i / 10) * fw;
      api.line([[x, bc[1] - fh / 2], [x, bc[1] + fh / 2]], { color: pal.grid, width: 1, alpha: i === 5 ? 1 : 0.6 });
    }

    // ---- Clients ----
    const rad = Math.max(1.05, api.s(compact ? 2.1 : 1.75));
    const pop = (p) => clamp((seg(t, POP[0], POP[1]) - p.ang * 0.85) / 0.15);
    const steerP = seg(t, STEER[0], STEER[1]);
    const oweP = seg(t, OWE[0], OWE[1]);
    const passed = (p, prog) => prog * 1.06 > p.ang + p.jit;
    const buf = st.buf; // 0 non-steered 5 GHz, 1 steered 5 GHz, 2 on 6 GHz, 3 rings
    const cnt = st.n;
    cnt[0] = cnt[1] = cnt[2] = cnt[3] = 0;
    const push = (g, x, y, r) => {
      const i = cnt[g]++ * 3;
      buf[g][i] = x;
      buf[g][i + 1] = y;
      buf[g][i + 2] = r;
    };
    for (const p of st.pts) {
      if (compact && !p.cmp) continue;
      const g = pop(p);
      if (g <= 0) continue;
      let [x, y] = P(p.x, p.y);
      const st6 = p.owe ? passed(p, oweP) : p.early;
      let cls = 0;
      if (p.steered && passed(p, steerP)) {
        cls = 1;
        // Steered clients get a small push as Passpoint reaches them.
        const since = clamp((steerP * 1.06 - p.ang - p.jit) * 8);
        const kick = Math.sin(Math.PI * since) * api.s(2.2);
        const len = Math.hypot(p.x * A, p.y * B) || 1;
        x += (p.x * A / len) * kick;
        y += (p.y * B / len) * kick;
        if (p.capable) push(3, x, y, rad * (2.05 + 0.9 * (1 - ease.out(since))));
      } else if (st6) cls = 2;
      push(cls, x, y, rad * g * (cls === 2 ? 1.3 : 1));
    }
    const dots = (g, o) => {
      const n = cnt[g];
      if (!n) return;
      const a = buf[g];
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < n * 3; i += 3) {
        ctx.moveTo(a[i] + a[i + 2], a[i + 1]);
        ctx.arc(a[i], a[i + 1], a[i + 2], 0, Math.PI * 2);
      }
      if (o.fill) {
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.fillStyle = o.fill;
        ctx.fill();
      }
      if (o.stroke) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = o.width;
        ctx.stroke();
      }
      ctx.restore();
    };
    dots(0, { fill: pal.ink3, alpha: 0.55 });
    dots(1, { fill: pal.ink2, alpha: 0.9 });
    dots(2, { fill: api.accent, stroke: pal.dark ? null : acEdge, width: 0.8 });
    dots(3, { stroke: pal.ink, width: Math.max(1, api.s(1.1)) });
    // Sweep hand for each configuration change.
    for (const [prog, a] of [[steerP, Math.min(seg(t, STEER[0], STEER[0] + 0.3), 1 - seg(t, STEER[1] - 0.2, STEER[1] + 0.2))], [oweP, Math.min(seg(t, OWE[0], OWE[0] + 0.3), 1 - seg(t, OWE[1] - 0.2, OWE[1] + 0.2))]]) {
      if (a <= 0) continue;
      const th = prog * 1.06 * Math.PI * 2 - Math.PI / 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / NE) * 1.06;
      const ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / NE) * 1.06;
      const ix = Math.sign(c) * Math.pow(Math.abs(c), 2 / NE) * 0.53;
      const iy = Math.sign(s) * Math.pow(Math.abs(s), 2 / NE) * 0.47;
      api.line([P(ix, iy), P(ex, ey)], { color: pal.ink, width: Math.max(1, api.s(1.4)), alpha: 0.55 * a });
    }

    // ---- Captions inside the field ----
    const cy = bc[1];
    api.caption(compact ? 'Passpoint → 5 GHz' : 'Passpoint: ~50% to 5 GHz only', bc[0], cy, STEER[0] + 0.2, STEER[1] + 0.4, { color: pal.ink, border: pal.ink3, size: api.fs(compact ? 10 : 11) });
    api.caption(compact ? 'OWE mode: 6 GHz up' : 'OWE transition mode: 6 GHz rises', bc[0], cy, OWE[0] + 0.2, OWE[1] + 0.3, { color: api.accentInk, border: acEdge, size: api.fs(compact ? 10 : 11) });
    api.caption(compact ? 'adoption is the limit' : 'adoption, not spectrum, is the limit', bc[0], cy, STATS[1] + 0.3, D - 0.6, { color: api.accentInk, border: acEdge, size: api.fs(compact ? 10 : 11) });

    // ---- Side panel: numbers from the abstract ----
    const px = w * (compact ? 0.615 : 0.655);
    const pr = w * (compact ? 0.97 : 0.95);
    const big = api.fs(compact ? 12 : 15);
    const a1 = ease.out(seg(t, STEER[0], STEER[0] + 0.4));
    const a2 = ease.out(seg(t, OWE[0], OWE[0] + 0.4));
    const a3 = ease.out(seg(t, STATS[0], STATS[0] + 0.4));
    const grow = ease.out(seg(t, STATS[0] + 0.2, STATS[1]));
    const capA = ease.out(seg(t, STEER[1] - 0.4, STEER[1] + 0.2));
    const pct = Math.round(50 * steerP);
    const owePct = Math.round(21 * oweP);
    const ringKey = (x, y, a) => {
      api.circle(x, y, rad * 2.05, { stroke: pal.ink, width: Math.max(1, api.s(1.1)), alpha: a });
      api.circle(x, y, rad, { fill: pal.ink2, alpha: a });
    };
    if (compact) {
      lab('PASSPOINT', px, h * 0.1, { alpha: a1 });
      api.text(`~${pct}% → 5 GHz`, px, h * 0.2, { size: big, weight: 650, color: pal.ink, alpha: a1 });
      if (capA > 0) {
        ringKey(px + api.s(5), h * 0.285 - api.fs(10) * 0.32, capA);
        lab('~20% capable', px + api.s(15), h * 0.285, { alpha: capA, color: pal.ink2 });
      }
      lab('OWE MODE', px, h * 0.42, { alpha: a2 });
      api.text(owePct < 1 ? '6 GHz ≈ 0%' : `6 GHz ${owePct}%`, px, h * 0.52, { size: big, weight: 650, color: api.accentInk, alpha: a2 });
      lab('6 GHz VS 5 GHz', px, h * 0.67, { alpha: a3 });
      const row = (y, v6, v5, unit) => {
        const s6 = v6;
        api.text(s6, px, y, { size: api.fs(11), weight: 650, color: api.accentInk, alpha: a3 });
        api.text(` vs ${v5}${unit}`, px + api.measure(s6, { size: api.fs(11), weight: 650 }), y, { size: api.fs(11), weight: 600, color: pal.ink2, alpha: a3 });
      };
      row(h * 0.77, `${Math.round(28 * grow)}`, `${Math.round(8 * grow)}`, ' Mbps');
      row(h * 0.87, `${(3.1 * grow).toFixed(1)}%`, `${(31.4 * grow).toFixed(1)}%`, '');
    } else {
      const y1 = h * 0.17;
      lab('PASSPOINT STEERING', px, y1, { alpha: a1 });
      api.circle(px + api.s(4), y1 + api.s(22) - big * 0.34, rad * 1.5, { fill: pal.ink2, alpha: a1 });
      api.text(`~${pct}% → 5 GHz only`, px + api.s(13), y1 + api.s(22), { size: big, weight: 650, color: pal.ink, alpha: a1 });
      if (capA > 0) {
        const ry = y1 + api.s(41);
        ringKey(px + api.s(4), ry - api.fs(10) * 0.32, capA);
        lab('~20% of them 6 GHz-capable', px + api.s(13), ry, { alpha: capA, color: pal.ink2 });
      }
      const y2 = h * 0.385;
      lab('OWE TRANSITION MODE', px, y2, { alpha: a2 });
      api.circle(px + api.s(4), y2 + api.s(22) - big * 0.34, rad * 1.7, { fill: api.accent, stroke: pal.dark ? undefined : acEdge, width: 1, alpha: a2 });
      api.text(owePct < 1 ? '6 GHz ≈ 0%' : `6 GHz ${owePct}%`, px + api.s(13), y2 + api.s(22), { size: big, weight: 650, color: api.accentInk, alpha: a2 });
      lab('of non-steered clients', px + api.s(13), y2 + api.s(39), { alpha: a2, color: pal.ink2 });
      const bars = (y, title, note, v6, v5, max, fmt) => {
        lab(title, px, y, { alpha: a3 });
        const bw = (pr - px) * 0.5;
        const bh = api.s(7);
        [[v6, '6 GHz', api.accent, api.accentInk], [v5, '5 GHz', pal.ink3, pal.ink2]].forEach(([v, name, c, tc], i) => {
          const by = y + api.s(9) + i * api.s(15);
          lab(name, px, by + bh * 0.85, { alpha: a3, color: pal.ink2 });
          const x0 = px + api.s(44);
          const len = Math.max(0, (v / max) * bw * grow);
          api.rect(x0, by, Math.max(bh, len), bh, { fill: c, stroke: i === 0 && !pal.dark ? acEdge : undefined, width: 1, r: bh / 2, alpha: a3 });
          api.text(fmt(v * grow), x0 + Math.max(bh, len) + api.s(6), by + bh * 0.9, { size: api.fs(10.5), weight: 650, color: tc, alpha: a3 });
        });
        lab(note, px + api.s(44), y + api.s(50), { alpha: a3 * ease.out(seg(t, STATS[1] - 0.3, STATS[1] + 0.2)), color: api.accentInk });
      };
      bars(h * 0.565, 'MEDIAN THROUGHPUT', '6 GHz: 3.4× higher', 28, 8, 28, (v) => `${Math.round(v)} Mbps`);
      bars(h * 0.765, 'CHANNEL UTILIZATION', '6 GHz: 90% lower', 3.1, 31.4, 31.4, (v) => `${v.toFixed(1)}%`);
    }

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
