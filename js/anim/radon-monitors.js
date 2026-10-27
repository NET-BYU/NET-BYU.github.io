// Long-Term Validation of a Consumer- vs. Industrial-Grade Indoor Radon and Air
// Quality Monitor at a School in Utah (Sensors 2026).
// A consumer monitor (accent) and a calibrated industrial monitor (neutral) share a
// classroom for ~29 weeks. Their 24 h moving averages agree for radon (CCC 0.92).
// The figure then steps through the other metrics: the consumer unit reads lower for
// CO₂, relative humidity and VOC, higher for temperature, and agrees again for
// barometric pressure (CCC 0.87). The scatter panel fills in against the 1:1 line.
import { lerp, seg, ease, smooth, noise1 } from './kit.js';

const D = 16;
const WEEKS = 29;
const DAYS = WEEKS * 7;
const N = WEEKS * 8; // samples of the 24 h moving average
const DRAW = [0.5, 4.9]; // radon sweep
const START = [0, 6.0, 7.8, 9.6, 11.4, 13.2]; // when each metric takes over
const MORPH = 0.75;
const EVERY = 3; // every third sample becomes a scatter point

const METRICS = [
  { name: 'Radon', short: 'Rn', unit: 'pCi/L', lo: 0, hi: 4.2, ticks: [0, 2, 4], verdict: 'ok', ccc: '0.92' },
  { name: 'CO₂', short: 'CO₂', unit: 'ppm', lo: 300, hi: 1000, ticks: [400, 600, 800], verdict: 'low' },
  { name: 'RH', short: 'RH', unit: '%', lo: 5, hi: 45, ticks: [10, 25, 40], verdict: 'low' },
  { name: 'VOC', short: 'VOC', unit: 'ppb', lo: 0, hi: 600, ticks: [0, 250, 500], verdict: 'low' },
  { name: 'Temp', short: 'T', unit: '°F', lo: 62, hi: 80, ticks: [65, 70, 75], verdict: 'high' },
  { name: 'Pressure', short: 'P', unit: 'hPa', lo: 846, hi: 876, ticks: [850, 860, 870], verdict: 'ok', ccc: '0.87' },
];

// 24 h moving average of school-day occupancy (day 0 = a Monday).
function occ(d) {
  const p = ((d % 7) + 7) % 7;
  return smooth(seg(p, 0.33, 0.9)) - smooth(seg(p, 5.33, 5.9));
}
// Weekend radon build-up while the ventilation is off: a smooth hump peaking early Monday.
function weekend(d) {
  const p = ((d % 7) + 7) % 7;
  const q = p < 3 ? p + 7 : p;
  return Math.exp(-(((q - 7.1) / 0.85) ** 2));
}

function ccc(x, y) {
  const n = x.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    sxx += a * a;
    syy += b * b;
    sxy += a * b;
  }
  return (2 * sxy) / n / (sxx / n + syy / n + (mx - my) ** 2);
}

// Consumer = industrial + bias + k·error, with k chosen so the pair's CCC is the paper's.
function tuned(x, bias, e, target) {
  const y = new Float64Array(x.length);
  const make = (k) => {
    for (let i = 0; i < x.length; i++) y[i] = x[i] + bias + k * e[i];
    return y;
  };
  let lo = 0;
  let hi = 40;
  for (let it = 0; it < 44; it++) {
    const k = (lo + hi) / 2;
    if (ccc(x, make(k)) > target) lo = k;
    else hi = k;
  }
  return Array.from(make((lo + hi) / 2));
}

