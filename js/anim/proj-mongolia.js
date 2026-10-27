// Mongolian Ger Air Quality Measurement and Analysis: cinematic scene.
// A winter night at the edge of Ulaanbaatar. Two gers stand side by side: the left is
// heated by a coal stove (smoke from the chimney, dense particles inside), the right has
// been insulated and runs on electricity (sparse particles). Low-cost sensors inside and
// outside each ger stream PM2.5 readings to a live chart. Once per loop the right ger's
// door opens and the dirtier night air outside pours in, spiking its indoor reading, as
// the study observed. The chart's numbers are synthetic; the footnote quotes the study.
import { TAU, clamp, lerp, seg, ease, fract, smooth } from './kit.js';

const D = 16;
const N = 320; // samples of the synthetic PM2.5 series over one loop
const WIN = 9; // seconds of history shown in the chart
const DOOR = [8.0, 8.5, 9.4, 9.9]; // opening, open, closing, closed
const PKT = 1.6; // seconds between readings per sensor
const RATIO = 0.52; // retrofit mean / coal mean, matching the study's 48% reduction

// Theme-independent colours.
const SKY = ['#070B16', '#0D1424', '#1C2233', '#3A3433'];
const LIME = [140, 206, 86];
const LIME_HI = [196, 236, 156];
const EMBER = [240, 146, 76];
const COOL = [176, 194, 218];
const INK = 'rgba(230,236,244,0.9)';
const INK_DIM = 'rgba(214,222,234,0.72)';
const FELT = [178, 184, 198];
const DOOR_C = [176, 92, 44]; // painted wood, orange
const POLE = [190, 98, 52]; // orange-painted roof poles and pillars

const col = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const wrap = (x) => ((x % D) + D) % D;
// A spike that rises in ~rise seconds and decays with time constant tau (0 before it starts).
const spike = (x, rise, tau) => (x < 0 ? 0 : (1 - Math.exp(-x / rise)) * Math.exp(-x / tau));

