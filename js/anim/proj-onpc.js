// On-Off Noise Power Communication (ONPC): cinematic scene.
// A commodity Wi-Fi radio on a knoll sends each bit as a spreading code of on/off chips:
// on = send packets, off = stay silent. The bursts carry on across a valley at dusk, long
// past where ordinary Wi-Fi frames can still be decoded. A receiver on the far ridge only
// measures noise and interference power; the on/off pattern is buried under other devices'
// traffic until correlating with the code pulls each bit out. All values are synthetic.
import { TAU, clamp, lerp, seg, ease, smooth } from './kit.js';

const D = 16; // loop length (s)
const CODE = [1, 1, 1, 0, 0, 1, 0]; // Barker-7 spreading code
const BITS = [1, 0, 1, 1, 0, 0, 1, 0];
const NCH = CODE.length * BITS.length; // chips per loop
const CHIP = D / NCH; // ≈ 0.286 s per chip
const BIT_T = CHIP * CODE.length; // 2 s per bit
const T_TR = 2.4; // drawn travel time across the valley (symbolic)
const FS = 30; // receiver power samples per second
const NS = D * FS;
const SIG = 1.3; // rise in measured power while the far radio transmits (dB, synthetic)

// Theme-independent palette.
const YEL = '#D8E022';
const Y_RGB = '216,224,34';
const Y_HI = '240,246,170';
const INK = '236,232,242';
const ICE = '200,228,255'; // other devices' interference

// World (metres, symbolic): x right, y up, z into the scene. Camera stands in the valley.
const H_CAM = 26;
const TX = { x: -102, y: 12, z: 200 };
const RX = { x: 95, y: 50, z: 250 };
const MAST_TX = 5;
const MAST_RX = 9;

const wrap = (t) => ((t % D) + D) % D;
const chipIndex = (t) => Math.floor(wrap(t) / CHIP) % NCH;
const chipOn = (k) => {
  const kk = ((k % NCH) + NCH) % NCH;
  const c = CODE[kk % CODE.length];
  return BITS[Math.floor(kk / CODE.length)] ? c : 1 - c;
};

function ridge(u, seed) {
  // sharp-crested 1D noise in 0..1
  const i = Math.floor(u);
  const f = u - i;
  const h = (n) => {
    const v = Math.sin((n + seed * 17.13) * 127.1) * 43758.5453;
    return v - Math.floor(v);
  };
  const a = h(i);
  const b = h(i + 1);
  const v = lerp(a, b, smooth(f)) * 2 - 1;
  return 1 - Math.abs(v);
}

function camAt(t, narrow) {
  const ph = (t / D) * TAU;
  return {
    x: (narrow ? -6 : 0) + 4.5 * Math.sin(ph),
    y: H_CAM + 1.2 * Math.sin(ph + 1.1),
    z: 0,
    yaw: 0.006 * Math.sin(ph + 0.5),
    pitch: narrow ? 0.125 : 0.031,
    f: narrow ? 0.7 : 1,
  };
}

