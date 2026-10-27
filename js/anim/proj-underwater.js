// Underwater Networking: cinematic scene.
// Beneath an ice shelf, a mothership releases six passenger robots. They ping in turn:
// when a ping's wavefront reaches a neighbour, its time of flight gives the range between
// them and the receiver's array the angle of arrival. Range by range the swarm localizes
// itself (each uncertainty halo tightens to a point) and the robots' shared drift reveals
// the current. Then the passengers return to the mothership and the loop begins again.
import { TAU, clamp, lerp, seg, ease, fract, smooth } from './kit.js';

const D = 16;
const M_PER_U = 12; // metres per world unit (labels only)
const ICE_Y = 2.2; // ice-shelf base, in world units above the camera
const ICE_Z = [30, 24, 19.5, 16, 13.4, 11.3, 9.6, 8.2, 7, 6, 5.1, 4.3, 3.6];
const FLOW = unit([1, 0.1, -0.3]);
const DRIFT = 0.05; // world units per second while deployed
const RING_V = 0.3; // wavefront speed, in projection-scale units per second
const RING_MAX = 0.46;
const SHRINK_RX = 0.42; // uncertainty factor for a robot that hears a ping
const SHRINK_TX = 0.72; // ...and for the pinger, per neighbour that heard it
const SIG_MIN = 0.03;
const SIG_MAX = 0.85;

// World layout for wide (21:9) frames; narrow frames stretch it vertically.
const MOTHER = [-3.0, 1.0, 9.6];
const STATIONS = [
  [-0.9, 0.35, 6.8],
  [0.75, 1.0, 9.0],
  [2.0, 0.05, 7.4],
  [-0.05, -0.75, 6.3],
  [3.3, 0.75, 9.9],
  [1.6, -1.05, 8.4],
];
const NARROW = (p) => [p[0] * 0.92 + 0.15, p[1] * 1.5 - 0.15, p[2]];
const PING_ORDER = [3, 1, 5, 0, 4, 2, 3];
const PING_T0 = 3.9;
const PING_DT = 1.2;
const HUD_IN = [1.2, 1.8];
const HUD_OUT = [12.9, 13.5];

// Theme-independent colours.
const WATER = ['#0B4856', '#082D47', '#04152B', '#01060F'];
const ICE_HI = [214, 242, 245];
const ICE_LO = [74, 134, 156];
const ICE_FOG = [12, 54, 72];
const FOG = [9, 44, 64];
const HULL_HI = [206, 218, 224];
const HULL_MID = [118, 138, 150];
const HULL_LO = [34, 50, 62];
const CYAN = [40, 198, 246];
const CYAN_HI = [150, 230, 255];
const INK = 'rgba(206,240,252,0.88)';
const INK_DIM = 'rgba(190,228,242,0.72)';

function unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
const col = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const bez = (a, c, b, u) => {
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1], v * v * a[2] + 2 * v * u * c[2] + u * u * b[2]];
};

// Facing as cos(yaw): +1 = nose right, −1 = nose left; turns smoothly for the trip home.
function facing(R, t) {
  const turn = smooth(seg(t, R.tc, R.tc + 0.8)) * (1 - smooth(seg(t, R.td - 0.7, R.td)));
  return Math.cos(Math.PI * turn);
}

function motherPos(t, lay) {
  const m = lay ? NARROW(MOTHER) : MOTHER;
  return [m[0], m[1] + 0.05 * Math.sin((TAU * t * 2) / D), m[2]];
}

// True position of passenger R at time t (docked → released → drifting → recovered).
// lay: 0 = wide layout, 1 = narrow layout.
function robotPos(R, t, lay) {
  const m = motherPos(t, lay);
  const station = R.stations[lay];
  const dock = [m[0] + R.dock[0], m[1] + R.dock[1], m[2] + R.dock[2]];
  if (t <= R.tr || t >= R.td) return dock;
  if (t < R.ta) {
    const u = ease.inOut(seg(t, R.tr, R.ta));
    const c = [lerp(dock[0], station[0], 0.3), Math.min(dock[1], station[1]) - 0.6, lerp(dock[2], station[2], 0.5)];
    return bez(dock, c, station, u);
  }
  const deployed = (tt) => {
    const k = (tt - R.ta) * DRIFT;
    const bob = 0.035 * Math.sin((TAU * tt * 3) / D + R.ph) * seg(tt, R.ta, R.ta + 1.2);
    return [station[0] + FLOW[0] * k, station[1] + FLOW[1] * k + bob, station[2] + FLOW[2] * k];
  };
  if (t < R.tc) return deployed(t);
  const from = deployed(R.tc);
  const u = ease.inOut(seg(t, R.tc, R.td));
  const c = [lerp(from[0], dock[0], 0.5), Math.min(from[1], dock[1]) - 0.45, lerp(from[2], dock[2], 0.5) - 0.3];
  return bez(from, c, dock, u);
}

