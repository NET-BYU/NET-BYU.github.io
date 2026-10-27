// Location Verification of Crowd-Sourced Sensors: the LaMDA framework (IoTEF 2023).
// A low-cost sensor has no GPS. It registers from a web browser with the help of a phone
// on the same home network, and the phone's location is recorded as the sensor's. The
// server then traceroutes to the sensor's home network and stores the hop path as a
// fingerprint. When the sensor is later moved, the new traceroute takes a different path,
// so the server flags a mismatch and asks for re-registration.
import { lerp, seg, ease, clamp } from './kit.js';

const D = 14;
// Abstract network map (normalized coordinates).
const R = [
  [0.62, 0.42], [0.59, 0.2], [0.61, 0.66], [0.5, 0.44], [0.49, 0.23], [0.52, 0.68],
  [0.45, 0.86], [0.39, 0.3], [0.39, 0.56], [0.41, 0.79], [0.28, 0.26], [0.29, 0.62], [0.3, 0.84],
];
const LINKS = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 3], [2, 5], [3, 4], [3, 7], [3, 8], [4, 7], [5, 8], [5, 9], [5, 6], [6, 9], [7, 10], [7, 8], [8, 11], [8, 9], [9, 12], [11, 12], [10, 11], [9, 11]];
const SERVER = [0.84, 0.29];
const HOME = [[0.115, 0.64], [0.115, 0.27]]; // registration home, then the new home
const ACCESS = [11, 10]; // router each home hangs off
const PATH = [[0, 3, 8, 11], [0, 3, 7, 10]];
const NAMES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13'];
const T = { phone: 0.6, pin: 1.0, pair: 1.6, fly: [2.3, 3.1], trace: [3.8, 8.7], hop: 0.5, move: [6.9, 8.3], flag: 11.35 };
const CAP = [[0.8, 3.4], [4.0, 6.7], [6.9, 8.5], [11.3, 13.4]];