export default {
  duration: D,
  still: 9.3,
  scene: true,

  init(api) {
    const r = api.rng('onpc-scene');
    // Landscape layers (far → near): [z, points], points span wider than any view.
    const layers = [];
    const prof = (z, fn, step) => {
      const pts = [];
      const span = z * 1.25 + 60;
      for (let x = -span; x <= span; x += step) pts.push([x, fn(x)]);
      return pts;
    };
    const mtn = (x, k, s) => 0.62 * ridge(x * k, s) + 0.28 * ridge(x * k * 2.3, s + 3) + 0.1 * ridge(x * k * 5.1, s + 7);
    layers.push({ z: 2300, pts: prof(2300, (x) => 150 + 330 * mtn(x + 900, 1 / 520, 1), 40), fill: ['#7B5675', '#5E4566'], rim: 0.34 });
    layers.push({ z: 980, pts: prof(980, (x) => 60 + 150 * mtn(x - 300, 1 / 260, 4), 18), fill: ['#4A3557', '#3A2B4B'], rim: 0.18 });
    // Left hills behind the knoll, rising to the left.
    layers.push({ z: 430, pts: prof(430, (x) => -10 + 95 * smooth(clamp((-x - 40) / 360)) + 14 * mtn(x, 1 / 90, 9), 10), fill: ['#2C2340', '#251D37'], rim: 0.1 });
    // The receiver's ridge on the right.
    layers.push({
      z: RX.z,
      pts: prof(RX.z, (x) => {
        const body = 36 * smooth(clamp((x + 40) / 130)) + 7 * smooth(clamp((x - 150) / 120));
        return -6 + body + 3.5 * mtn(x, 1 / 40, 12) + 2.5 * Math.exp(-Math.pow((x - RX.x) / 14, 2));
      }, 6),
      fill: ['#1F182F', '#1A152A'],
      rim: 0.12,
      flat: true,
    });
    // The transmitter's knoll on the left.
    layers.push({
      z: TX.z,
      pts: prof(TX.z, (x) => -14 + 26 * Math.exp(-Math.pow((x - TX.x) / 42, 2)) + 30 * smooth(clamp((-x - 170) / 150)) + 2.5 * mtn(x, 1 / 30, 15), 5),
      fill: ['#151125', '#120F20'],
      rim: 0.1,
      flat: true,
    });
    // Foreground meadow edge.
    layers.push({ z: 70, pts: prof(70, (x) => 6.5 + 9 * smooth(clamp((Math.abs(x + 6) - 8) / 55)) + 1.4 * mtn(x, 1 / 9, 21), 3), fill: ['#0B0914', '#07060D'], rim: 0.07, near: true, flat: true });
    const yAt = (L, x) => {
      const p = L.pts;
      const step = p[1][0] - p[0][0];
      const i = clamp(Math.floor((x - p[0][0]) / step), 0, p.length - 2);
      return lerp(p[i][1], p[i + 1][1], (x - p[i][0]) / step);
    };
    // Snap the nodes onto their terrain.
    TX.y = yAt(layers[4], TX.x);
    RX.y = yAt(layers[3], RX.x);

    // A lake on the valley floor (closed shoreline in x, z), smoothed.
    const shoreKeys = [[-190, 260], [-130, 182], [-60, 160], [0, 152], [60, 160], [125, 186], [200, 246], [235, 420], [160, 580], [60, 690], [-50, 730], [-150, 640], [-215, 470]];
    const lake = [];
    const nK = shoreKeys.length;
    for (let i = 0; i < nK; i++) {
      const a = shoreKeys[(i - 1 + nK) % nK];
      const b = shoreKeys[i];
      const c = shoreKeys[(i + 1) % nK];
      const d = shoreKeys[(i + 2) % nK];
      for (let k = 0; k < 6; k++) {
        const u = k / 6;
        const u2 = u * u;
        const u3 = u2 * u;
        // Catmull-Rom
        const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
        lake.push([cr(a[0], b[0], c[0], d[0]), cr(a[1], b[1], c[1], d[1])]);
      }
    }
    const ripples = Array.from({ length: 22 }, (_, i) => ({ z: lerp(165, 700, Math.pow(i / 21, 1.6)), x: r.range(-120, 120), len: r.range(30, 90), ph: r() * TAU }));

    // Houses: some in the valley, a cluster near the receiver (their Wi-Fi interferes there).
    const houses = [];
    const near = [[66, 0], [122, 0], [84, 0], [148, 0], [40, 0]];
    for (const [x, z] of near) houses.push({ x, z: RX.z - 2, y: Math.max(1, yAt(layers[3], x) * 0.55), nearRx: true });
    for (let i = 0; i < 14; i++) {
      const x = r.range(-80, 200);
      const z = r.range(300, 900);
      houses.push({ x, z, y: 0, nearRx: false });
    }
    houses.forEach((hh) => {
      hh.warm = r.range(0.4, 1);
      hh.ph = r() * TAU;
    });

    // Interference events (other devices' channel access), periodic over the loop.
    const events = [];
    const seedTry = (seed) => {
      const rr = api.rng(seed);
      const ev = [];
      let tt = rr.range(0, 0.6);
      while (tt < D) {
        const hi = rr.int(0, houses.length - 1);
        const h = houses[hi];
        const amp = h.nearRx ? rr.range(4.5, 11) : rr.range(0.8, 2.2);
        ev.push({ t: tt, house: hi, amp, dur: rr.range(0.04, 0.12) });
        tt += rr.range(0.35, 1.25);
      }
      // Measured power at the receiver (RX clock), sample by sample.
      const p = new Float32Array(NS);
      for (let i = 0; i < NS; i++) {
        const tau = i / FS;
        let v = 0.5 * Math.sin((tau / D) * TAU * 2 + 0.7) + 0.32 * Math.sin((tau / D) * TAU * 5 + 2.1);
        v += rr.gauss() * 0.5;
        if (chipOn(chipIndex(tau - T_TR))) v += SIG;
        p[i] = v;
      }
      for (const e of ev) {
        const i0 = Math.floor(e.t * FS);
        const n = Math.max(1, Math.round(e.dur * FS));
        for (let k = 0; k < n; k++) p[(i0 + k) % NS] += e.amp * (k === 0 ? 1 : 0.7);
      }
      // Correlate each bit (in RX time) with the code: running sums chip by chip.
      const corr = [];
      let ok = true;
      for (let b = 0; b < BITS.length; b++) {
        const tb0 = T_TR + b * BIT_T;
        // causal baseline: mean of the previous bit period
        let base = 0;
        let nb = 0;
        for (let tt2 = tb0 - BIT_T; tt2 < tb0; tt2 += 1 / FS) {
          base += p[Math.floor(wrap(tt2) * FS) % NS];
          nb++;
        }
        base /= nb;
        const sums = [0];
        let acc = 0;
        for (let j = 0; j < CODE.length; j++) {
          let m = 0;
          let n = 0;
          for (let tt2 = tb0 + j * CHIP + 0.02; tt2 < tb0 + (j + 1) * CHIP - 0.02; tt2 += 1 / FS) {
            m += p[Math.floor(wrap(tt2) * FS) % NS];
            n++;
          }
          m /= n;
          acc += (CODE[j] ? 1 : -1) * (m - base);
          sums.push(acc);
        }
        corr.push(sums);
        if ((acc > 0 ? 1 : 0) !== BITS[b] || Math.abs(acc) < 2.2) ok = false;
      }
      return { ev, p, corr, ok };
    };
    let sim = null;
    for (let s = 1; s < 60; s++) {
      sim = seedTry(`onpc-rx-${s}`);
      if (sim.ok) break;
    }
    events.push(...sim.ev);
    let cmax = 0;
    for (const c of sim.corr) cmax = Math.max(cmax, Math.abs(c[c.length - 1]));
    let pmin = Infinity;
    let pmax = -Infinity;
    for (const v of sim.p) {
      pmin = Math.min(pmin, v);
      pmax = Math.max(pmax, v);
    }

    const stars = Array.from({ length: 64 }, () => ({ x: r(), y: Math.pow(r(), 1.4) * 0.5, s: r.range(0.5, 1.3), a: r.range(0.25, 0.8), k: r.int(1, 4), ph: r() * TAU }));
    const pines = [];
    for (let i = 0; i < 9; i++) pines.push({ L: 4, x: TX.x + r.range(-60, 60), s: r.range(0.8, 1.3) });
    for (let i = 0; i < 9; i++) pines.push({ L: 3, x: RX.x + r.range(-50, 90), s: r.range(0.8, 1.3) });
    pines.forEach((pp) => {
      if (Math.abs(pp.x - (pp.L === 4 ? TX.x : RX.x)) < 7) pp.x += 14;
      pp.y = yAt(layers[pp.L], pp.x);
    });

    return { layers, lake, ripples, houses, events, p: sim.p, corr: sim.corr, cmax, pmin, pmax, stars, pines };
  },

  draw(api, st) {
    const { ctx, w, h, t } = api;
    const narrow = w / h < 1.6;
    const compact = api.compact;
    const cam = camAt(t, narrow);
    const P = (x, y, z) => api.project(x, y, z, cam);
    const S = api.s(1);
    const hz = P(cam.x, cam.y, 1e6); // horizon point
    const yH = hz ? hz[1] : h * 0.55;

    // ---------- Sky ----------
    const sky = ctx.createLinearGradient(0, 0, 0, yH);
    sky.addColorStop(0, '#0A0E25');
    sky.addColorStop(0.42, '#1E1D45');
    sky.addColorStop(0.72, '#4F3560');
    sky.addColorStop(0.9, '#9A526A');
    sky.addColorStop(1, '#DB8A6C');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, yH + 2);
    // Afterglow where the sun went down (left of centre), limited to the sky band.
    {
      const gx = w * 0.33;
      const gr = Math.max(w * 0.42, h * 0.8);
      const ag = ctx.createRadialGradient(gx, yH, 0, gx, yH, gr);
      ag.addColorStop(0, 'rgba(255,176,138,0.42)');
      ag.addColorStop(0.4, 'rgba(255,150,130,0.14)');
      ag.addColorStop(1, 'rgba(255,150,130,0)');
      ctx.fillStyle = ag;
      ctx.fillRect(Math.max(0, gx - gr), Math.max(0, yH - gr), Math.min(w, gr * 2), Math.min(yH, gr) + 2);
    }
    // Stars, slow twinkle (integer cycles per loop keep the loop seamless).
    for (const s of st.stars) {
      const y = s.y * yH;
      const fade = clamp(1 - y / (yH * 0.8));
      const tw = 0.65 + 0.35 * Math.sin((t / D) * TAU * s.k + s.ph);
      if (fade <= 0.02) continue;
      ctx.fillStyle = `rgba(240,236,255,${s.a * fade * tw})`;
      ctx.fillRect(s.x * w, y, s.s * Math.max(1, S), s.s * Math.max(1, S));
    }
    // Crescent moon, lit from the afterglow side.
    {
      const mx = w * (narrow ? 0.2 : 0.44);
      const my = h * (narrow ? 0.12 : 0.13);
      const mr = Math.max(4, S * 8);
      const d = mr * 0.78;
      const hh = Math.sqrt(mr * mr - (d * d) / 4);
      const phi = Math.atan2(hh, d / 2);
      api.light(mx, my, mr * 5, '#F6EBDD', 0.16);
      ctx.beginPath();
      ctx.arc(mx, my, mr, -phi, phi, true);
      ctx.arc(mx + d, my, mr, Math.PI - phi, Math.PI + phi, false);
      ctx.closePath();
      ctx.fillStyle = 'rgba(248,240,226,0.92)';
      ctx.fill();
    }

    // ---------- Valley floor and lake ----------
    {
      const a = P(-3000, 0, 2300);
      const b = P(3000, 0, 2300);
      const c = P(400, 0, 95);
      const d = P(-400, 0, 95);
      if (a && b && c && d) {
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(d[0], d[1]);
        ctx.closePath();
        ctx.fillStyle = '#1A1529';
        ctx.fill();
      }
      // Lake: mirrors the sky (bright toward the far shore), the ridges, and the lights.
      ctx.save();
      ctx.beginPath();
      let ok = false;
      for (const [x, z] of st.lake) {
        const q = P(x, 0, z);
        if (!q) continue;
        if (ok) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
        ok = true;
      }
      ctx.closePath();
      if (ok) {
        const lg = ctx.createLinearGradient(0, yH, 0, yH + h * 0.32);
        lg.addColorStop(0, '#C9806F');
        lg.addColorStop(0.18, '#8E4E68');
        lg.addColorStop(0.55, '#40305A');
        lg.addColorStop(1, '#1B1834');
        ctx.fillStyle = lg;
        ctx.fill();
        ctx.clip();
        // Mirrored ridges (far to near), darker than the real ones.
        for (let li = 0; li <= 4; li++) mirrorLayer(api, P, st.layers[li], li < 2 ? 0.72 : 0.6);
        // Afterglow path on the water.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(w * 0.36, yH + h * 0.05);
        ctx.scale(0.2, 1);
        const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.26);
        gp.addColorStop(0, 'rgba(255,186,150,0.5)');
        gp.addColorStop(0.5, 'rgba(255,186,150,0.16)');
        gp.addColorStop(1, 'rgba(255,186,150,0)');
        ctx.fillStyle = gp;
        ctx.fillRect(-h * 0.26, -h * 0.26, h * 0.52, h * 0.52);
        ctx.restore();
        // Ripples drifting slowly.
        ctx.lineWidth = 1;
        for (const rp of st.ripples) {
          const dx = Math.sin((t / D) * TAU + rp.ph) * 6;
          const a = P(rp.x + dx - rp.len / 2, 0, rp.z);
          const b = P(rp.x + dx + rp.len / 2, 0, rp.z);
          if (!a || !b) continue;
          ctx.strokeStyle = `rgba(255,214,200,${0.05 + 0.07 * (1 - (rp.z - 165) / 535)})`;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
        // Reflections of the lit houses on the receiver's shore.
        for (const hs of st.houses) {
          if (!hs.nearRx) continue;
          const q = P(hs.x, -hs.y - 1.5, hs.z);
          if (!q) continue;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(q[0], q[1]);
          ctx.scale(0.18, 1);
          const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 20);
          g2.addColorStop(0, 'rgba(255,200,140,0.32)');
          g2.addColorStop(1, 'rgba(255,200,140,0)');
          ctx.fillStyle = g2;
          ctx.fillRect(-S * 20, -S * 20, S * 40, S * 40);
          ctx.restore();
        }
      }
      ctx.restore();
      // Shoreline glint along the near edge.
      ctx.beginPath();
      let s3 = false;
      for (const [x, z] of st.lake) {
        if (z > 270) {
          s3 = false;
          continue;
        }
        const q = P(x, 0, z);
        if (!q) continue;
        if (s3) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
        s3 = true;
      }
      ctx.strokeStyle = 'rgba(255,200,180,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Luminous mist lying on the far part of the lake.
    {
      const q = P(0, 0, 640);
      if (q) {
        const mh = Math.max(6, api.s(30));
        const drift = Math.sin((t / D) * TAU) * S * 8;
        const mg = ctx.createLinearGradient(0, q[1] - mh, 0, q[1] + mh * 0.8);
        mg.addColorStop(0, 'rgba(230,160,160,0)');
        mg.addColorStop(0.55, 'rgba(230,160,160,0.22)');
        mg.addColorStop(1, 'rgba(230,160,160,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(drift - S * 10, q[1] - mh, w + S * 20, mh * 1.8);
      }
    }
    // Valley houses (lights) before the ridges hide the far ones.
    for (const hs of st.houses) if (!hs.nearRx) drawHouse(api, P, hs, t, S);

    // Wi-Fi range edge on the valley floor: a dashed arc around the transmitter.
    const rangeR = Math.hypot(-33 - TX.x, 217.5 - TX.z);
    {
      ctx.save();
      ctx.beginPath();
      let first = true;
      const a0 = Math.atan2(RX.z - TX.z, RX.x - TX.x);
      for (let a = a0 - 0.55; a <= a0 + 0.6; a += 0.03) {
        const x = TX.x + Math.cos(a) * rangeR;
        const z = TX.z + Math.sin(a) * rangeR;
        if (z < 100) {
          first = true;
          continue;
        }
        const q = P(x, 0.2, z);
        if (!q) continue;
        if (first) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
        first = false;
      }
      ctx.setLineDash([S * 4, S * 5]);
      ctx.strokeStyle = 'rgba(236,232,242,0.28)';
      ctx.lineWidth = Math.max(1, S * 1.1);
      ctx.stroke();
      ctx.restore();
    }

    // ---------- Terrain layers, with mist between them ----------
    for (let i = 0; i < st.layers.length; i++) {
      const L = st.layers[i];
      drawLayer(api, P, L, h);
      if (i === 1) mist(api, P, 980, 'rgba(150,110,150,0.2)', S, t);
      if (i === 2) mist(api, P, 430, 'rgba(120,90,140,0.16)', S, t);
      if (i === 3) {
        for (const hs of st.houses) if (hs.nearRx) drawHouse(api, P, hs, t, S);
        for (const pn of st.pines) if (pn.L === 3) pine(api, P, pn, L.z);
      }
      if (i === 4) for (const pn of st.pines) if (pn.L === 4) pine(api, P, pn, L.z);
    }

    // Interference blips from other devices (cool white, quick).
    for (const e of st.events) {
      const age = wrap(t - e.t);
      if (age > 0.55) continue;
      const hs = st.houses[e.house];
      const q = P(hs.x, hs.y + 3, hs.z);
      if (!q) continue;
      const u = age / 0.55;
      const a = (1 - u) * (hs.nearRx ? 0.9 : 0.45);
      api.light(q[0], q[1], S * (hs.nearRx ? 16 : 9), '#C8E4FF', a * 0.8);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(q[0], q[1], S * (2 + 13 * u) * (hs.nearRx ? 1 : 0.6), 0, TAU);
      ctx.strokeStyle = `rgba(${ICE},${a * 0.45})`;
      ctx.lineWidth = Math.max(1, S * 1.1);
      ctx.stroke();
      ctx.restore();
    }

    // ---------- The link ----------
    const p0 = [TX.x, TX.y + MAST_TX, TX.z];
    const p2 = [RX.x, RX.y + MAST_RX, RX.z];
    const p1 = [(p0[0] + p2[0]) / 2, Math.max(p0[1], p2[1]) + 46, (p0[2] + p2[2]) / 2];
    const at = (s) => {
      const a = (1 - s) * (1 - s);
      const b = 2 * s * (1 - s);
      const c = s * s;
      return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], a * p0[2] + b * p1[2] + c * p2[2]];
    };
    // Path parameter where the ground track crosses the range edge.
    let sRange = 0.35;
    for (let s = 0; s <= 1; s += 0.005) {
      const q = at(s);
      if (Math.hypot(q[0] - TX.x, q[2] - TX.z) >= rangeR) {
        sRange = s;
        break;
      }
    }
    // Faint guide along the path.
    {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const q3 = at(i / 48);
        const q = P(q3[0], q3[1], q3[2]);
        if (!q) continue;
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      }
      ctx.save();
      ctx.setLineDash([S * 1.5, S * 6]);
      ctx.strokeStyle = 'rgba(216,224,34,0.22)';
      ctx.lineWidth = Math.max(1, S * 1.2);
      ctx.stroke();
      ctx.restore();
    }
    // Vertical marker where ordinary Wi-Fi gives out.
    const gm = at(sRange);
    const qg = P(gm[0], 0, gm[2]);
    const qgTop = P(gm[0], gm[1] + 6, gm[2]);
    if (qg && qgTop) {
      api.line([qg, qgTop], { color: 'rgba(236,232,242,0.4)', width: Math.max(1, S), dash: [S * 2, S * 3] });
      // post with a small lamp
      api.line([qg, [qg[0], qg[1] - S * 9]], { color: 'rgba(236,232,242,0.85)', width: Math.max(1, S * 1.6) });
      api.circle(qg[0], qg[1] - S * 9, Math.max(1.2, S * 1.6), { fill: '#F2EEF6' });
      api.light(qg[0], qg[1] - S * 9, S * 10, '#F2EEF6', 0.35);
      const lab = compact ? 'Wi-Fi range' : 'standard Wi-Fi range';
      api.label(lab, qg[0], qg[1] + S * 13, { size: api.fs(10), color: `rgb(${INK})`, bg: 'rgba(14,10,24,0.72)', border: 'rgba(236,232,242,0.25)' });
      if (!compact) {
        const qe = P(...at(Math.min(0.75, sRange + 0.22)));
        if (qe) api.text('energy still measurable', qe[0], qe[1] + S * 30, { size: api.fs(10), color: `rgba(${Y_HI},0.85)`, align: 'center', weight: 600 });
      }
    }

    // Bursts in flight. Chip k leaves the transmitter during [k·CHIP, (k+1)·CHIP].
    const kNow = Math.floor(t / CHIP);
    const kOld = Math.floor((t - T_TR) / CHIP) - 1;
    for (let k = kOld; k <= kNow; k++) {
      if (!chipOn(k)) continue;
      const tLead = k * CHIP;
      for (let j = 0; j < 4; j++) {
        const tEmit = tLead + CHIP * (0.1 + j * 0.2);
        const s = (t - tEmit) / T_TR;
        if (s < 0 || s > 1) continue;
        const q3 = at(s);
        const q = P(q3[0], q3[1], q3[2]);
        if (!q) continue;
        const loss = Math.max(0.3, 1 / (1 + Math.pow(s / 0.34, 2)));
        const crisp = 1 - smooth(seg(s, sRange - 0.02, sRange + 0.06));
        const qn = P(...at(Math.min(1, s + 0.01)));
        const ang = qn ? Math.atan2(qn[1] - q[1], qn[0] - q[0]) : 0;
        const arrive = 1 - seg(s, 0.93, 1);
        if (crisp > 0.01) {
          // a decodable Wi-Fi frame: small crisp packet
          ctx.save();
          ctx.translate(q[0], q[1]);
          ctx.rotate(ang);
          ctx.globalAlpha = crisp * arrive;
          const pw = S * 7;
          const ph = S * 3.4;
          ctx.fillStyle = `rgba(${Y_RGB},0.95)`;
          ctx.beginPath();
          ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph * 0.3);
          ctx.fill();
          ctx.fillStyle = 'rgba(30,26,8,0.55)';
          ctx.fillRect(-pw / 2 + pw * 0.62, -ph / 2 + ph * 0.25, pw * 0.08, ph * 0.5);
          ctx.restore();
          api.light(q[0], q[1], S * 12, YEL, 0.35 * crisp * loss * arrive);
        }
        if (crisp < 0.99) {
          // past the range edge: only raw energy, fainter with distance
          const a = (1 - crisp) * loss * arrive;
          api.light(q[0], q[1], S * 13, YEL, 0.7 * a);
          api.circle(q[0], q[1], Math.max(1, S * 1.5), { fill: `rgba(${Y_HI},${0.85 * a})` });
        }
      }
    }

    if (!compact) {
      const hq = P(118, st.houses[1].y + 4, RX.z - 2);
      if (hq) api.text('other Wi-Fi devices', hq[0], hq[1] + S * 30, { size: api.fs(9.5), color: `rgba(${ICE},0.7)`, align: 'center' });
    }
    // Nodes.
    const onNow = chipOn(kNow);
    drawTx(api, P, onNow, S, t);
    const kRx = Math.floor((t - T_TR) / CHIP);
    drawRx(api, P, chipOn(kRx), S, t, st);

    // ---------- Vignette ----------
    vignette(ctx, w, h, '4,2,10', 0.5);

    // ---------- HUD ----------
    const rb = drawRxHud(api, st, t, narrow);
    const rtop = P(RX.x, RX.y + MAST_RX + 2, RX.z);
    if (rb && rtop && rtop[1] > rb.y + rb.h + S * 8) {
      api.line([[rtop[0], rb.y + rb.h + S * 2], [rtop[0], rtop[1] - S * 9]], { color: 'rgba(216,224,34,0.35)', width: 1, dash: [S * 2, S * 3] });
    }
    if (!compact) drawTxHud(api, t, narrow);
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
  const sw = w * 0.2;
  const sh = h * 0.24;
  band(0, 0, sw, 0, 0, 0, sw, h);
  band(w, 0, w - sw, 0, w - sw, 0, sw, h);
  band(0, h, 0, h - sh, 0, h - sh, w, sh);
  band(0, 0, 0, sh * 0.8, 0, 0, w, sh * 0.8);
}

