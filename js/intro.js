// Critical — intro cinématique + chargement thématique.
//  • Pendant que le noyau de verre tourne, le jeu se prépare VRAIMENT : polices, rendu des matières,
//    premières vagues de Cascade (JIT), défi du jour calculé dans un worker.
//  • Puis « Touche pour déclencher la réaction » : ton tap lance la chaîne d'explosions, le titre apparaît
//    et file se poser à la place du logo de l'accueil.
//  • Première fois : ~8 s. Ensuite : ~4 s. Réglages → « Revoir l'intro ».
import * as A from './audio.js';
import * as Skins from './skins.js';
import { chunk } from './endless.js';
import * as DAILY from './daily.js';

const SEEN = 'critical.intro.v1', TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rg = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lite = (c, k) => [lerp(c[0], 255, k), lerp(c[1], 255, k), lerp(c[2], 255, k)];
const hsl = (h, s, l) => { h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
const CY = [77, 243, 255], MG = [255, 79, 216], AM = [255, 194, 71], VI = [122, 107, 255], CYC = [CY, MG, AM, VI];
const LOW = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s, r = document) => r.querySelector(s);

const H = { vib: () => {}, today: () => '' };
let ui = null, ctx = null, O = null, active = false;

// Overlay noir créé dès l'évaluation du module : pas de flash de l'accueil pendant le chargement des scripts
function mount() {
  if (ui) return;
  document.documentElement.classList.add('intro-on');
  const st = document.createElement('style');
  st.textContent = `
html.intro-on #s-title,html.intro-on #s-title *,html.intro-on #s-title *::before,html.intro-on #s-title *::after{animation-play-state:paused!important}
#intro{position:fixed;inset:0;z-index:200;background:#04050d;touch-action:none;overflow:hidden;transition:opacity .7s ease}
#intro.out{opacity:0;pointer-events:none}
#intro canvas{position:absolute;inset:0;width:100%;height:100%}
.in-lbl{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);text-align:center;font:700 11px var(--disp,Orbitron,sans-serif);letter-spacing:.28em;color:rgba(238,244,255,.6);text-transform:uppercase;pointer-events:none}
.in-tap{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);text-align:center;font:900 14px var(--disp,Orbitron,sans-serif);letter-spacing:.18em;color:#fff;text-shadow:0 0 16px #4df3ff,0 0 34px #ff4fd8;animation:in-pulse 1.3s ease-in-out infinite;pointer-events:none;opacity:0}
.in-tap.on{opacity:1}
@keyframes in-pulse{50%{opacity:.35;transform:scale(.98)}}
.in-title{position:absolute;left:50%;top:42%;margin:0;transform:translate(-50%,-50%) scale(var(--ts,1.2));font:900 min(11vw,46px)/1 var(--disp,Orbitron,sans-serif);letter-spacing:.03em;white-space:nowrap;background:linear-gradient(100deg,#fff 0%,#7ff6ff 28%,#ff7be5 52%,#fff 76%,#7ff6ff 100%) 0 0/250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 16px rgba(77,243,255,.7)) drop-shadow(0 0 40px rgba(255,79,216,.5));opacity:0;pointer-events:none}
.in-title.on{opacity:1;animation:in-shine 2.4s linear infinite}
@keyframes in-shine{to{background-position:-250% 0}}
.in-tag{position:absolute;left:0;right:0;top:calc(42% + 64px);text-align:center;font-size:14px;color:rgba(238,244,255,.75);opacity:0;transition:opacity .6s;pointer-events:none}
.in-tag.on{opacity:1}
.in-skip{position:absolute;right:16px;top:calc(env(safe-area-inset-top,0px) + 12px);height:38px;padding:0 16px;border-radius:19px;font:700 12px var(--disp,Orbitron,sans-serif);letter-spacing:.1em;color:rgba(255,255,255,.8);background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .4s}
.in-skip.on{opacity:1;pointer-events:auto}
`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'intro';
  d.innerHTML = '<canvas></canvas><h1 class="in-title">CRITICAL</h1><div class="in-tag">Un tap. Une réaction en chaîne.</div><div class="in-lbl"></div><div class="in-tap">TOUCHE POUR DÉCLENCHER LA RÉACTION</div><button class="in-skip">PASSER</button>';
  document.body.appendChild(d);
  ui = { root: d, cv: $('canvas', d), lbl: $('.in-lbl', d), tap: $('.in-tap', d), title: $('.in-title', d), tag: $('.in-tag', d), skip: $('.in-skip', d) };
  d.addEventListener('pointerdown', (e) => { if (e.target === ui.skip) return; if (O && O.ph === 'ready') fire(); });
  ui.skip.addEventListener('click', () => { if (O && ['crack', 'chain', 'title'].includes(O.ph)) finish(); });
}
if (typeof document !== 'undefined' && document.body && !sessionStorage.getItem('critical.noIntro')) mount();

