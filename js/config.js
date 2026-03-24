// ============================================================
//  GAME CONFIGURATION & STATE
// ============================================================
const GameState = {
    xp: 0,
    level: 0,
    wins: 0,
    selectedCar: 0,
    selectedColor: '#ff3333',
    selectedTrack: 0,
    laps: 3,
    opponents: 5,
    difficulty: 0,
    paused: false,
    racing: false,
    cameraMode: 0,
};

const LEVELS = [
    { name: 'Beginner', xpNeeded: 0, color: '#2ecc71' },
    { name: 'Intermediate', xpNeeded: 100, color: '#f39c12' },
    { name: 'Advanced', xpNeeded: 300, color: '#e74c3c' },
    { name: 'Expert', xpNeeded: 600, color: '#9b59b6' },
];

const CARS = [
    { name: 'Diavolo GT', desc: 'Lambo-style beast!', speed: 50, accel: 70, handling: 80, unlock: 0,
      style: 'lambo', scale: 1.0, bodyH: 0, spoiler: 'lip' },
    { name: 'Rosso F40', desc: 'Ferrari-inspired racer', speed: 70, accel: 65, handling: 65, unlock: 0,
      style: 'ferrari', scale: 1.0, bodyH: 0, spoiler: 'lip' },
    { name: 'Street Runner', desc: 'Easy to drive starter', speed: 40, accel: 60, handling: 90, unlock: 0,
      style: 'hatchback', scale: 0.9, bodyH: 0.15, spoiler: 'none' },
    { name: 'Venom X', desc: 'Raw power muscle car!', speed: 75, accel: 85, handling: 55, unlock: 50,
      style: 'muscle', scale: 1.05, bodyH: 0.05, spoiler: 'big' },
    { name: 'Apex R1', desc: 'Open-wheel speed demon!', speed: 90, accel: 80, handling: 50, unlock: 100,
      style: 'f1', scale: 1.0, bodyH: 0, spoiler: 'none' },
    { name: 'Phantom RS', desc: 'Koenigsegg hypercar!', speed: 85, accel: 75, handling: 70, unlock: 150,
      style: 'koenigsegg', scale: 1.0, bodyH: 0, spoiler: 'wing' },
    { name: 'Inferno GT', desc: 'Wide body track car!', speed: 80, accel: 90, handling: 60, unlock: 200,
      style: 'gt', scale: 1.1, bodyH: -0.05, spoiler: 'big' },
    { name: 'Stallion 488', desc: 'Italian perfection', speed: 82, accel: 78, handling: 72, unlock: 250,
      style: 'ferrari', scale: 1.05, bodyH: 0.05, spoiler: 'wing' },
    { name: 'Thunder F1', desc: 'Championship racer!', speed: 95, accel: 88, handling: 45, unlock: 350,
      style: 'f1', scale: 1.1, bodyH: 0, spoiler: 'none' },
    { name: 'Ghost One', desc: 'Ultimate hypercar!', speed: 100, accel: 95, handling: 65, unlock: 500,
      style: 'koenigsegg', scale: 1.1, bodyH: -0.05, spoiler: 'wing' },
    { name: 'Supra MK4', desc: 'Legendary JDM icon!', speed: 100, accel: 100, handling: 100, unlock: 600,
      style: 'supra4', scale: 1.05, bodyH: 0.05, spoiler: 'big' },
    { name: 'Supra MK5', desc: 'Modern JDM beast!', speed: 100, accel: 100, handling: 100, unlock: 700,
      style: 'supra5', scale: 1.05, bodyH: 0, spoiler: 'wing' },
    { name: 'Bugatti Veyron', desc: 'W16 quad-turbo legend!', speed: 100, accel: 100, handling: 100, unlock: 800,
      style: 'bugatti', scale: 1.1, bodyH: 0, spoiler: 'lip' },
];

const COLORS = ['#ff3333','#3366ff','#33cc33','#ffcc00','#ff66cc','#00cccc','#ff8800','#aa33ff'];

