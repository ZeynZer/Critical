// Critical — page Défis : tout ce qui se gagne en un seul endroit. En haut, ce qui attend d'être récupéré (un seul bouton « Tout récupérer ») ;
// puis aujourd'hui (défi du jour, trois missions), les récompenses de connexion et de temps de jeu, et les objectifs permanents filtrables.
// api : { goals: { list, claimGoal, claimAll }, quests: { data, claimReward, claimAll }, daily: { info(), play() }, toast, vib, sfx, icon }
const KEY = 'critical.chp.v1', make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const CSS = `
.chp{display:flex;flex-direction:column;gap:12px;min-height:0;flex:1}.chp-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;display:flex;flex-direction:column;gap:12px;padding-bottom:8px}.chp-body::-webkit-scrollbar{display:none}.chp-body>*{flex-shrink:0}
.chp-top{flex:none;display:flex;align-items:center;gap:12px;padding:12px 12px 12px 16px;border-radius:24px;background:linear-gradient(135deg,rgba(93,255,192,.16),rgba(77,243,255,.1));border:1px solid rgba(93,255,192,.35)}.chp-top.none{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12)}
.chp-top div{flex:1;min-width:0}.chp-top b{display:block;font:900 clamp(16px,5vw,22px)/1.1 var(--disp)}.chp-top span{font-size:12px;color:rgba(255,255,255,.65)}
.chp-all{flex:none;height:50px;padding:0 clamp(12px,4vw,20px);border-radius:26px;border:0;font:900 13px var(--disp);letter-spacing:.05em;color:#04241a;background:#5dffc0;box-shadow:0 0 24px rgba(93,255,192,.5);animation:chp-pu 2s ease-in-out infinite}.chp-all:disabled{opacity:.35;box-shadow:none;animation:none}.chp-all:not(:disabled):active{transform:scale(.95)}@keyframes chp-pu{50%{box-shadow:0 0 34px rgba(93,255,192,.8)}}
.chp-h{margin:4px 2px 0;font:800 11px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.chp-day{display:flex;align-items:center;gap:12px;padding:14px;border-radius:22px;background:linear-gradient(135deg,rgba(255,194,71,.18),rgba(255,79,216,.1));border:1px solid rgba(255,194,71,.4)}.chp-day.ok{opacity:.65}.chp-day div{flex:1;min-width:0}.chp-day b{display:block;font-size:14px;line-height:1.25}.chp-day small{font-size:11.5px;color:rgba(255,255,255,.65)}
.chp-go{flex:none;height:44px;padding:0 18px;border-radius:22px;border:0;color:#fff;font:800 12px var(--disp);letter-spacing:.05em;background:linear-gradient(135deg,#ffb347,#ff4fa8)}
.chp-it{position:relative;display:flex;align-items:center;gap:11px;padding:12px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-left:4px solid var(--c,#4df3ff);overflow:hidden}.chp-it.ready{background:linear-gradient(90deg,rgba(93,255,192,.16),rgba(255,255,255,.04));border-color:rgba(93,255,192,.5)}.chp-it.done{opacity:.5}
.chp-it .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.chp-it b{font:700 13.5px/1.2 var(--font)}.chp-it small{font-size:11.5px;line-height:1.35;color:rgba(255,255,255,.62)}.chp-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}.chp-bar i{display:block;height:100%;border-radius:3px;background:var(--c,#4df3ff)}.chp-it em{font:700 10px var(--disp);font-style:normal;color:rgba(255,255,255,.55)}
.chp-rw{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right;font:700 11px var(--disp);color:rgba(255,255,255,.85)}.chp-rw .v{display:flex;align-items:center;gap:4px}.chp-rw small{font-size:10px;color:rgba(255,255,255,.5)}
.chp-ok{height:42px;min-width:88px;padding:0 14px;border-radius:21px;border:0;background:#5dffc0;color:#06231a;font:900 12px var(--disp);box-shadow:0 0 16px rgba(93,255,192,.45)}.chp-ok:disabled{opacity:.35;box-shadow:none}.chp-ok:not(:disabled):active{transform:scale(.94)}
.chp-chips{display:flex;flex-wrap:wrap;gap:6px}.chp-chips button{height:34px;padding:0 13px;border-radius:17px;font:700 11.5px var(--font);color:rgba(255,255,255,.7);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.chp-chips button.on{color:#fff;background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4)}
.chp-empty{padding:22px 8px;text-align:center;color:rgba(255,255,255,.55);font-size:13px}.chp-note{margin:0;font-size:11.5px;color:rgba(255,255,255,.5)}
`;
export function mount(page, api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  let S = { f: 'todo', diff: -1 }; try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ } const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const root = make('div', 'chp'), body = make('div', 'chp-body'); root.append(body); page.append(root); let armed = 0;
  const claimBtn = (txt, f) => { const b = make('button', 'chp-ok', txt); b.disabled = Date.now() < armed; if (b.disabled) setTimeout(() => { b.disabled = false; }, armed - Date.now()); b.addEventListener('click', () => { f(); api.sfx && api.sfx(); render(); }); return b; }; // inerte un instant après l'affichage : pas d'appui involontaire
  function render() {
    const sc = body.scrollTop; body.textContent = ''; const gs = api.goals.list(), qd = api.quests.data(), dy = api.daily.info(), gReady = gs.filter((g) => g.done && !g.claimed).length, qReady = qd.claimable, ready = gReady + qReady;
    const top = make('div', 'chp-top' + (ready ? '' : ' none')); top.innerHTML = `<div><b>${ready ? ready + ' à récupérer' : 'Tout est récupéré'}</b><span>${ready ? 'Un seul appui pour tout encaisser' : 'Joue : les objectifs se cochent tout seuls'}</span></div>`;
    const all = make('button', 'chp-all', 'Tout récupérer'); all.disabled = !ready; all.addEventListener('click', () => { api.goals.claimAll(); api.quests.claimAll(); render(); }); top.append(all); body.append(top);
    // — aujourd'hui
    body.append(make('h3', 'chp-h', 'Aujourd\'hui'));
    const day = make('div', 'chp-day' + (dy.done ? ' ok' : '')); day.innerHTML = `<div><b>Défi du jour</b><small>${esc(dy.txt)}</small></div>`; const go = make('button', 'chp-go', dy.done ? 'Rejouer' : 'Relever'); go.addEventListener('click', () => { api.sfx && api.sfx(); api.daily.play(); }); day.append(go); body.append(day);
    qd.quests.forEach((q) => { const it = make('div', 'chp-it' + (q.done ? ' done' : '')); it.style.setProperty('--c', '#ffc247'); it.innerHTML = `<div class="tx"><b>${esc(q.lbl)}</b>${q.done ? '' : `<div class="chp-bar"><i style="width:${Math.round(q.p / q.goal * 100)}%"></i></div><em>${fmt(q.p)} / ${fmt(q.goal)}</em>`}</div><div class="chp-rw"><span class="v">${q.done ? '✓ fait' : '+' + fmt(q.e) + ' ' + api.icon}</span></div>`; body.append(it); });
    body.append(make('p', 'chp-note', qd.bonus ? 'Les trois missions sont faites : bonus de 1 000 Voidium encaissé.' : 'Les trois missions terminées : +1 000 Voidium en plus. Les mêmes pour tous les joueurs.'));
    // — récompenses de connexion et de temps de jeu
    const rows = [...qd.dayRows.map((r) => ({ t: `Jour ${r.k} joué`, text: r.text, run: () => api.quests.claimReward('d', r.k) })), ...qd.timeRows.filter((r) => r.can).map((r) => ({ t: r.label, text: r.text, run: () => api.quests.claimReward('t', r.s) }))];
    const nxt = qd.timeRows.find((r) => !r.can && !r.done);
    body.append(make('h3', 'chp-h', 'Récompenses de fidélité'));
    for (const r of rows) { const it = make('div', 'chp-it ready'); it.style.setProperty('--c', '#5dffc0'); it.innerHTML = `<div class="tx"><b>${esc(r.t)}</b><small>${esc(r.text)}</small></div>`; const rw = make('div', 'chp-rw'); rw.append(claimBtn('Récupérer', r.run)); it.append(rw); body.append(it); }
    if (nxt) { const it = make('div', 'chp-it'); it.style.setProperty('--c', '#4df3ff'); it.innerHTML = `<div class="tx"><b>${esc(nxt.label)}</b><small>${esc(nxt.text)}</small><div class="chp-bar"><i style="width:${nxt.pct}%"></i></div><em>${nxt.pct} %</em></div>`; body.append(it); }
    body.append(make('p', 'chp-note', `Prochain jour joué : ${esc(qd.nextDay.text)}. Aucune série à garder : tout t'attend sans limite de temps.`));
    // — objectifs
    body.append(make('h3', 'chp-h', 'Objectifs'));
    const fc = make('div', 'chp-chips'); [['ready', `À valider${gReady ? ' (' + gReady + ')' : ''}`], ['todo', 'En cours'], ['done', 'Terminés']].forEach(([k, n]) => { const b = make('button', S.f === k ? 'on' : '', n); b.addEventListener('click', () => { S.f = k; save(); render(); }); fc.append(b); });
    const dc = make('div', 'chp-chips'); ['Tous niveaux', 'Facile', 'Moyen', 'Difficile', 'Légendaire'].forEach((n, i) => { const b = make('button', S.diff === i - 1 ? 'on' : '', n); b.addEventListener('click', () => { S.diff = i - 1; save(); render(); }); dc.append(b); }); body.append(fc, dc);
    let L = gs.filter((g) => (S.f === 'ready' ? g.done && !g.claimed : S.f === 'todo' ? !g.done : g.claimed) && (S.diff < 0 || g.l === S.diff));
    L = L.sort((a, b) => (S.f === 'todo' ? b.prog / b.n - a.prog / a.n : a.l - b.l));
    if (!L.length) body.append(make('div', 'chp-empty', S.f === 'ready' ? 'Rien à valider pour l\'instant.' : S.f === 'todo' ? 'Tout est accompli à ce niveau !' : 'Aucun objectif terminé ici pour l\'instant.'));
    for (const g of L) {
      const it = make('div', 'chp-it' + (g.done && !g.claimed ? ' ready' : '') + (g.claimed ? ' done' : '')); it.style.setProperty('--c', g.col);
      it.innerHTML = `<div class="tx"><b>${esc(g.t)}</b><small>${esc(g.d)}</small>${g.k !== 'e' && !g.done ? `<div class="chp-bar"><i style="width:${Math.round(g.prog / g.n * 100)}%"></i></div><em>${fmt(g.prog)} / ${fmt(g.n)}</em>` : `<em style="color:${g.col}">${esc(g.diff).toUpperCase()}</em>`}</div>`;
      const rw = make('div', 'chp-rw', `<span class="v">+${fmt(g.v)} ${api.icon}</span><small>+${fmt(g.xp)} XP${g.pack ? ' · +1 ' + esc(g.pack) : ''}</small>`); if (g.done && !g.claimed) rw.append(claimBtn('Valider', () => api.goals.claimGoal(g.id))); else if (g.claimed) rw.append(make('small', '', '✓ validé'));
      it.append(rw); body.append(it);
    }
    body.scrollTop = sc;
  }
  armed = Date.now() + 700; render(); return { refresh() { render(); }, count() { const c = api.quests.data().claimable + api.goals.list().filter((g) => g.done && !g.claimed).length; return c; }, shown() { armed = Date.now() + 700; render(); } };
}
