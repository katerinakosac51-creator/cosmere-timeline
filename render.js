'use strict';

// ─────────────────────────────────────────────
// LEGEND + FILTER + SCROLL-TO-PLANET
// Depends on: data.js, i18n.js
// ─────────────────────────────────────────────

const outer    = document.getElementById('outer');
const legendEl = document.getElementById('legend');
let activePlanet = null;

// Compute average x per planet for centering the scroll view
const planetCenterX = {};
for (const b of BOOKS) {
  if (!planetCenterX[b.planet]) planetCenterX[b.planet] = [];
  planetCenterX[b.planet].push(b.x);
}
for (const pid in planetCenterX) {
  const xs = planetCenterX[pid];
  planetCenterX[pid] = xs.reduce((a, v) => a + v, 0) / xs.length;
}

function scrollToPlanet(pid) {
  const cx = planetCenterX[pid] ?? TOTAL_W / 2;
  // sliderTarget and scheduleFrame are defined in scroll.js (loaded after render.js)
  sliderTarget = Math.max(0, Math.min(cx, outer.scrollWidth - outer.clientWidth));
  scheduleFrame();
}

const legItems = {};

function rebuildLegend() {
  legendEl.innerHTML = '';

  const allBtnNew = Object.assign(document.createElement('button'), {
    className: 'leg-all', textContent: t('allWorlds')
  });
  allBtnNew.addEventListener('click', () => setFilter(null));
  legendEl.appendChild(allBtnNew);

  for (const [id, p] of Object.entries(PLANETS)) {
    const el = document.createElement('button');
    el.className = 'leg-item';
    el.style.setProperty('--pc', p.color);
    el.innerHTML = `<span class="leg-dot" style="background:${p.color}88"></span>${getPlanetLabel(id)}`;
    el.addEventListener('click', () => {
      const toggling = activePlanet === id;
      setFilter(toggling ? null : id);
      if (!toggling) scrollToPlanet(id);
    });
    legendEl.appendChild(el);
    legItems[id] = el;
  }
}

function setFilter(pid) {
  activePlanet = pid;
  const allBtn = legendEl.querySelector('.leg-all');
  if (allBtn) {
    allBtn.style.opacity = pid ? '0.45' : '1';
    allBtn.classList.toggle('active', !pid);
  }
  for (const [id, el] of Object.entries(legItems)) {
    el.classList.toggle('active', id === pid);
    el.classList.toggle('faded', !!pid && id !== pid);
  }
  document.querySelectorAll('.bk').forEach(el =>
    el.classList.toggle('faded', !!pid && el.dataset.planet !== pid));
  document.querySelectorAll('.adot').forEach(el =>
    el.classList.toggle('faded', !!pid && el.dataset.planet !== pid));
}

// If a planet filter is active, clicking/tapping outside the legend clears it.
document.addEventListener('pointerdown', (e) => {
  if (!activePlanet) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.closest('#legend')) return;
  setFilter(null);
}, { passive: true });

// ─────────────────────────────────────────────
// CANVAS SETUP
// ─────────────────────────────────────────────

const canvas = document.getElementById('canvas');

function applyCanvasPadding() {
  const half = Math.round(outer.clientWidth / 2);
  outer.style.paddingLeft  = half + 'px';
  outer.style.paddingRight = half + 'px';
}
applyCanvasPadding();
window.addEventListener('resize', applyCanvasPadding);

canvas.style.width = TOTAL_W + 'px';
canvas.insertAdjacentHTML('beforeend', '<div class="axis"></div>');

function rebuildEras() {
  canvas.querySelectorAll('.tick, .era-lbl, .yr-mark').forEach(el => el.remove());
  for (const e of ERAS) {
    canvas.insertAdjacentHTML('beforeend', `
      <div class="tick"    style="left:${e.x}px" data-x="${e.x}"></div>
      <div class="era-lbl" style="left:${e.x}px" data-x="${e.x}">${t(e.labelKey)}</div>
      <div class="yr-mark" style="left:${e.x}px" data-x="${e.x}">${t(e.yearKey)}</div>`);
  }
}

// ─────────────────────────────────────────────
// COVER IMAGE UTILITIES
// ─────────────────────────────────────────────

/**
 * Given a loaded <img>, find the tight bounding box of non-background content
 * and apply it via CSS background-image + background-position/size on the container.
 * threshold: pixels within this luminance distance of the corner colour are "background".
 */
