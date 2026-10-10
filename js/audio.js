// Tone output: playing scheduled Morse with click-free keying, and a sidetone that follows
// a key held by hand. The AudioContext is created on first use, which is always inside a
// tap or key press, so browsers let it start.

import { schedule } from './morse.js';

const RAMP = 0.005; // seconds: rise and fall of each element, so the keying doesn't click

export class Tone {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.playing = null;
    this.side = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    this.master.gain.value = this.settings.volume * 0.5;
    return this.ctx;
  }

  // Play text; calls onChar(index, char) as each character starts and onEnd() when done.
  // Returns the schedule so callers know the timings.
  play(text, { wpm = this.settings.wpm, eff = this.settings.eff, onChar, onEnd, lead = 0.25 } = {}) {
    this.stop();
    const ctx = this.ensure();
    const plan = schedule(text, wpm, eff);
    const t0 = ctx.currentTime + lead;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = this.settings.tone;
    gain.gain.value = 0;
    osc.connect(gain).connect(this.master);
    for (const [a, b] of plan.marks) {
      gain.gain.setValueAtTime(0, t0 + a);
      gain.gain.linearRampToValueAtTime(1, t0 + a + RAMP);
      gain.gain.setValueAtTime(1, t0 + b - RAMP);
      gain.gain.linearRampToValueAtTime(0, t0 + b);
    }
    osc.start(t0);
    osc.stop(t0 + plan.end + 0.1);
    const timers = plan.chars.map((c, i) => setTimeout(() => onChar?.(i, c.ch), (lead + c.start) * 1000));
    timers.push(setTimeout(() => {
      this.playing = null;
      onEnd?.();
    }, (lead + plan.end + 0.05) * 1000));
    this.playing = { osc, gain, timers, onEnd };
    return { ...plan, startedAt: performance.now() + lead * 1000 };
  }

  stop() {
    if (!this.playing) return;
    const { osc, gain, timers } = this.playing;
    for (const t of timers) clearTimeout(t);
    try {
      const now = this.ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + RAMP);
      osc.stop(now + RAMP * 2);
    } catch { /* already stopped */ }
    this.playing = null;
  }

  get busy() {
    return !!this.playing;
  }

  // Sidetone for hand keying.
  key(down) {
    const ctx = this.ensure();
    if (!this.side) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.side = { osc, gain };
    }
    const { osc, gain } = this.side;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(this.settings.tone, now);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(down ? 1 : 0, now + RAMP);
  }
}

// An iambic keyer (mode B): holding the dit paddle sends dits, the dah paddle dahs, and
// both alternate; a paddle tapped during an element is remembered. Element timing comes
// from the character speed. It calls down() and up() exactly as a hand on a straight key
// would, so the same code times and decodes both.
export class Keyer {
  constructor(getWpm, down, up) {
    this.getWpm = getWpm;
    this.down = down;
    this.up = up;
    this.dit = false;
    this.dah = false;
    this.running = false;
    this.last = null;
    this.memory = null;
  }

  press(which, pressed) {
    this[which] = pressed;
    if (pressed && this.running && which !== this.current) this.memory = which;
    if (pressed && !this.running) this.next();
  }

  next() {
    const unit = 1200 / this.getWpm();
    let el = this.memory;
    this.memory = null;
    if (!el) {
      if (this.dit && this.dah) el = this.last === 'dit' ? 'dah' : 'dit';
      else if (this.dit) el = 'dit';
      else if (this.dah) el = 'dah';
    }
    if (!el) {
      this.running = false;
      return;
    }
    this.running = true;
    this.last = el;
    this.current = el;
    this.down();
    setTimeout(() => {
      this.up();
      this.current = null;
      setTimeout(() => this.next(), unit);
    }, el === 'dit' ? unit : unit * 3);
  }

  release() {
    this.dit = false;
    this.dah = false;
    this.memory = null;
  }
}