export default {
  duration: D,
  still: 11.8,

  draw(api) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const lime = api.accent;
    const P = (q) => [q[0] * w, q[1] * h];
    const routers = R.map(P);
    const server = P(SERVER);
    const homes = HOME.map(P);
    const houseW = Math.max(26, s(50));
    const homeRouter = (k) => [homes[k][0] + houseW * 0.26, homes[k][1] + houseW * 0.14];

    // ---------- Network map ----------
    for (const [a, b] of LINKS) api.line([routers[a], routers[b]], { color: pal.line, width: 1 });
    api.line([server, routers[0]], { color: pal.line, width: 1 });
    api.line([server, routers[1]], { color: pal.line, width: 1 });
    for (let k = 0; k < 2; k++) api.line([routers[ACCESS[k]], homeRouter(k)], { color: pal.line, width: 1 });
    const rr = Math.max(2.6, s(4.2));
    routers.forEach((p) => api.circle(p[0], p[1], rr, { fill: pal.surface, stroke: pal.ink3, width: 1 }));
    if (!compact) lab('INTERNET', routers[6][0] + s(14), routers[6][1] + s(4));

    // ---------- Homes ----------
    homes.forEach((p, k) => drawHouse(api, p[0], p[1], houseW, k === 0 ? 'HOME 1' : 'HOME 2', compact));
    homes.forEach((_, k) => {
      const [x, y] = homeRouter(k);
      api.rect(x - s(4), y - s(3), s(8), s(6), { fill: pal.surface, stroke: pal.ink3, width: 1, r: 1 });
    });

    // ---------- Server ----------
    drawServer(api, server[0], server[1], Math.max(12, s(20)), pal.ink2);
    lab('SERVER', server[0], server[1] - s(compact ? 20 : 26), { align: 'center' });

    // ---------- Traceroutes ----------
    const pathPts = (k) => [server, ...PATH[k].map((i) => routers[i]), homeRouter(k)];
    const trace = (k, t0) => {
      const pts = pathPts(k);
      const nHops = pts.length - 1;
      let reached = 0;
      for (let hop = 1; hop <= nHops; hop++) {
        const start = t0 + (hop - 1) * T.hop;
        const travel = 0.22 + 0.06 * hop;
        const p = seg(t, start, start + travel);
        if (p > 0 && p < 1) {
          const [x, y] = alongPath(pts.slice(0, hop + 1), ease.inOut(p));
          api.circle(x, y, Math.max(2, s(3)), { fill: lime });
        }
        if (t >= start + travel) reached = hop;
      }
      return { pts, reached, nHops };
    };
    const hopTime = (t0, hop) => t0 + (hop - 1) * T.hop + 0.22 + 0.06 * hop;
    const t1 = T.trace[0];
    const t2 = T.trace[1];
    const tr1 = trace(0, t1);
    const moved = seg(t, T.move[0], T.move[0] + 0.4);
    // Stored path 1: solid while current, then a dashed ghost after the move.
    if (tr1.reached > 0) {
      const sub = tr1.pts.slice(0, tr1.reached + 1);
      if (moved < 1) api.line(sub, { color: lime, width: s(2.2), alpha: 1 - moved });
      if (moved > 0) api.line(sub, { color: pal.ink3, width: s(1.4), dash: [s(4), s(4)], alpha: moved });
    }
    const tr2 = t >= t2 ? trace(1, t2) : { reached: 0 };
    if (tr2.reached > 0) api.line(pathPts(1).slice(0, tr2.reached + 1), { color: lime, width: s(2.2) });
    // Hop numbers and pulses.
    const hopMarks = (k, t0, n) => {
      const pts = pathPts(k);
      for (let hop = 1; hop <= n; hop++) {
        const ta = hopTime(t0, hop);
        const [x, y] = pts[hop];
        const pp = seg(t, ta, ta + 0.5);
        if (pp > 0 && pp < 1) api.circle(x, y, rr * (1.2 + 2 * ease.out(pp)), { stroke: lime, width: s(1.4), alpha: 1 - pp });
        if (t >= ta) api.circle(x, y, rr, { fill: lime });
        if (!compact && hop < pts.length - 1 && t >= ta) {
          const id = NAMES[PATH[k][hop - 1]];
          // Put the label in the diagonal quadrant farthest from the path's two segments.
          const near = [pts[hop - 1], pts[hop + 1]];
          if (k === 1) {
            const j = PATH[0].indexOf(PATH[1][hop - 1]);
            const old = pathPts(0);
            if (j >= 0) near.push(old[j], old[j + 2]);
          }
          const dirs = near.map((q) => {
            const l = Math.hypot(q[0] - x, q[1] - y) || 1;
            return [(q[0] - x) / l, (q[1] - y) / l];
          });
          let best = [1, -1];
          let bestScore = Infinity;
          for (const c of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
            const score = Math.max(...dirs.map((d) => (d[0] * c[0] + d[1] * c[1]) / Math.SQRT2));
            if (score < bestScore) {
              bestScore = score;
              best = c;
            }
          }
          const fsz = api.fs(10);
          api.text(id, x + best[0] * s(7), y + best[1] * s(7) + (best[1] > 0 ? fsz * 0.75 : 0), { size: fsz, weight: 600, color: api.accentInk, align: best[0] > 0 ? 'left' : 'right', alpha: ease.out(seg(t, ta, ta + 0.25)) });
        }
      }
    };
    if (moved < 1) hopMarks(0, t1, tr1.reached);
    if (t >= t2) hopMarks(1, t2, tr2.reached);

    // ---------- Sensor and phone ----------
    const mv = ease.inOut(seg(t, T.move[0], T.move[1]));
    const sA = [homes[0][0] - houseW * 0.12, homes[0][1] + houseW * 0.16];
    const sB = [homes[1][0] - houseW * 0.12, homes[1][1] + houseW * 0.16];
    const sx = lerp(sA[0], sB[0], mv) - Math.sin(Math.PI * mv) * s(26);
    const sy = lerp(sA[1], sB[1], mv);
    if (mv > 0 && mv < 1) {
      const ghost = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        ghost.push([lerp(sA[0], sB[0], u) - Math.sin(Math.PI * u) * s(26), lerp(sA[1], sB[1], u)]);
      }
      api.line(ghost, { color: pal.ink3, width: 1, dash: [s(2), s(3)] });
    }
    drawSensor(api, sx, sy, Math.max(7, s(11)), pal.ink2, mv > 0 && mv < 1 ? 0.6 : 1);
    // Phone: appears for registration, leaves before the move.
    const phA = ease.out(seg(t, T.phone, T.phone + 0.4)) * (1 - seg(t, T.move[0] - 0.4, T.move[0]));
    if (phA > 0) {
      const px = homes[0][0] - houseW * 0.84;
      const py = homes[0][1] + houseW * 0.04;
      const pinP = ease.out(seg(t, T.pin, T.pin + 0.45));
      drawPhone(api, px, py, Math.max(9, s(13)), pal.ink2, lime, pinP, phA);
      const pairA = ease.out(seg(t, T.pair, T.pair + 0.3)) * phA;
      if (pairA > 0) {
        api.line([[px + s(8), py + s(2)], [sA[0] - s(8), sA[1]]], { color: lime, width: s(1.4), dash: [s(3), s(3)], alpha: pairA });
        if (!compact) api.text('same network', (px + sA[0]) / 2 + s(4), py + houseW * 0.62, { size: api.fs(10), color: api.accentInk, align: 'center', alpha: pairA });
      }
      // The phone's location becomes the sensor's record on the server.
      const fp = seg(t, T.fly[0], T.fly[1]);
      if (fp > 0 && fp < 1) {
        const e = ease.inOut(fp);
        const fx = lerp(px, server[0], e);
        const fy = lerp(py, server[1], e) - Math.sin(Math.PI * e) * h * 0.18;
        drawPin(api, fx, fy, Math.max(4, s(6)), lime);
      }
    }

    // ---------- Fingerprint store (under the server) ----------
    const C = { x: w * 0.67, y: h * 0.47, w: w * 0.29 };
    const rowH = Math.max(14, s(19));
    const cardA = ease.out(seg(t, T.fly[1] - 0.2, T.fly[1] + 0.2));
    if (cardA > 0) {
      ctx.save();
      ctx.globalAlpha = cardA;
      const rows = 4;
      api.rect(C.x, C.y, C.w, rowH * rows + s(14), { fill: pal.surface, stroke: pal.line, width: 1, r: s(5) });
      ctx.restore();
      const rx = C.x + s(9);
      // Row 0: registered location.
      drawPin(api, rx + s(4), C.y + rowH * 0.95, Math.max(3.5, s(5)), lime, cardA);
      api.text(compact ? 'loc saved' : 'location saved', rx + s(14), C.y + rowH * 0.95, { size: api.fs(10.5), color: pal.ink, base: 'middle', alpha: cardA });
      // Rows 1 and 2: stored path, then the new path compared hop by hop.
      const chipRow = (row, k, t0, n, compare) => {
        const y = C.y + rowH * (row + 0.95);
        const label = row === 1 ? 'path' : 'now';
        const lw = compact ? 0 : api.measure('path ', { size: api.fs(10) });
        if (!compact) api.text(label, rx, y, { size: api.fs(10), color: pal.ink3, base: 'middle' });
        const ids = [...PATH[k].map((i) => NAMES[i]), 'H' + (k + 1)];
        const avail = C.w - s(18) - lw;
        const cw = avail / 5;
        for (let i = 0; i < Math.min(n, 5); i++) {
          const ta = hopTime(t0, i + 1);
          const a = ease.out(seg(t, ta, ta + 0.25));
          const x = rx + lw + i * cw;
          const diff = compare && ids[i] !== [...PATH[0].map((j) => NAMES[j]), 'H1'][i];
          const col = diff ? pal.ink : lime;
          if (diff) api.rect(x, y - rowH * 0.36, cw - s(3), rowH * 0.72, { stroke: col, width: Math.max(1, s(1.4)), r: s(2), alpha: a });
          else {
            api.rect(x, y - rowH * 0.36, cw - s(3), rowH * 0.72, { fill: lime, r: s(2), alpha: a * 0.22 });
            api.rect(x, y - rowH * 0.36, cw - s(3), rowH * 0.72, { stroke: lime, width: 1, r: s(2), alpha: a });
          }
          if (!compact) api.text(ids[i], x + (cw - s(3)) / 2, y + 0.5, { size: api.fs(10), weight: 600, color: diff ? pal.ink : api.accentInk, align: 'center', base: 'middle', alpha: a });
          if (diff && compact) {
            const cx = x + (cw - s(3)) / 2;
            const k2 = rowH * 0.18;
            api.line([[cx - k2, y - k2], [cx + k2, y + k2]], { color: pal.ink, width: 1.2, alpha: a });
            api.line([[cx - k2, y + k2], [cx + k2, y - k2]], { color: pal.ink, width: 1.2, alpha: a });
          }
        }
      };
      if (tr1.reached > 0) chipRow(1, 0, t1, tr1.reached, false);
      if (tr2.reached > 0) chipRow(2, 1, t2, tr2.reached, true);
      // Row 3: the verdict.
      const fa = ease.out(seg(t, T.flag, T.flag + 0.35));
      if (fa > 0) {
        const y = C.y + rowH * 3.95;
        drawFlag(api, rx + s(3), y + rowH * 0.3, rowH * 0.75, pal.ink, fa);
        api.text(compact ? 'MISMATCH' : 'MISMATCH · re-register', rx + s(14), y, { size: api.fs(10.5), weight: 700, color: pal.ink, base: 'middle', alpha: fa });
      }
    }
    // Flag planted on the moved sensor.
    const fa2 = ease.out(seg(t, T.flag, T.flag + 0.35));
    if (fa2 > 0) drawFlag(api, sx + s(9), sy - s(5), Math.max(12, s(20)), pal.ink, fa2);

    // ---------- Captions ----------
    const capO = { size: api.fs(11), color: api.accentInk, border: lime };
    const cx = w * 0.5;
    const cy = h * (compact ? 0.09 : 0.1);
    api.caption('phone registers the location', compact ? cx : w * 0.33, compact ? cy : h * 0.93, CAP[0][0], CAP[0][1], capO);
    api.caption('traceroute path stored', cx, compact ? cy : h * 0.93, CAP[1][0], CAP[1][1], capO);
    api.caption('later, the sensor moves', compact ? cx : w * 0.3, compact ? cy : h * 0.93, CAP[2][0], CAP[2][1], { ...capO, color: pal.ink, border: pal.line });
    api.caption('new path differs: flagged', cx, compact ? cy : h * 0.93, CAP[3][0], CAP[3][1], capO);

    // ---------- Loop fade ----------
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    void clamp;
  },
};

