// ============================================================
//  CAR PREVIEW — Rotating procedural 3D car on the car-select screen
// ============================================================
let _previewEngine = null;
let _previewScene = null;
let _previewCamera = null;
let _previewCarRoot = null;
let _previewLoadedStyle = null;
let _previewLoadedColor = null;
let _previewBodyMaterials = [];
let _previewRotation = 0;
let _previewAccentLights = [];
let _previewResizeWired = false;

function initCarPreview() {
    const canvas = document.getElementById('car-preview-canvas');
    if (!canvas) return;

    if (!_previewEngine) {
        _previewEngine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            alpha: true,
            antialias: true,
        });
        _previewScene = new BABYLON.Scene(_previewEngine);
        _previewScene.useRightHandedSystem = true;
        _previewScene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.06, 1);

        _previewCamera = new BABYLON.ArcRotateCamera(
            'previewCam',
            -Math.PI / 2 - 0.45,
            Math.PI / 2 - 0.22,
            12,
            new BABYLON.Vector3(0, 0.6, 0),
            _previewScene
        );
        _previewCamera.fov = 0.7;
        _previewCamera.lowerRadiusLimit = 4;
        _previewCamera.upperRadiusLimit = 30;
        _previewCamera.minZ = 0.1;
        _previewCamera.maxZ = 60;
        _previewCamera.wheelPrecision = 30;
        _previewCamera.angularSensibilityX = 1500;
        _previewCamera.angularSensibilityY = 1500;
        _previewCamera.panningSensibility = 0; // disable pan, only orbit
        _previewCamera.attachControl(canvas, true);

        // ── Three-point lighting (car-focused) ──
        const hemi = new BABYLON.HemisphericLight('phemi', new BABYLON.Vector3(0, 1, 0.2), _previewScene);
        hemi.intensity = 0.8;
        hemi.diffuse = new BABYLON.Color3(1, 0.95, 0.88);
        hemi.groundColor = new BABYLON.Color3(0.15, 0.12, 0.25);
        hemi.specular = new BABYLON.Color3(0.3, 0.3, 0.35);

        const key = new BABYLON.DirectionalLight('pkey', new BABYLON.Vector3(-0.4, -0.75, -0.5).normalize(), _previewScene);
        key.intensity = 1.15;
        key.diffuse = new BABYLON.Color3(1, 0.95, 0.85);
        key.specular = new BABYLON.Color3(1, 0.95, 0.85);

        const rim = new BABYLON.DirectionalLight('prim', new BABYLON.Vector3(0.5, -0.2, 0.7).normalize(), _previewScene);
        rim.intensity = 0.8;
        rim.diffuse = new BABYLON.Color3(0.55, 0.75, 1.0);
        rim.specular = new BABYLON.Color3(0.55, 0.75, 1.0);

        // Subtle swirling accent point lights — only on the car
        _previewAccentLights = [];
        const orangeL = new BABYLON.PointLight('paccent1', new BABYLON.Vector3(-3.5, 2.2, 1.5), _previewScene);
        orangeL.diffuse = new BABYLON.Color3(1, 0.5, 0.2);
        orangeL.intensity = 0.55;
        orangeL.range = 8;
        _previewAccentLights.push(orangeL);

        const cyanL = new BABYLON.PointLight('paccent2', new BABYLON.Vector3(3.5, 2.2, -1.5), _previewScene);
        cyanL.diffuse = new BABYLON.Color3(0.3, 0.7, 1.0);
        cyanL.intensity = 0.5;
        cyanL.range = 8;
        _previewAccentLights.push(cyanL);

        // HDR environment for reflective paint + chrome
        try {
            const envTex = BABYLON.CubeTexture.CreateFromPrefilteredData(
                'https://assets.babylonjs.com/environments/environmentSpecular.env', _previewScene
            );
            _previewScene.environmentTexture = envTex;
            _previewScene.environmentIntensity = 1.0;
        } catch(e) { /* graceful */ }

        // ── Showroom backdrop — gradient dome ──
        const dome = BABYLON.MeshBuilder.CreateSphere('pdome', { diameter: 60, segments: 24, sideOrientation: BABYLON.Mesh.BACKSIDE }, _previewScene);
        const domeTex = new BABYLON.DynamicTexture('pdomeTex', { width: 4, height: 512 }, _previewScene, false);
        const dctx = domeTex.getContext();
        const dgrad = dctx.createLinearGradient(0, 0, 0, 512);
        dgrad.addColorStop(0, '#0a0820');
        dgrad.addColorStop(0.45, '#170b40');
        dgrad.addColorStop(0.6, '#1a0533');
        dgrad.addColorStop(1, '#050308');
        dctx.fillStyle = dgrad;
        dctx.fillRect(0, 0, 4, 512);
        domeTex.update();
        const domeMat = new BABYLON.StandardMaterial('pdomeMat', _previewScene);
        domeMat.backFaceCulling = false;
        domeMat.disableLighting = true;
        domeMat.emissiveTexture = domeTex;
        domeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
        dome.material = domeMat;
        dome.infiniteDistance = true;

        // ── Turntable floor — matte, low-reflectance ──
        const floor = BABYLON.MeshBuilder.CreateDisc('pfloor', { radius: 30, tessellation: 72 }, _previewScene);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = -0.52;
        const floorMat = new BABYLON.StandardMaterial('pfloorMat', _previewScene);
        floorMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.08);
        floorMat.specularColor = new BABYLON.Color3(0, 0, 0);
        floorMat.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.02);
        floorMat.backFaceCulling = false;
        floor.material = floorMat;

        // Orange + cyan unlit glow rings
        const ring = BABYLON.MeshBuilder.CreateTorus('pring', { diameter: 8.4, thickness: 0.07, tessellation: 72 }, _previewScene);
        ring.position.y = -0.49;
        const ringMat = new BABYLON.StandardMaterial('pringMat', _previewScene);
        ringMat.disableLighting = true;
        ringMat.emissiveColor = new BABYLON.Color3(1, 0.45, 0.18);
        ring.material = ringMat;

        const ring2 = BABYLON.MeshBuilder.CreateTorus('pring2', { diameter: 6.6, thickness: 0.03, tessellation: 72 }, _previewScene);
        ring2.position.y = -0.50;
        const ring2Mat = new BABYLON.StandardMaterial('pring2Mat', _previewScene);
        ring2Mat.disableLighting = true;
        ring2Mat.emissiveColor = new BABYLON.Color3(0.25, 0.8, 1);
        ring2.material = ring2Mat;

        // Exclude background scene bits from the accent point lights
        [floor, ring, ring2, dome].forEach(m => {
            _previewAccentLights.forEach(L => { L.excludedMeshes = L.excludedMeshes || []; L.excludedMeshes.push(m); });
        });

        try {
            const glow = new BABYLON.GlowLayer('pglow', _previewScene);
            glow.intensity = 1.0;
        } catch(e) { /* graceful */ }

        _previewScene.imageProcessingConfiguration.toneMappingEnabled = true;
        _previewScene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        _previewScene.imageProcessingConfiguration.exposure = 1.2;
        _previewScene.imageProcessingConfiguration.contrast = 1.18;
        _previewScene.imageProcessingConfiguration.vignetteEnabled = true;
        _previewScene.imageProcessingConfiguration.vignetteWeight = 1.6;
        _previewScene.imageProcessingConfiguration.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);

        // Pause auto-spin while user is dragging; resume after a short idle.
        let _userIdleSince = 0;
        const markUserActive = () => { _userIdleSince = performance.now(); };
        canvas.addEventListener('pointerdown', markUserActive);
        canvas.addEventListener('pointermove', e => { if (e.buttons) markUserActive(); });
        canvas.addEventListener('wheel', markUserActive, { passive: true });

        _previewEngine.runRenderLoop(() => {
            if (!_previewScene) return;
            // Auto-orbit the camera (slow turntable) when user isn't interacting.
            if (_previewCamera && (performance.now() - _userIdleSince) > 1500) {
                _previewCamera.alpha -= 0.0035;
            }
            if (_previewAccentLights.length) {
                const t = performance.now() * 0.0005;
                _previewAccentLights[0].position.x = Math.cos(t) * 3.5;
                _previewAccentLights[0].position.z = Math.sin(t) * 2.5;
                _previewAccentLights[1].position.x = Math.cos(t + Math.PI) * 3.5;
                _previewAccentLights[1].position.z = Math.sin(t + Math.PI) * 2.5;
            }
            _previewScene.render();
        });

        if (!_previewResizeWired) {
            window.addEventListener('resize', () => { if (_previewEngine) _previewEngine.resize(); });
            _previewResizeWired = true;
        }
    }

    requestAnimationFrame(() => {
        if (_previewEngine) _previewEngine.resize();
        setTimeout(() => { if (_previewEngine) _previewEngine.resize(); }, 120);
    });
    updateCarPreview();
    // Generate thumbnails for every car in an offscreen scene so the strip
    // cards aren't blank for cars the user hasn't clicked yet. Delayed so the
    // main preview (already loading the selected car) gets the GPU first.
    setTimeout(() => {
        if (typeof preloadAllCarThumbnails === 'function') preloadAllCarThumbnails();
    }, 600);
}

