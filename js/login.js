// ============================================================
//  LOGIN SYSTEM & SCREEN MANAGEMENT
// ============================================================
let currentUser = null;
let isSignupMode = false;

// Users live on the server (users.json). They're shared across every origin
// that hits the same backend — localhost AND tunneled URLs (loca.lt etc.)
// because the tunnel just forwards to the same Python server. Falls back to
// localStorage if the API is unreachable so offline edits still work.
async function getUsersAsync() {
    try {
        const r = await fetch('/api/users', { cache: 'no-store' });
        if (!r.ok) throw new Error('api');
        return await r.json();
    } catch(e) {
        try { return JSON.parse(localStorage.getItem('mk4racer_users')) || {}; } catch(_) { return {}; }
    }
}

async function saveUsersAsync(users) {
    try {
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(users),
        });
    } catch(e) { /* fall through to localStorage backup */ }
    // Keep a localStorage cache for offline / fallback
    try { localStorage.setItem('mk4racer_users', JSON.stringify(users)); } catch(_) {}
}

// Sync wrappers for the rest of the code that still expects sync
function getUsers() {
    try { return JSON.parse(localStorage.getItem('mk4racer_users')) || {}; } catch(e) { return {}; }
}
function saveUsers(users) {
    try { localStorage.setItem('mk4racer_users', JSON.stringify(users)); } catch(_) {}
    // Fire-and-forget save to backend
    saveUsersAsync(users);
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

function switchTab(tab) {
    isSignupMode = tab === 'signup';
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    const confirmRow = document.getElementById('confirm-password-row');
    const btn = document.getElementById('login-btn');

    if (isSignupMode) {
        tabSignup.style.background = '#ff6b35'; tabSignup.style.color = '#fff';
        tabSignin.style.background = 'rgba(255,255,255,0.08)'; tabSignin.style.color = '#888';
        confirmRow.style.display = 'block';
        btn.textContent = 'Create Account';
        document.getElementById('login-subtitle').textContent = 'Create your racer account';
    } else {
        tabSignin.style.background = '#ff6b35'; tabSignin.style.color = '#fff';
        tabSignup.style.background = 'rgba(255,255,255,0.08)'; tabSignup.style.color = '#888';
        confirmRow.style.display = 'none';
        btn.textContent = 'Sign In';
        document.getElementById('login-subtitle').textContent = 'Welcome back, racer!';
    }
    document.getElementById('login-error').textContent = '';
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!username || username.length < 2) { errorEl.textContent = 'Username must be at least 2 characters'; return; }
    if (!password || password.length < 3) { errorEl.textContent = 'Password must be at least 3 characters'; return; }
    if (!/^[a-z0-9_]+$/.test(username)) { errorEl.textContent = 'Username: letters, numbers, underscore only'; return; }

    // Always fetch the latest from the backend so accounts created on a
    // different origin are visible here too.
    const users = await getUsersAsync();
    const passHash = simpleHash(password);

    if (isSignupMode) {
        const confirm = document.getElementById('login-confirm').value;
        if (password !== confirm) { errorEl.textContent = 'Passwords do not match!'; return; }
        if (users[username]) { errorEl.textContent = 'Username already taken!'; return; }
        users[username] = { passHash, xp: 0, wins: 0, created: Date.now() };
        await saveUsersAsync(users);
        loginAs(username, users[username]);
    } else {
        if (!users[username]) { errorEl.textContent = 'User not found. Sign up first!'; return; }
        if (users[username].passHash !== passHash) { errorEl.textContent = 'Wrong password!'; return; }
        loginAs(username, users[username]);
    }
}

function loginAs(username, data) {
    currentUser = username;
    GameState.xp = data.xp || 0;
    GameState.wins = data.wins || 0;
    localStorage.setItem('mk4racer_lastuser', username);
    updateUserBadge();

    // Restore last selection (car/track/etc.) and screen
    try {
        const saved = JSON.parse(localStorage.getItem('mk4racer_state'));
        if (saved) Object.assign(GameState, saved);
    } catch(e) {}
    let last = null;
    try { last = localStorage.getItem('mk4racer_lastScreen'); } catch(e) {}
    const valid = last && document.getElementById(last)
        && last !== 'login-screen' && last !== 'pause-screen' && last !== 'splash-screen';
    const next = valid ? last : 'main-menu';

    showScreen(next);
}

function updateUserBadge() {
    if (!currentUser) return;
    document.getElementById('user-avatar').textContent = currentUser[0].toUpperCase();
    document.getElementById('user-display-name').textContent = currentUser;
}

