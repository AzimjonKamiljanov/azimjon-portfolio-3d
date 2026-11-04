import * as THREE from "three";
import { createAtmosphereGlow } from "../scene/setup.js";
import projectsData from "../data/projects.json";

// Helper for radial ring geometry mapping
function createRadialRingGeometry(
  innerRadius,
  outerRadius,
  thetaSegments = 160,
  phiSegments = 32,
) {
  const geo = new THREE.RingGeometry(
    innerRadius,
    outerRadius,
    thetaSegments,
    phiSegments,
  );
  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    const u = Math.min(
      1.0,
      Math.max(0.0, (r - innerRadius) / (outerRadius - innerRadius)),
    );
    uvs.setXY(i, u, 0.5);
  }
  geo.attributes.uv.needsUpdate = true;
  return geo;
}

function createSaturnRingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.05, "rgba(110, 95, 75, 0.08)");
  grad.addColorStop(0.1, "rgba(145, 128, 100, 0.28)");
  grad.addColorStop(0.18, "rgba(165, 142, 110, 0.42)");
  grad.addColorStop(0.24, "rgba(140, 120, 95, 0.35)");
  grad.addColorStop(0.26, "rgba(30, 25, 20, 0.05)");
  grad.addColorStop(0.27, "rgba(170, 145, 112, 0.50)");
  grad.addColorStop(0.3, "rgba(235, 212, 168, 0.92)");
  grad.addColorStop(0.38, "rgba(245, 225, 182, 0.98)");
  grad.addColorStop(0.46, "rgba(228, 205, 160, 0.90)");
  grad.addColorStop(0.54, "rgba(242, 222, 178, 0.95)");
  grad.addColorStop(0.61, "rgba(220, 195, 150, 0.88)");
  grad.addColorStop(0.625, "rgba(5, 5, 5, 0.02)");
  grad.addColorStop(0.675, "rgba(8, 8, 8, 0.03)");
  grad.addColorStop(0.69, "rgba(215, 195, 160, 0.82)");
  grad.addColorStop(0.77, "rgba(205, 185, 150, 0.78)");
  grad.addColorStop(0.83, "rgba(195, 175, 140, 0.74)");
  grad.addColorStop(0.855, "rgba(10, 8, 6, 0.03)");
  grad.addColorStop(0.865, "rgba(190, 170, 138, 0.70)");
  grad.addColorStop(0.93, "rgba(170, 150, 120, 0.55)");
  grad.addColorStop(0.95, "rgba(10, 8, 6, 0.02)");
  grad.addColorStop(0.965, "rgba(140, 125, 100, 0.35)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, canvas.height);

  for (let x = 0; x < w; x++) {
    const u = x / w;
    if (
      (u > 0.625 && u < 0.675) ||
      (u > 0.852 && u < 0.868) ||
      u < 0.05 ||
      u > 0.97
    )
      continue;
    const microNoise = Math.sin(x * 0.45) * 0.08 + Math.sin(x * 1.4) * 0.04;
    if (microNoise > 0) {
      ctx.fillStyle = `rgba(255, 245, 225, ${microNoise * 0.22})`;
    } else {
      ctx.fillStyle = `rgba(30, 20, 10, ${-microNoise * 0.28})`;
    }
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createUranusRingTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.15, "rgba(120, 210, 225, 0.06)");
  grad.addColorStop(0.35, "rgba(150, 230, 245, 0.35)");
  grad.addColorStop(0.4, "rgba(10, 20, 30, 0.02)");
  grad.addColorStop(0.55, "rgba(160, 235, 250, 0.42)");
  grad.addColorStop(0.7, "rgba(10, 20, 30, 0.02)");
  grad.addColorStop(0.85, "rgba(180, 240, 255, 0.65)");
  grad.addColorStop(0.92, "rgba(190, 245, 255, 0.75)");
  grad.addColorStop(0.95, "rgba(10, 20, 30, 0.02)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function initPlanets(scene, textureLoader, interactableObjects) {
  const planetsConfig = [
    {
      id: "Mercury",
      name: "Merkuriy",
      radius: 0.95,
      distance: 16,
      speed: 0.012,
      texture: "mercury_2048.webp",
      color: 0xb5b2ad,
      tilt: 0.03,
    },
    {
      id: "Venus",
      name: "Venera",
      radius: 1.35,
      distance: 26,
      speed: 0.0085,
      texture: "venus_2048.webp",
      color: 0xe8c892,
      tilt: 177.3,
      hasAtmosphere: true,
      atmosphereColor: 0xfcd34d,
      atmosphereIntensity: 1.1,
    },
    {
      id: "Earth",
      name: "Yer",
      radius: 1.55,
      distance: 38,
      speed: 0.0062,
      texture: "earth_atmos_2048.webp",
      specular: "earth_specular_2048.webp",
      normal: "earth_normal_2048.webp",
      color: 0xffffff,
      tilt: 23.4,
      hasClouds: true,
      hasMoon: true,
      moonDistance: 3.4,
      hasAtmosphere: true,
      atmosphereColor: 0x38bdf8,
      atmosphereIntensity: 1.35,
      hasNightLights: true,
    },
    {
      id: "Mars",
      name: "Mars",
      radius: 1.15,
      distance: 50,
      speed: 0.0048,
      texture: "mars_2048.webp",
      color: 0xdb582a,
      tilt: 25.2,
    },
    {
      id: "Jupiter",
      name: "Yupiter",
      radius: 3.0,
      distance: 68,
      speed: 0.0028,
      texture: "jupiter_2048.webp",
      color: 0xc88b3a,
      tilt: 3.1,
    },
    {
      id: "Saturn",
      name: "Saturn",
      radius: 2.5,
      distance: 88,
      speed: 0.002,
      texture: "saturn_2048.webp",
      color: 0xe2bf7d,
      tilt: 26.7,
      hasRings: true,
    },
    {
      id: "Uranus",
      name: "Uran",
      radius: 1.8,
      distance: 108,
      speed: 0.0014,
      texture: "uranus_2048.webp",
      color: 0x4b70dd,
      tilt: 97.8,
      hasUranusRings: true,
      hasAtmosphere: true,
      atmosphereColor: 0x67e8f9,
      atmosphereIntensity: 0.8,
    },
    {
      id: "Neptune",
      name: "Neptun",
      radius: 1.75,
      distance: 126,
      speed: 0.001,
      texture: "neptune_2048.webp",
      color: 0x274687,
      tilt: 28.3,
      hasAtmosphere: true,
      atmosphereColor: 0x3b82f6,
      atmosphereIntensity: 0.9,
    },
    {
      id: "Pluto",
      name: "Pluton",
      radius: 0.65,
      distance: 142,
      speed: 0.0007,
      texture: "pluto_2048.webp",
      color: 0x968570,
      tilt: 122.5,
    },
  ];

  const planetMeshes = [];
  let earthCloudsMesh = null;
  let moonMesh = null;
  let moonGroup = null;

  planetsConfig.forEach((cfg) => {
    // Find metadata from projects.json
    const meta = projectsData.find((p) => p.id === cfg.id) || {};
    const uzMeta = meta.uz || {};

    // 1. Orbital ring line
    const orbitCurve = new THREE.EllipseCurve(
      0,
      0,
      cfg.distance,
      cfg.distance,
      0,
      2 * Math.PI,
      false,
      0,
    );
    const orbitPoints = orbitCurve.getPoints(128);
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(
      orbitPoints.map((p) => new THREE.Vector3(p.x, 0, p.y)),
    );
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
    scene.add(orbitLine);

    // 2. Planet container group for orbital rotation
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    // 3. Planet sphere geometry & material
    const planetGeo = new THREE.SphereGeometry(cfg.radius, 48, 48);
    const matOptions = {
      roughness: 0.85,
      metalness: 0.15,
    };

    if (cfg.texture) {
      const tex = textureLoader.load(`assets/${cfg.texture}`);
      tex.colorSpace = THREE.SRGBColorSpace;
      matOptions.map = tex;
    }

    if (cfg.normal) {
      matOptions.normalMap = textureLoader.load(`assets/${cfg.normal}`);
    }

    if (cfg.specular) {
      matOptions.metalnessMap = textureLoader.load(`assets/${cfg.specular}`);
    }

    const planetMat = new THREE.MeshStandardMaterial(matOptions);
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = cfg.distance;
    planet.rotation.z = (cfg.tilt * Math.PI) / 180;
    orbitGroup.add(planet);

    // 4. Special cases: Atmosphere, Clouds, Rings, Moon
    if (cfg.hasAtmosphere) {
      const atmoGlow = createAtmosphereGlow(
        cfg.radius,
        cfg.atmosphereColor,
        cfg.atmosphereIntensity,
        1.055,
      );
      planet.add(atmoGlow);
    }

    if (cfg.hasClouds) {
      const cloudsGeo = new THREE.SphereGeometry(cfg.radius * 1.015, 48, 48);
      const cloudsTex = textureLoader.load("assets/earth_clouds_2048.webp");
      cloudsTex.colorSpace = THREE.SRGBColorSpace;
      const cloudsMat = new THREE.MeshStandardMaterial({
        map: cloudsTex,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      earthCloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
      planet.add(earthCloudsMesh);
    }

    if (cfg.hasMoon) {
      moonGroup = new THREE.Group();
      moonGroup.position.set(cfg.distance, 0, 0);
      orbitGroup.add(moonGroup);

      const moonGeo = new THREE.SphereGeometry(0.38, 32, 32);
      const moonTex = textureLoader.load("assets/moon_1024.webp");
      moonTex.colorSpace = THREE.SRGBColorSpace;
      const moonMat = new THREE.MeshStandardMaterial({
        map: moonTex,
        roughness: 0.95,
        metalness: 0.05,
      });
      moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.position.x = cfg.moonDistance;
      moonGroup.add(moonMesh);

      moonMesh.userData = {
        id: "moon",
        isMoon: true,
        badge: "Oy Bazasidagi Sun'iy Intellekt Terminali",
        title: "Moon Direct AI & Telegram Terminal",
        subtitle: "Telegram va AI Kognitiv Serveri Bilan Jonli Muloqot",
        content: `Oy stansiyasidagi avtonom terminal orqali Azimjon Kamiljanovga to'g'ridan-to'g'ri xabar yuborish imkoniyati.
Xabarlar Cloudflare Worker orqali qattiq tekshiruvdan o'tib, Telegram botiga real vaqtda yetkaziladi.`,
        tags: [
          "Direct Terminal",
          "Telegram API",
          "Cloudflare Workers",
          "Instant Connect",
        ],
        actionUrl: "https://t.me/CyberAgentNexus",
        actionText: "Telegram Terminal",
        githubUrl: "https://github.com/AzimjonKamiljanov",
        githubText: "GitHub Profil",
        radius: 0.38,
      };
      interactableObjects.push(moonMesh);
    }

    if (cfg.hasRings) {
      const saturnRingGeo = createRadialRingGeometry(
        cfg.radius * 1.35,
        cfg.radius * 2.8,
        160,
        32,
      );
      const saturnRingTex = createSaturnRingTexture();
      const saturnRingMat = new THREE.MeshStandardMaterial({
        map: saturnRingTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        roughness: 0.65,
        metalness: 0.1,
        depthWrite: true,
      });
      const saturnRing = new THREE.Mesh(saturnRingGeo, saturnRingMat);
      saturnRing.rotation.x = Math.PI / 2;
      planet.add(saturnRing);
    }

    if (cfg.hasUranusRings) {
      const uranusRingGeo = createRadialRingGeometry(
        cfg.radius * 1.35,
        cfg.radius * 2.2,
        128,
        24,
      );
      const uranusRingTex = createUranusRingTexture();
      const uranusRingMat = new THREE.MeshStandardMaterial({
        map: uranusRingTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        roughness: 0.7,
        metalness: 0.1,
        depthWrite: true,
      });
      const uranusRing = new THREE.Mesh(uranusRingGeo, uranusRingMat);
      uranusRing.rotation.x = Math.PI / 2;
      planet.add(uranusRing);
    }

    // Attach interaction metadata
    planet.userData = {
      id: cfg.id,
      name: cfg.name,
      badge: uzMeta.badge || `${cfg.id} • Tizim`,
      title: uzMeta.title || cfg.name,
      subtitle: uzMeta.subtitle || "",
      content: uzMeta.content || "",
      tags: uzMeta.tags || [],
      actionUrl: meta.link || null,
      actionText: meta.link ? meta.linkText : null,
      githubUrl: meta.link || null,
      githubText: meta.link ? meta.linkText : null,
      radius: cfg.radius,
      distance: cfg.distance,
      orbitGroup,
    };

    interactableObjects.push(planet);
    planetMeshes.push({
      mesh: planet,
      orbitGroup,
      speed: cfg.speed,
    });
  });

  function update(time, delta, orbitMultiplier = 1) {
    planetMeshes.forEach((p) => {
      p.orbitGroup.rotation.y += p.speed * delta * 12 * orbitMultiplier;
      p.mesh.rotation.y += delta * 0.45;
    });

    if (earthCloudsMesh) {
      earthCloudsMesh.rotation.y += delta * 0.55;
    }

    if (moonGroup && moonMesh) {
      moonGroup.rotation.y += delta * 0.65 * orbitMultiplier;
      moonMesh.rotation.y += delta * 0.2;
    }
  }

  return { planetMeshes, earthCloudsMesh, moonMesh, update };
}
