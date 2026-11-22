// ==============================================================================
// AZIMJON KAMILJANOV • 3D SOLAR DEVELOPER PORTFOLIO (VITE MODULAR CORE)
// ==============================================================================

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";

import * as THREE from "three";
import gsap from "gsap";

import { initErrorTracking } from "./errors.js";
import { initScene } from "./scene/setup.js";
import { initPostprocessing } from "./scene/postprocessing.js";
import { initControls, resetToOverview } from "./input/controls.js";
import { initRaycaster } from "./input/raycaster.js";
import { initGestureControl } from "./input/gestures.js";

import { initSun } from "./bodies/sun.js";
import { initPlanets } from "./bodies/planets.js";
import { initAsteroidBelt } from "./bodies/asteroids.js";
import { initStars } from "./bodies/stars.js";
import { initCosmicBodies } from "./bodies/cosmic.js";

import {
  initSoundscape,
  playUiClick,
  playUiHover,
  toggleAudioMute,
} from "./audio/soundscape.js";

import { initHud } from "./ui/hud.js";
import { initModals } from "./ui/modals.js";
import { initCatalog } from "./ui/catalog.js";
import { initTour } from "./ui/tour.js";
import { initGuide } from "./ui/guide.js";
import { initTerminal } from "./ui/terminal.js";
import { initSpotlightCards } from "./ui/effects.js";
import { initGestureSettingsPanel } from "./ui/gestureSettingsPanel.js";

import {
  initLanguageSwitcher,
  getTranslations,
  onLanguageChange,
} from "./i18n/i18n.js";

// Initialize error tracking early
initErrorTracking();

// 1. Setup Scene, Camera, Renderer
const { scene, camera, renderer, skydomeMesh } = initScene();
const { composer, bloomPass } = initPostprocessing(renderer, scene, camera);
const controls = initControls(camera, renderer);

// Global interactable objects array for raycasting and UI
const interactableObjects = [];

// LoadingManager for real monotonic loading progress
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

let maxProgress = 15;
const phaseLabels = [
  "INITIALIZING DEEP SPACE CORE...",
  "DOWNLOADING HIGH-RES PLANETARY MAPS...",
  "COMPILING GLSL SHADERS & CORONA...",
  "INITIALIZING ASTEROID BELT...",
  "CALIBRATING STELLAR CATALOG...",
  "PREPARING SOLAR SYSTEM OVERVIEW...",
];
let currentPhaseIdx = 0;

loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  const calculated = Math.round((itemsLoaded / itemsTotal) * 95);
  if (calculated > maxProgress) {
    maxProgress = calculated;
    updatePreloaderProgress(maxProgress);
  }
  const phaseIdx = Math.min(
    phaseLabels.length - 1,
    Math.floor((maxProgress / 100) * phaseLabels.length),
  );
  if (phaseIdx > currentPhaseIdx) {
    currentPhaseIdx = phaseIdx;
    const subEl = document.getElementById("preloader-sub");
    if (subEl) subEl.innerText = phaseLabels[currentPhaseIdx];
  }
};

let skipTimeout = null;

loadingManager.onLoad = () => {
  if (skipTimeout) clearTimeout(skipTimeout);
  updatePreloaderProgress(100);
  const subEl = document.getElementById("preloader-sub");
  if (subEl) subEl.innerText = "READY // COMMENCING DIVE";
  setTimeout(() => {
    finishLoading();
    startInitialDive();
  }, 350);
};

// Fallback skip button appears after 6 seconds
skipTimeout = setTimeout(() => {
  const skipBtn = document.getElementById("preloader-skip-btn");
  if (skipBtn && !hasFinishedLoading) {
    skipBtn.classList.remove("hidden");
    skipBtn.onclick = () => {
      finishLoading();
      startInitialDive();
    };
  }
}, 6000);