/* ============================== chargement réel ============================== */
function tasks(O) {
  const T = [];
  const add = (name, w, fn) => T.push({ name, w, p: 0, fn });
  add('Polices', 1, async (t) => { try { await Promise.all([document.fonts.load('700 16px Orbitron'), document.fonts.load('900 16px Orbitron')]); } catch (e) { /* ignore */ } t.p = 1; });
  add('Illustration', 1, async (t) => {
    await new Promise((res) => { const im = new Image(); im.onload = () => { try { const s = document.createElement('canvas'); s.width = s.height = 48; const c = s.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(im, 0, 0, 48, 48); O.art = s; } catch (e) { /* ignore */ } res(); }; im.onerror = res; im.src = 'icons/icon-512.png'; setTimeout(res, 2500); });
    t.p = 1;
  });
  add('Réacteurs', 2, async (t) => { // préchauffe chaque matière (dégradés, JIT) pour éviter un à-coup au premier niveau
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d');
    const mats = Skins.MATS.map((m) => m[0]);
    for (let i = 0; i < mats.length; i++) { try { Skins.drawOrb(c, mats[i], 48, 48, 30, CY, 1 + (i % 3), 0.5, { hp: 0, gl: 1 }); } catch (e) { /* ignore */ } t.p = (i + 1) / mats.length; await wait(0); }
  });
  add('Cascade', 3, async (t) => { // les premières vagues sont les plus lentes (JIT) : on les calcule ici
    for (let i = 0; i < 8; i++) { try { chunk(i * 1.6, 6, 3); } catch (e) { /* ignore */ } t.p = (i + 1) / 8; await wait(0); }
  });
  add('Défi du jour', 2, async (t) => { try { await DAILY.prepare(H.today()); } catch (e) { /* ignore */ } t.p = 1; });
  return T;
}
const realProgress = (T) => T.reduce((a, t) => a + t.p * t.w, 0) / T.reduce((a, t) => a + t.w, 0);

/* ============================== scène ============================== */
export function init(o) {
  Object.assign(H, o);
  const btns = $('#m-settings .btns'), reset = $('#o-reset');
  if (btns && !$('#o-intro')) {
    const b = document.createElement('button'); b.className = 'big glass'; b.id = 'o-intro'; b.textContent = 'Revoir l\'intro';
    btns.insertBefore(b, reset || btns.firstChild);
    b.addEventListener('click', () => { A.ui(); H.vib(9); const c = $('#o-close'); if (c) c.click(); setTimeout(() => start({ force: 'long' }), 250); });
  }
}
export const busy = () => active;

