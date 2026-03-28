'use strict';

// ─────────────────────────────────────────────
// DRAG + SLIDER — unified rAF render loop
// Depends on: data.js, i18n.js, render.js, overlay.js
// ─────────────────────────────────────────────

const sliderEl = document.getElementById('slider');

// ── State ──
let dragging      = false, dragX0 = 0, scrollX0 = 0;
let sliderDriving = false;
let rafPending    = false;
let sliderTarget  = -1;
let lerpActive    = false;
const LERP = 0.18;

function cancelAutoScrollTarget() {
  sliderTarget = -1;
  lerpActive = false;
}

// ── Mouse drag on timeline ──
outer.addEventListener('mousedown', e => {
  dragging = true; dragX0 = e.pageX - outer.offsetLeft; scrollX0 = outer.scrollLeft;
  outer.style.userSelect = 'none';
  cancelAutoScrollTarget();
});
document.addEventListener('mouseup', () => { dragging = false; outer.style.userSelect = ''; });
outer.addEventListener('mousemove', e => {
  if (!dragging) return;
  e.preventDefault();
  outer.scrollLeft = scrollX0 - (e.pageX - outer.offsetLeft - dragX0);
  scheduleFrame();
});

// Use native touch scrolling for iOS momentum/inertia.
outer.addEventListener('touchstart', () => { cancelAutoScrollTarget(); }, { passive: true });
outer.addEventListener('wheel',      () => { cancelAutoScrollTarget(); }, { passive: true });

// ── Slider thumb drag guards ──
sliderEl.addEventListener('mousedown',  () => { sliderDriving = true; });
sliderEl.addEventListener('touchstart', () => { sliderDriving = true; }, { passive: true });
document.addEventListener('mouseup',   () => { sliderDriving = false; });
document.addEventListener('touchend',  () => { sliderDriving = false; });

function updateSliderThumbState() {
  const loopMs = 2600;
  const now = performance.now();
  const phase = (now % loopMs) / loopMs;
  const moonX = 14 + (phase * 72);
  const eclipseStrength = Math.pow(Math.sin(Math.PI * phase), 0.9);
  const coronaAlpha = 0.26 + (eclipseStrength * 0.18);

  sliderEl.style.setProperty('--eclipse-phase', eclipseStrength.toFixed(3));
  sliderEl.style.setProperty('--moon-x', moonX.toFixed(2) + '%');
  sliderEl.style.setProperty('--moon-alpha', eclipseStrength.toFixed(3));
  sliderEl.style.setProperty('--corona-alpha', coronaAlpha.toFixed(3));
}

function animateSliderThumb() {
  updateSliderThumbState();
  requestAnimationFrame(animateSliderThumb);
}
requestAnimationFrame(animateSliderThumb);

// ── Slider input → scroll ──
sliderEl.addEventListener('input', () => {
  cancelAutoScrollTarget();
  const max = outer.scrollWidth - outer.clientWidth;
  const pct = parseFloat(sliderEl.value);
  outer.scrollLeft = (pct / 100) * max;
  sliderEl.style.setProperty('--p', pct.toFixed(2) + '%');
  updateProjection();
});

// ─────────────────────────────────────────────
// PROJECTION LINE
// ─────────────────────────────────────────────

const projLine = document.getElementById('proj-line');
const SNAP_PX  = 120;
const CANVAS_H = 860;
const AXIS_TOP = 410;
projLine.style.setProperty('--ay', ((AXIS_TOP / CANVAS_H) * 100).toFixed(2) + '%');

const BOOK_SNAP = 60;
const DEFAULT_RAY_RGB = '201,168,76';
let lastRayBookIdx = null;
let rayPulseTimer  = null;

function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== 'string') return DEFAULT_RAY_RGB;
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return DEFAULT_RAY_RGB;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function triggerProjectionRayPulse() {
  projLine.classList.remove('ray-pulse');
  void projLine.offsetWidth; // force reflow so animation restarts
  projLine.classList.add('ray-pulse');
  clearTimeout(rayPulseTimer);
  rayPulseTimer = setTimeout(() => projLine.classList.remove('ray-pulse'), 620);
}

function updateProjection() {
  const lineX = outer.scrollLeft;
  projLine.style.left = lineX + 'px';

  // Live queries so rebuilt era elements (after language switch) are always found
  document.querySelectorAll('.era-lbl').forEach(el => {
    el.classList.toggle('near', Math.abs(Number(el.dataset.x) - lineX) < SNAP_PX);
  });
  document.querySelectorAll('.yr-mark').forEach(el => {
    el.classList.toggle('near', Math.abs(Number(el.dataset.x) - lineX) < SNAP_PX);
  });
  document.querySelectorAll('.tick').forEach(el => {
    el.classList.toggle('near', Math.abs(Number(el.dataset.x) - lineX) < SNAP_PX);
  });

  let closestBook = null;
  let closestDist = Infinity;
  document.querySelectorAll('.bk').forEach(bk => {
    if (bk.classList.contains('faded')) {
      bk.classList.remove('near');
      return;
    }
    const dist = Math.abs(Number(bk.dataset.x) - lineX);
    bk.classList.toggle('near', dist < BOOK_SNAP);
    if (dist < closestDist) {
      closestDist = dist;
      closestBook = bk;
    }
  });

  if (closestBook && closestDist < BOOK_SNAP) {
    const planetColor = PLANETS[closestBook.dataset.planet]?.color || '#c9a84c';
    projLine.style.setProperty('--ray-rgb', hexToRgbTriplet(planetColor));
    const bookIdx = Number.parseInt(closestBook.dataset.bookIdx || '', 10);
    if (!Number.isNaN(bookIdx) && bookIdx !== lastRayBookIdx) {
      lastRayBookIdx = bookIdx;
      triggerProjectionRayPulse();
    }
  } else {
    projLine.style.setProperty('--ray-rgb', DEFAULT_RAY_RGB);
    lastRayBookIdx = null;
  }
}

// ── Unified render frame ──
function scheduleFrame() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  rafPending = false;

  if (sliderTarget >= 0) {
    const dist = sliderTarget - outer.scrollLeft;
    if (Math.abs(dist) < 0.5) {
      outer.scrollLeft = sliderTarget;
      sliderTarget = -1;
      lerpActive = false;
    } else {
      outer.scrollLeft += dist * LERP;
      lerpActive = true;
      rafPending = true;
      requestAnimationFrame(renderFrame);
    }
  } else {
    lerpActive = false;
  }

  const max    = outer.scrollWidth - outer.clientWidth;
  const scroll = outer.scrollLeft;
  const pct    = max > 0 ? (scroll / max) * 100 : 0;

  if (!sliderDriving) {
    sliderEl.value = String(pct);
    sliderEl.style.setProperty('--p', pct.toFixed(2) + '%');
  }

  updateProjection();
}

// Native scroll → sync slider (skip during programmatic lerp)
outer.addEventListener('scroll', () => {
  if (lerpActive) return;
  scheduleFrame();
}, { passive: true });

renderFrame();

// EARLIER / LATER jump buttons
document.getElementById('btn-earlier').addEventListener('click', () => {
  sliderTarget = 0;
  scheduleFrame();
});
document.getElementById('btn-later').addEventListener('click', () => {
  sliderTarget = outer.scrollWidth - outer.clientWidth;
  scheduleFrame();
});

// ─────────────────────────────────────────────
// INITIALIZE LOCALIZATION
// Runs last — all other scripts are loaded by this point.
// ─────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLanguage(btn.getAttribute('data-lang')));
});

updateLanguageSelector();
applyTranslations();
