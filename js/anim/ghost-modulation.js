// Stealthy Signals: Using Ghost Modulation to Watermark Interference (LEO-NET 2023).
// A LEO satellite's packet train flows to a receiver. Most packets pass straight
// through; Ghost Modulation purposefully delays a few key packets, so the gap in
// front of each one is short (0) or long (1). A GM receiver only measures those gaps
// as they stream past and assembles a short coordination message.
import { seg, win, ease, clamp } from './kit.js';

const D = 16;
const BITS = [0, 1, 1, 0, 1, 0, 0, 1];
const MESSAGE = 'vacating ch 3'; // synthetic coordination message
const BETWEEN = [3, 2, 3, 2, 3, 2, 3, 2]; // pass-through packets before each key packet
const SPEED = 0.15; // lane widths (of w) per second
const PW = 0.022; // packet width, in w
const NAT = 0.023; // natural gap between packets, in w
const SHORT = 0.062; // gap in front of a key packet carrying 0
const LONG = 0.11; // ... carrying 1
const X0 = 0.15; // lane start (satellite), in w
const X1 = 0.85; // lane end (receiver), in w
const FIRST = 1.35; // first key packet reaches the receiver

export default {
  duration: D,
  still: 13.2,
  scene: false,

  init(api) {
    const r = api.rng('ghost');
    // Build the train back to front, in departure time from the satellite.
    const pk = [];
    let dep = 0;
    const push = (gap, key, bit) => {
      dep += (PW + gap) / SPEED;
      pk.push({ dep, key, bit, gap });
    };
    // The satellite repeats the message while it transmits; the meter reads the middle copy.
    for (let i = 0; i < 4; i++) push(NAT + r.range(-0.004, 0.006), false);
    for (let copy = 0; copy < 3; copy++) {
      BITS.forEach((b, k) => {
        for (let i = 0; i < BETWEEN[k]; i++) push(NAT + r.range(-0.004, 0.006), false);
        push(b ? LONG : SHORT, true, b);
        pk[pk.length - 1].meter = copy === 1;
      });
      for (let i = 0; i < 3; i++) push(NAT + r.range(-0.004, 0.006), false);
    }
    // Shift so the first key packet's front reaches the receiver at FIRST.
    const L = (X1 - X0) / SPEED;
    const k0 = pk.find((p) => p.meter);
    const shift = FIRST - (k0.dep + L);
    let ki = 0;
    for (let i = 0; i < pk.length; i++) {
      const p = pk[i];
      p.dep += shift;
      p.arrive = p.dep + L; // front edge at the receiver
      if (p.key) p.gapStart = pk[i - 1].dep + L + PW / SPEED; // previous packet's tail passes the receiver (already shifted)
      if (p.meter) p.k = ki++;
    }
    const keys = pk.filter((p) => p.meter);
    return { pk, keys, L };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const lx0 = X0 * w;
    const lx1 = X1 * w;
    const laneY = h * (compact ? 0.27 : 0.31);
    const ph = h * (compact ? 0.1 : 0.085);
    const xLead = (p) => lx0 + (t - p.dep) * SPEED * w;

    // ---- Lane, satellite, receiver ----
    api.line([[lx0, laneY + ph / 2 + api.s(4)], [lx1, laneY + ph / 2 + api.s(4)]], { color: pal.line, width: 1 });
    if (!compact) lab('PACKET TRAIN · MOST PACKETS PASS THROUGH', lx0 + api.s(4), laneY - ph / 2 - api.s(compact ? 14 : 26));
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx0, laneY - ph * 2, lx1 - lx0, ph * 4);
    ctx.clip();
    for (const p of st.pk) {
      const xl = xLead(p);
      const xt = xl - PW * w;
      if (xl < lx0 || xt > lx1) continue;
      if (p.key) api.rect(xt, laneY - ph / 2, PW * w, ph, { fill: api.accent, r: api.s(2.5) });
      else api.rect(xt, laneY - ph / 2, PW * w, ph, { fill: pal.ink3, r: api.s(2.5), alpha: 0.75 });
    }
    // Gap brackets in front of key packets (consumed as they stream into the receiver).
    const by = laneY - ph / 2 - api.s(compact ? 6 : 9);
    for (const p of st.pk) {
      if (!p.key) continue;
      const right = xLead(p) + p.gap * w; // previous packet's tail
      const left = xLead(p);
      if (left > lx1 || right < lx0) continue;
      const rr = Math.min(right, lx1);
      api.line([[left, by + api.s(3)], [left, by], [rr, by], ...(right <= lx1 ? [[rr, by + api.s(3)]] : [])], { color: api.accent, width: api.s(1.6) });
    }
    ctx.restore();
    drawSatellite(api, lx0 - api.s(compact ? 18 : 22), laneY, compact ? 1.35 : 1.45);
    drawTower(api, lx1 + api.s(compact ? 20 : 24), laneY, compact ? 1.3 : 1.35);
    if (!compact) {
      lab('LEO satellite', lx0 - api.s(22), laneY + ph / 2 + api.s(24), { align: 'center' });
      lab('GM receiver', lx1 + api.s(24), laneY + ph / 2 + api.s(24), { align: 'center' });
    }

    // ---- Gap meter: each bar grows while its gap streams into the receiver ----
    const cx0 = w * (compact ? 0.4 : 0.45);
    const cx1 = w * (compact ? 0.95 : 0.82);
    const cTop = h * (compact ? 0.52 : 0.56);
    const cBot = h * (compact ? 0.83 : 0.83);
    const scale = ((cBot - cTop) * 0.9) / (LONG * w);
    const spc = (cx1 - cx0) / BITS.length;
    const thrY = cBot - ((SHORT + LONG) / 2) * w * scale;
    const k1c = st.keys[1];
    const meterLabA = compact ? 1 - win(t, k1c.gapStart - 0.1, k1c.arrive + 1.5, 0.2) : 1;
    lab(compact ? 'GAP METER' : 'GAP IN FRONT OF EACH KEY PACKET', cx0, cTop - api.s(compact ? 6 : 10), { alpha: meterLabA });
    api.line([[cx0, cBot], [cx1, cBot]], { color: pal.line, width: 1 });
    api.line([[cx0, thrY], [cx1, thrY]], { color: pal.ink3, width: 1, dash: [api.s(4), api.s(4)] });
    if (!compact) {
      lab('long = 1', cx1 + api.s(6), thrY - api.s(5));
      lab('short = 0', cx1 + api.s(6), thrY + api.s(13));
    }
    const bw = Math.min(spc * 0.42, api.s(16));
    let decoded = 0;
    for (const p of st.keys) {
      const x = cx0 + (p.k + 0.5) * spc;
      const g = clamp((t - p.gapStart) / (p.arrive - p.gapStart));
      api.rect(x - bw / 2, cBot - api.s(1), bw, api.s(1), { fill: pal.line });
      if (g <= 0) continue;
      const bh = p.gap * w * scale * g;
      api.rect(x - bw / 2, cBot - bh, bw, bh, { fill: api.accent, r: [api.s(2), api.s(2), 0, 0], alpha: g < 1 ? 0.75 : 1 });
      const ba = ease.out(seg(t, p.arrive, p.arrive + 0.3));
      if (ba > 0) {
        decoded++;
        api.text(String(p.bit), x, cBot + api.s(compact ? 14 : 18), { size: api.fs(13), weight: 650, align: 'center', color: api.accentInk, alpha: ba });
      }
    }

    // ---- Decoded coordination message ----
    const mx = w * (compact ? 0.05 : 0.07);
    const my = h * (compact ? 0.56 : 0.6);
    const last = st.keys[st.keys.length - 1].arrive;
    lab(compact ? 'MESSAGE' : 'COORDINATION MESSAGE', mx, my);
    const bitsStr = BITS.slice(0, decoded).map((b, i) => (i === 4 ? ` ${b}` : String(b))).join('');
    api.text(bitsStr || '…', mx, my + api.s(compact ? 20 : 26), { size: api.fs(compact ? 12 : 14), weight: 600, color: pal.ink2 });
    const ma = ease.out(seg(t, last + 0.45, last + 0.95));
    if (ma > 0) {
      const ty = my + api.s(compact ? 42 : 56);
      api.text(`"${MESSAGE}"`, mx, ty + (1 - ma) * api.s(5), { size: api.fs(compact ? 12 : 16), weight: 650, color: api.accentInk, alpha: ma });
    }

    // ---- Captions ----
    const k0 = st.keys[0];
    const k1 = st.keys[1];
    api.caption(compact ? 'gap before key packet = bit' : 'key packet delayed: its gap is the bit', (lx0 + lx1) / 2, laneY + ph / 2 + api.s(compact ? 20 : 26), 0.5, k0.arrive + 0.6, { color: api.accentInk, border: api.accent, size: api.fs(11) });
    api.caption(compact ? 'receiver times the gap' : 'receiver times each gap', (cx0 + cx1) / 2, cTop - api.s(compact ? 16 : 38), k1.gapStart - 0.1, k1.arrive + 1.5, { color: pal.ink, border: pal.ink3, size: api.fs(11) });

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

function drawSatellite(api, x, y, k) {
  const { ctx, pal } = api;
  const s = api.s(k);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.ink2;
  ctx.beginPath();
  ctx.moveTo(0, -9 * s);
  ctx.lineTo(0, 9 * s);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const py = side > 0 ? 7 * s : -20 * s;
    ctx.beginPath();
    ctx.rect(-4.5 * s, py, 9 * s, 13 * s);
    ctx.fillStyle = pal.surface;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(-4.5 * s, py + (i * 13 * s) / 3);
      ctx.lineTo(4.5 * s, py + (i * 13 * s) / 3);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-5.5 * s, -5 * s, 11 * s, 10 * s, 1.5 * s);
  ctx.fillStyle = pal.ink2;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5.5 * s, 0);
  ctx.lineTo(9 * s, 0);
  ctx.stroke();
  ctx.restore();
}

