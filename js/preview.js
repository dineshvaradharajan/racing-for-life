// ============================================================
//  CAR PREVIEW — Rotating 3D model on the car-select screen
// ============================================================
let _previewEngine = null;
let _previewScene = null;
let _previewCamera = null;
let _previewCarRoot = null;
let _previewLoadedStyle = null;
let _previewLoadedColor = null;
let _previewRotation = 0;

function initCarPreview() {
    const canvas = document.getElementById('car-preview-canvas');
    if (!canvas) return;

    if (!_previewEngine) {
        _previewEngine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            alpha: true,
        });
        _previewScene = new BABYLON.Scene(_previewEngine);
        _previewScene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

        _previewCamera = new BABYLON.ArcRotateCamera(
            'previewCam',
            -Math.PI / 2 - 0.35,
            Math.PI / 2 - 0.28,
            8.5,
            BABYLON.Vector3.Zero(),
            _previewScene
        );
        _previewCamera.fov = 0.7;
        _previewCamera.minZ = 0.1;

        const hemi = new BABYLON.HemisphericLight('phemi', new BABYLON.Vector3(0, 1, 0.3), _previewScene);
        hemi.intensity = 0.85;
        hemi.diffuse = new BABYLON.Color3(1, 0.96, 0.9);
        hemi.groundColor = new BABYLON.Color3(0.14, 0.14, 0.25);

        const key = new BABYLON.DirectionalLight('pkey', new BABYLON.Vector3(-0.4, -0.7, -0.6).normalize(), _previewScene);
        key.intensity = 1.25;
        key.diffuse = new BABYLON.Color3(1, 0.96, 0.88);
        key.specular = new BABYLON.Color3(1, 0.96, 0.88);

        const rim = new BABYLON.DirectionalLight('prim', new BABYLON.Vector3(0.45, -0.25, 0.85).normalize(), _previewScene);
        rim.intensity = 0.8;
        rim.diffuse = new BABYLON.Color3(0.6, 0.78, 1.0);
        rim.specular = new BABYLON.Color3(0.6, 0.78, 1.0);

        try {
            const envTex = BABYLON.CubeTexture.CreateFromPrefilteredData(
                'https://assets.babylonjs.com/environments/environmentSpecular.env', _previewScene
            );
            _previewScene.environmentTexture = envTex;
            _previewScene.environmentIntensity = 0.95;
        } catch(e) { /* graceful */ }

        // Turntable disc floor with soft reflection
        const floor = BABYLON.MeshBuilder.CreateDisc('pfloor', { radius: 3.6, tessellation: 64 }, _previewScene);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = -0.45;
        const floorMat = new BABYLON.StandardMaterial('pfloorMat', _previewScene);
        floorMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.08);
        floorMat.specularColor = new BABYLON.Color3(0.35, 0.35, 0.42);
        floorMat.specularPower = 40;
        floorMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.04);
        if (_previewScene.environmentTexture) {
            floorMat.reflectionTexture = _previewScene.environmentTexture;
            floorMat.reflectionTexture.level = 0.35;
        }
        floor.material = floorMat;

        // Subtle ring glow under the car
        const ring = BABYLON.MeshBuilder.CreateTorus('pring', { diameter: 6.2, thickness: 0.05, tessellation: 48 }, _previewScene);
        ring.position.y = -0.43;
        const ringMat = new BABYLON.StandardMaterial('pringMat', _previewScene);
        ringMat.disableLighting = true;
        ringMat.emissiveColor = new BABYLON.Color3(1, 0.42, 0.2);
        ring.material = ringMat;

        try {
            const glow = new BABYLON.GlowLayer('pglow', _previewScene);
            glow.intensity = 0.9;
        } catch(e) { /* graceful */ }

        // Image processing — punchy look
        _previewScene.imageProcessingConfiguration.toneMappingEnabled = true;
        _previewScene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        _previewScene.imageProcessingConfiguration.exposure = 1.2;
        _previewScene.imageProcessingConfiguration.contrast = 1.15;

        _previewEngine.runRenderLoop(() => {
            if (!_previewScene) return;
            if (_previewCarRoot) {
                _previewRotation += 0.008;
                _previewCarRoot.rotation.y = _previewRotation;
            }
            _previewScene.render();
        });

        window.addEventListener('resize', () => { if (_previewEngine) _previewEngine.resize(); });
    }

    setTimeout(() => { if (_previewEngine) _previewEngine.resize(); }, 60);
    updateCarPreview();
}

