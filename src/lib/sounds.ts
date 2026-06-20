/**
 * Sound engine for the Toast Slot machine.
 *
 * All sounds are synthesized at runtime with the Web Audio API, so the app
 * needs ZERO audio asset files and works fully offline.
 *
 * Sounds provided (the ones you'd expect in a slot / one-armed-bandit game):
 *  - clickSpin   : the chunky "lever pull" thunk when you hit spin
 *  - spinLoop    : continuous mechanical whirring + ticking while the reel runs
 *  - tick        : short blip as each name whizzes past the center line
 *  - reelStop    : a satisfying clunk when the reel locks in
 *  - winFanfare  : triumphant ascending arpeggio when the winner is revealed
 *  - coin        : coin "ding" sprinkled into the celebration
 *
 * Browsers block audio until a user gesture, so the AudioContext is created
 * lazily on the first call (the spin button click counts as that gesture).
 */

type Maybe<T> = T | null;

class SoundEngine {
  private ctx: Maybe<AudioContext> = null;
  private master: Maybe<GainNode> = null;
  private muted = false;
  private spinLoopNodes: Maybe<{
    stop: () => void;
  }> = null;

  /** True if the browser claims it can play Web Audio. */
  get isSupported(): boolean {
    return typeof window !== "undefined" && "AudioContext" in window;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.now(), 0.02);
    }
    if (m) this.stopSpinLoop();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Lazily create the AudioContext (must follow a user gesture). */
  private ensureCtx(): AudioContext | null {
    if (!this.isSupported) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---- Low-level helpers -------------------------------------------------

  /** A short percussive tone with a fast decay — used for clicks/ticks. */
  private blip(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      freq: number;
      type?: OscillatorType;
      start?: number;
      dur?: number;
      gain?: number;
      glideTo?: number;
    }
  ) {
    const t0 = opts.start ?? ctx.currentTime;
    const dur = opts.dur ?? 0.06;
    const peak = opts.gain ?? 0.3;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.glideTo),
        t0 + dur
      );
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered noise burst — used for the "shhh" mechanical texture. */
  private noiseBurst(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      start?: number;
      dur?: number;
      gain?: number;
      filterFreq?: number;
      q?: number;
    }
  ) {
    const t0 = opts.start ?? ctx.currentTime;
    const dur = opts.dur ?? 0.2;
    const peak = opts.gain ?? 0.15;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // simple white noise
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = opts.filterFreq ?? 1200;
    filter.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---- Public sound API --------------------------------------------------

  /** The chunky lever-pull / spin-button press thunk. */
  clickSpin() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    // low thump
    this.blip(ctx, this.master, {
      freq: 180,
      glideTo: 60,
      type: "sawtooth",
      start: t,
      dur: 0.18,
      gain: 0.4,
    });
    // mechanical clack
    this.noiseBurst(ctx, this.master, {
      start: t + 0.005,
      dur: 0.08,
      gain: 0.25,
      filterFreq: 2400,
      q: 1.2,
    });
  }

  /** A single tick as a name passes the center line. */
  tick() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    this.blip(ctx, this.master, {
      freq: 900,
      type: "square",
      dur: 0.03,
      gain: 0.12,
    });
  }

  /**
   * Start the continuous spinning loop: a low mechanical hum + periodic ticking.
   * Returns nothing; call stopSpinLoop() when the reel stops.
   */
  startSpinLoop(totalMs: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    this.stopSpinLoop();

    const dest = this.master;
    // 1. Low mechanical hum — sawtooth through lowpass, with subtle vibrato.
    const humOsc = ctx.createOscillator();
    humOsc.type = "sawtooth";
    humOsc.frequency.value = 110;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(humOsc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    lp.Q.value = 4;
    humOsc.connect(lp);
    lp.connect(humGain);
    humGain.connect(dest);
    humOsc.start();
    lfo.start();
    humGain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.05);

    // 2. Periodic ticking via interval (faster at first, slows near the end).
    // We'll schedule with a JS timer because the rate changes over time.
    let elapsed = 0;
    let interval = 70; // ms between ticks, starts fast
    const minInterval = 90;
    const startTime = performance.now();
    let tickTimer: ReturnType<typeof setTimeout>;

    const scheduleTick = () => {
      this.tick();
      const progress = Math.min(1, elapsed / totalMs);
      // ease-out: ticks slow down as we approach the end
      interval = 70 + Math.pow(progress, 2.4) * 260; // up to ~330ms by the end
      interval = Math.max(minInterval, interval);
      elapsed = performance.now() - startTime;
      if (elapsed < totalMs - 120) {
        tickTimer = setTimeout(scheduleTick, interval);
      }
    };
    tickTimer = setTimeout(scheduleTick, interval);

    this.spinLoopNodes = {
      stop: () => {
        clearTimeout(tickTimer);
        try {
          humGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
          humOsc.stop(ctx.currentTime + 0.2);
          lfo.stop(ctx.currentTime + 0.2);
        } catch {
          /* already stopped */
        }
      },
    };
  }

  stopSpinLoop() {
    if (this.spinLoopNodes) {
      this.spinLoopNodes.stop();
      this.spinLoopNodes = null;
    }
  }

  /** The satisfying clunk when the reel locks onto the winner. */
  reelStop() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    // heavy low thud
    this.blip(ctx, this.master, {
      freq: 140,
      glideTo: 45,
      type: "sine",
      start: t,
      dur: 0.22,
      gain: 0.5,
    });
    // mechanical clack
    this.noiseBurst(ctx, this.master, {
      start: t,
      dur: 0.07,
      gain: 0.3,
      filterFreq: 1800,
      q: 1.0,
    });
    // a higher "lock" ping
    this.blip(ctx, this.master, {
      freq: 660,
      type: "triangle",
      start: t + 0.02,
      dur: 0.12,
      gain: 0.18,
    });
  }

  /** Triumphant ascending arpeggio + sparkle for the winner reveal. */
  winFanfare() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const dest = this.master;
    const t0 = ctx.currentTime;
    // C major pentatonic ascending: C5 E5 G5 A5 C6 — bright & celebratory.
    const notes = [523.25, 659.25, 783.99, 880.0, 1046.5];
    notes.forEach((f, i) => {
      const start = t0 + i * 0.11;
      this.blip(ctx, dest, {
        freq: f,
        type: "triangle",
        start,
        dur: 0.32,
        gain: 0.28,
      });
      // add a sine octave-up sparkle on top
      this.blip(ctx, dest, {
        freq: f * 2,
        type: "sine",
        start: start + 0.02,
        dur: 0.22,
        gain: 0.1,
      });
    });
    // final big chord (C major) to land on
    const chordStart = t0 + notes.length * 0.11 + 0.02;
    [261.63, 329.63, 392.0, 523.25].forEach((f) => {
      this.blip(ctx, dest, {
        freq: f,
        type: "triangle",
        start: chordStart,
        dur: 0.9,
        gain: 0.2,
      });
    });
    // a couple of coin dings
    this.coin(chordStart + 0.05);
    this.coin(chordStart + 0.28);
    this.coin(chordStart + 0.5);
  }

  /** A bright coin "ding". */
  coin(start?: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const t = start ?? ctx.currentTime;
    // two-tone bell: high + higher harmonic
    this.blip(ctx, this.master, {
      freq: 1318.51, // E6
      type: "sine",
      start: t,
      dur: 0.35,
      gain: 0.22,
    });
    this.blip(ctx, this.master, {
      freq: 2637.02, // E7
      type: "sine",
      start: t + 0.01,
      dur: 0.3,
      gain: 0.1,
    });
  }

  /** A soft UI click for buttons. */
  uiClick() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    this.blip(ctx, this.master, {
      freq: 520,
      type: "square",
      dur: 0.04,
      gain: 0.14,
    });
  }

  /** Dispose everything (called on unmount). */
  dispose() {
    this.stopSpinLoop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}

// Singleton — one engine shared across the app.
let engine: SoundEngine | null = null;
export function getSoundEngine(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}