function trimCoverImage(img, container) {
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;

    const offscreen = new OffscreenCanvas(w, h);
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    function px(x, y) {
      const i = (y * w + x) * 4;
      return [data[i], data[i+1], data[i+2], data[i+3]];
    }
    // Sample corners + edge midpoints; pick the lightest point as background candidate.
    // This catches covers with dark corners but light borders (e.g. Way of Kings).
    const samples = [px(0,0), px(w-1,0), px(0,h-1), px(w-1,h-1),
                     px(w>>1,0), px(w>>1,h-1), px(0,h>>1), px(w-1,h>>1)];
    let br = 0, bg = 0, bb = 0, bestLum = -1;
    for (const [r,g,b,a] of samples) {
      if (a < 20) continue;
      const lum = 0.299*r + 0.587*g + 0.114*b;
      if (lum > bestLum) { bestLum = lum; br = r; bg = g; bb = b; }
    }
    if (bestLum < 160) return;

    const THRESH = 40;
    function isBg(x, y) {
      const [r,g,b,a] = px(x, y);
      if (a < 20) return true;
      return Math.sqrt((r-br)**2 + (g-bg)**2 + (b-bb)**2) < THRESH;
    }

    let top = 0, bot = h-1, lft = 0, rgt = w-1;

    outer: for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (!isBg(x,y)) { top = y; break outer; }

    outer: for (let y = h-1; y >= 0; y--)
      for (let x = 0; x < w; x++)
        if (!isBg(x,y)) { bot = y; break outer; }

    outer: for (let x = 0; x < w; x++)
      for (let y = top; y <= bot; y++)
        if (!isBg(x,y)) { lft = x; break outer; }

    outer: for (let x = w-1; x >= 0; x--)
      for (let y = top; y <= bot; y++)
        if (!isBg(x,y)) { rgt = x; break outer; }

    const cropW = rgt - lft + 1, cropH = bot - top + 1;
    const pad = Math.max(lft/w, top/h, (w-1-rgt)/w, (h-1-bot)/h);
    if (pad < 0.015) return;

    const scaleX = container.offsetWidth  / cropW;
    const scaleY = container.offsetHeight / cropH;
    img.style.cssText += ';opacity:0;position:absolute;pointer-events:none';
    container.style.backgroundImage    = `url("${img.src}")`;
    container.style.backgroundSize    = `${(w * scaleX).toFixed(1)}px ${(h * scaleY).toFixed(1)}px`;
    container.style.backgroundPosition = `-${(lft * scaleX).toFixed(1)}px -${(top * scaleY).toFixed(1)}px`;
    container.style.backgroundRepeat   = 'no-repeat';
  } catch(e) {
    // CORS or OffscreenCanvas not available — leave image as-is
  }
}

function fallback(title, color, upcoming) {
  const d = document.createElement('div');
  d.className = 'cfall'; d.style.color = color;
  d.innerHTML = upcoming
    ? `<div class="fall-tag">${t('forthcoming')}</div><div class="fall-title">${title}</div>`
    : `<div class="fall-title">${title}</div>`;
  return d;
}

function createCoverImage(book, container, url) {
  const img = document.createElement('img');
  // Only set crossOrigin for hosts that send ACAO headers; others (coppermind.net, file://) fail if set.
  const CORS_HOST = /i\.mbooks\.com\.ua|upload\.wikimedia\.org|brandonsanderson\.com/;
  if (url && CORS_HOST.test(url)) img.crossOrigin = 'anonymous';
  img.alt = t(book.titleKey);
  img.loading = 'eager';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center center;display:block';
  img.addEventListener('load', () => trimCoverImage(img, container));
  img.addEventListener('error', function h() {
    this.removeEventListener('error', h);
    this.remove();
    if (!container.querySelector('.cfall')) {
      container.insertBefore(fallback(t(book.titleKey), PLANETS[book.planet].color, false), container.querySelector('.cw-band'));
    }
  });
  return img;
}

