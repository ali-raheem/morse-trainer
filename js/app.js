// App wiring: tabs, the five practice modes, settings and offline support.

import { CODE, KOCH, PROSIGNS, codeFor } from './morse.js';
import { Decoder } from './decoder.js';
import { align, tally } from './score.js';
import { PASS, lessonSet, groups, need, record, recordReaction, charsPerMinute } from './trainer.js';
import { WORDS, ABBREVIATIONS, callsign, exchange } from './words.js';
import { load, save, clear, DEFAULTS } from './store.js';
import { Tone, Keyer } from './audio.js';
import { Listener } from './listen.js';
import { createRng, randomSeed } from './rng.js';
import { VERSION, BUILT } from './version.js';

const $ = (id) => document.getElementById(id);
const state = load();
const tone = new Tone(state);
const rng = createRng(randomSeed());
const LESSONS = KOCH.length - 1;
const persist = () => save(state);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
const pretty = (code) => code.replace(/\./g, '·').replace(/-/g, '–');
const useIcon = (button, name) => button.querySelector('use').setAttribute('href', `#i-${name}`);
function setLabel(button, icon, text) {
  useIcon(button, icon);
  button.querySelector('span').textContent = text;
}

// --- tabs ----------------------------------------------------------------------------

let current = 'learn';
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function showTab(name) {
  if (name === current) return;
  stopEverything();
  current = name;
  for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.tab === name));
  for (const sec of document.querySelectorAll('.tab')) sec.hidden = sec.id !== `tab-${name}`;
  if (name === 'send') renderSend();
}
for (const t of tabs) t.addEventListener('click', () => showTab(t.dataset.tab));

function stopEverything() {
  tone.stop();
  if (learn.playing) finishLearn(true);
  if (instant.running) stopInstant();
  keyer.release();
  if (listener) stopListening();
}

// --- learn (Koch) --------------------------------------------------------------------

const learn = { playing: false, text: '', played: 0, awaiting: false, view: state.lesson };

function fillSelect(sel, values, current, label) {
  sel.innerHTML = values.map((v) => `<option value="${v}"${v === current ? ' selected' : ''}>${label(v)}</option>`).join('');
}

function renderLearnControls() {
  fillSelect($('learn-wpm'), [5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40].concat(state.wpm).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b),
    state.wpm, (v) => `${v} wpm`);
  fillSelect($('learn-eff'), [3, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40].concat(state.eff).filter((v, i, a) => v <= state.wpm && a.indexOf(v) === i).sort((a, b) => a - b),
    state.eff, (v) => (v >= state.wpm ? 'none' : `${v} wpm`));
  fillSelect($('learn-len'), [30, 60, 120, 180, 300], state.seconds, (v) => (v < 60 ? `${v} s` : `${v / 60} min`));
}

function renderLesson() {
  const n = learn.view;
  const set = lessonSet(n);
  const newest = set[set.length - 1];
  $('lesson-no').textContent = n;
  $('lesson-of').textContent = LESSONS;
  $('lesson-set').innerHTML = set.map((c) => `<span class="${c === newest ? 'new' : ''}">${escapeHtml(c)}</span>`).join('');
  $('new-char').textContent = n === 1 ? 'K M' : newest;
  $('new-code').textContent = n === 1 ? `${pretty(CODE.K)}  ${pretty(CODE.M)}` : pretty(CODE[newest]);
  $('lesson-prev').disabled = n <= 1;
  $('lesson-next').disabled = n >= Math.min(LESSONS, state.lesson);
  renderLearnStats();
}

function renderLearnStats() {
  const set = lessonSet(learn.view);
  $('learn-stats').innerHTML = set.map((ch) => {
    const s = state.stats[ch];
    const n = s ? s.right + s.wrong : 0;
    const acc = n ? s.right / n : 0;
    const color = !n ? '#5a5245' : acc >= 0.9 ? 'var(--good)' : acc >= 0.7 ? 'var(--accent)' : 'var(--bad)';
    return `<div class="bar"><b>${escapeHtml(ch)}</b> <small>${n ? `${Math.round(acc * 100)}% of ${n}` : 'not yet'}</small><div class="track"><i style="width:${(acc * 100).toFixed(0)}%;--c:${color}"></i></div></div>`;
  }).join('');
}

