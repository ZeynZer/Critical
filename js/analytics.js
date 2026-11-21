// Critical — console admin › Analyse : courbes, répartitions, rétention, constats automatiques et export (JSON, CSV, rapport Markdown prêt à donner à une autre IA).
// Les chiffres viennent d'une seule fonction serveur (admin_analytics, voir supabase/schema.sql) ; la collecte est anonyme (js/telemetry.js).
// build(box, { load(jours) → données, tierName(rang) → nom, toast(txt) })
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 0) => (Number.isFinite(+n) ? (+n).toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–');
const dur = (s) => { s = Math.round(+s || 0); return !s ? '0' : s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1).replace('.', ',')} h`; };
const pc = (a, b) => (b > 0 ? (100 * a) / b : 0);
const COL = { c: '#4df3ff', m: '#ff4fd8', g: '#ffc247', k: '#5dffc0', v: '#b46bff' };
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const dd = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const CSS = `
.an-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.an-top .an-chip{height:34px;padding:0 13px;border-radius:17px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;font:700 12px var(--font)}.an-top .an-chip.on{background:rgba(255,194,71,.22);border-color:rgba(255,194,71,.6)}
.an-top small{flex:1;min-width:140px;text-align:right;font-size:10.5px;color:rgba(255,255,255,.45)}
.an-g{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.an-k{padding:10px 5px 8px;border-radius:15px;text-align:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.an-k b{display:block;font:800 16px var(--disp);color:#fff}.an-k span{display:block;margin-top:2px;font-size:9.5px;line-height:1.25;color:rgba(255,255,255,.55)}.an-k.hot b{color:#5dffc0}
.an-in{display:flex;flex-direction:column;gap:6px}.an-in div{display:flex;gap:8px;padding:8px 10px;border-radius:12px;font-size:12px;line-height:1.4;background:rgba(255,255,255,.05);border-left:3px solid #4df3ff}.an-in .warn{border-color:#ffc247}.an-in .bad{border-color:#ff6a8a}.an-in .ok{border-color:#5dffc0}
.an-ch{position:relative;touch-action:pan-y}.an-ch svg{display:block;width:100%;height:auto;overflow:visible}.an-ch text{font:600 9px system-ui;fill:rgba(255,255,255,.5)}.an-ch .t{fill:rgba(255,255,255,.85)}
.an-rd{min-height:15px;font-size:10.5px;color:rgba(255,255,255,.75)}.an-lg{display:flex;gap:12px;flex-wrap:wrap;font-size:10.5px;color:rgba(255,255,255,.65)}.an-lg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.an-hb{display:flex;flex-direction:column;gap:4px}.an-hb div{display:grid;grid-template-columns:minmax(70px,32%) 1fr auto;align-items:center;gap:8px;font-size:11px}.an-hb span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,.75)}.an-hb u{height:9px;border-radius:5px;background:rgba(255,255,255,.07);position:relative;text-decoration:none;overflow:hidden}.an-hb u i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.an-hb b{font:700 10.5px var(--disp);min-width:34px;text-align:right}
.an-heat{display:grid;grid-template-columns:24px repeat(24,1fr);gap:2px;font-size:8px;color:rgba(255,255,255,.5)}.an-heat i{aspect-ratio:1;border-radius:3px;background:#4df3ff}.an-heat span{display:grid;place-items:center}
.an-tb{width:100%;border-collapse:collapse;font-size:11px}.an-tb th{font:700 9.5px var(--disp);letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);text-align:right;padding:4px 3px}.an-tb th:first-child,.an-tb td:first-child{text-align:left}.an-tb td{padding:6px 3px;text-align:right;border-top:1px solid rgba(255,255,255,.07)}
.an-ex{display:flex;flex-direction:column;gap:7px}.an-ex .ad-b{height:44px;text-align:left;display:flex;align-items:center;gap:10px}.an-ex small{display:block;font-weight:500;font-size:10px;color:rgba(255,255,255,.55)}
`;
let styled = false;

/* ---------- graphiques ---------- */
const nice = (mx) => { if (mx <= 0) return 1; const p = 10 ** Math.floor(Math.log10(mx)), f = mx / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
function lineChart(labels, series, o = {}) { // series : [{ n, c, v: [] }] ; survol / toucher : valeurs du jour dans la ligne du dessus
  const box = make('div', 'an-ch'), W = 340, H = o.h || 140, L = 30, R = 8, T = 8, B = 18, N = labels.length; const rd = make('div', 'an-rd', '&nbsp;'); box.append(rd);
  const mx = nice(Math.max(1, ...series.flatMap((s) => s.v))), X = (i) => L + (N < 2 ? (W - L - R) / 2 : (i * (W - L - R)) / (N - 1)), Y = (v) => T + (H - T - B) * (1 - v / mx);
  let g = '';
  for (let k = 0; k <= 4; k++) { const y = T + ((H - T - B) * k) / 4; g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.08)"/><text x="${L - 4}" y="${y + 3}" text-anchor="end">${fmt((mx * (4 - k)) / 4, mx < 8 ? 1 : 0)}${o.unit || ''}</text>`; }
  const ticks = N <= 1 ? [0] : [0, Math.round((N - 1) / 2), N - 1]; for (const i of ticks) g += `<text x="${X(i)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle'}">${esc(labels[i])}</text>`;
  series.forEach((s, si) => { const pts = s.v.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' '); if (si === 0 && N > 1) g += `<defs><linearGradient id="ag${o.id || 0}${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".35"/><stop offset="1" stop-color="${s.c}" stop-opacity="0"/></linearGradient></defs><polygon points="${X(0)},${Y(0)} ${pts} ${X(N - 1)},${Y(0)}" fill="url(#ag${o.id || 0}${si})"/>`;
    g += N > 1 ? `<polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''; if (N <= 31) g += s.v.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${N > 20 ? 1.6 : 2.4}" fill="${s.c}"/>`).join(''); });
  g += `<line id="gd" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.5)" stroke-dasharray="3 3" visibility="hidden"/><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
  const sv = make('div'); sv.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">${g}</svg>`; box.append(sv); const svg = sv.firstChild, guide = svg.querySelector('#gd');
  const show = (e) => { const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, i = Math.max(0, Math.min(N - 1, Math.round(((x - L) / (W - L - R)) * (N - 1)))); guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i)); guide.setAttribute('visibility', 'visible'); rd.innerHTML = `<b>${esc(labels[i])}</b> · ` + series.map((s) => `<span style="color:${s.c}">${esc(s.n)} ${fmt(s.v[i], 1)}${o.unit || ''}</span>`).join(' · '); };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show);
  if (series.length > 1 || o.legend) box.append(Object.assign(make('div', 'an-lg'), { innerHTML: series.map((s) => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join('') }));
  return box;
}
function barChart(items, o = {}) { // histogramme vertical : items [{ k, n }]
  const W = 340, H = o.h || 120, B = 22, T = 14, N = items.length || 1, mx = Math.max(1, ...items.map((x) => x.n)), bw = (W - 10) / N; let g = '';
  items.forEach((x, i) => { const h = ((H - B - T) * x.n) / mx, cx = 5 + i * bw + bw / 2; g += `<rect x="${cx - bw * 0.36}" y="${H - B - h}" width="${bw * 0.72}" height="${Math.max(h, 0.5)}" rx="4" fill="${o.c || COL.c}" opacity="${x.n ? 0.9 : 0.25}"/>${N <= 12 || o.vals ? `<text class="t" x="${cx}" y="${H - B - h - 4}" text-anchor="middle">${fmt(x.n, 1)}</text>` : ''}<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(x.k)}</text>`; });
  const b = make('div', 'an-ch'); b.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">${g}</svg>`; return b;
}
function hbars(items, o = {}) { // lignes : libellé, barre, valeur
  const mx = Math.max(1e-9, ...items.map((x) => x.n)), b = make('div', 'an-hb');
  for (const x of items) b.append(make('div', '', `<span title="${esc(x.k)}">${esc(x.k)}</span><u><i style="width:${(100 * x.n) / mx}%;background:${o.c || COL.c}"></i></u><b>${o.pct ? fmt(x.n, 1) + ' %' : fmt(x.n)}${x.s ? ` <small style="color:rgba(255,255,255,.45);font-weight:500">${esc(x.s)}</small>` : ''}</b>`));
  if (!items.length) b.append(make('p', '', 'Pas encore de données.')); return b;
}
function heat(cells) { // jours × heures : secondes de jeu
  const m = Array.from({ length: 7 }, () => Array(24).fill(0)); for (const [d, h, s] of cells) m[d][h] += s; const mx = Math.max(1, ...m.flat()), g = make('div', 'an-heat'), order = [1, 2, 3, 4, 5, 6, 0];
  g.append(make('span')); for (let h = 0; h < 24; h++) g.append(make('span', '', h % 6 === 0 ? String(h) : '')); for (const d of order) { g.append(make('span', '', DOW[d])); for (let h = 0; h < 24; h++) { const i = make('i'); const v = m[d][h] / mx; i.style.opacity = (0.06 + v * 0.94).toFixed(2); i.title = `${DOW[d]} ${h} h : ${dur(m[d][h])}`; g.append(i); } }
  return g;
}

