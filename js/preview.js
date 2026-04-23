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
let _previewAccentLights = [];

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
            Math.PI / 2 - 0.25,
            9.2,
            new BABYLON.Vector3(0, 0.2, 0),
            _previewScene
        );
        _previewCamera.fov = 0.65;
        _previewCamera.minZ = 0.1;
        _previewCamera.maxZ = 60;

        // ── Three-point lighting + colored accent lights ──
        const hemi = new BABYLON.HemisphericLight('phemi', new BABYLON.Vector3(0, 1, 0.15), _previewScene);
        hemi.intensity = 0.55;
        hemi.diffuse = new BABYLON.Color3(1, 0.96, 0.9);
        hemi.groundColor = new BABYLON.Color3(0.1, 0.08, 0.18);
        hemi.specular = new BABYLON.Color3(0.4, 0.4, 0.4);

        const key = new BABYLON.DirectionalLight('pkey', new BABYLON.Vector3(-0.35, -0.8, -0.55).normalize(), _previewScene);
        key.intensity = 1.45;
        key.diffuse = new BABYLON.Color3(1, 0.94, 0.82);
        key.specular = new BABYLON.Color3(1, 0.94, 0.82);
        key.position = new BABYLON.Vector3(6, 10, 6);

        const rim = new BABYLON.DirectionalLight('prim', new BABYLON.Vector3(0.55, -0.3, 0.75).normalize(), _previewScene);
        rim.intensity = 1.0;
        rim.diffuse = new BABYLON.Color3(0.55, 0.78, 1.0);
        rim.specular = new BABYLON.Color3(0.55, 0.78, 1.0);

        _previewAccentLights = [];
        const orangeL = new BABYLON.PointLight('paccent1', new BABYLON.Vector3(-6, 2.5, 3), _previewScene);
        orangeL.diffuse = new BABYLON.Color3(1, 0.4, 0.15);
        orangeL.intensity = 2.8;
        orangeL.range = 20;
        _previewAccentLights.push(orangeL);

        const cyanL = new BABYLON.PointLight('paccent2', new BABYLON.Vector3(6, 2.5, -3), _previewScene);
        cyanL.diffuse = new BABYLON.Color3(0.2, 0.6, 1.0);
        cyanL.intensity = 2.4;
        cyanL.range = 20;
        _previewAccentLights.push(cyanL);

        const magentaL = new BABYLON.PointLight('paccent3', new BABYLON.Vector3(0, 4, -6), _previewScene);
        magentaL.diffuse = new BABYLON.Color3(0.95, 0.25, 0.7);
        magentaL.intensity = 1.8;
        magentaL.range = 18;
        _previewAccentLights.push(magentaL);

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

        // ── Turntable floor ──
        const floor = BABYLON.MeshBuilder.CreateDisc('pfloor', { radius: 4.5, tessellation: 72 }, _previewScene);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = -0.45;
        const floorMat = new BABYLON.StandardMaterial('pfloorMat', _previewScene);
        floorMat.diffuseColor = new BABYLON.Color3(0.03, 0.03, 0.06);
        floorMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.7);
        floorMat.specularPower = 28;
        floorMat.emissiveColor = new BABYLON.Color3(0.015, 0.015, 0.03);
        if (_previewScene.environmentTexture) {
            floorMat.reflectionTexture = _previewScene.environmentTexture;
            floorMat.reflectionTexture.level = 0.55;
        }
        floor.material = floorMat;

        // Orange glow ring
        const ring = BABYLON.MeshBuilder.CreateTorus('pring', { diameter: 7.2, thickness: 0.06, tessellation: 64 }, _previewScene);
        ring.position.y = -0.42;
        const ringMat = new BABYLON.StandardMaterial('pringMat', _previewScene);
        ringMat.disableLighting = true;
        ringMat.emissiveColor = new BABYLON.Color3(1, 0.45, 0.18);
        ring.material = ringMat;

        // Cyan inner ring
        const ring2 = BABYLON.MeshBuilder.CreateTorus('pring2', { diameter: 5.4, thickness: 0.025, tessellation: 64 }, _previewScene);
        ring2.position.y = -0.43;
        const ring2Mat = new BABYLON.StandardMaterial('pring2Mat', _previewScene);
        ring2Mat.disableLighting = true;
        ring2Mat.emissiveColor = new BABYLON.Color3(0.25, 0.8, 1);
        ring2.material = ring2Mat;

        try {
            const glow = new BABYLON.GlowLayer('pglow', _previewScene);
            glow.intensity = 1.1;
        } catch(e) { /* graceful */ }

        // Image processing — cinematic
        _previewScene.imageProcessingConfiguration.toneMappingEnabled = true;
        _previewScene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        _previewScene.imageProcessingConfiguration.exposure = 1.25;
        _previewScene.imageProcessingConfiguration.contrast = 1.22;
        _previewScene.imageProcessingConfiguration.vignetteEnabled = true;
        _previewScene.imageProcessingConfiguration.vignetteWeight = 1.8;
        _previewScene.imageProcessingConfiguration.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);

        _previewEngine.runRenderLoop(() => {
            if (!_previewScene) return;
            if (_previewCarRoot) {
                _previewRotation += 0.009;
                _previewCarRoot.rotation.y = _previewRotation;
            }
            if (_previewAccentLights.length) {
                const t = performance.now() * 0.0006;
                _previewAccentLights[0].position.x = Math.cos(t) * 6;
                _previewAccentLights[0].position.z = Math.sin(t) * 5;
                _previewAccentLights[1].position.x = Math.cos(t + Math.PI) * 6;
                _previewAccentLights[1].position.z = Math.sin(t + Math.PI) * 5;
            }
            _previewScene.render();
        });

        window.addEventListener('resize', () => { if (_previewEngine) _previewEngine.resize(); });
    }

    requestAnimationFrame(() => {
        if (_previewEngine) _previewEngine.resize();
        setTimeout(() => { if (_previewEngine) _previewEngine.resize(); }, 120);
    });
    updateCarPreview();
}

