// ============================================================
//  RACE LIFECYCLE — Smooth camera, replay system
// ============================================================

// Replay recording
let replayFrames = [];
let replayMode = false;
let replayTime = 0;
let replayDuration = 0;
let replayCamAngle = 0;
let finishPositions = [];
let finishXP = 0;

function startRace() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Mute the procedural synth, then start the local MP3 playlist (the user's
    // own pop tracks dropped in /music/).
    initScene();

    // Reset replay state
    replayFrames = [];
    replayMode = false;
    replayTime = 0;
    finishPositions = [];

    // Reset arcade counters
    if (typeof driftScore !== 'undefined') { driftScore = 0; driftCombo = 0; driftTimer = 0; }
    if (typeof nearMissCount !== 'undefined') { nearMissCount = 0; nearMissTimer = 0; }
    if (typeof knockdownCount !== 'undefined') knockdownCount = 0;
    if (typeof nitroActive !== 'undefined') nitroActive = false;

    // Countdown
    const cd = document.getElementById('countdown');
    cd.classList.add('active');
    let count = 3;
    cd.textContent = count;

    const countInterval = setInterval(() => {
        count--;
        if (count > 0) {
            cd.textContent = count;
        } else if (count === 0) {
            cd.textContent = 'GO!';
            cd.style.color = '#2ecc71';
        } else {
            cd.classList.remove('active');
            cd.style.color = '#ff6b35';
            clearInterval(countInterval);
            GameState.racing = true;
            GameState.paused = false;
            SoundEngine.init();
            // Asphalt-style audio: silence the engine entirely so the music
            // dominates the race. Tiny residual rumble (~0.05) keeps the car
            // feeling like it's moving without overpowering the soundtrack.
            try {
                const ctx = SoundEngine.ctx;
                if (ctx && SoundEngine._master) {
                    const t = ctx.currentTime + 0.2;
                    SoundEngine._master.gain.linearRampToValueAtTime(0.05, t);
                }
            } catch(e) {}
            if (typeof initParticleSystems === 'function') initParticleSystems();

            document.getElementById('hud').classList.add('active');
            document.getElementById('positions-panel').classList.add('active');
            document.getElementById('minimap').classList.add('active');
            document.getElementById('controls-help').classList.add('active');

            lastFrameTime = performance.now();
            engine.runRenderLoop(animate);
        }
    }, 1000);
}

function animate() {
    if (!GameState.racing) { engine.stopRenderLoop(); return; }
    if (GameState.paused) return;

    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (replayMode) {
        animateReplay(dt);
        scene.render();
        return;
    }

    raceTime += dt;

    updatePlayer(dt);
    updateAI(dt);
    updateCamera(dt);
    updateHUD();
    updateMinimap();

    spawnDriftSmoke();
    updateSmoke(dt);
    updateSnowfall(dt);
    if (typeof updateNitroFlame === 'function') updateNitroFlame();
    if (typeof updateSpeedLines === 'function') updateSpeedLines();

    const car = CARS[GameState.selectedCar];
    const maxSpd = (car.speed / 100) * 120;
    SoundEngine.updateEngine(playerSpeed, maxSpd);

    updateSparks(dt);

    // Dynamic FOV — more aggressive like Asphalt Legends
    const speedRatio = Math.abs(playerSpeed) / maxSpd;
    const fovBoost = nitroActive ? 12 : 0;
    const targetFov = (65 + speedRatio * 8 + fovBoost) * Math.PI / 180;
    camera.fov += (targetFov - camera.fov) * Math.min(1, 5 * dt);

    // Camera shake on nitro and high speed
    if (nitroActive) {
        camShake = 0.15;
    } else if (speedRatio > 0.8) {
        camShake = (speedRatio - 0.8) * 0.3;
    } else {
        camShake = 0;
    }

    // Motion blur + chromatic aberration ramp — Asphalt-style speed rush
    if (typeof motionBlur !== 'undefined' && motionBlur) {
        const targetBlur = nitroActive ? 1.6 : Math.max(0, (speedRatio - 0.5)) * 1.4;
        motionBlur.motionStrength += (targetBlur - motionBlur.motionStrength) * Math.min(1, 8 * dt);
    }
    if (typeof chromaticAberration !== 'undefined' && chromaticAberration) {
        const base = (typeof baseAberration !== 'undefined') ? baseAberration : 18;
        const targetAb = base + (nitroActive ? 55 : speedRatio * 18);
        chromaticAberration.aberrationAmount += (targetAb - chromaticAberration.aberrationAmount) * Math.min(1, 6 * dt);
    }

    // Record frame for replay (every 3rd frame to save memory)
    if (replayFrames.length === 0 || raceTime - (replayFrames[replayFrames.length - 1]?.t || 0) > 0.05) {
        const ais = aiCars.map(ai => ({
            x: ai.mesh.position.x,
            y: ai.mesh.position.y,
            z: ai.mesh.position.z,
            heading: ai.mesh.rotation.y,
        }));
        replayFrames.push({
            t: raceTime,
            px: carX, py: carY, pz: carZ,
            heading: carHeading,
            speed: playerSpeed,
            ais,
        });
    }

    scene.render();
}

