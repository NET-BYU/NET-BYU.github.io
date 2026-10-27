// People page: a co-author network built from every paper on the site.
// Nodes are lab members (size = papers), links are shared papers. Drag, hover or tap
// a person to see who they have published with.
import { clamp, rng } from './anim/kit.js';

const AREA_VAR = {
  subprotocols: '--c-pink', underwater: '--c-cyan', vehicles: '--c-orange', spectrum: '--c-purple-line',
  sensing: '--c-lime', health: '--c-green', wifi: '--c-yellow',
};

export function initNetwork(box) {
  const data = JSON.parse(box.querySelector('.network-data')?.textContent || '{"nodes":[],"links":[]}');
  const canvas = box.querySelector('canvas');
  const tip = box.querySelector('.network-tip');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const r = rng('coauthors');

  const nodes = data.nodes.map((n) => ({ ...n, x: 0, y: 0, vx: 0, vy: 0, fixed: false }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = data.links.map((l) => ({ ...l, a: byId.get(l.source), b: byId.get(l.target) })).filter((l) => l.a && l.b);
  const neighbors = new Map(nodes.map((n) => [n.id, new Set()]));
  links.forEach((l) => { neighbors.get(l.a.id).add(l.b.id); neighbors.get(l.b.id).add(l.a.id); });

  let W = 0, H = 0, dpr = 1, colors = {};
  let hover = null, drag = null, alpha = 1, running = false, raf = 0;

  const readColors = () => {
    const probe = document.createElement('span');
    box.append(probe);
    const v = (n) => { probe.style.color = `var(${n})`; return getComputedStyle(probe).color; };
    colors = { ink: v('--fig-ink'), ink2: v('--fig-ink-2'), ink3: v('--fig-ink-3'), line: v('--fig-line'), bg: v('--fig-bg'), surface: v('--fig-surface') };
    for (const [k, name] of Object.entries(AREA_VAR)) colors[k] = v(name);
    probe.remove();
  };
  const radius = (n) => clamp(5 + Math.sqrt(n.papers) * 4.2, 6, 26) * (W < 520 ? 0.8 : 1);
  const color = (n) => colors[n.areas[0]] || colors.ink2;

  function size() {
    const rect = box.getBoundingClientRect();
    W = Math.round(rect.width);
    H = Math.round(rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  function seed() {
    // Faculty in the middle, everyone else on a ring, so the layout settles quickly and the same way each time.
    nodes.forEach((n, i) => {
      if (n.role === 'faculty') { n.x = W / 2; n.y = H / 2; return; }
      const a = (i / nodes.length) * Math.PI * 2 + r() * 0.4;
      const d = 0.3 + r() * 0.16;
      n.x = W / 2 + Math.cos(a) * d * W * 0.85;
      n.y = H / 2 + Math.sin(a) * d * H;
    });
  }

  function step() {
    const k = Math.sqrt((W * H) / Math.max(1, nodes.length)) * 0.78;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(36, dx * dx + dy * dy);
        const f = (k * k) / d2 * 0.9;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    for (const l of links) {
      const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const target = k * (1.15 - Math.min(0.5, l.weight * 0.08));
      const f = (d - target) * 0.012 * (1 + l.weight * 0.3);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      l.a.vx += fx; l.a.vy += fy;
      l.b.vx -= fx; l.b.vy -= fy;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.0007;
      n.vy += (H / 2 - n.y) * 0.0026;
      if (n === drag || n.fixed) { n.vx = n.vy = 0; continue; }
      n.x += clamp(n.vx * alpha, -12, 12);
      n.y += clamp(n.vy * alpha, -12, 12);
      n.vx *= 0.55; n.vy *= 0.55;
      const rr = radius(n) + 4;
      n.x = clamp(n.x, rr, W - rr);
      n.y = clamp(n.y, rr, H - rr);
    }
    alpha = Math.max(0.02, alpha * 0.985);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const focus = hover || drag;
    const near = focus ? neighbors.get(focus.id) : null;
    for (const l of links) {
      const on = focus && (l.a === focus || l.b === focus);
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y);
      ctx.lineTo(l.b.x, l.b.y);
      ctx.strokeStyle = on ? color(focus) : colors.line;
      ctx.globalAlpha = focus ? (on ? 0.95 : 0.25) : 0.9;
      ctx.lineWidth = on ? 1.4 + l.weight * 0.6 : 0.8 + l.weight * 0.35;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const labelAll = W >= 760;
    for (const n of nodes) {
      const rad = radius(n);
      const dim = focus && n !== focus && !near.has(n.id);
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = n.role === 'current' || n.role === 'faculty' ? color(n) : colors.surface;
      ctx.fill();
      ctx.lineWidth = n.role === 'current' || n.role === 'faculty' ? 0 : 2;
      if (ctx.lineWidth) { ctx.strokeStyle = color(n); ctx.stroke(); }
      if (n.areas.length > 1 && (n.role === 'current' || n.role === 'faculty')) {
        // A thin ring per extra area.
        n.areas.slice(1, 4).forEach((a, i) => {
          ctx.beginPath();
          ctx.arc(n.x, n.y, rad + 3 + i * 3, 0, Math.PI * 2);
          ctx.strokeStyle = colors[a] || colors.ink3;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }
      const showLabel = labelAll ? (n.papers >= 2 || n === focus || (near && near.has(n.id))) : (n === focus || (near && near.has(n.id)) || n.role === 'faculty');
      if (showLabel) {
        ctx.font = `${n === focus ? 650 : 560} 13px "Schibsted Grotesk", system-ui, sans-serif`;
        ctx.fillStyle = colors.ink;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y + rad + 16);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    step();
    draw();
    raf = running && alpha > 0.021 ? requestAnimationFrame(frame) : 0;
    if (!raf) running = false;
  }
  function kick(a = 0.5) {
    alpha = Math.max(alpha, a);
    if (reduced.matches) { for (let i = 0; i < 300; i++) step(); draw(); return; }
    if (!running) { running = true; raf = requestAnimationFrame(frame); }
  }

  const at = (x, y) => nodes.find((n) => Math.hypot(n.x - x, n.y - y) <= radius(n) + 6);
  const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  function showTip(n) {
    if (!n) { tip.classList.remove('is-on'); return; }
    const with_ = [...neighbors.get(n.id)].map((id) => byId.get(id).name);
    const role = { faculty: 'Faculty', current: 'Current student', alumni: 'Alumni', 'alumni-undergrad': 'Former undergraduate' }[n.role] || '';
    tip.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = n.name;
    const meta = document.createElement('span');
    meta.textContent = `${role} · ${n.papers} paper${n.papers === 1 ? '' : 's'}`;
    const list = document.createElement('div');
    list.style.marginTop = '6px';
    list.style.color = 'var(--ink-2)';
    list.textContent = with_.length ? `With ${with_.slice(0, 8).join(', ')}${with_.length > 8 ? ` and ${with_.length - 8} more` : ''}` : '';
    tip.append(strong, meta, list);
    const tx = clamp(n.x + 18, 8, W - 300);
    const ty = clamp(n.y - 20, 8, H - 120);
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
    tip.classList.add('is-on');
  }

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    if (drag) { drag.x = x; drag.y = y; kick(0.3); showTip(drag); return; }
    const n = at(x, y);
    if (n !== hover) { hover = n; canvas.style.cursor = n ? 'grab' : 'default'; showTip(n); draw(); }
  });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e);
    const n = at(x, y);
    hover = n;
    showTip(n);
    if (n) { drag = n; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
    draw();
  });
  const end = () => { if (drag) { drag = null; canvas.style.cursor = hover ? 'grab' : 'default'; kick(0.2); } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!drag) { hover = null; showTip(null); draw(); } });
  canvas.addEventListener('dblclick', (e) => {
    const n = at(...local(e));
    if (n && n.url) location.href = n.url;
  });

  readColors();
  size();
  seed();
  new ResizeObserver(() => { size(); kick(0.4); draw(); }).observe(box);
  document.addEventListener('themechange', () => { readColors(); draw(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); draw(); });
  new IntersectionObserver(([e]) => { if (e.isIntersecting) kick(1); }, { threshold: 0.2 }).observe(box);
  draw();
}
