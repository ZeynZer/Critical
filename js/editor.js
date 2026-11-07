// Critical — Atelier : éditeur de niveaux, analyse en direct, bibliothèque locale, codes et liens de partage.
// Module autonome (comme chest.js) : il injecte son propre HTML/CSS et sa propre sauvegarde (critical.editor.v1).
import * as A from './audio.js';
import { decode, encode, clone, run, remaining, reactors, solve, solveTimedOut, isReactor } from './engine.js';
import { encodeLevel, decodeLevel, group, difficulty, cleanName, LIMITS } from './levelcode.js';
import { WORLDS, mulberry32, levelParams, generate } from './gen.js';

const KEY = 'critical.editor.v1', MAX_LEVELS = 40;
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const H = { vib: () => {}, toast: () => {}, COL: null, play: () => {} };
const FALL = { 1: [77, 243, 255], 2: [255, 79, 216], 3: [255, 194, 71], 7: [150, 255, 90], 8: [255, 125, 60], 9: [255, 85, 85], 11: [205, 220, 255] };
const col = (t) => (H.COL && H.COL[t]) || FALL[t] || FALL[1];

/* ============================== sauvegarde ============================== */
const st = { levels: [], draft: null };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };

/* ============================== outils ============================== */
const TOOLS = [
  { id: 'core', t: 1, n: 'Noyau', d: 'Tire en croix et s\'arrête au premier objet. Touche à nouveau pour ajouter un bouclier.' },
  { id: 'pulsar', t: 2, n: 'Pulsar', d: 'Tire en diagonale.' },
  { id: 'star', t: 3, n: 'Étoile', d: 'Tire dans les 8 directions.' },
  { id: 'laser', t: 7, n: 'Laser', d: 'Son tir perce tout sur sa ligne et sa colonne.' },
  { id: 'fuse', t: 8, n: 'Mèche', d: 'Touchée, elle s\'amorce puis explose à 8 directions après un délai.' },
  { id: 'friend', t: 11, n: 'Cristal', d: 'À épargner : s\'il est touché, c\'est perdu. Le solveur en tient compte.' },
  { id: 'wall', t: 4, n: 'Mur', d: 'Bloque tous les tirs. Touche à nouveau pour l\'enlever.' },
  { id: 'mirror', t: 5, n: 'Miroir', d: 'Dévie les tirs droits. Touche à nouveau pour changer le sens.' },
  { id: 'erase', t: 0, n: 'Gomme', d: 'Efface. Glisse le doigt pour effacer plusieurs cases.' },
];
const hasHp = (t) => isReactor(t);

/* ============================== éditeur : état ============================== */
const S = { w: 6, h: 8, type: new Uint8Array(48), hp: new Uint8Array(48), theme: 0, extra: 2, name: '', editId: null };
let tool = TOOLS[0], defHp = 1, sym = false, showSol = false, an = { st: 'empty' };
let undo = [], redo = [], pops = new Map(), fx = [], rings = [], hover = -1, drag = null;
let mode = 'lib', isOpen = false, raf = 0, T = 0, last = 0, W = 0, H2 = 0, DPR = 1, B = { x: 0, y: 0, cs: 40 };
let anTimer = 0, draftTimer = 0, backTo = 'lib', ui = {}, cv, ctx;
const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, p: Math.random() * 6 }));

const resetBoard = (w, h) => { S.w = w; S.h = h; S.type = new Uint8Array(w * h); S.hp = new Uint8Array(w * h); };
const snap = () => ({ w: S.w, h: S.h, g: encode(S) });
function restore(sn) { const d = decode(sn); S.w = d.w; S.h = d.h; S.type = d.type; S.hp = d.hp; }
const asLevel = () => ({ w: S.w, h: S.h, g: encode(S), sol: an.sol || [], min: an.min || 0, theme: S.theme, extra: S.extra, name: S.name });

/* ============================== placement ============================== */
function place(x, y, first) {
  const i = y * S.w + x, ty = S.type[i], hp = S.hp[i], t = tool.t;
  if (t === 0) { if (!ty) return false; S.type[i] = 0; S.hp[i] = 0; return true; }
  if (first && (ty === t || (t === 5 && ty === 6))) { // même objet : cycle
    if (t === 5) { S.type[i] = ty === 5 ? 6 : 5; return true; }
    if (hasHp(t) && hp < 3) { S.hp[i] = hp + 1; return true; }
    S.type[i] = 0; S.hp[i] = 0; return true;
  }
  const nh = hasHp(t) ? defHp : t === 11 ? 1 : 0;
  if (ty === t && hp === nh) return false;
  S.type[i] = t; S.hp[i] = nh; return true;
}
function apply(i, first) {
  const x = i % S.w, y = (i / S.w) | 0;
  let ch = place(x, y, first);
  if (ch && sym && S.w - 1 - x !== x) { // symétrie horizontale
    const j = y * S.w + (S.w - 1 - x), ty = S.type[i];
    S.type[j] = ty === 5 ? 6 : ty === 6 ? 5 : ty; S.hp[j] = S.hp[i];
    pops.set(j, T);
  }
  if (!ch) return false;
  pops.set(i, T);
  const c = cellC(x, y), k = S.type[i] ? col(S.type[i] === 5 || S.type[i] === 6 ? 7 : S.type[i] === 4 ? 1 : S.type[i]) : [255, 255, 255];
  rings.push({ x: c.x, y: c.y, r0: B.cs * 0.15, r1: B.cs * 0.75, life: 0, max: 0.3, col: k });
  for (let n = 0; n < 7; n++) { const a = Math.random() * 6.283, s = B.cs * (1.2 + Math.random() * 1.6); fx.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.4 + Math.random() * 0.3, col: k }); }
  A.select(); H.vib(6);
  return true;
}
const cellC = (x, y) => ({ x: B.x + (x + 0.5) * B.cs, y: B.y + (y + 0.5) * B.cs });
function cellAt(e) {
  const x = Math.floor((e.clientX - B.x) / B.cs), y = Math.floor((e.clientY - B.y) / B.cs);
  return x >= 0 && y >= 0 && x < S.w && y < S.h ? y * S.w + x : -1;
}

