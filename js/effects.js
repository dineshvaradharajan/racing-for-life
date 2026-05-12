// ============================================================
//  EFFECTS: GPU Particle Systems — Asphalt Legends quality
// ============================================================

// Legacy arrays kept so race.js quitRace() dispose loops don't error
let smokeParticles = [];
// sparkParticles is declared in scene.js — don't redeclare

let smokeSystem = null;
let sparkSystem = null;
let dustSystem = null;
let smokeEmitter = null;
let nitroFlameSystem = null;
let nitroGlowSystem = null;
let nitroEmitter = null;
let speedStreakSystem = null;

// Create a simple circular gradient texture for particles
function _createParticleTexture() {
    const size = 64;
    const dt = new BABYLON.DynamicTexture("particleTex", size, scene, false);
    const ctx = dt.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    dt.update();
    return dt;
}

// Flame-shaped texture for nitro
function _createFlameTexture() {
    const size = 64;
    const dt = new BABYLON.DynamicTexture("flameTex", size, scene, false);
    const ctx = dt.getContext();
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2.2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,200,100,0.9)');
    gradient.addColorStop(0.5, 'rgba(255,100,20,0.6)');
    gradient.addColorStop(0.8, 'rgba(200,50,0,0.3)');
    gradient.addColorStop(1, 'rgba(100,20,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    dt.update();
    return dt;
}