const TRACKS = [
    { name: 'Sunny Valley', desc: 'Rolling green hills', difficulty: 'Easy', unlock: 0,
      skyColor: 0x87ceeb, groundColor: 0x6b9b5a, fogColor: 0x87ceeb, fogDensity: 0.003,
      trackWidth: 16, segments: 40, maxCurve: 0.6, hills: 0.3 },
    { name: 'Desert Storm', desc: 'Hot sandy dunes', difficulty: 'Easy', unlock: 0,
      skyColor: 0xf4d03f, groundColor: 0xd4b870, fogColor: 0xf4d03f, fogDensity: 0.004,
      trackWidth: 14, segments: 45, maxCurve: 0.8, hills: 0.5 },
    { name: 'Coastal Drive', desc: 'Ocean-side highway', difficulty: 'Easy', unlock: 0,
      skyColor: 0x66bbee, groundColor: 0x55aa44, fogColor: 0x88ccee, fogDensity: 0.002,
      trackWidth: 16, segments: 38, maxCurve: 0.5, hills: 0.2 },
    { name: 'Autumn Forest', desc: 'Golden leaf trails', difficulty: 'Medium', unlock: 50,
      skyColor: 0x99bbdd, groundColor: 0x6b7a3a, fogColor: 0xaabbcc, fogDensity: 0.004,
      trackWidth: 14, segments: 42, maxCurve: 0.7, hills: 0.4 },
    { name: 'Night City', desc: 'Neon-lit streets', difficulty: 'Medium', unlock: 100,
      skyColor: 0x0a0a2e, groundColor: 0x1a1a3e, fogColor: 0x0a0a2e, fogDensity: 0.005,
      trackWidth: 13, segments: 50, maxCurve: 1.0, hills: 0.2 },
    { name: 'Tropical Island', desc: 'Palm trees & beaches', difficulty: 'Medium', unlock: 150,
      skyColor: 0x55ccff, groundColor: 0x33aa55, fogColor: 0x77ddff, fogDensity: 0.003,
      trackWidth: 14, segments: 44, maxCurve: 0.8, hills: 0.3 },
    { name: 'Volcano Ring', desc: 'Lava fields & fire!', difficulty: 'Hard', unlock: 200,
      skyColor: 0x331111, groundColor: 0x2a1a0a, fogColor: 0x441111, fogDensity: 0.006,
      trackWidth: 12, segments: 50, maxCurve: 1.1, hills: 0.6 },
    { name: 'Snow Peak', desc: 'Icy mountain pass', difficulty: 'Hard', unlock: 300,
      skyColor: 0xc8d8e8, groundColor: 0xe8e8f0, fogColor: 0xc8d8e8, fogDensity: 0.004,
      trackWidth: 12, segments: 55, maxCurve: 1.2, hills: 0.7 },
    { name: 'Midnight Highway', desc: 'Dark highway racing', difficulty: 'Hard', unlock: 400,
      skyColor: 0x050515, groundColor: 0x111122, fogColor: 0x050515, fogDensity: 0.005,
      trackWidth: 13, segments: 52, maxCurve: 1.0, hills: 0.3 },
    { name: 'Thunder Mountain', desc: 'Extreme cliff roads!', difficulty: 'Extreme', unlock: 500,
      skyColor: 0x445566, groundColor: 0x556655, fogColor: 0x445566, fogDensity: 0.005,
      trackWidth: 11, segments: 60, maxCurve: 1.5, hills: 0.9 },
];

const DIFFICULTIES = [
    { name: 'Easy', badge: 'level-easy', aiSpeed: 0.6, unlock: 0 },
    { name: 'Medium', badge: 'level-medium', aiSpeed: 0.8, unlock: 0 },
    { name: 'Hard', badge: 'level-hard', aiSpeed: 1.0, unlock: 100 },
    { name: 'Extreme', badge: 'level-extreme', aiSpeed: 1.2, unlock: 300 },
];

// Utility: convert hex int to Babylon Color3
function hexToColor3(hex) {
    return new BABYLON.Color3(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255);
}

function hexToColor4(hex, a) {
    return new BABYLON.Color4(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255, a !== undefined ? a : 1);
}