function logout() {
    currentUser = null;
    localStorage.removeItem('mk4racer_lastuser');
    GameState.xp = 0;
    GameState.wins = 0;
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
    isSignupMode = false;
    switchTab('signin');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('login-screen').classList.add('active');
}

// Auto-login last user — checks the backend so a session started on a
// different origin still works here.
(async function autoLogin() {
    const lastUser = localStorage.getItem('mk4racer_lastuser');
    if (!lastUser) return;
    const users = await getUsersAsync();
    if (users[lastUser]) loginAs(lastUser, users[lastUser]);
})();

// Allow Enter key to submit login
document.addEventListener('DOMContentLoaded', () => {
    ['login-username', 'login-password', 'login-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    });
});

function saveProgress() {
    if (!currentUser) return;
    const users = getUsers();
    if (users[currentUser]) {
        users[currentUser].xp = GameState.xp;
        users[currentUser].wins = GameState.wins;
        saveUsers(users);
    }
}

function getLevel() {
    let lvl = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (GameState.xp >= LEVELS[i].xpNeeded) { lvl = i; break; }
    }
    return lvl;
}

// ============================================================
//  SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Remember last menu screen + selection state so a refresh lands the
    // user back where they were. Skip pause / login (those are transient or
    // determined by auth) and race itself (which doesn't go through here).
    if (id !== 'login-screen' && id !== 'pause-screen') {
        try { localStorage.setItem('mk4racer_lastScreen', id); } catch(e) {}
        try {
            localStorage.setItem('mk4racer_state', JSON.stringify({
                selectedCar: GameState.selectedCar,
                selectedTrack: GameState.selectedTrack,
                selectedColor: GameState.selectedColor,
                difficulty: GameState.difficulty,
                laps: GameState.laps,
                opponents: GameState.opponents,
            }));
        } catch(e) {}
    }
    if (id === 'main-menu') { updateMainMenu(); initMenuHeroCar(); } else { disposeMenuHeroCar(); }
    if (id === 'car-select') buildCarSelect();
    if (id === 'track-select') buildTrackSelect();
    if (id === 'race-config') buildRaceConfig();

    // Spin up / tear down the 3D previews alongside their screens
    if (id === 'car-select') {
        if (typeof initCarPreview === 'function') initCarPreview();
    } else {
        if (typeof disposeCarPreview === 'function') disposeCarPreview();
    }
    if (id === 'track-select') {
        if (typeof initTrackPreview === 'function') initTrackPreview();
    } else {
        if (typeof disposeTrackPreview === 'function') disposeTrackPreview();
    }

    // YouTube background music plays continuously across every screen —
    // menus, racing, results. Just keep it going; the user controls volume
    // via the in-game mute button.
    if (typeof MenuMusic !== 'undefined') {
        try { MenuMusic.play(); } catch(e) {}
    }
}

function updateMainMenu() {
    const lvl = getLevel();
    document.getElementById('player-level').textContent = LEVELS[lvl].name;
    const nextLvl = lvl < LEVELS.length - 1 ? LEVELS[lvl + 1].xpNeeded : LEVELS[lvl].xpNeeded;
    const prevXp = LEVELS[lvl].xpNeeded;
    const pct = lvl >= LEVELS.length - 1 ? 100 : ((GameState.xp - prevXp) / (nextLvl - prevXp) * 100);
    document.getElementById('level-progress').style.width = pct + '%';
    document.getElementById('xp-text').textContent = lvl >= LEVELS.length - 1
        ? `${GameState.xp} XP (MAX LEVEL!)` : `${GameState.xp} / ${nextLvl} XP`;
}

// ── Side-profile car silhouette SVGs (take the selected paint color) ──
function _shadeHex(color, amt) {
    const clamp = v => Math.max(0, Math.min(255, v));
    const r = clamp(parseInt(color.slice(1,3),16) + amt);
    const g = clamp(parseInt(color.slice(3,5),16) + amt);
    const b = clamp(parseInt(color.slice(5,7),16) + amt);
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
}

function _carWheels(x1, x2, r) {
    return `
        <circle cx="${x1}" cy="62" r="${r}" fill="#0e0e14"/>
        <circle cx="${x1}" cy="62" r="${r*0.55}" fill="#8a8a95" stroke="#2a2a33" stroke-width="0.8"/>
        <circle cx="${x1}" cy="62" r="${r*0.2}" fill="#1a1a22"/>
        <circle cx="${x2}" cy="62" r="${r}" fill="#0e0e14"/>
        <circle cx="${x2}" cy="62" r="${r*0.55}" fill="#8a8a95" stroke="#2a2a33" stroke-width="0.8"/>
        <circle cx="${x2}" cy="62" r="${r*0.2}" fill="#1a1a22"/>`;
}