function startLearn() {
  const set = lessonSet(learn.view);
  learn.text = groups(rng, set, state.stats, state.seconds, charsPerMinute(state.eff));
  learn.played = 0;
  learn.playing = true;
  learn.awaiting = false;
  $('learn-result').innerHTML = '';
  $('learn-copy').value = '';
  $('learn-copy').focus({ preventScroll: true });
  setLabel($('learn-start'), 'stop', 'Stop');
  const total = learn.text.replace(/ /g, '').length;
  tone.play(learn.text, {
    onChar: (i) => {
      learn.played = i + 1;
      $('learn-progress').style.width = `${((i + 1) / total) * 100}%`;
    },
    onEnd: () => finishLearn(false),
  });
}

// Playback has ended (or was stopped): wait for the copy to be checked.
function finishLearn(stopped) {
  tone.stop();
  learn.playing = false;
  learn.awaiting = learn.played > 0;
  setLabel($('learn-start'), 'play', learn.awaiting ? 'Check my copy' : 'Start');
  if (stopped && !learn.awaiting) $('learn-progress').style.width = '0';
}

function checkLearn() {
  learn.awaiting = false;
  // Only what was actually sent counts.
  const sent = learn.text.replace(/ /g, '').slice(0, learn.played);
  const result = align(sent, $('learn-copy').value);
  state.stats = record(state.stats, tally(result.ops));
  state.sessions.push({ at: Date.now(), lesson: learn.view, accuracy: result.accuracy, chars: sent.length });
  const pct = Math.round(result.accuracy * 100);
  const full = learn.played >= learn.text.replace(/ /g, '').length;
  const passed = result.accuracy >= PASS && full && learn.view === state.lesson && state.lesson < LESSONS;
  if (passed) state.lesson++;
  persist();
  const diff = result.ops.map((o) => {
    if (o.op === 'ok') return `<span class="ok">${escapeHtml(o.sent)}</span>`;
    if (o.op === 'wrong') return `<span class="wrong" title="you wrote ${escapeHtml(o.got)}">${escapeHtml(o.sent)}</span>`;
    if (o.op === 'missed') return `<span class="missed">${escapeHtml(o.sent)}</span>`;
    return `<span class="extra">${escapeHtml(o.got)}</span>`;
  }).join('');
  const t = tally(result.ops);
  const weak = Object.entries(t).filter(([, v]) => v.wrong).sort((a, b) => b[1].wrong - a[1].wrong).slice(0, 4).map(([ch]) => ch);
  let verdict;
  if (passed) {
    const next = lessonSet(state.lesson).at(-1);
    verdict = `<span class="pass">Passed.</span> Lesson ${state.lesson} adds <b class="code">${escapeHtml(next)}</b> ${pretty(CODE[next])}.`;
  } else if (result.accuracy >= PASS && !full) {
    verdict = '<span class="pass">Good copy.</span> Finish a whole session to move on.';
  } else if (result.accuracy >= PASS) {
    verdict = '<span class="pass">Good copy.</span>';
  } else {
    verdict = `<span class="fail">Not quite.</span> ${Math.round(PASS * 100)}% moves you on${weak.length ? `; watch ${weak.map(escapeHtml).join(' ')}` : ''}.`;
  }
  $('learn-result').innerHTML = `<div class="score">${pct}%</div><div class="diff">${diff}</div><div>${verdict}</div>
    <div class="meta">Green: right. Red underline: wrong. Struck through: missed. Small: extra.</div>`;
  setLabel($('learn-start'), 'play', 'Start');
  $('learn-progress').style.width = '0';
  learn.view = state.lesson > learn.view && passed ? state.lesson : learn.view;
  renderLesson();
}

$('learn-start').addEventListener('click', () => {
  if (learn.playing) finishLearn(true);
  else if (learn.awaiting) checkLearn();
  else startLearn();
});
$('learn-copy').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && learn.awaiting) {
    e.preventDefault();
    checkLearn();
  }
});
$('hear-new').addEventListener('click', () => {
  const set = lessonSet(learn.view);
  const ch = learn.view === 1 ? 'K M' : set.at(-1);
  tone.play(learn.view === 1 ? 'KKK MMM' : `${ch}${ch}${ch} ${ch}`, { eff: state.wpm });
});
$('lesson-prev').addEventListener('click', () => {
  learn.view = Math.max(1, learn.view - 1);
  renderLesson();
});
$('lesson-next').addEventListener('click', () => {
  learn.view = Math.min(state.lesson, learn.view + 1);
  renderLesson();
});
$('learn-wpm').addEventListener('change', (e) => setSpeed(Number(e.target.value), state.eff));
$('learn-eff').addEventListener('change', (e) => setSpeed(state.wpm, Number(e.target.value)));
$('learn-len').addEventListener('change', (e) => {
  state.seconds = Number(e.target.value);
  persist();
});