export default {
  duration: D,
  still: 15.0,
  scene: false,

  init() {
    const day = (i) => (i / (N - 1)) * DAYS;
    const gen = (f) => Array.from({ length: N }, (_, i) => f(day(i)));
    const err = (s1, s2) => gen((d) => noise1(d * 0.6, s1) + 0.4 * noise1(d * 1.5, s2));

    const ind = [
      gen((d) => 1.55 + 0.45 * Math.sin((d / DAYS) * 4.1 + 0.4) + weekend(d) * (0.55 + 0.3 * noise1(d * 0.15, 11)) + 0.38 * noise1(d * 0.33, 12) + 0.12 * noise1(d * 1.1, 13)),
      gen((d) => 470 + 300 * occ(d) * (0.85 + 0.15 * noise1(d * 0.2, 31)) + 60 * noise1(d * 0.3, 32)),
      gen((d) => 27 + 7 * Math.sin((d / DAYS) * 3.4 + 2.2) + 3.5 * noise1(d * 0.3, 41) + 1.5 * occ(d)),
      gen((d) => 220 + 180 * occ(d) * (0.8 + 0.2 * noise1(d * 0.25, 51)) + 60 * noise1(d * 0.3, 52)),
      gen((d) => 69 + 2.2 * occ(d) + 1.0 * noise1(d * 0.4, 61) + 1.1 * Math.sin((d / DAYS) * 3.8 + 1)),
      gen((d) => 861 + 6 * noise1(d * 0.24, 71) + 1.6 * noise1(d * 0.62, 72)),
    ];
    const con = [
      tuned(ind[0], -0.05, err(21, 22), 0.92),
      ind[1].map((v, i) => 0.8 * v + 25 + 45 * noise1(day(i) * 0.7, 33)),
      ind[2].map((v, i) => v - 6 + 2.4 * noise1(day(i) * 0.6, 42)),
      ind[3].map((v, i) => 0.6 * v + 10 + 38 * noise1(day(i) * 0.7, 53)),
      ind[4].map((v, i) => v + 3.2 + 1.0 * noise1(day(i) * 0.6, 62)),
      tuned(ind[5], 0.4, err(73, 74), 0.87),
    ];
    const norm = (arr, M) => Float32Array.from(arr, (v) => Math.min(1, Math.max(0, (v - M.lo) / (M.hi - M.lo))));
    return {
      ind: ind.map((a, k) => norm(a, METRICS[k])),
      con: con.map((a, k) => norm(a, METRICS[k])),
    };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    const A = (a) => a * fade;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o, alpha: A(o.alpha ?? 1) });

    // Which metric is on screen, and how far the morph from the previous one has gone.
    let k = 0;
    for (let i = 1; i < START.length; i++) if (t >= START[i]) k = i;
    const kp = Math.max(0, k - 1);
    const m = k === 0 ? 1 : ease.inOut(seg(t, START[k], START[k] + MORPH));
    const sweep = ease.sine(seg(t, DRAW[0], DRAW[1]));
    const iMax = k === 0 ? Math.floor(sweep * (N - 1)) : N - 1;
    const val = (arr, i) => lerp(arr[kp][i], arr[k][i], m);

    // ---- Time series panel ----
    const T = { x: w * 0.115, y: h * 0.3, w: w * 0.505, h: h * 0.39 };
    const px = (i) => T.x + (i / (N - 1)) * T.w;
    const py = (v) => T.y + T.h * (0.96 - 0.88 * v);
    const titleY = h * 0.155;
    const fsT = api.fs(10.5);

    // Metric title (cross-fades on a change) and y ticks.
    const drawMetric = (j, a) => {
      if (a <= 0.01) return;
      const M = METRICS[j];
      lab(compact ? M.name.toUpperCase() : `${M.name.toUpperCase()} · ${M.unit}`, T.x - (compact ? 0 : api.s(36)), titleY, { alpha: a });
      const ticks = compact ? [M.ticks[0], M.ticks[M.ticks.length - 1]] : M.ticks;
      for (const tv of ticks) {
        const y = py((tv - M.lo) / (M.hi - M.lo));
        api.line([[T.x, y], [T.x + T.w, y]], { color: pal.grid, width: 1, alpha: A(a) });
        api.text(String(tv), T.x - api.s(7), y, { size: fsT, color: pal.ink3, align: 'right', base: 'middle', alpha: A(a) });
      }
    };
    // Old labels leave during the first half of a morph, new ones arrive in the second.
    const aOut = 1 - seg(m, 0, 0.45);
    const aIn = seg(m, 0.55, 1);
    if (k === kp) drawMetric(k, 1);
    else {
      drawMetric(kp, aOut);
      drawMetric(k, aIn);
    }
    api.line([[T.x, T.y], [T.x, T.y + T.h], [T.x + T.w, T.y + T.h]], { color: pal.line, width: 1, cap: 'square' });
    for (const wk of compact ? [0, WEEKS] : [0, 10, 20, WEEKS]) {
      const x = T.x + (wk / WEEKS) * T.w;
      api.line([[x, T.y + T.h], [x, T.y + T.h + api.s(4)]], { color: pal.line, width: 1 });
      api.text(wk === WEEKS ? `${wk} wk` : String(wk), x, T.y + T.h + api.s(6) + fsT, { size: fsT, color: pal.ink3, align: wk === WEEKS ? 'right' : 'center' });
    }

    // Legend.
    const legend = (x, y, color, text, align) => {
      const tw = api.measure(text, { size: fsT });
      const sw = Math.max(10, api.s(14));
      const x0 = align === 'right' ? x - tw - sw - api.s(5) : x;
      api.line([[x0, y - fsT * 0.32], [x0 + sw, y - fsT * 0.32]], { color, width: Math.max(1.8, api.s(2)) });
      api.text(text, x0 + sw + api.s(5), y, { size: fsT, color: pal.ink2 });
      return x0;
    };
    if (compact) {
      legend(w * 0.95, titleY, api.accent, 'consumer', 'right');
      legend(w * 0.95, titleY + fsT * 1.35, pal.ink2, 'industrial', 'right');
    } else {
      const x1 = legend(T.x + T.w, titleY, pal.ink2, 'industrial', 'right');
      legend(x1 - api.s(14), titleY, api.accent, 'consumer', 'right');
    }

    // The two series (drawn straight on the context: no per-frame allocations).
    const series = (arr, color, width) => {
      if (iMax < 1) return;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= iMax; i++) {
        const x = px(i);
        const y = py(val(arr, i));
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    };
    series(st.ind, pal.ink2, api.s(1.6));
    series(st.con, api.accent, api.s(1.8));
    if (k === 0 && t < DRAW[1] + 0.4 && iMax >= 1) {
      const a = 1 - seg(t, DRAW[1], DRAW[1] + 0.4);
      const x = px(iMax);
      api.line([[x, T.y + api.s(4)], [x, T.y + T.h]], { color: pal.ink3, width: 1, alpha: A(a * 0.8) });
      api.circle(x, py(val(st.ind, iMax)), api.s(2.8), { fill: pal.ink2, alpha: A(a) });
      api.circle(x, py(val(st.con, iMax)), api.s(2.8), { fill: api.accent, alpha: A(a) });
    }

    // ---- Scatter: consumer vs industrial, against the 1:1 line ----
    const side = Math.min(w * 0.23, T.h);
    const S = { x: w * 0.93 - side, y: T.y };
    const sx = (v) => S.x + side * (0.04 + 0.92 * v);
    const sy = (v) => S.y + side * (0.96 - 0.92 * v);
    if (!compact) lab('CONSUMER vs INDUSTRIAL', S.x + side, titleY, { align: 'right' });
    api.line([[S.x, S.y], [S.x, S.y + side], [S.x + side, S.y + side]], { color: pal.line, width: 1, cap: 'square' });
    api.line([[sx(0), sy(0)], [sx(0.86), sy(0.86)]], { color: pal.ink3, width: 1, dash: [api.s(3), api.s(4)] });
    api.text('1:1', sx(0.93), sy(0.93), { size: fsT, color: pal.ink3, align: 'center', base: 'middle' });
    if (!compact) {
      api.text('industrial', S.x + side, S.y + side + api.s(6) + fsT, { size: fsT, color: pal.ink3, align: 'right' });
      api.text('consumer', S.x + api.s(5), S.y + fsT * 0.9, { size: fsT, color: pal.ink3 });
    }
    const dotR = api.s(compact ? 1.7 : 2);
    for (let i = 0; i < N; i += EVERY) {
      if (i > iMax) break;
      const pop = k === 0 ? ease.out(seg((iMax - i) / (N - 1), 0, 0.06)) : 1;
      api.circle(sx(val(st.ind, i)), sy(val(st.con, i)), dotR * (0.5 + 0.5 * pop), { fill: api.accent, alpha: A(0.7 * pop) });
    }

    // Readout under the scatter: CCC where the paper gives it, otherwise where the cloud sits.
    const readY = compact ? T.y + T.h + api.s(6) + fsT : S.y + side + api.s(42);
    const readout = (j, a) => {
      if (a <= 0.01) return;
      const M = METRICS[j];
      const shown = j === 0 ? seg(t, DRAW[1] - 0.3, DRAW[1] + 0.2) : 1;
      if (M.verdict === 'ok') {
        api.text(`CCC ${M.ccc}`, S.x + side / 2, readY, { size: api.fs(compact ? 12 : 14), weight: 650, color: api.accentInk, align: 'center', alpha: A(a * shown) });
      } else {
        api.text(M.verdict === 'low' ? 'below 1:1' : 'above 1:1', S.x + side / 2, readY, { size: api.fs(compact ? 11 : 12.5), weight: 600, color: pal.ink2, align: 'center', alpha: A(a) });
      }
    };
    if (k === kp) readout(k, 1);
    else {
      readout(kp, aOut);
      readout(k, aIn);
    }

    // ---- Metric chips: the verdict for each metric, filled in as the figure visits it ----
    const cs = api.fs(10.5);
    const chH = cs * 2.05;
    const padX = cs * 0.75;
    const gap = api.s(compact ? 5 : 8);
    const chips = METRICS.map((M, j) => {
      const name = compact ? M.short : M.name;
      const suffix = M.verdict === 'ok' ? (compact ? '' : ` ${M.ccc}`) : M.verdict === 'low' ? ' ↓' : ' ↑';
      const check = M.verdict === 'ok' ? cs * 1.25 : 0;
      const nw = api.measure(name, { size: cs, weight: 600 });
      const sw = api.measure(suffix, { size: cs, weight: 600 });
      return { M, j, name, suffix, check, nw, sw, cw: padX * 2 + nw + sw + check };
    });
    const total = chips.reduce((s, c) => s + c.cw, 0) + gap * (chips.length - 1);
    const chipY = h * 0.875;
    let cx = Math.max(w * 0.05, Math.min(w * 0.5 - total / 2, w - api.s(64) - total));
    for (const c of chips) {
      const reveal = c.j === 0 ? DRAW[1] : START[c.j] + MORPH * 0.8;
      const done = ease.out(seg(t, reveal, reveal + 0.35));
      const active = c.j === k && t >= (c.j === 0 ? DRAW[0] : START[c.j]);
      const ok = c.M.verdict === 'ok';
      const stroke = ok && done > 0.5 ? api.accent : active ? pal.ink2 : pal.line;
      api.rect(cx, chipY - chH / 2, c.cw, chH, { fill: pal.surface, stroke, width: active ? 1.5 : 1, r: chH / 2 });
      const tx = cx + padX;
      const ty = chipY + cs * 0.36;
      api.text(c.name, tx, ty, { size: cs, weight: 600, color: active ? pal.ink : done > 0 ? pal.ink2 : pal.ink3 });
      if (done > 0) {
        const sxx = tx + c.nw;
        if (ok) {
          // A drawn check mark, then the CCC.
          const g = c.check;
          const gx = sxx + cs * 0.45;
          api.line([[gx, chipY], [gx + g * 0.28, chipY + g * 0.26], [gx + g * 0.72, chipY - g * 0.3]], { color: api.accent, width: api.s(1.8), alpha: A(done) });
          api.text(c.suffix, sxx + g, ty, { size: cs, weight: 600, color: api.accentInk, alpha: A(done) });
        } else {
          api.text(c.suffix, sxx, ty, { size: cs, weight: 600, color: pal.ink2, alpha: A(done) });
        }
      }
      cx += c.cw + gap;
    }

    // ---- Live captions ----
    const capX = T.x + T.w / 2;
    const capY = T.y - api.s(compact ? 9 : 14);
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    api.caption(compact ? 'radon agrees' : 'radon: consumer ≈ industrial', capX, capY, 3.0, START[1] - 0.05, acc);
    api.caption(compact ? 'reads lower' : 'consumer reads lower', capX, capY, START[1] + 0.5, START[4] - 0.05, neu);
    api.caption(compact ? 'reads higher' : 'consumer reads higher', capX, capY, START[4] + 0.5, START[5] - 0.05, neu);
    api.caption(compact ? 'pressure agrees' : 'pressure agrees again', capX, capY, START[5] + 0.6, D - 0.45, acc);
    ctx.globalAlpha = 1;
  },
};
