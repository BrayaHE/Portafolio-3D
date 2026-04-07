import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const app = document.getElementById('app');
const statusBox = document.getElementById('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9e4ef);
scene.fog = new THREE.Fog(0xd9e4ef, 24, 95);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 1.7, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const moveState = { forward: false, backward: false, left: false, right: false };
const walkSpeed = 4.8;
const playerRadius = 0.3;

let verticalSpeed = 0;
const gravity = 18;
const floorHeight = 1.7;

const wallColliders = [];
const interactiveExhibits = [];
const pickableMeshes = [];
const roomAccentLights = [];

const raycaster = new THREE.Raycaster();
const pointerCenter = new THREE.Vector2(0, 0);

let selectedExhibit = null;
let nearestExhibit = null;
let tourTimer = 0;
let colorCycle = 0;

function updateStatus(message) {
    statusBox.textContent = message;
}

document.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
    updateStatus('GALERIA ACTIVA | Haz clic en pinturas para ver detalles');
});
controls.addEventListener('unlock', () => {
    updateStatus('MUSEO | Haz clic para comenzar');
});

document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyW') moveState.forward = true;
    if (event.code === 'KeyS') moveState.backward = true;
    if (event.code === 'KeyA') moveState.left = true;
    if (event.code === 'KeyD') moveState.right = true;

    if (event.code === 'Space' && camera.position.y <= floorHeight + 0.001) {
        verticalSpeed = 6.2;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'KeyW') moveState.forward = false;
    if (event.code === 'KeyS') moveState.backward = false;
    if (event.code === 'KeyA') moveState.left = false;
    if (event.code === 'KeyD') moveState.right = false;
});

document.addEventListener('mousedown', (event) => {
    if (!controls.isLocked || event.button !== 0) return;

    raycaster.setFromCamera(pointerCenter, camera);
    const intersections = raycaster.intersectObjects(pickableMeshes, false);
    if (intersections.length === 0) return;

    const hit = intersections[0].object;
    const exhibit = interactiveExhibits.find((item) => item.id === hit.userData.exhibitId);
    if (!exhibit) return;

    selectedExhibit = exhibit;
    updateStatus(`PINTURA SELECCIONADA | ${exhibit.name} - ${exhibit.category}`);

    exhibit.frame.material.emissive.setHex(0x443016);
});

function registerColliderFromMesh(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    wallColliders.push({
        minX: box.min.x,
        maxX: box.max.x,
        minZ: box.min.z,
        maxZ: box.max.z
    });
}

function collidesAt(x, z, radius = playerRadius) {
    for (const collider of wallColliders) {
        if (
            x + radius > collider.minX &&
            x - radius < collider.maxX &&
            z + radius > collider.minZ &&
            z - radius < collider.maxZ
        ) {
            return true;
        }
    }
    return false;
}

function tryMove(deltaX, deltaZ) {
    const newX = camera.position.x + deltaX;
    if (!collidesAt(newX, camera.position.z)) {
        camera.position.x = newX;
    }

    const newZ = camera.position.z + deltaZ;
    if (!collidesAt(camera.position.x, newZ)) {
        camera.position.z = newZ;
    }
}

function addMesh(mesh, options = {}) {
    const { castShadow = true, receiveShadow = true } = options;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    return mesh;
}

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';
const loadRepeatTexture = (url, repeatX, repeatY) => {
    const texture = textureLoader.load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    return texture;
};

const floorColor = loadRepeatTexture('https://threejs.org/examples/textures/hardwood2_diffuse.jpg', 10, 10);
const floorRoughness = loadRepeatTexture('https://threejs.org/examples/textures/hardwood2_roughness.jpg', 10, 10);
const floorNormal = loadRepeatTexture('https://threejs.org/examples/textures/hardwood2_bump.jpg', 10, 10);
const wallColor = loadRepeatTexture('https://threejs.org/examples/textures/brick_diffuse.jpg', 6, 2.5);
const wallNormal = loadRepeatTexture('https://threejs.org/examples/textures/brick_bump.jpg', 6, 2.5);

