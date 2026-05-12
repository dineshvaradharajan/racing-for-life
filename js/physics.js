// ============================================================
//  PLAYER PHYSICS & AI — Arcade style (Asphalt Legends feel)
// ============================================================

// Drift scoring system
let driftScore = 0;
let driftCombo = 0;
let driftTimer = 0;
let lastDriftScore = 0;
let nearMissTimer = 0;
let nearMissCount = 0;
let knockdownCount = 0;
let nitroActive = false;
let _prevShiftHeld = false;
let slipstreamTimer = 0;
let airborneTimer = 0;

function findClosestTrackT(x, z) {
    let bestT = 0, bestDist = Infinity;
    for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < bestDist) { bestDist = d; bestT = i / trackPoints.length; }
    }
    for (let off = -0.02; off <= 0.02; off += 0.001) {
        const t = ((bestT + off) % 1 + 1) % 1;
        const p = getTrackPointAt(trackPoints, t);
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < bestDist) { bestDist = d; bestT = t; }
    }
    return bestT;
}

function updatePlayer(dt) {
    if (raceFinished) return;
    const car = CARS[GameState.selectedCar];
    const track = TRACKS[GameState.selectedTrack];
    const up = new BABYLON.Vector3(0, 1, 0);

    // Arcade-style higher speeds
    const maxSpd = (car.speed / 100) * 85;
    const accelForce = (car.accel / 100) * 65;
    const turnRate = (car.handling / 100) * 0.7;
    const maxSteer = 0.22;
    const wheelBase = 5.5;
    const grip = 0.96;
    const drag = 0.988;

    // ── Throttle / Brake — arcade responsive ──
    if (keys['w'] || keys['arrowup']) {
        const speedFactor = 1 - (Math.abs(playerSpeed) / maxSpd) * 0.4;
        playerSpeed = Math.min(playerSpeed + accelForce * speedFactor * dt, maxSpd);
    } else if (keys['s'] || keys['arrowdown']) {
        playerSpeed = Math.max(playerSpeed - accelForce * 2.0 * dt, -maxSpd * 0.35);
    } else {
        playerSpeed *= Math.pow(0.75, dt);
        if (Math.abs(playerSpeed) < 0.5) playerSpeed = 0;
    }

    // ── Drift System — arcade style, earn nitro from drifting ──
    const wasDrifting = drifting;
    drifting = false;
    if (keys[' ']) {
        // Handbrake drift — slow down less, more slidey
        playerSpeed *= Math.pow(0.25, dt);
        drifting = true;
        if (!wasDrifting && Math.abs(playerSpeed) > 10) SoundEngine.playDrift();
    }
    if (keys['p']) {
        drifting = true;
        if (!wasDrifting && Math.abs(playerSpeed) > 10) SoundEngine.playDrift();
    }

    // Drift scoring — earn nitro from drifting
    if (drifting && Math.abs(playerSpeed) > 15) {
        driftTimer += dt;
        driftScore += Math.abs(playerSpeed) * dt * 2;
        driftCombo = Math.floor(driftTimer / 1.5) + 1;
        // Earn nitro from drifting (key arcade mechanic)
        nitro = Math.min(100, nitro + 12 * dt * driftCombo);
    } else if (wasDrifting && !drifting) {
        // Drift ended — award bonus
        if (driftScore > 50) {
            lastDriftScore = Math.round(driftScore * driftCombo);
            _showDriftBonus(lastDriftScore, driftCombo);
        }
        driftScore = 0;
        driftCombo = 0;
        driftTimer = 0;
    }

    // ── Nitro System — tap-to-fire ──
    // One Shift tap fires the nitro: it drains the tank automatically and
    // boosts top speed. No need to hold the key, no second-tap mechanic.
    const NITRO_MIN_TO_START = 25;
    const shiftHeld = !!keys['shift'];
    const shiftPressed = shiftHeld && !_prevShiftHeld;
    _prevShiftHeld = shiftHeld;

    if (shiftPressed && !nitroActive && nitro >= NITRO_MIN_TO_START) {
        nitroActive = true;
    }

    if (nitroActive) {
        if (nitro > 0) {
            playerSpeed = Math.min(playerSpeed + accelForce * 3.5 * dt, maxSpd * 1.4);
            nitro = Math.max(0, nitro - 25 * dt);
        } else {
            nitroActive = false;
        }
    } else {
        nitro = Math.min(100, nitro + 3 * dt);
    }

    // ── Steering — arcade responsive ──
    let targetSteer = 0;
    if (keys['a'] || keys['arrowleft']) targetSteer = maxSteer;
    if (keys['d'] || keys['arrowright']) targetSteer = -maxSteer;

    // Faster steering response for arcade feel
    const steerSpeed = targetSteer !== 0 ? turnRate * 7 : 10;
    carSteerAngle += (targetSteer - carSteerAngle) * Math.min(1, steerSpeed * dt);

    // ── Bicycle model steering ──
    const absSpeed = Math.abs(playerSpeed);
    if (absSpeed > 0.5) {
        const turnRadius = wheelBase / Math.tan(Math.abs(carSteerAngle) + 0.001);
        const angularVel = (playerSpeed / turnRadius) * Math.sign(carSteerAngle);
        // Less speed damping than sim — more control at high speed
        const speedDamping = 1.0 / (1.0 + absSpeed * 0.004);
        // Extra turn rate while drifting
        const driftBoost = drifting ? 1.4 : 1.0;
        carHeading += angularVel * dt * speedDamping * driftBoost;
    }

    // ── Velocity with grip physics ──
    const forwardX = Math.sin(carHeading);
    const forwardZ = Math.cos(carHeading);
    const targetVelX = forwardX * playerSpeed;
    const targetVelZ = forwardZ * playerSpeed;

    // Drift reduces grip — more slidey for arcade feel
    const g = drifting ? 0.78 : grip;
    carVelX = carVelX * (1 - g) + targetVelX * g;
    carVelZ = carVelZ * (1 - g) + targetVelZ * g;
    carVelX *= drag;
    carVelZ *= drag;

    carX += carVelX * dt;
    carZ += carVelZ * dt;

    // ── Track following ──
    const closestT = findClosestTrackT(carX, carZ);
    const trackPt = getTrackPointAt(trackPoints, closestT);

    const targetY = trackPt.y + 0.1;
    carY += (targetY - carY) * Math.min(1, 10 * dt);

    // ── Keep car on track — softer boundaries for arcade ──
    const trackDir = getTrackDirectionAt(trackPoints, closestT);
    const trackRight = BABYLON.Vector3.Cross(up, trackDir).normalize();
    const toCarX = carX - trackPt.x;
    const toCarZ = carZ - trackPt.z;
    const lateralDist = toCarX * trackRight.x + toCarZ * trackRight.z;
    const hw = track.trackWidth / 2;

    if (Math.abs(lateralDist) > hw * 0.8 && absSpeed > 10 && Math.random() > 0.7) {
        if (typeof spawnDust === 'function') spawnDust(carX, carY + 0.2, carZ);
    }

    if (Math.abs(lateralDist) > hw) {
        const pushBack = (Math.abs(lateralDist) - hw + 1.5) * Math.sign(lateralDist);
        carX -= trackRight.x * pushBack;
        carZ -= trackRight.z * pushBack;
        const velDotRight = carVelX * trackRight.x + carVelZ * trackRight.z;
        carVelX -= trackRight.x * velDotRight * 1.2;
        carVelZ -= trackRight.z * velDotRight * 1.2;
        playerSpeed *= 0.92; // Less speed penalty (arcade)
        SoundEngine.playCollision();
        spawnSparks(carX, carY, carZ);
        const headingDotRight = Math.sin(carHeading) * trackRight.x + Math.cos(carHeading) * trackRight.z;
        carHeading -= headingDotRight * 0.08;
    }
    if (Math.abs(lateralDist) > hw * 0.85) {
        playerSpeed *= Math.pow(0.82, dt); // Less penalty
    }

    // ── Slipstream / Drafting — get nitro from following AI closely ──
    slipstreamTimer = Math.max(0, slipstreamTimer - dt);
    let inSlipstream = false;
    aiCars.forEach(ai => {
        const dx = ai.mesh.position.x - carX;
        const dz = ai.mesh.position.z - carZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 12 && dist > 3) {
            // Check if AI is ahead of us (in our forward direction)
            const dotForward = dx * forwardX + dz * forwardZ;
            if (dotForward > 0) {
                inSlipstream = true;
                // Speed boost from slipstream
                playerSpeed = Math.min(playerSpeed + 8 * dt, maxSpd * 1.08);
                // Earn nitro from drafting
                nitro = Math.min(100, nitro + 6 * dt);
            }
        }
    });
    if (inSlipstream && slipstreamTimer <= 0) {
        slipstreamTimer = 2;
        _showActionText('SLIPSTREAM!', '#00ccff');
    }

    // ── Lap detection ──
    const prevT = playerT;
    playerT = closestT;
    if (prevT > 0.9 && playerT < 0.1) {
        const lapTime = raceTime - lapStartTime;
        if (lapTime > 5) {
            if (lapTime < bestLapTime) bestLapTime = lapTime;
            lapStartTime = raceTime;
            playerLap++;
            if (playerLap > GameState.laps) { finishRace(); return; }
        }
    }

    const displaySpeed = Math.sqrt(carVelX * carVelX + carVelZ * carVelZ) * 3.6;
    if (displaySpeed > topSpeed) topSpeed = displaySpeed;

    // ── Suspension — arcade bouncy ──
    const isF1Car = car.style === 'f1';
    if (!isF1Car) {
        const stiffness = 45, dampingK = 6;
        const bumpForce = Math.sin(raceTime * 12 + carX * 0.4) * absSpeed * 0.0006
                        + Math.sin(raceTime * 19 + carZ * 0.25) * absSpeed * 0.0005;
        let pitchInput = 0;
        if (keys['w'] || keys['arrowup']) pitchInput = -0.02 * Math.min(absSpeed / 25, 1);
        else if (keys['s'] || keys['arrowdown']) pitchInput = 0.04 * Math.min(absSpeed / 10, 1);

        suspVel += (-stiffness * suspBounce - dampingK * suspVel + bumpForce * 60) * dt;
        suspBounce += suspVel * dt;
        suspBounce = Math.max(-0.15, Math.min(0.15, suspBounce));

        const targetPitch = pitchInput + bumpForce * 0.12;
        suspPitch += (targetPitch - suspPitch) * Math.min(1, 7 * dt);

        // More dramatic body roll in turns
        const targetRoll = -carSteerAngle * 0.09 * Math.min(absSpeed / 20, 1);
        suspRoll += (targetRoll - suspRoll) * Math.min(1, 6 * dt);
    } else {
        suspBounce *= 0.9;
        suspVel *= 0.9;
        suspPitch *= 0.9;
        suspRoll *= 0.9;
    }

    // ── Update mesh position ──
    playerCar.position.set(carX, carY + suspBounce, carZ);
    playerCar.rotation.y = carHeading;
    playerCar.rotation.z = suspRoll;
    playerCar.rotation.x = suspPitch;

    if (playerCar.wheels) {
        playerCar.wheels.forEach(w => { w.rotation.x += absSpeed * dt * 3; });
    }
    checkCollisions();
    if (typeof updateNitroPickups === 'function') updateNitroPickups(dt);
}

