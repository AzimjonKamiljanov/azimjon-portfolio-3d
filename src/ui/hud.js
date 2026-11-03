import { playUiClick } from "../audio/soundscape.js";

let orbitSpeedMultiplier = 1;
let isCinematicActive = false;

export function initHud(
  onSpeedChange,
  onResetView,
  onToggleAudio,
  onOpenCatalog,
  onToggleTour,
) {
  const warpSpeedBtn = document.getElementById("warp-speed-btn");
  const warpSpeedText = document.getElementById("warp-speed-text");
  const audioBtn = document.getElementById("audio-toggle-btn");
  const overviewBtn = document.getElementById("overview-btn");
  const catalogBtn = document.getElementById("catalog-btn");
  const tourToggleBtn = document.getElementById("tour-toggle-btn");
  const cinematicToggleBtn = document.getElementById("cinematic-toggle-btn");
  const cinematicExitBtn = document.getElementById("cinematic-exit-btn");
  const cinematicExitBanner = document.getElementById("cinematic-exit-banner");
  const telemetryIslandToggleBtn = document.getElementById(
    "telemetry-island-toggle",
  );
  const cosmicTelemetryIsland = document.getElementById(
    "cosmic-telemetry-island",
  );

  if (telemetryIslandToggleBtn && cosmicTelemetryIsland) {
    telemetryIslandToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      const isCollapsed =
        cosmicTelemetryIsland.classList.toggle("island-collapsed");
      telemetryIslandToggleBtn.setAttribute("aria-expanded", !isCollapsed);
    });
  }

  if (warpSpeedBtn) {
    warpSpeedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      if (orbitSpeedMultiplier === 1) orbitSpeedMultiplier = 5;
      else if (orbitSpeedMultiplier === 5) orbitSpeedMultiplier = 20;
      else orbitSpeedMultiplier = 1;

      if (warpSpeedText)
        warpSpeedText.innerText = `Vaqt: ${orbitSpeedMultiplier}x`;
      if (typeof onSpeedChange === "function")
        onSpeedChange(orbitSpeedMultiplier);
    });
  }

  if (overviewBtn) {
    overviewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      if (typeof onResetView === "function") onResetView();
    });
  }

  if (audioBtn) {
    audioBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof onToggleAudio === "function") onToggleAudio();
    });
  }

  if (catalogBtn) {
    catalogBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      if (typeof onOpenCatalog === "function") onOpenCatalog();
    });
  }

  if (tourToggleBtn) {
    tourToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      if (typeof onToggleTour === "function") onToggleTour();
    });
  }

  function toggleCinematic(enable = null) {
    if (enable !== null) isCinematicActive = enable;
    else isCinematicActive = !isCinematicActive;

    if (isCinematicActive) {
      document.body.classList.add("cinematic-active");
      if (cinematicExitBanner) {
        cinematicExitBanner.classList.remove("hidden");
        cinematicExitBanner.style.display = "block";
      }
    } else {
      document.body.classList.remove("cinematic-active");
      if (cinematicExitBanner) {
        cinematicExitBanner.classList.add("hidden");
        setTimeout(() => {
          if (!isCinematicActive && cinematicExitBanner)
            cinematicExitBanner.style.display = "none";
        }, 350);
      }
    }
  }

  if (cinematicToggleBtn) {
    cinematicToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      toggleCinematic();
    });
  }

  if (cinematicExitBtn) {
    cinematicExitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playUiClick();
      toggleCinematic(false);
    });
  }

  // Global keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (
      e.target &&
      (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
    )
      return;
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      toggleCinematic();
    } else if (e.key === "Escape") {
      if (isCinematicActive) toggleCinematic(false);
    }
  });

  return {
    getOrbitSpeed: () => orbitSpeedMultiplier,
    isCinematic: () => isCinematicActive,
    toggleCinematic,
  };
}
