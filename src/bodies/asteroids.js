import * as THREE from "three";

export function initAsteroidBelt(scene) {
  const asteroidBeltGroup = new THREE.Group();
  scene.add(asteroidBeltGroup);

  const ASTEROID_COUNT = 1450;
  const asteroidGeo = new THREE.DodecahedronGeometry(0.24, 1);
  const posAttr = asteroidGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const noise =
      1.0 + (Math.sin(vx * 7.0 + vy * 5.0) * 0.18 + Math.cos(vz * 6.0) * 0.14);
    posAttr.setXYZ(i, vx * noise, vy * noise, vz * noise);
  }
  posAttr.needsUpdate = true;
  asteroidGeo.computeVertexNormals();

  const asteroidMat = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.12,
    flatShading: true,
  });

  const asteroidBeltMesh = new THREE.InstancedMesh(
    asteroidGeo,
    asteroidMat,
    ASTEROID_COUNT,
  );
  asteroidBeltMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  asteroidBeltMesh.raycast = () => {};

  const dummyObj = new THREE.Object3D();
  const tempColor = new THREE.Color();
  const asteroidColors = [
    0x4a4744, 0x5c5852, 0x383533, 0x6e6358, 0x54473b, 0x787268,
  ];

  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const normal =
      Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    const radius = 61.0 + normal * 2.2;
    const clampedRadius = Math.max(56.5, Math.min(65.5, radius));

    const theta = Math.random() * Math.PI * 2;
    const yDisp = (Math.random() + Math.random() - 1.0) * 1.6;

    dummyObj.position.set(
      Math.cos(theta) * clampedRadius,
      yDisp,
      Math.sin(theta) * clampedRadius,
    );

    dummyObj.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    );

    const isDwarf = i % 65 === 0;
    const baseScale = isDwarf
      ? 1.8 + Math.random() * 1.0
      : 0.45 + Math.random() * 0.95;
    dummyObj.scale.set(
      baseScale * (0.75 + Math.random() * 0.5),
      baseScale * (0.65 + Math.random() * 0.6),
      baseScale * (0.75 + Math.random() * 0.5),
    );

    dummyObj.updateMatrix();
    asteroidBeltMesh.setMatrixAt(i, dummyObj.matrix);

    const colHex =
      asteroidColors[Math.floor(Math.random() * asteroidColors.length)];
    tempColor.setHex(colHex);
    tempColor.multiplyScalar(0.85 + Math.random() * 0.35);
    asteroidBeltMesh.setColorAt(i, tempColor);
  }

  asteroidBeltMesh.instanceMatrix.needsUpdate = true;
  if (asteroidBeltMesh.instanceColor)
    asteroidBeltMesh.instanceColor.needsUpdate = true;
  asteroidBeltGroup.add(asteroidBeltMesh);

  function update(time, delta, orbitMultiplier = 1) {
    asteroidBeltGroup.rotation.y += delta * 0.025 * orbitMultiplier;
  }

  return { asteroidBeltGroup, update };
}
