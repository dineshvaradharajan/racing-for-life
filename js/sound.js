// ============================================================
//  SOUND ENGINE (Web Audio API) - no 3D engine dependency
// ============================================================
const SoundEngine = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    initialized: false,
    isF1: false,
    isBugatti: false,

    init() {
        if (this.initialized) return;
        this.isF1 = CARS[GameState.selectedCar].style === 'f1';
        this.isBugatti = CARS[GameState.selectedCar].style === 'bugatti';
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            if (this.isBugatti) {
                this.engineOsc = this.ctx.createOscillator();
                this.engineOsc.type = 'sawtooth';
                this.engineOsc.frequency.value = 45;
                const engineFilter = this.ctx.createBiquadFilter();
                engineFilter.type = 'lowpass';
                engineFilter.frequency.value = 250;
                engineFilter.Q.value = 6;
                this.engineFilter = engineFilter;
                this.engineGain = this.ctx.createGain();
                this.engineGain.gain.value = 0;
                this.engineOsc2 = this.ctx.createOscillator();
                this.engineOsc2.type = 'square';
                this.engineOsc2.frequency.value = 90;
                this.engineGain2 = this.ctx.createGain();
                this.engineGain2.gain.value = 0;
                this.engineOsc3 = this.ctx.createOscillator();
                this.engineOsc3.type = 'sine';
                this.engineOsc3.frequency.value = 600;
                this.engineGain3 = this.ctx.createGain();
                this.engineGain3.gain.value = 0;
                this.engineOsc.connect(engineFilter);
                engineFilter.connect(this.engineGain);
                this.engineGain.connect(this.ctx.destination);
                this.engineOsc2.connect(this.engineGain2);
                this.engineGain2.connect(this.ctx.destination);
                this.engineOsc3.connect(this.engineGain3);
                this.engineGain3.connect(this.ctx.destination);
                this.engineOsc.start();
                this.engineOsc2.start();
                this.engineOsc3.start();
            } else if (this.isF1) {
                this.engineOsc = this.ctx.createOscillator();
                this.engineOsc.type = 'sawtooth';
                this.engineOsc.frequency.value = 200;
                const engineFilter = this.ctx.createBiquadFilter();
                engineFilter.type = 'bandpass';
                engineFilter.frequency.value = 800;
                engineFilter.Q.value = 2;
                this.engineFilter = engineFilter;
                this.engineGain = this.ctx.createGain();
                this.engineGain.gain.value = 0;
                this.engineOsc2 = this.ctx.createOscillator();
                this.engineOsc2.type = 'sine';
                this.engineOsc2.frequency.value = 400;
                this.engineGain2 = this.ctx.createGain();
                this.engineGain2.gain.value = 0;
                this.engineOsc3 = this.ctx.createOscillator();
                this.engineOsc3.type = 'sine';
                this.engineOsc3.frequency.value = 1200;
                this.engineGain3 = this.ctx.createGain();
                this.engineGain3.gain.value = 0;
                this.engineOsc.connect(engineFilter);
                engineFilter.connect(this.engineGain);
                this.engineGain.connect(this.ctx.destination);
                this.engineOsc2.connect(this.engineGain2);
                this.engineGain2.connect(this.ctx.destination);
                this.engineOsc3.connect(this.engineGain3);
                this.engineGain3.connect(this.ctx.destination);
                this.engineOsc.start();
                this.engineOsc2.start();
                this.engineOsc3.start();
            } else {
                this.engineOsc = this.ctx.createOscillator();
                this.engineOsc.type = 'sawtooth';
                this.engineOsc.frequency.value = 60;
                const engineFilter = this.ctx.createBiquadFilter();
                engineFilter.type = 'lowpass';
                engineFilter.frequency.value = 300;
                engineFilter.Q.value = 5;
                this.engineFilter = engineFilter;
                this.engineGain = this.ctx.createGain();
                this.engineGain.gain.value = 0;
                this.engineOsc2 = this.ctx.createOscillator();
                this.engineOsc2.type = 'square';
                this.engineOsc2.frequency.value = 120;
                this.engineGain2 = this.ctx.createGain();
                this.engineGain2.gain.value = 0;
                this.engineOsc.connect(engineFilter);
                engineFilter.connect(this.engineGain);
                this.engineGain.connect(this.ctx.destination);
                this.engineOsc2.connect(this.engineGain2);
                this.engineGain2.connect(this.ctx.destination);
                this.engineOsc.start();
                this.engineOsc2.start();
            }
            this.initialized = true;
        } catch(e) { console.log('Audio not available'); }
    },

    updateEngine(speed, maxSpeed) {
        if (!this.initialized) return;
        const ratio = Math.abs(speed) / maxSpeed;
        const t = this.ctx.currentTime + 0.05;

        if (this.isBugatti) {
            const freq = 45 + ratio * 455;
            this.engineOsc.frequency.linearRampToValueAtTime(freq, t);
            this.engineOsc2.frequency.linearRampToValueAtTime(freq * 2, t);
            this.engineOsc3.frequency.linearRampToValueAtTime(600 + ratio * 2000, t);
            this.engineFilter.frequency.linearRampToValueAtTime(180 + ratio * 800, t);
            const vol = 0.05 + ratio * 0.12;
            this.engineGain.gain.linearRampToValueAtTime(vol, t);
            this.engineGain2.gain.linearRampToValueAtTime(vol * 0.4, t);
            this.engineGain3.gain.linearRampToValueAtTime(vol * 0.08 + ratio * 0.12, t);
        } else if (this.isF1) {
            const freq = 200 + ratio * 700;
            this.engineOsc.frequency.linearRampToValueAtTime(freq, t);
            this.engineOsc2.frequency.linearRampToValueAtTime(freq * 1.5, t);
            this.engineOsc3.frequency.linearRampToValueAtTime(freq * 3, t);
            this.engineFilter.frequency.linearRampToValueAtTime(400 + ratio * 1500, t);
            const vol = 0.04 + ratio * 0.1;
            this.engineGain.gain.linearRampToValueAtTime(vol, t);
            this.engineGain2.gain.linearRampToValueAtTime(vol * 0.5, t);
            this.engineGain3.gain.linearRampToValueAtTime(vol * 0.15, t);
        } else {
            const freq = 60 + ratio * 290;
            this.engineOsc.frequency.linearRampToValueAtTime(freq, t);
            this.engineOsc2.frequency.linearRampToValueAtTime(freq * 2, t);
            this.engineFilter.frequency.linearRampToValueAtTime(200 + ratio * 600, t);
            const vol = 0.03 + ratio * 0.08;
            this.engineGain.gain.linearRampToValueAtTime(vol, t);
            this.engineGain2.gain.linearRampToValueAtTime(vol * 0.3, t);
        }
    },

    playDrift() {
        if (!this.initialized) return;
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 2;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        noise.start(); noise.stop(this.ctx.currentTime + 0.15);
    },

    playCollision() {
        if (!this.initialized) return;
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.15;
        src.connect(gain); gain.connect(this.ctx.destination);
        src.start();
    },

    stop() {
        if (!this.initialized) return;
        try {
            // Fade out then stop oscillators
            const t = this.ctx.currentTime + 0.15;
            this.engineGain.gain.linearRampToValueAtTime(0, t);
            this.engineGain2.gain.linearRampToValueAtTime(0, t);
            if (this.engineGain3) this.engineGain3.gain.linearRampToValueAtTime(0, t);

            // Stop oscillators after fade
            setTimeout(() => {
                try {
                    if (this.engineOsc) this.engineOsc.stop();
                    if (this.engineOsc2) this.engineOsc2.stop();
                    if (this.engineOsc3) this.engineOsc3.stop();
                    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
                } catch(e) {}
            }, 200);
        } catch(e) {}
        this.initialized = false;
    }
};
