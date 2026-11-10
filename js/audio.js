// Critical — audio 100 % synthétisé (WebAudio) : aucun fichier son, aucune licence.
let ctx = null, master, sfx, mus, verb, AC = null;
const on = { sfx: true, mus: true };
let musTimer = null, chordI = 0, sess = null;
const SCALE = [0, 3, 5, 7, 10]; // pentatonique mineure : toute chaîne sonne juste
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function impulse(sec) {
  const len = (ctx.sampleRate * sec) | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
  return b;
}

/* ---------- déblocage automatique du son (iPhone, PWA comprise) ----------
   iOS ne laisse démarrer le son que dans un VRAI geste (touchend / click / pointerup, pas pointerdown).
   Le contexte est donc créé et repris dans ces gestes ; s'il reste bloqué (bug WebKit des PWA, état
   « suspended » / « interrupted » après la mise en arrière-plan), il est reconstruit au geste suivant.
   Plus aucun bouton « activer le son » : le premier tap, n'importe où, suffit. */
const GESTURES = ['touchend', 'pointerup', 'mouseup', 'click', 'keydown'];
let armed = false, tries = 0, silentEl = null;

function build() {
  AC = AC || window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ } // son même en mode silencieux
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain(); master.gain.value = 0.85;
  master.connect(comp); comp.connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  mus = ctx.createGain(); mus.gain.value = 0.55; mus.connect(master);
  verb = ctx.createConvolver(); verb.buffer = impulse(1.9);
  const vg = ctx.createGain(); vg.gain.value = 0.38;
  verb.connect(vg); vg.connect(master);
  sfx.connect(verb); mus.connect(verb);
  ctx.onstatechange = () => {
    if (!ctx) return;
    if (ctx.state === 'running') { tries = 0; disarm(); if (on.mus) startMusic(); }
    else { stopMusic(); arm(); }
  };
}
function silentAudio() { // anciens iOS : un <audio> silencieux fait passer la session en « lecture »
  if (navigator.audioSession || silentEl) return;
  try {
    const n = 800, u = new Uint8Array(44 + n), v = new DataView(u.buffer), w = (o, t) => [...t].forEach((c, i) => u[o + i] = c.charCodeAt(0));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); u.fill(128, 44);
    silentEl = new Audio(URL.createObjectURL(new Blob([u], { type: 'audio/wav' }))); silentEl.setAttribute('playsinline', ''); silentEl.play().catch(() => {});
  } catch (e) { /* ignore */ }
}
function unlock() { // appelé DANS un geste utilisateur
  if (!(window.AudioContext || window.webkitAudioContext)) return;
  if (ctx && ctx.state !== 'running' && tries >= 1) { // déjà essayé sans succès : on repart d'un contexte neuf
    stopMusic(); try { ctx.onstatechange = null; ctx.close(); } catch (e) { /* ignore */ } ctx = null; tries = 0;
  }
  if (!ctx) build();
  if (!ctx) return;
  if (ctx.state === 'running') { disarm(); return; }
  tries++;
  try { ctx.resume().then(() => { if (ctx && ctx.state === 'running') { disarm(); if (on.mus) startMusic(); } }).catch(() => {}); } catch (e) { /* ignore */ }
  try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (e) { /* ignore */ }
  silentAudio();
}
function arm() { if (armed) return; armed = true; for (const g of GESTURES) window.addEventListener(g, unlock, { capture: true, passive: true }); }
function disarm() { if (!armed) return; armed = false; for (const g of GESTURES) window.removeEventListener(g, unlock, { capture: true }); }
const recheck = () => { if (!document.hidden && (!ctx || ctx.state !== 'running')) arm(); };
document.addEventListener('visibilitychange', recheck); window.addEventListener('pageshow', recheck); window.addEventListener('focus', recheck);

export function init() { arm(); }                       // compatible avec l'ancien code : arme simplement le déblocage
export function resume() { if (!ctx || ctx.state !== 'running') arm(); }
export function setSfx(v) { on.sfx = v; }
export function setMusic(v) { on.mus = v; if (!ctx) return; v ? startMusic() : stopMusic(); }
export const isReady = () => !!ctx && ctx.state === 'running';
arm();

const live = () => ctx && ctx.state === 'running';
function tone(f, type, dur, vol, o = {}) {
  if (!live() || !on.sfx) return;
  const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (o.atk || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(sfx);
  osc.start(t); osc.stop(t + dur + 0.05);
}
function noise(dur, vol, f0, f1) {
  if (!live() || !on.sfx) return;
  const t = ctx.currentTime, len = (ctx.sampleRate * dur) | 0, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfx); s.start(t);
}
const noteOf = (n) => 57 + SCALE[n % 5] + 12 * Math.min(3, (n / 5) | 0);