let _thumbCycleRunning = false;
let _thumbCycleExpect = -1; // index we just set; differs from selectedCar if user clicked
async function _cycleAllCarThumbnails() {
    if (_thumbCycleRunning) return;
    if (typeof CARS === 'undefined' || !_previewScene) return;
    window.__carThumbnails = window.__carThumbnails || {};

    const userOriginal = GameState.selectedCar;
    // Skip the currently-selected car: the visible preview is already loading
    // it and will auto-capture its thumbnail. If we try to "load" it here,
    // updateCarPreview's dedup short-circuits and the cycler waits 4s for a
    // capture that the original load is still working on.
    const todo = CARS
        .map((c, i) => ({ car: c, i }))
        .filter(({ car, i }) =>
            GameState.xp >= car.unlock
            && !window.__carThumbnails[car.style]
            && i !== userOriginal
        );

    _thumbCycleRunning = true;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    for (const { car, i } of todo) {
        if (window.__carThumbnails[car.style]) continue;
        if (_thumbCycleExpect !== -1 && GameState.selectedCar !== _thumbCycleExpect) break;
        GameState.selectedCar = i;
        _thumbCycleExpect = i;
        updateCarPreview();
        // Bigger GLBs (lamborghini-diablo-sv is ~10MB) need more headroom.
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && !window.__carThumbnails[car.style]) {
            await sleep(120);
        }
    }

    // Restore selection only if user didn't pick something else mid-cycle.
    const userPicked = _thumbCycleExpect !== -1 && GameState.selectedCar !== _thumbCycleExpect;
    if (!userPicked) {
        GameState.selectedCar = userOriginal;
    }
    // Force the visible preview to reload the now-selected car. The cycler's
    // mid-flight loads may have left _previewLoadedStyle pointing at a car
    // that never actually finished rendering, so clear it first.
    _previewLoadedStyle = null;
    updateCarPreview();
    if (typeof buildCarSelect === 'function') buildCarSelect();
    _thumbCycleExpect = -1;
    _thumbCycleRunning = false;
}

// Generates 3D thumbnails for every CAR style in an offscreen canvas, so
// the strip cards in the car-select screen show the real cars without the
// user having to click each one first. Cached to window.__carThumbnails.
let _thumbsLoading = false;
async function preloadAllCarThumbnails() {
    if (_thumbsLoading) return;
    _thumbsLoading = true;
    window.__carThumbnails = window.__carThumbnails || {};
    if (typeof CARS === 'undefined' || typeof CAR_MODELS === 'undefined') {
        _thumbsLoading = false; return;
    }
    // Hidden offscreen canvas + engine
    const canvas = document.createElement('canvas');
    canvas.width = 360; canvas.height = 200;
    canvas.style.position = 'absolute'; canvas.style.left = '-9999px'; canvas.style.top = '-9999px';
    document.body.appendChild(canvas);
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
    const scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = new BABYLON.Color4(0.05, 0.03, 0.10, 1);
    new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.95;
    const dl = new BABYLON.DirectionalLight('d', new BABYLON.Vector3(-0.4, -0.8, -0.3), scene);
    dl.intensity = 0.7;
    const cam = new BABYLON.ArcRotateCamera('c', -Math.PI/2 - 0.45, Math.PI/2 - 0.22, 8, BABYLON.Vector3.Zero(), scene);
    cam.fov = 0.7; cam.minZ = 0.1; cam.maxZ = 60;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    for (const car of CARS) {
        const style = car.style;
        if (window.__carThumbnails[style]) continue;
        const info = CAR_MODELS[style];
        if (!info) continue;
        try {
            // Wipe scene (keep camera + lights)
            const keep = ['c', 'h', 'd'];
            [...scene.meshes].forEach(m => { if (!keep.includes(m.name)) m.dispose(); });
            [...scene.transformNodes].forEach(t => t.dispose());
            [...scene.materials].forEach(m => { try { m.dispose(); } catch(e) {} });

            const lastSlash = info.file.lastIndexOf('/');
            const rootUrl = lastSlash >= 0 ? info.file.substring(0, lastSlash + 1) : './';
            const fileName = lastSlash >= 0 ? info.file.substring(lastSlash + 1) : info.file;
            await new Promise((resolve) => {
                BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, scene, (meshes) => {
                    // Pick the main subtree with most descendants
                    const top = meshes.find(m => m.name === '__root__') || meshes.find(m => !m.parent || !meshes.includes(m.parent));
                    if (!top) { resolve(); return; }
                    // Find dominant subtree to drop bundled variants
                    let split = top;
                    while (split && split.getChildren) {
                        const k = split.getChildren();
                        if (k.length === 1) split = k[0]; else break;
                    }
                    if (split && split.getChildren && split.getChildren().length > 1) {
                        const groups = new Map();
                        meshes.forEach(m => {
                            let n = m;
                            while (n.parent && n.parent !== split) n = n.parent;
                            if (n.parent === split) {
                                if (!groups.has(n)) groups.set(n, 0);
                                groups.set(n, groups.get(n) + 1);
                            }
                        });
                        let big = null, bigC = 0;
                        groups.forEach((c, anc) => { if (c > bigC) { bigC = c; big = anc; } });
                        if (big && bigC / meshes.length >= 0.40) {
                            groups.forEach((_, anc) => {
                                if (anc !== big && anc.setEnabled) anc.setEnabled(false);
                            });
                        }
                    }
                    // Compute world bounds (skip flat planes)
                    let lo = null, hi = null;
                    meshes.forEach(m => {
                        if (!m.getBoundingInfo || !m.isEnabled || !m.isEnabled()) return;
                        if (m.getClassName && m.getClassName() === 'TransformNode') return;
                        m.computeWorldMatrix(true);
                        const bb = m.getBoundingInfo().boundingBox;
                        const d = bb.maximumWorld.subtract(bb.minimumWorld);
                        const longest = Math.max(d.x, d.y, d.z);
                        const shortest = Math.min(d.x, d.y, d.z);
                        if (longest > 3 && shortest < longest * 0.02) return;
                        if (!lo) { lo = bb.minimumWorld.clone(); hi = bb.maximumWorld.clone(); }
                        else { lo.minimizeInPlace(bb.minimumWorld); hi.maximizeInPlace(bb.maximumWorld); }
                    });
                    if (lo) {
                        const sz = hi.subtract(lo);
                        const longest = Math.max(sz.x, sz.y, sz.z);
                        const factor = (longest > 0.001) ? (4.5 / longest) : 1;
                        if (top.scaling) top.scaling = new BABYLON.Vector3(factor, factor, factor);
                        const cx = (lo.x + hi.x) / 2;
                        const cy = (lo.y + hi.y) / 2;
                        const cz = (lo.z + hi.z) / 2;
                        if (top.position) {
                            top.position.x -= cx * factor;
                            top.position.y -= cy * factor;
                            top.position.z -= cz * factor;
                        }
                    }
                    resolve();
                }, null, () => resolve());
            });
            // Let it render a couple frames
            await sleep(120);
            scene.render();
            await sleep(60);
            // Capture
            await new Promise(res => {
                BABYLON.Tools.CreateScreenshot(engine, cam, { width: 280, height: 160 }, (data) => {
                    window.__carThumbnails[style] = data;
                    if (typeof refreshCarStripCard === 'function') refreshCarStripCard(style);
                    res();
                });
            });
        } catch (e) { /* skip car if it fails */ }
    }
    try { scene.dispose(); engine.dispose(); canvas.remove(); } catch(e) {}
    _thumbsLoading = false;
}

