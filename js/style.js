// Critical — personnalisation du profil : couleurs, cadres d'avatar et titres. Données pures + rendu de l'avatar.
// Le serveur ne stocke que trois petits nombres / clés (accent 0-11, cadre 0-5, titre) ; tout le reste est défini ici.
export const ACCENTS = [ // c = couleur ; lv = niveau requis (les six premières sont offertes)
  { n: 'Cyan', c: [77, 243, 255], lv: 1 }, { n: 'Rose', c: [255, 79, 216], lv: 1 }, { n: 'Violet', c: [165, 120, 255], lv: 1 }, { n: 'Or', c: [255, 194, 71], lv: 1 }, { n: 'Menthe', c: [93, 255, 192], lv: 1 }, { n: 'Corail', c: [255, 120, 100], lv: 1 },
  { n: 'Azur', c: [80, 150, 255], lv: 5 }, { n: 'Lime', c: [175, 255, 90], lv: 10 }, { n: 'Magenta', c: [255, 60, 150], lv: 15 }, { n: 'Ambre', c: [255, 150, 40], lv: 20 }, { n: 'Glace', c: [205, 235, 255], lv: 30 }, { n: 'Aurore', c: [255, 255, 255], lv: 40, rb: 1 },
];
export const FRAMES = [
  { n: 'Simple', lv: 1 }, { n: 'Néon', lv: 1 }, { n: 'Orbite', lv: 5 }, { n: 'Plasma', lv: 12 }, { n: 'Cristal', lv: 20 }, { n: 'Prisme', lv: 35 },
];
// Titres : affichés sous le pseudo. ok(stats) → débloqué ; hint = comment l'obtenir. Déclaratif (comme la vitrine) : le serveur vérifie seulement le format.
export const TITLES = [
  { k: '', n: 'Aucun titre', ok: () => true },
  { k: 'voyageur', n: 'Voyageur', ok: () => true, hint: '' },
  { k: 'fusionneur', n: 'Fusionneur', ok: (s) => s.codex >= 8, hint: 'Découvre 8 astres' },
  { k: 'collectionneur', n: 'Collectionneur', ok: (s) => s.codex >= 25, hint: 'Découvre 25 astres' },
  { k: 'cartographe', n: 'Cartographe stellaire', ok: (s) => s.sector >= 5, hint: 'Atteins le secteur 5' },
  { k: 'architecte', n: 'Architecte de l\'espace', ok: (s) => s.sector >= 9, hint: 'Atteins le secteur 9' },
  { k: 'trou_noir', n: 'Dompteur de trous noirs', ok: (s) => s.tier >= 10, hint: 'Crée un trou noir' },
  { k: 'quasar', n: 'Chasseur de quasars', ok: (s) => s.tier >= 11, hint: 'Crée un quasar' },
  { k: 'galactique', n: 'Maître galactique', ok: (s) => s.tier >= 12, hint: 'Crée une galaxie' },
  { k: 'virtuose', n: 'Virtuose', ok: (s) => s.score >= 50000, hint: 'Marque 50 000 points' },
  { k: 'prodige', n: 'Prodige', ok: (s) => s.score >= 200000, hint: 'Marque 200 000 points' },
  { k: 'etoile', n: 'Étoile montante', ok: (s) => s.level >= 10, hint: 'Niveau 10' },
  { k: 'veteran', n: 'Vétéran', ok: (s) => s.level >= 25, hint: 'Niveau 25' },
  { k: 'legende', n: 'Légende vivante', ok: (s) => s.level >= 50, hint: 'Niveau 50' },
  { k: 'marathon', n: 'Marathonien', ok: (s) => s.playtime >= 36000, hint: '10 h de jeu' },
  { k: 'batisseur', n: 'Bâtisseur du Colosse', ok: (s) => (s.ev || []).includes('batisseur'), hint: 'Événement : la Grande Cuve' },
  { k: 'architecte', n: 'Architecte du Colosse', ok: (s) => (s.ev || []).includes('architecte'), hint: 'Podium de la Grande Cuve' },
  { k: 'colosse', n: 'Colosse atteint', ok: (s) => (s.ev || []).includes('colosse'), hint: 'Objectif de la Grande Cuve atteint' },
  { k: 'createur', n: 'Créateur du jeu', ok: (s) => !!s.admin, hint: 'Réservé', hidden: true },
];
export const titleName = (k) => { const t = TITLES.find((x) => x.k === k); return t && k ? t.n : ''; };
export const accentOf = (i) => ACCENTS[Math.max(0, Math.min(11, i | 0))];
export const accentRgb = (i) => accentOf(i).c.join(',');
export const unlockedAccent = (i, level) => accentOf(i).lv <= level;
export const unlockedFrame = (i, level) => (FRAMES[i] || FRAMES[0]).lv <= level;