export default {
  duration: D,
  still: 9.3,
  scene: true,

  init(api) {
    const r = api.rng('underwater-scene');
    // Ice-shelf base: rows of keels receding into the murk, nearest last.
    const ice = ICE_Z.map((z, k) => {
      const span = z * 1.35 + 4;
      const step = 0.26 + z * 0.06;
      const p1 = r() * TAU;
      const p2 = r() * TAU;
      const pts = [];
      for (let x = -span; x <= span + step; x += r.range(0.4, 1.15) * step) {
        const swell = 0.1 * (1 + Math.sin(x * 0.33 + p1)) + 0.06 * (1 + Math.sin(x * 0.85 + p2));
        const near = z < 7.5;
        const fore = z < 4.5; // the nearest rows hang into the top of the frame
        let keel = r() < (near ? 0.24 : 0.13) ? r.range(0.25, near ? 0.8 : 0.6) * (0.7 + 0.3 * (k / ICE_Z.length)) : r.range(0, 0.1);
        if (fore && r() < 0.3) keel = r.range(0.95, 1.45);
        // Far away to the right the shelf thickens toward its grounding line.
        const thick = z > 14 ? Math.max(0, x - 6) * 0.11 * clamp((z - 14) / 10) : 0;
        pts.push(x, swell + keel + thick);
      }
      return { z, pts, n: pts.length / 2, tone: r.range(0.86, 1.06), sx: new Float32Array(pts.length / 2), sy: new Float32Array(pts.length / 2) };
    });
    // Thinner patches of ice where more daylight comes through.
    const glows = Array.from({ length: 9 }, () => ({ x: r.range(-6, 7), z: r.range(4.6, 11), s: r.range(0.8, 1.6), a: r.range(0.5, 1), ph: r() * TAU }));
    // Seabed rising to meet the ice: the grounding zone the passengers are sent to reach.
    const bed = [
      { z: 24, base: -4.6, slope: 0.5, x0: -3, c: [8, 36, 56] },
      { z: 16, base: -4.4, slope: 0.42, x0: 1, c: [6, 26, 43] },
    ].map((b) => {
      const pts = [];
      for (let x = -12; x <= 20; x += r.range(0.5, 1.3)) {
        const rock = r() < 0.14 ? r.range(0.15, 0.45) : r.range(-0.1, 0.1);
        pts.push(x, Math.min(ICE_Y - 0.2, b.base + b.slope * Math.max(0, x - b.x0) + rock));
      }
      return { ...b, pts, n: pts.length / 2 };
    });
    const rays = Array.from({ length: 6 }, (_, i) => ({
      x: (i + 0.3 + r.range(-0.12, 0.12)) / 6,
      wd: r.range(0.03, 0.075),
      a: r.range(0.55, 1),
      ph: r() * TAU,
      n: 1 + (i % 3),
    }));
    const snow = Array.from({ length: 160 }, () => ({
      x: r.range(-9, 9),
      y: r.range(-3.4, 2.0),
      z: r.range(2.6, 22),
      ph: r(),
      s: r.range(0.5, 1.25),
    }));
    // A few out-of-focus particles drifting right in front of the lens.
    const bokeh = Array.from({ length: 7 }, (_, i) => ({ x: r.range(-1.2, 1.2), y: r.range(-0.7, 0.6), z: r.range(1.4, 2.6), ph: i / 7 + r.range(0, 0.1), s: r.range(0.7, 1.3) }));
    const robots = STATIONS.map((s, i) => {
      const tr = 0.9 + i * 0.3;
      const tc = 12.85 + i * 0.17;
      const a = r() * TAU;
      return {
        stations: [s, NARROW(s)],
        dock: [-0.68 + i * 0.27, -0.29, -0.02],
        tr,
        ta: tr + 2.3,
        tc,
        td: tc + 2.1,
        ph: r() * TAU,
        err: [Math.cos(a), Math.sin(a) * 0.75],
      };
    });
    // Acoustic neighbours: each robot links to its two nearest (and to whoever picks it).
    const nbr = STATIONS.map(() => new Set());
    STATIONS.forEach((a, i) => {
      const order = STATIONS.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])]).filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]);
      for (const [j] of order.slice(0, 2)) {
        nbr[i].add(j);
        nbr[j].add(i);
      }
    });
    const pings = PING_ORDER.map((src, k) => ({ src, t0: PING_T0 + k * PING_DT, nb: [...nbr[src]] }));
    const links = [];
    pings.forEach((p, k) => p.nb.forEach((j) => links.push({ k, a: p.src, b: j, tr: 0 })));
    return { ice, glows, bed, rays, snow, bokeh, robots, pings, links, scr: robots.map(() => ({ x: 0, y: 0, s: 1, z: 1, p: [0, 0, 0] })) };
  },

  draw(api, st) {
    const { ctx, w, h, t } = api;
    const narrow = w / h < 1.6;
    const lay = narrow ? 1 : 0;
    const compact = api.compact;
    const th = (TAU * t) / D;
    const cam = narrow
      ? { x: 0.3 + 0.1 * Math.sin(th), y: 0.05, z: -0.65 - 0.15 * Math.cos(th), pitch: 0, yaw: -0.015 * Math.sin(th), f: 1 }
      : { x: 0.15 * Math.sin(th), y: 0.2, z: 0.2 - 0.2 * Math.cos(th), pitch: 0, yaw: -0.018 * Math.sin(th), f: 1 };
    const P = (x, y, z) => api.project(x, y, z, cam);
    const F = cam.f * Math.min(w, h * 1.6);

    // ---- Water: teal under the ice, navy in the deep ----
    const wg = ctx.createLinearGradient(0, 0, 0, h);
    wg.addColorStop(0, WATER[0]);
    wg.addColorStop(0.34, WATER[1]);
    wg.addColorStop(0.7, WATER[2]);
    wg.addColorStop(1, WATER[3]);
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, h);
    const lg = ctx.createRadialGradient(w * 0.55, h * 0.12, 0, w * 0.55, h * 0.12, Math.max(w, h) * 0.6);
    lg.addColorStop(0, 'rgba(60,150,165,0.24)');
    lg.addColorStop(0.5, 'rgba(30,100,125,0.08)');
    lg.addColorStop(1, 'rgba(30,100,125,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);

    // ---- Seabed rising toward the grounding line (far, fogged) ----
    for (const b of st.bed) {
      ctx.beginPath();
      let top = h;
      let first = true;
      for (let i = 0; i < b.n; i++) {
        const q = P(b.pts[i * 2], b.pts[i * 2 + 1], b.z);
        if (!q) continue;
        if (first) {
          ctx.moveTo(q[0], h + 20);
          first = false;
        }
        ctx.lineTo(q[0], q[1]);
        top = Math.min(top, q[1]);
      }
      ctx.lineTo(w + 40, h + 20);
      ctx.closePath();
      const bg = ctx.createLinearGradient(0, top, 0, h);
      bg.addColorStop(0, col(b.c, 0.7));
      bg.addColorStop(1, col(mixc(b.c, [0, 0, 0], 0.45), 0.9));
      ctx.fillStyle = bg;
      ctx.fill();
    }

    // ---- Ice-shelf base, far rows first ----
    for (const row of st.ice) {
      const fogK = Math.pow(clamp((row.z - 4) / 17), 0.85);
      let maxY = -1e9;
      for (let i = 0; i < row.n; i++) {
        const q = P(row.pts[i * 2], ICE_Y - row.pts[i * 2 + 1], row.z);
        row.sx[i] = q ? q[0] : 0;
        row.sy[i] = q ? q[1] : -1e4;
        if (q && q[1] > maxY) maxY = q[1];
      }
      if (maxY < -2) continue;
      const c0 = P(cam.x, ICE_Y, row.z);
      const y0 = c0 ? c0[1] : 0;
      const y1 = Math.max(maxY, y0 + 2);
      const hi = mixc(mixc(ICE_LO, ICE_HI, row.tone), ICE_FOG, fogK);
      const lo = mixc(mixc([22, 58, 80], ICE_LO, row.tone * (row.z < 7.5 ? 0.85 : 1)), ICE_FOG, Math.min(1, fogK * 1.05));
      const a = lerp(0.95, 0.5, fogK);
      const g = ctx.createLinearGradient(0, y0 - (y1 - y0) * 0.9, 0, y1);
      g.addColorStop(0, col(hi, a));
      g.addColorStop(0.6, col(mixc(hi, lo, 0.5), a));
      g.addColorStop(1, col(lo, a));
      ctx.beginPath();
      ctx.moveTo(-20, -20);
      for (let i = 0; i < row.n; i++) ctx.lineTo(row.sx[i], row.sy[i]);
      ctx.lineTo(w + 20, -20);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      // Bright refracting rim along the keels.
      ctx.beginPath();
      ctx.moveTo(row.sx[0], row.sy[0]);
      for (let i = 1; i < row.n; i++) ctx.lineTo(row.sx[i], row.sy[i]);
      ctx.strokeStyle = `rgba(232,252,255,${0.62 * (1 - fogK) * (1 - fogK)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Daylight glowing through thinner ice (fixed to the ice, so it parallaxes with it).
    for (const gl of st.glows) {
      const q = P(gl.x, ICE_Y - 0.15, gl.z);
      if (!q) continue;
      const fade = 1 - clamp((gl.z - 6) / 6) * 0.6;
      api.light(q[0], q[1], q[2] * 1.3 * gl.s, '#C9F5F6', 0.17 * gl.a * fade * (0.8 + 0.2 * Math.sin(th + gl.ph)));
    }

    // ---- God rays (soft-edged: three nested shafts each) ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ceil = P(0, ICE_Y, 12);
    const rayTop = ceil ? ceil[1] : h * 0.25;
    const rayBot = h * 0.95;
    for (const ray of st.rays) {
      const flick = 0.6 + 0.4 * Math.sin(th * ray.n + ray.ph);
      const x0 = ray.x * w - cam.x * w * 0.03;
      const x1 = x0 + 0.2 * (rayBot - rayTop);
      const g = ctx.createLinearGradient(0, rayTop, 0, rayBot);
      g.addColorStop(0, `rgba(150,222,230,${0.05 * ray.a * flick})`);
      g.addColorStop(0.5, `rgba(110,190,210,${0.018 * ray.a * flick})`);
      g.addColorStop(1, 'rgba(110,190,210,0)');
      ctx.fillStyle = g;
      for (const k of [1, 0.62, 0.3]) {
        const wt = ray.wd * w * k;
        ctx.beginPath();
        ctx.moveTo(x0 - wt / 2, rayTop);
        ctx.lineTo(x0 + wt / 2, rayTop);
        ctx.lineTo(x1 + wt * 1.3, rayBot);
        ctx.lineTo(x1 - wt * 1.3, rayBot);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // ---- Marine snow ----
    const snowPass = (near) => {
      for (const p of st.snow) {
        if ((p.z < 9) !== near) continue;
        const u = fract(t / D + p.ph);
        const k = (u - 0.5) * 2.4;
        const q = P(p.x + FLOW[0] * k, p.y + FLOW[1] * k - (u - 0.5) * 0.5, p.z + FLOW[2] * k);
        if (!q || q[0] < -4 || q[0] > w + 4 || q[1] < -4 || q[1] > h + 4) continue;
        const fogK = clamp((p.z - 4) / 18);
        const a = Math.sin(Math.PI * u) * 0.6 * p.s * (1 - fogK * 0.7) * (near ? 0.75 : 1);
        const rad = clamp(q[2] * 0.009 * p.s, 0.6, api.s(1.8));
        ctx.fillStyle = `rgba(222,240,236,${a})`;
        ctx.beginPath();
        ctx.arc(q[0], q[1], rad, 0, TAU);
        ctx.fill();
      }
    };
    snowPass(false);

    // ---- Robots: true and screen positions ----
    const scr = st.scr;
    st.robots.forEach((R, i) => {
      const p = robotPos(R, t, lay);
      const q = P(p[0], p[1], p[2]) || [0, 0, 1];
      const o = scr[i];
      o.p = p;
      o.x = q[0];
      o.y = q[1];
      o.s = q[2];
      o.z = p[2] - cam.z;
    });
    // Ping reach times from the current screen geometry (the wavefront is drawn in screen space).
    const vS = RING_V * F;
    for (const L of st.links) {
      const A = scr[L.a];
      const B = scr[L.b];
      L.tr = st.pings[L.k].t0 + Math.hypot(B.x - A.x, B.y - A.y) / vS;
    }
    const sigmaAt = (i, tt) => {
      const R = st.robots[i];
      let s = tt < R.tr ? 0.12 : lerp(0.12, SIG_MAX, ease.out(seg(tt, R.tr, R.ta + 0.3)));
      for (const L of st.links) {
        if (tt <= L.tr) continue;
        if (L.b === i) s *= lerp(1, SHRINK_RX, smooth(seg(tt, L.tr, L.tr + 0.5)));
        else if (L.a === i) s *= lerp(1, SHRINK_TX, smooth(seg(tt, L.tr, L.tr + 0.5)));
      }
      return Math.max(SIG_MIN, s);
    };
    const meanErr = (tt) => {
      let s = 0;
      for (let i = 0; i < st.robots.length; i++) s += sigmaAt(i, tt);
      return (s / st.robots.length) * M_PER_U;
    };

    // Drift tracks: where each robot has been over the last few seconds.
    for (let i = 0; i < st.robots.length; i++) {
      const R = st.robots[i];
      const a = seg(t, R.ta + 1.5, R.ta + 3) * (1 - seg(t, R.tc - 0.4, R.tc));
      if (a <= 0) continue;
      for (let k = 1; k <= 7; k++) {
        const tt = t - k * 0.42;
        if (tt < R.ta) break;
        const p = robotPos(R, tt, lay);
        const q = P(p[0], p[1], p[2]);
        if (!q) continue;
        ctx.fillStyle = col(CYAN_HI, 0.32 * a * (1 - k / 8));
        ctx.beginPath();
        ctx.arc(q[0], q[1], Math.max(0.8, api.s(1.3)), 0, TAU);
        ctx.fill();
      }
    }

    // ---- Mothership and passengers, far to near ----
    const ms = motherPos(t, lay);
    const mq = P(ms[0], ms[1], ms[2]);
    const items = st.robots.map((R, i) => ({ i, z: scr[i].z - (t <= R.tr || t >= R.td ? 0.05 : 0) }));
    items.push({ i: -1, z: ms[2] - cam.z });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      if (it.i < 0) {
        if (mq) drawMother(api, mq, clamp((it.z - 5) / 18) * 0.7, t);
        continue;
      }
      const R = st.robots[it.i];
      const o = scr[it.i];
      // Pitch follows the screen velocity (limited); yaw turns for the trip home.
      const pa = robotPos(R, t - 0.06, lay);
      const pb = robotPos(R, t + 0.06, lay);
      const qa = P(pa[0], pa[1], pa[2]);
      const qb = P(pb[0], pb[1], pb[2]);
      let pitch = 0;
      if (qa && qb) pitch = clamp(Math.atan2(qb[1] - qa[1], Math.abs(qb[0] - qa[0]) + api.s(4)), -0.4, 0.4);
      drawSub(ctx, o.x, o.y, o.s * 0.5, o.s * 0.13, facing(R, t), pitch, clamp((o.z - 5) / 18) * 0.7);
    }

    // ---- Acoustic network: wavefronts ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of st.pings) {
      const dt = t - p.t0;
      if (dt < -0.4 || dt > RING_MAX / RING_V + 0.2) continue;
      const A = scr[p.src];
      const fl = seg(dt, -0.15, 0) * (1 - seg(dt, 0.05, 0.6));
      if (fl > 0) api.light(A.x, A.y, api.s(30), '#5FD8FF', 0.9 * fl);
      if (dt <= 0) continue;
      for (const lag of [0, 0.07]) {
        const rr = (dt - lag) * vS;
        if (rr <= 0) continue;
        const fade = Math.pow(clamp(1 - rr / (RING_MAX * F)), 1.2) * (lag ? 0.5 : 1);
        if (fade <= 0) continue;
        ctx.beginPath();
        ctx.arc(A.x, A.y, rr, 0, TAU);
        if (!lag) {
          ctx.strokeStyle = col(CYAN, 0.14 * fade);
          ctx.lineWidth = api.s(5);
          ctx.stroke();
        }
        ctx.strokeStyle = col(CYAN_HI, 0.7 * fade);
        ctx.lineWidth = Math.max(1, api.s(1.2));
        ctx.stroke();
      }
    }
    ctx.restore();

    // ---- Time-of-flight links, angle-of-arrival arcs, ranges ----
    let cxs = 0;
    let cys = 0;
    for (const o of scr) {
      cxs += o.x / scr.length;
      cys += o.y / scr.length;
    }
    for (const L of st.links) {
      const dt = t - L.tr;
      if (dt < 0 || dt > 1.6) continue;
      const a = seg(dt, 0, 0.08) * (1 - seg(dt, 0.55, 1.6));
      const A = scr[L.a];
      const B = scr[L.b];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.strokeStyle = col(CYAN, 0.22 * a);
      ctx.lineWidth = api.s(3.5);
      ctx.stroke();
      ctx.strokeStyle = col(CYAN_HI, 0.85 * a);
      ctx.lineWidth = Math.max(1, api.s(1.1));
      ctx.stroke();
      const ang = Math.atan2(A.y - B.y, A.x - B.x);
      ctx.strokeStyle = col(CYAN_HI, 0.95 * a);
      ctx.lineWidth = Math.max(1.2, api.s(1.8));
      ctx.beginPath();
      ctx.arc(B.x, B.y, api.s(11), ang - 0.5, ang + 0.5);
      ctx.stroke();
      ctx.restore();
      if (!compact || L.b === st.pings[L.k].nb[0]) {
        const d = Math.hypot(A.p[0] - B.p[0], A.p[1] - B.p[1], A.p[2] - B.p[2]) * M_PER_U;
        const mx0 = (A.x + B.x) / 2;
        const my0 = (A.y + B.y) / 2;
        let nx = -(B.y - A.y);
        let ny = B.x - A.x;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        if (nx * (mx0 - cxs) + ny * (my0 - cys) < 0) {
          nx = -nx;
          ny = -ny;
        }
        api.text(`${d.toFixed(1)} m`, mx0 + nx * api.s(13), my0 + ny * api.s(13), { size: api.fs(10), color: INK, align: 'center', base: 'middle', weight: 600, alpha: a });
      }
    }

    // ---- Position estimates: uncertainty halos tightening to points ----
    st.robots.forEach((R, i) => {
      const sg = sigmaAt(i, t);
      const vis = seg(t, R.tr + 0.15, R.tr + 0.8) * (1 - seg(t, R.tc - 0.1, R.tc + 0.5));
      if (vis <= 0) return;
      const o = scr[i];
      const off = sg * 0.7 * o.s;
      const ex = o.x + R.err[0] * off;
      const ey = o.y + R.err[1] * off;
      const rad = Math.max(api.s(5), sg * o.s);
      const fuzz = clamp((sg - 0.06) / 0.5);
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, rad);
      g.addColorStop(0, col(CYAN, 0.2 * vis * (0.4 + 0.6 * fuzz)));
      g.addColorStop(0.7, col(CYAN, 0.08 * vis * fuzz));
      g.addColorStop(1, col(CYAN, 0));
      ctx.fillStyle = g;
      ctx.fillRect(ex - rad, ey - rad, rad * 2, rad * 2);
      ctx.save();
      if (fuzz > 0.02) {
        ctx.setLineDash([api.s(2.5), api.s(4)]);
        ctx.strokeStyle = col(CYAN_HI, 0.5 * vis * fuzz);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ex, ey, rad, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Locked: a crisp ring with four ticks.
      const lock = vis * (1 - clamp(fuzz * 3));
      if (lock > 0.01) {
        const rr = api.s(6.5);
        ctx.strokeStyle = col(CYAN_HI, 0.9 * lock);
        ctx.lineWidth = Math.max(1, api.s(1.3));
        ctx.beginPath();
        ctx.arc(ex, ey, rr, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const ca = (k * Math.PI) / 2;
          ctx.moveTo(ex + Math.cos(ca) * rr * 1.35, ey + Math.sin(ca) * rr * 1.35);
          ctx.lineTo(ex + Math.cos(ca) * rr * 1.85, ey + Math.sin(ca) * rr * 1.85);
        }
        ctx.stroke();
      }
      ctx.restore();
      api.light(o.x, o.y, api.s(9 + 6 * lock), '#4FD6FF', 0.35 + 0.4 * lock);
    });

    // ---- Near marine snow and lens bokeh ----
    snowPass(true);
    for (const b of st.bokeh) {
      const u = fract(t / D + b.ph);
      const k = (u - 0.5) * 1.1;
      const q = P(cam.x + b.x + FLOW[0] * k, cam.y + b.y + FLOW[1] * k, cam.z + b.z);
      if (!q) continue;
      const rad = q[2] * 0.022 * b.s;
      const a = Math.sin(Math.PI * u) * 0.07 * b.s;
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad);
      g.addColorStop(0, `rgba(210,236,240,${a})`);
      g.addColorStop(0.7, `rgba(210,236,240,${a * 0.6})`);
      g.addColorStop(1, 'rgba(210,236,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(q[0] - rad, q[1] - rad, rad * 2, rad * 2);
    }

    // ---- Estimated current ----
    const flowA = seg(t, 8.3, 9.1) * (1 - seg(t, 12.6, 13.2));
    if (flowA > 0) {
      const conv = ease.inOut(seg(t, 8.3, 11.6));
      const base = narrow ? [0.6, -2.35, 7.6] : [0.5, -1.45, 7.4];
      const len = narrow ? 2.1 : 2.6;
      const q0 = P(base[0], base[1], base[2]);
      const q1 = P(base[0] + FLOW[0] * len, base[1] + FLOW[1] * len, base[2] + FLOW[2] * len);
      if (q0 && q1) {
        const ang = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]);
        const L = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
        // Angular uncertainty of the estimate, narrowing as it converges.
        const spread = lerp(0.34, 0.05, conv);
        ctx.save();
        ctx.translate(q0[0], q0[1]);
        ctx.rotate(ang);
        ctx.strokeStyle = col(CYAN_HI, 0.3 * flowA);
        ctx.lineWidth = 1;
        ctx.setLineDash([api.s(2), api.s(4)]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spread) * L * 0.92, -Math.sin(spread) * L * 0.92);
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spread) * L * 0.92, Math.sin(spread) * L * 0.92);
        ctx.stroke();
        ctx.restore();
        api.arrow(q0[0], q0[1], q1[0], q1[1], { color: col(CYAN_HI, 0.85 * flowA), width: Math.max(1.2, api.s(1.8)), head: api.s(9) });
        const v = lerp(0.07, 0.12, conv);
        api.text(`${compact ? 'current' : 'est. current'} ${v.toFixed(2)} m/s`, (q0[0] + q1[0]) / 2, Math.max(q0[1], q1[1]) + api.s(18), { size: api.fs(10.5), color: INK, align: 'center', weight: 600, alpha: flowA });
      }
    }

    // ---- HUD: swarm self-localization ----
    const hudA = seg(t, HUD_IN[0], HUD_IN[1]) * (1 - seg(t, HUD_OUT[0], HUD_OUT[1]));
    if (hudA > 0) {
      const hx = Math.max(api.s(20), w * 0.05);
      const vsz = api.fs(compact ? 26 : 18);
      const hy = h - (compact ? vsz * 2.6 : api.s(84));
      const err = meanErr(t);
      api.text('SELF-LOCALIZATION', hx, hy, { size: api.fs(10.5), color: INK_DIM, weight: 600, spacing: 1.2, alpha: hudA });
      const vy = hy + vsz * 1.3;
      api.text(`±${err.toFixed(1)} m`, hx, vy, { size: vsz, color: col(CYAN_HI, 0.95), weight: 600, alpha: hudA });
      if (!compact) {
        api.text('mean position error', hx, vy + api.s(19), { size: api.fs(10), color: INK_DIM, alpha: hudA });
        // Sparkline of the error over the deployment (log scale).
        const sx = hx + api.measure('±00.0 m', { size: vsz, weight: 600 }) + api.s(16);
        const sw = api.s(110);
        const sh = vsz * 0.95;
        const sy = vy - sh * 0.9;
        const t0 = st.robots[0].tr;
        const t1 = HUD_OUT[0];
        const ly = (e) => sy + sh * (1 - invLog(e));
        ctx.save();
        ctx.globalAlpha = hudA;
        ctx.strokeStyle = 'rgba(190,228,242,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy + sh + 0.5);
        ctx.lineTo(sx + sw, sy + sh + 0.5);
        ctx.stroke();
        ctx.beginPath();
        const tEnd = clamp(t, t0, t1);
        for (let k = 0; k <= 40; k++) {
          const tt = t0 + ((tEnd - t0) * k) / 40;
          const x = sx + ((tt - t0) / (t1 - t0)) * sw;
          const y = ly(meanErr(tt));
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = col(CYAN_HI, 0.85);
        ctx.lineWidth = Math.max(1, api.s(1.4));
        ctx.stroke();
        ctx.fillStyle = col(CYAN_HI, 1);
        ctx.beginPath();
        ctx.arc(sx + ((tEnd - t0) / (t1 - t0)) * sw, ly(meanErr(tEnd)), api.s(2.4), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    // ---- Captions ----
    const cap = (str, x, y, t0, t1) =>
      api.caption(str, clamp(x, w * 0.2, w * 0.8), y, t0, t1, { size: api.fs(10.5), bg: 'rgba(3,14,26,0.74)', border: col(CYAN, 0.55), color: INK });
    if (mq) cap(compact ? 'passengers released' : 'mothership releases passengers', mq[0], mq[1] + api.s(narrow ? 40 : 46), 1.0, 3.6);
    const p0 = scr[st.pings[0].src];
    cap(compact ? 'ping → range' : 'ping: time of flight → range', narrow ? Math.max(p0.x, w * 0.62) : p0.x, p0.y + api.s(narrow ? 34 : 42), 4.2, 6.6);
    cap(compact ? 'fixes tighten' : 'each range tightens the fixes', w * (narrow ? 0.5 : 0.6), h * (narrow ? 0.36 : 0.3), 7.1, 9.5);

    // ---- Vignette ----
    const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,4,10,0)');
    vg.addColorStop(1, 'rgba(0,4,10,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  },
};

// Log-scale position of an error value (metres) between 0.3 m and 12 m.
function invLog(e) {
  return clamp((Math.log10(Math.max(e, 0.3)) - Math.log10(0.3)) / (Math.log10(12) - Math.log10(0.3)));
}

// A small torpedo-shaped robot. L and dm are in pixels; face is cos(yaw) (±1 = side on,
// near 0 = end on), pitch is the screen-space climb angle.
function drawSub(ctx, x, y, L, dm, face, pitch, fogK) {
  if (L < 1) return;
  const r = dm / 2;
  const sx = Math.sign(face || 1) * Math.max(0.22, Math.abs(face));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pitch * Math.sign(sx));
  ctx.scale(sx, 1);
  const hi = mixc(HULL_HI, FOG, fogK);
  const mid = mixc(HULL_MID, FOG, fogK);
  const lo = mixc(HULL_LO, FOG, fogK);
  ctx.fillStyle = col(lo);
  ctx.beginPath();
  ctx.moveTo(-L * 0.36, -r * 0.5);
  ctx.lineTo(-L * 0.5, -r * 1.55);
  ctx.lineTo(-L * 0.52, -r * 0.4);
  ctx.closePath();
  ctx.moveTo(-L * 0.36, r * 0.5);
  ctx.lineTo(-L * 0.5, r * 1.45);
  ctx.lineTo(-L * 0.52, r * 0.4);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, col(hi));
  g.addColorStop(0.5, col(mid));
  g.addColorStop(1, col(lo));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -r * 0.5);
  ctx.lineTo(L / 2 - r, -r);
  ctx.arc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-L / 2, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col(mixc(lo, mid, 0.4));
  ctx.beginPath();
  ctx.arc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(L / 2 - r * 1.2, r);
  ctx.lineTo(L / 2 - r * 1.2, -r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = col(mixc(HULL_HI, [255, 255, 255], 0.4), 0.55 * (1 - fogK));
  ctx.lineWidth = Math.max(0.6, r * 0.22);
  ctx.beginPath();
  ctx.moveTo(-L * 0.38, -r * 0.62);
  ctx.lineTo(L / 2 - r * 1.3, -r * 0.7);
  ctx.stroke();
  ctx.restore();
}

// The mothership: a larger AUV with a sail, a docking rail and a headlight.
function drawMother(api, q, fogK, t) {
  const { ctx } = api;
  const s = q[2];
  const L = s * 2.2;
  const dm = s * 0.38;
  const r = dm / 2;
  const x = q[0];
  const y = q[1];
  const lo = mixc(HULL_LO, FOG, fogK);
  const mid = mixc(HULL_MID, FOG, fogK);
  const hi = mixc(HULL_HI, FOG, fogK);
  // Headlight beam, soft-edged.
  const nx = x + L / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bl = s * 3.6;
  const bg = ctx.createRadialGradient(nx, y, 0, nx, y, bl);
  bg.addColorStop(0, 'rgba(255,246,226,0.05)');
  bg.addColorStop(1, 'rgba(255,246,226,0)');
  ctx.fillStyle = bg;
  for (const k of [1, 0.66, 0.36]) {
    ctx.beginPath();
    ctx.moveTo(nx, y);
    ctx.lineTo(nx + bl, y + bl * (0.12 - 0.26 * k));
    ctx.lineTo(nx + bl, y + bl * (0.12 + 0.26 * k));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  // Sail with the acoustic modem.
  ctx.fillStyle = col(mixc(lo, mid, 0.35));
  ctx.beginPath();
  ctx.moveTo(L * 0.02, -r * 0.8);
  ctx.lineTo(L * 0.08, -r * 1.9);
  ctx.lineTo(L * 0.2, -r * 1.9);
  ctx.lineTo(L * 0.26, -r * 0.8);
  ctx.closePath();
  ctx.fill();
  // Tail fins.
  ctx.fillStyle = col(lo);
  ctx.beginPath();
  ctx.moveTo(-L * 0.38, -r * 0.6);
  ctx.lineTo(-L * 0.5, -r * 1.7);
  ctx.lineTo(-L * 0.53, -r * 0.5);
  ctx.closePath();
  ctx.moveTo(-L * 0.38, r * 0.6);
  ctx.lineTo(-L * 0.5, r * 1.6);
  ctx.lineTo(-L * 0.53, r * 0.5);
  ctx.closePath();
  ctx.fill();
  // Hull.
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, col(hi));
  g.addColorStop(0.45, col(mid));
  g.addColorStop(1, col(lo));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -r * 0.62);
  ctx.bezierCurveTo(-L * 0.36, -r * 1.02, -L * 0.2, -r, 0, -r);
  ctx.lineTo(L / 2 - r * 1.6, -r);
  ctx.bezierCurveTo(L / 2 - r * 0.4, -r, L / 2, -r * 0.5, L / 2, 0);
  ctx.bezierCurveTo(L / 2, r * 0.5, L / 2 - r * 0.4, r, L / 2 - r * 1.6, r);
  ctx.lineTo(0, r);
  ctx.bezierCurveTo(-L * 0.2, r, -L * 0.36, r * 1.02, -L / 2, r * 0.62);
  ctx.closePath();
  ctx.fill();
  // Propeller shroud.
  ctx.strokeStyle = col(mixc(lo, mid, 0.5));
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.beginPath();
  ctx.ellipse(-L / 2 - r * 0.05, 0, r * 0.22, r * 0.78, 0, 0, TAU);
  ctx.stroke();
  // Docking rail under the hull.
  ctx.strokeStyle = col(mixc(lo, [0, 0, 0], 0.2));
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.moveTo(-L * 0.34, r * 1.02);
  ctx.lineTo(L * 0.3, r * 1.02);
  ctx.stroke();
  // Highlight and panel seams.
  ctx.strokeStyle = col(mixc(HULL_HI, [255, 255, 255], 0.5), 0.5 * (1 - fogK));
  ctx.lineWidth = Math.max(0.8, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-L * 0.3, -r * 0.7);
  ctx.lineTo(L * 0.36, -r * 0.72);
  ctx.stroke();
  ctx.strokeStyle = col(lo, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const fx of [-0.18, 0.12, 0.34]) {
    ctx.moveTo(L * fx, -r * 0.95);
    ctx.lineTo(L * fx, r * 0.95);
  }
  ctx.stroke();
  ctx.restore();
  api.light(nx, y, s * 0.42, '#FFF4DC', 0.85);
  const blink = Math.max(0, Math.sin((TAU * t * 4) / D)) ** 12;
  api.light(x + L * 0.14, y - r * 1.95, s * 0.3, '#4FD6FF', 0.4 + 0.6 * blink);
}
