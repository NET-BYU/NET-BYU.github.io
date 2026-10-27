// Template for a paper or project animation. Copy this file to js/anim/<id>.js, where <id>
// is the `id` of your paper or project in _data/papers.yaml or _data/projects.yaml.
// Preview it with the dev harness (see README.md, "Animations").
//
// The toolkit (kit.js) gives you:
//   api.w, api.h        figure size in CSS pixels       api.t      time in seconds (0 → duration)
//   api.s(px), api.fs(px)  sizes that scale with the figure (reference width 640px)
//   api.pal             theme colors: ink, ink2, ink3, line, grid, surface, and the logo colors
//   api.accent          your research area's color (use it for your contribution)
//   api.accentInk       the same color, safe for text
//   api.line, api.circle, api.rect, api.arrow, api.text, api.label, api.caption, api.axes,
//   api.wave, api.light, api.project, and helpers ease, seg, win, lerp, clamp, rng from kit.js
import { TAU, ease, seg } from './kit.js';

export default {
  duration: 10, // seconds per loop
  still: 6, // the moment shown to visitors who prefer reduced motion

  // Optional: compute anything expensive once (data, random positions).
  init(api) {
    const r = api.rng('my-paper');
    return { phase: r() * TAU };
  },

  // Draw the whole frame for time api.t. Don't keep state between frames.
  draw(api, state) {
    const { w, h, t, pal } = api;
    const appear = ease.out(seg(t, 0, 1));
    api.text('YOUR ANIMATION', w * 0.08, h * 0.2, { size: api.fs(11), color: pal.ink3, spacing: 0.4, alpha: appear });
    api.wave(w * 0.08, w * 0.92, (x) => h * 0.55 + Math.sin(x * 0.03 - t * 2 + state.phase) * h * 0.15, {
      color: api.accent,
      width: api.s(2),
      alpha: appear,
    });
    api.caption('label the moment that matters', w / 2, h * 0.82, 3, 7, { color: api.accentInk, border: api.accent });
  },
};