function _carBodyByStyle(style, gid) {
    switch (style) {
        case 'f1': return `
            ${_carWheels(45, 138, 12)}
            <rect x="4" y="26" width="6" height="22" fill="#0a0a14"/>
            <rect x="1" y="20" width="22" height="5" rx="1" fill="url(#${gid})" stroke="#0a0a14" stroke-width="0.8"/>
            <rect x="1" y="24.2" width="22" height="1" fill="#e63030"/>
            <path d="M22,56 L35,48 L70,46 L110,46 L140,48 L160,54 L170,60 L22,60 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M82,46 Q92,32 102,32 L108,46 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <path d="M92,32 C92,26 102,26 102,32" fill="none" stroke="#dcdcdc" stroke-width="1.2"/>
            <path d="M140,50 L172,58 L140,58 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="0.8"/>
            <rect x="155" y="57" width="22" height="4" rx="1" fill="url(#${gid})" stroke="#0a0a14" stroke-width="0.6"/>`;

        case 'muscle': return `
            ${_carWheels(45, 140, 11)}
            <rect x="8" y="38" width="12" height="4" rx="1" fill="#0a0a14"/>
            <path d="M10,58 L18,46 L40,42 L78,30 L152,30 L164,40 L172,58 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M80,30 L102,16 L144,16 L154,30 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <line x1="120" y1="16" x2="120" y2="30" stroke="#0a0a14" stroke-width="0.5" opacity="0.7"/>
            <rect x="159" y="42" width="8" height="5" rx="1" fill="#fff0a8" opacity="0.9"/>
            <path d="M52,42 L72,42 L70,36 L54,36 Z" fill="#0a0a0a" opacity="0.75"/>`;

        case 'hatchback': return `
            ${_carWheels(42, 138, 10)}
            <path d="M12,58 L18,32 L40,22 L138,22 L160,32 L172,58 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M26,32 L46,22 L138,22 L150,32 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <line x1="90" y1="22" x2="90" y2="32" stroke="#0a0a14" stroke-width="0.5" opacity="0.7"/>
            <rect x="162" y="42" width="7" height="6" rx="1" fill="#fff0a8" opacity="0.9"/>`;

        case 'lambo': return `
            ${_carWheels(45, 138, 10)}
            <path d="M10,58 L18,46 L42,38 L78,28 L132,30 L160,38 L172,50 L172,58 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M52,38 L70,22 L122,22 L136,34 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <line x1="96" y1="22" x2="96" y2="34" stroke="#0a0a14" stroke-width="0.5" opacity="0.7"/>
            <rect x="163" y="41" width="8" height="5" rx="1" fill="#fff0a8" opacity="0.9"/>
            <path d="M78,38 L94,38 L92,42 L80,42 Z" fill="#0a0a0a" opacity="0.8"/>`;

        case 'supra4':
        case 'supra5': return `
            ${_carWheels(45, 138, 10)}
            <path d="M12,58 C14,44 30,38 55,34 C78,28 120,26 148,30 C165,34 170,44 172,58 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M58,34 Q76,18 118,18 L135,32 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <line x1="95" y1="20" x2="95" y2="32" stroke="#0a0a14" stroke-width="0.5" opacity="0.7"/>
            <rect x="162" y="42" width="8" height="5" rx="1" fill="#fff0a8" opacity="0.9"/>
            <rect x="14" y="28" width="22" height="3" rx="1" fill="#0a0a14"/>
            <rect x="22" y="31" width="5" height="6" fill="#0a0a14"/>`;

        case 'bugatti': return `
            ${_carWheels(45, 138, 10)}
            <path d="M12,58 Q20,40 55,34 Q90,26 128,28 Q156,30 172,56 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M55,34 Q75,18 116,18 Q132,22 133,32 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <line x1="90" y1="20" x2="90" y2="32" stroke="#0a0a14" stroke-width="0.5" opacity="0.7"/>
            <ellipse cx="62" cy="36" rx="2.4" ry="1.6" fill="#0a0a14"/>
            <path d="M92,30 L92,58" stroke="#0a0a14" stroke-width="0.6" opacity="0.5"/>
            <rect x="163" y="42" width="7" height="5" rx="1" fill="#fff0a8" opacity="0.9"/>`;

        // ferrari, koenigsegg, gt, and anything else → sleek supercar
        default: return `
            ${_carWheels(45, 138, 10)}
            <path d="M12,58 C14,46 28,40 50,36 C72,30 104,28 138,32 C160,36 170,44 172,58 Z" fill="url(#${gid})" stroke="#0a0a14" stroke-width="1"/>
            <path d="M56,36 Q72,20 108,20 L128,34 Z" fill="#12121e" stroke="#0a0a14" stroke-width="0.8"/>
            <line x1="90" y1="22" x2="90" y2="34" stroke="#0a0a14" stroke-width="0.5" opacity="0.7"/>
            <rect x="163" y="43" width="8" height="5" rx="1" fill="#fff0a8" opacity="0.9"/>
            <circle cx="15" cy="50" r="1.8" fill="#ff4a4a" opacity="0.85"/>`;
    }
}

