// Home hero. The logo's seven trace colors run out of the hexagon to the edges of the
// screen, carrying pulses. A receiver (your cursor, a tap, or a roaming ghost when idle)
// decodes the character each pulse carries, and the readout under the logo spells out
// the hidden message. Modifier-click decodes a different one.
import { clamp, lerp, rng, ease } from './anim/kit.js';

const MESSAGE = 'BUILDING REAL SYSTEMS THAT ENHANCE AND EXTEND WIRELESS NETWORKS';
const SECRET = 'HACK THE PLANET';
const ART = 865; // logo artwork size in px; exit points below are in artwork pixels

// Where each trace leaves the hexagon, and which way it heads.
const EXITS = [
  { c: 'yellow', x: 430, y: 6, dir: 'up' },
  { c: 'yellow', x: 84, y: 193, dir: 'left', to: -0.32 },
  { c: 'orange', x: 43, y: 406, dir: 'left', to: 0 },
  { c: 'pink', x: 43, y: 634, dir: 'left', to: 0.75 },
  { c: 'pink', x: 430, y: 858, dir: 'down' },
  { c: 'green', x: 702, y: 152, dir: 'right', to: -0.45 },
  { c: 'purple', x: 817, y: 470, dir: 'right', to: 0 },
  { c: 'lime', x: 817, y: 590, dir: 'right', to: 0.42 },
  { c: 'cyan', x: 636, y: 748, dir: 'downright' },
];

const SPACING = 68;
const SPEED = 92;

