import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE, DECODE, KOCH, tokens, timing, schedule, PARIS_UNITS } from '../js/morse.js';
import { Decoder } from '../js/decoder.js';
import { align, tally } from '../js/score.js';

test('the Koch order covers letters, digits and the common punctuation once each', () => {
  assert.equal(new Set(KOCH).size, KOCH.length);
  assert.equal(KOCH.length, 41);
  for (const ch of KOCH) assert.ok(CODE[ch], ch);
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') assert.ok(KOCH.includes(ch), ch);
});

test('every code decodes back', () => {
  for (const [ch, code] of Object.entries(CODE)) assert.equal(DECODE[code], ch);
});

test('PARIS takes 50 dits at full speed', () => {
  const t = timing(20);
  const s = schedule('PARIS ', 20);
  // 43 units of characters and gaps, plus the 7-unit word gap that follows.
  assert.ok(Math.abs(s.end + t.wordGap - PARIS_UNITS * t.dit) < 1e-9);
  assert.ok(Math.abs(t.dit - 0.06) < 1e-12);
});

test('Farnsworth stretches the gaps but not the characters', () => {
  const full = timing(20);
  const slow = timing(20, 10);
  assert.equal(slow.dit, full.dit);
  assert.ok(slow.charGap > full.charGap);
  assert.ok(slow.wordGap > full.wordGap);
  // At 20/10, a PARIS word (with its gap) takes six seconds: ten words a minute.
  const s = schedule('PARIS PARIS', 20, 10);
  const perWord = s.end - schedule('PARIS', 20, 10).end;
  assert.ok(Math.abs(perWord - 6) < 0.01, `${perWord}`);
});

test('prosigns are sent as one character', () => {
  assert.deepEqual(tokens('73 <SK>'), ['7', '3', ' ', '<SK>']);
  const s = schedule('<SK>', 20);
  assert.equal(s.chars.length, 1);
  assert.equal(s.marks.length, 6);
});

test('the decoder reads clean keying and adapts to the speed', () => {
  for (const wpm of [12, 20, 30]) {
    const d = new Decoder(20);
    const { marks } = schedule('CQ DE G4ABC', wpm);
    for (let i = 0; i < marks.length; i++) {
      d.mark((marks[i][1] - marks[i][0]) * 1000);
      if (i + 1 < marks.length) d.space((marks[i + 1][0] - marks[i][1]) * 1000);
    }
    d.flush();
    assert.equal(d.text, 'CQ DE G4ABC', `${wpm} wpm`);
    assert.ok(Math.abs(d.wpm - wpm) <= 3, `estimated ${d.wpm} for ${wpm}`);
  }
});

test('the decoder tolerates sloppy hand keying', () => {
  const d = new Decoder(15);
  // P = .--. with uneven elements and gaps.
  for (const [mark, gap] of [[70, 90], [260, 70], [210, 60], [95, 0]]) {
    d.mark(mark);
    if (gap) d.space(gap);
  }
  d.flush();
  assert.equal(d.text, 'P');
});

test('alignment scores missing, extra and wrong characters', () => {
  assert.equal(align('KMKMK', 'KMKMK').accuracy, 1);
  const r = align('KMRSU', 'KMSXU');
  assert.equal(r.errors, 2);
  assert.ok(Math.abs(r.accuracy - 0.6) < 1e-9);
  const t = tally(align('KKM', 'KM').ops);
  assert.deepEqual(t.K, { right: 1, wrong: 1 });
  assert.deepEqual(t.M, { right: 1, wrong: 0 });
  assert.equal(align('AB CD', 'abcd').accuracy, 1);
});