function refreshBookCovers() {
  document.querySelectorAll('.cw').forEach(cw => {
    const idx = parseInt(cw.dataset.bookIdx, 10);
    if (Number.isNaN(idx)) return;

    const book = BOOKS[idx];
    const planet = PLANETS[book.planet];
    const url = getBookCoverUrl(book);
    const band = cw.querySelector('.cw-band');
    const existingImg = cw.querySelector('img');
    const existingFallback = cw.querySelector('.cfall');

    if (book.upcoming || !url) {
      if (existingImg) existingImg.remove();
      if (!existingFallback) {
        cw.insertBefore(fallback(t(book.titleKey), planet.color, !!book.upcoming), band);
      } else {
        existingFallback.style.color = planet.color;
        existingFallback.innerHTML = book.upcoming
          ? `<div class="fall-tag">${t('forthcoming')}</div><div class="fall-title">${t(book.titleKey)}</div>`
          : `<div class="fall-title">${t(book.titleKey)}</div>`;
      }
      if (book.upcoming) {
        cw.style.borderStyle = 'dashed';
        cw.style.opacity = '0.6';
      }
      return;
    }

    if (existingFallback) existingFallback.remove();
    cw.style.borderStyle = '';
    cw.style.opacity = '';
    cw.style.backgroundImage = '';
    cw.style.backgroundSize = '';
    cw.style.backgroundPosition = '';
    cw.style.backgroundRepeat = '';

    if (existingImg) {
      existingImg.alt = t(book.titleKey);
      existingImg.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center center;display:block';
      if (existingImg.src !== url) {
        existingImg.src = url;
      } else {
        trimCoverImage(existingImg, cw);
      }
    } else {
      const img = createCoverImage(book, cw, url);
      img.src = url;
      cw.insertBefore(img, band);
    }
  });

  // overlay / currentBook / showOverlay are defined in overlay.js (loaded after render.js)
  if (overlay.classList.contains('on') && currentBook) {
    const openBook = currentBook;
    currentBook = null;
    showOverlay(openBook, PLANETS[openBook.planet], getBookCoverUrl(openBook));
  }
}

// ─────────────────────────────────────────────
// BUILD CANVAS
// ─────────────────────────────────────────────

// Initial era + legend build
rebuildEras();
rebuildLegend();
setFilter(null);

// Resolve same-side cover overlaps: books whose centers are closer than
// MIN_GAP on the same axis side will visually overlap. 108px is the cover
// width; add 16px buffer so the hover scale(1.08) doesn't cause overlap either.
(function resolveBookOverlaps() {
  const MIN_GAP = 124; // 108px cover + 16px buffer for hover scale
  [true, false].forEach(side => {
    const group = BOOKS
      .filter(b => b.above === side)
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];
      if (curr.x - prev.x < MIN_GAP) curr.x = prev.x + MIN_GAP;
    }
  });
})();

for (const b of BOOKS) {
  const p   = PLANETS[b.planet];
  const url = getBookCoverUrl(b);

  // Dot
  const dot = document.createElement('div');
  dot.className = 'adot';
  dot.style.cssText = `left:${b.x}px;background:${p.color}`;
  dot.dataset.planet = b.planet;
  canvas.appendChild(dot);

  // Wrapper
  const bk = document.createElement('div');
  bk.className   = 'bk';
  bk.dataset.planet = b.planet;
  bk.dataset.x = b.x;  // canvas-x center for projection hit-test
  bk.style.left  = (b.x - 55) + 'px';  // half of 110px bk width — centers bk and stem on b.x
  // Planet RGB triplet for CSS variable (used by .near highlight)
  const _hex = p.color.replace('#', '');
  bk.style.setProperty('--pc-rgb',
    `${parseInt(_hex.slice(0,2),16)},${parseInt(_hex.slice(2,4),16)},${parseInt(_hex.slice(4,6),16)}`);

  const stem = document.createElement('div');
  stem.className = 'stem';
  stem.style.cssText = `height:${b.stemH}px;background:${p.color}`;

  const cw = document.createElement('div');
  cw.className = 'cw';
  cw.style.borderColor = p.color + '66';

  if (url && !b.upcoming) {
    const img = createCoverImage(b, cw, url);
    img.src = url;
    cw.appendChild(img);
  } else {
    cw.appendChild(fallback(t(b.titleKey), p.color, !!b.upcoming));
    if (b.upcoming) { cw.style.borderStyle = 'dashed'; cw.style.opacity = '0.6'; }
  }

  const band = document.createElement('div');
  band.className = 'cw-band'; band.style.background = p.color;
  cw.appendChild(band);

  if (b.above) {
    bk.style.top = (AXIS_Y - b.stemH - 162 - 6) + 'px';
    bk.append(cw, stem);
  } else {
    bk.style.top = AXIS_Y + 'px';
    bk.append(stem, cw);
  }

  cw.dataset.bookIdx = String(BOOKS.indexOf(b));
  bk.dataset.bookIdx = String(BOOKS.indexOf(b));

  canvas.appendChild(bk);
}
