// ============================================================
//  HUD & MINIMAP — Optimized (no DOM thrashing)
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
    _getHudEl('hud-lap').textContent = Math.min(playerLap, GameState.laps);
    _getHudEl('nitro-bar').style.width = nitro + '%';
    _getHudEl('drift-indicator').style.display = drifting && keys['p'] ? 'block' : 'none';

    // Lap time display
    const lapTime = raceTime - lapStartTime;
    const lapMins = Math.floor(lapTime / 60);
    const lapSecs = (lapTime % 60).toFixed(1);

    const positions = getPositions();
    const playerPos = positions.findIndex(p => p.isPlayer) + 1;
    const suffixes = ['st','nd','rd'];
    _getHudEl('hud-position').textContent = playerPos + (suffixes[playerPos - 1] || 'th');

    const mins = Math.floor(raceTime / 60);
    const secs = Math.floor(raceTime % 60);
    _getHudEl('hud-time').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

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
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 180, 180);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(90, 90, 85, 0, Math.PI * 2);
    ctx.fill();

    // Track outline
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Draw every 3rd point for performance
    for (let i = 0; i < trackPoints.length; i += 3) {
        const p = trackPoints[i];
        const mx = 90 + p.x * 0.3;
        const my = 90 + p.z * 0.3;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    // Start/finish flag
    const fp = trackPoints[0];
    const fmx = 90 + fp.x * 0.3;
    const fmy = 90 + fp.z * 0.3;
    const fs = 4;
    for (let cx = -1; cx <= 1; cx++) {
        for (let cy = -1; cy <= 1; cy++) {
            ctx.fillStyle = (cx + cy) % 2 === 0 ? '#fff' : '#000';
            ctx.fillRect(fmx + cx * fs - fs, fmy + cy * fs - fs, fs, fs);
        }
    }
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fmx - fs - fs, fmy - fs - fs, fs * 3, fs * 3);

    // AI dots
    aiCars.forEach(ai => {
        const p = getTrackPointAt(trackPoints, ai.t);
        ctx.fillStyle = ai.color;
        ctx.beginPath();
        ctx.arc(90 + p.x * 0.3, 90 + p.z * 0.3, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Player dot
    const pp = getTrackPointAt(trackPoints, playerT);
    ctx.fillStyle = GameState.selectedColor;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(90 + pp.x * 0.3, 90 + pp.z * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}