floorColor.colorSpace = THREE.SRGBColorSpace;
wallColor.colorSpace = THREE.SRGBColorSpace;

const floorMat = new THREE.MeshStandardMaterial({
    map: floorColor,
    roughnessMap: floorRoughness,
    normalMap: floorNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.85,
    metalness: 0.0
});

const wallMat = new THREE.MeshStandardMaterial({
    map: wallColor,
    normalMap: wallNormal,
    roughness: 0.92,
    metalness: 0.02,
    color: 0xf2efe8
});

const trimMat = new THREE.MeshStandardMaterial({ color: 0x2d3b4f, metalness: 0.2, roughness: 0.6 });

const roomsByName = {
    norte: { cx: 0, cz: -10, width: 10, depth: 8 },
    sur: { cx: 0, cz: 10, width: 10, depth: 8 },
    este: { cx: 10, cz: 0, width: 8, depth: 10 },
    oeste: { cx: -10, cz: 0, width: 8, depth: 10 }
};

function buildExterior() {
    const base = addMesh(new THREE.Mesh(new THREE.BoxGeometry(38, 1, 38), new THREE.MeshStandardMaterial({ color: 0xc7d2de, roughness: 0.98 })), { collider: false });
    base.position.set(0, -0.5, 0);

    const floor = addMesh(new THREE.Mesh(new THREE.PlaneGeometry(34, 34), floorMat), { castShadow: false, receiveShadow: true });
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.001;

    const roof = addMesh(new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 34), trimMat), { collider: false });
    roof.position.set(0, 5.4, 0);

    const walls = [
        { size: [34, 5, 0.5], pos: [0, 2.5, -17] },
        { size: [34, 5, 0.5], pos: [0, 2.5, 17] },
        { size: [0.5, 5, 34], pos: [17, 2.5, 0] },
        { size: [0.5, 5, 34], pos: [-17, 2.5, 0] }
    ];

    walls.forEach(({ size, pos }) => {
        const wall = addMesh(new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), wallMat), { collider: true });
        wall.position.set(pos[0], pos[1], pos[2]);
        registerColliderFromMesh(wall);
    });
}

function addWallSegment(width, height, depth, x, y, z) {
    const segment = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat), { collider: true });
    segment.position.set(x, y, z);
    registerColliderFromMesh(segment);
}

function createRoomSign(text, x, z, rotationY) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f6f6f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#354b64';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.fillStyle = '#1f2b3a';
    ctx.font = 'bold 76px Segoe UI';
    ctx.fillText(text, 50, 158);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sign = addMesh(
        new THREE.Mesh(
            new THREE.PlaneGeometry(4.8, 1.2),
            new THREE.MeshStandardMaterial({ map: texture, metalness: 0.05, roughness: 0.6 })
        ),
        { castShadow: false, receiveShadow: false }
    );

    sign.position.set(x, 2.7, z);
    sign.rotation.y = rotationY;
}



