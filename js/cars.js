// ============================================================
//  CAR MESH BUILDER - GLB Models + Procedural Fallback (Babylon.js)
//  High-detail race car meshes with PBR-like StandardMaterials
// ============================================================
let _carPartId = 0;
function uid(prefix) { return prefix + '_' + (++_carPartId); }

// Map car styles to GLB model files
const CAR_MODELS = {
    'ferrari':    { file: 'models/ferrari.glb', scale: 1.2, yOffset: 0, fixRotation: true },
    'lambo':      { file: 'models/sedan-sports.glb', scale: 3.5, yOffset: 0 },
    'hatchback':  { file: 'models/hatchback-sports.glb', scale: 3.5, yOffset: 0 },
    'muscle':     { file: 'models/race.glb', scale: 3.5, yOffset: 0 },
    'f1':         { file: 'models/race-future.glb', scale: 3.5, yOffset: 0 },
    'koenigsegg': { file: 'models/sedan-sports.glb', scale: 3.5, yOffset: 0 },
    'gt':         { file: 'models/race.glb', scale: 3.5, yOffset: 0 },
    'supra4':     { file: 'models/sedan.glb', scale: 3.5, yOffset: 0 },
    'supra5':     { file: 'models/sedan-sports.glb', scale: 3.5, yOffset: 0 },
    'bugatti':    { file: 'models/sedan-sports.glb', scale: 3.5, yOffset: 0 },
};

// Cache loaded models
const _modelCache = {};
let _modelCallbackQueue = {};

// ── Shared material factory ──
function _createCarMaterials(color) {
    const parsedColor = BABYLON.Color3.FromHexString(color);
    const darkerColor = parsedColor.scale(0.6);

    // Car paint — metallic with subtle reflections
    const paint = new BABYLON.StandardMaterial(uid('carPaint'), scene);
    paint.diffuseColor = parsedColor;
    paint.specularColor = new BABYLON.Color3(0.65, 0.65, 0.65);
    paint.specularPower = 80;
    paint.backFaceCulling = true;
    // Fresnel reflection for metallic paint
    if (scene.environmentTexture) {
        paint.reflectionTexture = scene.environmentTexture;
        paint.reflectionTexture.level = 0.25;
        paint.reflectionFresnelParameters = new BABYLON.FresnelParameters();
        paint.reflectionFresnelParameters.leftColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        paint.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0, 0, 0);
        paint.reflectionFresnelParameters.power = 2.5;
        paint.reflectionFresnelParameters.bias = 0.05;
    }

    // Darker accent paint (for lower body, fenders)
    const paintDark = paint.clone(uid('carPaintDk'));
    paintDark.diffuseColor = darkerColor;

    // Chrome / polished metal
    const chrome = new BABYLON.StandardMaterial(uid('chrome'), scene);
    chrome.diffuseColor = new BABYLON.Color3(0.85, 0.87, 0.9);
    chrome.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    chrome.specularPower = 128;
    if (scene.environmentTexture) {
        chrome.reflectionTexture = scene.environmentTexture;
        chrome.reflectionTexture.level = 0.6;
        chrome.reflectionFresnelParameters = new BABYLON.FresnelParameters();
        chrome.reflectionFresnelParameters.leftColor = new BABYLON.Color3(1, 1, 1);
        chrome.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        chrome.reflectionFresnelParameters.power = 1.5;
        chrome.reflectionFresnelParameters.bias = 0.1;
    }

    // Alloy wheel rim
    const alloy = new BABYLON.StandardMaterial(uid('alloy'), scene);
    alloy.diffuseColor = new BABYLON.Color3(0.65, 0.67, 0.7);
    alloy.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    alloy.specularPower = 200;

    // Glass / windshield
    const glass = new BABYLON.StandardMaterial(uid('glass'), scene);
    glass.diffuseColor = new BABYLON.Color3(0.05, 0.08, 0.12);
    glass.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    glass.specularPower = 128;
    glass.alpha = 0.3;
    glass.backFaceCulling = false;
    if (scene.environmentTexture) {
        glass.reflectionTexture = scene.environmentTexture;
        glass.reflectionTexture.level = 0.4;
        glass.reflectionFresnelParameters = new BABYLON.FresnelParameters();
        glass.reflectionFresnelParameters.leftColor = new BABYLON.Color3(0.8, 0.85, 1);
        glass.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0, 0, 0);
        glass.reflectionFresnelParameters.power = 4;
        glass.reflectionFresnelParameters.bias = 0.1;
    }

    // Rubber tire
    const rubber = new BABYLON.StandardMaterial(uid('rubber'), scene);
    rubber.diffuseColor = new BABYLON.Color3(0.06, 0.06, 0.06);
    rubber.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    rubber.specularPower = 16;

    // Dark plastic / carbon fiber
    const carbon = new BABYLON.StandardMaterial(uid('carbon'), scene);
    carbon.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.04);
    carbon.specularColor = new BABYLON.Color3(0.35, 0.35, 0.35);
    carbon.specularPower = 64;

    // Matte dark (undertray, diffuser)
    const matteDark = new BABYLON.StandardMaterial(uid('matteDk'), scene);
    matteDark.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    matteDark.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    matteDark.specularPower = 8;

    // Brake caliper (red)
    const caliper = new BABYLON.StandardMaterial(uid('caliper'), scene);
    caliper.diffuseColor = new BABYLON.Color3(0.85, 0.05, 0.02);
    caliper.specularColor = new BABYLON.Color3(0.6, 0.2, 0.2);
    caliper.specularPower = 64;

    // Brake disc (steel)
    const brakeDisc = new BABYLON.StandardMaterial(uid('brakeDisc'), scene);
    brakeDisc.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.42);
    brakeDisc.specularColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    brakeDisc.specularPower = 100;

    // Headlight emissive
    const headlight = new BABYLON.StandardMaterial(uid('hl'), scene);
    headlight.diffuseColor = new BABYLON.Color3(1, 1, 0.95);
    headlight.emissiveColor = new BABYLON.Color3(1, 1, 0.8);
    headlight.specularColor = new BABYLON.Color3(1, 1, 1);
    headlight.specularPower = 256;

    // DRL (daytime running light, white)
    const drl = new BABYLON.StandardMaterial(uid('drl'), scene);
    drl.diffuseColor = new BABYLON.Color3(0.95, 0.97, 1);
    drl.emissiveColor = new BABYLON.Color3(0.7, 0.75, 0.9);

    // Tail light emissive
    const taillight = new BABYLON.StandardMaterial(uid('tl'), scene);
    taillight.diffuseColor = new BABYLON.Color3(0.9, 0, 0);
    taillight.emissiveColor = new BABYLON.Color3(0.9, 0.06, 0.02);

    // Indicator orange
    const indicator = new BABYLON.StandardMaterial(uid('ind'), scene);
    indicator.diffuseColor = new BABYLON.Color3(1, 0.55, 0);
    indicator.emissiveColor = new BABYLON.Color3(0.8, 0.4, 0);

    // Exhaust interior dark
    const exhaustInner = new BABYLON.StandardMaterial(uid('exIn'), scene);
    exhaustInner.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    exhaustInner.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    return {
        paint, paintDark, chrome, alloy, glass, rubber, carbon, matteDark,
        caliper, brakeDisc, headlight, drl, taillight, indicator, exhaustInner
    };
}

