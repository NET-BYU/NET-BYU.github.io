// Sustainable Radon Mitigation through Optimized HVAC Scheduling (CHASE 2025).
// With the ventilation off overnight, radon seeping up from the soil builds up in a
// school's classrooms. The optimized schedule switches the existing HVAC on shortly
// before occupancy and flushes radon below the action level before classes start; a
// naive schedule (neutral) gets there too, but runs the HVAC for more hours.
// Radon values, times and hours are synthetic.
import { clamp, lerp, seg, ease, noise1, TAU } from './kit.js';

const D = 14;
const H0 = 19; // clock: 19:00 …
const H1 = 35; // … to 11:00 the next day
const CLASS = 32; // classes start at 8:00
const ON_NAIVE = 28; // 4:00, a fixed early start
const ON_OPT = 30.5; // 6:30, just early enough
const SWEEP = [0.6, 10.6];
const STEP = 0.02; // simulation step (hours)
const CMAX = 10; // chart top (pCi/L)
const LIMIT = 4; // EPA action level (pCi/L)
const ROOMS = 3;

const hhmm = (hh) => {
  const x = ((hh % 24) + 24) % 24;
  const hr = Math.floor(x + 1e-6);
  const mn = Math.floor((x - hr) * 60 + 1e-6);
  return `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
};

export default {
  duration: D,
  still: 9.4,
  scene: false,

  init(api) {
    const n = Math.round((H1 - H0) / STEP) + 1;
    // First-order radon balance: builds toward a high level with the HVAC off, and is
    // flushed toward outdoor-like levels with it on.
    const sim = (onAt) => {
      const out = new Float32Array(n);
      let c = 2.4; // an hour after the HVAC went off at 18:00
      for (let i = 0; i < n; i++) {
        const hh = H0 + i * STEP;
        out[i] = c;
        const on = hh >= onAt;
        const eq = on ? 1.0 : 9.0;
        const tau = on ? 0.5 : 6;
        c += (eq - c) * (STEP / tau);
      }
      return out;
    };
    // The clock runs slower around the morning flush: cumulative animation time per grid point.
    const tc = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      tc[i] = acc;
      const hh = H0 + i * STEP;
      acc += STEP * (1 + 1.7 * Math.exp(-(((hh - 31.1) / 1.3) ** 2)));
    }
    for (let i = 0; i < n; i++) tc[i] = SWEEP[0] + (tc[i] / acc) * (SWEEP[1] - SWEEP[0]);

    const r = api.rng('radon-hvac');
    const parts = [];
    for (let room = 0; room < ROOMS; room++) {
      for (let i = 0; i < 26; i++) parts.push({ room, fx: r.range(0.08, 0.92), fy: r.range(0.1, 0.9), u: r.range(0.04, 0.95), ph: r() * 100 });
    }
    const soil = Array.from({ length: 16 }, (_, i) => ({ fx: (i + r.range(0.1, 0.9)) / 16, ph: r(), sp: r.range(0.18, 0.3) }));
    return { naive: sim(ON_NAIVE), opt: sim(ON_OPT), tc, n, parts, soil };
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

    // Clock time for this frame (binary search in the warped timeline).
    let hNow = H0;
    if (t >= SWEEP[1]) hNow = H1;
    else if (t > SWEEP[0]) {
      let lo = 0;
      let hi = st.n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (st.tc[mid] <= t) lo = mid;
        else hi = mid;
      }
      const f = (t - st.tc[lo]) / Math.max(1e-6, st.tc[hi] - st.tc[lo]);
      hNow = H0 + (lo + clamp(f)) * STEP;
    }
    const iNow = Math.min(st.n - 1, Math.round((hNow - H0) / STEP));
    const cOpt = st.opt[iNow];
    const optOn = hNow >= ON_OPT;
    const occupied = seg(hNow, CLASS, CLASS + 0.35);

    // ================= Building cross-section (optimized schedule) =================
    const B = { x0: w * 0.06, x1: w * (compact ? 0.44 : 0.42) };
    B.w = B.x1 - B.x0;
    const roofY = h * 0.38;
    const ceilY = roofY + h * 0.065;
    const floorY = h * 0.75;
    const soilB = h * 0.85;
    const roomW = B.w / ROOMS;
    const roomX = (i) => B.x0 + i * roomW;
    const rh = floorY - ceilY;

    // Soil, with radon seeping up toward the slab.
    api.rect(B.x0 - api.s(10), floorY + api.s(4), B.w + api.s(20), soilB - floorY - api.s(4), { fill: pal.grid, alpha: A(0.9) });
    if (!compact) lab('SOIL', B.x0 - api.s(4), soilB - api.s(6), { alpha: 0.9 });
    for (const p of st.soil) {
      const q = ((t * p.sp + p.ph) % 1 + 1) % 1;
      const x = B.x0 + p.fx * B.w;
      const y = lerp(soilB - api.s(2), floorY + api.s(3), q);
      api.circle(x, y, api.s(1.4), { fill: pal.ink3, alpha: A(Math.sin(Math.PI * q) * 0.75) });
    }

    // Room air: tint and radon particles scale with the concentration.
    const level = cOpt / CMAX;
    for (let i = 0; i < ROOMS; i++) {
      api.rect(roomX(i), ceilY, roomW, rh, { fill: pal.ink2, alpha: A(0.03 + 0.15 * level) });
    }
    const pr = api.s(compact ? 1.5 : 1.8);
    for (const p of st.parts) {
      const vis = clamp((level - p.u) * 9 + 0.5);
      if (vis <= 0.01) continue;
      const x0 = roomX(p.room) + roomW * (0.06 + 0.88 * p.fx);
      const y0 = ceilY + rh * (0.08 + 0.84 * p.fy);
      const x = x0 + noise1(t * 0.35 + p.ph, 3) * api.s(5);
      const y = y0 + noise1(t * 0.3 + p.ph, 4) * api.s(4) - (optOn ? api.s(6) * seg(hNow, ON_OPT, ON_OPT + 0.6) : 0);
      api.circle(x, y, pr, { fill: pal.ink2, alpha: A(0.75 * vis) });
    }

    // Shell: slab, walls, ceiling, roof.
    api.line([[B.x0 - api.s(8), floorY + api.s(2)], [B.x1 + api.s(8), floorY + api.s(2)]], { color: pal.ink3, width: api.s(4), cap: 'butt' });
    for (let i = 1; i < ROOMS; i++) api.line([[roomX(i), ceilY], [roomX(i), floorY]], { color: pal.line, width: 1 });
    api.line([[B.x0, floorY], [B.x0, roofY], [B.x1, roofY], [B.x1, floorY]], { color: pal.ink3, width: api.s(1.6) });
    api.line([[B.x0, ceilY], [B.x1, ceilY]], { color: pal.line, width: 1 });
    // Slab cracks where radon enters.
    for (let i = 0; i < ROOMS; i++) {
      const x = roomX(i) + roomW * 0.32;
      api.line([[x, floorY + api.s(4)], [x + api.s(2), floorY + api.s(1)], [x - api.s(1), floorY - api.s(0.5)]], { color: pal.ink3, width: 1 });
    }

    // Desks, then students once classes start.
    for (let i = 0; i < ROOMS; i++) {
      for (let j = 0; j < 2; j++) {
        const dx = roomX(i) + roomW * (0.3 + 0.4 * j);
        const dw = roomW * 0.2;
        const dy = floorY - rh * 0.22;
        api.line([[dx - dw / 2, dy], [dx + dw / 2, dy]], { color: pal.ink3, width: api.s(1.6) });
        api.line([[dx - dw * 0.38, dy], [dx - dw * 0.38, floorY]], { color: pal.ink3, width: 1 });
        api.line([[dx + dw * 0.38, dy], [dx + dw * 0.38, floorY]], { color: pal.ink3, width: 1 });
        if (occupied > 0) {
          const pop = ease.back(seg(occupied - j * 0.15 - i * 0.1, 0, 0.7));
          if (pop > 0) {
            const hr = api.s(compact ? 2.6 : 3.2) * pop;
            api.circle(dx, dy - api.s(compact ? 9 : 11), hr, { fill: pal.ink2, alpha: A(clamp(pop)) });
            ctx.save();
            ctx.globalAlpha = A(clamp(pop));
            ctx.fillStyle = pal.ink2;
            ctx.beginPath();
            ctx.ellipse(dx, dy - api.s(1), hr * 1.5, hr * 1.5, 0, Math.PI, TAU);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    // Rooftop unit and the duct that feeds every classroom.
    const U = { x: B.x1 - api.s(compact ? 40 : 58), y: roofY - api.s(compact ? 16 : 24), w: api.s(compact ? 32 : 46), h: api.s(compact ? 16 : 24) };
    const onA = optOn ? ease.out(seg(hNow, ON_OPT, ON_OPT + 0.25)) : 0;
    const unitColor = onA > 0.5 ? api.accent : pal.ink3;
    api.rect(U.x, U.y, U.w, U.h, { fill: pal.surface, stroke: unitColor, width: api.s(1.4), r: api.s(3) });
    const fc = { x: U.x + U.w * 0.32, y: U.y + U.h / 2, r: U.h * 0.32 };
    api.circle(fc.x, fc.y, fc.r, { stroke: unitColor, width: 1 });
    const ang = optOn ? t * 5 : 0.4;
    for (let b = 0; b < 3; b++) {
      const a = ang + (b * TAU) / 3;
      api.line([[fc.x, fc.y], [fc.x + Math.cos(a) * fc.r * 0.85, fc.y + Math.sin(a) * fc.r * 0.85]], { color: unitColor, width: api.s(1.3) });
    }
    for (let g = 0; g < 3; g++) {
      const gx = U.x + U.w * (0.62 + g * 0.11);
      api.line([[gx, U.y + U.h * 0.25], [gx, U.y + U.h * 0.75]], { color: unitColor, width: 1 });
    }
    if (!compact) lab('HVAC', U.x - api.s(6), U.y + U.h * 0.66, { align: 'right', color: onA > 0.5 ? api.accentInk : pal.ink3 });
    const ductY = (roofY + ceilY) / 2;
    const ductPath = [[U.x + U.w * 0.5, roofY], [U.x + U.w * 0.5, ductY], [B.x0 + roomW * 0.5, ductY]];
    api.line(ductPath, { color: pal.line, width: api.s(compact ? 4 : 6), cap: 'butt' });
    if (onA > 0) {
      ctx.save();
      ctx.globalAlpha = A(onA);
      ctx.setLineDash([api.s(5), api.s(7)]);
      ctx.lineDashOffset = -t * api.s(34);
      ctx.strokeStyle = api.accent;
      ctx.lineWidth = api.s(1.6);
      ctx.beginPath();
      ctx.moveTo(ductPath[0][0], ductPath[0][1]);
      ctx.lineTo(ductPath[1][0], ductPath[1][1]);
      ctx.lineTo(ductPath[2][0], ductPath[2][1]);
      ctx.stroke();
      ctx.restore();
    }
    // Diffusers, with supply air pushing down while the HVAC runs.
    for (let i = 0; i < ROOMS; i++) {
      const x = roomX(i) + roomW * 0.5;
      api.rect(x - api.s(7), ceilY - api.s(1.5), api.s(14), api.s(3), { fill: onA > 0.5 ? api.accent : pal.ink3 });
      if (onA > 0) {
        for (let k = 0; k < 2; k++) {
          const q = ((t * 0.9 + k * 0.5 + i * 0.17) % 1 + 1) % 1;
          const y = ceilY + api.s(5) + q * rh * 0.32;
          const dx = (k ? 1 : -1) * api.s(5) * (0.4 + q);
          api.arrow(x + dx * 0.4, y, x + dx, y + api.s(7), { color: api.accent, width: api.s(1.3), head: api.s(4.5), alpha: A(onA * Math.sin(Math.PI * q)) });
        }
      }
    }

    // ================= Chart: radon vs time, two schedules =================
    const C = { x: w * 0.535, y: h * 0.2, w: w * 0.395, h: h * 0.36 };
    const cx = (hh) => C.x + ((hh - H0) / (H1 - H0)) * C.w;
    const cy = (v) => C.y + C.h * (1 - v / CMAX);
    const tickY = C.y + C.h + api.s(6) + fsL;
    const rowGap = Math.max(api.s(17), fsL * 1.35);
    const rowA = tickY + rowGap;
    const rowB = rowA + rowGap;
    const rowH = api.s(compact ? 5 : 7);

    // Class hours band.
    api.rect(cx(CLASS), C.y, cx(H1) - cx(CLASS), C.h, { fill: pal.grid, alpha: A(0.85) });
    if (!compact && api.measure('classes', { size: fsL }) <= cx(H1) - cx(CLASS) + api.s(2)) lab('classes', (cx(CLASS) + cx(H1)) / 2, C.y + fsL + api.s(4), { spacing: 0, align: 'center' });
    lab(compact ? 'RADON' : 'RADON · pCi/L', C.x - api.s(compact ? 0 : 20), C.y - (compact ? fsL * 1.75 : api.s(22)));
    for (const v of [0, 4, 8]) {
      api.text(String(v), C.x - api.s(7), cy(v), { size: fsL, color: pal.ink3, align: 'right', base: 'middle' });
    }
    api.line([[C.x, C.y], [C.x, C.y + C.h], [C.x + C.w, C.y + C.h]], { color: pal.line, width: 1, cap: 'square' });
    // EPA action level, keyed in the empty top-left of the plot (no curve passes there).
    const dash = [api.s(4), api.s(3)];
    api.line([[C.x, cy(LIMIT)], [C.x + C.w, cy(LIMIT)]], { color: pal.ink2, width: 1, dash });
    const ky = C.y + api.s(compact ? 7 : 9);
    const ksw = Math.max(12, api.s(16));
    api.line([[C.x + api.s(8), ky], [C.x + api.s(8) + ksw, ky]], { color: pal.ink2, width: 1, dash });
    const keyLong = 'EPA action level 4 pCi/L';
    const keyText = !compact && api.measure(keyLong, { size: fsL }) <= cx(CLASS) - (C.x + api.s(19) + ksw) ? keyLong : 'EPA 4 pCi/L';
    api.text(keyText, C.x + api.s(13) + ksw, ky + fsL * 0.34, { size: fsL, color: pal.ink2 });
    const keyEnd = C.x + api.s(13) + ksw + api.measure(keyText, { size: fsL });

    // Curves up to the clock: naive underneath (wider, neutral), optimized on top.
    const curve = (arr, color, width) => {
      if (iNow < 1) return;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= iNow; i += 2) {
        const x = cx(H0 + i * STEP);
        const y = cy(arr[i]);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.lineTo(cx(hNow), cy(arr[iNow]));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    };
    curve(st.naive, pal.ink2, api.s(2.6));
    curve(st.opt, api.accent, api.s(1.9));

    // Schedule rows: when each schedule has the HVAC on (class-time running is shared, so dimmer).
    const row = (y, onAt, color, name, nameColor) => {
      const nw = api.measure(name, { size: fsL }) + api.s(6);
      api.text(name, C.x, y + fsL * 0.34, { size: fsL, color: nameColor });
      api.line([[C.x + nw, y], [C.x + C.w, y]], { color: pal.line, width: 1 });
      if (hNow > onAt) {
        const preEnd = Math.min(hNow, CLASS);
        api.rect(cx(onAt), y - rowH / 2, Math.max(1, cx(preEnd) - cx(onAt)), rowH, { fill: color, r: rowH / 2 });
        if (hNow > CLASS) api.rect(cx(CLASS), y - rowH / 2, cx(hNow) - cx(CLASS), rowH, { fill: color, r: rowH / 2, alpha: A(0.35) });
      }
    };
    if (!compact) {
      row(rowA, ON_NAIVE, pal.ink2, 'naive · HVAC on', pal.ink2);
      row(rowB, ON_OPT, api.accent, 'optimized · HVAC on', api.accentInk);
    }

    // Time axis.
    for (const hh of compact ? [24, 32] : [20, 24, 28, 32]) {
      api.line([[cx(hh), C.y + C.h], [cx(hh), C.y + C.h + api.s(4)]], { color: pal.line, width: 1 });
      api.text(hhmm(hh).replace(/^0(?=\d:)/, ''), cx(hh), tickY, { size: fsL, color: pal.ink3, align: 'center' });
    }

    // Clock cursor.
    if (t > SWEEP[0] - 0.2) {
      const x = cx(hNow);
      const ca = 1 - seg(t, SWEEP[1] + 0.3, SWEEP[1] + 0.9);
      const top = x < keyEnd + api.s(4) ? ky + api.s(7) : C.y - api.s(2); // stay clear of the EPA key
      api.line([[x, top], [x, C.y + C.h]], { color: pal.ink3, width: 1, alpha: A(ca) });
      api.circle(x, cy(st.naive[iNow]), api.s(3), { fill: pal.ink2, alpha: A(ca) });
      api.circle(x, cy(cOpt), api.s(3), { fill: api.accent, alpha: A(ca) });
      api.text(hhmm(hNow), x, C.y - api.s(6), { size: api.fs(11), weight: 600, color: pal.ink, align: 'center', alpha: A(ca) });
    }

    // ================= HVAC hours before class =================
    const bY = compact ? tickY + fsL * 2.7 : rowB + api.s(40);
    const bH = api.s(compact ? 6 : 8);
    const nameW = api.measure('optimized', { size: fsL }) + api.s(10);
    const unitW = (C.w * 0.62) / (CLASS - ON_NAIVE);
    const bx = C.x;
    const hoursA = Math.max(0, Math.min(hNow, CLASS) - ON_NAIVE);
    const hoursB = Math.max(0, Math.min(hNow, CLASS) - ON_OPT);
    lab(compact ? 'HVAC HOURS' : 'HVAC HOURS BEFORE CLASS', bx, bY - (compact ? fsL * 1.3 : api.s(16)));
    const bar = (y, hrs, color, name, nameColor) => {
      api.text(name, bx, y + fsL * 0.36, { size: fsL, color: nameColor });
      api.line([[bx + nameW, y], [bx + nameW + unitW * (CLASS - ON_NAIVE), y]], { color: pal.grid, width: 1 });
      if (hrs > 0) api.rect(bx + nameW, y - bH / 2, unitW * hrs, bH, { fill: color, r: bH / 2 });
    };
    bar(bY, hoursA, pal.ink2, 'naive', pal.ink2);
    bar(bY + Math.max(bH + api.s(9), fsL * 1.3), hoursB, api.accent, 'optimized', api.accentInk);

    // ================= Live captions (over the building) =================
    const capX = (B.x0 + B.x1) / 2 - (compact ? 0 : api.s(10));
    const capY = U.y - api.fs(11.5) - api.s(compact ? 5 : 8);
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    api.caption(compact ? 'radon builds up' : 'HVAC off: radon builds up', capX, capY, 1.3, 6.4, neu);
    api.caption('on just before class', capX, capY, 6.75, 8.45, acc);
    api.caption('below 4 pCi/L by 8:00', capX, capY, 8.6, 11.0, acc);
    api.caption('fewer HVAC hours', capX, capY, 11.1, D - 0.6, acc);
    ctx.globalAlpha = 1;
  },
};
