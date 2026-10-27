// STRAP: Secure TRansfer of Association Protocol (ICCCN 2018).
// Installing several Wi-Fi IoT devices usually means typing the network password into
// each one in turn. With STRAP the installer enters it once on a "boot" device that is
// already connected; the boot device sends the credentials, encrypted, through the
// home router to every waiting device at once, and they all join together.
// Timers are illustrative: the abstract only says STRAP is faster.
import { seg, ease, lerp, clamp, mix } from './kit.js';

const D = 14;
const N = 5;
const T0 = 0.8; // both timers start
const PER = 1.7; // manual: seconds per device (move, type, join)
const MAN_DONE = T0 + N * PER;
const S_TYPE = [T0 + 0.25, T0 + 1.15]; // STRAP: type once on the boot device
const S_WIRE = [S_TYPE[1] + 0.1, S_TYPE[1] + 0.6]; // boot → router
const S_AIR = [S_WIRE[1], S_WIRE[1] + 0.75]; // router → all devices
const S_DONE = S_AIR[1] + 0.15;
const FULL = 9.4; // seconds that fill a timer bar (shared scale)

export default {
  duration: D,
  still: 10.1,
  scene: false,

  draw(api) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const acLine = pal.dark ? api.accent : mix(api.accent, api.accentInk, 0.5);
    const acEdge = pal.dark ? api.accent : mix(api.accent, api.accentInk, 0.4);
    const k = compact ? 1.25 : 1.15;

    const halves = [
      { x0: w * 0.04, x1: w * 0.47, strap: false },
      { x0: w * 0.53, x1: w * 0.96, strap: true },
    ];
    api.line([[w * 0.5, h * 0.1], [w * 0.5, h * 0.94]], { color: pal.line, width: 1, dash: [api.s(3), api.s(5)] });
    const titleY = h * (compact ? 0.09 : 0.15);
    const routerY = h * (compact ? 0.3 : 0.31);
    const devY = h * (compact ? 0.62 : 0.6);
    const barY = h * (compact ? 0.86 : 0.85);

    for (const half of halves) {
      const { x0, x1, strap } = half;
      const hw = x1 - x0;
      const rx = strap ? x0 + hw * 0.6 : x0 + hw * 0.5;
      const devX = (i) => x0 + hw * (0.1 + (i * 0.8) / (N - 1));
      const linkC = strap ? acLine : pal.ink2;
      api.text(strap ? 'STRAP' : 'MANUAL', x0 + api.s(4), titleY, { size: api.fs(compact ? 11 : 12), weight: 650, color: strap ? api.accentInk : pal.ink2, spacing: 0.6 });
      if (!compact) lab(strap ? 'enter once, all join together' : 'type the password into each', x0 + api.s(4), titleY + api.s(17));

      // Joined state per device.
      const joinAt = (i) => (strap ? S_AIR[1] : T0 + i * PER + 1.35);
      for (let i = 0; i < N; i++) {
        const p = ease.out(seg(t, joinAt(i), joinAt(i) + 0.35));
        if (p <= 0) continue;
        const ax = rx;
        const ay = routerY + api.s(8 * k);
        const bx = devX(i);
        const by = devY - api.s(13 * k);
        api.line([[ax, ay], [lerp(ax, bx, p), lerp(ay, by, p)]], { color: linkC, width: api.s(strap ? 1.8 : 1.4) });
      }
      // STRAP: encrypted credentials travelling out to every device at once.
      if (strap) {
        const q = seg(t, S_AIR[0], S_AIR[1]);
        if (q > 0 && q < 1) {
          for (let i = 0; i < N; i++) {
            const e = ease.inOut(q);
            const x = lerp(rx, devX(i), e);
            const y = lerp(routerY + api.s(8 * k), devY - api.s(13 * k), e);
            api.line([[rx, routerY + api.s(8 * k)], [x, y]], { color: acLine, width: 1, alpha: 0.45, dash: [api.s(2), api.s(3)] });
            drawLock(api, x, y, compact ? 1.05 : 1.3, api.accent, acEdge);
          }
        }
      }
      drawRouter(api, rx, routerY, k);
      if (!compact) lab('router', rx, routerY - api.s(19 * k), { align: 'center' });

      // STRAP's boot device, wired to the router.
      if (strap) {
        const bx = x0 + hw * 0.16;
        api.line([[bx + api.s(14 * k), routerY + api.s(2)], [rx - api.s(18 * k), routerY + api.s(2)]], { color: pal.ink3, width: api.s(1.6) });
        drawLaptop(api, bx, routerY + api.s(4), k);
        // Typing once.
        const nd = Math.floor(clamp(seg(t, S_TYPE[0], S_TYPE[1]) * 6.999, 0, 6));
        if (t >= S_TYPE[0] && t < S_DONE + 0.6) {
          for (let d = 0; d < nd; d++) api.circle(bx - api.s(7 * k) + d * api.s(2.8 * k), routerY - api.s(3 * k), api.s(0.9 * k), { fill: pal.ink, alpha: 1 - seg(t, S_DONE, S_DONE + 0.6) });
        }
        const wq = seg(t, S_WIRE[0], S_WIRE[1]);
        if (wq > 0 && wq < 1) drawLock(api, lerp(bx + api.s(14 * k), rx - api.s(18 * k), ease.inOut(wq)), routerY + api.s(2), compact ? 1.05 : 1.3, api.accent, acEdge);
        if (!compact) lab('boot device', bx, routerY + api.s(24 * k), { align: 'center' });
        const ca = 1 - seg(t, S_TYPE[1] + 0.1, S_TYPE[1] + 0.5);
        if (t >= T0 - 0.2 && ca > 0) drawCursor(api, bx + api.s(6 * k), routerY - api.s(1 * k), compact ? 0.9 : 1, ca * seg(t, T0 - 0.2, T0 + 0.1));
      }

      // Devices.
      for (let i = 0; i < N; i++) {
        const on = t >= joinAt(i) + 0.3;
        drawDevice(api, devX(i), devY, k, on, strap ? api.accent : pal.ink2, strap ? acEdge : pal.ink2);
      }
      if (!compact) lab('5 new IoT devices', (devX(0) + devX(N - 1)) / 2, devY + api.s(30 * k), { align: 'center' });

      // Manual: the installer types the password into one device at a time.
      if (!strap) {
        const start = [x0 + hw * 0.08, devY + api.s(34 * k)];
        let cx = start[0];
        let cy = start[1];
        let ca = seg(t, T0 - 0.2, T0 + 0.1) * (1 - seg(t, MAN_DONE, MAN_DONE + 0.4));
        for (let i = 0; i < N; i++) {
          const ti = T0 + i * PER;
          const target = [devX(i) + api.s(5 * k), devY - api.s(2 * k)];
          const prev = i === 0 ? start : [devX(i - 1) + api.s(5 * k), devY - api.s(2 * k)];
          if (t >= ti) {
            const m = ease.inOut(seg(t, ti, ti + 0.45));
            cx = lerp(prev[0], target[0], m);
            cy = lerp(prev[1], target[1], m);
          }
          // Password field above the device while typing.
          const fa = Math.min(seg(t, ti + 0.35, ti + 0.5), 1 - seg(t, ti + 1.45, ti + 1.75));
          if (fa > 0) {
            const fw = api.s(compact ? 26 : 32);
            const fh = api.s(compact ? 10 : 11);
            const fx = devX(i) - fw / 2;
            const fy = devY - api.s(31 * k) - fh / 2;
            api.rect(fx, fy, fw, fh, { fill: pal.surface, stroke: pal.ink3, width: 1, r: fh / 2, alpha: fa });
            const nd = Math.floor(clamp(seg(t, ti + 0.45, ti + 1.3) * 6.999, 0, 6));
            for (let d = 0; d < nd; d++) api.circle(fx + fw * (0.2 + d * 0.12), fy + fh / 2, api.s(1.1), { fill: pal.ink, alpha: fa });
          }
        }
        if (ca > 0) drawCursor(api, cx, cy, compact ? 0.9 : 1, ca);
      }

      // Timer (illustrative): grows while the installer is busy, stops when all have joined.
      const done = strap ? S_DONE : MAN_DONE + 0.1;
      const el = clamp(t, T0, done) - T0;
      const bx0 = x0 + api.s(4);
      const bmax = hw - api.s(8);
      const bh = api.s(compact ? 7 : 8);
      const timerA = seg(t, T0 - 0.3, T0);
      lab(compact ? 'time' : 'time (illustrative)', bx0, barY - bh / 2 - api.s(compact ? 6 : 8), { alpha: timerA });
      api.rect(bx0, barY - bh / 2, bmax, bh, { stroke: pal.line, width: 1, r: bh / 2, alpha: timerA });
      if (el > 0) api.rect(bx0, barY - bh / 2, Math.max(bh, (el / FULL) * bmax), bh, { fill: strap ? api.accent : pal.ink3, stroke: strap && !pal.dark ? acEdge : undefined, width: 1, r: bh / 2 });
      const fin = ease.back(seg(t, done, done + 0.35));
      if (fin > 0) {
        const ex = bx0 + Math.max(bh, ((done - T0) / FULL) * bmax) + api.s(compact ? 9 : 12);
        drawCheck(api, ex, barY, api.s(compact ? 6 : 7) * fin, strap ? api.accent : pal.ink3, strap ? '#14161C' : pal.surface);
      }
    }

    // ---- Captions ----
    const R = halves[1];
    const capY = (devY + barY) / 2 + api.s(compact ? 1 : 6);
    api.caption(compact ? 'encrypted, to all 5' : 'encrypted credentials reach all five at once', (R.x0 + R.x1) / 2, capY, S_WIRE[0], S_DONE + 1.6, { color: api.accentInk, border: acEdge, size: api.fs(compact ? 10 : 11) });
    api.caption(compact ? 'STRAP is faster' : 'faster than the conventional way', (R.x0 + R.x1) / 2, capY, MAN_DONE + 0.3, D - 0.6, { color: api.accentInk, border: acEdge, size: api.fs(compact ? 10 : 11) });
    const L = halves[0];
    api.caption(compact ? 'one at a time' : 'one device at a time…', (L.x0 + L.x1) / 2, capY, T0 + PER * 1.05, T0 + PER * 2.6, { color: pal.ink, border: pal.ink3, size: api.fs(compact ? 10 : 11) });

    // ---- Loop fade ----
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};

