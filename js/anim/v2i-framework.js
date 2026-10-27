// A Multi-Layered Framework for Informing V2I Deployment Decisions (VNC 2024).
// Two commercial roadside units are tested side by side, one framework layer at a time:
// specification compliance (test messages, pass/fail per check), network management
// (status queries answered or not), and transmission range (a car drives away while each
// unit's packet delivery ratio is logged against distance). All values are synthetic.
import { lerp, seg, ease, clamp } from './kit.js';

const D = 14;
const L1 = [0.5, 4.1];
const L2 = [4.4, 7.7];
const L3 = [8.0, 13.4];
const CHECKS = [
  { name: 'message format', a: true, b: true },
  { name: 'timing', a: true, b: true },
  { name: 'security', a: true, b: false },
];
const CHECK_T = [1.2, 2.1, 3.0];
const QUERIES = [
  { key: 'status', a: 'online', b: 'online' },
  { key: 'firmware', a: 'v2.1', b: 'no reply' },
  { key: 'position', a: 'ok', b: 'ok' },
  { key: 'CPU load', a: '23%', b: '41%' },
];
const QUERY_T = [4.8, 5.45, 6.1, 6.75];
const DRIVE = [8.5, 12.4];
const KNEE = { a: 0.7, b: 0.47 };
const CAP = [[0.8, 3.9], [4.6, 7.5], [8.2, 10.4], [10.5, 13.4]];

const pdr = (d, knee) => 1 / (1 + Math.exp((d - knee) / 0.065));