// 2. Setup Celestial Bodies
const { sun, update: updateSun } = initSun(
  scene,
  textureLoader,
  interactableObjects,
);
const {
  planetMeshes,
  moonMesh,
  update: updatePlanets,
} = initPlanets(scene, textureLoader, interactableObjects);
const { update: updateAsteroids } = initAsteroidBelt(scene);
const { starMeshes, update: updateStars } = initStars(
  scene,
  interactableObjects,
);
const {
  voyagerGroup,
  blackHoleGroup,
  update: updateCosmic,
} = initCosmicBodies(scene, interactableObjects);

// 3. UI Modules Initialization
initTerminal();

const modals = initModals({
  onReturnToOrbit: () => {
    resetToOverview(camera, controls, () => {
      raycasterController.clearTarget();
      updateNavActiveState(null);
    });
  },
});

function focusTargetById(targetId) {
  let target = null;
  if (targetId === "sun") target = sun;
  else if (targetId === "moon") target = moonMesh;
  else if (targetId === "Voyager")
    target = voyagerGroup?.children[0] || voyagerGroup;
  else if (targetId === "BlackHole")
    target = blackHoleGroup?.children[0] || blackHoleGroup;
  else {
    const pObj = planetMeshes.find((p) => p.mesh.userData?.id === targetId);
    if (pObj) {
      target = pObj.mesh;
    } else {
      const sObj = starMeshes.find((s) => s.userData?.id === targetId);
      if (sObj) target = sObj;
    }
  }

  if (target) {
    raycasterController.focusOnObject(target);
    updateNavActiveStateForObject(target);
  }
}

const catalog = initCatalog({
  onSelectTarget: (targetId) => {
    focusTargetById(targetId);
  },
});

const tour = initTour({
  onFocusObject: (object, isTour) => {
    raycasterController.focusOnObject(object, isTour);
    updateNavActiveStateForObject(object);
  },
  onShowDetails: (object) => {
    modals.openInfoModal(object.userData);
  },
  getObjectById: (id) => {
    if (id === "sun") return sun;
    if (id === "moon") return moonMesh;
    const pObj = planetMeshes.find((p) => p.mesh.userData?.id === id);
    return pObj ? pObj.mesh : null;
  },
  getTranslations: () => getTranslations(),
});

const guide = initGuide();
initGestureSettingsPanel();

// 4. Raycaster Setup
const raycasterController = initRaycaster(
  camera,
  controls,
  interactableObjects,
  (selectedObject) => {
    modals.openInfoModal(selectedObject.userData);
    updateNavActiveStateForObject(selectedObject);
  },
  (_hoveredObject) => {
    // Hover state handled inside raycaster
  },
);

// 5. Soundscape Setup
initSoundscape();

// 6. HUD and Controls Setup
let currentOrbitSpeed = 1;
initHud(
  (speed) => {
    currentOrbitSpeed = speed;
  },
  () => {
    if (tour.isActive()) tour.exitTour();
    modals.closeInfoModal();
    catalog.closeCatalog();
    resetToOverview(camera, controls, () => {
      raycasterController.clearTarget();
      updateNavActiveState(null);
    });
  },
  () => {
    const muted = toggleAudioMute();
    const audioText = document.getElementById("audio-toggle-text");
    const audioBtn = document.getElementById("audio-toggle-btn");
    const uiTexts = getTranslations().ui;
    if (audioText)
      audioText.innerText = muted ? uiTexts.audioOff : uiTexts.audioOn;
    if (audioBtn) audioBtn.classList.toggle("audio-muted", muted);
  },
  () => {
    if (tour.isActive()) tour.exitTour();
    modals.closeInfoModal();
    catalog.openCatalog();
  },
  () => {
    if (tour.isActive()) tour.exitTour();
    else tour.startTour();
  },
);

// 7. Hand Gesture AI Vision Control
let isTimeFrozen = false;
let savedOrbitSpeed = 1;