function createRoom({ cx, cz, width, depth, doorSide, title }) {
    const wallThickness = 0.35;
    const wallHeight = 3.8;
    const doorWidth = 2.2;
    const halfW = width / 2;
    const halfD = depth / 2;

    const roomFloor = addMesh(new THREE.Mesh(new THREE.PlaneGeometry(width - 0.4, depth - 0.4), floorMat), { castShadow: false, receiveShadow: true });
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(cx, 0.01, cz);

    const roomLight = new THREE.PointLight(0xfff1dc, 0.68, 12);
    roomLight.position.set(cx, 3.2, cz);
    scene.add(roomLight);
    roomAccentLights.push(roomLight);

    const northZ = cz - halfD;
    const southZ = cz + halfD;
    const eastX = cx + halfW;
    const westX = cx - halfW;

    if (doorSide === 'north') {
        const sideLen = (width - doorWidth) / 2;
        addWallSegment(sideLen, wallHeight, wallThickness, cx - (doorWidth / 2 + sideLen / 2), wallHeight / 2, northZ);
        addWallSegment(sideLen, wallHeight, wallThickness, cx + (doorWidth / 2 + sideLen / 2), wallHeight / 2, northZ);
    } else {
        addWallSegment(width, wallHeight, wallThickness, cx, wallHeight / 2, northZ);
    }

    if (doorSide === 'south') {
        const sideLen = (width - doorWidth) / 2;
        addWallSegment(sideLen, wallHeight, wallThickness, cx - (doorWidth / 2 + sideLen / 2), wallHeight / 2, southZ);
        addWallSegment(sideLen, wallHeight, wallThickness, cx + (doorWidth / 2 + sideLen / 2), wallHeight / 2, southZ);
    } else {
        addWallSegment(width, wallHeight, wallThickness, cx, wallHeight / 2, southZ);
    }

    if (doorSide === 'east') {
        const sideLen = (depth - doorWidth) / 2;
        addWallSegment(wallThickness, wallHeight, sideLen, eastX, wallHeight / 2, cz - (doorWidth / 2 + sideLen / 2));
        addWallSegment(wallThickness, wallHeight, sideLen, eastX, wallHeight / 2, cz + (doorWidth / 2 + sideLen / 2));
    } else {
        addWallSegment(wallThickness, wallHeight, depth, eastX, wallHeight / 2, cz);
    }

    if (doorSide === 'west') {
        const sideLen = (depth - doorWidth) / 2;
        addWallSegment(wallThickness, wallHeight, sideLen, westX, wallHeight / 2, cz - (doorWidth / 2 + sideLen / 2));
        addWallSegment(wallThickness, wallHeight, sideLen, westX, wallHeight / 2, cz + (doorWidth / 2 + sideLen / 2));
    } else {
        addWallSegment(wallThickness, wallHeight, depth, westX, wallHeight / 2, cz);
    }

    if (doorSide === 'north') createRoomSign(title, cx, northZ - 0.45, 0);
    if (doorSide === 'south') createRoomSign(title, cx, southZ + 0.45, Math.PI);
    if (doorSide === 'east') createRoomSign(title, eastX + 0.45, cz, -Math.PI / 2);
    if (doorSide === 'west') createRoomSign(title, westX - 0.45, cz, Math.PI / 2);
}

function createDustParticles() {
    const count = 500;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
        positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(32);
        positions[i * 3 + 1] = Math.random() * 5 + 0.2;
        positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(32);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xd4c6ad,
        size: 0.03,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    return particles;
}