const CSS = `
.av{--a:77,243,255;--s:56px;position:relative;flex:none;width:var(--s);height:var(--s);border-radius:50%;display:grid;place-items:center}
.av .core{position:absolute;inset:7%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 50% 28%,rgba(var(--a),.3),rgba(255,255,255,.04) 70%),#0a0c22}
.av .core canvas{display:block;max-width:none}.av .core svg{width:50%;height:50%;opacity:.4;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round}
.av::before,.av::after{content:'';position:absolute;pointer-events:none;border-radius:50%}
.av::before{inset:0;border:2px solid rgba(var(--a),.95);box-shadow:0 0 calc(var(--s)*.22) rgba(var(--a),.55)}
.av.f1::before{box-shadow:0 0 0 calc(var(--s)*.035) rgba(0,0,0,.4),0 0 0 calc(var(--s)*.06) rgba(var(--a),.6),0 0 calc(var(--s)*.4) rgba(var(--a),.85)}
.av.f2::before{border:2px dashed rgba(var(--a),.9);background:radial-gradient(circle at 50% 0,rgb(var(--a)) 0 calc(var(--s)*.045),transparent calc(var(--s)*.06));box-shadow:0 0 calc(var(--s)*.2) rgba(var(--a),.4);animation:av-sp 14s linear infinite}
.av.f3::before{border:0;padding:calc(var(--s)*.05);background:conic-gradient(rgb(var(--a)),rgba(var(--a),.05) 38%,rgb(var(--a)) 62%,#fff 78%,rgb(var(--a)));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:av-sp 4.5s linear infinite;box-shadow:none}
.av.f3::after{inset:calc(var(--s)*-.04);box-shadow:0 0 calc(var(--s)*.35) rgba(var(--a),.55)}
.av.f4::before{border:1.5px solid rgba(255,255,255,.75);box-shadow:inset 0 0 calc(var(--s)*.18) rgba(255,255,255,.35),0 0 calc(var(--s)*.3) rgba(var(--a),.6)}
.av.f4::after{inset:calc(var(--s)*.045);border:1.5px solid rgba(var(--a),.9);box-shadow:0 0 calc(var(--s)*.12) rgba(var(--a),.7)}
.av.f5::before{border:0;padding:calc(var(--s)*.055);background:conic-gradient(#ff5fa8,#ffd45f,#5fffb0,#5fb8ff,#a878ff,#ff5fa8);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:av-sp 5s linear infinite;box-shadow:none}
.av.f5::after{inset:calc(var(--s)*-.04);background:conic-gradient(rgba(255,95,168,.35),rgba(95,184,255,.35),rgba(255,212,95,.35),rgba(255,95,168,.35));filter:blur(calc(var(--s)*.12));z-index:-1;animation:av-sp 5s linear infinite}
.av.rb:not(.f5)::before{animation:av-hue 6s linear infinite}.av.rb:not(.f5):not(.f3):not(.f2)::before{border-image:none}
.av.still::before,.av.still::after{animation:none!important}
@keyframes av-sp{to{transform:rotate(360deg)}}@keyframes av-hue{to{filter:hue-rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.av::before,.av::after{animation:none!important}}
`;
let styled = false;
export function injectStyle() { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
const USER = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.2-6 8-6s6.8 1.8 8 6"/></svg>';
// avatar rond : astre peint dans un cœur sombre, cadre et couleur du joueur. paint(canvas, clé, px, live) vient du jeu.
// o = { key, px, accent, frame, still (pas d'animation, pour les longues listes), paint }
export function avatar(box, o) {
  injectStyle(); const px = o.px || 56; box.className = ('av f' + ((o.frame | 0) % 6) + (accentOf(o.accent).rb ? ' rb' : '') + (o.still ? ' still' : '')); box.style.setProperty('--s', px + 'px'); box.style.setProperty('--a', accentRgb(o.accent)); box.textContent = '';
  const core = document.createElement('div'); core.className = 'core';
  if (o.key && o.paint) { const c = document.createElement('canvas'); c.dataset.key = o.key; o.paint(c, o.key, Math.round(px * 0.86), !o.still); core.append(c); } else core.innerHTML = USER;
  box.append(core); return box;
}
