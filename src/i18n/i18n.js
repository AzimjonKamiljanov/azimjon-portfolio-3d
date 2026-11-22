import { translations } from "./translations.js";

let currentLang = "uz";
const listeners = new Set();

export function getLanguage() {
  return currentLang;
}

export function getTranslations(lang = currentLang) {
  return {
    ui: translations.ui[lang] || translations.ui.uz,
    celestial: translations.celestial,
    stars: translations.stars,
  };
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLanguage(requestedLang) {
  const lang = translations.ui[requestedLang] ? requestedLang : "uz";
  currentLang = lang;
  try {
    localStorage.setItem("portfolio_lang", lang);
  } catch {
    // localStorage unavailable
  }
  document.documentElement.lang = lang;

  // 1. Language switcher buttons active state
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const isActive = btn.getAttribute("data-lang") === lang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive);
  });

  // 2. Header and Controls
  const uiTexts = translations.ui[lang] || translations.ui.uz;
  const brandTitleEl = document.querySelector(".brand-title");
  if (brandTitleEl) brandTitleEl.innerText = uiTexts.brandTitle;

  const brandSubtitleEl = document.querySelector(".brand-subtitle");
  if (brandSubtitleEl) {
    brandSubtitleEl.innerText = uiTexts.brandSubtitle;
  }

  const overviewBtnText = document.getElementById("overview-btn-text");
  if (overviewBtnText) overviewBtnText.innerText = uiTexts.overviewBtn;

  const catalogBtnText = document.getElementById("catalog-btn-text");
  if (catalogBtnText) catalogBtnText.innerText = uiTexts.catalogBtn;

  const telemetryToggleLabel = document.querySelector(
    ".telemetry-toggle-label",
  );
  if (telemetryToggleLabel && uiTexts.telemetryBtn)
    telemetryToggleLabel.innerText = uiTexts.telemetryBtn;
  const telemetryBadgeText = document.querySelector(".telemetry-badge-text");
  if (telemetryBadgeText && uiTexts.telemetryBadge)
    telemetryBadgeText.innerText = uiTexts.telemetryBadge;

  const tourToggleText = document.getElementById("tour-toggle-text");
  if (tourToggleText && uiTexts.tourBtn)
    tourToggleText.innerText = uiTexts.tourBtn;

  const resumeDownloadText = document.getElementById("resume-download-text");
  if (resumeDownloadText && uiTexts.resumeBtn)
    resumeDownloadText.innerText = uiTexts.resumeBtn;

  const sunResumeBtnText = document.getElementById("sun-resume-btn-text");
  if (sunResumeBtnText && uiTexts.resumeSunBtn)
    sunResumeBtnText.innerText = uiTexts.resumeSunBtn;

  const backButtonEl = document.getElementById("back-button");
  if (backButtonEl) backButtonEl.innerText = uiTexts.returnToOrbit;

  const controlHintsText = document.getElementById("control-hints-text");
  if (controlHintsText) controlHintsText.innerText = uiTexts.controlHints;

  const preloaderTitleEl = document.getElementById("preloader-title");
  if (preloaderTitleEl) preloaderTitleEl.innerText = uiTexts.preloaderTitle;

  const preloaderSubEl = document.getElementById("preloader-sub");
  if (preloaderSubEl) preloaderSubEl.innerText = uiTexts.preloaderSub;

  const preloaderStatusEl = document.getElementById("preloader-status");
  if (preloaderStatusEl) preloaderStatusEl.innerText = uiTexts.preloaderStatus;

  // Bottom Navigation Labels
  const navMap = {
    sun: uiTexts.nav.sun,
    Mercury: uiTexts.nav.mercury,
    Venus: uiTexts.nav.venus,
    Earth: uiTexts.nav.earth,
    moon: uiTexts.nav.moon,
    Mars: uiTexts.nav.mars,
    Jupiter: uiTexts.nav.jupiter,
    Saturn: uiTexts.nav.saturn,
    Uranus: uiTexts.nav.uranus,
    Neptune: uiTexts.nav.neptune,
    Pluto: uiTexts.nav.pluto,
    star: uiTexts.nav.stars,
    Voyager: uiTexts.nav.voyager || "Voyager",
    BlackHole: uiTexts.nav.blackHole || "Qora O'ra",
  };

  document.querySelectorAll("#nav-container .nav-btn").forEach((btn) => {
    const target = btn.getAttribute("data-target");
    const labelEl = btn.querySelector(".label");
    if (labelEl && navMap[target]) {
      labelEl.innerText = navMap[target];
    }
  });

  // Catalog modal headings
  const catalogBadgeEl = document.querySelector("#catalog-modal .badge-tag");
  if (catalogBadgeEl) catalogBadgeEl.innerText = uiTexts.catalogBadge;

  const catalogHeadingEl = document.querySelector(".catalog-heading");
  if (catalogHeadingEl) catalogHeadingEl.innerText = uiTexts.catalogHeading;

  const catalogDescEl = document.querySelector(".catalog-desc");
  if (catalogDescEl) catalogDescEl.innerText = uiTexts.catalogDesc;

  const searchInput = document.getElementById("catalog-search");
  if (searchInput) {
    searchInput.placeholder = uiTexts.catalogSearchPlaceholder;
  }

  const catLabels = {
    all: uiTexts.catAll,
    ai: uiTexts.catAi,
    security: uiTexts.catSecurity,
    web: uiTexts.catWeb,
    systems: uiTexts.catSystems,
  };
  document.querySelectorAll(".cat-filter-btn").forEach((btn) => {
    const cat = btn.getAttribute("data-category");
    const label = btn.querySelector(".cat-label");
    if (label && catLabels[cat]) {
      label.innerText = catLabels[cat];
    }
  });

  const emptyTitleEl = document.getElementById("catalog-empty-title");
  if (emptyTitleEl) emptyTitleEl.innerText = uiTexts.catalogEmptyTitle;

  const emptyDescEl = document.getElementById("catalog-empty-desc");
  if (emptyDescEl) emptyDescEl.innerText = uiTexts.catalogEmptyDesc;

  // Guide Modal
  const guideToggleText = document.getElementById("guide-toggle-text");
  if (guideToggleText)
    guideToggleText.innerText = uiTexts.guideBtn || "Ko'rsatma";

  if (uiTexts.guide) {
    const guideBadgeEl = document.getElementById("guide-badge");
    if (guideBadgeEl) guideBadgeEl.innerText = uiTexts.guide.badge;

    const guideHeadingEl = document.getElementById("guide-heading");
    if (guideHeadingEl) guideHeadingEl.innerText = uiTexts.guide.heading;

    const guideDescEl = document.getElementById("guide-desc");
    if (guideDescEl) guideDescEl.innerText = uiTexts.guide.desc;

    const step1Title = document.getElementById("guide-step1-title");
    if (step1Title) step1Title.innerText = uiTexts.guide.step1Title;
    const step1Desc = document.getElementById("guide-step1-desc");
    if (step1Desc) step1Desc.innerText = uiTexts.guide.step1Desc;

    const step2Title = document.getElementById("guide-step2-title");
    if (step2Title) step2Title.innerText = uiTexts.guide.step2Title;
    const step2Desc = document.getElementById("guide-step2-desc");
    if (step2Desc) step2Desc.innerText = uiTexts.guide.step2Desc;

    const step3Title = document.getElementById("guide-step3-title");
    if (step3Title) step3Title.innerText = uiTexts.guide.step3Title;
    const step3Desc = document.getElementById("guide-step3-desc");
    if (step3Desc) step3Desc.innerText = uiTexts.guide.step3Desc;

    const step4Title = document.getElementById("guide-step4-title");
    if (step4Title) step4Title.innerText = uiTexts.guide.step4Title;
    const step4Desc = document.getElementById("guide-step4-desc");
    if (step4Desc) step4Desc.innerText = uiTexts.guide.step4Desc;

    const step5Title = document.getElementById("guide-step5-title");
    if (step5Title) step5Title.innerText = uiTexts.guide.step5Title;
    const step5Desc = document.getElementById("guide-step5-desc");
    if (step5Desc) step5Desc.innerText = uiTexts.guide.step5Desc;

    const step6Title = document.getElementById("guide-step6-title");
    if (step6Title) step6Title.innerText = uiTexts.guide.step6Title;
    const step6Desc = document.getElementById("guide-step6-desc");
    if (step6Desc) step6Desc.innerText = uiTexts.guide.step6Desc;

    const step7Title = document.getElementById("guide-step7-title");
    if (step7Title) step7Title.innerText = uiTexts.guide.step7Title;
    const step7Desc = document.getElementById("guide-step7-desc");
    if (step7Desc) step7Desc.innerText = uiTexts.guide.step7Desc;

    const step8Title = document.getElementById("guide-step8-title");
    if (step8Title) step8Title.innerText = uiTexts.guide.step8Title;
    const step8Desc = document.getElementById("guide-step8-desc");
    if (step8Desc) step8Desc.innerText = uiTexts.guide.step8Desc;

    const dontShowText = document.getElementById("guide-dont-show-text");
    if (dontShowText) dontShowText.innerText = uiTexts.guide.dontShow;

    const startText = document.getElementById("guide-start-text");
    if (startText) startText.innerText = uiTexts.guide.startBtn;
  }

  // Credits Modal
  const creditsToggleText = document.getElementById("credits-toggle-text");
  if (creditsToggleText)
    creditsToggleText.innerText = uiTexts.creditsBtn || "Kreditlar";

  if (uiTexts.credits) {
    const creditsBadgeEl = document.getElementById("credits-badge");
    if (creditsBadgeEl) creditsBadgeEl.innerText = uiTexts.credits.badge;
    const creditsHeadingEl = document.getElementById("credits-heading");
    if (creditsHeadingEl) creditsHeadingEl.innerText = uiTexts.credits.heading;
    const creditsDescEl = document.getElementById("credits-desc");
    if (creditsDescEl) creditsDescEl.innerText = uiTexts.credits.desc;
    const creditsSec1 = document.getElementById("credits-sec1-title");
    if (creditsSec1) creditsSec1.innerText = uiTexts.credits.sec1Title;
    const creditsSec2 = document.getElementById("credits-sec2-title");
    if (creditsSec2) creditsSec2.innerText = uiTexts.credits.sec2Title;
  }

  listeners.forEach((fn) => {
    try {
      fn(lang);
    } catch (e) {
      console.error("Error in language listener:", e);
    }
  });
}

export function initLanguageSwitcher() {
  let saved = "uz";
  try {
    saved = localStorage.getItem("portfolio_lang") || "uz";
  } catch {
    saved = "uz";
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lang = btn.getAttribute("data-lang");
      if (lang) setLanguage(lang);
    });
  });

  setLanguage(saved);
}
