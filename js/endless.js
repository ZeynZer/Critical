// Critical — mode sans fin « Cascade » : génération des vagues et courbe de vitesse.
// Chaque vague est un mini-puzzle vérifié par le moteur : on sait combien de cases "résolvent tout" en un tap.
// Début : presque toutes les cases marchent. Plus tard : une seule est la bonne, sans toucher aux cristaux amis.
import { clone, run, remaining, solve, reactors } from './engine.js';

export const STAGE_SECONDS = 7; // un palier toutes les 7 s
// Vitesse de chute : exponentielle, plancher très bas (≈ 6,5 lignes/s) : le plafond, c'est ton skill.
export const stepInterval = (d) => Math.max(0.15, 0.95 * Math.pow(0.9, d));
export const spawnEvery = (d) => 3 + Math.max(0, 3 - Math.floor(d / 2.5));

function params(d) {
  const w = { 1: 6 };                                  // noyau
  if (d >= 2) w[2] = Math.min(3, 1 + (d - 2) * 0.5);   // pulsar (diagonales)
  if (d >= 3) w[7] = Math.min(2.2, 0.8 + (d - 3) * 0.3); // laser (perfore tout)
  if (d >= 4.5) w[3] = Math.min(2, (d - 4.5) * 0.5);   // étoile (8 directions)
  if (d >= 5) w[8] = Math.min(2.2, 0.8 + (d - 5) * 0.3); // mèche (explosion retardée)
  const n = d < 1.5 ? [3, 4] : d < 4 ? [4, 5] : d < 7 ? [5, 6] : d < 11 ? [5, 7] : [6, 8];
  const good = d < 2.5 ? [2, 9] : d < 7 ? [1, 3] : d < 11 ? [1, 1] : [0, 1];
  return {
    n, good, w,
    hp: d < 1 ? 1 : d < 4 ? 2 : 3,                      // boucliers : présents dès le début
    sp: Math.min(0.65, 0.2 + d * 0.06),                  // probabilité d'avoir un bouclier
    friend: d < 4 ? 0 : Math.min(0.65, 0.25 + (d - 4) * 0.05), // cristal ami à épargner
  };
}

function pickType(P, rnd) {
  let tot = 0; for (const k in P.w) tot += P.w[k];
  let x = rnd() * tot;
  for (const k in P.w) { x -= P.w[k]; if (x < 0) return +k; }
  return 1;
}

function build(P, cols, rows, rnd) {
  const n = cols * rows, type = new Uint8Array(n), hp = new Uint8Array(n);
  const cells = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let p = 0;
  if (rnd() < P.friend) { type[cells[p]] = 11; hp[cells[p]] = 1; p++; }
  const cnt = P.n[0] + ((rnd() * (P.n[1] - P.n[0] + 1)) | 0);
  for (let k = 0; k < cnt; k++) {
    const i = cells[p++]; type[i] = pickType(P, rnd);
    let h = 1; if (rnd() < P.sp) h++; if (P.hp >= 3 && rnd() < P.sp * 0.6) h++;
    hp[i] = Math.min(P.hp, type[i] === 8 ? Math.min(2, h) : h);
  }
  return { w: cols, h: rows, type, hp };
}
const count = (s, t) => { let c = 0; for (let i = 0; i < s.type.length; i++) if (s.type[i] === t) c++; return c; };

// Renvoie [{x,y,t,hp}] (vague de `rows` lignes).
export function chunk(d, cols, rows = 3, rnd = Math.random) {
  const P = params(d);
  let best = null;
  for (let a = 0; a < 90; a++) {
    let s;
    if (d < 2.5 && rnd() < 0.45) { // ligne simple : n'importe quelle case déclenche tout
      s = { w: cols, h: rows, type: new Uint8Array(cols * rows), hp: new Uint8Array(cols * rows) };
      const y = (rnd() * rows) | 0, k = 3 + ((rnd() * 3) | 0), xs = [...Array(cols).keys()].sort(() => rnd() - 0.5).slice(0, k);
      for (const x of xs) { s.type[y * cols + x] = 1; s.hp[y * cols + x] = rnd() < P.sp ? Math.min(2, P.hp) : 1; }
    } else s = build(P, cols, rows, rnd);
    if (!remaining(s)) continue;
    const friends = count(s, 11);
    let good = 0;
    for (const i of reactors(s)) { const c = clone(s); run(c, i); if (!remaining(c) && count(c, 11) === friends) good++; }
    const inRange = good >= P.good[0] && good <= P.good[1];
    if (!(good > 0 || solve(s, 2, 1))) continue;
    if (inRange) { best = s; break; }
    if (!best) best = s;
  }
  const out = [];
  if (!best) return out;
  for (let i = 0; i < best.type.length; i++) if (best.type[i]) out.push({ x: i % cols, y: (i / cols) | 0, t: best.type[i], hp: best.hp[i] });
  return out;
}