function carSvg(style, color, idx) {
    const gid = 'cg_' + idx + '_' + Math.random().toString(36).slice(2,7);
    const light = _shadeHex(color, 55);
    const mid   = color;
    const dark  = _shadeHex(color, -45);
    const defs = `<defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${light}"/>
            <stop offset="0.55" stop-color="${mid}"/>
            <stop offset="1" stop-color="${dark}"/>
        </linearGradient>
    </defs>`;
    const shadow = `<ellipse cx="90" cy="71" rx="78" ry="2.2" fill="#000" opacity="0.55"/>`;
    return `<svg class="card-car" viewBox="0 0 180 75" xmlns="http://www.w3.org/2000/svg">${defs}${shadow}${_carBodyByStyle(style, gid)}</svg>`;
}

function buildCarSelect() {
    const strip = document.getElementById('car-strip') || document.getElementById('car-grid');
    if (!strip) return;
    strip.innerHTML = '';
    CARS.forEach((car, i) => {
        const locked = GameState.xp < car.unlock;
        const div = document.createElement('div');
        div.className = `card ${i === GameState.selectedCar ? 'selected' : ''} ${locked ? 'locked' : ''}`;
        div.dataset.style = car.style;
        const thumb = window.__carThumbnails && window.__carThumbnails[car.style];
        const art = locked
            ? '<div class="lock-icon" style="margin:8px 0;font-size:24px">&#128274;</div>'
            : (thumb
                ? `<img class="card-car card-thumb" src="${thumb}" alt="${car.name}"/>`
                : carSvg(car.style, GameState.selectedColor, i));
        div.innerHTML = `
            ${art}
            <div class="card-title">${car.name}</div>`;
        if (!locked) div.onclick = () => { GameState.selectedCar = i; buildCarSelect(); };
        strip.appendChild(div);
    });

    // Auto-scroll selected card into view
    const selectedCard = strip.querySelector('.card.selected');
    if (selectedCard && selectedCard.scrollIntoView) {
        selectedCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // Update the 3D rotating preview + its name label and stats panel
    const selected = CARS[GameState.selectedCar];
    const previewName = document.getElementById('car-preview-name');
    if (previewName && selected) previewName.textContent = selected.name;
    const previewDesc = document.getElementById('car-preview-desc');
    if (previewDesc && selected) previewDesc.textContent = selected.desc;
    // Convert game stats (0-100) to display values
    const psSpeed = document.getElementById('ps-speed');
    const psAccel = document.getElementById('ps-accel');
    const psHandling = document.getElementById('ps-handling');
    const psSpeedBar = document.getElementById('ps-speed-bar');
    const psAccelBar = document.getElementById('ps-accel-bar');
    const psHandlingBar = document.getElementById('ps-handling-bar');
    if (selected && psSpeed) {
        // Speed scaled to roughly 200-400 km/h, power to 200-1500hp
        psSpeed.textContent = Math.round(180 + selected.speed * 2.4);
        psAccel.textContent = Math.round(200 + selected.accel * 12);
        psHandling.textContent = selected.handling;
        psSpeedBar.style.width = selected.speed + '%';
        psAccelBar.style.width = selected.accel + '%';
        psHandlingBar.style.width = selected.handling + '%';

        // ── Hero overlay: ghost name, tagline, class badge ──
        const ghostName = document.getElementById('cs-ghost-name');
        const ghostTag  = document.getElementById('cs-ghost-tag');
        const badge     = document.getElementById('cs-class-badge');
        const badgeLbl  = document.getElementById('cs-class-label');
        if (ghostName) ghostName.textContent = (selected.name || '').toUpperCase();
        if (ghostTag) {
            const score = (selected.speed + selected.accel + selected.handling) / 3;
            const tagline = score >= 85 ? 'Hypercar · Apex Hunter'
                          : score >= 70 ? 'Supercar · Track Tuned'
                          : score >= 55 ? 'Sport · Street Spec'
                          : 'Starter · Learn The Line';
            ghostTag.textContent = tagline;
        }
        if (badge && badgeLbl) {
            const top = Math.max(selected.speed, selected.accel, selected.handling);
            const cls = top >= 88 ? 'S' : top >= 75 ? 'A' : 'B';
            badge.dataset.class = cls;
            badgeLbl.textContent = cls + ' CLASS';
        }
    }
    if (typeof updateCarPreview === 'function') updateCarPreview();

    const cp = document.getElementById('color-picker');
    if (cp) cp.innerHTML = '';
}

// Called from preview.js after a thumbnail is captured for a car style.
// Updates just that one card in the strip without rebuilding the whole list
// (which would interrupt the user's scroll/selection state).
function refreshCarStripCard(style) {
    const strip = document.getElementById('car-strip');
    if (!strip || !window.__carThumbnails || !window.__carThumbnails[style]) return;
    const card = strip.querySelector(`[data-style="${style}"]`);
    if (!card) return;
    const existingArt = card.querySelector('.card-car, .lock-icon');
    if (existingArt) {
        const img = document.createElement('img');
        img.className = 'card-car card-thumb';
        img.src = window.__carThumbnails[style];
        img.alt = '';
        existingArt.replaceWith(img);
    }
}

function buildTrackSelect() {
    const strip = document.getElementById('track-strip') || document.getElementById('track-grid');
    if (!strip) return;
    strip.innerHTML = '';
    const icons = ['&#127796;', '&#127964;', '&#127754;', '&#127810;', '&#127747;', '&#127796;', '&#127755;', '&#127956;', '&#127747;', '&#9968;'];
    TRACKS.forEach((t, i) => {
        const locked = GameState.xp < t.unlock;
        const div = document.createElement('div');
        div.className = `card ${i === GameState.selectedTrack ? 'selected' : ''} ${locked ? 'locked' : ''}`;
        const mini = locked ? '' : trackMiniSvg(t);
        const lockArt = '<div class="lock-icon" style="margin:8px 0;font-size:24px">&#128274;</div>';
        div.innerHTML = `
            ${locked ? lockArt : mini}
            <div class="card-title">${t.displayName || t.name}</div>`;
        if (!locked) div.onclick = () => { GameState.selectedTrack = i; buildTrackSelect(); };
        strip.appendChild(div);
    });

    const sel = strip.querySelector('.card.selected');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

    // Update preview + stats panel
    const t = TRACKS[GameState.selectedTrack];
    if (!t) return;
    const nm = document.getElementById('track-preview-name');
    const desc = document.getElementById('track-preview-desc');
    if (nm) nm.textContent = t.displayName || t.name;
    if (desc) desc.textContent = t.desc;

    const stats = computeTrackStats(t);
    setStat('ts-turns', stats.turns, Math.min(100, stats.turns * 6));
    setStat('ts-length', stats.length, Math.min(100, (stats.length - 800) / 16));
    setStat('ts-width', t.trackWidth, Math.min(100, t.trackWidth * 5));
    const diffEl = document.getElementById('ts-diff');
    if (diffEl) diffEl.innerHTML = `<span class="level-badge level-${t.difficulty.toLowerCase()}">${t.difficulty}</span>`;

    if (typeof initTrackPreview === 'function') initTrackPreview();
    if (typeof updateTrackPreview === 'function') updateTrackPreview();
}

function setStat(idVal, value, barPct) {
    const el = document.getElementById(idVal);
    if (el) el.textContent = value;
    const bar = document.getElementById(idVal + '-bar');
    if (bar) bar.style.width = Math.max(8, Math.min(100, barPct)) + '%';
}

// Compute the track's loop path (same math as generateTrack in track.js but
// without Catmull-Rom subdivision — we just need the rough shape for preview
// and a turns count).
// Per-track shape, identical to track.js _trackShape. Keep in sync.
function _trackShape(trackDef) {
    if (trackDef.trackModel) {
        return { h1: 3, h2: 5, ph1: 0, ph2: 0, a1: 60, a2: 30,
                 h3: 1, ph3a: 0, a3: 0, xScale: 1, zScale: 1, rot: 0, ph3: 0 };
    }
    let h = 0;
    const n = trackDef.name || '';
    for (let i = 0; i < n.length; i++) h = ((h * 31) + n.charCodeAt(i)) | 0;
    h = h >>> 0;
    return {
        h1: 2 + (h & 7), h2: 3 + ((h >> 3) & 7), h3: 1 + ((h >> 26) & 1),
        ph1: ((h >> 6) & 15) * 0.4, ph2: ((h >> 10) & 15) * 0.4, ph3a: ((h >> 24) & 7) * 0.7,
        a1: 30 + ((h >> 14) & 31), a2: 15 + ((h >> 19) & 23), a3: 20 + ((h >> 27) & 15),
        xScale: 0.7 + ((h >> 16) & 7) * 0.10, zScale: 0.7 + ((h >> 28) & 7) * 0.10,
        rot: ((h >> 12) & 7) * (Math.PI / 4),
        ph3: ((h >> 22) & 15) * 0.5,
    };
}

function _trackPath(trackDef) {
    const n = trackDef.segments;
    const radius = 200;
    const f1 = (typeof F1_TRACK_SHAPES !== 'undefined')
        ? F1_TRACK_SHAPES[trackDef.name] : null;
    if (f1 && f1.length >= 6) {
        const fr = (typeof F1_TRACK_RADIUS !== 'undefined') ? F1_TRACK_RADIUS : radius;
        return f1.map(p => ({ x: p[0] * fr, z: p[1] * fr }));
    }
    const sh = _trackShape(trackDef);
    const cr = Math.cos(sh.rot), sr = Math.sin(sh.rot);
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const wiggle = Math.sin(a * sh.h1 + sh.ph1) * trackDef.maxCurve * sh.a1
                     + Math.cos(a * sh.h2 + sh.ph2) * trackDef.maxCurve * sh.a2
                     + Math.sin(a * sh.h3 + sh.ph3a) * trackDef.maxCurve * sh.a3;
        const r = radius + wiggle;
        const ux = Math.cos(a) * r * sh.xScale;
        const uz = Math.sin(a) * r * sh.zScale;
        pts.push({ x: ux * cr - uz * sr, z: ux * sr + uz * cr });
    }
    return pts;
}

