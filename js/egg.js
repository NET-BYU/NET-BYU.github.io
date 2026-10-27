// The easter egg. Ctrl- or ⌘-click a NET Lab logo (the big ones, not the header's link): signals run
// along the logo's circuit traces and a hidden message is decoded, bit by bit, next to a π. A nod
// to the π in the corner of the screen in The Net (1995), which hid a backdoor for anyone who
// knew to click it. The message is `easter_egg` in _config.yml.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = 140; // viewBox units per second
let traces = null;
let busy = false;

// The logo's colored traces (straight runs only: the ring pads, the thin stubs, the cyan hexagon
// and the lettering stay put), read once from the same SVG the page shows.
async function loadTraces() {
  if (traces) return traces;
  const text = await (await fetch('/images/netlab-logo.svg')).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  traces = {
    viewBox: svg.getAttribute('viewBox'),
    paths: [...doc.querySelectorAll('path[stroke]')]
      .filter((p) => p.getAttribute('stroke-width') === '3' && p.getAttribute('stroke') !== '#00aeef' && !/a/i.test(p.getAttribute('d')))
      .map((p) => ({ d: p.getAttribute('d'), color: p.getAttribute('stroke') })),
  };
  return traces;
}

const NS = 'http://www.w3.org/2000/svg';
function el(name, attrs) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Bright beads that run along every trace, drawn in an overlay exactly over the logo image.
async function runSignals(img) {
  const { viewBox, paths } = await loadTraces();
  const r = img.getBoundingClientRect();
  const svg = el('svg', { viewBox, 'aria-hidden': 'true', class: 'egg-overlay' });
  Object.assign(svg.style, { left: `${r.left + scrollX}px`, top: `${r.top + scrollY}px`, width: `${r.width}px`, height: `${r.height}px` });
  const blur = el('filter', { id: 'egg-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  blur.append(el('feGaussianBlur', { stdDeviation: '2' }));
  svg.append(blur);
  const halo = el('g', { filter: 'url(#egg-glow)', opacity: '0.9' });
  const core = el('g', {});
  svg.append(halo, core);
  document.body.append(svg);

  // Each signal is a short lit segment: a glow in the trace's color around a white-hot core.
  const runs = paths.flatMap(({ d, color }, i) => {
    const glow = el('path', { d, stroke: color, fill: 'none', 'stroke-width': '7', 'stroke-linecap': 'round' });
    const hot = el('path', { d, stroke: '#fff', fill: 'none', 'stroke-width': '2.2', 'stroke-linecap': 'round' });
    halo.append(glow);
    core.append(hot);
    const len = glow.getTotalLength();
    const bead = 10;
    const timing = { duration: Math.max(450, (len / SPEED) * 1000), delay: (i % 5) * 140, iterations: 3, easing: 'cubic-bezier(.45, 0, .55, 1)' };
    return [glow, hot].map((p) => {
      p.style.strokeDasharray = `${bead} ${len + bead}`;
      p.style.strokeDashoffset = `${bead}`;
      return p.animate([{ strokeDashoffset: bead }, { strokeDashoffset: -len }], timing).finished;
    });
  });
  await Promise.allSettled(runs);
  await svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished;
  svg.remove();
}

// The message arrives one character at a time: its eight bits flicker in, then settle into the letter.
function decode(toastEl, message) {
  toastEl.classList.add('toast--egg');
  toastEl.innerHTML = '<span class="egg-pi" aria-hidden="true">π</span><span class="egg-text" aria-hidden="true"></span><span class="sr-only"></span>';
  const out = toastEl.querySelector('.egg-text');
  toastEl.classList.add('is-on');
  const finish = () => {
    out.textContent = message;
    toastEl.querySelector('.sr-only').textContent = message;
  };
  if (reduced()) { finish(); return Promise.resolve(); }
  return new Promise((resolve) => {
    let i = 0;
    let flick = 0;
    const step = () => {
      if (i >= message.length) { finish(); resolve(); return; }
      const ch = message[i];
      const bits = ch.charCodeAt(0).toString(2).padStart(8, '0');
      if (flick < 3) {
        const noise = [...bits].map((b) => (Math.random() < 0.5 ? b : String(1 - b))).join('');
        out.innerHTML = `${escape(message.slice(0, i))}<span class="egg-bits">${flick === 2 ? bits : noise}</span>`;
        flick++;
        setTimeout(step, 35);
      } else {
        flick = 0;
        i++;
        out.textContent = message.slice(0, i);
        setTimeout(step, ch === ' ' ? 30 : 55);
      }
    };
    step();
  });
}

function escape(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

export async function play(img, toastEl) {
  if (busy || !toastEl) return;
  busy = true;
  try {
    const message = (img.dataset.egg || 'ACCESS GRANTED').trim();
    const signals = reduced() ? Promise.resolve() : runSignals(img).catch(() => {});
    await new Promise((r) => setTimeout(r, reduced() ? 0 : 500));
    await decode(toastEl, message);
    await Promise.all([signals, new Promise((r) => setTimeout(r, 3500))]);
  } finally {
    toastEl.classList.remove('is-on');
    setTimeout(() => toastEl.classList.remove('toast--egg'), 400);
    busy = false;
  }
}
