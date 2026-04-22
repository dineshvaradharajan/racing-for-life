// ============================================================
//  LOGIN SYSTEM & SCREEN MANAGEMENT
// ============================================================
let currentUser = null;
let isSignupMode = false;

function getUsers() {
    try { return JSON.parse(localStorage.getItem('mk4racer_users')) || {}; } catch(e) { return {}; }
}

function saveUsers(users) {
    localStorage.setItem('mk4racer_users', JSON.stringify(users));
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

function handleLogin() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!username || username.length < 2) { errorEl.textContent = 'Username must be at least 2 characters'; return; }
    if (!password || password.length < 3) { errorEl.textContent = 'Password must be at least 3 characters'; return; }
    if (!/^[a-z0-9_]+$/.test(username)) { errorEl.textContent = 'Username: letters, numbers, underscore only'; return; }

    const users = getUsers();
    const passHash = simpleHash(password);

    if (isSignupMode) {
        const confirm = document.getElementById('login-confirm').value;
        if (password !== confirm) { errorEl.textContent = 'Passwords do not match!'; return; }
        if (users[username]) { errorEl.textContent = 'Username already taken!'; return; }
        users[username] = { passHash, xp: 0, wins: 0, created: Date.now() };
        saveUsers(users);
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
    showScreen('main-menu');
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

// Auto-login last user
(function autoLogin() {
    const lastUser = localStorage.getItem('mk4racer_lastuser');
    if (lastUser) {
        const users = getUsers();
        if (users[lastUser]) {
            loginAs(lastUser, users[lastUser]);
            return;
        }
    }
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
    if (id === 'main-menu') updateMainMenu();
    if (id === 'car-select') buildCarSelect();
    if (id === 'track-select') buildTrackSelect();
    if (id === 'race-config') buildRaceConfig();

    // Spin up / tear down the 3D preview alongside the car-select screen
    if (id === 'car-select') {
        if (typeof initCarPreview === 'function') initCarPreview();
    } else {
        if (typeof disposeCarPreview === 'function') disposeCarPreview();
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
    const grid = document.getElementById('car-grid');
    grid.innerHTML = '';
    CARS.forEach((car, i) => {
        const locked = GameState.xp < car.unlock;
        const div = document.createElement('div');
        div.className = `card ${i === GameState.selectedCar ? 'selected' : ''} ${locked ? 'locked' : ''}`;
        const art = locked
            ? '<div class="lock-icon" style="margin:14px 0">&#128274;</div>'
            : carSvg(car.style, GameState.selectedColor, i);
        div.innerHTML = `
            ${art}
            <div class="card-title">${car.name}</div>
            <div class="card-desc">${locked ? `Unlock at ${car.unlock} XP` : car.desc}</div>
            <div class="card-stats">
                <div class="stat-label"><span>Speed</span><span>${car.speed}%</span></div>
                <div class="stat-bar"><div class="stat-fill" style="width:${car.speed}%"></div></div>
                <div class="stat-label"><span>Accel</span><span>${car.accel}%</span></div>
                <div class="stat-bar"><div class="stat-fill" style="width:${car.accel}%"></div></div>
                <div class="stat-label"><span>Handling</span><span>${car.handling}%</span></div>
                <div class="stat-bar"><div class="stat-fill" style="width:${car.handling}%"></div></div>
            </div>`;
        if (!locked) div.onclick = () => { GameState.selectedCar = i; buildCarSelect(); };
        grid.appendChild(div);
    });

    // Update the 3D rotating preview + its name label
    const selected = CARS[GameState.selectedCar];
    const previewName = document.getElementById('car-preview-name');
    if (previewName && selected) previewName.textContent = selected.name;
    if (typeof updateCarPreview === 'function') updateCarPreview();

    const cp = document.getElementById('color-picker');
    cp.innerHTML = '';
    COLORS.forEach(c => {
        const s = document.createElement('div');
        s.className = `color-swatch ${c === GameState.selectedColor ? 'selected' : ''}`;
        s.style.background = c;
        s.onclick = () => { GameState.selectedColor = c; buildCarSelect(); };
        cp.appendChild(s);
    });
}

function buildTrackSelect() {
    const grid = document.getElementById('track-grid');
    grid.innerHTML = '';
    const icons = ['&#127796;', '&#127964;', '&#127754;', '&#127810;', '&#127747;', '&#127796;', '&#127755;', '&#127956;', '&#127747;', '&#9968;'];
    TRACKS.forEach((t, i) => {
        const locked = GameState.xp < t.unlock;
        const div = document.createElement('div');
        div.className = `card ${i === GameState.selectedTrack ? 'selected' : ''} ${locked ? 'locked' : ''}`;
        div.innerHTML = `
            ${locked ? '<div class="lock-icon">&#128274;</div>' : `<div class="card-icon">${icons[i] || '&#127937;'}</div>`}
            <div class="card-title">${t.name}</div>
            <div class="card-desc">${locked ? `Unlock at ${t.unlock} XP` : t.desc}</div>
            <div style="margin-top:8px;"><span class="level-badge level-${t.difficulty.toLowerCase()}">${t.difficulty}</span></div>`;
        if (!locked) div.onclick = () => { GameState.selectedTrack = i; buildTrackSelect(); };
        grid.appendChild(div);
    });
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