export function start(opts = {}) {
  if (active) return; mount(); try { document.fonts.load('900 46px Orbitron'); } catch (e) { /* ignore */ }
  const seen = (() => { try { return !!localStorage.getItem(SEEN); } catch (e) { return false; } })();
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mode = opts.force || (reduce || seen ? 'short' : 'long');
  active = true; document.documentElement.classList.add('intro-on');
  const root = ui.root; root.classList.remove('out'); root.style.display = '';
  ui.title.classList.remove('on'); ui.tag.classList.remove('on'); ui.tap.classList.remove('on'); ui.skip.classList.remove('on'); ui.title.style.transform = ''; ui.title.getAnimations && ui.title.getAnimations().forEach((a) => { if (a.id === 'flip') a.cancel(); });
  const dpr = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2), W = root.clientWidth || innerWidth, Hh = root.clientHeight || innerHeight;
  ui.cv.width = Math.round(W * dpr); ui.cv.height = Math.round(Hh * dpr); ctx = ui.cv.getContext('2d');
  O = { mode, long: mode === 'long', W, H: Hh, dpr, cx: W / 2, cy: Hh * 0.42, R: Math.min(W, Hh) * 0.2, ph: 'load', t: 0, pt: 0, last: performance.now(), shown: 0, minLoad: mode === 'long' ? 3 : 1.4, parts: [], rings: [], shards: [], sprites: [], links: [], flash: 0, shake: 0, boost: 0, raysA: 0, k: 0, art: null, beat: 0 };
  O.tasks = tasks(O); O.done = false;
  ui.lbl.textContent = '';
  (async () => { for (const t of O.tasks) { O.cur = t.name; await t.fn(t); t.p = 1; } O.done = true; })();
  O.raf = requestAnimationFrame(loop);
}

function loop(now) {
  if (!O) return;
  O.raf = requestAnimationFrame(loop);
  const rd = Math.min(0.05, (now - O.last) / 1000); O.last = now; O.t += rd; O.pt += rd;
  const o = O;
  if (o.ph === 'load' || o.ph === 'ready') {
    const target = Math.min(realProgress(o.tasks), clamp(o.t / o.minLoad, 0, 1));
    o.shown += (target - o.shown) * Math.min(1, rd * 5);
    if (o.ph === 'load') {
      ui.lbl.textContent = o.shown > 0.97 ? '' : 'Chargement · ' + (o.cur || '');
      o.beat -= rd; if (o.beat <= 0) { o.beat = 0.9; ring(o.cx, o.cy, o.R * 0.95, o.R * 2.2, 0.9, lite(CY, 0.2), 0.02); }
      if (o.done && o.t >= o.minLoad && o.shown > 0.985) { o.ph = 'ready'; o.pt = 0; ui.lbl.textContent = ''; ui.tap.classList.add('on'); H.vib([14, 60, 14]); }
    }
  } else if (o.ph === 'crack') {
    if (o.pt > (o.long ? 0.55 : 0.35)) { o.ph = 'chain'; o.pt = 0; o.k = 0; o.nextT = 0; o.prev = { x: o.cx, y: o.cy }; }
  } else if (o.ph === 'chain') {
    while (o.k < o.N && o.pt >= o.nextT) { explode(o.k); o.k++; o.nextT += o.gap; }
    if (o.k >= o.N && o.pt > o.nextT + 0.2) showTitle();
  } else if (o.ph === 'title') {
    if (o.pt > (o.long ? 1.5 : 0.7)) exit();
  }
  for (const p of o.parts) { p.t += rd; p.x += p.vx * rd; p.y += p.vy * rd; p.vx *= 1 - rd * 0.6; p.vy *= 1 - rd * 0.6; }
  o.parts = o.parts.filter((p) => p.t < p.max);
  for (const r of o.rings) r.t += rd; o.rings = o.rings.filter((r) => r.t < r.max);
  for (const s of o.shards) s.t += rd; o.shards = o.shards.filter((s) => s.t < s.max);
  for (const s of o.sprites) s.t += rd; o.sprites = o.sprites.filter((s) => s.t < s.max);
  for (const l of o.links) l.t += rd; o.links = o.links.filter((l) => l.t < l.max);
  o.flash = Math.max(0, o.flash - rd * 2.2); o.shake *= Math.pow(0.02, rd); o.boost = Math.max(0, o.boost - rd * 0.5);
  draw();
}

