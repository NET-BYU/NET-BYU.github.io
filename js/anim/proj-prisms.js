// PRISMS (Pediatric Research using Integrated Sensor Monitoring Systems): cinematic scene.
// A cutaway home at night: kitchen, living room and a child's bedroom. A sensor in each room
// reports air quality to the home router and on to a research cloud. Cooking in the kitchen
// sends particles drifting toward the other rooms; the kitchen sensor flags the spike, the
// living-room air purifier switches on, and PM2.5 falls while the child's room stays low.
// The HUD's PM2.5 traces are counted from the drawn particles. All values are synthetic.
import { TAU, clamp, lerp, seg, ease, noise2 } from './kit.js';

const D = 16; // loop length (s)
const FADE = 0.6; // fade at the loop seam (s)

// Theme-independent palette.
const GREEN = '#00A775';
const G_RGB = '0,167,117';
const G_HI = '122,236,192'; // lighter tint for glows and text
const AMBER = '255,180,90';
const SMOKE = '226,214,200';
const LAMP = '255,212,160';
const INK = '232,240,238';

// House in metres: x runs kitchen → child's room, z front → back, y up.
const HX = 13;
const HZ = 7;
const WALL_H = 2.7; // back and left walls
const CUT_H = 1.35; // interior walls, cut to show the rooms
const LOW_H = 0.42; // front and right walls, cut low
const TW = 0.16; // wall thickness
const X1 = 4.4; // kitchen | living room
const X2 = 9.0; // living room | child's room
const DOOR = [4.2, 5.45]; // doorway span (z) in both interior walls
const PAN = { x: 1.65, y: 0.98, z: 6.55 };
const ROUTER = { x: 7.25, y: 0.5, z: 6.72 };
const PUR = { x0: 8.02, x1: 8.62, z0: 5.72, z1: 6.32, h: 1.1 };
const PUR_C = { x: (PUR.x0 + PUR.x1) / 2, z: (PUR.z0 + PUR.z1) / 2 };
const SENSORS = [
  { x: 0.02, y: 1.55, z: 2.4, wall: 'left' }, // kitchen
  { x: 5.5, y: 1.62, z: HZ - 0.02, wall: 'back' }, // living room
  { x: 12.3, y: 1.42, z: HZ - 0.02, wall: 'back' }, // child's room
];
const ALERT = 35; // µg/m³, synthetic alert level
const T_COOK = [1.2, 5.0];
const K_PM = 1.15; // µg/m³ per drawn particle (synthetic)
const BASE = [6, 5, 4];
const MIN_PER_S = 5; // timeline: 1 s of loop = 5 min

const wrapT = (t) => ((t % D) + D) % D;

function camAt(t, narrow) {
  const ph = (t / D) * TAU;
  const yaw = -0.37 + 0.022 * Math.sin(ph);
  const pitch = 0.6 + 0.012 * Math.sin(ph + 1.3);
  const dist = 30;
  const off = narrow ? 0 : 3.9; // shift the house left of the HUD on wide frames
  const tx = 6.5 + Math.cos(yaw) * off;
  const tz = 3.5 - Math.sin(yaw) * off;
  const ty = narrow ? -1.15 : 0.75;
  const hz = dist * Math.cos(pitch);
  return { x: tx - hz * Math.sin(yaw), y: ty + dist * Math.sin(pitch), z: tz - hz * Math.cos(yaw), yaw, pitch: -pitch, f: narrow ? 1.5 : 1.6 };
}

// Furniture: axis-aligned boxes; visible faces are the top, the front (-z) and the right (+x).
const KITCHEN_BOXES = [
  { x0: 0, x1: 3.3, z0: 6.35, z1: HZ, y0: 0, y1: 0.92, c: '#6E5D4F', top: '#B9B1A5' }, // counter
  { x0: 0, x1: 2.55, z0: 6.66, z1: HZ, y0: 1.55, y1: 2.3, c: '#776655', top: '#8C7B69' }, // wall cabinets
  { x0: 0, x1: 0.8, z0: 4.85, z1: 5.75, y0: 0, y1: 1.95, c: '#AEB4B8', top: '#C9CED1' }, // fridge
  { x0: 1.6, x1: 2.85, z0: 2.25, z1: 3.25, y0: 0.68, y1: 0.76, c: '#6B5444', top: '#8A6C56', legs: true }, // table
];
const LIVING_BOXES = [
  { x0: 5.3, x1: 7.7, z0: 6.48, z1: HZ, y0: 0, y1: 0.5, c: '#5A4637', top: '#715A47' }, // TV console
  { x0: 5.2, x1: 7.6, z0: 0.55, z1: 1.45, y0: 0, y1: 0.44, c: '#3F5663', top: '#4D6876' }, // sofa seat
  { x0: 5.2, x1: 7.6, z0: 0.32, z1: 0.6, y0: 0, y1: 0.86, c: '#3A505C', top: '#4A6371' }, // sofa back
  { x0: 5.85, x1: 7.0, z0: 2.25, z1: 2.9, y0: 0.32, y1: 0.4, c: '#5E4A3B', top: '#7A604C', legs: true }, // coffee table
];
const CHILD_BOXES = [
  { x0: 9.6, x1: 11.7, z0: 5.0, z1: 6.95, y0: 0, y1: 0.42, c: '#6A5545', top: '#7D6553' }, // bed frame
  { x0: 9.66, x1: 11.64, z0: 5.04, z1: 6.55, y0: 0.42, y1: 0.58, c: '#4E6290', top: '#6077A8' }, // blanket
  { x0: 9.95, x1: 11.35, z0: 6.42, z1: 6.86, y0: 0.42, y1: 0.66, c: '#C9C2B6', top: '#E2DCD1' }, // pillow
  { x0: 11.9, x1: 12.5, z0: 6.38, z1: 6.95, y0: 0, y1: 0.5, c: '#8A6C4E', top: '#A08061' }, // nightstand
  { x0: 12.05, x1: 12.82, z0: 1.0, z1: 2.15, y0: 0, y1: 0.52, c: '#7C6150', top: '#93745F' }, // toy chest
];

