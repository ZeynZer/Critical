// Critical — mode sans fin « Cascade » : génération de vagues qui tombent.
// Chaque vague est un mini-puzzle vérifié par le moteur : on sait combien de cases "résolvent tout" en un tap.
// Début : presque toutes les cases marchent. Plus tard : une seule case est la bonne, ou il faut un ordre précis.
import { clone, run, remaining, solve } from './engine.js';

export const stepInterval = (d) => Math.max(0.42, 1.1 - d * 0.055);
export const spawnEvery = (d) => 3 + Math.max(0, 3 - Math.floor(d / 2.5));

function params(d) {
  if (d < 2.5) return { n: [3, 4], good: [2, 9], hp: 1, pul: 0, star: 0, walls: 0, mir: 0 };
  if (d < 6) return { n: [4, 6], good: [1, 3], hp: 2, pul: Math.min(0.5, (d - 2.5) / 7), star: 0, walls: 0, mir: 0 };
  if (d < 10) return { n: [5, 7], good: [1, 1], hp: 3, pul: 0.4, star: Math.min(0.3, (d - 6) / 12), walls: 0.5, mir: 0 };
  return { n: [6, 8], good: [0, 1], hp: 3, pul: 0.4, star: 0.3, walls: 0.6, mir: 0.5 };
}

function build(P, cols, rows, rnd) {
  const n = cols * rows, type = new Uint8Array(n), hp = new Uint8Array(n);
  const cells = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let p = 0;
  if (rnd() < P.walls) type[cells[p++]] = 4;
  if (rnd() < P.mir) type[cells[p++]] = rnd() < 0.5 ? 5 : 6;
  const cnt = P.n[0] + ((rnd() * (P.n[1] - P.n[0] + 1)) | 0);
  for (let k = 0; k < cnt; k++) {
    const r = rnd(), i = cells[p++];
    type[i] = r < P.star ? 3 : r < P.star + P.pul ? 2 : 1;
    hp[i] = 1 + ((rnd() * rnd() * P.hp) | 0); if (hp[i] > P.hp) hp[i] = P.hp;
  }
  return { w: cols, h: rows, type, hp };
}

// Renvoie [{x,y,t,hp}] à poser dans les `rows` premières lignes.
export function chunk(d, cols, rows = 3, rnd = Math.random) {
  const P = params(d);
  let best = null;
  for (let a = 0; a < 90; a++) {
    let s;
    if (d < 2.5 && rnd() < 0.5) { // ligne simple : n'importe quelle case déclenche tout
      s = { w: cols, h: rows, type: new Uint8Array(cols * rows), hp: new Uint8Array(cols * rows) };
      const y = (rnd() * rows) | 0, k = 3 + ((rnd() * 3) | 0), xs = [...Array(cols).keys()].sort(() => rnd() - 0.5).slice(0, k);
      for (const x of xs) { s.type[y * cols + x] = 1; s.hp[y * cols + x] = 1; }
    } else s = build(P, cols, rows, rnd);
    if (!remaining(s)) continue;
    let good = 0;
    for (let i = 0; i < s.type.length; i++) if (s.type[i] >= 1 && s.type[i] <= 3) { const c = clone(s); run(c, i); if (!remaining(c)) good++; }
    const inRange = good >= P.good[0] && good <= P.good[1];
    const solvable = good > 0 || solve(s, 2, 1);
    if (!solvable) continue;
    if (inRange) { best = s; break; }
    if (!best) best = s;
  }
  const out = [];
  if (!best) return out;
  for (let i = 0; i < best.type.length; i++) if (best.type[i]) out.push({ x: i % cols, y: (i / cols) | 0, t: best.type[i], hp: best.hp[i] });
  return out;
}
