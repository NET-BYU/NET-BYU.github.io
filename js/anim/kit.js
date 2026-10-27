// Shared toolkit for NET Lab figure animations.
//
// Every animation module in js/anim/ exports a default object:
//
//   export default {
//     duration: 12,     // loop length in seconds; api.t runs 0 → duration
//     still: 7.5,       // the moment drawn when the visitor prefers reduced motion
//     scene: false,     // true for cinematic scenes that paint their own background
//     init(api) {},     // optional: build state once; return it
//     draw(api, state)  // required: draw the whole frame at api.t
//   };
//
// Modules draw in CSS pixels (api.w × api.h); the loader handles device pixel ratio,
// resizing, pausing offscreen, reduced motion and theme changes. Use api.rng() rather
// than Math.random() so every frame is reproducible.

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const fract = (x) => x - Math.floor(x);

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

// Progress of t through the window [a, b], clamped to 0..1.
export const seg = (t, a, b) => clamp((t - a) / (b - a));
// 0 → 1 → 0 envelope over [a, b] with fade length f at each end.
export const win = (t, a, b, f = 0.3) => Math.min(seg(t, a, a + f), 1 - seg(t, b - f, b));

export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32) with helpers.
export function rng(seed = 1) {
  let s = (typeof seed === 'string' ? hash(seed) : seed) >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = r();
    while (!v) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  r.bits = (n) => Array.from({ length: n }, () => (r() < 0.5 ? 0 : 1));
  return r;
}

// Smooth 1D/2D value noise in roughly -1..1.
function lattice(i, j, seed) {
  const h = Math.imul(i * 374761393 + j * 668265263 + seed * 1442695041, 1274126177);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295 * 2 - 1;
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(lattice(i, 0, seed), lattice(i + 1, 0, seed), smooth(f));
}
export function noise2(x, y, seed = 0) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = smooth(x - i);
  const fy = smooth(y - j);
  const a = lerp(lattice(i, j, seed), lattice(i + 1, j, seed), fx);
  const b = lerp(lattice(i, j + 1, seed), lattice(i + 1, j + 1, seed), fx);
  return lerp(a, b, fy);
}

// Text → bits (8 per character, MSB first).
export function textBits(str) {
  const out = [];
  for (const ch of str) {
    const c = ch.charCodeAt(0) & 0xff;
    for (let b = 7; b >= 0; b--) out.push((c >> b) & 1);
  }
  return out;
}

// ---------- Color ----------

export const AREA_COLOR = {
  subprotocols: 'pink',
  underwater: 'cyan',
  vehicles: 'orange',
  spectrum: 'purple',
  sensing: 'lime',
  health: 'green',
  wifi: 'yellow',
};
export const LOGO = ['pink', 'orange', 'yellow', 'green', 'purple', 'lime', 'cyan'];

// Read the current theme's palette from CSS custom properties, as resolved inside `host`
// (custom properties hold unresolved light-dark() values, so each one is resolved through
// a real color property on a probe element).
export function readPalette(host = document.documentElement) {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  host.appendChild(probe);
  const v = (name) => {
    probe.style.color = `var(${name})`;
    return getComputedStyle(probe).color;
  };
  const pal = {
    bg: v('--fig-bg'),
    surface: v('--fig-surface'),
    ink: v('--fig-ink'),
    ink2: v('--fig-ink-2'),
    ink3: v('--fig-ink-3'),
    line: v('--fig-line'),
    grid: v('--fig-grid'),
    page: v('--bg'),
  };
  for (const c of LOGO) {
    pal[c] = v(`--c-${c}`);
    pal[`${c}Ink`] = v(`--c-${c}-ink`);
  }
  pal.purpleLine = v('--c-purple-line');
  probe.remove();
  const [r, g, b] = rgbParts(pal.bg);
  pal.dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  return pal;
}

