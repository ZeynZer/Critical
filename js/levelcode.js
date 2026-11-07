// Critical — codes de partage de niveaux (aucune dépendance au DOM, testable dans Node).
// Un code = en-tête + grille compressée + solution + nom, en base64 « maison », avec somme de contrôle.
import { decode, encode, clone, run, remaining } from './engine.js';

const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._';
const chk = (b) => { let a = 0x5a; for (const v of b) a = (a * 31 + v) & 255; return a; };
function b64(bytes) {
  let o = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    o += AL[(n >> 18) & 63] + AL[(n >> 12) & 63] + (i + 1 < bytes.length ? AL[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? AL[n & 63] : '');
  }
  return o;
}
function unb64(s) {
  const out = []; let acc = 0, bits = 0;
  for (const ch of s) { const v = AL.indexOf(ch); if (v < 0) return null; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; } }
  return out;
}
export const group = (c) => (c.match(/.{1,5}/g) || []).join(' ');
export const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18);

export const LIMITS = { minW: 4, maxW: 8, minH: 5, maxH: 10 };

// L = { w, h, g, sol, theme, extra, name }
export function encodeLevel(L) {
  const s = decode(L), n = s.type.length;
  const bytes = [1, (L.w << 4) | L.h, (L.theme & 7) | (((L.extra ?? 2) & 3) << 3), L.sol.length, ...L.sol];
  let z = 0;
  for (let i = 0; i < n; i++) {
    const v = s.type[i] * 4 + s.hp[i];
    if (!v) { if (++z === 63) { bytes.push(0x40 | z); z = 0; } } else { if (z) { bytes.push(0x40 | z); z = 0; } bytes.push(v); }
  }
  if (z) bytes.push(0x40 | z);
  const nb = [...new TextEncoder().encode(cleanName(L.name))].slice(0, 30);
  bytes.push(nb.length, ...nb);
  bytes.push(chk(bytes));
  return b64(bytes);
}

const OK_HP = { 0: [0], 1: [1, 2, 3], 2: [1, 2, 3], 3: [1, 2, 3], 4: [0], 5: [0], 6: [0], 7: [1, 2, 3], 8: [1, 2, 3], 11: [1] };
const fr = (s) => { let c = 0; for (const t of s.type) if (t === 11) c++; return c; };

// Vérifie qu'un niveau est réellement soluble avec la solution fournie (le code ne peut pas "tricher").
export function verify(L) {
  const s = decode(L);
  if (!remaining(s)) return false;
  const f = fr(s); const c = clone(s);
  for (const i of L.sol) { if (i < 0 || i >= c.type.length || c.type[i] < 1) return false; run(c, i); }
  return remaining(c) === 0 && fr(c) === f;
}

// Renvoie { ok:true, level } ou { ok:false, error }
export function decodeLevel(input) {
  let code = String(input || '');
  const m = code.match(/#n=([^\s]+)/); if (m) code = decodeURIComponent(m[1]);
  code = code.replace(/\s+/g, '');
  if (code.length < 8) return { ok: false, error: 'Code trop court.' };
  const b = unb64(code);
  if (!b) return { ok: false, error: 'Code invalide : caractère inconnu.' };
  const last = b.pop();
  if (chk(b) !== last) return { ok: false, error: 'Code incorrect (faute de frappe ?).' };
  let p = 0;
  if (b[p++] !== 1) return { ok: false, error: 'Version de code inconnue.' };
  const w = b[p] >> 4, h = b[p++] & 15, meta = b[p++], solLen = b[p++];
  if (w < LIMITS.minW || w > LIMITS.maxW || h < LIMITS.minH || h > LIMITS.maxH) return { ok: false, error: 'Taille de niveau non valide.' };
  if (solLen < 1 || solLen > 6) return { ok: false, error: 'Solution invalide.' };
  const sol = b.slice(p, p + solLen); p += solLen;
  const n = w * h, type = new Uint8Array(n), hp = new Uint8Array(n); let i = 0;
  while (i < n) {
    const v = b[p++]; if (v === undefined) return { ok: false, error: 'Code tronqué.' };
    if (v & 0x40) { const r = v & 63; if (!r) return { ok: false, error: 'Code corrompu.' }; i += r; }
    else { const t = v >> 2, h2 = v & 3; if (!OK_HP[t] || !OK_HP[t].includes(h2)) return { ok: false, error: 'Objet inconnu dans ce code.' }; type[i] = t; hp[i] = h2; i++; }
  }
  if (i !== n) return { ok: false, error: 'Code corrompu.' };
  const nl = b[p++] || 0, name = cleanName(new TextDecoder().decode(new Uint8Array(b.slice(p, p + nl))));
  const L = { w, h, g: encode({ type, hp }), sol, min: sol.length, theme: meta & 7, extra: (meta >> 3) & 3, name };
  if (L.theme > 5) L.theme = 0;
  if (!verify(L)) return { ok: false, error: 'Ce niveau n\'est pas soluble : code refusé.' };
  return { ok: true, level: L };
}

// Estimation de difficulté (0..4) à partir de l'analyse du solveur.
export function difficulty(an) {
  const sc = an.min + (an.nSol <= 1 ? 1.2 : an.nSol <= 3 ? 0.6 : 0) + an.count * 0.09 + an.shield * 0.12 - Math.min(an.chain, 8) * 0.05;
  const lvl = sc < 2.3 ? 0 : sc < 3.5 ? 1 : sc < 4.8 ? 2 : sc < 6 ? 3 : 4;
  return { score: sc, lvl, label: ['Facile', 'Moyen', 'Difficile', 'Expert', 'Cauchemar'][lvl] };
}