// ── GLB model loader — parents the GLB hierarchy under our orient node.
// Earlier versions cloned each imported mesh into the scene, but mesh.clone()
// recursively clones children, and the loop also cloned those same children
// directly — producing two overlapping subtrees and leaving descendant clones
// stuck in the disabled state of their freshly-disabled originals. The
// turntable then rendered as a half-empty (often fully empty) showroom.
// Reparenting the GLB's __root__ under inner keeps the GLTF's own hierarchy
// and transforms intact and avoids the whole clone-juggle.
function _loadPreviewCar(style, color) {
    const modelInfo = CAR_MODELS[style];
    if (!modelInfo) return null;

    const rootNode = new BABYLON.TransformNode('previewCar_' + style, _previewScene);
    _previewBodyMaterials = [];

    const inner = new BABYLON.TransformNode('previewOrient', _previewScene);
    inner.parent = rootNode;
    if (modelInfo.fixRotation) inner.rotation.x = Math.PI / 2;
    if (modelInfo.rotationX)   inner.rotation.x = (inner.rotation.x || 0) + modelInfo.rotationX;
    if (modelInfo.rotationY)   inner.rotation.y = modelInfo.rotationY;

    const lastSlash = modelInfo.file.lastIndexOf('/');
    const rootUrl  = lastSlash >= 0 ? modelInfo.file.substring(0, lastSlash + 1) : './';
    const fileName = lastSlash >= 0 ? modelInfo.file.substring(lastSlash + 1) : modelInfo.file;

    BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, _previewScene, (meshes) => {
        if (_previewCarRoot !== rootNode) {
            meshes.forEach(m => { try { m.dispose(); } catch(e) {} });
            return;
        }
        console.log('[preview] GLB loaded:', fileName, 'meshes:', meshes.length);

        const parsedColor = BABYLON.Color3.FromHexString(color);

        // Reparent any top-level imported nodes (the GLTF __root__ and any siblings)
        // under our orient node. Children come along automatically.
        meshes.forEach(m => {
            if (!m.parent || m.parent === _previewScene) {
                m.parent = inner;
            }
        });

        // Tint body panels with the selected color. The GLBs load as PBRMaterial,
        // so we read/write `albedoColor` (StandardMaterial uses `diffuseColor` —
        // support both so future swaps don't silently break tinting).
        meshes.forEach((mesh) => {
            if (!mesh.material) return;
            const origMat = mesh.material;
            let mat;
            try { mat = origMat.clone('pmat_' + Math.random().toString(36).slice(2,7)); } catch(e) { mat = origMat; }
            mesh.material = mat;

            // Frustum culling on freshly-reparented meshes can drop them on the
            // first frames before bounding info catches up. Force them active.
            mesh.alwaysSelectAsActiveMesh = true;

            const baseColor = mat.albedoColor || mat.diffuseColor;
            if (!baseColor) return;
            const brightness = (baseColor.r + baseColor.g + baseColor.b) / 3;

            const setBase = (c) => {
                if ('albedoColor' in mat) mat.albedoColor = c;
                if ('diffuseColor' in mat) mat.diffuseColor = c;
            };

            if (brightness > 0.35 && brightness < 0.95) {
                setBase(parsedColor);
                if ('emissiveColor' in mat) mat.emissiveColor = parsedColor.scale(0.04);
                // PBR has metallic/roughness rather than specularPower
                if ('metallic' in mat) { mat.metallic = 0.6; mat.roughness = 0.35; }
                if ('specularColor' in mat) {
                    mat.specularColor = new BABYLON.Color3(0.85, 0.85, 0.9);
                    mat.specularPower = 140;
                }
                _previewBodyMaterials.push(mat);
            } else if (brightness < 0.25) {
                if ('metallic' in mat) { mat.metallic = 0.4; mat.roughness = 0.6; }
                if ('specularColor' in mat) {
                    mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.55);
                    mat.specularPower = 120;
                }
            }
        });

        rootNode.scaling.set(1, 1, 1);
        rootNode.position.set(0, 0, 0);

        setTimeout(() => _previewFitToTurntable(rootNode, fileName), 60);
    }, null, (_scene, message, exception) => {
        console.warn('[preview] GLB load failed for ' + style + ':', message, exception);
        // Clear the dedup flag so the user can click this car again to retry.
        if (_previewLoadedStyle === style) _previewLoadedStyle = null;
    });

    return rootNode;
}