export default {
  duration: D,
  still: 6.8,
  scene: true,

  init(api) {
    const r = api.rng('prisms-scene');
    // ---- Particles from the stove (deterministic paths through the doorways) ----
    const N = 150;
    const parts = [];
    for (let i = 0; i < N; i++) {
      const e = lerp(T_COOK[0] + 0.15, T_COOK[1] - 0.4, Math.pow(i / N, 0.85)) + r.range(-0.08, 0.08);
      const u = r();
      const dest = u < 0.5 ? 0 : u < 0.86 ? 1 : 2;
      const pts = [
        [PAN.x + r.range(-0.12, 0.12), PAN.y, PAN.z + r.range(-0.1, 0.1)],
        [PAN.x + r.range(-0.45, 0.45), r.range(1.7, 2.3), r.range(5.5, 6.3)],
      ];
      if (dest === 0) pts.push([r.range(0.5, 4.0), r.range(1.0, 2.2), r.range(0.8, 6.0)]);
      else {
        pts.push([r.range(2.6, 3.8), r.range(1.3, 2.0), r.range(4.6, 5.4)]);
        pts.push([X1, r.range(0.9, 1.9), r.range(DOOR[0] + 0.25, DOOR[1] - 0.2)]);
        if (dest === 1) pts.push([r.range(4.9, 8.5), r.range(0.7, 2.1), r.range(0.9, 6.2)]);
        else {
          pts.push([r.range(5.6, 8.2), r.range(1.0, 1.9), r.range(4.3, 5.6)]);
          pts.push([X2, r.range(0.9, 1.8), r.range(DOOR[0] + 0.25, DOOR[1] - 0.2)]);
          pts.push([r.range(9.5, 12.6), r.range(0.7, 1.9), r.range(1.0, 6.3)]);
        }
      }
      const seglen = [];
      let L = 0;
      for (let k = 1; k < pts.length; k++) {
        const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
        seglen.push(d);
        L += d;
      }
      parts.push({
        i,
        e,
        dest,
        pts,
        seglen,
        L,
        T: L / r.range(1.9, 2.8),
        life: r.range(8.5, 11.5),
        size: r.range(0.6, 1.25),
        cap: dest < 2 || r() < 0.6,
        delay: dest === 1 ? r.range(0, 2.2) : dest === 0 ? r.range(1.2, 4.2) : r.range(2.6, 5.4),
        cd: r.range(1.1, 1.9) + (dest === 1 ? 0 : 0.8),
        intake: [PUR_C.x + r.range(-0.32, 0.32), r.range(0.22, 0.7), PUR_C.z + r.range(-0.32, 0.32)],
      });
    }
    const st = { parts, tOn: 99, tOff: 99 };
    // Pass 1 (no purifier) finds when the kitchen crosses the alert level.
    const series = (withCapture) => {
      const n = D * 10;
      const out = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
      const pos = [0, 0, 0];
      for (let s = 0; s < n; s++) {
        const tt = s / 10;
        const acc = [0, 0, 0];
        for (const p of parts) {
          const a = partAt(st, p, tt, pos, withCapture);
          if (a <= 0) continue;
          acc[pos[0] < X1 ? 0 : pos[0] < X2 ? 1 : 2] += a;
        }
        for (let k = 0; k < 3; k++) out[k][s] = BASE[k] + K_PM * acc[k];
      }
      // light smoothing (3-tap)
      for (const arr of out) {
        const c = Float32Array.from(arr);
        for (let s = 1; s < n - 1; s++) arr[s] = (c[s - 1] + c[s] * 2 + c[s + 1]) / 4;
      }
      return out;
    };
    let pm = series(false);
    let tAlert = 3;
    for (let s = 0; s < pm[0].length; s++) {
      if (pm[0][s] > ALERT) {
        tAlert = s / 10;
        break;
      }
    }
    st.tAlert = tAlert;
    st.tOn = tAlert + 0.95;
    // Capture start: once the purifier runs and the particle has had time to spread.
    for (const p of parts) p.c0 = Math.max(st.tOn + p.delay, p.e + p.T * 0.55 + p.delay * 0.3);
    pm = series(true);
    st.pm = pm;
    st.tClear = D - 1;
    for (let s = Math.round((tAlert + 1) * 10); s < pm[0].length; s++) {
      if (pm[0][s] < ALERT) {
        st.tClear = s / 10;
        break;
      }
    }
    st.tOff = Math.min(D - 2.2, st.tClear + 3.2);
    for (let s = Math.round((st.tClear + 1) * 10); s < pm[0].length; s++) {
      if (pm[0][s] < 10 && pm[2][s] < 8) {
        st.tOff = Math.min(st.tOff, s / 10 + 0.4);
        break;
      }
    }
    st.peak = [0, 0, 0];
    for (let k = 0; k < 3; k++) for (const v of pm[k]) st.peak[k] = Math.max(st.peak[k], v);

    // ---- Data pulses: sensors → router (heartbeats, faster from the kitchen during the alert),
    // router → research cloud, and one command router → purifier. ----
    const pulses = [];
    const phases = [0.35, 1.15, 1.95];
    for (let si = 0; si < 3; si++) {
      for (let ts = phases[si]; ts < D - 1.2; ts += 2.6) {
        if (si === 0 && ts > st.tAlert && ts < st.tClear) continue;
        pulses.push({ from: si, t0: ts });
      }
    }
    for (let ts = st.tAlert + 0.05; ts < st.tClear; ts += 0.55) pulses.push({ from: 0, t0: ts, alert: true });
    st.pulses = pulses;
    st.up = pulses.map((p) => ({ t0: p.t0 + 0.8, alert: !!p.alert })).filter((p) => p.t0 < D - 1.1);

    // Planks and tiles (static floor detail).
    st.dust = Array.from({ length: 26 }, () => ({ x: r.range(-0.5, 13.5), y: r.range(0.4, 2.4), z: r.range(0.3, 6.8), ph: r() * TAU, s: r.range(0.5, 1) }));
    return st;
  },

  draw(api, st) {
    const { ctx, w, h, t } = api;
    const narrow = w / h < 1.6;
    const compact = api.compact;
    const cam = camAt(t, narrow);
    const P = (x, y, z) => api.project(x, y, z, cam);
    const S = api.s(1);
    const cooking = t >= T_COOK[0] && t < T_COOK[1];
    const heat = Math.min(seg(t, T_COOK[0], T_COOK[0] + 0.5), 1 - seg(t, T_COOK[1], T_COOK[1] + 0.8));
    const purOn = Math.min(seg(t, st.tOn, st.tOn + 0.6), 1 - seg(t, st.tOff, st.tOff + 0.8));
    const alertOn = t >= st.tAlert && t < st.tClear;

    // ---------- Night backdrop ----------
    ctx.fillStyle = '#071017';
    ctx.fillRect(0, 0, w, h);
    // One soft glow around the house doubles as the lawn it stands on.
    floorLight(ctx, P, 6.5, 3.5, 12, '26,52,50', 0.75, 0, 'source-over');
    quadPath(ctx, P, [[-0.5, 0, -0.6], [HX + 0.6, 0, -0.6], [HX + 0.6, 0, HZ + 0.5], [-0.5, 0, HZ + 0.5]]);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    // ---------- Floors ----------
    floorQuad(ctx, P, 0, X1, '#57534D');
    floorQuad(ctx, P, X1, X2, '#4A3628');
    floorQuad(ctx, P, X2, HX, '#3B3F4E');
    // Tile grid (kitchen) and planks (living room).
    ctx.beginPath();
    for (let x = 0.6; x < X1; x += 0.6) lineAt(ctx, P, [x, 0.003, 0], [x, 0.003, HZ]);
    for (let z = 0.6; z < HZ; z += 0.6) lineAt(ctx, P, [0, 0.003, z], [X1, 0.003, z]);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    for (let z = 0.22; z < HZ; z += 0.22) lineAt(ctx, P, [X1, 0.003, z], [X2, 0.003, z]);
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.stroke();
    // Rugs.
    quadPath(ctx, P, [[5.0, 0.01, 1.7], [8.3, 0.01, 1.7], [8.3, 0.01, 4.4], [5.0, 0.01, 4.4]]);
    ctx.fillStyle = 'rgba(122,78,62,0.55)';
    ctx.fill();
    quadPath(ctx, P, [[9.9, 0.01, 1.8], [12.2, 0.01, 1.8], [12.2, 0.01, 4.3], [9.9, 0.01, 4.3]]);
    ctx.fillStyle = 'rgba(120,108,150,0.45)';
    ctx.fill();
    // Ambient occlusion along wall feet.
    aoStrip(ctx, P, [0, HZ], [HX, HZ], [0, -0.75]);
    aoStrip(ctx, P, [0, 0], [0, HZ], [0.75, 0]);
    for (const X of [X1, X2]) {
      aoStrip(ctx, P, [X + TW / 2, 0], [X + TW / 2, HZ], [0.55, 0]);
      aoStrip(ctx, P, [X - TW / 2, 0], [X - TW / 2, HZ], [-0.55, 0]);
    }
    // Interior light pools (additive).
    floorLight(ctx, P, 1.8, 5.6, 2.6, LAMP, 0.32); // under-cabinet light
    floorLight(ctx, P, 2.2, 2.7, 2.4, LAMP, 0.22); // over the table
    floorLight(ctx, P, 5.1, 1.4, 2.6, LAMP, 0.34); // floor lamp
    floorLight(ctx, P, 6.5, 5.6, 2.2, '150,180,230', 0.1); // TV
    floorLight(ctx, P, 12.1, 5.9, 2.0, LAMP, 0.2); // night light
    if (heat > 0) floorLight(ctx, P, PAN.x, 6.0, 1.8, '255,140,70', 0.22 * heat);

    // ---------- Back and left walls ----------
    drawWallBox(ctx, P, { x0: -TW, x1: HX + TW, z0: HZ, z1: HZ + TW, y1: WALL_H }, '#7D7166', '#DCD3C7');
    for (const win of [[2.75, 3.95, 1.25, 2.2], [7.95, 8.85, 1.05, 2.3], [9.9, 11.25, 1.3, 2.25]]) backWindow(ctx, P, win);
    // TV on the back wall.
    quadPath(ctx, P, [[5.75, 0.95, HZ - 0.02], [7.25, 0.95, HZ - 0.02], [7.25, 1.8, HZ - 0.02], [5.75, 1.8, HZ - 0.02]]);
    ctx.fillStyle = '#10161D';
    ctx.fill();
    drawWallBox(ctx, P, { x0: -TW, x1: 0, z0: 0, z1: HZ, y1: WALL_H }, '#74685E', '#DCD3C7');
    // Warm wash on the walls from the lamps.
    wallGlow(api, P, 1.6, 1.25, HZ - 0.05, S * 70, 0.18);
    wallGlow(api, P, 12.1, 0.9, HZ - 0.05, S * 40, 0.16);
    // Wall-mounted sensors.
    const sensorState = (si) => (si === 0 && alertOn ? 'alert' : 'ok');
    drawSensor(api, P, SENSORS[1], sensorState(1), t, S);
    drawSensor(api, P, SENSORS[2], sensorState(2), t, S);
    drawSensor(api, P, SENSORS[0], sensorState(0), t, S);

    // ---------- Kitchen ----------
    stepParticles(st, t);
    for (const b of sortBoxes(KITCHEN_BOXES, cam)) drawBox(ctx, P, b);
    drawStove(api, P, heat, S, t);
    drawParticles(api, P, st, t, 0, S);
    // ---------- Wall: kitchen | living ----------
    interiorWall(ctx, P, X1);
    // ---------- Living room ----------
    drawBox(ctx, P, LIVING_BOXES[0]);
    drawRouter(api, P, S, t, st);
    drawPurifier(api, P, purOn, st, t, S);
    for (const b of sortBoxes(LIVING_BOXES.slice(1), cam)) drawBox(ctx, P, b);
    drawFloorLamp(api, P, S);
    drawParticles(api, P, st, t, 1, S);
    drawAirflow(api, P, purOn, t, S);
    // ---------- Wall: living | child's room ----------
    interiorWall(ctx, P, X2);
    // ---------- Child's room ----------
    for (const b of sortBoxes(CHILD_BOXES, cam)) drawBox(ctx, P, b);
    const nl = P(12.2, 0.62, 6.66);
    if (nl) {
      api.light(nl[0], nl[1], S * 16, '#FFD7A0', 0.5);
      api.circle(nl[0], nl[1], Math.max(1, S * 1.4), { fill: '#FFE7C4' });
    }
    drawParticles(api, P, st, t, 2, S);
    // ---------- Low front and right walls ----------
    drawWallBox(ctx, P, { x0: -TW, x1: HX + TW, z0: -TW, z1: 0, y1: LOW_H }, '#2A2F37', '#D8D0C4', true);
    drawWallBox(ctx, P, { x0: HX, x1: HX + TW, z0: 0, z1: HZ, y1: LOW_H }, '#262A32', '#D8D0C4', true);

    // ---------- Data: sensors → router → research cloud ----------
    const cloud = narrow ? { x: w * 0.84, y: h * 0.11, r: Math.max(16, S * 30) } : { x: w * 0.735, y: h * 0.17, r: S * 30 };
    const qRouter = P(ROUTER.x, ROUTER.y + 0.08, ROUTER.z);
    drawCloud(api, cloud, st, t, S);
    if (qRouter) {
      for (const p of st.pulses) {
        const u = (t - p.t0) / 0.8;
        if (u < 0 || u > 1) continue;
        const s = SENSORS[p.from];
        const q0 = P(s.x + (s.wall === 'left' ? 0.06 : 0), s.y, s.z - (s.wall === 'back' ? 0.06 : 0));
        if (q0) pulseDot(api, q0, qRouter, S * 26, u, p.alert ? 'alert' : 'ok', S);
      }
      for (const p of st.up) {
        const u = (t - p.t0) / 1.05;
        if (u < 0 || u > 1) continue;
        pulseDot(api, qRouter, [cloud.x - cloud.r * 0.1, cloud.y + cloud.r * 0.45], S * 60, u, 'ok', S);
      }
      // The command that switches the purifier on.
      const cu = (t - (st.tOn - 0.5)) / 0.5;
      const qp = P(PUR_C.x, PUR.h + 0.1, PUR_C.z);
      if (cu >= 0 && cu <= 1 && qp) pulseDot(api, qRouter, qp, S * 14, cu, 'cmd', S);
    }

    // ---------- Labels ----------
    if (narrow) {
      // Small floor labels inside the rooms (the HUD sits below the house here).
      const fl = (str, x, z) => {
        const q = P(x, 0, z);
        if (q) haloText(api, str, q[0], q[1], api.fs(8.5), `rgba(${INK},0.78)`, 'center');
      };
      fl('KITCHEN', 1.5, 1.2);
      fl("CHILD'S ROOM", 11.0, 3.1);
      if (!compact) fl('LIVING ROOM', 6.6, 3.7);
    } else {
      const roomLab = (str, x) => {
        const q = P(x, 0, -0.35);
        if (q) api.text(str, q[0], q[1] + api.fs(10) * 1.35, { size: api.fs(9.5), color: `rgba(${INK},0.62)`, align: 'center', weight: 600, spacing: 0.8 });
      };
      roomLab('KITCHEN', X1 / 2);
      roomLab('LIVING ROOM', (X1 + X2) / 2);
      roomLab("CHILD'S ROOM", (X2 + HX) / 2);
    }
    const qs = P(SENSORS[0].x, SENSORS[0].y + 0.32, SENSORS[0].z);
    if (qs) api.caption(compact ? 'spike' : 'PM2.5 spike', qs[0] + S * 6, qs[1] - S * 12, st.tAlert, st.tAlert + 2.6, { size: api.fs(10), color: `rgb(${AMBER})`, bg: 'rgba(14,12,10,0.8)', border: 'rgba(255,180,90,0.55)', align: 'left' });
    const qpl = compact ? P(7.0, 0, 3.9) : P(PUR_C.x, WALL_H + 0.55, PUR_C.z);
    const qpb = P(PUR_C.x, PUR.h + 0.2, PUR_C.z);
    const capA = Math.min(seg(t, st.tOn, st.tOn + 0.22), 1 - seg(t, st.tOn + 4.0, st.tOn + 4.2));
    if (qpl && qpb && capA > 0) api.line([[qpb[0], qpb[1]], [qpl[0], qpl[1] + api.fs(10)]], { color: `rgba(${G_HI},${0.45 * capA})`, width: 1, dash: [S * 2, S * 3] });
    if (qpl) api.caption(compact ? 'purifier on' : 'air purifier on', qpl[0], qpl[1], st.tOn, st.tOn + 4.2, { size: api.fs(10), color: `rgb(${G_HI})`, bg: 'rgba(6,18,16,0.82)', border: 'rgba(0,167,117,0.7)' });
    if (!compact && qRouter) haloText(api, 'router', qRouter[0] - S * 6, qRouter[1] + S * 17, api.fs(9), `rgba(${G_HI},0.9)`, 'right');

    // ---------- HUD: PM2.5 timeline ----------
    drawHud(api, st, t, narrow, cloud);

    vignette(ctx, w, h, '2,6,10', 0.5);
    // Fade at the loop seam: erase toward the stage colour (kit alpha options replace globalAlpha).
    const vis = Math.min(seg(t, 0, FADE), 1 - seg(t, D - FADE, D));
    if (vis < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${1 - vis})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};

// ---------- Particles ----------

// Writes the particle's position into out and returns its opacity (0 when not present).
function partAt(st, p, t, out, withCapture = true) {
  const a = t - p.e;
  if (a < 0) return 0;
  let alpha = Math.min(1, a / 0.35) * (1 - seg(a, p.life - 1.6, p.life));
  if (alpha <= 0) return 0;
  free(p, t, out);
  if (withCapture && p.cap && t > p.c0) {
    const u = seg(t, p.c0, p.c0 + p.cd);
    if (u >= 1) return 0;
    const x0 = out[0];
    const y0 = out[1];
    const z0 = out[2];
    // Route to the purifier through a doorway when coming from another room.
    const via = x0 < X1 ? [X1, 1.2, (DOOR[0] + DOOR[1]) / 2] : x0 > X2 ? [X2, 1.2, (DOOR[0] + DOOR[1]) / 2] : null;
    const e = ease.in(u);
    if (via) {
      if (e < 0.5) {
        const k = e / 0.5;
        out[0] = lerp(x0, via[0], k);
        out[1] = lerp(y0, via[1], k);
        out[2] = lerp(z0, via[2], k);
      } else {
        const k = (e - 0.5) / 0.5;
        out[0] = lerp(via[0], p.intake[0], k);
        out[1] = lerp(via[1], p.intake[1], k);
        out[2] = lerp(via[2], p.intake[2], k);
      }
    } else {
      out[0] = lerp(x0, p.intake[0], e);
      out[1] = lerp(y0, p.intake[1], e);
      out[2] = lerp(z0, p.intake[2], e);
    }
    alpha *= 1 - seg(u, 0.78, 1);
  }
  return alpha;
}

function free(p, t, out) {
  const a = t - p.e;
  const u = clamp(a / p.T);
  let s = (p.L * (1 - Math.cos(Math.PI * u))) / 2;
  let k = 0;
  while (k < p.seglen.length - 1 && s > p.seglen[k]) {
    s -= p.seglen[k];
    k++;
  }
  const f = clamp(s / p.seglen[k]);
  const A = p.pts[k];
  const B = p.pts[k + 1];
  const wob = 0.22 * Math.min(1, a / 1.5);
  out[0] = lerp(A[0], B[0], f) + noise2(p.i * 1.71, t * 0.32) * wob;
  out[1] = lerp(A[1], B[1], f) + noise2(p.i * 2.33 + 5, t * 0.28) * wob * 0.6 - 0.04 * Math.max(0, a - p.T);
  out[2] = lerp(A[2], B[2], f) + noise2(p.i * 3.07 + 9, t * 0.3) * wob;
  // Stay inside the house and away from the walls of the room you are in.
  if (u >= 1) {
    out[0] = clamp(out[0], 0.2, HX - 0.2);
    out[2] = clamp(out[2], 0.2, HZ - 0.2);
  }
  out[1] = Math.max(0.15, out[1]);
}

const POS = [0, 0, 0];
const MAXP = 256;
const PX = new Float32Array(MAXP);
const PY = new Float32Array(MAXP);
const PZ = new Float32Array(MAXP);
const PA = new Float32Array(MAXP);
const PR = new Uint8Array(MAXP);
// Positions for this frame, computed once and shared by the three room passes.
function stepParticles(st, t) {
  const n = Math.min(MAXP, st.parts.length);
  for (let k = 0; k < n; k++) {
    const a = partAt(st, st.parts[k], t, POS);
    PA[k] = a;
    if (a <= 0.01) continue;
    PX[k] = POS[0];
    PY[k] = POS[1];
    PZ[k] = POS[2];
    PR[k] = POS[0] < X1 ? 0 : POS[0] < X2 ? 1 : 2;
  }
}

function drawParticles(api, P, st, t, room, S) {
  const { ctx } = api;
  // Room haze, proportional to the room's PM2.5 (soft, additive).
  const idx = Math.min(st.pm[0].length - 1, Math.max(0, Math.floor(t * 10)));
  const level = clamp((st.pm[room][idx] - BASE[room]) / 90);
  if (level > 0.01) {
    const cx = room === 0 ? 2.2 : room === 1 ? 6.7 : 11.0;
    const q = P(cx, 1.3, 3.8);
    if (q) {
      const rr = q[2] * 2.3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr);
      g.addColorStop(0, `rgba(${SMOKE},${0.16 * level})`);
      g.addColorStop(1, `rgba(${SMOKE},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(q[0] - rr, q[1] - rr, rr * 2, rr * 2);
      ctx.restore();
    }
  }
  const n = Math.min(MAXP, st.parts.length);
  for (let k = 0; k < n; k++) {
    const a = PA[k];
    if (a <= 0.01 || PR[k] !== room) continue;
    const q = P(PX[k], PY[k], PZ[k]);
    if (!q) continue;
    const rad = Math.max(0.8, q[2] * 0.035 * st.parts[k].size);
    const warm = PX[k] < 3 && PZ[k] > 5 ? 0.35 : 0;
    ctx.fillStyle = `rgba(${warm ? '240,206,170' : SMOKE},${0.1 * a})`;
    ctx.beginPath();
    ctx.arc(q[0], q[1], rad * 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(${warm ? '250,220,190' : SMOKE},${0.5 * a})`;
    ctx.beginPath();
    ctx.arc(q[0], q[1], rad, 0, TAU);
    ctx.fill();
  }
  void S;
}

function haloText(api, str, x, y, size, color, align = 'left') {
  const { ctx } = api;
  ctx.save();
  ctx.font = api.font(size, { weight: 600 });
  ctx.textAlign = align;
  ctx.lineWidth = Math.max(2.5, size * 0.4);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,12,14,0.85)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// ---------- Geometry helpers ----------

function quadPath(ctx, P, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const q = P(pts[i][0], pts[i][1], pts[i][2]);
    if (!q) return false;
    if (i) ctx.lineTo(q[0], q[1]);
    else ctx.moveTo(q[0], q[1]);
  }
  ctx.closePath();
  return true;
}

function lineAt(ctx, P, a, b) {
  const qa = P(a[0], a[1], a[2]);
  const qb = P(b[0], b[1], b[2]);
  if (!qa || !qb) return;
  ctx.moveTo(qa[0], qa[1]);
  ctx.lineTo(qb[0], qb[1]);
}

function floorQuad(ctx, P, x0, x1, color) {
  if (quadPath(ctx, P, [[x0, 0, 0], [x1, 0, 0], [x1, 0, HZ], [x0, 0, HZ]])) {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(clamp(v * k, 0, 255));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function depthOf(cam, x, z) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  return dx * Math.sin(cam.yaw) + dz * Math.cos(cam.yaw);
}

function sortBoxes(list, cam) {
  return [...list].sort((a, b) => depthOf(cam, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) - depthOf(cam, (a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2));
}

function drawBox(ctx, P, b) {
  const { x0, x1, z0, z1, y0, y1 } = b;
  // contact shadow
  if (y0 === 0 || b.legs) {
    const yb = 0.004;
    if (quadPath(ctx, P, [[x0 - 0.12, yb, z0 - 0.12], [x1 + 0.12, yb, z0 - 0.12], [x1 + 0.12, yb, z1 + 0.1], [x0 - 0.12, yb, z1 + 0.1]])) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
    }
  }
  if (b.legs) {
    ctx.beginPath();
    for (const [lx, lz] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.08, z0 + 0.08], [x1 - 0.08, z1 - 0.08], [x0 + 0.08, z1 - 0.08]]) lineAt(ctx, P, [lx, 0, lz], [lx, y0, lz]);
    ctx.strokeStyle = shade(b.c, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (quadPath(ctx, P, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]])) {
    ctx.fillStyle = shade(b.c, 0.72);
    ctx.fill();
  }
  if (quadPath(ctx, P, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]])) {
    ctx.fillStyle = b.c;
    ctx.fill();
  }
  if (quadPath(ctx, P, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])) {
    ctx.fillStyle = b.top;
    ctx.fill();
  }
}