export default {
  duration: D,
  still: 11.4,

  init(api) {
    const r = api.rng('v2i-framework');
    // Message timeline for the drive: each message is delivered to A / B or not.
    const msgs = [];
    for (let k = 0; k < 64; k++) msgs.push({ t: DRIVE[0] + (k / 64) * (DRIVE[1] - DRIVE[0]), ua: r(), ub: r() });
    const wig = Array.from({ length: 41 }, () => r() - 0.5);
    return { msgs, wig };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const A_COL = api.accent;
    const onAccent = pal.dark ? '#0A0B0F' : '#fff';

    // ---------- Layer stack (left) ----------
    const SX = w * 0.06;
    const SW = w * 0.26;
    const SY = h * 0.19;
    const SH = h * 0.2;
    const SG = h * 0.045;
    const layers = [
      { n: '1', title: compact ? 'SPEC' : 'SPEC COMPLIANCE', win: L1 },
      { n: '2', title: compact ? 'NET MGMT' : 'NETWORK MGMT', win: L2 },
      { n: '3', title: compact ? 'RANGE' : 'TRANSMISSION RANGE', win: L3 },
    ];
    const activeIdx = t < L2[0] - 0.15 ? 0 : t < L3[0] - 0.15 ? 1 : 2;
    layers.forEach((ly, i) => {
      const y = SY + i * (SH + SG);
      const on = activeIdx === i;
      const onA = ease.out(seg(t, ly.win[0] - 0.3, ly.win[0])) * (1 - ease.out(seg(t, ly.win[1] - 0.15, ly.win[1] + 0.15)));
      api.rect(SX, y, SW, SH, { fill: pal.surface, stroke: on ? mixC(pal.line, pal.ink2, onA) : pal.line, width: on ? Math.max(1, s(1.4)) : 1, r: s(6) });
      const nx = SX + s(compact ? 9 : 14);
      api.text(ly.n, nx, y + SH * 0.42, { size: api.fs(compact ? 14 : 18), weight: 650, color: on ? pal.ink : pal.ink3, base: 'middle' });
      const tx0 = nx + Math.max(15, s(20));
      lab(ly.title, tx0, y + SH * 0.36, { color: on ? pal.ink : pal.ink2 });
      // Summary once the layer has run.
      const done = ease.out(seg(t, ly.win[1] - 0.4, ly.win[1]));
      if (done > 0) {
        const sy = y + SH * 0.72;
        const sx = tx0;
        if (i < 2) {
          const [ra, rb] = i === 0 ? ['3/3', '2/3'] : ['4/4', '3/4'];
          const sz = api.fs(compact ? 10 : 11);
          api.text(`A ${ra}`, sx, sy, { size: sz, weight: 650, color: api.accentInk, alpha: done });
          api.text(`B ${rb}`, sx + api.measure(compact ? `A ${ra} ` : `A ${ra}  `, { size: sz, weight: 650 }), sy, { size: sz, weight: 600, color: pal.ink2, alpha: done });
        } else {
          api.text(compact ? 'A farther' : 'A reaches farther', sx, sy, { size: api.fs(11), weight: 650, color: api.accentInk, alpha: done });
        }
      }
    });

    // ---------- Detail panel (right) ----------
    const DX = w * 0.4;
    const DW = w * (compact ? 0.44 : 0.54); // compact: stay clear of the pause button
    const DY = h * 0.19;
    const DH = h * 0.69;
    // Connector from the active slab to the panel.
    {
      const y = SY + activeIdx * (SH + SG) + SH / 2;
      const a = 1;
      api.line([[SX + SW, y], [DX - s(10), y]], { color: pal.ink3, width: 1, alpha: a });
      api.circle(DX - s(10), y, Math.max(2, s(2.5)), { fill: pal.ink3, alpha: a });
    }
    const pane = (win) => ease.out(seg(t, win[0] - 0.3, win[0] + 0.1)) * (1 - ease.in(seg(t, win[1] - 0.2, win[1] + 0.15)));
    const slide = (win) => (1 - ease.out(seg(t, win[0] - 0.3, win[0] + 0.1))) * s(8);

    // Layer 1: specification compliance checklist.
    let a = pane(L1);
    if (a > 0 && t < L1[1] + 0.2) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, slide(L1));
      const colA = DX + DW * (compact ? 0.66 : 0.62);
      const colB = DX + DW * (compact ? 0.9 : 0.86);
      const rowY = (k) => DY + DH * (0.3 + k * 0.22);
      api.text('RSU A', colA, DY + DH * 0.08, { size: api.fs(11.5), weight: 650, color: api.accentInk, align: 'center' });
      api.text('RSU B', colB, DY + DH * 0.08, { size: api.fs(11.5), weight: 650, color: pal.ink2, align: 'center' });
      drawRSU(api, colA, DY + DH * 0.08 - s(26), s(9), A_COL);
      drawRSU(api, colB, DY + DH * 0.08 - s(26), s(9), pal.ink2);
      CHECKS.forEach((c, k) => {
        const y = rowY(k);
        api.line([[DX, y + s(16)], [DX + DW, y + s(16)]], { color: pal.grid, width: 1 });
        api.text(c.name, DX, y + api.fs(11.5) * 0.35, { size: api.fs(11.5), color: pal.ink2 });
        const t0 = CHECK_T[k];
        // Test messages fired at both units.
        for (let m = 0; m < 4; m++) {
          const p = seg(t, t0 - 0.7 + m * 0.12, t0 - 0.2 + m * 0.12);
          if (p <= 0 || p >= 1) continue;
          const x0 = DX + api.measure(c.name, { size: api.fs(11.5) }) + s(8);
          for (const cx of [colA, colB]) {
            api.rect(lerp(x0, cx - s(5), ease.inOut(p)) - s(3), y - s(2.5), s(6), s(5), { fill: pal.ink3, r: s(1), alpha: 0.85 });
          }
        }
        const ma = ease.out(seg(t, t0, t0 + 0.3));
        if (ma > 0) {
          drawMark(api, colA, y, s(7), c.a, c.a ? A_COL : pal.ink2, ma);
          drawMark(api, colB, y, s(7), c.b, pal.ink2, ma);
        }
      });
      ctx.restore();
    }

    // Layer 2: network management queries.
    a = pane(L2);
    if (a > 0 && t > L2[0] - 0.4 && t < L2[1] + 0.2) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, slide(L2));
      const mx = DX + s(compact ? 14 : 22);
      const my = DY + DH * 0.47;
      drawLaptop(api, mx, my, s(compact ? 12 : 15), pal.ink2);
      if (!compact) lab('MANAGER', mx, my + s(26), { align: 'center' });
      const cardX = DX + DW * (compact ? 0.3 : 0.36);
      const cardW = DX + DW - cardX;
      const cards = [{ y: DY + DH * 0.02, name: 'RSU A', col: A_COL, ink: api.accentInk, key: 'a' }, { y: DY + DH * 0.52, name: 'RSU B', col: pal.ink2, ink: pal.ink2, key: 'b' }];
      const cardH = DH * 0.46;
      for (const cd of cards) {
        api.rect(cardX, cd.y, cardW, cardH, { fill: pal.surface, stroke: pal.line, width: 1, r: s(5) });
        api.rect(cardX, cd.y, s(3), cardH, { fill: cd.col, r: s(1.5) });
        api.text(cd.name, cardX + s(12), cd.y + s(16), { size: api.fs(11), weight: 650, color: cd.ink });
        const lineH = (cardH - s(24)) / 4;
        QUERIES.forEach((q, k) => {
          const y = cd.y + s(24) + lineH * (k + 0.62);
          const t0 = QUERY_T[k];
          const arrive = t0 + 0.38;
          api.text(q.key, cardX + s(12), y, { size: api.fs(10.5), color: pal.ink3 });
          // Query pulse from the manager to the card.
          const p = seg(t, t0, arrive);
          if (p > 0 && p < 1) {
            const e = ease.inOut(p);
            api.circle(lerp(mx + s(14), cardX, e), lerp(my, cd.y + cardH * 0.5, e), Math.max(2, s(2.6)), { fill: pal.ink2 });
          }
          const va = ease.out(seg(t, arrive, arrive + 0.25));
          if (va > 0) {
            const miss = q[cd.key] === 'no reply';
            const val = miss && compact ? 'n/a' : q[cd.key];
            api.text(val, cardX + cardW - s(10), y, { size: api.fs(11), weight: miss ? 500 : 600, color: miss ? pal.ink3 : cd.key === 'a' ? api.accentInk : pal.ink, align: 'right', alpha: va });
          }
        });
        api.line([[mx + s(14), my], [cardX, cd.y + cardH * 0.5]], { color: pal.line, width: 1, dash: [s(2), s(3)] });
      }
      ctx.restore();
    }

    // Layer 3: transmission range, the car drives away from both units.
    a = pane(L3);
    if (a > 0 && t > L3[0] - 0.4) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, slide(L3));
      const gy = DY + DH * 0.27;
      const x0 = DX + s(compact ? 26 : 34);
      const x1 = DX + DW - s(compact ? 16 : 22);
      const dist = (x) => (x - x0) / (x1 - x0);
      api.line([[DX, gy], [DX + DW, gy]], { color: pal.ink3, width: 1 });
      for (let x = DX + s(6); x < DX + DW; x += s(18)) api.line([[x, gy + s(4)], [x + s(8), gy + s(4)]], { color: pal.line, width: 1 });
      const poleH = s(compact ? 40 : 50);
      drawPole(api, DX + s(compact ? 7 : 9), gy, poleH, A_COL, 'A', api.accentInk);
      drawPole(api, DX + s(compact ? 19 : 24), gy, poleH, pal.ink2, 'B', pal.ink2);
      const dp = clamp((t - DRIVE[0]) / (DRIVE[1] - DRIVE[0]));
      const carD = ease.inOut(dp) * 0.97;
      const carX = lerp(x0, x1, carD);
      // Messages from the car's onboard unit toward the units (lost ones fade out).
      for (const m of st.msgs) {
        const p = seg(t, m.t, m.t + 0.55);
        if (p <= 0 || p >= 1) continue;
        const d = ease.inOut(clamp((m.t - DRIVE[0]) / (DRIVE[1] - DRIVE[0]))) * 0.97;
        const sx = lerp(x0, x1, d);
        const okA = m.ua < pdr(d, KNEE.a);
        const okB = m.ub < pdr(d, KNEE.b);
        const ex = DX + s(compact ? 13 : 16);
        const e = ease.out(p);
        const xx = lerp(sx, ex, e);
        const yy = gy - s(16) - Math.sin(Math.PI * e) * s(10);
        const lostFade = (ok) => (ok ? 1 : Math.max(0, 1 - e * 2.2));
        api.circle(xx, yy - s(3), Math.max(1.5, s(2.2)), { fill: A_COL, alpha: 0.9 * lostFade(okA) });
        api.circle(xx, yy + s(3), Math.max(1.5, s(2.2)), { fill: pal.ink2, alpha: 0.9 * lostFade(okB) });
      }
      drawCar(api, carX, gy, Math.max(22, s(40)), pal.ink2);
      // Packet delivery ratio against distance, on the road's own x axis.
      const py0 = gy + s(compact ? 22 : 30);
      const py1 = DY + DH - s(compact ? 14 : 18);
      api.line([[x0, py0], [x0, py1], [x1, py1]], { color: pal.line, width: 1, cap: 'square' });
      for (let q = 1; q <= 4; q++) {
        const xq = lerp(x0, x1, q * 0.97 / 4);
        api.line([[xq, py1], [xq, py1 + s(4)]], { color: pal.line, width: 1 });
        api.line([[xq, gy + s(1)], [xq, gy + s(7)]], { color: pal.ink3, width: 1 });
      }
      // Guide from the car down to where its curves are being drawn.
      if (dp > 0) api.line([[carX, gy + s(10)], [carX, py1]], { color: pal.ink3, width: 1, dash: [s(2), s(3)], alpha: 0.8 });
      lab('100%', x0 - s(5), py0 + s(4), { align: 'right' });
      lab('0', x0 - s(5), py1 + s(4), { align: 'right' });
      lab(compact ? 'PDR' : 'DELIVERY RATIO', x0 + s(8), py0 + s(4));
      lab('distance', x0 + s(2), py1 + s(15));
      const yOf = (v) => lerp(py1, py0 + s(6), v);
      const curve = (knee, k0) => {
        const pts = [];
        const n = 40;
        for (let i = 0; i <= n; i++) {
          const d = (i / n) * 0.97;
          if (d > carD + 1e-6) break;
          const v = clamp(pdr(d, knee) + st.wig[i] * 0.04 * (1 - Math.abs(pdr(d, knee) - 0.5) * 1.4) + k0);
          pts.push([lerp(x0, x1, d), yOf(v)]);
        }
        return pts;
      };
      const cvB = curve(KNEE.b, 0);
      const cvA = curve(KNEE.a, 0);
      if (cvB.length > 1) api.line(cvB, { color: pal.ink2, width: s(1.8) });
      if (cvA.length > 1) api.line(cvA, { color: A_COL, width: s(2.2) });
      if (cvA.length) api.circle(cvA[cvA.length - 1][0], cvA[cvA.length - 1][1], Math.max(2, s(3)), { fill: A_COL });
      if (cvB.length) api.circle(cvB[cvB.length - 1][0], cvB[cvB.length - 1][1], Math.max(2, s(2.6)), { fill: pal.ink2 });
      // Curve labels once they have separated.
      const la = ease.out(seg(dp, 0.62, 0.8));
      if (la > 0 && !compact) {
        api.text('A', lerp(x0, x1, KNEE.a) + s(8), yOf(0.62), { size: api.fs(11), weight: 650, color: api.accentInk, alpha: la });
        api.text('B', lerp(x0, x1, KNEE.b) - s(14), yOf(0.4), { size: api.fs(11), weight: 650, color: pal.ink2, alpha: la });
      }
      ctx.restore();
    }

    // ---------- Captions ----------
    const capO = { size: api.fs(11), color: pal.ink, border: pal.line };
    const cx = DX + DW / 2;
    const cy = h * (compact ? 0.09 : 0.105);
    api.caption('same tests, both units', cx, cy, CAP[0][0], CAP[0][1], capO);
    api.caption("query each unit's status", cx, cy, CAP[1][0], CAP[1][1], capO);
    api.caption('drive away, log deliveries', cx, cy, CAP[2][0], CAP[2][1], capO);
    api.caption('A keeps delivering farther', cx, cy, CAP[3][0], CAP[3][1], { ...capO, color: api.accentInk, border: A_COL });

    // ---------- Loop fade ----------
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    void onAccent;
  },
};

