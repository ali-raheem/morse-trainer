# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Morse Trainer: a Morse code learning tool (Koch lessons, instant recognition, copy practice, a straight key and paddles with a live decoder, and a microphone decoder) shipped as an offline PWA. It's a tool rather than one of the screensaver siblings, so it has its own page layout (sticky tabs, a scrolling page, a settings sheet), but the same no-build vanilla ES modules, version bump and service worker pattern as `../Affinity`. `README.md` explains the modes and how they work.

(The parent `../CLAUDE.md` describes the shoryuken.me workspace and its shared-origin rules; the one above that, `~/Workspace/CLAUDE.md`, is an unrelated Rust/Fallout project. Ignore that one here.)

## Commands

```bash
npm test                            # node --test tests/*.test.mjs
node --test tests/morse.test.mjs    # single file
npm run serve                       # python3 -m http.server 8080 (getUserMedia needs localhost/HTTPS)
npm run bump                        # bump js/version.js + package.json (-- minor|major)
npm run icons                       # regenerate icons/ (Pillow)
```

## Architecture

DOM-free and unit-tested:

- `js/morse.js`: `CODE`, `PROSIGNS` (written `<SK>` etc.), `DECODE`, `KOCH`, `tokens()`, `timing(wpm, eff)` (ARRL Farnsworth), `schedule(text, wpm, eff)` → `{ marks: [[start, end]], chars, end }` in seconds.
- `js/decoder.js`: the `Decoder` class: `mark(ms)`, `space(ms)`, `flush()`, an adaptive `dit`, `text`, and the pending `symbol`.
- `js/score.js`: `align(sent, got)` (Levenshtein with ops: ok, wrong, missed, extra; spaces ignored) and `tally(ops)`.
- `js/trainer.js`: `lessonSet(n)`, `need(stats, ch)` (practice weight), `groups()`, `record()`, `recordReaction()`, `PASS` = 0.9.
- `js/store.js`: `load`/`save`/`clear` under the single key `morse.v1`, with clamping. Pass a storage object in tests.
- `js/words.js`: words, abbreviations, random `callsign()`, `exchange()`.

Browser-only:

- `js/audio.js`: `Tone` (`play(text, { onChar, onEnd })` schedules one oscillator with 5 ms ramps; `key(down)` is the sidetone) and `Keyer` (iambic mode B, which calls the same `down`/`up` handlers as the straight key).
- `js/listen.js` + `js/tone-worklet.js`: the microphone. The worklet posts the Goertzel power every 128 samples; `Listener` tracks the floor and peak (in dB), thresholds with hysteresis, and feeds the `Decoder`. An AnalyserNode FFT retunes the worklet to the strongest tone between 300 and 1,200 Hz.
- `js/app.js`: tab switching (`stopEverything()` on every switch), and each mode's UI. The Learn mode only scores what was actually played (`learn.played`), and only advances a lesson on a full session at ≥90%.

## Conventions and gotchas

- **Adding or renaming a file:** add it to `ASSETS` in `sw.js` (`tests/assets.test.mjs` fails otherwise), then `npm run bump`. The worklet is loaded by URL, so it must stay in `ASSETS` to work offline.
- **Audio** starts only from a user gesture; every `Tone` call is made from one.
- **Keyboard:** in Send, the space bar and `[`/`]`/arrows/`z`/`x` are keys only when focus isn't in a form field; in Instant, any printable key answers.
- **Testing the microphone decoder:** run Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>` and a generated WAV of known text. It should copy clean 20 wpm code after the first character, while it locks onto the pitch.
- **Visual checks:** Playwright from `../JJUCompanion/node_modules` against `npm run serve`, at 1280×860 and 390×844.

## Shared origin

Served at `/morse/`. The manifest `id` is `/morse/` (never change it once released). localStorage uses the single key `morse.v1`; "Reset progress" removes only that key. `sw.js` uses cache prefix `morse-`, handles only requests inside its scope, reads only its own cache (never `caches.match()`), precaches with `cache: 'reload'` and fetches with `cache: 'no-cache'`. See `../CLAUDE.md`.

## Deployment

Live since 2026-10-10 (nginx blocks in the site config, card on the homepage). To ship an update, after `npm test` and `npm run bump` copy only the served files:

```bash
rsync -a --delete --chmod=D755,F644 index.html manifest.webmanifest sw.js css js icons root@185.163.204.17:/var/www/shoryuken.me/morse/
```
