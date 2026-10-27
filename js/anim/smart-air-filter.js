// Smart Home Air Filtering System: A Randomized Controlled Trial for Performance
// Evaluation (CHASE 2018).
// Enrolled homes are randomized into a smart-filter group and a control group. In the
// filter homes the filter switches itself on when PM rises and clears the spike fast;
// in control homes spikes linger. Each group's cumulative exposure is tracked, and the
// two curves separate over the trial. All values are synthetic and qualitative.
import { TAU, clamp, lerp, seg, ease } from './kit.js';

const D = 14;
const HOMES = 12;
const ASSIGN = [0.9, 2.3]; // homes are assigned one after another
const MOVE = [2.5, 3.4]; // homes slide into their groups
const TRIAL = [3.5, 11.7]; // trial runs (animation seconds)
const DT = 0.02;
const ON_AT = 0.3; // filter switches on above this PM level …
const OFF_AT = 0.12; // … and off again below this one

export default {
  duration: D,
  still: 10.9,
  scene: false,

  init(api) {
    const r = api.rng('smart-air-filter');
    // Balanced randomization: 6 filter, 6 control, in a shuffled order.
    const group = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    const order = Array.from({ length: HOMES }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const assignAt = new Float32Array(HOMES);
    order.forEach((h, k) => { assignAt[h] = ASSIGN[0] + (k / (HOMES - 1)) * (ASSIGN[1] - ASSIGN[0]); });
    // Slot within the group row.
    const slot = new Int8Array(HOMES);
    let a = 0;
    let b = 0;
    for (let i = 0; i < HOMES; i++) slot[i] = group[i] ? a++ : b++;

    // PM events (cooking, cleaning, outdoor smoke…) at random times in each home.
    const n = Math.round((TRIAL[1] - TRIAL[0]) / DT) + 1;
    const pm = [];
    const fan = [];
    for (let i = 0; i < HOMES; i++) {
      const events = [];
      let tt = TRIAL[0] + r.range(0.1, 1.4);
      while (tt < TRIAL[1] - 0.6) {
        events.push({ t: tt, amp: r.range(0.55, 0.95) });
        tt += r.range(1.9, 3.2);
      }
      const level = new Float32Array(n);
      const on = new Uint8Array(n);
      let v = 0.08;
      let running = false;
      for (let k = 0; k < n; k++) {
        const t = TRIAL[0] + k * DT;
        let src = 0;
        for (const e of events) if (t >= e.t && t < e.t + 0.35) src += e.amp / 0.35;
        if (group[i]) {
          if (!running && v > ON_AT) running = true;
          if (running && v < OFF_AT) running = false;
        }
        const tau = running ? 0.32 : 1.7;
        v += src * DT + ((0.08 - v) / tau) * DT;
        level[k] = v;
        on[k] = running ? 1 : 0;
      }
      pm.push(level);
      fan.push(on);
    }
    // Cumulative exposure of each group's mean.
    const cum = [new Float32Array(n), new Float32Array(n)]; // [control, filter]
    for (let g = 0; g < 2; g++) {
      let acc = 0;
      for (let k = 0; k < n; k++) {
        let s = 0;
        for (let i = 0; i < HOMES; i++) if (group[i] === g) s += pm[i][k];
        acc += (s / 6) * DT;
        cum[g][k] = acc;
      }
    }
    const top = cum[0][n - 1] / 0.9;
    for (let g = 0; g < 2; g++) for (let k = 0; k < n; k++) cum[g][k] /= top;
    return { group, assignAt, slot, pm, fan, cum, n };
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
    const k = clamp(Math.round((t - TRIAL[0]) / DT), 0, st.n - 1);
    const inTrial = t >= TRIAL[0];

    // ================= Homes: grid → randomized into two rows =================
    const L = compact ? { x: w * 0.05, w: w * 0.45 } : { x: w * 0.07, w: w * 0.42 };
    const hs = api.s(compact ? 25 : 30); // house width
    const gridPos = (i) => ({ x: L.x + ((i % 4) + 0.5) * (L.w / 4), y: h * (compact ? 0.33 : 0.34) + Math.floor(i / 4) * h * (compact ? 0.2 : 0.19) });
    const rowY = [h * (compact ? 0.76 : 0.74), h * (compact ? 0.42 : 0.41)]; // [control, filter]
    const groupPos = (i) => ({ x: L.x + (st.slot[i] + 0.5) * (L.w / 6), y: rowY[st.group[i]] });
    const titleY = h * (compact ? 0.11 : 0.155);
    const gridA = 1 - seg(t, MOVE[0], MOVE[0] + 0.3);
    if (gridA > 0) lab(compact ? 'HOMES' : 'ENROLLED HOMES', L.x, titleY, { alpha: gridA });
    const grpA = seg(t, MOVE[1] - 0.3, MOVE[1] + 0.2);
    if (grpA > 0) {
      lab('SMART FILTER', L.x, rowY[1] - hs * 1.05 - api.s(compact ? 6 : 10), { alpha: grpA, color: api.accentInk });
      lab('CONTROL', L.x, rowY[0] - hs * 1.05 - api.s(compact ? 6 : 10), { alpha: grpA });
    }

    const house = (x, y, s) => {
      // Body from y-0.62s to y, roof up to y-1.02s.
      ctx.beginPath();
      ctx.moveTo(x - s / 2, y);
      ctx.lineTo(x - s / 2, y - s * 0.62);
      ctx.lineTo(x, y - s * 1.02);
      ctx.lineTo(x + s / 2, y - s * 0.62);
      ctx.lineTo(x + s / 2, y);
      ctx.closePath();
    };
    for (let i = 0; i < HOMES; i++) {
      const p0 = gridPos(i);
      const p1 = groupPos(i);
      const lag = st.slot[i] * 0.05 + (st.group[i] ? 0 : 0.08); // homes file into their rows left to right
      const f = ease.inOut(seg(t, MOVE[0] + lag, MOVE[1] - 0.33 + lag));
      const x = lerp(p0.x, p1.x, f);
      const y = lerp(p0.y, p1.y, f);
      const assigned = seg(t, st.assignAt[i], st.assignAt[i] + 0.25);
      const isF = st.group[i] === 1;
      const level = inTrial ? st.pm[i][k] : 0.08;
      // PM level fills the house from the floor up.
      ctx.save();
      house(x, y, hs);
      ctx.clip();
      const lv = clamp(level / 1.0) * hs * 1.02;
      ctx.globalAlpha = A(pal.dark ? 0.32 : 0.22);
      ctx.fillStyle = pal.ink2;
      ctx.fillRect(x - hs / 2, y - lv, hs, lv);
      ctx.restore();
      ctx.save();
      house(x, y, hs);
      ctx.globalAlpha = A(1);
      ctx.strokeStyle = assigned > 0.5 ? (isF ? api.accent : pal.ink2) : pal.ink3;
      ctx.lineWidth = api.s(assigned > 0.5 && isF ? 1.6 : 1.3);
      ctx.lineJoin = 'round';
      if (assigned <= 0.5) ctx.setLineDash([api.s(2.5), api.s(2.5)]); // not yet assigned
      ctx.stroke();
      ctx.restore();
      // Assignment pop.
      if (assigned > 0 && assigned < 1) {
        api.circle(x, y - hs * 0.5, hs * (0.5 + 0.5 * ease.out(assigned)), { stroke: isF ? api.accent : pal.ink3, width: 1, alpha: A(1 - assigned) });
      }
      // The filter unit: an outline fan, spinning (and in the area colour) while it runs.
      if (isF && assigned > 0.5) {
        const running = inTrial && st.fan[i][k] === 1;
        const fr = hs * 0.17;
        const fxp = x + hs * 0.2;
        const fyp = y - hs * 0.22;
        api.circle(fxp, fyp, fr, { stroke: running ? api.accent : pal.ink3, width: 1 });
        const ang = running ? t * 5.5 : 0.5;
        for (let b = 0; b < 3; b++) {
          const an = ang + (b * TAU) / 3;
          api.line([[fxp, fyp], [fxp + Math.cos(an) * fr * 0.85, fyp + Math.sin(an) * fr * 0.85]], { color: running ? api.accent : pal.ink3, width: api.s(1.2) });
        }
      }
    }

    // ================= Cumulative exposure by group =================
    const C = compact ? { x: w * 0.6, y: h * 0.24, w: w * 0.35, h: h * 0.5 } : { x: w * 0.6, y: h * 0.25, w: w * 0.33, h: h * 0.46 };
    lab(compact ? 'EXPOSURE' : 'CUMULATIVE PM EXPOSURE', C.x - (compact ? 0 : api.s(4)), titleY);
    api.line([[C.x, C.y], [C.x, C.y + C.h], [C.x + C.w, C.y + C.h]], { color: pal.line, width: 1, cap: 'square' });
    lab('time in trial →', C.x + C.w, C.y + C.h + api.s(8) + fsL, { align: 'right', spacing: 0 });
    if (!compact) lab('start', C.x, C.y + C.h + api.s(8) + fsL, { spacing: 0 });
    const cx = (kk) => C.x + (kk / (st.n - 1)) * C.w;
    const cy = (v) => C.y + C.h * (1 - v);
    if (inTrial && k > 0) {
      for (let g = 0; g < 2; g++) {
        ctx.save();
        ctx.beginPath();
        for (let kk = 0; kk <= k; kk += 2) {
          const x = cx(kk);
          const y = cy(st.cum[g][kk]);
          if (kk) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.lineTo(cx(k), cy(st.cum[g][k]));
        ctx.strokeStyle = g ? api.accent : pal.ink2;
        ctx.lineWidth = api.s(g ? 2.1 : 1.8);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
        api.circle(cx(k), cy(st.cum[g][k]), api.s(2.8), { fill: g ? api.accent : pal.ink2 });
      }
      // The gap between the groups, once it has opened up.
      const gapA = seg(t, 7.2, 8.0);
      if (gapA > 0) {
        const x = cx(k) + api.s(8);
        const y0 = cy(st.cum[0][k]);
        const y1 = cy(st.cum[1][k]);
        api.line([[x - api.s(3), y0], [x, y0], [x, y1], [x - api.s(3), y1]], { color: pal.ink3, width: 1, alpha: A(gapA) });
      }
    }
    // Legend in the plot's top-left corner, which the rising curves never reach.
    const lx = C.x + api.s(10);
    const sw = Math.max(10, api.s(14));
    [['control', pal.ink2, pal.ink2], [compact ? 'filter' : 'smart filter', api.accent, api.accentInk]].forEach(([name, col, ink], i) => {
      const y = C.y + api.s(8) + fsL * (0.4 + i * 1.45);
      api.line([[lx, y - fsL * 0.32], [lx + sw, y - fsL * 0.32]], { color: col, width: Math.max(1.8, api.s(2)) });
      api.text(name, lx + sw + api.s(6), y, { size: fsL, color: ink, weight: i ? 600 : 500 });
    });

    // ================= Live captions =================
    const capX = w * 0.5;
    const capY = h * (compact ? 0.93 : 0.925);
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    api.caption(compact ? 'randomized: filter vs control' : 'homes randomized: smart filter vs control', capX, capY, ASSIGN[0] + 0.1, TRIAL[0] + 0.3, neu);
    api.caption(compact ? 'filter turns on as PM rises' : 'the filter switches on when PM rises', capX, capY, TRIAL[0] + 0.5, 7.6, acc);
    api.caption(compact ? 'exposure curves separate' : 'the groups’ exposure curves separate', capX, capY, 7.8, D - 0.6, acc);
    ctx.globalAlpha = 1;
  },
};
