// Utilizing a Blockchain for Managing Sensor Metadata in Exposure Health Studies (i-ETC 2022).
// A home air-quality sensor streams data while every deployment event (installed,
// calibrated, firmware update, moved) is written as a block on a permissioned ledger, each
// block holding the previous block's hash. When the stream shows an anomaly, a trace walks
// back along the chain and links the anomaly's onset to the firmware-update block.
import { lerp, seg, ease, clamp, noise1 } from './kit.js';

const D = 14;
const DAYS = 10;
const EVENTS = [
  { day: 1.0, name: 'installed', hash: '3a9f' },
  { day: 2.8, name: 'calibrated', hash: '7c1e' },
  { day: 5.6, name: 'firmware update', short: ['firmware', 'update'], hash: 'b24d' },
  { day: 8.1, name: 'moved', hash: 'e06a' },
];
const CAUSE = 2;
const DETECT_DAY = 8.9;
const T = { draw: [0.6, 6.6], trace: [7.6, 9.4], link: [9.4, 10.2] };
const CAP = [[1.4, 4.4], [5.8, 7.6], [9.6, 13.4]];

const tOfDay = (d) => lerp(T.draw[0], T.draw[1], d / DAYS);

export default {
  duration: D,
  still: 11.0,

  init() {
    // Synthetic PM2.5-like readings: diurnal swing + noise, offset and noisier after the update.
    const N = 220;
    const vals = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const d = (i / N) * DAYS;
      const after = d >= EVENTS[CAUSE].day;
      const base = 0.3 + 0.07 * Math.sin((d - 0.3) * Math.PI * 2) + 0.035 * noise1(d * 9, 4) + 0.02 * noise1(d * 31, 9);
      vals[i] = base + (after ? 0.27 + 0.05 * noise1(d * 13, 2) + 0.03 * noise1(d * 40, 5) : 0);
    }
    return { vals, N };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const s = (v) => api.s(v);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const green = api.accent;

    // ---------- Stream ----------
    const S = { x: w * 0.08, y: h * 0.18, w: w * 0.84, h: h * 0.3 };
    const sb = S.y + S.h;
    const dx = (d) => S.x + (d / DAYS) * S.w;
    const vy = (v) => sb - v * S.h;
    lab(compact ? 'PM2.5 STREAM' : 'SENSOR STREAM · PM2.5', S.x, h * 0.13);
    api.line([[S.x, S.y], [S.x, sb], [S.x + S.w, sb]], { color: pal.line, width: 1, cap: 'square' });
    for (let d = 1; d <= DAYS; d++) api.line([[dx(d), sb], [dx(d), sb + s(3)]], { color: pal.line, width: 1 });
    lab('days', S.x + S.w, sb + s(15), { align: 'right' });
    const cur = clamp(((t - T.draw[0]) / (T.draw[1] - T.draw[0])) * DAYS, 0, DAYS);
    // Anomaly band (onset → detection) once detected.
    const detT = tOfDay(DETECT_DAY);
    const bandA = ease.out(seg(t, detT, detT + 0.4));
    const onsetX = dx(EVENTS[CAUSE].day);
    if (bandA > 0) {
      const bx1 = dx(Math.min(cur, DAYS));
      hatch(api, onsetX, S.y, bx1 - onsetX, S.h, pal.ink3, 0.18 * bandA);
      api.line([[onsetX, S.y], [onsetX, sb]], { color: pal.ink3, width: 1, dash: [s(3), s(3)], alpha: bandA });
      api.label('anomaly', (onsetX + bx1) / 2, S.y + s(2), { size: api.fs(10.5), color: pal.ink, border: pal.ink3, alpha: bandA });
    }
    const pts = [];
    const n = Math.round((cur / DAYS) * st.N);
    for (let i = 0; i <= n; i++) pts.push([dx((i / st.N) * DAYS), vy(st.vals[i])]);
    if (pts.length > 1) api.line(pts, { color: pal.ink2, width: s(1.6) });
    if (cur > 0 && cur < DAYS) api.circle(pts[pts.length - 1][0], pts[pts.length - 1][1], Math.max(2, s(2.8)), { fill: pal.ink2 });

    // ---------- Permissioned ledger ----------
    const bw = w * 0.18;
    const bh = Math.max(compact ? 30 : 34, s(compact ? 40 : 52));
    const by = h * 0.62;
    const ledY = by + bh + Math.max(15, s(19));
    drawLock(api, S.x + s(5), ledY - s(4), Math.max(5, s(7)), green);
    lab('PERMISSIONED LEDGER', S.x + s(17), ledY);
    const bx = (i) => S.x + (S.w - bw) * (i / (EVENTS.length - 1));
    const appear = EVENTS.map((e) => ease.out(seg(t, tOfDay(e.day), tOfDay(e.day) + 0.45)));
    // Trace state.
    const tp = seg(t, T.trace[0], T.trace[1]);
    const linkP = ease.inOut(seg(t, T.link[0], T.link[1]));
    const causeOn = ease.out(seg(t, T.link[0] - 0.15, T.link[0] + 0.25));
    EVENTS.forEach((e, i) => {
      const a = appear[i];
      if (a <= 0) return;
      const x = bx(i);
      const yOff = (1 - a) * s(10);
      // Leader from the event's moment on the stream axis to its block.
      const ex = dx(e.day);
      api.line([[ex, sb + s(4)], [ex, sb + s(12)], [x + bw / 2, by - s(8)], [x + bw / 2, by - 1 + yOff]], { color: pal.ink3, width: 1, dash: [s(2), s(3)], alpha: 0.8 * a });
      api.circle(ex, sb, Math.max(2, s(2.6)), { fill: i === CAUSE && causeOn > 0 ? green : pal.ink3, alpha: a });
      // Hash pointer to the previous block.
      if (i > 0) {
        const x0 = bx(i - 1) + bw;
        const yy = by + bh * 0.5 + yOff;
        api.arrow(x - s(2), yy, x0 + s(3), yy, { color: pal.ink3, width: 1, head: Math.max(5, s(6)), alpha: a });
        drawLinkGlyph(api, (x + x0) / 2, yy, Math.max(4, s(6)), pal.ink3, a);
      }
      const hot = i === CAUSE ? causeOn : 0;
      api.rect(x, by + yOff, bw, bh, { fill: pal.surface, stroke: hot > 0.01 ? green : pal.line, width: hot > 0.01 ? Math.max(1.5, s(2)) : 1, r: s(5), alpha: a });
      if (hot > 0.01) api.rect(x, by + yOff, bw, bh, { fill: green, r: s(5), alpha: 0.12 * hot });
      const tx = x + s(8);
      if (!compact) {
        api.text(`#${i + 1}`, tx, by + yOff + s(15), { size: api.fs(10), weight: 650, color: pal.ink3, alpha: a });
        api.text(e.hash, x + bw - s(8), by + yOff + s(15), { size: api.fs(10), color: pal.ink3, align: 'right', alpha: a });
        api.text(e.name, tx, by + yOff + s(32), { size: api.fs(11), weight: 600, color: hot > 0.5 ? api.accentInk : pal.ink, alpha: a });
        if (i > 0) api.text(`prev ${EVENTS[i - 1].hash}`, tx, by + yOff + s(46), { size: api.fs(10), color: pal.ink3, alpha: a });
      } else {
        const lines = e.short || [e.name];
        lines.forEach((ln, k) => api.text(ln, x + bw / 2, by + yOff + bh / 2 + (k - (lines.length - 1) / 2) * api.fs(11) + api.fs(11) * 0.35, { size: api.fs(10), weight: 600, color: hot > 0.5 ? api.accentInk : pal.ink, align: 'center', alpha: a }));
      }
    });

    // ---------- Trace: anomaly → newest block → back along the chain ----------
    const head = EVENTS.length - 1;
    const ax = dx(DETECT_DAY);
    const ai = Math.round((DETECT_DAY / DAYS) * st.N);
    const ayv = vy(st.vals[ai]);
    const detA = ease.out(seg(t, detT + 0.2, detT + 0.6));
    if (detA > 0) api.circle(ax, ayv, Math.max(3, s(4.5)), { stroke: green, width: s(1.8), alpha: detA });
    if (tp > 0) {
      // Leg 1: down from the detection point to the newest block.
      const leg1 = [[ax, ayv + s(5)], [ax, by]];
      const p1 = ease.inOut(seg(tp, 0, 0.42));
      const d1 = along(leg1, p1, true);
      api.line(d1.sub, { color: green, width: s(1.8), alpha: 0.9 });
      if (p1 > 0 && p1 < 1) api.circle(d1.pt[0], d1.pt[1], Math.max(2.5, s(3.6)), { fill: green });
      // The newest block is checked and passed over: its event came after the onset.
      const pa = seg(tp, 0.42, 0.62);
      if (pa > 0 && pa < 1) api.rect(bx(head) - s(3), by - s(3), bw + s(6), bh + s(6), { stroke: green, width: Math.max(1, s(1.4)), r: s(7), alpha: 0.8 * (1 - pa) });
      // Leg 2: along the hash pointer to the previous block.
      const yy = by + bh * 0.5;
      const leg2 = [[bx(head), yy], [bx(CAUSE) + bw, yy]];
      const p2 = ease.inOut(seg(tp, 0.62, 1));
      if (p2 > 0) {
        const d2 = along(leg2, p2, true);
        api.line(d2.sub, { color: green, width: s(2.2) });
        if (p2 < 1) api.circle(d2.pt[0], d2.pt[1], Math.max(2.5, s(3.6)), { fill: green });
      }
    }
    // Link from the cause block up to the anomaly's onset.
    if (linkP > 0) {
      const x0 = bx(CAUSE) + bw / 2;
      const y0 = by - s(2);
      const pts3 = [[x0, y0], [x0, sb + s(12)], [onsetX, sb + s(4)], [onsetX, S.y + s(14)]];
      const d = along(pts3, linkP, true);
      api.line(d.sub, { color: green, width: s(2.2) });
      api.circle(onsetX, sb, Math.max(2.4, s(3.4)), { fill: green, alpha: linkP });
    }

    // ---------- Captions ----------
    const capY = h * 0.925;
    api.caption('each deployment event adds a block', w / 2, capY, CAP[0][0], CAP[0][1], { size: api.fs(11), color: pal.ink, border: pal.line });
    api.caption('anomaly in the data stream', w / 2, capY, CAP[1][0], CAP[1][1], { size: api.fs(11), color: pal.ink, border: pal.line });
    api.caption('traced back to the firmware update', w / 2, capY, CAP[2][0], CAP[2][1], { size: api.fs(11), color: api.accentInk, border: green });

    // ---------- Loop fade ----------
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.5, D));
    if (fade < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};

