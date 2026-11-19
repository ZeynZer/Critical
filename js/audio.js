// Critical — audio 100 % synthétisé (WebAudio) : aucun fichier son, aucune licence.
let ctx = null, master, fade, sfx, mus, verb, AC = null;
let asleep = false, sleepT = 0; // asleep : l'app est en arrière-plan (écran éteint…) ; le son est suspendu
const on = { sfx: true, mus: true };
let musTimer = null, chordI = 0, sess = null;
const SCALE = [0, 3, 5, 7, 10]; // pentatonique mineure : toute chaîne sonne juste
// Session audio « jeu » (iOS 16.4+ ; ailleurs le comportement par défaut est déjà celui-ci) : on respecte l'interrupteur silencieux
// du téléphone et on se mélange à la musique ou au podcast de l'utilisateur au lieu de les couper.
const gameSession = () => { try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* ignore */ } };
gameSession();
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
let armed = false, tries = 0;

function build() {
  AC = AC || window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  gameSession();
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  master = ctx.createGain(); master.gain.value = 0.85;
  fade = ctx.createGain(); // fondu d'entrée et de mise en veille, indépendant des réglages
  master.connect(fade); fade.connect(comp); comp.connect(ctx.destination);
  sfx = ctx.createGain(); sfx.connect(master);
  mus = ctx.createGain(); mus.gain.value = 0.55; mus.connect(master);
  verb = ctx.createConvolver(); verb.buffer = impulse(1.9);
  const vg = ctx.createGain(); vg.gain.value = 0.38;
  verb.connect(vg); vg.connect(master);
  sfx.connect(verb); mus.connect(verb);
  ctx.onstatechange = () => {
    if (!ctx) return;
    if (ctx.state === 'running') { tries = 0; disarm(); fadeUp(); if (on.mus) startMusic(); }
    else { stopMusic(); arm(); }
  };
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
}
// Fondu d'entrée (au premier démarrage et à chaque reprise) : jamais de son qui claque
function fadeUp() { if (asleep || !fade) return; try { const t = ctx.currentTime; fade.gain.cancelScheduledValues(t); fade.gain.setValueAtTime(0, t); fade.gain.linearRampToValueAtTime(1, t + 0.4); } catch (e) { /* ignore */ } }
// Écran éteint, app en arrière-plan, onglet caché : fondu de 0,15 s, puis le contexte audio est suspendu (plus aucun son, plus de batterie
// consommée par la puce audio). Au retour : reprise en fondu ; si le système exige un geste (iOS), le prochain toucher la rétablit.
function sleep() {
  asleep = true; clearTimeout(sleepT);
  if (!ctx || ctx.state === 'closed') return;
  stopMusic();
  try { const t = ctx.currentTime; fade.gain.cancelScheduledValues(t); fade.gain.setTargetAtTime(0, t, 0.04); } catch (e) { /* ignore */ }
  sleepT = setTimeout(() => { if (asleep && ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 180);
}
function wake() {
  if (!asleep) return; asleep = false; clearTimeout(sleepT);
  if (!ctx || ctx.state === 'closed') return;
  if (ctx.state === 'running') { fadeUp(); if (on.mus) startMusic(); return; } // jamais suspendu (retour très rapide)
  ctx.resume().catch(() => arm()); // à la reprise, onstatechange relance fondu et musique
}
document.addEventListener('visibilitychange', () => (document.hidden ? sleep() : wake()));
window.addEventListener('pagehide', sleep); window.addEventListener('pageshow', wake);
document.addEventListener('freeze', sleep); document.addEventListener('resume', wake);
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

const live = () => ctx && ctx.state === 'running' && !asleep;
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
// Intensité de la musique (0 calme → 1 plein) : nappes plus brillantes, notes plus denses, basse qui pulse
let mood = 0;
export const setMood = (v) => { mood = Math.max(0, Math.min(1, v)); };
function startMusic() {
  if (musTimer || !ctx || ctx.state !== 'running' || asleep) return;
  sess = ctx.createGain(); sess.gain.value = 1; sess.connect(mus);
  const bus = sess;
  const play = () => {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, ch = CHORDS[chordI++ % CHORDS.length];
    ch.forEach((m, k) => {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(m - 12); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 520 + k * 80 + mood * 900;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + 7.6);
        o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + 8);
      }
    });
    if (mood > 0.3) for (let k = 0; k < 8; k++) { const o = ctx.createOscillator(), g = ctx.createGain(), at = t + k * 0.875; o.type = 'sine'; o.frequency.value = mtof(ch[0] - 24); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09 * mood, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6); o.connect(g); g.connect(bus); o.start(at); o.stop(at + 0.7); }
    for (let k = 0, n = 3 + Math.round(mood * 6); k < n; k++) {
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

// ---- Genèse : un timbre par famille d'astres, légèrement désaccordé à chaque fois pour ne jamais sonner pareil ----
const jit = () => 1 + (Math.random() - 0.5) * 0.05;
export function fuse(fam, n) { // fam : 0 roche · 1 planète · 2 étoile · 3 astre extrême · 4 galactique ; n = maillon de la chaîne (monte la gamme)
  const f = mtof(noteOf(Math.max(0, n - 1)) + 12) * jit();
  if (fam === 0) { tone(f * 2, 'triangle', 0.09, 0.2, { to: f }); noise(0.05, 0.14, 5200, 1200); } // choc sec de cailloux
  else if (fam === 1) { tone(f, 'sine', 0.7, 0.26); tone(f * 2.76, 'sine', 0.35, 0.07); tone(f * 5.4, 'sine', 0.15, 0.03); } // cloche de verre
  else if (fam === 2) { tone(f / 2, 'sawtooth', 0.5, 0.1, { to: f, atk: 0.08 }); tone(f * 1.5, 'sine', 0.6, 0.16, { at: 0.05 }); tone(f, 'sine', 0.7, 0.2); noise(0.4, 0.12, 600, 4200); } // embrasement
  else if (fam === 3) { tone(f / 2, 'sine', 0.9, 0.34, { to: f / 8 }); tone(f * 2, 'square', 0.12, 0.05, { to: f * 4 }); noise(0.6, 0.2, 3000, 80); } // effondrement grave
  else { [0, 4, 7, 11, 14, 19].forEach((st, i) => { tone(f * 2 ** (st / 12), 'sine', 0.9, 0.16, { at: i * 0.07 }); tone(f * 2 ** (st / 12) * 2.01, 'triangle', 0.5, 0.05, { at: i * 0.07 }); }); noise(1.2, 0.14, 300, 6000); } // arpège scintillant
}
export const release = () => tone(520 * jit(), 'sine', 0.12, 0.13, { to: 260 });
export const thud = (size) => { tone((150 - size * 90) * jit(), 'sine', 0.1 + size * 0.1, 0.1 + size * 0.14, { to: 45 }); if (size > 0.5) noise(0.08, 0.06, 500, 120); };
export const gulp = () => tone(300 * jit(), 'sine', 0.25, 0.2, { to: 50 });
export const ping = () => { tone(1900 * jit(), 'sine', 0.3, 0.1); tone(2850, 'sine', 0.2, 0.04, { at: 0.03 }); };
export function rare(r) { // fanfare d'autant plus longue et haute que la rareté monte
  const st = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36, 40, 43, 48, 52, 55];
  for (let i = 0; i < 5 + r * 2; i++) { tone(mtof(60 + r + st[i]), 'sine', 1.2, 0.2, { at: i * 0.09 }); tone(mtof(72 + r + st[i]), 'triangle', 0.6, 0.06, { at: i * 0.09 + 0.02 }); }
  noise(1.5, 0.16, 200, 7000); tone(55, 'sine', 1.6, 0.3, { to: 30 });
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

// Ouverture de pack : montée qui s'accélère, notes de liaison (plus aiguës et plus riches pour une bonne rareté), avalement, impact
export function packRise(d) { chestRise(d); const n = Math.max(3, Math.round(d * 4)); for (let i = 0; i < n; i++) tone(70 + i * 22, 'sine', 0.16, 0.22, { at: ((i / n) ** 1.6) * d }); }
export function packLink(i, r) { const f = mtof(72 + [0, 2, 4, 7, 9][i % 5] + (r >= 3 ? 12 : 0)); tone(f, 'sine', 0.55, 0.18); tone(f * 2, 'triangle', 0.3, 0.07, { at: 0.02 }); if (r >= 3) [0, 4, 7, 12].forEach((s, k) => tone(mtof(84 + s + i), 'sine', 0.9, 0.07, { at: k * 0.05 })); }
export function packCharge(p) { tone(mtof(48 + p * 24), 'sine', 0.22, 0.12 + p * 0.1); if (p > 0.7) noise(0.12, 0.05 + p * 0.06, 4000 + p * 4000, 800); }
export function packPlace(r) { noise(0.16, 0.12, 5000, 700); tone(mtof(60 + r * 2), 'triangle', 0.18, 0.1); }
export function packSwallow() { noise(1.3, 0.28, 900, 50); tone(220, 'sawtooth', 1.3, 0.14, { to: 28, atk: 0.4 }); }
export function packBoom(r) { noise(1.1, 0.4, 9000, 90); tone(48, 'sine', 1.2, 0.6, { to: 26 }); if (r >= 4) rare(r); }
export function packHit(r) { if (r >= 3) rare(r); else if (r >= 1) { tone(mtof(72 + r * 3), 'sine', 0.6, 0.2); tone(mtof(84 + r * 3), 'triangle', 0.35, 0.08); } else tone(mtof(66), 'sine', 0.25, 0.12); }
