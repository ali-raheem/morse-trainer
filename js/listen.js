// The microphone decoder: an audio worklet reports the power at the tone frequency every
// few milliseconds; this turns that into key-down and key-up times with an adaptive
// threshold, and feeds them to the same decoder the practice key uses. It finds the tone's
// pitch by itself from an FFT of the input.

import { Decoder } from './decoder.js';

export class Listener {
  constructor({ onChar, onStatus }) {
    this.onChar = onChar;
    this.onStatus = onStatus; // ({ level, on, pitch, wpm })
    this.decoder = new Decoder(18);
    this.decoder.onChar = (ch) => this.onChar(ch);
  }

  async start(pitch = 600) {
    this.pitch = pitch;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    await this.ctx.audioWorklet.addModule('js/tone-worklet.js');
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'tone-detector', { processorOptions: { freq: pitch } });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.6;
    src.connect(this.node);
    src.connect(this.analyser);
    this.spectrum = new Float32Array(this.analyser.frequencyBinCount);
    // Envelope state, in dB.
    this.floor = -90;
    this.peak = -40;
    this.on = false;
    this.since = 0; // ms at the last transition
    this.clock = 0; // ms of audio processed
    this.node.port.onmessage = (e) => this.block(e.data);
    this.pitchTimer = setInterval(() => this.findPitch(), 250);
  }

  block({ power, frames }) {
    const ms = (frames / this.ctx.sampleRate) * 1000;
    this.clock += ms;
    const db = 10 * Math.log10(power + 1e-12);
    // Track the noise floor slowly upwards and quickly down; the peak the other way round.
    this.floor = db < this.floor ? this.floor + (db - this.floor) * 0.2 : this.floor + (db - this.floor) * 0.002;
    this.peak = db > this.peak ? this.peak + (db - this.peak) * 0.3 : this.peak + (db - this.peak) * 0.0006;
    const span = Math.max(6, this.peak - this.floor);
    const hi = this.floor + span * 0.55;
    const lo = this.floor + span * 0.4;
    const usable = this.peak - this.floor > 10;
    const now = this.clock;
    if (!this.on && usable && db > hi) {
      this.decoder.space(now - this.since);
      this.on = true;
      this.since = now;
    } else if (this.on && db < lo) {
      this.decoder.mark(now - this.since);
      this.on = false;
      this.since = now;
    } else if (!this.on) {
      // A long silence ends the character, then the word.
      const quiet = now - this.since;
      if (quiet > this.decoder.dit * 3 && this.decoder.symbol) this.decoder.flush();
      if (quiet > this.decoder.dit * 7 && this.decoder.text && !this.decoder.text.endsWith(' ')) this.decoder.emit(' ');
    }
    this.onStatus?.({ level: Math.max(0, Math.min(1, (db - this.floor) / Math.max(12, span))), on: this.on, pitch: this.pitch, wpm: this.decoder.wpm });
  }

  // Lock onto the strongest steady tone between 300 and 1200 Hz.
  findPitch() {
    this.analyser.getFloatFrequencyData(this.spectrum);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const lo = Math.floor(300 / binHz);
    const hi = Math.ceil(1200 / binHz);
    let best = lo;
    for (let i = lo; i <= hi; i++) if (this.spectrum[i] > this.spectrum[best]) best = i;
    const sorted = Array.from(this.spectrum.slice(lo, hi)).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (this.spectrum[best] - median > 20) {
      const f = best * binHz;
      if (Math.abs(f - this.pitch) > 15) {
        this.pitch = Math.round(this.pitch + (f - this.pitch) * 0.6);
        this.node.port.postMessage({ freq: this.pitch });
      }
    }
  }

  stop() {
    clearInterval(this.pitchTimer);
    this.node?.port.close();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
  }
}