function initParticleSystems() {
    const tex = _createParticleTexture();
    const flameTex = _createFlameTexture();

    // ── Drift Smoke System — thicker, more dramatic ──
    smokeEmitter = new BABYLON.TransformNode("smokeEmitter", scene);
    smokeSystem = new BABYLON.ParticleSystem("smoke", 400, scene);
    smokeSystem.particleTexture = tex;
    smokeSystem.emitter = smokeEmitter;
    smokeSystem.minEmitBox = new BABYLON.Vector3(-1.5, 0, -0.8);
    smokeSystem.maxEmitBox = new BABYLON.Vector3(1.5, 0.4, 0.8);

    smokeSystem.color1 = new BABYLON.Color4(0.85, 0.82, 0.75, 0.7);
    smokeSystem.color2 = new BABYLON.Color4(0.7, 0.68, 0.62, 0.5);
    smokeSystem.colorDead = new BABYLON.Color4(0.45, 0.45, 0.45, 0);

    smokeSystem.minSize = 0.8;
    smokeSystem.maxSize = 3.5;
    smokeSystem.minLifeTime = 0.5;
    smokeSystem.maxLifeTime = 1.8;

    smokeSystem.emitRate = 0;
    smokeSystem.gravity = new BABYLON.Vector3(0, 3, 0);
    smokeSystem.direction1 = new BABYLON.Vector3(-2, 1, -2);
    smokeSystem.direction2 = new BABYLON.Vector3(2, 4, 2);

    smokeSystem.minEmitPower = 1;
    smokeSystem.maxEmitPower = 4;
    smokeSystem.updateSpeed = 0.02;

    smokeSystem.addSizeGradient(0, 0.8);
    smokeSystem.addSizeGradient(0.3, 2.0);
    smokeSystem.addSizeGradient(0.7, 3.5);
    smokeSystem.addSizeGradient(1.0, 5.0);

    smokeSystem.addColorRemapGradient(0, 0, 1);
    smokeSystem.addColorRemapGradient(1.0, 0, 0);

    smokeSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    smokeSystem.start();

    // ── Spark System — brighter, more numerous ──
    sparkSystem = new BABYLON.ParticleSystem("sparks", 500, scene);
    sparkSystem.particleTexture = tex;
    sparkSystem.emitter = new BABYLON.Vector3(0, 0, 0);
    sparkSystem.minEmitBox = new BABYLON.Vector3(-0.4, 0, -0.4);
    sparkSystem.maxEmitBox = new BABYLON.Vector3(0.4, 0.5, 0.4);

    sparkSystem.color1 = new BABYLON.Color4(1, 0.8, 0.3, 1);
    sparkSystem.color2 = new BABYLON.Color4(1, 0.5, 0.15, 1);
    sparkSystem.colorDead = new BABYLON.Color4(1, 0.15, 0, 0);

    sparkSystem.minSize = 0.04;
    sparkSystem.maxSize = 0.18;
    sparkSystem.minLifeTime = 0.15;
    sparkSystem.maxLifeTime = 0.7;

    sparkSystem.emitRate = 0;
    sparkSystem.gravity = new BABYLON.Vector3(0, -35, 0);
    sparkSystem.direction1 = new BABYLON.Vector3(-18, 5, -18);
    sparkSystem.direction2 = new BABYLON.Vector3(18, 20, 18);
    sparkSystem.minEmitPower = 8;
    sparkSystem.maxEmitPower = 25;
    sparkSystem.updateSpeed = 0.01;

    sparkSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    sparkSystem.start();

    // ── Dust System ──
    dustSystem = new BABYLON.ParticleSystem("dust", 150, scene);
    dustSystem.particleTexture = tex;
    dustSystem.emitter = new BABYLON.Vector3(0, 0, 0);
    dustSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    dustSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.2, 0.5);

    dustSystem.color1 = new BABYLON.Color4(0.65, 0.55, 0.38, 0.5);
    dustSystem.color2 = new BABYLON.Color4(0.55, 0.45, 0.30, 0.35);
    dustSystem.colorDead = new BABYLON.Color4(0.4, 0.35, 0.25, 0);

    dustSystem.minSize = 0.4;
    dustSystem.maxSize = 2.0;
    dustSystem.minLifeTime = 0.6;
    dustSystem.maxLifeTime = 2.0;

    dustSystem.emitRate = 0;
    dustSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);
    dustSystem.direction1 = new BABYLON.Vector3(-3, 0.5, -3);
    dustSystem.direction2 = new BABYLON.Vector3(3, 2, 3);
    dustSystem.minEmitPower = 1;
    dustSystem.maxEmitPower = 3;

    dustSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    dustSystem.start();

    // ── NITRO FLAME System — blue-white jet flame ──
    nitroEmitter = new BABYLON.TransformNode("nitroEmitter", scene);
    nitroFlameSystem = new BABYLON.ParticleSystem("nitroFlame", 600, scene);
    nitroFlameSystem.particleTexture = flameTex;
    nitroFlameSystem.emitter = nitroEmitter;
    nitroFlameSystem.minEmitBox = new BABYLON.Vector3(-0.3, -0.2, -0.2);
    nitroFlameSystem.maxEmitBox = new BABYLON.Vector3(0.3, 0.2, 0.2);

    // Blue → white → cyan flame colors
    nitroFlameSystem.color1 = new BABYLON.Color4(0.4, 0.7, 1.0, 1);
    nitroFlameSystem.color2 = new BABYLON.Color4(0.8, 0.9, 1.0, 0.9);
    nitroFlameSystem.colorDead = new BABYLON.Color4(0.1, 0.3, 0.8, 0);

    nitroFlameSystem.minSize = 0.3;
    nitroFlameSystem.maxSize = 1.2;
    nitroFlameSystem.minLifeTime = 0.05;
    nitroFlameSystem.maxLifeTime = 0.2;

    nitroFlameSystem.emitRate = 0;
    nitroFlameSystem.gravity = new BABYLON.Vector3(0, 1, 0);
    nitroFlameSystem.minEmitPower = 8;
    nitroFlameSystem.maxEmitPower = 18;

    nitroFlameSystem.addSizeGradient(0, 0.6);
    nitroFlameSystem.addSizeGradient(0.3, 1.0);
    nitroFlameSystem.addSizeGradient(1.0, 0.1);

    nitroFlameSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    nitroFlameSystem.start();

    // ── Nitro Glow — secondary larger glow particles ──
    nitroGlowSystem = new BABYLON.ParticleSystem("nitroGlow", 200, scene);
    nitroGlowSystem.particleTexture = tex;
    nitroGlowSystem.emitter = nitroEmitter;
    nitroGlowSystem.minEmitBox = new BABYLON.Vector3(-0.5, -0.3, -0.3);
    nitroGlowSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.3, 0.3);

    nitroGlowSystem.color1 = new BABYLON.Color4(0.2, 0.5, 1.0, 0.4);
    nitroGlowSystem.color2 = new BABYLON.Color4(0.6, 0.8, 1.0, 0.3);
    nitroGlowSystem.colorDead = new BABYLON.Color4(0.1, 0.2, 0.5, 0);

    nitroGlowSystem.minSize = 1.0;
    nitroGlowSystem.maxSize = 3.0;
    nitroGlowSystem.minLifeTime = 0.08;
    nitroGlowSystem.maxLifeTime = 0.25;

    nitroGlowSystem.emitRate = 0;
    nitroGlowSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);
    nitroGlowSystem.minEmitPower = 4;
    nitroGlowSystem.maxEmitPower = 10;

    nitroGlowSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    nitroGlowSystem.start();
}