/* ============================== changements / analyse ============================== */
function changed() {
  clearTimeout(anTimer); an = { st: 'busy' }; renderStat(); updateBtns();
  anTimer = setTimeout(runAnalysis, 180);
  clearTimeout(draftTimer); draftTimer = setTimeout(() => { st.draft = { ...snap(), theme: S.theme, extra: S.extra, name: S.name, editId: S.editId }; save(); }, 400);
  updateUndo();
}
function runAnalysis() {
  const s = { w: S.w, h: S.h, type: S.type.slice(), hp: S.hp.slice() }, cnt = remaining(s);
  if (!cnt) { an = { st: 'empty' }; renderStat(); updateBtns(); return; }
  const r = solve(s, 5, 40, 420);
  if (!r) an = { st: solveTimedOut() ? 'slow' : 'none' };
  else {
    let chain = 0, shield = 0;
    for (const i of reactors(s)) chain = Math.max(chain, run(clone(s), i));
    for (let k = 0; k < s.type.length; k++) if (isReactor(s.type[k])) shield += s.hp[k] - 1;
    an = { st: 'ok', min: r.depth, nSol: r.sols.length, sol: r.sols[0], chain, count: cnt, shield };
    an.diff = difficulty(an);
  }
  renderStat(); updateBtns();
}
function renderStat() {
  if (!ui.stat) return;
  const dot = (c) => `<i class="ed-dot" style="background:${c};box-shadow:0 0 10px ${c}"></i>`;
  let h;
  if (an.st === 'empty') h = `${dot('#8a96ad')}<b>Pose des réacteurs pour commencer</b>`;
  else if (an.st === 'busy') h = `${dot('#ffc247')}<b>Analyse…</b>`;
  else if (an.st === 'none') h = `${dot('#ff5c7a')}<b>Aucune solution en 5 taps</b><span class="chip">impossible ou trop dur</span>`;
  else if (an.st === 'slow') h = `${dot('#ffc247')}<b>Trop complexe à vérifier</b><span class="chip">retire un objet</span>`;
  else {
    const pips = Array.from({ length: 5 }, (_, i) => `<u class="${i <= an.diff.lvl ? 'on' : ''}"></u>`).join('');
    h = `${dot('#5dffc0')}<b>Solution en ${an.min} tap${an.min > 1 ? 's' : ''}</b>` +
      `<span class="chip">${an.nSol <= 1 ? 'solution unique ✨' : (an.nSol >= 40 ? '40+' : an.nSol) + ' solutions'}</span>` +
      `<span class="chip">chaîne ×${an.chain}</span><span class="chip ed-diff">${an.diff.label} <em>${pips}</em></span>`;
  }
  ui.stat.innerHTML = h;
}
function updateBtns() {
  const ok = an.st === 'ok';
  for (const b of [ui.test, ui.save]) { b.style.opacity = ok ? 1 : 0.42; b.dataset.ok = ok ? '1' : ''; }
  ui.solBtn.style.display = ok ? '' : 'none';
}
function updateUndo() { ui.undo.style.opacity = undo.length ? 1 : 0.35; ui.redo.style.opacity = redo.length ? 1 : 0.35; }