// Walls: inner/visible faces with a soft vertical gradient and a light section cut on top.
function drawWallBox(ctx, P, b, face, cut, exterior = false) {
  const { x0, x1, z0, z1, y1 } = b;
  const fill = (pts, k) => {
    if (!quadPath(ctx, P, pts)) return;
    const qa = P(pts[0][0], 0, pts[0][2]);
    const qb = P(pts[0][0], y1, pts[0][2]);
    if (qa && qb && !exterior) {
      const g = ctx.createLinearGradient(qa[0], qa[1], qb[0], qb[1]);
      g.addColorStop(0, shade(face, 0.72 * k));
      g.addColorStop(0.5, shade(face, 1.0 * k));
      g.addColorStop(1, shade(face, 0.86 * k));
      ctx.fillStyle = g;
    } else ctx.fillStyle = shade(face, k);
    ctx.fill();
  };
  fill([[x1, 0, z0], [x1, 0, z1], [x1, y1, z1], [x1, y1, z0]], 0.86);
  fill([[x0, 0, z0], [x1, 0, z0], [x1, y1, z0], [x0, y1, z0]], 1);
  if (quadPath(ctx, P, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])) {
    ctx.fillStyle = cut;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function interiorWall(ctx, P, X) {
  const x0 = X - TW / 2;
  const x1 = X + TW / 2;
  drawWallBox(ctx, P, { x0, x1, z0: DOOR[1], z1: HZ, y1: CUT_H }, '#8A7D70', '#DCD3C7');
  drawWallBox(ctx, P, { x0, x1, z0: 0, z1: DOOR[0], y1: CUT_H }, '#8A7D70', '#DCD3C7');
}

function aoStrip(ctx, P, a, b, d) {
  const pts = [[a[0], 0.002, a[1]], [b[0], 0.002, b[1]], [b[0] + d[0], 0.002, b[1] + d[1]], [a[0] + d[0], 0.002, a[1] + d[1]]];
  if (!quadPath(ctx, P, pts)) return;
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const q0 = P(m[0], 0, m[1]);
  const q1 = P(m[0] + d[0], 0, m[1] + d[1]);
  if (!q0 || !q1) return;
  const g = ctx.createLinearGradient(q0[0], q0[1], q1[0], q1[1]);
  g.addColorStop(0, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fill();
}

// Elliptical light pool on a horizontal plane.
function floorLight(ctx, P, x, z, r, rgb, a, y = 0, op = 'lighter') {
  const q = P(x, y, z);
  const qx0 = P(x - r, y, z);
  const qx1 = P(x + r, y, z);
  const qz0 = P(x, y, z - r);
  const qz1 = P(x, y, z + r);
  if (!q || !qx0 || !qx1 || !qz0 || !qz1) return;
  const rx = Math.max(Math.hypot(qx1[0] - qx0[0], qx1[1] - qx0[1]), Math.hypot(qz1[0] - qz0[0], qz1[1] - qz0[1])) / 2;
  const ry = Math.max(1, Math.max(Math.abs(qx1[1] - qx0[1]), Math.abs(qz1[1] - qz0[1])) / 2);
  if (rx < 1) return;
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.translate(q[0], q[1]);
  ctx.scale(1, Math.min(1, ry / rx));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

function wallGlow(api, P, x, y, z, r, a) {
  const q = P(x, y, z);
  if (q) api.light(q[0], q[1], r, '#FFD6A0', a);
}

function backWindow(ctx, P, [x0, x1, y0, y1]) {
  const z = HZ - 0.015;
  if (!quadPath(ctx, P, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]])) return;
  const qa = P(x0, y1, z);
  const qb = P(x0, y0, z);
  const g = ctx.createLinearGradient(qa[0], qa[1], qb[0], qb[1]);
  g.addColorStop(0, '#0B1628');
  g.addColorStop(1, '#1C3150');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,218,206,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  lineAt(ctx, P, [(x0 + x1) / 2, y0, z], [(x0 + x1) / 2, y1, z]);
  lineAt(ctx, P, [x0, (y0 + y1) / 2, z], [x1, (y0 + y1) / 2, z]);
  ctx.strokeStyle = 'rgba(226,218,206,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------- Devices ----------

function drawSensor(api, P, s, state, t, S) {
  const { ctx } = api;
  const hw = 0.17;
  const hh = 0.11;
  const pts = s.wall === 'left'
    ? [[s.x, s.y - hh, s.z - hw], [s.x, s.y - hh, s.z + hw], [s.x, s.y + hh, s.z + hw], [s.x, s.y + hh, s.z - hw]]
    : [[s.x - hw, s.y - hh, s.z], [s.x + hw, s.y - hh, s.z], [s.x + hw, s.y + hh, s.z], [s.x - hw, s.y + hh, s.z]];
  if (!quadPath(ctx, P, pts)) return;
  ctx.fillStyle = '#E4E9E8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const q = P(s.x + (s.wall === 'left' ? 0.01 : 0.07), s.y + 0.02, s.z - (s.wall === 'back' ? 0.01 : 0.07));
  if (!q) return;
  if (state === 'alert') {
    const pulse = ((t * 1.25) % 1 + 1) % 1;
    api.light(q[0], q[1], S * 26, '#FFB45A', 0.75);
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - pulse);
    ctx.strokeStyle = `rgb(${AMBER})`;
    ctx.lineWidth = Math.max(1, S * 1.4);
    ctx.beginPath();
    ctx.arc(q[0], q[1], S * (4 + 16 * pulse), 0, TAU);
    ctx.stroke();
    ctx.restore();
    api.circle(q[0], q[1], Math.max(1.2, S * 1.8), { fill: '#FFD9A6' });
  } else {
    api.light(q[0], q[1], S * 14, GREEN, 0.75);
    api.circle(q[0], q[1], Math.max(1.1, S * 1.5), { fill: `rgb(${G_HI})` });
  }
}

function drawRouter(api, P, S, t, st) {
  const { ctx } = api;
  const { x, y, z } = ROUTER;
  drawBox(ctx, P, { x0: x - 0.2, x1: x + 0.2, z0: z - 0.12, z1: z + 0.12, y0: y, y1: y + 0.07, c: '#2E3338', top: '#41474E' });
  ctx.beginPath();
  lineAt(ctx, P, [x - 0.14, y + 0.07, z + 0.1], [x - 0.18, y + 0.36, z + 0.1]);
  lineAt(ctx, P, [x + 0.14, y + 0.07, z + 0.1], [x + 0.18, y + 0.36, z + 0.1]);
  ctx.strokeStyle = '#4A5058';
  ctx.lineWidth = Math.max(1, S * 1.2);
  ctx.stroke();
  const q = P(x + 0.05, y + 0.05, z - 0.12);
  if (q) {
    const busy = st.pulses.some((p) => t - p.t0 > 0.7 && t - p.t0 < 0.95);
    api.light(q[0], q[1], S * (busy ? 18 : 10), GREEN, busy ? 0.9 : 0.55);
    api.circle(q[0], q[1], Math.max(1, S * 1.2), { fill: `rgb(${G_HI})` });
  }
}

function fanAngle(st, t) {
  // integral of the fan's speed ramp (pure function of t)
  const on = st.tOn;
  const off = st.tOff;
  const up = 0.6;
  const dn = 0.8;
  let v = 0;
  if (t > on) v += Math.min(t - on, up) ** 2 / (2 * up);
  if (t > on + up) v += Math.min(t, off) - (on + up);
  if (t > off) {
    const k = Math.min(t - off, dn);
    v += k - (k * k) / (2 * dn);
  }
  return v * 11;
}

function drawPurifier(api, P, on, st, t, S) {
  const { ctx } = api;
  drawBox(ctx, P, { x0: PUR.x0, x1: PUR.x1, z0: PUR.z0, z1: PUR.z1, y0: 0, y1: PUR.h, c: '#C5CBCC', top: '#DDE2E2' });
  // intake slots on the front face
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const y = 0.18 + k * 0.1;
    lineAt(ctx, P, [PUR.x0 + 0.08, y, PUR.z0 - 0.002], [PUR.x1 - 0.08, y, PUR.z0 - 0.002]);
  }
  ctx.strokeStyle = 'rgba(60,70,72,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // fan grille on top
  const cx = PUR_C.x;
  const cz = PUR_C.z;
  const y = PUR.h + 0.002;
  const R = 0.18;
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * TAU;
    const q = P(cx + Math.cos(a) * R, y, cz + Math.sin(a) * R);
    if (!q) return;
    if (i) ctx.lineTo(q[0], q[1]);
    else ctx.moveTo(q[0], q[1]);
  }
  ctx.closePath();
  ctx.fillStyle = '#3D4548';
  ctx.fill();
  const ang = fanAngle(st, t);
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = ang + (k / 5) * TAU;
    lineAt(ctx, P, [cx, y, cz], [cx + Math.cos(a) * R * 0.9, y, cz + Math.sin(a) * R * 0.9]);
  }
  ctx.strokeStyle = on > 0.05 ? `rgba(${G_HI},${0.5 + 0.4 * on})` : 'rgba(150,160,162,0.6)';
  ctx.lineWidth = Math.max(1, S * 1.4);
  ctx.stroke();
  const q = P(PUR.x1 - 0.06, PUR.h - 0.1, PUR.z0 - 0.002);
  if (q) {
    if (on > 0.05) api.light(q[0], q[1], S * 22, GREEN, 0.85 * on);
    api.circle(q[0], q[1], Math.max(1, S * 1.3), { fill: on > 0.05 ? `rgb(${G_HI})` : 'rgba(120,130,132,0.8)' });
  }
}

