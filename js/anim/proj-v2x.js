// Vehicle-to-Everything (V2X): cinematic scene.
// A city intersection at night, seen from above. Every car (and one pedestrian's phone)
// broadcasts short safety messages, drawn as expanding orange rings that buildings
// shadow. Cars A and B approach on crossing streets with a corner tower between them, so
// neither hears the other directly. The roadside unit (RSU) on the corner pole hears A and
// relays it; B gets a cross-traffic warning seconds early, brakes, and waits while A passes.
// All values are synthetic sample data.
import { TAU, clamp, lerp, seg, ease } from './kit.js';

const D = 16; // loop length (s)

// Theme-independent palette.
const ORANGE = '#F89938';
const OR = '248,153,56';
const OR_HI = '255,210,160';
const HEAD = '255,242,222';
const TAIL = '255,58,46';
const LAMP = '#CFE0FA';
const INK = '233,238,245';

// World in metres: x east, z north, y up; the intersection is centred on the origin.
const RW = 7; // road half-width: two 3.5 m lanes each way
const WALK = 11; // outer edge of the sidewalks
const LOT = 12.5; // building line
const LANE = 1.75; // inner lane centre
const OUTER = 5.25; // outer lane centre
const EXT = { x0: -150, x1: 150, z0: -60, z1: 160 }; // drawn ground

const BUILDINGS = [
  { x0: -27, x1: -11.3, z0: 11.3, z1: 26, h: 42, tower: true }, // the corner tower between A and B
  { x0: -27, x1: -11.3, z0: 28.5, z1: 55, h: 15 },
  { x0: -66, x1: -29.5, z0: LOT, z1: 37, h: 19 },
  { x0: LOT, x1: 28, z0: LOT, z1: 30, h: 21 },
  { x0: 30.5, x1: 58, z0: LOT, z1: 26, h: 14 },
  { x0: LOT, x1: 35, z0: 32.5, z1: 60, h: 34, beacon: true },
  { x0: 37.5, x1: 66, z0: 28.5, z1: 56, h: 27 },
  { x0: -28, x1: -LOT, z0: -34, z1: -LOT, h: 9 },
  { x0: -64, x1: -30.5, z0: -28, z1: -LOT, h: 13 },
  { x0: LOT, x1: 30, z0: -29, z1: -LOT, h: 8 },
  { x0: 32.5, x1: 64, z0: -33, z1: -LOT, h: 12 },
];
const RSU = { x: -8.7, z: 8.7, h: 6.2 };
// Street lamps: [pole x, pole z, head x, head z].
const LAMPS = [
  [RSU.x, RSU.z, -6.6, 6.6], [8.7, 8.7, 6.6, 6.6], [-8.7, -8.7, -6.6, -6.6], [8.7, -8.7, 6.6, -6.6],
  [-36, -9.2, -36, -6.4], [36, 9.2, 36, 6.4], [-9.2, 36, -6.4, 36], [9.2, -34, 6.4, -34],
  [-64, 9.2, -64, 6.4], [66, -9.2, 66, -6.4], [9.2, 64, 6.4, 64],
];
const SHOPS = [[19, 11.6, 6], [-44, 11.8, 7], [46, -11.8, 6], [11.6, -21, 5], [-11.7, 42, 6], [27, -11.8, 5], [11.7, 38, 6]];
const TREES = [
  [-21, -9.9], [-46, -9.9], [21, -9.9], [47, -9.9], [-22, 9.9], [-49, 9.9], [22, 9.9], [46, 9.9],
  [9.9, 22], [9.9, 46], [-9.9, 24], [-9.9, 48], [9.9, -24], [-9.9, -25],
];

// Story kinematics (m, s). Unbraked, A and B would both reach the conflict point at TC.
const VA = 9.5;
const TC = 9.0;
const XA0 = -LANE - VA * TC; // A: eastbound, inner lane
const VB = 8; // B: southbound, inner lane
const Z_STOP = 12 + 0.4 + 2.3; // B's centre when its bumper is at the stop line
const B_ACC = 3.8;
const B_VMAX = 11;
const T_RESUME = 9.6;
const PERIOD = 1.25; // seconds between drawn broadcasts (illustrative, slower than real)
const RING = { T: 0.85, R: 54 };
const RELAY = { T: 0.95, R: 60 };
const AMB = { T: 0.75, R: 34 };
const PHONE = { T: 0.8, R: 14 };
const A_PHASE = 0.15;

// Ambient traffic, periodic over the loop. dir: +1/-1 along the axis.
const AMBIENT = [
  { axis: 'x', lane: OUTER, dir: -1, v: 12, start: 80, phase: -4.67, color: '#8E97A5' }, // westbound
  { axis: 'z', lane: OUTER, dir: 1, v: 11, start: -70, phase: 6.24, color: '#6E2630' }, // northbound
  { axis: 'x', lane: LANE, dir: -1, v: 11, start: 85, phase: 6.47, color: '#3B414B' }, // westbound
];
// Pedestrian: out of one door, across the south crosswalk, into another.
const WALKWAY = [[12.5, -15.5], [9.4, -15.5], [9.4, -9.5], [-9.4, -9.5], [-9.4, -15.5], [-12.5, -15.5]];
const PED_T0 = 0.3;
const PED_V = 2.4;

const N_RING = 84;
const RCOS = new Float32Array(N_RING + 1);
const RSIN = new Float32Array(N_RING + 1);
for (let i = 0; i <= N_RING; i++) {
  RCOS[i] = Math.cos((i / N_RING) * TAU);
  RSIN[i] = Math.sin((i / N_RING) * TAU);
}
const RX = new Float32Array(N_RING + 1);
const RY = new Float32Array(N_RING + 1);
const RV = new Uint8Array(N_RING + 1);

const wrap = (t) => ((t % D) + D) % D;

function posA(t) {
  return { x: XA0 + VA * t, z: -LANE, hd: 0, brake: 0 };
}

