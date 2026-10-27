// 404: a packet leaves a router, misses its next hop and falls off the route.
import { seg, ease, lerp, clamp } from './kit.js';

export default {
  duration: 6,
  still: 3.6,
  draw(api) {
    const { w, h, t, pal } = api;
    const y = h * 0.38;
    const nodes = [[w * 0.14, y], [w * 0.5, y], [w * 0.86, y]];
    const fade = 1 - seg(t, 5.4, 6);
    // Links: the second one is broken
    api.line([nodes[0], nodes[1]], { color: pal.ink3, width: api.s(1.6) });
    const gapX = lerp(nodes[1][0], nodes[2][0], 0.5);
    api.line([nodes[1], [gapX - api.s(12), y]], { color: pal.ink3, width: api.s(1.6), dash: [api.s(4), api.s(4)] });
    api.line([[gapX + api.s(12), y], nodes[2]], { color: pal.ink3, width: api.s(1.6), dash: [api.s(4), api.s(4)] });
    nodes.forEach(([x, yy], i) => {
      api.circle(x, yy, api.s(12), { fill: pal.surface, stroke: i === 2 ? pal.ink3 : pal.ink, width: api.s(1.6) });
      api.text(['A', 'B', '?'][i], x, yy + api.fs(11) * 0.36, { size: api.fs(11), align: 'center', color: pal.ink, weight: 600 });
    });
    // The packet: A → B, then off the edge of the broken link and down
    const p1 = ease.inOut(seg(t, 0.4, 1.8));
    const p2 = seg(t, 2, 2.7);
    const fall = seg(t, 2.7, 4.4);
    let x, yy, rot = 0;
    if (t < 2) { x = lerp(nodes[0][0] + api.s(14), nodes[1][0] - api.s(14), p1); yy = y; }
    else if (t < 2.7) { x = lerp(nodes[1][0] + api.s(14), gapX, ease.in(p2)); yy = y; }
    else { x = gapX + fall * api.s(30); yy = y + ease.in(fall) * h * 0.55; rot = fall * 1.6; }
    const alpha = fade * (1 - clamp((yy - h * 0.86) / (h * 0.1), 0, 1));
    const ctx = api.ctx;
    ctx.save();
    ctx.translate(x, yy - api.s(16));
    ctx.rotate(rot);
    api.rect(-api.s(13), -api.s(8), api.s(26), api.s(16), { fill: api.accent, r: api.s(3), alpha });
    ctx.restore();
    api.caption('no route to host', gapX, y - api.s(42), 2.6, 4.8, { color: api.accentInk, border: api.accent });
  },
};
