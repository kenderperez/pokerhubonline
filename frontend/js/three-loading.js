let isAnimating3D = false;
let animationFrameId;
const clock = new THREE.Clock();

let scene, camera, renderer, chip;

export function initLoadingScene(containerId = 'canvas-container-loading') {
    const container = document.getElementById(containerId);
    if (!container) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const spotLight = new THREE.SpotLight(0xffffff, 1.5);
    spotLight.position.set(10, 20, 10);
    scene.add(spotLight);
    const pointLight = new THREE.PointLight(0x88ccff, 1, 50);
    pointLight.position.set(-10, -10, 10);
    scene.add(pointLight);

    const geometry = new THREE.CylinderGeometry(4, 4, 0.5, 64);
    const topBottomMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2, map: createChipFaceTexture(renderer) });
    const edgeMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2, map: createChipEdgeTexture() });
    chip = new THREE.Mesh(geometry, [edgeMaterial, topBottomMaterial, topBottomMaterial]);
    chip.rotation.x = Math.PI / 2.5;
    chip.rotation.z = Math.PI / 8;
    chip.castShadow = true;
    chip.receiveShadow = true;
    scene.add(chip);

    camera.position.z = 10;

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function createChipFaceTexture(renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const center = 512;

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(center, center, 500, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.translate(center, center); ctx.rotate(i * (Math.PI / 3)); ctx.fillRect(-120, -512, 240, 300); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(center, center, 360, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D30000'; ctx.beginPath(); ctx.arc(center, center, 290, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 400px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♠', center, center + 30);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
}

export function createChipEdgeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1024, 64);
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 6; i++) { ctx.fillRect(i * (1024 / 6) + 30, 0, 100, 64); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function animate3D() {
    if (!isAnimating3D) return;
    animationFrameId = requestAnimationFrame(animate3D);
    const elapsedTime = clock.getElapsedTime();
    if (chip) {
        chip.rotation.y -= 0.05;
        chip.position.y = Math.sin(elapsedTime * 3) * 0.3;
    }
    renderer.render(scene, camera);
}

export function mostrarPantallaCarga() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('visible');
    }
    isAnimating3D = true;
    clock.start();
    animate3D();
}

export function ocultarPantallaCarga() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('visible');
    }
    isAnimating3D = false;
    cancelAnimationFrame(animationFrameId);
}

export function startLoading() {
    mostrarPantallaCarga();
}

export function stopLoading() {
    ocultarPantallaCarga();
}