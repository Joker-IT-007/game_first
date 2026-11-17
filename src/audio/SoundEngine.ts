export class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.crowdGain && this.ctx) {
      this.crowdGain.gain.setTargetAtTime(enabled ? 0.075 : 0, this.ctx.currentTime, 0.12);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buffer;
  }

  public startCrowdAmbience() {
    this.unlock();
    if (!this.ctx || !this.noiseBuffer || this.crowdSource) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.value = this.enabled ? 0.075 : 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();

    this.crowdSource = source;
    this.crowdFilter = filter;
    this.crowdGain = gain;
  }

  public setCrowdExcitement(level: number) {
    if (!this.ctx || !this.crowdGain || !this.crowdFilter || !this.enabled) return;
    const clamped = Math.max(0, Math.min(1, level));
    const targetGain = 0.065 + clamped * 0.16;
    const targetFreq = 480 + clamped * 780;
    this.crowdGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.25);
    this.crowdFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.25);
  }

  public stopCrowdAmbience() {
    if (this.crowdSource) {
      try {
        this.crowdSource.stop();
        this.crowdSource.disconnect();
      } catch {
        // ignore
      }
      this.crowdSource = null;
    }
    this.crowdFilter?.disconnect();
    this.crowdGain?.disconnect();
    this.crowdFilter = null;
    this.crowdGain = null;
  }

  public playWhistle(kind: 'kickoff' | 'halftime' | 'fulltime' | 'goal' = 'kickoff') {
    this.unlock();
    if (!this.ctx || !this.enabled) return;

    const triggerBlast = (startOffset: number, duration: number) => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + startOffset;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const mainGain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(2820, now);
      osc2.frequency.setValueAtTime(2970, now);

      // Pea trill modulation
      lfo.frequency.setValueAtTime(34, now);
      lfoGain.gain.setValueAtTime(95, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      mainGain.gain.setValueAtTime(0.0001, now);
      mainGain.gain.exponentialRampToValueAtTime(0.14, now + 0.025);
      mainGain.gain.setValueAtTime(0.14, now + duration - 0.05);
      mainGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(mainGain);
      osc2.connect(mainGain);
      mainGain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);
      osc1.stop(now + duration + 0.02);
      osc2.stop(now + duration + 0.02);
      lfo.stop(now + duration + 0.02);
    };

    if (kind === 'kickoff') {
      triggerBlast(0, 0.42);
    } else if (kind === 'halftime') {
      triggerBlast(0, 0.25);
      triggerBlast(0.32, 0.5);
    } else if (kind === 'fulltime') {
      triggerBlast(0, 0.22);
      triggerBlast(0.28, 0.22);
      triggerBlast(0.56, 0.65);
    } else {
      triggerBlast(0, 0.35);
    }
  }

  public playKick(power = 0.7) {
    this.unlock();
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const p = Math.max(0.25, Math.min(1, power));

    // Low leather thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145 + p * 45, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);

    gain.gain.setValueAtTime(0.28 * p, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // Crisp transient pop
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200 + p * 600;
      filter.Q.value = 1.4;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18 * p, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.07);
    }
  }

  public playPass() {
    this.playKick(0.45);
  }

  public playTackle() {
    this.unlock();
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.24);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.28);
  }

  public playPostHit() {
    this.unlock();
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const freqs = [310, 625, 1180];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.16 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.48);
    });
  }

  public playGoalCelebration() {
    this.unlock();
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;

    // Massive crowd roar surge
    if (this.noiseBuffer) {
      const roar = this.ctx.createBufferSource();
      roar.buffer = this.noiseBuffer;
      roar.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.linearRampToValueAtTime(1350, now + 0.8);
      filter.frequency.linearRampToValueAtTime(680, now + 3.2);
      filter.Q.value = 0.55;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.35);
      gain.gain.setValueAtTime(0.32, now + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.6);

      roar.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      roar.start(now);
      roar.stop(now + 3.7);
    }

    // Stadium brass fanfare chord
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0.001, now + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.045, now + i * 0.04 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.6);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + 1.65);
    });
  }

  public dispose() {
    this.stopCrowdAmbience();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
