// ============================================================
//  BABYLON.JS SCENE SETUP — Slow Roads quality
// ============================================================
let engine, scene, camera;
let shadowGenerator = null;
let pipeline = null;
let glowLayer = null;
let envTexture = null;

// Shared scene state
let playerCar, aiCars = [];
let trackPoints = [];
let trackMeshes = [];
let sparkParticles = [];

// Race variables
let playerT = 0, playerSpeed = 0, playerLateralOffset = 0;
let playerLap = 1, playerCheckpoints = 0;
let raceTime = 0, bestLapTime = Infinity, lapStartTime = 0;
let topSpeed = 0;
let nitro = 100;
let raceFinished = false;
let keys = {};

// Real car physics state
let carX = 0, carZ = 0, carY = 0;
let carHeading = 0;
let carVelX = 0, carVelZ = 0;
let carSteerAngle = 0;
let drifting = false;
let suspBounce = 0, suspVel = 0, suspPitch = 0, suspRoll = 0;

// Camera spring state
let camPosX = 0, camPosY = 10, camPosZ = -20;
let camVelX = 0, camVelY = 0, camVelZ = 0;
let camShake = 0;

// Time tracking
let lastFrameTime = 0;

function initScene() {
    const track = TRACKS[GameState.selectedTrack];
    const isNight = track.skyColor === 0x0a0a2e || track.skyColor === 0x050515 || track.skyColor === 0x331111;
    const isDesert = track.name === 'Desert Storm' || track.name === 'Volcano Ring';
    const isSnow = track.name === 'Snow Peak' || track.name === 'Thunder Mountain';

    const canvas = document.getElementById('renderCanvas');
    canvas.style.display = 'block';

    // Create Babylon engine
    engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        adaptToDeviceRatio: true,
    });
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));

    // Create scene
    scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = hexToColor4(track.skyColor, 1);
    scene.ambientColor = isNight ? new BABYLON.Color3(0.08, 0.08, 0.15) : new BABYLON.Color3(0.3, 0.28, 0.25);

    // Atmospheric fog — tuned for smooth horizon blending
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = track.fogDensity * 0.55; // gentler fade for depth perception
    // Fog color matches sky horizon for seamless blend
    scene.fogColor = hexToColor3(track.fogColor);

    // Camera with smooth spring physics
    camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 10, -20), scene);
    camera.fov = 65 * Math.PI / 180;
    camera.minZ = 0.5;
    camera.maxZ = 2000;
    camera.inputs.clear();

    // ── Lighting — cinematic quality ──
    // Hemisphere light (sky/ground ambient fill)
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = isNight ? hexToColor3(0x1a1a4e) : hexToColor3(0x88bbff);
    hemi.groundColor = isNight ? hexToColor3(0x080818) : hexToColor3(0x445522);
    hemi.intensity = isNight ? 0.35 : 0.85;
    hemi.specular = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Directional light (sun/moon) — key light
    const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.3, -0.8, 0.5).normalize(), scene);
    sun.diffuse = isNight ? hexToColor3(0x4444aa) : hexToColor3(0xfff4e0);
    sun.specular = isNight ? hexToColor3(0x222255) : hexToColor3(0xffeedd);
    sun.intensity = isNight ? 0.5 : 1.2;
    sun.position = new BABYLON.Vector3(100, 200, 80);

    // Shadow cascade for large scene
    shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 8;
    shadowGenerator.blurScale = 2;
    shadowGenerator.depthScale = 50;
    shadowGenerator.setDarkness(0.5);
    shadowGenerator.bias = 0.001;
    shadowGenerator.normalBias = 0.02;

    // Fill light (soft opposite side)
    const fill = new BABYLON.DirectionalLight("fill", new BABYLON.Vector3(0.5, -0.3, -0.4).normalize(), scene);
    fill.diffuse = isNight ? hexToColor3(0x111133) : hexToColor3(0x99bbdd);
    fill.specular = new BABYLON.Color3(0, 0, 0);
    fill.intensity = isNight ? 0.15 : 0.3;

    // Night ambient — soft moonlight fill instead of garish neon
    if (isNight) {
        hemi.intensity = 0.6;
        sun.intensity = 0.8;
        // Subtle cool ambient point lights around the track
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r = 230;
            const pl = new BABYLON.PointLight("nightAmb" + i, new BABYLON.Vector3(
                Math.cos(angle) * r, 15, Math.sin(angle) * r
            ), scene);
            pl.diffuse = new BABYLON.Color3(0.4, 0.45, 0.6);
            pl.intensity = 2;
            pl.range = 150;
        }
    }

    // Warm sun glow for daytime tracks
    if (!isNight) {
        const sunGlow = new BABYLON.PointLight("sunGlow", new BABYLON.Vector3(100, 200, 80), scene);
        sunGlow.diffuse = hexToColor3(0xfff0dd);
        sunGlow.intensity = 0.2;
        sunGlow.range = 500;
    }

    // ── Post-processing — use individual effects instead of DefaultRenderingPipeline ──
    // (DefaultRenderingPipeline has a bug with _cameras.slice in Babylon v8)
    pipeline = null;

    // FXAA anti-aliasing
    const fxaa = new BABYLON.FxaaPostProcess("fxaa", 1.0, camera);

    // Tone mapping via scene image processing
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = isNight ? 1.8 : 1.0;
    scene.imageProcessingConfiguration.contrast = 1.05;
    // Vignette disabled for clean look
    scene.imageProcessingConfiguration.vignetteEnabled = false;

    // Image processing post-process for bloom-like glow + vignette
    const imgProc = new BABYLON.ImageProcessingPostProcess("imgProc", 1.0, camera);

    // Motion blur — removed for clean visibility

    // Bloom via glow layer (configured below)

    glowLayer = new BABYLON.GlowLayer("glow", scene);
    glowLayer.intensity = isNight ? 0.6 : 0.3;

    // Subtle environment for car reflections only
    try {
        const envTex = BABYLON.CubeTexture.CreateFromPrefilteredData(
            "https://assets.babylonjs.com/environments/environmentSpecular.env", scene
        );
        scene.environmentTexture = envTex;
        scene.environmentIntensity = isNight ? 0.3 : 0.5;
    } catch(e) {
        console.log('Environment texture not available');
    }

    // ── Sky ── procedural gradient sky dome
    createSkyDome(track, isNight, isDesert, isSnow);

    // ── Ground (far backdrop, sits below terrain to fill horizon) ──
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 4000, height: 4000 }, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = hexToColor3(track.groundColor).scale(0.85);
    groundMat.specularColor = new BABYLON.Color3(0.01, 0.01, 0.01);
    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.position.y = -2.0;

    // ── Generate track ──
    trackPoints = generateTrack(track);
    buildTrackMesh(track);
    addScenery(track);

    // ── Build player car ──
    playerCar = buildCarMesh(GameState.selectedColor, CARS[GameState.selectedCar]);

    // ── Build AI cars ──
    aiCars = [];
    const aiColors = ['#2266ff','#ff8800','#22cc44','#cc22cc','#cccc00','#00cccc','#ff4466'];
    for (let i = 0; i < GameState.opponents; i++) {
        const aiColor = aiColors[i % aiColors.length];
        const aiCarIdx = Math.floor(Math.random() * CARS.length);
        const mesh = buildCarMesh(aiColor, CARS[Math.min(aiCarIdx, CARS.length - 1)]);
        aiCars.push({
            mesh,
            t: 0.01 + i * 0.015,
            speed: 0,
            targetSpeed: 40.0 + Math.random() * 30.0,
            lateralOffset: (Math.random() - 0.5) * track.trackWidth * 0.5,
            lap: 1,
            name: `Racer ${i + 1}`,
            color: aiColor,
            finished: false,
            finishTime: 0,
        });
    }

    // ── Player start ──
    playerT = 0;
    playerSpeed = 0;
    playerLateralOffset = 0;
    playerLap = 1;
    playerCheckpoints = 0;
    raceTime = 0;
    bestLapTime = Infinity;
    lapStartTime = 0;
    raceFinished = false;

    const startPos = trackPoints[0];
    const startDir = getTrackDirectionAt(trackPoints, 0);
    carX = startPos.x;
    carZ = startPos.z;
    carY = startPos.y + 0.1;
    carHeading = Math.atan2(startDir.x, startDir.z);
    carVelX = 0;
    carVelZ = 0;
    carSteerAngle = 0;
    drifting = false;
    suspBounce = 0; suspVel = 0; suspPitch = 0; suspRoll = 0;

    // Init camera spring state
    camPosX = carX - Math.sin(carHeading) * 14;
    camPosY = carY + 6;
    camPosZ = carZ - Math.cos(carHeading) * 14;
    camVelX = 0; camVelY = 0; camVelZ = 0;
    camShake = 0;

    lastFrameTime = performance.now();
}

