import * as THREE from "three";

export function initCosmicBodies(scene, interactableObjects) {
  // 1. VOYAGER 1 / CYBERPROBE
  const voyagerGroup = new THREE.Group();

  const dishGeo = new THREE.CylinderGeometry(1.5, 0.2, 0.45, 32, 1, true);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.3,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });
  const dishMesh = new THREE.Mesh(dishGeo, dishMat);
  dishMesh.rotation.x = Math.PI / 2;
  dishMesh.position.z = 0.35;
  voyagerGroup.add(dishMesh);

  const subreflectorGeo = new THREE.ConeGeometry(0.18, 0.65, 12);
  const subreflectorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
  });
  const subreflectorMesh = new THREE.Mesh(subreflectorGeo, subreflectorMat);
  subreflectorMesh.rotation.x = -Math.PI / 2;
  subreflectorMesh.position.z = 0.75;
  voyagerGroup.add(subreflectorMesh);

  const busGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 10);
  const busMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.85,
    roughness: 0.25,
  });
  const busMesh = new THREE.Mesh(busGeo, busMat);
  busMesh.position.z = -0.15;
  voyagerGroup.add(busMesh);

  const boomMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.6,
  });

  const rtgBoomGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8);
  const rtgBoom = new THREE.Mesh(rtgBoomGeo, boomMat);
  rtgBoom.rotation.z = Math.PI / 3;
  rtgBoom.position.set(-1.2, 0.6, -0.2);
  voyagerGroup.add(rtgBoom);

  const rtgCanGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 12);
  const rtgCanMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.3,
  });
  const rtgCan = new THREE.Mesh(rtgCanGeo, rtgCanMat);
  rtgCan.position.set(-2.4, 1.2, -0.2);
  voyagerGroup.add(rtgCan);

  const magBoomGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.2, 8);
  const magBoom = new THREE.Mesh(magBoomGeo, boomMat);
  magBoom.rotation.z = -Math.PI / 4;
  magBoom.position.set(1.6, -0.9, -0.2);
  voyagerGroup.add(magBoom);

  const beaconGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.set(0, 0.55, 0.5);
  voyagerGroup.add(beaconMesh);

  const voyagerHitGeo = new THREE.SphereGeometry(2.4, 16, 16);
  const voyagerHitMat = new THREE.MeshBasicMaterial({ visible: false });
  const voyagerHitMesh = new THREE.Mesh(voyagerHitGeo, voyagerHitMat);

  voyagerHitMesh.userData = {
    id: "Voyager",
    isProbe: true,
    radius: 1.5,
    badge: "Koinot Zondi • Interstellar Architecture",
    title: "Voyager 1 • CyberProbe Deep Space Telemetry",
    subtitle: "Avtonom Tizimlar, Chuqur Arxitektura va Erkin AI Missiyasi",
    content: `Azimjon Kamiljanovning yulduzlararo fazoga yo'naltirilgan texnologik konseptsiyasi.
Yulduzlararo masofalarda avtonom ishlovchi kiber-agentlar arxitekturasi, markazlashmagan protokollar va tizimli optimallashtirish missiyasi.`,
    tags: [
      "Voyager 1",
      "Interstellar Mission",
      "Autonomous Agents",
      "Deep Architecture",
      "Decentralized Tech",
    ],
    actionUrl: "https://github.com/AzimjonKamiljanov",
    actionText: "Voyager Missiyasi",
    githubUrl: "https://github.com/AzimjonKamiljanov",
    githubText: "GitHub Profil",
  };
  voyagerGroup.add(voyagerHitMesh);
  voyagerGroup.userData = voyagerHitMesh.userData;
  interactableObjects.push(voyagerHitMesh);

  let voyagerOrbitAngle = 1.1;
  const VOYAGER_DIST = 158;
  voyagerGroup.position.set(
    Math.cos(voyagerOrbitAngle) * VOYAGER_DIST,
    14,
    Math.sin(voyagerOrbitAngle) * VOYAGER_DIST,
  );
  voyagerGroup.lookAt(0, 0, 0);
  scene.add(voyagerGroup);

  // 2. GRAVITATIONAL LENSING BLACK HOLE (SAGITTARIUS A*)
  const blackHoleGroup = new THREE.Group();

  const eventHorizonGeo = new THREE.SphereGeometry(3.6, 64, 64);
  const eventHorizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eventHorizon = new THREE.Mesh(eventHorizonGeo, eventHorizonMat);
  blackHoleGroup.add(eventHorizon);

  const accretionGeo = new THREE.RingGeometry(3.7, 13.0, 160, 24);
  const accretionMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInnerRadius: { value: 3.7 },
      uOuterRadius: { value: 13.0 },
    },
    vertexShader: `
            varying vec2 vUv;
            varying vec3 vPos;
            void main() {
                vUv = uv;
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            uniform float uTime;
            uniform float uInnerRadius;
            uniform float uOuterRadius;
            varying vec2 vUv;
            varying vec3 vPos;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                           mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
            }

            void main() {
                float r = length(vPos.xy);
                float angle = atan(vPos.y, vPos.x);
                float normR = (r - uInnerRadius) / (uOuterRadius - uInnerRadius);
                if (normR < 0.0 || normR > 1.0) discard;

                float swirl = angle * 5.0 - uTime * (1.8 / (normR + 0.25));
                float n1 = noise(vec2(normR * 10.0, swirl * 0.6));
                float n2 = noise(vec2(normR * 20.0, swirl * 1.4));
                float plasma = n1 * 0.65 + n2 * 0.35;

                float doppler = 1.0 + 0.58 * cos(angle + 0.5);

                vec3 colInner = vec3(1.0, 0.95, 0.72);
                vec3 colMid = vec3(1.0, 0.52, 0.12);
                vec3 colOuter = vec3(0.85, 0.16, 0.02);

                vec3 color = mix(colInner, colMid, smoothstep(0.0, 0.38, normR));
                color = mix(color, colOuter, smoothstep(0.38, 0.95, normR));
                color *= (0.75 + 0.7 * plasma) * doppler;

                float alpha = smoothstep(0.0, 0.08, normR) * smoothstep(1.0, 0.68, normR) * 0.92;
                gl_FragColor = vec4(color, alpha);
            }
        `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const accretionDisk = new THREE.Mesh(accretionGeo, accretionMat);
  accretionDisk.rotation.x = Math.PI / 2 + 0.32;
  accretionDisk.rotation.y = 0.2;
  blackHoleGroup.add(accretionDisk);

  const lensingGeo = new THREE.PlaneGeometry(36, 36);
  const lensingMat = new THREE.ShaderMaterial({
    uniforms: {
      uHorizonRadius: { value: 3.6 },
    },
    vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    fragmentShader: `
            uniform float uHorizonRadius;
            varying vec2 vUv;
            void main() {
                vec2 centerUv = vUv - 0.5;
                float dist = length(centerUv) * 36.0;
                if (dist < uHorizonRadius) discard;

                float photonRing = exp(-pow(dist - 4.3, 2.0) / 0.16) * 1.85;
                float lensingGlow = pow(uHorizonRadius / max(dist, uHorizonRadius), 3.2) * 0.42;

                vec3 ringCol = vec3(1.0, 0.88, 0.55) * photonRing;
                vec3 glowCol = vec3(1.0, 0.48, 0.12) * lensingGlow;

                float alpha = clamp(photonRing + lensingGlow, 0.0, 0.95);
                gl_FragColor = vec4(ringCol + glowCol, alpha);
            }
        `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lensingMesh = new THREE.Mesh(lensingGeo, lensingMat);
  blackHoleGroup.add(lensingMesh);

  const blackHoleHitGeo = new THREE.SphereGeometry(7.5, 16, 16);
  const blackHoleHitMat = new THREE.MeshBasicMaterial({ visible: false });
  const blackHoleHitMesh = new THREE.Mesh(blackHoleHitGeo, blackHoleHitMat);

  blackHoleHitMesh.userData = {
    id: "BlackHole",
    isBlackHole: true,
    radius: 3.6,
    badge: "Singulyarlik • Gravitatsion Linza",
    title: "Sagittarius A* • Supermassive Singularity",
    subtitle: "Fazoni Eguvchi Gravitatsion Linzalanish va Voqealar Gorizonti",
    content: `Somon Yo'li galaktikasi markazidagi o'ta og'ir qora tuynuk (Gargantua / Sagittarius A*).
Umumiy nisbiylik nazariyasi bo'yicha cheksiz gravitatsiya qudug'i, voqealar gorizonti va yorug'lik tezligiga yaqin aylanuvchi plazma akkretsion diski.`,
    tags: [
      "General Relativity",
      "Event Horizon",
      "Accretion Disk",
      "Einstein Ring",
      "Gravitational Lensing",
      "GLSL Shader",
    ],
    actionUrl: "https://github.com/AzimjonKamiljanov",
    actionText: "Singulyarlik Tahlili",
    githubUrl: "https://github.com/AzimjonKamiljanov",
    githubText: "GitHub Profil",
  };
  blackHoleGroup.add(blackHoleHitMesh);
  blackHoleGroup.userData = blackHoleHitMesh.userData;
  interactableObjects.push(blackHoleHitMesh);

  blackHoleGroup.position.set(-170, 26, -145);
  scene.add(blackHoleGroup);

  function update(time, delta, camera, orbitMultiplier = 1) {
    // Voyager orbit & beacon
    voyagerOrbitAngle += 0.00035 * delta * 10 * orbitMultiplier;
    voyagerGroup.position.set(
      Math.cos(voyagerOrbitAngle) * VOYAGER_DIST,
      14 + Math.sin(time * 0.5) * 1.2,
      Math.sin(voyagerOrbitAngle) * VOYAGER_DIST,
    );
    voyagerGroup.lookAt(0, 0, 0);

    const pulse = 0.5 + 0.5 * Math.sin(time * 4.0);
    beaconMat.color.setRGB(0.2, 0.8 + 0.2 * pulse, 1.0);

    // Black Hole accretion & lensing
    accretionMat.uniforms.uTime.value = time;
    if (camera) {
      lensingMesh.lookAt(camera.position);
    }
  }

  return { voyagerGroup, blackHoleGroup, update };
}
