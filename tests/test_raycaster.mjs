import * as THREE from 'three';
const scene = new THREE.Scene();
const g = new THREE.SphereGeometry(1.5, 8, 8);
const m = new THREE.MeshBasicMaterial({ visible: false });
const mesh = new THREE.Mesh(g, m);
mesh.visible = false; // Is this what they did?
scene.add(mesh);

const m2 = new THREE.MeshBasicMaterial({ visible: false });
const mesh2 = new THREE.Mesh(g, m2); // They did not set mesh.visible = false, they set material visible to false.
scene.add(mesh2);

const raycaster = new THREE.Raycaster();
raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
const intersects = raycaster.intersectObject(mesh);
console.log("mesh.visible=false: ", intersects.length > 0 ? "Intersected" : "Missed");

const intersects2 = raycaster.intersectObject(mesh2);
console.log("material.visible=false: ", intersects2.length > 0 ? "Intersected" : "Missed");