function spawnDriftSmoke() {
    if (!smokeSystem || !playerCar || !drifting || Math.abs(playerSpeed) < 5) {
        if (smokeSystem) smokeSystem.emitRate = 0;
        return;
    }

    const intensity = Math.min(Math.abs(playerSpeed) / 35, 1);
    const behind = new BABYLON.Vector3(-Math.sin(carHeading), 0, -Math.cos(carHeading));

    smokeEmitter.position.set(
        carX + behind.x * 3,
        carY + 0.2,
        carZ + behind.z * 3
    );

    smokeSystem.emitRate = Math.floor(50 * intensity);
    smokeSystem.minEmitPower = 1 + intensity * 3;
    smokeSystem.maxEmitPower = 3 + intensity * 6;

    smokeSystem.direction1 = new BABYLON.Vector3(
        behind.x * 2 - 1, 1, behind.z * 2 - 1
    );
    smokeSystem.direction2 = new BABYLON.Vector3(
        behind.x * 2 + 1, 4, behind.z * 2 + 1
    );
}

function updateSmoke(dt) {
    if (!drifting && smokeSystem) {
        smokeSystem.emitRate = 0;
    }
}

// ── Nitro flame effect — called from animate() ──
function updateNitroFlame() {
    const flameOn = nitroActive && nitro > 0 && Math.abs(playerSpeed) > 2;

    if (!nitroFlameSystem || !nitroEmitter) return;

    if (flameOn) {
        const behind = new BABYLON.Vector3(-Math.sin(carHeading), 0, -Math.cos(carHeading));
        nitroEmitter.position.set(
            carX + behind.x * 3.5,
            carY + 0.5,
            carZ + behind.z * 3.5
        );

        // Flame shoots backwards
        nitroFlameSystem.direction1 = new BABYLON.Vector3(behind.x * 8 - 2, -1, behind.z * 8 - 2);
        nitroFlameSystem.direction2 = new BABYLON.Vector3(behind.x * 8 + 2, 2, behind.z * 8 + 2);
        nitroFlameSystem.emitRate = 300;

        nitroGlowSystem.direction1 = new BABYLON.Vector3(behind.x * 5 - 1, -0.5, behind.z * 5 - 1);
        nitroGlowSystem.direction2 = new BABYLON.Vector3(behind.x * 5 + 1, 1, behind.z * 5 + 1);
        nitroGlowSystem.emitRate = 80;

        // Speed lines overlay
        if (speedLinesOverlay) {
            speedLinesOverlay.style.opacity = '1';
            speedLinesOverlay.style.background = 'radial-gradient(ellipse at center,transparent 30%,rgba(100,150,255,0.04) 60%,rgba(100,180,255,0.12) 100%)';
        }
    } else {
        nitroFlameSystem.emitRate = 0;
        nitroGlowSystem.emitRate = 0;
    }
}

