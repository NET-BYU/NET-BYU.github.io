// Spectrum Sharing via Interference-resilient Passive Receivers and Passive-aware Active
// Services: cinematic scene.
// A radio telescope listens for a faint spectral line. Towers on the horizon and a LEO
// satellite light up, and their interference buries the line. The observatory broadcasts a
// notice of the band it is protecting; compliant transmitters notch that band out of their
// emissions, and the one that ignores the notice is removed at the receiver by a
// projection step. The line re-emerges clean, then the sky goes quiet and the loop repeats.
import { TAU, clamp, lerp, seg, ease, fract, smooth, noise2 } from './kit.js';

const D = 16;
const BAND = [0.42, 0.58]; // protected band, as a fraction of the panel's frequency span
const LINE_U = 0.5;
const LINE_AMP = 0.085;
const FLOOR = 0.17;
const NOTICE_T = 5.6;
const PROJ_T = [9.8, 11.0];
const END_FADE = [14.2, 15.6];

// Interferers. Towers sit on the horizon; the satellite crosses the sky (its hump drifts
// with Doppler). ok = complies with the observatory's notice.
const TX = [
  { kind: 'tower', x: 0.62, hgt: 0.12, u: 0.37, wd: 0.075, amp: 0.36, on: 2.5, ok: true },
  { kind: 'tower', x: 0.75, hgt: 0.165, u: 0.515, wd: 0.05, amp: 0.44, on: 3.0, ok: false },
  { kind: 'tower', x: 0.885, hgt: 0.1, u: 0.65, wd: 0.07, amp: 0.3, on: 3.4, ok: true },
  { kind: 'sat', u0: 0.6, u1: 0.43, wd: 0.045, amp: 0.3, on: 2.8, ok: true, t0: 1.6, t1: 11.2 },
];

// Theme-independent colours.
const SKY = ['#04060F', '#080B1E', '#141634', '#231C3A'];
const PURPLE = [181, 123, 214]; // #B57BD6, the hero light
const PURPLE_HI = [226, 196, 244];
const AMBER = [232, 160, 84]; // interference
const TRACE = [232, 228, 246];
const INK = 'rgba(232,226,246,0.88)';
const INK_DIM = 'rgba(210,204,232,0.7)';

const col = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const bandMask = (u) => smooth(seg(u, BAND[0] - 0.012, BAND[0] + 0.012)) * (1 - smooth(seg(u, BAND[1] - 0.012, BAND[1] + 0.012)));