export const tap = () => { tone(220, 'sine', 0.16, 0.35, { to: 70 }); tone(900, 'triangle', 0.04, 0.12); };
export const select = () => tone(700, 'sine', 0.05, 0.1);
export const ui = () => tone(540, 'sine', 0.06, 0.12, { to: 620 });
export const hit = () => tone(1500 + Math.random() * 500, 'triangle', 0.05, 0.06);
export function boom(n) {
  const f = mtof(noteOf(Math.max(0, n - 1)) + 12);
  tone(f, 'sine', 0.55, 0.3);
  tone(f * 2, 'triangle', 0.22, 0.12);
  tone(f * 3.01, 'sine', 0.12, 0.05, { at: 0.01 });
  noise(0.16, 0.16 + Math.min(n, 10) * 0.012, 3200, 180);
  if (n < 3) tone(90, 'sine', 0.18, 0.3, { to: 45 });
}
export const crack = () => { noise(0.07, 0.22, 4200, 900); tone(140 + Math.random() * 60, 'square', 0.05, 0.08); };
export const rumble = () => { noise(0.7, 0.3, 500, 60); tone(55, 'sawtooth', 0.7, 0.18, { to: 32 }); };
export const land = () => tone(80, 'sine', 0.09, 0.14, { to: 50 });
export const step = (d = 0) => tone(95 + d * 7, 'sine', 0.07, 0.09);
export const breach = () => { tone(130, 'sawtooth', 0.45, 0.25, { to: 38 }); noise(0.35, 0.3, 2200, 90); };
export const mult = (m) => { const f = mtof(72 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(8, m) - 1]); tone(f, 'sine', 0.4, 0.22); tone(f * 2, 'triangle', 0.22, 0.08); };
export function win() { [0, 2, 4, 7, 9, 12].forEach((s, i) => { tone(mtof(69 + s), 'sine', 0.7, 0.2, { at: i * 0.08 }); tone(mtof(81 + s), 'triangle', 0.4, 0.07, { at: i * 0.08 + 0.02 }); }); }
export function fail() { tone(330, 'triangle', 0.35, 0.2, { to: 220 }); tone(247, 'sine', 0.5, 0.2, { at: 0.18, to: 150 }); }
export function star(i) { tone(mtof(81 + i * 4), 'sine', 0.6, 0.22); tone(mtof(93 + i * 4), 'triangle', 0.3, 0.08); }

// Musique : nappes lentes + notes éparses, très discrète.
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 65]];
function startMusic() {
  if (musTimer || !ctx || ctx.state !== 'running') return;
  sess = ctx.createGain(); sess.gain.value = 1; sess.connect(mus);
  const bus = sess;
  const play = () => {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, ch = CHORDS[chordI++ % CHORDS.length];
    ch.forEach((m, k) => {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(m - 12); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 520 + k * 80;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + 7.6);
        o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + 8);
      }
    });
    for (let k = 0; k < 3; k++) {
      const m = ch[(Math.random() * ch.length) | 0] + 12, at = t + 1 + Math.random() * 5;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.05, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8);
      o.connect(g); g.connect(bus); o.start(at); o.stop(at + 2);
    }
  };
  play(); musTimer = setInterval(play, 7000);
}
function stopMusic() {
  clearInterval(musTimer); musTimer = null;
  if (!sess) return;
  const old = sess; sess = null; // coupe tout de suite, y compris les nappes en cours
  old.gain.cancelScheduledValues(ctx.currentTime); old.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  setTimeout(() => { try { old.disconnect(); } catch (e) { /* ignore */ } }, 300);
}

// ---- Coffres / noyaux scellés ----
export const setScale = (a) => { SCALE.splice(0, SCALE.length, ...a); }; // gamme de la skin équipée
export const chestBeat = (p = 0) => { tone(62 + p * 40, 'sine', 0.2, 0.5, { to: 38 }); tone(240 + p * 900, 'triangle', 0.05, 0.1 + p * 0.1); };
export function chestCrack() { noise(0.5, 0.4, 7000, 160); tone(180, 'sawtooth', 0.6, 0.28, { to: 36 }); tone(1200, 'triangle', 0.25, 0.12, { to: 300 }); }
export function chestRise(d = 1) { tone(180, 'sawtooth', d, 0.1, { to: 1700, atk: d * 0.95 }); tone(360, 'sine', d, 0.12, { to: 3400, atk: d * 0.95 }); }
export function chestReveal(r = 0) {
  const base = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21], n = [3, 4, 6, 8, 10][r];
  noise(0.6, 0.3 + r * 0.05, 8000, 200); tone(60, 'sine', 0.9, 0.5, { to: 30 });
  for (let i = 0; i < n; i++) { const f = mtof(64 + base[i % base.length]); tone(f, 'sine', 0.9 + r * 0.15, 0.2, { at: i * 0.07 }); tone(f * 2, 'triangle', 0.5, 0.08, { at: i * 0.07 + 0.01 }); }
  if (r >= 3) [0, 7, 12, 16].forEach((s, i) => tone(mtof(48 + s), 'sawtooth', 1.8, 0.07, { at: 0.1 + i * 0.03 }));
}
