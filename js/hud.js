// ============================================================
//  HUD & MINIMAP — Arcade racing style
// ============================================================
let _lastPanelUpdate = 0;
let _cachedPositions = null;
const _hudEls = {};

function _getHudEl(id) {
    if (!_hudEls[id]) _hudEls[id] = document.getElementById(id);
    return _hudEls[id];
}

function getPositions() {
    const all = [
        { name: 'You', t: playerT, lap: playerLap, isPlayer: true, finished: raceFinished, finishTime: raceTime }
    ];
    aiCars.forEach(ai => {
        all.push({ name: ai.name, t: ai.t, lap: ai.lap, isPlayer: false, finished: ai.finished, finishTime: ai.finishTime, color: ai.color });
    });
    all.sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.lap !== b.lap) return b.lap - a.lap;
        return b.t - a.t;
    });
    return all;
}

function updateHUD() {
    const displaySpeed = Math.round(Math.sqrt(carVelX * carVelX + carVelZ * carVelZ) * 3.6);
    _getHudEl('hud-speed').textContent = displaySpeed;

    // Distance % — based on player progress along the track + completed laps
    const totalLaps = Math.max(1, GameState.laps || 1);
    const progress = Math.min(1, ((playerLap - 1) + (typeof playerT !== 'undefined' ? playerT : 0)) / totalLaps);
    const distEl = _getHudEl('hud-dist');
    if (distEl) distEl.textContent = Math.round(progress * 100);
    const oppEl = _getHudEl('hud-total-opps');
    if (oppEl) oppEl.textContent = (1 + (GameState.opponents || 0));

    // Big nitro bar — yellow fill, cyan PERFECT zone fixed at 38–51%
    const bigFill = document.getElementById('big-nitro-fill');
    const bigPct = document.getElementById('nitro-pct');
    const bigBox = document.getElementById('big-nitro');
    if (bigBox) bigBox.style.display = GameState.racing ? 'block' : 'none';
    if (bigFill) {
        bigFill.style.width = nitro + '%';
        if (bigPct) bigPct.textContent = Math.round(nitro) + '%';
    }

    // Drift indicator — show during any drift
    const driftEl = _getHudEl('drift-indicator');
    if (drifting && Math.abs(playerSpeed) > 15) {
        driftEl.style.display = 'block';
        const comboText = driftCombo > 1 ? ` x${driftCombo}` : '';
        driftEl.textContent = `DRIFT${comboText}`;
        // Pulse effect
        const pulse = 0.8 + Math.sin(performance.now() * 0.01) * 0.2;
        driftEl.style.opacity = String(pulse);
    } else {
        driftEl.style.display = 'none';
    }

    // Speed color changes at high speed
    const speedEl = _getHudEl('hud-speed');
    const car = CARS[GameState.selectedCar];
    const maxSpd = (car.speed / 100) * 85;
    const speedRatio = Math.abs(playerSpeed) / maxSpd;
    if (nitroActive && nitro > 0) {
        speedEl.style.color = '#00ddff';
        speedEl.style.textShadow = '0 0 25px rgba(0,221,255,.6),0 0 50px rgba(0,221,255,.3)';
    } else if (speedRatio > 0.85) {
        speedEl.style.color = '#ff3333';
        speedEl.style.textShadow = '0 0 20px rgba(255,51,51,.5)';
    } else {
        speedEl.style.color = '#ff6b35';
        speedEl.style.textShadow = '0 0 20px rgba(255,107,53,.4)';
    }

    const positions = getPositions();
    const playerPos = positions.findIndex(p => p.isPlayer) + 1;
    const posEl = _getHudEl('hud-position');
    if (posEl) posEl.textContent = playerPos;

    // Only rebuild positions panel every 200ms
    const now = performance.now();
    if (now - _lastPanelUpdate > 200) {
        _lastPanelUpdate = now;
        const panel = _getHudEl('positions-panel');
        panel.innerHTML = '';
        positions.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `pos-entry ${p.isPlayer ? 'player' : ''}`;
            div.innerHTML = `<div class="pos-number">${i + 1}</div>
                <span style="color:${p.isPlayer ? '#ff6b35' : p.color || '#fff'}">${p.name}</span>
                <span style="color:#666; font-size:11px;">L${Math.min(p.lap, GameState.laps)}</span>`;
            panel.appendChild(div);
        });
    }
}

function updateMinimap() {
    const canvas = _getHudEl('minimap');
    if (!canvas) return;

    const size = canvas.clientWidth || 180;
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    const half = size / 2;
    const scale = size / 180;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // Dark background with glow border
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(half, half, half - 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,107,53,0.3)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Track outline — glowing
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    const trackScale = 0.3 * scale;
    for (let i = 0; i < trackPoints.length; i += 3) {
        const p = trackPoints[i];
        const mx = half + p.x * trackScale;
        const my = half + p.z * trackScale;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    // Track glow overlay
    ctx.strokeStyle = 'rgba(255,107,53,0.15)';
    ctx.lineWidth = 8 * scale;
    ctx.stroke();

    // Start/finish flag
    const fp = trackPoints[0];
    const fmx = half + fp.x * trackScale;
    const fmy = half + fp.z * trackScale;
    const fs = 4 * scale;
    for (let cx = -1; cx <= 1; cx++) {
        for (let cy = -1; cy <= 1; cy++) {
            ctx.fillStyle = (cx + cy) % 2 === 0 ? '#fff' : '#000';
            ctx.fillRect(fmx + cx * fs - fs, fmy + cy * fs - fs, fs, fs);
        }
    }

    // AI dots with glow
    aiCars.forEach(ai => {
        const p = getTrackPointAt(trackPoints, ai.t);
        const px = half + p.x * trackScale;
        const py = half + p.z * trackScale;
        // Glow
        ctx.fillStyle = ai.color + '44';
        ctx.beginPath();
        ctx.arc(px, py, 5 * scale, 0, Math.PI * 2);
        ctx.fill();
        // Dot
        ctx.fillStyle = ai.color;
        ctx.beginPath();
        ctx.arc(px, py, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
    });

    // Player dot with pulsing glow
    const pp = getTrackPointAt(trackPoints, playerT);
    const ppx = half + pp.x * trackScale;
    const ppy = half + pp.z * trackScale;
    const pulse = 6 + Math.sin(performance.now() * 0.005) * 2;
    ctx.fillStyle = 'rgba(255,107,53,0.25)';
    ctx.beginPath();
    ctx.arc(ppx, ppy, pulse * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GameState.selectedColor;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(ppx, ppy, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}