export default {
  duration: D,
  still: 11.4,
  scene: true,

  init(api) {
    const r = api.rng('spectrum-scene');
    const stars = Array.from({ length: 260 }, () => ({ x: r(), y: Math.pow(r(), 1.25) * 0.86, b: Math.pow(r(), 2.2), ph: r() * TAU, n: 1 + r.int(0, 2) }));
    // Milky Way: soft blobs and dense faint stars along a band.
    const way = [];
    for (let i = 0; i < 12; i++) way.push({ s: i / 11 + r.range(-0.03, 0.03), off: r.range(-0.04, 0.04), rad: r.range(0.08, 0.15), a: r.range(0.5, 1) });
    const wayStars = Array.from({ length: 420 }, () => ({ s: r(), off: r.gauss() * 0.05, b: r.range(0.15, 0.75) }));
    const ridge = [];
    for (let i = 0; i <= 40; i++) ridge.push(Math.sin(i * 0.55 + 1.3) * 0.012 + Math.sin(i * 1.7) * 0.006 + r.range(-0.004, 0.004));
    const motes = Array.from({ length: 14 }, (_, i) => ({ ph: i / 14 + r.range(0, 0.05), off: r.range(-1, 1) }));
    return { stars, way, wayStars, ridge, motes, buf: new Float32Array(1024) };
  },

  draw(api, st) {
    const { ctx, w, h, t } = api;
    const narrow = w / h < 1.6;
    const compact = api.compact;
    const th = (TAU * t) / D;
    const drift = Math.sin(th) * api.s(4); // slow camera drift (parallax by layer)

    // ---- Layout ----
    const horizon = h * (narrow ? 0.8 : 0.79);
    const ridgeY = (fx) => {
      const i = clamp(fx, 0, 1) * 40;
      const k = Math.floor(i);
      const f = i - k;
      return horizon + lerp(st.ridge[Math.min(k, 40)], st.ridge[Math.min(k + 1, 40)], f) * h;
    };
    const dishR = h * (narrow ? 0.17 : 0.2);
    const dishX = w * (narrow ? 0.2 : 0.17) + drift * 1.4;
    const groundAtDish = h * (narrow ? 0.94 : 0.93);
    const elev = 0.9; // dish elevation (rad)
    const tagClear = w > 520 ? 56 : 0;
    const panel = narrow
      ? { x: w * 0.05, y: Math.max(h * 0.05, tagClear), w: w * 0.9, h: h * 0.36 }
      : { x: w * 0.585, y: h * 0.085, w: w * 0.37, h: h * 0.47 };

    // ---- Sky ----
    const sg = ctx.createLinearGradient(0, 0, 0, horizon);
    sg.addColorStop(0, SKY[0]);
    sg.addColorStop(0.45, SKY[1]);
    sg.addColorStop(0.85, SKY[2]);
    sg.addColorStop(1, SKY[3]);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    // Faint warm glow of a distant town behind the towers.
    const tg = ctx.createRadialGradient(w * 0.78, horizon, 0, w * 0.78, horizon, w * 0.45);
    tg.addColorStop(0, 'rgba(255,170,110,0.13)');
    tg.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, w, horizon + 4);

    // ---- Milky Way ----
    const wayA = [w * -0.05 + drift * 0.3, horizon * 0.95];
    const wayB = [w * (narrow ? 0.95 : 0.62) + drift * 0.3, -h * 0.05];
    const wx = wayB[0] - wayA[0];
    const wy = wayB[1] - wayA[1];
    const wl = Math.hypot(wx, wy);
    const nx = -wy / wl;
    const ny = wx / wl;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of st.way) {
      const x = wayA[0] + wx * b.s + nx * b.off * wl;
      const y = wayA[1] + wy * b.s + ny * b.off * wl;
      const rad = b.rad * wl;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(160,150,210,${0.085 * b.a})`);
      g.addColorStop(1, 'rgba(150,140,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
    for (const s of st.wayStars) {
      const x = wayA[0] + wx * s.s + nx * s.off * wl;
      const y = wayA[1] + wy * s.s + ny * s.off * wl;
      if (y > horizon) continue;
      ctx.fillStyle = `rgba(222,218,248,${0.5 * s.b})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // ---- Stars ----
    for (const s of st.stars) {
      const y = s.y * horizon;
      const x = s.x * w + drift * 0.2;
      const tw = 0.7 + 0.3 * Math.sin(th * s.n + s.ph);
      const a = (0.25 + 0.75 * s.b) * tw;
      const rad = 0.5 + s.b * 1.1;
      ctx.fillStyle = `rgba(236,234,250,${a})`;
      if (rad < 0.9) ctx.fillRect(x, y, 1, 1);
      else {
        ctx.beginPath();
        ctx.arc(x, y, rad * api.s(1) * 0.9, 0, TAU);
        ctx.fill();
      }
    }

    // ---- Dish geometry (needed for the sky target) ----
    const ax = Math.cos(elev);
    const ay = -Math.sin(elev);
    const pedTop = groundAtDish - dishR * 0.95;
    const E = [dishX, pedTop - dishR * 0.12];
    const C = [E[0] + ax * dishR * 0.5, E[1] + ay * dishR * 0.5];
    const feed = [C[0] + ax * dishR * 0.66, C[1] + ay * dishR * 0.66];
    // The source the telescope is pointed at, and its faint signal arriving.
    const tgtD = narrow ? h * 0.42 : h * 0.5;
    const tgt = [feed[0] + ax * tgtD, feed[1] + ay * tgtD];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(tgt[0], tgt[1]);
    ctx.rotate(-0.5);
    ctx.scale(1, 0.42);
    const gr = api.s(16);
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
    gg.addColorStop(0, 'rgba(240,226,255,0.55)');
    gg.addColorStop(0.25, 'rgba(200,170,240,0.22)');
    gg.addColorStop(1, 'rgba(200,170,240,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(-gr, -gr, gr * 2, gr * 2);
    ctx.restore();
    for (const m of st.motes) {
      const u = fract(t / (D / 4) + m.ph);
      const x = lerp(tgt[0], feed[0], u) + m.off * api.s(5) * (1 - u);
      const y = lerp(tgt[1], feed[1], u) + m.off * api.s(3) * (1 - u);
      ctx.fillStyle = `rgba(230,220,255,${0.45 * Math.sin(Math.PI * u)})`;
      ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }

    // ---- Transmitters: positions and state ----
    const txs = TX.map((tx, i) => {
      let x;
      let y;
      let vis = 1;
      if (tx.kind === 'tower') {
        x = w * tx.x + drift * 0.6;
        y = ridgeY(tx.x) - h * tx.hgt;
      } else {
        const p = seg(t, tx.t0, tx.t1);
        const path = narrow ? [[-0.04, 0.6], [1.04, 0.43]] : [[-0.03, 0.42], [0.57, 0.04]];
        x = w * lerp(path[0][0], path[1][0], p) + drift * 0.4;
        y = h * lerp(path[0][1], path[1][1], p) - Math.sin(Math.PI * p) * h * 0.03;
        vis = seg(t, tx.t0, tx.t0 + 0.4) * (1 - seg(t, tx.t1 - 0.4, tx.t1));
      }
      const act = smooth(seg(t, tx.on, tx.on + 1.0)) * (1 - smooth(seg(t, END_FADE[0] + i * 0.15, END_FADE[1]))) * vis;
      return { ...tx, x, y, vis, act };
    });
    // Notice wavefront: screen-space rings from the feed.
    const vN = Math.max(w, h * 1.4) * 0.55;
    for (const tx of txs) {
      let tr = NOTICE_T;
      if (tx.kind === 'tower') tr = NOTICE_T + Math.hypot(tx.x - feed[0], tx.y - feed[1]) / vN;
      else {
        // The satellite moves while the notice travels: settle the meeting time.
        tr = NOTICE_T + Math.hypot(tx.x - feed[0], tx.y - feed[1]) / vN;
        for (let k = 0; k < 3; k++) {
          const p = seg(tr, tx.t0, tx.t1);
          const path = narrow ? [[-0.04, 0.6], [1.04, 0.43]] : [[-0.03, 0.42], [0.57, 0.04]];
          const sx = w * lerp(path[0][0], path[1][0], p);
          const sy = h * lerp(path[0][1], path[1][1], p) - Math.sin(Math.PI * p) * h * 0.03;
          tr = NOTICE_T + Math.hypot(sx - feed[0], sy - feed[1]) / vN;
        }
      }
      tx.tr = tr;
      tx.notch = tx.ok ? smooth(seg(t, tr + 0.15, tr + 0.8)) : 0;
      tx.cancel = tx.ok ? 0 : smooth(seg(t, PROJ_T[0] + 0.35, PROJ_T[1]));
      if (tx.kind === 'sat') tx.u = lerp(tx.u0, tx.u1, seg(t, tx.t0, tx.t1));
    }

    // ---- Satellites ----
    for (const tx of txs) {
      if (tx.kind !== 'sat' || tx.vis <= 0) continue;
      drawSat(api, tx, t);
    }
    // A second, silent satellite streaking past late in the loop.
    {
      const p = seg(t, 11.6, 14.6);
      if (p > 0 && p < 1) {
        const path = narrow ? [[1.04, 0.52], [-0.04, 0.38]] : [[0.5, 0.0], [-0.04, 0.32]];
        const x = w * lerp(path[0][0], path[1][0], p);
        const y = h * lerp(path[0][1], path[1][1], p);
        const tl = api.s(26);
        const dx = (path[1][0] - path[0][0]) * w;
        const dy = (path[1][1] - path[0][1]) * h;
        const dl = Math.hypot(dx, dy);
        const a = Math.sin(Math.PI * p) * 0.7;
        const g = ctx.createLinearGradient(x, y, x - (dx / dl) * tl, y - (dy / dl) * tl);
        g.addColorStop(0, `rgba(235,235,250,${a})`);
        g.addColorStop(1, 'rgba(235,235,250,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1, api.s(1.2));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (dx / dl) * tl, y - (dy / dl) * tl);
        ctx.stroke();
      }
    }

    // ---- Far ridge with towers ----
    ctx.beginPath();
    ctx.moveTo(-10, h + 10);
    for (let i = 0; i <= 40; i++) ctx.lineTo((i / 40) * w + drift * 0.6, ridgeY(i / 40));
    ctx.lineTo(w + 10, h + 10);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, horizon - h * 0.03, 0, h);
    rg.addColorStop(0, '#0C0E1E');
    rg.addColorStop(1, '#05060C');
    ctx.fillStyle = rg;
    ctx.fill();
    for (const tx of txs) if (tx.kind === 'tower') drawTower(api, tx, ridgeY, t);

    // Interference radiating from active transmitters.
    for (const tx of txs) {
      if (tx.act <= 0.01 || tx.vis <= 0) continue;
      const strong = tx.ok ? 1 - 0.6 * tx.notch : 1;
      for (let k = 0; k < 4; k++) {
        const u = fract((t - tx.on) / 1.1 + k / 4);
        const rr = api.s(6) + u * api.s(tx.kind === 'sat' ? 30 : 44);
        const a = (1 - u) * 0.5 * tx.act * strong * tx.vis;
        ctx.strokeStyle = col(AMBER, a);
        ctx.lineWidth = Math.max(1, api.s(1.2));
        ctx.beginPath();
        if (tx.kind === 'tower') ctx.arc(tx.x, tx.y + api.s(4), rr, Math.PI * 0.95, Math.PI * 2.05);
        else ctx.arc(tx.x, tx.y, rr, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
    }

    // ---- Near ground and the telescope ----
    ctx.beginPath();
    ctx.moveTo(-10, h + 10);
    ctx.lineTo(-10, groundAtDish - h * 0.05);
    ctx.bezierCurveTo(w * 0.08 + drift, groundAtDish - h * 0.045, dishX - dishR * 0.6, groundAtDish - h * 0.01, dishX, groundAtDish);
    ctx.bezierCurveTo(dishX + dishR * 1.4, groundAtDish + h * 0.012, w * 0.42 + drift, h * 0.975, w * 0.62, h + 10);
    ctx.closePath();
    ctx.fillStyle = '#030409';
    ctx.fill();
    drawDish(api, { E, C, feed, ax, ay, R: dishR, groundAtDish, x: dishX });

    // ---- Notice: purple wavefronts from the feed ----
    const nt = t - NOTICE_T;
    if (nt > -0.3 && nt < 3.2) {
      const fl = seg(nt, -0.3, 0) * (1 - seg(nt, 0.1, 0.9));
      if (fl > 0) api.light(feed[0], feed[1], api.s(40), '#C58BE6', 0.9 * fl);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, horizon + h * 0.01);
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const rr = (nt - k * 0.22) * vN;
        if (rr <= 0) continue;
        const a = Math.pow(clamp(1 - rr / (Math.max(w, h) * 1.25)), 1.1) * (1 - k * 0.28);
        ctx.beginPath();
        ctx.arc(feed[0], feed[1], rr, 0, TAU);
        ctx.strokeStyle = col(PURPLE, 0.16 * a);
        ctx.lineWidth = api.s(6);
        ctx.stroke();
        ctx.strokeStyle = col(PURPLE_HI, 0.75 * a);
        ctx.lineWidth = Math.max(1, api.s(1.5));
        ctx.stroke();
      }
      ctx.restore();
    }
    // Acknowledgements from compliant transmitters.
    for (const tx of txs) {
      if (!tx.ok || tx.vis <= 0) continue;
      const dt = t - tx.tr;
      if (dt < 0 || dt > 1.2) continue;
      const a = 1 - seg(dt, 0.2, 1.2);
      api.light(tx.x, tx.y, api.s(22), '#C58BE6', 0.8 * a);
      ctx.strokeStyle = col(PURPLE_HI, 0.8 * a);
      ctx.lineWidth = Math.max(1, api.s(1.3));
      ctx.beginPath();
      ctx.arc(tx.x, tx.y, api.s(6) + ease.out(seg(dt, 0, 1)) * api.s(14), 0, TAU);
      ctx.stroke();
    }
    // A small purple mark stays on transmitters that have notched the band.
    for (const tx of txs) {
      if (!tx.ok || tx.notch <= 0 || tx.act <= 0.02 || tx.vis <= 0) continue;
      ctx.fillStyle = col(PURPLE_HI, 0.9 * tx.notch * tx.act * tx.vis);
      ctx.beginPath();
      ctx.arc(tx.x + api.s(tx.kind === 'sat' ? 0 : 0), tx.y - api.s(tx.kind === 'sat' ? 7 : 9), api.s(2.2), 0, TAU);
      ctx.fill();
    }
    // The holdout gets bracketed while the projection removes it.
    const holdout = txs.find((tx) => !tx.ok);
    const hb = seg(t, PROJ_T[0], PROJ_T[0] + 0.3) * (1 - seg(t, PROJ_T[1] + 0.4, PROJ_T[1] + 1));
    if (holdout && hb > 0) {
      const bw = api.s(15);
      const bh = api.s(20);
      const cx = holdout.x;
      const cy = holdout.y + api.s(8);
      ctx.strokeStyle = col(PURPLE_HI, 0.9 * hb);
      ctx.lineWidth = Math.max(1, api.s(1.4));
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(cx + sx * bw, cy + sy * bh - sy * api.s(6));
        ctx.lineTo(cx + sx * bw, cy + sy * bh);
        ctx.lineTo(cx + sx * bw - sx * api.s(6), cy + sy * bh);
      }
      ctx.stroke();
    }

    // ---- Spectrum panel (HUD) ----
    drawPanel(api, st, panel, txs, narrow);

    // ---- Captions ----
    const cap = (str, x, y, t0, t1, warm) =>
      api.caption(str, clamp(x, w * 0.18, w * 0.82), y, t0, t1, { size: api.fs(10.5), bg: 'rgba(8,8,22,0.76)', border: warm ? col(AMBER, 0.6) : col(PURPLE, 0.7), color: warm ? 'rgba(250,226,200,0.92)' : 'rgba(238,224,250,0.94)' });
    // Narrow frames: one slot under the panel. Wide frames: a slot left of the panel.
    const slot = narrow ? [w * 0.5, panel.y + panel.h + api.s(16)] : [panel.x - api.s(16), panel.y + panel.h * 0.62];
    const scap = (str, t0, t1, warm) => {
      if (narrow) cap(str, slot[0], slot[1], t0, t1, warm);
      else api.caption(str, slot[0], slot[1], t0, t1, { align: 'right', size: api.fs(10.5), bg: 'rgba(8,8,22,0.76)', border: warm ? col(AMBER, 0.6) : col(PURPLE, 0.7), color: warm ? 'rgba(250,226,200,0.92)' : 'rgba(238,224,250,0.94)' });
    };
    scap(compact ? 'interference buries it' : 'interference buries the signal', 2.9, 5.3, true);
    if (narrow) scap('band notice', 5.75, 7.75);
    else cap('observatory announces its band', feed[0] + dishR * 1.3, feed[1] - dishR * 0.6, 5.75, 7.75);
    scap(compact ? 'compliant users notch out' : 'compliant users notch it out', 7.9, 9.7);
    scap(compact ? 'holdout projected out' : 'projection removes the holdout', 9.85, 12.1);

    // ---- Vignette ----
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,6,0)');
    vg.addColorStop(1, 'rgba(0,0,6,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  },
};