/* ============================== rendu ============================== */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H2 = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H2 * DPR); cv.style.width = W + 'px'; cv.style.height = H2 + 'px';
  layout();
}
function layout() {
  const r = ui.stage && ui.stage.getBoundingClientRect();
  if (!r || !r.height) return;
  const cs = Math.min((r.width - 36) / S.w, (r.height - 30) / S.h, 84);
  B = { cs, x: r.left + (r.width - cs * S.w) / 2, y: r.top + (r.height - cs * S.h) / 2 };
}
function bg(hue) {
  const g = ctx.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, `hsl(${hue} 55% 6%)`); g.addColorStop(1, `hsl(${hue + 35} 65% 3%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H2);
  ctx.globalCompositeOperation = 'lighter';
  [[0.2, 0.25, 0], [0.85, 0.5, 60], [0.35, 0.9, -50]].forEach((b, i) => {
    const x = (b[0] + Math.sin(T * 0.07 + i * 2) * 0.12) * W, y = (b[1] + Math.cos(T * 0.05 + i) * 0.1) * H2, r = Math.max(W, H2) * 0.55;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `hsla(${hue + b[2]},90%,55%,.16)`); rg.addColorStop(1, `hsla(${hue + b[2]},90%,55%,0)`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H2);
  });
  ctx.fillStyle = '#fff';
  for (const s of stars) { ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(T * s.z + s.p))) * s.z; ctx.fillRect(s.x * W, ((s.y + T * 0.004 * s.z) % 1) * H2, 1.4 * s.z + 0.4, 1.4 * s.z + 0.4); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// Dessin d'un objet (partagé : éditeur, vignettes, palette)
function drawItem(c, ty, hp, cx, cy, cs, t, k = 1, alpha = 1) {
  c.globalAlpha = alpha;
  if (ty === 4) {
    rr(c, cx - cs * 0.4 * k, cy - cs * 0.4 * k, cs * 0.8 * k, cs * 0.8 * k, cs * 0.14); c.fillStyle = 'rgba(8,10,26,.9)'; c.fill(); c.strokeStyle = 'rgba(165,175,255,.4)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(165,175,255,.18)'; c.beginPath(); for (let q = -1; q <= 1; q++) { c.moveTo(cx - cs * 0.3, cy + q * cs * 0.2 + cs * 0.3); c.lineTo(cx + cs * 0.3, cy + q * cs * 0.2 - cs * 0.3); } c.stroke();
  } else if (ty === 5 || ty === 6) {
    const d = cs * 0.34 * k, a = ty === 5 ? -1 : 1;
    rr(c, cx - cs * 0.4, cy - cs * 0.4, cs * 0.8, cs * 0.8, cs * 0.14); c.fillStyle = 'rgba(150,255,235,.08)'; c.fill();
    c.lineCap = 'round'; c.strokeStyle = 'rgba(93,255,192,.3)'; c.lineWidth = cs * 0.13; c.beginPath(); c.moveTo(cx - d, cy + a * d); c.lineTo(cx + d, cy - a * d); c.stroke();
    c.strokeStyle = 'rgba(220,255,248,.95)'; c.lineWidth = cs * 0.045; c.stroke();
  } else if (ty === 11) {
    const r = cs * 0.31 * k, cc2 = col(11), by = cy + Math.sin(t * 3 + cx) * cs * 0.02;
    c.globalCompositeOperation = 'lighter'; let g = c.createRadialGradient(cx, by, r * 0.3, cx, by, r * 2.3); g.addColorStop(0, rgba(cc2, 0.4 * alpha)); g.addColorStop(1, rgba(cc2, 0)); c.fillStyle = g; c.fillRect(cx - r * 2.4, by - r * 2.4, r * 4.8, r * 4.8); c.globalCompositeOperation = 'source-over';
    c.save(); c.translate(cx, by); c.rotate(Math.sin(t * 1.6 + cx) * 0.12); c.beginPath(); c.moveTo(0, -r * 1.2); c.lineTo(r * 0.88, 0); c.lineTo(0, r * 1.2); c.lineTo(-r * 0.88, 0); c.closePath();
    g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, rgba(cc2, 0.75)); g.addColorStop(1, 'rgba(150,170,255,.55)'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.6; c.stroke(); c.restore();
  } else if (ty >= 1) {
    const cl = col(ty), r = cs * 0.29 * k * (1 + 0.025 * Math.sin(t * 2.3 + cx));
    c.globalCompositeOperation = 'lighter'; let g = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.4); g.addColorStop(0, rgba(cl, 0.36 * alpha)); g.addColorStop(1, rgba(cl, 0)); c.fillStyle = g; c.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5); c.globalCompositeOperation = 'source-over';
    c.lineWidth = Math.max(1.5, cs * 0.034);
    for (let q = 0; q < hp; q++) { const rad = r * (1.24 + 0.21 * q); c.strokeStyle = rgba(cl, 0.85 - q * 0.17); c.setLineDash([rad * 0.95, rad * 0.4]); c.lineDashOffset = -t * 22 * (q % 2 ? 1 : -1); c.beginPath(); c.arc(cx, cy, rad, 0, 6.2832); c.stroke(); }
    c.setLineDash([]);
    g = c.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.3, rgba(cl.map((v) => Math.min(255, v + 40)), 0.95)); g.addColorStop(1, rgba(cl.map((v) => v * 0.42), 0.96));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineCap = 'round'; c.lineWidth = Math.max(2, cs * 0.045);
    const L = r * (ty === 3 ? 0.5 : 0.46); c.beginPath();
    if (ty === 7) { const q = L * 0.5; for (const sg of [-1, 1]) { c.moveTo(cx - L, cy + sg * q); c.lineTo(cx + L, cy + sg * q); c.moveTo(cx + sg * q, cy - L); c.lineTo(cx + sg * q, cy + L); } }
    else if (ty === 8) { c.moveTo(cx + L * 0.55, cy); c.arc(cx, cy, L * 0.55, 0, 6.2832); }
    else if (ty !== 2) { c.moveTo(cx - L, cy); c.lineTo(cx + L, cy); c.moveTo(cx, cy - L); c.lineTo(cx, cy + L); }
    if (ty === 2 || ty === 3) { const d = L * 0.72; c.moveTo(cx - d, cy - d); c.lineTo(cx + d, cy + d); c.moveTo(cx + d, cy - d); c.lineTo(cx - d, cy + d); }
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(cx - r * 0.34, cy - r * 0.5, r * 0.3, r * 0.15, -0.6, 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;
}

function drawBoard(dt) {
  const { x, y, cs } = B, w = S.w, h = S.h, ok = an.st === 'ok', bad = an.st === 'none';
  const edge = ok ? [93, 255, 192] : bad ? [255, 92, 122] : [255, 255, 255];
  rr(ctx, x - 12, y - 12, cs * w + 24, cs * h + 24, 26);
  const g = ctx.createLinearGradient(x, y, x + cs * w, y + cs * h); g.addColorStop(0, 'rgba(255,255,255,.11)'); g.addColorStop(0.5, 'rgba(255,255,255,.035)'); g.addColorStop(1, 'rgba(255,255,255,.08)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba(edge, ok || bad ? 0.35 + 0.15 * Math.sin(T * 3) : 0.2); ctx.lineWidth = ok || bad ? 1.6 : 1.2; ctx.stroke();
  for (let r = 0; r < h; r++) for (let c2 = 0; c2 < w; c2++) {
    const i = r * w + c2, hot = i === hover && drag;
    rr(ctx, x + c2 * cs + 2.5, y + r * cs + 2.5, cs - 5, cs - 5, cs * 0.2);
    ctx.fillStyle = hot ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.035)'; ctx.fill(); ctx.strokeStyle = hot ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.stroke();
  }
  if (sym) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(x + cs * w / 2, y - 8); ctx.lineTo(x + cs * w / 2, y + cs * h + 8); ctx.stroke(); ctx.setLineDash([]); }
  let n = 0;
  for (let i = 0; i < S.type.length; i++) {
    const ty = S.type[i]; if (!ty) continue; n++;
    const c = cellC(i % w, (i / w) | 0), p = pops.get(i), k = p === undefined ? 1 : easeOutBack(clamp((T - p) / 0.28, 0, 1));
    drawItem(ctx, ty, S.hp[i], c.x, c.y, cs, T, Math.max(0.01, k));
  }
  if (!n && !drag) { ctx.fillStyle = 'rgba(238,244,255,.5)'; ctx.font = '600 15px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Touche une case pour poser un objet', x + cs * w / 2, y + cs * h / 2); }
  if (drag && hover >= 0 && tool.t) { const c = cellC(hover % w, (hover / w) | 0); drawItem(ctx, tool.t, hasHp(tool.t) ? defHp : tool.t === 11 ? 1 : 0, c.x, c.y, cs, T, 1.05, 0.55); }
  if (showSol && ok) an.sol.forEach((i, q) => {
    const c = cellC(i % w, (i / w) | 0), p = (T * 1.2 + q * 0.3) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - p)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y, cs * (0.34 + p * 0.4), 0, 6.2832); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x + cs * 0.3, c.y - cs * 0.3, cs * 0.17, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#05060f'; ctx.font = `900 ${cs * 0.2}px Orbitron, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(q + 1, c.x + cs * 0.3, c.y - cs * 0.29); ctx.textBaseline = 'alphabetic';
  });
}
function drawFx(dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life += dt; if (r.life >= r.max) { rings.splice(i, 1); continue; } const k = r.life / r.max; ctx.strokeStyle = rgba(r.col, (1 - k) * 0.9); ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, 1 - (1 - k) ** 3), 0, 6.2832); ctx.stroke(); }
  for (let i = fx.length - 1; i >= 0; i--) { const p = fx[i]; p.life += dt; if (p.life >= p.max) { fx.splice(i, 1); continue; } const d = Math.exp(-3.4 * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; const k = p.life / p.max; ctx.fillStyle = rgba(p.col, 1 - k); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * (1 - k * 0.6), 0, 6.2832); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}
function frame(now) {
  if (!isOpen) { raf = 0; return; }
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bg(mode === 'edit' ? WORLDS[S.theme].hue : 215);
  if (mode === 'edit') { layout(); drawBoard(dt); }
  drawFx(dt);
}

