// On-off Noise Power Communication (MobiCom 2019).
// A Wi-Fi radio too far away to be decoded can still raise the receiver's noise floor.
// ONPC spreads each data bit over a pseudo-random chip code; an "on" chip is a frame
// sent, an "off" chip is silence. The receiver only samples noise power, which other
// devices' traffic keeps spiking, and correlates it with the code over each bit
// (bursts clipped): the correlation climbs to a clean peak, up = 1, down = 0.
import { seg, ease, clamp, mix } from './kit.js';

const D = 13;
const BITS = [1, 0, 1, 1];
const NC = 15; // chips per bit (maximum-length sequence)
const SPC = 4; // noise samples per chip
const CHIP_T = 0.16; // seconds per chip (slowed down)
const T0 = 0.8;
const NCH = BITS.length * NC;
const T_END = T0 + NCH * CHIP_T;

function mseq() {
  // LFSR x^4 + x + 1 → 15-chip m-sequence of ±1.
  let s = 0b1000;
  const out = [];
  for (let i = 0; i < NC; i++) {
    out.push(s & 1 ? 1 : -1);
    const fb = (s ^ (s >> 1)) & 1;
    s = (s >> 1) | (fb << 3);
  }
  return out;
}

export default {
  duration: D,
  still: 10.9,
  scene: false,

  init(api) {
    const r = api.rng('onpc');
    const code = mseq();
    const chips = BITS.flatMap((b) => code.map((c) => (b ? c : -c)));
    const n = NCH * SPC;
    // Noise power: floor + small rise while our frames are on + other devices' bursts.
    const rssi = new Float32Array(n);
    const bursts = [];
    for (let i = 0; i < 9; i++) bursts.push({ at: r.range(4, n - 4), len: r.range(1.5, 4.5), amp: r.range(0.45, 0.95) });
    bursts.push({ at: NC * SPC * 1.35, len: 4, amp: 1 }); // a big one early, for the caption
    for (let i = 0; i < n; i++) {
      const on = chips[Math.floor(i / SPC)] > 0;
      let v = 0.18 + r.gauss() * 0.035 + (on ? 0.13 : 0);
      for (const b of bursts) if (i >= b.at && i < b.at + b.len) v += b.amp * (0.85 + 0.15 * r());
      rssi[i] = Math.min(1.15, v);
    }
    // Correlate with the code over each bit period (synchronized receiver), after clipping
    // interference bursts; the running sum ends in a clean peak.
    const clipTop = 0.42;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += Math.min(rssi[i], clipTop);
    mean /= n;
    const L = NC * SPC;
    const corr = new Float32Array(n);
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (i % L === 0) c = 0;
      c += code[Math.floor((i % L) / SPC)] * (Math.min(rssi[i], clipTop) - mean);
      corr[i] = c;
    }
    const peak = Math.max(...BITS.map((_, b) => Math.abs(corr[(b + 1) * L - 1])));
    for (let i = 0; i < n; i++) corr[i] /= peak;
    const bigBurst = bursts[bursts.length - 1].at;
    return { code, chips, rssi, corr, bigBurst };
  },

  draw(api, st) {
    const { w, h, t, pal, ctx } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const acLine = pal.dark ? api.accent : mix(api.accent, api.accentInk, 0.55);
    const acEdge = pal.dark ? api.accent : mix(api.accent, api.accentInk, 0.4);
    const onAccent = '#14161C';

    const x0 = w * (compact ? 0.07 : 0.2);
    const x1 = w * (compact ? 0.95 : 0.94);
    const chipW = (x1 - x0) / NCH;
    const cx = (c) => x0 + c * chipW;
    const curChip = clamp((t - T0) / CHIP_T, 0, NCH);
    const sx = (i) => x0 + (i / SPC) * chipW; // sample index → x
    const labX = w * 0.06;
    const rowLab = (str, y) => !compact && lab(str, labX, y + api.fs(10.5) * 0.35);

    // Row geometry.
    const R = compact
      ? { tx: h * 0.16, txH: h * 0.1, rs: [h * 0.36, h * 0.6], co: [h * 0.7, h * 0.92] }
      : { bits: h * 0.165, chips: h * 0.275, tx: h * 0.385, txH: h * 0.062, rs: [h * 0.47, h * 0.62], co: [h * 0.69, h * 0.86], dec: h * 0.935 };

    // Symbol separators across all rows.
    const top = compact ? R.tx - R.txH : R.bits - h * 0.035;
    for (let b = 0; b <= BITS.length; b++) {
      api.line([[cx(b * NC), top], [cx(b * NC), R.co[1]]], { color: pal.grid, width: 1 });
    }

    // ---- Data bits (full rows: compact shows them above the TX row) ----
    const symNow = Math.min(BITS.length - 1, Math.floor(curChip / NC));
    const sending = t >= T0 && t < T_END;
    if (!compact) {
      rowLab('DATA BITS', R.bits);
      const ch = h * 0.058;
      BITS.forEach((b, i) => {
        const active = sending && i === symNow;
        const l = cx(i * NC) + api.s(3);
        const ww = NC * chipW - api.s(6);
        api.rect(l, R.bits - ch / 2, ww, ch, { fill: active ? api.accent : pal.surface, stroke: active ? acEdge : pal.line, width: 1, r: api.s(3) });
        api.text(String(b), l + ww / 2, R.bits + api.fs(13) * 0.36, { size: api.fs(13), weight: 650, align: 'center', color: active ? onAccent : pal.ink });
      });
      // ---- Chip code ----
      rowLab('× CHIP CODE', R.chips);
      const amp = h * 0.026;
      const pts = [];
      st.chips.forEach((c, i) => {
        const y = R.chips - c * amp;
        pts.push([cx(i), y], [cx(i + 1), y]);
      });
      api.line(pts, { color: pal.ink2, width: api.s(1.3), join: 'miter' });
      if (sending) {
        const i = Math.floor(curChip);
        api.rect(cx(i), R.chips - amp - api.s(3), chipW, amp * 2 + api.s(6), { fill: pal.dark ? 'rgba(233,235,239,0.10)' : 'rgba(20,22,28,0.08)', r: api.s(1.5) });
      }
    } else {
      BITS.forEach((b, i) => api.text(String(b), cx(i * NC + NC / 2), R.tx - R.txH / 2 - api.s(10), { size: api.fs(11), weight: 650, align: 'center', color: sending && i === symNow ? api.accentInk : pal.ink2 }));
    }

    // ---- TX: frame sent (on) or silence (off) per chip ----
    rowLab('TX ON / OFF', R.tx);
    api.line([[x0, R.tx + R.txH / 2], [x1, R.tx + R.txH / 2]], { color: pal.line, width: 1 });
    const bw = Math.max(1.5, chipW - Math.max(1, api.s(1.6)));
    for (let i = 0; i < NCH; i++) {
      const p = seg(curChip, i, i + 0.6);
      if (p <= 0 || st.chips[i] < 0) continue;
      const hh = R.txH * ease.out(p);
      api.rect(cx(i) + (chipW - bw) / 2, R.tx + R.txH / 2 - hh, bw, hh, { fill: api.accent, stroke: pal.dark ? undefined : acEdge, width: 1, r: Math.min(api.s(1.5), bw / 3) });
    }

    // ---- RX: measured noise power ----
    rowLab(compact ? '' : 'RX NOISE POWER', (R.rs[0] + R.rs[1]) / 2);
    if (compact) lab('RX NOISE POWER', x0, R.rs[0] - api.s(6));
    const rsY = (v) => R.rs[1] - clamp(v / 1.15) * (R.rs[1] - R.rs[0]);
    api.line([[x0, R.rs[1]], [x1, R.rs[1]]], { color: pal.line, width: 1 });
    const nUp = Math.floor(curChip * SPC);
    if (nUp > 1) {
      const pts = [];
      for (let i = 0; i < nUp; i++) pts.push([sx(i + 0.5), rsY(st.rssi[i])]);
      api.line([...pts, [pts[pts.length - 1][0], R.rs[1]], [pts[0][0], R.rs[1]]], { color: 'none', fill: pal.dark ? 'rgba(233,235,239,0.06)' : 'rgba(20,22,28,0.05)', close: true });
      api.line(pts, { color: pal.ink2, width: api.s(1.3) });
    }

    // ---- Correlation with the chip code ----
    const coMid = (R.co[0] + R.co[1]) / 2;
    const coA = (R.co[1] - R.co[0]) / 2;
    const coY = (v) => coMid - clamp(v, -1.15, 1.15) * coA * 0.85;
    if (compact) lab('CORRELATION', x0, R.co[0] - api.s(6));
    else rowLab('CORRELATION', coMid);
    api.line([[x0, coMid], [x1, coMid]], { color: pal.line, width: 1 });
    for (const v of [0.5, -0.5]) api.line([[x0, coY(v)], [x1, coY(v)]], { color: pal.ink3, width: 1, dash: [api.s(3), api.s(4)], alpha: 0.6 });
    const L = NC * SPC;
    for (let b = 0; b < BITS.length; b++) {
      const i0 = b * L;
      if (nUp <= i0) break;
      const pts = [[cx(b * NC), coMid]];
      for (let i = i0; i < Math.min(nUp, i0 + L); i++) pts.push([sx(i + 1), coY(st.corr[i])]);
      api.line(pts, { color: acLine, width: api.s(1.8) });
    }
    // Peaks at the end of each bit, and the decoded bits.
    BITS.forEach((b, i) => {
      const end = (i + 1) * NC;
      const te = T0 + end * CHIP_T;
      const a = ease.out(seg(t, te, te + 0.35));
      if (a <= 0) return;
      const v = st.corr[end * SPC - 1];
      const px = cx(end);
      const py = coY(v);
      api.line([[px, py], [px, coMid]], { color: acLine, width: 1, dash: [api.s(2), api.s(2)], alpha: a });
      api.circle(px, py, api.s(4) * (0.6 + 0.4 * a), { fill: api.accent, stroke: acEdge, width: 1 });
      if (compact) api.text(String(b), px - api.s(12), py + (v > 0 ? api.s(4) : api.s(4)), { size: api.fs(12), weight: 700, align: 'right', color: api.accentInk, alpha: a });
      else api.text(String(b), cx(i * NC + NC / 2), R.dec, { size: api.fs(15), weight: 700, align: 'center', color: api.accentInk, alpha: a });
    });
    if (!compact) rowLab('DECODED', R.dec - api.fs(10.5) * 0.3);

    // Cursor.
    const curA = Math.min(seg(t, T0 - 0.3, T0), 1 - seg(t, T_END, T_END + 0.4));
    if (curA > 0) api.line([[cx(curChip), top], [cx(curChip), R.co[1]]], { color: pal.ink, width: 1, alpha: 0.5 * curA });

    // ---- Captions ----
    api.caption(compact ? 'on = frame sent' : 'on = a frame sent · off = silence', x1, compact ? R.tx - R.txH / 2 - api.s(10) : R.tx, T0 + 0.3, T0 + 2.1, { align: 'right', color: api.accentInk, border: acEdge, size: api.fs(11) });
    const tb = T0 + (st.bigBurst / SPC) * CHIP_T;
    const trafX = compact ? Math.min(x1 - api.s(50), sx(st.bigBurst) + api.s(80)) : x0 + api.s(2);
    const trafY = compact ? R.rs[0] + api.s(2) : (R.rs[1] + R.co[0]) / 2;
    api.caption(compact ? "others' traffic" : "other devices' traffic", trafX, trafY, tb + 0.05, tb + 1.9, { align: compact ? 'center' : 'left', color: pal.ink, border: pal.ink3, size: api.fs(11) });
    const tp = T0 + NC * CHIP_T;
    api.caption(compact ? 'peak up = 1, down = 0' : 'correlation peak: up = 1, down = 0', x1, compact ? R.co[0] - api.s(4) : (R.rs[1] + R.co[0]) / 2, tp + 0.15, tp + 3.4, { align: 'right', color: api.accentInk, border: acEdge, size: api.fs(11) });

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
