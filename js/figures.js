// Mounts animation modules (js/anim/<id>.js) into .fig[data-anim] slots.
//
// Every figure rests on a still frame (the module's `still` moment). It plays only while someone
// is looking at it on purpose: while the pointer is over it (or over the card it belongs to), or
// while that card has keyboard focus. Then the moving picture wipes in over the still
// behind an area-colored scan line, and fades back to the still when the pointer leaves. Phones
// can't hover, so there the one figure nearest the middle of the screen plays. Visitors who
// prefer reduced motion only ever see the still.
import { createApi, readPalette, AREA_COLOR } from './anim/kit.js';

const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const noHoverMQ = matchMedia('(hover: none)');
const FADE_MS = 350; // matches the fade-out of .fig-live in site.css
const live = new Set();
const mounted = new Set();
let raf = 0;
let last = 0;

export class Figure {
  constructor(el) {
    this.el = el;
    this.stage = el.querySelector('.fig-stage');
    this.id = el.dataset.anim;
    this.area = AREA_COLOR[el.dataset.area] || el.dataset.color || 'cyan';
    this.visible = false;
    this.wanted = { hover: false, focus: false, centre: false };
    this.playing = false;
    this.elapsed = 0;
    this.mod = null;
    this.state = null;
    this.failed = false;
  }

  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        this.mod = (await import(`./anim/${this.id}.js`)).default;
      } catch (err) {
        console.warn(`[figure] could not load "${this.id}", using the generic animation`, err);
        try {
          this.mod = (await import('./anim/generic.js')).default;
        } catch {
          this.fail();
          return;
        }
      }
      // Two layers: the still frame underneath, the moving picture on top.
      this.still = document.createElement('canvas');
      this.still.className = 'fig-still';
      const label = this.stage.dataset.label;
      if (label) {
        this.still.setAttribute('role', 'img');
        this.still.setAttribute('aria-label', label);
      } else {
        this.still.setAttribute('aria-hidden', 'true');
      }
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'fig-live';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.stage.prepend(this.still, this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.stillCtx = this.still.getContext('2d');
      this.api = createApi(this.ctx, { area: this.area, seed: this.el.dataset.seed || this.id });
      this.measure();
      try {
        this.state = this.mod.init ? this.mod.init(this.api) : null;
      } catch (err) {
        console.error(`[figure] init failed for "${this.id}"`, err);
        this.fail();
        return;
      }
      this.ro = new ResizeObserver(() => {
        if (this.measure()) {
          if (this.mod.resize) this.state = this.mod.resize(this.api, this.state) ?? this.state;
          this.paintStill();
          if (this.playing || this.forcedT !== undefined) this.render();
        }
      });
      this.ro.observe(this.stage);
      mounted.add(this);
      this.paintStill();
      this.update();
    })();
    return this.loading;
  }

  measure() {
    const r = this.stage.getBoundingClientRect();
    const cap = this.mod && this.mod.scene ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === this.api.w && h === this.api.h && dpr === this.api.dpr) return false;
    for (const c of [this.canvas, this.still]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    this.api.w = w;
    this.api.h = h;
    this.api.dpr = dpr;
    this.stage.style.setProperty('--stage-w', `${w}px`);
    return true;
  }

  get stillT() {
    const d = this.mod.duration || 10;
    return this.mod.still ?? d * 0.6;
  }

  // Draw one moment of the animation onto the top (live) canvas.
  draw(t) {
    if (!this.mod || this.failed) return false;
    const api = this.api;
    api.pal = this.pal || (this.pal = readPalette(this.el));
    api.reduced = reducedMQ.matches;
    api.t = t;
    const ctx = this.ctx;
    ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, api.w, api.h);
    try {
      this.mod.draw(api, this.state);
    } catch (err) {
      console.error(`[figure] draw failed for "${this.id}"`, err);
      this.fail();
      return false;
    }
    api.frame++;
    return true;
  }

  // The resting picture: the module's still moment, copied to the bottom canvas.
  paintStill() {
    if (!this.draw(this.stillT)) return;
    this.stillCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.stillCtx.clearRect(0, 0, this.still.width, this.still.height);
    this.stillCtx.drawImage(this.canvas, 0, 0);
  }

  render() {
    if (!this.mod) return;
    const d = this.mod.duration || 10;
    this.draw(this.forcedT ?? this.elapsed % d);
  }

  // Draw one fixed moment on the live layer (used by the dev harness and screenshots).
  seek(t) {
    this.forcedT = t;
    this.render();
  }

  // Play while the pointer, keyboard focus or (on phones) the middle of the screen is on it.
  want(reason, on) {
    this.wanted[reason] = on;
    this.update();
  }

  update() {
    const w = this.wanted;
    const play = !!this.mod && !this.failed && !reducedMQ.matches && this.visible && (w.hover || w.focus || w.centre);
    if (play === this.playing) return;
    this.playing = play;
    clearTimeout(this.fadeTimer);
    if (play) {
      if (!live.has(this)) this.elapsed = 0;
      this.render();
      // Restart the wipe and scan line from the left each time.
      this.el.classList.remove('is-playing');
      void this.stage.offsetWidth;
      this.el.classList.add('is-playing');
      start(this);
    } else {
      // Keep moving while the live layer fades out, then rest on the still.
      this.el.classList.remove('is-playing');
      this.fadeTimer = setTimeout(() => live.delete(this), FADE_MS);
    }
  }

  fail() {
    this.failed = true;
    this.el.classList.add('is-failed');
    this.canvas?.remove();
    this.still?.remove();
    if (!this.stage.querySelector('.fig-fallback')) {
      const msg = document.createElement('p');
      msg.className = 'fig-fallback';
      msg.textContent = 'This animation could not load.';
      this.stage.append(msg);
    }
  }
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  for (const f of live) {
    if (f.forcedT !== undefined) continue;
    f.elapsed += dt;
    f.api.dt = dt;
    f.render();
  }
  raf = live.size && !document.hidden ? requestAnimationFrame(tick) : 0;
}

