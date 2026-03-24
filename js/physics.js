// ============================================================
//  PLAYER PHYSICS & AI — Smooth, realistic handling
// ============================================================
function findClosestTrackT(x, z) {
    let bestT = 0, bestDist = Infinity;
    // Coarse search
    for (let i = 0; i < trackPoints.length; i++) {
        const p = trackPoints[i];
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < bestDist) { bestDist = d; bestT = i / trackPoints.length; }
    }
    // Fine refinement
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

    const maxSpd = (car.speed / 100) * 70;
    const accelForce = (car.accel / 100) * 50;
    const turnRate = (car.handling / 100) * 0.6;
    const maxSteer = 0.2;
    const wheelBase = 6.0;
    const grip = 0.97;
    const drag = 0.985;

    // ── Throttle / Brake ──
    if (keys['w'] || keys['arrowup']) {
        // Progressive acceleration (more realistic — less at high speed)
        const speedFactor = 1 - (Math.abs(playerSpeed) / maxSpd) * 0.5;
        playerSpeed = Math.min(playerSpeed + accelForce * speedFactor * dt, maxSpd);
    } else if (keys['s'] || keys['arrowdown']) {
        playerSpeed = Math.max(playerSpeed - accelForce * 1.5 * dt, -maxSpd * 0.3);
    } else {
        // Engine braking (smooth deceleration)
        playerSpeed *= Math.pow(0.7, dt);
        if (Math.abs(playerSpeed) < 0.5) playerSpeed = 0;
    }

    // ── Drift / Handbrake ──
    const wasDrifting = drifting;
    drifting = false;
    if (keys[' ']) {
        playerSpeed *= Math.pow(0.15, dt);
        drifting = true;
        if (!wasDrifting && Math.abs(playerSpeed) > 10) SoundEngine.playDrift();
    }
    if (keys['p']) {
        drifting = true;
        if (!wasDrifting && Math.abs(playerSpeed) > 10) SoundEngine.playDrift();
    }

    // ── Nitro ──
    if (keys['shift'] && nitro > 0) {
        playerSpeed = Math.min(playerSpeed + accelForce * 3 * dt, maxSpd * 1.4);
        nitro = Math.max(0, nitro - 30 * dt);
    } else {
        nitro = Math.min(100, nitro + 5 * dt);
    }

    // ── Steering — smooth input with speed-sensitive reduction ──
    let targetSteer = 0;
    if (keys['a'] || keys['arrowleft']) targetSteer = maxSteer;
    if (keys['d'] || keys['arrowright']) targetSteer = -maxSteer;

    // Smoother steering interpolation
    const steerSpeed = targetSteer !== 0 ? turnRate * 5 : 8;
    carSteerAngle += (targetSteer - carSteerAngle) * Math.min(1, steerSpeed * dt);

    // ── Bicycle model steering ──
    const absSpeed = Math.abs(playerSpeed);
    if (absSpeed > 0.5) {
        const turnRadius = wheelBase / Math.tan(Math.abs(carSteerAngle) + 0.001);
        const angularVel = (playerSpeed / turnRadius) * Math.sign(carSteerAngle);
        // Speed-dependent steering reduction (harder to turn at high speed)
        const speedDamping = 1.0 / (1.0 + absSpeed * 0.006);
        carHeading += angularVel * dt * speedDamping;
    }

    // ── Velocity with grip physics ──
    const forwardX = Math.sin(carHeading);
    const forwardZ = Math.cos(carHeading);
    const targetVelX = forwardX * playerSpeed;
    const targetVelZ = forwardZ * playerSpeed;

    // Drift reduces grip
    const g = drifting ? 0.82 : grip;
    carVelX = carVelX * (1 - g) + targetVelX * g;
    carVelZ = carVelZ * (1 - g) + targetVelZ * g;
    carVelX *= drag;
    carVelZ *= drag;

    carX += carVelX * dt;
    carZ += carVelZ * dt;

    // ── Track following ──
    const closestT = findClosestTrackT(carX, carZ);
    const trackPt = getTrackPointAt(trackPoints, closestT);

    // Smooth Y interpolation (no sudden jumps)
    const targetY = trackPt.y + 0.1;
    carY += (targetY - carY) * Math.min(1, 10 * dt);

    // ── Keep car on track ──
    const trackDir = getTrackDirectionAt(trackPoints, closestT);
    const trackRight = BABYLON.Vector3.Cross(up, trackDir).normalize();
    const toCarX = carX - trackPt.x;
    const toCarZ = carZ - trackPt.z;
    const lateralDist = toCarX * trackRight.x + toCarZ * trackRight.z;
    const hw = track.trackWidth / 2;

    // Spawn dust when on track edge
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
        playerSpeed *= 0.9;
        SoundEngine.playCollision();
        spawnSparks(carX, carY, carZ);
        const headingDotRight = Math.sin(carHeading) * trackRight.x + Math.cos(carHeading) * trackRight.z;
        carHeading -= headingDotRight * 0.1;
    }
    if (Math.abs(lateralDist) > hw * 0.85) {
        playerSpeed *= Math.pow(0.75, dt);
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

    // ── Suspension — smooth body motion ──
    const isF1Car = car.style === 'f1';
    if (!isF1Car) {
        const stiffness = 50, dampingK = 7;
        // Road bumps based on position
        const bumpForce = Math.sin(raceTime * 12 + carX * 0.4) * absSpeed * 0.0005
                        + Math.sin(raceTime * 19 + carZ * 0.25) * absSpeed * 0.0004;
        let pitchInput = 0;
        if (keys['w'] || keys['arrowup']) pitchInput = -0.015 * Math.min(absSpeed / 30, 1);
        else if (keys['s'] || keys['arrowdown']) pitchInput = 0.03 * Math.min(absSpeed / 10, 1);

        // Spring-damper for bounce
        suspVel += (-stiffness * suspBounce - dampingK * suspVel + bumpForce * 60) * dt;
        suspBounce += suspVel * dt;
        suspBounce = Math.max(-0.12, Math.min(0.12, suspBounce));

        // Smooth pitch (nose dive under braking, squat under accel)
        const targetPitch = pitchInput + bumpForce * 0.1;
        suspPitch += (targetPitch - suspPitch) * Math.min(1, 6 * dt);

        // Smooth roll (body lean in corners) — subtle
        const targetRoll = -carSteerAngle * 0.06 * Math.min(absSpeed / 25, 1);
        suspRoll += (targetRoll - suspRoll) * Math.min(1, 5 * dt);
    } else {
        // F1 — very stiff, minimal body roll
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
}

function checkCollisions() {
    const pPos = playerCar.position;
    const collisionDist = 4.0;

    aiCars.forEach(ai => {
        const dx = pPos.x - ai.mesh.position.x;
        const dz = pPos.z - ai.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
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
            playerSpeed *= 0.75;
            ai.speed *= 0.85;
            SoundEngine.playCollision();
            spawnSparks((pPos.x + ai.mesh.position.x) / 2, pPos.y + 0.5, (pPos.z + ai.mesh.position.z) / 2);
        }
    });

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

function updateAI(dt) {
    const diff = DIFFICULTIES[GameState.difficulty];
    const track = TRACKS[GameState.selectedTrack];
    const up = new BABYLON.Vector3(0, 1, 0);

    aiCars.forEach(ai => {
        if (ai.finished) return;

        // Use a per-car phase so each AI moves differently (not a function of t)
        if (ai._phase === undefined) ai._phase = Math.random() * Math.PI * 2;

        // Smooth speed — very gentle variance, NO high-frequency oscillation
        const baseSpeed = ai.targetSpeed * diff.aiSpeed;
        const variance = Math.sin(raceTime * 0.4 + ai._phase) * 1.5;
        ai.speed += (baseSpeed + variance - ai.speed) * 0.8 * dt;
        ai.t += ai.speed * dt / 1300;

        if (ai.t >= 1) {
            ai.t -= 1;
            ai.lap++;
            if (ai.lap > GameState.laps) {
                ai.finished = true;
                ai.finishTime = raceTime;
            }
        }

        // Gentle lateral drift — slow sine, per-car phase, NOT multiplied by t
        const targetLateral = Math.sin(raceTime * 0.3 + ai._phase) * 2.5;
        ai.lateralOffset += (targetLateral - ai.lateralOffset) * 0.5 * dt;
        const hw2 = track.trackWidth / 2 - 2;
        ai.lateralOffset = Math.max(-hw2, Math.min(hw2, ai.lateralOffset));

        const pos = getTrackPointAt(trackPoints, ai.t);
        const dir = getTrackDirectionAt(trackPoints, ai.t);
        const right = BABYLON.Vector3.Cross(up, dir).normalize();

        // Smooth position interpolation (lower rate = smoother)
        const targetPos = pos.add(right.scale(ai.lateralOffset));
        if (ai._prevX === undefined) {
            ai._prevX = targetPos.x;
            ai._prevY = targetPos.y;
            ai._prevZ = targetPos.z;
        }
        ai._prevX += (targetPos.x - ai._prevX) * Math.min(1, 5 * dt);
        ai._prevY += (targetPos.y - ai._prevY) * Math.min(1, 5 * dt);
        ai._prevZ += (targetPos.z - ai._prevZ) * Math.min(1, 5 * dt);

        ai.mesh.position.set(ai._prevX, ai._prevY + 0.15, ai._prevZ);

        // Smooth heading — slower interpolation for no jitter
        const targetHeading = Math.atan2(dir.x, dir.z);
        if (ai._heading === undefined) ai._heading = targetHeading;
        let headingDiff = targetHeading - ai._heading;
        while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
        while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
        ai._heading += headingDiff * Math.min(1, 4 * dt);
        ai.mesh.rotation.y = ai._heading;

        // No body lean — keep cars upright
        ai.mesh.rotation.z = 0;
        ai.mesh.rotation.x = 0;

        if (ai.mesh.wheels) {
            ai.mesh.wheels.forEach(w => { w.rotation.x += ai.speed * dt * 3; });
        }
    });
}
