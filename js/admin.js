// Critical — console d'administration (plein écran, par onglets). Elle n'est proposée que si le SERVEUR a reconnu le compte comme admin (pulse.admin) ;
// chaque action est de toute façon refusée par la base si le compte n'est pas admin (voir supabase/schema.sql).
// api : { call(fn, args), toast(txt), vib(n), paint(canvas, clé, px, live), local: { p, e, x, u, test(rareté) } }
import { mount as mountIdeas } from './ideas.js';
import { avatar, titleName } from './style.js';
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
const dur = (sec) => (!sec ? '–' : sec < 3600 ? `${Math.round(sec / 60)} min` : `${Math.floor(sec / 3600)} h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`);
const ago = (iso) => { if (!iso) return 'jamais'; const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const day = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
const CSS = `
#ad-m{padding:0;align-items:stretch;justify-content:center;background:rgba(3,4,14,.94)}
.ad-in{position:relative;display:flex;flex-direction:column;width:100%;max-width:520px;height:100%;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 0;box-sizing:border-box}
.ad-in::before{content:'';position:absolute;left:-10%;right:-10%;top:0;height:200px;background:radial-gradient(60% 100% at 20% 0,rgba(255,194,71,.18),transparent 70%),radial-gradient(60% 100% at 85% 0,rgba(255,79,216,.14),transparent 70%);pointer-events:none}
.ad-hd{position:relative;display:flex;align-items:center;gap:10px;margin-bottom:10px}.ad-hd h2{flex:1;margin:0;font:900 22px var(--disp);color:#ffc247;text-shadow:0 0 20px rgba(255,194,71,.4)}.ad-hd small{display:block;font:500 11px var(--font);color:rgba(255,255,255,.5);text-shadow:none}
.ad-x{width:42px;height:42px;border-radius:21px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font-size:17px}
.ad-tabs{position:relative;display:flex;gap:4px;padding:4px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);overflow-x:auto;scrollbar-width:none}.ad-tabs::-webkit-scrollbar{display:none}
.ad-tabs button{flex:1;min-width:max-content;height:36px;padding:0 12px;border-radius:16px;font:700 11.5px var(--font);color:rgba(255,255,255,.6)}.ad-tabs button.on{color:#fff;background:rgba(255,194,71,.22);box-shadow:inset 0 0 0 1px rgba(255,194,71,.5)}
.ad-body{position:relative;flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;scrollbar-width:none;padding:12px 0 24px;display:flex;flex-direction:column;gap:10px}.ad-body::-webkit-scrollbar{display:none}
.ad-sec{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:20px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09)}.ad-sec h3{margin:0;font:800 11px var(--disp);letter-spacing:.13em;text-transform:uppercase;color:#ffc247}.ad-sec p{margin:0;font-size:12px;line-height:1.4;color:rgba(255,255,255,.6)}
.ad-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ad-k{padding:11px 6px 9px;border-radius:16px;text-align:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.ad-k b{display:block;font:800 18px var(--disp);color:#fff}.ad-k span{display:block;margin-top:2px;font-size:10px;color:rgba(255,255,255,.55);line-height:1.2}.ad-k.hot b{color:#5dffc0}.ad-k.warn b{color:#ff8aa0}
.ad-m input,.ad-m select,.ad-m textarea{height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#fff;padding:0 12px;font:600 14px var(--font);outline:none;user-select:text;-webkit-user-select:text;min-width:0;box-sizing:border-box}.ad-m textarea{height:auto;min-height:64px;padding:10px 12px;resize:none;touch-action:pan-y}
.ad-r{display:flex;gap:8px;flex-wrap:wrap}.ad-r>input,.ad-r>select{flex:1}.ad-b{height:40px;padding:0 14px;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font:700 12px var(--font);flex:none}.ad-b.go{background:linear-gradient(135deg,#5b8cff,#b46bff);border:0}.ad-b.d{border-color:rgba(255,106,138,.6);color:#ff8aa0}.ad-b:disabled{opacity:.4}.ad-b.arm{background:rgba(255,106,138,.28);color:#fff}
#ad-list{display:flex;flex-direction:column;gap:5px;max-height:34vh;overflow-y:auto;scrollbar-width:none;touch-action:pan-y}
.ad-p{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:15px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;text-align:left;font:600 13px var(--font)}.ad-p.on{border-color:#4df3ff;background:rgba(77,243,255,.12)}.ad-p span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ad-p small{font-size:10.5px;color:rgba(255,255,255,.5)}.ad-p s{text-decoration:none;font:800 9px var(--disp);color:#ff8aa0;border:1px solid #ff8aa0;border-radius:8px;padding:2px 5px}.ad-p u{width:8px;height:8px;border-radius:50%;background:#5dffc0;box-shadow:0 0 8px #5dffc0}
.ad-fiche{display:flex;flex-direction:column;gap:10px}.ad-id{display:flex;align-items:center;gap:12px}.ad-id h4{margin:0;font:900 18px var(--disp)}.ad-id p{margin:2px 0 0;font-size:11.5px;color:rgba(255,255,255,.55)}
.ad-tbl{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;font-size:12px}.ad-tbl div{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)}.ad-tbl span{color:rgba(255,255,255,.5)}.ad-tbl b{font-weight:700;text-align:right}
.ad-an{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.05);font-size:12px}.ad-an span{flex:1;min-width:0}.ad-an em{font-style:normal;font-size:10px;color:rgba(255,255,255,.45);display:block}.ad-an.off{opacity:.5}
.ad-rar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
`;
export function mount(api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  const m = make('div', 'modal ad-m', `<div class="ad-in"><div class="ad-hd"><h2>Administration<small>Console du créateur</small></h2><button class="ad-x" id="ad-x2" aria-label="Fermer">✕</button></div>
<div class="ad-tabs"><button data-t="dash" class="on">Tableau</button><button data-t="players">Joueurs</button><button data-t="send">Cadeaux et annonces</button><button data-t="event">Événement</button><button data-t="ideas">Idées</button><button data-t="tools">Outils</button></div><div class="ad-body" id="ad-body"></div></div>`); m.id = 'ad-m'; document.body.append(m);
  const body = m.querySelector('#ad-body'); let tab = 'dash', sel = null, armed = null, ideasUi = null; const panes = {};
  const run = async (fn, args, ok) => { try { const r = await api.call(fn, args); if (ok) api.toast(ok); return r === undefined || r === null ? true : r; } catch (e) { api.toast('Refusé : ' + e.message); return null; } };
  const confirmed = (key) => { if (armed === key) { armed = null; return true; } armed = key; api.toast('Touche encore pour confirmer'); setTimeout(() => { if (armed === key) armed = null; }, 3000); return false; }; // actions destructrices ou massives : deux appuis
  const sec = (title, ...kids) => { const s = make('div', 'ad-sec'); if (title) s.append(make('h3', '', title)); s.append(...kids); return s; };
  const btn = (txt, cls, f) => { const b = make('button', 'ad-b ' + (cls || ''), txt); b.addEventListener('click', f); return b; };
  /* ---------- tableau de bord ---------- */
  async function dash() {
    const p = panes.dash; p.textContent = ''; const g = make('div', 'ad-g'); p.append(sec('Vue d\'ensemble', g), sec('En ligne maintenant')); const on = p.lastChild;
    const s = await run('admin_stats', {}); if (!s || s === true) { g.innerHTML = '<p>Statistiques indisponibles (le SQL est-il à jour ?).</p>'; return; }
    const k = (v, l, c) => `<div class="ad-k ${c || ''}"><b>${v}</b><span>${l}</span></div>`;
    g.innerHTML = k(fmt(s.players), 'joueurs inscrits') + k(fmt(s.online), 'en ligne', 'hot') + k(fmt(s.active24), 'actifs sur 24 h') + k(fmt(s.new7), 'nouveaux (7 j)') + k(fmt(s.runs), 'joueurs classés') + k(fmt(s.top), 'meilleur score') + k(fmt(s.hours) + ' h', 'jouées au total') + k(s.avg_level, 'niveau moyen') + k(fmt(s.duels), 'duels (24 h)') + k(fmt(s.likes), 'likes de profils') + k(`${fmt(s.ideas_open)} / ${fmt(s.ideas)}`, 'idées ouvertes / total') + k(fmt(s.idea_likes), 'soutiens aux idées') + k(fmt(s.gifts_pending), 'cadeaux en attente', s.gifts_pending ? 'warn' : '') + k(fmt(s.banned), 'bannis', s.banned ? 'warn' : '');
    const rows = await run('admin_players', { p_query: '', p_limit: 60 }); on.append(...(rows && rows !== true ? rows.filter((r) => r.online) : []).map((r) => rowBtn(r, true)), ...(rows && rows !== true && !rows.some((r) => r.online) ? [make('p', '', 'Personne en ce moment.')] : []));
  }
  /* ---------- joueurs ---------- */
  function rowBtn(p, goPlayers) { const b = make('button', 'ad-p' + (sel === p.name ? ' on' : ''), `${p.online ? '<u></u>' : ''}<span>${esc(p.name)}${p.admin ? ' ★' : ''}</span>${p.banned ? '<s>BANNI</s>' : ''}<small>niv ${p.level} · ${p.score != null ? fmt(p.score) : '–'}</small>`); b.addEventListener('click', () => { if (goPlayers) { setTab('players'); } pick(p.name); }); return b; }
  async function search() {
    const pl = panes.players, q = pl.querySelector('#ad-q').value, rows = await run('admin_players', { p_query: q, p_limit: 40 }); if (!rows || rows === true) return; const list = pl.querySelector('#ad-list'); list.textContent = '';
    for (const p of rows) { const b = rowBtn(p, false); list.append(b); } if (!rows.length) list.innerHTML = '<p>Aucun joueur.</p>';
  }
  async function pick(name) {
    sel = name; const f = panes.players.querySelector('#ad-fiche'); f.textContent = ''; f.append(make('p', '', 'Chargement…')); const p = await run('admin_player', { p_name: name }); if (!p || p === true) { f.textContent = ''; return; }
    f.textContent = ''; const av = make('div'); avatar(av, { key: (p.featured || [])[0], px: 62, accent: p.accent, frame: p.frame, still: true, paint: api.paint });
    const id = make('div', 'ad-id'); id.append(av, make('div', '', `<h4>${esc(p.name)}${p.admin ? ' ★' : ''}${p.banned ? ' <s style="color:#ff8aa0;font-size:11px">BANNI</s>' : ''}</h4><p>${p.online ? '<span style="color:#5dffc0">● en ligne</span>' : 'vu ' + ago(p.seen)} · inscrit le ${day(p.since)}${p.title ? ' · ' + esc(titleName(p.title) || p.title) : ''}</p>${p.motto ? `<p>« ${esc(p.motto)} »</p>` : ''}`));
    const tb = make('div', 'ad-tbl'); const row = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    tb.innerHTML = row('Niveau', p.level) + row('Rang', p.best != null ? 'n° ' + fmt(p.rank) : '–') + row('Meilleur score', p.best != null ? fmt(p.best) : '–') + row('Astres découverts', p.codex) + row('Défis réussis', p.wins) + row('Temps de jeu', dur(p.playtime)) + row('Likes reçus', p.likes_in) + row('Likes donnés', p.likes_out) + row('Idées', p.ideas) + row('Cadeaux', `${p.gifts} (${p.gifts_pending} en attente)`);
    f.append(id, tb);
    // cadeau
    const e = make('input'), x = make('input'), pk = make('select'), pn = make('input'), note = make('input'); e.placeholder = 'Voidium'; x.placeholder = 'XP'; pn.placeholder = 'Qté'; note.placeholder = 'Message (facultatif)'; note.maxLength = 80; for (const i of [e, x, pn]) i.inputMode = 'numeric'; pn.style.maxWidth = '70px';
    pk.innerHTML = '<option value="">Aucun pack</option><option value="etoile">Pack Étoile</option><option value="nebuleuse">Pack Nébuleuse</option><option value="galaxie">Pack Galaxie</option>';
    const send = btn('Offrir', 'go', async () => { const d = parseInt(e.value, 10) || 0, xp = parseInt(x.value, 10) || 0, pa = pk.value || null, n = parseInt(pn.value, 10) || (pa ? 1 : 0); if (!d && !xp && !pa) return api.toast('Rien à offrir'); if (await run('admin_gift', { p_name: p.name, p_eclats: d, p_xp: xp, p_note: note.value, p_pack: pa, p_pack_n: n }, 'Cadeau envoyé à ' + p.name)) { e.value = x.value = pn.value = note.value = ''; pk.value = ''; } });
    f.append(sec('Offrir un cadeau', make('div', 'ad-r'), make('div', 'ad-r'), note, send)); const gs = f.lastChild.querySelectorAll('.ad-r'); gs[0].append(e, x); gs[1].append(pk, pn);
    // actions
    if (!p.admin) {
      const act = make('div', 'ad-r'), once = (key, txt, cls, fn) => { const b = btn(txt, cls, async () => { if (confirmed(key + p.name)) { await fn(); } }); return b; };
      act.append(once('ban', p.banned ? 'Débannir' : 'Bannir', 'd', async () => { await run('admin_ban', { p_name: p.name, p_value: !p.banned }, p.banned ? 'Débanni' : 'Banni'); search(); pick(p.name); }),
        btn('Reprise de compte 30 min', '', () => run('admin_open_claim', { p_name: p.name, p_minutes: 30 }, 'Reprise ouverte 30 min')),
        btn('Renommer', '', async () => { const n = prompt('Nouveau pseudo pour ' + p.name); if (n) { await run('admin_rename', { p_name: p.name, p_new: n }, 'Renommé'); search(); pick(n); } }),
        once('clr', 'Effacer devise et vitrine', 'd', () => run('admin_clear_profile', { p_name: p.name }, 'Profil nettoyé').then(() => pick(p.name))),
        once('rs', 'Effacer ses scores', 'd', () => run('admin_reset_scores', { p_name: p.name }, 'Scores effacés').then(() => pick(p.name))),
        once('del', 'Supprimer le compte', 'd', async () => { await run('admin_delete', { p_name: p.name }, 'Compte supprimé'); sel = null; f.textContent = ''; search(); }));
      f.append(sec('Modération', act));
    }
    f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function buildPlayers() {
    const p = panes.players, q = make('input'); q.id = 'ad-q'; q.placeholder = 'Chercher un joueur'; q.autocomplete = 'off'; q.autocapitalize = 'off'; q.spellcheck = false; q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    const r = make('div', 'ad-r'); r.append(q, btn('Chercher', 'go', search)); const list = make('div'); list.id = 'ad-list'; const fiche = make('div', 'ad-fiche'); fiche.id = 'ad-fiche'; p.append(sec('Joueurs', r, list), fiche);
  }
  /* ---------- cadeaux et annonces ---------- */
  function buildSend() {
    const p = panes.send, e = make('input'), x = make('input'), pk = make('select'), pn = make('input'), note = make('input'), on = make('select'); e.placeholder = 'Voidium'; x.placeholder = 'XP'; pn.placeholder = 'Qté'; pn.style.maxWidth = '70px'; note.placeholder = 'Message affiché au joueur'; note.maxLength = 80; for (const i of [e, x, pn]) i.inputMode = 'numeric';
    pk.innerHTML = '<option value="">Aucun pack</option><option value="etoile">Pack Étoile</option><option value="nebuleuse">Pack Nébuleuse</option><option value="galaxie">Pack Galaxie</option>'; on.innerHTML = '<option value="0">Tous les joueurs</option><option value="1">Seulement ceux en ligne</option>';
    const go = btn('Envoyer à tout le monde', 'd', async () => { const d = parseInt(e.value, 10) || 0, xp = parseInt(x.value, 10) || 0, pa = pk.value || null, n = parseInt(pn.value, 10) || (pa ? 1 : 0); if (!d && !xp && !pa) return api.toast('Rien à offrir'); if (!confirmed('all')) return; const r = await run('admin_gift_all', { p_eclats: d, p_xp: xp, p_note: note.value, p_pack: pa, p_pack_n: n, p_online: on.value === '1' }); if (r && r !== true) { api.toast(`Cadeau envoyé à ${fmt(r.count)} joueur${r.count > 1 ? 's' : ''}`); e.value = x.value = pn.value = note.value = ''; pk.value = ''; } });
    const r1 = make('div', 'ad-r'), r2 = make('div', 'ad-r'); r1.append(e, x); r2.append(pk, pn);
    const t = make('textarea'); t.placeholder = 'Texte de l\'annonce (200 caractères)'; t.maxLength = 200; const mins = make('select'); mins.innerHTML = '<option value="15">15 minutes</option><option value="60" selected>1 heure</option><option value="360">6 heures</option><option value="1440">24 heures</option>';
    const list = make('div'); list.id = 'ad-anns'; list.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    const loadAnn = async () => { const rows = await run('admin_announcements', {}); list.textContent = ''; if (!rows || rows === true) return; if (!rows.length) list.innerHTML = '<p>Aucune annonce.</p>'; for (const a of rows) { const d = make('div', 'ad-an' + (a.active ? '' : ' off'), `<span>${esc(a.text)}<em>${a.active ? 'active jusqu\'à ' + new Date(a.until).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'terminée'} · ${ago(a.at)}</em></span>`); d.append(btn('Supprimer', 'd', async () => { await run('admin_announce_delete', { p_id: a.id }, 'Annonce supprimée'); loadAnn(); })); list.append(d); } };
    const ra = make('div', 'ad-r'); ra.append(mins, btn('Publier', 'go', async () => { if (!t.value.trim()) return; if (await run('admin_announce', { p_text: t.value, p_minutes: +mins.value }, 'Annonce publiée')) { t.value = ''; loadAnn(); } }));
    p.append(sec('Cadeau pour la communauté', make('p', '', 'Un cadeau par joueur, encaissé à sa prochaine connexion (jusqu\'à 100 000 Voidium / XP et 10 packs).'), on, r1, r2, note, go), sec('Annonce pour tous', make('p', '', 'Affichée une seule fois à chaque joueur connecté, hors partie.'), t, ra), sec('Annonces récentes', list)); panes.send.load = loadAnn;
  }
  /* ---------- événement : la Grande Cuve ---------- */
  function buildEvent() {
    const p = panes.event, nm = make('input'), hrs = make('input'), goal = make('input'), box = make('div'); nm.value = 'La Grande Cuve'; nm.maxLength = 40; hrs.value = '60'; goal.value = '300'; hrs.inputMode = goal.inputMode = 'numeric'; hrs.placeholder = 'Durée (heures)'; goal.placeholder = 'Objectif (galaxies)';
    const show = async () => { const e = await run('event_current', {}); box.textContent = ''; if (!e || e === true) { box.innerHTML = '<p>Aucun événement pour l\'instant.</p>'; return; } const left = Date.parse(e.ends) - Date.parse(e.now); box.innerHTML = `<div class="ad-tbl"><div><span>Nom</span><b>${esc(e.name)}</b></div><div><span>État</span><b>${e.active ? 'en cours · ' + dur(left / 1000) : 'terminé'}</b></div><div><span>Galaxies</span><b>${fmt(e.galaxies)} / ${fmt(e.goal)}</b></div><div><span>Masse</span><b>${fmt(e.mass)}</b></div><div><span>Astres posés</span><b>${fmt(e.astres)}</b></div><div><span>Joueurs</span><b>${fmt(e.players)}</b></div></div>` + (e.board || []).slice(0, 5).map((b, i) => `<div class="ad-an"><span>${i + 1}. ${esc(b.n)}</span><b>${fmt(b.a)}</b></div>`).join(''); };
    const go = btn('Lancer l\'événement', 'go', async () => { const h = parseInt(hrs.value, 10) || 60, g = parseInt(goal.value, 10) || 300; if (!confirmed('evstart')) return; if (await run('admin_event_start', { p_name: nm.value, p_hours: h, p_goal: g }, 'Événement lancé')) show(); });
    const end = btn('Arrêter maintenant', 'd', async () => { if (confirmed('evend') && await run('admin_event_end', {}, 'Événement terminé')) show(); });
    const r1 = make('div', 'ad-r'); r1.append(hrs, goal); const r2 = make('div', 'ad-r'); r2.append(go, end, btn('Actualiser', '', show));
    p.append(sec('Événement en cours', box), sec('Nouvel événement', make('p', '', 'Remplace l\'événement en cours. 1 galaxie ≈ 1 429 astres posés ; un joueur actif en pose environ 7 000 par heure (≈ 5 galaxies). Objectif conseillé ≈ 5 × joueurs actifs × heures de jeu ÷ 2.'), nm, r1, r2)); p.show = show;
  }
  /* ---------- outils sur cet appareil ---------- */
  function buildTools() {
    const p = panes.tools, a = make('div', 'ad-r'), rr = make('div', 'ad-rar'); a.append(btn('+10 000 Voidium', '', () => { api.local.e(); api.toast('Fait'); }), btn('+1 000 XP', '', () => { api.local.x(); api.toast('Fait'); }), btn('3 packs de chaque', '', () => { api.local.p(); api.toast('Fait'); }), btn('Tout débloquer', '', () => { api.local.u(); api.toast('Fait'); }));
    [['Commune', 0], ['Peu commune', 1], ['Rare', 2], ['Épique', 3], ['Légendaire', 4], ['Cosmique', 5]].forEach(([n, r]) => rr.append(btn(n, '', () => { m.classList.remove('on'); api.local.test(r); })));
    p.append(sec('Sur cet appareil', make('p', '', 'Ces actions ne touchent que ta sauvegarde locale.'), a), sec('Tester l\'ouverture de pack', make('p', '', 'Aperçu gratuit de l\'animation complète avec une rareté forcée (voir : galaxie, supernova, trou noir, convergence).'), rr));
  }
  function setTab(t) { tab = t; m.querySelectorAll('.ad-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); for (const [k, el] of Object.entries(panes)) el.hidden = k !== t; body.scrollTop = 0; if (t === 'dash') dash(); else if (t === 'players') { if (!panes.players.querySelector('#ad-list').children.length) search(); } else if (t === 'send') panes.send.load && panes.send.load(); else if (t === 'event') panes.event.show && panes.event.show(); else if (t === 'ideas') { if (!ideasUi) ideasUi = mountIdeas(panes.ideas, { call: (fn, args) => api.call(fn, args), name: () => 'admin', askName() {}, isAdmin: () => true, toast: api.toast, vib: api.vib || (() => {}) }); ideasUi.refresh(); } }
  for (const k of ['dash', 'players', 'send', 'event', 'ideas', 'tools']) { const el = make('div'); el.style.cssText = 'display:flex;flex-direction:column;gap:10px'; el.hidden = true; panes[k] = el; body.append(el); }
  buildPlayers(); buildSend(); buildEvent(); buildTools();
  m.querySelector('.ad-tabs').addEventListener('click', (e) => { const t = e.target.dataset.t; if (t) setTab(t); });
  m.querySelector('#ad-x2').addEventListener('click', () => m.classList.remove('on'));
  return { open() { m.classList.add('on'); setTab(tab); } };
}