function drawRouter(api, x, y, k) {
  const { pal } = api;
  const bw = api.s(34 * k);
  const bh = api.s(13 * k);
  for (const dx of [-0.3, 0.3]) api.line([[x + dx * bw, y - bh / 2], [x + dx * bw * 1.2, y - bh / 2 - api.s(9 * k)]], { color: pal.ink2, width: api.s(1.5) });
  api.rect(x - bw / 2, y - bh / 2, bw, bh, { fill: pal.surface, stroke: pal.ink2, width: 1, r: api.s(3) });
  for (let i = 0; i < 3; i++) api.circle(x - bw * 0.24 + i * bw * 0.12, y, api.s(1.3 * k), { fill: pal.ink3 });
}

function drawLaptop(api, x, y, k) {
  const { pal } = api;
  const sw = api.s(24 * k);
  const sh = api.s(16 * k);
  api.rect(x - sw / 2, y - sh, sw, sh, { fill: pal.surface, stroke: pal.ink2, width: 1, r: api.s(2) });
  api.line([[x - sw * 0.66, y + api.s(1.5)], [x + sw * 0.66, y + api.s(1.5)]], { color: pal.ink2, width: api.s(2) });
}

// A small IoT device; its status LED lights once it has joined.
function drawDevice(api, x, y, k, on, led, edge) {
  const { pal } = api;
  const s = api.s(22 * k);
  api.rect(x - s / 2, y - s / 2, s, s, { fill: pal.surface, stroke: on ? edge : pal.ink3, width: on ? Math.max(1, api.s(1.4)) : 1, r: api.s(5 * k) });
  for (let i = 0; i < 2; i++) api.line([[x - s * 0.24, y + s * (0.05 + i * 0.17)], [x + s * 0.14, y + s * (0.05 + i * 0.17)]], { color: pal.ink3, width: 1 });
  api.circle(x + s * 0.22, y - s * 0.2, api.s(2.2 * k), { fill: on ? led : 'transparent', stroke: on ? edge : pal.ink3, width: 1 });
}

