// Network Layer Spectral Coordination Integrated With Hadamard Projection (DySPAN 2024).
// A passive receiver (a radio-astronomy array) broadcasts its spectrum-use plan with a
// protocol any radio can decode from channel energy alone. Compliant active users move
// out of the protected band. One non-compliant interferer stays: the array's time-delay
// Hadamard projection lines it up across the four channels, so it becomes a common-mode
// term that the projection discards, while the weak signal of interest passes through.
import { lerp, seg, ease, noise2, mix } from './kit.js';

const D = 13;
const BAND = [0.32, 0.72];
const USERS = [
  { c0: 0.37, c1: 0.13, wd: 0.034, amp: 0.5, ok: true },
  { c0: 0.47, c1: 0.47, wd: 0.034, amp: 0.74, ok: false },
  { c0: 0.655, c1: 0.875, wd: 0.034, amp: 0.44, ok: true },
];
const NC = 1; // index of the non-compliant user
const SOI = { c: 0.565, wd: 0.013, amp: 0.2 };
const H4 = [[1, 1, 1, 1], [1, -1, 1, -1], [1, 1, -1, -1], [1, -1, -1, 1]];
const T = { band: 0.6, ring: 0.9, gap: 0.34, move: 1.4, chain: 5.3, null0: 6.5, null1: 8.1 };
const CAP = [[0.9, 2.1], [2.15, 4.7], [6.5, 8.9], [9.0, 12.3]];
const PB = 0.8; // period of the sample stream drawn through the receiver chain (s)
const DI = [0, 0.1, 0.2, 0.3]; // interferer arrival offset at each element (s)
const DS = [0.18, 0.12, 0.06, 0]; // signal-of-interest offsets (it arrives from another angle)
const DMAX = 0.3;
const SOI_LAG = 0.36;

const humpFlat = (u, c, wd) => Math.exp(-Math.pow(Math.abs((u - c) / wd), 4));
const humpGauss = (u, c, wd) => Math.exp(-0.5 * ((u - c) / wd) ** 2);

