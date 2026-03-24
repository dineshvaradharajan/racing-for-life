// ============================================================
//  INPUT HANDLERS
// ============================================================
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape' && GameState.racing) {
        if (GameState.paused) resumeRace();
        else pauseRace();
    }
    if (e.key.toLowerCase() === 'c' && GameState.racing) {
        GameState.cameraMode = (GameState.cameraMode + 1) % 3;
    }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener('resize', () => {
    if (engine) {
        engine.resize();
    }
});

// Init menu on load
updateMainMenu();