// Polyline up to fraction u of its length; returns the partial polyline and its end point.
function along(pts, u, wantSub) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let d = clamp(u) * total;
  const sub = [pts[0]];
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]) {
      const f = lens[i] ? d / lens[i] : 0;
      const pt = [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
      if (wantSub) sub.push(pt);
      return { sub, pt };
    }
    d -= lens[i];
    sub.push(pts[i + 1]);
  }
  return { sub, pt: pts[pts.length - 1] };
}

function hatch(api, x, y, w, h, color, a) {
  if (w <= 0 || a <= 0) return;
  const { ctx } = api;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.globalAlpha = a * 0.5;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = a * 1.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const step = Math.max(5, api.s(7));
  ctx.beginPath();
  for (let k = -h; k < w + h; k += step) {
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

// Padlock: shackle arc over a body, keyhole cut out.
function drawLock(api, x, y, sz, color) {
  const { ctx, pal } = api;
  const lw = Math.max(1.2, api.s(1.5));
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - sz * 0.15, sz * 0.48, Math.PI, 0);
  ctx.lineTo(x + sz * 0.48, y + sz * 0.15);
  ctx.moveTo(x - sz * 0.48, y + sz * 0.15);
  ctx.lineTo(x - sz * 0.48, y - sz * 0.15);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
  api.rect(x - sz * 0.75, y + sz * 0.1, sz * 1.5, sz * 1.1, { fill: color, r: sz * 0.18 });
  api.circle(x, y + sz * 0.55, Math.max(0.8, sz * 0.16), { fill: pal.surface });
}

// Two interlocked links centred on (x, y).
function drawLinkGlyph(api, x, y, sz, color, a) {
  const { ctx } = api;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, api.s(1.3));
  ctx.fillStyle = api.pal.bg;
  for (const off of [-sz * 0.38, sz * 0.38]) {
    ctx.beginPath();
    ctx.roundRect(x + off - sz * 0.5, y - sz * 0.3, sz, sz * 0.6, sz * 0.3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