function updateCarPreview() {
    if (!_previewScene) return;
    const car = CARS[GameState.selectedCar];
    if (!car) return;
    const locked = GameState.xp < car.unlock;

    const previewWrap = document.getElementById('car-preview-canvas');
    if (previewWrap) previewWrap.style.opacity = locked ? '0.25' : '1';

    if (locked) {
        if (_previewCarRoot) { _previewCarRoot.dispose(); _previewCarRoot = null; }
        _previewLoadedStyle = null;
        _previewLoadedColor = null;
        return;
    }

    const style = car.style;
    const color = GameState.selectedColor;

    if (_previewLoadedStyle === style && _previewLoadedColor === color) return;

    if (_previewLoadedStyle === style && _previewCarRoot && _previewLoadedColor !== color) {
        _retintPreviewCar(color);
        _previewLoadedColor = color;
        return;
    }

    if (_previewCarRoot) { _previewCarRoot.dispose(); _previewCarRoot = null; }

    const modelInfo = CAR_MODELS[style];
    if (!modelInfo) return;

    const lastSlash = modelInfo.file.lastIndexOf('/');
    const rootUrl = lastSlash >= 0 ? modelInfo.file.substring(0, lastSlash + 1) : './';
    const fileName = lastSlash >= 0 ? modelInfo.file.substring(lastSlash + 1) : modelInfo.file;

    const root = new BABYLON.TransformNode('previewRoot', _previewScene);
    _previewCarRoot = root;
    _previewRotation = 0;

    BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, _previewScene, (meshes) => {
        if (_previewCarRoot !== root) {
            meshes.forEach(m => m.dispose && m.dispose());
            return;
        }
        let innerParent = root;
        if (modelInfo.fixRotation) {
            const fix = new BABYLON.TransformNode('previewFix', _previewScene);
            fix.parent = root;
            fix.rotation.x = Math.PI / 2;
            innerParent = fix;
        }

        const targetColor = BABYLON.Color3.FromHexString(color);
        meshes.forEach((mesh, idx) => {
            if (idx === 0 && mesh.getClassName && mesh.getClassName() === 'TransformNode') {
                mesh.parent = innerParent;
                return;
            }
            mesh.parent = innerParent;

            if (mesh.material) {
                try {
                    const m = mesh.material.clone('pmat_' + idx + '_' + Math.random().toString(36).slice(2,6));
                    const d = m.diffuseColor;
                    if (d) {
                        const b = (d.r + d.g + d.b) / 3;
                        if (b > 0.35 && b < 0.95) {
                            m.diffuseColor = targetColor;
                            m.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
                            m.specularPower = 120;
                            m.emissiveColor = targetColor.scale(0.04);
                            if (_previewScene.environmentTexture) {
                                m.reflectionTexture = _previewScene.environmentTexture;
                                m.reflectionTexture.level = 0.55;
                                m.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                                m.reflectionFresnelParameters.leftColor = new BABYLON.Color3(1, 1, 1);
                                m.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0.1, 0.1, 0.1);
                                m.reflectionFresnelParameters.power = 1.8;
                            }
                            mesh.metadata = mesh.metadata || {};
                            mesh.metadata.isBodyPanel = true;
                        } else {
                            m.specularColor = new BABYLON.Color3(0.4, 0.4, 0.45);
                            m.specularPower = 60;
                        }
                    }
                    mesh.material = m;
                } catch (e) { /* keep original */ }
            }
        });

        // Fit to view: scale so the longest axis is ~3.1 units, wheels on turntable
        const bounds = _previewComputeBounds(root);
        if (bounds) {
            const size = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
            const scaleFactor = size > 0 ? 3.1 / size : 1;
            root.scaling.x = scaleFactor;
            root.scaling.y = scaleFactor;
            root.scaling.z = scaleFactor;
            root.position.y = -0.38 - bounds.min.y * scaleFactor;
            // Nudge car laterally so it's centered
            const centerX = (bounds.min.x + bounds.max.x) / 2;
            const centerZ = (bounds.min.z + bounds.max.z) / 2;
            root.position.x = -centerX * scaleFactor;
            root.position.z = -centerZ * scaleFactor;
        }

        _previewLoadedStyle = style;
        _previewLoadedColor = color;
    }, null, () => { /* graceful: leave empty */ });
}

function _previewComputeBounds(root) {
    let min = null, max = null;
    const children = root.getChildMeshes();
    children.forEach(m => {
        if (!m.getBoundingInfo) return;
        m.refreshBoundingInfo && m.refreshBoundingInfo();
        const bb = m.getBoundingInfo().boundingBox;
        const lo = bb.minimumWorld;
        const hi = bb.maximumWorld;
        if (!min) { min = lo.clone(); max = hi.clone(); return; }
        min.x = Math.min(min.x, lo.x); min.y = Math.min(min.y, lo.y); min.z = Math.min(min.z, lo.z);
        max.x = Math.max(max.x, hi.x); max.y = Math.max(max.y, hi.y); max.z = Math.max(max.z, hi.z);
    });
    if (!min) return null;
    return { min, max, size: new BABYLON.Vector3(max.x - min.x, max.y - min.y, max.z - min.z) };
}

function _retintPreviewCar(color) {
    if (!_previewCarRoot) return;
    const target = BABYLON.Color3.FromHexString(color);
    _previewCarRoot.getChildMeshes().forEach(mesh => {
        if (!mesh.material || !mesh.metadata || !mesh.metadata.isBodyPanel) return;
        mesh.material.diffuseColor = target;
        mesh.material.emissiveColor = target.scale(0.04);
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
}
