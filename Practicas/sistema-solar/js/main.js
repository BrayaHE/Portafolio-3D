import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';

const app = document.getElementById('app');
const toggleAnimationButton = document.getElementById('toggleAnimation');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const toggleOrbits = document.getElementById('toggleOrbits');

const planetInfoTitle = document.querySelector('#planetInfo h2');
const planetInfoDescription = document.getElementById('planetDesc');
const planetInfoData = document.getElementById('planetData');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 45, 88);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 18;
controls.maxDistance = 260;
controls.target.set(0, 0, 0);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let isPaused = false;
let globalSpeed = 1;

const textureLoader = new THREE.TextureLoader();
const planetTextureBase = '../textures/planets';

function applyTextureSafe(material, url) {
    textureLoader.load(
        url,
        (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.needsUpdate = true;
        },
        undefined,
        () => {
            // Keep base color if texture fails to load.
            material.map = null;
            material.needsUpdate = true;
        }
    );
}

// Fondo espacial procedural para evitar fallos de carga por red en Brave.
const starGeometry = new THREE.BufferGeometry();
const starCount = 3500;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
    const radius = 250 + Math.random() * 160;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    starPositions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi);
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xdde6ff, size: 0.75, sizeAttenuation: true })
);
scene.add(stars);

const ambientLight = new THREE.AmbientLight(0x404060, 3.0);
scene.add(ambientLight);

const sunLight = new THREE.PointLight(0xfff5e0, 800, 0);
sunLight.position.set(0, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
scene.add(sunLight);

const solarSystemRoot = new THREE.Group();
scene.add(solarSystemRoot);

const sun = new THREE.Mesh(
    new THREE.SphereGeometry(6.5, 64, 64),
    new THREE.MeshStandardMaterial({
        color: 0xffd27a,
        emissive: 0xffb347,
        emissiveIntensity: 1.75,
        metalness: 0,
        roughness: 0.9
    })
);
sun.castShadow = false;
solarSystemRoot.add(sun);
applyTextureSafe(sun.material, `${planetTextureBase}/sun.jpg`);

const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(7.4, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.24 })
);
solarSystemRoot.add(sunGlow);

const planetDefinitions = [
    {
        name: 'Mercurio',
        radius: 0.9,
        distance: 11,
        rotationSpeed: 0.45,
        orbitSpeed: 1.2,
        texture: `${planetTextureBase}/mercury.jpg`,
        color: 0xcccccc,
        description: 'Planeta rocoso mas cercano al Sol.',
        data: 'Radio relativo: 0.9 | Orbita: 11 u | Rotacion: 0.45 | Traslacion: 1.20'
    },
    {
        name: 'Venus',
        radius: 1.3,
        distance: 15,
        rotationSpeed: 0.25,
        orbitSpeed: 0.92,
        texture: `${planetTextureBase}/venus.jpg`,
        color: 0xeedd99,
        description: 'Atmosfera densa y superficie muy caliente.',
        data: 'Radio relativo: 1.3 | Orbita: 15 u | Rotacion: 0.25 | Traslacion: 0.92'
    },
    {
        name: 'Tierra',
        radius: 1.38,
        distance: 20,
        rotationSpeed: 1.0,
        orbitSpeed: 0.78,
        texture: `${planetTextureBase}/earth_atmos_2048.jpg`,
        color: 0xddddff,
        description: 'Nuestro planeta, con agua liquida y vida conocida.',
        data: 'Radio relativo: 1.38 | Orbita: 20 u | Rotacion: 1.00 | Traslacion: 0.78'
    },
    {
        name: 'Marte',
        radius: 1.15,
        distance: 25,
        rotationSpeed: 0.92,
        orbitSpeed: 0.63,
        texture: `${planetTextureBase}/mars_1024.jpg`,
        color: 0xee8866,
        description: 'Conocido como el planeta rojo.',
        data: 'Radio relativo: 1.15 | Orbita: 25 u | Rotacion: 0.92 | Traslacion: 0.63'
    },
    {
        name: 'Jupiter',
        radius: 3.5,
        distance: 33,
        rotationSpeed: 1.85,
        orbitSpeed: 0.34,
        texture: `${planetTextureBase}/jupiter.jpg`,
        color: 0xeebb88,
        description: 'El planeta mas grande del Sistema Solar.',
        data: 'Radio relativo: 3.5 | Orbita: 33 u | Rotacion: 1.85 | Traslacion: 0.34'
    },
    {
        name: 'Saturno',
        radius: 3.0,
        distance: 42,
        rotationSpeed: 1.62,
        orbitSpeed: 0.25,
        texture: `${planetTextureBase}/saturn.jpg`,
        color: 0xeeddaa,
        description: 'Destaca por su sistema de anillos.',
        data: 'Radio relativo: 3.0 | Orbita: 42 u | Rotacion: 1.62 | Traslacion: 0.25'
    },
    {
        name: 'Urano',
        radius: 2.2,
        distance: 51,
        rotationSpeed: 1.12,
        orbitSpeed: 0.19,
        texture: `${planetTextureBase}/uranus.jpg`,
        color: 0xaaeeff,
        description: 'Gigante helado con eje inclinado.',
        data: 'Radio relativo: 2.2 | Orbita: 51 u | Rotacion: 1.12 | Traslacion: 0.19'
    },
    {
        name: 'Neptuno',
        radius: 2.15,
        distance: 60,
        rotationSpeed: 1.08,
        orbitSpeed: 0.15,
        texture: `${planetTextureBase}/neptune.jpg`,
        color: 0x7799ff,
        description: 'Gigante helado azul, muy alejado del Sol.',
        data: 'Radio relativo: 2.15 | Orbita: 60 u | Rotacion: 1.08 | Traslacion: 0.15'
    }
];

