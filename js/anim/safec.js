// SAFEC: Slack-Aware Forward Error Correction (MobiCom 2026 WiP).
// A codeword's FEC can correct more errors than the channel usually causes.
// SAFEC spends that slack on purpose: it flips chosen bits so that *where* the
// errors sit encodes a second stream. The decoder fixes every error (the base data
// is untouched) and the corrected positions read back as the secondary bits.
import { clamp, lerp, seg, ease, win } from './kit.js';

const SEGS = 4; // codeword split into segments; one deliberate flip per segment
const PER = 6; // bits per segment
const N = SEGS * PER;
const SLOTS = 4; // candidate slots per segment → 2 secondary bits each
const SECONDARY = [[1, 0], [0, 1], [1, 1], [0, 0]];
const CHANNEL_ERR = [4, 16]; // positions the channel corrupts

// Phases (seconds)
const P = { build: [0, 1.2], encode: [1.4, 3.6], channel: [3.8, 5.4], decode: [5.6, 8.4], gain: [8.6, 11.4], out: [11.4, 12] };

export default {
  duration: 12,
  still: 8.1,

  init(api) {
    const r = api.rng('safec');
    const data = Array.from({ length: N }, () => (r() < 0.5 ? 0 : 1));
    // Slot positions within each segment (spread out), and the chosen slot per segment.
    const slotOffsets = [0, 2, 3, 5];
    const flips = SECONDARY.map((pair, sIdx) => sIdx * PER + slotOffsets[pair[0] * 2 + pair[1]]);
    return { data, slotOffsets, flips };
  },

  draw(api, st) {
    const { w, h, t, pal } = api;
    const compact = api.compact;
    const lab = (str, x, y, o = {}) => api.text(str, x, y, { size: api.fs(10.5), color: pal.ink3, spacing: 0.4, ...o });
    const fadeAll = 1 - seg(t, P.out[0], P.out[1]);
    const ctx = api.ctx;
    ctx.globalAlpha = fadeAll;

    // Geometry
    const left = w * 0.07;
    const right = w * 0.93;
    const cellGap = Math.max(1.5, api.s(2.5));
    const segGap = api.s(10);
    const cell = (right - left - segGap * (SEGS - 1) - cellGap * (N - SEGS)) / N;
    const rowY = h * (compact ? 0.44 : 0.45);
    const cellH = Math.min(cell * 1.35, h * 0.13);
    const xOf = (i) => left + i * (cell + cellGap) + Math.floor(i / PER) * (segGap - cellGap);

    // ---- Secondary data (top) ----
    const secY = h * 0.22;
    const encodeP = seg(t, P.encode[0], P.encode[0] + 0.6);
    lab('SECONDARY DATA', left, secY - api.s(compact ? 14 : 16));
    for (let sIdx = 0; sIdx < SEGS; sIdx++) {
      const sx = xOf(sIdx * PER);
      const sw = xOf(sIdx * PER + PER - 1) + cell - sx;
      const pair = SECONDARY[sIdx];
      const a = ease.out(seg(t, P.build[0] + 0.15 * sIdx, P.build[0] + 0.15 * sIdx + 0.5));
      api.text(pair.join(''), sx + sw / 2, secY + api.fs(13) * 0.35, { size: api.fs(17), weight: 600, align: 'center', color: api.accentInk, alpha: a });
      // Bracket over the segment.
      api.line([[sx, secY + api.s(14)], [sx, secY + api.s(18)], [sx + sw, secY + api.s(18)], [sx + sw, secY + api.s(14)]], { color: pal.line, width: 1, alpha: a });
    }

    // ---- Codeword row ----
    const decodeX = lerp(left - api.s(10), right + api.s(10), ease.inOut(seg(t, P.decode[0], P.decode[1] - 0.5)));
    const decoding = t >= P.decode[0];
    const transitP = seg(t, P.channel[0], P.channel[1]);
    const lift = Math.sin(Math.PI * transitP) * api.s(6);
    lab(compact ? 'CODEWORD' : 'LDPC CODEWORD', left, rowY - cellH / 2 - api.s(12));
    for (let i = 0; i < N; i++) {
      const x = xOf(i);
      const appear = ease.out(seg(t, P.build[0] + i * 0.02, P.build[0] + i * 0.02 + 0.4));
      if (appear <= 0) continue;
      const isFlip = st.flips.includes(i);
      const isChan = CHANNEL_ERR.includes(i);
      const flipOn = isFlip && t >= P.encode[0] + 0.7 + (st.flips.indexOf(i) * 0.35);
      const chanOn = isChan && t >= P.channel[0] + 0.5 + CHANNEL_ERR.indexOf(i) * 0.4;
      const corrected = decoding && x + cell / 2 < decodeX;
      const wrong = (flipOn || chanOn) && !corrected;
      let fill = pal.surface;
      let stroke = pal.line;
      let txt = pal.ink3;
      if (wrong && isFlip) { fill = api.accent; stroke = api.accent; txt = api.pal.dark ? '#0A0B0F' : '#fff'; }
      else if (wrong && isChan) { fill = pal.ink2; stroke = pal.ink2; txt = pal.bg; }
      else if (corrected && (flipOn || chanOn)) { stroke = isFlip ? api.accent : pal.ink2; txt = pal.ink; }
      const y = rowY - cellH / 2 - (isFlip || isChan ? 0 : 0) - lift * (0.6 + 0.4 * Math.sin(i * 0.7));
      api.rect(x, y, cell, cellH, { fill, stroke, width: 1, r: Math.min(api.s(3), cell * 0.25), alpha: appear });
      const bit = wrong ? 1 - st.data[i] : st.data[i];
      if (cell > 9) api.text(String(bit), x + cell / 2, y + cellH / 2 + Math.min(api.fs(13), cell * 0.62) * 0.36, { size: Math.min(api.fs(13), cell * 0.62), align: 'center', color: txt, weight: 600, alpha: appear });
      // Candidate slots under each segment.
      const slot = st.slotOffsets.indexOf(i % PER);
      if (slot >= 0) {
        const sa = appear * (0.35 + 0.65 * win(t, P.encode[0], P.encode[1] + 1.2, 0.4));
        api.circle(x + cell / 2, rowY + cellH / 2 + api.s(8), api.s(1.8), { fill: isFlip && flipOn ? api.accent : pal.ink3, alpha: sa });
      }
    }
    // Drop markers falling onto chosen slots.
    st.flips.forEach((i, k) => {
      const t0 = P.encode[0] + 0.25 + k * 0.35;
      const p = seg(t, t0, t0 + 0.45);
      if (p <= 0 || p >= 1) return;
      const x = xOf(i) + cell / 2;
      const y = lerp(secY + api.s(22), rowY - cellH / 2, ease.in(p));
      api.circle(x, y, api.s(3.5), { fill: api.accent });
    });
    api.caption('flip a bit: its position carries 2 bits', w / 2, rowY + cellH / 2 + api.s(28), P.encode[0] + 0.7, P.encode[1] + 0.2, { color: api.accentInk, border: api.accent });
    api.caption('channel adds its own errors', w / 2, rowY + cellH / 2 + api.s(28), P.channel[0] + 0.4, P.channel[1], { color: pal.ink, border: pal.line });
    // Decoder sweep.
    if (decoding && t < P.decode[1]) {
      api.line([[decodeX, rowY - cellH * 0.95], [decodeX, rowY + cellH * 0.95]], { color: pal.ink, width: api.s(2) });
      api.text('DECODER', decodeX, rowY - cellH - api.s(6), { size: api.fs(10), color: pal.ink2, align: 'center', weight: 600 });
    }

    // ---- Correction budget (slack meter) ----
    const mY = h * (compact ? 0.68 : 0.7);
    const mX = left;
    const mW = right - left;
    const mH = api.s(compact ? 9 : 11);
    const meterA = ease.out(seg(t, P.build[1] - 0.4, P.build[1] + 0.4)) * (1 - seg(t, P.gain[0] - 0.4, P.gain[0]));
    if (meterA > 0) {
      lab('ERRORS THE CODE CAN CORRECT', mX, mY - api.s(9), { alpha: meterA });
      api.rect(mX, mY, mW, mH, { stroke: pal.line, width: 1, r: mH / 2, alpha: meterA });
      const capacity = 10;
      const chanUsed = CHANNEL_ERR.filter((_, k) => t >= P.channel[0] + 0.5 + k * 0.4).length;
      const flipUsed = st.flips.filter((_, k) => t >= P.encode[0] + 0.7 + k * 0.35).length;
      const unit = mW / capacity;
      if (chanUsed) api.rect(mX, mY, unit * chanUsed, mH, { fill: pal.ink2, r: mH / 2, alpha: meterA });
      if (flipUsed) api.rect(mX + unit * chanUsed, mY, unit * flipUsed, mH, { fill: api.accent, r: mH / 2, alpha: meterA });
      if (!compact) {
        lab(`channel ${chanUsed}`, mX, mY + mH + api.s(15), { alpha: meterA, color: pal.ink2 });
        lab(`SAFEC ${flipUsed}`, mX + unit * Math.max(chanUsed, 2) + api.s(8), mY + mH + api.s(15), { alpha: meterA, color: api.accentInk });
        lab(`unused slack ${capacity - chanUsed - flipUsed}`, mX + mW, mY + mH + api.s(15), { alpha: meterA, align: 'right' });
      }
    }

    // ---- Readout ----
    const outY = h * 0.89;
    const readA = ease.out(seg(t, P.decode[0] + 0.4, P.decode[0] + 1));
    const gainP = seg(t, P.gain[0], P.gain[0] + 0.5);
    if (readA > 0 && gainP < 1) {
      const a = readA * (1 - gainP);
      const got = st.flips.filter((i) => xOf(i) + cell / 2 < decodeX).length;
      const bits = SECONDARY.slice(0, got).map((p) => p.join('')).join(' ');
      api.text('base data', left, outY, { size: api.fs(12), color: pal.ink2, alpha: a });
      api.text('intact', left + api.measure('base data ', { size: api.fs(12) }), outY, { size: api.fs(12), color: pal.ink, weight: 650, alpha: a });
      api.text(`secondary  ${bits || '…'}`, right, outY, { size: api.fs(12), color: api.accentInk, align: 'right', weight: 600, alpha: a });
    }

    // ---- Throughput between MCS steps ----
    const gA = ease.out(gainP) * (1 - seg(t, P.out[0] - 0.2, P.out[0] + 0.3));
    if (gA > 0) {
      const gx = left;
      const gw = right - left;
      const gy = h * 0.7;
      const bh = api.s(compact ? 12 : 14);
      const grow = ease.out(seg(t, P.gain[0] + 0.3, P.gain[0] + 1.6));
      lab('THROUGHPUT', gx, gy - api.s(9), { alpha: gA });
      const rows = [
        { label: 'MCS n', v: 0.6, color: pal.ink3 },
        { label: 'MCS n + SAFEC', v: 0.6 + 0.6 * 0.095 * grow * 1.7, color: api.accent },
        { label: 'MCS n+1', v: 0.6 * 1.194, color: pal.ink3 },
      ];
      rows.forEach((row, i) => {
        const y = gy + i * (bh + api.s(9));
        const len = gw * 0.62 * row.v * (i === 1 ? 1 : grow);
        api.rect(gx, y, Math.max(2, len), bh, { fill: row.color, r: bh / 2, alpha: gA * (i === 1 ? 1 : 0.7) });
        api.text(row.label, gx + len + api.s(8), y + bh * 0.72, { size: api.fs(11), color: i === 1 ? api.accentInk : pal.ink2, weight: i === 1 ? 600 : 500, alpha: gA });
      });
      api.caption('fills the gap between steps', right, gy - api.s(12), P.gain[0] + 1.2, P.gain[1], { align: 'right', color: api.accentInk, border: api.accent });
    }
    ctx.globalAlpha = 1;
    void clamp;
  },
};