function setSpeed(wpm, eff) {
  state.wpm = wpm;
  state.eff = Math.min(eff, wpm);
  persist();
  renderLearnControls();
  renderSettings();
}

// --- instant recognition --------------------------------------------------------------

const instant = { running: false, ch: null, askedAt: 0, count: 0, right: 0, streak: 0, timer: null, answered: false };

function instantSet() {
  switch ($('ins-set').value) {
    case 'letters': return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    case 'alnum': return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
    case 'all': return KOCH;
    default: return lessonSet(state.lesson);
  }
}

function renderPad() {
  $('ins-pad').innerHTML = instantSet().map((c) => `<button data-ch="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  renderInstantStats();
}

function renderInstantStats() {
  $('ins-stats').innerHTML = instantSet().map((ch) => {
    const s = state.stats[ch];
    const ms = s?.ms;
    const w = ms ? Math.max(4, Math.min(100, 100 - (ms - 300) / 15)) : 0;
    const color = !ms ? '#5a5245' : ms < 800 ? 'var(--good)' : ms < 1500 ? 'var(--accent)' : 'var(--bad)';
    return `<div class="bar"><b>${escapeHtml(ch)}</b> <small>${ms ? `${Math.round(ms)} ms` : 'not yet'}</small><div class="track"><i style="width:${w.toFixed(0)}%;--c:${color}"></i></div></div>`;
  }).join('');
}

function renderInstantMeta() {
  const acc = instant.count ? Math.round((instant.right / instant.count) * 100) : 0;
  $('ins-meta').textContent = instant.count ? `${instant.right}/${instant.count} right (${acc}%) · streak ${instant.streak}` : 'Press Start, then answer each character as fast as you can.';
}

function askInstant() {
  const set = instantSet();
  const weights = set.map((ch) => [ch, need(state.stats, ch)]);
  let ch = rng.weighted(weights);
  if (ch === instant.ch && set.length > 1) ch = rng.weighted(weights);
  instant.ch = ch;
  instant.answered = false;
  const box = $('ins-char');
  box.textContent = '?';
  box.className = 'huge';
  $('ins-code').textContent = '';
  instant.askedAt = Infinity;
  tone.play(ch, { eff: state.wpm, lead: 0.1, onEnd: () => (instant.askedAt = performance.now()) });
}

function answerInstant(ch) {
  if (!instant.running || instant.answered) return;
  instant.answered = true;
  const correct = ch.toUpperCase() === instant.ch;
  // Answering before the character has finished counts as instant.
  const ms = Math.max(0, performance.now() - Math.min(instant.askedAt, performance.now()));
  tone.stop();
  state.stats = recordReaction(state.stats, instant.ch, correct, ms);
  persist();
  instant.count++;
  if (correct) {
    instant.right++;
    instant.streak++;
  } else {
    instant.streak = 0;
  }
  const box = $('ins-char');
  box.textContent = instant.ch;
  box.className = `huge ${correct ? 'right' : 'wrong'}`;
  $('ins-code').textContent = `${pretty(codeFor(instant.ch))}${correct ? ` · ${Math.round(ms)} ms` : ` · you pressed ${ch.toUpperCase()}`}`;
  const btn = $('ins-pad').querySelector(`[data-ch="${CSS.escape(ch.toUpperCase())}"]`);
  if (btn) {
    btn.classList.add(correct ? 'flash-ok' : 'flash-bad');
    setTimeout(() => btn.classList.remove('flash-ok', 'flash-bad'), 300);
  }
  renderInstantMeta();
  renderInstantStats();
  // A miss replays the character so the right sound sticks.
  if (!correct) setTimeout(() => instant.running && tone.play(instant.ch, { eff: state.wpm, lead: 0.05 }), 350);
  instant.timer = setTimeout(() => instant.running && askInstant(), correct ? 650 : 1700);
}

function startInstant() {
  Object.assign(instant, { running: true, count: 0, right: 0, streak: 0, ch: null });
  setLabel($('ins-start'), 'stop', 'Stop');
  renderInstantMeta();
  askInstant();
}

function stopInstant() {
  instant.running = false;
  clearTimeout(instant.timer);
  tone.stop();
  setLabel($('ins-start'), 'play', 'Start');
}

$('ins-start').addEventListener('click', () => (instant.running ? stopInstant() : startInstant()));
$('ins-set').addEventListener('change', () => {
  if (instant.running) stopInstant();
  renderPad();
});
$('ins-pad').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ch]');
  if (b) answerInstant(b.dataset.ch);
});

// --- copy ----------------------------------------------------------------------------

const copy = { item: '', checked: true, right: 0, total: 0 };

function nextCopyItem() {
  switch ($('copy-kind').value) {
    case 'abbr': return rng.pick(ABBREVIATIONS);
    case 'calls': return callsign(rng);
    case 'qso': return exchange(rng);
    default: return rng.pick(WORDS);
  }
}

function playCopy(fresh) {
  if (fresh) {
    copy.item = nextCopyItem();
    copy.checked = false;
    $('copy-result').innerHTML = '';
    $('copy-input').value = '';
  }
  if (!copy.item) return;
  $('copy-input').focus({ preventScroll: true });
  tone.play(copy.item);
}

function checkCopy() {
  if (!copy.item || copy.checked) {
    playCopy(true);
    return;
  }
  copy.checked = true;
  const got = $('copy-input').value.trim().toUpperCase().replace(/\s+/g, ' ');
  const want = copy.item.replace(/<|>/g, '');
  const ok = got.replace(/ /g, '') === want.replace(/ /g, '');
  copy.total++;
  if (ok) copy.right++;
  const r = align(want, got);
  $('copy-result').innerHTML = ok
    ? `<div class="score pass">✓ ${escapeHtml(want)}</div><div class="meta">Enter for the next one.</div>`
    : `<div class="score fail">${Math.round(r.accuracy * 100)}%</div><div class="diff">${escapeHtml(want)}</div><div class="meta">You wrote: ${escapeHtml(got) || '(nothing)'}. Enter for the next one.</div>`;
  $('copy-score').textContent = `${copy.right}/${copy.total} right`;
}

$('copy-play').addEventListener('click', () => playCopy(true));
$('copy-replay').addEventListener('click', () => playCopy(false));
$('copy-show').addEventListener('click', () => {
  if (copy.item) $('copy-result').innerHTML = `<div class="diff">${escapeHtml(copy.item.replace(/<|>/g, ''))}</div>`;
});
$('copy-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    checkCopy();
  }
});
$('copy-kind').addEventListener('change', () => {
  copy.item = '';
  state.copyKind = $('copy-kind').value;
  persist();
});

// --- send ----------------------------------------------------------------------------

const decoder = new Decoder(state.wpm);
let downAt = 0;
let upAt = 0;
let isDown = false;
let idle = [];
let sendDone = false;

function keyDown() {
  if (isDown) return;
  isDown = true;
  const now = performance.now();
  for (const t of idle) clearTimeout(t);
  idle = [];
  tone.key(true);
  if (upAt) decoder.space(now - upAt);
  downAt = now;
  for (const id of ['key-straight', 'paddle-dit', 'paddle-dah']) $(id).classList.toggle('down', id === 'key-straight');
}

function keyUp() {
  if (!isDown) return;
  isDown = false;
  const now = performance.now();
  tone.key(false);
  decoder.mark(now - downAt);
  upAt = now;
  $('key-straight').classList.remove('down');
  // Silence ends the character, then the word.
  idle.push(setTimeout(() => {
    decoder.flush();
    renderDecoded();
  }, decoder.dit * 3));
  idle.push(setTimeout(() => {
    if (decoder.text && !decoder.text.endsWith(' ')) decoder.emit(' ');
    upAt = 0;
    renderDecoded();
  }, decoder.dit * 7));
  renderDecoded();
}

const keyer = new Keyer(() => state.wpm, keyDown, keyUp);

function renderDecoded() {
  $('send-out').innerHTML = `${escapeHtml(decoder.text)}<span class="pending">${pretty(decoder.symbol)}</span>`;
  $('send-meta').textContent = decoder.text ? `≈ ${decoder.wpm} wpm` : '';
  const target = $('send-target').textContent.trim();
  const sent = decoder.text.trim().split(' ').slice(-target.split(' ').length).join(' ');
  if (target && sent === target && !sendDone) {
    sendDone = true;
    $('send-meta').textContent = `✓ sent cleanly at ≈ ${decoder.wpm} wpm`;
    setTimeout(() => {
      sendDone = false;
      newSendTarget();
      decoder.reset();
      renderDecoded();
    }, 1200);
  } else if (sendDone) {
    $('send-meta').textContent = `✓ sent cleanly at ≈ ${decoder.wpm} wpm`;
  }
}

function newSendTarget() {
  const pick = rng.weighted([[() => rng.pick(WORDS), 0.5], [() => callsign(rng), 0.25], [() => rng.pick(ABBREVIATIONS), 0.25]]);
  $('send-target').textContent = pick();
}

function renderSend() {
  const iambic = state.keyMode === 'iambic';
  for (const b of document.querySelectorAll('.seg [data-mode]')) b.setAttribute('aria-checked', String(b.dataset.mode === state.keyMode));
  $('key-straight').hidden = iambic;
  $('paddle-dit').hidden = !iambic;
  $('paddle-dah').hidden = !iambic;
  $('send-hint').textContent = iambic
    ? `Paddles: hold the left one for dits and the right one for dahs, or both to alternate (iambic mode B, ${state.wpm} wpm). On a keyboard, use [ and ] or the left and right arrows.`
    : 'Press and hold the key, or the space bar, for each element. The decoder learns your speed as you go; keep the gaps between letters about three dits long, and between words about seven.';
  if (!$('send-target').textContent) newSendTarget();
}

for (const b of document.querySelectorAll('.seg [data-mode]')) {
  b.addEventListener('click', () => {
    state.keyMode = b.dataset.mode;
    persist();
    renderSend();
  });
}

function bindKey(el, down, up) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    down();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, () => up());
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindKey($('key-straight'), keyDown, keyUp);
bindKey($('paddle-dit'), () => {
  $('paddle-dit').classList.add('down');
  keyer.press('dit', true);
}, () => {
  $('paddle-dit').classList.remove('down');
  keyer.press('dit', false);
});
bindKey($('paddle-dah'), () => {
  $('paddle-dah').classList.add('down');
  keyer.press('dah', true);
}, () => {
  $('paddle-dah').classList.remove('down');
  keyer.press('dah', false);
});
$('send-new').addEventListener('click', () => {
  newSendTarget();
  decoder.reset();
  renderDecoded();
});
$('send-clear').addEventListener('click', () => {
  decoder.reset();
  renderDecoded();
});

// --- decode (microphone) -----------------------------------------------------------

let listener = null;
let heard = '';

async function startListening() {
  heard = '';
  $('dec-out').textContent = '';
  $('dec-meta').textContent = 'Asking for the microphone…';
  listener = new Listener({
    onChar: (ch) => {
      heard = (heard + ch).slice(-3000);
      $('dec-out').textContent = heard;
      $('dec-out').scrollTop = $('dec-out').scrollHeight;
    },
    onStatus: ({ level, on, pitch, wpm }) => {
      $('dec-level').style.width = `${(level * 100).toFixed(0)}%`;
      $('dec-led').classList.toggle('on', on);
      $('dec-meta').textContent = `tone ${pitch} Hz · ≈ ${wpm} wpm`;
    },
  });
  try {
    await listener.start(state.tone);
    setLabel($('dec-start'), 'stop', 'Stop listening');
  } catch (err) {
    listener = null;
    $('dec-meta').textContent = err?.name === 'NotAllowedError'
      ? 'The microphone was blocked. Allow it in your browser\'s site settings and try again.'
      : `Couldn't start the microphone (${err?.message ?? err}).`;
  }
}