function computeTrackStats(trackDef) {
    const pts = _trackPath(trackDef);
    const n = pts.length;
    // Turns = direction changes whose signed curvature crosses a threshold and
    // alternates sign (a real "corner" is where the track bends one way).
    let turns = 0;
    let lastSign = 0;
    let inTurn = false;
    let length = 0;
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        // Segment length
        const dx = p1.x - p0.x, dz = p1.z - p0.z;
        length += Math.sqrt(dx * dx + dz * dz);
        // Signed curvature
        const ax = p1.x - p0.x, az = p1.z - p0.z;
        const bx = p2.x - p1.x, bz = p2.z - p1.z;
        const cross = ax * bz - az * bx;
        const mag = Math.sqrt(ax * ax + az * az) * Math.sqrt(bx * bx + bz * bz) || 1;
        const k = cross / mag;
        const sign = k > 0.06 ? 1 : k < -0.06 ? -1 : 0;
        if (sign !== 0 && sign !== lastSign) {
            turns++;
            lastSign = sign;
            inTurn = true;
        } else if (sign === 0 && inTurn) {
            inTurn = false;
        }
    }
    return { turns, length: Math.round(length) };
}

// Tiny inline SVG mini-map of a track (for the strip cards).
function trackMiniSvg(trackDef) {
    const pts = _trackPath(trackDef);
    const skyHex = '#' + (trackDef.skyColor).toString(16).padStart(6, '0');
    const groundHex = '#' + (trackDef.groundColor).toString(16).padStart(6, '0');
    let lo = { x: Infinity, z: Infinity }, hi = { x: -Infinity, z: -Infinity };
    pts.forEach(p => {
        if (p.x < lo.x) lo.x = p.x; if (p.z < lo.z) lo.z = p.z;
        if (p.x > hi.x) hi.x = p.x; if (p.z > hi.z) hi.z = p.z;
    });
    const w = 180, h = 100, pad = 8;
    const sx = (w - pad * 2) / (hi.x - lo.x);
    const sz = (h - pad * 2) / (hi.z - lo.z);
    const s = Math.min(sx, sz);
    const cx = (lo.x + hi.x) / 2, cz = (lo.z + hi.z) / 2;
    const path = pts.map((p, i) => {
        const px = (p.x - cx) * s + w / 2;
        const py = (p.z - cz) * s + h / 2;
        return (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1);
    }).join('') + 'Z';
    return `<svg class="card-car" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${skyHex}" opacity="0.18" rx="6"/>
        <path d="${path}" stroke="${groundHex}" stroke-width="9" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
        <path d="${path}" stroke="#1a1a22" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${path}" stroke="#ff6b35" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3 4" opacity="0.7"/>
    </svg>`;
}