function hump(u, c, wd) {
  const x = (u - c) / wd;
  return Math.exp(-0.5 * x * x * x * x * 0.6 - 0.5 * x * x);
}

// Interference at frequency u after the transmitters' notches and the receiver's projection.
function interference(txs, u) {
  let s = 0;
  for (const tx of txs) {
    if (tx.act <= 0) continue;
    let v = tx.amp * hump(u, tx.u, tx.wd) * tx.act;
    if (tx.notch) v *= 1 - tx.notch * bandMask(u);
    if (tx.cancel) v *= 1 - tx.cancel;
    s += v;
  }
  return s;
}

function drawPanel(api, st, P, txs, narrow) {
  const { ctx, t } = api;
  const th = (TAU * t) / D;
  const compact = api.compact;
  // Backing.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(P.x, P.y, P.w, P.h, api.s(6));
  ctx.fillStyle = 'rgba(8,8,24,0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,200,240,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  const pad = api.s(narrow ? 10 : 14);
  const titleY = P.y + pad + api.fs(10.5) * 0.8;
  api.text('SPECTRUM AT THE DISH', P.x + pad, titleY, { size: api.fs(10.5), color: INK_DIM, weight: 600, spacing: 1.1, maxWidth: P.w * 0.56 });
  // Plot area.
  const L = { x: P.x + pad, y: titleY + api.s(narrow ? 8 : 12), w: P.w - pad * 2, h: 0 };
  L.h = P.y + P.h - pad - api.s(narrow ? 6 : 10) - L.y;
  const base = L.y + L.h;
  const X = (u) => L.x + u * L.w;
  const Y = (v) => base - clamp(v, -0.02, 1.05) * L.h * 0.92;
  // Protected band.
  const pulse = seg(t, NOTICE_T - 0.1, NOTICE_T + 0.3) * (1 - seg(t, NOTICE_T + 1.2, NOTICE_T + 2.6));
  const bx0 = X(BAND[0]);
  const bx1 = X(BAND[1]);
  ctx.fillStyle = col(PURPLE, 0.1 + 0.12 * pulse);
  ctx.fillRect(bx0, L.y, bx1 - bx0, L.h);
  ctx.save();
  ctx.setLineDash([api.s(3), api.s(3)]);
  ctx.strokeStyle = col(PURPLE, 0.55 + 0.35 * pulse);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx0 + 0.5, L.y);
  ctx.lineTo(bx0 + 0.5, base);
  ctx.moveTo(bx1 - 0.5, L.y);
  ctx.lineTo(bx1 - 0.5, base);
  ctx.stroke();
  ctx.restore();
  api.text(compact ? 'protected' : 'protected band', (bx0 + bx1) / 2, L.y + api.fs(10) * 1.05, { size: api.fs(10), color: col(PURPLE_HI, 0.9), align: 'center', weight: 600 });
  // Baseline.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(210,200,240,0.22)';
  ctx.beginPath();
  ctx.moveTo(L.x, base + 0.5);
  ctx.lineTo(L.x + L.w, base + 0.5);
  ctx.stroke();
  // Spectrum samples.
  const n = Math.min(500, Math.max(60, Math.round(L.w / Math.max(1.6, api.s(2.2)))));
  const buf = st.buf;
  const R = 5;
  const cx = Math.cos(th) * R;
  const cy = Math.sin(th) * R;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const I = interference(txs, u);
    const nz = (noise2(u * 95 + cx, cy, 3) * 0.65 + noise2(u * 210 + cy, cx + 7, 5) * 0.35) * (0.016 + 0.07 * I);
    const ln = LINE_AMP * Math.exp(-0.5 * ((u - LINE_U) / 0.011) ** 2);
    buf[k * 2] = FLOOR + ln + nz; // clean part
    buf[k * 2 + 1] = FLOOR + ln + nz + I; // total
  }
  // Interference area (amber), then the trace.
  ctx.beginPath();
  for (let k = 0; k <= n; k++) ctx.lineTo(X(k / n), Y(buf[k * 2 + 1]));
  for (let k = n; k >= 0; k--) ctx.lineTo(X(k / n), Y(buf[k * 2]));
  ctx.closePath();
  const ag = ctx.createLinearGradient(0, L.y, 0, base);
  ag.addColorStop(0, col(AMBER, 0.42));
  ag.addColorStop(1, col(AMBER, 0.12));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = ag;
  ctx.fill();
  ctx.restore();
  // The removed component, outlined while it is projected out.
  const holdout = txs.find((tx) => !tx.ok);
  const ghost = seg(t, PROJ_T[0], PROJ_T[0] + 0.3) * (1 - seg(t, PROJ_T[1], PROJ_T[1] + 1.2));
  if (holdout && ghost > 0 && holdout.act > 0) {
    ctx.save();
    ctx.setLineDash([api.s(3), api.s(3)]);
    ctx.strokeStyle = col(PURPLE_HI, 0.85 * ghost);
    ctx.lineWidth = Math.max(1, api.s(1.3));
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      ctx.lineTo(X(u), Y(FLOOR + holdout.amp * hump(u, holdout.u, holdout.wd) * holdout.act));
    }
    ctx.stroke();
    ctx.restore();
    if (t > PROJ_T[0] + 0.3 && t < PROJ_T[1] + 0.2) {
      const fx = X(holdout.u);
      api.light(fx, Y(FLOOR + holdout.amp * 0.5 * (1 - holdout.cancel)), api.s(36), '#C58BE6', 0.5 * ghost);
    }
  }
  ctx.beginPath();
  for (let k = 0; k <= n; k++) {
    const x = X(k / n);
    const y = Y(buf[k * 2 + 1]);
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.strokeStyle = col(TRACE, 0.92);
  ctx.lineWidth = Math.max(1, api.s(1.3));
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Signal of interest: marked under the axis (dim while it is buried).
  const I0 = interference(txs, LINE_U);
  const clear = 1 - clamp(I0 / 0.08);
  const lx = X(LINE_U);
  const recovered = seg(t, PROJ_T[1] - 0.2, PROJ_T[1] + 0.6) * (1 - seg(t, END_FADE[1], D));
  if (recovered > 0) api.light(lx, Y(FLOOR + LINE_AMP * 0.6), api.s(26), '#C58BE6', 0.6 * recovered * clear);
  const labA = 0.5 + 0.45 * clear;
  const labC = recovered > 0.5 ? col(PURPLE_HI, 0.95) : INK;
  const labS = compact ? 'signal' : 'signal of interest';
  const labY = base + api.s(narrow ? 12 : 15);
  ctx.strokeStyle = recovered > 0.5 ? col(PURPLE_HI, 0.8 * labA) : col(TRACE, 0.6 * labA);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx, base + api.s(2));
  ctx.lineTo(lx, base + api.s(5));
  ctx.stroke();
  api.text(labS, lx, labY, { size: api.fs(10), color: labC, align: 'center', weight: 600, alpha: labA });
  const labW = api.measure(labS, { size: api.fs(10), weight: 600 });
  const fq = 'frequency →';
  const fqW = api.measure(fq, { size: api.fs(10) });
  if (L.x + L.w - fqW > lx + labW / 2 + api.s(12)) api.text(fq, L.x + L.w, labY, { size: api.fs(10), color: INK_DIM, align: 'right' });
  // Line SNR readout (synthetic).
  const snr = 10 * Math.log10(LINE_AMP / (0.011 + I0 * 0.55));
  const sTxt = `SNR ${snr >= 0 ? '+' : '−'}${Math.abs(snr).toFixed(1)} dB`;
  api.text(sTxt, P.x + P.w - pad, titleY, { size: api.fs(10.5), color: snr > 3 ? col(PURPLE_HI, 0.95) : 'rgba(250,214,180,0.92)', weight: 600, align: 'right' });
}

