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

// Momentum state
let velX          = 0;      // px/frame at ~60fps
let momentumOn    = false;
let lastMoveX     = 0, lastMoveT = 0;
let scrollF       = 0;      // float scroll position — avoids integer rounding steps
const FRICTION    = 0.95;
const VEL_STOP    = 0.15;   // px/frame threshold to stop

function cancelAutoScrollTarget() {
  sliderTarget  = -1;
  lerpActive    = false;
  momentumOn    = false;
  velX          = 0;
}

// ── Mouse drag on timeline ──
outer.addEventListener('mousedown', e => {
  dragging   = true;
  dragX0     = e.pageX - outer.offsetLeft;
  scrollX0   = outer.scrollLeft;
  outer.style.userSelect = 'none';
  cancelAutoScrollTarget();
  lastMoveX  = e.pageX;
  lastMoveT  = performance.now();
});
document.addEventListener('mouseup', () => {
  if (dragging && Math.abs(velX) > VEL_STOP) {
    momentumOn = true;
    scheduleFrame();
  }
  dragging = false;
  outer.style.userSelect = '';
});
outer.addEventListener('mousemove', e => {
  if (!dragging) return;
  e.preventDefault();
  const now = performance.now();
  const dt  = now - lastMoveT;
  if (dt > 0 && dt < 80) velX = ((e.pageX - lastMoveX) / dt) * 16; // px/ms → px/frame
  lastMoveX = e.pageX;
  lastMoveT = now;
  scrollF = scrollX0 - (e.pageX - outer.offsetLeft - dragX0);
  outer.scrollLeft = scrollF;
  scheduleFrame();
});

// Use native touch scrolling for iOS momentum/inertia.
outer.addEventListener('touchstart', () => { cancelAutoScrollTarget(); }, { passive: true });
outer.addEventListener('wheel',      () => { cancelAutoScrollTarget(); }, { passive: true });

// ── Legend bar momentum drag ──
(function initLegendDrag() {
  const leg = document.getElementById('legend');
  let lgDragging = false, lgX0 = 0, lgSL0 = 0, lgVel = 0, lgLastX = 0, lgLastT = 0, lgRaf = null;

  function lgMomentum() {
    lgVel *= 0.95;
    if (Math.abs(lgVel) < 0.15 || leg.scrollLeft <= 0 ||
        leg.scrollLeft >= leg.scrollWidth - leg.clientWidth) {
      lgVel = 0; lgRaf = null; return;
    }
    leg.scrollLeft -= lgVel;
    lgRaf = requestAnimationFrame(lgMomentum);
  }

  leg.addEventListener('mousedown', e => {
    if (lgRaf) { cancelAnimationFrame(lgRaf); lgRaf = null; }
    lgDragging = true; lgX0 = e.pageX; lgSL0 = leg.scrollLeft;
    lgVel = 0; lgLastX = e.pageX; lgLastT = performance.now();
    leg.classList.add('grabbing');
    e.preventDefault();
  });
  document.addEventListener('mouseup', () => {
    if (!lgDragging) return;
    lgDragging = false;
    leg.classList.remove('grabbing');
    if (Math.abs(lgVel) > 0.15) lgRaf = requestAnimationFrame(lgMomentum);
  });
  document.addEventListener('mousemove', e => {
    if (!lgDragging) return;
    const now = performance.now();
    const dt  = now - lgLastT;
    if (dt > 0 && dt < 80) lgVel = ((e.pageX - lgLastX) / dt) * 16;
    lgLastX = e.pageX; lgLastT = now;
    leg.scrollLeft = lgSL0 - (e.pageX - lgX0);
  });
}());

// ── Slider thumb drag guards ──
sliderEl.addEventListener('mousedown',  () => { sliderDriving = true; });
sliderEl.addEventListener('touchstart', () => { sliderDriving = true; }, { passive: true });
document.addEventListener('mouseup',   () => { sliderDriving = false; });
document.addEventListener('touchend',  () => { sliderDriving = false; });