// Air drawn into the purifier and clean air rising from its top.
function drawAirflow(api, P, on, t, S) {
  if (on <= 0.02) return;
  const { ctx } = api;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.setLineDash([S * 3, S * 7]);
  ctx.lineDashOffset = -t * S * 26;
  ctx.lineWidth = Math.max(1, S * 1.3);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.4;
    const r0 = 1.25;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const rr = lerp(r0, 0.3, u);
      const aa = a + u * 1.1;
      const q = P(PUR_C.x + Math.cos(aa) * rr, lerp(1.1, 0.4, u), PUR_C.z + Math.sin(aa) * rr * 0.8);
      if (!q) continue;
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
    ctx.strokeStyle = `rgba(${G_HI},${0.32 * on})`;
    ctx.stroke();
  }
  ctx.lineDashOffset = t * S * 30;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const q = P(PUR_C.x + (k - 1) * 0.1 + Math.sin(u * 5 + k + t * 2) * 0.06, PUR.h + 0.05 + u * 1.1, PUR_C.z);
      if (!q) continue;
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
    ctx.strokeStyle = `rgba(200,240,232,${0.3 * on})`;
    ctx.stroke();
  }
  ctx.restore();
}

function drawStove(api, P, heat, S, t) {
  const { ctx } = api;
  const y = 0.925;
  for (const [bx, bz] of [[1.65, 6.55], [2.15, 6.55], [1.65, 6.82], [2.15, 6.82]]) {
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * TAU;
      const q = P(bx + Math.cos(a) * 0.12, y, bz + Math.sin(a) * 0.1);
      if (!q) return;
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
    ctx.closePath();
    const active = bx === PAN.x && bz === PAN.z;
    ctx.strokeStyle = active && heat > 0 ? `rgba(255,${Math.round(110 + 40 * heat)},60,${0.5 + 0.5 * heat})` : 'rgba(40,40,42,0.9)';
    ctx.lineWidth = Math.max(1, S * 1.6);
    ctx.stroke();
  }
  // pan and handle
  const qp = P(PAN.x, y + 0.06, PAN.z);
  if (qp) {
    if (heat > 0) api.light(qp[0], qp[1] + S * 2, S * 26, '#FF8A3D', 0.55 * heat * (0.9 + 0.1 * Math.sin(t * 9)));
    ctx.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * TAU;
      const q = P(PAN.x + Math.cos(a) * 0.15, y + 0.06, PAN.z + Math.sin(a) * 0.13);
      if (!q) return;
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
    ctx.closePath();
    ctx.fillStyle = '#22252A';
    ctx.fill();
    ctx.beginPath();
    lineAt(ctx, P, [PAN.x + 0.15, y + 0.06, PAN.z - 0.02], [PAN.x + 0.42, y + 0.08, PAN.z - 0.1]);
    ctx.strokeStyle = '#2B2E33';
    ctx.lineWidth = Math.max(1.5, S * 2);
    ctx.stroke();
  }
}

