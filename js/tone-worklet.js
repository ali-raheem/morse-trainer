// Audio worklet for the microphone decoder: for every 128-sample block it measures the
// power at the tone frequency (a Goertzel filter over the last 256 samples) and posts it,
// with the block's total power, to the main thread.

class ToneDetector extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.freq = options.processorOptions?.freq ?? 600;
    this.buf = new Float32Array(256);
    this.pos = 0;
    this.port.onmessage = (e) => {
      if (e.data.freq) this.freq = e.data.freq;
    };
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    let total = 0;
    for (let i = 0; i < input.length; i++) {
      this.buf[this.pos] = input[i];
      this.pos = (this.pos + 1) % this.buf.length;
      total += input[i] * input[i];
    }
    const n = this.buf.length;
    const k = (2 * Math.PI * this.freq) / sampleRate;
    const coeff = 2 * Math.cos(k);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      // Hann window, read oldest first.
      const x = this.buf[(this.pos + i) % n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
      const s0 = x + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    const power = (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (n * n);
    this.port.postMessage({ power, total: total / input.length, frames: input.length });
    return true;
  }
}

registerProcessor('tone-detector', ToneDetector);
