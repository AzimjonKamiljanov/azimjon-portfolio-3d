import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";

let activeCameraTween = null;
let initialDiveTween = null;
let isAnimating = false;

export function initControls(camera, renderer) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.8;
  controls.maxDistance = 550;
  controls.minDistance = 12;
  controls.enablePan = false;
  controls.target.set(0, 0, 0);

  return controls;
}

export function animateCamera(
  camera,
  controls,
  finalCamPos,
  targetWorldPos,
  onCompleteCallback,
) {
  if (initialDiveTween) {
    initialDiveTween.kill();
    initialDiveTween = null;
  }
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  if (activeCameraTween) {
    activeCameraTween.kill();
    activeCameraTween = null;
  }

  isAnimating = true;
  const startCam = camera.position.clone();
  const startTarget = controls.target.clone();

  // Elevated midpoint arc to avoid sun/planetary collision
  const midCam = startCam.clone().add(finalCamPos).multiplyScalar(0.5);
  midCam.y += Math.max(25, startCam.distanceTo(finalCamPos) * 0.22);

  const animObj = { t: 0 };

  activeCameraTween = gsap.to(animObj, {
    t: 1,
    duration: 1.4,
    ease: "power2.inOut",
    onUpdate: () => {
      const t = animObj.t;
      const u = 1 - t;
      camera.position.x =
        u * u * startCam.x + 2 * u * t * midCam.x + t * t * finalCamPos.x;
      camera.position.y =
        u * u * startCam.y + 2 * u * t * midCam.y + t * t * finalCamPos.y;
      camera.position.z =
        u * u * startCam.z + 2 * u * t * midCam.z + t * t * finalCamPos.z;

      controls.target.lerpVectors(startTarget, targetWorldPos, t);
      controls.update();
    },
    onComplete: () => {
      isAnimating = false;
      activeCameraTween = null;
      if (typeof onCompleteCallback === "function") {
        onCompleteCallback();
      }
    },
  });

  return activeCameraTween;
}

export function resetToOverview(camera, controls, onComplete) {
  const defaultPos = { x: 0, y: 165, z: 195 };
  const defaultTarget = { x: 0, y: 0, z: 0 };
  animateCamera(camera, controls, defaultPos, defaultTarget, onComplete);
}