function drawFloorLamp(api, P, S) {
  const { ctx } = api;
  const x = 4.95;
  const z = 0.75;
  const a = P(x, 0, z);
  const b = P(x, 1.5, z);
  if (!a || !b) return;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = '#3A3530';
  ctx.lineWidth = Math.max(1, S * 1.4);
  ctx.stroke();
  drawBox(ctx, P, { x0: x - 0.17, x1: x + 0.17, z0: z - 0.17, z1: z + 0.17, y0: 1.42, y1: 1.7, c: '#E8D2B0', top: '#F3E3C8' });
  api.light(b[0], b[1], S * 46, '#FFD49A', 0.42);
}

// ---------- Data, cloud, HUD ----------

function pulseDot(api, a, b, lift, u, kind, S) {
  const mx = (a[0] + b[0]) / 2;
  const my = Math.min(a[1], b[1]) - lift;
  const e = ease.inOut(u);
  const x = (1 - e) * (1 - e) * a[0] + 2 * e * (1 - e) * mx + e * e * b[0];
  const y = (1 - e) * (1 - e) * a[1] + 2 * e * (1 - e) * my + e * e * b[1];
  const fade = Math.min(1, u * 6, (1 - u) * 6);
  if (kind === 'cmd') {
    api.light(x, y, S * 16, GREEN, 0.9 * fade);
    api.circle(x, y, S * 3.4, { stroke: `rgba(${G_HI},${fade})`, width: Math.max(1, S * 1.4) });
    api.circle(x, y, Math.max(1, S * 1.5), { fill: `rgba(${G_HI},${fade})` });
    return;
  }
  const col = kind === 'alert' ? '#FFB45A' : GREEN;
  api.light(x, y, S * 11, col, 0.8 * fade);
  api.circle(x, y, Math.max(1, S * 1.6), { fill: kind === 'alert' ? `rgba(255,222,180,${fade})` : `rgba(${G_HI},${fade})` });
}

