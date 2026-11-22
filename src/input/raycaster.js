import * as THREE from "three";
import { animateCamera } from "./controls.js";
import { playUiClick } from "../audio/soundscape.js";

export function initRaycaster(
  camera,
  controls,
  interactableObjects,
  onSelectObject,
  onHoverObject,
) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownPos = { x: 0, y: 0, time: 0 };
  let currentTarget = null;

  // Hover state
  let hoveredObject = null;

  function isModalOpen() {
    const infoPanel = document.getElementById("info-panel");
    if (infoPanel && !infoPanel.classList.contains("hidden")) return true;
    const catalogModal = document.getElementById("catalog-modal");
    if (catalogModal && !catalogModal.classList.contains("hidden")) return true;
    const guideModal = document.getElementById("guide-modal");
    if (guideModal && !guideModal.classList.contains("hidden")) return true;
    return false;
  }

  function isUiInteraction(e) {
    if (isModalOpen()) return true;
    if (!e || !e.target) return false;
    const canvasDom = controls?.domElement;
    if (canvasDom && e.target !== canvasDom && !canvasDom.contains(e.target)) {
      return true;
    }
    return false;
  }

  function onPointerDown(e) {
    if (isUiInteraction(e)) return;
    pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
  }

  function onPointerMove(e) {
    if (isUiInteraction(e)) {
      if (hoveredObject) {
        hoveredObject = null;
        document.body.style.cursor = "default";
        if (typeof onHoverObject === "function") onHoverObject(null, e);
      }
      return;
    }

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && (!hit.userData || !hit.userData.title) && hit.parent) {
        hit = hit.parent;
      }
      if (hit && hit !== hoveredObject) {
        hoveredObject = hit;
        document.body.style.cursor = "pointer";
        if (typeof onHoverObject === "function") onHoverObject(hit, e);
      }
    } else if (hoveredObject) {
      hoveredObject = null;
      document.body.style.cursor = "default";
      if (typeof onHoverObject === "function") onHoverObject(null, e);
    }
  }

  function onPointerUp(e) {
    if (isUiInteraction(e)) return;
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    const dt = Date.now() - pointerDownPos.time;

    // If dragged more than 8px or held longer than 350ms, it was an orbit/pan gesture
    if (Math.hypot(dx, dy) > 8 || dt > 350) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      while (
        hitObj &&
        (!hitObj.userData || !hitObj.userData.title) &&
        hitObj.parent
      ) {
        hitObj = hitObj.parent;
      }
      if (hitObj && hitObj.userData && hitObj.userData.title) {
        focusOnObject(hitObj);
      }
    }
  }

  function focusOnObject(object, isTour = false) {
    if (!object || !object.userData || !object.userData.title) return;
    if (!isTour && currentTarget === object) return;
    currentTarget = object;

    playUiClick();

    const targetWorldPos = new THREE.Vector3();
    object.getWorldPosition(targetWorldPos);

    const rad = Number(object.userData.radius) || 1.0;
    let camOffsetDist = 12;
    if (object.userData.isSun) {
      camOffsetDist = 24;
    } else if (object.userData.id === "Saturn") {
      camOffsetDist = Math.max(rad * 4.6, 12);
    } else if (object.userData.isMoon) {
      camOffsetDist = Math.max(rad * 10.0, 5.0);
    } else if (object.userData.isStar) {
      camOffsetDist = 18.0;
    } else if (object.userData.isProbe) {
      camOffsetDist = 8.0;
    } else if (object.userData.isBlackHole) {
      camOffsetDist = 28.0;
    }

    const dir = targetWorldPos.clone().normalize();
    if (dir.lengthSq() === 0) dir.set(0, 0, 1);

    const isMobile = window.innerWidth < 768;
    let finalCamPos;
    const finalTargetPos = targetWorldPos.clone();

    if (object.userData.isSun) {
      finalCamPos = targetWorldPos.clone().add(new THREE.Vector3(0, 4, 22));
    } else {
      const inward = dir.clone().negate();
      const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const camDir = inward
        .clone()
        .multiplyScalar(0.42)
        .add(tangent.clone().multiplyScalar(0.88))
        .normalize();
      finalCamPos = targetWorldPos
        .clone()
        .add(camDir.multiplyScalar(camOffsetDist));
      finalCamPos.y += Math.max(rad * 1.6, 2.4);
    }

    if (!isMobile) {
      const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const sideOffset = camOffsetDist * 0.28;
      finalCamPos.add(tangent.clone().multiplyScalar(sideOffset));
      finalTargetPos.add(tangent.clone().multiplyScalar(sideOffset));
    } else {
      const verticalLift = object.userData.isSun
        ? 4.2
        : Math.max(rad * 1.8, 2.5);
      finalTargetPos.y -= verticalLift * 0.45;
      finalCamPos.y += verticalLift * 0.45;
    }

    animateCamera(camera, controls, finalCamPos, finalTargetPos, () => {
      if (typeof onSelectObject === "function") {
        onSelectObject(object);
      }
    });
  }

  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });

  function raycastAt(normX, normY) {
    const coords = new THREE.Vector2(normX, normY);
    raycaster.setFromCamera(coords, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);
    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && (!hit.userData || !hit.userData.title) && hit.parent) {
        hit = hit.parent;
      }
      if (hit && hit.userData && hit.userData.title) {
        return hit;
      }
    }
    return null;
  }

  return {
    focusOnObject,
    raycastAt,
    getCurrentTarget: () => currentTarget,
    clearTarget: () => {
      currentTarget = null;
    },
  };
}