export function rgbParts(color) {
  const m = String(color).match(/[\d.]+/g);
  if (!m) return [0, 0, 0, 1];
  return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] === undefined ? 1 : Number(m[3])];
}
// Any CSS rgb()/hex color with a new alpha.
export function alpha(color, a) {
  if (color.startsWith('#')) {
    const h = color.length === 4 ? color.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : color;
    const n = parseInt(h.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const [r, g, b] = rgbParts(color);
  return `rgba(${r},${g},${b},${a})`;
}
export function mix(c1, c2, t) {
  const a = c1.startsWith('#') ? rgbParts(alpha(c1, 1)) : rgbParts(c1);
  const b = c2.startsWith('#') ? rgbParts(alpha(c2, 1)) : rgbParts(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

// ---------- Drawing API ----------

const FONT = '"Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif';
const MONO = '"Red Hat Mono", ui-monospace, Menlo, monospace';

// Builds the api object handed to modules. The loader updates w, h, t, pal each frame.
export function createApi(ctx, opts = {}) {
  const api = {
    ctx,
    w: 0,
    h: 0,
    dpr: 1,
    t: 0,
    dt: 0,
    frame: 0,
    pal: null,
    area: opts.area || 'cyan',
    reduced: false,
    seed: opts.seed || 'net',

    get accent() {
      return api.area === 'purple' ? api.pal.purpleLine : api.pal[api.area];
    },
    get accentInk() {
      return api.pal[`${api.area}Ink`];
    },
    // Size relative to a 640px-wide reference figure.
    s(v) {
      return v * clamp(api.w / 640, 0.55, 2);
    },
    // Font size relative to the reference, never below 10px.
    fs(v) {
      return Math.max(10, api.s(v));
    },
    get compact() {
      return api.w < 480;
    },
    rng(seed) {
      return rng(seed === undefined ? api.seed : seed);
    },

    clear(color) {
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, api.w, api.h);
      } else {
        ctx.clearRect(0, 0, api.w, api.h);
      }
    },

    line(pts, o = {}) {
      if (pts.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (o.close) ctx.closePath();
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fill();
      }
      ctx.strokeStyle = o.color || api.pal.ink;
      ctx.lineWidth = o.width ?? api.s(1.5);
      ctx.lineCap = o.cap || 'round';
      ctx.lineJoin = o.join || 'round';
      if (o.dash) ctx.setLineDash(o.dash);
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      if (o.color !== 'none') ctx.stroke();
      ctx.restore();
    },

    circle(x, y, r, o = {}) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, r), 0, TAU);
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fill();
      }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = o.width ?? api.s(1.5);
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    },

    rect(x, y, w, h, o = {}) {
      ctx.save();
      ctx.beginPath();
      if (o.r) ctx.roundRect(x, y, w, h, o.r);
      else ctx.rect(x, y, w, h);
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fill();
      }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = o.width ?? api.s(1.25);
        if (o.dash) ctx.setLineDash(o.dash);
        ctx.stroke();
      }
      ctx.restore();
    },

    arrow(x1, y1, x2, y2, o = {}) {
      const color = o.color || api.pal.ink2;
      const width = o.width ?? api.s(1.5);
      const head = o.head ?? api.s(7);
      const a = Math.atan2(y2 - y1, x2 - x1);
      api.line([[x1, y1], [x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6]], { color, width, dash: o.dash, alpha: o.alpha });
      ctx.save();
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(a - 0.42) * head, y2 - Math.sin(a - 0.42) * head);
      ctx.lineTo(x2 - Math.cos(a + 0.42) * head, y2 - Math.sin(a + 0.42) * head);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    font(size, { weight = 500, mono = true, italic = false } = {}) {
      return `${italic ? 'italic ' : ''}${weight} ${size}px ${mono ? MONO : FONT}`;
    },

    // Text in the figure's label face (mono by default, for data and labels).
    text(str, x, y, o = {}) {
      ctx.save();
      ctx.font = api.font(o.size ?? api.fs(12), o);
      ctx.fillStyle = o.color || api.pal.ink2;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.base || 'alphabetic';
      if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
      if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
      ctx.fillText(str, x, y, o.maxWidth);
      ctx.restore();
    },

    measure(str, o = {}) {
      ctx.save();
      ctx.font = api.font(o.size ?? api.fs(12), o);
      if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
      const m = ctx.measureText(str).width;
      ctx.restore();
      return m;
    },

    // A pill label. Use for live captions that point at the moment they explain.
    label(str, x, y, o = {}) {
      const size = o.size ?? api.fs(11.5);
      const padX = o.padX ?? size * 0.7;
      const h = o.height ?? size * 2;
      const w = api.measure(str, { size, weight: o.weight ?? 600, mono: o.mono ?? true }) + padX * 2;
      const align = o.align || 'center';
      const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      const top = y - h / 2;
      const a = o.alpha ?? 1;
      if (a <= 0.001) return { x: left, y: top, w, h };
      ctx.save();
      ctx.globalAlpha = a;
      const pop = o.pop ?? 1;
      if (pop !== 1) {
        ctx.translate(left + w / 2, y);
        ctx.scale(pop, pop);
        ctx.translate(-(left + w / 2), -y);
      }
      ctx.beginPath();
      ctx.roundRect(left, top, w, h, h / 2);
      ctx.fillStyle = o.bg || api.pal.surface;
      ctx.fill();
      if (o.border !== false) {
        ctx.strokeStyle = o.border || api.pal.line;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.font = api.font(size, { weight: o.weight ?? 600, mono: o.mono ?? true });
      ctx.fillStyle = o.color || api.pal.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, left + w / 2, y + size * 0.04);
      ctx.restore();
      return { x: left, y: top, w, h };
    },

    // A caption that snaps in at t0 and out at t1 (with a quick pop), for live annotation.
    caption(str, x, y, t0, t1, o = {}) {
      const t = api.t;
      if (t < t0 || t > t1) return;
      const inP = seg(t, t0, t0 + 0.22);
      const outP = seg(t, t1 - 0.18, t1);
      const a = Math.min(inP, 1 - outP);
      api.label(str, x, y, { ...o, alpha: a * (o.alpha ?? 1), pop: 0.92 + 0.08 * ease.back(inP) });
    },

    // Axes with optional ticks. Returns mapping helpers.
    axes(o) {
      const { x, y, w, h } = o;
      const color = o.color || api.pal.line;
      if (o.grid) {
        for (const tk of o.yTicks || []) {
          const yy = y + h - (tk.p ?? 0) * h;
          api.line([[x, yy], [x + w, yy]], { color: api.pal.grid, width: 1 });
        }
      }
      api.line([[x, y], [x, y + h], [x + w, y + h]], { color, width: 1, cap: 'square' });
      const size = api.fs(10.5);
      for (const tk of o.xTicks || []) {
        const xx = x + (tk.p ?? 0) * w;
        api.line([[xx, y + h], [xx, y + h + api.s(4)]], { color, width: 1 });
        if (tk.label) api.text(tk.label, xx, y + h + api.s(6) + size, { size, color: api.pal.ink3, align: 'center' });
      }
      for (const tk of o.yTicks || []) {
        const yy = y + h - (tk.p ?? 0) * h;
        api.line([[x - api.s(4), yy], [x, yy]], { color, width: 1 });
        if (tk.label) api.text(tk.label, x - api.s(7), yy, { size, color: api.pal.ink3, align: 'right', base: 'middle' });
      }
      if (o.xLabel) api.text(o.xLabel, x + w, y + h - api.s(6), { size, color: api.pal.ink3, align: 'right' });
      if (o.yLabel) api.text(o.yLabel, x + api.s(6), y + size, { size, color: api.pal.ink3 });
      return {
        px: (p) => x + p * w,
        py: (p) => y + h - p * h,
      };
    },

    // Polyline through f(x) sampled every `step` px between x0 and x1.
    wave(x0, x1, f, o = {}) {
      const step = o.step ?? Math.max(1, api.s(2));
      const pts = [];
      for (let x = x0; x <= x1 + 0.01; x += step) pts.push([x, f(x)]);
      api.line(pts, o);
      return pts;
    },

    // Draw fn() with a soft glow (for scenes). Keeps blur bounded.
    glow(color, blur, fn) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      fn();
      ctx.restore();
    },

    // Radial light blob, additive. Cheap glow for particles and lights.
    light(x, y, r, color, a = 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, alpha(color, 0.9 * a));
      g.addColorStop(0.35, alpha(color, 0.35 * a));
      g.addColorStop(1, alpha(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    },

    // Simple perspective projection for pseudo-3D scenes.
    // cam: { x, y, z, yaw, pitch, f } ; returns [sx, sy, scale] or null when behind the camera.
    project(px, py, pz, cam) {
      let x = px - cam.x;
      let y = py - cam.y;
      let z = pz - cam.z;
      const cy = Math.cos(cam.yaw || 0);
      const sy = Math.sin(cam.yaw || 0);
      [x, z] = [x * cy - z * sy, x * sy + z * cy];
      const cp = Math.cos(cam.pitch || 0);
      const sp = Math.sin(cam.pitch || 0);
      [y, z] = [y * cp - z * sp, y * sp + z * cp];
      if (z <= 0.01) return null;
      const f = (cam.f || 1) * Math.min(api.w, api.h * 1.6);
      return [api.w / 2 + (x / z) * f, api.h / 2 - (y / z) * f, f / z];
    },
  };
  return api;
}
