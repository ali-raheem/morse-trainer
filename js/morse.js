// The code itself, the Koch learning order, and timing: turning text into a schedule of
// key-down intervals at a character speed, optionally stretched with Farnsworth spacing.
// DOM-free.

export const CODE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
  "'": '.----.', '(': '-.--.', ')': '-.--.-', ':': '---...', '@': '.--.-.', '!': '-.-.--',
};

// Prosigns: run-together characters sent without a gap, written <AR> etc.
export const PROSIGNS = { '<AR>': '.-.-.', '<SK>': '...-.-', '<BT>': '-...-', '<KN>': '-.--.', '<AS>': '.-...' };

export const DECODE = Object.fromEntries([
  ...Object.entries(CODE).map(([ch, code]) => [code, ch]),
  ['...-.-', '<SK>'], ['.-...', '<AS>'],
]);

// The Koch order (as used by LCWO): characters that sound distinct from each other
// come early, so a beginner learns them apart.
export const KOCH = [...'KMURESNAPTLWI.JZ=FOY,VG5/Q92H38B?47C1D60X'];

// Split text into symbols: single characters, or prosigns written <XX>.
export function tokens(text) {
  const out = [];
  const s = text.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '<') {
      const end = s.indexOf('>', i);
      if (end > i) {
        out.push(s.slice(i, end + 1));
        i = end;
        continue;
      }
    }
    out.push(s[i]);
  }
  return out;
}

export function codeFor(token) {
  return CODE[token] ?? PROSIGNS[token] ?? null;
}

// Element timings in seconds. With Farnsworth spacing (eff < wpm) characters keep their
// speed and the gaps between them stretch, using the ARRL formula.
export function timing(wpm, eff = wpm) {
  const dit = 1.2 / wpm;
  const e = Math.min(eff, wpm);
  if (e >= wpm) return { dit, dah: 3 * dit, gap: dit, charGap: 3 * dit, wordGap: 7 * dit };
  const ta = (60 * wpm - 37.2 * e) / (e * wpm);
  return { dit, dah: 3 * dit, gap: dit, charGap: (3 * ta) / 19, wordGap: (7 * ta) / 19 };
}

// A schedule for some text: key-down intervals [start, end] in seconds, plus when each
// character starts and ends (so the UI can follow along).
export function schedule(text, wpm, eff = wpm, start = 0) {
  const t = timing(wpm, eff);
  const marks = [];
  const chars = [];
  let at = start;
  let pendingGap = 0;
  for (const tok of tokens(text)) {
    if (tok === ' ' || tok === '\n') {
      if (chars.length) pendingGap = t.wordGap;
      continue;
    }
    const code = codeFor(tok);
    if (!code) continue;
    at += pendingGap;
    const begin = at;
    for (let i = 0; i < code.length; i++) {
      const len = code[i] === '.' ? t.dit : t.dah;
      marks.push([at, at + len]);
      at += len + (i < code.length - 1 ? t.gap : 0);
    }
    chars.push({ ch: tok, start: begin, end: at });
    pendingGap = t.charGap;
  }
  return { marks, chars, end: at };
}

// PARIS: the standard word, 50 dits long, that defines words per minute.
export const PARIS_UNITS = 50;