export function initHero(hero) {
  const canvas = hero.querySelector('.hero-canvas');
  const ctx = canvas.getContext('2d');
  const vis = hero.querySelector('.hero-vis');
  const logo = hero.querySelector('.hero-logo');
  const rxBox = hero.querySelector('.rx-line');
  const rxText = hero.querySelector('.rx-text');
  const rxBits = hero.querySelector('.rx-bits');
  const rxHint = hero.querySelector('.rx-hint');
  const caret = hero.querySelector('.rx-caret');
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(hover: none)').matches;
  if (rxHint && touch) rxHint.textContent = 'Tap the traces to decode the hidden message';

  let W = 0, H = 0, dpr = 1;
  let routes = [];
  let colors = {};
  let geo = null;
  let running = false, raf = 0, last = 0, time = 0;
  const lens = { x: 0, y: 0, tx: 0, ty: 0, r: 80, user: 0, shown: 0 };
  let message = MESSAGE;
  let decoded = '';
  let ptr = 0;
  let cooldown = 0;
  let doneAt = -1;
  let secret = false;
  let flash = 0;
  const assigned = new Map(); // pulse key → { ch, t0 }
  const flying = []; // { ch, x0, y0, t0 }

  const readColors = () => {
    const probe = document.createElement('span');
    hero.append(probe);
    const v = (n) => { probe.style.color = `var(${n})`; return getComputedStyle(probe).color; };
    colors = {
      pink: v('--c-pink'), orange: v('--c-orange'), yellow: v('--c-yellow'), green: v('--c-green'),
      purple: v('--c-purple-line'), lime: v('--c-lime'), cyan: v('--c-cyan'),
      ink: v('--ink'), ink3: v('--ink-3'), bg: v('--bg'), surface: v('--surface'), line: v('--line-2'),
    };
    probe.remove();
    const m = colors.bg.match(/\d+/g) || [255];
    colors.dark = Number(m[0]) < 100;
  };

  // ---------- Geometry ----------
  function layout() {
    const hr = hero.getBoundingClientRect();
    W = Math.round(hr.width);
    H = Math.round(hr.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const lr = logo.getBoundingClientRect();
    const vr = vis.getBoundingClientRect();
    const rr = rxBox && rxBox.offsetParent ? rxBox.getBoundingClientRect() : null;
    const S = lr.width;
    const header = document.querySelector('.site-header')?.offsetHeight || 64;
    geo = {
      S,
      cx: lr.left - hr.left + S / 2,
      cy: lr.top - hr.top + S / 2,
      top: Math.max(header + 18, vr.top - hr.top + 8),
      bottom: vr.bottom - hr.top - 12,
      rx: rr ? { x: rr.left - hr.left, y: rr.top - hr.top, w: rr.width, h: rr.height } : null,
      tw: Math.max(2, S * 0.0125),
    };
    lens.r = clamp(S * 0.3, 58, 104);
    routes = buildRoutes(geo);
    if (!lens.x) { lens.x = lens.tx = geo.cx + S * 0.9; lens.y = lens.ty = geo.cy; }
  }

  function buildRoutes(g) {
    const P = (x, y) => [g.cx + (x / ART - 0.5) * g.S, g.cy + (y / ART - 0.5) * g.S];
    const out = [];
    const r = rng('hero-traces');
    const stub = g.S * 0.07;
    const logoTop = g.cy - g.S / 2;
    const logoBottom = g.cy + g.S / 2;
    const rxTop = g.rx ? g.rx.y : logoBottom + 24;
    const spread = Math.min(g.S * 0.42, (g.bottom - g.top) * 0.22);
    for (const e of EXITS) {
      const [x0, y0] = P(e.x, e.y);
      let pts;
      if (e.dir === 'left' || e.dir === 'right') {
        const sx = e.dir === 'left' ? -1 : 1;
        const x1 = x0 + sx * stub;
        let ty = y0 + e.to * spread;
        ty = clamp(ty, g.top + 6, Math.min(g.bottom, rxTop - 16));
        const dy = ty - y0;
        const x2 = x1 + sx * Math.abs(dy);
        const xEnd = sx < 0 ? -40 : W + 40;
        pts = [[x0, y0], [x1, y0], [x2, ty], [xEnd, ty]];
      } else if (e.dir === 'up') {
        // Up out of the top vertex, then along the top of the field to the left edge.
        const y1 = g.top + 6;
        const d = Math.min(g.S * 0.08, Math.max(0, y0 - y1 - 6));
        pts = [[x0, y0], [x0, y1 + d], [x0 - d, y1], [-40, y1]];
      } else if (e.dir === 'down') {
        const yEnd = g.rx ? g.rx.y : y0 + stub;
        pts = [[x0, y0], [x0, Math.max(y0 + 4, yEnd)]];
      } else {
        // down-right: 45° until just above the readout, then straight to the right edge
        const ty = Math.min(rxTop - 14, y0 + g.S * 0.22);
        const d = Math.max(4, ty - y0);
        pts = [[x0, y0], [x0 + d, y0 + d], [W + 40, y0 + d]];
      }
      const route = makeRoute(e.c, pts);
      route.branches = makeBranches(route, g, r);
      out.push(route);
    }
    return out;
  }

  function makeRoute(c, pts) {
    const segs = [];
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      segs.push({ x0, y0, x1, y1, len, start: L });
      L += len;
    }
    return { c, pts, segs, L };
  }

  function pointAt(route, s) {
    for (const seg of route.segs) {
      if (s <= seg.start + seg.len) {
        const u = seg.len ? (s - seg.start) / seg.len : 0;
        return [lerp(seg.x0, seg.x1, u), lerp(seg.y0, seg.y1, u), Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0)];
      }
    }
    const s0 = route.segs[route.segs.length - 1];
    return [s0.x1, s0.y1, Math.atan2(s0.y1 - s0.y0, s0.x1 - s0.x0)];
  }

  // Short side traces ending in ring pads, in the logo's style.
  function makeBranches(route, g, r) {
    const out = [];
    const avoid = g.rx ? { x: g.rx.x - 30, y: g.rx.y - 30, w: g.rx.w + 60, h: g.rx.h + 80 } : null;
    for (const seg of route.segs) {
      if (Math.abs(seg.y1 - seg.y0) > 1 || seg.len < 150) continue; // horizontal runs only
      const n = seg.len > 420 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const u = 0.25 + (i + r() * 0.6) / (n + 0.6) * 0.6;
        const x = lerp(seg.x0, seg.x1, u);
        if (x < 24 || x > W - 24) continue;
        const up = r() < 0.5 ? -1 : 1;
        const len = g.S * (0.06 + r() * 0.08);
        const y = seg.y0;
        const end = [x + (r() < 0.5 ? 0 : len * 0.6 * Math.sign(seg.x1 - seg.x0)), y + up * len];
        if (end[1] < g.top - 4 || end[1] > g.bottom) continue;
        if (avoid && end[0] > avoid.x && end[0] < avoid.x + avoid.w && end[1] > avoid.y && end[1] < avoid.y + avoid.h) continue;
        out.push({ pts: [[x, y], [x, y + up * len * 0.45], end], comb: r() < 0.45, up });
      }
    }
    return out;
  }

  // ---------- Drawing ----------
  function strokePath(pts, color, width) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawTraces() {
    const tw = geo.tw;
    for (const route of routes) {
      const col = colors[route.c];
      strokePath(route.pts, col, tw);
      for (const b of route.branches) {
        strokePath(b.pts, col, tw * 0.8);
        const [ex, ey] = b.pts[b.pts.length - 1];
        ctx.beginPath();
        ctx.arc(ex, ey + b.up * tw * 2.2, tw * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = tw * 0.8;
        ctx.stroke();
        if (b.comb) {
          for (let k = 1; k <= 3; k++) {
            const ox = ex + tw * 4.5;
            const oy = b.pts[1][1] + b.up * k * tw * 1.6;
            strokePath([[ox, oy], [ox + geo.S * 0.05, oy]], col, tw * 0.45);
          }
        }
      }
    }
  }

  function pulseKey(i, k, c) { return `${i}:${k}:${c}`; }

  function drawPulses(dt) {
    const tw = geo.tw;
    const len = Math.max(10, geo.S * 0.05);
    const glow = colors.dark;
    routes.forEach((route, i) => {
      const n = Math.ceil(route.L / SPACING) + 1;
      const period = n * SPACING;
      const col = colors[route.c];
      for (let k = 0; k < n; k++) {
        const raw = k * SPACING + SPEED * time;
        const s = raw % period;
        const cyc = Math.floor(raw / period);
        if (s > route.L) continue;
        const [x, y, a] = pointAt(route, s);
        if (x < -20 || x > W + 20) continue;
        const key = pulseKey(i, k, cyc);
        const inLens = lens.shown > 0.05 && Math.hypot(x - lens.x, y - lens.y) < lens.r;
        // Decode a pulse the first time it enters the receiver.
        if (inLens && !assigned.has(key) && cooldown <= 0 && doneAt < 0 && ptr < message.length) {
          const ch = message[ptr++];
          assigned.set(key, { ch, t0: time });
          flying.push({ ch, x0: x, y0: y - tw * 6, t0: time });
          cooldown = 0.11;
        }
        const as = assigned.get(key);
        const hx = Math.cos(a) * len * 0.5;
        const hy = Math.sin(a) * len * 0.5;
        if (glow) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, len * 1.3);
          g.addColorStop(0, col.replace('rgb(', 'rgba(').replace(')', ',0.55)'));
          g.addColorStop(1, col.replace('rgb(', 'rgba(').replace(')', ',0)'));
          ctx.fillStyle = g;
          ctx.fillRect(x - len * 1.3, y - len * 1.3, len * 2.6, len * 2.6);
        }
        strokePath([[x - hx, y - hy], [x + hx, y + hy]], col, tw * 2.5 + (flash > 0 ? tw * 1.5 * flash : 0));
        strokePath([[x - hx * 0.55, y - hy * 0.55], [x + hx * 0.55, y + hy * 0.55]], colors.bg, tw * 0.8);
        if (as && inLens) {
          const p = ease.out(clamp((time - as.t0) / 0.25));
          drawChip(as.ch, x, y - tw * 5.5 - 10 * p, p);
        }
      }
    });
    if (assigned.size > 400) {
      // Forget old pulses.
      const cut = time - 30;
      for (const [k, v] of assigned) if (v.t0 < cut) assigned.delete(k);
    }
    void dt;
  }

  function drawChip(ch, x, y, a) {
    const size = 12;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `600 ${size}px "Red Hat Mono", ui-monospace, monospace`;
    const label = ch === ' ' ? '·' : ch;
    const w = Math.max(18, ctx.measureText(label).width + 10);
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 10, w, 20, 6);
    ctx.fillStyle = colors.surface;
    ctx.fill();
    ctx.strokeStyle = secret ? colors.orange : colors.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  }

  function drawLens() {
    if (lens.shown <= 0.01) return;
    const { x, y, r } = lens;
    ctx.save();
    ctx.globalAlpha = lens.shown;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = secret ? colors.orange : colors.ink;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6));
      ctx.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
      ctx.stroke();
    }
    ctx.font = '600 11px "Red Hat Mono", ui-monospace, monospace';
    ctx.fillStyle = secret ? colors.orange : colors.ink3;
    ctx.textAlign = 'left';
    ctx.fillText('RX', x + r * 0.74 + 6, y - r * 0.74 - 4);
    ctx.restore();
  }

  function caretPoint() {
    const hr = hero.getBoundingClientRect();
    const cr = caret?.getBoundingClientRect();
    return cr ? [cr.left - hr.left + cr.width / 2, cr.top - hr.top + cr.height / 2] : [geo.cx, geo.cy + geo.S];
  }

  function drawFlying() {
    if (!flying.length) return;
    const [tx, ty] = caretPoint();
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      const p = clamp((time - f.t0) / 0.5);
      if (p >= 1) {
        decoded += f.ch;
        flying.splice(i, 1);
        renderReadout();
        continue;
      }
      const e = ease.inOut(p);
      const x = lerp(f.x0, tx, e);
      const y = lerp(f.y0, ty, e) - Math.sin(Math.PI * e) * 40;
      ctx.save();
      ctx.globalAlpha = 1 - p * 0.3;
      ctx.font = '600 13px "Red Hat Mono", ui-monospace, monospace';
      ctx.fillStyle = secret ? colors.orange : colors.ink;
      ctx.textAlign = 'center';
      ctx.fillText(f.ch === ' ' ? '·' : f.ch, x, y);
      ctx.restore();
    }
  }

  function renderReadout() {
    if (!rxText) return;
    rxText.textContent = decoded;
    const ch = decoded[decoded.length - 1];
    if (rxBits) {
      if (doneAt >= 0 || (decoded.length === message.length && !flying.length)) {
        rxBits.textContent = secret ? 'secret message decoded' : 'message decoded';
      } else if (ch) {
        rxBits.textContent = `${ch.charCodeAt(0).toString(2).padStart(8, '0')}  →  ${ch === ' ' ? 'space' : ch}`;
      } else {
        rxBits.textContent = '';
      }
    }
    if (decoded.length === message.length && !flying.length && doneAt < 0) doneAt = time;
  }

  function resetMessage(next) {
    message = next;
    decoded = '';
    ptr = 0;
    doneAt = -1;
    flying.length = 0;
    assigned.clear();
    rxBox?.classList.toggle('is-secret', secret);
    renderReadout();
  }

  // ---------- Receiver position ----------
  // A slow figure-eight through both trace fields that never parks on the logo.
  function ghostTarget() {
    const span = Math.min(W * 0.4, geo.S * 2.4);
    const th = time * 0.19 + 0.9;
    const x = geo.cx + Math.sin(th) * span;
    const y = geo.cy - Math.cos(2 * th) * geo.S * 0.48;
    return [x, clamp(y, geo.top + lens.r * 0.85, geo.bottom - lens.r * 0.3)];
  }

  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    lens.tx = e.clientX - r.left;
    lens.ty = e.clientY - r.top;
    lens.user = performance.now();
    rxHint?.classList.add('is-used');
  });
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    const r = hero.getBoundingClientRect();
    if (e.pointerType === 'touch') {
      lens.tx = e.clientX - r.left;
      lens.ty = e.clientY - r.top;
      lens.user = performance.now() + 4000;
      rxHint?.classList.add('is-used');
    }
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
      secret = !secret;
      flash = 1;
      resetMessage(secret ? SECRET : MESSAGE);
    }
  });
  hero.addEventListener('pointerleave', () => { lens.user = Math.min(lens.user, performance.now() - 2500); });

  // ---------- Loop ----------
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    time += dt;
    cooldown -= dt;
    flash = Math.max(0, flash - dt * 1.6);
    const userActive = now - lens.user < 3500;
    const [gx, gy] = userActive ? [lens.tx, lens.ty] : ghostTarget();
    const k = userActive ? 0.25 : 0.06;
    lens.x += (gx - lens.x) * k;
    lens.y += (gy - lens.y) * k;
    lens.shown = Math.min(1, lens.shown + dt * 1.5);
    if (doneAt >= 0 && time - doneAt > (secret ? 3.5 : 4.5)) {
      if (secret) secret = false;
      resetMessage(MESSAGE);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawTraces();
    drawPulses(dt);
    drawLens();
    drawFlying();
    raf = running ? requestAnimationFrame(frame) : 0;
  }

  function drawStatic() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawTraces();
  }

  function start() {
    if (running || reducedMQ.matches) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function refresh() {
    readColors();
    layout();
    if (rxHint) rxHint.hidden = reducedMQ.matches;
    if (reducedMQ.matches) {
      stop();
      decoded = message;
      renderReadout();
      drawStatic();
    }
  }

  readColors();
  layout();
  renderReadout();
  if (reducedMQ.matches) { decoded = message; renderReadout(); drawStatic(); if (rxHint) rxHint.hidden = true; }

  new ResizeObserver(() => { layout(); if (!running) drawStatic(); }).observe(hero);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.05 }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  document.addEventListener('themechange', () => { readColors(); if (!running) drawStatic(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); if (!running) drawStatic(); });
  reducedMQ.addEventListener('change', () => { refresh(); if (!reducedMQ.matches) start(); });
  document.fonts?.ready.then(() => { layout(); if (!running) drawStatic(); });
}
