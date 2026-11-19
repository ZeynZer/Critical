// Critical — onglet Packs : boutique, pack offert du jour, probabilités et garanties, ouverture (animation : js/packfx.js).
// api : { info(), open(id) -> tirage | null, preview(rareté) -> tirage, free(), paintCard, sfx, vib, toast, refresh() }
import { PACKS, RAR } from './packs.js';
import * as FX from './packfx.js';
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const RC = ['#96aad7', '#4df3ff', '#be78ff', '#ffcd50', '#ff785a', '#ffffff'];
const CSS = `
.pk-list{display:flex;flex-direction:column;gap:12px;width:100%}
.pk-free{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:22px;background:linear-gradient(135deg,rgba(93,255,192,.2),rgba(77,243,255,.1));border:1px solid rgba(93,255,192,.5);box-shadow:0 0 22px rgba(93,255,192,.25)}.pk-free b{flex:1;font:700 13px/1.3 var(--font)}.pk-free small{display:block;color:rgba(255,255,255,.65);font-weight:500;font-size:11.5px}
.pk-btn{height:42px;padding:0 16px;border-radius:21px;border:1px solid rgba(255,255,255,.35);background:linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.34));color:#fff;font:800 12px var(--disp);letter-spacing:.05em;white-space:nowrap;flex:none}.pk-btn:active{transform:scale(.94)}.pk-btn.g{background:rgba(255,255,255,.08)}.pk-btn:disabled{opacity:.4}
.pk-card{position:relative;display:flex;align-items:center;gap:12px;padding:12px 12px 12px 10px;border-radius:26px;background:radial-gradient(120% 90% at 0 0,color-mix(in srgb,var(--c) 28%,transparent),rgba(255,255,255,.03));border:1px solid color-mix(in srgb,var(--c) 55%,transparent);box-shadow:0 0 26px color-mix(in srgb,var(--c) 22%,transparent)}
.pk-art{flex:none;width:64px;height:64px;animation:pkf 4.5s ease-in-out infinite}.pk-art canvas{width:64px;height:64px;display:block}@keyframes pkf{50%{transform:translateY(-4px) rotate(3deg)}}
.pk-tx{flex:1;min-width:0}.pk-tx b{display:block;font:800 12px var(--disp);letter-spacing:.02em;text-transform:uppercase}.pk-tx small{display:block;margin-top:3px;font-size:11px;line-height:1.3;color:rgba(255,255,255,.65)}.pk-tx em{display:block;margin-top:4px;font:700 9px/1.3 var(--disp);font-style:normal;color:var(--c)}
.pk-st{position:absolute;top:8px;right:12px;font:800 10px var(--disp);color:#5dffc0}
.pk-act{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.pk-link{align-self:center;background:none;border:0;color:rgba(255,255,255,.6);font:600 12.5px var(--font);text-decoration:underline;padding:6px}
#pk-od .card{max-width:430px;align-items:stretch}#pk-od h2{text-align:center;margin:0}#pk-od table{width:100%;border-collapse:collapse;font-size:12.5px}#pk-od th,#pk-od td{padding:6px 4px;text-align:right}#pk-od th:first-child,#pk-od td:first-child{text-align:left}#pk-od th{font:700 10px var(--disp);color:rgba(255,255,255,.55);letter-spacing:.05em}#pk-od td:first-child{font-weight:700}#pk-od p{margin:0;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.7);text-align:left}
@media (prefers-reduced-motion:reduce){.pk-art{animation:none}}
`;
function emblem(cv, col) { // pastille d'un pack : petite galaxie dessinée une fois
  const S = 76, d = Math.min(window.devicePixelRatio || 1, 2); cv.width = cv.height = S * d; const x = cv.getContext('2d'); x.scale(d, d); const c = S / 2; x.globalCompositeOperation = 'lighter';
  let g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, `rgba(${col},.9)`); g.addColorStop(0.5, `rgba(${col},.22)`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) { const t = ((i * 0.6180339) % 1) ** 0.8, a = (i % 3) * 2.094 + t * 4.2, r = 3 + t * 31, px = c + Math.cos(a) * r, py = c + Math.sin(a) * r * 0.94; g = x.createRadialGradient(px, py, 0, px, py, 2.4); g.addColorStop(0, i % 4 ? `rgba(${col},.95)` : 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - 3, py - 3, 6, 6); }
  g = x.createRadialGradient(c, c, 0, c, c, 9); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(c - 9, c - 9, 18, 18);
}
export function mount(page, api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  const list = make('div', 'pk-list'); page.append(list); let sig = '';
  const lowFx = (navigator.hardwareConcurrency || 4) <= 4;
  const run = (res, id, preview) => FX.play({
    result: res, names: { pack: PACKS[id].n, rar: RAR }, paintCard: api.paintCard, onView: api.view, sfx: api.sfx, vib: api.vib, quick: api.quick && api.quick(), lowFx,
    canAgain: () => { if (preview) return { ok: false, label: 'Aperçu administrateur' }; const i = api.info(), n = i.stock[id]; return n > 0 ? { ok: true, label: `Ouvrir un autre (${n})` } : i.dust >= PACKS[id].cost ? { ok: true, label: `Ouvrir un autre · ${fmt(PACKS[id].cost)}` } : { ok: false, label: 'Plus assez d\'Éclats' }; },
    onDone: (act) => { sig = ''; api.refresh(); if (act === 'again') start(id); },
  });
  function start(id) { const res = api.open(id); if (!res) return api.toast(`Il te faut ${fmt(PACKS[id].cost)} Éclats`); sig = ''; run(res, id, false); }
  function odds() {
    const m = make('div', 'modal on', '<div class="card glass"><h2>Probabilités</h2><table><tr><th></th>' + Object.values(PACKS).map((p) => `<th>${p.n.replace('Pack ', '')}</th>`).join('') + '</tr>' + RAR.map((r, i) => `<tr><td style="color:${RC[i]}">${r}</td>` + Object.values(PACKS).map((p) => `<td>${p.odds[i].toLocaleString('fr-FR')} %</td>`).join('') + '</tr>').join('') + '</table>'
      + '<p>Probabilités par astre (5 astres par pack). Garanties : ' + Object.values(PACKS).map((p) => `<b>${p.n}</b> : ${RAR[p.min]} minimum${p.min ? '' : ' (aucun minimum)'} · un épique au moins tous les ${p.pity[0]} packs · un légendaire au moins tous les ${p.pity[1]} packs`).join(' ; ') + '.</p><p>Les doublons ne sont jamais perdus : chaque exemplaire compte pour la Fusion. Le tirage est décidé avant l\'animation, qui ne fait que le raconter : ses indices sont toujours vrais.</p><div class="btns"><button class="big primary">Fermer</button></div></div>'); m.id = 'pk-od';
    m.addEventListener('click', (e) => { if (e.target === m || e.target.tagName === 'BUTTON') m.remove(); }); document.body.append(m);
  }
  const refresh = () => {
    const i = api.info(), s = JSON.stringify([i.stock, i.pity, i.free, Math.floor(i.dust / 100)]); if (s === sig) return; sig = s; list.textContent = '';
    if (i.free) { const f = make('div', 'pk-free', '<b>Pack offert du jour<small>Un Pack Étoile, sans condition.</small></b>'), b = make('button', 'pk-btn', 'Récupérer'); b.addEventListener('click', () => { api.sfx.link(2, 3); api.vib(15); api.free(); api.toast('Pack Étoile ajouté !'); sig = ''; refresh(); }); f.append(b); list.append(f); }
    for (const [id, pk] of Object.entries(PACKS)) {
      const n = i.stock[id] | 0, p = i.pity[id] || {}, can = n > 0 || i.dust >= pk.cost, left = Math.max(1, pk.pity[0] - (p.e | 0)), c = pk.col.join(',');
      const card = make('div', 'pk-card'); card.style.setProperty('--c', `rgb(${c})`);
      const art = make('div', 'pk-art'), cv = document.createElement('canvas'); emblem(cv, c); art.append(cv);
      const tx = make('div', 'pk-tx', `<b>${pk.n}</b><small>5 astres · ${pk.min ? RAR[pk.min] + ' minimum' : 'tous les astres du jeu'}</small><em>Épique garanti dans ${left} pack${left > 1 ? 's' : ''} au plus</em>`);
      const act = make('div', 'pk-act'), b = make('button', 'pk-btn', n > 0 ? `Ouvrir (${n})` : `${fmt(pk.cost)} Éclats`); b.disabled = !can; b.addEventListener('click', () => { api.sfx.link(0, 0); start(id); });
      act.append(b); card.append(art, tx, act); if (n > 0) card.append(make('span', 'pk-st', '×' + n)); list.append(card);
    }
    const l = make('button', 'pk-link', 'Probabilités et garanties'); l.addEventListener('click', odds); list.append(l);
  };
  refresh();
  return { refresh, preview(r, id = 'galaxie') { const res = api.preview(r, id); if (res) run(res, id, true); } };
}
