// Wireless Latency Shift Keying (MobiCom 2024).
// An untrusted Wi-Fi sensor never joins the network. Instead it sends spoofed NULL
// frames that make the access point buffer traffic for one wireless device (the ping
// reflector). A wired receiver on the trusted network pings that device: in a beacon
// interval with a jam its latency spikes (1), otherwise it stays low (0). The decoded
// bits let Wicket set up a separate trust association with the sensor.
import { seg, ease, lerp, clamp, noise1 } from './kit.js';

const D = 14;
const BITS = [1, 0, 1, 1, 0, 0, 1, 0];
const P = 1.0; // one beacon interval per bit (slowed down)
const T0 = 1.2;
const T_END = T0 + BITS.length * P;
const JAM = 0.55; // fraction of the interval the AP holds the reflector's frames
const DT = 0.1; // ping spacing
const A = 0.22; // wired ↔ AP travel
const B = 0.17; // AP ↔ reflector travel
const THRESH = 25; // ms
const MAXMS = 60;
const WICKET = [T_END + 0.45, T_END + 1.3];

export default {
  duration: D,
  still: 11.2,
  scene: false,

  init() {
    const jams = [];
    BITS.forEach((b, k) => {
      if (b) jams.push([T0 + k * P + 0.04, T0 + k * P + 0.04 + JAM * P]);
    });
    const pings = [];
    for (let s = 0.15; s < D - 1.2; s += DT) {
      const atAP = s + A;
      const jam = jams.find(([j0, j1]) => atAP >= j0 && atAP < j1);
      let depart = atAP;
      let slot = 0;
      if (jam) {
        slot = Math.round((atAP - jam[0]) / DT);
        depart = jam[1] + slot * 0.025; // buffered frames flush in a quick burst
      }
      const hold = depart - atAP;
      const ms = 3.5 + 1.2 * (noise1(s * 3.7, 11) + 1) + hold * 92;
      pings.push({ s, atAP, depart, hold, ms, ret: depart + 2 * B + A, jam, slot });
    }
    return { jams, pings };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });

    // ---- Network geometry ----
    const rowY = h * (compact ? 0.27 : 0.3);
    const sen = [w * (compact ? 0.09 : 0.1), rowY];
    const ap = [w * 0.47, rowY];
    const wired = [w * (compact ? 0.88 : 0.87), rowY];
    const refl = [w * 0.64, h * (compact ? 0.45 : 0.46)];
    const k = compact ? 1.35 : 1.4;
    // Trusted network boundary.
    const bL = w * 0.3;
    const bT = h * (compact ? 0.13 : 0.17);
    const bR = w * 0.965;
    const bB = h * (compact ? 0.53 : 0.555);
    api.rect(bL, bT, bR - bL, bB - bT, { stroke: pal.line, width: 1, dash: [api.s(4), api.s(4)], r: api.s(10) });
    if (!compact) lab('TRUSTED NETWORK', bL + api.s(10), bB - api.s(9));
    // Links: Ethernet to the wired receiver; Wi-Fi to the reflector.
    api.line([[ap[0] + api.s(18 * k), ap[1] + api.s(2)], [wired[0] - api.s(17 * k), wired[1] + api.s(2)]], { color: pal.ink3, width: api.s(1.6) });
    api.line([[ap[0] + api.s(6), ap[1] + api.s(8)], [refl[0] - api.s(6), refl[1] - api.s(10)]], { color: pal.line, width: 1, dash: [api.s(3), api.s(3)] });
    if (!compact) lab('ethernet', (ap[0] + wired[0]) / 2, ap[1] - api.s(8), { align: 'center' });

    // NULL frames from the sensor at the start of each jam, plus the wake-up frame at its end.
    for (const [j0, j1] of st.jams) {
      for (const [ts, n] of [[j0 - 0.32, 3], [j1 - 0.3, 1]]) {
        for (let i = 0; i < n; i++) {
          const q = seg(t, ts + i * 0.07, ts + i * 0.07 + 0.3);
          if (q <= 0 || q >= 1) continue;
          const x = lerp(sen[0] + api.s(16), ap[0] - api.s(20), ease.inOut(q));
          const y = lerp(sen[1] - api.s(2), ap[1] - api.s(2), ease.inOut(q)) - Math.sin(Math.PI * q) * api.s(8);
          api.rect(x - api.s(4), y - api.s(2.5), api.s(8), api.s(5), { fill: api.accent, r: api.s(1.5) });
        }
      }
    }
    // Buffer at the AP: pings for the reflector held during a jam.
    let held = 0;
    for (const p of st.pings) if (p.jam && t >= p.atAP && t < p.depart) held++;
    const qx = ap[0] - api.s(compact ? 22 : 28);
    const qy = ap[1] + api.s(compact ? 13 : 16);
    const cell = api.s(compact ? 5 : 5.5);
    const jamOn = st.jams.some(([j0, j1]) => t >= j0 - 0.02 && t < j1 + 0.15);
    if (jamOn || held > 0) {
      const bw = cell * 3 + api.s(4);
      api.rect(qx - bw / 2, qy, bw, cell * 2 + api.s(4), { stroke: api.accent, width: 1, dash: [api.s(2), api.s(2)], r: api.s(2) });
      for (let i = 0; i < Math.min(held, 6); i++) {
        const cx = qx - cell + (i % 3) * cell;
        const cy = qy + api.s(2) + cell / 2 + Math.floor(i / 3) * cell;
        api.circle(cx, cy, cell * 0.36, { fill: pal.ink2 });
      }
      if (!compact) lab('buffered', qx, qy + cell * 2 + api.s(16), { align: 'center', color: api.accentInk });
    }
    // Pings in flight: wired → AP → reflector → AP → wired.
    const r = api.s(compact ? 2.2 : 2.6);
    for (const p of st.pings) {
      let x;
      let y;
      if (t < p.s || t > p.ret) continue;
      if (t < p.atAP) {
        const q = (t - p.s) / A;
        x = lerp(wired[0] - api.s(17 * k), ap[0] + api.s(18 * k), q);
        y = ap[1] + api.s(2);
      } else if (t < p.depart) {
        continue; // drawn in the buffer
      } else if (t < p.depart + B) {
        const q = (t - p.depart) / B;
        x = lerp(ap[0] + api.s(6), refl[0] - api.s(6), q);
        y = lerp(ap[1] + api.s(8), refl[1] - api.s(10), q);
      } else if (t < p.depart + 2 * B) {
        const q = (t - p.depart - B) / B;
        x = lerp(refl[0] + api.s(2), ap[0] + api.s(12), q);
        y = lerp(refl[1] - api.s(10), ap[1] + api.s(8), q);
      } else {
        const q = (t - p.depart - 2 * B) / A;
        x = lerp(ap[0] + api.s(18 * k), wired[0] - api.s(17 * k), q);
        y = ap[1] + api.s(7);
      }
      api.circle(x, y, r, { fill: pal.ink2, alpha: 0.85 });
    }
    // Devices.
    drawSensor(api, sen[0], sen[1], k);
    drawAP(api, ap[0], ap[1], k);
    drawLaptop(api, refl[0], refl[1], k);
    drawDesktop(api, wired[0], wired[1], k);
    const ly = (y, d) => y + api.s(d * k);
    if (compact) {
      lab('sensor', sen[0], ly(sen[1], 26), { align: 'center' });
    } else {
      lab('untrusted', sen[0], ly(sen[1], 28), { align: 'center' });
      lab('Wi-Fi sensor', sen[0], ly(sen[1], 41), { align: 'center' });
      lab('access point', ap[0] + api.s(6), ly(ap[1], -19), { align: 'center' });
      lab('ping reflector', refl[0] + api.s(26), refl[1] + api.s(4));
      lab('wired receiver', wired[0], ly(wired[1], 30), { align: 'center' });
    }

    // ---- Latency plot ----
    const px0 = w * (compact ? 0.1 : 0.115);
    const px1 = w * 0.935;
    const pTop = h * (compact ? 0.62 : 0.645);
    const pH = h * (compact ? 0.2 : 0.2);
    const pB = pTop + pH;
    const xT = (tt) => px0 + ((tt - T0) / (T_END - T0)) * (px1 - px0);
    const yMs = (ms) => pB - (clamp(ms, 0, MAXMS) / MAXMS) * pH;
    lab(compact ? 'PING RTT' : 'PING LATENCY (ms)', px0, pTop - api.s(compact ? 8 : 10));
    for (let i = 0; i <= BITS.length; i++) {
      const x = xT(T0 + i * P);
      api.line([[x, pTop + api.s(4)], [x, pB]], { color: pal.grid, width: 1 });
    }
    api.line([[px0, pTop], [px0, pB], [px1, pB]], { color: pal.line, width: 1, cap: 'square' });
    for (const v of [0, 50]) {
      api.line([[px0 - api.s(4), yMs(v)], [px0, yMs(v)]], { color: pal.line, width: 1 });
      api.text(String(v), px0 - api.s(7), yMs(v), { size: api.fs(10), color: pal.ink3, align: 'right', base: 'middle' });
    }
    api.line([[px0, yMs(THRESH)], [px1, yMs(THRESH)]], { color: pal.ink3, width: 1, dash: [api.s(4), api.s(4)] });
    if (!compact) lab('threshold', px1 - api.s(2), yMs(THRESH) - api.s(5), { align: 'right' });
    // Measured RTT (pink: this is the channel the sensor modulates), plotted as replies return.
    const pts = [];
    for (const p of st.pings) {
      if (p.s < T0 || p.s > T_END || t < p.ret) continue;
      pts.push([xT(p.s), yMs(p.ms)]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    if (pts.length > 1) api.line(pts, { color: api.accent, width: api.s(1.8) });
    for (const q of pts) api.circle(q[0], q[1], api.s(1.7), { fill: api.accent });
    // Decoded bits under each beacon interval.
    BITS.forEach((b, i) => {
      const a = ease.out(seg(t, T0 + (i + 1) * P + 0.4, T0 + (i + 1) * P + 0.7));
      if (a <= 0) return;
      api.text(String(b), xT(T0 + (i + 0.5) * P), pB + api.s(compact ? 15 : 19), { size: api.fs(compact ? 12 : 14), weight: 650, align: 'center', color: api.accentInk, alpha: a });
    });
    if (!compact) lab('beacon intervals', px1, pB + api.s(19), { align: 'right', alpha: 1 - ease.out(seg(t, T_END - 0.6, T_END)) });

    // ---- Wicket: the decoded bits set up a new trust association ----
    const wk = seg(t, WICKET[0], WICKET[1]);
    if (wk > 0) {
      const p0 = [sen[0], sen[1] - api.s(20 * k)];
      const p2 = [wired[0], wired[1] - api.s(20 * k)];
      const peak = h * (compact ? 0.085 : 0.14);
      const c = [(p0[0] + p2[0]) / 2, 2 * peak - (p0[1] + p2[1]) / 2];
      const bez = (u) => [
        (1 - u) * (1 - u) * p0[0] + 2 * u * (1 - u) * c[0] + u * u * p2[0],
        (1 - u) * (1 - u) * p0[1] + 2 * u * (1 - u) * c[1] + u * u * p2[1],
      ];
      const n = 40;
      const upto = ease.inOut(wk);
      const arc = [];
      for (let i = 0; i <= n * upto; i++) arc.push(bez(i / n));
      arc.push(bez(upto));
      api.line(arc, { color: api.accent, width: api.s(2) });
      const ok = ease.back(seg(t, WICKET[1] - 0.1, WICKET[1] + 0.35));
      if (ok > 0) {
        const [mx, my] = bez(0.5);
        const rr = api.s(compact ? 8 : 10) * ok;
        api.circle(mx, my, rr, { fill: api.accent });
        api.line([[mx - rr * 0.42, my + rr * 0.02], [mx - rr * 0.1, my + rr * 0.34], [mx + rr * 0.45, my - rr * 0.32]], { color: pal.dark ? '#0A0B0F' : '#fff', width: Math.max(1.5, api.s(2.2)) });
        const la = ease.out(seg(t, WICKET[1] + 0.2, WICKET[1] + 0.6));
        api.text(compact ? 'Wicket' : 'Wicket: trusted link', mx + rr + api.s(6), my - api.s(compact ? 5 : 7), { size: api.fs(12), weight: 650, color: api.accentInk, alpha: la });
      }
    }

    // ---- Captions ----
    const j = st.jams[0];
    const capY = pTop - api.s(compact ? 13 : 15);
    api.caption(compact ? 'NULL frames: AP buffers' : 'spoofed NULL frames: AP buffers pings', px1, capY, j[0] - 0.35, j[1] + 0.45, { align: 'right', color: api.accentInk, border: api.accent, size: api.fs(11) });
    api.caption('latency spike = 1 · flat = 0', px1, capY, j[1] + 0.65, T0 + 4.9, { align: 'right', color: api.accentInk, border: api.accent, size: api.fs(11) });

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

function drawSensor(api, x, y, k) {
  const { pal } = api;
  const bw = api.s(26 * k);
  const bh = api.s(22 * k);
  api.rect(x - bw / 2, y - bh / 2, bw, bh, { fill: pal.surface, stroke: pal.ink2, width: 1, r: api.s(5 * k) });
  for (let i = 0; i < 3; i++) {
    const yy = y - bh * 0.18 + i * bh * 0.2;
    api.line([[x - bw * 0.28, yy], [x + bw * 0.08, yy]], { color: pal.ink3, width: 1 });
  }
  api.circle(x + bw * 0.27, y - bh * 0.18, api.s(1.8 * k), { fill: pal.ink2 });
  api.line([[x + bw * 0.3, y - bh / 2], [x + bw * 0.3, y - bh / 2 - api.s(9 * k)]], { color: pal.ink2, width: api.s(1.4) });
  api.circle(x + bw * 0.3, y - bh / 2 - api.s(9 * k), api.s(1.6 * k), { fill: pal.ink2 });
}

function drawAP(api, x, y, k) {
  const { pal } = api;
  const bw = api.s(36 * k);
  const bh = api.s(13 * k);
  for (const dx of [-0.3, 0.3]) {
    api.line([[x + dx * bw, y - bh / 2], [x + dx * bw * 1.25, y - bh / 2 - api.s(10 * k)]], { color: pal.ink2, width: api.s(1.6) });
  }
  api.rect(x - bw / 2, y - bh / 2, bw, bh, { fill: pal.surface, stroke: pal.ink2, width: 1, r: api.s(3) });
  for (let i = 0; i < 3; i++) api.circle(x - bw * 0.25 + i * bw * 0.12, y, api.s(1.4 * k), { fill: pal.ink3 });
}

function drawLaptop(api, x, y, k) {
  const { pal } = api;
  const sw = api.s(22 * k);
  const sh = api.s(14 * k);
  api.rect(x - sw / 2, y - sh, sw, sh, { fill: pal.surface, stroke: pal.ink2, width: 1, r: api.s(2) });
  api.line([[x - sw * 0.65, y + api.s(1.5)], [x + sw * 0.65, y + api.s(1.5)]], { color: pal.ink2, width: api.s(2) });
}

function drawDesktop(api, x, y, k) {
  const { pal } = api;
  const sw = api.s(30 * k);
  const sh = api.s(21 * k);
  api.rect(x - sw / 2, y - sh / 2 - api.s(3), sw, sh, { fill: pal.surface, stroke: pal.ink2, width: 1, r: api.s(2.5) });
  api.line([[x, y + sh / 2 - api.s(3)], [x, y + sh / 2 + api.s(3)]], { color: pal.ink2, width: api.s(1.6) });
  api.line([[x - sw * 0.25, y + sh / 2 + api.s(3)], [x + sw * 0.25, y + sh / 2 + api.s(3)]], { color: pal.ink2, width: api.s(1.6) });
}