// ── Speed lines overlay intensity based on speed ──
function updateSpeedLines() {
    if (!speedLinesOverlay) return;
    if (nitroActive && nitro > 0) return; // nitro handles its own overlay

    const absSpeed = Math.abs(playerSpeed);
    const car = CARS[GameState.selectedCar];
    const maxSpd = (car.speed / 100) * 70;
    const ratio = Math.max(0, (absSpeed / maxSpd) - 0.6) / 0.4; // only above 60% speed

    if (ratio > 0) {
        const alpha = ratio * 0.08;
        speedLinesOverlay.style.opacity = String(Math.min(1, ratio));
        speedLinesOverlay.style.background = `radial-gradient(ellipse at center,transparent 35%,rgba(255,255,255,${alpha * 0.3}) 65%,rgba(200,220,255,${alpha}) 100%)`;
    } else {
        speedLinesOverlay.style.opacity = '0';
    }
}

let _lastSparkTime = 0;
function spawnSparks(x, y, z) {
    if (!sparkSystem) return;
    const now = performance.now();
    if (now - _lastSparkTime < 80) return;
    _lastSparkTime = now;

    sparkSystem.emitter = new BABYLON.Vector3(x, y + 0.3, z);
    sparkSystem.manualEmitCount = 35;
}

function updateSparks(dt) {
    // ParticleSystem handles this automatically
}

function spawnDust(x, y, z) {
    if (!dustSystem) return;
    dustSystem.emitter = new BABYLON.Vector3(x, y + 0.1, z);
    dustSystem.manualEmitCount = 8;
}

function updateSnowfall(dt) {
    if (!scene._snowParticles) return;
    const cx = carX, cz = carZ;
    scene._snowParticles.forEach(s => {
        s.position.y -= s._speed * dt;
        s.position.x += Math.sin(s._idx * 0.7 + raceTime) * dt * 1.5;
        s.position.z += Math.cos(s._idx * 1.1 + raceTime * 0.8) * dt * 1.0;

        if (s.position.y < -1) {
            s.position.y = 50 + Math.random() * 30;
            s.position.x = cx + (Math.random() - 0.5) * 200;
            s.position.z = cz + (Math.random() - 0.5) * 200;
        }
    });

    if (scene._emberParticles) {
        scene._emberParticles.forEach(e => {
            e.position.y += e._speed * dt;
            e.position.x += Math.sin(e._drift + raceTime * 0.5) * dt * 2;
            e.position.z += Math.cos(e._drift + raceTime * 0.3) * dt * 2;
            e.material.emissiveColor.r = 0.7 + Math.sin(raceTime * 10 + e._drift) * 0.3;

            if (e.position.y > 20) {
                e.position.y = 0;
                e.position.x = carX + (Math.random() - 0.5) * 300;
                e.position.z = carZ + (Math.random() - 0.5) * 300;
            }
        });
    }
}

// Dispose GPU particle systems (call from quitRace)
function disposeParticleSystems() {
    if (smokeSystem) { smokeSystem.dispose(); smokeSystem = null; }
    if (sparkSystem) { sparkSystem.dispose(); sparkSystem = null; }
    if (dustSystem) { dustSystem.dispose(); dustSystem = null; }
    if (smokeEmitter) { smokeEmitter.dispose(); smokeEmitter = null; }
    if (nitroFlameSystem) { nitroFlameSystem.dispose(); nitroFlameSystem = null; }
    if (nitroGlowSystem) { nitroGlowSystem.dispose(); nitroGlowSystem = null; }
    if (nitroEmitter) { nitroEmitter.dispose(); nitroEmitter = null; }
    if (speedLinesOverlay) { speedLinesOverlay.style.opacity = '0'; }
}

