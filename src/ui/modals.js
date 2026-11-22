import { playUiOpen, playUiClose } from "../audio/soundscape.js";
import { renderMoonTerminal } from "./terminal.js";

let activeTrapCleanup = null;

function trapFocus(modalElement) {
  if (activeTrapCleanup) {
    activeTrapCleanup();
    activeTrapCleanup = null;
  }

  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    'input[type="text"]:not([disabled])',
    'input[type="email"]:not([disabled])',
    'input[type="tel"]:not([disabled])',
    'input[type="checkbox"]:not([disabled])',
    "select:not([disabled])",
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
    } else if (document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }

  modalElement.addEventListener("keydown", handleKeyDown);

  // Initial focus
  setTimeout(() => {
    const focusables = getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      modalElement.focus();
    }
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

export function initModals({ onReturnToOrbit }) {
  const infoPanel = document.getElementById("info-panel");
  const modalClose = document.getElementById("modal-close");
  const backBtn = document.getElementById("back-button");
  const sunResumeBtn = document.getElementById("sun-resume-btn");
  const infoActionBtn = document.getElementById("info-action-btn");
  const infoGithubBtn = document.getElementById("info-github-btn");
  const moonTerminal = document.getElementById("moon-terminal-container");

  const infoBadge = document.getElementById("info-badge");
  const infoTitle = document.getElementById("info-title");
  const infoSubtitle = document.getElementById("info-subtitle");
  const infoContent = document.getElementById("info-content");
  const infoTags = document.getElementById("info-tags");

  let currentOpenObject = null;

  function setAriaHiddenOnBackground(hidden) {
    const mainLandmarks = [
      "#canvas-container",
      "#dock",
      "#cosmic-telemetry-island",
      "#accessible-fallback",
    ];
    mainLandmarks.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        if (hidden) el.setAttribute("aria-hidden", "true");
        else el.removeAttribute("aria-hidden");
      }
    });
  }

  function openInfoModal(objData) {
    if (!infoPanel) return;
    currentOpenObject = objData;
    playUiOpen();

    if (infoBadge)
      infoBadge.textContent = objData.badge || "TIZIM TELEMETRIYASI";
    if (infoTitle)
      infoTitle.textContent =
        objData.title || objData.name || "Noma'lum Obyekt";
    if (infoSubtitle)
      infoSubtitle.textContent = objData.subtitle || objData.role || "";

    if (infoContent) {
      // Render multi-line content cleanly
      const text = objData.content || objData.desc || "";
      infoContent.innerHTML = text
        .split("\n\n")
        .map(
          (para) =>
            `<p class="info-content-para">${para.replace(/\n/g, "<br>")}</p>`,
        )
        .join("");
    }

    // Tags
    if (infoTags) {
      infoTags.innerHTML = "";
      const tags = objData.tags || [];
      tags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = tag.startsWith("#") ? tag : `#${tag}`;
        infoTags.appendChild(span);
      });
    }

    // Sun specific resume button
    if (sunResumeBtn) {
      if (objData.isSun) {
        sunResumeBtn.style.display = "inline-flex";
      } else {
        sunResumeBtn.style.display = "none";
      }
    }

    // Action links
    if (infoActionBtn) {
      if (objData.actionUrl) {
        infoActionBtn.href = objData.actionUrl;
        infoActionBtn.style.display = "inline-flex";
        const actionText = document.getElementById("info-action-text");
        if (actionText)
          actionText.textContent = objData.actionText || "Batafsil / Aloqa";
      } else {
        infoActionBtn.style.display = "none";
      }
    }

    if (infoGithubBtn) {
      if (objData.githubUrl) {
        infoGithubBtn.href = objData.githubUrl;
        infoGithubBtn.style.display = "inline-flex";
        const githubText = document.getElementById("info-github-text");
        if (githubText)
          githubText.textContent = objData.githubText || "GitHub Repo";
      } else {
        infoGithubBtn.style.display = "none";
      }
    }

    // Moon Terminal mount
    if (moonTerminal) {
      if (
        objData.id === "moon" ||
        objData.isMoon ||
        objData.name === "Moon" ||
        objData.name === "Oy"
      ) {
        renderMoonTerminal(document.documentElement.lang || "uz");
        moonTerminal.classList.remove("hidden");
        moonTerminal.style.display = "block";
      } else {
        moonTerminal.classList.add("hidden");
        moonTerminal.style.display = "none";
      }
    }

    infoPanel.classList.remove("hidden");
    infoPanel.setAttribute("role", "dialog");
    infoPanel.setAttribute("aria-modal", "true");
    infoPanel.setAttribute("aria-labelledby", "info-title");
    setAriaHiddenOnBackground(true);

    trapFocus(infoPanel);
  }

  function closeInfoModal() {
    if (!infoPanel || infoPanel.classList.contains("hidden")) return;
    playUiClose();
    infoPanel.classList.add("hidden");
    setAriaHiddenOnBackground(false);

    if (activeTrapCleanup) {
      activeTrapCleanup();
      activeTrapCleanup = null;
    }

    if (typeof onReturnToOrbit === "function") {
      onReturnToOrbit();
    }
    currentOpenObject = null;
  }

  if (modalClose) {
    modalClose.addEventListener("click", (e) => {
      e.stopPropagation();
      closeInfoModal();
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeInfoModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (infoPanel && !infoPanel.classList.contains("hidden")) {
        closeInfoModal();
      }
    }
  });

  return {
    openInfoModal,
    closeInfoModal,
    getCurrentObject: () => currentOpenObject,
    isOpen: () => infoPanel && !infoPanel.classList.contains("hidden"),
  };
}