function createPaintingTexture(name, palette) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(1, palette[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 40; i += 1) {
        ctx.strokeStyle = palette[(i % 3) + 2];
        ctx.lineWidth = 8 + ((i * 3) % 18);
        ctx.beginPath();
        ctx.moveTo((i * 83) % canvas.width, (i * 57) % canvas.height);
        ctx.bezierCurveTo(
            ((i * 113) + 170) % canvas.width,
            ((i * 149) + 90) % canvas.height,
            ((i * 181) + 210) % canvas.width,
            ((i * 77) + 180) % canvas.height,
            ((i * 199) + 320) % canvas.width,
            ((i * 131) + 260) % canvas.height
        );
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(250, 250, 248, 0.92)';
    ctx.fillRect(24, canvas.height - 84, 460, 52);
    ctx.fillStyle = '#1d2430';
    ctx.font = 'bold 30px Segoe UI';
    ctx.fillText(name, 40, canvas.height - 48);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const imageQueue = [];
let imageLoading = false;

function processImageQueue() {
    if (imageLoading || imageQueue.length === 0) return;
    imageLoading = true;
    const task = imageQueue.shift();
    const { url, name, palette, material, retries = 0 } = task;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        material.map = tex;
        material.needsUpdate = true;
        imageLoading = false;
        setTimeout(processImageQueue, 300);
    };
    img.onerror = () => {
        if (retries < 3) {
            imageQueue.push({ url, name, palette, material, retries: retries + 1 });
        }
        imageLoading = false;
        setTimeout(processImageQueue, 800);
    };
    img.src = url;
}

function loadPaintingImage(url, name, palette, material) {
    const fallback = createPaintingTexture(name, palette);
    material.map = fallback;
    imageQueue.push({ url, name, palette, material, retries: 0 });
    processImageQueue();
}

function getPaintingTransform(roomKey, wall, offset) {
    const room = roomsByName[roomKey];
    const halfW = room.width / 2;
    const halfD = room.depth / 2;

    if (wall === 'north') return { x: room.cx + offset, y: 1.9, z: room.cz - halfD + 0.2, rotY: 0 };
    if (wall === 'south') return { x: room.cx + offset, y: 1.9, z: room.cz + halfD - 0.2, rotY: Math.PI };
    if (wall === 'east') return { x: room.cx + halfW - 0.2, y: 1.9, z: room.cz + offset, rotY: -Math.PI / 2 };
    return { x: room.cx - halfW + 0.2, y: 1.9, z: room.cz + offset, rotY: Math.PI / 2 };
}

function addPainting(painting) {
    const transform = getPaintingTransform(painting.room, painting.wall, painting.offset);

    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.4, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x5d4128, roughness: 0.62, metalness: 0.08, emissive: 0x000000 })
    );

    const artMaterial = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 });

    if (painting.img) {
        loadPaintingImage(painting.img, painting.name, painting.palette, artMaterial);
    } else {
        artMaterial.map = createPaintingTexture(painting.name, painting.palette);
    }

    const art = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.1),
        artMaterial
    );
    art.position.z = 0.05;
    art.userData.exhibitId = painting.id;

    const group = new THREE.Group();
    group.position.set(transform.x, transform.y, transform.z);
    group.rotation.y = transform.rotY;
    group.add(frame);
    group.add(art);
    scene.add(group);

    pickableMeshes.push(art);
    interactiveExhibits.push({
        id: painting.id,
        name: painting.name,
        category: `Pintura | ${painting.artist}`,
        object3D: group,
        frame
    });
}

