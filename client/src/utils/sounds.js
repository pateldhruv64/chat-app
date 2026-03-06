// Notification Sounds using Web Audio API — no external files needed

let audioCtx = null;

const getAudioCtx = () => {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

// Sound enabled state
export const isSoundEnabled = () => {
    return localStorage.getItem('chatapp_sound_muted') !== 'true';
};

export const toggleSound = () => {
    const muted = localStorage.getItem('chatapp_sound_muted') === 'true';
    localStorage.setItem('chatapp_sound_muted', !muted ? 'true' : 'false');
    return muted; // returns new enabled state
};

// Whoosh — rising frequency sweep for sent messages
export const playSendSound = () => {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
        // Silently fail if audio not available
    }
};

// Pop — short pop sound for received messages
export const playReceiveSound = () => {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        // Silently fail
    }
};

// Gentle chime — two-tone for friend coming online
export const playOnlineChime = () => {
    if (!isSoundEnabled()) return;
    try {
        const ctx = getAudioCtx();

        const playTone = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0.08, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        playTone(523, ctx.currentTime, 0.15);       // C5
        playTone(659, ctx.currentTime + 0.12, 0.2);  // E5
    } catch (e) {
        // Silently fail
    }
};