// Bigger top-down preview drawn on the canvas in the bottom panel.
function drawTrackPreview(trackDef) {
    const canvas = document.getElementById('track-preview-canvas');
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height || rect.width * 0.55));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pts = _trackPath(trackDef);
    let lo = { x: Infinity, z: Infinity }, hi = { x: -Infinity, z: -Infinity };
    pts.forEach(p => {
        if (p.x < lo.x) lo.x = p.x; if (p.z < lo.z) lo.z = p.z;
        if (p.x > hi.x) hi.x = p.x; if (p.z > hi.z) hi.z = p.z;
    });
    const pad = 60;
    const sx = (w - pad * 2) / (hi.x - lo.x);
    const sz = (h - pad * 2) / (hi.z - lo.z);
    const s = Math.min(sx, sz);
    const cx = (lo.x + hi.x) / 2, cz = (lo.z + hi.z) / 2;
    const project = p => ({ x: (p.x - cx) * s + w / 2, y: (p.z - cz) * s + h / 2 });

    // Outer glow shoulder
    const shoulderColor = '#' + (trackDef.groundColor).toString(16).padStart(6, '0');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = shoulderColor;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 36;
    ctx.beginPath();
    pts.forEach((p, i) => {
        const q = project(p);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Asphalt
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#21242b';
    ctx.lineWidth = 22;
    ctx.beginPath();
    pts.forEach((p, i) => {
        const q = project(p);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Centre line dashes
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    pts.forEach((p, i) => {
        const q = project(p);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish marker
    if (pts.length) {
        const q = project(pts[0]);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff6b35';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('START', q.x, q.y - 12);
    }
}

function buildRaceConfig() {
    const dc = document.getElementById('difficulty-btns');
    dc.innerHTML = '';
    DIFFICULTIES.forEach((d, i) => {
        const locked = GameState.xp < d.unlock;
        const btn = document.createElement('button');
        btn.className = `menu-btn secondary ${locked ? 'locked' : ''}`;
        if (i === GameState.difficulty) btn.style.borderColor = '#ff6b35';
        btn.innerHTML = `<span class="level-badge ${d.badge}">${d.name}</span>`;
        if (!locked) btn.onclick = () => { GameState.difficulty = i; buildRaceConfig(); };
        dc.appendChild(btn);
    });
}

function setLaps(n) {
    GameState.laps = n;
    document.querySelectorAll('.lap-btn').forEach(b => {
        b.style.borderColor = parseInt(b.dataset.laps) === n ? '#ff6b35' : '';
    });
}

function setOpponents(n) {
    GameState.opponents = n;
    document.querySelectorAll('.opp-btn').forEach(b => {
        b.style.borderColor = parseInt(b.dataset.opp) === n ? '#ff6b35' : '';
    });
}

// ── Cinematic menu hero car: loads a real GLB into a small Babylon scene
// behind the main menu, replacing the SVG silhouette with an actual 3D car.
let _menuHeroEngine = null, _menuHeroScene = null, _menuHeroCam = null;
function initMenuHeroCar() {
    if (_menuHeroEngine) return;
    const canvas = document.getElementById('menu-hero-canvas');
    if (!canvas || typeof BABYLON === 'undefined') return;

    try {
        _menuHeroEngine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, alpha: true, antialias: true });
        const scene = _menuHeroScene = new BABYLON.Scene(_menuHeroEngine);
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent — show the cinematic backdrop
        scene.useRightHandedSystem = true;

        // Front-3/4 hero shot
        const cam = _menuHeroCam = new BABYLON.ArcRotateCamera('mhCam', -Math.PI / 2 + 0.15, Math.PI / 2 - 0.18, 7.4, new BABYLON.Vector3(0, 0.5, 0), scene);
        cam.fov = 0.55;
        cam.minZ = 0.05; cam.maxZ = 80;

        // Three-point lighting matching the warm dusk vibe
        const hemi = new BABYLON.HemisphericLight('mhHemi', new BABYLON.Vector3(0, 1, 0.2), scene);
        hemi.intensity = 0.65; hemi.diffuse = new BABYLON.Color3(1, 0.85, 0.7); hemi.groundColor = new BABYLON.Color3(0.15, 0.08, 0.12);
        const key = new BABYLON.DirectionalLight('mhKey', new BABYLON.Vector3(-0.4, -0.8, -0.5).normalize(), scene);
        key.intensity = 1.2; key.diffuse = new BABYLON.Color3(1, 0.9, 0.78); key.specular = new BABYLON.Color3(1, 0.85, 0.75);
        const rim = new BABYLON.DirectionalLight('mhRim', new BABYLON.Vector3(0.7, -0.1, 0.4).normalize(), scene);
        rim.intensity = 1.0; rim.diffuse = new BABYLON.Color3(1, 0.4, 0.4); rim.specular = new BABYLON.Color3(1, 0.4, 0.4);

        try {
            const envTex = BABYLON.CubeTexture.CreateFromPrefilteredData('https://assets.babylonjs.com/environments/environmentSpecular.env', scene);
            scene.environmentTexture = envTex;
            scene.environmentIntensity = 0.85;
        } catch(e) {}

        scene.imageProcessingConfiguration.toneMappingEnabled = true;
        scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        scene.imageProcessingConfiguration.exposure = 1.1;
        scene.imageProcessingConfiguration.contrast = 1.18;

        try { const glow = new BABYLON.GlowLayer('mhGlow', scene); glow.intensity = 0.6; } catch(e) {}

        // Load the Bugatti Chiron — top-tier hero car
        BABYLON.SceneLoader.ImportMesh('', 'models/', 'bugatti-chiron.glb', scene, (meshes) => {
            const root = new BABYLON.TransformNode('mhRoot', scene);
            meshes.forEach(m => { if (!m.parent || m.parent === scene) m.parent = root; });

            // Tint body panels Ferrari red
            const target = BABYLON.Color3.FromHexString('#cc1a10');
            meshes.forEach(m => {
                if (!m.material) return;
                const mat = m.material;
                const base = mat.albedoColor || mat.diffuseColor;
                if (!base) return;
                const b = (base.r + base.g + base.b) / 3;
                if (b > 0.35 && b < 0.95) {
                    if ('albedoColor' in mat) mat.albedoColor = target;
                    if ('diffuseColor' in mat) mat.diffuseColor = target;
                    if ('metallic' in mat) { mat.metallic = 0.6; mat.roughness = 0.32; }
                }
                m.alwaysSelectAsActiveMesh = true;
            });

            // Frame to fill canvas
            setTimeout(() => {
                let lo = null, hi = null;
                meshes.forEach(m => {
                    if (!m.getBoundingInfo || (m.getClassName && m.getClassName() === 'TransformNode')) return;
                    m.computeWorldMatrix(true);
                    const bb = m.getBoundingInfo().boundingBox;
                    if (!lo) { lo = bb.minimumWorld.clone(); hi = bb.maximumWorld.clone(); }
                    else { lo.minimizeInPlace(bb.minimumWorld); hi.maximizeInPlace(bb.maximumWorld); }
                });
                if (lo) {
                    const sz = hi.subtract(lo);
                    const longestH = Math.max(sz.x, sz.z);
                    if (longestH > 0.01) {
                        const factor = 4.5 / longestH;
                        root.scaling = new BABYLON.Vector3(factor, factor, factor);
                        const cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2, cz = (lo.z + hi.z) / 2;
                        root.position.set(-cx * factor, -lo.y * factor, -cz * factor);
                    }
                }
                // Hide the SVG fallback now that the model is on screen
                const svgFb = document.getElementById('menu-hero-svg');
                if (svgFb) svgFb.style.display = 'none';
            }, 80);
        });

        let t0 = performance.now();
        _menuHeroEngine.runRenderLoop(() => {
            if (!_menuHeroScene) return;
            const t = (performance.now() - t0) * 0.0001;
            cam.alpha = -Math.PI / 2 + 0.15 + Math.sin(t * 4) * 0.05;
            cam.beta  = Math.PI / 2 - 0.18 + Math.sin(t * 3.2) * 0.02;
            _menuHeroScene.render();
        });
        window.addEventListener('resize', () => { if (_menuHeroEngine) _menuHeroEngine.resize(); });
    } catch(e) { console.warn('[menuHero]', e); }
}

function disposeMenuHeroCar() {
    if (!_menuHeroEngine) return;
    try { _menuHeroEngine.stopRenderLoop(); } catch(e) {}
    try { _menuHeroScene && _menuHeroScene.dispose(); } catch(e) {}
    try { _menuHeroEngine.dispose(); } catch(e) {}
    _menuHeroEngine = null; _menuHeroScene = null; _menuHeroCam = null;
    const svgFb = document.getElementById('menu-hero-svg');
    if (svgFb) svgFb.style.display = '';
}
