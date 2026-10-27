// Poster: Informing V2I Deployment Decisions Using Commercial Hardware-in-the-loop Testing
// (VNC 2023). Commercial roadside units are tested two ways. Indoors, an onboard unit on a
// bench is cabled to two units through an attenuator and every message is counted as the
// attenuation steps up. Outdoors, a car drives away from the same units and the messages
// they still receive thin out with distance. Both tests end in side-by-side bars per unit.
// All values are synthetic.
import { lerp, seg, ease, clamp } from './kit.js';

const D = 14;
const BENCH = [0.7, 4.7];
const DRIVE = [5.4, 9.8];
const ATT_STEPS = [0.7, 2.0, 3.3]; // attenuation level 1, 2, 3 starts
const P_BENCH = { a: [1, 0.97, 0.9], b: [1, 0.86, 0.55] }; // delivery per attenuation level
const KNEE = { a: 0.78, b: 0.52 };
const BARS = { bench: [4.6, 5.4], drive: [9.8, 10.6] };
const CAP = [[0.9, 4.6], [5.5, 9.6], [10.4, 13.4]];
const MSG_DT = 0.11;
const RES = {
  bench: { a: 0.94, b: 0.79, fmt: (v) => `${Math.round(v * 100)}%` },
  drive: { a: 0.92, b: 0.6, fmt: (v) => `${Math.round(v * 850)} m` },
};

const pdr = (d, knee) => 1 / (1 + Math.exp((d - knee) / 0.06));
// Car position along the road: steady speed with gentle start and stop.
const carPath = (p) => {
  const q = clamp(p);
  return lerp(q, ease.inOut(q), 0.3);
};