// Point at fraction u along a polyline (by length).
function alongPath(pts, u) {
  let total = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = u * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
    }
    d -= lens[i];
  }
  return pts[pts.length - 1];
}

function drawHouse(api, x, y, W, name, compact) {
  const { pal } = api;
  const H = W * 0.62;
  const lw = Math.max(1, api.s(1.3));
  api.line([[x - W / 2, y - H * 0.15], [x, y - H * 0.95], [x + W / 2, y - H * 0.15]], { color: pal.ink3, width: lw });
  api.line([[x - W * 0.42, y - H * 0.28], [x - W * 0.42, y + H * 0.62], [x + W * 0.42, y + H * 0.62], [x + W * 0.42, y - H * 0.28]], { color: pal.ink3, width: lw });
  if (!compact) api.text(name, x, y - H * 0.95 - api.s(7), { size: api.fs(10.5), color: pal.ink3, align: 'center', spacing: 0.4 });
}

function drawServer(api, x, y, sz, color) {
  const lw = Math.max(1, api.s(1.3));
  for (let k = 0; k < 3; k++) {
    const yy = y - sz * 0.75 + k * sz * 0.52;
    api.rect(x - sz * 0.85, yy, sz * 1.7, sz * 0.42, { fill: api.pal.surface, stroke: color, width: lw, r: sz * 0.08 });
    api.circle(x + sz * 0.55, yy + sz * 0.21, Math.max(1, sz * 0.07), { fill: color });
  }
}

