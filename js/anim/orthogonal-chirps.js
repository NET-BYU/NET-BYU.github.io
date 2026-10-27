// Using Orthogonal Chirps Underwater for In-Band, Full-Duplex Communication (WUWNet 2024).
// Nodes A and B transmit at the same time in the same band: A with up-chirps, B with
// down-chirps. At A's receiver its own loud signal swamps B's. Multiplying by the conjugate
// of B's base down-chirp ("dechirping") turns each of B's symbols into a constant tone,
// so the FFT shows one sharp spike at the symbol's value, while A's own up-chirps become
// even steeper sweeps that spread flat across every bin. No cancellation filter is needed
// while B is within −20 dB of A's self-interference (the paper's abstract).
import { lerp, seg, ease, fract } from './kit.js';

const D = 14;
const NB = 32; // FFT bins drawn
const SYM = 4; // B symbols in the window
const B_VALS = [22, 7, 27, 13];
const A_OFF = 0.37; // A's symbol boundaries relative to B's (the two are not synchronized)
const A_VALS = [9, 3, 19, 11, 26]; // A's symbols covering the window (k = -1..3)
const P = { tx: [0.6, 4.6], morph: [4.8, 7.0], fft: 7.0, win: 1.4 };
const CAP = [[0.9, 3.6], [4.8, 7.0], [7.15, 9.7], [9.8, 13.3]];
const LVL = { a: 0.5, b: 0.15, spike: 0.95, low: 0.04 };

