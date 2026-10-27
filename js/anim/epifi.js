// An In-Home IoT Architecture for Epidemiological Deployments (EpiFi, SenseApp 2018).
// Exposure sensors in a study participant's home bootstrap their connectivity onto the
// home Wi-Fi router one after another, then stream readings to the study server. When
// the router goes offline, each sensor keeps sampling into a local buffer; when it comes
// back, the backlog uploads and the server's counters show nothing was lost.
// Floor plan, counts and timing are illustrative.
import { TAU, clamp, lerp, seg, ease } from './kit.js';

const D = 14;
const JOIN0 = 0.8; // first sensor starts joining
const JOIN_STEP = 0.78; // one sensor after another
const OFF = [6.6, 9.5]; // router offline
const PERIOD = 0.72; // seconds between readings per sensor
const TO_ROUTER = 0.32;
const TO_SERVER = 0.36;
// Sensors (plan units 0..1), in joining order.
const SENSORS = [
  { x: 0.21, y: 0.27, room: 0 },
  { x: 0.77, y: 0.24, room: 2 },
  { x: 0.17, y: 0.76, room: 1 },
  { x: 0.84, y: 0.7, room: 3 },
  { x: 0.64, y: 0.83, room: 3 },
];
const ROUTER = { x: 0.465, y: 0.5 };

