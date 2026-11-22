// Critical — page Collection : toutes les cartes (filtres et tris), le deck de capacités à équiper (glisser-déposer ou toucher), les packs et les décors.
// api : { entries(), paint(canvas, clé, px, live), view(clé, actions), deck: { info, add, remove, preset, buySlot }, skin: { equipable(tier, v), equip(tier, v), of(tier) },
//         themes: { list, use, preview(th, w, h) }, mountPacks(box), toast, vib, sfx, icon }
const KEY = 'critical.col.v1', make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const RN = ['Commune', 'Peu commune', 'Rare', 'Épique', 'Légendaire', 'Cosmique'], RC = ['#96aad7', '#4df3ff', '#be78ff', '#ffcd50', '#ff785a', '#ffffff'];
const KINDS = [['all', 'Toutes'], ['capacite', 'Capacités'], ['base', 'Astres'], ['skin', 'Apparences'], ['galaxie', 'Galaxies'], ['rare', 'Rares'], ['secret', 'Secrets']];
const SORTS = [['rar-desc', 'Rareté : rares d\'abord'], ['rar-asc', 'Rareté : communes d\'abord'], ['rank-asc', 'Rang croissant'], ['rank-desc', 'Rang décroissant'], ['ability', 'Capacités d\'abord'], ['name', 'Nom A → Z']];
const CSS = `
.co{display:flex;flex-direction:column;gap:10px;min-height:0;flex:1}.co-tabs{display:flex;gap:4px;padding:4px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);flex:none}.co-tabs button{flex:1;height:36px;border-radius:16px;font:700 11.5px var(--disp);letter-spacing:.02em;color:rgba(255,255,255,.6)}.co-tabs button.on{color:#fff;background:linear-gradient(135deg,rgba(77,243,255,.34),rgba(255,79,216,.3))}
.co-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;display:flex;flex-direction:column;gap:10px;padding-bottom:6px}.co-body::-webkit-scrollbar{display:none}.co-body>*{flex-shrink:0}
.co-sum{display:flex;align-items:center;gap:10px;font-size:12px;color:rgba(255,255,255,.7)}.co-sum i{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}.co-sum b{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
.co-ctl{display:flex;gap:8px}.co-ctl select,.co-ctl input{height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;padding:0 10px;font:600 12.5px var(--font);min-width:0;outline:none;user-select:text;-webkit-user-select:text}.co-ctl select{flex:1.3}.co-ctl input{flex:1}
.co-chips{display:flex;flex-wrap:wrap;gap:6px}.co-chips button{height:30px;padding:0 11px;border-radius:15px;font:700 11px var(--font);color:rgba(255,255,255,.7);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.co-chips button.on{color:#fff;border-color:var(--c,#fff);background:color-mix(in srgb,var(--c,#fff) 22%,transparent)}
.co-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.co-c{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 3px 7px;border-radius:18px;color:#fff;background:radial-gradient(120% 80% at 50% 0,color-mix(in srgb,var(--c) 22%,transparent),rgba(255,255,255,.03));border:1.5px solid color-mix(in srgb,var(--c) 70%,transparent);transition:transform .15s}.co-c:active{transform:scale(.95)}
.co-c.lock{opacity:.4;border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.03)}.co-c b{font-size:10.5px;line-height:1.15;text-align:center}.co-c small{font:700 8.5px var(--disp);letter-spacing:.06em;color:var(--c)}.co-c canvas{display:block}.co-c .q{width:46px;height:46px;display:grid;place-items:center;font:900 20px var(--disp);color:rgba(255,255,255,.35)}
.co-c .bd{position:absolute;top:5px;right:6px;font:900 9px var(--disp);color:#5dffc0}.co-c .cp{position:absolute;top:5px;left:7px;font:800 9px var(--disp);color:rgba(255,255,255,.6)}.co-c .ab{position:absolute;bottom:4px;right:6px;font-size:9px;color:#ffc247}
.co-c.craft{opacity:.62;border-style:dashed}.co-c.craft small{color:var(--c)}.co-fr b{color:#c79bff}.co-cr{align-items:center;text-align:center;gap:6px}.co-cr canvas{width:96px;height:96px}.co-crn{font-size:16px}.co-cr .btns button:disabled{opacity:.45}
.co-c{contain:layout style}
.co-c.r2{box-shadow:0 0 12px -6px var(--c)}
.co-c.r3{box-shadow:0 0 16px -5px var(--c),inset 0 0 16px -9px var(--c)}
.co-c.r4{border-width:2px;box-shadow:0 0 18px -5px var(--c),inset 0 0 22px -8px var(--c);background:radial-gradient(120% 80% at 50% 0,color-mix(in srgb,var(--c) 38%,transparent),rgba(40,10,0,.35));overflow:hidden}
.co-c.r4 small{text-shadow:0 0 8px var(--c)}
.co-c .fx{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
.co-c .fx::before{content:'';position:absolute;top:0;bottom:0;left:-70%;width:60%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.26),transparent);transform:translateX(0)}
.co-c.on .fx::before{animation:co-sh 3.6s ease-in-out infinite;will-change:transform}
.co-c.r5{border-color:rgba(255,255,255,.75);background:#2a1460;overflow:hidden;isolation:isolate;box-shadow:0 0 12px -3px rgba(190,120,255,.85)}
.co-c.r5 .rb{position:absolute;left:50%;top:50%;width:220%;aspect-ratio:1;margin:-110% 0 0 -110%;z-index:-2;pointer-events:none;background:conic-gradient(#ff5fd8,#ff9a6b,#ffd75a,#6dffb0,#4df3ff,#6f8bff,#b46bff,#ff5fd8)}
.co-c.r5.on .rb{animation:co-rot 4.5s linear infinite;will-change:transform}
.co-c.r5 .sp{position:absolute;inset:0;border-radius:inherit;z-index:-1;pointer-events:none;background:
 radial-gradient(1.2px 1.2px at 18% 28%,#fff 60%,transparent),radial-gradient(1px 1px at 72% 14%,#fff 60%,transparent),radial-gradient(1.6px 1.6px at 86% 58%,#fff 60%,transparent),
 radial-gradient(1px 1px at 32% 82%,#fff 60%,transparent),radial-gradient(1.3px 1.3px at 10% 64%,#fff 60%,transparent),
 radial-gradient(45% 34% at 50% 30%,rgba(255,255,255,.4),transparent 70%),
 linear-gradient(125deg,rgba(255,255,255,.22),transparent 40%,rgba(255,255,255,.12) 60%,transparent),
 linear-gradient(180deg,rgba(25,10,60,.18),rgba(15,6,40,.42) 62%,rgba(10,4,30,.62))}
.co-c.r5 b{text-shadow:0 1px 3px rgba(0,0,30,.9),0 0 10px rgba(40,10,90,.8)}
.co-c.r5 small{color:#fff;letter-spacing:.16em;text-shadow:0 1px 3px rgba(0,0,30,.9),0 0 8px rgba(255,255,255,.7)}
@keyframes co-rot{to{transform:rotate(1turn)}}
@keyframes co-sh{0%{transform:translateX(0)}55%,100%{transform:translateX(330%)}}
@media (prefers-reduced-motion:reduce){.co-c.on .fx::before,.co-c.r5.on .rb{animation:none}}
.co-c .stx{font:800 8.5px var(--disp);letter-spacing:.04em;color:#ffd75a;text-shadow:0 0 6px rgba(255,200,80,.6);position:relative;z-index:1}
.dk-up{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.dk-up>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.dk-up b{font-size:12.5px}.dk-up small{font-size:11px;line-height:1.35;color:rgba(255,255,255,.65)}.dk-up em{font-style:normal;color:#ffd75a;font-size:12px}.dk-up button{flex:none;height:34px;padding:0 12px;border-radius:17px;border:0;font:800 10.5px var(--disp);color:#fff;background:linear-gradient(135deg,#ffb347,#ff5fd8)}.dk-up button:disabled{opacity:.4}
.co-empty{padding:30px 10px;text-align:center;color:rgba(255,255,255,.55);font-size:13px}
.co-h{margin:6px 0 0;font:800 11px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}.co-p{margin:0;font-size:12px;line-height:1.45;color:rgba(255,255,255,.6)}
.dk-pre{display:flex;gap:6px}.dk-pre button{flex:1;height:34px;border-radius:17px;font:800 11px var(--disp);color:rgba(255,255,255,.65);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.dk-pre button.on{color:#fff;background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4)}
.dk-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.dk-s{position:relative;min-height:84px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 2px;border-radius:16px;text-align:center;border:2px dashed rgba(255,255,255,.2);background:rgba(255,255,255,.03);transition:transform .2s,border-color .2s,background .2s}.dk-s.over{border-color:#5dffc0;background:rgba(93,255,192,.14);transform:scale(1.08)}
.dk-s.full{border-style:solid;border-color:var(--c);background:radial-gradient(120% 90% at 50% 0,color-mix(in srgb,var(--c) 26%,transparent),rgba(255,255,255,.03))}.dk-s b{font-size:9px;line-height:1.1;padding:0 2px}.dk-s .x{position:absolute;top:2px;right:2px;width:22px;height:22px;border-radius:11px;background:rgba(0,0,0,.45);color:#fff;font-size:10px;border:0}.dk-s .em{font-size:20px;color:rgba(255,255,255,.35)}.dk-s.lk{border-color:rgba(167,120,255,.45)}.dk-ab{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}.dk-ab b{font-size:12.5px}.dk-ab small{font-size:11.5px;line-height:1.35;color:rgba(255,255,255,.7)}
.dk-buy{width:100%;height:100%;min-height:70px;border-radius:12px;border:0;background:transparent;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:18px}.dk-buy span{font:800 9.5px var(--disp);color:#c79bff}.dk-buy:disabled{opacity:.45}
.dk-tray{display:flex;gap:8px;overflow-x:auto;touch-action:pan-x;scrollbar-width:none;padding:2px 2px 6px}.dk-tray::-webkit-scrollbar{display:none}.dk-t{flex:none;width:98px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border-radius:18px;text-align:center;border:1.5px solid var(--c);background:radial-gradient(120% 80% at 50% 0,color-mix(in srgb,var(--c) 22%,transparent),rgba(255,255,255,.03));touch-action:pan-x;user-select:none;-webkit-user-select:none;color:#fff}
.dk-t.lock{opacity:.4;border-color:rgba(255,255,255,.12)}.dk-t.used{opacity:.5}.dk-t b{font-size:10.5px}.dk-t small{font-size:9px;line-height:1.25;color:rgba(255,255,255,.65)}
.dk-ghost{position:fixed;z-index:200;pointer-events:none;width:86px;padding:8px 4px;border-radius:18px;text-align:center;border:2px solid #5dffc0;background:rgba(20,20,60,.92);box-shadow:0 10px 30px rgba(0,0,0,.5);transform:translate(-50%,-60%) scale(1.08);color:#fff;font-size:10.5px}
.dk-sk{display:flex;flex-wrap:wrap;gap:6px}.dk-sk button{display:flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:11px}
.th-g{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.th-c{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:18px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);text-align:left}.th-c.on{border-color:#5dffc0}.th-c canvas{width:100%;height:auto;border-radius:12px;display:block;aspect-ratio:160/84;object-fit:cover}.th-c b{font-size:13px}.th-c button{height:34px;border-radius:17px;border:0;font:800 11px var(--disp);color:#fff;background:linear-gradient(135deg,#5b8cff,#b46bff);display:flex;align-items:center;justify-content:center;gap:6px}.th-c.on button{background:rgba(93,255,192,.22);color:#5dffc0}
`;
export function mount(page, api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  let S = { tab: 'cards', rar: -1, kind: 'all', sort: 'rar-desc', q: '' }; try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ } const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...S, q: '' })); } catch (e) { /* ignore */ } };
  const root = make('div', 'co'), tabs = make('div', 'co-tabs'), body = make('div', 'co-body'); root.append(tabs, body); page.append(root);
  const TABS = [['cards', 'Cartes'], ['deck', 'Deck'], ['packs', 'Packs'], ['decors', 'Décors']]; let packsBox = null;
  const paintTabs = () => { tabs.textContent = ''; for (const [k, n] of TABS) { const b = make('button', S.tab === k ? 'on' : '', n); b.addEventListener('click', () => { S.tab = k; save(); api.sfx && api.sfx(); render(); }); tabs.append(b); } };
  const thumbs = new Map(); // vignettes déjà dessinées : un filtre ou un tri ne redessine plus aucun astre, il recopie l'image
  const jobs = []; let jobRaf = 0; // dessins d'astres pas encore en cache : par petits paquets (6 ms par image au plus), dans l'ordre de la grille
  const work = () => { jobRaf = 0; const t0 = performance.now(); while (jobs.length && performance.now() - t0 < 6) { const [cv, ck, key] = jobs.shift(); if (!cv.isConnected) continue; let src = thumbs.get(ck); if (!src) { src = document.createElement('canvas'); api.paint(src, key, 46, false); thumbs.set(ck, src); } cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); } if (jobs.length) jobRaf = requestAnimationFrame(work); };
  const thumb = (key, tier) => { const ck = key + '|' + (tier >= 0 && tier < 12 ? api.skin.of(tier) : 0), src = thumbs.get(ck), cv = document.createElement('canvas'); cv.style.width = cv.style.height = '46px';
    if (src) { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); } else { jobs.push([cv, ck, key]); if (!jobRaf) jobRaf = requestAnimationFrame(work); } return cv; };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { for (const x of es) x.target.classList.toggle('on', x.isIntersecting); }) : null; // animations seulement pour les cartes visibles
  const cell = (e) => { const c = RC[e.rar], b = make('button', 'co-c' + (e.ok ? ' r' + e.rar : ' lock')); b.style.setProperty('--c', c);
    if (e.ok && e.rar === 5) b.append(make('i', 'rb'), make('i', 'sp'));
    if (e.ok && e.tier >= 0) b.append(thumb(e.key, e.tier)); else b.append(make('div', 'q', e.ok ? '★' : '?'));
    b.append(make('b', '', e.ok ? esc(e.name) : '???'), make('small', '', e.ok ? RN[e.rar].toUpperCase() : ''));
    if (e.ok && e.deckable) b.append(make('span', 'stx', (e.skill ? esc(e.skill) + ' ' : '') + '★'.repeat(e.stars || 1)));
    if (e.ok && e.copies > 1) b.append(make('span', 'cp', '×' + e.copies)); if (e.inDeck) b.append(make('span', 'bd', 'DECK')); else if (e.skinOn) b.append(make('span', 'bd', 'ÉQUIPÉ')); if (e.ok && e.ability && !e.inDeck) b.append(make('span', 'ab', '✦'));
    if (e.ok && e.rar >= 4) { b.append(make('i', 'fx')); if (io) io.observe(b); else b.classList.add('on'); }
    if (e.ok && e.tier >= 0) b.addEventListener('click', () => open(e));
    else if (api.frag && api.frag.info(e.key)) { const ci = api.frag.info(e.key); b.style.setProperty('--c', RC[ci.rar]); b.querySelector('small').textContent = '✦ ' + fmt(ci.cost); b.classList.add('craft'); b.addEventListener('click', () => craftDlg(e.key)); }
    return b; };
  function craftDlg(key) { // fabriquer une carte jamais obtenue avec des fragments stellaires (gagnés grâce aux doublons)
    const ci = api.frag.info(key); if (!ci) return; const ok = ci.have >= ci.cost;
    const m = make('div', 'modal on', `<div class="card glass co-cr"><h2>Fabriquer</h2><canvas></canvas><b class="co-crn" style="color:${RC[ci.rar]}">${esc(ci.name)}</b><small style="color:${RC[ci.rar]}">${RN[ci.rar].toUpperCase()}</small>`
      + `<p class="co-p">Coût : <b>✦ ${fmt(ci.cost)}</b> fragments stellaires · tu en as <b>${fmt(ci.have)}</b>.${ok ? '' : `<br>Il t'en manque ${fmt(ci.cost - ci.have)} : chaque doublon (pack ou partie) en rapporte.`}</p>`
      + `<div class="btns"><button class="big glass" data-x>Fermer</button><button class="big primary" data-go${ok ? '' : ' disabled'}>Fabriquer</button></div></div>`);
    api.paint(m.querySelector('canvas'), key, 96, false);
    m.addEventListener('click', (ev) => { if (ev.target === m || ev.target.hasAttribute('data-x')) m.remove(); });
    m.querySelector('[data-go]').addEventListener('click', () => { const r = api.frag.craft(key); m.remove(); if (r === 'ok') { api.vib && api.vib([14, 40, 14]); api.toast('Carte fabriquée : ' + ci.name); render(); const e = api.entries().find((x) => x.key === key); if (e) open(e); } else if (r === 'poor') api.toast('Pas assez de fragments'); });
    document.body.append(m);
  }
  const inDeck = (k) => api.deck.info().cards.some((c) => c.key === k);
  const UPMSG = { ok: 'Carte améliorée !', frag: 'Pas assez de fragments stellaires (les doublons en rapportent)', poor: 'Pas assez de Voidium', max: 'Déjà au maximum (3★)', locked: 'Carte pas encore obtenue' };
  function actionsOf(e) { // boutons de la carte immersive : deck, amélioration, apparence
    const A = [];
    if (e.deckable) {
      A.push({ label: () => (inDeck(e.key) ? 'Retirer du deck' : 'Mettre dans le deck'), primary: () => inDeck(e.key), run: () => { if (inDeck(e.key)) api.deck.remove(e.key); else { const r = api.deck.add(e.key); api.toast(r === 'full' ? 'Deck plein : retire une carte ou débloque un emplacement' : r === 'swap' ? 'Carte équipée (elle remplace celle du même rang)' : 'Carte équipée'); } render(); } });
      A.push({ label: () => { const c = api.deck.card(e.key); return c.up ? `Améliorer ${'★'.repeat(c.stars + 1)} · ✦ ${fmt(c.up.frag)} + ${fmt(c.up.dust)} Voidium` : `${'★'.repeat(c.stars)} Niveau maximum`; }, primary: () => false, run: () => { const r = api.deck.upgrade(e.key); api.toast(UPMSG[r] || ''); if (r === 'ok') api.vib && api.vib([14, 40, 14]); render(); } });
    }
    if (api.skin.equipable(e.tier, e.v) && e.v >= 2) A.push({ label: () => (api.skin.of(e.tier) === e.v ? 'Retirer l\'apparence' : 'Équiper l\'apparence'), primary: () => api.skin.of(e.tier) === e.v, run: () => { api.skin.equip(e.tier, api.skin.of(e.tier) === e.v ? 0 : e.v); render(); } });
    return A.length ? A : null;
  }
  const open = (e) => api.view(e.key, actionsOf(e));
  /* ---------- cartes ---------- */
  function cards() {
    const all = api.entries(), found = all.filter((e) => e.ok).length; body.append(make('div', 'co-sum', `<span>${found} / ${all.length} découvertes</span><i><b style="width:${Math.round(found / all.length * 100)}%"></b></i><span>${Math.round(found / all.length * 100)} %</span>`));
    if (api.frag) body.append(make('p', 'co-p co-fr', `<b>✦ ${fmt(api.frag.have())}</b> fragments stellaires · les doublons en rapportent ; touche une carte verrouillée pour la fabriquer.`));
    const ctl = make('div', 'co-ctl'), sel = make('select'), q = make('input'); sel.innerHTML = SORTS.map(([k, n]) => `<option value="${k}"${S.sort === k ? ' selected' : ''}>${n}</option>`).join(''); sel.addEventListener('change', () => { S.sort = sel.value; save(); fill(); }); q.placeholder = 'Chercher'; q.value = S.q; q.addEventListener('input', () => { S.q = q.value; fill(); }); ctl.append(sel, q); body.append(ctl);
    const rc = make('div', 'co-chips'), kc = make('div', 'co-chips');
    const chip = (box, txt, on, col, f) => { const b = make('button', on ? 'on' : '', txt); if (col) b.style.setProperty('--c', col); b.addEventListener('click', () => { f(); save(); render(); }); box.append(b); };
    chip(rc, 'Toutes raretés', S.rar < 0, '#fff', () => { S.rar = -1; }); RN.forEach((n, i) => chip(rc, n, S.rar === i, RC[i], () => { S.rar = i; })); KINDS.forEach(([k, n]) => chip(kc, n, S.kind === k, '#4df3ff', () => { S.kind = k; })); body.append(rc, kc);
    const grid = make('div', 'co-grid'); body.append(grid);
    function fill() {
      if (io) io.disconnect(); grid.textContent = ''; const q2 = S.q.trim().toLowerCase();
      let L = all.filter((e) => (S.rar < 0 || e.rar === S.rar) && (S.kind === 'all' || (S.kind === 'skin' ? ['skin', 'style', 'prisme'].includes(e.kind) : e.kind === S.kind)) && (!q2 || (e.ok && e.name.toLowerCase().includes(q2))));
      const rk = (e) => (e.tier < 0 ? -1 : e.tier * 20 + e.v), cmp = { 'rar-desc': (a, b) => b.rar - a.rar || rk(b) - rk(a), 'rar-asc': (a, b) => a.rar - b.rar || rk(a) - rk(b), 'rank-asc': (a, b) => rk(a) - rk(b), 'rank-desc': (a, b) => rk(b) - rk(a), name: (a, b) => a.name.localeCompare(b.name, 'fr'), ability: (a, b) => (b.ability ? 1 : 0) - (a.ability ? 1 : 0) || b.rar - a.rar }[S.sort];
      L = L.sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0) || cmp(a, b)); // les découvertes d'abord
      if (!L.length) grid.append(make('div', 'co-empty', 'Aucune carte ne correspond à ces filtres.')); for (const e of L) grid.append(cell(e));
    }
    fill();
  }
  /* ---------- deck : glisser une capacité vers un emplacement (ou la toucher) ---------- */
  function deck() {
    const d = api.deck.info(); const pre = make('div', 'dk-pre'); ['Deck A', 'Deck B'].forEach((n, i) => { const b = make('button', d.sel === i ? 'on' : '', n); b.addEventListener('click', () => { api.deck.preset(i); render(); }); pre.append(b); }); body.append(pre);
    const slots = make('div', 'dk-slots'), els = []; body.append(slots);
    for (let i = 0; i < d.max; i++) { // une seule rangée : emplacements et plateau visibles ensemble, pour pouvoir glisser sans défiler
      const s = make('div', 'dk-s'); els.push(s);
      if (i < d.slots) { const k = d.cards[i]; if (k) { s.classList.add('full'); s.style.setProperty('--c', RC[k.rar]); const cv = document.createElement('canvas'); api.paint(cv, k.key, 40, false); s.append(cv, make('b', '', esc(k.name)), make('small', 'stx', '★'.repeat(k.stars))); const x = make('button', 'x', '✕'); x.setAttribute('aria-label', 'Retirer ' + k.name); x.addEventListener('click', () => { api.deck.remove(k.key); api.vib && api.vib(6); render(); }); s.append(x); } else s.append(make('div', 'em', '+')); }
      else if (i === d.slots) { s.classList.add('lk'); const b = make('button', 'dk-buy', `🔓<span>${fmt(d.nextCost)}</span>`); b.setAttribute('aria-label', 'Débloquer un emplacement pour ' + fmt(d.nextCost) + ' Voidium'); b.disabled = d.dust < d.nextCost; b.addEventListener('click', () => { const r = api.deck.buySlot(); api.toast(r === 'ok' ? 'Emplacement débloqué !' : r === 'poor' ? 'Pas assez de Voidium' : 'Déjà au maximum'); render(); }); s.append(b); }
      else { s.classList.add('lk'); s.style.opacity = '.35'; s.append(make('div', 'em', '🔒')); }
      slots.append(s);
    }
    body.append(make('p', 'co-p', `${d.cards.length} / ${d.slots} emplacements utilisés. Glisse une carte du plateau vers le haut pour l'équiper, ou touche-la.`));
    const tray = make('div', 'dk-tray'); body.append(tray);
    const owned = d.pool.filter((c) => c.own), locked = d.pool.length - owned.length;
    for (const c of owned) {
      const t = make('div', 'dk-t' + (c.inDeck ? ' used' : '')); t.style.setProperty('--c', RC[c.rar]);
      const cv = document.createElement('canvas'); api.paint(cv, c.key, 52, false); t.append(cv);
      t.append(make('b', '', esc(c.name)), make('small', 'stx', esc(c.kind === 'pouvoir' ? 'Pouvoir' : c.kind) + ' ' + '★'.repeat(c.stars)), make('small', '', esc(c.info))); tray.append(t);
      if (!c.inDeck) grab(t, c, els, d);
    }
    if (!owned.length) tray.append(make('p', 'co-p', 'Aucune carte à capacité pour l\'instant : ouvre des packs ou joue pour en obtenir.'));
    body.append(make('p', 'co-p', `${owned.length} carte${owned.length > 1 ? 's' : ''} à capacité · ${locked} à découvrir. Chaque apparence a sa capacité ; une seule carte par rang (en placer une autre du même rang la remplace).`));
    body.append(make('h3', 'co-h', 'En partie'));
    if (d.cards.length) for (const k of d.cards) { const row = make('div', 'dk-up', `<div><b style="color:${RC[k.rar]}">${esc(k.name)} <em>${k.starLine}</em></b><small>${esc(k.info)}</small></div>`), ub = make('button', '', k.up ? `★ ${fmt(k.up.frag)} ✦ · ${fmt(k.up.dust)}` : 'MAX'); ub.disabled = !k.up || d.frag < k.up.frag || d.dust < k.up.dust; ub.setAttribute('aria-label', k.up ? `Améliorer ${k.name} pour ${fmt(k.up.frag)} fragments et ${fmt(k.up.dust)} Voidium` : 'Niveau maximum'); ub.addEventListener('click', () => { const r = api.deck.upgrade(k.key); api.toast(UPMSG[r] || ''); if (r === 'ok') api.vib && api.vib([14, 40, 14]); render(); }); row.append(ub); body.append(row); } else body.append(make('p', 'co-p', 'Aucune carte équipée : tes astres sont normaux. Équipe des cartes pour changer les règles à ton avantage (aimant, onde, éclat, souffle…). Actif en Univers, Blitz et Shaker ; inactif en duel, défi du jour et bac à sable.'));
    if (d.skins.length) { body.append(make('h3', 'co-h', 'Apparences équipées')); const sk = make('div', 'dk-sk'); for (const s of d.skins) { const b = make('button'); const cv = document.createElement('canvas'); api.paint(cv, s.key, 30, false); b.append(cv, document.createTextNode(s.name + ' ✕')); b.addEventListener('click', () => { api.skin.equip(s.tier, 0); render(); }); sk.append(b); } body.append(sk); }
  }
  function grab(t, c, els, d) { // vertical = on saisit la carte (le navigateur garde le défilement horizontal du plateau) ; simple toucher = placer dans le premier emplacement libre
    let st = null, ghost = null, over = -1; const slotAt = (x, y) => els.findIndex((s, i) => { const r = s.getBoundingClientRect(); return i < d.slots && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    t.addEventListener('pointerdown', (e) => { st = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; });
    t.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return; const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!ghost) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 0.8 && dy < 0) { ghost = make('div', 'dk-ghost'); const cv = document.createElement('canvas'); api.paint(cv, c.key, 52, false); ghost.append(cv, make('div', '', esc(c.name))); document.body.append(ghost); try { t.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } st.moved = true; api.vib && api.vib(8); } else return; }
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; const i = slotAt(e.clientX, e.clientY); if (i !== over) { els.forEach((s, k) => s.classList.toggle('over', k === i)); over = i; }
    });
    const end = (e) => { if (!st || e.pointerId !== st.id) return; const s0 = st; st = null; if (ghost) { ghost.remove(); ghost = null; els.forEach((s) => s.classList.remove('over')); if (e.type === 'pointerup' && over >= 0) { const r = api.deck.add(c.key); api.toast(r === 'full' ? 'Deck plein' : r === 'swap' ? 'Remplace la carte du même rang' : 'Carte équipée'); api.vib && api.vib([8, 20, 8]); render(); } over = -1; return; } if (e.type === 'pointerup' && !s0.moved && Math.abs(e.clientX - s0.x) < 8) { const r = api.deck.add(c.key); if (r === 'full') api.toast('Deck plein : retire une carte ou débloque un emplacement'); else if (r === 'swap') api.toast('Remplace la carte du même rang'); api.vib && api.vib(8); render(); } };
    t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
  }
  /* ---------- décors ---------- */
  function decors() {
    body.append(make('p', 'co-p', 'L\'ambiance de fond de la cuve. Un décor acheté est à toi pour toujours.')); const g = make('div', 'th-g'); body.append(g);
    for (const t of api.themes.list()) { const c = make('div', 'th-c' + (t.on ? ' on' : '')); c.append(api.themes.preview(t.th, 160, 84), make('b', '', esc(t.n))); const b = make('button', '', t.on ? 'Équipé' : t.own ? 'Équiper' : `Acheter · ${fmt(t.cost)} ${api.icon || ''}`); b.addEventListener('click', () => { if (t.on) return; const r = api.themes.use(t.id); api.toast(r === 'ok' ? (t.own ? 'Décor équipé' : 'Décor acheté et équipé') : r === 'poor' ? 'Pas assez de Voidium' : ''); render(); }); c.append(b); g.append(c); }
  }
  function render() {
    paintTabs(); const sc = body.scrollTop; for (const ch of [...body.children]) if (ch !== packsBox) ch.remove(); if (packsBox) packsBox.hidden = S.tab !== 'packs';
    if (S.tab === 'cards') cards(); else if (S.tab === 'deck') deck(); else if (S.tab === 'decors') decors(); else if (S.tab === 'packs') { if (!packsBox) { packsBox = make('div'); body.append(packsBox); api.mountPacks(packsBox); } packsBox.hidden = false; }
    body.scrollTop = sc;
  }
  render(); return { refresh() { if (S.tab !== 'cards' || !page.contains(document.activeElement)) render(); } };
}