// ── Spring-damper camera system ──
function updateCamera(dt) {
    const carPos = playerCar.position;
    const fwdX = Math.sin(carHeading);
    const fwdZ = Math.cos(carHeading);
    const absSpeed = Math.abs(playerSpeed);

    if (GameState.cameraMode === 0) {
        // ── Chase cam — cinematic spring physics ──
        const dist = 5 + absSpeed * 0.025;
        const height = 2.0 + absSpeed * 0.010;
        const lookAhead = 6 + absSpeed * 0.08;

        let targetX = carPos.x - fwdX * dist;
        let targetY = carPos.y + height;
        let targetZ = carPos.z - fwdZ * dist;

        // Camera shake
        if (camShake > 0) {
            targetX += (Math.random() - 0.5) * camShake;
            targetY += (Math.random() - 0.5) * camShake * 0.5;
            targetZ += (Math.random() - 0.5) * camShake;
        }

        const stiffness = 7;
        const damping = 4.8;
        const ax = stiffness * (targetX - camPosX) - damping * camVelX;
        const ay = stiffness * (targetY - camPosY) - damping * camVelY;
        const az = stiffness * (targetZ - camPosZ) - damping * camVelZ;
        camVelX += ax * dt;
        camVelY += ay * dt;
        camVelZ += az * dt;
        camPosX += camVelX * dt;
        camPosY += camVelY * dt;
        camPosZ += camVelZ * dt;

        camera.position.set(camPosX, camPosY, camPosZ);

        // More dramatic roll on steering
        const targetRoll = -carSteerAngle * 0.12 * Math.min(absSpeed / 15, 1);
        camera.rotation.z = camera.rotation.z || 0;
        camera.rotation.z += (targetRoll - camera.rotation.z) * Math.min(1, 6 * dt);

        const lookX = carPos.x + fwdX * lookAhead;
        const lookY = carPos.y + 0.7;
        const lookZ = carPos.z + fwdZ * lookAhead;
        camera.setTarget(new BABYLON.Vector3(lookX, lookY, lookZ));

    } else if (GameState.cameraMode === 1) {
        // ── Hood cam ──
        const camX = carPos.x + fwdX * 1.8;
        const camY = carPos.y + 2.0;
        const camZ = carPos.z + fwdZ * 1.8;
        camera.position.x += (camX - camera.position.x) * Math.min(1, 15 * dt);
        camera.position.y += (camY - camera.position.y) * Math.min(1, 15 * dt);
        camera.position.z += (camZ - camera.position.z) * Math.min(1, 15 * dt);

        camera.setTarget(new BABYLON.Vector3(
            carPos.x + fwdX * 60,
            carPos.y + 1,
            carPos.z + fwdZ * 60
        ));

    } else {
        // ── Cinematic high chase ──
        const dist = 14 + absSpeed * 0.05;
        const height = 6 + absSpeed * 0.015;
        const targetX = carPos.x - fwdX * dist;
        const targetY = carPos.y + height;
        const targetZ = carPos.z - fwdZ * dist;
        camera.position.x += (targetX - camera.position.x) * Math.min(1, 3 * dt);
        camera.position.y += (targetY - camera.position.y) * Math.min(1, 3 * dt);
        camera.position.z += (targetZ - camera.position.z) * Math.min(1, 3 * dt);
        camera.setTarget(new BABYLON.Vector3(carPos.x, carPos.y + 1, carPos.z));
    }
}