function stopListening() {
  listener?.stop();
  listener = null;
  setLabel($('dec-start'), 'mic', 'Start listening');
  $('dec-level').style.width = '0';
  $('dec-led').classList.remove('on');
}

$('dec-start').addEventListener('click', () => (listener ? stopListening() : startListening()));
$('dec-clear').addEventListener('click', () => {
  heard = '';
  $('dec-out').textContent = '';
  listener?.decoder.reset();
});
if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
  $('dec-start').disabled = true;
  $('dec-meta').textContent = 'This browser can\'t listen to the microphone from a web page.';
}

// --- chart ---------------------------------------------------------------------------

$('chart').innerHTML = KOCH.map((c) => `<button data-play="${escapeHtml(c)}"><b>${escapeHtml(c)}</b><span>${pretty(CODE[c])}</span></button>`).join('');
$('chart-pro').innerHTML = Object.entries(PROSIGNS).map(([p, code]) => `<button data-play="${escapeHtml(p)}"><b>${escapeHtml(p.replace(/[<>]/g, ''))}</b><span>${pretty(code)}</span></button>`).join('');
for (const id of ['chart', 'chart-pro']) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('[data-play]');
    if (b) tone.play(b.dataset.play, { eff: state.wpm, lead: 0.05 });
  });
}