function drawSat(api, tx, t) {
  const { ctx } = api;
  const a = tx.vis;
  // Trail.
  const tl = api.s(34);
  const g = ctx.createLinearGradient(tx.x, tx.y, tx.x - tl, tx.y + tl * 0.55);
  g.addColorStop(0, `rgba(235,235,250,${0.5 * a})`);
  g.addColorStop(1, 'rgba(235,235,250,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(1, api.s(1.2));
  ctx.beginPath();
  ctx.moveTo(tx.x, tx.y);
  ctx.lineTo(tx.x - tl, tx.y + tl * 0.55);
  ctx.stroke();
  // Body and panels.
  const s = api.s(3.2);
  ctx.fillStyle = `rgba(236,236,250,${a})`;
  ctx.fillRect(tx.x - s * 0.5, tx.y - s * 0.5, s, s);
  ctx.fillStyle = `rgba(150,160,210,${0.9 * a})`;
  ctx.fillRect(tx.x - s * 2.3, tx.y - s * 0.3, s * 1.5, s * 0.6);
  ctx.fillRect(tx.x + s * 0.8, tx.y - s * 0.3, s * 1.5, s * 0.6);
  if (tx.act > 0.02) api.light(tx.x, tx.y, api.s(16), '#E8A054', 0.5 * tx.act * a * (tx.ok ? 1 - 0.5 * tx.notch : 1));
  void t;
}

function drawTower(api, tx, ridgeY, t) {
  const { ctx, h } = api;
  const baseY = ridgeY(tx.x / api.w) + h * 0.004;
  const H = baseY - tx.y;
  const x = tx.x;
  const bw = H * 0.1;
  const tw = H * 0.025;
  ctx.strokeStyle = 'rgba(70,72,104,0.95)';
  ctx.lineWidth = Math.max(1, api.s(1.1));
  ctx.beginPath();
  ctx.moveTo(x - bw, baseY);
  ctx.lineTo(x - tw, tx.y);
  ctx.moveTo(x + bw, baseY);
  ctx.lineTo(x + tw, tx.y);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.6, api.s(0.7));
  ctx.beginPath();
  const lv = 6;
  for (let k = 0; k < lv; k++) {
    const y0 = baseY - (H * k) / lv;
    const y1 = baseY - (H * (k + 1)) / lv;
    const w0 = lerp(bw, tw, k / lv);
    const w1 = lerp(bw, tw, (k + 1) / lv);
    ctx.moveTo(x - w0, y0);
    ctx.lineTo(x + w1, y1);
    ctx.moveTo(x + w0, y0);
    ctx.lineTo(x - w1, y1);
  }
  ctx.stroke();
  // Antenna panels near the top.
  ctx.fillStyle = 'rgba(80,82,116,0.95)';
  const py = tx.y + H * 0.08;
  const pw = Math.max(1.5, api.s(2.2));
  const ph = Math.max(3, H * 0.13);
  ctx.fillRect(x - tw - pw * 1.6, py, pw, ph);
  ctx.fillRect(x + tw + pw * 0.6, py, pw, ph);
  ctx.fillRect(x - pw / 2, py - ph * 0.25, pw, ph);
  // Red aviation beacon.
  const blink = 0.35 + 0.65 * Math.max(0, Math.sin((TAU * t * 6) / D + tx.x * 9)) ** 6;
  api.light(x, tx.y - api.s(2), api.s(10), '#FF4A3A', 0.7 * blink);
  ctx.fillStyle = `rgba(255,110,96,${0.6 + 0.4 * blink})`;
  ctx.beginPath();
  ctx.arc(x, tx.y - api.s(2), Math.max(1, api.s(1.4)), 0, TAU);
  ctx.fill();
}

