// Hidden in Plain Sight: Communicating using Interference (DySPAN 2025).
// Spectra watermarks an interfering transmitter: a LEO satellite sends key packets
// slightly early or late around expected symbol times. The radio observatory never
// demodulates them; it only timestamps arrivals, reads early = 0 / late = 1, and uses
// forward error correction to undo the bit that a channel fade corrupted.
import { seg, win, ease, lerp, clamp, noise1 } from './kit.js';

const D = 14;
const DATA = [1, 0, 1, 0, 0, 1, 1, 1]; // watermark byte 0xA7
const PARITY = [0, 1, 1, 0]; // synthetic parity bits
const BITS = [...DATA, ...PARITY];
const N = BITS.length;
const ST = 0.7; // seconds per Spectra symbol
const T0 = 1.0;
const T_END = T0 + N * ST;
const SHIFT = 0.21; // early/late shift, in symbol periods
const BAD = 5; // symbol hit by the deep fade
const FEC = [T_END + 0.35, T_END + 1.35];
const ID_T = FEC[1] + 0.25;
const FLY = 0.45; // satellite → dish travel time (drawn, not to scale)

export default {
  duration: D,
  still: 11.4,
  scene: false,

  init(api) {
    const r = api.rng('spectra');
    const keys = BITS.map((b, k) => {
      let off = (b ? 1 : -1) * SHIFT + r.range(-0.03, 0.03);
      if (k === BAD) off = -SHIFT * 0.9; // the fade's timing jitter lands it in the wrong window
      return { k, b, off, t: T0 + (k + 0.5 + off) * ST };
    });
    // Ordinary traffic that passes through unshifted, outside the symbol windows.
    const others = [];
    for (let k = 0; k < N; k++) {
      const n = r() < 0.55 ? 1 : r() < 0.6 ? 2 : 0;
      for (let j = 0; j < n; j++) {
        const u = n === 1 ? r.range(0.92, 1.06) : j === 0 ? r.range(0.87, 0.92) : r.range(1.05, 1.12);
        if (k === N - 1 && u > 1) continue;
        others.push({ t: T0 + (k + u) * ST });
      }
    }
    const packets = [...keys.map((p) => ({ ...p, key: true })), ...others.map((p) => ({ ...p, key: false }))];
    return { keys, packets };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const onAccent = pal.dark ? '#0A0B0F' : '#fff';
    const soft = pal.dark ? 'rgba(233,235,239,0.06)' : 'rgba(20,22,28,0.05)';

    // ---- Channel gain over the pass (rises with elevation, deep fade at BAD) ----
    const tBad = T0 + (BAD + 0.5) * ST;
    const gain = (tt) => {
      const p = clamp((tt - 0.4) / (T_END + 0.2));
      const elev = 0.62 + 0.3 * Math.sin(Math.PI * p);
      const dip = 0.74 * Math.exp(-Math.pow((tt - tBad + 0.1) / (0.3 * ST), 2));
      return clamp(elev + 0.08 * noise1(tt * 2.1, 7) - dip, 0.08, 1);
    };

    // ---- Sky: satellite pass over the observatory ----
    const groundY = h * (compact ? 0.37 : 0.41);
    const cxA = w * 0.5;
    const RX = w * (compact ? 0.41 : 0.39);
    const RY = groundY - h * (compact ? 0.08 : 0.17);
    const pass = (tt) => lerp(Math.PI * 0.94, Math.PI * 0.06, clamp((tt - 0.2) / (T_END + 0.5)));
    const satAt = (tt) => {
      const a = pass(tt);
      return [cxA + RX * Math.cos(a), groundY - RY * Math.sin(a)];
    };
    const track = [];
    for (let i = 0; i <= 56; i++) {
      const a = lerp(Math.PI * 0.97, Math.PI * 0.03, i / 56);
      track.push([cxA + RX * Math.cos(a), groundY - RY * Math.sin(a)]);
    }
    api.line(track, { color: pal.line, width: 1, dash: [api.s(2), api.s(5)] });
    api.line([[w * 0.05, groundY], [w * 0.95, groundY]], { color: pal.line, width: 1 });
    const [sx, sy] = satAt(t);
    const dsc = compact ? 1.05 : 1.45;
    const feed = [cxA, groundY - api.s(16 * dsc)];
    // Transmissions: a faint beam while each packet travels to the dish.
    for (const p of st.packets) {
      const q = (t - (p.t - FLY)) / FLY;
      if (q <= 0 || q >= 1) continue;
      const [x0, y0] = satAt(p.t - FLY);
      const x = lerp(x0, feed[0], ease.inOut(q));
      const y = lerp(y0, feed[1], ease.inOut(q));
      if (p.key) {
        api.line([[x0, y0], [x, y]], { color: api.accent, width: api.s(1.4), alpha: 0.25 });
        api.circle(x, y, api.s(3.4), { fill: api.accent, alpha: 0.3 + 0.7 * gain(p.t) });
      } else {
        api.line([[x0, y0], [x, y]], { color: pal.ink3, width: 1, alpha: 0.35 });
        api.circle(x, y, api.s(2.4), { fill: pal.ink3 });
      }
    }
    drawSatellite(api, sx, sy, compact ? 1.15 : 1.5, (pass(t) - Math.PI / 2) * 0.3);
    drawDish(api, cxA, groundY, Math.atan2(sy - feed[1], sx - feed[0]), dsc);
    if (!compact) {
      lab('LEO SATELLITE', sx, sy - api.s(24), { align: 'center' });
      lab('RADIO OBSERVATORY', cxA + api.s(34), groundY - api.s(7));
    }

    // ---- Arrival lane: timestamps against expected symbol times ----
    const ax0 = w * (compact ? 0.05 : 0.07);
    const ax1 = w * (compact ? 0.95 : 0.93);
    const sp = (ax1 - ax0) / N;
    const xT = (tt) => ax0 + ((tt - T0) / (N * ST)) * (ax1 - ax0);
    const axisY = h * (compact ? 0.63 : 0.68);
    const laneH = h * (compact ? 0.17 : 0.155);
    const top = axisY - laneH;
    const cursorT = clamp(t, T0, T_END);
    lab(compact ? 'ARRIVALS' : 'ARRIVALS · TIMESTAMPS ONLY, PAYLOAD UNREAD', ax0, top - api.s(compact ? 7 : 11));
    // Expected symbol times (from the shared schedule).
    for (let k = 0; k < N; k++) {
      const cx = ax0 + (k + 0.5) * sp;
      api.line([[cx, top + api.s(2)], [cx, axisY]], { color: pal.ink3, width: 1, dash: [api.s(2), api.s(3)], alpha: 0.8 });
      api.line([[cx, axisY - api.s(3)], [cx, axisY + api.s(4)]], { color: pal.ink2, width: 1 });
    }
    // Received-power envelope over the lane, revealed as time passes.
    const env = [];
    for (let i = 0; i <= 140; i++) {
      const tt = T0 + (i / 140) * N * ST;
      if (tt > cursorT + 1e-6) break;
      env.push([xT(tt), axisY - gain(tt) * laneH]);
    }
    if (env.length > 1) {
      api.line([...env, [env[env.length - 1][0], axisY], [env[0][0], axisY]], { color: 'none', fill: soft, close: true });
      api.line(env, { color: pal.ink3, width: api.s(1.3) });
    }
    api.line([[ax0, axisY], [ax1, axisY]], { color: pal.ink3, width: 1 });
    // Arrivals: hatched packets (never demodulated), height = received power, stamped at the leading edge.
    const pw = Math.max(3, sp * 0.11);
    for (const p of st.packets) {
      const a = ease.out(seg(t, p.t, p.t + 0.2));
      if (a <= 0) continue;
      const x = xT(p.t);
      const g = gain(p.t);
      const ph = laneH * g * 0.92 * a;
      hatched(api, x, axisY - ph, pw, ph, p.key ? api.accent : pal.ink3, p.key ? 0.5 + 0.5 * g : 0.75);
      if (p.key) {
        const cx = ax0 + (p.k + 0.5) * sp;
        const ay = axisY + api.s(compact ? 6 : 9);
        api.arrow(cx, ay, x, ay, { color: api.accent, width: api.s(1.8), head: api.s(compact ? 6 : 6.5), alpha: a });
      }
    }
    const curA = Math.min(seg(t, T0 - 0.3, T0), 1 - seg(t, T_END, T_END + 0.4));
    if (curA > 0) api.line([[xT(cursorT), top - api.s(2)], [xT(cursorT), axisY + api.s(4)]], { color: pal.ink, width: 1, alpha: 0.6 * curA });
    if (!compact) lab('expected', ax0 + 0.5 * sp, axisY + api.s(25), { align: 'center' });

    // ---- Decoded bits, FEC, watermark ----
    const bitY = h * (compact ? 0.775 : 0.8);
    const cw = Math.min(sp * 0.72, api.s(30));
    const ch = h * (compact ? 0.09 : 0.066);
    const fecX = lerp(ax0 - api.s(6), ax1 + api.s(6), ease.inOut(seg(t, FEC[0], FEC[1])));
    for (const p of st.keys) {
      const cx = ax0 + (p.k + 0.5) * sp;
      const a = ease.out(seg(t, p.t + 0.12, p.t + 0.4));
      const parity = p.k >= DATA.length;
      const got = p.off > 0 ? 1 : 0;
      const wrong = got !== p.b;
      const fixed = wrong && t >= FEC[0] && fecX > cx;
      let fill = pal.surface;
      let stroke = parity ? pal.ink3 : pal.ink3;
      let tc = parity ? pal.ink2 : pal.ink;
      let val = got;
      if (a > 0 && wrong && !fixed) { fill = pal.ink2; stroke = pal.ink2; tc = pal.bg; }
      if (fixed) { fill = api.accent; stroke = api.accent; tc = onAccent; val = p.b; }
      const dash = parity && a > 0 && !fixed ? [api.s(2.5), api.s(2)] : undefined;
      api.rect(cx - cw / 2, bitY - ch / 2, cw, ch, { fill: a > 0 ? fill : 'transparent', stroke: a > 0 ? stroke : pal.grid, width: 1, r: api.s(3), dash });
      if (a > 0) api.text(String(val), cx, bitY + api.fs(13) * 0.36, { size: api.fs(13), weight: 650, align: 'center', color: tc, alpha: fixed ? 1 : a });
    }
    if (t > FEC[0] && t < FEC[1] + 0.25) {
      const a = 1 - seg(t, FEC[1] - 0.1, FEC[1] + 0.25);
      api.line([[fecX, bitY - ch * 0.95], [fecX, bitY + ch * 0.95]], { color: pal.ink, width: api.s(2), alpha: a });
    }
    const resY = h * (compact ? 0.94 : 0.925);
    const dL = ax0 + 0.5 * sp - cw / 2;
    const dR = ax0 + (DATA.length - 0.5) * sp + cw / 2;
    const pL = ax0 + (DATA.length + 0.5) * sp - cw / 2;
    const pR = ax0 + (N - 0.5) * sp + cw / 2;
    const bkY = bitY + ch / 2 + api.s(5);
    const idA = ease.out(seg(t, ID_T, ID_T + 0.5));
    api.line([[dL, bkY], [dL, bkY + api.s(3)], [dR, bkY + api.s(3)], [dR, bkY]], { color: idA > 0 ? api.accent : pal.line, width: 1 });
    api.line([[pL, bkY], [pL, bkY + api.s(3)], [pR, bkY + api.s(3)], [pR, bkY]], { color: pal.line, width: 1 });
    lab(compact ? 'FEC' : 'FEC parity', (pL + pR) / 2, resY, { align: 'center' });
    if (idA > 0) {
      api.text(compact ? 'ID A7' : 'watermark: satellite ID A7', (dL + dR) / 2, resY + (1 - idA) * api.s(5), { size: api.fs(compact ? 12 : 13), weight: 650, align: 'center', color: api.accentInk, alpha: idA });
    } else {
      const bt = st.keys[BAD].t;
      lab(compact ? 'watermark' : 'watermark bits', (dL + dR) / 2, resY, { align: 'center', alpha: 1 - win(t, bt + 0.25, bt + 2.4, 0.2) });
    }

    // ---- Captions ----
    const firstLate = st.keys.find((p) => p.b === 1);
    api.caption('early = 0 · late = 1', compact ? ax1 : ax1, top - api.s(compact ? 12 : 15), firstLate.t + 0.15, firstLate.t + 2.2, { align: 'right', color: api.accentInk, border: api.accent, size: api.fs(11) });
    const bad = st.keys[BAD];
    api.caption(compact ? 'fade: a bit flips' : 'deep fade: jitter flips a bit', clamp(xT(bad.t), ax0 + api.s(compact ? 70 : 100), ax1 - api.s(compact ? 70 : 100)), resY - api.s(4), bad.t + 0.35, bad.t + 2.3, { color: pal.ink, border: pal.ink3, size: api.fs(11) });
    api.caption(compact ? 'FEC fixes it' : 'FEC corrects the flipped bit', compact ? (pL + pR) / 2 - api.s(20) : (pL + pR) / 2 - api.s(30), resY - api.s(4), FEC[0] + 0.25, FEC[1] + 1.4, { color: api.accentInk, border: api.accent, size: api.fs(11) });

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

// A packet whose payload is hatched: the observatory never decodes it.
function hatched(api, x, y, pw, ph, color, a) {
  const { ctx } = api;
  if (ph <= 0.5) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.rect(x, y, pw, ph);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();
  ctx.beginPath();
  const step = Math.max(2.5, api.s(3.4));
  for (let d = -ph; d < pw + ph; d += step) {
    ctx.moveTo(x + d, y + ph);
    ctx.lineTo(x + d + ph, y);
  }
  ctx.stroke();
  ctx.restore();
  // Leading edge = the timestamp.
  api.line([[x, y], [x, y + ph]], { color, width: Math.max(1.4, api.s(2)), alpha: a, cap: 'butt' });
}

function drawSatellite(api, x, y, k, tilt) {
  const { ctx, pal } = api;
  const s = api.s(k);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.ink2;
  // Booms and solar panels.
  ctx.beginPath();
  ctx.moveTo(-9 * s, 0);
  ctx.lineTo(9 * s, 0);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const px = side > 0 ? 8 * s : -21 * s;
    ctx.beginPath();
    ctx.rect(px, -4.5 * s, 13 * s, 9 * s);
    ctx.fillStyle = pal.surface;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(px + (i * 13 * s) / 3, -4.5 * s);
      ctx.lineTo(px + (i * 13 * s) / 3, 4.5 * s);
    }
    ctx.moveTo(px, 0);
    ctx.lineTo(px + 13 * s, 0);
    ctx.stroke();
  }
  // Body and downlink antenna.
  ctx.beginPath();
  ctx.roundRect(-5 * s, -5.5 * s, 10 * s, 11 * s, 1.5 * s);
  ctx.fillStyle = pal.ink2;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 5.5 * s);
  ctx.lineTo(0, 8.5 * s);
  ctx.stroke();
  ctx.restore();
}