// Procedural sky dome — gradient sphere
function createSkyDome(track, isNight, isDesert, isSnow) {
    const sky = BABYLON.MeshBuilder.CreateSphere("sky", { diameter: 1800, segments: 24, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);

    // Create gradient sky texture
    const skySize = 512;
    const skyTex = new BABYLON.DynamicTexture("skyTex", { width: 4, height: skySize }, scene, false);
    const ctx = skyTex.getContext();

    // Compute zenith (top) and horizon (bottom) colors per biome
    let zenith, horizon;
    if (isNight) {
        zenith = '#020010';
        horizon = '#0a0a2e';
    } else if (isDesert) {
        zenith = '#5588bb';
        horizon = '#e8c870';
    } else if (isSnow) {
        zenith = '#7799bb';
        horizon = '#c8d8e8';
    } else {
        // Default outdoor: blue sky fading to pale horizon
        zenith = '#3366aa';
        horizon = '#b8d4e8';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, skySize);
    grad.addColorStop(0, zenith);
    grad.addColorStop(0.45, horizon);
    grad.addColorStop(0.55, horizon);
    // Below horizon — blend toward ground/fog color
    const fogHex = '#' + ((track.fogColor >> 16) & 0xff).toString(16).padStart(2,'0') +
                         ((track.fogColor >> 8) & 0xff).toString(16).padStart(2,'0') +
                         (track.fogColor & 0xff).toString(16).padStart(2,'0');
    grad.addColorStop(0.7, fogHex);
    grad.addColorStop(1.0, fogHex);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, skySize);
    skyTex.update();

    const skyMat = new BABYLON.StandardMaterial("skyMat", scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.emissiveTexture = skyTex;
    skyMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    sky.material = skyMat;
    sky.infiniteDistance = true;
    sky.renderingGroupId = 0;

    // Sun disc for daytime
    if (!isNight) {
        const sunDisc = BABYLON.MeshBuilder.CreateDisc("sunDisc", { radius: 25, tessellation: 32 }, scene);
        const sunMat = new BABYLON.StandardMaterial("sunMat", scene);
        sunMat.disableLighting = true;
        sunMat.emissiveColor = new BABYLON.Color3(1, 0.97, 0.88);
        sunMat.alpha = 0.85;
        sunDisc.material = sunMat;
        sunDisc.position = new BABYLON.Vector3(100, 200, 80);
        sunDisc.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    }
}
