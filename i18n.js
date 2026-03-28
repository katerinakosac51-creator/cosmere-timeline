'use strict';

// ─────────────────────────────────────────────
// LANGUAGE + TRANSLATION ENGINE
// Depends on: data.js (TRANSLATIONS, BOOK_TITLE_EN, PLANETS, COVER_URL, LOCALIZED_COVER_URLS)
// ─────────────────────────────────────────────

let currentLang = localStorage.getItem('cosmere-lang') || 'en';

function t(key) {
  // Try with current language suffix for Ukrainian
  if (currentLang === 'uk' && TRANSLATIONS.uk[key + '_uk']) {
    return TRANSLATIONS.uk[key + '_uk'];
  }
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || BOOK_TITLE_EN[key] || TRANSLATIONS.uk[key] || key;
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('cosmere-lang', lang);
  applyTranslations();
  updateLanguageSelector();
  refreshBookCovers(); // defined in render.js
}

function applyTranslations() {
  // Static UI elements
  document.title = t('pageTitle');
  document.querySelector('.header h1').textContent = t('title');
  document.querySelector('.header p').textContent = t('subtitle');
  const footerRights = document.getElementById('footer-rights');
  if (footerRights) footerRights.textContent = t('rightsNotice');
  document.documentElement.lang = currentLang;

  // Dynamic buttons
  const allBtn = document.querySelector('.leg-all');
  if (allBtn) allBtn.textContent = t('allWorlds');

  const btnEarlier = document.getElementById('btn-earlier');
  if (btnEarlier) {
    const btnEarlierText = btnEarlier.querySelector('.btn-text');
    if (btnEarlierText) btnEarlierText.textContent = t('earlier');
    btnEarlier.title = t('jumpToStart');
  }

  const btnLater = document.getElementById('btn-later');
  if (btnLater) {
    const btnLaterText = btnLater.querySelector('.btn-text');
    if (btnLaterText) btnLaterText.textContent = t('later');
    btnLater.title = t('jumpToEnd');
  }

  const slider = document.getElementById('slider');
  if (slider) slider.setAttribute('aria-label', t('timelinePosition'));

  const legend = document.getElementById('legend');
  if (legend) legend.setAttribute('aria-label', t('planetFilter'));

  // Rebuild legend items with new labels and preserve active filter state.
  rebuildLegend();     // defined in render.js
  setFilter(activePlanet); // defined in render.js

  // Rebuild era labels on canvas
  rebuildEras();       // defined in render.js
}

function updateLanguageSelector() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
  });
}

// ─────────────────────────────────────────────
// COVER URL HELPERS
// ─────────────────────────────────────────────

function getPlanetLabel(planetId) {
  const planet = PLANETS[planetId];
  return planet ? t(planet.labelKey) : planetId;
}

function getCanonicalBookTitle(titleKey) {
  return BOOK_TITLE_EN[titleKey] || titleKey;
}

function getOriginalBookTitle(titleKey) {
  return BOOK_TITLE_EN[titleKey] || t(titleKey);
}

function getLocalizedBookCoverUrl(book, lang = currentLang) {
  const canonicalTitle = getCanonicalBookTitle(book.titleKey);
  return LOCALIZED_COVER_URLS[lang]?.[canonicalTitle] ?? null;
}

function getBookCoverUrl(book) {
  const canonicalTitle = getCanonicalBookTitle(book.titleKey);
  const localizedUrl = getLocalizedBookCoverUrl(book);
  if (localizedUrl) return localizedUrl;
  return COVER_URL[canonicalTitle] ?? null;
}
