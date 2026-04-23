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
            9.5,
            new BABYLON.Vector3(0, 0.6, 0),
            _previewScene
        );
        _previewCamera.fov = 0.75;
        _previewCamera.minZ = 0.1;
        _previewCamera.maxZ = 60;

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
        const floor = BABYLON.MeshBuilder.CreateDisc('pfloor', { radius: 4.8, tessellation: 72 }, _previewScene);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = -0.52;
        const floorMat = new BABYLON.StandardMaterial('pfloorMat', _previewScene);
        floorMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.08);
        floorMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.06);
        floorMat.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.02);
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

        _previewEngine.runRenderLoop(() => {
            if (!_previewScene) return;
            if (_previewCarRoot) {
                _previewRotation += 0.008;
                _previewCarRoot.rotation.y = _previewRotation;
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

        window.addEventListener('resize', () => { if (_previewEngine) _previewEngine.resize(); });
    }

    requestAnimationFrame(() => {
        if (_previewEngine) _previewEngine.resize();
        setTimeout(() => { if (_previewEngine) _previewEngine.resize(); }, 120);
    });
    updateCarPreview();
}

// ── GLB model loader — mirrors cars.js cloneModelInto pattern exactly ──
function _loadPreviewCar(style, color) {
    const modelInfo = CAR_MODELS[style];
    if (!modelInfo) return null;

    const rootNode = new BABYLON.TransformNode('previewCar_' + style, _previewScene);
    _previewBodyMaterials = [];

    let meshTarget = rootNode;
    if (modelInfo.fixRotation) {
        const inner = new BABYLON.TransformNode('previewFix', _previewScene);
        inner.parent = rootNode;
        inner.rotation.x = Math.PI / 2;
        meshTarget = inner;
    }

    const lastSlash = modelInfo.file.lastIndexOf('/');
    const rootUrl  = lastSlash >= 0 ? modelInfo.file.substring(0, lastSlash + 1) : './';
    const fileName = lastSlash >= 0 ? modelInfo.file.substring(lastSlash + 1) : modelInfo.file;

    BABYLON.SceneLoader.ImportMesh('', rootUrl, fileName, _previewScene, (meshes) => {
        if (_previewCarRoot !== rootNode) {
            meshes.forEach(m => { try { m.dispose(); } catch(e) {} });
            return;
        }
        console.log('[preview] GLB loaded:', fileName, 'meshes:', meshes.length);

        // Hide the GLB's original meshes — we render cloned copies
        meshes.forEach(m => {
            if (m.setEnabled) m.setEnabled(false);
            m.isVisible = false;
        });

        const parsedColor = BABYLON.Color3.FromHexString(color);

        meshes.forEach((mesh, idx) => {
            if (mesh.getClassName && mesh.getClassName() === 'TransformNode' && idx === 0) return;

            let clone;
            try { clone = mesh.clone('pc_' + idx + '_' + Math.random().toString(36).slice(2,6)); }
            catch (e) { try { clone = mesh.createInstance('pci_' + idx); } catch (e2) { clone = null; } }
            if (!clone) return;

            clone.parent = meshTarget;
            clone.isVisible = true;
            if (clone.setEnabled) clone.setEnabled(true);

            // Tint body panels with the selected color (match cars.js heuristic)
            if (clone.material) {
                const origMat = clone.material;
                let mat;
                try { mat = origMat.clone('pmat_' + idx + '_' + Math.random().toString(36).slice(2,6)); } catch (e) { mat = origMat; }
                clone.material = mat;

                let brightness = 0.5;
                if (mat.diffuseColor) {
                    brightness = (mat.diffuseColor.r + mat.diffuseColor.g + mat.diffuseColor.b) / 3;
                }

                if (brightness > 0.35 && brightness < 0.95) {
                    mat.diffuseColor = parsedColor;
                    mat.specularColor = new BABYLON.Color3(0.85, 0.85, 0.9);
                    mat.specularPower = 140;
                    mat.emissiveColor = parsedColor.scale(0.04);
                    if (_previewScene.environmentTexture) {
                        mat.reflectionTexture = _previewScene.environmentTexture;
                        mat.reflectionTexture.level = 0.55;
                        mat.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                        mat.reflectionFresnelParameters.leftColor = new BABYLON.Color3(1, 1, 1);
                        mat.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0.08, 0.08, 0.08);
                        mat.reflectionFresnelParameters.power = 1.6;
                    }
                    _previewBodyMaterials.push(mat);
                } else if (brightness < 0.25) {
                    // Darker trim — glass / tires / accents. Polish a little.
                    mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.55);
                    mat.specularPower = 120;
                    if (_previewScene.environmentTexture) {
                        mat.reflectionTexture = _previewScene.environmentTexture;
                        mat.reflectionTexture.level = 0.3;
                    }
                }
            }
        });

        // Apply the in-game scale so the car is the right size in the scene
        const s = modelInfo.scale || 1;
        rootNode.scaling.set(s, s, s);
        // The Kenney GLB pivots are at the wheels, so place pivot at floor
        rootNode.position.y = -0.5 + (modelInfo.yOffset || 0);
    }, null, (_scene, message, exception) => {
        console.warn('[preview] GLB load failed for ' + style + ':', message, exception);
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

function _retintPreviewCar(color) {
    if (!_previewBodyMaterials.length) return;
    const target = BABYLON.Color3.FromHexString(color);
    _previewBodyMaterials.forEach(m => {
        m.diffuseColor = target;
        m.emissiveColor = target.scale(0.05);
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
