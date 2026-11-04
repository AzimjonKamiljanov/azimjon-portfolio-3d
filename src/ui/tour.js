import { playUiClick } from "../audio/soundscape.js";

const tourStops = [
  { id: "sun" },
  { id: "Mercury" },
  { id: "Venus" },
  { id: "Earth" },
  { id: "moon" },
  { id: "Mars" },
  { id: "Jupiter" },
  { id: "Saturn" },
  { id: "Uranus" },
  { id: "Neptune" },
  { id: "Pluto" },
];

export function initTour({
  onFocusObject,
  onShowDetails,
  getObjectById,
  getTranslations,
}) {
  let isTourActive = false;
  let tourIndex = 0;
  let isTourPaused = false;
  let tourProgressInterval = null;
  const TOUR_STEP_DURATION_MS = 9000;
  let tourStepStart = 0;
  let tourElapsed = 0;

  const tourHud = document.getElementById("tour-hud");
  const tourBadgeText = document.getElementById("tour-badge-text");
  const tourCounterText = document.getElementById("tour-counter-text");
  const tourExitBtn = document.getElementById("tour-exit-btn");
  const tourStopIcon = document.getElementById("tour-stop-icon");
  const tourTitleText = document.getElementById("tour-title-text");
  const tourRoleText = document.getElementById("tour-role-text");
  const tourProgressFill = document.getElementById("tour-progress-fill");
  const tourPrevBtn = document.getElementById("tour-prev-btn");
  const tourPlayBtn = document.getElementById("tour-play-btn");
  const tourNextBtn = document.getElementById("tour-next-btn");
  const tourDetailBtn = document.getElementById("tour-detail-btn");
  const tourPlayIcon = document.getElementById("tour-play-icon");
  const tourPlayLabel = document.getElementById("tour-play-label");
  const tourPrevLabel = document.getElementById("tour-prev-label");
  const tourNextLabel = document.getElementById("tour-next-label");
  const tourDetailLabel = document.getElementById("tour-detail-label");
  const tourToggleBtn = document.getElementById("tour-toggle-btn");

  function clearTourTimers() {
    if (tourProgressInterval) {
      clearInterval(tourProgressInterval);
      tourProgressInterval = null;
    }
  }

  function updateTourHud() {
    if (!isTourActive) return;
    const stop = tourStops[tourIndex];
    const trans =
      typeof getTranslations === "function" ? getTranslations() : {};
    const uiTexts = trans.ui || {};
    const tourUi = uiTexts.tour || {};
    const stopTrans = tourUi.stops?.[stop.id.toLowerCase()] || {};

    if (tourBadgeText)
      tourBadgeText.innerText = tourUi.badge || "KINEMATIK AVTO-SAYOHAT";
    if (tourCounterText)
      tourCounterText.innerText = `${String(tourIndex + 1).padStart(2, "0")} / ${String(tourStops.length).padStart(2, "0")}`;
    if (tourStopIcon)
      tourStopIcon.innerHTML = `<span class="planet-orb orb-${stop.id.toLowerCase()}"></span>`;

    const planetName = stopTrans.name || stop.id;
    const targetObj =
      typeof getObjectById === "function" ? getObjectById(stop.id) : null;
    const objTitle = targetObj?.userData?.title || stopTrans.role || "";

    if (tourTitleText)
      tourTitleText.innerText = `${planetName} • ${objTitle.split("•")[0].trim()}`;
    if (tourRoleText)
      tourRoleText.innerText =
        stopTrans.role || targetObj?.userData?.subtitle || "";

    if (tourPrevLabel) tourPrevLabel.innerText = tourUi.prev || "Oldingi";
    if (tourNextLabel) tourNextLabel.innerText = tourUi.next || "Keyingi";
    if (tourDetailLabel)
      tourDetailLabel.innerText = tourUi.details || "Batafsil";
  }

  function updateTourControlsUI() {
    const trans =
      typeof getTranslations === "function" ? getTranslations() : {};
    const uiTexts = trans.ui || {};
    const tourUi = uiTexts.tour || {};

    if (tourPlayIcon) {
      tourPlayIcon.innerHTML = isTourPaused
        ? '<svg class="btn-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7 4 19 12 7 20 7 4"/></svg>'
        : '<svg class="btn-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="3.5" height="16" rx="1"/><rect x="14.5" y="4" width="3.5" height="16" rx="1"/></svg>';
    }
    if (tourPlayLabel)
      tourPlayLabel.innerText = isTourPaused
        ? tourUi.play || "Davom ettirish"
        : tourUi.pause || "To'xtatish";
  }

  function startTourCountdown() {
    clearTourTimers();
    if (isTourPaused) return;

    tourStepStart = Date.now() - tourElapsed;
    const totalDuration = TOUR_STEP_DURATION_MS;

    tourProgressInterval = setInterval(() => {
      if (isTourPaused) return;
      const now = Date.now();
      tourElapsed = now - tourStepStart;
      const pct = Math.min(
        100,
        Math.max(0, (tourElapsed / totalDuration) * 100),
      );
      if (tourProgressFill) tourProgressFill.style.width = `${pct}%`;
      if (tourElapsed >= totalDuration) {
        clearTourTimers();
        nextTourStop();
      }
    }, 50);
  }

  function goToTourStop(index) {
    if (!isTourActive) return;
    tourIndex = (index + tourStops.length) % tourStops.length;
    tourElapsed = 0;
    if (tourProgressFill) tourProgressFill.style.width = "0%";

    const stop = tourStops[tourIndex];
    const targetObj =
      typeof getObjectById === "function" ? getObjectById(stop.id) : null;

    if (targetObj && typeof onFocusObject === "function") {
      onFocusObject(targetObj, true);
    }

    updateTourHud();
    updateTourControlsUI();

    if (!isTourPaused) {
      startTourCountdown();
    }
  }

  function nextTourStop() {
    playUiClick();
    goToTourStop(tourIndex + 1);
  }

  function prevTourStop() {
    playUiClick();
    goToTourStop(tourIndex - 1);
  }

  function toggleTourPlayPause() {
    playUiClick();
    if (!isTourActive) {
      startTour();
      return;
    }
    isTourPaused = !isTourPaused;
    updateTourControlsUI();
    if (isTourPaused) {
      clearTourTimers();
    } else {
      startTourCountdown();
    }
  }

  function startTour(fromIndex = 0) {
    playUiClick();
    isTourActive = true;
    isTourPaused = false;
    tourIndex = fromIndex;
    tourElapsed = 0;

    if (tourToggleBtn) tourToggleBtn.classList.add("active");
    if (tourHud) {
      tourHud.classList.remove("hidden");
      tourHud.style.display = "block";
    }

    goToTourStop(tourIndex);
  }

  function exitTour(_shouldReset = true) {
    if (!isTourActive) return;
    playUiClick();
    isTourActive = false;
    isTourPaused = false;
    clearTourTimers();

    if (tourToggleBtn) tourToggleBtn.classList.remove("active");
    if (tourHud) {
      tourHud.classList.add("hidden");
      tourHud.style.display = "none";
    }
  }

  if (tourExitBtn) {
    tourExitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exitTour();
    });
  }

  if (tourPlayBtn) {
    tourPlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTourPlayPause();
    });
  }

  if (tourNextBtn) {
    tourNextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      nextTourStop();
    });
  }

  if (tourPrevBtn) {
    tourPrevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      prevTourStop();
    });
  }

  if (tourDetailBtn) {
    tourDetailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      const stop = tourStops[tourIndex];
      const targetObj =
        typeof getObjectById === "function" ? getObjectById(stop.id) : null;
      if (targetObj && typeof onShowDetails === "function") {
        isTourPaused = true;
        clearTourTimers();
        updateTourControlsUI();
        onShowDetails(targetObj);
      }
    });
  }

  return {
    startTour,
    exitTour,
    nextTourStop,
    prevTourStop,
    toggleTourPlayPause,
    updateHud: updateTourHud,
    isActive: () => isTourActive,
  };
}