// ── GLB model loading ──
function loadCarModel(style, color, parentNode, callback) {
    const modelInfo = CAR_MODELS[style];
    if (!modelInfo) { callback(null); return; }

    const cacheKey = modelInfo.file;

    if (_modelCache[cacheKey] && _modelCache[cacheKey] !== 'loading') {
        const clone = cloneModelInto(parentNode, _modelCache[cacheKey], modelInfo, color);
        callback(clone);
        return;
    }
    // If already loading, queue callback for when it finishes
    if (_modelCache[cacheKey] === 'loading') {
        if (!_modelCallbackQueue) _modelCallbackQueue = {};
        if (!_modelCallbackQueue[cacheKey]) _modelCallbackQueue[cacheKey] = [];
        _modelCallbackQueue[cacheKey].push({ parentNode, color, modelInfo, callback });
        return;
    }

    // Mark as loading to prevent duplicate loads
    _modelCache[cacheKey] = 'loading';

    // Split path into rootUrl + filename for proper Babylon.js loading
    const lastSlash = modelInfo.file.lastIndexOf('/');
    const rootUrl = lastSlash >= 0 ? modelInfo.file.substring(0, lastSlash + 1) : './';
    const fileName = lastSlash >= 0 ? modelInfo.file.substring(lastSlash + 1) : modelInfo.file;

    console.log('Loading GLB model:', rootUrl + fileName);

    BABYLON.SceneLoader.ImportMesh("", rootUrl, fileName, scene, function(meshes) {
        console.log('Model loaded successfully:', fileName, 'meshes:', meshes.length);
        if (meshes.length === 0) { delete _modelCache[cacheKey]; callback(null); return; }

        // Hide original meshes so they don't show at origin
        meshes.forEach(m => {
            if (m.setEnabled) m.setEnabled(false);
            m.isVisible = false;
        });

        _modelCache[cacheKey] = meshes;
        const clone = cloneModelInto(parentNode, meshes, modelInfo, color);
        callback(clone);

        // Flush waiting queue for this model
        if (_modelCallbackQueue && _modelCallbackQueue[cacheKey]) {
            _modelCallbackQueue[cacheKey].forEach(q => {
                const c = cloneModelInto(q.parentNode, meshes, q.modelInfo, q.color);
                q.callback(c);
            });
            delete _modelCallbackQueue[cacheKey];
        }
    }, null, function(scene, message) {
        console.warn('GLB load FAILED:', rootUrl + fileName, message);
        delete _modelCache[cacheKey];
        callback(null);

        // Flush waiting queue with null (they'll use procedural fallback)
        if (_modelCallbackQueue && _modelCallbackQueue[cacheKey]) {
            _modelCallbackQueue[cacheKey].forEach(q => q.callback(null));
            delete _modelCallbackQueue[cacheKey];
        }
    });
}

// Clear model cache between races to avoid referencing disposed meshes
function clearModelCache() {
    for (const key in _modelCache) {
        delete _modelCache[key];
    }
}

function cloneModelInto(parentNode, originalMeshes, modelInfo, color) {
    const parsedColor = BABYLON.Color3.FromHexString(color);

    // For models that need orientation fix, use an intermediate node
    let meshParent = parentNode;
    if (modelInfo.fixRotation) {
        meshParent = new BABYLON.TransformNode(uid('modelFix'), scene);
        meshParent.parent = parentNode;
        // Ferrari model: correct orientation using quaternion
        // Rotate -90° around X to lay flat, then 180° around Y to face forward
        const qX = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
        const qY = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), Math.PI);
        meshParent.rotationQuaternion = qY.multiply(qX);
    }

    originalMeshes.forEach((mesh, idx) => {
        if (mesh.getClassName() === 'TransformNode' && idx === 0) return;

        let clone;
        try {
            clone = mesh.clone(uid('carModel'));
        } catch(e) {
            clone = mesh.createInstance(uid('carInst'));
        }

        if (clone) {
            clone.parent = meshParent;
            clone.isVisible = true;
            clone.setEnabled(true);

            // PRESERVE the original GLB material and texture (colormap.png atlas)
            // Only clone the material so we can tint body-colored parts
            if (clone.material) {
                const origMat = clone.material;
                let mat;
                try {
                    mat = origMat.clone(uid('carMat'));
                } catch(e) {
                    mat = origMat;
                }
                clone.material = mat;

                // Detect body panels by color brightness and tint them
                // Kenney models use the colormap: bright regions = body panels
                let brightness = 0.5;
                if (mat.diffuseColor) {
                    brightness = (mat.diffuseColor.r + mat.diffuseColor.g + mat.diffuseColor.b) / 3;
                }

                if (brightness > 0.35 && brightness < 0.95) {
                    // This is a body panel — tint with player's color
                    if (mat.diffuseTexture) {
                        mat.diffuseColor = parsedColor;
                    } else {
                        mat.diffuseColor = parsedColor;
                    }
                    // Metallic specular + environment reflection for shiny paint
                    mat.specularColor = new BABYLON.Color3(0.7, 0.7, 0.7);
                    mat.specularPower = 80;
                    if (scene.environmentTexture) {
                        mat.reflectionTexture = scene.environmentTexture;
                        mat.reflectionTexture.level = 0.3;
                        mat.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                        mat.reflectionFresnelParameters.leftColor = new BABYLON.Color3(0.8, 0.8, 0.8);
                        mat.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0, 0, 0);
                        mat.reflectionFresnelParameters.power = 3;
                        mat.reflectionFresnelParameters.bias = 0.05;
                    }
                } else if (brightness >= 0.95) {
                    // Very bright = windows/glass — make semi-transparent + reflective
                    mat.alpha = 0.4;
                    mat.specularColor = new BABYLON.Color3(1, 1, 1);
                    mat.specularPower = 128;
                    if (scene.environmentTexture) {
                        mat.reflectionTexture = scene.environmentTexture;
                        mat.reflectionTexture.level = 0.5;
                    }
                    mat.reflectionFresnelParameters = new BABYLON.FresnelParameters();
                    mat.reflectionFresnelParameters.leftColor = new BABYLON.Color3(1, 1, 1);
                    mat.reflectionFresnelParameters.rightColor = new BABYLON.Color3(0, 0, 0);
                    mat.reflectionFresnelParameters.power = 4;
                    mat.reflectionFresnelParameters.bias = 0.1;
                } else if (brightness <= 0.15) {
                    // Very dark = tires/trim — add subtle sheen
                    mat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
                    mat.specularPower = 16;
                } else {
                    // Medium = chrome/accents — enhance reflectivity
                    mat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
                    mat.specularPower = 48;
                    if (scene.environmentTexture) {
                        mat.reflectionTexture = scene.environmentTexture;
                        mat.reflectionTexture.level = 0.4;
                    }
                }
            }

            if (shadowGenerator && clone.getTotalVertices && clone.getTotalVertices() > 0) {
                shadowGenerator.addShadowCaster(clone);
            }
        }
    });

    parentNode.scaling = new BABYLON.Vector3(modelInfo.scale, modelInfo.scale, modelInfo.scale);
    parentNode.position.y += modelInfo.yOffset;

    // Add headlight SpotLights to GLB models too
    _addHeadlightBeams(parentNode, 2.2 * modelInfo.scale, 0.5 * modelInfo.scale, 5.5 * modelInfo.scale, 0.42 * modelInfo.scale);

    return parentNode;
}

