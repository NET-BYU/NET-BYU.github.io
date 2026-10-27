// Managing In-home Environments Through Sensing, Annotating, and Visualizing Air
// Quality Data (MAAV, IMWUT / UbiComp 2018).
// Several air quality monitors watch one home. When the kitchen monitor sees a PM2.5
// spike, MAAV texts the participant a prompt; they tag it "cooking", and the annotated
// spike appears on the tablet's timeline next to the other monitors' readings.
// Readings and timing are illustrative.
import { clamp, lerp, seg, win, ease, noise1, TAU } from './kit.js';

const D = 14;
const NOW = [0.5, 12.6]; // tablet "now" cursor sweeps the day over this window
const X0 = 0.2; // chart x at the start of the sweep (earlier readings already on screen)
const X1 = 0.96;
const COOK = 2.1; // stove on
const SPIKE = 3.0; // monitor flags the spike
const SMS = [3.5, 4.3]; // prompt travels to the phone
const CHIPS = 4.9; // reply options appear
const TAP = 5.7; // participant taps "cooking"
const TAG = [6.3, 7.1]; // annotation travels to the tablet
const xNow = (t) => lerp(X0, X1, seg(t, NOW[0], NOW[1]));
const XS = xNow(SPIKE - 0.35); // where the spike starts on the chart

