let isGestureActive = false;
let gestureStream = null;
let handsInstance = null;
let gestureAnimFrameId = null;
let isProcessingFrame = false;

let smoothedPalmX = null;
let smoothedPalmY = null;
let prevPalmPos = null;

let smoothedReticleX = null;
let smoothedReticleY = null;

let currentGesture = "none";
let isPinchingActive = false;
let pinchDidSelect = false;
let pinchStartY = null;
let gestureHoveredObject = null;
let lastPinchTriggerTime = 0;

function detectHandGesture(lm) {
  if (!lm || lm.length < 21) return { gesture: "none" };

  const d = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const wrist = lm[0];
  const indexMcp = lm[5];

  const isIndexExt = d(lm[8], wrist) > d(lm[6], wrist) * 1.15;
  const isMiddleExt = d(lm[12], wrist) > d(lm[10], wrist) * 1.15;
  const isRingExt = d(lm[16], wrist) > d(lm[14], wrist) * 1.15;
  const isPinkyExt = d(lm[20], wrist) > d(lm[18], wrist) * 1.15;

  const pinchDist = d(lm[4], lm[8]);
  const isPinch = pinchDist < 0.065;
  const isIndexReachingOut = d(lm[8], wrist) >= d(indexMcp, wrist) * 0.95;

  const extCount =
    (isIndexExt ? 1 : 0) +
    (isMiddleExt ? 1 : 0) +
    (isRingExt ? 1 : 0) +
    (isPinkyExt ? 1 : 0);

  if (isPinch && isIndexReachingOut) {
    return { gesture: "pinch", lm, pinchDist };
  }
  if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
    return { gesture: "pointing", lm };
  }
  if (extCount === 0) {
    return { gesture: "fist", lm };
  }
  if (extCount >= 3) {
    return { gesture: "palm", lm };
  }

  return { gesture: "none", lm };
}

function drawGestureCanvas(lm, gestureName) {
  const canvas = document.getElementById("gesture-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const video = document.getElementById("gesture-video");
  if (video && video.readyState >= 2) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(2, 8, 20, 0.52)";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#090a10";
    ctx.fillRect(0, 0, w, h);
  }

  if (!lm) return;

  // Draw landmark joints
  ctx.fillStyle = "#38bdf8";
  for (let i = 0; i < lm.length; i++) {
    const x = (1.0 - lm[i].x) * w;
    const y = lm[i].y * h;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function loadMediaPipeScripts() {
  if (window.Hands) return true;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/mediapipe/hands/hands.js";
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      reject(new Error("MediaPipe script failed to load"));
    };
    document.head.appendChild(script);
  });
}

export async function toggleGestureControl(camera, controls, raycasterUtil) {
  if (isGestureActive) {
    stopGestureControl();
    return false;
  } else {
    // Privacy notice
    const agreed = window.confirm(
      "AI Vision Qo'l Boshqaruvi Maxfiylik Kafolati:\n\n" +
        "Kamera video oqimi 100% qurilmangiz ichida (mahalliy WebAssembly) tahlil qilinadi.\n" +
        "Hech qanday video yoki surat serverga yuborilmaydi va saqlanmaydi.\n\n" +
        "Davom ettirishni xohlaysizmi?",
    );
    if (!agreed) return false;

    const started = await startGestureControl(camera, controls, raycasterUtil);
    return started;
  }
}

