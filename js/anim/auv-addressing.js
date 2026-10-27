// Poster: Role-Based Network Addressing for Fleets of AUVs (WUWNet 2024).
// Eight AUVs swim in two groups. Every vehicle's network address names its role, its
// group and its id (role.group.id). A packet addressed to a role, lead.*.*, hops through
// the fleet and is taken by whichever vehicles hold that role. Mid-mission the fleet
// regroups into three groups and the addresses update in place, so the same role
// address now also reaches the new group's lead.
import { TAU, lerp, seg, ease, fract } from './kit.js';

const D = 16;
const V = 8;
const ROLE = 'lead';
const ADDR0 = ['lead.1.1', 'survey.1.2', 'survey.1.3', 'survey.1.4', 'lead.2.1', 'sample.2.2', 'sample.2.3', 'sample.2.4'];
const ADDR1 = ['lead.1.1', 'survey.1.2', 'survey.1.3', 'lead.3.1', 'lead.2.1', 'sample.2.2', 'sample.2.3', 'sample.3.2'];
const GROUP0 = [1, 1, 1, 1, 2, 2, 2, 2];
const GROUP1 = [1, 1, 1, 3, 2, 2, 2, 3];
const POS0 = [[0.8, 0.38], [0.585, 0.38], [0.37, 0.38], [0.155, 0.38], [0.8, 0.7], [0.585, 0.7], [0.37, 0.7], [0.155, 0.7]];
const POS1 = [[0.75, 0.31], [0.535, 0.31], [0.32, 0.31], [0.63, 0.56], [0.69, 0.81], [0.49, 0.81], [0.29, 0.81], [0.42, 0.56]];
const STAGGER = [0, 0.08, 0.16, 0.05, 0.1, 0.18, 0.26, 0.12];
const GATE = [0.9, 0.13];
const T = { send0: 2.5, move: [5.5, 7.7], roll: 6.5, send1: 8.9, hop: 0.38 };
const CAP = [[0.8, 2.45], [2.5, 5.3], [5.6, 8.5], [9.4, 14.6]];

const isRole = (addr) => addr.startsWith(ROLE + '.');

// Breadth-first spanning tree from the gateway over acoustic neighbors (normalized units).
function tree(pos) {
  const nodes = [...pos, GATE];
  const g = nodes.length - 1;
  const dist = (a, b) => Math.hypot((nodes[a][0] - nodes[b][0]) * 1.6, nodes[a][1] - nodes[b][1]);
  const depth = nodes.map(() => -1);
  const parent = nodes.map(() => -1);
  depth[g] = 0;
  const q = [g];
  while (q.length) {
    const a = q.shift();
    const nb = nodes.map((_, b) => b).filter((b) => depth[b] < 0 && dist(a, b) < 0.42).sort((x, y) => dist(a, x) - dist(a, y));
    for (const b of nb) {
      depth[b] = depth[a] + 1;
      parent[b] = a;
      q.push(b);
    }
  }
  return { depth, parent };
}