// ── Replay system ──
function startReplay() {
    replayMode = true;
    replayTime = 0;
    replayDuration = replayFrames.length > 0 ? replayFrames[replayFrames.length - 1].t : 10;
    replayCamAngle = 0;

    // Silence the entire engine chain (noise rumble + hiss + harmonic tones)
    // by ducking the master gain. The replay should be music-only.
    try {
        const ctx = SoundEngine.ctx;
        const t = ctx ? ctx.currentTime + 0.2 : 0;
        if (SoundEngine._master)     SoundEngine._master.gain.linearRampToValueAtTime(0, t);
        if (SoundEngine.engineGain)  SoundEngine.engineGain.gain.linearRampToValueAtTime(0, t);
        if (SoundEngine.engineGain2) SoundEngine.engineGain2.gain.linearRampToValueAtTime(0, t);
        if (SoundEngine.engineGain3) SoundEngine.engineGain3.gain.linearRampToValueAtTime(0, t);
        if (SoundEngine._lowG)       SoundEngine._lowG.gain.linearRampToValueAtTime(0, t);
        if (SoundEngine._hissG)      SoundEngine._hissG.gain.linearRampToValueAtTime(0, t);
    } catch(e) {}
    // Hide race HUD
    document.getElementById('hud').classList.remove('active');
    document.getElementById('positions-panel').classList.remove('active');
    document.getElementById('minimap').classList.remove('active');
    document.getElementById('controls-help').classList.remove('active');

    // Show replay overlay with leaderboard
    const overlay = document.getElementById('replay-overlay');
    overlay.classList.add('active');

    // Build leaderboard
    buildReplayLeaderboard();

    // Reset camera FOV for cinematic replay
    camera.fov = 60 * Math.PI / 180;
    camera.rotation.z = 0;
}

function buildReplayLeaderboard() {
    const container = document.getElementById('replay-lb-entries');
    container.innerHTML = '';

    finishPositions.forEach((entry, idx) => {
        const div = document.createElement('div');
        div.className = 'lb-entry';

        const pos = document.createElement('div');
        pos.className = 'lb-pos';
        pos.textContent = idx + 1;

        const name = document.createElement('div');
        name.className = 'lb-name' + (entry.isPlayer ? ' is-player' : '');
        name.textContent = entry.name;
        if (entry.color && !entry.isPlayer) {
            name.style.color = entry.color;
        }

        const time = document.createElement('div');
        const finished = entry.finished || entry.isPlayer;
        time.className = 'lb-time' + (finished ? ' finished' : '');
        let ft;
        if (finished) {
            ft = entry.finishTime || 0;
        } else {
            // Project an estimated finish time from race progress so every
            // racer shows a real time instead of "DNF".
            const totalLaps = Math.max(1, GameState.laps || 1);
            const progress = (entry.lap || 0) + Math.min(1, Math.max(0, entry.t || 0));
            const frac = Math.max(0.05, progress / totalLaps);
            ft = (raceTime || 0) / frac;
        }
        const mins = Math.floor(ft / 60);
        const secs = (ft % 60).toFixed(1);
        time.textContent = `${mins}:${secs.padStart(4, '0')}`;

        div.appendChild(pos);
        div.appendChild(name);
        div.appendChild(time);
        container.appendChild(div);
    });
}