const ring = (x, y, r0, r1, max, col, w) => O.rings.push({ x, y, r0, r1, t: 0, max, col, w });
function burst(x, y, n, col, speed, life = 0.9) {
  n = Math.round(n * (LOW ? 0.6 : 1));
  for (let i = 0; i < n && O.parts.length < 700; i++) { const a = Math.random() * TAU, s = speed * (0.25 + Math.random() * 0.9); O.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: life * (0.5 + Math.random() * 0.8), s: 1.6 + Math.random() * 2, col: col || hsl(Math.random() * 360, 100, 66) }); }
}

// Le tap : le noyau éclate en éclats de verre, la chaîne démarre
function fire() {
  const o = O; o.ph = 'crack'; o.pt = 0; o.flash = 1; o.shake = 24; o.boost = 1; o.raysA = 1;
  o.N = o.long ? 12 : 6; o.gap = o.long ? 0.2 : 0.17;
  try { localStorage.setItem(SEEN, '1'); } catch (e) { /* ignore */ }
  A.init(); A.resume(); A.chestCrack(); H.vib([34, 40, 34, 40, 70, 40, 100]);
  ui.tap.classList.remove('on'); ui.skip.classList.add('on');
  for (let k = 0; k < 30; k++) {
    const a = Math.random() * TAU, d = Math.random() * o.R * 0.9, sz = o.R * (0.1 + Math.random() * 0.2), sp = 180 + Math.random() * 560, ang = Math.random() * TAU;
    const pts = [0, 1, 2].map((q) => { const aa = ang + q * 2.1 + Math.random() * 0.6, rr = sz * (0.55 + Math.random() * 0.7); return [Math.cos(aa) * rr, Math.sin(aa) * rr]; });
    o.shards.push({ x: o.cx + Math.cos(a) * d, y: o.cy + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 9, t: 0, max: 0.9 + Math.random() * 0.5, pts, col: hsl(a * 57 + 180, 90, 62) });
  }
  ring(o.cx, o.cy, o.R * 0.5, Math.max(o.W, o.H), 0.8, [255, 255, 255], 0.03); ring(o.cx, o.cy, o.R * 0.5, Math.max(o.W, o.H) * 0.7, 0.6, CY, 0.05);
  burst(o.cx, o.cy, 110, null, o.R * 7, 1);
}
function explode(k) {
  const o = O, m = Math.min(o.W, o.H), a = k * 2.399 + 0.5, rad = Math.min(m * 0.46, m * 0.16 + k * m * 0.03);
  const x = clamp(o.cx + Math.cos(a) * rad, 40, o.W - 40), y = clamp(o.cy + Math.sin(a) * rad * 1.3, 90, o.H - 120), col = CYC[k % 4], ty = 1 + (k % 3);
  ring(x, y, 8, o.R * (1.3 + k * 0.05), 0.55, col, 0.07); ring(x, y, 5, o.R * 0.8, 0.3, [255, 255, 255], 0.05);
  burst(x, y, 26 + k * 2, col, o.R * 4.2, 0.9);
  o.sprites.push({ x, y, r: o.R * 0.4, t: 0, max: 0.34, col, ty });
  o.links.push({ x1: o.prev.x, y1: o.prev.y, x2: x, y2: y, t: 0, max: 0.35, col }); o.prev = { x, y };
  o.shake = Math.max(o.shake, 5 + k * 1.3); o.flash = Math.max(o.flash, 0.22 + k * 0.025); o.boost = Math.max(o.boost, 0.5 + k * 0.04);
  A.boom(k + 1); H.vib(k % 3 === 2 ? [12, 30, 12] : 12);
}
function showTitle() {
  const o = O; o.ph = 'title'; o.pt = 0; o.flash = 1; o.shake = 16; o.boost = 1;
  // le titre ne dépasse jamais de l'écran : on mesure avec la VRAIE police (Orbitron Black), puis on re-mesure
  const fit = () => { if (!O) return; const w0 = ui.title.offsetWidth || 1; ui.title.style.setProperty('--ts', Math.max(0.6, Math.min(1.25, (O.W * 0.86) / w0)).toFixed(3)); };
  fit(); try { document.fonts.load('900 46px Orbitron').then(fit, () => {}); } catch (e) { /* ignore */ } setTimeout(fit, 250);
  ui.title.classList.add('on'); setTimeout(() => ui.tag.classList.add('on'), 450);
  ring(o.cx, o.cy, o.R * 0.3, Math.max(o.W, o.H) * 0.8, 0.9, [255, 255, 255], 0.04); ring(o.cx, o.cy, o.R * 0.3, Math.max(o.W, o.H) * 0.6, 0.8, MG, 0.05);
  burst(o.cx, o.cy, 140, null, o.R * 8, 1.3); A.chestReveal(2); H.vib([14, 60, 14, 60, 14, 60, 22]);
}
function exit() {
  const o = O; o.ph = 'exit'; ui.skip.classList.remove('on');
  document.documentElement.classList.remove('intro-on'); // l'accueil rejoue son entrée en cascade
  try {
    const lg = $('#s-title .logo'), a = ui.title.getBoundingClientRect();
    if (lg && a.width) { const b = lg.getBoundingClientRect(); if (b.width) { const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), s = b.width / a.width, ts = parseFloat(getComputedStyle(ui.title).getPropertyValue('--ts')) || 1.2; const an = ui.title.animate([{ transform: `translate(-50%,-50%) scale(${ts})` }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${ts * s})` }], { duration: 750, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards', id: 'flip' }); } }
  } catch (e) { /* ignore */ }
  ui.tag.classList.remove('on'); ui.root.classList.add('out');
  setTimeout(end, 800);
}
function finish() { if (O && O.ph !== 'exit') exit(); }
function end() {
  if (!O) return; cancelAnimationFrame(O.raf); O = null; active = false;
  ui.root.style.display = 'none'; ui.title.classList.remove('on'); ui.title.getAnimations && ui.title.getAnimations().forEach((a) => a.cancel());
  document.documentElement.classList.remove('intro-on');
}

/* ============================== rendu ============================== */
function orbitRings(x, y, R, t, hc, front) {
  const c = ctx;
  for (let k = 0; k < 3; k++) {
    const rx = R * (1.5 + k * 0.1), ry = rx * (0.28 + k * 0.2), rot = (k - 1) * 0.55 + 0.25 * Math.sin(t * 0.5 + k), col = hsl(hc + k * 60, 100, 68), a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.strokeStyle = rg(col, 0.14); c.lineWidth = R * 0.1; c.beginPath(); c.ellipse(x, y, rx, ry, rot, a0, a1); c.stroke();
    c.strokeStyle = rg(lite(col, 0.4), front ? 0.9 : 0.5); c.lineWidth = R * 0.022; c.stroke();
    const pp = t * (1.5 + k * 0.5) + k * 2.1, sn = Math.sin(pp);
    if ((sn > 0) === front) { const ex = Math.cos(pp) * rx, ey = sn * ry, bx = x + ex * Math.cos(rot) - ey * Math.sin(rot), by = y + ex * Math.sin(rot) + ey * Math.cos(rot), g = c.createRadialGradient(bx, by, 0, bx, by, R * 0.16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, rg(col, 0.8)); g.addColorStop(1, rg(col, 0)); c.fillStyle = g; c.fillRect(bx - R * 0.16, by - R * 0.16, R * 0.32, R * 0.32); }
    c.globalCompositeOperation = 'source-over';
  }
}
function progressArc(o) {
  const c = ctx, n = 28, rad = o.R * 1.95, lit = o.shown * n, ready = o.ph === 'ready';
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i / n) * TAU + 0.03, a1 = a0 + TAU / n - 0.07, f = clamp(lit - i, 0, 1), col = hsl(190 + (i / n) * 150, 100, 64), pulse = ready ? 0.7 + 0.3 * Math.sin(o.t * 5 - i * 0.4) : 1;
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = o.R * 0.07; c.beginPath(); c.arc(o.cx, o.cy, rad, a0, a1); c.stroke();
    if (f > 0) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = rg(col, 0.3 * f * pulse); c.lineWidth = o.R * 0.2; c.beginPath(); c.arc(o.cx, o.cy, rad, a0, a1); c.stroke(); c.strokeStyle = rg(lite(col, 0.5), f * pulse); c.lineWidth = o.R * 0.07; c.stroke(); c.globalCompositeOperation = 'source-over'; }
  }
}
function draw() {
  const o = O, c = ctx, W = o.W, Hh = o.H;
  c.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#04050d'; c.fillRect(0, 0, W, Hh);
  if (o.art) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.globalAlpha = 0.28 + 0.5 * o.boost; const s = Math.max(W, Hh); c.drawImage(o.art, (W - s) / 2, (Hh - s) / 2, s, s); c.globalAlpha = 1; }
  c.globalCompositeOperation = 'lighter';
  [[CY, 0.3, 0.7], [MG, 0.5, 1.1], [VI, 0.2, 0.9]].forEach(([col, px, sp], i) => { const x = W * (px + 0.25 * Math.sin(o.t * 0.35 * sp + i * 2)), y = Hh * (0.35 + 0.3 * Math.cos(o.t * 0.3 * sp + i)), r = Math.max(W, Hh) * 0.55, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rg(col, 0.2 + 0.25 * o.boost)); g.addColorStop(1, rg(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); });
  c.globalCompositeOperation = 'source-over';
  c.save();
  if (o.shake > 0.2) c.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
  // rayons
  if (o.raysA > 0.01) {
    c.globalCompositeOperation = 'lighter';
    const n = 24, len = Math.max(W, Hh) * 1.1, a0 = o.t * 0.4;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + a0, w = 0.035 + 0.02 * Math.sin(o.t * 3 + i); c.fillStyle = rg(hsl(i * (360 / n) + o.t * 80, 100, 62), 0.15 * o.raysA); c.beginPath(); c.moveTo(o.cx, o.cy); c.lineTo(o.cx + Math.cos(a - w) * len, o.cy + Math.sin(a - w) * len); c.lineTo(o.cx + Math.cos(a + w) * len, o.cy + Math.sin(a + w) * len); c.fill(); }
    c.globalCompositeOperation = 'source-over';
  }
  // noyau de verre qui tourne + anneau de progression
  if (o.ph === 'load' || o.ph === 'ready') {
    const hc = 190 + 130 * (0.5 + 0.5 * Math.sin(o.t * 0.8)), col = hsl(hc, 100, 62), ready = o.ph === 'ready', beat = 1 + (ready ? 0.045 : 0.02) * Math.sin(o.t * (ready ? 6 : 3));
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(o.cx, o.cy + o.R * 1.75); c.scale(1, 0.22); // reflet au sol
    const fg = c.createRadialGradient(0, 0, 0, 0, 0, o.R * 1.8); fg.addColorStop(0, rg(col, 0.5)); fg.addColorStop(1, rg(col, 0)); c.fillStyle = fg; c.beginPath(); c.arc(0, 0, o.R * 1.8, 0, TAU); c.fill(); c.restore();
    orbitRings(o.cx, o.cy, o.R * beat, o.t, hc, false);
    Skins.drawOrb(c, 'glass', o.cx, o.cy, o.R * beat, col, 1, o.t, { gl: ready ? 1.4 : 1.1 });
    orbitRings(o.cx, o.cy, o.R * beat, o.t, hc, true);
    progressArc(o);
  }
  // éclats de verre
  for (const s of o.shards) {
    const k = s.t / s.max, e = 1 - (1 - k) ** 2, px = s.x + s.vx * e, py = s.y + s.vy * e + 220 * k * k;
    c.save(); c.translate(px, py); c.rotate(s.rot + s.vr * k); c.globalAlpha = Math.max(0, 1 - k * k);
    c.beginPath(); c.moveTo(s.pts[0][0], s.pts[0][1]); c.lineTo(s.pts[1][0], s.pts[1][1]); c.lineTo(s.pts[2][0], s.pts[2][1]); c.closePath();
    const sg = c.createLinearGradient(s.pts[0][0], s.pts[0][1], s.pts[2][0], s.pts[2][1]); sg.addColorStop(0, rg(lite(s.col, 0.7), 0.75)); sg.addColorStop(1, rg(s.col, 0.25));
    c.fillStyle = sg; c.fill(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.3; c.stroke(); c.restore();
  }
  // liens de chaîne, sphères, ondes, étincelles
  c.globalCompositeOperation = 'lighter';
  for (const l of o.links) { const k = l.t / l.max; c.strokeStyle = rg(l.col, 0.3 * (1 - k)); c.lineWidth = 10 * (1 - k) + 2; c.beginPath(); c.moveTo(l.x1, l.y1); c.lineTo(l.x2, l.y2); c.stroke(); c.strokeStyle = rg(lite(l.col, 0.7), 0.9 * (1 - k)); c.lineWidth = 2.2 * (1 - k) + 0.6; c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  for (const s of o.sprites) { const k = s.t / s.max; c.globalAlpha = 1 - k * k; Skins.drawOrb(c, 'glass', s.x, s.y, s.r * (0.85 + k * 0.5), s.col, s.ty, o.t, { gl: 1 }); c.globalAlpha = 1; }
  c.globalCompositeOperation = 'lighter';
  for (const r of o.rings) { const k = r.t / r.max, e = 1 - (1 - k) ** 3, rad = Math.max(0.1, lerp(r.r0, r.r1, e)), w = Math.max(1.5, Math.abs(r.r1) * r.w * (1 - k)); c.strokeStyle = rg(r.col, 0.22 * (1 - k)); c.lineWidth = w * 2.6; c.beginPath(); c.arc(r.x, r.y, rad, 0, TAU); c.stroke(); c.strokeStyle = rg(lite(r.col, 0.6), 0.9 * (1 - k)); c.lineWidth = w; c.stroke(); }
  c.lineCap = 'round';
  for (const p of o.parts) { const k = p.t / p.max, a = 1 - k, sz = Math.max(0.8, p.s * (1 + (1 - k)) * 0.8), x2 = p.x - p.vx * 0.045, y2 = p.y - p.vy * 0.045; c.strokeStyle = rg(p.col, a * 0.28); c.lineWidth = sz * 3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = rg(lite(p.col, 0.65), a); c.lineWidth = sz; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(x2, y2); c.stroke(); }
  c.globalCompositeOperation = 'source-over';
  c.restore();
  if (o.flash > 0.08) { c.save(); c.globalCompositeOperation = 'lighter'; c.translate(o.cx, o.cy); c.scale(1, 0.05); const g = c.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, Hh)); g.addColorStop(0, rg([255, 255, 255], Math.min(1, o.flash) * 0.9)); g.addColorStop(0.3, rg(CY, o.flash * 0.4)); g.addColorStop(1, rg(CY, 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, Math.max(W, Hh), 0, TAU); c.fill(); c.restore(); }
  if (o.flash > 0.01) { c.fillStyle = `rgba(255,255,255,${Math.min(1, o.flash)})`; c.fillRect(0, 0, W, Hh); }
}
