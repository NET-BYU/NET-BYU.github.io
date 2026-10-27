// Site behavior. Every page works without this script; it adds the interactive layer.
import { initFigures } from './figures.js';

const root = document.documentElement;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// Run a DOM change inside a view transition when the browser supports it.
function transition(fn) {
  if (document.startViewTransition && !reduced()) document.startViewTransition(fn);
  else fn();
}

// ---------- Theme ----------
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
function labelThemeButtons() {
  const next = theme() === 'dark' ? 'light' : 'dark';
  $$('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', `Switch to ${next} theme`));
}
$$('[data-theme-toggle]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    transition(() => {
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch { /* private mode */ }
      document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
      labelThemeButtons();
    });
  }),
);
systemDark.addEventListener('change', () => {
  if (!root.dataset.theme) document.dispatchEvent(new CustomEvent('themechange'));
  labelThemeButtons();
});
labelThemeButtons();

// ---------- Animations on/off (one switch for the whole site, remembered) ----------
function labelMotionButtons() {
  const off = root.dataset.motion === 'off';
  $$('[data-motion-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(off));
    b.textContent = off ? 'Play animations' : 'Pause animations';
  });
}
$$('[data-motion-toggle]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const off = root.dataset.motion !== 'off';
    if (off) root.dataset.motion = 'off';
    else delete root.dataset.motion;
    try { localStorage.setItem('motion', off ? 'off' : 'on'); } catch { /* private mode */ }
    document.dispatchEvent(new CustomEvent('motionchange', { detail: off ? 'off' : 'on' }));
    labelMotionButtons();
  }),
);
labelMotionButtons();

// ---------- Header ----------
const header = document.querySelector('.site-header');
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Mobile menu ----------
const menu = document.getElementById('menu-panel');
const menuBtn = document.querySelector('.menu-btn');
function setMenu(open) {
  if (!menu) return;
  menu.classList.toggle('is-open', open);
  menuBtn?.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) menu.querySelector('[data-menu-close]')?.focus();
  else menuBtn?.focus();
}
menuBtn?.addEventListener('click', () => setMenu(true));
menu?.querySelector('[data-menu-close]')?.addEventListener('click', () => setMenu(false));
menu?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
  if (e.key === 'Tab') {
    const items = $$('a, button', menu);
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ---------- Toast ----------
const toastEl = document.querySelector('.toast');
let toastTimer = 0;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

// ---------- Abstracts ----------
$$('button[aria-controls^="abs-"]').forEach((btn) => {
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  if (!panel) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
  });
});

// ---------- Copy citation ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
$$('[data-cite]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    toast((await copyText(btn.dataset.cite)) ? 'Citation copied' : 'Could not copy. Select the text instead.');
  }),
);

// ---------- Read more ----------
$$('.readmore').forEach((box) => {
  const inner = box.querySelector('.readmore-inner');
  const btn = box.querySelector('button');
  if (!inner || !btn) return;
  box.classList.add('is-clamped');
  requestAnimationFrame(() => {
    if (inner.scrollHeight > inner.clientHeight + 24) box.classList.add('can-expand');
    else box.classList.remove('is-clamped');
  });
  btn.addEventListener('click', () => {
    const open = box.classList.toggle('is-open');
    box.classList.toggle('is-clamped', !open);
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('span').textContent = open ? 'Show less' : 'Read the full description';
  });
});

// ---------- Lightbox ----------
const lightbox = document.querySelector('.lightbox');
if (lightbox) {
  const img = lightbox.querySelector('img');
  const close = () => { lightbox.classList.remove('is-open'); lightbox.__opener?.focus(); };
  $$('[data-lightbox]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      img.src = a.href;
      img.alt = a.querySelector('img')?.alt || '';
      lightbox.__opener = a;
      lightbox.classList.add('is-open');
      lightbox.querySelector('button').focus();
    }),
  );
  lightbox.addEventListener('click', (e) => { if (e.target !== img) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightbox.classList.contains('is-open')) close(); });
}

// ---------- Rails (horizontal scrollers) ----------
$$('[data-rail]').forEach((wrap) => {
  const rail = wrap.querySelector('.rail');
  const step = () => (rail.querySelector(':scope > *')?.getBoundingClientRect().width || 300) + 24;
  wrap.querySelector('[data-rail-prev]')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduced() ? 'auto' : 'smooth' }));
  wrap.querySelector('[data-rail-next]')?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: reduced() ? 'auto' : 'smooth' }));
});

// ---------- Chip rows that scroll sideways get an edge fade ----------
$$('.chips').forEach((row) => {
  const update = () => {
    const over = row.scrollWidth > row.clientWidth + 2;
    row.classList.toggle('is-overflowing', over);
    row.classList.toggle('at-end', over && row.scrollLeft + row.clientWidth >= row.scrollWidth - 4);
  };
  row.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(row);
});

// ---------- Scroll-spy chip bars ----------
$$('[data-spy]').forEach((bar) => {
  const links = $$('a[href^="#"]', bar);
  const targets = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => {
        const on = a.getAttribute('href') === `#${e.target.id}`;
        a.classList.toggle('is-current', on);
        if (on) a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
      });
    }
  }, { rootMargin: '-35% 0px -60% 0px' });
  targets.forEach((t) => io.observe(t));
});

// ---------- Papers: filter by area and search ----------
const paperList = document.querySelector('[data-papers]');
if (paperList) {
  const chips = $$('[data-filter]');
  const search = document.querySelector('[data-search-input]');
  const count = document.querySelector('[data-result-count]');
  const empty = document.querySelector('.no-results');
  const papers = $$('.paper', paperList);
  const groups = $$('.year-group', paperList);
  const params = new URLSearchParams(location.search);
  let area = params.get('area') || 'all';
  if (search && params.get('q')) search.value = params.get('q');

  const apply = () => {
    const q = (search?.value || '').trim().toLowerCase();
    let shown = 0;
    papers.forEach((p) => {
      const ok = (area === 'all' || p.dataset.area === area) && (!q || p.dataset.search.includes(q));
      p.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach((g) => { g.hidden = !g.querySelector('.paper:not([hidden])'); });
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === area)));
    if (count) count.textContent = `${shown} of ${papers.length} papers`;
    if (empty) empty.hidden = shown > 0;
    const next = new URLSearchParams();
    if (area !== 'all') next.set('area', area);
    if (q) next.set('q', q);
    history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}${location.hash}`);
  };
  chips.forEach((c) => c.addEventListener('click', () => { area = c.dataset.filter; transition(apply); }));
  let typing = 0;
  search?.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(apply, 120); });
  apply();
}

// ---------- The π easter egg (modifier + Shift click) ----------
document.getElementById('the-net')?.addEventListener('click', (e) => {
  if ((e.ctrlKey || e.altKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    window.location.href = 'https://www.imdb.com/title/tt0113957/';
  }
});

// ---------- Page modules ----------
initFigures(document);
