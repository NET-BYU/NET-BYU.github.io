// Mounts animation modules (js/anim/<id>.js) into .fig[data-anim] slots.
// Modules load when a figure nears the viewport and only animate while visible.
import { createApi, readPalette, AREA_COLOR } from './anim/kit.js';

const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
// Still frames when the visitor prefers reduced motion or paused animations in the footer.
const stillOnly = () => reducedMQ.matches || document.documentElement.dataset.motion === 'off';
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
    this.elapsed = Number(el.dataset.start || 0);
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
      this.canvas = document.createElement('canvas');
      const label = this.stage.dataset.label;
      if (label) {
        this.canvas.setAttribute('role', 'img');
        this.canvas.setAttribute('aria-label', label);
      } else {
        this.canvas.setAttribute('aria-hidden', 'true');
      }
      this.stage.prepend(this.canvas);
      this.ctx = this.canvas.getContext('2d');
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
          this.render();
        }
      });
      this.ro.observe(this.stage);
      mounted.add(this);
      this.render();
      if (this.visible) start(this);
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
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.api.w = w;
    this.api.h = h;
    this.api.dpr = dpr;
    this.stage.style.setProperty('--stage-w', `${w}px`);
    return true;
  }

  render() {
    if (!this.mod || this.failed) return;
    const api = this.api;
    const d = this.mod.duration || 10;
    api.pal = this.pal || (this.pal = readPalette(this.el));
    api.reduced = stillOnly();
    api.t = this.forcedT ?? (api.reduced ? (this.mod.still ?? d * 0.6) : this.elapsed % d);
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
    }
    api.frame++;
  }

  // Draw one fixed moment and stop (used by the dev harness and screenshots).
  seek(t) {
    this.forcedT = t;
    this.render();
  }

  fail() {
    this.failed = true;
    this.el.classList.add('is-failed');
    if (this.canvas) this.canvas.remove();
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
    if (f.api.reduced || f.forcedT !== undefined) continue;
    f.elapsed += dt;
    f.api.dt = dt;
    f.render();
  }
  raf = live.size && !document.hidden ? requestAnimationFrame(tick) : 0;
}

function start(fig) {
  if (!fig.mod || fig.failed) return;
  live.add(fig);
  if (!raf && !document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

function stop(fig) {
  live.delete(fig);
}

// Video figures play only while visible, and not at all when animations are off.
const videos = new Set();
function wireVideo(el) {
  const video = el.querySelector('video');
  if (!video) return;
  video.removeAttribute('autoplay');
  const entry = { video, visible: false };
  videos.add(entry);
  new IntersectionObserver(([e]) => {
    entry.visible = e.isIntersecting;
    syncVideo(entry);
  }, { threshold: 0.15 }).observe(el);
}
function syncVideo({ video, visible }) {
  if (visible && !stillOnly()) video.play().catch(() => {});
  else video.pause();
}

export function initFigures(root = document) {
  const figs = [...root.querySelectorAll('.fig[data-anim]')].filter((el) => !el.__fig);
  if (!figs.length && !root.querySelector('.fig video')) return [];

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
      fig.visible = e.isIntersecting && e.intersectionRatio > 0.12;
      if (fig.visible) {
        e.target.classList.add('is-on');
        start(fig);
      } else {
        stop(fig);
      }
    }
  }, { threshold: [0, 0.12, 0.5] });

  const out = figs.map((el) => {
    const fig = new Figure(el);
    el.__fig = fig;
    near.observe(el);
    seen.observe(el);
    return fig;
  });
  root.querySelectorAll('.fig').forEach((el) => {
    if (el.querySelector('video')) wireVideo(el);
  });
  return out;
}

function repaintAll() {
  for (const f of mounted) {
    f.pal = null;
    f.render();
  }
}

document.addEventListener('themechange', repaintAll);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaintAll);
function motionChanged() {
  repaintAll();
  for (const f of mounted) if (f.visible) start(f);
  videos.forEach(syncVideo);
}
reducedMQ.addEventListener('change', motionChanged);
document.addEventListener('motionchange', motionChanged);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && live.size && !raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
});

window.NETFigures = { initFigures, mounted, live };
