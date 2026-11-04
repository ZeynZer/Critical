// Critical — moteur de simulation déterministe + solveur.
// Aucune dépendance au DOM : tourne dans le navigateur ET dans Node (génération/test des niveaux).

export const T = { E: 0, CORE: 1, PULSAR: 2, STAR: 3, WALL: 4, MA: 5, MB: 6 };
const O4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const D4 = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
const DIRS = { 1: O4, 2: D4, 3: [...O4, ...D4] };
const MAX_LIFE = 40; // garde-fou contre les boucles de miroirs

// Encodage compact d'un niveau : 1 caractère par case
//  . vide | 1 2 3 noyau (pv) | p q r pulsar (pv) | s t u étoile (pv) | # mur | / \ miroirs
const CH = { '.': [0, 0], '1': [1, 1], '2': [1, 2], '3': [1, 3], p: [2, 1], q: [2, 2], r: [2, 3], s: [3, 1], t: [3, 2], u: [3, 3], '#': [4, 0], '/': [5, 0], '\\': [6, 0] };
const REV = {};
for (const k in CH) REV[CH[k][0] * 4 + CH[k][1]] = k;

export const isReactor = (t) => t >= 1 && t <= 3;

export function decode(def) {
  const n = def.w * def.h, type = new Uint8Array(n), hp = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const c = CH[def.g[i]]; type[i] = c[0]; hp[i] = c[1]; }
  return { w: def.w, h: def.h, type, hp };
}
export function encode(s) {
  let g = '';
  for (let i = 0; i < s.type.length; i++) g += REV[s.type[i] * 4 + s.hp[i]];
  return g;
}
export const clone = (s) => ({ w: s.w, h: s.h, type: s.type.slice(), hp: s.hp.slice() });
export function remaining(s) { let n = 0; for (let i = 0; i < s.type.length; i++) if (isReactor(s.type[i])) n++; return n; }
export function reactors(s) { const r = []; for (let i = 0; i < s.type.length; i++) if (isReactor(s.type[i])) r.push(i); return r; }

function detonate(s, i, out, sim) {
  const t = s.type[i], x = i % s.w, y = (i / s.w) | 0;
  s.type[i] = 0; s.hp[i] = 0; sim.booms++;
  for (const d of DIRS[t]) out.push({ x, y, dx: d[0], dy: d[1], c: t, life: 0 });
  return { x, y, i, t, n: sim.booms };
}

// Démarre une réaction en tapant la case i. `rec` = true pour obtenir les événements (rendu).
export function begin(s, i, rec) {
  const sim = { shots: [], booms: 0, tick: 0, rec: !!rec };
  const b = detonate(s, i, sim.shots, sim);
  sim.first = b;
  return sim;
}

// Avance d'un tick. Tous les impacts d'un tick sont appliqués AVANT les détonations :
// le résultat ne dépend donc pas de l'ordre de traitement des tirs.
export function step(s, sim) {
  const { w, h, type: ty, hp } = s;
  const next = [], hits = [], mv = sim.rec ? [] : null, boom = sim.rec ? [] : null;
  for (const sh of sim.shots) {
    const fx = sh.x, fy = sh.y, nx = sh.x + sh.dx, ny = sh.y + sh.dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) { if (mv) mv.push({ fx, fy, tx: nx, ty: ny, c: sh.c, end: 1 }); continue; }
    const i = ny * w + nx, c = ty[i];
    let end = 0;
    if (c === 0 || (c >= 5 && sh.dx && sh.dy)) { sh.x = nx; sh.y = ny; }
    else if (c <= 3) { hp[i]--; hits.push(i); end = 2; }
    else if (c === 4) end = 3;
    else {
      const a = c === 5 ? (-sh.dy) | 0 : sh.dy, b = c === 5 ? (-sh.dx) | 0 : sh.dx;
      sh.dx = a; sh.dy = b; sh.x = nx; sh.y = ny;
    }
    if (mv) mv.push({ fx, fy, tx: nx, ty: ny, c: sh.c, end, i });
    if (!end && ++sh.life < MAX_LIFE) next.push(sh);
  }
  if (hits.length) {
    const uniq = [...new Set(hits)].sort((a, b) => a - b);
    for (const i of uniq) if (isReactor(ty[i]) && hp[i] <= 0) { const b = detonate(s, i, next, sim); if (boom) boom.push(b); }
  }
  sim.shots = next; sim.tick++;
  return mv ? { mv, hits, boom } : null;
}
export const done = (sim) => sim.shots.length === 0;

// Résout une réaction complète (sans événements). Renvoie le nombre de détonations.
export function run(s, i) {
  const sim = begin(s, i, false);
  let g = 0;
  while (!done(sim) && g++ < 400) step(s, sim);
  return sim.booms;
}

const key = (s) => { let k = ''; for (let i = 0; i < s.type.length; i++) k += String.fromCharCode(48 + s.type[i] * 4 + s.hp[i]); return k; };

// Solveur : cherche les séquences de taps les plus courtes qui nettoient le plateau.
export function solve(s0, maxDepth, limit = 30) {
  for (let d = 1; d <= maxDepth; d++) {
    const sols = [], seen = new Set();
    (function dfs(s, left, path) {
      if (sols.length >= limit) return;
      const k = left + key(s);
      if (seen.has(k)) return;
      seen.add(k);
      for (const i of reactors(s)) {
        const c = clone(s);
        run(c, i);
        path.push(i);
        if (left === 1) { if (remaining(c) === 0) sols.push(path.slice()); }
        else if (remaining(c) > 0) dfs(c, left - 1, path);
        path.pop();
        if (sols.length >= limit) return;
      }
    })(s0, d, []);
    if (sols.length) return { depth: d, sols };
  }
  return null;
}

// Trajectoires prévues d'un reactor (aperçu visuel quand on maintient le doigt).
export function trace(s, i) {
  const t = s.type[i], x0 = i % s.w, y0 = (i / s.w) | 0, out = [];
  for (const d of DIRS[t]) {
    let x = x0, y = y0, dx = d[0], dy = d[1];
    const pts = [[x, y]]; let hit = null;
    for (let life = 0; life < MAX_LIFE; life++) {
      x += dx; y += dy;
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) { pts.push([x, y]); break; }
      const c = s.type[y * s.w + x];
      pts.push([x, y]);
      if (c >= 1 && c <= 4) { if (c <= 3) hit = [x, y]; break; }
      if (c >= 5 && !(dx && dy)) { const a = c === 5 ? (-dy) | 0 : dy, b = c === 5 ? (-dx) | 0 : dx; dx = a; dy = b; }
    }
    out.push({ pts, hit });
  }
  return out;
}
