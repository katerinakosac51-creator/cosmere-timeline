'use strict';

// ─────────────────────────────────────────────
// OVERLAY  — pointer-events:none so it never blocks covers
// Detection via document.mousemove + elementFromPoint
// Depends on: data.js, i18n.js, render.js (trimCoverImage)
// ─────────────────────────────────────────────

const overlay    = document.getElementById('overlay');
const ovImgWrap  = document.getElementById('ov-img');
const ovImgEl    = document.getElementById('ov-img-el');
const ovFall     = document.getElementById('ov-fall');
const ovTitle    = document.getElementById('ov-title');
const ovOriginal = document.getElementById('ov-original');
const ovPlanet   = document.getElementById('ov-planet');
const ovYear     = document.getElementById('ov-year');
const ovBlurb    = document.getElementById('ov-blurb');
const backdrop   = document.getElementById('ov-backdrop');

let currentBook = null;
let hideTimer   = null;
let loadToken   = 0;

// Backdrop click dismisses overlay
backdrop.addEventListener('click', () => hideOverlay());

function isTouchDevice() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function resetImgState() {
  ovImgEl.onload  = null;
  ovImgEl.onerror = null;
  ovImgEl.src     = '';
  ovImgWrap.style.backgroundImage    = '';
  ovImgWrap.style.backgroundSize     = '';
  ovImgWrap.style.backgroundPosition = '';
  ovImgEl.style.opacity  = '1';
  ovImgEl.style.position = 'relative';
  ovImgEl.style.cssText  = '';
}

function showOverlay(b, p, url) {
  if (currentBook === b && overlay.classList.contains('on')) return;
  currentBook = b;
  clearTimeout(hideTimer);

  resetImgState();

  if (url && !b.upcoming) {
    const token = ++loadToken;
    ovImgEl.style.display = 'block';
    ovFall.style.display  = 'none';
    ovImgEl.alt           = t(b.titleKey);
    ovImgEl.crossOrigin   = 'anonymous';
    ovImgEl.onload  = () => { if (loadToken === token) trimCoverImage(ovImgEl, ovImgWrap); };
    ovImgEl.onerror = () => {
      if (loadToken !== token) return;
      ovImgEl.style.display = 'none';
      ovFall.style.display  = 'flex';
      ovFall.style.color    = p.color;
      ovFall.innerHTML      = `<div class="fall-title">${t(b.titleKey)}</div>`;
    };
    ovImgEl.src = url;
  } else {
    ovImgEl.style.display = 'none';
    ovFall.style.display  = 'flex';
    ovFall.style.color    = p.color;
    ovFall.innerHTML = b.upcoming
      ? `<div class="fall-tag" style="font-size:12px;margin-bottom:10px">${t('forthcoming')}</div><div class="fall-title" style="font-size:20px">${t(b.titleKey)}</div>`
      : `<div class="fall-title" style="font-size:18px">${t(b.titleKey)}</div>`;
  }

  ovImgWrap.style.borderColor = p.color + '99';
  ovTitle.textContent  = t(b.titleKey);
  if (currentLang !== 'en') {
    ovOriginal.textContent = `(${getOriginalBookTitle(b.titleKey)})`;
    ovOriginal.style.display = 'block';
  } else {
    ovOriginal.textContent = '';
    ovOriginal.style.display = 'none';
  }
  ovPlanet.textContent = getPlanetLabel(b.planet);
  ovPlanet.style.color = p.color;
  ovYear.textContent   = t(b.yearKey);
  const words  = t(b.blurbKey).split(' ');
  const chunks = [];
  for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(' '));
  ovBlurb.innerHTML = chunks.map((c, i) =>
    `<span class="ov-line" style="animation-delay:${i * 55}ms">${c}</span>`).join('');
  overlay.classList.add('on');
  if (isTouchDevice()) document.body.style.overflow = 'hidden';
}

function hideOverlay() {
  overlay.classList.remove('on');
  document.body.style.overflow = '';
  currentBook = null;
}

// ── CURSOR TRACKING ──
// Since overlay is pointer-events:none it never blocks the cursor.
// We track cursor position and hit-test cover elements directly.
document.addEventListener('mousemove', e => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return;

  const cw = el.closest('.cw');
  if (cw) {
    const idx = parseInt(cw.dataset.bookIdx, 10);
    if (!isNaN(idx)) {
      const b = BOOKS[idx];
      const p = PLANETS[b.planet];
      const url = getBookCoverUrl(b);
      clearTimeout(hideTimer);
      showOverlay(b, p, url);
    }
    return;
  }

  // Cursor is NOT over any cover — hide after short delay
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideOverlay, 80);
});