export default {
  duration: D,
  still: 11.0,

  init(api) {
    const r = api.rng('orthogonal-chirps');
    const ripA = Array.from({ length: SYM }, () => Array.from({ length: NB }, () => r() - 0.5));
    const ripB = Array.from({ length: NB }, () => r() - 0.5);
    const ripLow = Array.from({ length: NB }, () => r());
    return { ripA, ripB, ripLow };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const cyan = api.accent;

    // ---------- Geometry ----------
    const surfY = h * 0.125;
    const ny = h * (compact ? 0.23 : 0.22);
    const A = { x: w * 0.13, y: ny };
    const B = { x: w * 0.87, y: ny };
    const S = { x: w * 0.08, y: h * (compact ? 0.43 : 0.42), w: w * 0.55, h: h * (compact ? 0.42 : 0.44) };
    const Sb = S.y + S.h;
    const F = { x: w * 0.7, w: w * 0.2 };
    const tx = (tau) => S.x + (tau / SYM) * S.w;
    const fy = (f) => Sb - f * S.h;
    const binY = (i) => Sb - ((i + 0.5) / NB) * S.h;

    const head = SYM * seg(t, P.tx[0], P.tx[1]);
    const lam = ease.inOut(seg(t, P.morph[0], P.morph[1]));
    const win = t < P.morph[0] ? -1 : t < P.fft ? 0 : Math.min(SYM - 1, Math.floor((t - P.fft) / P.win));

    // ---------- Water and the two nodes ----------
    const wave = [];
    for (let x = w * 0.05; x <= w * 0.95; x += Math.max(2, s(4))) wave.push([x, surfY + Math.sin(x * 0.045 / Math.max(0.6, w / 640) + t * 1.4) * s(1.6)]);
    api.line(wave, { color: pal.line, width: 1 });
    // Acoustic wavefronts: A loud (thick, neutral), B quiet (thin, cyan).
    const span = B.x - A.x;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, surfY + s(4), w, ny + s(compact ? 16 : 20) - surfY - s(4));
    ctx.clip();
    for (let k = 0; k < 4; k++) {
      const p = fract(t / 2.4 + k / 4);
      const rA = s(14) + p * span * 0.92;
      const rB = s(14) + fract(t / 2.4 + k / 4 + 0.125) * span * 0.92;
      const fadeA = Math.pow(1 - p, 1.2);
      arc(ctx, A.x, A.y, rA, -0.42, 0.42, pal.ink2, s(3.2), 0.5 * fadeA);
      arc(ctx, B.x, B.y, rB, Math.PI - 0.42, Math.PI + 0.42, cyan, s(1.4), 0.95 * Math.pow(1 - fract(t / 2.4 + k / 4 + 0.125), 1.2));
    }
    ctx.restore();
    drawNode(api, A.x, A.y, pal.ink, pal.ink2);
    drawNode(api, B.x, B.y, cyan, pal.ink2);
    const nl = s(compact ? 15 : 17);
    api.text('A', A.x - nl, A.y + api.fs(14) * 0.35, { size: api.fs(14), weight: 650, color: pal.ink, align: 'right' });
    api.text('B', B.x + nl, B.y + api.fs(14) * 0.35, { size: api.fs(14), weight: 650, color: api.accentInk, align: 'left' });
    if (!compact) {
      lab('up-chirps, loud', A.x, A.y + s(31), { align: 'center', color: pal.ink2 });
      lab('down-chirps, quiet', B.x, B.y + s(31), { align: 'center', color: api.accentInk });
    }

    // ---------- Spectrogram at A's receiver ----------
    if (!compact) lab(lam > 0.5 ? 'AT A · AFTER DECHIRP' : "AT A'S RECEIVER", S.x, S.y - s(24));
    api.line([[S.x, S.y], [S.x, Sb], [S.x + S.w, Sb]], { color: pal.line, width: 1, cap: 'square' });
    lab('time', S.x + S.w, Sb + s(15), { align: 'right' });
    lab('freq', S.x - s(6), S.y + s(4), { align: 'right' });
    // B's symbol windows (the dechirp works on B's timing).
    const gridA = ease.out(seg(t, P.morph[0], P.morph[0] + 0.5));
    for (let j = 1; j < SYM; j++) api.line([[tx(j), S.y], [tx(j), Sb]], { color: pal.line, width: 1, dash: [s(2), s(3)], alpha: 0.4 + 0.6 * gridA });
    if (win >= 0) {
      const wa = ease.out(seg(t, win === 0 ? P.morph[0] : P.fft + win * P.win, (win === 0 ? P.morph[0] : P.fft + win * P.win) + 0.3));
      api.rect(tx(win), S.y, tx(win + 1) - tx(win), S.h, { fill: cyan, alpha: 0.08 * wa });
      api.rect(tx(win), S.y, tx(win + 1) - tx(win), S.h, { stroke: cyan, width: 1, alpha: 0.6 * wa });
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(S.x, S.y - s(2), Math.max(0, tx(head) - S.x), S.h + s(4));
    ctx.clip();
    // A: up-chirps; after dechirping their slope doubles (they also reset at B's boundaries).
    const pieces = [];
    for (let k = -1; k < SYM; k++) {
      const a0 = A_OFF + k;
      const val = A_VALS[k + 1] / NB;
      const lo = Math.max(0, a0);
      const hi = Math.min(SYM, a0 + 1);
      if (hi - lo < 1e-6) continue;
      const edges = [lo];
      for (let j = Math.floor(lo) + 1; j < hi; j++) edges.push(j);
      edges.push(hi);
      for (let e = 0; e < edges.length - 1; e++) {
        const jB = Math.floor(edges[e] + 1e-9); // B's symbol this piece falls in
        sweep(pieces, edges[e], edges[e + 1], (tau) => val + (tau - a0) + lam * (tau - jB));
      }
    }
    for (const pc of pieces) api.line(pc.map(([tau, f]) => [tx(tau), fy(f)]), { color: pal.ink2, width: s(5.5), alpha: 0.22 });
    for (const pc of pieces) api.line(pc.map(([tau, f]) => [tx(tau), fy(f)]), { color: pal.ink2, width: s(1.9) });
    // B: down-chirps; dechirping flattens each into a tone at its value.
    for (let j = 0; j < SYM; j++) {
      const val = (B_VALS[j] + 0.5) / NB;
      const pcs = [];
      sweep(pcs, j, j + 1, (tau) => val - (tau - j) + lam * (tau - j));
      for (const pc of pcs) api.line(pc.map(([tau, f]) => [tx(tau), fy(f)]), { color: cyan, width: s(1.6) });
    }
    ctx.restore();
    if (head > 0 && head < SYM) api.line([[tx(head), S.y - s(3)], [tx(head), Sb]], { color: pal.ink3, width: 1 });
    // Decoded values above each finished window.
    for (let j = 0; j < SYM; j++) {
      const tj = P.fft + j * P.win + 0.35;
      const a = ease.out(seg(t, tj, tj + 0.3));
      if (a > 0) api.text(String(B_VALS[j]), (tx(j) + tx(j + 1)) / 2, S.y - s(7), { size: api.fs(13), weight: 650, color: api.accentInk, align: 'center', alpha: a });
    }

    // ---------- FFT of the current window (frequency axis shared with the spectrogram) ----------
    if (!compact) lab('FFT PER SYMBOL', F.x, S.y - s(24));
    api.line([[F.x, S.y], [F.x, Sb], [F.x + F.w, Sb]], { color: pal.line, width: 1, cap: 'square' });
    if (compact) lab('power', F.x + s(4), Sb + s(15) + 3);
    else lab('power', F.x + F.w, Sb + s(15), { align: 'right' });
    const px = (p) => F.x + p * F.w;
    const symA = Math.max(0, win);
    const ptsA = [];
    const ptsB = [];
    const spikeW = (j) => {
      if (win < 0) return 0;
      const start = j === 0 ? P.morph[0] : P.fft + j * P.win;
      const up = j === 0 ? lam : ease.out(seg(t, start, start + 0.3));
      const down = j === win ? 0 : ease.in(seg(t, P.fft + (j + 1) * P.win, P.fft + (j + 1) * P.win + 0.25));
      return j <= win ? up * (1 - down) : 0;
    };
    const weights = B_VALS.map((_, j) => spikeW(j));
    const floorA = (i) => LVL.a + 0.07 * st.ripA[symA][Math.max(0, Math.min(NB - 1, i))];
    for (let i = 0; i < NB; i++) {
      const y = binY(i);
      ptsA.push([px(floorA(i)), y]);
      ptsB.push([px(lerp(LVL.b + 0.05 * st.ripB[i], LVL.low + 0.03 * st.ripLow[i], lam)), y]);
    }
    api.line([[F.x, binY(0)], ...ptsA, [F.x, binY(NB - 1)]], { color: 'none', fill: pal.dark ? 'rgba(233,235,239,0.06)' : 'rgba(20,22,28,0.05)', close: true });
    api.line(ptsA, { color: pal.ink2, width: s(1.9) });
    // Before dechirping, B is a flat trace 20 dB under A; after, its energy sits in one bin.
    if (lam < 1) api.line(ptsB, { color: cyan, width: s(1.6), alpha: 1 - lam });
    let tip = null;
    for (let j = 0; j < SYM; j++) {
      if (weights[j] < 0.01) continue;
      const b = B_VALS[j];
      const tx0 = px(lerp(floorA(b), LVL.spike, weights[j]));
      api.line([[px(floorA(b - 1)), binY(b - 1)], [tx0, binY(b)], [px(floorA(b + 1)), binY(b + 1)]], { color: cyan, width: s(1.8), alpha: Math.min(1, weights[j] * 3) });
      if (j === win) tip = [tx0, binY(b), weights[j]];
    }
    // Level labels at the top of each trace.
    const topY = S.y - s(7);
    const rawA = 1 - lam;
    lab('A', px(LVL.a), topY, { align: 'center', color: pal.ink2, weight: 650 });
    lab('B', px(LVL.b), topY, { align: 'center', color: api.accentInk, weight: 650, alpha: rawA });
    // The −20 dB gap between them before dechirping.
    if (rawA > 0.01 && head > 0.5) {
      const yb = S.y + Math.max(s(14), api.fs(10.5) * 2.2);
      const ga = rawA * ease.out(seg(t, P.tx[0] + 1, P.tx[0] + 1.5));
      api.line([[px(LVL.b), yb], [px(LVL.a), yb]], { color: pal.ink3, width: 1, alpha: ga });
      for (const xx of [px(LVL.b), px(LVL.a)]) api.line([[xx, yb - s(4)], [xx, yb + s(4)]], { color: pal.ink3, width: 1, alpha: ga });
      const dbW = api.measure('−20 dB', { size: api.fs(10.5) }) + s(6);
      const dbX = (px(LVL.b) + px(LVL.a)) / 2;
      api.rect(dbX - dbW / 2, yb - s(6) - api.fs(10.5) * 0.85, dbW, api.fs(10.5) * 1.1, { fill: pal.bg, r: s(2), alpha: ga });
      api.text('−20 dB', dbX, yb - s(6), { size: api.fs(10.5), color: pal.ink2, align: 'center', alpha: ga });
    }
    if (tip) {
      api.circle(tip[0], tip[1], Math.max(2, s(2.6)), { fill: cyan, alpha: tip[2] });
      api.text('B', tip[0] + s(7), tip[1] + api.fs(10.5) * 0.36, { size: api.fs(10.5), weight: 650, color: api.accentInk, alpha: tip[2] });
    }

    // ---------- Captions ----------
    const capO = { color: api.accentInk, border: cyan, size: api.fs(11) };
    const railX = w / 2;
    const railY = ny;
    api.caption('same band, same time', railX, railY, CAP[0][0], CAP[0][1], { ...capO, color: pal.ink, border: pal.line });
    api.caption("dechirp with B's down-chirp", railX, railY, CAP[1][0], CAP[1][1], capO);
    api.caption("B's symbol: one sharp spike", railX, railY, CAP[2][0], CAP[2][1], capO);
    api.caption('no cancellation needed within −20 dB', railX, railY, CAP[3][0], CAP[3][1], capO);

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

// Sample f(tau) on [t0, t1] (frequency taken mod 1) into polyline pieces that break and
// meet the band edges where the sweep wraps around.
function sweep(out, t0, t1, f) {
  const n = Math.max(8, Math.ceil((t1 - t0) * 90));
  let cur = [];
  let prevT = t0;
  let prevRaw = f(t0);
  cur.push([t0, fract(prevRaw)]);
  for (let i = 1; i <= n; i++) {
    const tau = t0 + ((t1 - t0) * i) / n;
    const raw = f(tau);
    const kPrev = Math.floor(prevRaw);
    const kNow = Math.floor(raw);
    if (kNow !== kPrev) {
      const edge = kNow > kPrev ? kNow : kPrev; // integer crossed
      const tc = prevT + ((edge - prevRaw) / (raw - prevRaw)) * (tau - prevT);
      cur.push([tc, kNow > kPrev ? 1 : 0]);
      out.push(cur);
      cur = [[tc, kNow > kPrev ? 0 : 1]];
    }
    cur.push([tau, fract(raw)]);
    prevT = tau;
    prevRaw = raw;
  }
  out.push(cur);
}

function arc(ctx, x, y, r, a0, a1, color, width, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.restore();
}

// An underwater acoustic modem on a short mooring: float, body, transducer.
function drawNode(api, x, y, accent, line) {
  const { pal } = api;
  const bw = Math.max(6, api.s(11));
  const bh = Math.max(12, api.s(22));
  api.rect(x - bw / 2, y - bh / 2, bw, bh, { fill: pal.surface, stroke: line, width: Math.max(1, api.s(1.3)), r: bw * 0.45 });
  api.circle(x, y + bh * 0.18, bw * 0.24, { fill: accent });
  api.line([[x - bw * 0.25, y - bh * 0.22], [x + bw * 0.25, y - bh * 0.22]], { color: line, width: 1 });
}