export default {
  duration: D,
  still: 9.8,

  draw(api) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });

    // ---------- Geometry ----------
    const P = compact ? { x: w * 0.07, y: h * 0.34, w: w * 0.585, h: h * 0.46 } : { x: w * 0.07, y: h * 0.32, w: w * 0.585, h: h * 0.52 };
    const base = P.y + P.h;
    const ux = (u) => P.x + u * P.w;
    const vy = (v) => base - v * P.h * 0.86;
    const R = { x: w * 0.735, w: w * 0.205 };
    const chx = (i) => R.x + R.w * (0.125 + 0.25 * i);
    const acx = R.x + R.w / 2;
    const ay = h * 0.17;
    const gy = P.y - s(compact ? 20 : 26); // device glyph row
    const glyph = Math.max(5.5, s(10));
    const dishR = Math.max(4, s(8.5));
    const lineTop = ay + dishR * 1.05;
    const Dy0 = h * 0.37;
    const Dy1 = Dy0 + Math.max(14, s(19));
    const cellW = R.w * 0.25 * 0.72;
    const cellH = Math.max(7, s(12));
    const Hy0 = h * (compact ? 0.56 : 0.57);
    const yRow = (r) => Hy0 + r * cellH + cellH / 2;

    // ---------- Ripple timing: when the broadcast reaches each active user ----------
    const speed = Math.max(w, h * 1.6) * 0.55;
    const userState = USERS.map((us) => {
      const hit = T.ring + Math.hypot(acx - ux(us.c0), ay - gy) / speed;
      const mv = us.ok ? ease.inOut(seg(t, hit + 0.45, hit + 0.45 + T.move)) : 0;
      return { hit, c: lerp(us.c0, us.c1, mv) };
    });
    const ringFar = Math.max(...userState.map((u, i) => (u.hit - T.ring) * speed + (i === 0 ? 0 : 0))) + s(60);
    const nullK = ease.inOut(seg(t, T.null0, T.null1));
    const ampOf = (i) => (i === NC ? USERS[i].amp * (1 - 0.95 * nullK) : USERS[i].amp);

    // Spectrum model (normalized power).
    const floorAt = (u) => 0.075 + 0.022 * noise2(u * 26, t * 1.2, 3) + 0.012 * noise2(u * 71, t * 2.1, 7);
    const specAt = (u, withNull = true) => {
      let v = floorAt(u);
      for (let i = 0; i < USERS.length; i++) v += (withNull ? ampOf(i) : USERS[i].amp) * humpFlat(u, userState[i].c, USERS[i].wd);
      return v + SOI.amp * humpGauss(u, SOI.c, SOI.wd);
    };

    // ---------- Spectrum panel ----------
    lab(compact ? 'RX SPECTRUM' : 'PASSIVE RX · SPECTRUM', P.x, h * 0.13);
    api.line([[P.x, P.y - s(4)], [P.x, base], [P.x + P.w, base]], { color: pal.line, width: 1, cap: 'square' });
    lab('frequency', P.x + P.w, base + s(15), { align: 'right' });
    if (!compact) lab('power', P.x + s(6), P.y + s(8));

    // Protected band: the passive user's plan.
    const bandA = ease.out(seg(t, T.band, T.band + 0.6));
    const bx0 = ux(BAND[0]);
    const bx1 = ux(BAND[1]);
    if (bandA > 0) {
      api.rect(bx0, P.y - s(4), bx1 - bx0, base - P.y + s(4), { fill: api.accent, alpha: 0.09 * bandA });
      for (const bx of [bx0, bx1]) api.line([[bx, P.y - s(4)], [bx, base]], { color: api.accent, width: 1, dash: [s(3), s(3)], alpha: 0.7 * bandA });
      lab(compact ? 'PROTECTED' : 'PROTECTED BAND', (bx0 + bx1) / 2, P.y + s(compact ? 9 : 11), { align: 'center', color: api.accentInk, alpha: bandA });
    }

    // Trace.
    const step = Math.max(1, s(2)) / P.w;
    const pts = [];
    for (let u = 0; u <= 1 + 1e-9; u += step) pts.push([ux(u), vy(specAt(u))]);
    api.line([...pts, [ux(1), base], [ux(0), base]], { color: 'none', fill: pal.dark ? 'rgba(233,235,239,0.06)' : 'rgba(20,22,28,0.05)', close: true });

    // Ghost of the interferer before projection (the before/after comparison).
    const nc = USERS[NC];
    if (nullK > 0) {
      const ghost = [];
      for (let u = nc.c0 - nc.wd * 2.2; u <= nc.c0 + nc.wd * 2.2; u += step) ghost.push([ux(u), vy(specAt(u, false))]);
      api.line(ghost, { color: pal.ink3, width: s(1.3), dash: [s(3), s(3)], alpha: Math.min(1, nullK * 3) });
      const gA = ease.out(seg(t, T.null1 - 0.5, T.null1 + 0.1));
      const topY = vy(0.075 + nc.amp);
      lab('before', ux(nc.c0 + nc.wd * 1.05) + s(4), topY + s(9), { color: pal.ink2, alpha: gA });
      if (!compact) lab('after', ux((BAND[0] + nc.c0 - nc.wd * 1.25) / 2), vy(0.11) - s(5), { align: 'center', color: pal.ink2, alpha: gA });
    }
    api.line(pts, { color: pal.ink2, width: s(1.6) });

    // Signal of interest, in the area color.
    const soiPts = [];
    for (let u = SOI.c - SOI.wd * 3.2; u <= SOI.c + SOI.wd * 3.2; u += step * 0.5) soiPts.push([ux(u), vy(specAt(u))]);
    const soiFloor = [];
    for (let i = soiPts.length - 1; i >= 0; i--) soiFloor.push([soiPts[i][0], vy(floorAt((soiPts[i][0] - P.x) / P.w))]);
    api.line([...soiPts, ...soiFloor], { color: 'none', fill: api.accent, close: true, alpha: 0.3 });
    api.line(soiPts, { color: api.accent, width: s(2) });

    // ---------- Active users (glyphs ride above their humps) ----------
    USERS.forEach((us, i) => {
      const st = userState[i];
      const x = ux(st.c);
      const hitP = seg(t, st.hit, st.hit + 0.55);
      if (hitP > 0 && hitP < 1) api.circle(x, gy - glyph * 0.3, glyph * (1 + 0.8 * ease.out(hitP)), { stroke: api.accent, width: s(1.4), alpha: 0.8 * (1 - hitP) });
      drawRadio(api, x, gy, glyph, pal.ink2);
      const markA = ease.out(seg(t, st.hit + 0.15, st.hit + 0.45));
      if (markA <= 0) return;
      const mx = x + glyph * 1.6;
      const my = gy - glyph * 1.1;
      const k = glyph * 0.42;
      if (us.ok) {
        api.line([[mx - k, my], [mx - k * 0.25, my + k * 0.75], [mx + k, my - k * 0.8]], { color: api.accent, width: s(1.8), alpha: markA });
      } else {
        api.line([[mx - k * 0.7, my - k * 0.7], [mx + k * 0.7, my + k * 0.7]], { color: pal.ink2, width: s(1.6), alpha: markA });
        api.line([[mx - k * 0.7, my + k * 0.7], [mx + k * 0.7, my - k * 0.7]], { color: pal.ink2, width: s(1.6), alpha: markA });
        if (!compact) lab('ignores plan', x, gy - glyph * 2.25, { align: 'center', color: pal.ink2, alpha: markA });
      }
    });

    // ---------- Broadcast ripple (keyed on and off in energy, drawn as dashes) ----------
    for (let k = 0; k < 3; k++) {
      const r = (t - T.ring - k * T.gap) * speed;
      if (r <= dishR * 2 || r > ringFar) continue;
      const a = 0.7 * Math.pow(1 - r / ringFar, 0.6);
      ctx.save();
      ctx.beginPath();
      ctx.arc(acx, ay, r, Math.PI * 0.74, Math.PI * 1.1);
      ctx.strokeStyle = api.accent;
      ctx.globalAlpha = a;
      ctx.lineWidth = s(1.6);
      ctx.setLineDash([s(6), s(4)]);
      ctx.stroke();
      ctx.restore();
    }

    // ---------- Passive receiver: four-element array + time-delay Hadamard projection ----------
    lab(compact ? 'PASSIVE RX' : 'PASSIVE RX ARRAY', acx, ay - dishR - s(10), { align: 'center' });
    const chainA = 0.4 + 0.6 * ease.out(seg(t, T.chain, T.chain + 0.6));
    for (let i = 0; i < 4; i++) {
      api.line([[chx(i), lineTop], [chx(i), Hy0]], { color: pal.line, width: 1 });
      drawDish(api, chx(i), ay, dishR, pal.ink2, pal.surface);
    }

    // Stream timing through the chain (seconds after each sample reaches the array).
    const vpx = (Dy0 - lineTop) / 0.42;
    const tA = 0.42;
    const tD = 0.12;
    const tC = (Hy0 - Dy1) / vpx;
    const tIntAt = tA + DMAX + tD + tC; // interferer reaches the matrix on all channels at once
    const tSoiAt = SOI_LAG + Math.max(...DS.map((d, i) => d + DMAX - DI[i])) + tA + tD + tC;
    const kNow = Math.floor((t - T.chain) / PB);
    const since = (at) => {
      if (t < T.chain) return 99;
      let best = 99;
      for (let k = Math.max(0, kNow - 2); k <= kNow; k++) {
        const d = t - (T.chain + k * PB + at);
        if (d >= 0 && d < best) best = d;
      }
      return best;
    };
    const glowI = Math.max(0, 1 - since(tIntAt) / 0.35);
    const glowS = Math.max(0, 1 - since(tSoiAt) / 0.45);

    ctx.save();
    ctx.globalAlpha = chainA;
    api.rect(R.x, Dy0, R.w, Dy1 - Dy0, { fill: pal.surface, stroke: pal.line, width: 1, r: s(3) });
    api.text('DELAY', acx, (Dy0 + Dy1) / 2 + 0.5, { size: api.fs(10), color: pal.ink2, align: 'center', base: 'middle', weight: 600, spacing: 0.4 });
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const col = r === 0 ? mix(pal.ink3, pal.ink, glowI * 0.8) : mix(pal.ink2, api.accent, glowS);
        api.rect(chx(c) - cellW / 2, Hy0 + r * cellH + 1, cellW, cellH - 2, { fill: H4[r][c] > 0 ? col : pal.surface, stroke: col, width: 1, r: Math.min(s(2), cellH * 0.2), alpha: chainA * (r === 0 ? 0.55 + 0.45 * glowI : 0.9) });
      }
    }
    api.text('HADAMARD', acx, Hy0 + cellH * 4 + s(15), { size: api.fs(10), color: api.accentInk, align: 'center', weight: 600, spacing: 0.4 });
    // Outputs leave to the left. Row 0, the sum the interferer collapses into, is discarded.
    const gx0 = chx(0) - cellW / 2 - s(3);
    const xStub = gx0 - s(12);
    const xk = Math.max(2, s(3));
    api.line([[gx0, yRow(0)], [xStub, yRow(0)]], { color: pal.ink3, width: 1 });
    api.line([[xStub - xk, yRow(0) - xk], [xStub + xk, yRow(0) + xk]], { color: pal.ink3, width: Math.max(1, s(1.3)) });
    api.line([[xStub - xk, yRow(0) + xk], [xStub + xk, yRow(0) - xk]], { color: pal.ink3, width: Math.max(1, s(1.3)) });
    const tipX = P.x + P.w + s(6);
    const joinX = tipX + Math.max(8, s(14));
    const outY = yRow(2);
    for (let r = 1; r < 4; r++) api.line([[gx0, yRow(r)], [gx0 - s(6), yRow(r)], [joinX, outY]], { color: pal.line, width: 1 });
    api.arrow(joinX, outY, tipX, outY, { color: pal.ink3, width: 1, head: Math.max(5, s(6)) });
    ctx.restore();

    // Sample stream: interferer (neutral) and signal of interest (accent) on each channel.
    if (t >= T.chain) {
      const rB = Math.max(1.8, s(2.6));
      for (let k = Math.max(0, kNow - 3); k <= kNow; k++) {
        const t0 = T.chain + k * PB;
        for (let i = 0; i < 4; i++) {
          blip(api, t - t0 - DI[i], DMAX - DI[i], chx(i), lineTop, Dy0, Dy1, Hy0, tA, tD, tC, rB, pal.ink2);
          blip(api, t - t0 - DS[i] - SOI_LAG, DMAX - DI[i], chx(i), lineTop, Dy0, Dy1, Hy0, tA, tD, tC, rB, api.accent);
        }
        // The aligned interferer leaves only on row 0 (discarded) ...
        const pI = seg(t, t0 + tIntAt, t0 + tIntAt + 0.35);
        if (pI > 0 && pI < 1) api.circle(lerp(gx0, xStub, pI), yRow(0), rB, { fill: pal.ink2, alpha: 1 - pI * 0.6 });
        // ... while the signal of interest leaves on the remaining rows.
        const pS = seg(t, t0 + tSoiAt, t0 + tSoiAt + 0.55);
        if (pS > 0 && pS < 1) {
          const e = ease.inOut(pS);
          for (let r = 1; r < 4; r++) {
            const x = e < 0.12 ? lerp(gx0, gx0 - s(6), e / 0.12) : lerp(gx0 - s(6), joinX, (e - 0.12) / 0.88);
            const y = e < 0.12 ? yRow(r) : lerp(yRow(r), outY, (e - 0.12) / 0.88);
            api.circle(x, y, rB, { fill: api.accent, alpha: 1 - 0.3 * pS });
          }
        }
      }
    }

    // ---------- Captions ----------
    const capO = { color: api.accentInk, border: api.accent, size: api.fs(11) };
    const midX = P.x + P.w / 2;
    const capY = compact ? h * 0.93 : P.y + s(36);
    api.caption('passive RX broadcasts its plan', compact ? midX : R.x + R.w, compact ? capY : (ay + Dy0) / 2 + s(6), CAP[0][0], CAP[0][1], { ...capO, align: compact ? 'center' : 'right' });
    api.caption('compliant users move out', midX, capY, CAP[1][0], CAP[1][1], capO);
    api.caption('Hadamard projection removes it', midX, capY, CAP[2][0], CAP[2][1], capO);
    api.caption('signal of interest preserved', compact ? midX : ux(SOI.c), capY, CAP[3][0], CAP[3][1], capO);

    // ---------- Loop fade ----------
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};

