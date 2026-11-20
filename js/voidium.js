// Critical — la monnaie du jeu : l'Éclat de Voidium (minerai quantique). Pictogramme, vocabulaire et fenêtre « Mon Voidium » (solde, d'où il vient, où il va, derniers mouvements).
// Le solde et le registre vivent dans mine.js (sv.dust, sv.ledger) ; ici, seulement la présentation.
export const NAME = 'Éclat de Voidium', UNIT = 'Voidium';
let n = 0;
export function icon(cls = 'vd-ic') { // cristal violet à facettes ; identifiants de dégradé uniques (plusieurs pictogrammes dans la page)
  const id = 'vd' + ++n;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6d0ff"/><stop offset=".5" stop-color="#9a5cff"/><stop offset="1" stop-color="#4b1fb8"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79bff"/><stop offset="1" stop-color="#5a28d8"/></linearGradient></defs>`
    + `<path d="M12 1.6l6.6 5.4-1.9 14.4H7.3L5.4 7z" fill="url(#${id}a)" stroke="rgba(255,255,255,.55)" stroke-width=".7" stroke-linejoin="round"/>`
    + `<path d="M12 1.6L9.4 7.6 12 21.4l2.6-13.8z" fill="url(#${id}b)" opacity=".9"/><path d="M5.4 7l4 .6M18.6 7l-4 .6" stroke="rgba(255,255,255,.5)" stroke-width=".6" fill="none"/><path d="M9.6 5.2l1.2-2" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".85"/></svg>`;
}
const SOURCES = [['Parties', 'Chaque partie rapporte selon le secteur atteint et le score.'], ['Défis et missions', 'Les objectifs, les trois missions du jour et le défi du jour.'], ['Niveaux', 'Chaque niveau gagné.'], ['Connexion et temps de jeu', 'Récompenses de jours joués et d\'heures de jeu.'], ['Doublons', 'Un décor que tu possèdes déjà est remboursé à moitié.']];
const SINKS = [['Packs d\'astres', 'Étoile, Nébuleuse, Galaxie : de nouvelles cartes à collectionner.'], ['Décors', 'Les ambiances de fond de la cuve.'], ['Emplacements de deck', 'Un emplacement de plus pour équiper une capacité de plus.']];
const fmt = (v) => Math.round(v).toLocaleString('fr-FR');
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'à l\'instant' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} j`; };
export function modal(balance, ledger) {
  const m = document.createElement('div'); m.className = 'modal on';
  const rows = (ledger || []).slice(-8).reverse().map((e) => `<div class="vd-r"><span>${String(e.l || (e.n > 0 ? 'Gain' : 'Dépense')).replace(/[<>&]/g, '')}</span><b class="${e.n > 0 ? 'p' : 'm'}">${e.n > 0 ? '+' : '−'}${fmt(Math.abs(e.n))}</b><small>${ago(e.t)}</small></div>`).join('');
  m.innerHTML = `<div class="card glass vd-card"><div class="vd-hero">${icon('vd-big')}<h2>${NAME}</h2><p class="vd-t">Minerai quantique</p><div class="vd-bal"><b>${fmt(balance)}</b> ${UNIT}</div></div>`
    + `<p class="vd-lore">Un cristal né de la fusion des astres : plus ton univers est dense, plus il en libère. C'est la seule monnaie du jeu.</p>`
    + `<h3>D'où il vient</h3>${SOURCES.map(([a, b]) => `<div class="vd-l"><b>${a}</b><small>${b}</small></div>`).join('')}<h3>Où il va</h3>${SINKS.map(([a, b]) => `<div class="vd-l"><b>${a}</b><small>${b}</small></div>`).join('')}`
    + `<h3>Derniers mouvements</h3>${rows || '<p class="vd-lore">Aucun mouvement pour l\'instant.</p>'}<div class="btns"><button class="big primary">Fermer</button></div></div>`;
  m.addEventListener('click', (e) => { if (e.target === m || e.target.tagName === 'BUTTON') m.remove(); }); document.body.append(m);
}
export const CSS = `.vd-ic{width:22px;height:22px;flex:none;filter:drop-shadow(0 0 6px rgba(150,90,255,.7))}.vd-big{width:84px;height:84px;filter:drop-shadow(0 0 22px rgba(150,90,255,.85));animation:vd-fl 3.2s ease-in-out infinite}@keyframes vd-fl{50%{transform:translateY(-4px) rotate(2deg)}}
.vd-card{max-width:420px;align-items:stretch;gap:6px}.vd-hero{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}.vd-hero h2{margin:4px 0 0}.vd-t{margin:0;font:700 11px var(--disp);letter-spacing:.16em;text-transform:uppercase;color:#c79bff}
.vd-bal{margin-top:4px;font:600 14px var(--font);color:rgba(255,255,255,.7)}.vd-bal b{font:900 30px var(--disp);color:#fff;text-shadow:0 0 18px rgba(150,90,255,.8)}.vd-lore{margin:4px 0;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.65);text-align:center}
.vd-card h3{margin:10px 0 2px;font:800 11px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#c79bff}.vd-l{display:flex;flex-direction:column;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)}.vd-l b{font-size:13px}.vd-l small{font-size:11.5px;color:rgba(255,255,255,.55)}
.vd-r{display:flex;align-items:baseline;gap:8px;padding:5px 0;font-size:12.5px}.vd-r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vd-r b.p{color:#5dffc0}.vd-r b.m{color:#ff8aa0}.vd-r small{font-size:10.5px;color:rgba(255,255,255,.45);min-width:44px;text-align:right}`;