function animateReplay(dt) {
    replayTime += dt;
    replayCamAngle += dt * 0.12;

    // Find two surrounding frames and interpolate smoothly
    const playbackT = replayTime % replayDuration;
    let f0 = replayFrames[0], f1 = replayFrames[0];
    for (let i = 0; i < replayFrames.length - 1; i++) {
        if (replayFrames[i].t <= playbackT && replayFrames[i + 1].t > playbackT) {
            f0 = replayFrames[i];
            f1 = replayFrames[i + 1];
            break;
        }
        f0 = replayFrames[i];
        f1 = replayFrames[Math.min(i + 1, replayFrames.length - 1)];
    }

    // Lerp between frames for smooth car motion
    const span = f1.t - f0.t;
    const alpha = span > 0 ? (playbackT - f0.t) / span : 0;
    const smoothAlpha = alpha * alpha * (3 - 2 * alpha); // smoothstep
    const fpx = f0.px + (f1.px - f0.px) * smoothAlpha;
    const fpy = f0.py + (f1.py - f0.py) * smoothAlpha;
    const fpz = f0.pz + (f1.pz - f0.pz) * smoothAlpha;

    // Smooth heading interpolation (handle wraparound)
    let headingDiff = f1.heading - f0.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    const fheading = f0.heading + headingDiff * smoothAlpha;

    // Smoothly move car (extra damping to prevent any jitter)
    const carLerp = Math.min(1, 12 * dt);
    playerCar.position.x += (fpx - playerCar.position.x) * carLerp;
    playerCar.position.y += (fpy + 0.1 - playerCar.position.y) * carLerp;
    playerCar.position.z += (fpz - playerCar.position.z) * carLerp;
    playerCar.rotation.y = fheading;
    playerCar.rotation.x = 0;
    playerCar.rotation.z = 0;

    // AI cars — replay their recorded positions in lockstep with the player
    const f0Ais = f0.ais || [];
    const f1Ais = f1.ais || f0Ais;
    const aiLerp = Math.min(1, 12 * dt);
    aiCars.forEach((ai, i) => {
        const a0 = f0Ais[i];
        const a1 = f1Ais[i] || a0;
        if (!a0) return;
        const ax = a0.x + (a1.x - a0.x) * smoothAlpha;
        const ay = a0.y + (a1.y - a0.y) * smoothAlpha;
        const az = a0.z + (a1.z - a0.z) * smoothAlpha;
        let aHeadDiff = a1.heading - a0.heading;
        while (aHeadDiff > Math.PI) aHeadDiff -= Math.PI * 2;
        while (aHeadDiff < -Math.PI) aHeadDiff += Math.PI * 2;
        const aHead = a0.heading + aHeadDiff * smoothAlpha;
        ai.mesh.position.x += (ax - ai.mesh.position.x) * aiLerp;
        ai.mesh.position.y += (ay - ai.mesh.position.y) * aiLerp;
        ai.mesh.position.z += (az - ai.mesh.position.z) * aiLerp;
        ai.mesh.rotation.y = aHead;
        ai.mesh.rotation.x = 0;
        ai.mesh.rotation.z = 0;
    });

    // Cinematic camera — very smooth, slow follow
    const carPos = playerCar.position;
    const fwd = Math.sin(fheading);
    const fwdZ = Math.cos(fheading);
    const camLerp = Math.min(1, 1.5 * dt); // very gentle follow

    // Single smooth orbit — no jarring angle switches
    const orbitR = 16 + Math.sin(replayTime * 0.2) * 4; // breathing distance
    const orbitHeight = 4 + Math.sin(replayTime * 0.15) * 2; // gentle height wave
    const cx = carPos.x + Math.sin(replayCamAngle) * orbitR;
    const cy = carPos.y + orbitHeight;
    const cz = carPos.z + Math.cos(replayCamAngle) * orbitR;

    camera.position.x += (cx - camera.position.x) * camLerp;
    camera.position.y += (cy - camera.position.y) * camLerp;
    camera.position.z += (cz - camera.position.z) * camLerp;

    // Smooth look-at target (slightly ahead of car)
    const lookX = carPos.x + fwd * 3;
    const lookY = carPos.y + 1;
    const lookZ = carPos.z + fwdZ * 3;
    camera.setTarget(new BABYLON.Vector3(lookX, lookY, lookZ));
    camera.rotation.z = 0;

    // Auto-end replay after full playback
    if (replayTime >= replayDuration + 2) {
        skipReplay();
    }
}

function skipReplay() {
    replayMode = false;
    document.getElementById('replay-overlay').classList.remove('active');
    showResultScreen();
}

