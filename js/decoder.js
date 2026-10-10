// Turns key-down and key-up durations into text, adapting to the sender's speed. Used for
// both the practice key and the microphone. DOM-free.
//
// The dit length is tracked from the marks themselves: anything under twice the dit
// estimate is a dit, anything longer a dah (worth a third of its length as evidence).
// Gaps under two dits separate elements, under five separate characters, longer ones words.

import { DECODE } from './morse.js';

export class Decoder {
  constructor(wpm = 20) {
    this.dit = 1200 / wpm; // ms
    this.symbol = '';
    this.text = '';
    this.onChar = null;
  }

  get wpm() {
    return Math.round(1200 / this.dit);
  }

  mark(ms) {
    if (ms < this.dit * 0.25) return; // a glitch
    if (ms < this.dit * 2) {
      this.symbol += '.';
      this.dit = this.dit * 0.8 + ms * 0.2;
    } else {
      this.symbol += '-';
      this.dit = this.dit * 0.8 + (ms / 3) * 0.2;
    }
    this.dit = Math.max(20, Math.min(400, this.dit));
  }

  space(ms) {
    if (ms < this.dit * 2) return;
    this.flush();
    if (ms >= this.dit * 5 && this.text && !this.text.endsWith(' ')) this.emit(' ');
  }

  // Call when the line has been quiet long enough that the last character is done.
  flush() {
    if (!this.symbol) return;
    this.emit(DECODE[this.symbol] ?? '*');
    this.symbol = '';
  }

  emit(ch) {
    this.text += ch;
    this.onChar?.(ch);
  }

  reset() {
    this.symbol = '';
    this.text = '';
  }
}