function updateCarPreview() {
    if (!_previewScene) return;
    const car = CARS[GameState.selectedCar];
    if (!car) return;
    const locked = GameState.xp < car.unlock;

    const canvasEl = document.getElementById('car-preview-canvas');
    if (canvasEl) canvasEl.style.opacity = locked ? '0.3' : '1';

    if (locked) {
        if (_previewCarRoot) { _previewCarRoot.dispose(); _previewCarRoot = null; }
        _previewLoadedStyle = null;
        _previewLoadedColor = null;
        return;
    }

    const style = car.style;
    const color = GameState.selectedColor;

    if (_previewLoadedStyle === style && _previewLoadedColor === color) return;

    // Same car, different color — retint materials in place
    if (_previewLoadedStyle === style && _previewCarRoot && _previewLoadedColor !== color) {
        _retintPreviewCar(color);
        _previewLoadedColor = color;
        return;
    }

    // Different car — rebuild
    if (_previewCarRoot) {
        _previewCarRoot.getChildMeshes(false).forEach(m => { try { m.dispose(); } catch(e) {} });
        try { _previewCarRoot.dispose(); } catch(e) {}
        _previewCarRoot = null;
    }
    _previewBodyMaterials = [];

    _previewCarRoot = _loadPreviewCar(style, color);
    _previewRotation = 0;
    _previewLoadedStyle = style;
    _previewLoadedColor = color;
}

// Robust fit: walks every AbstractMesh under root, collects valid world
// bounding boxes, scales root so the longest axis ≈ 4.0, then repositions
// so the car is centered on X/Z with its bottom on the turntable (y=-0.5).
function _previewFitToTurntable(root, label) {
    if (!root || !_previewScene) return;
    if (_previewCarRoot !== root) return;

    // Walk subtree forcing world-matrix + bounding-info refresh on every node.
    // Without this, cloned child meshes keep stale (zero) world bounds — Babylon's
    // frustum culling drops them, so they never render, so the world matrix never
    // refreshes. Result: a turntable with no car on it.
    const refreshAll = (n) => {
        if (n && n.computeWorldMatrix) n.computeWorldMatrix(true);
        if (n && n.refreshBoundingInfo) n.refreshBoundingInfo();
        if (n && n.getChildren) n.getChildren().forEach(refreshAll);
    };

    const collectMeshes = (node) => {
        const out = [];
        const visit = (n) => {
            if (n && n.getClassName && n.getClassName() !== 'TransformNode'
                && n.getBoundingInfo && n.isEnabled && n.isEnabled()) {
                out.push(n);
            }
            if (n && n.getChildren) n.getChildren().forEach(visit);
        };
        visit(node);
        return out;
    };

    const worldBounds = (meshes) => {
        let min = null, max = null;
        for (const m of meshes) {
            const bb = m.getBoundingInfo().boundingBox;
            const lo = bb.minimumWorld, hi = bb.maximumWorld;
            if (!isFinite(lo.x) || !isFinite(hi.x)) continue;
            const dx = hi.x - lo.x, dy = hi.y - lo.y, dz = hi.z - lo.z;
            if (dx < 0.0001 && dy < 0.0001 && dz < 0.0001) continue;
            if (!min) { min = lo.clone(); max = hi.clone(); }
            else { min.minimizeInPlace(lo); max.maximizeInPlace(hi); }
        }
        return min ? { min, max } : null;
    };

    refreshAll(root);
    let meshes = collectMeshes(root);
    if (!meshes.length) { console.warn('[preview] no meshes under', label); return; }

    // Drop baked contact-shadow / decal planes some GLBs ship under the car.
    // They pull the world bbox down — Inferno GT floated above the rings,
    // Supra MK4 rendered as a visible black rectangle on the turntable.
    // Heuristic: the mesh is flat (Y extent ≪ horizontal extent) AND sits in
    // the bottom 15% of the car's overall height. The position check stops
    // us from accidentally hiding flat panels at the top (roof, hood, spoiler).
    const bPre = worldBounds(meshes);
    if (bPre) {
        const fullH = bPre.max.y - bPre.min.y;
        const lowCut = bPre.min.y + fullH * 0.15;
        meshes.forEach(m => {
            const bb = m.getBoundingInfo().boundingBox;
            const lo = bb.minimumWorld, hi = bb.maximumWorld;
            const dx = hi.x - lo.x, dy = hi.y - lo.y, dz = hi.z - lo.z;
            const longestXZ = Math.max(dx, dz);
            if (longestXZ > 0.5 && dy < longestXZ * 0.05 && hi.y < lowCut) {
                try { m.setEnabled(false); } catch(e) {}
            }
        });
        meshes = collectMeshes(root);
    }
    if (!meshes.length) { console.warn('[preview] no meshes after shadow-plane filter for', label); return; }

    const b1 = worldBounds(meshes);
    if (!b1) { console.warn('[preview] no valid bounds for', label); return; }

    // Normalize on length (longest horizontal axis) so every car fills the
    // turntable to the same wheelbase, ignoring height differences.
    const s1 = Math.max(b1.max.x - b1.min.x, b1.max.z - b1.min.z);
    if (s1 < 0.0001) return;

    const target = 6.0;
    const factor = target / s1;
    if (factor < 0.001 || factor > 1000) { console.warn('[preview] factor out of range', factor); return; }

    // Apply scaling AND centering on `inner` (root's child), not on root
    // itself. Root only carries rotation — its origin must stay at (0,0,0)
    // so the turntable spin keeps the car in place. If we offset root's
    // position, every frame's rotation orbits the car across the platform.
    const inner = root.getChildren()[0]; // the orient node created in _loadPreviewCar
    if (!inner) return;
    inner.scaling.copyFromFloats(factor, factor, factor);
    refreshAll(root);

    const b3 = worldBounds(meshes);
    if (!b3) return;
    // Shift inner so the meshes' world-space bbox center lands at (0,0,0)
    // (root's pivot) — when root rotates, the car spins in place.
    inner.position.x -= (b3.min.x + b3.max.x) / 2;
    inner.position.y -= (b3.min.y + b3.max.y) / 2;
    inner.position.z -= (b3.min.z + b3.max.z) / 2;
    refreshAll(root);

    // Reposition the rings + floor disc directly under the car's actual
    // visual bottom — works regardless of GLB origin convention.
    const b4 = worldBounds(meshes);
    if (b4) {
        const carBottomY = b4.min.y;
        const carCenterY = (b4.min.y + b4.max.y) / 2;
        const floor = _previewScene.getMeshByName('pfloor');
        const ring  = _previewScene.getMeshByName('pring');
        const ring2 = _previewScene.getMeshByName('pring2');
        // Floor + rings sit at the car's bottom. Tiny offsets so the rings
        // are crisp above the floor, no z-fighting.
        if (floor) floor.position.y = carBottomY - 0.001;
        if (ring)  ring.position.y  = carBottomY;
        if (ring2) ring2.position.y = carBottomY;
        if (_previewCamera) _previewCamera.target = new BABYLON.Vector3(0, carCenterY, 0);
    }

    console.log('[preview] fit', label, 'native=', s1.toFixed(2), 'factor=', factor.toFixed(3));

    // Capture a thumbnail of this car for the strip cards. Schedule a few
    // frames out so the scene has time to render with materials/lighting
    // settled. Cache by style so we only do it once per car.
    window.__carThumbnails = window.__carThumbnails || {};
    const captureStyle = _previewLoadedStyle;
    if (captureStyle && !window.__carThumbnails[captureStyle]) {
        setTimeout(() => {
            try {
                if (!_previewEngine || !_previewCamera) return;
                BABYLON.Tools.CreateScreenshot(_previewEngine, _previewCamera,
                    { width: 280, height: 160 }, (data) => {
                        window.__carThumbnails[captureStyle] = data;
                        if (typeof refreshCarStripCard === 'function') {
                            refreshCarStripCard(captureStyle);
                        }
                    });
            } catch(e) { /* graceful */ }
        }, 350);
    }
}