/* ---------- constats et rapport ---------- */
function stats(a) { // chiffres dérivés, communs à l'écran et au rapport
  const dl = a.daily || [], last = dl[dl.length - 1] || {}, tot = (k) => dl.reduce((s, x) => s + (+x[k] || 0), 0), dev = a.span.devices || 0, runs = a.runs.total || 0, mau = +a.mau || 0;
  const act = dl.filter((x) => x.dau > 0), avgDau = act.length ? tot('dau') / act.length : 0, ret = Object.fromEntries((a.retention || []).map((r) => [r.d, r.base ? pc(r.kept, r.base) : null]));
  const tr = (a.runs.tier_reach || []).map((x) => x.n), drop = []; for (let i = 1; i < tr.length; i++) if (tr[i - 1] > 4) drop.push({ t: i + 1, from: pc(tr[i - 1], runs), to: pc(tr[i], runs), loss: 1 - tr[i] / tr[i - 1] });
  const hod = a.hod || [], peak = hod.reduce((m, x) => (x.avg > (m.avg || 0) ? x : m), {}), over = a.runs.modes.find((m) => m.k === 'classic'), fps = a.runs.modes.filter((m) => m.fps), runN = a.runs.modes.reduce((s, m) => s + m.n, 0);
  const secsHist = a.runs.secs_hist || [], short = secsHist.filter((x) => /< 30 s|30-60 s/.test(x.k)).reduce((s, x) => s + x.n, 0);
  return { last, dev, runs, mau, avgDau, ret, drop, peak, over, fps, runN, short, secs: tot('secs'), errors: tot('errors'), newPlayers: tot('new_players'), stick: mau ? pc(last.dau || 0, mau) : 0, perDevice: a.runs.per_device, installed: pc(a.span.installed, dev), sess: a.devices.secs_per_session,
    fpsAvg: fps.length ? fps.reduce((s, m) => s + m.fps * m.n, 0) / fps.reduce((s, m) => s + m.n, 0) : 0 };
}
function insights(a, S, tn) {
  const o = [], add = (lv, t) => o.push({ lv, t });
  if (!S.dev) { add('info', "Aucune donnée de télémétrie pour l'instant : la collecte démarre avec cette version du jeu et se remplit à chaque partie (statistiques anonymes, activées par défaut)."); return o; }
  if (S.dev < 30) add('info', `Échantillon encore petit (${S.dev} appareils) : les pourcentages bougent beaucoup, lis-les comme des tendances.`);
  const r1 = S.ret[1], r7 = S.ret[7]; if (r1 != null) add(r1 >= 35 ? 'ok' : r1 >= 20 ? 'info' : 'warn', `Rétention J1 : ${fmt(r1, 0)} % des joueurs reviennent le lendemain (repère de jeu mobile : 25–40 %).`); if (r7 != null) add(r7 >= 12 ? 'ok' : r7 >= 6 ? 'info' : 'warn', `Rétention J7 : ${fmt(r7, 0)} % (repère : 8–15 %).`);
  if (S.stick) add(S.stick >= 20 ? 'ok' : S.stick >= 10 ? 'info' : 'warn', `Stickiness (actifs du jour / actifs sur 30 j) : ${fmt(S.stick, 0)} % — mesure l'habitude de jouer ; 20 % et plus est très bon.`);
  if (a.devices.secs_per_session) add(a.devices.secs_per_session < 150 ? 'warn' : 'info', `Une session dure en moyenne ${dur(a.devices.secs_per_session)} ; le joueur médian a joué ${dur(a.devices.secs_median)} au total.`);
  if (S.runs) add(S.short / S.runs > 0.35 ? 'warn' : 'info', `${fmt(pc(S.short, S.runs), 0)} % des parties durent moins d'une minute${S.short / S.runs > 0.35 ? ' : abandon précoce, difficulté ou compréhension du principe à vérifier' : ''}.`);
  if (S.drop.length) { const w = S.drop.slice().sort((x, y) => y.loss - x.loss)[0]; add('warn', `Plus gros palier de perte : de « ${tn(w.t - 1)} » (${fmt(w.from, 0)} % des parties) à « ${tn(w.t)} » (${fmt(w.to, 0)} %) : ${fmt(100 * w.loss, 0)} % des parties s'arrêtent là.`); }
  if (S.peak.h != null && S.peak.avg > 0) add('info', `Pic d'activité vers ${S.peak.h} h (UTC) : ${fmt(S.peak.avg, 1)} appareils actifs en moyenne sur l'heure. Idéal pour lancer un événement ou une annonce.`);
  if (S.dev >= 10) add(S.installed < 10 ? 'warn' : 'info', `${fmt(S.installed, 0)} % des appareils ont installé le jeu sur l'écran d'accueil${S.installed < 10 ? ' : le guide d\'installation est peu suivi' : ''}.`);
  if (S.fpsAvg) add(S.fpsAvg < 40 ? 'bad' : S.fpsAvg < 52 ? 'warn' : 'ok', `Fluidité moyenne en partie : ${fmt(S.fpsAvg, 0)} images/s${S.fpsAvg < 52 ? ' — des appareils peinent, voir le détail par plateforme et le mode économie d\'effets' : ''}.`);
  if (S.errors) add('bad', `${fmt(S.errors)} erreur(s) JavaScript sur la période (liste détaillée plus bas).`); else add('ok', 'Aucune erreur JavaScript remontée sur la période.');
  const pf = a.devices.platform; if (pf.length > 1) add('info', `Plateformes : ` + pf.slice(0, 4).map((x) => `${x.k} ${fmt(pc(x.n, S.dev), 0)} %`).join(', ') + '.');
  return o;
}
const csvOf = (a) => ['jour,joueurs_actifs,nouveaux_appareils,secondes_jouees,parties,duree_moy_partie_s,score_moyen,nouveaux_inscrits,duels,erreurs', ...(a.daily || []).map((x) => [x.day, x.dau, x.new_devices, x.secs, x.runs, x.run_secs, x.avg_score, x.new_players, x.duels, x.errors].join(','))].join('\n');
function reportMd(a, S, notes, tn) {
  const t = (rows, head) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n` + rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  const L = [];
  L.push(`# Critical — rapport d'analyse (${a.days} derniers jours, généré le ${new Date(a.generated).toLocaleString('fr-FR')})`, '',
    '## Contexte du jeu', 'Critical est un jeu mobile (PWA, JavaScript, Supabase) de fusion d\'astres façon « Suika » : on lâche des astres dans une cuve, deux astres identiques fusionnent en un astre plus grand (13 rangs, de la poussière à la galaxie), la partie se termine quand la cuve déborde.',
    'Modes : Univers (partie classique à secteurs), Blitz (cuve basse, tempo et combos, temps qui se recharge), Défi du jour, Duel 1v1 en temps réel sur une cuve partagée (classement Elo), Bac à sable. Boucle de progression : XP/niveaux, Voidium (monnaie), packs d\'astres (raretés, variantes, pity), collection, deck de pouvoirs équipables, quêtes/défis, classement mondial, profils personnalisables, boîte à idées, événements collaboratifs (« Grande Cuve »).',
    '', '## Fiabilité des données', `- Télémétrie anonyme (identifiant d'appareil aléatoire, aucun pseudo). Les joueurs peuvent la couper : les chiffres sont un **échantillon** des joueurs réels.`, `- Première donnée : ${a.span.first ? new Date(a.span.first).toLocaleDateString('fr-FR') : 'aucune'} · ${fmt(S.dev)} appareils observés, ${fmt(S.runs)} parties sur la période.`,
    '- Temps de jeu = secondes avec écran visible et action récente (inactivité > 90 s non comptée). Jours en UTC. FPS plafonné à 20 par image lente (estimation).', '- Les « joueurs inscrits » (table players) sont ceux qui ont choisi un pseudo : sous-ensemble des appareils.', '',
    '## Chiffres clés', t([['Appareils (total)', fmt(S.dev)], ['Actifs sur 24 h (dernier jour)', fmt(S.last.dau)], ['Actifs 7 j / 30 j', `${fmt(a.wau)} / ${fmt(a.mau)}`], ['Stickiness DAU/MAU', `${fmt(S.stick, 1)} %`], ['Durée moyenne d\'une session', dur(a.devices.secs_per_session)], ['Temps de jeu total (période)', dur(S.secs)],
      ['Parties (période)', fmt(S.runs)], ['Parties par appareil actif', fmt(S.perDevice, 1)], ['Appareils installés (écran d\'accueil)', `${fmt(S.installed, 0)} %`], ['Nouveaux inscrits (période)', fmt(S.newPlayers)], ['Erreurs JS (période)', fmt(S.errors)], ['FPS moyen en partie', S.fpsAvg ? fmt(S.fpsAvg, 0) : 'n/d']], ['Indicateur', 'Valeur']),
    '', '## Constats automatiques', ...notes.map((n) => `- [${n.lv}] ${n.t}`), '', '## Rétention (par appareil, jour N après la première visite)', t((a.retention || []).map((r) => [`J${r.d}`, fmt(r.base), fmt(r.kept), r.base ? `${fmt(pc(r.kept, r.base), 1)} %` : 'n/d']), ['Jour', 'Appareils éligibles', 'Revenus', 'Taux']),
    '', '## Parties par mode', t(a.runs.modes.map((m) => [m.k, fmt(m.n), fmt(m.avg_score), dur(m.avg_secs), `${fmt(m.over, 1)} %`, fmt(m.avg_drops), m.fps ? fmt(m.fps) : 'n/d']), ['Mode', 'Parties', 'Score moyen', 'Durée moyenne', 'Effondrements', 'Lâchers moyens', 'FPS']),
    '', '## Progression : part des parties atteignant chaque rang', t((a.runs.tier_reach || []).map((x) => [`${x.t} — ${tn(x.t)}`, fmt(x.n), `${fmt(pc(x.n, S.runs), 1)} %`]), ['Rang', 'Parties', 'Part']),
    '', '## Répartitions', '### Durée de jeu cumulée par appareil', t(a.devices.secs_hist.map((x) => [x.k, x.n]), ['Tranche', 'Appareils']), '### Durée d\'une partie', t(a.runs.secs_hist.map((x) => [x.k, x.n]), ['Tranche', 'Parties']), '### Score par partie', t(a.runs.score_hist.map((x) => [x.k, x.n]), ['Tranche', 'Parties']),
    '### Niveau des joueurs inscrits', t(a.players.levels.map((x) => [x.k, x.n]), ['Niveau', 'Joueurs']), '### Temps de jeu des joueurs inscrits', t(a.players.playtime_hist.map((x) => [x.k, x.n]), ['Tranche', 'Joueurs']),
    '', '## Appareils', `Plateformes : ${a.devices.platform.map((x) => `${x.k} ${x.n}`).join(', ') || 'n/d'}`, `Langues : ${a.devices.lang.map((x) => `${x.k} ${x.n}`).join(', ') || 'n/d'}`, `Écrans : ${a.devices.screen.map((x) => `${x.k} ${x.n}`).join(', ') || 'n/d'}`, `Versions : ${a.devices.ver.map((x) => `${x.k} ${x.n}`).join(', ') || 'n/d'}`,
    '', '## Usage des fonctionnalités (compteurs d\'événements)', t(a.events.map((e) => [e.k, fmt(e.n), fmt(e.devs)]), ['Événement', 'Total', 'Appareils distincts']),
    '', '## Erreurs JavaScript', a.errors.length ? t(a.errors.map((e) => [e.k || '(sans texte)', e.n, new Date(e.last).toLocaleString('fr-FR')]), ['Erreur', 'Occurrences', 'Dernière']) : 'Aucune.',
    '', '## Joueurs inscrits', `Total ${fmt(a.players.total)} (bannis ${fmt(a.players.banned)}), niveau moyen ${a.players.avg_level}, temps de jeu moyen ${dur(a.players.playtime_avg)} (médiane ${dur(a.players.playtime_median)}), ${fmt(a.players.duelists)} duellistes (Elo moyen ${a.players.elo_avg}), ${fmt(a.players.event_players)} participants à des événements, ${fmt(a.players.ideas)} idées, ${fmt(a.players.likes)} likes.`,
    '', '## Série journalière', t((a.daily || []).map((x) => [x.day, x.dau, x.new_devices, dur(x.secs), x.runs, dur(x.run_secs), fmt(x.avg_score), x.new_players, x.duels, x.errors]), ['Jour', 'Actifs', 'Nouveaux appareils', 'Temps de jeu', 'Parties', 'Durée partie', 'Score moy.', 'Inscrits', 'Duels', 'Erreurs']),
    '', '## Consigne pour l\'analyse', 'Tu es analyste produit / game designer spécialisé jeux mobiles casual. À partir de ces données :',
    '1. Dresse un diagnostic : où perd-on les joueurs (premières minutes, premiers jours, après quel rang) ? Quels modes/fonctions sont sous-utilisés ?',
    '2. Évalue l\'équilibrage : durée et difficulté des parties, paliers de progression, fréquence des effondrements, économie (packs, Voidium).',
    '3. Repère les risques techniques (erreurs, fluidité par plateforme) et les opportunités (heures de pic, installation PWA, événements).',
    '4. Propose 10 améliorations priorisées (impact × effort), chacune avec l\'hypothèse, la métrique à suivre et un test A/B possible.',
    '5. Dis quelles données manquent encore pour trancher et quels compteurs ajouter.', '', '## Données brutes (JSON)', '```json', JSON.stringify(a), '```', '');
  return L.join('\n');
}
function save(name, text, type) { const url = URL.createObjectURL(new Blob([text], { type })), a = make('a'); a.href = url; a.download = name; document.body.append(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000); }