export default {
  duration: D,
  still: 9.0,
  scene: false,

  init() {
    const n = 240;
    const mk = (base, amp, delay, width, seed) => Float32Array.from({ length: n }, (_, i) => {
      const x = i / (n - 1);
      const d = x - (XS + delay);
      const bump = d < 0 ? Math.exp(-((d / 0.012) ** 2)) : Math.exp(-d / width);
      return base + amp * bump + 0.025 * noise1(x * 40, seed) + 0.02 * noise1(x * 9, seed + 7);
    });
    return {
      n,
      // kitchen, living room, bedroom (between-monitor comparison: the spike spreads, weaker)
      series: [mk(0.16, 0.74, 0, 0.07, 1), mk(0.13, 0.26, 0.025, 0.09, 2), mk(0.11, 0.08, 0.05, 0.1, 3)],
    };
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
    const xn = xNow(t);
    const valAt = (k, x) => st.series[k][clamp(Math.round(x * (st.n - 1)), 0, st.n - 1)];

    // ================= House with three monitors =================
    const H = compact ? { x0: w * 0.035, x1: w * 0.3, top: h * 0.3, ground: h * 0.8 } : { x0: w * 0.06, x1: w * 0.34, top: h * 0.34, ground: h * 0.82 };
    const peak = H.top - (H.x1 - H.x0) * 0.36;
    const mid = (H.top + H.ground) / 2 + api.s(4);
    const hx = (u) => lerp(H.x0, H.x1, u);
    api.line([[H.x0 - api.s(8), H.top + api.s(4)], [hx(0.5), peak], [H.x1 + api.s(8), H.top + api.s(4)]], { color: pal.ink3, width: api.s(1.8) });
    api.line([[H.x0, H.top], [H.x0, H.ground], [H.x1, H.ground], [H.x1, H.top]], { color: pal.ink3, width: api.s(1.6) });
    api.line([[H.x0, mid], [H.x1, mid]], { color: pal.ink3, width: api.s(1.3) });
    api.line([[hx(0.52), mid], [hx(0.52), H.ground - (H.ground - mid) * 0.62]], { color: pal.line, width: 1 });
    api.line([[H.x0 - api.s(16), H.ground], [H.x1 + api.s(16), H.ground]], { color: pal.line, width: 1 });
    // A window upstairs and the front door.
    const ww = (H.x1 - H.x0) * 0.16;
    const wy = H.top + (mid - H.top) * 0.3;
    api.rect(hx(0.3) - ww / 2, wy, ww, ww * 0.8, { stroke: pal.line, width: 1, r: 1 });
    api.line([[hx(0.3), wy], [hx(0.3), wy + ww * 0.8]], { color: pal.line, width: 1 });
    const dw = (H.x1 - H.x0) * 0.12;
    api.rect(hx(0.9) - dw / 2, H.ground - (H.ground - mid) * 0.55, dw, (H.ground - mid) * 0.55, { stroke: pal.line, width: 1, r: 1 });
    if (!compact) {
      lab('bedroom', hx(0.06), H.top + fsL + api.s(5), { spacing: 0 });
      const under = 1 - win(t, SPIKE, SMS[1] + 0.75, 0.25); // make room for the spike pill
      lab('kitchen', hx(0.06), mid + fsL + api.s(5), { spacing: 0, alpha: under });
      lab('living', hx(0.58), mid + fsL + api.s(5), { spacing: 0, alpha: under });
    }
    // Stove and pan in the kitchen; steam while cooking.
    const sx = hx(0.2);
    const sw = (H.x1 - H.x0) * 0.24;
    const sTop = H.ground - (H.ground - mid) * 0.34;
    api.rect(sx - sw / 2, sTop, sw, H.ground - sTop, { stroke: pal.ink3, width: 1, r: api.s(1.5) });
    api.line([[sx - sw * 0.32, sTop - api.s(2)], [sx + sw * 0.32, sTop - api.s(2)]], { color: pal.ink2, width: api.s(2.2) });
    api.line([[sx + sw * 0.32, sTop - api.s(3.5)], [sx + sw * 0.62, sTop - api.s(5.5)]], { color: pal.ink2, width: api.s(1.4) });
    const cook = Math.min(seg(t, COOK, COOK + 0.5), 1 - seg(t, 7.5, 8.5));
    if (cook > 0) {
      for (let k = 0; k < 3; k++) {
        const f = (t * 0.55 + k / 3) % 1;
        const bx = sx - sw * 0.2 + k * sw * 0.2;
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const q = j / 8;
          pts.push([bx + Math.sin(q * TAU + f * TAU + k) * api.s(2.2), sTop - api.s(6) - q * api.s(16) - f * api.s(6)]);
        }
        api.line(pts, { color: pal.ink3, width: 1, alpha: A(cook * (1 - f) * 0.9) });
      }
    }
    // Monitors: bedroom, kitchen, living room. Each shows its current PM2.5 as a small meter.
    const mons = [
      { x: hx(0.72), y: H.top + (mid - H.top) * 0.55, k: 2 },
      { x: hx(0.4), y: mid + (H.ground - mid) * 0.36, k: 0 },
      { x: hx(0.8), y: mid + (H.ground - mid) * 0.52, k: 1 },
    ];
    const mw = api.s(compact ? 15 : 19);
    const mh = api.s(compact ? 10 : 12);
    const detected = t >= SPIKE;
    for (const m of mons) {
      const v = valAt(m.k, xn);
      const hot = m.k === 0 && detected && t < 8.5;
      api.rect(m.x - mw / 2, m.y - mh / 2, mw, mh, { fill: pal.surface, stroke: hot ? api.accent : pal.ink2, width: api.s(1.3), r: api.s(2.5) });
      const iw = (mw - api.s(6)) * clamp(v / 0.9);
      api.rect(m.x - mw / 2 + api.s(3), m.y - api.s(1.5), Math.max(1, iw), api.s(3), { fill: hot ? api.accent : pal.ink3, r: api.s(1) });
    }
    // Spike detection ring on the kitchen monitor.
    const ring = seg(t, SPIKE, SPIKE + 0.9);
    if (ring > 0 && ring < 1) {
      api.circle(mons[1].x, mons[1].y, mw * 0.6 + api.s(18) * ease.out(ring), { stroke: api.accent, width: api.s(1.6), alpha: A(1 - ring) });
    }
    if (!compact) api.caption('PM2.5 spike', mons[1].x, mons[1].y - mh - api.s(10), SPIKE + 0.1, SMS[1] + 0.4, { size: api.fs(10), color: api.accentInk, border: api.accent, alpha: fade });

    // ================= Phone =================
    const Ph = compact ? { x: w * 0.355, y: h * 0.16, w: w * 0.22, h: h * 0.66 } : { x: w * 0.405, y: h * 0.18, w: w * 0.165, h: h * 0.63 };
    api.rect(Ph.x, Ph.y, Ph.w, Ph.h, { fill: pal.surface, stroke: pal.ink2, width: api.s(1.5), r: api.s(compact ? 8 : 11) });
    api.rect(Ph.x + Ph.w * 0.36, Ph.y + api.s(5), Ph.w * 0.28, api.s(4), { fill: pal.line, r: api.s(2) });
    if (!compact) lab('PARTICIPANT', Ph.x + Ph.w / 2, Ph.y - api.s(9), { align: 'center' });
    const pad = Ph.w * 0.09;
    const bfs = api.fs(compact ? 10 : 10.5);
    const lh = bfs * 1.25;
    // Incoming prompt.
    const inP = ease.out(seg(t, SMS[1], SMS[1] + 0.35));
    const lines = compact ? ['Spike in', 'kitchen.', 'Tag it?'] : ['PM2.5 spike', 'in kitchen.', 'What was it?'];
    const bubW = Math.min(Ph.w - pad * 2, Math.max(...lines.map((s) => api.measure(s, { size: bfs }))) + pad * 1.6);
    const bubH = lines.length * lh + pad * 1.1;
    const by = Ph.y + api.s(compact ? 18 : 24);
    if (inP > 0) {
      ctx.save();
      ctx.translate(Ph.x + pad, by);
      ctx.scale(0.85 + 0.15 * inP, 0.85 + 0.15 * inP);
      api.rect(0, 0, bubW, bubH, { fill: pal.grid, stroke: pal.line, width: 1, r: api.s(6), alpha: A(inP) });
      lines.forEach((s, i) => api.text(s, pad * 0.8, pad * 0.55 + lh * (i + 0.8), { size: bfs, color: pal.ink, alpha: A(inP) }));
      ctx.restore();
    }
    // Reply chips, the tap, and the outgoing tag.
    const chipsA = ease.out(seg(t, CHIPS, CHIPS + 0.3)) * (1 - seg(t, TAP + 0.25, TAP + 0.55));
    const opts = compact ? ['cooking', 'other'] : ['cooking', 'cleaning', 'other'];
    const cy0 = by + bubH + api.s(compact ? 12 : 16);
    const chH = bfs * 1.75;
    if (chipsA > 0) {
      opts.forEach((o, i) => {
        const y = cy0 + i * (chH + api.s(5));
        const ow = api.measure(o, { size: bfs }) + bfs * 1.2;
        const x = Ph.x + Ph.w - pad - ow;
        const pick = i === 0 && t >= TAP;
        api.rect(x, y, ow, chH, { fill: pick ? api.accent : pal.surface, stroke: i === 0 ? api.accent : pal.line, width: 1, r: chH / 2, alpha: A(chipsA) });
        api.text(o, x + ow / 2, y + chH / 2 + bfs * 0.36, { size: bfs, color: pick ? (pal.dark ? '#0A0B0F' : '#fff') : i === 0 ? api.accentInk : pal.ink2, align: 'center', alpha: A(chipsA) });
      });
    }
    const tap = seg(t, TAP - 0.05, TAP + 0.5);
    if (tap > 0 && tap < 1) {
      const ow = api.measure('cooking', { size: bfs }) + bfs * 1.2;
      api.circle(Ph.x + Ph.w - pad - ow / 2, cy0 + chH / 2, api.s(4) + api.s(14) * ease.out(tap), { stroke: api.accent, width: api.s(1.4), alpha: A(1 - tap) });
    }
    const outP = ease.out(seg(t, TAP + 0.35, TAP + 0.7));
    if (outP > 0) {
      const ow = api.measure('cooking', { size: bfs }) + pad * 1.6;
      const x = Ph.x + Ph.w - pad - ow;
      const y = cy0 + api.s(2) * (1 - outP);
      api.rect(x, y, ow, bfs * 2, { fill: api.accent, r: api.s(6), alpha: A(outP) });
      api.text('cooking', x + ow / 2, y + bfs + bfs * 0.36, { size: bfs, weight: 600, color: pal.dark ? '#0A0B0F' : '#fff', align: 'center', alpha: A(outP) });
      if (!compact) api.text('tagged', x + ow, y + bfs * 2 + api.s(13), { size: api.fs(10), color: pal.ink3, align: 'right', alpha: A(outP) });
    }

    // ================= Tablet: timeline with the annotation =================
    const Tb = compact ? { x: w * 0.625, y: h * 0.3, w: w * 0.345, h: h * 0.42 } : { x: w * 0.625, y: h * 0.3, w: w * 0.305, h: h * 0.44 };
    api.rect(Tb.x, Tb.y, Tb.w, Tb.h, { fill: pal.surface, stroke: pal.ink2, width: api.s(1.5), r: api.s(compact ? 6 : 9) });
    if (!compact) lab('TABLET', Tb.x + Tb.w / 2, Tb.y - api.s(9), { align: 'center' });
    const C = { x: Tb.x + Tb.w * 0.07, y: Tb.y + Tb.h * (compact ? 0.3 : 0.27), w: Tb.w * 0.86, h: Tb.h * (compact ? 0.58 : 0.6) };
    const cx = (x) => C.x + x * C.w;
    const cy = (v) => C.y + C.h * (1 - v);
    // Axis caption under the timeline (kept clear of the annotation flag above the plot).
    const capBase = C.y + C.h + api.fs(10) * 1.15;
    if (capBase < Tb.y + Tb.h - api.s(3)) api.text('PM2.5 · today', C.x + C.w, capBase, { size: api.fs(10), color: pal.ink3, align: 'right' });
    api.line([[C.x, C.y + C.h], [C.x + C.w, C.y + C.h]], { color: pal.line, width: 1 });
    // Annotated span behind the lines.
    const tagA = ease.out(seg(t, TAG[1] - 0.1, TAG[1] + 0.4));
    if (tagA > 0) api.rect(cx(XS - 0.02), C.y, C.w * 0.2, C.h, { fill: api.accent, alpha: A(0.12 * tagA) });
    const cols = [pal.ink2, pal.ink3, pal.ink3];
    for (let k = 2; k >= 0; k--) {
      ctx.save();
      ctx.beginPath();
      const iMax = Math.round(xn * (st.n - 1));
      for (let i = 0; i <= iMax; i++) {
        const x = cx(i / (st.n - 1));
        const y = cy(st.series[k][i]);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = cols[k];
      ctx.lineWidth = api.s(k === 0 ? 1.7 : 1.2);
      ctx.globalAlpha = A(k === 2 ? 0.6 : 1);
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
    api.line([[cx(xn), C.y], [cx(xn), C.y + C.h]], { color: pal.line, width: 1 });
    const kA = seg(xn, XS + 0.08, XS + 0.12); // the line label waits for the spike to be drawn
    if (!compact && kA > 0) {
      api.text('kitchen', cx(XS + 0.075), cy(valAt(0, XS + 0.05)) + api.s(2), { size: api.fs(10), color: pal.ink2, alpha: A(kA) });
    }
    // The flag: the participant's tag pinned to the spike.
    if (tagA > 0) {
      const fxp = cx(XS + 0.005);
      const top = C.y - api.s(compact ? 4 : 6);
      api.line([[fxp, cy(valAt(0, XS + 0.005)) - api.s(2)], [fxp, top]], { color: api.accent, width: api.s(1.5), alpha: A(tagA) });
      api.label('cooking', fxp - api.s(2), top, { align: 'left', size: api.fs(10), color: pal.dark ? '#0A0B0F' : '#fff', bg: api.accent, border: false, alpha: A(tagA), pop: 0.9 + 0.1 * tagA });
    }

    // ================= Messages in flight =================
    const arc = (p0, p1, f, lift) => {
      const mx = (p0[0] + p1[0]) / 2;
      const my = Math.min(p0[1], p1[1]) - lift;
      const u = 1 - f;
      return [u * u * p0[0] + 2 * u * f * mx + f * f * p1[0], u * u * p0[1] + 2 * u * f * my + f * f * p1[1]];
    };
    const sms = seg(t, SMS[0], SMS[1]);
    if (sms > 0 && sms < 1) {
      for (let k = 0; k < 4; k++) {
        const f = ease.inOut(clamp(sms - k * 0.05));
        const [x, y] = arc([mons[1].x + mw / 2, mons[1].y], [Ph.x + pad, by + api.s(6)], f, api.s(40));
        api.circle(x, y, api.s(3 - k * 0.55), { fill: api.accent, alpha: A(1 - k * 0.22) });
      }
    }
    const tag = seg(t, TAG[0], TAG[1]);
    if (tag > 0 && tag < 1) {
      for (let k = 0; k < 4; k++) {
        const f = ease.inOut(clamp(tag - k * 0.05));
        const [x, y] = arc([Ph.x + Ph.w, cy0 + bfs], [cx(XS), C.y - api.s(4)], f, api.s(30));
        api.circle(x, y, api.s(3 - k * 0.55), { fill: api.accent, alpha: A(1 - k * 0.22) });
      }
    }

    // ================= Live captions =================
    const capX = compact ? w * 0.5 : w * 0.47;
    const capY = h * (compact ? 0.92 : 0.915);
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    api.caption(compact ? 'monitors in every room' : 'monitors in several rooms', capX, capY, 0.7, SPIKE - 0.1, neu);
    api.caption(compact ? 'spike → text prompt' : 'spike detected → text prompt', capX, capY, SPIKE + 0.05, TAP - 0.25, acc);
    api.caption(compact ? 'tagged: cooking' : 'participant tags it "cooking"', capX, capY, TAP - 0.1, TAG[1], acc);
    api.caption(compact ? 'annotated on the tablet' : 'annotated spike on the tablet timeline', capX, capY, TAG[1] + 0.1, D - 0.6, acc);
    ctx.globalAlpha = 1;
  },
};