function start(fig) {
  live.add(fig);
  if (!raf && !document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

// What counts as "looking at" a figure: the whole card when the figure sits in a link (the home
// page's project tiles), otherwise the figure itself.
function zoneOf(el) {
  return el.closest('a') || el;
}

function wireZone(el, set) {
  const zone = zoneOf(el);
  zone.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') set('hover', true); });
  zone.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') set('hover', false); });
  zone.addEventListener('focusin', () => set('focus', zone.matches(':focus-within')));
  zone.addEventListener('focusout', (e) => { if (!zone.contains(e.relatedTarget)) set('focus', false); });
}

// Phones: the figure nearest the middle of the screen plays, the rest rest.
let centreQueued = false;
function pickCentre() {
  centreQueued = false;
  if (!noHoverMQ.matches) return;
  const mid = innerHeight / 2;
  let best = null;
  let bestD = innerHeight * 0.3;
  for (const f of mounted) {
    if (!f.visible) continue;
    const r = f.stage.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - mid);
    if (d < bestD) { best = f; bestD = d; }
  }
  for (const f of mounted) if (f.wanted.centre !== (f === best)) f.want('centre', f === best);
}
function queueCentre() {
  if (!centreQueued && noHoverMQ.matches) {
    centreQueued = true;
    requestAnimationFrame(pickCentre);
  }
}
addEventListener('scroll', queueCentre, { passive: true });
addEventListener('resize', queueCentre);

// Video figures follow the same rules: first frame at rest, playing while looked at.
function wireVideo(el) {
  const video = el.querySelector('video');
  if (!video) return;
  video.removeAttribute('autoplay');
  video.pause();
  wireZone(el, (reason, on) => {
    if (on && !reducedMQ.matches) video.play().catch(() => {});
    else if (!on) { video.pause(); video.currentTime = 0; }
  });
}

export function initFigures(root = document) {
  const figs = [...root.querySelectorAll('.fig[data-anim]')].filter((el) => !el.__fig);
  root.querySelectorAll('.fig').forEach((el) => {
    if (el.querySelector('video')) wireVideo(el);
  });
  if (!figs.length) return [];

  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        near.unobserve(e.target);
        e.target.__fig.load();
      }
    }
  }, { rootMargin: '600px 0px' });

  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const fig = e.target.__fig;
      fig.visible = e.isIntersecting;
      fig.update();
    }
    queueCentre();
  }, { threshold: [0, 0.5] });

  return figs.map((el) => {
    const fig = new Figure(el);
    el.__fig = fig;
    wireZone(el, (reason, on) => fig.want(reason, on));
    near.observe(el);
    seen.observe(el);
    return fig;
  });
}

function repaintAll() {
  for (const f of mounted) {
    f.pal = null;
    f.paintStill();
    if (f.playing) f.render();
  }
}

document.addEventListener('themechange', repaintAll);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaintAll);
reducedMQ.addEventListener('change', () => { for (const f of mounted) f.update(); });
noHoverMQ.addEventListener('change', () => {
  for (const f of mounted) f.want('centre', false);
  queueCentre();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && live.size && !raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
});

window.NETFigures = { initFigures, mounted, live };
