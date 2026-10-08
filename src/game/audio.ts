type CueName = "spray" | "caught" | "runup" | "hit" | "success" | "fail";

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

class SchoolDashAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private muted = false;

  unlock() {
    if (!this.ctx) {
      const AudioCtor =
        window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
      if (!AudioCtor) return;
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.42,
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  cue(name: CueName) {
    this.unlock();
    if (!this.ctx) return;

    if (name === "spray") {
      this.tone(220, 0.08, "square", 0.12);
      this.tone(330, 0.08, "square", 0.12, 0.11);
      this.noise(0.28, 0.04, 0.06);
      return;
    }
    if (name === "caught") {
      this.tone(164, 0.18, "sawtooth", 0.16);
      this.tone(110, 0.22, "sawtooth", 0.14, 0.16);
      this.noise(0.12, 0.08, 0.03);
      return;
    }
    if (name === "runup") {
      [392, 392, 523, 659].forEach((freq, index) => {
        this.tone(freq, index === 3 ? 0.22 : 0.09, "square", 0.14, index * 0.28);
      });
      return;
    }
    if (name === "hit") {
      this.noise(0.16, 0.22, 0);
      this.tone(82, 0.24, "sawtooth", 0.24);
      return;
    }
    if (name === "success") {
      [523, 659, 784, 1046].forEach((freq, index) => {
        this.tone(freq, 0.13, "triangle", 0.16, index * 0.12);
      });
      return;
    }
    [392, 330, 262, 196].forEach((freq, index) => {
      this.tone(freq, 0.16, "triangle", 0.14, index * 0.15);
    });
  }

  startMusic() {
    this.unlock();
    if (!this.ctx) return;
    this.stopMusic();
    this.stepIndex = 0;
    this.nextStepTime = this.ctx.currentTime + 0.04;

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const horizon = this.ctx.currentTime + 0.18;
      while (this.nextStepTime < horizon) {
        this.scheduleStep(this.stepIndex, this.nextStepTime);
        this.stepIndex += 1;
        this.nextStepTime += 60 / 132 / 2;
      }
    }, 45);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleStep(step: number, when: number) {
    const barStep = step % 16;
    if (barStep % 4 === 0) {
      this.kick(when);
    }
    if (barStep % 2 === 1) {
      this.hat(when);
    }

    const bassline = [98, 98, 123.47, 98, 146.83, 98, 123.47, 164.81];
    const note = bassline[Math.floor(barStep / 2) % bassline.length];
    if (barStep % 2 === 0) {
      this.tone(note, 0.09, "square", 0.055, when - (this.ctx?.currentTime ?? 0));
    }
    if (barStep === 14) {
      this.tone(392, 0.08, "triangle", 0.05, when - (this.ctx?.currentTime ?? 0));
      this.tone(494, 0.08, "triangle", 0.05, when - (this.ctx?.currentTime ?? 0) + 0.08);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }

  private kick(when: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.11);
    gain.gain.setValueAtTime(0.16, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.13);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.15);
  }

  private hat(when: number) {
    this.noise(0.035, 0.035, when - (this.ctx?.currentTime ?? 0));
  }

  private noise(duration: number, volume: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const start = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
  }
}

export const schoolAudio = new SchoolDashAudio();