function posB(st, t) {
  const B = st.B;
  let z;
  let brake = 0;
  if (t <= B.tb) z = -LANE + VB * (TC - t);
  else if (t <= B.ts) {
    const u = t - B.tb;
    z = B.zb - VB * u + 0.5 * B.dec * u * u;
    brake = 1;
  } else if (t <= T_RESUME) {
    z = Z_STOP;
    brake = 1;
  } else {
    const u = t - T_RESUME;
    const ta = B_VMAX / B_ACC;
    z = u <= ta ? Z_STOP - 0.5 * B_ACC * u * u : Z_STOP - 0.5 * B_ACC * ta * ta - B_VMAX * (u - ta);
    brake = u < 0.25 ? 1 : 0;
  }
  return { x: -LANE, z, hd: -Math.PI / 2, brake };
}

function posAmbient(c, t) {
  const s = c.start + c.dir * c.v * wrap(t - c.phase);
  return c.axis === 'x'
    ? { x: s, z: c.dir < 0 ? c.lane : -c.lane, hd: c.dir > 0 ? 0 : Math.PI, brake: 0 }
    : { x: c.dir > 0 ? c.lane : -c.lane, z: s, hd: c.dir > 0 ? Math.PI / 2 : -Math.PI / 2, brake: 0 };
}

function posPed(st, t) {
  const u = wrap(t - PED_T0);
  const d = u * PED_V;
  if (d > st.walkLen) return null;
  let acc = 0;
  for (let i = 0; i < WALKWAY.length - 1; i++) {
    const [x0, z0] = WALKWAY[i];
    const [x1, z1] = WALKWAY[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (d <= acc + L) {
      const f = (d - acc) / L;
      const fade = Math.min(seg(d, 0, 1.2), 1 - seg(d, st.walkLen - 1.2, st.walkLen));
      return { x: lerp(x0, x1, f), z: lerp(z0, z1, f), hd: Math.atan2(z1 - z0, x1 - x0), a: fade, step: d };
    }
    acc += L;
  }
  return null;
}

// True when the straight path a→b passes through building footprint b (Liang–Barsky).
function entersBox(ax, az, bx, bz, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const k = q / p;
    if (p < 0) {
      if (k > t1) return false;
      if (k > t0) t0 = k;
    } else {
      if (k < t0) return false;
      if (k < t1) t1 = k;
    }
    return true;
  };
  if (!clip(-dx, ax - r.x0) || !clip(dx, r.x1 - ax) || !clip(-dz, az - r.z0) || !clip(dz, r.z1 - az)) return -1;
  return t0 < t1 ? t0 : -1;
}
function blocked(ax, az, bx, bz) {
  for (const b of BUILDINGS) {
    // quick reject on bounding boxes
    if (Math.max(ax, bx) < b.x0 || Math.min(ax, bx) > b.x1 || Math.max(az, bz) < b.z0 || Math.min(az, bz) > b.z1) continue;
    if (entersBox(ax, az, bx, bz, b) >= 0) return true;
  }
  return false;
}

function camAt(t, narrow) {
  const ph = (t / D) * TAU;
  const pitch = narrow ? 1.17 : 1.13; // radians below the horizon
  const dist = narrow ? 190 : 166;
  const yaw = 0.05 + 0.03 * Math.sin(ph + 0.4);
  const tx = (narrow ? -3 : -1) + 1.4 * Math.sin(ph);
  const tz = (narrow ? 9 : 11) + 1.1 * Math.cos(ph + 0.3);
  const hz = dist * Math.cos(pitch);
  return { x: tx - hz * Math.sin(yaw), y: dist * Math.sin(pitch), z: tz - hz * Math.cos(yaw), yaw, pitch: -pitch, f: 2 };
}