initGestureControl({
  onOrbit: (deltaX, deltaY) => {
    const rotSpeed = 0.005;
    controls.object.position.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -deltaX * rotSpeed,
    );
    if (Math.abs(deltaY) > 0.001) {
      controls.object.position.y += deltaY * 0.15;
    }
    controls.update();
  },
  onZoom: (delta) => {
    const zoomSpeed = 0.5;
    camera.position.addScaledVector(
      camera.getWorldDirection(new THREE.Vector3()),
      delta * zoomSpeed,
    );
    controls.update();
  },
  onSelect: (target) => {
    if (target && target.userData && target.userData.title) {
      raycasterController.focusOnObject(target);
      modals.openInfoModal(target.userData);
      updateNavActiveStateForObject(target);
    }
  },
  getReticleTarget: (normX, normY) => {
    return raycasterController.raycastAt(normX, normY);
  },
  onOverview: () => {
    if (tour.isActive()) tour.exitTour();
    modals.closeInfoModal();
    catalog.closeCatalog();
    resetToOverview(camera, controls, () => {
      raycasterController.clearTarget();
      updateNavActiveState(null);
    });
  },
  onFreezeToggle: () => {
    isTimeFrozen = !isTimeFrozen;
    if (isTimeFrozen) {
      savedOrbitSpeed = currentOrbitSpeed;
      currentOrbitSpeed = 0;
    } else {
      currentOrbitSpeed = savedOrbitSpeed || 1;
    }
  },
  onTourToggle: () => {
    if (tour.isActive()) tour.exitTour();
    else tour.startTour();
  },
  onSwipe: (dir) => navigatePlanetSwipe(dir),
  onVerticalSwipe: (dir) => {
    if (dir === "up") {
      const zoomDir = camera.getWorldDirection(new THREE.Vector3());
      camera.position.addScaledVector(zoomDir, 35);
      controls.update();
    } else {
      if (tour.isActive()) tour.exitTour();
      modals.closeInfoModal();
      catalog.closeCatalog();
      resetToOverview(camera, controls, () => {
        raycasterController.clearTarget();
        updateNavActiveState(null);
      });
    }
  },
  onSpeedBoostToggle: () => {
    if (currentOrbitSpeed > 1.8) {
      currentOrbitSpeed = 1.0;
    } else {
      currentOrbitSpeed = 3.5;
    }
  },
  onCatalogToggle: () => {
    if (catalog.isOpen()) {
      catalog.closeCatalog();
    } else {
      catalog.openCatalog();
    }
  },
  onContactToggle: () => {
    if (moonMesh) {
      raycasterController.focusOnObject(moonMesh);
      modals.openInfoModal(moonMesh.userData);
      updateNavActiveStateForObject(moonMesh);
    }
  },
  onScaleToggle: () => {
    if (
      typeof window !== "undefined" &&
      typeof window.__toggleTrueScale === "function"
    ) {
      window.__toggleTrueScale();
    }
  },

  // Thumbs down dismisses whatever is on top. Everything a visitor can open by
  // hand now closes by hand too; previously the only way out of a modal was a
  // mouse or the Escape key, which defeated the point of hand control.
  onBack: () => {
    if (guide.isVisible?.()) {
      guide.hideGuide();
      return;
    }
    if (catalog.isOpen()) {
      catalog.closeCatalog();
      return;
    }
    if (modals.isOpen()) {
      modals.closeInfoModal();
      return;
    }
    if (tour.isActive()) {
      tour.exitTour();
      return;
    }
    // Nothing is layered over the scene, so "back" means back to the system.
    resetToOverview(camera, controls, () => {
      raycasterController.clearTarget();
      updateNavActiveState(null);
    });
  },

  // Scrolls the topmost scrollable panel, so long lists are reachable without
  // touching the mouse.
  onScroll: (deltaY) => {
    const scrollable = getActiveScrollContainer();
    if (scrollable) scrollable.scrollTop += deltaY;
  },

  // Two-hand roll orbits the camera horizontally; the gesture layer has
  // already unwrapped the angle, so this is a plain delta.
  onRoll: (deltaAngle) => {
    controls.object.position.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      deltaAngle,
    );
    controls.update();
  },
});

/**
 * The scroll container currently under the visitor's attention, chosen by the
 * same precedence as onBack so the two gestures never disagree about which
 * panel is "on top".
 */