function drawSensor(api, x, y, sz, color, a) {
  const lw = Math.max(1, api.s(1.3));
  api.rect(x - sz * 0.8, y - sz * 0.55, sz * 1.6, sz * 1.1, { fill: api.pal.surface, stroke: color, width: lw, r: sz * 0.2, alpha: a });
  for (let k = 0; k < 3; k++) api.line([[x - sz * 0.5, y - sz * 0.22 + k * sz * 0.22], [x + sz * 0.2, y - sz * 0.22 + k * sz * 0.22]], { color, width: 1, alpha: a });
  api.line([[x + sz * 0.55, y - sz * 0.55], [x + sz * 0.55, y - sz * 1.2]], { color, width: lw, alpha: a });
  api.circle(x + sz * 0.55, y - sz * 1.2, Math.max(1, sz * 0.13), { fill: color, alpha: a });
}

function drawPhone(api, x, y, sz, color, accent, pinP, a) {
  const lw = Math.max(1, api.s(1.3));
  api.rect(x - sz * 0.55, y - sz, sz * 1.1, sz * 2, { fill: api.pal.surface, stroke: color, width: lw, r: sz * 0.22, alpha: a });
  api.line([[x - sz * 0.38, y - sz * 0.62], [x + sz * 0.38, y - sz * 0.62]], { color, width: 1, alpha: a });
  api.circle(x - sz * 0.3, y - sz * 0.78, Math.max(0.8, sz * 0.06), { fill: color, alpha: a });
  if (pinP > 0) drawPin(api, x, y - sz * 0.05 - (1 - pinP) * sz * 0.5, sz * 0.32, accent, a * pinP);
}

// Location pin: circle head with a point, tip at (x, y + r*1.6).
function drawPin(api, x, y, r, color, a = 1) {
  const { ctx } = api;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.6);
  ctx.bezierCurveTo(x - r * 0.4, y + r * 0.9, x - r, y + r * 0.45, x - r, y);
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.bezierCurveTo(x + r, y + r * 0.45, x + r * 0.4, y + r * 0.9, x, y + r * 1.6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = api.pal.surface;
  ctx.fill();
  ctx.restore();
}

// Flag on a short pole; (x, y) is the pole's foot.
function drawFlag(api, x, y, hgt, color, a) {
  const { ctx } = api;
  const lw = Math.max(1, api.s(1.4));
  api.line([[x, y], [x, y - hgt]], { color, width: lw, alpha: a });
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(x, y - hgt);
  ctx.lineTo(x + hgt * 0.62, y - hgt * 0.8);
  ctx.lineTo(x, y - hgt * 0.58);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