// Radio telescope: pedestal plus a parabolic dish that tracks `ang` (screen radians).
function drawDish(api, x, y, ang, k) {
  const { ctx, pal } = api;
  const s = api.s(k);
  const pivot = [x, y - 11 * s];
  // Pedestal.
  ctx.save();
  ctx.fillStyle = pal.ink3;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y);
  ctx.lineTo(x - 2.2 * s, pivot[1]);
  ctx.lineTo(x + 2.2 * s, pivot[1]);
  ctx.lineTo(x + 7 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Dish.
  ctx.save();
  ctx.translate(pivot[0], pivot[1]);
  ctx.rotate(ang + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-15 * s, -6 * s);
  ctx.quadraticCurveTo(0, 9 * s, 15 * s, -6 * s);
  ctx.quadraticCurveTo(0, 3 * s, -15 * s, -6 * s);
  ctx.closePath();
  ctx.fillStyle = pal.ink2;
  ctx.fill();
  // Feed legs and receiver.
  ctx.strokeStyle = pal.ink3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-9 * s, -1.5 * s);
  ctx.lineTo(0, -13 * s);
  ctx.lineTo(9 * s, -1.5 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -13.5 * s, 1.9 * s, 0, Math.PI * 2);
  ctx.fillStyle = pal.ink2;
  ctx.fill();
  ctx.restore();
}
