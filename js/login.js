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

function buildCarSelect() {
    const grid = document.getElementById('car-grid');
    grid.innerHTML = '';
    CARS.forEach((car, i) => {
        const locked = GameState.xp < car.unlock;
        const div = document.createElement('div');
        div.className = `card ${i === GameState.selectedCar ? 'selected' : ''} ${locked ? 'locked' : ''}`;
        div.innerHTML = `
            ${locked ? '<div class="lock-icon">&#128274;</div>' : '<div class="card-icon">&#127950;</div>'}
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
