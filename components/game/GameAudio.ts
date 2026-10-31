export type MusicTrack = "neon" | "playful" | "off";
export type GameSound = "start" | "correct" | "end" | "win" | "tick";

// All buffers are packaged assets. One unlocked context mixes cues above music.
export class GameAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer | null>>();
  private music: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private effects = new Set<AudioBufferSourceNode>();
  private generation = 0;
  private effectGeneration = 0;
  private enabled = true;
  private effectsVolume = 1;
  private musicVolume = .55;
  private urgent = false;
  private track: MusicTrack = "off";

  unlock() {
    try {
      this.context ??= new AudioContext({ latencyHint: "interactive" });
      void this.context.resume().catch(() => {});
      for (const name of ["start", "correct", "end", "win", "tick", "neon", "playful"]) void this.load(name);
    } catch { /* Sound must never interrupt a turn. */ }
  }

  private load(name: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);
    const pending = this.pending.get(name);
    if (pending) return pending;
    const task = fetch(`/audio/${name}.m4a`)
      .then(response => { if (!response.ok) throw new Error("Missing audio asset"); return response.arrayBuffer(); })
      .then(data => this.context!.decodeAudioData(data))
      .then(buffer => { this.buffers.set(name, buffer); return buffer; })
      .catch(() => null)
      .finally(() => this.pending.delete(name));
    this.pending.set(name, task);
    return task;
  }

  configure(enabled: boolean, effectsVolume: number, musicVolume: number) {
    this.enabled = enabled;
    this.effectsVolume = effectsVolume;
    this.musicVolume = musicVolume;
    if (!enabled) { this.stopMusic(); this.stopEffects(); }
    this.updateMusicGain();
  }

  private updateMusicGain() {
    if (!this.context || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(this.enabled ? this.musicVolume * (this.urgent ? .16 : .48) : 0, this.context.currentTime, .12);
  }

  setUrgent(urgent: boolean) { this.urgent = urgent; this.updateMusicGain(); }

  async play(kind: GameSound) {
    if (!this.enabled || this.effectsVolume === 0 || document.hidden) return;
    this.unlock();
    if (!this.context) return;
    const epoch = this.effectGeneration;
    const buffer = this.buffers.get(kind);
    // A start bell must respond inside the tap even on the very first cold launch.
    if (kind === "start" && !buffer) {
      const now = this.context.currentTime;
      for (const [frequency, offset] of [[880, 0], [1320, .13]]) {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(.3 * this.effectsVolume, now + offset + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, now + offset + .65);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start(now + offset); oscillator.stop(now + offset + .7);
      }
      return;
    }
    const decoded = buffer ?? await this.load(kind);
    if (!decoded || epoch !== this.effectGeneration || !this.enabled || document.hidden) return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = decoded;
    gain.gain.value = this.effectsVolume;
    source.connect(gain).connect(this.context.destination);
    this.effects.add(source);
    source.onended = () => { this.effects.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
  }

  async startMusic(track: MusicTrack) {
    if (!this.enabled || track === "off" || document.hidden) { this.stopMusic(); return; }
    if (this.track === track && this.music) return;
    this.stopMusic();
    this.unlock();
    const epoch = this.generation;
    const buffer = await this.load(track);
    if (!buffer || !this.context || epoch !== this.generation || !this.enabled || document.hidden) return;
    this.track = track;
    this.music = this.context.createBufferSource();
    this.musicGain = this.context.createGain();
    this.music.buffer = buffer;
    this.music.loop = true;
    this.music.connect(this.musicGain).connect(this.context.destination);
    this.musicGain.gain.value = 0;
    this.updateMusicGain();
    this.music.start();
  }

  stopMusic() {
    this.generation++;
    this.music?.stop(); this.music?.disconnect(); this.musicGain?.disconnect();
    this.music = null; this.musicGain = null; this.track = "off";
  }

  stopEffects() { this.effectGeneration++; for (const source of this.effects) source.stop(); this.effects.clear(); }
  suspend() { this.stopMusic(); this.stopEffects(); void this.context?.suspend().catch(() => {}); }
  dispose() { this.stopMusic(); this.stopEffects(); void this.context?.close().catch(() => {}); this.context = null; }
}