// A receiving mast: lattice tower with an antenna head.
function drawTower(api, x, y, k) {
  const { pal } = api;
  const s = api.s(k);
  const top = y - 14 * s;
  const bot = y + 16 * s;
  const c = pal.ink2;
  api.line([[x - 8 * s, bot], [x - 2 * s, top], [x + 2 * s, top], [x + 8 * s, bot]], { color: c, width: Math.max(1, api.s(1.3)) });
  api.line([[x - 6 * s, bot - 7 * s], [x + 4.5 * s, bot - 15 * s], [x - 3.5 * s, bot - 21 * s]], { color: pal.ink3, width: 1 });
  api.line([[x + 6 * s, bot - 7 * s], [x - 4.5 * s, bot - 15 * s], [x + 3.5 * s, bot - 21 * s]], { color: pal.ink3, width: 1 });
  api.rect(x - 3.5 * s, top - 8 * s, 7 * s, 8 * s, { fill: c, r: 1.5 * s });
  for (const rr of [6, 10]) {
    api.ctx.save();
    api.ctx.strokeStyle = pal.ink3;
    api.ctx.lineWidth = 1;
    api.ctx.beginPath();
    api.ctx.arc(x, top - 4 * s, rr * s, Math.PI * 0.75, Math.PI * 1.25);
    api.ctx.stroke();
    api.ctx.restore();
  }
}
