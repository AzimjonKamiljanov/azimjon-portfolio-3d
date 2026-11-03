import * as THREE from "three";
import projectsData from "../data/projects.json";

function createAstronomicalStarTexture(colorStr) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const cx = 128,
    cy = 128;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 115);
  grad.addColorStop(0.0, "#ffffff");
  grad.addColorStop(0.06, "#ffffff");
  grad.addColorStop(0.18, colorStr);
  grad.addColorStop(0.38, colorStr);
  grad.addColorStop(0.65, "rgba(0, 0, 0, 0)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const spikeLen = 115;

  // Horizontal spike
  const hGrad = ctx.createLinearGradient(cx - spikeLen, cy, cx + spikeLen, cy);
  hGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
  hGrad.addColorStop(0.35, colorStr);
  hGrad.addColorStop(0.5, "#ffffff");
  hGrad.addColorStop(0.65, colorStr);
  hGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = hGrad;
  ctx.beginPath();
  ctx.moveTo(cx - spikeLen, cy);
  ctx.lineTo(cx, cy - 3.2);
  ctx.lineTo(cx + spikeLen, cy);
  ctx.lineTo(cx, cy + 3.2);
  ctx.closePath();
  ctx.fill();

  // Vertical spike
  const vGrad = ctx.createLinearGradient(cx, cy - spikeLen, cx, cy + spikeLen);
  vGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
  vGrad.addColorStop(0.35, colorStr);
  vGrad.addColorStop(0.5, "#ffffff");
  vGrad.addColorStop(0.65, colorStr);
  vGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = vGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - spikeLen);
  ctx.lineTo(cx + 3.2, cy);
  ctx.lineTo(cx, cy + spikeLen);
  ctx.lineTo(cx - 3.2, cy);
  ctx.closePath();
  ctx.fill();

  const dLen = 42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  const dGrad = ctx.createLinearGradient(-dLen, 0, dLen, 0);
  dGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
  dGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
  dGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = dGrad;
  ctx.beginPath();
  ctx.moveTo(-dLen, 0);
  ctx.lineTo(0, -1.5);
  ctx.lineTo(dLen, 0);
  ctx.lineTo(0, 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -dLen);
  ctx.lineTo(1.5, 0);
  ctx.lineTo(0, dLen);
  ctx.lineTo(-1.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function initStars(scene, interactableObjects) {
  const starsConfig = [
    {
      id: "star_legion_power",
      pos: new THREE.Vector3(155, 46, 115),
      colorHex: 0xa0c8ff,
      colorStr: "#a0c8ff",
    },
    {
      id: "star_titan_cyber",
      pos: new THREE.Vector3(-165, 52, 110),
      colorHex: 0xffffff,
      colorStr: "#ffffff",
    },
    {
      id: "star_graphify",
      pos: new THREE.Vector3(-145, -42, -140),
      colorHex: 0x9ae4ff,
      colorStr: "#9ae4ff",
    },
    {
      id: "star_newapi",
      pos: new THREE.Vector3(-120, -55, 155),
      colorHex: 0xfff1d6,
      colorStr: "#fff1d6",
    },
    {
      id: "star_agentzero",
      pos: new THREE.Vector3(115, 60, -155),
      colorHex: 0xffd580,
      colorStr: "#ffd580",
    },
    {
      id: "star_aider_nv",
      pos: new THREE.Vector3(175, -38, -95),
      colorHex: 0xffe2b8,
      colorStr: "#ffe2b8",
    },
    {
      id: "star_openshell",
      pos: new THREE.Vector3(-135, 65, -125),
      colorHex: 0x8ce8ff,
      colorStr: "#8ce8ff",
    },
    {
      id: "star_btech",
      pos: new THREE.Vector3(160, -48, 120),
      colorHex: 0xa8d5ff,
      colorStr: "#a8d5ff",
    },
    {
      id: "star_gsd",
      pos: new THREE.Vector3(-180, 32, -90),
      colorHex: 0xffc48c,
      colorStr: "#ffc48c",
    },
    {
      id: "star_claudemem",
      pos: new THREE.Vector3(130, -62, -145),
      colorHex: 0x98dcff,
      colorStr: "#98dcff",
    },
    {
      id: "star_headroom",
      pos: new THREE.Vector3(-155, -35, 140),
      colorHex: 0xffe8c2,
      colorStr: "#ffe8c2",
    },
    {
      id: "star_ralph",
      pos: new THREE.Vector3(140, 58, 135),
      colorHex: 0xffb87a,
      colorStr: "#ffb87a",
    },
    {
      id: "star_deepseek_harness",
      pos: new THREE.Vector3(-125, 48, 165),
      colorHex: 0xffffff,
      colorStr: "#ffffff",
    },
    {
      id: "star_titan_osint",
      pos: new THREE.Vector3(170, 35, -130),
      colorHex: 0x9ae4ff,
      colorStr: "#9ae4ff",
    },
    {
      id: "star_sentinel_shield",
      pos: new THREE.Vector3(-170, -50, -85),
      colorHex: 0xa0c8ff,
      colorStr: "#a0c8ff",
    },
    {
      id: "star_solar_portfolio",
      pos: new THREE.Vector3(125, -55, 150),
      colorHex: 0xffd580,
      colorStr: "#ffd580",
    },
    {
      id: "star_school21",
      pos: new THREE.Vector3(-160, 42, -150),
      colorHex: 0x8ce8ff,
      colorStr: "#8ce8ff",
    },
    {
      id: "star_task_observer",
      pos: new THREE.Vector3(150, -32, -160),
      colorHex: 0xa8d5ff,
      colorStr: "#a8d5ff",
    },
  ];

  const starMeshes = [];

  starsConfig.forEach((cfg) => {
    const meta = projectsData.find((p) => p.id === cfg.id) || {};
    const uzMeta = meta.uz || {};

    const starGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.copy(cfg.pos);
    scene.add(starMesh);

    // Holographic diffraction spike glow sprite
    const spriteTex = createAstronomicalStarTexture(cfg.colorStr);
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(16, 16, 1);
    starMesh.add(sprite);

    // Orbital line around origin
    const dist = cfg.pos.length();
    const starOrbitCurve = new THREE.EllipseCurve(
      0,
      0,
      dist,
      dist,
      0,
      2 * Math.PI,
      false,
      0,
    );
    const starOrbitPoints = starOrbitCurve.getPoints(128);
    const starOrbitGeo = new THREE.BufferGeometry().setFromPoints(
      starOrbitPoints.map((p) => new THREE.Vector3(p.x, 0, p.y)),
    );
    const starOrbitMat = new THREE.LineBasicMaterial({
      color: cfg.colorHex,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const starOrbitLine = new THREE.LineLoop(starOrbitGeo, starOrbitMat);
    starOrbitLine.rotation.x = Math.PI / 8;
    scene.add(starOrbitLine);

    starMesh.userData = {
      id: cfg.id,
      isStar: true,
      badge: uzMeta.badge || "Kiber Yulduz Tizimi",
      title: uzMeta.title || cfg.id,
      subtitle: uzMeta.subtitle || "",
      content: uzMeta.content || "",
      tags: uzMeta.tags || [],
      actionUrl: meta.link || "https://github.com/AzimjonKamiljanov",
      actionText: meta.linkText || "Repo",
      githubUrl: meta.link || "https://github.com/AzimjonKamiljanov",
      githubText: meta.linkText || "Repo",
      radius: 1.6,
      sprite,
    };

    interactableObjects.push(starMesh);
    starMeshes.push(starMesh);
  });

  // 2. Planck Blackbody Background Starfield (7,500 background stars)
  const BACKGROUND_STAR_COUNT = 7500;
  const bgStarGeo = new THREE.BufferGeometry();
  const bgStarPositions = new Float32Array(BACKGROUND_STAR_COUNT * 3);
  const bgStarColors = new Float32Array(BACKGROUND_STAR_COUNT * 3);

  const colorPalette = [
    new THREE.Color(0x9db4ff),
    new THREE.Color(0xbbccff),
    new THREE.Color(0xf8f9ff),
    new THREE.Color(0xfff4e8),
    new THREE.Color(0xffddb4),
    new THREE.Color(0xffbd6f),
    new THREE.Color(0xff6060),
  ];

  for (let i = 0; i < BACKGROUND_STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2500 + Math.random() * 1500;

    bgStarPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgStarPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgStarPositions[i * 3 + 2] = r * Math.cos(phi);

    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    bgStarColors[i * 3] = col.r;
    bgStarColors[i * 3 + 1] = col.g;
    bgStarColors[i * 3 + 2] = col.b;
  }

  bgStarGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(bgStarPositions, 3),
  );
  bgStarGeo.setAttribute("color", new THREE.BufferAttribute(bgStarColors, 3));

  const bgStarMat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const bgStarfield = new THREE.Points(bgStarGeo, bgStarMat);
  scene.add(bgStarfield);

  function update(time, delta) {
    starMeshes.forEach((s, idx) => {
      const scale = 14 + Math.sin(time * 2.0 + idx) * 2.0;
      if (s.userData.sprite) {
        s.userData.sprite.scale.set(scale, scale, 1);
      }
    });
    bgStarfield.rotation.y += delta * 0.001;
  }

  return { starMeshes, bgStarfield, update };
}
