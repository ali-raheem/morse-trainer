// Lesson logic for the Koch method and instant recognition: which characters are in play,
// how to pick practice text that leans on the weak ones, and when to move on. DOM-free.

import { KOCH } from './morse.js';

export const PASS = 0.9; // accuracy needed to unlock the next character
export const GROUP = 5; // characters per group

// The characters in lesson n (lesson 1 is K and M).
export function lessonSet(n) {
  return KOCH.slice(0, Math.max(2, Math.min(KOCH.length, n + 1)));
}

// How much a character needs practice, from its stats: unseen and error-prone ones
// score high. stats[ch] = { right, wrong, ms } (ms: mean reaction time, if known).
export function need(stats, ch) {
  const s = stats[ch];
  if (!s || s.right + s.wrong === 0) return 3;
  const errorRate = (s.wrong + 1) / (s.right + s.wrong + 2);
  const slow = s.ms ? Math.min(2, s.ms / 900) : 1;
  return 0.4 + errorRate * 4 + (slow - 0.5) * 0.6;
}

// Practice groups for a lesson: the newest character gets a boost, weak ones come up
// more often, and every character in the set appears.
export function groups(rng, set, stats, seconds, charsPerMinute) {
  const newest = set[set.length - 1];
  const weights = set.map((ch) => [ch, need(stats, ch) * (ch === newest ? 2 : 1)]);
  const count = Math.max(GROUP, Math.round((seconds / 60) * charsPerMinute));
  const out = [];
  let g = '';
  for (let i = 0; i < count; i++) {
    g += rng.weighted(weights);
    if (g.length === GROUP) {
      out.push(g);
      g = '';
    }
  }
  if (g) out.push(g);
  // Make sure nothing in the set is missed entirely.
  const flat = out.join('');
  for (const ch of set) {
    if (!flat.includes(ch)) out[rng.int(0, out.length - 1)] += ch;
  }
  return out.join(' ');
}

// Characters per minute at a given effective speed (a word is five characters).
export const charsPerMinute = (eff) => eff * 5;

// Merge one session's tally into the running stats.
export function record(stats, tally) {
  const out = { ...stats };
  for (const [ch, t] of Object.entries(tally)) {
    const s = out[ch] ?? { right: 0, wrong: 0 };
    out[ch] = { ...s, right: s.right + t.right, wrong: s.wrong + t.wrong };
  }
  return out;
}

// Instant recognition: record one answer with its reaction time.
export function recordReaction(stats, ch, correct, ms) {
  const s = stats[ch] ?? { right: 0, wrong: 0 };
  const mean = s.ms ? s.ms * 0.75 + ms * 0.25 : ms;
  return { ...stats, [ch]: { ...s, right: s.right + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1), ms: correct ? mean : s.ms } };
}
