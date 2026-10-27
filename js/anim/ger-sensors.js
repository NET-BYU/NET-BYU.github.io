// Utilizing Low-Cost Sensors to Monitor Indoor Air Quality in Mongolian Gers (Sensors 2023).
// Low-cost sensors log indoor PM2.5 over a day in three kinds of ger: coal-heated,
// insulated, and insulated with electric heating and cooking. At night the outside air
// is dirtier than the air inside, so every door opening shows up as a spike. The bars
// give the abstract's reductions: 17.5% (insulated), 19.1% (insulated, coal plus
// electricity) and 48% (insulated, electric), which is still 6.4× the WHO guideline.
// The daily shapes are synthetic; their means follow the abstract's ratios.
import { seg, ease, noise1 } from './kit.js';

const D = 14;
const H0 = 12; // the day runs noon → noon, so the night sits in the middle
const H1 = 36;
const STEP = 0.05; // hours per sample
const SWEEP = [0.5, 8.4];
const NIGHT = [18, 32];
const WHO = 0.52 / 6.4; // the WHO guideline relative to the coal ger's mean (from 48% and 6.4×)
const YMAX = 2.35;
const BARS = [
  { name: 'coal-heated', short: 'coal', v: 1, cut: '' },
  { name: 'insulated', short: 'insulated', v: 0.825, cut: '−17.5%' },
  { name: 'insulated, coal+elec', short: '+ coal/elec', v: 0.809, cut: '−19.1%' },
  { name: 'insulated, electric', short: '+ electric', v: 0.52, cut: '−48%' },
];
// Door openings (clock hours) for each ger: coal, insulated, electric.
const DOORS = [
  [21.4, 25.1, 29.3],
  [22.3, 26.6, 30.4],
  [21.9, 24.2, 27.7, 31.0],
];
const g = (x, c, s) => Math.exp(-(((x - c) / s) ** 2));