/* ---------- écran ---------- */
export function build(box, api) {
  if (!styled) { styled = true; const s = make('style'); s.textContent = CSS; document.head.appendChild(s); }
  const tn = (t) => (api.tierName ? api.tierName(Math.max(0, Math.min(12, t))) : 'Rang ' + t); let days = +localStorage.getItem('critical.an.days') || 30, data = null, busy = false;
  const top = make('div', 'an-top'), out = make('div'); out.style.cssText = 'display:flex;flex-direction:column;gap:10px'; box.append(top, out);
  async function load() {
    if (busy) return; busy = true; out.innerHTML = '<p>Analyse en cours…</p>'; const a = await api.load(days); busy = false; if (!a || a === true) { out.innerHTML = '<p>Analyse indisponible : colle la dernière version de supabase/schema.sql dans Supabase (SQL Editor).</p>'; return; }
    data = a; paint();
  }
  function head() { top.textContent = ''; for (const d of [7, 30, 90, 365]) { const b = make('button', 'an-chip' + (d === days ? ' on' : ''), d === 365 ? '1 an' : d + ' j'); b.addEventListener('click', () => { days = d; try { localStorage.setItem('critical.an.days', d); } catch (e) { /* ignore */ } head(); load(); }); top.append(b); } const r = make('button', 'an-chip', '↻'); r.setAttribute('aria-label', 'Actualiser'); r.addEventListener('click', load); top.append(r, make('small', '', data ? 'Mis à jour ' + new Date(data.generated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '')); }
  const sec = (title, ...k) => { const s = make('div', 'ad-sec'); if (title) s.append(make('h3', '', title)); s.append(...k); return s; };
  const k = (v, l, c) => `<div class="an-k ${c || ''}"><b>${v}</b><span>${l}</span></div>`;
  function paint() {
    head(); const a = data, S = stats(a), notes = insights(a, S, tn), lab = (a.daily || []).map((x) => dd(x.day)); out.textContent = '';
    const g = make('div', 'an-g'); g.innerHTML = k(fmt(S.dev), 'appareils observés') + k(fmt(a.now.devices) + ' / ' + fmt(a.now.players), 'en ligne (anonymes / pseudos)', 'hot') + k(fmt(S.last.dau), 'actifs aujourd\'hui') + k(fmt(a.wau), 'actifs 7 j') + k(fmt(a.mau), 'actifs 30 j') + k(fmt(S.stick, 0) + ' %', 'stickiness DAU/MAU')
      + k(dur(a.devices.secs_per_session), 'durée moy. de session') + k(dur(S.secs), 'temps de jeu (période)') + k(fmt(S.runs), 'parties (période)') + k(fmt(S.perDevice, 1), 'parties / appareil actif') + k(fmt(S.installed, 0) + ' %', 'installés (écran d\'accueil)') + k(S.ret[1] != null ? fmt(S.ret[1], 0) + ' %' : '–', 'rétention J1') + k(S.ret[7] != null ? fmt(S.ret[7], 0) + ' %' : '–', 'rétention J7') + k(fmt(S.newPlayers), 'nouveaux inscrits') + k(fmt(S.errors), 'erreurs JS', S.errors ? 'bad' : '');
    const ins = make('div', 'an-in'); ins.innerHTML = notes.map((n) => `<div class="${n.lv}">${esc(n.t)}</div>`).join('');
    out.append(sec('Vue d\'ensemble', g), sec('Constats automatiques', ins));
    out.append(sec('Joueurs actifs par jour', lineChart(lab, [{ n: 'actifs', c: COL.c, v: a.daily.map((x) => x.dau) }, { n: 'nouveaux appareils', c: COL.m, v: a.daily.map((x) => x.new_devices) }], { id: 1, title: 'Joueurs actifs par jour' })),
      sec('Temps de jeu par jour (heures)', lineChart(lab, [{ n: 'heures', c: COL.k, v: a.daily.map((x) => +(x.secs / 3600).toFixed(2)) }], { id: 2, unit: ' h', title: 'Temps de jeu' })),
      sec('Temps de jeu moyen par joueur actif (minutes)', lineChart(lab, [{ n: 'minutes / actif', c: COL.g, v: a.daily.map((x) => (x.dau ? +(x.secs / 60 / x.dau).toFixed(1) : 0)) }], { id: 3, unit: ' min', title: 'Temps par joueur' })),
      sec('Parties par jour', lineChart(lab, [{ n: 'parties', c: COL.v, v: a.daily.map((x) => x.runs) }, { n: 'duels', c: COL.g, v: a.daily.map((x) => x.duels) }], { id: 4, title: 'Parties' })),
      sec('Durée moyenne d\'une partie (secondes) et score moyen', lineChart(lab, [{ n: 'durée (s)', c: COL.c, v: a.daily.map((x) => x.run_secs) }], { id: 5, unit: ' s', title: 'Durée de partie' }), lineChart(lab, [{ n: 'score moyen', c: COL.m, v: a.daily.map((x) => x.avg_score) }], { id: 6, title: 'Score moyen' })),
      sec('Nouveaux inscrits (pseudo choisi) et erreurs', lineChart(lab, [{ n: 'inscrits', c: COL.k, v: a.daily.map((x) => x.new_players) }, { n: 'erreurs JS', c: '#ff6a8a', v: a.daily.map((x) => x.errors) }], { id: 7, title: 'Inscrits et erreurs' })));
    out.append(sec('Quand jouent-ils ? (heure UTC, jours × heures)', heat(a.heat || []), make('p', '', 'Plus la case est claire, plus le temps de jeu cumulé est élevé. Survole pour la durée exacte.')),
      sec('Appareils actifs par heure (moyenne)', barChart((a.hod || []).filter((x, i) => i % 1 === 0).map((x) => ({ k: x.h % 3 === 0 ? String(x.h) : '', n: +x.avg })), { c: COL.g, title: 'Activité par heure' })));
    out.append(sec('Rétention : reviennent-ils ?', hbars((a.retention || []).map((r) => ({ k: `Jour ${r.d}`, n: r.base ? pc(r.kept, r.base) : 0, s: `${r.kept}/${r.base}` })), { pct: true, c: COL.k }), make('p', '', 'Part des appareils revus exactement N jours après leur première visite (seulement ceux assez anciens).')));
    out.append(sec('Combien de temps joue-t-on au total ? (par appareil)', barChart(a.devices.secs_hist.map((x) => ({ k: x.k.replace(' min', 'm').replace(' ', ''), n: x.n })), { title: 'Temps cumulé par appareil' })),
      sec('Durée d\'une partie', barChart(a.runs.secs_hist.map((x) => ({ k: x.k.replace(' min', 'm').replace(' ', ''), n: x.n })), { c: COL.v, title: 'Durée de partie' })), sec('Score par partie', barChart(a.runs.score_hist, { c: COL.m, title: 'Score' })));
    const tbl = make('table', 'an-tb'); tbl.innerHTML = '<tr><th>Mode</th><th>Parties</th><th>Score</th><th>Durée</th><th>Chute</th><th>FPS</th></tr>' + a.runs.modes.map((m) => `<tr><td>${esc(m.k)}</td><td>${fmt(m.n)}</td><td>${fmt(m.avg_score)}</td><td>${dur(m.avg_secs)}</td><td>${fmt(m.over, 0)} %</td><td>${m.fps || '–'}</td></tr>`).join(''); if (!a.runs.modes.length) tbl.append(make('p', '', 'Pas encore de parties.'));
    out.append(sec('Parties par mode', tbl, make('p', '', 'Chute = part des parties terminées par un effondrement (ou un défi manqué / duel perdu).')),
      sec('Progression : parties atteignant chaque rang', hbars((a.runs.tier_reach || []).map((x) => ({ k: `${x.t} · ${tn(x.t)}`, n: pc(x.n, S.runs) })), { pct: true, c: COL.c }), make('p', '', 'Une chute brutale d\'un rang au suivant montre un palier trop dur (ou une fusion peu lisible).')),
      sec('Plateformes', hbars(a.devices.platform.map((x) => ({ k: x.k, n: x.n })), { c: COL.g })), sec('Écrans et versions', hbars(a.devices.screen.map((x) => ({ k: x.k, n: x.n })), { c: COL.v }), hbars(a.devices.ver.map((x) => ({ k: x.k, n: x.n })), { c: COL.m })),
      sec('Utilisation des fonctions (compteurs)', hbars(a.events.map((e) => ({ k: e.k, n: e.n, s: `${e.devs} app.` })), { c: COL.k })),
      sec('Erreurs JavaScript', a.errors.length ? Object.assign(make('div', 'an-in'), { innerHTML: a.errors.map((e) => `<div class="bad"><span style="flex:1;word-break:break-word">${esc(e.k || '(sans texte)')}</span><b>×${e.n}</b></div>`).join('') }) : make('p', '', 'Aucune erreur remontée.')));
    out.append(sec('Joueurs inscrits (pseudo)', make('div', 'an-g', k(fmt(a.players.total), 'inscrits') + k(a.players.avg_level, 'niveau moyen') + k(dur(a.players.playtime_median), 'temps de jeu médian') + k(fmt(a.players.duelists), 'duellistes') + k(a.players.elo_avg, 'Elo moyen') + k(fmt(a.players.event_players), 'ont joué l\'événement')), barChart(a.players.levels, { c: COL.g, title: 'Niveaux' }), barChart(a.players.playtime_hist, { c: COL.k, title: 'Temps de jeu' })));
    const ex = make('div', 'an-ex'), stamp = new Date().toISOString().slice(0, 10), md = () => reportMd(a, S, notes, tn);
    const b1 = make('button', 'ad-b go', `<span style="font-size:20px">⬇</span><span>Rapport pour une IA (Markdown)<small>Contexte du jeu + chiffres + consigne d'analyse + données brutes</small></span>`); b1.addEventListener('click', () => { save(`critical-analyse-${stamp}.md`, md(), 'text/markdown'); api.toast('Rapport téléchargé'); });
    const b2 = make('button', 'ad-b', `<span style="font-size:20px">{ }</span><span>Données complètes (JSON)<small>Pour un script, un tableur avancé ou une IA</small></span>`); b2.addEventListener('click', () => { save(`critical-analyse-${stamp}.json`, JSON.stringify(a, null, 1), 'application/json'); api.toast('JSON téléchargé'); });
    const b3 = make('button', 'ad-b', `<span style="font-size:20px">▦</span><span>Série journalière (CSV)<small>S'ouvre dans Excel / Google Sheets</small></span>`); b3.addEventListener('click', () => { save(`critical-jours-${stamp}.csv`, '﻿' + csvOf(a), 'text/csv'); api.toast('CSV téléchargé'); });
    const b4 = make('button', 'ad-b', `<span style="font-size:20px">⧉</span><span>Copier le rapport<small>À coller directement dans une conversation avec une IA</small></span>`); b4.addEventListener('click', async () => { try { await navigator.clipboard.writeText(md()); api.toast('Rapport copié'); } catch (e) { api.toast('Copie impossible : utilise le téléchargement'); } });
    ex.append(b1, b4, b2, b3); if (navigator.share && navigator.canShare) { try { const f = new File([md()], `critical-analyse-${stamp}.md`, { type: 'text/markdown' }); if (navigator.canShare({ files: [f] })) { const b5 = make('button', 'ad-b', `<span style="font-size:20px">↗</span><span>Partager le fichier…<small>Mail, Drive, messagerie</small></span>`); b5.addEventListener('click', () => navigator.share({ files: [f], title: 'Analyse Critical' }).catch(() => {})); ex.append(b5); } } catch (e) { /* ignore */ } }
    out.append(sec('Exporter pour analyse approfondie', ex, make('p', '', 'Le rapport Markdown est pensé pour être donné tel quel à une autre IA : il décrit le jeu, la fiabilité des données, tous les chiffres, puis demande un diagnostic et 10 améliorations priorisées.')));
  }
  head(); return { show() { if (!data) load(); else if (Date.now() - new Date(data.generated) > 60000) load(); }, load };
}