/* ============================== vignettes ============================== */
function thumb(cnv, L) {
  const d = decode(L), px = 2, cw = cnv.clientWidth || 140, chh = cnv.clientHeight || 140;
  cnv.width = cw * px; cnv.height = chh * px;
  const c = cnv.getContext('2d'); c.setTransform(px, 0, 0, px, 0, 0); c.clearRect(0, 0, cw, chh);
  const cs = Math.min((cw - 12) / d.w, (chh - 12) / d.h), ox = (cw - cs * d.w) / 2, oy = (chh - cs * d.h) / 2;
  rr(c, ox - 4, oy - 4, cs * d.w + 8, cs * d.h + 8, 12); c.fillStyle = 'rgba(255,255,255,.05)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.stroke();
  for (let i = 0; i < d.type.length; i++) if (d.type[i]) drawItem(c, d.type[i], d.hp[i], ox + ((i % d.w) + 0.5) * cs, oy + (((i / d.w) | 0) + 0.5) * cs, cs, 0);
}
function toolIcon(cnv, t) {
  const px = 2; cnv.width = 40 * px; cnv.height = 40 * px;
  const c = cnv.getContext('2d'); c.setTransform(px, 0, 0, px, 0, 0);
  if (t.id === 'erase') { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.2; c.lineCap = 'round'; rr(c, 9, 14, 22, 14, 4); c.stroke(); c.beginPath(); c.moveTo(14, 28); c.lineTo(28, 14); c.stroke(); return; }
  drawItem(c, t.t, t.t === 11 ? 1 : hasHp(t.t) ? 1 : 0, 20, 20, 27, 0);
}

/* ============================== interface ============================== */
const CSS = `
#ed{position:fixed;inset:0;z-index:9;background:#05060f;display:none}
#ed.on{display:block;animation:fade .3s}
#ed-cv{position:absolute;inset:0;touch-action:none;display:block}
.ed-sc{position:absolute;inset:0;display:none;flex-direction:column;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 0}
.ed-sc.on{display:flex}.ed-sc>*{pointer-events:auto}
.ed-top{display:flex;gap:10px;align-items:center;padding:10px 14px 6px}
.ed-top .t{flex:1;min-width:0;height:46px;border-radius:15px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15}
.ed-top .t b{font-family:var(--disp);font-size:14px;letter-spacing:.8px}.ed-top .t span{font-size:12px;color:var(--dim);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px}
.ed-top .icon svg{width:22px;height:22px}
.ed-stat{margin:4px 14px 0;border-radius:16px;padding:9px 12px;display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;font-size:14px;min-height:46px}
.ed-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.chip{padding:3px 10px;border-radius:11px;background:rgba(255,255,255,.1);font-weight:600;font-size:12px}
.ed-diff em{display:inline-flex;gap:2px;margin-left:5px;vertical-align:middle}.ed-diff u{width:6px;height:10px;border-radius:2px;background:rgba(255,255,255,.2)}.ed-diff u.on{background:var(--am);box-shadow:0 0 8px var(--am)}
.ed-stage{flex:1;min-height:0;pointer-events:none!important}
.ed-dock{padding:10px 12px calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;flex-direction:column;gap:9px;border-radius:26px 26px 0 0;border-bottom:0}
.ed-tools,.ed-pills{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;padding:1px 1px 3px}
.ed-tools::-webkit-scrollbar,.ed-pills::-webkit-scrollbar{display:none}
.ed-tool{flex:0 0 auto;width:58px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0 5px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:11px;font-weight:600;transition:transform .12s}
.ed-tool canvas{width:40px;height:40px}.ed-tool:active{transform:scale(.94)}
.ed-tool.on{border-color:var(--acc,#4df3ff);background:rgba(255,255,255,.14);box-shadow:0 0 18px color-mix(in srgb,var(--acc,#4df3ff) 50%,transparent)}
.ed-hint{font-size:12px;color:var(--dim);min-height:16px;text-align:center;padding:0 6px}
.ed-pill{flex:0 0 auto;height:38px;padding:0 14px;border-radius:19px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14)}
.ed-pill.on{background:linear-gradient(135deg,rgba(77,243,255,.35),rgba(255,79,216,.3));border-color:rgba(255,255,255,.4)}
.ed-pill svg{width:16px;height:16px}
.ed-hp{display:flex;align-items:center;gap:6px;flex:0 0 auto;height:38px;padding:0 6px 0 12px;border-radius:19px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);font-size:13px;font-weight:600}
.ed-hp button{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.1);font-weight:700;font-size:13px}.ed-hp button.on{background:var(--cy);color:#05060f;box-shadow:0 0 12px var(--cy)}
.ed-act{display:flex;gap:10px}.ed-act .big{min-height:52px;flex:1}
.ed-lib-list{flex:1;overflow-y:auto;touch-action:pan-y;padding:4px 16px 120px;display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:start;scrollbar-width:none}
.ed-lib-list::-webkit-scrollbar{display:none}
.ed-card{border-radius:20px;padding:10px;display:flex;flex-direction:column;gap:6px;text-align:left;transition:transform .12s}
.ed-card:active{transform:scale(.97)}
.ed-card canvas{width:100%;aspect-ratio:1/1.05;border-radius:14px;background:rgba(0,0,0,.18)}
.ed-card b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ed-card small{font-size:12px;color:var(--dim);display:flex;justify-content:space-between}.ed-card .st{color:var(--am);letter-spacing:1px}
.ed-empty{grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--dim);line-height:1.6}.ed-empty h3{font-family:var(--disp);color:var(--ink);margin:0 0 8px}
.ed-fab{position:absolute;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);pointer-events:auto}
.ed-code{width:100%;border-radius:16px;padding:12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.16);font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.5;word-break:break-all;text-align:center;user-select:text;-webkit-user-select:text;color:var(--ink)}
textarea.ed-code{height:96px;resize:none;outline:none;touch-action:auto}
.ed-prev{width:100%;height:150px;border-radius:16px;background:rgba(0,0,0,.2)}
.ed-name{width:100%;height:50px;border-radius:16px;padding:0 14px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.2);font:600 16px var(--font);color:var(--ink);outline:none;user-select:text;-webkit-user-select:text;touch-action:auto}
.ed-sw{display:flex;gap:10px;justify-content:center;width:100%}.ed-sw button{width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,255,255,.2);transition:transform .15s}.ed-sw button.on{border-color:#fff;transform:scale(1.18);box-shadow:0 0 16px currentColor}
.ed-lab{width:100%;font-size:12px;color:var(--dim);margin:2px 0 -4px;text-align:left}
.ed-step{display:flex;align-items:center;justify-content:space-between;width:100%;font-weight:600;font-size:16px}.ed-step div{display:flex;align-items:center;gap:14px}.ed-step button{width:44px;height:44px;border-radius:14px;font-size:22px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}.ed-step b{min-width:22px;text-align:center;font-family:var(--disp)}
.ed-err{color:#ff8aa0!important;font-weight:600}.ed-ok{color:#5dffc0!important;font-weight:600}
.ed-row2{display:flex;gap:12px;width:100%}
`;

