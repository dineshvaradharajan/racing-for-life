// ============================================================
//  EFFECTS: GPU Particle Systems — Cinematic quality
// ============================================================

// Legacy arrays kept so race.js quitRace() dispose loops don't error
let smokeParticles = [];
// sparkParticles is declared in scene.js — don't redeclare

let smokeSystem = null;
let sparkSystem = null;
let dustSystem = null;
let smokeEmitter = null;

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

function initParticleSystems() {
    const tex = _createParticleTexture();

    // ── Drift Smoke System ──
    smokeEmitter = new BABYLON.TransformNode("smokeEmitter", scene);
    smokeSystem = new BABYLON.ParticleSystem("smoke", 200, scene);
    smokeSystem.particleTexture = tex;
    smokeSystem.emitter = smokeEmitter;
    smokeSystem.minEmitBox = new BABYLON.Vector3(-1, 0, -0.5);
    smokeSystem.maxEmitBox = new BABYLON.Vector3(1, 0.3, 0.5);

    smokeSystem.color1 = new BABYLON.Color4(0.8, 0.78, 0.72, 0.6);
    smokeSystem.color2 = new BABYLON.Color4(0.7, 0.68, 0.62, 0.4);
    smokeSystem.colorDead = new BABYLON.Color4(0.5, 0.5, 0.5, 0);

    smokeSystem.minSize = 0.5;
    smokeSystem.maxSize = 2.5;
    smokeSystem.minLifeTime = 0.4;
    smokeSystem.maxLifeTime = 1.2;

    smokeSystem.emitRate = 0;
    smokeSystem.gravity = new BABYLON.Vector3(0, 2, 0);
    smokeSystem.direction1 = new BABYLON.Vector3(-2, 1, -2);
    smokeSystem.direction2 = new BABYLON.Vector3(2, 3, 2);

    smokeSystem.minEmitPower = 1;
    smokeSystem.maxEmitPower = 3;
    smokeSystem.updateSpeed = 0.02;

    // Size over lifetime (expand)
    smokeSystem.addSizeGradient(0, 0.5);
    smokeSystem.addSizeGradient(0.5, 1.5);
    smokeSystem.addSizeGradient(1.0, 3.0);

    // Alpha over lifetime (fade out)
    smokeSystem.addColorRemapGradient(0, 0, 1);
    smokeSystem.addColorRemapGradient(1.0, 0, 0);

    smokeSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    smokeSystem.start();

    // ── Spark System (burst-based) ──
    sparkSystem = new BABYLON.ParticleSystem("sparks", 300, scene);
    sparkSystem.particleTexture = tex;
    sparkSystem.emitter = new BABYLON.Vector3(0, 0, 0);
    sparkSystem.minEmitBox = new BABYLON.Vector3(-0.3, 0, -0.3);
    sparkSystem.maxEmitBox = new BABYLON.Vector3(0.3, 0.5, 0.3);

    sparkSystem.color1 = new BABYLON.Color4(1, 0.7, 0.2, 1);
    sparkSystem.color2 = new BABYLON.Color4(1, 0.4, 0.1, 1);
    sparkSystem.colorDead = new BABYLON.Color4(1, 0.1, 0, 0);

    sparkSystem.minSize = 0.03;
    sparkSystem.maxSize = 0.12;
    sparkSystem.minLifeTime = 0.1;
    sparkSystem.maxLifeTime = 0.5;

    sparkSystem.emitRate = 0;
    sparkSystem.gravity = new BABYLON.Vector3(0, -30, 0);
    sparkSystem.direction1 = new BABYLON.Vector3(-15, 5, -15);
    sparkSystem.direction2 = new BABYLON.Vector3(15, 15, 15);
    sparkSystem.minEmitPower = 5;
    sparkSystem.maxEmitPower = 20;
    sparkSystem.updateSpeed = 0.01;

    sparkSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    sparkSystem.start();

    // ── Dust System ──
    dustSystem = new BABYLON.ParticleSystem("dust", 100, scene);
    dustSystem.particleTexture = tex;
    dustSystem.emitter = new BABYLON.Vector3(0, 0, 0);
    dustSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    dustSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.2, 0.5);

    dustSystem.color1 = new BABYLON.Color4(0.65, 0.55, 0.38, 0.4);
    dustSystem.color2 = new BABYLON.Color4(0.55, 0.45, 0.30, 0.3);
    dustSystem.colorDead = new BABYLON.Color4(0.4, 0.35, 0.25, 0);

    dustSystem.minSize = 0.3;
    dustSystem.maxSize = 1.5;
    dustSystem.minLifeTime = 0.5;
    dustSystem.maxLifeTime = 1.5;

    dustSystem.emitRate = 0;
    dustSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);
    dustSystem.direction1 = new BABYLON.Vector3(-3, 0.5, -3);
    dustSystem.direction2 = new BABYLON.Vector3(3, 2, 3);
    dustSystem.minEmitPower = 1;
    dustSystem.maxEmitPower = 3;

    dustSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    dustSystem.start();
}

function spawnDriftSmoke() {
    if (!smokeSystem || !playerCar || !drifting || Math.abs(playerSpeed) < 5) {
        if (smokeSystem) smokeSystem.emitRate = 0;
        return;
    }

    const intensity = Math.min(Math.abs(playerSpeed) / 40, 1);
    const behind = new BABYLON.Vector3(-Math.sin(carHeading), 0, -Math.cos(carHeading));

    // Position emitter behind car
    smokeEmitter.position.set(
        carX + behind.x * 3,
        carY + 0.2,
        carZ + behind.z * 3
    );

    // Scale emission rate with intensity
    smokeSystem.emitRate = Math.floor(30 * intensity);
    smokeSystem.minEmitPower = 1 + intensity * 2;
    smokeSystem.maxEmitPower = 3 + intensity * 4;

    // Set direction based on car heading
    smokeSystem.direction1 = new BABYLON.Vector3(
        behind.x * 2 - 1, 1, behind.z * 2 - 1
    );
    smokeSystem.direction2 = new BABYLON.Vector3(
        behind.x * 2 + 1, 3, behind.z * 2 + 1
    );
}

function updateSmoke(dt) {
    // ParticleSystem handles its own update.
    // Just ensure emitRate is 0 when not drifting.
    if (!drifting && smokeSystem) {
        smokeSystem.emitRate = 0;
    }
}

let _lastSparkTime = 0;
function spawnSparks(x, y, z) {
    if (!sparkSystem) return;
    // Throttle sparks to avoid overwhelming
    const now = performance.now();
    if (now - _lastSparkTime < 100) return;
    _lastSparkTime = now;

    // Move emitter to collision point and fire a burst
    sparkSystem.emitter = new BABYLON.Vector3(x, y + 0.3, z);
    sparkSystem.manualEmitCount = 25;
}

function updateSparks(dt) {
    // ParticleSystem handles this automatically
}

function spawnDust(x, y, z) {
    if (!dustSystem) return;
    dustSystem.emitter = new BABYLON.Vector3(x, y + 0.1, z);
    dustSystem.manualEmitCount = 5;
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
}