function _retintPreviewCar(color) {
    if (!_previewBodyMaterials.length) return;
    const target = BABYLON.Color3.FromHexString(color);
    _previewBodyMaterials.forEach(m => {
        if ('albedoColor' in m) m.albedoColor = target;
        if ('diffuseColor' in m) m.diffuseColor = target;
        if ('emissiveColor' in m) m.emissiveColor = target.scale(0.05);
    });
}

function disposeCarPreview() {
    if (_previewEngine) _previewEngine.stopRenderLoop();
    if (_previewScene) { try { _previewScene.dispose(); } catch(e) {} _previewScene = null; }
    if (_previewEngine) { try { _previewEngine.dispose(); } catch(e) {} _previewEngine = null; }
    _previewCamera = null;
    _previewCarRoot = null;
    _previewLoadedStyle = null;
    _previewLoadedColor = null;
    _previewAccentLights = [];
    _previewBodyMaterials = [];
}

// ============================================================
//  TRACK 3D PREVIEW — lightweight Babylon scene that renders the
//  selected track's curve as a 3D ribbon with ground + sky tints.
// ============================================================
let _trackPrevEngine = null;
let _trackPrevScene = null;
let _trackPrevCamera = null;
let _trackPrevTrackId = null;
let _trackPrevAutoSpin = true;
let _trackPrevIdleSince = 0;
let _trackPrevResizeWired = false;

function initTrackPreview() {
    const canvas = document.getElementById('track-preview-canvas');
    if (!canvas) return;

    if (!_trackPrevEngine) {
        _trackPrevEngine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true, alpha: true, antialias: true
        });
        _trackPrevScene = new BABYLON.Scene(_trackPrevEngine);
        _trackPrevScene.useRightHandedSystem = true;
        _trackPrevScene.clearColor = new BABYLON.Color4(0.03, 0.04, 0.08, 1);

        _trackPrevCamera = new BABYLON.ArcRotateCamera(
            'trackPrevCam',
            -Math.PI / 2, Math.PI / 3.4, 520,
            new BABYLON.Vector3(0, 0, 0),
            _trackPrevScene
        );
        _trackPrevCamera.fov = 0.7;
        _trackPrevCamera.minZ = 1; _trackPrevCamera.maxZ = 4000;
        _trackPrevCamera.lowerRadiusLimit = 200;
        _trackPrevCamera.upperRadiusLimit = 1200;
        _trackPrevCamera.wheelPrecision = 1.5;
        _trackPrevCamera.angularSensibilityX = 1500;
        _trackPrevCamera.angularSensibilityY = 1500;
        _trackPrevCamera.panningSensibility = 0;
        _trackPrevCamera.attachControl(canvas, true);

        // Lighting
        const hemi = new BABYLON.HemisphericLight('tphemi', new BABYLON.Vector3(0, 1, 0), _trackPrevScene);
        hemi.intensity = 0.95;
        const dir = new BABYLON.DirectionalLight('tpdir', new BABYLON.Vector3(-0.4, -0.8, -0.3), _trackPrevScene);
        dir.intensity = 0.7;

        // Pause auto-spin while user drags
        const markActive = () => { _trackPrevIdleSince = performance.now(); };
        canvas.addEventListener('pointerdown', markActive);
        canvas.addEventListener('pointermove', e => { if (e.buttons) markActive(); });
        canvas.addEventListener('wheel', markActive, { passive: true });

        _trackPrevEngine.runRenderLoop(() => {
            if (!_trackPrevScene) return;
            if (_trackPrevAutoSpin && _trackPrevCamera && (performance.now() - _trackPrevIdleSince) > 1500) {
                _trackPrevCamera.alpha -= 0.0028;
            }
            _trackPrevScene.render();
        });

        if (!_trackPrevResizeWired) {
            window.addEventListener('resize', () => { if (_trackPrevEngine) _trackPrevEngine.resize(); });
            _trackPrevResizeWired = true;
        }
    }

    requestAnimationFrame(() => {
        if (_trackPrevEngine) _trackPrevEngine.resize();
        setTimeout(() => { if (_trackPrevEngine) _trackPrevEngine.resize(); }, 120);
    });
}

function _trackPrevShape(trackDef) {
    if (trackDef.trackModel) {
        return { h1: 3, h2: 5, ph1: 0, ph2: 0, a1: 60, a2: 30,
                 h3: 1, ph3a: 0, a3: 0, xScale: 1, zScale: 1, rot: 0, ph3: 0 };
    }
    let h = 0;
    const n = trackDef.name || '';
    for (let i = 0; i < n.length; i++) h = ((h * 31) + n.charCodeAt(i)) | 0;
    h = h >>> 0;
    return {
        h1: 2 + (h & 7), h2: 3 + ((h >> 3) & 7), h3: 1 + ((h >> 26) & 1),
        ph1: ((h >> 6) & 15) * 0.4, ph2: ((h >> 10) & 15) * 0.4, ph3a: ((h >> 24) & 7) * 0.7,
        a1: 30 + ((h >> 14) & 31), a2: 15 + ((h >> 19) & 23), a3: 20 + ((h >> 27) & 15),
        xScale: 0.7 + ((h >> 16) & 7) * 0.10, zScale: 0.7 + ((h >> 28) & 7) * 0.10,
        rot: ((h >> 12) & 7) * (Math.PI / 4),
        ph3: ((h >> 22) & 15) * 0.5,
    };
}

function _trackPrevSamplePath(trackDef) {
    // Same Catmull-Rom curve as track.js generateTrack — F1 shapes win when
    // present, otherwise hashed harmonics + oval stretch + rotation.
    const n = trackDef.segments;
    const radius = 200;
    const sh = _trackPrevShape(trackDef);
    const cr = Math.cos(sh.rot), sr = Math.sin(sh.rot);
    const coarse = [];
    const f1 = (typeof F1_TRACK_SHAPES !== 'undefined')
        ? F1_TRACK_SHAPES[trackDef.name] : null;
    if (f1 && f1.length >= 6) {
        const fr = (typeof F1_TRACK_RADIUS !== 'undefined') ? F1_TRACK_RADIUS : radius;
        for (let i = 0; i < f1.length; i++) {
            const [nx, nz] = f1[i];
            const t = i / f1.length * Math.PI * 2;
            const y = Math.sin(t * 2 + sh.ph3) * trackDef.hills * 15 + Math.cos(t * 4) * trackDef.hills * 8;
            coarse.push(new BABYLON.Vector3(nx * fr, Math.max(y, 0.5), nz * fr));
        }
    } else {
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const wiggle = Math.sin(a * sh.h1 + sh.ph1) * trackDef.maxCurve * sh.a1
                     + Math.cos(a * sh.h2 + sh.ph2) * trackDef.maxCurve * sh.a2
                     + Math.sin(a * sh.h3 + sh.ph3a) * trackDef.maxCurve * sh.a3;
        const r = radius + wiggle;
        const ux = Math.cos(a) * r * sh.xScale;
        const uz = Math.sin(a) * r * sh.zScale;
        const x = ux * cr - uz * sr;
        const z = ux * sr + uz * cr;
        const y = Math.sin(a * 2 + sh.ph3) * trackDef.hills * 15 + Math.cos(a * 4) * trackDef.hills * 8;
        coarse.push(new BABYLON.Vector3(x, Math.max(y, 0.5), z));
    }
    }
    const sub = 4;
    const out = [];
    for (let i = 0; i < coarse.length; i++) {
        const p0 = coarse[(i - 1 + coarse.length) % coarse.length];
        const p1 = coarse[i];
        const p2 = coarse[(i + 1) % coarse.length];
        const p3 = coarse[(i + 2) % coarse.length];
        for (let s = 0; s < sub; s++) {
            const t = s / sub;
            const t2 = t * t, t3 = t2 * t;
            const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
            const z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
            out.push(new BABYLON.Vector3(x, Math.max(y, 0.3), z));
        }
    }
    return out;
}