function drawCloud(api, c, st, t, S) {
  const { ctx } = api;
  const lobes = [[-0.55, 0.12, 0.42], [-0.15, -0.12, 0.55], [0.32, -0.02, 0.48], [0.62, 0.16, 0.34]];
  let hit = 0;
  for (const p of st.up) {
    const d = t - (p.t0 + 1.05);
    if (d >= 0 && d < 0.5) hit = Math.max(hit, 1 - d / 0.5);
  }
  api.light(c.x, c.y, c.r * 2.4, GREEN, 0.18 + 0.25 * hit);
  ctx.save();
  ctx.lineWidth = Math.max(1.5, S * 2.4);
  ctx.strokeStyle = `rgba(${G_HI},${0.55 + 0.35 * hit})`;
  for (const [dx, dy, rr] of lobes) {
    ctx.beginPath();
    ctx.arc(c.x + dx * c.r * 1.3, c.y + dy * c.r, rr * c.r, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(c.x - c.r * 1.25, c.y + c.r * 0.08, c.r * 2.5, c.r * 0.44, c.r * 0.22);
  ctx.stroke();
  ctx.fillStyle = '#0A1A1A';
  for (const [dx, dy, rr] of lobes) {
    ctx.beginPath();
    ctx.arc(c.x + dx * c.r * 1.3, c.y + dy * c.r, rr * c.r, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.roundRect(c.x - c.r * 1.25, c.y + c.r * 0.08, c.r * 2.5, c.r * 0.44, c.r * 0.22);
  ctx.fill();
  // stacked records inside
  ctx.fillStyle = `rgba(${G_HI},${0.45 + 0.3 * hit})`;
  for (let k = 0; k < 3; k++) ctx.fillRect(c.x - c.r * 0.45, c.y - c.r * 0.12 + k * c.r * 0.16, c.r * 0.9 * (1 - k * 0.18), Math.max(1, c.r * 0.06));
  ctx.restore();
  api.text('RESEARCH CLOUD', c.x, c.y + c.r * 0.9 + api.fs(9), { size: api.fs(9), color: `rgba(${G_HI},0.85)`, align: 'center', weight: 600, spacing: 0.8 });
}

function drawHud(api, st, t, narrow, cloud) {
  const { ctx, w, h } = api;
  const compact = api.compact;
  const fsT = api.fs(9);
  const fsL = api.fs(9.5);
  const pad = Math.max(7, api.s(10));
  let x0;
  let y0;
  let pw;
  let ph;
  if (narrow) {
    x0 = Math.max(8, w * 0.035);
    pw = w * 0.8 - x0;
    ph = h * 0.31;
    y0 = h - ph - Math.max(8, h * 0.03);
  } else {
    x0 = w * 0.655;
    pw = w * 0.955 - x0;
    y0 = h * 0.37;
    ph = h * 0.46;
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, pw, ph, Math.max(4, api.s(6)));
  ctx.fillStyle = 'rgba(5,14,16,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,240,238,0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  if (!narrow && cloud) {
    api.line([[cloud.x, cloud.y + cloud.r * 0.9 + api.fs(9) * 1.6], [cloud.x, y0 - api.s(4)]], { color: 'rgba(122,236,192,0.3)', width: 1, dash: [api.s(2), api.s(4)] });
  }
  const ix = x0 + pad;
  const iw = pw - pad * 2;
  const idx = Math.min(st.pm[0].length - 1, Math.max(0, Math.floor(t * 10)));
  const kv = Math.round(st.pm[0][idx]);
  const cv = Math.round(st.pm[2][idx]);
  const sw = api.s(10);
  let ly;
  if (compact) {
    // One row: title and the two live values.
    ly = y0 + pad + fsT * 0.9;
    api.text('PM2.5', ix, ly, { size: fsT, color: `rgba(${INK},0.82)`, weight: 600, spacing: 0.6 });
    const vtxt = `child ${cv}`;
    api.text(vtxt, ix + iw, ly, { size: fsL, color: `rgba(${G_HI},0.95)`, weight: 600, align: 'right' });
    const vw = api.measure(vtxt, { size: fsL, weight: 600 });
    api.text(`kitchen ${kv}`, ix + iw - vw - api.s(14), ly, { size: fsL, color: `rgba(${AMBER},0.95)`, weight: 600, align: 'right' });
  } else {
    api.text('PM2.5 · µg/m³', ix, y0 + pad + fsT * 0.9, { size: fsT, color: `rgba(${INK},0.82)`, weight: 600, spacing: 0.6 });
    api.text('SIMULATED', x0 + pw - pad, y0 + pad + fsT * 0.9, { size: api.fs(8), color: `rgba(${INK},0.42)`, weight: 600, spacing: 0.8, align: 'right' });
    ly = y0 + pad + fsT * 1.9 + fsL * 0.9;
    api.line([[ix, ly - fsL * 0.32], [ix + sw, ly - fsL * 0.32]], { color: `rgb(${AMBER})`, width: Math.max(1.5, api.s(2)) });
    api.text(`kitchen ${kv}`, ix + sw + api.s(5), ly, { size: fsL, color: `rgba(${AMBER},0.95)`, weight: 600 });
    const lx2 = ix + iw * 0.5;
    api.line([[lx2, ly - fsL * 0.32], [lx2 + sw, ly - fsL * 0.32]], { color: `rgb(${G_HI})`, width: Math.max(1.5, api.s(2)) });
    api.text(`child's room ${cv}`, lx2 + sw + api.s(5), ly, { size: fsL, color: `rgba(${G_HI},0.95)`, weight: 600 });
  }
  // Plot.
  const px = ix;
  const pwid = iw;
  const ptop = ly + fsL * 0.9;
  const pbot = y0 + ph - pad - api.fs(8) * 1.5;
  const phgt = pbot - ptop;
  const vmax = Math.max(60, Math.ceil(st.peak[0] / 20) * 20 + 10);
  const X = (tt) => px + (tt / D) * pwid;
  const Y = (v) => pbot - (v / vmax) * phgt;
  // purifier band
  const b0 = X(st.tOn);
  const b1 = X(Math.min(D, st.tOff + 0.4));
  const bandA = seg(t, st.tOn, st.tOn + 0.3);
  if (bandA > 0) {
    ctx.fillStyle = `rgba(0,167,117,${0.13 * bandA})`;
    ctx.fillRect(b0, ptop, Math.min(X(t), b1) - b0, phgt);
    if (!compact) api.text('purifier on', b0 + api.s(4), ptop + api.fs(8) * 1.05, { size: api.fs(8), color: `rgba(${G_HI},${0.75 * bandA})` });
  }
  // axes
  api.line([[px, pbot], [px + pwid, pbot]], { color: 'rgba(232,240,238,0.3)', width: 1 });
  api.line([[px, Y(ALERT)], [px + pwid, Y(ALERT)]], { color: 'rgba(255,180,90,0.5)', width: 1, dash: [api.s(3), api.s(3)] });
  api.text('alert', px + pwid, Y(ALERT) - api.s(3), { size: api.fs(8), color: 'rgba(255,180,90,0.75)', align: 'right' });
  const ticks = narrow ? [0, 40, 80] : [0, 20, 40, 60, 80];
  for (const m of ticks) {
    const xx = X(m / MIN_PER_S);
    api.line([[xx, pbot], [xx, pbot + api.s(3)]], { color: 'rgba(232,240,238,0.3)', width: 1 });
    api.text(m === 80 ? '80 min' : String(m), Math.min(xx, px + pwid), pbot + api.fs(8) * 1.3, { size: api.fs(8), color: `rgba(${INK},0.5)`, align: m === 0 ? 'left' : m === 80 ? 'right' : 'center' });
  }
  // traces up to now
  const trace = (k, rgb) => {
    ctx.beginPath();
    const n = Math.floor(t * 10);
    for (let s = 0; s <= n && s < st.pm[k].length; s++) {
      const xx = X(s / 10);
      const yy = Y(Math.min(vmax, st.pm[k][s]));
      if (s) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.strokeStyle = `rgb(${rgb})`;
    ctx.lineWidth = Math.max(1.5, api.s(1.8));
    ctx.lineJoin = 'round';
    ctx.stroke();
    const yy = Y(Math.min(vmax, st.pm[k][idx]));
    api.circle(X(t), yy, Math.max(2, api.s(2.8)), { fill: `rgb(${rgb})` });
  };
  trace(2, G_HI);
  trace(0, AMBER);
  void wrapT;
}

// Edge darkening from four linear bands (cheaper than one full-frame radial gradient).
function vignette(ctx, w, h, rgb, a) {
  const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  const sw = w * 0.12;
  const sh = h * 0.16;
  band(0, 0, sw, 0, 0, 0, sw, h);
  band(w, 0, w - sw, 0, w - sw, 0, sw, h);
  band(0, h, 0, h - sh, 0, h - sh, w, sh);
}