const HTML = `
<div id="ed"><canvas id="ed-cv"></canvas>
  <section class="ed-sc" id="ed-lib">
    <div class="ed-top"><button class="icon glass" id="ed-lback" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><div class="t glass"><b>ATELIER</b><span id="ed-lsub"></span></div><button class="icon glass" id="ed-lcode" aria-label="Importer un code"><svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg></button></div>
    <div class="ed-lib-list" id="ed-list"></div>
    <div class="ed-fab"><button class="big primary" id="ed-new">Nouveau niveau</button></div>
  </section>
  <section class="ed-sc" id="ed-edit">
    <div class="ed-top"><button class="icon glass" id="ed-eback" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><div class="t glass"><b id="ed-etitle">NOUVEAU NIVEAU</b><span id="ed-esub">Brouillon enregistré automatiquement</span></div>
      <button class="icon glass" id="ed-undo" aria-label="Annuler"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button><button class="icon glass" id="ed-redo" aria-label="Rétablir"><svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/></svg></button></div>
    <div class="ed-stat glass" id="ed-stat"></div>
    <div class="ed-stage" id="ed-stage"></div>
    <div class="ed-dock glass">
      <div class="ed-hint" id="ed-hint"></div>
      <div class="ed-tools" id="ed-tools"></div>
      <div class="ed-pills">
        <div class="ed-hp"><span>Boucliers</span><button data-hp="1" class="on">1</button><button data-hp="2">2</button><button data-hp="3">3</button></div>
        <button class="ed-pill" id="ed-sym"><svg viewBox="0 0 24 24"><path d="M12 3v18M8 7L3 12l5 5M16 7l5 5-5 5"/></svg>Symétrie</button>
        <button class="ed-pill" id="ed-size"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Taille</button>
        <button class="ed-pill" id="ed-sol" style="display:none"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>Solution</button>
        <button class="ed-pill" id="ed-idea"><svg viewBox="0 0 24 24"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>Inspire-moi</button>
        <button class="ed-pill" id="ed-clear"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>Vider</button>
      </div>
      <div class="ed-act"><button class="big glass" id="ed-test">▶ Tester</button><button class="big primary" id="ed-save">Enregistrer</button></div>
    </div>
  </section>
</div>
<div class="modal" id="ed-m-save"><div class="card glass"><h2>Enregistrer</h2>
  <div class="ed-lab">Nom du niveau</div><input class="ed-name" id="ed-nm" maxlength="18" placeholder="Mon niveau" autocomplete="off">
  <div class="ed-lab">Ambiance</div><div class="ed-sw" id="ed-th"></div>
  <div class="ed-lab">Marge de taps</div><div class="seg" style="width:100%"><span></span><div id="ed-mg" style="width:100%"><button data-x="0" style="flex:1">Stricte</button><button data-x="1" style="flex:1">Normale</button><button data-x="2" style="flex:1">Souple</button></div></div>
  <p id="ed-sinfo"></p>
  <div class="btns"><button class="big primary" id="ed-sok">Enregistrer et partager</button><button class="big glass" id="ed-scancel">Annuler</button></div></div></div>
<div class="modal" id="ed-m-share"><div class="card glass"><h2 id="ed-shn">Niveau</h2><canvas class="ed-prev" id="ed-shp"></canvas><p id="ed-shi"></p>
  <div class="ed-code" id="ed-shc"></div>
  <div class="btns"><button class="big primary" id="ed-shcopy">Copier le code</button><button class="big glass" id="ed-shlink">Partager le lien</button><div class="ed-row2"><button class="big glass half" id="ed-shplay">Jouer</button><button class="big glass half" id="ed-shx">Fermer</button></div></div></div></div>
<div class="modal" id="ed-m-import"><div class="card glass"><h2>Entrer un code</h2><p>Colle le code d'un niveau partagé par un ami.</p>
  <textarea class="ed-code" id="ed-imp" placeholder="AVcQA RNTBU cFQQV…" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
  <canvas class="ed-prev" id="ed-imv" style="display:none"></canvas><p id="ed-imi"></p>
  <div class="btns"><div class="ed-row2"><button class="big glass half" id="ed-impaste">Coller</button><button class="big primary half" id="ed-imadd" style="opacity:.4">Ajouter</button></div><button class="big glass" id="ed-implay" style="opacity:.4">Ajouter et jouer</button><button class="big glass" id="ed-imx">Fermer</button></div></div></div>
<div class="modal" id="ed-m-size"><div class="card glass"><h2>Taille de la grille</h2>
  <div class="ed-step"><span>Colonnes</span><div><button data-d="-1" data-k="w">−</button><b id="ed-szw"></b><button data-d="1" data-k="w">+</button></div></div>
  <div class="ed-step"><span>Lignes</span><div><button data-d="-1" data-k="h">−</button><b id="ed-szh"></b><button data-d="1" data-k="h">+</button></div></div>
  <p>Réduire coupe les cases en bas et à droite.</p><div class="btns"><button class="big primary" id="ed-szok">Appliquer</button></div></div></div>
<div class="modal" id="ed-m-sheet"><div class="card glass"><h2 id="ed-sn">Niveau</h2><p id="ed-si"></p><div class="btns" id="ed-sb"></div></div></div>`;

const mkLevelId = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const plural = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;
const hintOf = () => `${tool.n} · ${tool.d}`;