// One sample on one channel: element → delay block (held for `hold`) → Hadamard matrix.
function blip(api, dt, hold, x, y0, Dy0, Dy1, Hy0, tA, tD, tC, r, color) {
  if (dt < 0) return;
  if (dt < tA) {
    api.circle(x, lerp(y0, Dy0, dt / tA), r, { fill: color });
    return;
  }
  const t2 = dt - tA - hold - tD;
  if (t2 >= 0 && t2 < tC) api.circle(x, lerp(Dy1, Hy0, t2 / tC), r, { fill: color });
}

function drawRadio(api, x, y, sz, color) {
  const lw = Math.max(1, api.s(1.2));
  api.rect(x - sz, y - sz * 0.55, sz * 2, sz * 1.1, { fill: api.pal.surface, stroke: color, width: lw, r: sz * 0.25 });
  api.line([[x + sz * 0.55, y - sz * 0.55], [x + sz * 0.55, y - sz * 1.45]], { color, width: lw });
  api.circle(x + sz * 0.55, y - sz * 1.45, Math.max(1.2, sz * 0.17), { fill: color });
  api.circle(x - sz * 0.45, y, Math.max(1, sz * 0.14), { fill: color });
}

function drawDish(api, x, y, r, color, fill) {
  const { ctx } = api;
  const lw = Math.max(1, api.s(1.3));
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - r * 0.55, r, Math.PI * 0.12, Math.PI * 0.88);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
  api.line([[x, y + r * 0.42], [x, y + r * 1.05]], { color, width: lw });
  api.line([[x, y - r * 0.1], [x, y - r * 0.85]], { color, width: 1 });
  api.circle(x, y - r * 0.85, Math.max(1, r * 0.14), { fill: color });
}