// ── Mesh builder helpers ──
function makeBox(w, h, d, mat, parent) {
    const m = BABYLON.MeshBuilder.CreateBox(uid('box'), { width: w, height: h, depth: d }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    return m;
}

function makeSphere(diam, segs, mat, parent) {
    const m = BABYLON.MeshBuilder.CreateSphere(uid('sph'), { diameter: diam, segments: segs }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    return m;
}

function makeCylinder(dTop, dBot, h, tess, mat, parent) {
    const m = BABYLON.MeshBuilder.CreateCylinder(uid('cyl'), {
        diameterTop: dTop * 2, diameterBottom: dBot * 2, height: h, tessellation: tess
    }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    return m;
}

function makeTorus(diameter, thickness, tess, mat, parent) {
    const m = BABYLON.MeshBuilder.CreateTorus(uid('tor'), {
        diameter: diameter, thickness: thickness, tessellation: tess
    }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    return m;
}

function makePlane(w, h, mat, parent) {
    const m = BABYLON.MeshBuilder.CreatePlane(uid('pln'), { width: w, height: h }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    return m;
}

function _addShadow(m) {
    if (shadowGenerator && m.getTotalVertices && m.getTotalVertices() > 0) {
        shadowGenerator.addShadowCaster(m);
    }
}

// ── Detailed wheel assembly ──
function _buildWheel(x, z, wR, wW, mats, group) {
    const wheelGroup = new BABYLON.TransformNode(uid('whlGrp'), scene);
    wheelGroup.parent = group;
    wheelGroup.position.set(x, wR, z);

    const side = x < 0 ? -1 : 1;

    // Tire (torus-like cylinder with rounded look)
    const tire = makeCylinder(wR, wR, wW, 24, mats.rubber, wheelGroup);
    tire.rotation.z = Math.PI / 2;

    // Tire sidewall detail (slightly larger, thin)
    const sidewall1 = makeCylinder(wR * 1.02, wR * 0.98, wW * 0.15, 24, mats.rubber, wheelGroup);
    sidewall1.rotation.z = Math.PI / 2;
    sidewall1.position.x = side * wW * 0.35;

    // Rim face (alloy disc)
    const rim = makeCylinder(wR * 0.72, wR * 0.72, wW * 0.6, 12, mats.alloy, wheelGroup);
    rim.rotation.z = Math.PI / 2;

    // Rim lip (chrome ring)
    const rimLip = makeCylinder(wR * 0.82, wR * 0.82, wW * 0.08, 24, mats.chrome, wheelGroup);
    rimLip.rotation.z = Math.PI / 2;
    rimLip.position.x = side * wW * 0.28;

    // Hub cap center
    const hub = makeCylinder(wR * 0.18, wR * 0.18, wW * 0.65, 8, mats.chrome, wheelGroup);
    hub.rotation.z = Math.PI / 2;

    // Spoke simulation (5 spokes)
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spoke = makeBox(wR * 0.12, 0.02, wR * 0.55, mats.alloy, wheelGroup);
        spoke.position.set(side * wW * 0.1, Math.sin(angle) * wR * 0.35, Math.cos(angle) * wR * 0.35);
        spoke.rotation.x = angle;
    }

    // Brake disc (visible through spokes)
    const disc = makeCylinder(wR * 0.6, wR * 0.6, wW * 0.06, 20, mats.brakeDisc, wheelGroup);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = -side * wW * 0.05;

    // Brake caliper
    const calBox = makeBox(wR * 0.25, wR * 0.15, wR * 0.35, mats.caliper, wheelGroup);
    calBox.position.set(-side * wW * 0.12, wR * 0.25, 0);

    // The tire itself is what rotates for animation
    group.wheels.push(tire);

    return wheelGroup;
}

// ── Headlight spotlights ──
function _addHeadlightBeams(group, W, H, L, wR) {
    for (let sx of [-1, 1]) {
        const light = new BABYLON.SpotLight(
            uid('hlBeam'),
            new BABYLON.Vector3(sx * (W / 2 - 0.25), wR + H * 0.55, L / 2 + 0.1),
            new BABYLON.Vector3(0, -0.15, 1),
            Math.PI / 4, // angle
            2, // exponent
            scene
        );
        light.diffuse = new BABYLON.Color3(1, 0.97, 0.85);
        light.intensity = 0.8;
        light.range = 60;
        light.parent = group;

        // Exclude from shadow to save perf
        light.shadowEnabled = false;
    }
}

// ── Side mirrors ──
function _addMirrors(group, W, H, L, wR, mats) {
    for (let sx of [-1, 1]) {
        // Mirror arm
        const arm = makeBox(0.25, 0.04, 0.06, mats.carbon, group);
        arm.position.set(sx * (W / 2 + 0.08), wR + H + 0.15, L * 0.08);

        // Mirror housing
        const housing = makeBox(0.08, 0.1, 0.12, mats.paint, group);
        housing.position.set(sx * (W / 2 + 0.18), wR + H + 0.15, L * 0.08);

        // Mirror face
        const face = makePlane(0.06, 0.08, mats.glass, group);
        face.position.set(sx * (W / 2 + 0.23), wR + H + 0.15, L * 0.08);
        face.rotation.y = sx * Math.PI / 2;
    }
}

// ── Exhaust pipes ──
function _addExhausts(group, positions, wR, mats) {
    positions.forEach(p => {
        // Outer chrome tip
        const outer = makeCylinder(p.r || 0.06, (p.r || 0.06) * 1.15, 0.18, 12, mats.chrome, group);
        outer.rotation.x = Math.PI / 2;
        outer.position.set(p.x, wR + (p.y || 0.18), p.z);

        // Inner dark
        const inner = makeCylinder((p.r || 0.06) * 0.7, (p.r || 0.06) * 0.8, 0.19, 12, mats.exhaustInner, group);
        inner.rotation.x = Math.PI / 2;
        inner.position.set(p.x, wR + (p.y || 0.18), p.z);
    });
}

// ── Door line grooves ──
function _addDoorLines(group, W, H, L, wR, mats) {
    for (let sx of [-1, 1]) {
        // Front door line
        const d1 = makeBox(0.008, H * 0.7, L * 0.22, mats.carbon, group);
        d1.position.set(sx * (W / 2 + 0.005), wR + H * 0.55, L * 0.04);

        // Rear door line (if sedan-like)
        const d2 = makeBox(0.008, H * 0.65, L * 0.18, mats.carbon, group);
        d2.position.set(sx * (W / 2 + 0.005), wR + H * 0.5, -L * 0.14);
    }
}

// ── Undercarriage detail ──
function _addUndercarriage(group, W, H, L, wR, mats) {
    // Flat undertray
    const tray = makeBox(W * 0.9, 0.03, L * 0.85, mats.matteDark, group);
    tray.position.set(0, wR * 0.3, 0);

    // Cross-members
    for (let i = -2; i <= 2; i++) {
        const xm = makeBox(W * 0.5, 0.04, 0.06, mats.matteDark, group);
        xm.position.set(0, wR * 0.35, i * L * 0.15);
    }

    // Transmission tunnel
    const tunnel = makeBox(0.3, 0.1, L * 0.5, mats.matteDark, group);
    tunnel.position.set(0, wR * 0.4, -L * 0.05);
}

// ── Headlights and taillights ──
function _addLights(group, W, H, L, wR, mats, headlightShape, taillightShape) {
    const hlW = headlightShape === 'round' ? 0.16 : 0.28;
    const hlH = headlightShape === 'round' ? 0.16 : 0.1;

    for (let sx of [-1, 1]) {
        // Headlight housing
        const hlHousing = makeBox(hlW + 0.04, hlH + 0.04, 0.08, mats.carbon, group);
        hlHousing.position.set(sx * (W / 2 - 0.2), wR + H * 0.55, L / 2 + 0.01);

        // Headlight lens
        if (headlightShape === 'round') {
            const hl = makeSphere(hlW, 12, mats.headlight, group);
            hl.scaling.z = 0.3;
            hl.position.set(sx * (W / 2 - 0.2), wR + H * 0.55, L / 2 + 0.04);
        } else {
            const hl = makeBox(hlW, hlH, 0.06, mats.headlight, group);
            hl.position.set(sx * (W / 2 - 0.2), wR + H * 0.55, L / 2 + 0.04);
        }

        // DRL strip
        const drlStrip = makeBox(hlW * 0.8, 0.02, 0.04, mats.drl, group);
        drlStrip.position.set(sx * (W / 2 - 0.2), wR + H * 0.48, L / 2 + 0.05);

        // Tail lights
        const tlW = taillightShape === 'round' ? 0.12 : 0.25;
        const tlH = taillightShape === 'round' ? 0.12 : 0.08;

        // Tail light housing
        const tlHousing = makeBox(tlW + 0.04, tlH + 0.04, 0.06, mats.carbon, group);
        tlHousing.position.set(sx * (W / 2 - 0.18), wR + H * 0.5, -L / 2 - 0.01);

        if (taillightShape === 'round') {
            const tl = makeSphere(tlW, 10, mats.taillight, group);
            tl.scaling.z = 0.3;
            tl.position.set(sx * (W / 2 - 0.18), wR + H * 0.5, -L / 2 - 0.03);
        } else {
            const tl = makeBox(tlW, tlH, 0.05, mats.taillight, group);
            tl.position.set(sx * (W / 2 - 0.18), wR + H * 0.5, -L / 2 - 0.03);
        }

        // Reverse light (small white)
        const rev = makeBox(0.06, 0.04, 0.03, mats.headlight, group);
        rev.position.set(sx * (W / 2 - 0.35), wR + H * 0.4, -L / 2 - 0.02);

        // Indicator
        const ind = makeBox(0.06, 0.04, 0.03, mats.indicator, group);
        ind.position.set(sx * (W / 2 - 0.05), wR + H * 0.5, L / 2 + 0.03);
    }

    // License plate light
    const lp = makeBox(0.25, 0.12, 0.01, mats.chrome, group);
    lp.position.set(0, wR + H * 0.3, -L / 2 - 0.04);
}

// ── Wheel arch cutouts ──
function _addWheelArches(group, wheelPositions, wR, W, mats) {
    wheelPositions.forEach(wp => {
        for (let sx of [-1, 1]) {
            if (Math.sign(wp.x) !== sx && Math.sign(wp.x) !== 0) continue;
            // Arch lip (colored, over wheel)
            const arch = makeCylinder(wR * 1.25, wR * 1.25, 0.08, 16, mats.paintDark, group);
            arch.rotation.z = Math.PI / 2;
            arch.position.set(wp.x + sx * 0.04, wR, wp.z);
            arch.scaling.y = 0.55; // Half-arch appearance
        }
    });
}


// ============================================================
//  PROCEDURAL CAR BUILDERS - One per style
// ============================================================

function _buildLambo(group, mats, W, H, L, wR, sc) {
    // Low wedge-shaped body
    const body = makeBox(W, H, L * 0.75, mats.paint, group);
    body.position.set(0, wR + H / 2, -L * 0.05);
    _addShadow(body);

    // Wedge nose - tapered front
    const nose = makeBox(W * 0.92, H * 0.45, L * 0.35, mats.paint, group);
    nose.position.set(0, wR + H * 0.22, L * 0.38);
    _addShadow(nose);

    // Nose lip splitter
    const splitter = makeBox(W * 1.02, 0.04, 0.35, mats.carbon, group);
    splitter.position.set(0, wR + 0.02, L * 0.5);

    // Hood with slight angle
    const hood = makeBox(W * 0.9, 0.04, L * 0.35, mats.paint, group);
    hood.position.set(0, wR + H * 0.48, L * 0.28);
    hood.rotation.x = 0.12;

    // Hood vent lines
    for (let i = -1; i <= 1; i += 2) {
        const hv = makeBox(0.04, 0.02, L * 0.12, mats.carbon, group);
        hv.position.set(i * 0.25, wR + H * 0.52, L * 0.22);
    }

    // Windshield (aggressive angle)
    const ws = makeBox(W * 0.78, 0.04, H * 2.4, mats.glass, group);
    ws.position.set(0, wR + H + 0.3, L * 0.08);
    ws.rotation.x = -1.1;

    // Roof panel (very low)
    const roof = makeBox(W * 0.72, 0.05, L * 0.18, mats.carbon, group);
    roof.position.set(0, wR + H + 0.5, -L * 0.04);

    // Rear window (steep)
    const rw = makeBox(W * 0.68, 0.04, H * 1.6, mats.glass, group);
    rw.position.set(0, wR + H + 0.32, -L * 0.17);
    rw.rotation.x = 0.85;

    // Engine cover vents
    for (let i = 0; i < 4; i++) {
        const vent = makeBox(W * 0.5, 0.015, 0.04, mats.carbon, group);
        vent.position.set(0, wR + H + 0.01, -L * 0.22 - i * 0.06);
    }

    // Side air intakes (angular)
    for (let sx of [-1, 1]) {
        const intake = makeBox(0.06, H * 0.55, L * 0.18, mats.carbon, group);
        intake.position.set(sx * (W / 2 + 0.02), wR + H * 0.55, -L * 0.12);

        // Side scoop
        const scoop = makeBox(0.04, H * 0.3, L * 0.08, mats.matteDark, group);
        scoop.position.set(sx * (W / 2 + 0.04), wR + H * 0.4, -L * 0.05);

        // Side skirt
        const skirt = makeBox(0.06, H * 0.25, L * 0.65, mats.carbon, group);
        skirt.position.set(sx * (W / 2 + 0.02), wR + H * 0.12, 0);

        // Wide fender flares
        const fender = makeBox(0.1, H * 0.4, L * 0.18, mats.paint, group);
        fender.position.set(sx * (W / 2 + 0.03), wR + H * 0.35, -L * 0.3);
    }

    // Rear diffuser (aggressive, with fins)
    const diff = makeBox(W * 0.88, 0.12, 0.5, mats.carbon, group);
    diff.position.set(0, wR + 0.06, -L / 2 - 0.15);
    for (let i = -2; i <= 2; i++) {
        const fin = makeBox(0.02, 0.1, 0.4, mats.carbon, group);
        fin.position.set(i * 0.2, wR + 0.08, -L / 2 - 0.1);
    }

    // Lip spoiler
    const spoiler = makeBox(W * 0.75, 0.04, 0.2, mats.paint, group);
    spoiler.position.set(0, wR + H + 0.15, -L / 2 + 0.08);

    // Quad exhausts
    _addExhausts(group, [
        { x: -0.35, z: -L / 2 - 0.22, r: 0.07 },
        { x: -0.15, z: -L / 2 - 0.22, r: 0.07 },
        { x: 0.15, z: -L / 2 - 0.22, r: 0.07 },
        { x: 0.35, z: -L / 2 - 0.22, r: 0.07 },
    ], wR, mats);

    _addLights(group, W, H, L, wR, mats, 'angular', 'angular');
    _addMirrors(group, W, H, L, wR, mats);
    _addDoorLines(group, W, H, L, wR, mats);
    _addUndercarriage(group, W, H, L, wR, mats);
}

function _buildFerrari(group, mats, W, H, L, wR, sc) {
    // Flowing curved body
    const body = makeBox(W, H, L * 0.7, mats.paint, group);
    body.position.set(0, wR + H / 2, 0);
    _addShadow(body);

    // Curved nose (sphere-based)
    const nose = makeSphere(W, 16, mats.paint, group);
    nose.scaling = new BABYLON.Vector3(1, 0.32, 0.5);
    nose.position.set(0, wR + H * 0.28, L / 2);
    _addShadow(nose);

    // Front splitter
    const splitter = makeBox(W * 1.02, 0.035, 0.3, mats.carbon, group);
    splitter.position.set(0, wR + 0.02, L / 2 + 0.05);

    // Front air dam (lower grille)
    const airDam = makeBox(W * 0.6, H * 0.25, 0.06, mats.carbon, group);
    airDam.position.set(0, wR + H * 0.15, L / 2 + 0.12);

    // Hood with scoop
    const hood = makeBox(W * 0.88, 0.04, L * 0.3, mats.paint, group);
    hood.position.set(0, wR + H + 0.02, L * 0.2);
    const scoop = makeBox(W * 0.2, 0.06, L * 0.1, mats.carbon, group);
    scoop.position.set(0, wR + H + 0.07, L * 0.18);

    // NACA duct on hood
    const duct = makeBox(0.08, 0.03, 0.15, mats.carbon, group);
    duct.position.set(0.25, wR + H + 0.04, L * 0.25);

    // Windshield
    const ws = makeBox(W * 0.8, 0.04, H * 2.6, mats.glass, group);
    ws.position.set(0, wR + H + 0.38, L * 0.06);
    ws.rotation.x = -0.95;

    // Roof
    const roof = makeBox(W * 0.7, 0.06, L * 0.2, mats.paint, group);
    roof.position.set(0, wR + H + 0.58, -L * 0.04);

    // Rear glass
    const rg = makeBox(W * 0.62, 0.04, H * 1.8, mats.glass, group);
    rg.position.set(0, wR + H + 0.34, -L * 0.17);
    rg.rotation.x = 0.7;

    // Side quarter windows
    for (let sx of [-1, 1]) {
        const qw = makeBox(0.03, H * 0.4, L * 0.06, mats.glass, group);
        qw.position.set(sx * (W / 2 + 0.005), wR + H + 0.3, -L * 0.1);
    }

    // Flowing rear fenders with vents
    for (let sx of [-1, 1]) {
        const fender = makeBox(0.18, H * 0.75, L * 0.28, mats.paint, group);
        fender.position.set(sx * (W / 2 + 0.06), wR + H * 0.5, -L * 0.2);
        _addShadow(fender);

        // Triple side vents
        for (let v = 0; v < 3; v++) {
            const vent = makeBox(0.04, 0.05, 0.2, mats.carbon, group);
            vent.position.set(sx * (W / 2 + 0.01), wR + H * 0.72 + v * 0.07, L * 0.05);
        }

        // Side skirt
        const skirt = makeBox(0.05, H * 0.2, L * 0.55, mats.carbon, group);
        skirt.position.set(sx * (W / 2 + 0.02), wR + H * 0.1, 0);
    }

    // Rear lip
    const lip = makeBox(W * 0.85, 0.04, 0.12, mats.paint, group);
    lip.position.set(0, wR + H + 0.06, -L / 2);

    // Rear diffuser
    const diff = makeBox(W * 0.82, 0.1, 0.4, mats.carbon, group);
    diff.position.set(0, wR + 0.06, -L / 2 - 0.1);
    for (let i = -1; i <= 1; i++) {
        const fin = makeBox(0.02, 0.09, 0.35, mats.carbon, group);
        fin.position.set(i * 0.25, wR + 0.08, -L / 2 - 0.08);
    }

    // Quad center exhausts (Ferrari style)
    _addExhausts(group, [
        { x: -0.22, z: -L / 2 - 0.18, r: 0.055 },
        { x: -0.08, z: -L / 2 - 0.18, r: 0.055 },
        { x: 0.08, z: -L / 2 - 0.18, r: 0.055 },
        { x: 0.22, z: -L / 2 - 0.18, r: 0.055 },
    ], wR, mats);

    // Round tail lights (Ferrari signature)
    _addLights(group, W, H, L, wR, mats, 'angular', 'round');
    _addMirrors(group, W, H, L, wR, mats);
    _addDoorLines(group, W, H, L, wR, mats);
    _addUndercarriage(group, W, H, L, wR, mats);
}

function _buildMuscle(group, mats, W, H, L, wR, sc) {
    // Tall, boxy body
    const bodyH = H * 1.15;
    const body = makeBox(W, bodyH, L * 0.72, mats.paint, group);
    body.position.set(0, wR + bodyH / 2, 0);
    _addShadow(body);

    // High power-dome hood
    const hood = makeBox(W * 0.88, 0.06, L * 0.38, mats.paint, group);
    hood.position.set(0, wR + bodyH + 0.03, L * 0.18);
    const dome = makeBox(W * 0.3, 0.08, L * 0.2, mats.paint, group);
    dome.position.set(0, wR + bodyH + 0.08, L * 0.2);
    _addShadow(dome);

    // Hood scoop
    const scoop = makeBox(W * 0.22, 0.1, 0.12, mats.carbon, group);
    scoop.position.set(0, wR + bodyH + 0.13, L * 0.22);

    // Front fascia / nose
    const nose = makeBox(W * 0.96, bodyH * 0.5, L * 0.15, mats.paint, group);
    nose.position.set(0, wR + bodyH * 0.28, L * 0.43);

    // Large front grille
    const grille = makeBox(W * 0.65, bodyH * 0.35, 0.06, mats.carbon, group);
    grille.position.set(0, wR + bodyH * 0.25, L / 2 + 0.05);

    // Grille slats
    for (let i = 0; i < 5; i++) {
        const slat = makeBox(W * 0.6, 0.015, 0.04, mats.chrome, group);
        slat.position.set(0, wR + bodyH * 0.12 + i * 0.05, L / 2 + 0.06);
    }

    // Front bumper
    const fbump = makeBox(W * 1.02, bodyH * 0.22, 0.2, mats.paintDark, group);
    fbump.position.set(0, wR + bodyH * 0.11, L / 2 + 0.08);

    // Windshield (more upright, muscle style)
    const ws = makeBox(W * 0.8, 0.04, bodyH * 2.2, mats.glass, group);
    ws.position.set(0, wR + bodyH + 0.38, L * 0.02);
    ws.rotation.x = -0.75;

    // Roof
    const roof = makeBox(W * 0.76, 0.06, L * 0.22, mats.paint, group);
    roof.position.set(0, wR + bodyH + 0.6, -L * 0.06);

    // Rear window
    const rw = makeBox(W * 0.7, 0.04, bodyH * 1.5, mats.glass, group);
    rw.position.set(0, wR + bodyH + 0.35, -L * 0.19);
    rw.rotation.x = 0.55;

    // Side windows
    for (let sx of [-1, 1]) {
        const sw = makeBox(0.03, bodyH * 0.45, L * 0.28, mats.glass, group);
        sw.position.set(sx * (W / 2 + 0.005), wR + bodyH + 0.18, -L * 0.02);
    }

    // Wide rear fenders (aggressive stance)
    for (let sx of [-1, 1]) {
        const fender = makeBox(0.15, bodyH * 0.7, L * 0.25, mats.paint, group);
        fender.position.set(sx * (W / 2 + 0.06), wR + bodyH * 0.45, -L * 0.22);
        _addShadow(fender);

        // Side trim
        const trim = makeBox(0.015, 0.04, L * 0.5, mats.chrome, group);
        trim.position.set(sx * (W / 2 + 0.01), wR + bodyH * 0.55, 0);

        // Fender badge
        const badge = makeBox(0.01, 0.06, 0.12, mats.chrome, group);
        badge.position.set(sx * (W / 2 + 0.01), wR + bodyH * 0.6, L * 0.12);
    }

    // Rear panel
    const rearPanel = makeBox(W * 0.98, bodyH * 0.6, 0.1, mats.paintDark, group);
    rearPanel.position.set(0, wR + bodyH * 0.35, -L / 2 - 0.02);

    // Rear bumper
    const rBump = makeBox(W * 1.0, bodyH * 0.2, 0.15, mats.paintDark, group);
    rBump.position.set(0, wR + bodyH * 0.1, -L / 2 - 0.05);

    // Trunk lip
    const trunkLip = makeBox(W * 0.65, 0.04, 0.08, mats.paint, group);
    trunkLip.position.set(0, wR + bodyH + 0.02, -L / 2 + 0.15);

    // Dual exhausts (large, muscle style)
    _addExhausts(group, [
        { x: -0.35, z: -L / 2 - 0.2, r: 0.09 },
        { x: 0.35, z: -L / 2 - 0.2, r: 0.09 },
    ], wR, mats);

    _addLights(group, W, bodyH, L, wR, mats, 'angular', 'angular');
    _addMirrors(group, W, bodyH, L, wR, mats);
    _addDoorLines(group, W, bodyH, L, wR, mats);
    _addUndercarriage(group, W, bodyH, L, wR, mats);
}

function _buildF1(group, mats, W, H, L, wR, sc) {
    // Narrow central monocoque
    const monoW = W * 0.45;
    const mono = makeBox(monoW, H * 0.7, L * 0.55, mats.paint, group);
    mono.position.set(0, wR + H * 0.35, 0);
    _addShadow(mono);

    // Nose cone (tapered)
    const noseW = monoW * 0.6;
    const nose = makeBox(noseW, H * 0.35, L * 0.3, mats.paint, group);
    nose.position.set(0, wR + H * 0.18, L * 0.4);
    _addShadow(nose);

    // Nose tip
    const tip = makeBox(noseW * 0.5, H * 0.2, L * 0.1, mats.paint, group);
    tip.position.set(0, wR + H * 0.12, L * 0.55);

    // Front wing (multi-element)
    const fWing = makeBox(W * 1.1, 0.02, 0.35, mats.paint, group);
    fWing.position.set(0, wR + 0.08, L / 2 + 0.1);
    fWing.rotation.x = 0.08;

    const fWing2 = makeBox(W * 1.05, 0.015, 0.2, mats.paint, group);
    fWing2.position.set(0, wR + 0.14, L / 2 + 0.15);
    fWing2.rotation.x = 0.12;

    // Front wing endplates
    for (let sx of [-1, 1]) {
        const ep = makeBox(0.02, 0.12, 0.4, mats.paint, group);
        ep.position.set(sx * W * 0.55, wR + 0.1, L / 2 + 0.1);
    }

    // Open cockpit
    const cockpit = makeBox(monoW * 0.8, H * 0.15, L * 0.18, mats.carbon, group);
    cockpit.position.set(0, wR + H * 0.72, L * 0.02);

    // Cockpit opening rim
    const cockpitRim = makeCylinder(monoW * 0.45, monoW * 0.45, 0.04, 16, mats.carbon, group);
    cockpitRim.position.set(0, wR + H * 0.78, L * 0.02);
    cockpitRim.scaling.z = 2.5;

    // Roll hoop / airbox
    const rollHoop = makeBox(monoW * 0.35, H * 0.45, 0.12, mats.paint, group);
    rollHoop.position.set(0, wR + H * 0.85, -L * 0.08);

    // Airbox intake on roll hoop
    const airbox = makeBox(monoW * 0.25, H * 0.2, 0.08, mats.carbon, group);
    airbox.position.set(0, wR + H * 1.05, -L * 0.08);

    // Halo device
    const haloTop = makeBox(monoW * 0.12, 0.03, L * 0.15, mats.carbon, group);
    haloTop.position.set(0, wR + H * 1.0, L * 0.02);
    const haloFront = makeBox(0.04, H * 0.3, 0.04, mats.carbon, group);
    haloFront.position.set(0, wR + H * 0.85, L * 0.1);
    haloFront.rotation.x = -0.3;

    // Side pods
    for (let sx of [-1, 1]) {
        const pod = makeBox(W * 0.22, H * 0.5, L * 0.4, mats.paint, group);
        pod.position.set(sx * (monoW / 2 + W * 0.12), wR + H * 0.3, -L * 0.05);
        _addShadow(pod);

        // Sidepod intake
        const intake = makeBox(W * 0.2, H * 0.35, 0.04, mats.carbon, group);
        intake.position.set(sx * (monoW / 2 + W * 0.12), wR + H * 0.35, L * 0.15);

        // Sidepod undercut
        const undercut = makeBox(W * 0.18, H * 0.1, L * 0.25, mats.carbon, group);
        undercut.position.set(sx * (monoW / 2 + W * 0.14), wR + H * 0.08, -L * 0.1);

        // Bargeboard
        const barge = makeBox(0.015, H * 0.3, L * 0.12, mats.carbon, group);
        barge.position.set(sx * (monoW / 2 + 0.02), wR + H * 0.3, L * 0.18);
        barge.rotation.y = sx * 0.15;
    }

    // Engine cover (narrowing to rear)
    const engine = makeBox(monoW * 0.7, H * 0.45, L * 0.25, mats.paint, group);
    engine.position.set(0, wR + H * 0.3, -L * 0.28);

    // Rear crash structure
    const rearStruct = makeBox(monoW * 0.3, H * 0.2, L * 0.08, mats.carbon, group);
    rearStruct.position.set(0, wR + H * 0.25, -L * 0.42);

    // Rear wing (dual element)
    const rWingMount1 = makeBox(0.03, H * 0.5, 0.04, mats.carbon, group);
    rWingMount1.position.set(-monoW * 0.2, wR + H * 0.7, -L * 0.43);
    const rWingMount2 = makeBox(0.03, H * 0.5, 0.04, mats.carbon, group);
    rWingMount2.position.set(monoW * 0.2, wR + H * 0.7, -L * 0.43);

    const rWing = makeBox(W * 0.85, 0.025, 0.3, mats.paint, group);
    rWing.position.set(0, wR + H * 0.95, -L * 0.43);
    rWing.rotation.x = -0.1;

    const rWing2 = makeBox(W * 0.8, 0.02, 0.15, mats.paint, group);
    rWing2.position.set(0, wR + H * 1.05, -L * 0.43);
    rWing2.rotation.x = -0.15;

    // Rear wing endplates
    for (let sx of [-1, 1]) {
        const ep = makeBox(0.015, H * 0.35, 0.35, mats.paint, group);
        ep.position.set(sx * W * 0.42, wR + H * 0.9, -L * 0.43);
    }

    // Rear diffuser
    const diff = makeBox(W * 0.75, 0.15, 0.5, mats.carbon, group);
    diff.position.set(0, wR + 0.04, -L / 2 - 0.05);
    diff.rotation.x = 0.15;
    for (let i = -2; i <= 2; i++) {
        const fin = makeBox(0.015, 0.12, 0.45, mats.carbon, group);
        fin.position.set(i * 0.15, wR + 0.06, -L / 2);
    }

    // Exhaust (central, high)
    _addExhausts(group, [
        { x: 0, z: -L / 2 - 0.1, r: 0.06, y: H * 0.3 },
    ], wR, mats);

    // Rain light
    const rainLight = makeBox(0.2, 0.04, 0.03, mats.taillight, group);
    rainLight.position.set(0, wR + H * 0.55, -L / 2 - 0.08);

    // Simplified lights for F1 (no road headlights)
    const tlMesh = makeBox(0.08, 0.04, 0.03, mats.taillight, group);
    tlMesh.position.set(0, wR + H * 0.4, -L / 2 - 0.06);

    // Undertray (flat floor)
    const tray = makeBox(W * 0.95, 0.025, L * 0.9, mats.matteDark, group);
    tray.position.set(0, wR * 0.2, 0);

    // Floor edges / strakes
    for (let sx of [-1, 1]) {
        const strake = makeBox(0.03, 0.05, L * 0.3, mats.carbon, group);
        strake.position.set(sx * W * 0.47, wR * 0.2, -L * 0.15);
    }
}

function _buildHatchback(group, mats, W, H, L, wR, sc) {
    const bodyH = H * 1.1;
    const bodyL = L * 0.85;

    // Main body
    const body = makeBox(W * 0.95, bodyH, bodyL, mats.paint, group);
    body.position.set(0, wR + bodyH / 2, 0);
    _addShadow(body);

    // Rounded nose
    const nose = makeSphere(W * 0.9, 12, mats.paint, group);
    nose.scaling = new BABYLON.Vector3(1, 0.4, 0.3);
    nose.position.set(0, wR + bodyH * 0.35, bodyL / 2 + 0.05);

    // Front bumper
    const fbump = makeBox(W * 1.0, bodyH * 0.3, 0.2, mats.paintDark, group);
    fbump.position.set(0, wR + bodyH * 0.15, bodyL / 2 + 0.08);

    // Lower grille
    const grille = makeBox(W * 0.5, bodyH * 0.15, 0.05, mats.carbon, group);
    grille.position.set(0, wR + bodyH * 0.12, bodyL / 2 + 0.12);

    // Hood
    const hood = makeBox(W * 0.88, 0.04, bodyL * 0.28, mats.paint, group);
    hood.position.set(0, wR + bodyH + 0.02, bodyL * 0.18);

    // Windshield
    const ws = makeBox(W * 0.82, 0.04, bodyH * 2.2, mats.glass, group);
    ws.position.set(0, wR + bodyH + 0.35, bodyL * 0.02);
    ws.rotation.x = -0.8;

    // Roof with slight forward rake
    const roof = makeBox(W * 0.82, 0.06, bodyL * 0.3, mats.paint, group);
    roof.position.set(0, wR + bodyH + 0.58, -bodyL * 0.06);

    // Roof rails
    for (let sx of [-1, 1]) {
        const rail = makeBox(0.03, 0.035, bodyL * 0.28, mats.chrome, group);
        rail.position.set(sx * (W * 0.38), wR + bodyH + 0.61, -bodyL * 0.06);
    }

    // Rear hatch glass (steep, defining hatchback look)
    const rg = makeBox(W * 0.78, 0.04, bodyH * 2.0, mats.glass, group);
    rg.position.set(0, wR + bodyH + 0.2, -bodyL * 0.22);
    rg.rotation.x = 0.55;

    // Side windows
    for (let sx of [-1, 1]) {
        const sw = makeBox(0.03, bodyH * 0.4, bodyL * 0.32, mats.glass, group);
        sw.position.set(sx * (W * 0.475 + 0.005), wR + bodyH + 0.18, -bodyL * 0.02);

        // Window trim
        const trim = makeBox(0.015, 0.025, bodyL * 0.33, mats.chrome, group);
        trim.position.set(sx * (W * 0.48 + 0.005), wR + bodyH + 0.38, -bodyL * 0.02);

        // Side skirt (subtle)
        const skirt = makeBox(0.04, bodyH * 0.12, bodyL * 0.5, mats.paintDark, group);
        skirt.position.set(sx * (W * 0.48), wR + bodyH * 0.06, 0);
    }

    // Rear bumper
    const rBump = makeBox(W * 0.98, bodyH * 0.25, 0.15, mats.paintDark, group);
    rBump.position.set(0, wR + bodyH * 0.12, -bodyL / 2 - 0.05);

    // Rear spoiler (small lip on hatch)
    const spoiler = makeBox(W * 0.6, 0.03, 0.1, mats.paint, group);
    spoiler.position.set(0, wR + bodyH + 0.45, -bodyL / 2 + 0.12);

    // Single center exhaust
    _addExhausts(group, [
        { x: -0.25, z: -bodyL / 2 - 0.15, r: 0.05 },
    ], wR, mats);

    _addLights(group, W * 0.95, bodyH, bodyL, wR, mats, 'angular', 'angular');
    _addMirrors(group, W * 0.95, bodyH, bodyL, wR, mats);
    _addDoorLines(group, W * 0.95, bodyH, bodyL, wR, mats);
    _addUndercarriage(group, W * 0.95, bodyH, bodyL, wR, mats);
}

function _buildGT(group, mats, W, H, L, wR, sc) {
    // Wide, low GT body
    const gtW = W * 1.08;

    const body = makeBox(gtW, H, L * 0.72, mats.paint, group);
    body.position.set(0, wR + H / 2, 0);
    _addShadow(body);

    // Low nose
    const nose = makeBox(gtW * 0.95, H * 0.5, L * 0.3, mats.paint, group);
    nose.position.set(0, wR + H * 0.25, L * 0.35);
    _addShadow(nose);

    // Front splitter (large)
    const splitter = makeBox(gtW * 1.08, 0.04, 0.45, mats.carbon, group);
    splitter.position.set(0, wR + 0.02, L / 2 + 0.12);

    // Splitter end fins
    for (let sx of [-1, 1]) {
        const fin = makeBox(0.04, 0.06, 0.3, mats.carbon, group);
        fin.position.set(sx * (gtW / 2 + 0.04), wR + 0.04, L / 2 + 0.05);
    }

    // Front air intakes (large, aggressive)
    for (let sx of [-1, 0, 1]) {
        const intake = makeBox(gtW * 0.2, H * 0.25, 0.06, mats.carbon, group);
        intake.position.set(sx * 0.4, wR + H * 0.15, L / 2 + 0.14);
    }

    // Hood
    const hood = makeBox(gtW * 0.9, 0.04, L * 0.32, mats.paint, group);
    hood.position.set(0, wR + H + 0.02, L * 0.18);

    // Hood vents
    for (let i = -1; i <= 1; i += 2) {
        const hv = makeBox(gtW * 0.15, 0.03, L * 0.1, mats.carbon, group);
        hv.position.set(i * 0.3, wR + H + 0.04, L * 0.22);
    }

    // Windshield
    const ws = makeBox(gtW * 0.78, 0.04, H * 2.4, mats.glass, group);
    ws.position.set(0, wR + H + 0.35, L * 0.06);
    ws.rotation.x = -1.0;

    // Roof
    const roof = makeBox(gtW * 0.7, 0.05, L * 0.18, mats.carbon, group);
    roof.position.set(0, wR + H + 0.52, -L * 0.04);

    // Rear window
    const rw = makeBox(gtW * 0.65, 0.04, H * 1.6, mats.glass, group);
    rw.position.set(0, wR + H + 0.32, -L * 0.16);
    rw.rotation.x = 0.75;

    // Wide body fenders and side details
    for (let sx of [-1, 1]) {
        // Wide fender flares
        const fenderF = makeBox(0.12, H * 0.6, L * 0.2, mats.paint, group);
        fenderF.position.set(sx * (gtW / 2 + 0.04), wR + H * 0.4, L * 0.28);
        _addShadow(fenderF);

        const fenderR = makeBox(0.14, H * 0.7, L * 0.22, mats.paint, group);
        fenderR.position.set(sx * (gtW / 2 + 0.05), wR + H * 0.45, -L * 0.25);
        _addShadow(fenderR);

        // Side skirts (prominent)
        const skirt = makeBox(0.06, H * 0.22, L * 0.55, mats.carbon, group);
        skirt.position.set(sx * (gtW / 2 + 0.02), wR + H * 0.1, 0);

        // Side air vent behind front wheel
        const vent = makeBox(0.04, H * 0.2, L * 0.1, mats.carbon, group);
        vent.position.set(sx * (gtW / 2 + 0.01), wR + H * 0.5, L * 0.12);
    }

    // Large rear wing on swan-neck mounts
    for (let sx of [-1, 1]) {
        // Swan neck mount
        const mount = makeBox(0.03, H * 0.3, 0.04, mats.carbon, group);
        mount.position.set(sx * 0.4, wR + H + 0.35, -L * 0.38);
        mount.rotation.x = 0.2;
    }
    const wing = makeBox(gtW * 1.0, 0.03, 0.3, mats.paint, group);
    wing.position.set(0, wR + H + 0.55, -L * 0.4);
    wing.rotation.x = -0.08;

    // Wing endplates
    for (let sx of [-1, 1]) {
        const ep = makeBox(0.02, 0.15, 0.32, mats.carbon, group);
        ep.position.set(sx * (gtW / 2 + 0.02), wR + H + 0.5, -L * 0.4);
    }

    // Gurney flap
    const gurney = makeBox(gtW * 0.95, 0.04, 0.02, mats.carbon, group);
    gurney.position.set(0, wR + H + 0.57, -L * 0.41 - 0.14);

    // Rear diffuser (large, functional)
    const diff = makeBox(gtW * 0.9, 0.15, 0.55, mats.carbon, group);
    diff.position.set(0, wR + 0.06, -L / 2 - 0.15);
    for (let i = -3; i <= 3; i++) {
        const fin = makeBox(0.015, 0.13, 0.5, mats.carbon, group);
        fin.position.set(i * 0.16, wR + 0.08, -L / 2 - 0.1);
    }

    // Center-exit twin exhausts
    _addExhausts(group, [
        { x: -0.15, z: -L / 2 - 0.22, r: 0.07 },
        { x: 0.15, z: -L / 2 - 0.22, r: 0.07 },
    ], wR, mats);

    _addLights(group, gtW, H, L, wR, mats, 'angular', 'angular');
    _addMirrors(group, gtW, H, L, wR, mats);
    _addDoorLines(group, gtW, H, L, wR, mats);
    _addUndercarriage(group, gtW, H, L, wR, mats);
}

function _buildKoenigsegg(group, mats, W, H, L, wR, sc) {
    // Sleek hypercar body
    const body = makeBox(W, H, L * 0.7, mats.paint, group);
    body.position.set(0, wR + H / 2, 0);
    _addShadow(body);

    // Streamlined nose
    const nose = makeSphere(W * 0.95, 16, mats.paint, group);
    nose.scaling = new BABYLON.Vector3(1, 0.3, 0.55);
    nose.position.set(0, wR + H * 0.25, L * 0.42);
    _addShadow(nose);

    // Front splitter
    const splitter = makeBox(W * 1.0, 0.035, 0.3, mats.carbon, group);
    splitter.position.set(0, wR + 0.02, L / 2 + 0.08);

    // Hood with twin humps
    for (let sx of [-1, 1]) {
        const hump = makeBox(W * 0.2, 0.05, L * 0.15, mats.paint, group);
        hump.position.set(sx * 0.3, wR + H + 0.04, L * 0.22);
    }

    // Central hood vent
    const hoodVent = makeBox(0.12, 0.03, L * 0.12, mats.carbon, group);
    hoodVent.position.set(0, wR + H + 0.03, L * 0.2);

    // Windshield (very aggressive)
    const ws = makeBox(W * 0.76, 0.04, H * 2.5, mats.glass, group);
    ws.position.set(0, wR + H + 0.35, L * 0.06);
    ws.rotation.x = -1.1;

    // Dihedral synchro-helix door line hint
    for (let sx of [-1, 1]) {
        const doorLine = makeBox(0.008, H * 0.8, L * 0.3, mats.carbon, group);
        doorLine.position.set(sx * (W / 2 + 0.005), wR + H * 0.5, L * 0.02);
        doorLine.rotation.z = sx * 0.05;
    }

    // Targa-style roof
    const roof = makeBox(W * 0.65, 0.04, L * 0.15, mats.carbon, group);
    roof.position.set(0, wR + H + 0.52, -L * 0.03);

    // Rear window
    const rw = makeBox(W * 0.6, 0.04, H * 1.5, mats.glass, group);
    rw.position.set(0, wR + H + 0.3, -L * 0.16);
    rw.rotation.x = 0.8;

    // Engine bay window (Koenigsegg signature)
    const ebw = makeBox(W * 0.35, 0.04, L * 0.1, mats.glass, group);
    ebw.position.set(0, wR + H + 0.01, -L * 0.25);

    // Side air channels
    for (let sx of [-1, 1]) {
        const channel = makeBox(0.05, H * 0.5, L * 0.2, mats.carbon, group);
        channel.position.set(sx * (W / 2 + 0.02), wR + H * 0.5, -L * 0.1);

        // Side scoop
        const scoop = makeBox(0.06, H * 0.25, L * 0.08, mats.matteDark, group);
        scoop.position.set(sx * (W / 2 + 0.03), wR + H * 0.35, -L * 0.02);

        // Side skirt
        const skirt = makeBox(0.05, H * 0.2, L * 0.6, mats.carbon, group);
        skirt.position.set(sx * (W / 2 + 0.02), wR + H * 0.1, 0);

        // Rear fender flares
        const fender = makeBox(0.1, H * 0.5, L * 0.2, mats.paint, group);
        fender.position.set(sx * (W / 2 + 0.04), wR + H * 0.4, -L * 0.25);
    }

    // Active rear wing (retracted position)
    const wingMount = makeBox(0.06, H * 0.15, 0.04, mats.carbon, group);
    wingMount.position.set(0, wR + H + 0.1, -L * 0.38);
    const wing = makeBox(W * 0.75, 0.025, 0.22, mats.carbon, group);
    wing.position.set(0, wR + H + 0.2, -L * 0.38);

    // Rear diffuser
    const diff = makeBox(W * 0.85, 0.12, 0.45, mats.carbon, group);
    diff.position.set(0, wR + 0.06, -L / 2 - 0.12);
    for (let i = -2; i <= 2; i++) {
        const fin = makeBox(0.015, 0.1, 0.4, mats.carbon, group);
        fin.position.set(i * 0.2, wR + 0.08, -L / 2 - 0.08);
    }

    // Central exhaust (top-exit, Koenigsegg style)
    _addExhausts(group, [
        { x: 0, z: -L / 2 - 0.15, r: 0.08, y: H * 0.5 },
    ], wR, mats);

    _addLights(group, W, H, L, wR, mats, 'angular', 'angular');
    _addMirrors(group, W, H, L, wR, mats);
    _addUndercarriage(group, W, H, L, wR, mats);
}

function _buildGeneric(group, mats, W, H, L, wR, sc) {
    // Clean sedan proportions
    const bodyH = H * 1.05;

    // Lower body / rocker panel area
    const lowerBody = makeBox(W, bodyH * 0.55, L * 0.82, mats.paintDark, group);
    lowerBody.position.set(0, wR + bodyH * 0.275, 0);
    _addShadow(lowerBody);

    // Upper body
    const upperBody = makeBox(W * 0.98, bodyH * 0.5, L * 0.82, mats.paint, group);
    upperBody.position.set(0, wR + bodyH * 0.7, 0);
    _addShadow(upperBody);

    // Front end
    const nose = makeBox(W * 0.96, bodyH * 0.55, L * 0.12, mats.paint, group);
    nose.position.set(0, wR + bodyH * 0.32, L * 0.45);

    // Front bumper
    const fbump = makeBox(W * 1.01, bodyH * 0.3, 0.2, mats.paintDark, group);
    fbump.position.set(0, wR + bodyH * 0.15, L / 2 + 0.05);

    // Grille
    const grille = makeBox(W * 0.55, bodyH * 0.2, 0.05, mats.carbon, group);
    grille.position.set(0, wR + bodyH * 0.25, L / 2 + 0.1);

    // Grille chrome surround
    const grilleSurround = makeBox(W * 0.58, bodyH * 0.22, 0.02, mats.chrome, group);
    grilleSurround.position.set(0, wR + bodyH * 0.25, L / 2 + 0.11);

    // Hood
    const hood = makeBox(W * 0.92, 0.04, L * 0.3, mats.paint, group);
    hood.position.set(0, wR + bodyH + 0.02, L * 0.18);

    // Windshield
    const ws = makeBox(W * 0.82, 0.04, bodyH * 2.3, mats.glass, group);
    ws.position.set(0, wR + bodyH + 0.38, L * 0.03);
    ws.rotation.x = -0.82;

    // Roof
    const roof = makeBox(W * 0.8, 0.06, L * 0.25, mats.paint, group);
    roof.position.set(0, wR + bodyH + 0.6, -L * 0.05);

    // Rear window
    const rw = makeBox(W * 0.72, 0.04, bodyH * 1.8, mats.glass, group);
    rw.position.set(0, wR + bodyH + 0.35, -L * 0.2);
    rw.rotation.x = 0.6;

    // Side windows
    for (let sx of [-1, 1]) {
        const sw = makeBox(0.03, bodyH * 0.42, L * 0.35, mats.glass, group);
        sw.position.set(sx * (W / 2 + 0.005), wR + bodyH + 0.18, -L * 0.02);

        // Chrome window trim
        const trim = makeBox(0.015, 0.025, L * 0.36, mats.chrome, group);
        trim.position.set(sx * (W / 2 + 0.008), wR + bodyH + 0.39, -L * 0.02);

        // Subtle body crease
        const crease = makeBox(0.006, 0.015, L * 0.6, mats.paintDark, group);
        crease.position.set(sx * (W / 2 + 0.004), wR + bodyH * 0.55, 0);
    }

    // Trunk
    const trunk = makeBox(W * 0.9, bodyH * 0.35, L * 0.15, mats.paint, group);
    trunk.position.set(0, wR + bodyH * 0.6, -L * 0.38);

    // Rear bumper
    const rBump = makeBox(W * 0.98, bodyH * 0.25, 0.15, mats.paintDark, group);
    rBump.position.set(0, wR + bodyH * 0.12, -L / 2 - 0.05);

    // Chrome trunk trim
    const trunkTrim = makeBox(W * 0.4, 0.02, 0.02, mats.chrome, group);
    trunkTrim.position.set(0, wR + bodyH * 0.78, -L * 0.38 - L * 0.075);

    // Dual exhaust
    _addExhausts(group, [
        { x: -0.3, z: -L / 2 - 0.15, r: 0.05 },
        { x: 0.3, z: -L / 2 - 0.15, r: 0.05 },
    ], wR, mats);

    _addLights(group, W, bodyH, L, wR, mats, 'angular', 'angular');
    _addMirrors(group, W, bodyH, L, wR, mats);
    _addDoorLines(group, W, bodyH, L, wR, mats);
    _addUndercarriage(group, W, bodyH, L, wR, mats);
}

// ============================================================
//  MAIN ENTRY POINTS
// ============================================================

function buildCarMesh(color, carDef) {
    const style = carDef.style || 'lambo';
    const group = new BABYLON.TransformNode(uid('car'), scene);
    group.wheels = [];

    // Try to load GLB model
    if (CAR_MODELS[style]) {
        loadCarModel(style, color, group, function(result) {
            if (!result) {
                // Fallback to procedural if model fails
                buildProceduralCar(group, color, carDef);
            }
        });
    } else {
        buildProceduralCar(group, color, carDef);
    }

    return group;
}

function buildProceduralCar(group, color, carDef) {
    const style = carDef.style || 'lambo';
    const sc = carDef.scale || 1.0;
    const extraH = carDef.bodyH || 0;

    const mats = _createCarMaterials(color);

    const W = 2.2 * sc, H = (0.5 + extraH) * sc, L = 5.5 * sc, wR = 0.42 * sc;
    const wW = 0.28 * sc; // wheel width

    // ── Build body based on style ──
    switch (style) {
        case 'lambo':
            _buildLambo(group, mats, W, H, L, wR, sc);
            break;
        case 'ferrari':
            _buildFerrari(group, mats, W, H, L, wR, sc);
            break;
        case 'muscle':
            _buildMuscle(group, mats, W, H, L, wR, sc);
            break;
        case 'f1':
            _buildF1(group, mats, W, H, L, wR, sc);
            break;
        case 'hatchback':
            _buildHatchback(group, mats, W, H, L, wR, sc);
            break;
        case 'gt':
            _buildGT(group, mats, W, H, L, wR, sc);
            break;
        case 'koenigsegg':
            _buildKoenigsegg(group, mats, W, H, L, wR, sc);
            break;
        default:
            _buildGeneric(group, mats, W, H, L, wR, sc);
            break;
    }

    // ── Wheels (all styles except F1 get same detailed wheels) ──
    const bL = L;
    const bW = W;
    let wheelPositions;

    if (style === 'f1') {
        // F1: wider track, exposed wheels
        wheelPositions = [
            { x: -bW * 0.55, z: bL * 0.34 },
            { x: bW * 0.55, z: bL * 0.34 },
            { x: -bW * 0.55, z: -bL * 0.32 },
            { x: bW * 0.55, z: -bL * 0.32 },
        ];
    } else {
        wheelPositions = [
            { x: -bW / 2 + 0.15, z: bL * 0.32 },
            { x: bW / 2 - 0.15, z: bL * 0.32 },
            { x: -bW / 2 + 0.1, z: -bL * 0.32 },
            { x: bW / 2 - 0.1, z: -bL * 0.32 },
        ];
    }

    wheelPositions.forEach(wp => {
        _buildWheel(wp.x, wp.z, wR, wW, mats, group);
    });

    // ── Headlight beams ──
    _addHeadlightBeams(group, W, H, L, wR);
}