// --- keyboard --------------------------------------------------------------------------

const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (current === 'send' && !typing()) {
    if (e.repeat && ['ArrowLeft', 'ArrowRight', '[', ']', ' '].includes(e.key)) {
      e.preventDefault();
      return;
    }
    if (state.keyMode === 'straight' && e.key === ' ') {
      e.preventDefault();
      keyDown();
      return;
    }
    if (state.keyMode === 'iambic' && ['[', 'ArrowLeft', 'z', 'Z'].includes(e.key)) {
      e.preventDefault();
      keyer.press('dit', true);
      return;
    }
    if (state.keyMode === 'iambic' && [']', 'ArrowRight', 'x', 'X', '/'].includes(e.key)) {
      e.preventDefault();
      keyer.press('dah', true);
      return;
    }
  }
  if (current === 'instant' && instant.running && !typing() && e.key.length === 1 && e.key !== ' ') {
    e.preventDefault();
    answerInstant(e.key);
  }
  if (e.key === 'Escape' && !$('settings').hidden) closeSettings();
});
window.addEventListener('keyup', (e) => {
  if (current !== 'send') return;
  if (e.key === ' ') keyUp();
  if (['[', 'ArrowLeft', 'z', 'Z'].includes(e.key)) keyer.press('dit', false);
  if ([']', 'ArrowRight', 'x', 'X', '/'].includes(e.key)) keyer.press('dah', false);
});
window.addEventListener('blur', () => {
  keyUp();
  keyer.release();
});