function showResultScreen() {
    const playerPos = finishPositions.findIndex(p => p.isPlayer) + 1;

    const rs = document.getElementById('result-screen');
    const suffixes = ['st','nd','rd'];
    const posText = playerPos + (suffixes[playerPos - 1] || 'th');

    let posClass = 'result-other';
    if (playerPos === 1) posClass = 'result-gold';
    else if (playerPos === 2) posClass = 'result-silver';
    else if (playerPos === 3) posClass = 'result-bronze';

    document.getElementById('result-position').className = `result-position ${posClass}`;
    document.getElementById('result-position').textContent = posText;

    const messages = { 1: 'WINNER! Amazing race!', 2: 'So close! Great effort!', 3: 'On the podium! Nice!' };
    document.getElementById('result-text').textContent = messages[playerPos] || 'Keep practicing!';

    const mins = Math.floor(raceTime / 60);
    const secs = Math.floor(raceTime % 60);
    document.getElementById('result-time').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (bestLapTime < Infinity) {
        const blm = Math.floor(bestLapTime / 60);
        const bls = Math.floor(bestLapTime % 60);
        document.getElementById('result-best-lap').textContent = `${blm}:${bls.toString().padStart(2, '0')}`;
    } else {
        document.getElementById('result-best-lap').textContent = '-';
    }

    document.getElementById('result-top-speed').textContent = Math.round(topSpeed) + ' km/h';
    document.getElementById('result-xp').textContent = `+${finishXP} XP`;

    // Show arcade stats
    const knockdownEl = document.getElementById('result-knockdowns');
    const nearMissEl = document.getElementById('result-nearmiss');
    if (knockdownEl) knockdownEl.textContent = (typeof knockdownCount !== 'undefined' ? knockdownCount : 0);
    if (nearMissEl) nearMissEl.textContent = (typeof nearMissCount !== 'undefined' ? nearMissCount : 0);

    rs.classList.add('active');
}

// ── Race finish — triggers replay ──
function finishRace() {
    raceFinished = true;
    const positions = getPositions();
    const playerPos = positions.findIndex(p => p.isPlayer) + 1;

    let xpEarned = 10;
    if (playerPos === 1) xpEarned = 50;
    else if (playerPos === 2) xpEarned = 30;
    else if (playerPos === 3) xpEarned = 20;
    // Bonus XP for arcade actions
    xpEarned += (typeof knockdownCount !== 'undefined' ? knockdownCount : 0) * 5;
    xpEarned += (typeof nearMissCount !== 'undefined' ? nearMissCount : 0) * 2;
    xpEarned *= (1 + GameState.difficulty * 0.5);
    xpEarned = Math.round(xpEarned);

    GameState.xp += xpEarned;
    if (playerPos <= 3) GameState.wins++;
    saveProgress();

    // Store finish data for later display
    finishPositions = positions;
    finishXP = xpEarned;

    // Start replay after a brief moment
    setTimeout(() => {
        startReplay();
    }, 500);
}

function pauseRace() {
    GameState.paused = true;
    document.getElementById('pause-screen').classList.add('active');
}

function resumeRace() {
    GameState.paused = false;
    document.getElementById('pause-screen').classList.remove('active');
    lastFrameTime = performance.now();
}

function quitRace() {
    GameState.racing = false;
    GameState.paused = false;
    replayMode = false;
    SoundEngine.stop();

    if (engine) engine.stopRenderLoop();

    // Dispose particles
    smokeParticles.forEach(sp => sp.mesh && sp.mesh.dispose());
    smokeParticles = [];
    sparkParticles.forEach(sp => sp.mesh && sp.mesh.dispose());
    sparkParticles = [];
    if (typeof disposeParticleSystems === 'function') disposeParticleSystems();

    // Hide everything
    document.getElementById('hud').classList.remove('active');
    document.getElementById('positions-panel').classList.remove('active');
    document.getElementById('minimap').classList.remove('active');
    document.getElementById('controls-help').classList.remove('active');
    document.getElementById('pause-screen').classList.remove('active');
    document.getElementById('result-screen').classList.remove('active');
    document.getElementById('replay-overlay').classList.remove('active');

    // Clear model cache before disposing scene
    if (typeof clearModelCache === 'function') clearModelCache();

    // Dispose Babylon scene + engine
    if (scene) scene.dispose();
    if (engine) engine.dispose();
    scene = null;
    engine = null;
    trackMeshes = [];

    const canvas = document.getElementById('renderCanvas');
    canvas.style.display = 'none';

    showScreen('main-menu');
}