export default {
  duration: D,
  still: 5.9,
  scene: true,

  init(api) {
    const r = api.rng('v2x-scene');
    const buildings = BUILDINGS.map((b) => {
      const faces = {};
      for (const side of ['s', 'n', 'e', 'w']) {
        const len = side === 's' || side === 'n' ? b.x1 - b.x0 : b.z1 - b.z0;
        const cols = Math.max(2, Math.round(len / 3.1));
        const rows = Math.max(2, Math.round(b.h / 3.3));
        const lit = [[], [], [], []]; // warm bright, warm dim, cool bright, cool dim
        for (let c = 0; c < cols; c++) {
          for (let k = 0; k < rows; k++) {
            const p = r();
            if (p < 0.12) lit[0].push(c, k);
            else if (p < 0.24) lit[1].push(c, k);
            else if (p < 0.3) lit[2].push(c, k);
            else if (p < 0.38) lit[3].push(c, k);
          }
        }
        faces[side] = { cols, rows, lit };
      }
      const units = [];
      for (let u = r.int(1, 3); u > 0; u--) {
        const uw = r.range(2.2, 4.6);
        const ud = r.range(2, 3.8);
        units.push({ x: r.range(b.x0 + 2, b.x1 - 2 - uw), z: r.range(b.z0 + 2, b.z1 - 2 - ud), w: uw, d: ud, h: r.range(1.2, 2.6) });
      }
      const tone = r.range(0, 1);
      const roof = `rgb(${Math.round(33 + tone * 8)},${Math.round(39 + tone * 8)},${Math.round(53 + tone * 9)})`;
      return { ...b, faces, units, tone, roof };
    });

    // Road markings as ground quads [x0, z0, x1, z1].
    const white = [];
    const centre = [];
    for (let i = 0; i < 12; i++) {
      const a = -RW + 0.4 + i * 1.15;
      white.push([a, 8.2, a + 0.55, 10.8], [a, -10.8, a + 0.55, -8.2], [-10.8, a, -8.2, a + 0.55], [8.2, a, 10.8, a + 0.55]);
    }
    white.push([-RW, 11.7, 0, 12.2], [0, -12.2, RW, -11.7], [-12.2, -RW, -11.7, 0], [11.7, 0, 12.2, RW]);
    for (const sgn of [-1, 1]) {
      for (let s = 15; s < 150; s += 9) {
        const s0 = sgn * s;
        const s1 = sgn * (s + 3);
        const lo = Math.min(s0, s1);
        const hi = Math.max(s0, s1);
        for (const off of [-3.5, 3.5]) {
          white.push([lo, off - 0.08, hi, off + 0.08]); // E-W legs
          white.push([off - 0.08, lo, off + 0.08, hi]); // N-S legs
        }
      }
      const a = sgn > 0 ? 12.2 : -150;
      const b = sgn > 0 ? 150 : -12.2;
      centre.push([a, -0.32, b, -0.18], [a, 0.18, b, 0.32], [-0.32, a, -0.18, b], [0.18, a, 0.32, b]);
    }

    // B's braking plan follows from when the relayed warning reaches it.
    const rsuDist = (p) => Math.hypot(p.x - RSU.x, p.z - RSU.z);
    const aEmits = [];
    for (let e = A_PHASE; e < D; e += PERIOD) aEmits.push(e);
    let key = aEmits.find((e) => rsuDist(posA(e)) < RING.R * 0.85);
    const tHear = key + RING.T * (rsuDist(posA(key)) / RING.R);
    const tRelay = tHear + 0.1;
    let tWarn = tRelay + 0.3;
    for (let i = 0; i < 4; i++) {
      const pb = { x: -LANE, z: -LANE + VB * (TC - tWarn) };
      tWarn = tRelay + RELAY.T * (rsuDist(pb) / RELAY.R);
    }
    tWarn += 0.04;
    const tb = tWarn + 0.25;
    const zb = -LANE + VB * (TC - tb);
    const dec = (VB * VB) / (2 * (zb - Z_STOP));
    const B = { tb, zb, dec, ts: tb + VB / dec };
    const st = { buildings, white, centre, B, tHear, tRelay, tWarn, lead: TC - tWarn };

    // Every broadcast in the loop: [emit time, x, z, kind]. Rings live on the ground plane.
    const rings = [];
    const add = (fn, phase, kind, period = PERIOD) => {
      for (let e = phase; e < D; e += period) {
        const p = fn(e);
        if (!p || Math.abs(p.x) > 110 || p.z > 120 || p.z < -80) continue;
        rings.push({ e, x: p.x, z: p.z, kind });
      }
    };
    add(posA, A_PHASE, 'car');
    add((tt) => posB(st, tt), 0.95, 'car');
    AMBIENT.forEach((c, i) => add((tt) => posAmbient(c, tt), 0.2 + i * 0.37, 'amb'));
    // The RSU relays each of A's messages it hears until A has crossed.
    for (const e of aEmits) {
      const p = posA(e);
      const d = rsuDist(p);
      if (e < key || d > RING.R * 0.85 || p.x > -LANE) continue;
      rings.push({ e: e + RING.T * (d / RING.R) + 0.1, x: RSU.x, z: RSU.z, kind: e === key ? 'key' : 'relay' });
    }
    st.rings = rings;
    st.walkLen = WALKWAY.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - WALKWAY[i - 1][0], p[1] - WALKWAY[i - 1][1]) : 0), 0);
    st.trees = TREES.map(([x, z]) => ({ x, z, r: r.range(2.1, 2.9), tint: r.range(0, 1) }));
    st.key = key;
    void clamp;
    return st;
  },

  draw(api, st) {
    const { ctx, w, h, t } = api;
    const narrow = w / h < 1.6;
    const compact = api.compact;
    const cam = camAt(t, narrow);
    const P = (x, y, z) => api.project(x, y, z, cam);
    const S = api.s(1);

    // ---------- Ground ----------
    // Flat fills keep the per-frame cost low; the lamp pools and the vignette do the shading.
    ctx.fillStyle = '#0E1219';
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    groundRect(ctx, P, EXT.x0, -WALK, EXT.x1, WALK, 0);
    groundRect(ctx, P, -WALK, EXT.z0, WALK, EXT.z1, 0);
    ctx.fillStyle = '#1C222D';
    ctx.fill();
    ctx.beginPath();
    groundRect(ctx, P, EXT.x0, -RW, EXT.x1, RW, 0);
    groundRect(ctx, P, -RW, EXT.z0, RW, EXT.z1, 0);
    ctx.fillStyle = '#12161E';
    ctx.fill();
    // Wheel-worn strips, curbs.
    ctx.beginPath();
    for (const o of [-OUTER, -LANE, LANE, OUTER]) {
      for (const s of [-0.85, 0.85]) {
        groundRect(ctx, P, EXT.x0, o + s - 0.3, -RW, o + s + 0.3, 0);
        groundRect(ctx, P, RW, o + s - 0.3, EXT.x1, o + s + 0.3, 0);
        groundRect(ctx, P, o + s - 0.3, EXT.z0, o + s + 0.3, -RW, 0);
        groundRect(ctx, P, o + s - 0.3, RW, o + s + 0.3, EXT.z1, 0);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fill();
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = P(sx * RW, 0, sz > 0 ? EXT.z1 : EXT.z0);
        const b = P(sx * RW, 0, sz * RW);
        const c = P(sx * EXT.x1, 0, sz * RW);
        if (a && b && c) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.lineTo(c[0], c[1]);
        }
      }
    }
    ctx.strokeStyle = 'rgba(170,186,212,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Markings.
    ctx.beginPath();
    for (const q of st.white) groundRect(ctx, P, q[0], q[1], q[2], q[3], 0.02);
    ctx.fillStyle = 'rgba(214,222,236,0.3)';
    ctx.fill();
    ctx.beginPath();
    for (const q of st.centre) groundRect(ctx, P, q[0], q[1], q[2], q[3], 0.02);
    ctx.fillStyle = 'rgba(226,212,170,0.32)';
    ctx.fill();

    // Storefront light on the sidewalks.
    for (const [sx, sz, sr] of SHOPS) groundLight(ctx, P, sx, sz, sr, '255,226,196', 0.11);
    // Street-lamp pools (cool LED light) and their wet-asphalt reflections, additive.
    for (const [, , hx, hz] of LAMPS) {
      groundLight(ctx, P, hx, hz, 9.5, LAMP, 0.22);
      const qa = P(hx, 0, hz);
      const qm = P(hx, -8, hz);
      if (qa && qm) {
        const len = Math.max(4, qm[1] - qa[1]);
        const wd = Math.max(2, S * 5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(qm[0], qm[1] - len * 0.35);
        ctx.scale(wd / len, 1);
        const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
        rg.addColorStop(0, 'rgba(207,224,250,0.22)');
        rg.addColorStop(1, 'rgba(207,224,250,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(-len, -len, len * 2, len * 2);
        ctx.restore();
      }
    }

    // ---------- Moving things ----------
    const A = posA(t);
    const Bp = posB(st, t);
    const cars = [
      { ...A, color: '#D5D9E0', id: 'A' },
      { ...Bp, color: '#2F4D7E', id: 'B' },
      ...AMBIENT.map((c) => ({ ...posAmbient(c, t), color: c.color })),
    ].filter((c) => Math.abs(c.x) < 120 && c.z < 130 && c.z > -75);
    const ped = posPed(st, t);

    for (const c of cars) carGround(api, P, c, S);

    // Broadcast rings (additive, shadowed by buildings).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const rg of st.rings) {
      const kind = rg.kind;
      const spec = kind === 'key' || kind === 'relay' ? RELAY : kind === 'amb' ? AMB : RING;
      const age = wrap(t - rg.e);
      if (age >= spec.T) continue;
      const str = kind === 'key' ? 1.3 : kind === 'relay' ? 0.55 : kind === 'car' ? 0.95 : 0.5;
      drawRing(api, P, rg.x, rg.z, spec.R * (kind === 'relay' ? 0.78 : 1), age / spec.T, str, S, kind === 'key');
    }
    if (ped && ped.a > 0.4) {
      for (let e = 0.4; e < D; e += 1.5) {
        const age = wrap(t - e);
        if (age >= PHONE.T) continue;
        const pp = posPed(st, e);
        if (pp && pp.a > 0.5) drawRing(api, P, pp.x, pp.z, PHONE.R, age / PHONE.T, 0.6 * ped.a, S, false);
      }
    }
    ctx.restore();

    // ---------- Sorted world objects (far to near) ----------
    const items = [];
    for (const b of st.buildings) items.push({ k: b.z0, f: () => drawBuilding(api, P, cam, b, t, S) });
    for (const c of cars) items.push({ k: c.z - 2.4, f: () => drawCar(api, P, c, S, t, st) });
    for (const tr of st.trees) items.push({ k: tr.z - tr.r, f: () => drawTree(api, P, tr) });
    for (const L of LAMPS) items.push({ k: Math.min(L[1], L[3]), f: () => drawLamp(api, P, L, S) });
    items.push({ k: RSU.z - 0.1, f: () => drawRsu(api, P, st, t, S) });
    if (ped) items.push({ k: ped.z, f: () => drawPed(api, P, ped, S) });
    items.sort((a, b) => b.k - a.k);
    for (const it of items) it.f();

    // ---------- Story overlays ----------
    const qa = P(A.x, 1.5, A.z);
    const qb = P(Bp.x, 1.5, Bp.z);
    const onScreen = (q) => q && q[0] > -S * 10 && q[0] < w + S * 10 && q[1] > -S * 10 && q[1] < h + S * 10;
    const bothIn = onScreen(qa) && onScreen(qb);
    const los = bothIn ? !blocked(A.x, A.z, Bp.x, Bp.z) : null;

    // Blocked sight line between A and B.
    const losA = Math.min(seg(t, st.key - 0.6, st.key - 0.1), 1 - seg(t, st.tWarn + 1.4, st.tWarn + 1.8));
    if (bothIn && los === false && losA > 0) {
      let tHit = 1;
      for (const b of BUILDINGS) {
        const k = entersBox(A.x, A.z, Bp.x, Bp.z, b);
        if (k >= 0 && k < tHit) tHit = k;
      }
      const hx = lerp(A.x, Bp.x, tHit);
      const hz = lerp(A.z, Bp.z, tHit);
      const qh = P(hx, 1.5, hz);
      api.line([qa, qh], { color: `rgba(${INK},${0.5 * losA})`, width: Math.max(1, S * 1.2), dash: [S * 4, S * 5] });
      api.line([qh, qb], { color: `rgba(${INK},${0.16 * losA})`, width: Math.max(1, S * 1.2), dash: [S * 4, S * 5] });
      const xs = S * 5;
      api.line([[qh[0] - xs, qh[1] - xs], [qh[0] + xs, qh[1] + xs]], { color: `rgba(${INK},${0.9 * losA})`, width: S * 1.8 });
      api.line([[qh[0] - xs, qh[1] + xs], [qh[0] + xs, qh[1] - xs]], { color: `rgba(${INK},${0.9 * losA})`, width: S * 1.8 });
      if (!compact) {
        api.label('no line of sight', qh[0] - S * 12, qh[1] - S * 17, { size: api.fs(10), align: 'right', color: `rgb(${INK})`, bg: 'rgba(7,10,17,0.76)', border: 'rgba(233,238,245,0.22)', alpha: losA });
      }
    }

    // Relay path: A → RSU → B, with dashes flowing along it.
    const relA = Math.min(seg(t, st.tHear - 0.05, st.tHear + 0.25), 1 - seg(t, st.tWarn + 2.2, st.tWarn + 2.8));
    const qr = P(RSU.x, RSU.h + 0.4, RSU.z);
    if (relA > 0 && qr) {
      const arc = (p, q, lift, prog, a) => {
        if (!p || !q) return;
        const mx = (p[0] + q[0]) / 2;
        const my = Math.min(p[1], q[1]) - lift;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.setLineDash([S * 2.5, S * 4.5]);
        ctx.lineDashOffset = -t * S * 18;
        ctx.strokeStyle = `rgba(${OR},${0.85 * a})`;
        ctx.lineWidth = Math.max(1, S * 1.6);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        const n = 24;
        for (let i = 1; i <= Math.round(n * prog); i++) {
          const u = i / n;
          ctx.lineTo((1 - u) * (1 - u) * p[0] + 2 * u * (1 - u) * mx + u * u * q[0], (1 - u) * (1 - u) * p[1] + 2 * u * (1 - u) * my + u * u * q[1]);
        }
        ctx.stroke();
        ctx.restore();
      };
      arc(qa, qr, S * 18, ease.out(seg(t, st.tHear - 0.3, st.tHear)), relA);
      arc(qr, qb, S * 18, ease.out(seg(t, st.tRelay, st.tWarn)), relA);
    }
    // RSU flash when it hears A and relays.
    if (qr) {
      const fl = Math.max(0, 1 - Math.abs(t - st.tRelay) / 0.45);
      if (fl > 0) api.light(qr[0], qr[1], S * 46, ORANGE, 0.9 * ease.out(fl));
    }

    // Warning marker over B, and the brake.
    const warnA = Math.min(seg(t, st.tWarn, st.tWarn + 0.25), 1 - seg(t, T_RESUME - 0.4, T_RESUME));
    if (warnA > 0 && qb) {
      const qm = [qb[0], qb[1] - S * 30];
      const pop = 0.75 + 0.25 * ease.back(seg(t, st.tWarn, st.tWarn + 0.35));
      const sz = S * 13 * pop;
      const pulse = fractPulse(t - st.tWarn, 1.1);
      api.light(qm[0], qm[1], sz * 3.2, ORANGE, 0.55 * warnA);
      ctx.save();
      ctx.globalAlpha = warnA * (1 - pulse) * 0.7;
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = Math.max(1, S * 1.4);
      ctx.beginPath();
      ctx.arc(qm[0], qm[1] - sz * 0.15, sz * (1 + pulse * 1.4), 0, TAU);
      ctx.stroke();
      ctx.restore();
      warnSign(ctx, qm[0], qm[1], sz, warnA);
      if (!compact) {
        api.label('cross-traffic warning', qm[0] - sz * 1.5, qm[1] + sz * 0.1, { size: api.fs(10), align: 'right', color: `rgb(${OR_HI})`, bg: 'rgba(8,10,16,0.78)', border: 'rgba(248,153,56,0.5)', alpha: warnA });
      }
    }
    // Received flash on B.
    const rx = Math.max(0, 1 - Math.abs(t - st.tWarn) / 0.4);
    if (rx > 0 && qb) api.light(qb[0], qb[1], S * 34, ORANGE, 0.7 * rx);

    // Small labels.
    const tag = (str, q, dx, dy, a = 1) => {
      if (!q || a <= 0) return;
      api.label(str, q[0] + dx, q[1] + dy, { size: api.fs(9.5), color: `rgb(${INK})`, bg: 'rgba(7,10,17,0.7)', border: 'rgba(233,238,245,0.25)', alpha: a, padX: api.fs(9.5) * 0.55 });
    };
    tag('A', qa, -S * 4, -S * 19, onScreen(qa) ? 1 : 0);
    tag('B', qb, S * 20, S * 4, onScreen(qb) ? 1 : 0);
    // The RSU label steps aside once B pulls up to the corner, and returns before the loop restarts.
    const rsuA = Math.max(1 - seg(t, st.tWarn + 1.5, st.tWarn + 2.0), seg(t, D - 1, D - 0.5));
    if (qr && rsuA > 0) {
      api.text(compact ? 'RSU' : 'roadside unit', qr[0] + S * 4, qr[1] - S * 14, { size: api.fs(10), color: `rgba(${OR_HI},${0.92 * rsuA})`, align: 'center', weight: 600 });
    }
    if (ped && !compact && ped.a > 0.05) {
      const qp = P(ped.x, 2, ped.z);
      if (qp) api.text('pedestrian (V2P)', qp[0] + S * 10, qp[1] + S * 16, { size: api.fs(9.5), color: `rgba(${INK},${0.72 * ped.a})`, weight: 500 });
    }

    // ---------- Atmosphere ----------
    const fog = ctx.createLinearGradient(0, 0, 0, h * 0.36);
    fog.addColorStop(0, 'rgba(24,32,56,0.5)');
    fog.addColorStop(1, 'rgba(24,32,56,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h * 0.36);
    vignette(ctx, w, h, '0,0,0', 0.55);

    // ---------- HUD ----------
    drawHud(api, st, t, los, narrow);
  },
};

