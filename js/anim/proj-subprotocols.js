// Software-Based Wireless Sub-Protocols: cinematic scene.
// Ordinary Wi-Fi frames stream toward the viewer across three channels. A decoder
// plane reads one hidden bit from each frame's power (tall = 1, short = 0) as it
// passes; the bits spell a message, while the frames themselves arrive unchanged.
import { TAU, clamp, lerp, seg, ease, textBits, fract } from './kit.js';

const D = 16; // loop length (s)
const SPEED = 1.5; // depth units per second
const Z_FAR = 13;
const Z_NEAR = 0.2;
const Z_LENS = 3.4;
const LANES = [-1.85, 0, 1.85];
const MESSAGE = 'NET';
const BG_TOP = '#03050A';
const BG_BOT = '#0B111D';
const PINK = '#ED3F95';
const FRAME = '220,230,242';

export default {
  duration: D,
  still: 11.2,
  scene: true,

  init(api) {
    const r = api.rng('subprotocols-scene');
    const bits = textBits(MESSAGE); // 24 bits → 24 frames per loop
    const travelToLens = (Z_FAR - Z_LENS) / SPEED;
    // Crossing times spread through the loop, leaving the first and last second quiet.
    let prevLane = 1;
    const packets = bits.map((bit, i) => {
      const cross = 1.4 + (i / bits.length) * (D - 3.2) + r.range(-0.15, 0.15);
      const lane = (prevLane + 1 + r.int(0, 1)) % 3; // never the same lane twice in a row
      prevLane = lane;
      return {
        bit,
        lane: LANES[lane],
        jitterX: r.range(-0.18, 0.18),
        width: r.range(0.78, 0.98),
        len: r.range(0.45, 1.05),
        height: bit ? r.range(0.62, 0.78) : r.range(0.2, 0.3),
        cross,
        spawn: cross - travelToLens,
      };
    });
    // Background traffic that never crosses during this loop's message window (fills the far field).
    const extra = [];
    for (let i = 0; i < 14; i++) {
      extra.push({ lane: LANES[i % 3], jitterX: r.range(-0.15, 0.15), width: r.range(0.75, 0.95), len: r.range(0.4, 1), height: r.range(0.22, 0.7), phase: r() * D });
    }
    const dust = Array.from({ length: 70 }, () => ({ x: r.range(-4, 4), y: r.range(0, 2.6), z: r.range(0.5, Z_FAR), s: r.range(0.4, 1), ph: r() * TAU }));
    return { packets, extra, dust, bits };
  },

  draw(api, st) {
    const { w, h, t, ctx } = api;
    // Background
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, BG_TOP);
    g.addColorStop(1, BG_BOT);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const narrow = w / h < 1.6;
    const cam = { x: 0, y: narrow ? 2.6 : 2.25, z: narrow ? -3.2 : -2.4, pitch: narrow ? -0.44 : -0.36, yaw: Math.sin((t / D) * TAU) * 0.04, f: narrow ? 0.82 : 0.95 };
    const P = (x, y, z) => api.project(x, y, z, cam);
    // Fade into the distance, and fade out just before reaching the viewer.
    const fog = (z) => clamp(1 - (z - 2) / (Z_FAR - 1.5), 0, 1) * clamp((z - Z_NEAR) / 2.2, 0, 1);

    // Horizon glow
    const hz = P(0, 0, Z_FAR);
    if (hz) {
      const hg = ctx.createRadialGradient(w / 2, hz[1], 0, w / 2, hz[1], w * 0.6);
      hg.addColorStop(0, 'rgba(60,90,140,0.22)');
      hg.addColorStop(1, 'rgba(60,90,140,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, h);
    }

    // Floor grid
    ctx.lineWidth = 1;
    for (let x = -4; x <= 4; x += 0.7) {
      const a = P(x, 0, Z_NEAR + 0.3);
      const b = P(x, 0, Z_FAR);
      if (!a || !b) continue;
      ctx.strokeStyle = 'rgba(140,165,205,0.07)';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const scroll = fract((t * SPEED) / 0.8);
    for (let k = 0; k < 18; k++) {
      const z = Z_NEAR + 0.3 + (k - scroll) * 0.8;
      if (z < Z_NEAR + 0.3 || z > Z_FAR) continue;
      const a = P(-4.2, 0, z);
      const b = P(4.2, 0, z);
      if (!a || !b) continue;
      ctx.strokeStyle = `rgba(140,165,205,${0.09 * fog(z)})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // Channel lanes
    for (const lx of LANES) {
      for (const side of [-0.75, 0.75]) {
        const a = P(lx + side, 0, Z_NEAR + 0.3);
        const b = P(lx + side, 0, Z_FAR);
        if (!a || !b) continue;
        const lg = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        lg.addColorStop(0, 'rgba(170,195,230,0.22)');
        lg.addColorStop(1, 'rgba(170,195,230,0)');
        ctx.strokeStyle = lg;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }

    // Collect packets with current depth.
    const items = [];
    for (const p of st.packets) {
      const age = ((t - p.spawn) % D + D) % D;
      const z0 = Z_FAR - age * SPEED;
      if (z0 + p.len < Z_NEAR || z0 > Z_FAR) continue;
      items.push({ ...p, x: p.lane + p.jitterX, z0, key: true });
    }
    for (const p of st.extra) {
      const age = ((t - p.phase) % D + D) % D;
      const z0 = Z_FAR + 6 - age * SPEED; // offset so they mostly live in the far field
      if (z0 + p.len < Z_LENS + 1.5 || z0 > Z_FAR) continue;
      items.push({ ...p, x: p.lane + p.jitterX, z0, key: false });
    }
    items.sort((a, b) => b.z0 - a.z0);

    const lensCross = (it) => (it.key ? clamp((Z_LENS - it.z0) / it.len, 0, 1) : 0);

    // Lens plane (drawn between far and near packets).
    const drawLens = () => {
      const x0 = -3.4;
      const x1 = 3.4;
      const top = 1.15;
      const c = [P(x0, 0, Z_LENS), P(x1, 0, Z_LENS), P(x1, top, Z_LENS), P(x0, top, Z_LENS)];
      if (c.some((q) => !q)) return;
      const lg = ctx.createLinearGradient(0, c[2][1], 0, c[1][1]);
      lg.addColorStop(0, 'rgba(237,63,149,0.02)');
      lg.addColorStop(1, 'rgba(237,63,149,0.13)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]);
      for (const q of c.slice(1)) ctx.lineTo(q[0], q[1]);
      ctx.closePath(); ctx.fill();
      // Floor scan line with glow.
      api.glow(PINK, api.s(14), () => api.line([c[0], c[1]], { color: PINK, width: api.s(2.2) }));
      api.line([c[3], c[2]], { color: 'rgba(237,63,149,0.35)', width: 1 });
      // Threshold: above = 1, below = 0.
      const th = 0.46;
      const ta = P(x0, th, Z_LENS);
      const tb = P(x1, th, Z_LENS);
      api.line([ta, tb], { color: 'rgba(237,63,149,0.75)', width: api.s(1.2), dash: [api.s(5), api.s(5)] });
      const edge = w - api.s(24);
      api.text('DECODER', Math.min(c[2][0] - api.s(8), edge), c[2][1] + api.fs(13), { size: api.fs(11), color: 'rgba(250,180,215,0.9)', weight: 600, spacing: 1, align: 'right' });
      if (!api.compact) api.text('1 above · 0 below', Math.min(tb[0] - api.s(8), edge), tb[1] - api.s(7), { size: api.fs(10.5), color: 'rgba(250,180,215,0.75)', align: 'right' });
    };

    let lensDrawn = false;
    for (const it of items) {
      if (!lensDrawn && it.z0 < Z_LENS) {
        drawLens();
        lensDrawn = true;
      }
      drawPacket(api, P, it, fog(it.z0 + it.len / 2), lensCross(it));
    }
    if (!lensDrawn) drawLens();

    // Dust
    for (const d of st.dust) {
      const z = Z_NEAR + 0.5 + ((d.z - t * SPEED * 0.35) % (Z_FAR - 0.5) + (Z_FAR - 0.5)) % (Z_FAR - 0.5);
      const q = P(d.x + Math.sin(t * 0.3 + d.ph) * 0.1, d.y + Math.sin(t * 0.5 + d.ph) * 0.06, z);
      if (!q) continue;
      const a = 0.35 * fog(z) * d.s;
      api.circle(q[0], q[1], Math.max(0.6, q[2] * 0.004 * d.s), { fill: `rgba(200,215,240,${a})` });
    }

    // Bits flying from the decoder to the readout.
    const hudX = w * 0.05;
    const hudY = h - api.s(narrow ? 84 : 100);
    const fsBits = api.fs(narrow ? 12 : 14);
    const charW = api.measure('0', { size: fsBits, weight: 600 });
    const groupGap = charW * 0.9;
    const bitPos = (i) => [hudX + i * charW + Math.floor(i / 8) * groupGap, hudY + api.s(26)];
    const sorted = [...st.packets].sort((a, b) => a.cross - b.cross);
    const loopFade = 1 - seg(t, D - 0.6, D);
    let shown = 0;
    sorted.forEach((p, i) => {
      const dtc = t - p.cross;
      if (dtc < 0) return;
      const fly = seg(dtc, 0, 0.9);
      const [bx, by] = bitPos(i);
      if (fly < 1) {
        const q = P(p.lane + p.jitterX, p.height + 0.1, Z_LENS);
        if (q) {
          const e = ease.inOut(fly);
          const x = lerp(q[0], bx + charW / 2, e);
          const y = lerp(q[1], by - fsBits * 0.35, e) - Math.sin(Math.PI * e) * h * 0.08;
          api.light(x, y, api.s(18), PINK, 0.8 * (1 - fly * 0.5));
          api.text(String(p.bit), x, y + fsBits * 0.35, { size: fsBits, color: '#FFD3E8', align: 'center', weight: 700 });
        }
      } else {
        shown++;
      }
    });
    // Readout
    api.text('HIDDEN STREAM', hudX, hudY, { size: api.fs(11), color: 'rgba(250,180,215,0.85)', weight: 600, spacing: 1.2, alpha: loopFade });
    for (let i = 0; i < shown; i++) {
      const [bx, by] = bitPos(i);
      api.text(String(sorted[i].bit), bx, by, { size: fsBits, color: PINK, weight: 600, alpha: loopFade });
    }
    for (let c = 0; c < MESSAGE.length; c++) {
      if (shown >= (c + 1) * 8) {
        const [bx, by] = bitPos(c * 8);
        const a = ease.out(seg(t, sorted[(c + 1) * 8 - 1].cross + 0.9, sorted[(c + 1) * 8 - 1].cross + 1.4)) * loopFade;
        api.text(`"${MESSAGE[c]}"`, bx + charW * 4, by + fsBits * 1.45, { size: fsBits, color: '#F6F7F9', weight: 600, alpha: a, align: 'center' });
      }
    }
    // Primary traffic readout (top right).
    const arrivals = st.packets.filter((p) => t >= p.cross + (Z_LENS - Z_NEAR) / SPEED).length;
    const rx = w * 0.95;
    const topY = api.s(34);
    api.text('WI-FI FRAMES', rx, topY, { size: api.fs(11), color: 'rgba(200,215,240,0.75)', weight: 600, spacing: 1.2, align: 'right' });
    api.text(`${arrivals} delivered, unchanged`, rx, topY + api.s(24), { size: fsBits, color: '#E6ECF4', weight: 500, align: 'right', alpha: loopFade });

    // Vignette
    const vg = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  },
};

function drawPacket(api, P, it, fogA, decoded) {
  const { ctx } = api;
  const x0 = it.x - it.width / 2;
  const x1 = it.x + it.width / 2;
  const z0 = Math.max(it.z0, Z_NEAR);
  const z1 = it.z0 + it.len;
  const y1 = it.height;
  const q = (x, y, z) => P(x, y, z);
  const fbl = q(x0, 0, z0), fbr = q(x1, 0, z0), ftr = q(x1, y1, z0), ftl = q(x0, y1, z0);
  const btl = q(x0, y1, z1), btr = q(x1, y1, z1);
  if (!fbl || !fbr || !ftr || !ftl || !btl || !btr) return;
  const a = clamp(fogA, 0, 1);
  const pinkMix = decoded;
  const base = (alpha) => (pinkMix > 0 ? `rgba(${Math.round(lerp(220, 237, pinkMix))},${Math.round(lerp(230, 63, pinkMix))},${Math.round(lerp(242, 149, pinkMix))},${alpha})` : `rgba(${FRAME},${alpha})`);
  // Top face
  ctx.beginPath();
  ctx.moveTo(ftl[0], ftl[1]); ctx.lineTo(ftr[0], ftr[1]); ctx.lineTo(btr[0], btr[1]); ctx.lineTo(btl[0], btl[1]); ctx.closePath();
  ctx.fillStyle = base(0.16 * a + 0.14 * pinkMix * a);
  ctx.fill();
  // Front face
  const fg = ctx.createLinearGradient(0, ftl[1], 0, fbl[1]);
  fg.addColorStop(0, base(0.42 * a + 0.25 * pinkMix * a));
  fg.addColorStop(1, base(0.08 * a));
  ctx.beginPath();
  ctx.moveTo(fbl[0], fbl[1]); ctx.lineTo(fbr[0], fbr[1]); ctx.lineTo(ftr[0], ftr[1]); ctx.lineTo(ftl[0], ftl[1]); ctx.closePath();
  ctx.fillStyle = fg;
  ctx.fill();
  // Edges
  ctx.strokeStyle = base(0.75 * a);
  ctx.lineWidth = Math.max(0.75, api.s(1));
  ctx.beginPath();
  ctx.moveTo(ftl[0], ftl[1]); ctx.lineTo(ftr[0], ftr[1]); ctx.lineTo(btr[0], btr[1]); ctx.lineTo(btl[0], btl[1]); ctx.closePath();
  ctx.stroke();
  if (pinkMix > 0.05) api.light((ftl[0] + ftr[0]) / 2, ftl[1], api.s(40) * (0.6 + 0.4 * pinkMix), '#ED3F95', 0.35 * pinkMix * a);
}