// Scroll-driven eclipse — cycles 4 times across the full scroll sweep, seamlessly reversible
const ECLIPSE_CYCLES = 4;
function updateSliderThumbState() {
  const max = outer.scrollWidth - outer.clientWidth;
  const raw   = max > 0 ? outer.scrollLeft / max : 0;
  const phase = (raw * ECLIPSE_CYCLES) % 1; // 0→1 repeating ECLIPSE_CYCLES times
  const moonX = 14 + (phase * 72);
  const eclipseStrength = Math.pow(Math.sin(Math.PI * phase), 0.9);
  const coronaAlpha = 0.26 + (eclipseStrength * 0.18);

  sliderEl.style.setProperty('--eclipse-phase', eclipseStrength.toFixed(3));
  sliderEl.style.setProperty('--moon-x', moonX.toFixed(2) + '%');
  sliderEl.style.setProperty('--moon-alpha', eclipseStrength.toFixed(3));
  sliderEl.style.setProperty('--corona-alpha', coronaAlpha.toFixed(3));
}

// ── Slider input → scroll ──
sliderEl.addEventListener('input', () => {
  cancelAutoScrollTarget();
  const max = outer.scrollWidth - outer.clientWidth;
  const pct = parseFloat(sliderEl.value);
  scrollF = (pct / 100) * max;
  outer.scrollLeft = scrollF;
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

function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== 'string') return DEFAULT_RAY_RGB;
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return DEFAULT_RAY_RGB;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

// ── Canvas ray burst ──
const planetBookCounts = {};
for (const b of BOOKS) {
  planetBookCounts[b.planet] = (planetBookCounts[b.planet] || 0) + 1;
}

const RAY_CANVAS_W = 130;
const rayCanvas = document.createElement('canvas');
rayCanvas.id = 'ray-canvas';
rayCanvas.width = RAY_CANVAS_W;
rayCanvas.height = CANVAS_H;
projLine.appendChild(rayCanvas);
const rayCtx = rayCanvas.getContext('2d');
let rayAnimId = null;

// Multi-harmonic wave — sum of Fourier-like components, left/right edges offset
function waveAt(y, phase, side) {
  const s = side === 0 ? 0 : 1; // 0 = left, 1 = right
  return (
    Math.sin(y * 0.038 + phase        + s * 1.31) * 0.42 +
    Math.sin(y * 0.079 + phase * 1.53 + s * 0.87) * 0.24 +
    Math.sin(y * 0.148 + phase * 2.27 + s * 2.05) * 0.14 +
    Math.sin(y * 0.261 + phase * 3.41 + s * 0.42) * 0.10 +
    Math.sin(y * 0.433 + phase * 4.89 + s * 1.74) * 0.06 +
    Math.sin(y * 0.712 + phase * 7.13 + s * 3.10) * 0.04
  ); // sum of weights ≈ 1.0 → multiply by amp for actual pixels
}

function drawRayPulse(progress, baseW, rgb) {
  const w = RAY_CANVAS_W;
  rayCtx.clearRect(0, 0, w, CANVAS_H);
  if (progress >= 1) return;

  const expand  = progress < 0.28 ? progress / 0.28 : 1;
  const beamH   = expand * 290 + progress * 20;
  const topY    = AXIS_TOP - beamH * 0.62;
  const botY    = AXIS_TOP + beamH * 0.38;
  const opacity = progress < 0.22
    ? progress / 0.22
    : Math.pow(1 - (progress - 0.22) / 0.78, 1.6);
  if (opacity <= 0.01) return;

  const cx        = w / 2;
  const wavePhase = progress * 5.5;
  // amp decays as beam fades; kept subtle (sand-beach: gentle ripple, not crash)
  const amp       = (1 - progress * 0.75) * 3.5;
  const steps     = Math.max(40, Math.ceil((botY - topY) / 3));
  const axisT     = (AXIS_TOP - topY) / (botY - topY);

  rayCtx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t      = i / steps;
    const y      = topY + t * (botY - topY);
    const taper  = Math.exp(-Math.pow((t - axisT) / 0.36, 2));
    const halfW  = (baseW / 2) * taper;
    const edge   = cx - halfW + waveAt(y, wavePhase, 0) * amp;
    if (i === 0) rayCtx.moveTo(edge, y);
    else         rayCtx.lineTo(edge, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t      = i / steps;
    const y      = topY + t * (botY - topY);
    const taper  = Math.exp(-Math.pow((t - axisT) / 0.36, 2));
    const halfW  = (baseW / 2) * taper;
    const edge   = cx + halfW + waveAt(y, wavePhase, 1) * amp;
    rayCtx.lineTo(edge, y);
  }
  rayCtx.closePath();

  const [r, g, b] = rgb;
  const at   = Math.max(0, Math.min(axisT, 0.99));
  const grad = rayCtx.createLinearGradient(0, topY, 0, botY);
  grad.addColorStop(0,                       `rgba(${r},${g},${b},0)`);
  grad.addColorStop(Math.max(0, at - 0.45),  `rgba(${r},${g},${b},${(opacity * 0.55).toFixed(3)})`);
  grad.addColorStop(at,                      `rgba(${r},${g},${b},${opacity.toFixed(3)})`);
  grad.addColorStop(Math.min(1, at + 0.2),   `rgba(${r},${g},${b},${(opacity * 0.42).toFixed(3)})`);
  grad.addColorStop(1,                       `rgba(${r},${g},${b},0)`);

  // Main fill — blurred so edges are smudged, not sharp
  rayCtx.save();
  rayCtx.filter = 'blur(5px)';
  rayCtx.fillStyle = grad;
  rayCtx.fill();
  rayCtx.restore();

  // Bright core pass — wider blur for soft halo
  rayCtx.save();
  rayCtx.filter = 'blur(9px)';
  rayCtx.globalAlpha = opacity * 0.32;
  rayCtx.fillStyle = `rgba(${r},${g},${b},1)`;
  rayCtx.fill();
  rayCtx.restore();
}

function triggerProjectionRayPulse(rgb, bookCount) {
  if (rayAnimId !== null) cancelAnimationFrame(rayAnimId);
  const duration = 620;
  const rawW  = 6 + bookCount * 1.2 + (Math.random() * 4 - 2);
  const baseW = Math.min(rawW, 20); // cap at 20px
  const t0       = performance.now();
  function frame(now) {
    const progress = Math.min((now - t0) / duration, 1);
    drawRayPulse(progress, baseW, rgb);
    if (progress < 1) rayAnimId = requestAnimationFrame(frame);
    else rayAnimId = null;
  }
  rayAnimId = requestAnimationFrame(frame);
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
      const rgb    = hexToRgbTriplet(planetColor).split(',').map(Number);
      const bCount = planetBookCounts[closestBook.dataset.planet] || 1;
      triggerProjectionRayPulse(rgb, bCount);
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
    const dist = sliderTarget - scrollF;
    if (Math.abs(dist) < 0.4) {
      scrollF = sliderTarget;
      outer.scrollLeft = scrollF;
      sliderTarget = -1;
      lerpActive = false;
    } else {
      scrollF += dist * LERP;
      outer.scrollLeft = scrollF;
      lerpActive = true;
      rafPending = true;
      requestAnimationFrame(renderFrame);
    }
  } else if (momentumOn) {
    velX *= FRICTION;
    const max = outer.scrollWidth - outer.clientWidth;
    scrollF -= velX;
    if (Math.abs(velX) < VEL_STOP || scrollF <= 0 || scrollF >= max) {
      scrollF = Math.max(0, Math.min(max, scrollF));
      outer.scrollLeft = scrollF;
      momentumOn = false;
      velX = 0;
    } else {
      outer.scrollLeft = scrollF;
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

  updateSliderThumbState();
  updateProjection();
}

// Native scroll → sync slider (skip during programmatic lerp)
outer.addEventListener('scroll', () => {
  if (lerpActive) return;
  scrollF = outer.scrollLeft; // keep float in sync with native scroll
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