// Edge darkening from four linear bands (much cheaper than one full-frame radial gradient).
function vignette(ctx, w, h, rgb, a) {
  const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  const sw = w * 0.18;
  const sh = h * 0.22;
  band(0, 0, sw, 0, 0, 0, sw, h);
  band(w, 0, w - sw, 0, w - sw, 0, sw, h);
  band(0, h, 0, h - sh, 0, h - sh, w, sh);
  band(0, 0, 0, sh, 0, 0, w, sh);
}

function fractPulse(dt, period) {
  if (dt < 0) return 0;
  return (dt % period) / period;
}

function groundRect(ctx, P, x0, z0, x1, z1, y) {
  const a = P(x0, y, z0);
  const b = P(x1, y, z0);
  const c = P(x1, y, z1);
  const d = P(x0, y, z1);
  if (!a || !b || !c || !d) return;
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}

// Elliptical light pool on the ground plane, additive.
function groundLight(ctx, P, x, z, r, color, a) {
  const q = P(x, 0, z);
  const qx = P(x + r, 0, z);
  const qz0 = P(x, 0, z - r);
  const qz1 = P(x, 0, z + r);
  if (!q || !qx || !qz0 || !qz1) return;
  const rx = Math.abs(qx[0] - q[0]);
  const ry = Math.abs(qz0[1] - qz1[1]) / 2;
  if (rx < 1) return;
  const cv = ctx.canvas;
  const lim = Math.max(cv.width, cv.height); // device px ≥ css px, a safe bound
  if (q[0] + rx < 0 || q[1] + ry < 0 || q[0] - rx > lim || q[1] - ry > lim) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(q[0], q[1]);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  const rgb = color.startsWith('#') ? hexRgb(color) : color;
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.45, `rgba(${rgb},${a * 0.42})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function drawRing(api, P, cx, cz, R, u, str, S, key) {
  const { ctx } = api;
  const rad = R * (0.03 + 0.97 * u);
  const a = str * (1 - u * u) * Math.min(1, u * 14);
  if (a <= 0.01) return;
  for (let i = 0; i <= N_RING; i++) {
    const x = cx + RCOS[i] * rad;
    const z = cz + RSIN[i] * rad;
    const q = P(x, 0.15, z);
    if (!q) {
      RV[i] = 2;
      continue;
    }
    RX[i] = q[0];
    RY[i] = q[1];
    RV[i] = blocked(cx, cz, x, z) ? 0 : 1;
  }
  const path = (want) => {
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < N_RING; i++) {
      const ok = RV[i] !== 2 && RV[i + 1] !== 2 && (want ? RV[i] && RV[i + 1] : !(RV[i] && RV[i + 1]));
      if (ok) {
        if (!open) ctx.moveTo(RX[i], RY[i]);
        ctx.lineTo(RX[i + 1], RY[i + 1]);
        open = true;
      } else open = false;
    }
  };
  path(true);
  ctx.strokeStyle = `rgba(${OR},${0.2 * a})`;
  ctx.lineWidth = S * (key ? 9 : 6);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${OR_HI},${0.85 * a})`;
  ctx.lineWidth = Math.max(1, S * (key ? 2.2 : 1.5));
  ctx.stroke();
  path(false);
  ctx.strokeStyle = `rgba(${OR},${0.09 * a})`;
  ctx.lineWidth = Math.max(1, S * 1.2);
  ctx.stroke();
}