function drawLayer(api, P, L, h) {
  const { ctx } = api;
  const pts = L.pts;
  let top = Infinity;
  ctx.beginPath();
  let started = false;
  let first = null;
  let last = null;
  for (let i = 0; i < pts.length; i++) {
    const q = P(pts[i][0], L.near ? pts[i][1] : Math.max(0, pts[i][1]), L.z);
    if (!q) continue;
    if (!started) {
      ctx.moveTo(q[0], q[1]);
      started = true;
      first = q;
    } else ctx.lineTo(q[0], q[1]);
    last = q;
    if (q[1] < top) top = q[1];
  }
  if (!started) return;
  // Close down to the layer's own foot (y = 0) so it never covers nearer ground.
  const baseY = L.near ? h + 2 : (P(0, 0, L.z) || [0, h])[1];
  ctx.lineTo(last[0], baseY);
  ctx.lineTo(first[0], baseY);
  ctx.closePath();
  if (L.flat) ctx.fillStyle = L.fill[0];
  else {
    const g = ctx.createLinearGradient(0, top, 0, baseY);
    g.addColorStop(0, L.fill[0]);
    g.addColorStop(1, L.fill[1]);
    ctx.fillStyle = g;
  }
  ctx.fill();
  // Backlit crest.
  if (L.rim > 0) {
    ctx.beginPath();
    let s2 = false;
    for (let i = 0; i < pts.length; i++) {
      if (!L.near && pts[i][1] < 0.5) {
        s2 = false;
        continue;
      }
      const q = P(pts[i][0], pts[i][1], L.z);
      if (!q) continue;
      if (!s2) {
        ctx.moveTo(q[0], q[1]);
        s2 = true;
      } else ctx.lineTo(q[0], q[1]);
    }
    ctx.strokeStyle = `rgba(255,190,160,${L.rim})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function mirrorLayer(api, P, L, alpha) {
  const { ctx } = api;
  ctx.beginPath();
  let first = null;
  let last = null;
  let bottom = -Infinity;
  for (const [x, y] of L.pts) {
    const q = P(x, -Math.max(0, y), L.z);
    if (!q) continue;
    if (!first) {
      ctx.moveTo(q[0], q[1]);
      first = q;
    } else ctx.lineTo(q[0], q[1]);
    last = q;
    if (q[1] > bottom) bottom = q[1];
  }
  if (!first) return;
  const base = P(0, 0, L.z);
  ctx.lineTo(last[0], base[1]);
  ctx.lineTo(first[0], base[1]);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  if (L.flat || L.z < 500) ctx.fillStyle = L.fill[1];
  else {
    const g = ctx.createLinearGradient(0, base[1], 0, bottom);
    g.addColorStop(0, L.fill[1]);
    g.addColorStop(1, L.fill[0]);
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}

function mist(api, P, z, color, S, t) {
  const { ctx, w } = api;
  const q = P(0, 0, z);
  if (!q) return;
  const y = q[1];
  const hh = S * 26;
  const drift = Math.sin((t / D) * TAU) * S * 6;
  const g = ctx.createLinearGradient(0, y - hh, 0, y + hh * 0.4);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-S * 10 + drift, y - hh, w + S * 20, hh * 1.4);
}

function pine(api, P, pn, z) {
  const { ctx } = api;
  const b = P(pn.x, pn.y - 0.5, z);
  const tp = P(pn.x, pn.y + 9 * pn.s, z);
  if (!b || !tp) return;
  const hh = b[1] - tp[1];
  const wd = hh * 0.32;
  ctx.beginPath();
  ctx.moveTo(tp[0], tp[1]);
  ctx.lineTo(b[0] + wd, b[1]);
  ctx.lineTo(b[0] - wd, b[1]);
  ctx.closePath();
  ctx.fillStyle = '#0D0A17';
  ctx.fill();
}

function drawHouse(api, P, hs, t, S) {
  const q = P(hs.x, hs.y + 1.5, hs.z);
  if (!q) return;
  const flick = 0.85 + 0.15 * Math.sin((t / D) * TAU * 3 + hs.ph);
  const a = hs.warm * flick * (hs.nearRx ? 0.95 : 0.7);
  api.light(q[0], q[1], S * (hs.nearRx ? 7 : 5), '#FFC98C', 0.45 * a);
  api.ctx.fillStyle = `rgba(255,214,160,${0.9 * a})`;
  const sz = Math.max(1, S * (hs.nearRx ? 1.6 : 1.1));
  api.ctx.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz);
}

function drawTx(api, P, on, S, t) {
  const g = P(TX.x, TX.y, TX.z);
  const top = P(TX.x, TX.y + MAST_TX, TX.z);
  if (!g || !top) return;
  const { ctx } = api;
  api.line([g, top], { color: 'rgba(170,160,190,0.8)', width: Math.max(1, S * 1.3) });
  const bw = S * 8;
  const bh = S * 5.5;
  ctx.beginPath();
  ctx.roundRect(top[0] - bw / 2, top[1] - bh, bw, bh, S * 1.3);
  ctx.fillStyle = '#231E33';
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,224,34,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  api.line([[top[0] + bw * 0.3, top[1] - bh], [top[0] + bw * 0.3, top[1] - bh - S * 7]], { color: 'rgba(200,196,214,0.8)', width: Math.max(1, S) });
  const led = [top[0] - bw * 0.18, top[1] - bh / 2];
  if (on) api.light(led[0], led[1], S * 26, YEL, 0.75);
  api.circle(led[0], led[1], Math.max(1.2, S * 1.6), { fill: on ? '#F4F8B8' : 'rgba(216,224,34,0.25)' });
  void t;
}

function drawRx(api, P, energy, S, t, st) {
  const g = P(RX.x, RX.y, RX.z);
  const top = P(RX.x, RX.y + MAST_RX, RX.z);
  if (!g || !top) return;
  const { ctx } = api;
  api.line([g, top], { color: 'rgba(170,160,190,0.85)', width: Math.max(1, S * 1.3) });
  // antenna cross-bar and box
  api.line([[top[0] - S * 6, top[1]], [top[0] + S * 6, top[1]]], { color: 'rgba(200,196,214,0.85)', width: Math.max(1, S * 1.2) });
  const bw = S * 7;
  const bh = S * 5;
  ctx.beginPath();
  ctx.roundRect(top[0] - bw / 2, top[1] + S * 3, bw, bh, S * 1.2);
  ctx.fillStyle = '#231E33';
  ctx.fill();
  ctx.strokeStyle = 'rgba(216,224,34,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // a soft glow while energy arrives; a pulse when a bit is decoded
  if (energy) api.light(top[0], top[1], S * 14, YEL, 0.25);
  const sinceBit = wrap(t - T_TR) % BIT_T;
  const pulse = 1 - seg(sinceBit, 0, 0.6);
  if (pulse > 0) api.light(top[0], top[1] + S * 5, S * 30, YEL, 0.7 * pulse);
  api.circle(top[0], top[1] + S * 3 + bh / 2, Math.max(1.2, S * 1.4), { fill: `rgba(${Y_HI},${0.5 + 0.5 * pulse})` });
  void st;
}

function drawRxHud(api, st, t, narrow) {
  const { ctx, w, h } = api;
  const compact = api.compact;
  const fsT = api.fs(9);
  const pad = Math.max(7, api.s(9));
  const pw = narrow ? w * 0.62 : w * 0.3;
  const x0 = w - pw - Math.max(8, api.s(narrow ? 10 : 18));
  const y0 = Math.max(8, api.s(narrow ? 10 : 14));
  const titleH = fsT * 1.75;
  const traceH = h * 0.11;
  const codeH = Math.max(5, api.s(6));
  const corrH = h * 0.065;
  const fsB = api.fs(10.5);
  const bitsH = fsB * 1.75;
  const ph = pad * 2 + titleH + traceH + codeH + api.s(4) + corrH + bitsH;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0, y0, pw, ph, Math.max(4, api.s(6)));
  ctx.fillStyle = 'rgba(12,9,22,0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(236,232,242,0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  const ix = x0 + pad;
  const iw = pw - pad * 2;
  const box = { x: x0, y: y0, w: pw, h: ph };
  api.text('RX · NOISE POWER', ix, y0 + pad + fsT * 0.9, { size: fsT, color: `rgba(${INK},0.82)`, weight: 600, spacing: 0.8 });
  api.text('SIMULATED', x0 + pw - pad, y0 + pad + fsT * 0.9, { size: api.fs(8), color: `rgba(${INK},0.42)`, weight: 600, spacing: 0.8, align: 'right' });

  // Rolling window in receiver time; "now" is the right edge.
  const win = narrow ? 1.5 * BIT_T : 2.2 * BIT_T;
  const ty = y0 + pad + titleH;
  const tx = (tau) => ix + ((tau - (t - win)) / win) * iw;
  const codeY = ty + traceH + api.s(2);
  const cy = codeY + codeH + api.s(4) + corrH / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ix, ty - 1, iw, traceH + codeH + corrH + api.s(8));
  ctx.clip();
  // Chips: faint tint where the code is 1, the code as a thin timing strip, bit boundaries.
  const k0 = Math.floor((t - win - T_TR) / CHIP) - 1;
  const k1 = Math.floor((t - T_TR) / CHIP);
  ctx.beginPath();
  let started = false;
  for (let k = k0; k <= k1; k++) {
    const kk = ((k % NCH) + NCH) % NCH;
    const a = T_TR + k * CHIP;
    const xa = tx(a);
    const xb = Math.min(tx(a + CHIP), tx(t));
    if (xb <= xa) continue;
    const c = CODE[kk % CODE.length];
    const yy = c ? codeY : codeY + codeH;
    if (!started) {
      ctx.moveTo(xa, yy);
      started = true;
    } else ctx.lineTo(xa, yy);
    ctx.lineTo(xb, yy);
    if (kk % CODE.length === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(236,232,242,0.22)';
      ctx.fillRect(xa, ty, 1, traceH + codeH + corrH + api.s(6));
      ctx.restore();
    }
  }
  ctx.strokeStyle = 'rgba(216,224,34,0.75)';
  ctx.lineWidth = Math.max(1, api.s(1));
  ctx.stroke();
  // Power trace. The scale covers the noise floor and the small on/off steps; strong
  // interference spikes run off the top.
  const n = Math.ceil(win * FS);
  const lo = st.pmin + 0.4;
  const hi = lo + 6.2;
  const py = (v) => ty + traceH - clamp((v - lo) / (hi - lo), 0, 1) * traceH;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const tau = t - win + (i / n) * win;
    const v = st.p[Math.floor(wrap(tau) * FS) % NS];
    const x = tx(tau);
    if (i) ctx.lineTo(x, py(v));
    else ctx.moveTo(x, py(v));
  }
  ctx.strokeStyle = `rgba(${INK},0.88)`;
  ctx.lineWidth = Math.max(1, api.s(1.1));
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Correlation per bit: running sum as chips arrive; its sign is the bit.
  ctx.fillStyle = 'rgba(236,232,242,0.18)';
  ctx.fillRect(ix, cy, iw, 1);
  const b0 = Math.floor((t - win - T_TR) / BIT_T) - 1;
  const b1 = Math.floor((t - T_TR) / BIT_T);
  const bwid = (iw / (win / BIT_T)) * 0.3;
  for (let b = b0; b <= b1; b++) {
    const bb = ((b % BITS.length) + BITS.length) % BITS.length;
    const start = T_TR + b * BIT_T;
    const done = clamp((t - start) / CHIP, 0, CODE.length);
    const j = Math.floor(done);
    const sums = st.corr[bb];
    const v = j >= CODE.length ? sums[CODE.length] : lerp(sums[j], sums[j + 1], done - j);
    const bh = (v / st.cmax) * corrH * 0.48;
    const xc = tx(start + BIT_T / 2);
    const complete = t >= start + BIT_T;
    ctx.fillStyle = complete ? YEL : 'rgba(216,224,34,0.5)';
    ctx.fillRect(xc - bwid / 2, Math.min(cy, cy - bh), bwid, Math.max(1, Math.abs(bh)));
    if (complete) {
      const a = ease.out(seg(t, start + BIT_T, start + BIT_T + 0.3));
      api.text(String(BITS[bb]), xc + bwid / 2 + api.s(5), cy + (bh > 0 ? -1 : 1) * corrH * 0.22 + fsB * 0.36, { size: fsB, color: `rgba(${Y_HI},${a})`, weight: 700 });
    }
  }
  ctx.restore();
  if (!compact) {
    haloText(api, 'code', ix + api.s(3), codeY + codeH * 0.5 + api.fs(8) * 0.36, api.fs(8), 'rgba(216,224,34,0.9)');
    haloText(api, 'correlation', ix + api.s(3), cy - corrH / 2 + api.fs(8) * 0.95, api.fs(8), `rgba(${INK},0.6)`);
  }
  // Decoded bits register: the last eight; the newest pops in at the right.
  const by = cy + corrH / 2 + bitsH * 0.72;
  api.text('DECODED', ix, by, { size: fsT, color: `rgba(${INK},0.6)`, weight: 600, spacing: 0.8 });
  const nDone = Math.floor((t - T_TR) / BIT_T);
  const cw = api.measure('0', { size: fsB, weight: 700 }) * 1.75;
  const xr = x0 + pw - pad;
  const pop = ease.out(seg(t - T_TR - nDone * BIT_T, 0, 0.35));
  for (let i = 0; i < 8; i++) {
    const b = nDone - 1 - i;
    const bb = ((b % BITS.length) + BITS.length) % BITS.length;
    const x = xr - (i + (1 - pop)) * cw;
    const a = i === 0 ? pop : i === 7 ? 1 - pop : 1;
    api.text(String(BITS[bb]), x, by, { size: fsB, color: i === 0 ? `rgba(${Y_HI},${a})` : `rgba(${Y_RGB},${0.85 * a})`, weight: 700, align: 'right' });
  }
  return box;
}

function haloText(api, str, x, y, size, color) {
  const { ctx } = api;
  ctx.save();
  ctx.font = api.font(size, { weight: 600 });
  ctx.lineWidth = Math.max(2, size * 0.35);
  ctx.strokeStyle = 'rgba(12,9,22,0.95)';
  ctx.lineJoin = 'round';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawTxHud(api, t, narrow) {
  const { w, h } = api;
  const fsT = api.fs(9.5);
  const k = Math.floor(wrap(t) / CHIP) % NCH;
  const bit = BITS[Math.floor(k / CODE.length)];
  const j = k % CODE.length;
  const x0 = Math.max(10, api.s(narrow ? 12 : 22));
  const cell = api.s(13);
  const gap = api.s(4);
  const yb = h - Math.max(12, api.s(22));
  const yc = yb - api.fs(9.5) * 1.6 - cell;
  const yt = yc - api.s(8);
  api.text('SENDING BIT', x0, yt, { size: fsT, color: `rgba(${INK},0.72)`, weight: 600, spacing: 0.8 });
  api.text(String(bit), x0 + api.measure('SENDING BIT ', { size: fsT, weight: 600, spacing: 0.8 }) + api.s(4), yt + api.s(1), { size: api.fs(12), color: `rgb(${Y_HI})`, weight: 700 });
  for (let i = 0; i < CODE.length; i++) {
    const on = bit ? CODE[i] : 1 - CODE[i];
    const x = x0 + i * (cell + gap);
    const cur = i === j;
    api.rect(x, yc, cell, cell, { fill: on ? (cur ? YEL : 'rgba(216,224,34,0.6)') : 'rgba(0,0,0,0)', stroke: cur ? `rgb(${Y_HI})` : 'rgba(236,232,242,0.35)', width: 1, r: api.s(2) });
  }
  api.text('on = send packets · off = silent', x0, yb, { size: api.fs(9.5), color: `rgba(${INK},0.6)` });
  void w;
}