function getActiveScrollContainer() {
  const candidates = [
    catalog.isOpen() ? document.getElementById("catalog-modal") : null,
    modals.isOpen() ? document.getElementById("info-panel") : null,
    guide.isVisible?.()
      ? document.getElementById("guide-modal-container")
      : null,
  ];

  for (const el of candidates) {
    if (el && el.scrollHeight > el.clientHeight + 4) return el;
  }
  return null;
}

function navigatePlanetSwipe(dir) {
  const planetIds = [
    "Mercury",
    "Venus",
    "Earth",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
  ];
  const currentId = raycasterController.getCurrentTarget()?.userData?.id;
  let idx = planetIds.indexOf(currentId);
  if (idx === -1) idx = 0;
  if (dir === "right") {
    idx = (idx + 1) % planetIds.length;
  } else {
    idx = (idx - 1 + planetIds.length) % planetIds.length;
  }
  focusTargetById(planetIds[idx]);
}

// Touch swipe fallback on canvas for touchscreen devices without webcam
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const canvasContainer = document.getElementById("canvas-container");
if (canvasContainer) {
  canvasContainer.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    },
    { passive: true },
  );
  canvasContainer.addEventListener(
    "touchend",
    (e) => {
      if (e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 40 && dt < 450) {
          navigatePlanetSwipe(dx > 0 ? "right" : "left");
        }
      }
    },
    { passive: true },
  );
}

// 8. Navigation Active State
function updateNavActiveState(activeBtn) {
  document.querySelectorAll("#nav-container .nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn === activeBtn);
  });
}

function updateNavActiveStateForObject(object) {
  if (!object || !object.userData) return;
  const id = object.userData.id;
  let selector = `.nav-btn[data-target="${id}"]`;
  if (object.userData.isSun) selector = '.nav-btn[data-target="sun"]';
  else if (object.userData.isMoon) selector = '.nav-btn[data-target="moon"]';
  else if (object.userData.isStar) selector = '.nav-btn[data-target="star"]';
  else if (object.userData.isProbe)
    selector = '.nav-btn[data-target="Voyager"]';
  else if (object.userData.isBlackHole)
    selector = '.nav-btn[data-target="BlackHole"]';

  const btn = document.querySelector(selector);
  if (btn) updateNavActiveState(btn);
}

// Bottom nav bar button listeners
document.querySelectorAll("#nav-container .nav-btn").forEach((btn) => {
  btn.addEventListener("mouseenter", () => playUiHover());
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    playUiClick();
    const targetId = btn.getAttribute("data-target");
    focusTargetById(targetId);
  });
});

// Sound listeners for general interactive elements
document
  .querySelectorAll(".header-link, .lang-btn, .close-btn, #back-button")
  .forEach((el) => {
    el.addEventListener("mouseenter", () => playUiHover());
  });

// 9. Preloader and Initial Dive
const preloaderEl = document.getElementById("preloader");
const preloaderBar = document.getElementById("preloader-bar");
const preloaderPct = document.getElementById("preloader-pct");
const controlHintsEl = document.getElementById("control-hints");

function updatePreloaderProgress(pct) {
  if (preloaderBar) preloaderBar.style.width = `${Math.min(pct, 100)}%`;
  if (preloaderPct)
    preloaderPct.innerText = `${Math.round(Math.min(pct, 100))}%`;
}

function dismissControlHints() {
  if (controlHintsEl && !controlHintsEl.classList.contains("hint-hidden")) {
    controlHintsEl.classList.add("hint-hidden");
  }
}

let hasFinishedLoading = false;
function finishLoading() {
  if (hasFinishedLoading) return;
  hasFinishedLoading = true;
  updatePreloaderProgress(100);

  if (preloaderEl) {
    preloaderEl.classList.add("preloader-hidden");
    setTimeout(() => {
      if (preloaderEl.parentNode) preloaderEl.style.display = "none";
    }, 850);
  }

  if (controlHintsEl) {
    controlHintsEl.classList.remove("hint-hidden");
    setTimeout(dismissControlHints, 4500);
  }

  if (!guide.isDismissed()) {
    setTimeout(() => {
      if (window.__guideInteracted) return;
      guide.showGuide();
    }, 1200);
  }
}

