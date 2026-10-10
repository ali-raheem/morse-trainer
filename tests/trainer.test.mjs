import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonSet, groups, need, record, recordReaction } from '../js/trainer.js';
import { load, save, DEFAULTS } from '../js/store.js';
import { callsign, exchange } from '../js/words.js';
import { tokens, codeFor } from '../js/morse.js';
import { createRng } from '../js/rng.js';

test('lessons grow one character at a time from K and M', () => {
  assert.deepEqual(lessonSet(1), ['K', 'M']);
  assert.deepEqual(lessonSet(2), ['K', 'M', 'U']);
  assert.equal(lessonSet(99).length, 41);
});

test('practice groups use only the lesson set and include all of it', () => {
  const set = lessonSet(5);
  const text = groups(createRng(1), set, {}, 60, 50);
  for (const ch of text.replace(/ /g, '')) assert.ok(set.includes(ch));
  for (const ch of set) assert.ok(text.includes(ch));
  assert.ok(text.split(' ').every((g) => g.length >= 1 && g.length <= 6));
});

test('weak characters get more practice', () => {
  const stats = { K: { right: 50, wrong: 0 }, M: { right: 10, wrong: 10 } };
  assert.ok(need(stats, 'M') > need(stats, 'K'));
  assert.ok(need({}, 'U') > need(stats, 'K'));
});

test('stats accumulate', () => {
  let s = record({}, { K: { right: 3, wrong: 1 } });
  s = record(s, { K: { right: 1, wrong: 0 }, M: { right: 0, wrong: 2 } });
  assert.deepEqual(s.K, { right: 4, wrong: 1 });
  s = recordReaction(s, 'K', true, 800);
  assert.equal(s.K.ms, 800);
  assert.equal(s.K.right, 5);
});

test('settings survive storage and junk is ignored', () => {
  const m = new Map();
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  assert.deepEqual(load(storage), DEFAULTS);
  save({ ...DEFAULTS, wpm: 25, eff: 99, lesson: 7 }, storage);
  const s = load(storage);
  assert.equal(s.wpm, 25);
  assert.equal(s.eff, 25); // can't be faster than the character speed
  assert.equal(s.lesson, 7);
  m.set('morse.v1', '{nope');
  assert.deepEqual(load(storage), DEFAULTS);
});

test('callsigns and exchanges are sendable', () => {
  const rng = createRng(4);
  for (let i = 0; i < 50; i++) {
    assert.match(callsign(rng), /^[A-Z0-9]+[0-9][A-Z]{1,3}$/);
    for (const tok of tokens(exchange(rng))) if (tok !== ' ') assert.ok(codeFor(tok), tok);
  }
});