function checkCollisions() {
    const pPos = playerCar.position;
    const collisionDist = 4.0;

    aiCars.forEach(ai => {
        const dx = pPos.x - ai.mesh.position.x;
        const dz = pPos.z - ai.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Near miss detection (close but no collision)
        if (dist < 6 && dist > collisionDist && Math.abs(playerSpeed) > 20) {
            nearMissTimer += 0.016;
            if (nearMissTimer > 0.3) {
                nearMissCount++;
                nearMissTimer = 0;
                // Earn nitro from near misses
                nitro = Math.min(100, nitro + 8);
                _showActionText('NEAR MISS! +NOS', '#ffcc00');
            }
        }

        if (dist < collisionDist && dist > 0.01) {
            const nx = dx / dist, nz = dz / dist;
            const overlap = collisionDist - dist;
            carX += nx * overlap * 0.5;
            carZ += nz * overlap * 0.5;
            const relVel = carVelX * nx + carVelZ * nz;
            if (relVel < 0) {
                carVelX -= nx * relVel * 1.5;
                carVelZ -= nz * relVel * 1.5;
            }

            // Knockdown system — if we're faster, knock them aside
            const mySpeed = Math.abs(playerSpeed);
            if (mySpeed > ai.speed * 1.2 && mySpeed > 25) {
                knockdownCount++;
                ai.speed *= 0.5; // Slow them way down
                ai.lateralOffset += (Math.random() - 0.5) * 8; // Push them sideways
                nitro = Math.min(100, nitro + 15); // Reward nitro
                playerSpeed *= 0.88; // Less penalty for knockdowns
                _showActionText('KNOCKDOWN! +NOS', '#ff4444');
            } else {
                playerSpeed *= 0.78;
                ai.speed *= 0.85;
            }

            SoundEngine.playCollision();
            spawnSparks((pPos.x + ai.mesh.position.x) / 2, pPos.y + 0.5, (pPos.z + ai.mesh.position.z) / 2);
        }
    });

    // AI-AI collisions
    for (let i = 0; i < aiCars.length; i++) {
        for (let j = i + 1; j < aiCars.length; j++) {
            const a = aiCars[i].mesh.position, b = aiCars[j].mesh.position;
            const dx = a.x - b.x, dz = a.z - b.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < collisionDist && dist > 0.01) {
                const push = (collisionDist - dist) * 0.5;
                aiCars[i].lateralOffset += push * 0.5;
                aiCars[j].lateralOffset -= push * 0.5;
                aiCars[i].speed *= 0.9;
                aiCars[j].speed *= 0.9;
                spawnSparks((a.x + b.x) / 2, a.y + 0.5, (a.z + b.z) / 2);
            }
        }
    }
}

