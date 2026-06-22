/**
 * Sound engine for the Toast Slot machine.
 *
 * Provides two modes:
 *  1. Built-in synthesized sounds — softer, ear-friendly casino-style SFX.
 *  2. Custom user sounds — loaded from the user's device via the UI and stored
 *     in IndexedDB. The user can replace any event sound individually.
 *
 * Supported custom formats: MP3, WAV, OGG, M4A, WEBM, FLAC.
 *
 * Events that can be customized:
 *  - clickSpin   : lever / spin button press
 *  - spinLoop    : background loop while the reel spins (should be a seamless loop)
 *  - tick        : short tick as a name passes the center line
 *  - reelStop    : clunk when the reel locks
 *  - winFanfare  : winner reveal fanfare
 *  - coin        : coin "ding" during celebration
 *  - uiClick     : generic UI button click
 *
 * Browsers block audio until a user gesture, so the AudioContext is created
 * lazily on the first call.
 */

type Maybe<T> = T | null;

export type SoundEvent =
  | "clickSpin"
  | "spinLoop"
  | "tick"
  | "reelStop"
  | "winFanfare"
  | "coin"
  | "uiClick";

export const SOUND_EVENT_LABELS: Record<SoundEvent, string> = {
  clickSpin: "Кнопка «Крутить»",
  spinLoop: "Фоновое кручение (loop)",
  tick: "Тик барабана",
  reelStop: "Остановка барабана",
  winFanfare: "Победная фанфара",
  coin: "Звон монет",
  uiClick: "Клик в интерфейсе",
};

interface CustomSound {
  event: SoundEvent;
  name: string;
  type: string;
  buffer: ArrayBuffer;
}

interface CustomSoundsMap {
  [event: string]: CustomSound;
}

const DB_NAME = "ToastSlotSoundsDB";
const DB_STORE = "customSounds";
const DB_VERSION = 1;

function openSoundsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "event" });
      }
    };
  });
}

async function loadCustomSoundsFromDB(): Promise<CustomSoundsMap> {
  try {
    const db = await openSoundsDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const map: CustomSoundsMap = {};
        (req.result as CustomSound[]).forEach((s) => {
          map[s.event] = s;
        });
        resolve(map);
      };
    });
  } catch {
    return {};
  }
}