function drawLock(api, x, y, k, fill, edge) {
  const { ctx } = api;
  const s = api.s(k);
  ctx.save();
  ctx.lineWidth = Math.max(1.2, 1.5 * s);
  ctx.strokeStyle = edge;
  ctx.beginPath();
  ctx.arc(x, y - 2.5 * s, 3 * s, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
  api.rect(x - 4.5 * s, y - 2.5 * s, 9 * s, 7 * s, { fill, stroke: edge, width: 1, r: 1.5 * s });
}

function drawCursor(api, x, y, k, a) {
  const { ctx, pal } = api;
  const s = api.s(k);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 15 * s);
  ctx.lineTo(3.8 * s, 11.4 * s);
  ctx.lineTo(6.6 * s, 17 * s);
  ctx.lineTo(9 * s, 15.9 * s);
  ctx.lineTo(6.3 * s, 10.5 * s);
  ctx.lineTo(11 * s, 10.5 * s);
  ctx.closePath();
  ctx.fillStyle = pal.ink;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.surface;
  ctx.stroke();
  ctx.restore();
}

function drawCheck(api, x, y, r, fill, ink) {
  if (r <= 0.3) return;
  api.circle(x, y, r, { fill });
  api.line([[x - r * 0.42, y + r * 0.02], [x - r * 0.1, y + r * 0.34], [x + r * 0.45, y - r * 0.32]], { color: ink, width: Math.max(1.3, r * 0.28) });
}