function mixC(c1, c2, k) {
  const a = c1.match(/[\d.]+/g).map(Number);
  const b = c2.match(/[\d.]+/g).map(Number);
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
}

function drawMark(api, x, y, r, ok, color, a) {
  const lw = Math.max(1.4, api.s(2));
  if (ok) api.line([[x - r, y], [x - r * 0.3, y + r * 0.7], [x + r, y - r * 0.75]], { color, width: lw, alpha: a });
  else {
    api.line([[x - r * 0.7, y - r * 0.7], [x + r * 0.7, y + r * 0.7]], { color, width: lw, alpha: a });
    api.line([[x - r * 0.7, y + r * 0.7], [x + r * 0.7, y - r * 0.7]], { color, width: lw, alpha: a });
  }
}

// Roadside unit: a small box with an antenna.
function drawRSU(api, x, y, sz, color) {
  const lw = Math.max(1, api.s(1.3));
  api.rect(x - sz * 0.8, y - sz * 0.55, sz * 1.6, sz * 1.1, { fill: api.pal.surface, stroke: color, width: lw, r: sz * 0.2 });
  api.line([[x + sz * 0.45, y - sz * 0.55], [x + sz * 0.45, y - sz * 1.35]], { color, width: lw });
  api.circle(x + sz * 0.45, y - sz * 1.35, Math.max(1.2, sz * 0.16), { fill: color });
  api.circle(x - sz * 0.35, y, Math.max(1, sz * 0.15), { fill: color });
}