function mount() {
  const sty = document.createElement('style'); sty.textContent = CSS; document.head.appendChild(sty);
  const d = document.createElement('div'); d.innerHTML = HTML; document.body.append(...d.children);
  cv = $('#ed-cv'); ctx = cv.getContext('2d');
  ui = { root: $('#ed'), lib: $('#ed-lib'), edit: $('#ed-edit'), stat: $('#ed-stat'), stage: $('#ed-stage'), undo: $('#ed-undo'), redo: $('#ed-redo'), test: $('#ed-test'), save: $('#ed-save'), solBtn: $('#ed-sol'), hint: $('#ed-hint') };
  // boutons de l'écran titre
  const menu = $('#s-title .menu');
  if (menu) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<button class="big glass half" id="b-atelier"><span>Atelier</span><small id="ed-tsub">Crée tes niveaux</small></button><button class="big glass half" id="b-code"><span>Code</span><small>Importer un niveau</small></button>';
    menu.appendChild(row);
  }
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click('#b-atelier', () => openLib()); click('#b-code', () => openImport());
  click('#ed-lback', close); click('#ed-lcode', () => openImport());
  click('#ed-new', () => newLevel()); click('#ed-eback', () => { flushDraft(); setMode('lib'); renderLib(); });
  ui.undo.addEventListener('click', doUndo); ui.redo.addEventListener('click', doRedo);
  // outils
  const tl = $('#ed-tools');
  TOOLS.forEach((t) => { const b = document.createElement('button'); b.className = 'ed-tool' + (t === tool ? ' on' : ''); b.innerHTML = `<canvas></canvas><span>${t.n}</span>`; b.onclick = () => { tool = t; tl.querySelectorAll('.ed-tool').forEach((x) => x.classList.toggle('on', x === b)); ui.hint.textContent = hintOf(); A.select(); H.vib(6); }; tl.appendChild(b); t.btn = b; });
  document.querySelectorAll('.ed-hp button').forEach((b) => b.onclick = () => { defHp = +b.dataset.hp; document.querySelectorAll('.ed-hp button').forEach((x) => x.classList.toggle('on', x === b)); A.select(); H.vib(6); });
  $('#ed-sym').onclick = (e) => { sym = !sym; e.currentTarget.classList.toggle('on', sym); A.ui(); H.vib(8); };
  $('#ed-sol').onclick = (e) => { showSol = !showSol; e.currentTarget.classList.toggle('on', showSol); A.ui(); H.vib(8); };
  click('#ed-size', openSize); click('#ed-idea', inspire); click('#ed-clear', () => { if (!S.type.some(Boolean)) return; undo.push(snap()); redo = []; S.type.fill(0); S.hp.fill(0); changed(); });
  click('#ed-test', () => { if (ui.test.dataset.ok) playTest(); else H.toast(an.st === 'busy' ? 'Analyse en cours…' : 'Le niveau doit avoir une solution'); });
  click('#ed-save', () => { if (ui.save.dataset.ok) openSave(); else H.toast(an.st === 'busy' ? 'Analyse en cours…' : 'Le niveau doit avoir une solution'); });
  // pointeur
  cv.addEventListener('pointerdown', (e) => {
    if (mode !== 'edit' || !isOpen) return;
    const i = cellAt(e); if (i < 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    drag = { pre: snap(), changed: false, id: e.pointerId }; hover = i;
    if (apply(i, true)) drag.changed = true;
  });
  cv.addEventListener('pointermove', (e) => {
    const i = cellAt(e); if (!drag || e.pointerId !== drag.id) return;
    if (i >= 0 && i !== hover) { hover = i; if (tool.t === 0 || tool.t === 4 || hasHp(tool.t) || tool.t === 5 || tool.t === 11) if (apply(i, false)) drag.changed = true; }
  });
  const up = (e) => { if (!drag || e.pointerId !== drag.id) return; if (drag.changed) { undo.push(drag.pre); if (undo.length > 60) undo.shift(); redo = []; changed(); } drag = null; hover = -1; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => { if (isOpen) resize(); });
  // modales : enregistrer
  const th = $('#ed-th'); WORLDS.forEach((w, i) => { const b = document.createElement('button'); b.style.cssText = `background:${w.col};color:${w.col}`; b.title = w.name; b.onclick = () => { S.theme = i; th.querySelectorAll('button').forEach((x, k) => x.classList.toggle('on', k === i)); A.select(); H.vib(6); }; th.appendChild(b); });
  document.querySelectorAll('#ed-mg button').forEach((b) => b.onclick = () => { S.extra = +b.dataset.x; syncSave(); A.select(); H.vib(6); });
  $('#ed-nm').addEventListener('input', (e) => { S.name = e.target.value; });
  click('#ed-sok', confirmSave); click('#ed-scancel', () => $('#ed-m-save').classList.remove('on'));
  // taille
  document.querySelectorAll('#ed-m-size button[data-k]').forEach((b) => b.onclick = () => { const k = b.dataset.k; sz[k] = clamp(sz[k] + +b.dataset.d, k === 'w' ? LIMITS.minW : LIMITS.minH, k === 'w' ? LIMITS.maxW : LIMITS.maxH); syncSize(); A.select(); H.vib(6); });
  click('#ed-szok', applySize);
  // import
  $('#ed-imp').addEventListener('input', () => checkImport());
  click('#ed-impaste', async () => { try { $('#ed-imp').value = await navigator.clipboard.readText(); checkImport(); } catch (e) { H.toast('Colle le code dans la zone de texte'); } });
  click('#ed-imadd', () => doImport(false)); click('#ed-implay', () => doImport(true)); click('#ed-imx', () => $('#ed-m-import').classList.remove('on'));
  for (const id of ['save', 'share', 'import', 'size', 'sheet']) { const m = $('#ed-m-' + id); m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('on'); }); }
  ui.hint.textContent = hintOf();
  TOOLS.forEach((t) => toolIcon($('canvas', t.btn), t));
  refreshTitle();
}
const sz = { w: 6, h: 8 };