const hemi = new THREE.HemisphereLight(0xe8f2ff, 0xb6a483, 0.9);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(8, 14, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 80;
keyLight.shadow.camera.left = -24;
keyLight.shadow.camera.right = 24;
keyLight.shadow.camera.top = 24;
keyLight.shadow.camera.bottom = -24;
scene.add(keyLight);

buildExterior();

createRoom({ cx: 0, cz: -10, width: 10, depth: 8, doorSide: 'south', title: 'Sala Renacentista' });
createRoom({ cx: 0, cz: 10, width: 10, depth: 8, doorSide: 'north', title: 'Sala Impresionista' });
createRoom({ cx: 10, cz: 0, width: 8, depth: 10, doorSide: 'west', title: 'Sala Moderna' });
createRoom({ cx: -10, cz: 0, width: 8, depth: 10, doorSide: 'east', title: 'Sala Contemporanea' });

[
    // ═══ SALA RENACENTISTA (norte) ═══
    { id: 'p1', name: 'La Mona Lisa', artist: 'Leonardo da Vinci', room: 'norte', wall: 'north', offset: -2.2,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/400px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
      palette: ['#5c5a3a', '#c9b87a', '#3a3520', '#7d7245', '#a69460'] },
    { id: 'p2', name: 'La Ultima Cena', artist: 'Leonardo da Vinci', room: 'norte', wall: 'north', offset: 2.2,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/%C3%9Altima_Cena_-_Da_Vinci_5.jpg/400px-%C3%9Altima_Cena_-_Da_Vinci_5.jpg',
      palette: ['#8b7d5e', '#c4b08a', '#5a4e35', '#a09070', '#d4c498'] },
    { id: 'p3', name: 'Hombre de Vitruvio', artist: 'Leonardo da Vinci', room: 'norte', wall: 'east', offset: -1.8,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Da_Vinci_Vitruve_Luc_Viatour.jpg/400px-Da_Vinci_Vitruve_Luc_Viatour.jpg',
      palette: ['#c8b88a', '#e8dcc0', '#6b5a3a', '#9a8a60', '#ddd0a8'] },
    { id: 'p4', name: 'La Dama del Armino', artist: 'Leonardo da Vinci', room: 'norte', wall: 'east', offset: 1.8,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Lady_with_an_Ermine_-_Leonardo_da_Vinci_-_Google_Art_Project.jpg/400px-Lady_with_an_Ermine_-_Leonardo_da_Vinci_-_Google_Art_Project.jpg',
      palette: ['#2a2a2a', '#d4c4a0', '#5a4a30', '#8a7a5a', '#f0e0c0'] },
    { id: 'p5', name: 'La Anunciacion', artist: 'Leonardo da Vinci', room: 'norte', wall: 'west', offset: -1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Leonardo_da_Vinci_-_Annunciazione_-_Google_Art_Project.jpg/400px-Leonardo_da_Vinci_-_Annunciazione_-_Google_Art_Project.jpg',
      palette: ['#4a6848', '#b8c498', '#2a3a28', '#7a9468', '#d0d8b8'] },
    { id: 'p6', name: 'El Nacimiento de Venus', artist: 'Sandro Botticelli', room: 'norte', wall: 'west', offset: 1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/400px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',
      palette: ['#7aaab8', '#e8d0a8', '#4a7888', '#c0a878', '#a8d4e0'] },
    { id: 'p7', name: 'La Creacion de Adan', artist: 'Miguel Angel', room: 'norte', wall: 'south', offset: -3.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg/400px-Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg',
      palette: ['#a8947c', '#d8c8b0', '#6a5a48', '#c4a888', '#e8dcc8'] },
    { id: 'p8', name: 'La Escuela de Atenas', artist: 'Rafael Sanzio', room: 'norte', wall: 'south', offset: 3.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/400px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg',
      palette: ['#b8a888', '#e0d4c0', '#7a6a50', '#c8b498', '#d8c8a8'] },

    // ═══ SALA IMPRESIONISTA (sur) ═══
    { id: 'p9', name: 'La Noche Estrellada', artist: 'Vincent van Gogh', room: 'sur', wall: 'south', offset: -2.2,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/400px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
      palette: ['#1a2a5a', '#f0d848', '#0a1a3a', '#4a6aaa', '#2848a0'] },
    { id: 'p10', name: 'Los Girasoles', artist: 'Vincent van Gogh', room: 'sur', wall: 'south', offset: 2.2,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Vincent_Willem_van_Gogh_127.jpg/400px-Vincent_Willem_van_Gogh_127.jpg',
      palette: ['#d8a820', '#f0d060', '#a07810', '#e8c840', '#c89818'] },
    { id: 'p11', name: 'Terraza de Cafe por la Noche', artist: 'Vincent van Gogh', room: 'sur', wall: 'east', offset: -1.8,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Vincent_Willem_van_Gogh_-_Cafe_Terrace_at_Night_%28Yorck%29.jpg/400px-Vincent_Willem_van_Gogh_-_Cafe_Terrace_at_Night_%28Yorck%29.jpg',
      palette: ['#1a2040', '#f0d868', '#3a4878', '#c8a838', '#5868a8'] },
    { id: 'p12', name: 'Autorretrato con Sombrero', artist: 'Vincent van Gogh', room: 'sur', wall: 'east', offset: 1.8,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Vincent_van_Gogh_-_Self-Portrait_-_Google_Art_Project.jpg/400px-Vincent_van_Gogh_-_Self-Portrait_-_Google_Art_Project.jpg',
      palette: ['#4a7898', '#d8c098', '#2a4868', '#88a8b8', '#c0a878'] },
    { id: 'p13', name: 'La Habitacion en Arles', artist: 'Vincent van Gogh', room: 'sur', wall: 'west', offset: -1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg/400px-Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg',
      palette: ['#5878b8', '#e8c878', '#3858a0', '#c8a858', '#7898c8'] },
    { id: 'p14', name: 'Impresion Sol Naciente', artist: 'Claude Monet', room: 'sur', wall: 'west', offset: 1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Monet_-_Impression%2C_Sunrise.jpg/400px-Monet_-_Impression%2C_Sunrise.jpg',
      palette: ['#4a6888', '#e86828', '#2a4868', '#88a8c0', '#c84818'] },
    { id: 'p15', name: 'Nenufares', artist: 'Claude Monet', room: 'sur', wall: 'north', offset: -3.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Claude_Monet_-_Water_Lilies_-_1906%2C_Chicago.jpg/400px-Claude_Monet_-_Water_Lilies_-_1906%2C_Chicago.jpg',
      palette: ['#4888a0', '#88c8a0', '#2868a0', '#68a890', '#a8d8c0'] },
    { id: 'p16', name: 'Baile en el Moulin', artist: 'Pierre-Auguste Renoir', room: 'sur', wall: 'north', offset: 3.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Pierre-Auguste_Renoir%2C_Le_Moulin_de_la_Galette.jpg/400px-Pierre-Auguste_Renoir%2C_Le_Moulin_de_la_Galette.jpg',
      palette: ['#3858a0', '#e8d0a8', '#1838a0', '#88a8c8', '#c8b088'] },

    // ═══ SALA MODERNA (este) ═══
    { id: 'p17', name: 'El Grito', artist: 'Edvard Munch', room: 'este', wall: 'east', offset: -2.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/400px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg',
      palette: ['#e86828', '#f8a848', '#a83818', '#f8d088', '#c84818'] },
    { id: 'p18', name: 'El Beso', artist: 'Gustav Klimt', room: 'este', wall: 'east', offset: 0.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/400px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg',
      palette: ['#d8a828', '#f8e868', '#a87818', '#e8c848', '#c89828'] },
    { id: 'p19', name: 'Noche Estrellada sobre el Rodano', artist: 'Vincent van Gogh', room: 'este', wall: 'east', offset: 2.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Starry_Night_Over_the_Rhone.jpg/400px-Starry_Night_Over_the_Rhone.jpg',
      palette: ['#0a1a4a', '#f8d848', '#1a2a6a', '#4868b8', '#d8b828'] },
    { id: 'p20', name: 'La Gran Ola de Kanagawa', artist: 'Katsushika Hokusai', room: 'este', wall: 'north', offset: 0.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/400px-Tsunami_by_hokusai_19th_century.jpg',
      palette: ['#1858a8', '#f8f8f0', '#0838a8', '#88b8d8', '#d8d8d0'] },
    { id: 'p21', name: 'La Libertad Guiando al Pueblo', artist: 'Eugene Delacroix', room: 'este', wall: 'south', offset: -1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg/400px-Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg',
      palette: ['#3848a8', '#e8c888', '#1828a8', '#c8a868', '#585888'] },
    { id: 'p22', name: 'Composicion VIII', artist: 'Wassily Kandinsky', room: 'este', wall: 'south', offset: 1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg/400px-Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg',
      palette: ['#2848a8', '#e83838', '#f8d828', '#1828a8', '#28a848'] },

    // ═══ SALA CONTEMPORANEA (oeste) ═══
    { id: 'p23', name: 'La Joven de la Perla', artist: 'Johannes Vermeer', room: 'oeste', wall: 'west', offset: -2.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Meisje_met_de_parel.jpg/400px-Meisje_met_de_parel.jpg',
      palette: ['#1a3050', '#f8e8a8', '#0a2040', '#4a6888', '#d8c880'] },
    { id: 'p24', name: 'La Ronda de Noche', artist: 'Rembrandt', room: 'oeste', wall: 'west', offset: 0.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/The_Night_Watch_-_HD.jpg/400px-The_Night_Watch_-_HD.jpg',
      palette: ['#3a2a18', '#d8b868', '#1a1a08', '#8a7a48', '#b8a458'] },
    { id: 'p25', name: 'Las Meninas', artist: 'Diego Velazquez', room: 'oeste', wall: 'west', offset: 2.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg/400px-Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg',
      palette: ['#4a3a28', '#c8b898', '#2a2018', '#8a7a68', '#a89878'] },
    { id: 'p26', name: 'El Caminante sobre el Mar de Niebla', artist: 'Caspar David Friedrich', room: 'oeste', wall: 'north', offset: 0.0,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg/400px-Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg',
      palette: ['#4a6888', '#d8d8c8', '#2a4868', '#88a8c0', '#a8b8c8'] },
    { id: 'p27', name: 'La Lechera', artist: 'Johannes Vermeer', room: 'oeste', wall: 'south', offset: -1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg/400px-Johannes_Vermeer_-_Het_melkmeisje_-_Google_Art_Project.jpg',
      palette: ['#4a5a78', '#e8d8a8', '#2a3a58', '#88a888', '#c8b878'] },
    { id: 'p28', name: 'Mujer con Sombrilla', artist: 'Claude Monet', room: 'oeste', wall: 'south', offset: 1.5,
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg/400px-Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg',
      palette: ['#68a8c8', '#e8e8d8', '#4888a8', '#a8c8a8', '#d8d8c0'] }
].forEach(addPainting);

const dust = createDustParticles();
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    if (controls.isLocked) {
        const moveVector = new THREE.Vector3(
            Number(moveState.right) - Number(moveState.left),
            0,
            Number(moveState.forward) - Number(moveState.backward)
        );

        if (moveVector.lengthSq() > 0) {
            moveVector.normalize();

            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
            const deltaMoveX = (right.x * moveVector.x + forward.x * moveVector.z) * walkSpeed * delta;
            const deltaMoveZ = (right.z * moveVector.x + forward.z * moveVector.z) * walkSpeed * delta;
            tryMove(deltaMoveX, deltaMoveZ);
        }

        verticalSpeed -= gravity * delta;
        camera.position.y += verticalSpeed * delta;
        if (camera.position.y < floorHeight) {
            camera.position.y = floorHeight;
            verticalSpeed = 0;
        }

        let nearestDistance = Infinity;
        nearestExhibit = null;

        interactiveExhibits.forEach((exhibit, index) => {
            exhibit.frame.material.emissive.lerp(
                new THREE.Color(selectedExhibit && selectedExhibit.id === exhibit.id ? 0x443016 : 0x000000),
                0.08
            );

            const dist = camera.position.distanceTo(exhibit.object3D.position);
            if (dist < nearestDistance) {
                nearestDistance = dist;
                nearestExhibit = exhibit;
            }
        });

        if (nearestExhibit && nearestDistance < 2.2 && !selectedExhibit) {
            updateStatus(`CERCA DE PINTURA | ${nearestExhibit.name} (clic para detalle)`);
        }

        tourTimer += delta;
        if (tourTimer > 10) {
            tourTimer = 0;
            colorCycle += 0.12;
            const hue = (0.09 + colorCycle) % 1;
            roomAccentLights.forEach((light, i) => {
                light.color.setHSL((hue + i * 0.08) % 1, 0.48, 0.72);
            });
        }
    }

    const pos = dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
        const yIndex = i * 3 + 1;
        pos.array[yIndex] += Math.sin(elapsed * 0.4 + i * 0.2) * 0.0004;
        if (pos.array[yIndex] > 6) pos.array[yIndex] = 0.2;
    }
    pos.needsUpdate = true;

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
