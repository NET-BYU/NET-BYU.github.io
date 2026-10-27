// The Hitchhiker's Guide to Successful Remote Sensing Deployments in Mongolia (i-ETC 2020).
// Low-cost air quality sensors around Ulaanbaatar upload readings in real time over
// cellular: each reading hops to a tower, then to the server. When an outage cuts
// some nodes off, they keep sampling and buffer the readings locally; when the link
// returns they backfill in a burst and the gaps in the server's timeline fill in.
// Map, positions and timing are illustrative.
import { clamp, lerp, seg, ease } from './kit.js';

const D = 14;
const PERIOD = 0.9; // seconds between readings per node
const OUT = [4.2, 8.4]; // outage window for the affected nodes
const UP = 0.42; // node → tower
const HOP = 0.38; // tower → server
const NODES = [
  { x: 0.2, y: 0.27, id: 'S1', out: true },
  { x: 0.31, y: 0.15, id: 'S2', out: true },
  { x: 0.13, y: 0.47, id: 'S3', out: true },
  { x: 0.5, y: 0.2, id: 'S4' },
  { x: 0.73, y: 0.26, id: 'S5' },
  { x: 0.85, y: 0.55, id: 'S6' },
  { x: 0.42, y: 0.74, id: 'S7' },
];
const TOWER = { x: 0.58, y: 0.47 };
const ZONE = { x: 0.21, y: 0.31, rx: 0.17, ry: 0.27 }; // outage area (map units)