// --- settings --------------------------------------------------------------------------

function renderSettings() {
  $('set-wpm').value = state.wpm;
  $('set-eff').max = state.wpm;
  $('set-eff').value = state.eff;
  $('set-tone').value = state.tone;
  $('set-vol').value = state.volume;
  $('out-wpm').textContent = `${state.wpm} wpm`;
  $('out-eff').textContent = state.eff >= state.wpm ? 'off' : `${state.eff} wpm`;
  $('out-tone').textContent = `${state.tone} Hz`;
  $('out-vol').textContent = `${Math.round(state.volume * 100)}%`;
}
function openSettings() {
  renderSettings();
  $('settings').hidden = false;
}
function closeSettings() {
  $('settings').hidden = true;
}
$('btn-settings').addEventListener('click', () => ($('settings').hidden ? openSettings() : closeSettings()));
$('settings-close').addEventListener('click', closeSettings);
$('set-wpm').addEventListener('input', (e) => setSpeed(Number(e.target.value), state.eff));
$('set-eff').addEventListener('input', (e) => setSpeed(state.wpm, Number(e.target.value)));
$('set-tone').addEventListener('input', (e) => {
  state.tone = Number(e.target.value);
  persist();
  renderSettings();
});
$('set-vol').addEventListener('input', (e) => {
  state.volume = Number(e.target.value);
  persist();
  renderSettings();
});
$('set-test').addEventListener('click', () => tone.play('PARIS PARIS'));
$('set-reset').addEventListener('click', () => {
  if (!confirm('Reset your lesson and all your character stats? Your speed and tone settings stay.')) return;
  clear();
  Object.assign(state, { lesson: 1, stats: {}, sessions: [] });
  persist();
  learn.view = 1;
  renderLesson();
  renderPad();
});
$('version').textContent = `v${VERSION} · built ${new Date(BUILT).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;

// Install: Chromium hands us a deferred prompt; iOS Safari has no install API, so we
// explain Share → Add to Home Screen instead.
let installPrompt = null;
const runningInstalled = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function renderInstall() {
  $('set-install').hidden = runningInstalled || !installPrompt;
  $('install-hint').hidden = runningInstalled || installPrompt || !isIOS;
  $('install-hint').textContent = 'To install: in Safari, tap Share, then Add to Home Screen.';
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  renderInstall();
});
$('set-install').addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  prompt.prompt();
  await prompt.userChoice;
  renderInstall();
});
renderInstall();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register(`./sw.js?v=${VERSION}`).catch(() => {});
}

// --- start -----------------------------------------------------------------------------

$('copy-kind').value = state.copyKind ?? DEFAULTS.copyKind;
renderLearnControls();
renderLesson();
renderPad();
renderInstantMeta();
renderSettings();
renderDecoded();