/* ---- navigation ---- */
function setMode(m) { mode = m; ui.lib.classList.toggle('on', m === 'lib'); ui.edit.classList.toggle('on', m === 'edit'); if (m === 'edit') { document.documentElement.style.setProperty('--acc', WORLDS[S.theme].col); setTimeout(layout, 30); } }
function openLib() {
  isOpen = true; ui.root.classList.add('on'); resize(); setMode('lib'); renderLib();
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}
function close() { isOpen = false; ui.root.classList.remove('on'); refreshTitle(); }
export const busy = () => isOpen;
export function back() { // retour depuis une partie test
  if (!isOpen) { isOpen = true; ui.root.classList.add('on'); resize(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
  setMode(backTo); if (backTo === 'lib') renderLib(); else { updateUndo(); renderStat(); updateBtns(); }
  setTimeout(resize, 50);
}
function refreshTitle() { const s = $('#ed-tsub'); if (s) s.textContent = st.levels.length ? plural(st.levels.length, 'niveau') + ' créé' + (st.levels.length > 1 ? 's' : '') : 'Crée tes niveaux'; }
function flushDraft() { clearTimeout(draftTimer); if (an.st === 'busy') runAnalysis(); st.draft = { ...snap(), theme: S.theme, extra: S.extra, name: S.name, editId: S.editId }; save(); }

/* ---- bibliothèque ---- */
function renderLib() {
  const list = $('#ed-list'); list.innerHTML = '';
  $('#ed-lsub').textContent = st.levels.length ? `${plural(st.levels.length, 'niveau')} · partage par code` : 'Crée, teste, partage';
  if (!st.levels.length) { list.innerHTML = '<div class="ed-empty"><h3>Ton atelier est vide</h3>Crée un niveau, prouve qu\'il est faisable grâce au solveur,<br>puis partage-le avec un simple code.</div>'; }
  st.levels.forEach((L) => {
    const b = document.createElement('button'); b.className = 'ed-card glass';
    b.innerHTML = `<canvas></canvas><b></b><small><span>${plural(L.min, 'tap')} · ${['Facile', 'Moyen', 'Difficile', 'Expert', 'Cauchemar'][L.diff || 0]}</span><span class="st">${L.stars ? '★'.repeat(L.stars) : ''}</span></small>`;
    $('b', b).textContent = L.name || 'Sans nom'; b.style.setProperty('--acc', WORLDS[L.theme].col);
    list.appendChild(b); thumb($('canvas', b), L); b.onclick = () => { A.ui(); H.vib(9); sheet(L); };
  });
}
function sheet(L) {
  $('#ed-sn').textContent = L.name || 'Sans nom'; $('#ed-si').textContent = `${plural(L.min, 'tap')} · grille ${L.w}×${L.h}${L.from ? ' · importé' : ''}`;
  const box = $('#ed-sb'); box.innerHTML = '';
  const add = (t, cls, f) => { const b = document.createElement('button'); b.className = 'big ' + cls; b.textContent = t; b.onclick = () => { A.ui(); H.vib(9); $('#ed-m-sheet').classList.remove('on'); f(); }; box.appendChild(b); };
  add('Jouer', 'primary', () => playLevel(L, 'lib'));
  add('Partager', 'glass', () => openShare(L));
  const r = document.createElement('div'); r.className = 'ed-row2'; box.appendChild(r);
  const sub = (t, f, cls = 'glass') => { const b = document.createElement('button'); b.className = 'big half ' + cls; b.textContent = t; b.onclick = () => { A.ui(); H.vib(9); $('#ed-m-sheet').classList.remove('on'); f(); }; r.appendChild(b); };
  sub('Modifier', () => editLevel(L)); sub('Dupliquer', () => { const c = { ...L, id: mkLevelId(), name: cleanName((L.name || 'Niveau') + ' (copie)'), stars: 0 }; st.levels.unshift(c); save(); renderLib(); refreshTitle(); H.toast('Niveau dupliqué'); });
  add('Supprimer', 'glass danger', () => { st.levels = st.levels.filter((x) => x.id !== L.id); save(); renderLib(); refreshTitle(); H.toast('Niveau supprimé'); });
  $('#ed-m-sheet').classList.add('on');
}

/* ---- création / édition ---- */
function startEdit(sn) {
  undo = []; redo = []; pops.clear(); showSol = false; $('#ed-sol').classList.remove('on');
  if (sn.w) { S.w = sn.w; S.h = sn.h; const d = decode(sn); S.type = d.type; S.hp = d.hp; } else resetBoard(6, 8);
  S.theme = sn.theme || 0; S.extra = sn.extra ?? 2; S.name = sn.name || ''; S.editId = sn.editId || null;
  $('#ed-etitle').textContent = S.editId ? 'MODIFIER' : 'NOUVEAU NIVEAU'; $('#ed-esub').textContent = S.name || 'Brouillon enregistré automatiquement';
  setMode('edit'); backTo = 'edit'; changed(); setTimeout(layout, 40);
}
function newLevel() {
  if (st.draft && st.draft.g && !st.draft.editId && decode(st.draft).type.some(Boolean)) { startEdit(st.draft); H.toast('Brouillon repris'); } else startEdit({});
}
function editLevel(L) { startEdit({ ...L, editId: L.id }); }
function doUndo() { if (!undo.length) return; redo.push(snap()); restore(undo.pop()); A.ui(); H.vib(8); changed(); }
function doRedo() { if (!redo.length) return; undo.push(snap()); restore(redo.pop()); A.ui(); H.vib(8); changed(); }
function inspire() {
  const wi = (Math.random() * 6) | 0, k = 2 + ((Math.random() * 6) | 0), rng = mulberry32((Math.random() * 1e9) | 0);
  const P = { ...levelParams(wi, k), tries: 160 }, def = generate(rng, P, 500);
  if (!def) { H.toast('Réessaie !'); return; }
  undo.push(snap()); redo = []; const d = decode(def); S.w = def.w; S.h = def.h; S.type = d.type; S.hp = d.hp; S.theme = wi;
  d.type.forEach((t, i) => { if (t) pops.set(i, T + Math.random() * 0.4); }); A.ui(); H.vib([10, 30, 10]); changed(); H.toast('Une idée pour toi — modifie-la à ta façon');
}
function openSize() { sz.w = S.w; sz.h = S.h; syncSize(); $('#ed-m-size').classList.add('on'); }
function syncSize() { $('#ed-szw').textContent = sz.w; $('#ed-szh').textContent = sz.h; }
function applySize() {
  $('#ed-m-size').classList.remove('on');
  if (sz.w === S.w && sz.h === S.h) return;
  undo.push(snap()); redo = [];
  const t = new Uint8Array(sz.w * sz.h), hp = new Uint8Array(sz.w * sz.h);
  for (let y = 0; y < Math.min(S.h, sz.h); y++) for (let x = 0; x < Math.min(S.w, sz.w); x++) { t[y * sz.w + x] = S.type[y * S.w + x]; hp[y * sz.w + x] = S.hp[y * S.w + x]; }
  S.w = sz.w; S.h = sz.h; S.type = t; S.hp = hp; layout(); changed();
}

/* ---- enregistrer ---- */
function syncSave() {
  document.querySelectorAll('#ed-mg button').forEach((b) => b.classList.toggle('on', +b.dataset.x === S.extra));
  const al = an.min + S.extra;
  $('#ed-sinfo').textContent = `Les joueurs auront ${plural(al, 'tap')} (parfait en ${an.min}).`;
}
function openSave() {
  $('#ed-nm').value = S.name; document.querySelectorAll('#ed-th button').forEach((x, k) => x.classList.toggle('on', k === S.theme)); syncSave();
  $('#ed-m-save').classList.add('on');
}
function confirmSave() {
  S.name = cleanName($('#ed-nm').value) || 'Niveau ' + (st.levels.length + 1);
  const L = { ...asLevel(), diff: an.diff.lvl, id: S.editId || mkLevelId(), stars: 0, created: Date.now() };
  const old = st.levels.find((x) => x.id === L.id);
  if (old) { L.stars = old.g === L.g ? old.stars : 0; L.created = old.created; Object.assign(old, L); } else { if (st.levels.length >= MAX_LEVELS) { H.toast(`Limite de ${MAX_LEVELS} niveaux : supprime-en un`); return; } st.levels.unshift(L); }
  S.editId = L.id; st.draft = null; save(); $('#ed-m-save').classList.remove('on'); $('#ed-etitle').textContent = 'MODIFIER'; $('#ed-esub').textContent = S.name;
  refreshTitle(); H.vib([14, 50, 14]); A.star && A.star(1); openShare(st.levels.find((x) => x.id === L.id), true);
}

/* ---- jouer ---- */
function lvDef(L) { return { w: L.w, h: L.h, g: L.g, min: L.min, sol: L.sol, world: L.theme, extra: L.extra ?? 2, custom: true, name: L.name || 'Niveau', id: L.id }; }
function playLevel(L, from) { backTo = from; isOpen = false; ui.root.classList.remove('on'); H.play(lvDef(L)); }
function playTest() { flushDraft(); const L = { ...asLevel(), id: S.editId || null }; if (!L.name) L.name = 'Test'; playLevel(L, 'edit'); }
export function onResult(lv, starsN) {
  const L = st.levels.find((x) => x.id === lv.id); if (!L) return;
  if (starsN > (L.stars || 0)) { L.stars = starsN; save(); }
}
export function share(lv) { openShare(st.levels.find((x) => x.id === lv.id) || { ...lv, theme: lv.world }); }

/* ---- partager ---- */
let shareL = null;
function codeOf(L) { return encodeLevel({ w: L.w, h: L.h, g: L.g, sol: L.sol, theme: L.theme, extra: L.extra ?? 2, name: L.name }); }
function openShare(L, fresh) {
  shareL = L; const code = codeOf(L);
  $('#ed-shn').textContent = fresh ? 'Niveau enregistré ✓' : (L.name || 'Niveau');
  $('#ed-shi').textContent = `${L.name || 'Niveau'} · ${plural(L.min, 'tap')} · envoie ce code à tes amis`; $('#ed-shc').textContent = group(code);
  $('#ed-m-share').classList.add('on'); thumb($('#ed-shp'), L);
}
const linkOf = (L) => location.href.split('#')[0] + '#n=' + codeOf(L);
async function copy(text, msg) { try { await navigator.clipboard.writeText(text); H.toast(msg); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#ed-shc')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); H.toast('Sélectionné : copie-le manuellement'); } }
function wireShare() {
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click('#ed-shcopy', () => copy(group(codeOf(shareL)), 'Code copié'));
  click('#ed-shlink', async () => { const url = linkOf(shareL), text = `Critical · « ${shareL.name || 'Niveau'} » (${plural(shareL.min, 'tap')}). Réussis-tu ?`; try { if (navigator.share) await navigator.share({ title: 'Critical', text, url }); else await copy(text + '\n' + url, 'Lien copié'); } catch (e) { /* annulé */ } });
  click('#ed-shplay', () => { $('#ed-m-share').classList.remove('on'); playLevel(shareL, mode === 'edit' ? 'edit' : 'lib'); });
  click('#ed-shx', () => { $('#ed-m-share').classList.remove('on'); if (mode === 'lib') renderLib(); });
}

/* ---- importer ---- */
let imp = null;
function checkImport() {
  const v = $('#ed-imp').value.trim(), info = $('#ed-imi'), pv = $('#ed-imv');
  imp = null; const lock = (on) => { $('#ed-imadd').style.opacity = on ? 1 : 0.4; $('#ed-implay').style.opacity = on ? 1 : 0.4; };
  if (!v) { info.textContent = ''; info.className = ''; pv.style.display = 'none'; lock(false); return; }
  const r = decodeLevel(v);
  if (!r.ok) { info.textContent = r.error; info.className = 'ed-err'; pv.style.display = 'none'; lock(false); return; }
  imp = r.level; info.textContent = `« ${imp.name || 'Sans nom'} » · ${plural(imp.min, 'tap')} · ${imp.w}×${imp.h} · vérifié ✓`; info.className = 'ed-ok';
  pv.style.display = 'block'; thumb(pv, imp); lock(true);
}
export function openImport(code) {
  $('#ed-imp').value = code || ''; checkImport(); $('#ed-m-import').classList.add('on');
}
function doImport(andPlay) {
  if (!imp) return;
  let L = st.levels.find((x) => x.g === imp.g && x.w === imp.w && x.h === imp.h);
  if (!L) {
    if (st.levels.length >= MAX_LEVELS) { H.toast(`Limite de ${MAX_LEVELS} niveaux : supprime-en un`); return; }
    const probe = { w: imp.w, h: imp.h, type: decode(imp).type, hp: decode(imp).hp };
    L = { ...imp, id: mkLevelId(), stars: 0, from: 1, created: Date.now(), diff: difficulty0(probe, imp) }; st.levels.unshift(L); save(); refreshTitle();
  }
  $('#ed-m-import').classList.remove('on'); $('#ed-imp').value = ''; imp = null;
  if (andPlay) playLevel(L, 'lib'); else { H.vib([14, 50, 14]); H.toast('Niveau ajouté à ton atelier'); if (!isOpen) openLib(); else renderLib(); }
}
function difficulty0(s, L) { let count = 0, shield = 0, chain = 0; for (const i of reactors(s)) { count++; shield += s.hp[i] - 1; chain = Math.max(chain, run(clone(s), i)); } return difficulty({ min: L.min, nSol: 2, count, shield, chain }).lvl; }

/* ============================== init ============================== */
export function init(opts) {
  Object.assign(H, opts);
  mount(); wireShare(); resetBoard(6, 8);
  const m = location.hash.match(/#n=([^&\s]+)/); // lien de partage
  if (m) { const code = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname + location.search); setTimeout(() => openImport(code), 700); }
  window.__editor = { st, S, get an() { return an; }, get B() { return B; }, TOOLS, decodeLevel };
}
