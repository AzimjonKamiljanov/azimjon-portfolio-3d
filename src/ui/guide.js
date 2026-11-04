import { playUiOpen, playUiClose } from "../audio/soundscape.js";

let activeTrapCleanup = null;

function trapFocus(modalElement) {
  if (activeTrapCleanup) {
    activeTrapCleanup();
    activeTrapCleanup = null;
  }

  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    'input[type="checkbox"]:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  function getFocusableElements() {
    return Array.from(
      modalElement.querySelectorAll(focusableSelectors.join(",")),
    ).filter(
      (el) =>
        el.offsetParent !== null &&
        window.getComputedStyle(el).visibility !== "hidden",
    );
  }

  const previousActiveElement = document.activeElement;

  function handleKeyDown(e) {
    if (e.key !== "Tab") return;

    const focusables = getFocusableElements();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }

  modalElement.addEventListener("keydown", handleKeyDown);

  setTimeout(() => {
    const startBtn =
      modalElement.querySelector("#guide-start-btn") ||
      modalElement.querySelector("button");
    if (startBtn) startBtn.focus();
  }, 50);

  activeTrapCleanup = () => {
    modalElement.removeEventListener("keydown", handleKeyDown);
    if (
      previousActiveElement &&
      typeof previousActiveElement.focus === "function"
    ) {
      previousActiveElement.focus();
    }
  };

  return activeTrapCleanup;
}

export function initGuide() {
  const guideModalContainer = document.getElementById("guide-modal-container");
  const guideToggleBtn = document.getElementById("guide-toggle-btn");
  const guideCloseBtn = document.getElementById("guide-close-btn");
  const guideStartBtn = document.getElementById("guide-start-btn");
  const guideDontShowCheckbox = document.getElementById(
    "guide-dont-show-checkbox",
  );

  function showGuide() {
    window.__guideInteracted = true;
    if (!guideModalContainer) return;
    playUiOpen();
    guideModalContainer.classList.remove("hidden");
    guideModalContainer.style.display = "flex";
    guideModalContainer.setAttribute("role", "dialog");
    guideModalContainer.setAttribute("aria-modal", "true");
    guideModalContainer.setAttribute("aria-labelledby", "guide-heading");

    trapFocus(guideModalContainer);
  }

  function hideGuide() {
    window.__guideInteracted = true;
    if (!guideModalContainer) return;
    playUiClose();
    guideModalContainer.classList.add("hidden");
    guideModalContainer.style.display = "none";

    if (guideDontShowCheckbox && guideDontShowCheckbox.checked) {
      try {
        localStorage.setItem("solar_guide_v2_dismissed", "true");
      } catch {
        // ignore localStorage restrictions
      }
    }

    if (activeTrapCleanup) {
      activeTrapCleanup();
      activeTrapCleanup = null;
    }
  }

  const creditsModalContainer = document.getElementById("credits-modal-container");
  const creditsToggleBtn = document.getElementById("credits-toggle-btn");
  const creditsCloseBtn = document.getElementById("credits-close-btn");

  function showCredits() {
    if (!creditsModalContainer) return;
    if (guideModalContainer) hideGuide();
    playUiOpen();
    creditsModalContainer.classList.remove("hidden");
    creditsModalContainer.style.display = "flex";
    trapFocus(creditsModalContainer);
  }

  function hideCredits() {
    if (!creditsModalContainer) return;
    playUiClose();
    creditsModalContainer.classList.add("hidden");
    creditsModalContainer.style.display = "none";
    if (activeTrapCleanup) {
      activeTrapCleanup();
      activeTrapCleanup = null;
    }
  }

  if (creditsToggleBtn) {
    creditsToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showCredits();
    });
  }

  if (creditsCloseBtn) {
    creditsCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideCredits();
    });
  }

  if (creditsModalContainer) {
    creditsModalContainer.addEventListener("click", (e) => {
      if (e.target === creditsModalContainer) {
        hideCredits();
      }
    });
  }

  if (guideToggleBtn) {
    guideToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (creditsModalContainer) hideCredits();
      showGuide();
    });
  }

  if (guideCloseBtn) {
    guideCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideGuide();
    });
  }

  if (guideStartBtn) {
    guideStartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideGuide();
    });
  }

  if (guideModalContainer) {
    guideModalContainer.addEventListener("click", (e) => {
      if (e.target === guideModalContainer) {
        hideGuide();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    const isInputActive =
      document.activeElement &&
      (document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        document.activeElement.isContentEditable);

    if (e.key === "Escape") {
      if (
        creditsModalContainer &&
        !creditsModalContainer.classList.contains("hidden") &&
        creditsModalContainer.style.display !== "none"
      ) {
        hideCredits();
      } else if (
        guideModalContainer &&
        !guideModalContainer.classList.contains("hidden") &&
        guideModalContainer.style.display !== "none"
      ) {
        hideGuide();
      }
    } else if (
      (e.key === "h" || e.key === "H" || e.key === "?") &&
      !isInputActive &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      if (
        guideModalContainer &&
        !guideModalContainer.classList.contains("hidden") &&
        guideModalContainer.style.display !== "none"
      ) {
        hideGuide();
      } else {
        showGuide();
      }
    }
  });

  // Check if dismissed previously
  let isDismissed = false;
  try {
    isDismissed = localStorage.getItem("solar_guide_v2_dismissed") === "true";
  } catch {
    isDismissed = false;
  }

  function handleGestureRecognized(gestureName) {
    if (!gestureName || !guideModalContainer) return;
    const chip = guideModalContainer.querySelector(
      `.gesture-practice-chip[data-gesture="${gestureName}"]`,
    );
    if (chip) {
      chip.classList.add("recognized");
    }
  }

  if (typeof window !== "undefined") {
    window.__onGestureRecognized = handleGestureRecognized;
    window.__showCredits = showCredits;
    window.__hideCredits = hideCredits;
    window.__showGuide = showGuide;
    window.__hideGuide = hideGuide;
  }

  return {
    showGuide,
    hideGuide,
    showCredits,
    hideCredits,
    handleGestureRecognized,
    isDismissed: () => isDismissed,
  };
}
