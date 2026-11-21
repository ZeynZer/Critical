// Critical — la Grande Cuve : événement collaboratif de plusieurs jours. Tous les joueurs posent des astres dans une cuve géante ; les astres des autres tombent en direct (l'état est relevé toutes les 2 s),
// le classement et la jauge d'objectif se mettent à jour sous les yeux. Règles et chiffres : js/cuve.js ; serveur : supabase/schema.sql (event_current, event_drop, event_claim).
// api : { call(fn, args), name(), askName(), claim() → texte, colors[rang] = [r,g,b], sprite(rang) → canvas de l'astre, accent(i) = 'r,g,b', toast(txt), vib(n), sfx() }
import { GAL_MASS, TIERS, MILESTONES, MIN_PART, pick } from './cuve.js';
import * as F from './fusion.js';
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const MAXRATE = 4; // 4 astres par seconde au plus par joueur
const dur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d} j ${String(h).padStart(2, '0')} h` : h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };
const CSS = `
#ev{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;background:radial-gradient(80% 50% at 50% 0,rgba(110,80,255,.25),transparent 70%),#04040f;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px calc(env(safe-area-inset-bottom,0px) + 10px);gap:8px;animation:ev-in .4s ease;touch-action:none;user-select:none;-webkit-user-select:none;color:#fff}@keyframes ev-in{from{opacity:0;transform:scale(1.03)}}
.ev-hd{display:flex;align-items:center;gap:10px}.ev-hd h2{flex:1;margin:0;font:900 17px var(--disp);letter-spacing:.08em;background:linear-gradient(90deg,#fff,#9ff9ff 50%,#ff9ae8);-webkit-background-clip:text;background-clip:text;color:transparent}.ev-hd small{display:block;font:500 11px var(--font);letter-spacing:0;color:rgba(255,255,255,.55);-webkit-text-fill-color:rgba(255,255,255,.55)}
.ev-x{width:42px;height:42px;border-radius:21px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font-size:17px;flex:none}
.ev-prog{position:relative;height:22px;border-radius:11px;background:rgba(255,255,255,.1);overflow:hidden}.ev-prog i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#4df3ff,#b46bff,#ff4fd8);border-radius:11px;transition:width .8s}.ev-prog b{position:absolute;inset:0;display:grid;place-items:center;font:800 11px var(--disp);text-shadow:0 1px 4px #000}.ev-prog u{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.4)}
.ev-main{position:relative;flex:1;min-height:0}.ev-side{position:absolute;left:6px;top:6px;width:118px;z-index:3;pointer-events:none;display:flex;flex-direction:column;gap:3px;background:rgba(5,6,26,.55);padding:6px;border-radius:12px}.ev-side h3{margin:0 0 2px;font:800 10px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.ev-r{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:10px;background:rgba(255,255,255,.06);font-size:11px;border:1px solid transparent}.ev-r.me{border-color:#5dffc0;background:rgba(93,255,192,.12)}.ev-r i{font:900 10px var(--disp);font-style:normal;color:rgba(255,255,255,.5);width:14px;text-align:right}.ev-r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.ev-r b{font:800 10px var(--disp)}.ev-r.up{animation:ev-up .6s}@keyframes ev-up{from{background:rgba(255,255,255,.35)}}
.ev-st{position:absolute;left:8px;bottom:8px;z-index:3;pointer-events:none;font-size:10.5px;line-height:1.45;color:rgba(255,255,255,.8);text-shadow:0 1px 3px #000;background:rgba(5,6,26,.5);padding:5px 8px;border-radius:10px}.ev-st b{color:#fff}
.ev-cv{position:absolute;inset:0;border-radius:14px;overflow:hidden;border:1.5px solid rgba(255,255,255,.2);background:#05061a;touch-action:none}.ev-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ev-ft{display:flex;align-items:center;gap:10px}.ev-nx{display:flex;align-items:center;gap:8px;font-size:11px;color:rgba(255,255,255,.7);flex:1}.ev-nx i{width:22px;height:22px;border-radius:50%;display:block;box-shadow:0 0 12px currentColor}.ev-hint{flex:1;text-align:center;font-size:11.5px;color:rgba(255,255,255,.55)}
.ev-go{height:48px;padding:0 20px;border-radius:24px;border:0;color:#fff;font:900 12px var(--disp);letter-spacing:.06em;background:linear-gradient(135deg,#5b8cff,#b46bff);flex:none}.ev-go.g{background:#5dffc0;color:#04241a}.ev-go:disabled{opacity:.4}
.ev-fin{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(4,4,15,.82);text-align:center;padding:20px}.ev-fin h3{margin:0;font:900 22px var(--disp)}.ev-fin p{margin:0;font-size:13px;color:rgba(255,255,255,.7);line-height:1.45}`;
export function mount(api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  let ev = null, off = 0, root = null, poll = 0, flushT = 0, raf = 0, info = null; const pend = [0, 0, 0, 0], falls = [], labels = [], prev = new Map(), me = { astres: 0 }; let shownMass = 0, nextT = pick(Math.random()), claimMsg = '', over = false;
  const load = async () => { try { const e = await api.call('event_current', {}); if (e) { e.mass += pend.reduce((s, c, i) => s + c * 2 ** i, 0); ev = e; off = Date.parse(e.now) - Date.now(); } return e; } catch (e) { return null; } };
  const pct = () => (ev ? Math.min(999, (ev.mass / GAL_MASS) * 100 / Math.max(1, ev.goal)) : 0);
  const left = () => (ev ? Date.parse(ev.ends) - (Date.now() + off) : 0);
  async function flush() {
    const tot = pend.reduce((a, b) => a + b, 0); if (!tot || !api.name()) return; const send = pend.map((c) => Math.min(40, c));
    try { const r = await api.call('event_drop', { p_counts: send }); for (let i = 0; i < 4; i++) pend[i] -= send[i]; me.astres = r.me; if (ev) { ev.mass = Math.max(ev.mass, r.mass); ev.astres = r.astres; } }
    catch (e) { if (e.message === 'no_event') { pend.fill(0); over = true; } /* sinon on réessaie au prochain lot */ }
  }
  /* ---------- écran ---------- */
  function open() {
    if (root) return; root = make('div'); root.id = 'ev'; over = false;
    root.innerHTML = `<div class="ev-hd"><h2><span id="ev-t">LA GRANDE CUVE</span><small id="ev-s"></small></h2><button class="ev-x" aria-label="Fermer">✕</button></div><div class="ev-prog"><i id="ev-pi"></i><b id="ev-pb"></b></div>`
      + `<div class="ev-main"><div class="ev-cv" id="ev-cv"><canvas></canvas></div><div class="ev-side"><h3>Bâtisseurs</h3><div id="ev-b"></div></div><div class="ev-st" id="ev-st"></div></div><div class="ev-ft"><div class="ev-nx"><i id="ev-ni"></i><span id="ev-nt"></span></div><button class="ev-go g" id="ev-cl" hidden>Récompenses</button></div>`;
    document.body.append(root); root.querySelector('.ev-x').addEventListener('click', close); MILESTONES.forEach(([p]) => { if (p <= 100) { const u = make('u'); u.style.left = (p / 100 * 100) + '%'; root.querySelector('.ev-prog').append(u); } });
    // — la cuve est le vrai moteur du jeu (js/fusion.js, mode bac à sable) : les astres sont plus gros, ils roulent, se touchent et fusionnent comme en partie. Les lâchers des autres joueurs y arrivent à chaque relevé.
    // Les très gros astres (rang 8 et plus) sont « envoyés » vers le tas de la Grande Cuve (la bande du bas), qui monte avec la masse réelle du serveur.
    const cv = root.querySelector('canvas'), box = root.querySelector('#ev-cv'), ctx = cv.getContext('2d'), G = F.newGame(20261121, { sandbox: true }); let W = 0, H = 0, D = 1, U = 30, aim = 0.5, holding = false, hold = 0, lastShot = 0, sent = 0;
    const fit = () => { D = Math.min(window.devicePixelRatio || 1, 2); W = box.clientWidth; H = box.clientHeight; cv.width = Math.ceil(W * D); cv.height = Math.ceil(H * D); U = W / F.W; G.ht = H / U; }; fit(); window.addEventListener('resize', fit);
    const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; };
    const bandUnits = () => { const p = ev ? Math.min(1, shownMass / (ev.goal * GAL_MASS)) : 0; return p * Math.min(G.ht * 0.45, 8); }; // le tas du fond : jusqu'à 45 % de la hauteur à l'objectif
    const fx = []; // anneaux et éclats : { x, y, r, rgb, t }
    function put(ax, tier, own, name, rgb) { // un astre entre dans la cuve à la position ax (0 à 1)
      G.cur = { k: 'c', tier }; G.cool = 0; if (!F.drop(G, ax * F.W)) return; const b = G.bodies[G.bodies.length - 1]; b.tag = { rgb: rgb || (own ? [93, 255, 192] : [255, 255, 255]), t: performance.now() };
      if (name) labels.push({ x: ax * W, y: 14, txt: name, rgb: b.tag.rgb, l: 0 });
    }
    const drop = () => { if (!ev || !ev.active || over) return; if (!api.name()) { api.askName(); return; } const now = performance.now(); if (now - lastShot < 1000 / MAXRATE) return; lastShot = now; const t = nextT; pend[t]++; me.astres++; ev.mass += 2 ** t; put(aim, t, true, '', null); nextT = pick(Math.random()); api.vib && me.astres % 6 === 0 && api.vib(5); if (pend.reduce((a, b) => a + b, 0) >= 30) flush(); };
    const aimAt = (e) => { const r = box.getBoundingClientRect(); aim = Math.max(0.03, Math.min(0.97, (e.clientX - r.left) / r.width)); };
    box.addEventListener('pointerdown', (e) => { aimAt(e); holding = true; try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } drop(); clearInterval(hold); hold = setInterval(drop, 1000 / MAXRATE + 5); });
    box.addEventListener('pointermove', (e) => { if (holding) aimAt(e); }); const rel = () => { holding = false; clearInterval(hold); }; box.addEventListener('pointerup', rel); box.addEventListener('pointercancel', rel);
    root.querySelector('#ev-cl').addEventListener('click', async () => { const b = root.querySelector('#ev-cl'); b.disabled = true; try { claimMsg = await api.claim(); api.toast(claimMsg); } catch (e) { api.toast(e.message); } b.disabled = false; render(); });
    // — affichage
    function render() {
      if (!ev) return; const p = pct(), g = Math.floor(ev.mass / GAL_MASS); root.querySelector('#ev-t').textContent = esc(ev.name).toUpperCase(); root.querySelector('#ev-s').textContent = ev.active ? `Il reste ${dur(left())} · ${fmt(ev.players)} joueur${ev.players > 1 ? 's' : ''}` : 'Événement terminé';
      root.querySelector('#ev-pi').style.width = Math.min(100, p) + '%'; root.querySelector('#ev-pb').textContent = `${fmt(g)} / ${fmt(ev.goal)} galaxies · ${Math.floor(p)} %`;
      const bd = root.querySelector('#ev-b'); const top = ev.board.slice(0, 5), mineIn = top.some((x) => x.n === api.name()); bd.textContent = '';
      top.forEach((x, i) => { const r = make('div', 'ev-r' + (x.n === api.name() ? ' me' : '')); r.innerHTML = `<i>${i + 1}</i><span>${esc(x.n)}</span><b>${fmt(x.a)}</b>`; const was = bd.dataset['k' + x.n]; if (was && +was < x.a) r.classList.add('up'); bd.dataset['k' + x.n] = x.a; bd.append(r); });
      if (api.name() && !mineIn) { const r = make('div', 'ev-r me'); r.innerHTML = `<i>${ev.me ? ev.me.rank : '–'}</i><span>Toi</span><b>${fmt(me.astres)}</b>`; bd.append(r); }
      root.querySelector('#ev-st').innerHTML = `<b>${fmt(Math.max(me.astres, 0))}</b> astres posés par toi<br><b>${fmt(ev.astres)}</b> au total<br><b>${fmt(sent)}</b> gros astres envoyés au tas`;
      const nt = root.querySelector('#ev-nt'), ni = root.querySelector('#ev-ni'), c = api.colors[Math.min(12, nextT)]; ni.style.color = ni.style.background = `rgb(${c.join(',')})`; nt.textContent = ev.active ? 'Prochain astre · touche la cuve, maintiens pour enchaîner' : 'La cuve est figée';
      const claimable = me.astres >= MIN_PART && (!ev.active || p >= MILESTONES[0][0]); const cl = root.querySelector('#ev-cl'); cl.hidden = !claimable; cl.textContent = ev.active ? 'Récompenses de palier' : 'Mes récompenses';
      let fin = root.querySelector('.ev-fin'); if (!ev.active && !fin) { fin = make('div', 'ev-fin'); fin.innerHTML = `<h3>${p >= 100 ? 'Objectif atteint !' : 'Événement terminé'}</h3><p>${fmt(g)} galaxies formées par ${fmt(ev.players)} joueurs, ${fmt(ev.astres)} astres posés.${ev.board[0] ? ` Bâtisseur n° 1 : <b>${esc(ev.board[0].n)}</b> (${fmt(ev.board[0].a)}).` : ''}</p>`; box.append(fin); } else if (ev.active && fin) fin.remove();
    }
    // — dessin (30 images/s) : moteur du jeu + sprites des vrais astres
    let last = performance.now(), t0 = last, tick = 0; const spawnQ = [], spr = [];
    const sprite = (t) => spr[t] || (spr[t] = api.sprite(Math.min(12, t)));
    function frame(now) {
      raf = requestAnimationFrame(frame); if (document.hidden || !ev) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; if ((tick++ & 1) && dt < 0.03) return; const t = (now - t0) / 1000;
      shownMass += (ev.mass - shownMass) * Math.min(1, dt * 1.5); const band = bandUnits(); G.ht += ((H / U - band) - G.ht) * Math.min(1, dt * 3); // le tas du fond repousse doucement le sol
      for (let i = spawnQ.length - 1; i >= 0; i--) if (now >= spawnQ[i].at) { const s = spawnQ[i]; spawnQ.splice(i, 1); put(s.x, s.t, false, s.name, s.rgb); }
      F.tick(G, dt); for (const e of G.ev) if (e.t === 'merge') fx.push({ x: e.x, y: e.y, r: 0.4 + e.tier * 0.12, rgb: api.colors[Math.min(12, e.tier)], t: 0 }); G.ev.length = 0;
      for (const b of G.bodies) { if (b.tier >= 8 && !b.dead) { b.big = b.big || now; if (now - b.big > 1300) { b.dead = true; sent++; fx.push({ x: b.x, y: b.y, r: b.r * 1.6, rgb: api.colors[b.tier], t: 0, big: true }); } } } // envoi des gros astres vers le tas
      if (G.bodies.length > 42) { const cand = G.bodies.filter((b) => !b.dead).sort((a, b) => a.tier - b.tier || a.id - b.id).slice(0, 3); for (const b of cand) { b.dead = true; fx.push({ x: b.x, y: b.y, r: b.r * 1.2, rgb: api.colors[b.tier], t: 0 }); } } // trop d'astres : les plus petits rejoignent le tas
      if (G.bodies.some((b) => b.dead)) G.bodies = G.bodies.filter((b) => !b.dead);
      ctx.setTransform(D, 0, 0, D, 0, 0); ctx.clearRect(0, 0, W, H); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#080a26'); g.addColorStop(1, '#0b0820'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(255,255,255,${0.15 + (hash(i * 7) % 50) / 120})`; ctx.fillRect((hash(i) % 1000) / 1000 * W, (hash(i + 99) % 1000) / 1000 * H * 0.7, 1, 1); }
      // le tas de la Grande Cuve : des astres minuscules, teintés selon la répartition, qui montent avec la masse
      if (band > 0.02) { const y0 = H - band * U; ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 3) ctx.lineTo(x, y0 - Math.sin(x * 0.07 + t * 1.2) * 1.5); ctx.lineTo(W, H); ctx.closePath(); ctx.clip(); const gg = ctx.createLinearGradient(0, y0, 0, H); gg.addColorStop(0, '#b46bff'); gg.addColorStop(1, '#3a1d8a'); ctx.fillStyle = gg; ctx.fillRect(0, y0 - 4, W, H); for (let i = 0; i < 260; i++) { const h = hash(i * 13); const c = api.colors[TIERS[h % TIERS.length]]; ctx.fillStyle = `rgba(${c.join(',')},${0.35 + (h % 50) / 120})`; ctx.fillRect((h % 997) / 997 * W, y0 + ((h >>> 9) % 997) / 997 * (H - y0), 2, 2); } ctx.restore(); ctx.strokeStyle = 'rgba(210,180,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x <= W; x += 3) { const y = y0 - Math.sin(x * 0.07 + t * 1.2) * 1.5; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      if (pct() >= 100) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,120,${0.07 + 0.04 * Math.sin(t * 3)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      for (const b of G.bodies) { const r = b.r * U, s = sprite(b.tier); ctx.save(); ctx.translate(b.x * U, b.y * U); ctx.rotate(b.ang || 0); const k = r * 2.78; ctx.drawImage(s, -k / 2, -k / 2, k, k); ctx.restore();
        if (b.tag && now - b.tag.t < 1800) { ctx.globalAlpha = 1 - (now - b.tag.t) / 1800; ctx.strokeStyle = `rgb(${b.tag.rgb.join(',')})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x * U, b.y * U, r * 1.15, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; } }
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; if (f.t > 0.7) { fx.splice(i, 1); continue; } const k = f.t / 0.7; ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = `rgb(${f.rgb.join(',')})`; ctx.lineWidth = f.big ? 4 : 2; ctx.beginPath(); ctx.arc(f.x * U, f.y * U, f.r * U * (1 + k * 1.6), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }
      for (let i = labels.length - 1; i >= 0; i--) { const l = labels[i]; l.l += dt; if (l.l > 1.6) { labels.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, (1.6 - l.l) * 2); ctx.fillStyle = `rgb(${l.rgb.join(',')})`; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(l.txt, Math.max(24, Math.min(W - 24, l.x)), l.y + l.l * 14); ctx.globalAlpha = 1; }
      if (ev.active) { const ax = aim * W; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(ax, 20); ctx.lineTo(ax, H - band * U); ctx.stroke(); ctx.setLineDash([]); const c = api.colors[Math.min(12, nextT)], rr = Math.max(4, F.TIERS[nextT].r * U); ctx.fillStyle = `rgb(${c.join(',')})`; ctx.beginPath(); ctx.arc(ax, 12, rr, 0, 6.3); ctx.fill(); }
    }
    const onPoll = async () => { const e = await load(); if (!e || !root) return; if (ev) { for (const a of ev.act || []) { const p0 = prev.get(a.n); if (p0 != null && a.n !== api.name() && a.a > p0) { const n = Math.min(24, a.a - p0), rgb = (api.accent(a.c) || '255,255,255').split(',').map(Number); for (let i = 0; i < n; i++) spawnQ.push({ at: performance.now() + i * (1900 / n) + Math.random() * 120, x: 0.04 + Math.random() * 0.92, t: pick(Math.random()), name: i === 0 ? a.n : '', rgb }); } prev.set(a.n, a.a); } me.astres = Math.max(me.astres, ev.me ? ev.me.astres : 0); } render(); };
    poll = setInterval(onPoll, 2000); flushT = setInterval(flush, 2500); raf = requestAnimationFrame(frame);
    (async () => { await load(); if (ev) { shownMass = ev.mass * 0.98; for (const a of ev.act || []) prev.set(a.n, a.a); me.astres = ev.me ? ev.me.astres : 0; } render(); })();
    root._cleanup = () => { window.removeEventListener('resize', fit); clearInterval(hold); };
  }
  function close() { if (!root) return; flush(); clearInterval(poll); clearInterval(flushT); cancelAnimationFrame(raf); if (root._cleanup) root._cleanup(); root.remove(); root = null; }
  return { open, close, async check() { const e = await load(); info = e ? { id: e.id, name: e.name, active: e.active, pct: pct(), left: left() } : null; return info; }, info: () => info };
}