export default {
  duration: D,
  still: 11.2,
  scene: false,

  init() {
    const n = Math.round((H1 - H0) / STEP) + 1;
    const hours = Array.from({ length: n }, (_, i) => H0 + i * STEP);
    const outside = hours.map((hh) => 0.62 + 1.45 * ease.inOut(seg(hh, 18, 21.5)) * (1 - ease.inOut(seg(hh, 30.5, 33.5))) + 0.08 * noise1(hh * 1.3, 9));
    const spikes = (k, hh) => {
      let v = 0;
      for (const d of DOORS[k]) {
        if (hh < d) continue;
        const dt = hh - d;
        v += (1 - Math.exp(-dt / 0.04)) * Math.exp(-dt / 0.38);
      }
      return v;
    };
    const shapes = [
      (hh) => 0.5 + 1.2 * g(hh, 19.7, 1.6) + 0.45 * g(hh, 23.5, 2.4) + 0.8 * g(hh, 32.7, 1.0) + 0.25 * g(hh, 13.5, 1.2) + 0.85 * spikes(0, hh) + 0.05 * noise1(hh * 2.2, 1),
      (hh) => 0.5 + 0.95 * g(hh, 19.9, 1.5) + 0.35 * g(hh, 23.5, 2.4) + 0.65 * g(hh, 32.8, 1.0) + 0.2 * g(hh, 13.5, 1.2) + 0.75 * spikes(1, hh) + 0.05 * noise1(hh * 2.2, 2),
      (hh) => 0.36 + 0.3 * g(hh, 19.4, 1.1) + 0.22 * g(hh, 32.6, 0.8) + 0.2 * ease.inOut(seg(hh, 20, 23)) * (1 - ease.inOut(seg(hh, 30, 33))) + 0.6 * spikes(2, hh) + 0.04 * noise1(hh * 2.2, 3),
    ];
    const means = [1, 0.825, 0.52];
    const series = shapes.map((f, k) => {
      const raw = hours.map(f);
      const m = raw.reduce((a, b) => a + b, 0) / n;
      return Float32Array.from(raw, (v) => (v * means[k]) / m);
    });
    return { n, series, outside: Float32Array.from(outside) };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.55, D));
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    const A = (a) => a * fade;
    const fsL = api.fs(10.5);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: fsL, color: pal.ink3, spacing: 0.4, ...o, alpha: A(o.alpha ?? 1) });
    const COLORS = [pal.ink2, pal.ink3, api.accent];
    const INK = [pal.ink2, pal.ink2, api.accentInk];

    const hNow = H0 + (H1 - H0) * seg(t, SWEEP[0], SWEEP[1]);
    const iNow = Math.min(st.n - 1, Math.floor((hNow - H0) / STEP));

    // ================= 24 h chart =================
    const P = compact ? { x: w * 0.08, y: h * 0.24, w: w * 0.48, h: h * 0.44 } : { x: w * 0.1, y: h * 0.25, w: w * 0.5, h: h * 0.42 };
    const px = (hh) => P.x + ((hh - H0) / (H1 - H0)) * P.w;
    const py = (v) => P.y + P.h * (1 - v / YMAX);
    lab(compact ? 'INDOOR PM2.5' : 'INDOOR PM2.5 · ONE DAY', P.x - (compact ? 0 : api.s(4)), h * (compact ? 0.11 : 0.155));
    // Night band.
    api.rect(px(NIGHT[0]), P.y, px(NIGHT[1]) - px(NIGHT[0]), P.h, { fill: pal.grid, alpha: A(0.55) });
    if (!compact) lab('night', px(NIGHT[0]) + api.s(5), P.y + fsL + api.s(3), { spacing: 0 });
    api.line([[P.x, P.y], [P.x, P.y + P.h], [P.x + P.w, P.y + P.h]], { color: pal.line, width: 1, cap: 'square' });
    for (const hh of compact ? [12, 24, 36] : [12, 18, 24, 30, 36]) {
      const x = px(hh);
      api.line([[x, P.y + P.h], [x, P.y + P.h + api.s(4)]], { color: pal.line, width: 1 });
      api.text(`${hh % 24}:00`, x, P.y + P.h + api.s(6) + fsL, { size: fsL, color: pal.ink3, align: hh === 36 ? 'right' : hh === 12 ? 'left' : 'center' });
    }

    // Outside air: a light area, drawn up to the clock.
    const upto = (fn) => {
      ctx.beginPath();
      for (let i = 0; i <= iNow; i++) {
        const x = px(H0 + i * STEP);
        const y = fn(i);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    };
    if (iNow > 1) {
      ctx.save();
      upto((i) => py(st.outside[i]));
      ctx.lineTo(px(H0 + iNow * STEP), P.y + P.h);
      ctx.lineTo(P.x, P.y + P.h);
      ctx.closePath();
      ctx.globalAlpha = A(pal.dark ? 0.07 : 0.05);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      ctx.restore();
      ctx.save();
      upto((i) => py(st.outside[i]));
      ctx.setLineDash([api.s(1.5), api.s(3)]);
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = api.s(1.4);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
      const oa = seg(hNow, 27.8, 28.8);
      if (oa > 0 && !compact) api.text('outside', px(27.5), py(st.outside[Math.round((27.5 - H0) / STEP)]) - api.s(7), { size: fsL, color: pal.ink2, align: 'center', alpha: A(oa) });
    }

    // WHO guideline.
    api.line([[P.x, py(WHO)], [P.x + P.w, py(WHO)]], { color: pal.ink2, width: 1, dash: [api.s(4), api.s(3)] });
    api.text(compact ? 'WHO' : 'WHO guideline', P.x + api.s(5), py(WHO) - api.s(5), { size: fsL, color: pal.ink2 });

    // Indoor series: coal, insulated, then electric on top.
    for (let k = 0; k < 3; k++) {
      if (iNow < 1) break;
      ctx.save();
      upto((i) => py(st.series[k][i]));
      ctx.strokeStyle = COLORS[k];
      ctx.lineWidth = api.s(k === 2 ? 2.1 : 1.7);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.globalAlpha = A(1);
      ctx.stroke();
      ctx.restore();
    }
    if (t > SWEEP[0] && t < SWEEP[1] + 0.5) {
      const ca = 1 - seg(t, SWEEP[1], SWEEP[1] + 0.5);
      const x = px(hNow);
      api.line([[x, P.y], [x, P.y + P.h]], { color: pal.ink3, width: 1, alpha: A(ca * 0.8) });
      for (let k = 0; k < 3; k++) api.circle(x, py(st.series[k][iNow]), api.s(2.6), { fill: COLORS[k], alpha: A(ca) });
    }

    // ================= Gers (legend), doors opening at the spikes =================
    // Animation time at which the clock reaches hour hh.
    const tAt = (hh) => SWEEP[0] + ((hh - H0) / (H1 - H0)) * (SWEEP[1] - SWEEP[0]);
    if (!compact) {
      const base = h * 0.89;
      const u = api.s(21);
      const names = ['coal-heated', 'insulated', 'insulated, electric'];
      for (let k = 0; k < 3; k++) {
        const x = P.x + P.w * (k * 2 + 1) / 6;
        const col = COLORS[k];
        let door = 0;
        for (const d of DOORS[k]) door = Math.max(door, Math.sin(Math.PI * seg(t, tAt(d), tAt(d) + 0.8)));
        const top = base - u * 0.62;
        const roof = [[x - u * 1.12, top], [x - u * 0.22, base - u * 1.05], [x + u * 0.22, base - u * 1.05], [x + u * 1.12, top]];
        if (k > 0) {
          // Insulated: a thick felt layer around the shell.
          api.line([[x - u, base], [x - u, top], ...roof.slice(1, 3), [x + u, top], [x + u, base]], { color: col, width: api.s(4.2), alpha: A(0.28) });
        }
        api.line([[x - u, base], [x - u, top], [x + u, top], [x + u, base]], { color: col, width: api.s(1.5) });
        api.line(roof, { color: col, width: api.s(1.5) });
        api.line([[x - u * 1.3, base], [x + u * 1.3, base]], { color: pal.line, width: 1 });
        // Lattice wall.
        for (let j = -2; j <= 2; j++) {
          if (j === 0) continue;
          const lx = x + j * u * 0.42;
          api.line([[lx - u * 0.16, base - u * 0.06], [lx + u * 0.16, top + u * 0.06]], { color: col, width: 1, alpha: A(0.35) });
        }
        // Door: swings open into a dark gap at each opening.
        const dw = u * 0.34;
        const dh = u * 0.46;
        api.rect(x - dw / 2, base - dh, dw, dh, { fill: door > 0.05 ? pal.ink : pal.surface, stroke: col, width: 1, alpha: A(door > 0.05 ? 0.25 + 0.6 * door : 1) });
        if (door > 0.05) {
          api.line([[x - dw / 2, base], [x - dw / 2 - dw * 0.9 * door, base - dh * 0.15], [x - dw / 2 - dw * 0.9 * door, base - dh * 1.05], [x - dw / 2, base - dh]], { color: col, width: 1, fill: pal.surface, close: true });
          for (let q = 0; q < 4; q++) {
            const f = (t * 1.6 + q * 0.25) % 1;
            api.circle(x - dw * 2.6 + f * dw * 2.6, base - dh * (0.3 + 0.18 * (q % 3)), api.s(1.3), { fill: pal.ink2, alpha: A(door * Math.sin(Math.PI * f)) });
          }
        }
        // Heat source: chimney smoke for coal stoves, a bolt for electric.
        if (k < 2) {
          api.line([[x + u * 0.08, base - u * 1.05], [x + u * 0.08, base - u * 1.35]], { color: col, width: api.s(1.6) });
          const puffs = k === 0 ? 3 : 2;
          for (let q = 0; q < puffs; q++) {
            const f = (t * 0.45 + q / puffs) % 1;
            api.circle(x + u * 0.08 + f * u * 0.5, base - u * 1.42 - f * u * 0.75, api.s(1.6 + 2.2 * f), { fill: pal.ink3, alpha: A(0.5 * (1 - f)) });
          }
        } else {
          const bx = x + u * 0.55;
          const by = base - u * 1.32;
          const b = u * 0.3;
          api.line([[bx + b * 0.2, by - b], [bx - b * 0.35, by + b * 0.1], [bx + b * 0.1, by + b * 0.1], [bx - b * 0.2, by + b]], { color: api.accent, width: api.s(1.6) });
        }
        // Wrap a name onto two lines only if it would run into a neighbour's label.
        const half = (q) => api.measure(q, { size: fsL, weight: 600 }) / 2;
        const room = Math.min(k > 0 ? P.w / 3 - half(names[k - 1]) : Infinity, k < 2 ? P.w / 3 - half(names[k + 1]) : Infinity, k === 2 ? w - x : Infinity);
        const parts = half(names[k]) + api.s(8) > room && names[k].includes(', ') ? names[k].split(', ').map((q, j, arr) => (j < arr.length - 1 ? `${q},` : q)) : [names[k]];
        parts.forEach((q, j) => api.text(q, x, base + api.s(16) + j * fsL * 1.2, { size: fsL, color: INK[k], align: 'center', weight: k === 2 ? 600 : 500 }));
      }
    } else {
      // Compact: a one-line legend instead of the ger drawings.
      const names = ['coal', 'insulated', 'electric'];
      const y = h * 0.93;
      let x = P.x;
      for (let k = 0; k < 3; k++) {
        api.line([[x, y - fsL * 0.32], [x + 10, y - fsL * 0.32]], { color: COLORS[k], width: 2 });
        api.text(names[k], x + 14, y, { size: fsL, color: INK[k] });
        x += 14 + api.measure(names[k], { size: fsL }) + 12;
      }
    }

    // ================= Reductions (bars) =================
    const R = compact ? { x: w * 0.635, y: h * 0.24, w: w * 0.315 } : { x: w * 0.655, y: h * 0.25, w: w * 0.275 };
    lab(compact ? 'MEAN vs COAL' : 'MEAN PM2.5 vs COAL', R.x, h * (compact ? 0.11 : 0.155));
    const rowH = compact ? Math.max(fsL * 2.2, (P.h * 1.05) / BARS.length) : P.h / BARS.length;
    const barH = api.s(compact ? 6 : 9);
    const whoX = R.x + WHO * R.w;
    const last = R.y + rowH * (BARS.length - 1) + fsL + api.s(7) + barH;
    lab('WHO', whoX, last + api.s(8) + fsL, { align: 'center', color: pal.ink2, spacing: 0 });
    BARS.forEach((b, i) => {
      const y0 = R.y + i * rowH;
      const t0 = SWEEP[1] - 0.3 + i * 0.32;
      const grow = ease.out(seg(t, t0, t0 + 0.8));
      const done = ease.out(seg(t, t0 + 0.55, t0 + 0.9));
      const isLab = i === 3;
      const col = i === 0 ? pal.ink2 : isLab ? api.accent : pal.ink3;
      const cutW = b.cut ? api.measure(b.cut, { size: fsL, weight: 650 }) + api.s(8) : 0;
      const name = !compact && api.measure(b.name, { size: fsL, weight: 600 }) + cutW <= R.w ? b.name : b.short;
      api.text(name, R.x, y0 + fsL, { size: fsL, color: isLab ? api.accentInk : pal.ink2, weight: isLab ? 600 : 500 });
      if (b.cut) api.text(b.cut, R.x + R.w, y0 + fsL, { size: fsL, color: isLab ? api.accentInk : pal.ink, weight: 650, align: 'right', alpha: A(done) });
      const by = y0 + fsL + api.s(7);
      api.line([[R.x, by + barH / 2], [R.x + R.w, by + barH / 2]], { color: pal.grid, width: 1 });
      api.line([[whoX, by - api.s(3)], [whoX, by + barH + api.s(3)]], { color: pal.ink2, width: 1 });
      if (grow > 0) api.rect(R.x, by, Math.max(1, R.w * b.v * grow), barH, { fill: col, r: barH / 2 });
    });

    // ================= Live captions =================
    const capX = P.x + P.w / 2;
    const capY = P.y - (compact ? fsL * 1.15 : api.s(15));
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    api.caption(compact ? 'night: dirtier outside' : 'night: outside air is dirtier', capX, capY, tAt(21.2), tAt(24.6), neu);
    api.caption(compact ? 'door opens → spike' : 'door opens → PM2.5 spike', capX, capY, tAt(25.0), SWEEP[1] + 0.2, neu);
    api.caption(compact ? 'electric: still 6.4× WHO' : 'electric: −48%, still 6.4× WHO', capX, capY, SWEEP[1] + 1.3, D - 0.6, acc);
    ctx.globalAlpha = 1;
  },
};
