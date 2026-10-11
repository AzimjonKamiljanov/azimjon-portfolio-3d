import * as THREE from 'three';

const earth = new THREE.Mesh();
const moonOrbit = new THREE.Group();
earth.add(moonOrbit);
const moon = new THREE.Mesh();
moon.position.x = 3.5;
moonOrbit.add(moon);

// initial position
earth.updateMatrixWorld();
const initialMoonPos = new THREE.Vector3();
moon.getWorldPosition(initialMoonPos);
console.log("Initial Moon Pos:", initialMoonPos);

// simulate animation when shouldRotate is false
earth.rotation.y += 0.1;
earth.updateMatrixWorld();

const newMoonPos = new THREE.Vector3();
moon.getWorldPosition(newMoonPos);
console.log("New Moon Pos:", newMoonPos);