async function saveCustomSoundToDB(sound: CustomSound): Promise<void> {
  const db = await openSoundsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.put(sound);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

async function removeCustomSoundFromDB(event: SoundEvent): Promise<void> {
  const db = await openSoundsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.delete(event);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

class SoundEngine {
  private ctx: Maybe<AudioContext> = null;
  private master: Maybe<GainNode> = null;
  private muted = false;
  private volume = 0.75;
  private spinLoopNodes: Maybe<{
    stop: () => void;
  }> = null;
  private customSounds: CustomSoundsMap = {};
  private decodedBuffers: Map<string, AudioBuffer> = new Map();

  constructor() {
    void this.reloadCustomSounds();
  }

  /** True if the browser claims it can play Web Audio. */
  get isSupported(): boolean {
    return typeof window !== "undefined" && "AudioContext" in window;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get masterVolume(): number {
    return this.volume;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.now(), 0.05);
    }
    if (m) this.stopSpinLoop();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.now(), 0.05);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async reloadCustomSounds(): Promise<CustomSoundsMap> {
    this.customSounds = await loadCustomSoundsFromDB();
    this.decodedBuffers.clear();
    return this.customSounds;
  }

  getCustomSounds(): CustomSoundsMap {
    return { ...this.customSounds };
  }

  async uploadCustomSound(event: SoundEvent, file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const sound: CustomSound = {
      event,
      name: file.name,
      type: file.type,
      buffer,
    };
    await saveCustomSoundToDB(sound);
    this.customSounds[event] = sound;
    this.decodedBuffers.delete(event);
  }

  async removeCustomSound(event: SoundEvent): Promise<void> {
    await removeCustomSoundFromDB(event);
    delete this.customSounds[event];
    this.decodedBuffers.delete(event);
  }

  /** Lazily create the AudioContext (must follow a user gesture). */
  private ensureCtx(): AudioContext | null {
    if (!this.isSupported) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        ((window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext as typeof AudioContext);
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
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

  private async getDecodedBuffer(event: SoundEvent): Promise<AudioBuffer | null> {
    const custom = this.customSounds[event];
    if (!custom) return null;
    if (this.decodedBuffers.has(event)) {
      return this.decodedBuffers.get(event) ?? null;
    }
    const ctx = this.ensureCtx();
    if (!ctx) return null;
    try {
      const decoded = await ctx.decodeAudioData(custom.buffer.slice(0));
      this.decodedBuffers.set(event, decoded);
      return decoded;
    } catch {
      return null;
    }
  }

  private playBuffer(buffer: AudioBuffer, loop = false, when?: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const g = ctx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(this.master);
    const t = when ?? ctx.currentTime;
    src.start(t);
    return { source: src, gain: g, stop: () => src.stop() };
  }

  // ---- Low-level helpers -------------------------------------------------

  /** A short percussive tone with a smooth ADSR envelope. */
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
      attack?: number;
      decay?: number;
    }
  ) {
    const t0 = opts.start ?? ctx.currentTime;
    const dur = opts.dur ?? 0.08;
    const peak = opts.gain ?? 0.2;
    const attack = opts.attack ?? 0.005;
    const decay = opts.decay ?? dur * 0.85;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.glideTo),
        t0 + dur
      );
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Filtered noise burst with a smooth envelope. */
  private noiseBurst(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      start?: number;
      dur?: number;
      gain?: number;
      filterFreq?: number;
      q?: number;
      type?: BiquadFilterType;
    }
  ) {
    const t0 = opts.start ?? ctx.currentTime;
    const dur = opts.dur ?? 0.15;
    const peak = opts.gain ?? 0.12;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? "bandpass";
    filter.frequency.value = opts.filterFreq ?? 800;
    filter.Q.value = opts.q ?? 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---- Public sound API --------------------------------------------------

  /** The chunky but soft lever-pull / spin-button press thunk. */
  clickSpin() {
    void this.playEvent("clickSpin", false);
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.customSounds.clickSpin) return;
    const t = ctx.currentTime;
    // soft low thump
    this.blip(ctx, this.master, {
      freq: 160,
      glideTo: 55,
      type: "triangle",
      start: t,
      dur: 0.18,
      gain: 0.22,
      attack: 0.01,
    });
    // gentle mechanical clack
    this.noiseBurst(ctx, this.master, {
      start: t + 0.01,
      dur: 0.06,
      gain: 0.1,
      filterFreq: 1600,
      q: 1.0,
      type: "lowpass",
    });
  }

  /** A single tick as a name passes the center line. */
  tick() {
    void this.playEvent("tick", false);
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.customSounds.tick) return;
    this.blip(ctx, this.master, {
      freq: 760,
      type: "sine",
      dur: 0.025,
      gain: 0.06,
      attack: 0.002,
    });
  }

  private async playEvent(event: SoundEvent, loop: boolean): Promise<(() => void) | undefined> {
    const buffer = await this.getDecodedBuffer(event);
    if (!buffer) return;
    const nodes = this.playBuffer(buffer, loop);
    if (!nodes) return;
    return () => {
      try {
        nodes.source.stop();
      } catch {
        /* already stopped */
      }
    };
  }

  /**
   * Start the continuous spinning loop.
   * Custom spinLoop sound (if uploaded) is played on loop.
   * Otherwise a soft synthesized mechanical hum + ticking is used.
   */
  startSpinLoop(totalMs: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    this.stopSpinLoop();

    // If user uploaded a custom loop, play it.
    let stopCustomLoop: (() => void) | undefined;
    void this.playEvent("spinLoop", true).then((stop) => {
      stopCustomLoop = stop;
    });

    const dest = this.master;

    // Soft mechanical hum — sine through lowpass, very low gain.
    const humOsc = ctx.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 90;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(humOsc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 350;
    lp.Q.value = 2;
    humOsc.connect(lp);
    lp.connect(humGain);
    humGain.connect(dest);
    humOsc.start();
    lfo.start();
    humGain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.08);

    // Periodic ticking (only if no custom loop is set, otherwise rely on the loop).
    let elapsed = 0;
    let interval = 80;
    const minInterval = 100;
    const startTime = performance.now();
    let tickTimer: ReturnType<typeof setTimeout>;

    const scheduleTick = () => {
      if (!this.customSounds.spinLoop) {
        this.tick();
      }
      const progress = Math.min(1, elapsed / totalMs);
      interval = 80 + Math.pow(progress, 2.4) * 260;
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
        if (stopCustomLoop) {
          stopCustomLoop();
          stopCustomLoop = undefined;
        }
        try {
          humGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
          humOsc.stop(ctx.currentTime + 0.25);
          lfo.stop(ctx.currentTime + 0.25);
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
    void this.playEvent("reelStop", false);
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.customSounds.reelStop) return;
    const t = ctx.currentTime;
    // heavy low thud
    this.blip(ctx, this.master, {
      freq: 120,
      glideTo: 40,
      type: "sine",
      start: t,
      dur: 0.24,
      gain: 0.28,
      attack: 0.005,
    });
    // soft clack
    this.noiseBurst(ctx, this.master, {
      start: t,
      dur: 0.06,
      gain: 0.08,
      filterFreq: 1200,
      q: 0.8,
      type: "lowpass",
    });
    // higher lock ping
    this.blip(ctx, this.master, {
      freq: 560,
      type: "triangle",
      start: t + 0.02,
      dur: 0.12,
      gain: 0.1,
      attack: 0.003,
    });
  }

  /** Triumphant but soft ascending arpeggio for the winner reveal. */
  winFanfare() {
    void this.playEvent("winFanfare", false);
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.customSounds.winFanfare) return;
    const dest = this.master;
    const t0 = ctx.currentTime;
    // soft C major pentatonic ascending
    const notes = [523.25, 659.25, 783.99, 880.0, 1046.5];
    notes.forEach((f, i) => {
      const start = t0 + i * 0.13;
      this.blip(ctx, dest, {
        freq: f,
        type: "triangle",
        start,
        dur: 0.36,
        gain: 0.16,
        attack: 0.01,
      });
      // soft sine octave-up sparkle
      this.blip(ctx, dest, {
        freq: f * 2,
        type: "sine",
        start: start + 0.02,
        dur: 0.24,
        gain: 0.05,
        attack: 0.01,
      });
    });
    // final soft chord
    const chordStart = t0 + notes.length * 0.13 + 0.04;
    [261.63, 329.63, 392.0, 523.25].forEach((f) => {
      this.blip(ctx, dest, {
        freq: f,
        type: "triangle",
        start: chordStart,
        dur: 1.0,
        gain: 0.12,
        attack: 0.02,
      });
    });
    // a couple of soft coin dings
    this.coin(chordStart + 0.08);
    this.coin(chordStart + 0.34);
    this.coin(chordStart + 0.58);
  }

  /** A bright but soft coin "ding". */
  coin(start?: number) {
    void this.playEvent("coin", false);
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.customSounds.coin) return;
    const t = start ?? ctx.currentTime;
    this.blip(ctx, this.master, {
      freq: 1318.51,
      type: "sine",
      start: t,
      dur: 0.35,
      gain: 0.1,
      attack: 0.005,
    });
    this.blip(ctx, this.master, {
      freq: 2637.02,
      type: "sine",
      start: t + 0.01,
      dur: 0.28,
      gain: 0.04,
      attack: 0.005,
    });
  }

  /** A soft UI click for buttons. */
  uiClick() {
    void this.playEvent("uiClick", false);
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.customSounds.uiClick) return;
    this.blip(ctx, this.master, {
      freq: 480,
      type: "sine",
      dur: 0.035,
      gain: 0.06,
      attack: 0.002,
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