function drawDish(api, d) {
  const { ctx } = api;
  const { E, C, feed, ax, ay, R, groundAtDish, x } = d;
  const px = -ay; // in-plane direction across the dish
  const py = ax;
  const rot = Math.atan2(py, px);
  const K = 0.32; // foreshortening of the rim
  const rim = (ang, k = 1) => {
    const lx = Math.cos(ang) * R * k;
    const ly = Math.sin(ang) * R * K * k;
    return [C[0] + px * lx + ax * ly, C[1] + py * lx + ay * ly];
  };
  // Pedestal and turntable.
  const pedTop = E[1] + R * 0.34;
  const pg = ctx.createLinearGradient(x - R * 0.3, 0, x + R * 0.3, 0);
  pg.addColorStop(0, '#1A1D36');
  pg.addColorStop(0.4, '#0E1022');
  pg.addColorStop(1, '#07080F');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(x - R * 0.17, pedTop);
  ctx.lineTo(x + R * 0.17, pedTop);
  ctx.lineTo(x + R * 0.27, groundAtDish + 2);
  ctx.lineTo(x - R * 0.27, groundAtDish + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#13162C';
  ctx.fillRect(x - R * 0.34, pedTop - R * 0.07, R * 0.68, R * 0.08);
  // Far yoke arm.
  ctx.fillStyle = '#0A0C1A';
  ctx.beginPath();
  ctx.moveTo(x + R * 0.08, pedTop - R * 0.07);
  ctx.lineTo(x + R * 0.3, pedTop - R * 0.07);
  ctx.lineTo(E[0] + R * 0.1, E[1] - R * 0.02);
  ctx.lineTo(E[0] - R * 0.02, E[1] + R * 0.04);
  ctx.closePath();
  ctx.fill();
  // Backup structure: the convex back of the reflector and its truss.
  ctx.save();
  ctx.translate(C[0] - ax * R * 0.22, C[1] - ay * R * 0.22);
  ctx.rotate(rot);
  ctx.fillStyle = '#0B0D1B';
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.97, R * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(95,95,140,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const ang of [0.55, 1.2, 1.95, 2.6]) {
    const p = rim(ang + Math.PI * 0.02, 0.95);
    ctx.moveTo(p[0] - ax * R * 0.1, p[1] - ay * R * 0.1);
    ctx.lineTo(E[0], E[1]);
  }
  ctx.stroke();
  // Near yoke arm.
  const yg = ctx.createLinearGradient(x - R * 0.3, 0, x, 0);
  yg.addColorStop(0, '#22264A');
  yg.addColorStop(1, '#0F1124');
  ctx.fillStyle = yg;
  ctx.beginPath();
  ctx.moveTo(x - R * 0.3, pedTop - R * 0.07);
  ctx.lineTo(x - R * 0.06, pedTop - R * 0.07);
  ctx.lineTo(E[0] + R * 0.02, E[1] + R * 0.05);
  ctx.lineTo(E[0] - R * 0.12, E[1] + R * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2A2E55';
  ctx.beginPath();
  ctx.arc(E[0] - R * 0.05, E[1] + R * 0.03, R * 0.06, 0, TAU);
  ctx.fill();
  // Reflector surface: concave, darker toward the vertex, lit along the upper rim.
  ctx.save();
  ctx.translate(C[0], C[1]);
  ctx.rotate(rot);
  ctx.save();
  ctx.scale(1, K);
  const g = ctx.createRadialGradient(R * 0.25, R * 0.35, R * 0.1, 0, 0, R * 1.02);
  g.addColorStop(0, '#15172E');
  g.addColorStop(0.6, '#262A4C');
  g.addColorStop(1, '#4A4E7A');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  // Panel seams: rings and radial ribs.
  ctx.strokeStyle = 'rgba(170,165,225,0.13)';
  ctx.lineWidth = 1 / K;
  ctx.beginPath();
  for (const k of [0.36, 0.68]) {
    ctx.moveTo(R * k, 0);
    ctx.arc(0, 0, R * k, 0, TAU);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(170,165,225,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * TAU;
    ctx.moveTo(Math.cos(ang) * R * 0.12, Math.sin(ang) * R * K * 0.12);
    ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R * K);
  }
  ctx.stroke();
  // Rim, brighter where it faces the sky.
  const rg = ctx.createLinearGradient(0, -R * K, 0, R * K);
  rg.addColorStop(0, 'rgba(225,215,255,0.7)');
  rg.addColorStop(1, 'rgba(160,150,210,0.25)');
  ctx.strokeStyle = rg;
  ctx.lineWidth = Math.max(1, R * 0.022);
  ctx.beginPath();
  ctx.ellipse(0, 0, R, R * K, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  // Quadrupod feed legs and the receiver cabin at the focus.
  ctx.strokeStyle = 'rgba(165,160,215,0.6)';
  ctx.lineWidth = Math.max(1, R * 0.018);
  ctx.beginPath();
  for (const ang of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
    const p = rim(ang, 0.9);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(feed[0], feed[1]);
  }
  ctx.stroke();
  ctx.save();
  ctx.translate(feed[0], feed[1]);
  ctx.rotate(Math.atan2(ay, ax));
  ctx.fillStyle = '#1E2140';
  ctx.fillRect(-R * 0.09, -R * 0.065, R * 0.16, R * 0.13);
  ctx.fillStyle = 'rgba(200,190,240,0.5)';
  ctx.fillRect(R * 0.07, -R * 0.04, R * 0.025, R * 0.08);
  ctx.restore();
}