// ============================================================
//  NITRO PICKUPS — Asphalt-style boost canisters along the track
// ============================================================
let _nitroPickups = []; // [{ mesh, glow, t, active, respawn }]

function spawnNitroPickups(track) {
    // Clean up any leftovers from a previous race
    _nitroPickups.forEach(p => {
        try { p.mesh.dispose(); } catch(e) {}
        try { p.glow.dispose(); } catch(e) {}
    });
    _nitroPickups = [];

    if (!trackPoints || !trackPoints.length) return;

    const count = 14; // pickups around the lap
    const stepT = 1 / count;
    const upVec = new BABYLON.Vector3(0, 1, 0);

    // Glowing blue tetrahedron material
    const pickupMat = new BABYLON.StandardMaterial('nitroPickupMat', scene);
    pickupMat.disableLighting = true;
    pickupMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    pickupMat.emissiveColor = new BABYLON.Color3(0.20, 0.85, 1.0);
    pickupMat.alpha = 0.95;

    const haloMat = new BABYLON.StandardMaterial('nitroHaloMat', scene);
    haloMat.disableLighting = true;
    haloMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    haloMat.emissiveColor = new BABYLON.Color3(0.10, 0.55, 0.95);
    haloMat.alpha = 0.35;
    haloMat.backFaceCulling = false;

    for (let i = 0; i < count; i++) {
        const t = i * stepT + 0.04;
        const pos = getTrackPointAt(trackPoints, t);
        const dir = getTrackDirectionAt(trackPoints, t);
        const right = BABYLON.Vector3.Cross(upVec, dir).normalize();
        // Slight side offset so they don't all sit on the racing line
        const sideOffset = (i % 3 - 1) * 1.4;

        // Diamond-shaped icosphere as the pickup
        const mesh = BABYLON.MeshBuilder.CreatePolyhedron('nitroPickup' + i, {
            type: 1, size: 1.2,
        }, scene);
        mesh.material = pickupMat;
        mesh.position.set(
            pos.x + right.x * sideOffset,
            pos.y + 1.6,
            pos.z + right.z * sideOffset
        );

        // Soft halo plane behind the pickup
        const glow = BABYLON.MeshBuilder.CreateDisc('nitroHalo' + i, {
            radius: 1.8, tessellation: 18, sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        }, scene);
        glow.material = haloMat;
        glow.position.copyFrom(mesh.position);
        glow.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        _nitroPickups.push({ mesh, glow, t, active: true, respawn: 0, baseY: mesh.position.y });
    }
}

function updateNitroPickups(dt) {
    if (!_nitroPickups.length || !playerCar) return;
    const px = playerCar.position.x, pz = playerCar.position.z;
    const time = (typeof raceTime !== 'undefined' ? raceTime : performance.now() * 0.001);
    const collectRange2 = 16; // ~4m

    _nitroPickups.forEach(p => {
        if (p.active) {
            // Spin + bob
            p.mesh.rotation.y += dt * 2.5;
            p.mesh.position.y = p.baseY + Math.sin(time * 3 + p.t * 12) * 0.3;
            p.glow.position.y = p.mesh.position.y;
            // Collision check
            const dx = p.mesh.position.x - px;
            const dz = p.mesh.position.z - pz;
            if (dx * dx + dz * dz < collectRange2) {
                // Refill nitro and hide for a bit
                if (typeof nitro !== 'undefined') {
                    nitro = Math.min(100, nitro + 35);
                }
                p.active = false;
                p.mesh.setEnabled(false);
                p.glow.setEnabled(false);
                p.respawn = 8; // seconds until respawn
                if (typeof _showActionText === 'function') _showActionText('+NITRO', '#00ddff');
                if (typeof SoundEngine !== 'undefined' && SoundEngine.playNitro) SoundEngine.playNitro();
            }
        } else {
            p.respawn -= dt;
            if (p.respawn <= 0) {
                p.active = true;
                p.mesh.setEnabled(true);
                p.glow.setEnabled(true);
            }
        }
    });
}