const planetSystems = [];
const orbitLines = [];
const selectablePlanets = [];

function createOrbitLine(radius) {
    const points = [];
    const segments = 180;

    for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x53618f, transparent: true, opacity: 0.5 });
    const line = new THREE.LineLoop(geometry, material);
    scene.add(line);
    orbitLines.push(line);
}

planetDefinitions.forEach((planetDef) => {
    const orbitPivot = new THREE.Object3D();
    solarSystemRoot.add(orbitPivot);

    const planetMaterial = new THREE.MeshStandardMaterial({
        color: planetDef.color,
        metalness: 0.0,
        roughness: 1.0
    });
    applyTextureSafe(planetMaterial, planetDef.texture);

    const planet = new THREE.Mesh(
        new THREE.SphereGeometry(planetDef.radius, 48, 48),
        planetMaterial
    );

    planet.position.x = planetDef.distance;
    planet.castShadow = true;
    planet.receiveShadow = true;
    planet.userData = {
        name: planetDef.name,
        description: planetDef.description,
        data: planetDef.data
    };

    orbitPivot.add(planet);

    if (planetDef.name === 'Saturno') {
        // Generar textura del anillo proceduralmente
        const ringCanvas = document.createElement('canvas');
        ringCanvas.width = 512;
        ringCanvas.height = 64;
        const rctx = ringCanvas.getContext('2d');
        const grad = rctx.createLinearGradient(0, 0, 512, 0);
        grad.addColorStop(0.0, '#8a7a5a');
        grad.addColorStop(0.15, '#d8c290');
        grad.addColorStop(0.3, '#b5a06a');
        grad.addColorStop(0.45, 'rgba(180,160,120,0.3)');
        grad.addColorStop(0.55, '#c8b080');
        grad.addColorStop(0.7, '#a0905e');
        grad.addColorStop(0.85, 'rgba(160,140,100,0.4)');
        grad.addColorStop(1.0, '#6a5a3a');
        rctx.fillStyle = grad;
        rctx.fillRect(0, 0, 512, 64);
        const ringTexture = new THREE.CanvasTexture(ringCanvas);

        const ringMaterial = new THREE.MeshStandardMaterial({
            map: ringTexture,
            color: 0xd8c290,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
            roughness: 0.85,
            metalness: 0.03
        });

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(planetDef.radius * 1.45, planetDef.radius * 2.35, 96),
            ringMaterial
        );

        ring.rotation.x = Math.PI / 2.25;
        planet.add(ring);
    }

    // Hitbox invisible para facilitar clic en planetas pequenos.
    const hitSphere = new THREE.Mesh(
        new THREE.SphereGeometry(planetDef.radius * 1.7, 18, 18),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitSphere.userData = planet.userData;
    planet.add(hitSphere);
    selectablePlanets.push(hitSphere);

    createOrbitLine(planetDef.distance);

    planetSystems.push({
        ...planetDef,
        orbitPivot,
        planet
    });
});

function updatePlanetInfo(planetMesh) {
    if (!planetMesh) {
        planetInfoTitle.textContent = 'Selecciona un planeta';
        planetInfoDescription.textContent = 'Haz clic en cualquiera de los 8 planetas para ver sus datos principales.';
        planetInfoData.textContent = 'Datos: -';
        return;
    }

    const { name, description, data } = planetMesh.userData;
    planetInfoTitle.textContent = name;
    planetInfoDescription.textContent = description;
    planetInfoData.textContent = data;
}

renderer.domElement.addEventListener('pointerdown', (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selectablePlanets, true);

    if (hits.length > 0) {
        updatePlanetInfo(hits[0].object);
    }
});

toggleAnimationButton.addEventListener('click', () => {
    isPaused = !isPaused;
    toggleAnimationButton.textContent = isPaused ? 'Reanudar animacion' : 'Pausar animacion';
});

speedRange.addEventListener('input', () => {
    globalSpeed = Number(speedRange.value);
    speedValue.textContent = `${globalSpeed.toFixed(2)}x`;
});

toggleOrbits.addEventListener('change', () => {
    orbitLines.forEach((line) => {
        line.visible = toggleOrbits.checked;
    });
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const adjustedDelta = delta * globalSpeed;

    if (!isPaused) {
        sun.rotation.y += adjustedDelta * 0.2;
        sunGlow.rotation.y -= adjustedDelta * 0.1;

        planetSystems.forEach((planetSystem) => {
            planetSystem.orbitPivot.rotation.y += adjustedDelta * planetSystem.orbitSpeed;
            planetSystem.planet.rotation.y += adjustedDelta * planetSystem.rotationSpeed;
        });
    }

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