export default {
  duration: D,
  still: 11.6,

  init(api) {
    const r = api.rng('auv-addressing');
    const drift = Array.from({ length: 26 }, () => ({ x: r(), y: r.range(0.2, 0.96), len: r.range(6, 16), a: r.range(0.35, 1) }));
    return { tree0: tree(POS0), tree1: tree(POS1), drift, ph: Array.from({ length: V }, () => r() * TAU) };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const cyan = api.accent;
    const L = Math.max(19, s(36)); // vehicle length
    const labOff = Math.max(14, s(21));
    const fsAddr = api.fs(11);

    // ---------- Background drift (the fleet is cruising to the right) ----------
    const driftSpeed = 2 / D; // two screen widths per loop: seamless
    for (const d of st.drift) {
      const x = fract(d.x - t * driftSpeed) * (w + s(40)) - s(20);
      api.line([[x, d.y * h], [x + s(d.len), d.y * h]], { color: pal.ink3, width: 1, alpha: 0.45 * d.a });
    }

    // ---------- Vehicle positions ----------
    const moveP = (i, tt) => ease.inOut(seg(tt, T.move[0] + STAGGER[i], T.move[1] + STAGGER[i]));
    const posAt = (i, tt) => {
      const p = moveP(i, tt);
      const bob = Math.sin(TAU * (tt / D) * 3 + st.ph[i]);
      return [lerp(POS0[i][0], POS1[i][0], p) * w + s(2.2) * Math.sin(TAU * (tt / D) * 2 + st.ph[i] * 1.7), lerp(POS0[i][1], POS1[i][1], p) * h + s(1.6) * bob];
    };
    const pos = [];
    for (let i = 0; i < V; i++) pos.push(posAt(i, t));
    const gate = [GATE[0] * w, GATE[1] * h];
    const node = (k) => (k === V ? gate : pos[k]);

    // ---------- Group outlines (lerped between the two formations) ----------
    const padX = Math.max(L / 2 + s(12), api.measure('survey.1.2', { size: fsAddr, weight: 650 }) / 2 + s(8));
    const hullOf = (members, P) => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y = 0;
      for (const i of members) {
        x0 = Math.min(x0, P[i][0] * w);
        x1 = Math.max(x1, P[i][0] * w);
        y = P[i][1] * h;
      }
      return { x: x0 - padX, y: y - s(15), w: x1 - x0 + padX * 2, h: labOff + s(22), cy: y };
    };
    const members = (G, g) => G.map((v, i) => (v === g ? i : -1)).filter((i) => i >= 0);
    const mp = ease.inOut(seg(t, T.move[0], T.move[1] + 0.2));
    const hulls = [1, 2, 3].map((g) => {
      const h1 = hullOf(members(GROUP1, g), POS1);
      if (g === 3) return { ...h1, a: mp, g };
      const h0 = hullOf(members(GROUP0, g), POS0);
      return { x: lerp(h0.x, h1.x, mp), y: lerp(h0.y, h1.y, mp), w: lerp(h0.w, h1.w, mp), h: lerp(h0.h, h1.h, mp), cy: lerp(h0.cy, h1.cy, mp), a: 1, g };
    });
    for (const hl of hulls) {
      if (hl.a <= 0.01) continue;
      api.rect(hl.x, hl.y, hl.w, hl.h, { stroke: pal.ink3, width: 1, dash: [s(4), s(4)], r: s(10), alpha: 0.6 * hl.a });
      lab(`GROUP ${hl.g}`, hl.x + s(4), hl.y - s(6), { alpha: hl.a });
    }

    // ---------- Packets to the role address ----------
    const sends = [{ t0: T.send0, tr: st.tree0, addr: ADDR0, until: T.move[0] + 0.2 }, { t0: T.send1, tr: st.tree1, addr: ADDR1, until: D }];
    const reach = new Array(V).fill(0);
    const pulse = new Array(V).fill(-1);
    for (const sd of sends) {
      if (t < sd.t0) continue;
      const fadeOut = 1 - seg(t, sd.until - 0.5, sd.until);
      for (let k = 0; k < V; k++) {
        const d = sd.tr.depth[k];
        if (d < 1) continue;
        const a0 = sd.t0 + (d - 1) * T.hop;
        const a1 = a0 + T.hop;
        const par = sd.tr.parent[k];
        // Edge flashes as the packet crosses it, then fades.
        const ea = seg(t, a0, a0 + 0.1) * (1 - seg(t, a1 + 0.2, a1 + 0.9));
        if (ea > 0) api.line([node(par), node(k)], { color: pal.ink3, width: 1, alpha: 0.7 * ea });
        const p = seg(t, a0, a1);
        if (p > 0 && p < 1) {
          const e = ease.inOut(p);
          const A = node(par);
          const B = node(k);
          api.circle(lerp(A[0], B[0], e), lerp(A[1], B[1], e), Math.max(2, s(3)), { fill: cyan });
        }
        if (t >= a1) {
          if (isRole(sd.addr[k])) {
            reach[k] = Math.max(reach[k], ease.out(seg(t, a1, a1 + 0.3)) * fadeOut);
            pulse[k] = Math.max(pulse[k], t - a1);
          } else if (t - a1 < 0.4) {
            api.circle(pos[k][0], pos[k][1], L * (0.45 + 0.4 * (t - a1) / 0.4), { stroke: pal.ink3, width: 1, alpha: 0.6 * (1 - (t - a1) / 0.4) });
          }
        }
      }
    }

    // ---------- Gateway buoy ----------
    api.circle(gate[0], gate[1], Math.max(4, s(7)), { fill: pal.surface, stroke: pal.ink2, width: Math.max(1, s(1.3)) });
    api.circle(gate[0], gate[1], Math.max(1.5, s(2.4)), { fill: pal.ink2 });
    api.circle(gate[0], gate[1], Math.max(7, s(12)), { stroke: pal.line, width: 1 });
    if (!compact) lab('GATEWAY', gate[0], gate[1] + s(26), { align: 'center' });
    for (const sd of sends) {
      const a = seg(t, sd.t0 - 0.3, sd.t0) * (1 - seg(t, sd.t0 + 2.2, sd.t0 + 2.6));
      if (a > 0 && !compact) api.label('to lead.*.*', gate[0] - s(18), gate[1], { align: 'right', size: api.fs(11), color: api.accentInk, border: cyan, alpha: a });
    }

    // ---------- Vehicles and their addresses ----------
    for (let i = 0; i < V; i++) {
      const [x, y] = pos[i];
      const a2 = posAt(i, t + 0.06);
      const a1 = posAt(i, t - 0.06);
      const heading = Math.max(-0.32, Math.min(0.32, Math.atan2(a2[1] - a1[1], (a2[0] - a1[0]) + w * 0.03)));
      // Wake.
      for (let k = 0; k < 3; k++) {
        const f = fract(t * 1.3 + k / 3 + i * 0.17);
        const bx = x - Math.cos(heading) * (L * 0.55 + f * s(22));
        const by = y - Math.sin(heading) * (L * 0.55 + f * s(22));
        api.circle(bx, by, Math.max(1, s(1.7)), { fill: pal.ink3, alpha: 0.7 * (1 - f) });
      }
      const rc = reach[i];
      if (pulse[i] >= 0 && pulse[i] < 0.7) api.circle(x, y, L * (0.55 + 0.6 * ease.out(pulse[i] / 0.7)), { stroke: cyan, width: s(1.6), alpha: 0.9 * (1 - pulse[i] / 0.7) * (rc > 0 ? 1 : 0) });
      drawAUV(api, x, y, L, heading, rc);
      // Address label, rolling to its new value during the regroup.
      const roll = seg(t, T.roll + STAGGER[i], T.roll + STAGGER[i] + 0.7);
      const col = rc > 0.5 ? api.accentInk : pal.ink2;
      drawAddr(api, ADDR0[i], ADDR1[i], roll, x, y + labOff, fsAddr, col, rc > 0.5 ? 650 : 500, pal.ink);
    }

    // ---------- Captions ----------
    const capO = { color: api.accentInk, border: cyan, size: api.fs(11) };
    const railX = compact ? w * 0.46 : w * 0.47;
    const railY = h * (compact ? 0.15 : 0.17);
    api.caption('address = role.group.id', railX, railY, CAP[0][0], CAP[0][1], { ...capO, color: pal.ink, border: pal.line });
    api.caption(compact ? 'to lead.*.*: every lead' : 'sent to a role, not a vehicle', railX, railY, CAP[1][0], CAP[1][1], capO);
    api.caption('groups re-form, addresses update', railX, railY, CAP[2][0], CAP[2][1], { ...capO, color: pal.ink, border: pal.line });
    api.caption(compact ? 'reaches the new lead too' : 'reaches whoever holds the role now', railX, railY, CAP[3][0], CAP[3][1], capO);

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

// Top-down torpedo: hull, nose, cruciform tail fins; tinted when it holds the addressed role.
function drawAUV(api, x, y, L, heading, reached) {
  const { ctx, pal } = api;
  const W = L * 0.27;
  const lw = Math.max(1, api.s(1.3));
  const stroke = reached > 0.02 ? mixRGB(pal.ink2, api.accent, reached) : pal.ink2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  // Tail fins.
  ctx.beginPath();
  ctx.moveTo(-L * 0.36, 0);
  ctx.lineTo(-L * 0.5, -W * 0.95);
  ctx.moveTo(-L * 0.36, 0);
  ctx.lineTo(-L * 0.5, W * 0.95);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Hull.
  ctx.beginPath();
  ctx.moveTo(-L * 0.42, -W * 0.38);
  ctx.lineTo(L * 0.22, -W * 0.5);
  ctx.quadraticCurveTo(L * 0.5, -W * 0.45, L * 0.5, 0);
  ctx.quadraticCurveTo(L * 0.5, W * 0.45, L * 0.22, W * 0.5);
  ctx.lineTo(-L * 0.42, W * 0.38);
  ctx.closePath();
  ctx.fillStyle = pal.surface;
  ctx.fill();
  if (reached > 0.02) {
    ctx.globalAlpha = 0.35 * reached;
    ctx.fillStyle = api.accent;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  // Propeller.
  ctx.beginPath();
  ctx.moveTo(-L * 0.47, -W * 0.3);
  ctx.lineTo(-L * 0.47, W * 0.3);
  ctx.stroke();
  ctx.restore();
}

function mixRGB(c1, c2, k) {
  const a = c1.match(/[\d.]+/g).map(Number);
  const b = c2.match(/[\d.]+/g).map(Number);
  return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
}

// Address label that rolls (odometer style) from one value to another.
function drawAddr(api, from, to, p, x, y, size, color, weight, strong) {
  const { ctx } = api;
  const cw = api.measure('0', { size, weight });
  if (p <= 0 || p >= 1 || from === to) {
    api.text(p <= 0 ? from : to, x, y, { size, color, align: 'center', weight });
    return;
  }
  const rollH = size * 1.15;
  const band = (x0, w0) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y - size * 1.05, w0, size * 1.4);
    ctx.clip();
  };
  if (from.length === to.length) {
    const x0 = x - (cw * to.length) / 2;
    for (let i = 0; i < to.length; i++) {
      const cx = x0 + cw * (i + 0.5);
      if (from[i] === to[i]) {
        api.text(to[i], cx, y, { size, color, align: 'center', weight });
        continue;
      }
      const q = ease.inOut(seg(p, i * 0.04, 0.7 + i * 0.03));
      band(cx - cw / 2, cw);
      api.text(from[i], cx, y - q * rollH, { size, color, align: 'center', weight, alpha: 1 - q });
      api.text(to[i], cx, y + (1 - q) * rollH, { size, color: q < 1 ? strong : color, align: 'center', weight: 650, alpha: q });
      ctx.restore();
    }
    return;
  }
  const q = ease.inOut(p);
  const wMax = cw * Math.max(from.length, to.length) + 4;
  band(x - wMax / 2, wMax);
  api.text(from, x, y - q * rollH, { size, color, align: 'center', weight, alpha: 1 - q });
  api.text(to, x, y + (1 - q) * rollH, { size, color: q < 1 ? strong : color, align: 'center', weight, alpha: q });
  ctx.restore();
}