function updateTrackPreview() {
    if (!_trackPrevScene) return;
    const t = TRACKS[GameState.selectedTrack];
    if (!t) return;
    if (_trackPrevTrackId === t.name) return; // already showing this one
    _trackPrevTrackId = t.name;

    // Wipe everything from the scene except camera + lights
    const keep = ['trackPrevCam', 'tphemi', 'tpdir'];
    [..._trackPrevScene.meshes].forEach(m => { if (!keep.includes(m.name)) m.dispose(); });
    [..._trackPrevScene.materials].forEach(m => { try { m.dispose(); } catch(e) {} });

    // Sky tint via clearColor
    const skyR = ((t.skyColor >> 16) & 255) / 255;
    const skyG = ((t.skyColor >> 8) & 255) / 255;
    const skyB = (t.skyColor & 255) / 255;
    _trackPrevScene.clearColor = new BABYLON.Color4(skyR * 0.55, skyG * 0.55, skyB * 0.55, 1);

    // If this track has a baked GLB model, load it instead of the procedural
    // ribbon + scenery (saves a lot of redundant work and keeps the preview
    // in sync with the in-race visuals).
    if (t.trackModel) {
        const lastSlash = t.trackModel.lastIndexOf('/');
        const rootUrl = lastSlash >= 0 ? t.trackModel.substring(0, lastSlash + 1) : './';
        const fileName = lastSlash >= 0 ? t.trackModel.substring(lastSlash + 1) : t.trackModel;
        BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, _trackPrevScene, () => {
            // Frame the camera around the imported model
            if (_trackPrevCamera) _trackPrevCamera.radius = 600;
        }, null, (s, msg) => console.warn('[trackpreview] GLB failed:', msg));
        return;
    }

    // Ground disc (biome color)
    const ground = BABYLON.MeshBuilder.CreateGround('tpground', { width: 1400, height: 1400, subdivisions: 1 }, _trackPrevScene);
    const groundMat = new BABYLON.StandardMaterial('tpgroundMat', _trackPrevScene);
    const gR = ((t.groundColor >> 16) & 255) / 255;
    const gG = ((t.groundColor >> 8) & 255) / 255;
    const gB = (t.groundColor & 255) / 255;
    groundMat.diffuseColor = new BABYLON.Color3(gR, gG, gB);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;
    ground.position.y = -0.5;

    // Track ribbon — extrude a flat 2D shape along the curve
    const path = _trackPrevSamplePath(t);
    const hw = (t.trackWidth || 14) / 2;
    const ribbonRows = [path.map(p => new BABYLON.Vector3(p.x, p.y + 0.05, p.z))];
    // Build left/right edges by offsetting each path point along its right vector
    const left = [], right = [];
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const next = path[(i + 1) % path.length];
        const dirX = next.x - p.x, dirZ = next.z - p.z;
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        // Right perpendicular in XZ (rotate dir by -90°)
        const rx = dirZ / len, rz = -dirX / len;
        left.push(new BABYLON.Vector3(p.x - rx * hw, p.y + 0.06, p.z - rz * hw));
        right.push(new BABYLON.Vector3(p.x + rx * hw, p.y + 0.06, p.z + rz * hw));
    }
    // Close the loop
    left.push(left[0]); right.push(right[0]);
    const ribbon = BABYLON.MeshBuilder.CreateRibbon('tpribbon', {
        pathArray: [left, right], closeArray: false, closePath: false, sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, _trackPrevScene);
    const ribbonMat = new BABYLON.StandardMaterial('tpribbonMat', _trackPrevScene);
    ribbonMat.diffuseColor = new BABYLON.Color3(0.18, 0.19, 0.22);
    ribbonMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    ribbon.material = ribbonMat;
    ribbon.receiveShadows = true;

    // Track edges — orange "rumble strip" lines
    const edgeMat = new BABYLON.StandardMaterial('tpedgeMat', _trackPrevScene);
    edgeMat.disableLighting = true;
    edgeMat.emissiveColor = new BABYLON.Color3(1, 0.42, 0.15);
    edgeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    const lineLeft = BABYLON.MeshBuilder.CreateLines('tpedgeL', {
        points: left.map(p => new BABYLON.Vector3(p.x, p.y + 0.02, p.z)),
        useVertexAlpha: false
    }, _trackPrevScene);
    lineLeft.color = new BABYLON.Color3(1, 0.42, 0.15);
    const lineRight = BABYLON.MeshBuilder.CreateLines('tpedgeR', {
        points: right.map(p => new BABYLON.Vector3(p.x, p.y + 0.02, p.z)),
        useVertexAlpha: false
    }, _trackPrevScene);
    lineRight.color = new BABYLON.Color3(1, 0.42, 0.15);

    // Start/finish marker
    const startMarker = BABYLON.MeshBuilder.CreateBox('tpstart', { width: hw * 2 + 1, height: 0.4, depth: 1.2 }, _trackPrevScene);
    const startMat = new BABYLON.StandardMaterial('tpstartMat', _trackPrevScene);
    startMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    startMat.emissiveColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    startMarker.material = startMat;
    if (path.length > 0) {
        const sp = path[0];
        const np = path[1] || path[0];
        startMarker.position.set(sp.x, sp.y + 0.1, sp.z);
        startMarker.rotation.y = Math.atan2(np.x - sp.x, np.z - sp.z);
    }

    // Biome scenery
    _trackPrevAddScenery(t, path, hw);
}