export default {
  duration: D,
  still: 11.6,

  init(api) {
    const r = api.rng('v2i-poster');
    const bench = [];
    for (let tt = BENCH[0]; tt < BENCH[1] - 0.6; tt += MSG_DT) {
      const lvl = tt >= ATT_STEPS[2] ? 2 : tt >= ATT_STEPS[1] ? 1 : 0;
      bench.push({ t: tt, okA: r() < P_BENCH.a[lvl], okB: r() < P_BENCH.b[lvl] });
    }
    const drive = [];
    for (let tt = DRIVE[0]; tt < DRIVE[1]; tt += MSG_DT * 2.0) {
      const d = carPath((tt - DRIVE[0]) / (DRIVE[1] - DRIVE[0]));
      drive.push({ t: tt, d, okA: r() < pdr(d, KNEE.a), okB: r() < pdr(d, KNEE.b) });
    }
    return { bench, drive };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const A_COL = api.accent;

    const BX = w * 0.06;
    const BW = w * 0.4;
    const RX = w * 0.54;
    const RW = w * 0.4;
    const SY = h * 0.2;
    const SH = h * 0.38;
    const benchOn = 0.45 + 0.55 * (1 - ease.out(seg(t, BENCH[1] + 0.3, BENCH[1] + 0.8)));
    const driveOn = 0.45 + 0.55 * ease.out(seg(t, DRIVE[0] - 0.6, DRIVE[0] - 0.1));
    lab(compact ? '1 INDOOR' : '1 · INDOOR BENCH', BX, h * 0.14, { color: benchOn > 0.9 ? pal.ink : pal.ink3 });
    lab(compact ? '2 OUTDOOR' : '2 · OUTDOOR DRIVE', RX, h * 0.14, { color: driveOn > 0.9 ? pal.ink : pal.ink3 });

    // ---------- Indoor bench ----------
    ctx.save();
    ctx.globalAlpha = benchOn;
    const topY = SY + SH * 0.74;
    api.line([[BX, topY], [BX + BW, topY]], { color: pal.ink3, width: Math.max(1.5, s(2.4)) });
    for (const lx of [BX + s(10), BX + BW - s(10)]) api.line([[lx, topY], [lx, topY + SH * 0.24]], { color: pal.ink3, width: Math.max(1, s(1.4)) });
    const bw = Math.max(22, s(40));
    const bh = Math.max(14, s(26));
    const obu = { x: BX + BW * 0.09, y: topY - bh / 2 };
    const att = { x: BX + BW * 0.4, y: topY - bh * 0.6 };
    const ra = { x: BX + BW * 0.68, y: topY - bh / 2 };
    const rb = { x: BX + BW * 0.91, y: topY - bh / 2 };
    // Cables (drawn first, under the boxes).
    const cab = (p, q, sag) => (u) => {
      const x = lerp(p.x, q.x, u);
      const y = lerp(p.y, q.y, u) + Math.sin(Math.PI * u) * sag;
      return [x, y];
    };
    const yC = topY - bh * 0.3;
    const c1 = cab({ x: obu.x + bw / 2, y: yC }, { x: att.x - bw / 2, y: yC }, s(7));
    const c2 = cab({ x: att.x + bw / 2, y: yC }, { x: ra.x - bw / 2, y: yC }, s(6));
    const c3 = cab({ x: att.x + bw / 2, y: yC }, { x: rb.x - bw / 2, y: yC }, s(12));
    for (const c of [c1, c2, c3]) {
      const pts = [];
      for (let i = 0; i <= 20; i++) pts.push(c(i / 20));
      api.line(pts, { color: pal.ink2, width: Math.max(1.2, s(1.8)) });
    }
    // Messages through the cables; the attenuator drops some on the way to each unit.
    let sent = 0;
    let gotA = 0;
    let gotB = 0;
    const rB = Math.max(1.6, s(2.4));
    for (const m of st.bench) {
      if (t < m.t) break;
      sent++;
      const p1 = seg(t, m.t, m.t + 0.32);
      if (p1 < 1) {
        const [x, y] = c1(p1);
        api.circle(x, y, rB, { fill: pal.ink2 });
        continue;
      }
      const p2 = seg(t, m.t + 0.36, m.t + 0.7);
      if (p2 >= 1) {
        if (m.okA) gotA++;
        if (m.okB) gotB++;
        continue;
      }
      if (p2 <= 0) continue;
      const [xa, ya] = c2(p2);
      const [xb, yb] = c3(p2);
      api.circle(xa, ya, rB, { fill: A_COL, alpha: m.okA ? 1 : Math.max(0, 1 - p2 * 3) });
      api.circle(xb, yb, rB, { fill: pal.ink2, alpha: m.okB ? 1 : Math.max(0, 1 - p2 * 3) });
    }
    // Boxes.
    const box = (b, ww, hh, stroke, name, nameCol) => {
      api.rect(b.x - ww / 2, b.y - hh / 2, ww, hh, { fill: pal.surface, stroke, width: Math.max(1, s(1.4)), r: s(3) });
      if (name) lab(name, b.x, b.y - hh / 2 - s(6), { align: 'center', color: nameCol || pal.ink3 });
    };
    box(obu, bw * 0.9, bh, pal.ink2, 'OBU');
    box(att, bw, bh * 1.2, pal.ink2, compact ? 'ATT' : 'ATTENUATOR');
    box(ra, bw, bh, A_COL, compact ? 'A' : 'RSU A', api.accentInk);
    box(rb, bw, bh, pal.ink2, compact ? 'B' : 'RSU B', pal.ink2);
    // Attenuation level: three bars on the attenuator face.
    const lvl = t >= ATT_STEPS[2] ? 3 : t >= ATT_STEPS[1] ? 2 : t >= ATT_STEPS[0] ? 1 : 0;
    for (let k = 0; k < 3; k++) {
      const bx = att.x - bw * 0.28 + k * bw * 0.22;
      const hh2 = bh * (0.22 + k * 0.17);
      api.rect(bx, att.y + bh * 0.38 - hh2, bw * 0.14, hh2, { fill: k < lvl ? pal.ink : 'transparent', stroke: pal.ink2, width: 1, r: 1 });
    }
    // Counters.
    const cnt = (n) => `${n * 10}`;
    const cy = SY + SH * 0.18;
    api.text(cnt(sent), obu.x, cy, { size: api.fs(14), weight: 650, color: pal.ink, align: 'center' });
    lab('sent', obu.x, cy + s(14), { align: 'center' });
    api.text(cnt(gotA), ra.x, cy, { size: api.fs(14), weight: 650, color: api.accentInk, align: 'center' });
    api.text(cnt(gotB), rb.x, cy, { size: api.fs(14), weight: 650, color: pal.ink, align: 'center' });
    lab('received', (ra.x + rb.x) / 2, cy + s(14), { align: 'center' });
    ctx.restore();

    // ---------- Outdoor drive (seen from above) ----------
    ctx.save();
    ctx.globalAlpha = driveOn;
    const roadY = SY + SH * 0.56;
    const roadH = Math.max(16, s(32));
    api.rect(RX, roadY - roadH / 2, RW, roadH, { fill: pal.dark ? 'rgba(233,235,239,0.06)' : 'rgba(20,22,28,0.05)' });
    api.line([[RX, roadY - roadH / 2], [RX + RW, roadY - roadH / 2]], { color: pal.ink3, width: 1 });
    api.line([[RX, roadY + roadH / 2], [RX + RW, roadY + roadH / 2]], { color: pal.ink3, width: 1 });
    api.line([[RX + s(4), roadY], [RX + RW, roadY]], { color: pal.line, width: 1, dash: [s(6), s(5)] });
    const poleY = roadY - roadH / 2 - s(12);
    const pA = RX + s(compact ? 8 : 10);
    const pB = RX + s(compact ? 22 : 28);
    api.circle(pA, poleY, Math.max(3, s(5)), { fill: A_COL });
    api.circle(pB, poleY, Math.max(3, s(5)), { fill: pal.ink2 });
    api.text('A', pA, poleY - s(10), { size: api.fs(10.5), weight: 650, color: api.accentInk, align: 'center' });
    api.text('B', pB, poleY - s(10), { size: api.fs(10.5), weight: 650, color: pal.ink2, align: 'center' });
    const x0 = RX + s(compact ? 34 : 44);
    const x1 = RX + RW - s(compact ? 14 : 18);
    for (let q = 0; q <= 4; q++) {
      const xq = lerp(x0, x1, q / 4);
      api.line([[xq, roadY + roadH / 2 + s(3)], [xq, roadY + roadH / 2 + s(7)]], { color: pal.ink3, width: 1 });
    }
    lab('distance', x1, roadY + roadH / 2 + s(20), { align: 'right' });
    // Reception marks left where each message was sent from (A above the centre line, B below).
    const rr = Math.max(1.8, s(2.7));
    for (const m of st.drive) {
      if (t < m.t) break;
      const x = lerp(x0, x1, m.d);
      const a = ease.out(seg(t, m.t + 0.2, m.t + 0.45));
      if (m.okA) api.circle(x, roadY - roadH * 0.24, rr, { stroke: A_COL, width: Math.max(1, s(1.4)), alpha: a });
      if (m.okB) api.circle(x, roadY + roadH * 0.24, rr, { stroke: pal.ink2, width: Math.max(1, s(1.4)), alpha: a });
    }
    // Messages heading back to the units (lost ones fade before arriving).
    for (const m of st.drive) {
      const p = seg(t, m.t, m.t + 0.45);
      if (p <= 0 || p >= 1) continue;
      const x = lerp(x0, x1, m.d);
      const e = ease.out(p);
      const yy = lerp(roadY, poleY, e) - Math.sin(Math.PI * e) * s(12);
      api.circle(lerp(x, pA, e), yy, Math.max(1.3, s(1.9)), { fill: A_COL, alpha: m.okA ? 0.9 : Math.max(0, 0.9 - e * 2.4) });
      api.circle(lerp(x, pB, e), yy + s(3), Math.max(1.3, s(1.9)), { fill: pal.ink2, alpha: m.okB ? 0.9 : Math.max(0, 0.9 - e * 2.4) });
    }
    const dp = carPath((t - DRIVE[0]) / (DRIVE[1] - DRIVE[0]));
    drawCarTop(api, lerp(x0, x1, dp), roadY, Math.max(18, s(34)), pal.ink2);
    ctx.restore();

    // ---------- Side-by-side bars ----------
    const baseY = h * (compact ? 0.9 : 0.875);
    const barMax = h * 0.13;
    const barW = Math.max(14, s(30));
    const gap = Math.max(8, s(14));
    const groups = [
      { cx: BX + BW / 2, key: 'bench', title: compact ? 'RECEIVED' : 'MESSAGES RECEIVED', win: BARS.bench },
      { cx: RX + RW / 2, key: 'drive', title: compact ? 'RANGE' : 'DRIVE RANGE', win: BARS.drive },
    ];
    for (const g of groups) {
      const grow = ease.out(seg(t, g.win[0], g.win[1]));
      const res = RES[g.key];
      api.line([[g.cx - barW - gap, baseY], [g.cx + barW + gap, baseY]], { color: pal.line, width: 1 });
      lab(g.title, g.cx, baseY - barMax - s(26), { align: 'center', alpha: 0.5 + 0.5 * grow });
      [['a', A_COL, api.accentInk, g.cx - gap / 2 - barW], ['b', pal.ink2, pal.ink, g.cx + gap / 2]].forEach(([k, col, ink, bx]) => {
        const v = res[k] * grow;
        if (v > 0.002) api.rect(bx, baseY - barMax * v, barW, barMax * v, { fill: col, r: Math.min(s(3), barW * 0.2) });
        api.text(k.toUpperCase(), bx + barW / 2, baseY + api.fs(11) + s(2), { size: api.fs(11), weight: 650, color: k === 'a' ? api.accentInk : pal.ink2, align: 'center' });
        if (grow > 0.05) api.text(res.fmt(res[k]), bx + barW / 2, baseY - barMax * v - s(5), { size: api.fs(10.5), weight: 600, color: ink, align: 'center', alpha: grow });
      });
    }

    // ---------- Captions ----------
    const capY = h * 0.6;
    api.caption('bench: cable, attenuate, count', compact ? w / 2 : BX + BW / 2, capY, CAP[0][0], CAP[0][1], { size: api.fs(11), color: pal.ink, border: pal.line });
    api.caption('drive: receptions thin out', compact ? w / 2 : RX + RW / 2, capY, CAP[1][0], CAP[1][1], { size: api.fs(11), color: pal.ink, border: pal.line });
    api.caption('same units, compared side by side', w / 2, capY, CAP[2][0], CAP[2][1], { size: api.fs(11), color: api.accentInk, border: A_COL });

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

// Car seen from above, heading right.
function drawCarTop(api, x, y, L, color) {
  const { ctx, pal } = api;
  const W = L * 0.5;
  const lw = Math.max(1, api.s(1.4));
  api.rect(x - L / 2, y - W / 2, L, W, { fill: pal.surface, stroke: color, width: lw, r: W * 0.35 });
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + L * 0.12, y - W * 0.36);
  ctx.lineTo(x + L * 0.26, y - W * 0.3);
  ctx.lineTo(x + L * 0.26, y + W * 0.3);
  ctx.lineTo(x + L * 0.12, y + W * 0.36);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
  api.rect(x - L * 0.3, y - W * 0.32, L * 0.1, W * 0.64, { stroke: color, width: 1, r: 1 });
  api.circle(x - L * 0.02, y, Math.max(1.5, L * 0.06), { fill: color });
}