function startInitialDive() {
  const isMobile = window.innerWidth < 768;
  const finalPos = isMobile
    ? { x: 0, y: 225, z: 235 }
    : { x: 0, y: 165, z: 195 };

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    camera.position.set(finalPos.x, finalPos.y, finalPos.z);
    controls.update();
    return;
  }

  gsap.to(camera.position, {
    x: finalPos.x,
    y: finalPos.y,
    z: finalPos.z,
    duration: 2.4,
    ease: "power2.out",
    onUpdate: () => {
      controls.update();
    },
  });
}

// 10. Window Event Handlers
function onWindowResize() {
  const isMobile = window.innerWidth <= 768;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  // The pixel ratio comes from the budget in src/scene/pixelBudget.js, and
  // is re-derived here because both the viewport and the display's own ratio
  // change when a phone rotates or a window moves between monitors.
  //
  // This must run *after* setSize: three.js recomputes the drawing buffer
  // from the stored size, so calling it the other way round lets setSize
  // reinstate the previous ratio. This function used to carry its own copy
  // of the old width-based rule, which silently overrode the budget — a
  // 1600x857 viewport at DPR 2 went back to 3200x1714 (5.5 MP) the first
  // time the window resized.
  renderer.recomputePixelRatio();

  composer.setSize(window.innerWidth, window.innerHeight);
  if (bloomPass) {
    const bloomRes = isMobile
      ? new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)
      : new THREE.Vector2(window.innerWidth, window.innerHeight);
    bloomPass.setSize(bloomRes.x, bloomRes.y);
  }
}
let resizeRafId = null;
function handleThrottledResize() {
  if (resizeRafId) return;
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null;
    onWindowResize();
  });
}
window.addEventListener("resize", handleThrottledResize);

// WebGL context loss handling
renderer.domElement.addEventListener(
  "webglcontextlost",
  (e) => {
    e.preventDefault();
    console.warn("WebGL context lost. Pausing rendering.");
  },
  false,
);

renderer.domElement.addEventListener(
  "webglcontextrestored",
  () => {
    console.warn("WebGL context restored. Re-initializing renderer.");
    onWindowResize();
  },
  false,
);

// 11. Multi-language setup & callbacks
initLanguageSwitcher();
onLanguageChange((lang) => {
  catalog.setLanguage(lang);
  tour.updateHud();
});

// Spotlight cards
initSpotlightCards();

// 12. Main Animation Loop with visibility pause
let isPageVisible = true;
document.addEventListener("visibilitychange", () => {
  isPageVisible = !document.hidden;
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  if (!isPageVisible) return;

  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsedTime = clock.getElapsedTime();

  controls.update();

  // Update Celestial Bodies
  updateSun(elapsedTime, camera);
  updatePlanets(elapsedTime, delta, currentOrbitSpeed);
  updateAsteroids(elapsedTime, delta, currentOrbitSpeed);
  updateStars(elapsedTime, delta);
  updateCosmic(elapsedTime, delta, camera);

  // Update skydome
  if (skydomeMesh && skydomeMesh.material.uniforms?.uTime) {
    skydomeMesh.material.uniforms.uTime.value = elapsedTime;
  }

  composer.render();
}

// Start rendering
animate();

// Initial progress
updatePreloaderProgress(15);

function disposeSolarEngine() {
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      }
    });
  }
  if (composer && typeof composer.dispose === "function") {
    composer.dispose();
  }
  if (renderer) {
    renderer.dispose();
  }
  window.removeEventListener("resize", handleThrottledResize);
}

// Global debug handles
window.__solarEngine = {
  camera,
  scene,
  renderer,
  composer,
  controls,
  focusTargetById,
  resetToOverview: () => resetToOverview(camera, controls),
  catalog,
  modals,
  dispose: disposeSolarEngine,
};