function carFrame(c) {
  const fx = Math.cos(c.hd);
  const fz = Math.sin(c.hd);
  // local (a forward, b right) → world
  return (a, b) => [c.x + fx * a + fz * b, c.z + fz * a - fx * b];
}

const CAR_L = 4.6;
const CAR_W = 1.9;
const OUTLINE = [[1, -0.76], [1, 0.76], [0.9, 1], [-0.92, 1], [-1, 0.84], [-1, -0.84], [-0.92, -1], [0.9, -1]];

function carGround(api, P, c, S) {
  const { ctx } = api;
  const L = CAR_L / 2;
  const W = CAR_W / 2;
  const fr = carFrame(c);
  // Soft shadow.
  ctx.beginPath();
  OUTLINE.forEach(([a, b], i) => {
    const [x, z] = fr(a * (L + 0.35), b * (W + 0.3));
    const q = P(x, 0, z);
    if (!q) return;
    if (i) ctx.lineTo(q[0], q[1]);
    else ctx.moveTo(q[0], q[1]);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  // Headlight beams.
  const f0 = P(...xyz(fr(L + 0.2, 0)));
  const f1 = P(...xyz(fr(L + 17, 0)));
  const pts = [fr(L + 0.1, -0.75), fr(L + 0.1, 0.75), fr(L + 17, 5.2), fr(L + 17, -5.2)].map((p) => P(p[0], 0.02, p[1]));
  if (f0 && f1 && pts.every(Boolean)) {
    const g = ctx.createLinearGradient(f0[0], f0[1], f1[0], f1[1]);
    g.addColorStop(0, `rgba(${HEAD},0.34)`);
    g.addColorStop(0.35, `rgba(${HEAD},0.12)`);
    g.addColorStop(1, `rgba(${HEAD},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (c.brake) {
    const [bx, bz] = fr(-L - 1.6, 0);
    groundLight(ctx, P, bx, bz, 3.6, TAIL, 0.4);
  }
}

function xyz(p) {
  return [p[0], 0.02, p[1]];
}

function drawCar(api, P, c, S, t, st) {
  const { ctx } = api;
  const L = CAR_L / 2;
  const W = CAR_W / 2;
  const fr = carFrame(c);
  const poly = (pts, y, fill) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = fr(pts[i][0], pts[i][1]);
      const q = P(x, y, z);
      if (!q) return;
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const scaled = (sa, sb) => OUTLINE.map(([a, b]) => [a * sa, b * sb]);
  poly(scaled(L, W), 0.35, shade(c.color, -0.45));
  poly(scaled(L, W), 0.95, c.color);
  // Glasshouse and roof.
  poly([[0.62, -0.78], [0.62, 0.78], [-1.3, 0.8], [-1.3, -0.8]], 1.42, '#0B1018');
  poly([[0.6, -0.72], [0.6, 0.72], [0.22, 0.74], [0.22, -0.74]], 1.44, 'rgba(120,140,175,0.5)');
  poly([[0.12, -0.7], [0.12, 0.7], [-1.05, 0.72], [-1.05, -0.72]], 1.46, shade(c.color, 0.08));
  // Lights.
  for (const b of [-0.66, 0.66]) {
    const [hx, hz] = fr(L - 0.05, b);
    const qh = P(hx, 0.75, hz);
    if (qh) {
      api.light(qh[0], qh[1], S * 7, '#FFF2DC', 0.55);
      api.circle(qh[0], qh[1], Math.max(0.8, S * 1.1), { fill: '#FFF8EC' });
    }
    const [tx, tz] = fr(-L + 0.05, b);
    const qt = P(tx, 0.8, tz);
    if (qt) {
      if (c.brake) api.light(qt[0], qt[1], S * 12, '#FF3A2E', 0.8);
      api.circle(qt[0], qt[1], Math.max(0.8, S * (c.brake ? 1.4 : 1)), { fill: c.brake ? '#FF6A5A' : 'rgba(255,58,46,0.7)' });
    }
  }
  void t;
  void st;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawBuilding(api, P, cam, b, t, S) {
  const { ctx } = api;
  const { x0, x1, z0, z1, h } = b;
  const g = [P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)];
  const r = [P(x0, h, z0), P(x1, h, z0), P(x1, h, z1), P(x0, h, z1)];
  if (g.some((q) => !q) || r.some((q) => !q)) return;
  const tone = b.tone;
  if (cam.z < z0) wall(api, g[0], g[1], r[1], r[0], b.faces.s, 1, tone);
  if (cam.z > z1) wall(api, g[2], g[3], r[3], r[2], b.faces.n, 0.7, tone);
  if (cam.x < x0) wall(api, g[3], g[0], r[0], r[3], b.faces.w, 0.82, tone);
  if (cam.x > x1) wall(api, g[1], g[2], r[2], r[1], b.faces.e, 0.82, tone);
  // Roof: lit by the sky glow, with a parapet and a crisp rim.
  poly(ctx, r);
  ctx.fillStyle = b.roof;
  ctx.fill();
  const ins = 0.9;
  const ri = [P(x0 + ins, h, z0 + ins), P(x1 - ins, h, z0 + ins), P(x1 - ins, h, z1 - ins), P(x0 + ins, h, z1 - ins)];
  if (ri.every(Boolean)) {
    poly(ctx, ri);
    ctx.fillStyle = 'rgba(4,6,10,0.28)';
    ctx.fill();
  }
  poly(ctx, r);
  ctx.strokeStyle = 'rgba(200,216,244,0.36)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Rooftop units.
  for (const u of b.units) {
    const top = [P(u.x, h + u.h, u.z), P(u.x + u.w, h + u.h, u.z), P(u.x + u.w, h + u.h, u.z + u.d), P(u.x, h + u.h, u.z + u.d)];
    const bot = [P(u.x, h, u.z), P(u.x + u.w, h, u.z)];
    if (!top.every(Boolean) || !bot.every(Boolean)) continue;
    poly(ctx, [bot[0], bot[1], top[1], top[0]]);
    ctx.fillStyle = 'rgba(14,17,25,0.95)';
    ctx.fill();
    poly(ctx, top);
    ctx.fillStyle = 'rgba(70,80,100,0.95)';
    ctx.fill();
  }
  if (b.beacon) {
    const q = P(x1 - 1, h + 0.5, z0 + 1);
    const a = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin((t / D) * TAU * 8), 3);
    if (q) {
      api.light(q[0], q[1], S * 10, '#FF4038', 0.7 * a);
      api.circle(q[0], q[1], Math.max(0.8, S * 1.1), { fill: `rgba(255,90,80,${0.5 + 0.5 * a})` });
    }
  }
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function wall(api, p00, p10, p11, p01, face, lum, tone) {
  const { ctx } = api;
  const yb = (p00[1] + p10[1]) / 2;
  const yt = (p01[1] + p11[1]) / 2;
  const gr = ctx.createLinearGradient(0, yb, 0, yt);
  const k = lum;
  gr.addColorStop(0, `rgb(${Math.round((30 + tone * 5) * k)},${Math.round((36 + tone * 5) * k)},${Math.round((50 + tone * 7) * k)})`);
  gr.addColorStop(0.25, `rgb(${Math.round((19 + tone * 4) * k)},${Math.round((23 + tone * 4) * k)},${Math.round((33 + tone * 5) * k)})`);
  gr.addColorStop(1, `rgb(${Math.round((11 + tone * 3) * k)},${Math.round((13 + tone * 3) * k)},${Math.round((20 + tone * 4) * k)})`);
  poly(ctx, [p00, p10, p11, p01]);
  ctx.fillStyle = gr;
  ctx.fill();
  const cw = Math.hypot(p10[0] - p00[0], p10[1] - p00[1]) / face.cols;
  const rh = Math.hypot(p01[0] - p00[0], p01[1] - p00[1]) / face.rows;
  if (rh > 2.5) {
    // floor lines
    ctx.beginPath();
    for (let j = 1; j < face.rows; j++) {
      bil(ctx, p00, p10, p11, p01, 0, j / face.rows, true);
      bil(ctx, p00, p10, p11, p01, 1, j / face.rows, false);
    }
    ctx.strokeStyle = 'rgba(150,172,210,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Windows, batched by colour; skipped when too small to read.
  if (cw < 2.6 || rh < 1.6) return;
  const fills = ['rgba(255,222,180,0.5)', 'rgba(255,222,180,0.2)', 'rgba(206,226,255,0.4)', 'rgba(206,226,255,0.16)'];
  for (let f = 0; f < 4; f++) {
    const list = face.lit[f];
    if (!list.length) continue;
    ctx.beginPath();
    for (let i = 0; i < list.length; i += 2) {
      const u0 = (list[i] + 0.22) / face.cols;
      const u1 = (list[i] + 0.78) / face.cols;
      const v0 = (list[i + 1] + 0.3) / face.rows;
      const v1 = (list[i + 1] + 0.78) / face.rows;
      bil(ctx, p00, p10, p11, p01, u0, v0, true);
      bil(ctx, p00, p10, p11, p01, u1, v0, false);
      bil(ctx, p00, p10, p11, p01, u1, v1, false);
      bil(ctx, p00, p10, p11, p01, u0, v1, false);
      ctx.closePath();
    }
    ctx.fillStyle = fills[f];
    ctx.fill();
  }
}

function bil(ctx, p00, p10, p11, p01, u, v, move) {
  const bx = p00[0] + (p10[0] - p00[0]) * u;
  const by = p00[1] + (p10[1] - p00[1]) * u;
  const tx = p01[0] + (p11[0] - p01[0]) * u;
  const ty = p01[1] + (p11[1] - p01[1]) * u;
  const x = bx + (tx - bx) * v;
  const y = by + (ty - by) * v;
  if (move) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}

function drawTree(api, P, tr) {
  const { ctx } = api;
  const q = P(tr.x, 5, tr.z);
  const q0 = P(tr.x, 0, tr.z);
  if (!q || !q0) return;
  const rad = tr.r * q[2];
  // shadow
  ctx.save();
  ctx.translate(q0[0], q0[1]);
  ctx.scale(1, 0.62);
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.95, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.restore();
  const g = ctx.createRadialGradient(q[0] - rad * 0.3, q[1] - rad * 0.35, rad * 0.1, q[0], q[1], rad);
  g.addColorStop(0, tr.tint > 0.5 ? '#29433D' : '#24393F');
  g.addColorStop(1, '#0B1515');
  ctx.beginPath();
  ctx.arc(q[0], q[1], rad, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawLamp(api, P, L, S) {
  const [px, pz, hx, hz] = L;
  const top = 8;
  const a = P(px, 0, pz);
  const b = P(px, top, pz);
  const c = P(hx, top, hz);
  if (!a || !b || !c) return;
  api.line([a, b, c], { color: 'rgba(120,132,152,0.65)', width: Math.max(1, S * 1.1) });
  api.light(c[0], c[1], S * 12, LAMP, 0.55);
  api.circle(c[0], c[1], Math.max(1, S * 1.6), { fill: '#EEF4FF' });
}

function drawRsu(api, P, st, t, S) {
  const q = P(RSU.x, RSU.h, RSU.z);
  if (!q) return;
  const { ctx } = api;
  const bw = S * 7;
  const bh = S * 5;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(q[0] - bw / 2, q[1] - bh / 2, bw, bh, S * 1.2);
  ctx.fillStyle = '#1B212C';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,206,150,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // antennas
  api.line([[q[0] - bw * 0.3, q[1] - bh / 2], [q[0] - bw * 0.3, q[1] - bh / 2 - S * 5]], { color: 'rgba(200,210,226,0.7)', width: 1 });
  api.line([[q[0] + bw * 0.3, q[1] - bh / 2], [q[0] + bw * 0.3, q[1] - bh / 2 - S * 5]], { color: 'rgba(200,210,226,0.7)', width: 1 });
  // status LED: slow idle breath, bright while relaying
  let tx = 0;
  for (const r of st.rings) if (r.kind === 'key' || r.kind === 'relay') tx = Math.max(tx, 1 - wrap(t - r.e) / 0.4);
  const relaying = tx > 0;
  const idle = 0.35 + 0.25 * Math.sin((t / D) * TAU * 6);
  const a = relaying ? Math.max(idle, tx) : idle;
  const q0 = P(RSU.x, 0.1, RSU.z);
  if (relaying && q0) {
    api.line([q, q0], { color: `rgba(${OR_HI},${0.8 * tx})`, width: Math.max(1, S * 1.6) });
    groundLight(ctx, P, RSU.x, RSU.z, 4.5, ORANGE, 0.5 * tx);
  }
  api.light(q[0], q[1], S * (relaying ? 22 : 10), ORANGE, 0.7 * a);
  api.circle(q[0], q[1], Math.max(1, S * 1.4), { fill: `rgba(${OR_HI},${0.6 + 0.4 * a})` });
}

function drawPed(api, P, p, S) {
  const { ctx } = api;
  if (p.a <= 0.01) return;
  const q0 = P(p.x, 0, p.z);
  const q = P(p.x, 1.5, p.z);
  const qh = P(p.x, 1.75, p.z);
  if (!q0 || !q || !qh) return;
  const sc = q[2];
  ctx.save();
  ctx.globalAlpha = p.a;
  // shadow
  ctx.beginPath();
  ctx.ellipse(q0[0], q0[1], 0.55 * sc, 0.35 * sc, 0, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  // legs (alternating stride)
  const fx = Math.cos(p.hd);
  const fz = Math.sin(p.hd);
  const swing = Math.sin(p.step * 2.6) * 0.32;
  for (const sgn of [-1, 1]) {
    const lx = p.x + fx * swing * sgn - fz * 0.12 * sgn;
    const lz = p.z + fz * swing * sgn + fx * 0.12 * sgn;
    const qa = P(lx, 0.05, lz);
    const qb = P(p.x - fz * 0.12 * sgn, 0.9, p.z + fx * 0.12 * sgn);
    if (qa && qb) api.line([qa, qb], { color: '#2A303B', width: Math.max(1, 0.18 * sc) });
  }
  // body and head
  ctx.beginPath();
  ctx.ellipse(q[0], q[1], 0.36 * sc, 0.26 * sc, -p.hd, 0, TAU);
  ctx.fillStyle = '#3A4252';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(qh[0], qh[1], 0.2 * sc, 0, TAU);
  ctx.fillStyle = '#1C2129';
  ctx.fill();
  ctx.restore();
  // phone glow
  const qp = P(p.x + fx * 0.35 + fz * 0.2, 1.25, p.z + fz * 0.35 - fx * 0.2);
  if (qp) {
    api.light(qp[0], qp[1], S * 9, ORANGE, 0.7 * p.a);
    api.circle(qp[0], qp[1], Math.max(0.8, S * 1), { fill: `rgba(${OR_HI},${p.a})` });
  }
}

function warnSign(ctx, x, y, s, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.98, y + s * 0.72);
  ctx.lineTo(x - s * 0.98, y + s * 0.72);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.22;
  ctx.strokeStyle = ORANGE;
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  ctx.fill();
  ctx.fillStyle = '#1A1006';
  ctx.beginPath();
  ctx.roundRect(x - s * 0.09, y - s * 0.48, s * 0.18, s * 0.72, s * 0.08);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + s * 0.44, s * 0.11, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawHud(api, st, t, los, narrow) {
  const { ctx, w } = api;
  const compact = api.compact;
  const fsT = api.fs(9.5);
  const fsR = api.fs(10.5);
  const endFade = 1 - seg(t, D - 1.2, D - 0.4);
  const relayOn = t >= st.tRelay && t < st.tWarn + 6;
  const warnOn = t >= st.tWarn;
  const rows = [];
  if (!compact) rows.push(['A ↔ B direct', los === null ? '—' : los ? 'clear' : 'blocked', los === false ? `rgba(${INK},0.95)` : `rgba(${INK},0.7)`, 1]);
  rows.push(['via roadside unit', relayOn ? 'A → B' : '—', relayOn ? `rgba(${OR_HI},0.95)` : `rgba(${INK},0.5)`, 1]);
  rows.push(['warning lead', warnOn ? `${st.lead.toFixed(1)} s` : '—', warnOn ? `rgba(${OR_HI},0.95)` : `rgba(${INK},0.5)`, warnOn ? endFade : 1, warnOn ? 1 - endFade : 0]);
  const lineH = fsR * 1.7;
  const padX = Math.max(8, api.s(12));
  const padY = Math.max(7, api.s(10));
  const labW = Math.max(...rows.map((r) => api.measure(r[0], { size: fsR })));
  const valW = Math.max(...rows.map((r) => api.measure(r[1], { size: fsR, weight: 600 })), api.measure('blocked', { size: fsR, weight: 600 }));
  const gap = api.s(14);
  const title = 'V2X SAFETY · SIMULATED';
  const titleW = api.measure(title, { size: fsT, weight: 600, spacing: 1 });
  const bw = Math.max(labW + gap + valW, titleW) + padX * 2;
  const bh = padY * 2 + fsT * 1.6 + rows.length * lineH;
  const x1 = narrow ? Math.max(10, api.s(14)) + bw : w - Math.max(10, api.s(20));
  const x0 = x1 - bw;
  const y0 = narrow ? api.h - bh - Math.max(10, api.s(14)) : Math.max(10, api.s(18));
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, bw, bh, Math.max(4, api.s(6)));
  ctx.fillStyle = 'rgba(6,9,15,0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(233,238,245,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  api.text(title, x0 + padX, y0 + padY + fsT * 0.95, { size: fsT, color: `rgba(${OR_HI},0.85)`, weight: 600, spacing: 1 });
  rows.forEach((r, i) => {
    const y = y0 + padY + fsT * 1.6 + lineH * (i + 0.72);
    api.text(r[0], x0 + padX, y, { size: fsR, color: `rgba(${INK},0.68)` });
    api.text(r[1], x1 - padX, y, { size: fsR, color: r[2], weight: 600, align: 'right', alpha: r[3] });
    if (r[4]) api.text('—', x1 - padX, y, { size: fsR, color: `rgba(${INK},0.5)`, weight: 600, align: 'right', alpha: r[4] });
  });
}