export default {
  duration: D,
  still: 12.0,
  scene: false,

  init() {
    const readings = SENSORS.map((_, i) => {
      const joined = JOIN0 + i * JOIN_STEP + 0.7;
      const list = [];
      let queued = 0;
      for (let tg = joined + 0.15 + i * 0.11; tg < D - 1.4; tg += PERIOD) {
        // A reading that cannot reach the server before the router drops waits in the buffer.
        const held = tg + TO_ROUTER + TO_SERVER > OFF[0] && tg < OFF[1];
        const depart = held ? OFF[1] + 0.2 + queued++ * 0.16 + i * 0.05 : tg;
        const speed = held ? 0.75 : 1;
        list.push({ tg, depart, held, atRouter: depart + TO_ROUTER * speed, arrive: depart + (TO_ROUTER + TO_SERVER) * speed });
      }
      return { joined, list };
    });
    return { readings };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const fade = Math.min(seg(t, 0, 0.5), 1 - seg(t, D - 0.55, D));
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    const A = (a) => a * fade;
    const fsL = api.fs(10.5);
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: fsL, color: pal.ink3, spacing: 0.4, ...o, alpha: A(o.alpha ?? 1) });
    const onA = 1 - Math.min(seg(t, OFF[0], OFF[0] + 0.25), 1 - seg(t, OFF[1], OFF[1] + 0.25)); // router up?
    const offline = t >= OFF[0] && t < OFF[1];

    // ================= Floor plan =================
    const F = compact ? { x: w * 0.05, y: h * 0.09, w: w * 0.54, h: h * 0.72 } : { x: w * 0.07, y: h * 0.16, w: w * 0.52, h: h * 0.66 };
    const fx = (u) => F.x + u * F.w;
    const fy = (v) => F.y + v * F.h;
    const wall = { color: pal.ink3, width: api.s(compact ? 2 : 2.6), cap: 'square' };
    const thin = { color: pal.ink3, width: api.s(1.3), cap: 'square' };
    const gap = 0.07;
    // Outer walls with a front door gap on the bottom.
    api.line([[fx(0.4), fy(1)], [fx(0), fy(1)], [fx(0), fy(0)], [fx(1), fy(0)], [fx(1), fy(1)], [fx(0.4 + gap * 1.4), fy(1)]], wall);
    // Hall walls (left and right of the corridor), with doorways.
    api.line([[fx(0.38), fy(0)], [fx(0.38), fy(0.36)]], thin);
    api.line([[fx(0.38), fy(0.36 + gap * 1.6)], [fx(0.38), fy(0.7)]], thin);
    api.line([[fx(0.38), fy(0.7 + gap * 1.6)], [fx(0.38), fy(1)]], thin);
    api.line([[fx(0.55), fy(0)], [fx(0.55), fy(0.3)]], thin);
    api.line([[fx(0.55), fy(0.3 + gap * 1.6)], [fx(0.55), fy(0.56)]], thin);
    api.line([[fx(0.55), fy(0.56 + gap * 1.6)], [fx(0.55), fy(1)]], thin);
    api.line([[fx(0), fy(0.52)], [fx(0.38), fy(0.52)]], thin);
    api.line([[fx(0.55), fy(0.46)], [fx(1), fy(0.46)]], thin);
    if (!compact) {
      const rl = (s, u, v) => lab(s, fx(u), fy(v), { spacing: 0, alpha: 0.9 });
      rl('bedroom', 0.03, 0.09);
      rl('bedroom', 0.03, 0.61);
      rl('kitchen', 0.58, 0.09);
      rl('living room', 0.58, 0.55);
    }

    // Router and the uplink to the study server.
    const R = { x: fx(ROUTER.x), y: fy(ROUTER.y) };
    const rw = api.s(compact ? 20 : 26);
    const rh = api.s(compact ? 9 : 11);
    const S = compact ? { x: w * 0.8, y: h * 0.2, w: api.s(44), h: api.s(28) } : { x: w * 0.79, y: h * 0.22, w: api.s(56), h: api.s(34) };
    const sIn = { x: S.x - S.w / 2, y: S.y };
    const up = [[R.x, R.y - rh / 2], [R.x, fy(0) - api.s(14)], [sIn.x - api.s(18), fy(0) - api.s(14)], [sIn.x, sIn.y]];
    api.line(up, { color: pal.line, width: 1, dash: [api.s(4), api.s(4)], alpha: A(0.4 + 0.6 * onA) });
    // Point along the uplink polyline.
    const lens = [];
    let total = 0;
    for (let i = 1; i < up.length; i++) {
      const l = Math.hypot(up[i][0] - up[i - 1][0], up[i][1] - up[i - 1][1]);
      lens.push(l);
      total += l;
    }
    const along = (f) => {
      let d = f * total;
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i] || i === lens.length - 1) {
          const q = clamp(d / lens[i]);
          return [lerp(up[i][0], up[i + 1][0], q), lerp(up[i][1], up[i + 1][1], q)];
        }
        d -= lens[i];
      }
      return up[up.length - 1];
    };

    // Sensor links: dashed while offline; drawn in as each sensor joins.
    const sp = SENSORS.map((s) => ({ x: fx(s.x), y: fy(s.y) }));
    st.readings.forEach((r, i) => {
      const linkP = ease.out(seg(t, r.joined - 0.15, r.joined + 0.2));
      if (linkP <= 0) return;
      const p = sp[i];
      const end = [lerp(R.x, p.x, linkP), lerp(R.y, p.y, linkP)];
      api.line([[R.x, R.y], end], { color: onA > 0.5 ? api.accent : pal.ink3, width: api.s(1.2), alpha: A(onA > 0.5 ? 0.55 : 0.5), dash: onA > 0.5 ? undefined : [api.s(2), api.s(4)] });
    });

    // Bootstrapping handshakes: hello from the sensor, then credentials back from the router.
    st.readings.forEach((r, i) => {
      const t0 = JOIN0 + i * JOIN_STEP;
      const p = sp[i];
      const hello = seg(t, t0, t0 + 0.3);
      if (hello > 0 && hello < 1) {
        const f = ease.inOut(hello);
        api.circle(lerp(p.x, R.x, f), lerp(p.y, R.y, f), api.s(2.2), { stroke: pal.ink2, width: api.s(1.2) });
      }
      const cred = seg(t, t0 + 0.32, t0 + 0.68);
      if (cred > 0 && cred < 1) {
        const f = ease.inOut(cred);
        const cx = lerp(R.x, p.x, f);
        const cy = lerp(R.y, p.y, f);
        const k = api.s(compact ? 3 : 3.6);
        api.rect(cx - k, cy - k * 0.75, k * 2, k * 1.5, { fill: api.accent, r: api.s(1.5) });
      }
    });

    // Reading pulses.
    const pr = api.s(compact ? 2 : 2.5);
    st.readings.forEach((r, i) => {
      const p = sp[i];
      for (const rd of r.list) {
        if (t < rd.depart || t > rd.arrive) continue;
        if (t < rd.atRouter) {
          const f = ease.inOut(seg(t, rd.depart, rd.atRouter));
          api.circle(lerp(p.x, R.x, f), lerp(p.y, R.y, f), pr, { fill: api.accent });
        } else {
          const [x, y] = along(ease.inOut(seg(t, rd.atRouter, rd.arrive)));
          api.circle(x, y, pr, { fill: api.accent });
        }
      }
    });

    // Router glyph.
    const rCol = onA > 0.5 ? api.accent : pal.ink3;
    api.line([[R.x - rw * 0.3, R.y - rh / 2], [R.x - rw * 0.38, R.y - rh * 1.35]], { color: pal.ink2, width: api.s(1.3) });
    api.line([[R.x + rw * 0.3, R.y - rh / 2], [R.x + rw * 0.38, R.y - rh * 1.35]], { color: pal.ink2, width: api.s(1.3) });
    api.rect(R.x - rw / 2, R.y - rh / 2, rw, rh, { fill: pal.surface, stroke: pal.ink2, width: api.s(1.3), r: api.s(3) });
    for (let k = 0; k < 3; k++) api.circle(R.x - rw * 0.25 + k * rw * 0.25, R.y, api.s(1.4), { fill: k === 0 ? rCol : pal.ink3 });
    for (let k = 1; k <= 2; k++) {
      ctx.save();
      ctx.globalAlpha = A(onA > 0.5 ? 0.9 : 0.35);
      ctx.strokeStyle = rCol;
      ctx.lineWidth = api.s(1.3);
      ctx.beginPath();
      ctx.arc(R.x, R.y - rh * 1.2, api.s(4 + 4 * k), -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.stroke();
      ctx.restore();
    }
    if (offline) {
      const k = api.s(4.5);
      const cx = R.x;
      const cy = R.y - rh * 1.2 - api.s(9);
      api.line([[cx - k, cy - k], [cx + k, cy + k]], { color: pal.ink, width: api.s(1.8) });
      api.line([[cx - k, cy + k], [cx + k, cy - k]], { color: pal.ink, width: api.s(1.8) });
    }
    api.caption('offline', R.x, R.y + rh + api.s(compact ? 9 : 11), OFF[0] + 0.1, OFF[1], { size: api.fs(10), color: pal.ink, border: pal.ink3, alpha: fade });
    const homeA = 1 - Math.min(seg(t, OFF[0], OFF[0] + 0.1), 1 - seg(t, OFF[1], OFF[1] + 0.2));
    if (!compact && homeA > 0) api.label('home Wi-Fi', R.x, R.y + rh + api.s(11), { size: api.fs(10), weight: 500, color: pal.ink2, border: pal.line, alpha: A(homeA) });

    // Sensors, with buffer rings that fill while the router is down.
    const ss = api.s(compact ? 8 : 10);
    st.readings.forEach((r, i) => {
      const p = sp[i];
      const joined = t >= r.joined;
      const pop = ease.back(seg(t, r.joined - 0.1, r.joined + 0.25));
      let held = 0;
      let heldMax = 0;
      for (const rd of r.list) {
        if (!rd.held) continue;
        heldMax++;
        if (t >= rd.tg && t < rd.depart) held++;
      }
      if (heldMax && held) {
        const rr = ss * 0.95 + api.s(4);
        api.circle(p.x, p.y, rr, { stroke: pal.grid, width: api.s(2.4) });
        ctx.save();
        ctx.globalAlpha = A(1);
        ctx.strokeStyle = api.accent;
        ctx.lineWidth = api.s(2.4);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * (held / (heldMax + 1)));
        ctx.stroke();
        ctx.restore();
      }
      const sc = joined ? 1 + 0.12 * (1 - Math.abs(pop - 1)) : 1;
      const half = (ss / 2) * sc;
      api.rect(p.x - half, p.y - half, half * 2, half * 2, { fill: pal.surface, stroke: joined ? (onA > 0.5 ? api.accent : pal.ink2) : pal.ink3, width: api.s(1.3), r: api.s(2.5), dash: joined ? undefined : [api.s(2), api.s(2)] });
      api.circle(p.x, p.y, api.s(1.8), { fill: joined ? api.accent : pal.ink3 });
    });

    // ================= Study server and its counters =================
    api.rect(S.x - S.w / 2, S.y - S.h / 2, S.w, S.h, { fill: pal.surface, stroke: pal.ink3, width: 1.2, r: api.s(4) });
    for (let k = 0; k < 3; k++) {
      const yy = S.y - S.h / 2 + S.h * (0.25 + k * 0.25);
      api.line([[S.x - S.w * 0.32, yy], [S.x + S.w * 0.12, yy]], { color: pal.line, width: api.s(1.4) });
      api.circle(S.x + S.w * 0.3, yy, api.s(1.6), { fill: api.accent });
    }
    lab(compact ? 'SERVER' : 'STUDY SERVER', S.x, S.y - S.h / 2 - api.s(8), { align: 'center' });

    let received = 0;
    let buffered = 0;
    for (const r of st.readings) {
      for (const rd of r.list) {
        if (t >= rd.arrive) received++;
        if (rd.held && t >= rd.tg && t < rd.depart) buffered++;
      }
    }
    const C = compact ? { x: w * 0.64, x1: w * 0.96, y: h * 0.42, gap: h * 0.15 } : { x: w * 0.665, x1: w * 0.93, y: h * 0.44, gap: h * 0.135 };
    const big = compact ? Math.max(14, api.s(22)) : api.fs(22);
    const rows = [
      { name: 'received', v: received, color: pal.ink, nameColor: pal.ink2 },
      { name: compact ? 'buffered' : 'in sensor buffers', v: buffered, color: buffered ? api.accentInk : pal.ink3, nameColor: pal.ink2 },
      { name: 'lost', v: 0, color: api.accentInk, nameColor: api.accentInk },
    ];
    rows.forEach((row, i) => {
      const y = C.y + i * C.gap;
      api.text(row.name, C.x, y, { size: fsL, color: row.nameColor, weight: i === 2 ? 600 : 500 });
      api.text(String(row.v), C.x1, y + api.s(1), { size: big, weight: 650, color: row.color, align: 'right' });
      if (i < 2) api.line([[C.x, y + C.gap * 0.42], [C.x1, y + C.gap * 0.42]], { color: pal.grid, width: 1 });
    });

    // ================= Live captions =================
    const capX = F.x + F.w / 2;
    const capY = F.y + F.h + api.fs(11.5) + api.s(compact ? 4 : 10);
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    const joinedAll = JOIN0 + (SENSORS.length - 1) * JOIN_STEP + 0.9;
    api.caption(compact ? 'sensors join one by one' : 'sensors bootstrap onto home Wi-Fi, one by one', capX, capY, JOIN0 + 0.1, joinedAll + 0.6, acc);
    api.caption(compact ? 'offline: sensors buffer' : 'router offline: sensors keep buffering', capX, capY, OFF[0] + 0.2, OFF[1], neu);
    api.caption(compact ? 'backlog uploads' : 'back online: the backlog uploads', capX, capY, OFF[1] + 0.15, OFF[1] + 1.9, acc);
    api.caption(compact ? 'backlog intact · 0 lost' : 'backlog arrives intact · 0 lost', capX, capY, OFF[1] + 2.05, D - 0.6, acc);
    ctx.globalAlpha = 1;
  },
};