export default {
  duration: D,
  still: 9.3,
  scene: true,

  init(api) {
    const r = api.rng('mongolia-scene');
    // Synthetic PM2.5 (µg/m³), periodic over the loop.
    const outside = new Float32Array(N);
    const coal = new Float32Array(N);
    const retro = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * D;
      const th = (TAU * t) / D;
      outside[i] = 236 + 14 * Math.sin(th + 0.7) + 8 * Math.sin(3 * th + 1.9) + 5 * Math.sin(7 * th + 0.3) + 3 * Math.sin(13 * th + 2);
      coal[i] = 150 + 9 * Math.sin(2 * th + 0.4) + 6 * Math.sin(5 * th + 2.2) + 4 * Math.sin(11 * th) + 70 * spike(wrap(t - 2.2), 0.35, 2.4);
      retro[i] = 4 * Math.sin(2 * th + 1.1) + 3 * Math.sin(5 * th + 0.2) + 2 * Math.sin(9 * th + 1.7) + 150 * spike(wrap(t - DOOR[0] - 0.25), 0.5, 1.9);
    }
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const base = RATIO * mean(coal) - mean(retro);
    for (let i = 0; i < N; i++) retro[i] += base;

    const flakes = Array.from({ length: 170 }, () => ({ x: r(), ph: r(), n: 2 + r.int(0, 2), s: r.range(0.5, 1.3), sw: r() * TAU, z: r() }));
    const stars = Array.from({ length: 40 }, () => ({ x: r(), y: r() * 0.4, b: r.range(0.2, 0.8) }));
    // City at the horizon: apartment blocks with lit windows.
    const blocks = [];
    for (let x = 0.0; x < 1.04; ) {
      const bw = r.range(0.018, 0.05);
      blocks.push({ x, w: bw, h: r.range(0.03, 0.11) * (x > 0.25 ? 1 : 0.6), lit: r() });
      x += bw + r.range(0.002, 0.02);
    }
    const windows = Array.from({ length: 260 }, () => ({ b: r.int(0, blocks.length - 1), u: r(), v: r(), on: r() < 0.55 })).filter((wn) => wn.on);
    for (const wn of windows) wn.fill = `rgba(255,${190 + ((wn.u * 40) | 0)},120,${(0.35 + 0.35 * wn.v).toFixed(2)})`;
    const district = Array.from({ length: 11 }, (_, i) => ({ x: (i + r.range(0.1, 0.9)) / 11, s: r.range(0.7, 1.2), ph: r() }));
    const smog = Array.from({ length: 80 }, () => ({ x: r(), y: r.range(0.5, 1.0), ph: r(), s: r.range(0.6, 1.2) }));
    // Particles inside each ger (normalized coordinates).
    const mk = (n) => Array.from({ length: n }, () => ({ u: r.range(-0.95, 0.4), v: r.range(0.05, 0.95), k1: 1 + r.int(0, 1), k2: 1 + r.int(0, 2), p1: r() * TAU, p2: r() * TAU, s: r.range(0.6, 1.3) }));
    const coalP = mk(120);
    const retroP = mk(18);
    const gust = Array.from({ length: 46 }, (_, i) => ({ te: lerp(DOOR[0] + 0.35, DOOR[2] + 0.3, i / 45) + r.range(-0.1, 0.1), v: r.range(0.1, 0.85), du: r.range(0.9, 1.4), p: r() * TAU, s: r.range(0.6, 1.2), out: r.range(0, 0.6) }));
    const inflow = Array.from({ length: 48 }, (_, i) => ({ te: lerp(DOOR[0] + 0.15, DOOR[2], i / 47) + r.range(-0.1, 0.1), dx: r.range(0.2, 0.95), dy: r.range(-0.25, 0.35), s: r.range(0.7, 1.3) }));
    const drifts = Array.from({ length: 9 }, () => ({ x: r(), y: r.range(0.15, 0.95), l: r.range(0.06, 0.16), a: r.range(0.04, 0.09) }));
    const puffs = Array.from({ length: 26 }, (_, i) => ({ ph: i / 26, w: r.range(-1, 1), s: r.range(0.8, 1.25) }));
    return { outside, coal, retro, flakes, stars, blocks, windows, district, smog, coalP, retroP, gust, inflow, puffs, drifts };
  },

  draw(api, st) {
    const { ctx, w, h, t } = api;
    const narrow = w / h < 1.6;
    const compact = api.compact;
    const th = (TAU * t) / D;
    const sample = (arr, tt) => {
      const x = (wrap(tt) / D) * N;
      const i = Math.floor(x);
      return lerp(arr[i % N], arr[(i + 1) % N], x - i);
    };

    // ---- Layout ----
    const horizon = h * (narrow ? 0.6 : 0.6);
    const gy = h * (narrow ? 0.85 : 0.79);
    const R = narrow ? Math.min(w * 0.205, h * 0.3) : Math.min(w * 0.112, h * 0.27);
    const gers = [
      { kind: 'coal', ...geom(w * (narrow ? 0.265 : 0.195), gy, R) },
      { kind: 'retro', ...geom(w * (narrow ? 0.735 : 0.475), gy, R) },
    ];
    const tagClear = w > 520 ? 56 : 0;
    const chart = narrow
      ? { x: w * 0.05, y: Math.max(h * 0.045, tagClear), w: w * 0.9, h: h * 0.37 }
      : { x: w * 0.632, y: h * 0.08, w: w * 0.33, h: h * 0.56 };
    const doorOpen = smooth(seg(t, DOOR[0], DOOR[1])) * (1 - smooth(seg(t, DOOR[2], DOOR[3])));

    // ---- Sky, moon, haze ----
    const sg = ctx.createLinearGradient(0, 0, 0, horizon);
    sg.addColorStop(0, SKY[0]);
    sg.addColorStop(0.5, SKY[1]);
    sg.addColorStop(0.85, SKY[2]);
    sg.addColorStop(1, SKY[3]);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, horizon + 2);
    ctx.fillStyle = 'rgb(220,226,240)';
    for (const s of st.stars) {
      ctx.globalAlpha = 0.35 * s.b;
      ctx.fillRect(s.x * w, s.y * horizon, 1, 1);
    }
    ctx.globalAlpha = 1;
    const moon = narrow ? [w * 0.86, h * 0.5] : [w * 0.1, h * 0.2];
    api.light(moon[0], moon[1], api.s(70), '#B8C4DA', 0.28);
    ctx.fillStyle = 'rgba(236,236,226,0.92)';
    ctx.beginPath();
    ctx.arc(moon[0], moon[1], api.s(7.5), 0, TAU);
    ctx.fill();

    // Hills around the valley.
    ctx.fillStyle = '#161B29';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * w;
      ctx.lineTo(x, horizon - h * (0.07 + 0.035 * Math.sin(i * 0.7 + 0.5) + 0.02 * Math.sin(i * 1.9)));
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();

    // City: apartment blocks, windows, a power plant.
    for (const b of st.blocks) {
      ctx.fillStyle = '#1A1C26';
      ctx.fillRect(b.x * w, horizon - b.h * h, b.w * w + 1, b.h * h + 1);
    }
    const ws = Math.max(1, api.s(1.4));
    for (const win of st.windows) {
      const b = st.blocks[win.b];
      ctx.fillStyle = win.fill;
      ctx.fillRect((b.x + b.w * (0.12 + win.u * 0.76)) * w, horizon - b.h * h * (0.1 + win.v * 0.82), ws, ws);
    }
    const plantX = w * (narrow ? 0.5 : 0.6);
    for (let k = 0; k < 2; k++) {
      const sx = plantX + k * api.s(14);
      const sh = h * (narrow ? 0.13 : 0.16);
      ctx.fillStyle = '#20222C';
      ctx.beginPath();
      ctx.moveTo(sx - api.s(3.2), horizon);
      ctx.lineTo(sx - api.s(2), horizon - sh);
      ctx.lineTo(sx + api.s(2), horizon - sh);
      ctx.lineTo(sx + api.s(3.2), horizon);
      ctx.closePath();
      ctx.fill();
      plume(api, sx, horizon - sh, t, k * 0.37, api.s(10), 0.2);
      const bl = 0.5 + 0.5 * Math.sin((TAU * t * 5) / D + k * 2) ** 8;
      api.light(sx, horizon - sh, api.s(6), '#FF5040', 0.6 * bl);
    }
    // Sodium glow and smog over the city.
    const cg = ctx.createLinearGradient(0, horizon - h * 0.2, 0, horizon + h * 0.04);
    cg.addColorStop(0, 'rgba(160,110,70,0)');
    cg.addColorStop(0.75, 'rgba(200,130,70,0.22)');
    cg.addColorStop(1, 'rgba(210,140,80,0.3)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, horizon - h * 0.2, w, h * 0.24);

    // ---- Snowfield ----
    const gg = ctx.createLinearGradient(0, horizon, 0, h);
    gg.addColorStop(0, '#2E3240');
    gg.addColorStop(0.3, '#3A4458');
    gg.addColorStop(1, '#5E6A84');
    ctx.fillStyle = gg;
    ctx.fillRect(0, horizon, w, h - horizon);
    for (const d of st.drifts) {
      const y = lerp(horizon + h * 0.04, h, d.y);
      const g = ctx.createRadialGradient(d.x * w, y, 0, d.x * w, y, d.l * w);
      g.addColorStop(0, `rgba(190,200,220,${d.a})`);
      g.addColorStop(1, 'rgba(190,200,220,0)');
      ctx.save();
      ctx.translate(d.x * w, y);
      ctx.scale(1, 0.12);
      ctx.translate(-d.x * w, -y);
      ctx.fillStyle = g;
      ctx.fillRect(d.x * w - d.l * w, y - d.l * w, d.l * w * 2, d.l * w * 2);
      ctx.restore();
    }
    // Ger district in the middle distance: small gers, fences, chimney smoke.
    for (const d of st.district) {
      const x = d.x * w;
      const s = api.s(9) * d.s;
      const y = horizon + h * 0.025 + d.ph * h * 0.03;
      ctx.fillStyle = 'rgba(30,30,36,0.9)';
      ctx.fillRect(x - s * 2.2, y - s * 0.9, s * 4.4, s * 0.9);
      ctx.fillStyle = 'rgba(150,154,168,0.85)';
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s, y - s * 0.55);
      ctx.lineTo(x - s * 0.15, y - s * 0.95);
      ctx.lineTo(x + s * 0.15, y - s * 0.95);
      ctx.lineTo(x + s, y - s * 0.55);
      ctx.lineTo(x + s, y);
      ctx.closePath();
      ctx.fill();
      plume(api, x, y - s * 1.1, t, d.ph, s * 0.9, 0.12, 4);
    }
    const hz = ctx.createLinearGradient(0, horizon - h * 0.02, 0, horizon + h * 0.1);
    hz.addColorStop(0, 'rgba(150,120,95,0.28)');
    hz.addColorStop(1, 'rgba(150,120,95,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon - h * 0.02, w, h * 0.12);

    // Fence behind the gers (wooden planks of the plot, as in ger districts).
    const fenceTop = gy - R * 0.9;
    const fenceBot = gy - R * 0.6;
    const fenceR = narrow ? w : w * 0.64;
    ctx.fillStyle = '#34302F';
    ctx.fillRect(0, fenceTop, fenceR, fenceBot - fenceTop);
    ctx.strokeStyle = 'rgba(12,12,16,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const plank = Math.max(3, api.s(7));
    for (let x = 0; x < fenceR; x += plank) {
      const jag = ((x * 7.3) % 5) * 0.4 * api.s(1);
      ctx.moveTo(x, fenceTop - jag);
      ctx.lineTo(x, fenceBot);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(214,222,236,0.75)';
    ctx.fillRect(0, fenceTop - api.s(1.5), fenceR, api.s(2));

    // Warm light pooling on the snow.
    for (const G of gers) {
      const k = G.kind === 'coal' ? 1 : 0.8;
      api.light(G.cx - G.R * 0.4, G.gy + G.e * 1.3, G.R * 0.8, '#FF9A50', 0.14 * k);
      if (G.kind === 'retro' && doorOpen > 0) {
        const dp = wallPt(G, G.door, 0);
        api.light(dp[0] + G.R * 0.1, dp[1] + G.e * 1.1, G.R * 0.55 * (0.6 + 0.4 * doorOpen), '#FFB060', 0.32 * doorOpen);
      }
    }

    // A utility pole between the plots feeds the retrofit ger: its heat comes from the grid.
    {
      const G = gers[1];
      const px = (gers[0].cx + G.cx) / 2;
      const pb = gy - R * 0.62;
      const pt = gy - R * 1.72;
      ctx.strokeStyle = '#2C2826';
      ctx.lineWidth = Math.max(1.5, R * 0.032);
      ctx.beginPath();
      ctx.moveTo(px, pb);
      ctx.lineTo(px, pt);
      ctx.moveTo(px - R * 0.15, pt + R * 0.07);
      ctx.lineTo(px + R * 0.15, pt + R * 0.07);
      ctx.stroke();
      const attach = roofPt(G, -1.25, 0.06);
      ctx.strokeStyle = 'rgba(18,18,24,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + R * 0.13, pt + R * 0.07);
      ctx.quadraticCurveTo((px + attach[0]) / 2 + R * 0.1, Math.max(pt, attach[1]) + R * 0.12, attach[0], attach[1]);
      ctx.moveTo(px - R * 0.13, pt + R * 0.07);
      ctx.quadraticCurveTo(px - R * 0.7, pt + R * 0.22, px - R * 1.5, pt - R * 0.02);
      ctx.stroke();
    }

    // ---- The two gers ----
    const nodes = [];
    for (const G of gers) drawGer(api, st, G, t, G.kind === 'retro' ? doorOpen : 0, nodes);

    // Coal smoke from the left ger's stovepipe, flattening under the night inversion.
    const cG = gers[0];
    const pipeTop = [cG.cx, cG.apexY - cG.R * 0.34];
    const smokeG = puffGrad(ctx, '124,116,112');
    for (const p of st.puffs) {
      const a = fract(t / 8 + p.ph);
      const rise = 1 - Math.pow(1 - Math.min(a * 1.6, 1), 2);
      const x = pipeTop[0] + Math.pow(a, 1.25) * cG.R * 3.2 + p.w * cG.R * 0.12 * a;
      const y = pipeTop[1] - rise * cG.R * 0.62 - a * cG.R * 0.08 + p.w * cG.R * 0.05 * a;
      const rad = cG.R * (0.06 + a * 0.42) * p.s;
      const al = 0.4 * Math.min(1, a * 8) * (1 - a) ** 0.8;
      puff(ctx, smokeG, x, y, rad, al);
    }

    // Outdoor particles (the night air is dirtier than inside).
    ctx.fillStyle = 'rgb(150,124,100)';
    for (const p of st.smog) {
      const u = fract(p.ph + t / D);
      const x = fract(p.x + u * 0.06) * w;
      const y = lerp(horizon, h, p.y) + Math.sin(th * 2 + p.ph * 9) * api.s(3);
      const sz = Math.max(1, api.s(1.4) * p.s);
      ctx.globalAlpha = 0.4 * Math.sin(Math.PI * u) * p.s;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
    // Night air pouring through the open door.
    const rG = gers[1];
    if (t > DOOR[0] && t < DOOR[3] + 1.4) {
      const dp = wallPt(rG, rG.door, 0.4);
      // A soft stream of smoggy air drawn into the doorway, carrying particles.
      for (let k = 0; k < 6; k++) {
        const u = fract(t / 1.4 + k / 6);
        const x = lerp(dp[0] + rG.R * 0.75, dp[0] + rG.R * 0.02, ease.inOut(u));
        const y = lerp(dp[1] + rG.R * 0.12, dp[1] + rG.R * 0.03, u);
        puff(ctx, puffGrad(ctx, '150,122,96'), x, y, rG.R * (0.2 - u * 0.1), 0.2 * Math.sin(Math.PI * u) * doorOpen);
      }
      for (const p of st.inflow) {
        const u = seg(t, p.te, p.te + 1.2);
        if (u <= 0 || u >= 1) continue;
        const e = ease.inOut(u);
        const x = lerp(dp[0] + rG.R * p.dx, dp[0], e);
        const y = lerp(dp[1] + rG.R * p.dy, dp[1] + rG.R * 0.02, e);
        ctx.fillStyle = `rgba(176,144,114,${0.9 * Math.sin(Math.PI * u)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.9, api.s(1.7) * p.s), 0, TAU);
        ctx.fill();
      }
      // Warm, moist air escaping at the top of the doorway.
      if (doorOpen > 0.05) {
        const top = wallPt(rG, rG.door, 0.82);
        for (let k = 0; k < 5; k++) {
          const u = fract(t / 1.6 + k / 5);
          const x = top[0] + u * rG.R * 0.35;
          const y = top[1] - u * rG.R * 0.25;
          puff(ctx, puffGrad(ctx, '230,234,240'), x, y, rG.R * (0.04 + u * 0.12), 0.22 * (1 - u) * doorOpen);
        }
      }
    }

    // ---- Chart geometry (needed for the data streams) ----
    const pad = api.s(narrow ? 9 : 14);
    const titleY = chart.y + pad + api.fs(10.5) * 0.8;
    const footN = compact ? 1 : 2;
    const footH = api.fs(10) * 1.35 * footN;
    const labW = api.measure('retrofit 000', { size: api.fs(10), weight: 600 }) + api.s(14);
    const yLab = api.measure('300', { size: api.fs(10) }) + api.s(8);
    const plot = { x: chart.x + pad + yLab, y: titleY + api.s(narrow ? 10 : 16), w: 0, h: 0 };
    plot.w = chart.x + chart.w - pad - labW - plot.x;
    plot.h = chart.y + chart.h - pad - footH - api.s(narrow ? 6 : 10) - plot.y;
    const VMAX = 320;
    const py = (v) => plot.y + plot.h * (1 - clamp(v / VMAX, 0, 1.05));
    const series = [
      { key: 'outside', arr: st.outside, c: COOL, label: 'outside' },
      { key: 'coal', arr: st.coal, c: EMBER, label: compact ? 'coal' : 'coal ger' },
      { key: 'retro', arr: st.retro, c: LIME, label: 'retrofit' },
    ];

    // ---- Data streams: each sensor sends a reading every PKT seconds ----
    nodes.forEach((nd, k) => {
      const ser = series.find((s) => s.key === nd.series);
      const tgt = [plot.x + plot.w, py(sample(ser.arr, t))];
      const off = (k * 0.41) % PKT;
      const last = Math.floor((t - off) / PKT);
      for (let j = last - 1; j <= last; j++) {
        const te = off + j * PKT;
        const u = (t - te) / 1.05;
        if (u < 0 || u > 1) continue;
        const e = ease.inOut(u);
        const mx = (nd.x + tgt[0]) / 2;
        const my = Math.min(nd.y, tgt[1]) - h * 0.16;
        const x = (1 - e) * (1 - e) * nd.x + 2 * (1 - e) * e * mx + e * e * tgt[0];
        const y = (1 - e) * (1 - e) * nd.y + 2 * (1 - e) * e * my + e * e * tgt[1];
        api.light(x, y, api.s(9), '#9BE070', 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.2 + 0.05)));
        ctx.fillStyle = col(LIME_HI, 0.95);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, api.s(1.6)), 0, TAU);
        ctx.fill();
      }
      // Blink when a reading is taken.
      const since = t - (off + last * PKT);
      const blink = 1 - seg(since, 0.05, 0.35);
      api.light(nd.x, nd.y, api.s(8 + 6 * blink), '#8CD860', 0.35 + 0.65 * blink);
      ctx.fillStyle = col(LIME_HI, 0.6 + 0.4 * blink);
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, Math.max(1, api.s(1.5)), 0, TAU);
      ctx.fill();
    });

    // ---- Snowfall ----
    ctx.fillStyle = 'rgb(236,240,248)';
    const fk = Math.max(0.7, api.s(1));
    for (const f of st.flakes) {
      const u = fract(f.ph + (t * f.n) / D);
      const y = lerp(-0.05, 1.05, u) * h;
      const x = (fract(f.x + u * 0.08) + Math.sin(u * TAU * 2 + f.sw) * 0.006) * w;
      const rad = (0.5 + f.z * 1.3) * f.s * fk;
      ctx.globalAlpha = 0.35 + 0.5 * f.z;
      if (rad < 1.1) ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      else {
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ---- Chart (HUD) ----
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(chart.x, chart.y, chart.w, chart.h, api.s(6));
    ctx.fillStyle = 'rgba(8,12,22,0.66)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(214,222,236,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    api.text('PM2.5 · µg/m³', chart.x + pad, titleY, { size: api.fs(10.5), color: INK_DIM, weight: 600, spacing: 1 });
    const liveOn = 0.55 + 0.45 * Math.sin(th * 8) ** 2;
    api.text('LIVE', chart.x + chart.w - pad, titleY, { size: api.fs(10.5), color: col(LIME_HI, 0.9), weight: 600, spacing: 1, align: 'right' });
    const lw = api.measure('LIVE', { size: api.fs(10.5), weight: 600, spacing: 1 });
    api.light(chart.x + chart.w - pad - lw - api.s(8), titleY - api.fs(10.5) * 0.35, api.s(6), '#9BE070', liveOn);
    // Grid.
    ctx.lineWidth = 1;
    for (const v of [100, 200, 300]) {
      const y = py(v);
      ctx.strokeStyle = 'rgba(214,222,236,0.1)';
      ctx.beginPath();
      ctx.moveTo(plot.x, y + 0.5);
      ctx.lineTo(plot.x + plot.w, y + 0.5);
      ctx.stroke();
      api.text(String(v), plot.x - api.s(6), y, { size: api.fs(10), color: INK_DIM, align: 'right', base: 'middle' });
    }
    ctx.strokeStyle = 'rgba(214,222,236,0.22)';
    ctx.beginPath();
    ctx.moveTo(plot.x, plot.y + plot.h + 0.5);
    ctx.lineTo(plot.x + plot.w, plot.y + plot.h + 0.5);
    ctx.stroke();
    // Door-open marker in the history.
    const dAge = wrap(t - DOOR[0]);
    if (dAge < WIN) {
      const x = plot.x + plot.w * (1 - dAge / WIN);
      ctx.save();
      ctx.setLineDash([api.s(2), api.s(3)]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(214,222,236,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, plot.y);
      ctx.lineTo(x, plot.y + plot.h);
      ctx.stroke();
      ctx.restore();
      if (!compact && x > plot.x + api.s(30)) api.text('door', x - api.s(4), plot.y + api.fs(10) * 0.9, { size: api.fs(10), color: INK_DIM, align: 'right' });
    }
    // Traces.
    const n = Math.max(40, Math.round(plot.w / Math.max(2, api.s(3))));
    const ends = [];
    for (const s of series) {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const tt = t - WIN + (k / n) * WIN;
        const x = plot.x + (k / n) * plot.w;
        const y = py(sample(s.arr, tt));
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = col(s.c, 0.95);
      ctx.lineWidth = Math.max(1.2, api.s(s.key === 'retro' ? 2 : 1.6));
      ctx.lineJoin = 'round';
      ctx.stroke();
      const v = sample(s.arr, t);
      ends.push({ s, v, y: py(v) });
    }
    // Live readouts beside the trace ends (kept apart).
    ends.sort((a, b) => a.y - b.y);
    const gap = api.fs(10) * 1.3;
    for (let k = 1; k < ends.length; k++) ends[k].ly = Math.max(ends[k].y, (ends[k - 1].ly ?? ends[k - 1].y) + gap);
    ends[0].ly = ends[0].y;
    const over = ends[ends.length - 1].ly - (plot.y + plot.h);
    if (over > 0) for (const e of ends) e.ly -= over;
    for (const e of ends) {
      const x = plot.x + plot.w;
      ctx.fillStyle = col(e.s.c, 1);
      ctx.beginPath();
      ctx.arc(x, e.y, api.s(2.4), 0, TAU);
      ctx.fill();
      api.text(`${e.s.label} ${Math.round(e.v)}`, x + api.s(8), e.ly, { size: api.fs(10), color: col(mixc(e.s.c, [255, 255, 255], 0.25), 0.98), base: 'middle', weight: 600 });
    }
    // Footnote: the study's numbers, exactly as its abstract states them.
    const fy = chart.y + chart.h - pad - (footN - 1) * api.fs(10) * 1.35;
    if (compact) api.text('study: insulated all-electric −48%', chart.x + pad, fy, { size: api.fs(10), color: col(LIME_HI, 0.92) });
    else {
      api.text('Study: insulated, all-electric gers: −48% PM2.5,', chart.x + pad, fy - api.fs(10) * 1.35, { size: api.fs(10), color: col(LIME_HI, 0.92), maxWidth: chart.w - pad * 2 });
      api.text('still 6.4× the WHO guideline.', chart.x + pad, fy, { size: api.fs(10), color: INK_DIM, maxWidth: chart.w - pad * 2 });
    }

    // ---- Labels and captions ----
    for (const G of gers) {
      const str = G.kind === 'coal' ? (compact ? 'COAL' : 'COAL STOVE') : compact ? 'RETROFIT' : 'INSULATED · ELECTRIC';
      api.text(str, G.cx, G.gy + G.e + api.s(narrow ? 13 : 17), { size: api.fs(10), color: INK, weight: 600, spacing: 1, align: 'center' });
    }
    const capO = { size: api.fs(10.5), bg: 'rgba(8,12,22,0.78)', border: col(LIME, 0.65), color: INK };
    const n0 = nodes[1] || nodes[0];
    api.caption(compact ? 'sensors stream PM2.5' : 'sensors inside and out stream PM2.5', clamp(n0.x, w * 0.22, w * 0.6), Math.min(n0.y - R * 0.95, gy - R * 1.45), 0.9, 3.7, capO);
    const dp = wallPt(rG, rG.door, 1);
    api.caption(compact ? 'door opens: smog flows in' : 'door opens: outside air rushes in', clamp(dp[0], w * 0.24, narrow ? w * 0.76 : w * 0.5), dp[1] - R * (narrow ? 0.75 : 0.95), DOOR[0] + 0.1, DOOR[3] + 1.1, capO);

    // ---- Vignette ----
    const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,2,8,0)');
    vg.addColorStop(1, 'rgba(0,2,8,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  },
};

// Ger geometry: round wall, low conical roof, crown ring.
function geom(cx, gy, R) {
  const Hw = R * 0.5;
  const rise = R * 0.4;
  return { cx, gy, R, e: R * 0.17, Hw, rise, rc: R * 0.12, apexY: gy - Hw - rise, door: 0.47, dw: 0.12, cut: [-1.18, 0.22] };
}
// Point on the wall at angle phi (0 = facing us, + = right), height fraction hf.
function wallPt(G, phi, hf) {
  return [G.cx + G.R * Math.sin(phi), G.gy + G.e * Math.cos(phi) - G.Hw * hf];
}
// Point on the roof at angle phi; k = 0 at the eave, 1 at the crown.
function roofPt(G, phi, k) {
  const rr = lerp(G.R * 1.05, G.rc, k);
  const ee = lerp(G.e * 1.05, G.rc * 0.34, k);
  return [G.cx + rr * Math.sin(phi), lerp(G.gy - G.Hw, G.apexY, k) + ee * Math.cos(phi)];
}

function drawGer(api, st, G, t, doorOpen, nodes) {
  const { ctx } = api;
  const { cx, gy, R, e, Hw, apexY, rc } = G;
  const coal = G.kind === 'coal';
  const [ca, cb] = G.cut;
  const th = (TAU * t) / D;
  // Cutaway outline: a slice of wall and roof removed on the left of the door.
  const cutPath = (begin = true) => {
    if (begin) ctx.beginPath();
    let first = true;
    for (let k = 0; k <= 12; k++) {
      const p = wallPt(G, lerp(ca, cb, k / 12), 0);
      if (first) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
      first = false;
    }
    const tb = wallPt(G, cb, 1);
    ctx.lineTo(tb[0], tb[1]);
    const rb = roofPt(G, cb, 0.82);
    ctx.lineTo(rb[0], rb[1]);
    for (let k = 1; k <= 8; k++) {
      const p = roofPt(G, lerp(cb, ca, k / 8), 0.82);
      ctx.lineTo(p[0], p[1]);
    }
    const ta = wallPt(G, ca, 1);
    ctx.lineTo(ta[0], ta[1]);
    ctx.closePath();
  };
  const flick = coal ? 0.82 + 0.18 * (Math.sin(th * 11) * 0.5 + Math.sin(th * 23 + 1) * 0.3 + Math.sin(th * 37 + 2) * 0.2) : 1;

  // ---- Interior, seen through the cutaway ----
  ctx.save();
  cutPath();
  ctx.clip();
  ctx.fillStyle = coal ? '#2A1A12' : '#2C2016';
  ctx.fillRect(cx - R * 1.2, apexY - R * 0.2, R * 2.4, gy - apexY + R * 0.6);
  // Inner roof (far half) with the radiating roof poles.
  ctx.fillStyle = coal ? '#3A261A' : '#433022';
  ctx.beginPath();
  ctx.moveTo(cx - R, gy - Hw);
  for (let k = 0; k <= 16; k++) {
    const phi = Math.PI * 0.5 + (k / 16) * Math.PI;
    const p = wallPt(G, phi, 1);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.lineTo(cx, apexY);
  ctx.closePath();
  ctx.fill();
  // Back wall band (inner surface) with the khana lattice.
  const backBand = () => {
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const p = wallPt(G, Math.PI * 0.5 + (k / 16) * Math.PI, 1);
      if (k) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    for (let k = 16; k >= 0; k--) {
      const p = wallPt(G, Math.PI * 0.5 + (k / 16) * Math.PI, 0);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
  };
  backBand();
  const bw = ctx.createLinearGradient(0, gy - Hw - e, 0, gy);
  bw.addColorStop(0, coal ? '#5A3A24' : '#6A4C32');
  bw.addColorStop(1, coal ? '#7A4E2E' : '#8A6644');
  ctx.fillStyle = bw;
  ctx.fill();
  ctx.save();
  backBand();
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,40,22,0.7)';
  ctx.lineWidth = Math.max(1, R * 0.012);
  ctx.beginPath();
  const sp = R * 0.11;
  for (let x = cx - R - Hw; x < cx + R + Hw; x += sp) {
    ctx.moveTo(x, gy);
    ctx.lineTo(x + Hw * 1.1, gy - Hw * 1.3);
    ctx.moveTo(x + Hw * 1.1, gy);
    ctx.lineTo(x, gy - Hw * 1.3);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = col(POLE, 0.85);
  ctx.lineWidth = Math.max(1, R * 0.014);
  ctx.beginPath();
  for (let k = 0; k <= 18; k++) {
    const phi = Math.PI * 0.5 + (k / 18) * Math.PI;
    const p = wallPt(G, phi, 1);
    const q = [cx + rc * Math.sin(phi), apexY + rc * 0.34 * Math.cos(phi)];
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  ctx.strokeStyle = col(POLE, 0.95);
  ctx.lineWidth = Math.max(1.2, R * 0.025);
  ctx.beginPath();
  ctx.ellipse(cx, apexY, rc, rc * 0.34, 0, 0, TAU);
  ctx.stroke();
  // Floor.
  ctx.fillStyle = coal ? '#3B2A20' : '#4A3526';
  ctx.beginPath();
  ctx.ellipse(cx, gy, R, e, 0, 0, TAU);
  ctx.fill();
  // Stove (coal) or electric heater (retrofit) at the centre, between the two pillars.
  const stoveW = R * 0.28;
  const stoveH = R * 0.2;
  const sx = cx - stoveW / 2;
  const sy = gy - stoveH - e * 0.15;
  if (coal) {
    ctx.strokeStyle = '#2A2A2E';
    ctx.lineWidth = Math.max(1.2, R * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx + stoveW * 0.18, sy);
    ctx.lineTo(cx + stoveW * 0.18, apexY + rc * 0.2);
    ctx.stroke();
    ctx.fillStyle = '#1C1C20';
    ctx.fillRect(sx, sy, stoveW, stoveH);
    ctx.fillStyle = `rgba(255,${(120 + 40 * flick) | 0},50,${0.85 * flick})`;
    ctx.fillRect(sx + stoveW * 0.2, sy + stoveH * 0.35, stoveW * 0.45, stoveH * 0.4);
  } else {
    ctx.fillStyle = '#B8B4AC';
    ctx.beginPath();
    ctx.roundRect(sx, sy + stoveH * 0.1, stoveW, stoveH * 0.9, R * 0.02);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,86,80,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      ctx.moveTo(sx + (stoveW * k) / 6, sy + stoveH * 0.2);
      ctx.lineTo(sx + (stoveW * k) / 6, sy + stoveH * 0.9);
    }
    ctx.stroke();
  }
  // The two centre pillars (bagana), orange-painted, rising to the crown.
  ctx.strokeStyle = col(POLE, 1);
  ctx.lineWidth = Math.max(1.5, R * 0.035);
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(cx + s * R * 0.085, gy - e * 0.35);
    ctx.lineTo(cx + s * R * 0.06, apexY + rc * 0.3);
  }
  ctx.stroke();
  // Sensor box mounted on the left pillar.
  const nyF = 0.5;
  const nx = lerp(cx - R * 0.085, cx - R * 0.06, nyF);
  const ny = lerp(gy - e * 0.35, apexY, nyF);
  ctx.fillStyle = '#E8E6E0';
  ctx.fillRect(nx - R * 0.11, ny - R * 0.04, R * 0.1, R * 0.075);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(nx - R * 0.11, ny + R * 0.028, R * 0.1, R * 0.007);
  nodes.push({ x: nx - R * 0.06, y: ny - R * 0.005, series: G.kind });
  // Warm light from the stove or heater.
  api.light(cx, sy + stoveH * 0.4, R * (coal ? 0.95 : 0.8), coal ? '#FF8A3A' : '#FFB86A', (coal ? 0.5 : 0.36) * flick);
  // Smoke haze (coal) and particles.
  if (coal) {
    ctx.fillStyle = 'rgba(120,92,66,0.22)';
    ctx.fillRect(cx - R * 1.2, apexY - R * 0.2, R * 2.4, gy - apexY + R * 0.6);
  }
  const H = gy - apexY;
  const drawP = (p, a) => {
    const u = p.u + 0.18 * Math.sin((TAU * t * p.k1) / D + p.p1);
    const v = clamp(p.v + 0.08 * Math.sin((TAU * t * p.k2) / D + p.p2), 0.02, 0.98);
    const x = cx + u * R * 0.95;
    const y = gy - v * H * 0.92;
    const rr = Math.max(0.7, api.s(1.15) * p.s);
    ctx.globalAlpha = a;
    if (rr < 1.2) ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    else {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
    }
  };
  const parts = coal ? st.coalP : st.retroP;
  ctx.fillStyle = 'rgb(236,196,156)';
  for (const p of parts) drawP(p, 0.55 * p.s);
  if (!coal) {
    // Outside air that came in through the door, spreading and slowly clearing.
    for (const p of st.gust) {
      const age = t - p.te;
      if (age < 0) continue;
      const fade = seg(age, 0, 0.5) * (1 - seg(t, 11.6 + p.out * 1.4, 14.2 + p.out));
      if (fade <= 0) continue;
      const u = lerp(0.42, 0.42 - p.du, ease.out(seg(age, 0, 2.2))) + 0.05 * Math.sin(t * 1.3 + p.p);
      drawP({ u, v: p.v, k1: 1, k2: 1, p1: p.p, p2: p.p * 2, s: p.s }, 0.6 * fade * p.s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ---- Exterior: wall and roof with the cutaway removed ----
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - R * 2, apexY - R, R * 4, R * 3);
  cutPath(false);
  ctx.clip('evenodd');
  // Wall.
  const felt = coal ? FELT : mixc(FELT, [196, 190, 176], 0.35);
  const wg = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  wg.addColorStop(0, col(mixc(felt, [40, 46, 62], 0.55)));
  wg.addColorStop(0.32, col(mixc(felt, [255, 255, 255], 0.12)));
  wg.addColorStop(0.7, col(felt));
  wg.addColorStop(1, col(mixc(felt, [40, 46, 62], 0.6)));
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(cx - R, gy - Hw);
  for (let k = 0; k <= 24; k++) {
    const p = wallPt(G, -Math.PI / 2 + (k / 24) * Math.PI, 0);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.lineTo(cx + R, gy - Hw);
  for (let k = 24; k >= 0; k--) {
    const p = wallPt(G, -Math.PI / 2 + (k / 24) * Math.PI, 1);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
  ctx.fill();
  // Girth ropes around the wall.
  ctx.strokeStyle = 'rgba(70,72,86,0.55)';
  ctx.lineWidth = Math.max(1, R * 0.016);
  ctx.beginPath();
  for (const hf of [0.2, 0.5, 0.8]) {
    for (let k = 0; k <= 24; k++) {
      const p = wallPt(G, -Math.PI / 2 + (k / 24) * Math.PI, hf);
      if (k) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
  }
  ctx.stroke();
  // Roof: felt cone under snow.
  const rg = ctx.createLinearGradient(0, apexY, 0, gy - Hw + e);
  rg.addColorStop(0, '#E4E8F0');
  rg.addColorStop(0.6, '#C2C8D6');
  rg.addColorStop(1, '#8A90A2');
  ctx.fillStyle = rg;
  ctx.beginPath();
  const rl = roofPt(G, -Math.PI / 2, 0);
  ctx.moveTo(cx - rc, apexY);
  ctx.lineTo(rl[0], rl[1]);
  for (let k = 0; k <= 24; k++) {
    const p = roofPt(G, -Math.PI / 2 + (k / 24) * Math.PI, 0);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.lineTo(cx + rc, apexY);
  ctx.closePath();
  ctx.fill();
  // Eave shadow on the wall, and the roof band.
  ctx.strokeStyle = 'rgba(40,44,58,0.45)';
  ctx.lineWidth = Math.max(1, R * 0.03);
  ctx.beginPath();
  for (let k = 0; k <= 24; k++) {
    const p = roofPt(G, -Math.PI / 2 + (k / 24) * Math.PI, 0);
    if (k) ctx.lineTo(p[0], p[1] + R * 0.012);
    else ctx.moveTo(p[0], p[1] + R * 0.012);
  }
  ctx.stroke();
  // Door: wooden, painted orange, with warm light at its edges.
  const d0 = G.door - G.dw;
  const d1 = G.door + G.dw;
  const hd = 0.84;
  const bl = wallPt(G, d0, 0);
  const br = wallPt(G, d1, 0);
  const tr = wallPt(G, d1, hd);
  const tl = wallPt(G, d0, hd);
  // Doorway (lit when open).
  ctx.fillStyle = doorOpen > 0 ? `rgba(255,186,110,${0.35 + 0.6 * doorOpen})` : '#3A2416';
  ctx.beginPath();
  ctx.moveTo(bl[0], bl[1]);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(tr[0], tr[1]);
  ctx.lineTo(tl[0], tl[1]);
  ctx.closePath();
  ctx.fill();
  if (doorOpen > 0) api.light((bl[0] + tr[0]) / 2, (bl[1] + tr[1]) / 2, R * 0.5, '#FFB060', 0.6 * doorOpen);
  // Door leaf, hinged on its right edge, swinging out.
  const sw = Math.cos(doorOpen * 1.25);
  const fx = lerp(br[0], bl[0], sw) + (1 - sw) * R * 0.05;
  const lift = (1 - sw) * R * 0.03;
  ctx.fillStyle = col(mixc(DOOR_C, [30, 20, 14], 0.25 + 0.2 * (1 - sw)));
  ctx.beginPath();
  ctx.moveTo(fx, lerp(br[1], bl[1], sw) + lift);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(tr[0], tr[1]);
  ctx.lineTo(fx, lerp(tr[1], tl[1], sw) - lift);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,36,18,0.8)';
  ctx.lineWidth = Math.max(1, R * 0.012);
  ctx.stroke();
  if (doorOpen < 0.05) {
    ctx.strokeStyle = 'rgba(255,190,110,0.55)';
    ctx.lineWidth = Math.max(1, R * 0.01);
    ctx.beginPath();
    ctx.moveTo(bl[0], bl[1]);
    ctx.lineTo(tl[0], tl[1]);
    ctx.lineTo(tr[0], tr[1]);
    ctx.stroke();
  }
  // Snow banked against the base.
  ctx.fillStyle = 'rgba(214,222,236,0.9)';
  ctx.beginPath();
  for (let k = 0; k <= 24; k++) {
    const phi = -Math.PI / 2 + (k / 24) * Math.PI;
    const p = wallPt(G, phi, 0);
    const bump = R * (0.025 + 0.02 * Math.sin(k * 1.7 + G.cx));
    if (k) ctx.lineTo(p[0], p[1] - bump);
    else ctx.moveTo(p[0], p[1] - bump);
  }
  for (let k = 24; k >= 0; k--) {
    const p = wallPt(G, -Math.PI / 2 + (k / 24) * Math.PI, 0);
    ctx.lineTo(p[0], p[1] + R * 0.02);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Cut faces: the wall's thickness (felt; plus insulation boards on the retrofit) ----
  const layers = coal ? [[226, 228, 232], [130, 126, 120]] : [[226, 228, 232], [210, 176, 92], [212, 182, 100], [140, 134, 124]];
  const thick = R * (coal ? 0.03 : 0.075);
  const lw = thick / layers.length;
  for (const phi of [ca, cb]) {
    const b = wallPt(G, phi, 0);
    const tp = wallPt(G, phi, 1);
    const dir = phi === ca ? 1 : -1; // faces point into the opening
    layers.forEach((c, k) => {
      ctx.fillStyle = col(mixc(c, [20, 22, 30], 0.18));
      ctx.fillRect(b[0] + dir * k * lw - (dir < 0 ? lw : 0), tp[1], lw, b[1] - tp[1]);
    });
  }
  for (const phi of [ca, cb]) {
    const p0 = roofPt(G, phi, 0);
    const p1 = roofPt(G, phi, 0.82);
    ctx.strokeStyle = coal ? 'rgba(140,136,130,0.9)' : 'rgba(208,176,96,0.95)';
    ctx.lineWidth = thick * 0.9;
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  }
  // Crown: toono cover, and the stovepipe on the coal ger.
  ctx.fillStyle = '#5C5A60';
  ctx.beginPath();
  ctx.ellipse(cx, apexY, rc * 1.05, rc * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E8ECF4';
  ctx.beginPath();
  ctx.ellipse(cx, apexY - rc * 0.08, rc * 0.92, rc * 0.3, 0, Math.PI, TAU);
  ctx.fill();
  if (coal) {
    ctx.fillStyle = '#2C2C30';
    ctx.fillRect(cx - R * 0.018, apexY - R * 0.34, R * 0.036, R * 0.34);
    ctx.fillRect(cx - R * 0.03, apexY - R * 0.35, R * 0.06, R * 0.02);
  }
  // Outside sensor on the wall, right of the door.
  const op = wallPt(G, G.door + G.dw + 0.2, 0.62);
  ctx.fillStyle = '#E8E6E0';
  ctx.fillRect(op[0] - R * 0.04, op[1] - R * 0.035, R * 0.08, R * 0.06);
  nodes.push({ x: op[0], y: op[1] - R * 0.005, series: 'outside' });
}

// One unit-radius soft gradient per colour, reused for every puff via transforms.
const PUFF = new WeakMap();
function puffGrad(ctx, rgb) {
  let m = PUFF.get(ctx);
  if (!m) PUFF.set(ctx, (m = {}));
  if (!m[rgb]) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.6, `rgba(${rgb},0.45)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    m[rgb] = g;
  }
  return m[rgb];
}
function puff(ctx, grad, x, y, rad, a) {
  if (a <= 0.003 || rad <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rad, rad);
  ctx.globalAlpha = a;
  ctx.fillStyle = grad;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// A soft smoke plume drifting right (used for distant chimneys and the power plant).
function plume(api, x, y, t, ph, size, alpha, n = 6) {
  const { ctx } = api;
  const g = puffGrad(ctx, '150,146,150');
  for (let k = 0; k < n; k++) {
    const a = fract(t / 8 + ph + k / n);
    puff(ctx, g, x + a * size * 5, y - Math.min(a * 2, 1) * size * 1.6, size * (0.4 + a * 1.4), alpha * Math.sin(Math.PI * a));
  }
}