// ── Biome-specific scenery for the 3D track preview. Lightweight stylized
// shapes — placed randomly outside the track but inside the ground disc.
function _trackPrevAddScenery(t, path, hw) {
    return; // scenery disabled
    const name = t.name;
    const isCity = name === 'Baku Streets' || name === 'Jeddah Corniche' || name === 'Las Vegas Strip' || name === 'Shanghai';
    const isDesert = name === 'Austin COTA';
    const isVolcano = false;
    const isSnow = name === 'Fuji Speedway';
    const isTropical = name === 'Miami Gardens' || name === 'Sepang';
    const isCoastal = name === 'Zandvoort';
    const isForest = name === 'Imola' || name === 'Mugello' || name === 'Hockenheim';
    const isSunny = name === 'Interlagos' || name === 'Mexico Hermanos' || name === 'Red Bull Ring';

    // Quick deterministic RNG so previews are consistent
    let seed = 1234;
    const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // Helper: is a point near the track? Skip placements there.
    const samples = path.filter((_, i) => i % 3 === 0);
    const nearTrack = (x, z, margin) => {
        const m2 = (margin || hw + 4) ** 2;
        for (const p of samples) {
            const dx = p.x - x, dz = p.z - z;
            if (dx * dx + dz * dz < m2) return true;
        }
        return false;
    };

    const pickSpot = (innerR, outerR, margin) => {
        for (let tries = 0; tries < 12; tries++) {
            const a = rand() * Math.PI * 2;
            const r = innerR + rand() * (outerR - innerR);
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            if (!nearTrack(x, z, margin)) return { x, z };
        }
        return null;
    };

    // ── Materials ──
    const mkMat = (name, diff, emis) => {
        const m = new BABYLON.StandardMaterial('tps_' + name, _trackPrevScene);
        m.diffuseColor = new BABYLON.Color3(diff[0], diff[1], diff[2]);
        if (emis) m.emissiveColor = new BABYLON.Color3(emis[0], emis[1], emis[2]);
        m.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        return m;
    };
    const trunkMat = mkMat('trunk', [0.32, 0.20, 0.12]);
    const pineMat = mkMat('pine', [0.10, 0.42, 0.16]);
    const autumnMat = mkMat('autumn', [0.85, 0.42, 0.10]);
    const palmLeafMat = mkMat('palm', [0.18, 0.55, 0.18]);
    const cactusMat = mkMat('cactus', [0.18, 0.45, 0.18]);
    const sandMat = mkMat('sand', [0.86, 0.72, 0.42]);
    const stoneMat = mkMat('stone', [0.55, 0.48, 0.36]);
    const sphinxMat = mkMat('sphinx', [0.78, 0.62, 0.36]);
    const snowMat = mkMat('snow', [0.96, 0.97, 1.0], [0.05, 0.06, 0.08]);
    const rockMat = mkMat('rock', [0.32, 0.30, 0.30]);
    const lavaMat = (() => {
        const m = mkMat('lava', [0, 0, 0], [1.0, 0.32, 0.05]);
        m.disableLighting = true;
        return m;
    })();
    const buildingMat = mkMat('bldg', [0.22, 0.24, 0.30], [0.04, 0.05, 0.08]);
    const waterMat = (() => {
        const m = mkMat('water', [0, 0, 0], [0.10, 0.40, 0.72]);
        m.disableLighting = true;
        return m;
    })();

    const addPineTree = (x, z, scale, mat) => {
        const trunk = BABYLON.MeshBuilder.CreateCylinder('tpTrunk', { diameterTop: 0.5 * scale, diameterBottom: 0.7 * scale, height: 4 * scale, tessellation: 8 }, _trackPrevScene);
        trunk.material = trunkMat;
        trunk.position.set(x, 2 * scale, z);
        const cone = BABYLON.MeshBuilder.CreateCylinder('tpPine', { diameterTop: 0, diameterBottom: 5 * scale, height: 9 * scale, tessellation: 12 }, _trackPrevScene);
        cone.material = mat;
        cone.position.set(x, 4 * scale + 4.5 * scale, z);
    };

    const addPalmTree = (x, z, scale) => {
        const trunk = BABYLON.MeshBuilder.CreateCylinder('tpTrunk', { diameterTop: 0.4 * scale, diameterBottom: 0.7 * scale, height: 7 * scale, tessellation: 8 }, _trackPrevScene);
        trunk.material = trunkMat;
        trunk.position.set(x, 3.5 * scale, z);
        // Leaf fan: a few flat planes
        for (let i = 0; i < 6; i++) {
            const leaf = BABYLON.MeshBuilder.CreatePlane('tpLeaf', { width: 6 * scale, height: 1.4 * scale, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, _trackPrevScene);
            leaf.material = palmLeafMat;
            leaf.position.set(x, 7 * scale, z);
            leaf.rotation.y = (i / 6) * Math.PI * 2;
            leaf.rotation.z = -0.4;
        }
    };

    const addCactus = (x, z, scale) => {
        const body = BABYLON.MeshBuilder.CreateCylinder('tpCactus', { diameter: 1.3 * scale, height: 5 * scale, tessellation: 10 }, _trackPrevScene);
        body.material = cactusMat;
        body.position.set(x, 2.5 * scale, z);
        // Two arms
        for (const side of [-1, 1]) {
            const arm = BABYLON.MeshBuilder.CreateCylinder('tpCactusArm', { diameter: 0.9 * scale, height: 2.5 * scale, tessellation: 8 }, _trackPrevScene);
            arm.material = cactusMat;
            arm.position.set(x + side * 1.0 * scale, 3.7 * scale, z);
            arm.rotation.z = side * 0.5;
            const armUp = BABYLON.MeshBuilder.CreateCylinder('tpCactusUp', { diameter: 0.85 * scale, height: 1.6 * scale, tessellation: 8 }, _trackPrevScene);
            armUp.material = cactusMat;
            armUp.position.set(x + side * 1.5 * scale, 4.6 * scale, z);
        }
    };

    const addPyramid = (x, z, base, height) => {
        // 4-sided pyramid via a square cylinder (tessellation 4)
        const py = BABYLON.MeshBuilder.CreateCylinder('tpPyramid', {
            diameterTop: 0, diameterBottom: base * 1.414, height: height, tessellation: 4
        }, _trackPrevScene);
        py.material = sandMat;
        py.position.set(x, height / 2, z);
        py.rotation.y = Math.PI / 4;
    };

    const addSphinx = (x, z) => {
        const root = new BABYLON.TransformNode('tpSphinx', _trackPrevScene);
        root.position.set(x, 0, z);
        // Body — long stepped block
        const body = BABYLON.MeshBuilder.CreateBox('tpSphinxBody', { width: 6, height: 5, depth: 18 }, _trackPrevScene);
        body.material = sphinxMat; body.position.y = 2.5; body.parent = root;
        // Front legs
        const legs = BABYLON.MeshBuilder.CreateBox('tpSphinxLegs', { width: 6, height: 3, depth: 6 }, _trackPrevScene);
        legs.material = sphinxMat; legs.position.set(0, 1.5, 9); legs.parent = root;
        // Head — smaller cube on top of front
        const head = BABYLON.MeshBuilder.CreateBox('tpSphinxHead', { width: 3.6, height: 4, depth: 3.6 }, _trackPrevScene);
        head.material = sphinxMat; head.position.set(0, 7, 7); head.parent = root;
        // Headdress: triangular nemes drape angled out from the head
        for (const side of [-1, 1]) {
            const drape = BABYLON.MeshBuilder.CreateBox('tpSphinxDrape', { width: 1.5, height: 4, depth: 4 }, _trackPrevScene);
            drape.material = sphinxMat; drape.position.set(side * 2.0, 6.5, 7); drape.parent = root;
        }
        // Pedestal under sphinx
        const ped = BABYLON.MeshBuilder.CreateBox('tpSphinxPed', { width: 9, height: 1, depth: 24 }, _trackPrevScene);
        ped.material = stoneMat; ped.position.set(0, 0.5, 4); ped.parent = root;
    };

    const addRock = (x, z, scale) => {
        const r = BABYLON.MeshBuilder.CreateSphere('tpRock', { diameter: 3 * scale, segments: 5 }, _trackPrevScene);
        r.material = rockMat; r.position.set(x, 1.2 * scale, z);
        r.scaling.y = 0.6;
    };

    const addBuilding = (x, z, w, h, d) => {
        const b = BABYLON.MeshBuilder.CreateBox('tpBldg', { width: w, height: h, depth: d }, _trackPrevScene);
        b.material = buildingMat; b.position.set(x, h / 2, z);
        // Glow strip near the top to suggest windows
        const top = BABYLON.MeshBuilder.CreateBox('tpBldgTop', { width: w * 1.02, height: 1.5, depth: d * 1.02 }, _trackPrevScene);
        const tm = mkMat('bldgTop', [0, 0, 0], [1.0, 0.7, 0.2]);
        tm.disableLighting = true;
        top.material = tm; top.position.set(x, h - 1.5, z);
    };

    const addWaterPool = (x, z, r) => {
        const pool = BABYLON.MeshBuilder.CreateDisc('tpPool', { radius: r, tessellation: 28 }, _trackPrevScene);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(x, 0.05, z);
        pool.material = waterMat;
    };

    const addLavaPool = (x, z, r) => {
        const pool = BABYLON.MeshBuilder.CreateDisc('tpLava', { radius: r, tessellation: 28 }, _trackPrevScene);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(x, 0.05, z);
        pool.material = lavaMat;
    };

    const addMountain = (x, z, height, baseDia, snowy) => {
        const m = BABYLON.MeshBuilder.CreateCylinder('tpMtn', {
            diameterTop: 4, diameterBottom: baseDia, height: height, tessellation: 18
        }, _trackPrevScene);
        m.material = snowy ? snowMat : rockMat;
        m.position.set(x, height / 2, z);
    };

    // ── Place scenery ──
    if (isDesert) {
        // Pyramids — three large ones at distinctive positions
        addPyramid(-260, -180, 80, 110);
        addPyramid(180, -300, 65, 90);
        addPyramid(310, 220, 55, 75);
        // Sphinx in a clear spot
        addSphinx(-280, 240);
        // Cacti scattered around
        for (let i = 0; i < 30; i++) {
            const s = pickSpot(220, 520, hw + 12);
            if (s) addCactus(s.x, s.z, 1 + rand() * 1.2);
        }
        // Rocks
        for (let i = 0; i < 25; i++) {
            const s = pickSpot(220, 520, hw + 8);
            if (s) addRock(s.x, s.z, 1 + rand() * 1.5);
        }
    } else if (isVolcano) {
        // Crater rim — short visible lip instead of a full chamber that
        // blocks the camera view of the track inside.
        const rim = BABYLON.MeshBuilder.CreateTorus('tpCrater', {
            diameter: 760, thickness: 16, tessellation: 56
        }, _trackPrevScene);
        const rimMat = mkMat('crater', [0.22, 0.13, 0.10], [0.06, 0.02, 0.01]);
        rim.material = rimMat;
        rim.position.y = 8;
        // Lava ring
        const lavaRing = BABYLON.MeshBuilder.CreateTorus('tpLavaRing', {
            diameter: 700, thickness: 12, tessellation: 56
        }, _trackPrevScene);
        lavaRing.material = lavaMat; lavaRing.position.y = 0.5;
        // Lava pools inside
        for (let i = 0; i < 8; i++) {
            const s = pickSpot(240, 320, hw + 10);
            if (s) addLavaPool(s.x, s.z, 6 + rand() * 8);
        }
        // Smaller lava cracks closer to the track
        for (let i = 0; i < 6; i++) {
            const s = pickSpot(220, 300, hw + 8);
            if (s) addLavaPool(s.x, s.z, 3 + rand() * 4);
        }
        // Black rocks
        for (let i = 0; i < 18; i++) {
            const s = pickSpot(240, 340, hw + 8);
            if (s) addRock(s.x, s.z, 1.5 + rand() * 1.5);
        }
    } else if (isSnow) {
        // Central peak
        addMountain(0, 0, 240, 280, true);
        // Foothill ring
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + 0.4;
            const r = 145;
            addMountain(Math.cos(a) * r, Math.sin(a) * r, 30 + (i % 3) * 6, 30 + (i % 3) * 6, true);
        }
        // Pine trees outside the ring
        for (let i = 0; i < 24; i++) {
            const s = pickSpot(240, 480, hw + 8);
            if (s) addPineTree(s.x, s.z, 0.9 + rand() * 0.6, snowMat);
        }
    } else if (isCity) {
        // Buildings outside the loop
        for (let i = 0; i < 32; i++) {
            const s = pickSpot(230, 520, hw + 10);
            if (s) addBuilding(s.x, s.z, 12 + rand() * 16, 30 + rand() * 80, 12 + rand() * 16);
        }
    } else if (isForest) {
        // Dense autumn trees + a river
        addWaterPool(-280, 260, 50);
        for (let i = 0; i < 70; i++) {
            const s = pickSpot(230, 520, hw + 6);
            if (s) addPineTree(s.x, s.z, 0.9 + rand() * 0.7, rand() < 0.45 ? autumnMat : pineMat);
        }
    } else if (isTropical || isCoastal) {
        // Ocean ring + palm trees + scattered rocks
        const ocean = BABYLON.MeshBuilder.CreateDisc('tpOcean', { radius: 520, tessellation: 48 }, _trackPrevScene);
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -0.3;
        const omat = mkMat('ocean', [0, 0, 0], [0.10, 0.42, 0.78]);
        omat.disableLighting = true;
        ocean.material = omat;
        // The track island — a sand disc
        const island = BABYLON.MeshBuilder.CreateDisc('tpIsland', { radius: 320, tessellation: 48 }, _trackPrevScene);
        island.rotation.x = -Math.PI / 2;
        island.position.y = -0.2;
        const imat = mkMat('island', [0.86, 0.78, 0.50]);
        island.material = imat;
        for (let i = 0; i < 30; i++) {
            const s = pickSpot(230, 305, hw + 8);
            if (s) addPalmTree(s.x, s.z, 0.9 + rand() * 0.6);
        }
    } else {
        // Sunny Valley + default — pine trees + a couple of lakes
        if (isSunny) addWaterPool(-280, -260, 70);
        for (let i = 0; i < 40; i++) {
            const s = pickSpot(230, 520, hw + 8);
            if (s) addPineTree(s.x, s.z, 0.9 + rand() * 0.7, pineMat);
        }
    }
}

function disposeTrackPreview() {
    if (_trackPrevEngine) _trackPrevEngine.stopRenderLoop();
    if (_trackPrevScene) { try { _trackPrevScene.dispose(); } catch(e) {} _trackPrevScene = null; }
    if (_trackPrevEngine) { try { _trackPrevEngine.dispose(); } catch(e) {} _trackPrevEngine = null; }
    _trackPrevCamera = null;
    _trackPrevTrackId = null;
}