function drawPole(api, x, gy, hgt, color, name, ink) {
  const lw = Math.max(1, api.s(1.4));
  api.line([[x, gy], [x, gy - hgt]], { color: api.pal.ink3, width: lw });
  const sz = Math.max(4, api.s(6));
  api.rect(x - sz * 0.7, gy - hgt - sz * 0.6, sz * 1.4, sz * 1.9, { fill: color, r: sz * 0.25 });
  api.line([[x, gy - hgt - sz * 0.6], [x, gy - hgt - sz * 1.7]], { color, width: lw });
  api.text(name, x, gy - hgt - sz * 2.3, { size: api.fs(10.5), weight: 650, color: ink, align: 'center' });
}

// Side-view car carrying the onboard unit.
function drawCar(api, x, gy, L, color) {
  const { ctx, pal } = api;
  const H = L * 0.3;
  const lw = Math.max(1, api.s(1.4));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - L * 0.5, gy - L * 0.1);
  ctx.lineTo(x - L * 0.5, gy - H);
  ctx.lineTo(x - L * 0.28, gy - H);
  ctx.lineTo(x - L * 0.16, gy - H - L * 0.2);
  ctx.lineTo(x + L * 0.18, gy - H - L * 0.2);
  ctx.lineTo(x + L * 0.32, gy - H);
  ctx.lineTo(x + L * 0.5, gy - H + L * 0.04);
  ctx.lineTo(x + L * 0.5, gy - L * 0.1);
  ctx.closePath();
  ctx.fillStyle = pal.surface;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
  for (const wx of [x - L * 0.3, x + L * 0.3]) api.circle(wx, gy - L * 0.1, L * 0.11, { fill: pal.surface, stroke: color, width: lw });
  // Onboard unit antenna.
  api.line([[x, gy - H - L * 0.2], [x, gy - H - L * 0.36]], { color, width: lw });
  api.circle(x, gy - H - L * 0.36, Math.max(1.2, L * 0.04), { fill: color });
}

function drawLaptop(api, x, y, sz, color) {
  const lw = Math.max(1, api.s(1.3));
  api.rect(x - sz * 0.8, y - sz * 0.9, sz * 1.6, sz * 1.05, { fill: api.pal.surface, stroke: color, width: lw, r: sz * 0.12 });
  api.line([[x - sz, y + sz * 0.3], [x + sz, y + sz * 0.3]], { color, width: lw });
  api.line([[x - sz * 0.8, y + sz * 0.15], [x - sz, y + sz * 0.3]], { color, width: lw });
  api.line([[x + sz * 0.8, y + sz * 0.15], [x + sz, y + sz * 0.3]], { color, width: lw });
}