function updateCarPreview() {
    if (!_previewScene) return;
    const car = CARS[GameState.selectedCar];
    if (!car) return;
    const locked = GameState.xp < car.unlock;

    const canvasEl = document.getElementById('car-preview-canvas');
    if (canvasEl) canvasEl.style.opacity = locked ? '0.25' : '1';

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

    const rootNode = new BABYLON.TransformNode('previewRoot', _previewScene);
    _previewCarRoot = rootNode;
    _previewRotation = 0;

    BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, _previewScene, (meshes) => {
        if (_previewCarRoot !== rootNode) {
            meshes.forEach(m => { try { m.dispose(); } catch(e) {} });
            return;
        }

        let innerParent = rootNode;
        if (modelInfo.fixRotation) {
            const fix = new BABYLON.TransformNode('previewFix', _previewScene);
            fix.parent = rootNode;
            fix.rotation.x = Math.PI / 2;
            innerParent = fix;
        }

        // Reparent only the top-level GLB nodes — keep wheels attached to body
        meshes.forEach(m => {
            if (m.parent === null || m.parent === undefined) {
                m.parent = innerParent;
            }
            if (m.setEnabled) m.setEnabled(true);
            if ('isVisible' in m) m.isVisible = true;
        });

        const targetColor = BABYLON.Color3.FromHexString(color);
        meshes.forEach((mesh, idx) => {
            if (!mesh.material) return;
            try {
                const m = mesh.material.clone('pmat_' + idx + '_' + Math.random().toString(36).slice(2,6));
                const d = m.diffuseColor;
                if (d) {
                    const brightness = (d.r + d.g + d.b) / 3;
                    if (brightness > 0.35 && brightness < 0.95) {
                        m.diffuseColor = targetColor;
                        m.specularColor = new BABYLON.Color3(0.95, 0.95, 0.95);
                        m.specularPower = 140;
                        m.emissiveColor = targetColor.scale(0.05);
                        if (_previewScene.environmentTexture) {
                            m.reflectionTexture = _previewScene.environmentTexture;
                            m.reflectionTexture.level = 0.65;
                            m.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                            m.reflectionFresnelParameters.leftColor = new BABYLON.Color3(1, 1, 1);
                            m.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0.08, 0.08, 0.08);
                            m.reflectionFresnelParameters.power = 1.8;
                        }
                        mesh.metadata = mesh.metadata || {};
                        mesh.metadata.isBodyPanel = true;
                    } else {
                        m.specularColor = new BABYLON.Color3(0.55, 0.55, 0.6);
                        m.specularPower = 80;
                        if (_previewScene.environmentTexture && brightness < 0.2) {
                            m.reflectionTexture = _previewScene.environmentTexture;
                            m.reflectionTexture.level = 0.35;
                        }
                    }
                }
                mesh.material = m;
            } catch (e) { /* keep original */ }
        });

        const bounds = _previewComputeBounds(rootNode);
        if (bounds) {
            const size = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
            const scaleFactor = size > 0 ? 3.2 / size : 1;
            rootNode.scaling.x = scaleFactor;
            rootNode.scaling.y = scaleFactor;
            rootNode.scaling.z = scaleFactor;
            rootNode.position.y = -0.4 - bounds.min.y * scaleFactor;
            const centerX = (bounds.min.x + bounds.max.x) / 2;
            const centerZ = (bounds.min.z + bounds.max.z) / 2;
            rootNode.position.x = -centerX * scaleFactor;
            rootNode.position.z = -centerZ * scaleFactor;
        }

        _previewLoadedStyle = style;
        _previewLoadedColor = color;
    }, null, (_s, message, exception) => {
        console.warn('[preview] GLB load failed:', modelInfo.file, message, exception);
    });
}

function _previewComputeBounds(root) {
    let min = null, max = null;
    const children = root.getChildMeshes(false);
    children.forEach(m => {
        if (!m.getBoundingInfo) return;
        m.refreshBoundingInfo && m.refreshBoundingInfo();
        m.computeWorldMatrix && m.computeWorldMatrix(true);
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
    _previewCarRoot.getChildMeshes(false).forEach(mesh => {
        if (!mesh.material || !mesh.metadata || !mesh.metadata.isBodyPanel) return;
        mesh.material.diffuseColor = target;
        mesh.material.emissiveColor = target.scale(0.05);
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
}