export default {
  duration: D,
  still: 10.1,
  scene: false,

  init(api) {
    const r = api.rng('mongolia-deployment');
    // Readings: when each is taken, when it leaves the node, and whether it waited in the buffer.
    const readings = NODES.map((nd, i) => {
      const list = [];
      const phase = 0.35 + ((i * 0.37) % PERIOD);
      let queued = 0;
      for (let tg = phase; tg < D - 1.3; tg += PERIOD) {
        const held = nd.out && tg >= OUT[0] && tg < OUT[1];
        const depart = held ? OUT[1] + 0.15 + i * 0.05 + queued++ * 0.13 : tg;
        list.push({ tg, depart, held, arrive: depart + (held ? 0.8 : 1) * (UP + HOP) });
      }
      return list;
    });
    // Ger districts on the northern hills: clustered dots.
    const gers = [];
    const centers = [[0.12, 0.2], [0.3, 0.13], [0.5, 0.14], [0.74, 0.18], [0.2, 0.42], [0.88, 0.35]];
    for (const [cx, cy] of centers) {
      const n = r.int(9, 14);
      for (let k = 0; k < n; k++) gers.push([clamp(cx + r.gauss() * 0.055, 0.03, 0.97), clamp(cy + r.gauss() * 0.045, 0.04, 0.5)]);
    }
    const blocks = Array.from({ length: 9 }, (_, k) => ({ x: 0.47 + (k % 3) * 0.05 + r.range(-0.006, 0.006), y: 0.58 + Math.floor(k / 3) * 0.055, w: r.range(0.028, 0.038), h: r.range(0.028, 0.04) }));
    return { readings, gers, blocks };
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

    // ================= Map =================
    const M = compact ? { x: w * 0.04, y: h * 0.07, w: w * 0.54, h: h * 0.74 } : { x: w * 0.06, y: h * 0.14, w: w * 0.54, h: h * 0.7 };
    const mx = (u) => M.x + u * M.w;
    const my = (v) => M.y + v * M.h;
    api.rect(M.x, M.y, M.w, M.h, { stroke: pal.line, width: 1, r: api.s(6) });
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(M.x, M.y, M.w, M.h, api.s(6));
    ctx.clip();
    // Hills (contours) in the north.
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push([mx(u), my(0.07 + k * 0.1 + 0.05 * Math.sin(u * 7 + k * 1.3) + 0.03 * Math.sin(u * 15 + k))]);
      }
      api.line(pts, { color: pal.grid, width: 1 });
    }
    // River.
    const river = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      river.push([mx(u), my(0.86 + 0.035 * Math.sin(u * 9 + 0.6) + 0.02 * Math.sin(u * 23))]);
    }
    api.line(river, { color: pal.grid, width: api.s(7) });
    api.line(river, { color: pal.line, width: 1 });
    // Roads and the city centre.
    api.line([[mx(0), my(0.63)], [mx(0.3), my(0.62)], [mx(0.62), my(0.66)], [mx(1), my(0.63)]], { color: pal.line, width: api.s(1.6) });
    api.line([[mx(0.36), my(0.42)], [mx(0.35), my(0.82)]], { color: pal.line, width: 1 });
    api.line([[mx(0.65), my(0.36)], [mx(0.67), my(0.82)]], { color: pal.line, width: 1 });
    for (const b of st.blocks) api.rect(mx(b.x), my(b.y), b.w * M.w, b.h * M.h, { stroke: pal.line, width: 1, r: 1 });
    // Ger districts.
    for (const [u, v] of st.gers) api.circle(mx(u), my(v), api.s(1.2), { fill: pal.ink3, alpha: A(0.45) });
    ctx.restore();
    lab('ULAANBAATAR', mx(0.97), my(0.79), { align: 'right', spacing: 1.2, color: pal.ink2 });

    // Outage zone.
    const outA = Math.min(seg(t, OUT[0] - 0.2, OUT[0] + 0.2), 1 - seg(t, OUT[1] - 0.1, OUT[1] + 0.3));
    if (outA > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(M.x, M.y, M.w, M.h, api.s(6));
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(mx(ZONE.x), my(ZONE.y), ZONE.rx * M.w, ZONE.ry * M.h, -0.35, 0, Math.PI * 2);
      ctx.globalAlpha = A(0.08 * outA);
      ctx.fillStyle = pal.ink2;
      ctx.fill();
      ctx.globalAlpha = A(outA);
      ctx.setLineDash([api.s(3), api.s(3)]);
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      lab(compact ? 'OUTAGE' : 'OUTAGE · NO SIGNAL', mx(ZONE.x) + (compact ? api.s(4) : 0), my(ZONE.y + ZONE.ry) + api.s(compact ? 4 : 2), { align: 'center', alpha: outA, color: pal.ink2 });
    }

    // Tower and the backhaul to the server.
    const T = { x: mx(TOWER.x), y: my(TOWER.y) };
    const th = api.s(compact ? 20 : 26);
    const S = compact ? { x: w * 0.79, y: h * 0.17, w: api.s(46), h: api.s(30) } : { x: w * 0.79, y: h * 0.2, w: api.s(58), h: api.s(36) };
    const sIn = { x: S.x - S.w / 2, y: S.y };
    const tTop = { x: T.x, y: T.y - th };
    api.line([[tTop.x, tTop.y], [sIn.x, sIn.y]], { color: pal.line, width: 1, dash: [api.s(4), api.s(4)] });
    if (!compact) {
      // Label set along the backhaul, just outside the map.
      const ang = Math.atan2(sIn.y - tTop.y, sIn.x - tTop.x);
      ctx.save();
      ctx.translate(lerp(tTop.x, sIn.x, 0.8), lerp(tTop.y, sIn.y, 0.8));
      ctx.rotate(ang);
      lab('CELLULAR', 0, -api.s(6), { align: 'center', spacing: 0.6 });
      ctx.restore();
    }
    // Links from nodes to the tower.
    NODES.forEach((nd) => {
      const x = mx(nd.x);
      const y = my(nd.y);
      const cut = nd.out ? outA : 0;
      api.line([[x, y], [tTop.x, tTop.y + th * 0.3]], { color: pal.line, width: 1, alpha: A(1 - 0.6 * cut), dash: cut > 0.5 ? [api.s(2), api.s(4)] : undefined });
      if (cut > 0.05) {
        const cx = lerp(x, tTop.x, 0.42);
        const cy = lerp(y, tTop.y + th * 0.3, 0.42);
        const k = api.s(3.5) * cut;
        api.line([[cx - k, cy - k], [cx + k, cy + k]], { color: pal.ink2, width: api.s(1.5) });
        api.line([[cx - k, cy + k], [cx + k, cy - k]], { color: pal.ink2, width: api.s(1.5) });
      }
    });
    // Mast.
    const bw = th * 0.32;
    api.line([[T.x - bw, T.y], [T.x, tTop.y], [T.x + bw, T.y]], { color: pal.ink2, width: api.s(1.5) });
    for (let k = 1; k <= 3; k++) {
      const f = k / 4;
      api.line([[T.x - bw * (1 - f), T.y - th * f], [T.x + bw * (1 - f), T.y - th * f]], { color: pal.ink2, width: 1 });
    }
    // Antenna arcs (brighter when something is in the air).
    let busy = 0;
    for (const list of st.readings) for (const rd of list) if (t > rd.depart && t < rd.arrive) busy = 1;
    for (let k = 1; k <= 2; k++) {
      ctx.save();
      ctx.globalAlpha = A(0.35 + 0.4 * busy);
      ctx.strokeStyle = pal.ink2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(tTop.x, tTop.y, api.s(4 + 4 * k), -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // Server.
    api.rect(S.x - S.w / 2, S.y - S.h / 2, S.w, S.h, { fill: pal.surface, stroke: pal.ink3, width: 1.2, r: api.s(4) });
    for (let k = 0; k < 3; k++) {
      const yy = S.y - S.h / 2 + S.h * (0.25 + k * 0.25);
      api.line([[S.x - S.w * 0.32, yy], [S.x + S.w * 0.12, yy]], { color: pal.line, width: api.s(1.4) });
      api.circle(S.x + S.w * 0.3, yy, api.s(1.6), { fill: api.accent });
    }
    lab('SERVER', S.x, S.y - S.h / 2 - api.s(8), { align: 'center' });

    // Pulses in flight.
    const pr = api.s(compact ? 2.2 : 2.7);
    for (let i = 0; i < NODES.length; i++) {
      const nd = NODES[i];
      for (const rd of st.readings[i]) {
        if (t < rd.depart || t > rd.arrive) continue;
        const up = rd.held ? UP * 0.8 : UP;
        let x;
        let y;
        if (t < rd.depart + up) {
          const f = ease.inOut(seg(t, rd.depart, rd.depart + up));
          x = lerp(mx(nd.x), tTop.x, f);
          y = lerp(my(nd.y), tTop.y + th * 0.3, f);
        } else {
          const f = ease.inOut(seg(t, rd.depart + up, rd.arrive));
          x = lerp(tTop.x, sIn.x, f);
          y = lerp(tTop.y, sIn.y, f);
        }
        api.circle(x, y, pr, { fill: api.accent });
      }
    }

    // Nodes, with their local buffers.
    const ns = api.s(compact ? 7 : 9);
    NODES.forEach((nd, i) => {
      const x = mx(nd.x);
      const y = my(nd.y);
      const list = st.readings[i];
      const cutNow = nd.out && t >= OUT[0] && t < OUT[1] + 0.1;
      // Buffered = taken during the outage and not yet sent.
      let stack = 0;
      for (const rd of list) if (rd.held && t >= rd.tg && t < rd.depart) stack++;
      const blink = list.some((rd) => t >= rd.tg && t < rd.tg + 0.25);
      api.rect(x - ns / 2, y - ns / 2, ns, ns, { fill: pal.surface, stroke: cutNow ? pal.ink3 : pal.ink2, width: 1.2, r: api.s(2) });
      api.circle(x, y, api.s(1.8), { fill: cutNow ? pal.ink3 : api.accent, alpha: A(blink ? 1 : 0.65) });
      if (!compact) lab(nd.id, x + ns / 2 + api.s(4), y + ns / 2 + api.s(1), { spacing: 0 });
      const cw = api.s(compact ? 6 : 8);
      const chh = api.s(compact ? 2 : 2.6);
      for (let k = 0; k < stack; k++) {
        const yy = y - ns / 2 - api.s(3) - (k + 1) * (chh + api.s(1.2));
        api.rect(x - cw / 2, yy, cw, chh, { fill: api.accent, r: 1 });
      }
    });

    // ================= Server timeline: one row per node =================
    const TL = compact ? { x: w * 0.7, y: h * 0.34, w: w * 0.25, h: h * 0.5 } : { x: w * 0.71, y: h * 0.38, w: w * 0.22, h: h * 0.42 };
    const rowGap = TL.h / (NODES.length - 1);
    const tx = (tt) => TL.x + (tt / D) * TL.w;
    if (!compact) lab('READINGS RECEIVED', w * 0.655, TL.y - api.s(18));
    const tickH = Math.min(api.s(9), rowGap * 0.62);
    NODES.forEach((nd, i) => {
      const y = TL.y + i * rowGap;
      api.text(nd.id, TL.x - api.s(8), y + fsL * 0.34, { size: fsL, color: nd.out ? pal.ink2 : pal.ink3, align: 'right' });
      api.line([[TL.x, y], [TL.x + TL.w, y]], { color: pal.grid, width: 1 });
      // The gap while the outage lasts and nothing has been backfilled yet.
      if (nd.out) {
        const firstBack = st.readings[i].find((rd) => rd.held);
        const backAt = firstBack ? firstBack.arrive : D;
        const gapA = Math.min(seg(t, OUT[0] + 0.6, OUT[0] + 1), 1 - seg(t, backAt - 0.1, backAt + 0.4));
        const x0 = tx(OUT[0]);
        const x1 = Math.min(tx(OUT[1]), tx(t));
        const by = y - tickH / 2 - api.s(2);
        const bh = tickH + api.s(4);
        if (gapA > 0 && x1 > x0) api.rect(x0, by, x1 - x0, bh, { stroke: pal.ink3, width: 1, dash: [api.s(2), api.s(2)], r: api.s(2), alpha: A(gapA) });
        // Once the backlog lands, the former gap stays marked as backfilled.
        const fillA = ease.out(seg(t, backAt - 0.1, backAt + 0.5));
        if (fillA > 0) api.rect(x0, by, tx(OUT[1]) - x0, bh, { fill: api.accent, r: api.s(2), alpha: A(0.13 * fillA) });
      }
      for (const rd of st.readings[i]) {
        if (t < rd.arrive) continue;
        const pop = ease.out(seg(t, rd.arrive, rd.arrive + 0.25));
        const x = tx(rd.tg);
        api.rect(x - api.s(1), y - (tickH / 2) * pop, api.s(2), tickH * pop, { fill: rd.held ? api.accent : pal.ink2, r: api.s(1) });
      }
    });
    // "Now" cursor on the timeline.
    const nowX = tx(clamp(t, 0, D));
    api.line([[nowX, TL.y - tickH], [nowX, TL.y + TL.h + tickH]], { color: pal.ink3, width: 1 });
    lab('now', nowX, TL.y + TL.h + tickH + api.s(4) + fsL, { align: 'center', spacing: 0 });
    if (!compact) {
      const ly = TL.y + TL.h + tickH + api.s(28);
      api.rect(TL.x, ly - api.s(7), api.s(2), api.s(8), { fill: pal.ink2 });
      api.text('live', TL.x + api.s(7), ly, { size: fsL, color: pal.ink2 });
      const bx = TL.x + api.s(7) + api.measure('live', { size: fsL }) + api.s(14);
      api.rect(bx, ly - api.s(7), api.s(2), api.s(8), { fill: api.accent });
      api.text('backfilled', bx + api.s(7), ly, { size: fsL, color: api.accentInk });
    }

    // ================= Live captions =================
    const capX = M.x + M.w / 2;
    const capY = M.y + M.h + api.s(compact ? 15 : 22);
    const acc = { color: api.accentInk, border: api.accent, alpha: fade };
    const neu = { color: pal.ink, border: pal.line, alpha: fade };
    api.caption(compact ? 'real-time uploads' : 'readings upload in real time', capX, capY, 0.9, OUT[0] - 0.15, acc);
    api.caption(compact ? 'link down: buffer' : 'link down: nodes buffer locally', capX, capY, OUT[0] + 0.25, OUT[1] - 0.05, neu);
    api.caption(compact ? 'backfill burst' : 'link back: backfill in a burst', capX, capY, OUT[1] + 0.1, OUT[1] + 2.3, acc);
    api.caption(compact ? 'no gaps left' : 'server timeline has no gaps', capX, capY, OUT[1] + 2.5, D - 0.6, acc);
    ctx.globalAlpha = 1;
  },
};
