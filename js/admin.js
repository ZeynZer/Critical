// Critical — panneau d'administration. Il n'est proposé que si le SERVEUR a reconnu le compte comme admin (pulse.admin) ;
// chaque action est de toute façon refusée par la base si le compte n'est pas admin.
// api : { call(fn, args), toast(txt), local: { eclats(n), xp(n), unlock() } }
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
#ad-m .card{max-width:440px;align-items:stretch;gap:10px}#ad-m h2{text-align:center;margin:0}#ad-m h3{margin:6px 0 0;font:700 11px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#ffc247}
#ad-m select{height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#fff;padding:0 10px;font:600 14px var(--font);flex:1;min-width:0}
#ad-m input{height:42px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#fff;padding:0 12px;font:600 14px var(--font);outline:none;user-select:text;-webkit-user-select:text;min-width:0}
.ad-r{display:flex;gap:8px}.ad-r input{flex:1}.ad-b{height:40px;padding:0 14px;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font:700 12px var(--font);flex:none}.ad-b.d{border-color:rgba(255,106,138,.6);color:#ff8aa0}.ad-b.go{background:rgba(93,255,192,.18);border-color:rgba(93,255,192,.5)}.ad-b:active{transform:scale(.95)}
#ad-list{display:flex;flex-direction:column;gap:5px;max-height:26vh;overflow-y:auto;scrollbar-width:none;touch-action:pan-y}#ad-list::-webkit-scrollbar{display:none}
.ad-p{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;text-align:left;font:600 13px var(--font)}.ad-p.on{border-color:#4df3ff;background:rgba(77,243,255,.12)}.ad-p span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ad-p small{color:rgba(255,255,255,.6);font-size:11px}.ad-p u{width:8px;height:8px;border-radius:50%;background:#5dffc0;box-shadow:0 0 8px #5dffc0}.ad-p s{color:#ff8aa0;text-decoration:none;font-size:10px;font-weight:800}
#ad-act{display:flex;flex-wrap:wrap;gap:6px}#ad-act:empty{display:none}.ad-sel{font:700 14px var(--font);color:#fff}
`;
export function mount(api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  const m = make('div', 'modal', `<div class="card glass"><h2>Administration</h2>
<div class="ad-r"><input id="ad-q" placeholder="Chercher un joueur" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="ad-b" id="ad-go">Chercher</button></div>
<div id="ad-list"></div><p class="ad-sel" id="ad-sel"></p><div id="ad-act"></div>
<h3>Cadeau pour le joueur choisi</h3><div class="ad-r"><input id="ad-e" inputmode="numeric" placeholder="Éclats"><input id="ad-x" inputmode="numeric" placeholder="XP"></div><div class="ad-r"><select id="ad-pk"><option value="">Aucun pack</option><option value="etoile">Pack Étoile</option><option value="nebuleuse">Pack Nébuleuse</option><option value="galaxie">Pack Galaxie</option></select><input id="ad-pn" inputmode="numeric" placeholder="Nombre" style="max-width:96px"></div><div class="ad-r"><input id="ad-n" placeholder="Message (facultatif)" maxlength="80"><button class="ad-b go" id="ad-gift">Offrir</button></div>
<h3>Annonce pour tous</h3><div class="ad-r"><input id="ad-t" placeholder="Texte de l'annonce" maxlength="200"><button class="ad-b go" id="ad-ann">Envoyer</button></div><div class="ad-r"><button class="ad-b" id="ad-clr">Effacer les annonces</button></div>
<h3>Sur cet appareil</h3><div id="ad-loc" class="ad-r" style="flex-wrap:wrap"><button class="ad-b" data-k="e">+10 000 Éclats</button><button class="ad-b" data-k="x">+1 000 XP</button><button class="ad-b" data-k="u">Tout débloquer</button><button class="ad-b" data-k="p">+3 packs de chaque</button></div>
<h3>Tester l'ouverture de pack (aperçu gratuit)</h3><div id="ad-t2" class="ad-r" style="flex-wrap:wrap"><button class="ad-b" data-r="0">Commune</button><button class="ad-b" data-r="2">Rare</button><button class="ad-b" data-r="3">Épique</button><button class="ad-b" data-r="4">Légendaire</button><button class="ad-b" data-r="5">Cosmique</button></div>
<div class="btns"><button class="big primary" id="ad-x2">Fermer</button></div></div>`); m.id = 'ad-m'; document.body.append(m);
  const $ = (s) => m.querySelector(s); let sel = null, armed = null;
  const run = async (fn, args, ok) => { try { const r = await api.call(fn, args); api.toast(ok || 'Fait'); return r || true; } catch (e) { api.toast('Refusé : ' + e.message); return null; } };
  const confirmed = (key) => { if (armed === key) { armed = null; return true; } armed = key; api.toast('Touche encore pour confirmer'); setTimeout(() => { if (armed === key) armed = null; }, 3000); return false; }; // actions destructrices : deux appuis
  async function search() {
    const rows = await run('admin_players', { p_query: $('#ad-q').value, p_limit: 30 }, 'Liste à jour'); if (!rows || rows === true) return; const list = $('#ad-list'); list.textContent = '';
    for (const p of rows) { const b = make('button', 'ad-p' + (sel === p.name ? ' on' : ''), `${p.online ? '<u></u>' : ''}<span>${esc(p.name)}${p.admin ? ' ★' : ''}</span>${p.banned ? '<s>BANNI</s>' : ''}<small>niv ${p.level} · ${p.score != null ? Number(p.score).toLocaleString('fr-FR') : '–'}</small>`); b.addEventListener('click', () => pick(p)); list.append(b); }
  }
  function pick(p) {
    sel = p.name; $('#ad-sel').textContent = `Joueur : ${p.name}${p.banned ? ' (banni)' : ''}`; const act = $('#ad-act'); act.textContent = ''; if (p.admin) return;
    const add = (txt, cls, f) => { const b = make('button', 'ad-b ' + cls, txt); b.addEventListener('click', f); act.append(b); };
    add(p.banned ? 'Débannir' : 'Bannir', 'd', async () => { if (confirmed('ban')) { await run('admin_ban', { p_name: p.name, p_value: !p.banned }, p.banned ? 'Débanni' : 'Banni'); search(); } });
    add('Ouvrir la reprise 30 min', '', () => run('admin_open_claim', { p_name: p.name, p_minutes: 30 }, 'Reprise ouverte 30 min'));
    add('Renommer', '', async () => { const n = prompt('Nouveau pseudo pour ' + p.name); if (n) { await run('admin_rename', { p_name: p.name, p_new: n }, 'Renommé'); sel = n; search(); } });
    add('Effacer ses scores', 'd', () => confirmed('rs') && run('admin_reset_scores', { p_name: p.name }, 'Scores effacés'));
    add('Supprimer le compte', 'd', async () => { if (confirmed('del')) { await run('admin_delete', { p_name: p.name }, 'Compte supprimé'); sel = null; act.textContent = ''; $('#ad-sel').textContent = ''; search(); } });
    document.querySelectorAll('#ad-list .ad-p').forEach((b) => b.classList.toggle('on', b.textContent.startsWith(p.name)));
  }
  $('#ad-go').addEventListener('click', search); $('#ad-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
  $('#ad-gift').addEventListener('click', () => { if (!sel) return api.toast('Choisis un joueur'); const d = parseInt($('#ad-e').value, 10) || 0, x = parseInt($('#ad-x').value, 10) || 0, pk = $('#ad-pk').value || null, pn = parseInt($('#ad-pn').value, 10) || (pk ? 1 : 0); if (!d && !x && !pk) return api.toast('Indique des Éclats, de l\'XP ou un pack'); run('admin_gift', { p_name: sel, p_eclats: d, p_xp: x, p_note: $('#ad-n').value, p_pack: pk, p_pack_n: pn }, `Cadeau envoyé à ${sel}`); });
  $('#ad-ann').addEventListener('click', () => $('#ad-t').value.trim() && run('admin_announce', { p_text: $('#ad-t').value, p_minutes: 60 }, 'Annonce envoyée (1 h)'));
  $('#ad-clr').addEventListener('click', () => run('admin_announce_clear', {}, 'Annonces effacées'));
  $('#ad-loc').addEventListener('click', (e) => { const k = e.target.dataset.k; if (k) { api.local[k](); api.toast('Fait sur cet appareil'); } });
  $('#ad-t2').addEventListener('click', (e) => { const r = e.target.dataset.r; if (r !== undefined) { m.classList.remove('on'); api.local.test(+r); } });
  $('#ad-x2').addEventListener('click', () => m.classList.remove('on'));
  return { open() { m.classList.add('on'); search(); } };
}