export async function startGestureControl(camera, controls, raycasterUtil) {
  const hud = document.getElementById("gesture-hud");
  const video = document.getElementById("gesture-video");

  try {
    await loadMediaPipeScripts();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        "Kameraga ruxsat berilmadi yoki brauzeringiz qo'llab-quvvatlamaydi.",
      );
      return false;
    }

    gestureStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: "user",
      },
      audio: false,
    });

    if (video) {
      video.srcObject = gestureStream;
      await video.play();
    }

    if (window.Hands) {
      handsInstance = new window.Hands({
        locateFile: (file) => `/mediapipe/hands/${file}`,
      });

      handsInstance.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // Lite model for speed
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      handsInstance.onResults((results) => {
        isProcessingFrame = false;
        if (!isGestureActive) return;

        if (
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
        ) {
          const lm = results.multiHandLandmarks[0];
          const detected = detectHandGesture(lm);
          currentGesture = detected.gesture;
          drawGestureCanvas(lm, currentGesture);

          const stateText = document.getElementById("gesture-state-text");
          const stateIcon = document.getElementById("gesture-indicator-icon");

          if (currentGesture === "palm") {
            if (stateIcon) stateIcon.innerText = "🖐";
            if (stateText) stateText.innerText = "Kaft: Orbit Aylanmoqda";
            // Orbit interaction
            const palmX = 1.0 - lm[9].x;
            const palmY = lm[9].y;
            if (prevPalmPos) {
              const dx = (palmX - prevPalmPos.x) * 4.0;
              const dy = (palmY - prevPalmPos.y) * 4.0;
              if (controls) {
                controls.rotateLeft(dx);
                controls.rotateUp(dy);
                controls.update();
              }
            }
            prevPalmPos = { x: palmX, y: palmY };
          } else {
            prevPalmPos = null;
            if (currentGesture === "fist") {
              if (stateIcon) stateIcon.innerText = "✊";
              if (stateText) stateText.innerText = "Musht: To'xtatildi";
            } else if (currentGesture === "pinch") {
              if (stateIcon) stateIcon.innerText = "🤏";
              if (stateText) stateText.innerText = "Chimchilash: Tanlash";
              if (
                !isPinchingActive &&
                Date.now() - lastPinchTriggerTime > 600
              ) {
                isPinchingActive = true;
                lastPinchTriggerTime = Date.now();
                // Trigger raycast select
                if (gestureHoveredObject && raycasterUtil) {
                  raycasterUtil.focusOnObject(gestureHoveredObject);
                }
              }
            } else {
              isPinchingActive = false;
              if (stateIcon) stateIcon.innerText = "👆";
              if (stateText) stateText.innerText = "Ko'rsatkich: Nishon";
            }
          }
        } else {
          drawGestureCanvas(null, "none");
          prevPalmPos = null;
        }
      });
    }

    isGestureActive = true;
    if (hud) {
      hud.classList.remove("hidden");
      hud.style.display = "block";
    }

    async function processFrame() {
      if (!isGestureActive) return;
      if (
        video &&
        video.readyState >= 2 &&
        handsInstance &&
        !isProcessingFrame
      ) {
        isProcessingFrame = true;
        await handsInstance.send({ image: video });
      }
      gestureAnimFrameId = requestAnimationFrame(processFrame);
    }
    gestureAnimFrameId = requestAnimationFrame(processFrame);

    return true;
  } catch (err) {
    console.error("Gesture control initialization error:", err);
    stopGestureControl();
    return false;
  }
}

export function stopGestureControl() {
  isGestureActive = false;
  if (gestureAnimFrameId) {
    cancelAnimationFrame(gestureAnimFrameId);
    gestureAnimFrameId = null;
  }
  if (gestureStream) {
    gestureStream.getTracks().forEach((t) => t.stop());
    gestureStream = null;
  }
  const hud = document.getElementById("gesture-hud");
  if (hud) {
    hud.classList.add("hidden");
    hud.style.display = "none";
  }
  prevPalmPos = null;
}

export function initGestureControl(handlers = {}) {
  const gestureToggleBtn = document.getElementById("gesture-toggle-btn");
  const gestureCloseBtn = document.getElementById("gesture-close-btn");

  if (gestureToggleBtn) {
    gestureToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleGestureControl();
    });
  }

  if (gestureCloseBtn) {
    gestureCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      stopGestureControl();
    });
  }

  return {
    start: startGestureControl,
    stop: stopGestureControl,
    toggle: toggleGestureControl,
    isActive: () => isGestureActive,
  };
}