// ── Action text popup system ──
let _actionTextTimeout = null;
function _showActionText(text, color) {
    let el = document.getElementById('action-text');
    if (!el) {
        el = document.createElement('div');
        el.id = 'action-text';
        el.style.cssText = 'position:fixed;top:35%;left:50%;transform:translate(-50%,-50%);z-index:55;font-size:28px;font-weight:900;letter-spacing:3px;text-transform:uppercase;pointer-events:none;opacity:0;transition:opacity 0.2s,transform 0.3s;text-shadow:0 0 20px currentColor,0 0 40px currentColor;';
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.color = color;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.2)';
    clearTimeout(_actionTextTimeout);
    setTimeout(() => { el.style.transform = 'translate(-50%,-50%) scale(1)'; }, 100);
    _actionTextTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1200);
}

function _showDriftBonus(score, combo) {
    const comboText = combo > 1 ? ` x${combo}` : '';
    _showActionText(`DRIFT +${score}${comboText}`, '#ff6b35');
}

function updateAI(dt) {
    const diff = DIFFICULTIES[GameState.difficulty];
    const track = TRACKS[GameState.selectedTrack];
    const up = new BABYLON.Vector3(0, 1, 0);

    // Rubber-banding — AI adjusts to player position for exciting races
    const playerPos = getPositions().findIndex(p => p.isPlayer) + 1;
    const totalRacers = aiCars.length + 1;

    aiCars.forEach((ai, idx) => {
        if (ai.finished) return;

        if (ai._phase === undefined) ai._phase = Math.random() * Math.PI * 2;

        // Rubber-banding: AI speeds up if player is far ahead, slows if behind
        let rubberBand = 1.0;
        if (playerPos <= 2) {
            // Player is leading — AI gets faster
            rubberBand = 1.0 + (1 - playerPos / totalRacers) * 0.15;
        } else if (playerPos >= totalRacers - 1) {
            // Player is last — AI slows slightly
            rubberBand = 0.92;
        }

        const baseSpeed = ai.targetSpeed * diff.aiSpeed * rubberBand;
        // More varied AI behavior — some aggressive bursts
        const burst = Math.sin(raceTime * 0.8 + ai._phase * 3) > 0.7 ? 5 : 0;
        const variance = Math.sin(raceTime * 0.4 + ai._phase) * 2 + burst;
        ai.speed += (baseSpeed + variance - ai.speed) * 1.0 * dt;
        ai.t += ai.speed * dt / 1300;

        if (ai.t >= 1) {
            ai.t -= 1;
            ai.lap++;
            if (ai.lap > GameState.laps) {
                ai.finished = true;
                ai.finishTime = raceTime;
            }
        }

        // More aggressive lateral movement — AI weaves and battles
        const targetLateral = Math.sin(raceTime * 0.5 + ai._phase) * 3.0
                            + Math.sin(raceTime * 1.2 + ai._phase * 2) * 1.5;
        ai.lateralOffset += (targetLateral - ai.lateralOffset) * 0.7 * dt;
        const hw2 = track.trackWidth / 2 - 2;
        ai.lateralOffset = Math.max(-hw2, Math.min(hw2, ai.lateralOffset));

        const pos = getTrackPointAt(trackPoints, ai.t);
        const dir = getTrackDirectionAt(trackPoints, ai.t);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        const targetPos = pos.add(right.scale(ai.lateralOffset));
        if (ai._prevX === undefined) {
            ai._prevX = targetPos.x;
            ai._prevY = targetPos.y;
            ai._prevZ = targetPos.z;
        }
        ai._prevX += (targetPos.x - ai._prevX) * Math.min(1, 6 * dt);
        ai._prevY += (targetPos.y - ai._prevY) * Math.min(1, 6 * dt);
        ai._prevZ += (targetPos.z - ai._prevZ) * Math.min(1, 6 * dt);

        ai.mesh.position.set(ai._prevX, ai._prevY + 0.15, ai._prevZ);

        const targetHeading = Math.atan2(dir.x, dir.z);
        if (ai._heading === undefined) ai._heading = targetHeading;
        let headingDiff = targetHeading - ai._heading;
        while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
        while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
        ai._heading += headingDiff * Math.min(1, 5 * dt);
        ai.mesh.rotation.y = ai._heading;

        // Slight body lean for AI cars in turns
        const aiLean = -headingDiff * 0.15 * Math.min(ai.speed / 30, 1);
        ai.mesh.rotation.z = aiLean;
        ai.mesh.rotation.x = 0;

        if (ai.mesh.wheels) {
            ai.mesh.wheels.forEach(w => { w.rotation.x += ai.speed * dt * 3; });
        }
    });
}
