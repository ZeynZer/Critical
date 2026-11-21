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
.ev-prog{position:relative;height:22px;border-radius:11px;background:rgba(255,255,255,.1);overflow:hidden}.ev-prog i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#4df3ff,#b46bff,#ff4fd8);border-radius:11px}.ev-prog b{position:absolute;inset:0;display:grid;place-items:center;font:800 11px var(--disp);text-shadow:0 1px 4px #000}.ev-prog u{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.4)}
.ev-bd{display:flex;gap:6px}.ev-bd .ev-r{flex:1;min-width:0}
.ev-r{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:10px;background:rgba(255,255,255,.06);font-size:11px;border:1px solid transparent}.ev-r.me{border-color:#5dffc0;background:rgba(93,255,192,.12)}.ev-r i{font:900 10px var(--disp);font-style:normal;color:rgba(255,255,255,.5)}.ev-r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.ev-r b{font:800 10px var(--disp)}
.ev-cv{position:relative;flex:1;min-height:0;width:100%;max-width:440px;align-self:center;border-radius:14px;overflow:hidden;border:1.5px solid rgba(255,255,255,.2);background:#05061a;touch-action:none}.ev-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ev-ft{display:flex;align-items:center;gap:10px;height:48px;flex:none}.ev-nx{display:flex;align-items:center;gap:10px;font-size:11px;line-height:1.4;color:rgba(255,255,255,.7);flex:1;min-width:0}.ev-nx b{color:#fff}.ev-nx>span{flex:none;width:38px;height:38px}.ev-hint{flex:1;text-align:center;font-size:11.5px;color:rgba(255,255,255,.55)}
.ev-go{height:44px;padding:0 16px;border-radius:24px;border:0;color:#fff;font:900 12px var(--disp);letter-spacing:.06em;background:linear-gradient(135deg,#5b8cff,#b46bff);flex:none}.ev-go.g{background:#5dffc0;color:#04241a}.ev-go:disabled{opacity:.4}
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
      + `<div class="ev-bd" id="ev-b"></div><div class="ev-cv" id="ev-cv"><canvas></canvas></div><div class="ev-ft"><div class="ev-nx"><span id="ev-ni"></span><div id="ev-nt"></div></div><button class="ev-go g" id="ev-cl" hidden>Récompenses</button></div>`;
    document.body.append(root); root.querySelector('.ev-x').addEventListener('click', close); MILESTONES.forEach(([p]) => { if (p <= 100) { const u = make('u'); u.style.left = (p / 100 * 100) + '%'; root.querySelector('.ev-prog').append(u); } });
    // — la cuve : le vrai moteur du jeu (js/fusion.js, bac à sable), sol fixe, 60 images/s. Un astre de rang ≥ SINK est absorbé par le « cœur » du fond (qui se remplit avec la masse du serveur) ;
    // si le tas monte trop haut, le fond se vide doucement : la cuve ne bloque jamais. Les lâchers des autres sont étalés dans le temps (pas de lot d'un coup) et visent les creux.
    const SINK = 7, cv = root.querySelector('canvas'), box = root.querySelector('#ev-cv'), ctx = cv.getContext('2d'), G = F.newGame(20261121, { sandbox: true });
    let W = 0, H = 0, D = 1, U = 30, floor = 0, coreH = 56, aim = 0.5, aimS = 0.5, holding = false, lastShot = 0, handAt = 0, sent = 0, corePulse = 0, lastDrain = 0, ntShown = -1, lastProg = 0;
    const fit = () => { D = Math.min(window.devicePixelRatio || 1, 2); W = box.clientWidth; H = box.clientHeight; cv.width = Math.ceil(W * D); cv.height = Math.ceil(H * D); U = W / F.W; coreH = Math.max(46, Math.min(70, H * 0.1)); floor = H - coreH; G.ht = floor / U; for (const b of G.bodies) b.y = Math.min(b.y, G.ht - b.r); }; fit(); const onResize = () => fit(); window.addEventListener('resize', onResize); const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (box.clientWidth !== W || box.clientHeight !== H) fit(); }) : null; if (ro) ro.observe(box); // la toile suit toujours la taille réelle de la cuve (sinon les astres s'étirent)
    const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; };
    const fx = [], ghosts = []; // fx : anneaux { x, y (unités), r, rgb, t } ; ghosts : astres absorbés qui glissent vers le cœur
    function put(ax, tier, own, name, rgb) { // un astre entre dans la cuve à la position ax (0 à 1)
      G.cur = { k: 'c', tier }; G.cool = 0; if (!F.drop(G, ax * F.W)) return; const b = G.bodies[G.bodies.length - 1]; b.tag = { rgb: rgb || (own ? [93, 255, 192] : [255, 255, 255]), t: performance.now(), own };
      if (name) labels.push({ x: b.x * U, txt: name, rgb: b.tag.rgb, l: 0 });
    }
    const sink = (b, big) => { if (b.dead) return; b.dead = true; ghosts.push({ x: b.x, y: b.y, r: b.r, tier: b.tier, t: 0, big }); };
    const hole = () => { // un creux de la cuve pour les astres des autres : la plus basse de quelques colonnes tirées au hasard
      let best = 0.5, bh = -1; for (let i = 0; i < 4; i++) { const x = 0.06 + Math.random() * 0.88; let top = G.ht; for (const b of G.bodies) if (!b.dead && Math.abs(b.x - x * F.W) < b.r + 0.4 && b.y - b.r < top) top = b.y - b.r; if (top > bh) { bh = top; best = x; } } return best;
    };
    const drop = () => { if (!ev || !ev.active || over) return; if (!api.name()) { api.askName(); holding = false; return; } const now = performance.now(); if (now - lastShot < 1000 / MAXRATE) return; lastShot = now; const t = nextT; pend[t]++; me.astres++; ev.mass += 2 ** t; put(aimS, t, true, '', null); nextT = pick(Math.random()); handAt = now; api.vib && me.astres % 6 === 0 && api.vib(5); if (pend.reduce((a, b) => a + b, 0) >= 30) flush(); };
    const aimAt = (e) => { const r = box.getBoundingClientRect(); aim = Math.max(0.03, Math.min(0.97, (e.clientX - r.left) / r.width)); };
    box.addEventListener('pointerdown', (e) => { aimAt(e); aimS = aim; holding = true; try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } drop(); });
    box.addEventListener('pointermove', (e) => { if (holding) aimAt(e); }); const rel = () => { holding = false; }; box.addEventListener('pointerup', rel); box.addEventListener('pointercancel', rel);
    root.querySelector('#ev-cl').addEventListener('click', async () => { const b = root.querySelector('#ev-cl'); b.disabled = true; try { claimMsg = await api.claim(); api.toast(claimMsg); } catch (e) { api.toast(e.message); } b.disabled = false; render(); });
    // — textes (classement, stats, boutons) : à chaque relevé ; la jauge d'objectif suit la masse affichée, image par image
    function prog() { const p = ev ? Math.min(999, (shownMass / GAL_MASS) * 100 / Math.max(1, ev.goal)) : 0; root.querySelector('#ev-pi').style.width = Math.min(100, p) + '%'; root.querySelector('#ev-pb').textContent = ev ? `${fmt(Math.floor(shownMass / GAL_MASS))} / ${fmt(ev.goal)} galaxies · ${Math.floor(p)} %` : ''; }
    function render() {
      if (!ev) return; const p = pct(), g = Math.floor(ev.mass / GAL_MASS); root.querySelector('#ev-t').textContent = esc(ev.name).toUpperCase(); root.querySelector('#ev-s').textContent = ev.active ? `Il reste ${dur(left())} · ${fmt(ev.players)} joueur${ev.players > 1 ? 's' : ''}` : 'Événement terminé';
      const bd = root.querySelector('#ev-b'), nm = api.name(), top = ev.board.slice(0, 3), mineIn = top.some((x) => x.n === nm); bd.textContent = '';
      top.forEach((x, i) => { const r = make('div', 'ev-r' + (x.n === nm ? ' me' : '')); r.innerHTML = `<i>${i + 1}</i><span>${esc(x.n)}</span><b>${fmt(x.n === nm ? Math.max(x.a, me.astres) : x.a)}</b>`; bd.append(r); });
      if (nm && !mineIn) { const r = make('div', 'ev-r me'); r.innerHTML = `<i>${ev.me ? ev.me.rank : '–'}</i><span>Toi</span><b>${fmt(me.astres)}</b>`; bd.append(r); }
      root.querySelector('#ev-nt').innerHTML = ev.active ? `<b>${fmt(me.astres)}</b> posés par toi<br><b>${fmt(ev.astres)}</b> au total` : 'La cuve est figée';
      const claimable = me.astres >= MIN_PART && (!ev.active || p >= MILESTONES[0][0]); const cl = root.querySelector('#ev-cl'); cl.hidden = !claimable; cl.textContent = ev.active ? 'Récompenses de palier' : 'Mes récompenses';
      let fin = root.querySelector('.ev-fin'); if (!ev.active && !fin) { fin = make('div', 'ev-fin'); fin.innerHTML = `<h3>${p >= 100 ? 'Objectif atteint !' : 'Événement terminé'}</h3><p>${fmt(g)} galaxies formées par ${fmt(ev.players)} joueurs, ${fmt(ev.astres)} astres posés.${ev.board[0] ? ` Bâtisseur n° 1 : <b>${esc(ev.board[0].n)}</b> (${fmt(ev.board[0].a)}).` : ''}</p>`; box.append(fin); } else if (ev.active && fin) fin.remove();
    }
    // — dessin
    let last = performance.now(), t0 = last; const spawnQ = [], spr = [];
    // les sprites des petits astres ne remplissent pas leur toile : on mesure le rayon plein (opacité > 200) pour que l'astre dessiné ait la taille de son vrai rayon de collision
    const info = (t) => { t = Math.min(12, t); if (spr[t]) return spr[t]; const c = api.sprite(t), x = c.getContext('2d'), w = c.width, d = x.getImageData(0, 0, w, w).data; let m = 1; for (let R = 2; R < w / 2; R++) { let hit = 0, n = 0; for (let a = 0; a < 6.283; a += 0.05) { n++; const X = Math.round(w / 2 + R * Math.cos(a)), Y = Math.round(w / 2 + R * Math.sin(a)); if (d[(Y * w + X) * 4 + 3] > 150) hit++; } if (hit / n > 0.8) m = R; } return (spr[t] = { c, k: t === 0 ? 3 : w / m }); }; // rang 0 : petite poussière d'étoile (point + éclats), dessinée petite comme en partie // k : largeur de dessin / rayon du disque (anneaux et halo exclus) → le disque a exactement le rayon de collision
    const sprite = (t) => info(t).c;
    const back = (k) => { const c = 1.70158; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };
    function frame(now) {
      raf = requestAnimationFrame(frame); if (!ev) return; if (document.hidden) { last = now; return; } const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
      shownMass += (ev.mass - shownMass) * Math.min(1, dt * 2.5); corePulse = Math.max(0, corePulse - dt * 2.2); aimS += (aim - aimS) * Math.min(1, dt * 22);
      if (now - lastProg > 120) { lastProg = now; prog(); }
      if (ntShown !== nextT) { ntShown = nextT; const c = document.createElement('canvas'); c.width = c.height = 76; c.style.cssText = 'width:38px;height:38px;display:block'; const S = info(nextT), z = (8 + nextT * 1.6) * 2 * S.k; c.getContext('2d').drawImage(S.c, 38 - z / 2, 38 - z / 2, z, z); root.querySelector('#ev-ni').replaceChildren(c); }
      if (holding && ev.active) drop();
      for (let i = spawnQ.length - 1; i >= 0; i--) if (now >= spawnQ[i].at) { const s = spawnQ[i]; spawnQ.splice(i, 1); put(hole(), s.t, false, s.name, s.rgb); }
      F.tick(G, dt);
      for (const e of G.ev) if (e.t === 'merge') { fx.push({ x: e.x, y: e.y, r: 0.35 + e.tier * 0.1, rgb: api.colors[Math.min(12, e.tier)], t: 0 }); if (e.tier >= SINK) { const b = G.bodies.find((o) => o.id === e.id); if (b) sink(b, true); } }
      G.ev.length = 0;
      let top = 1e9, n = 0; for (const b of G.bodies) if (!b.dead) { n++; if (b.hit && b.age > 0.8 && b.y - b.r < top) top = b.y - b.r; }
      if ((top < G.ht * 0.3 || n > 64) && now - lastDrain > 140) { lastDrain = now; let c = null; for (const b of G.bodies) if (!b.dead && b.hit && b.tier <= 5 && (!c || b.y > c.y)) c = b; if (c) sink(c, false); } // trop haut : le fond se vide
      if (G.bodies.some((b) => b.dead)) G.bodies = G.bodies.filter((b) => !b.dead);
      const FY = floor;
      ctx.setTransform(D, 0, 0, D, 0, 0); ctx.clearRect(0, 0, W, H); const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#080a26'); bg.addColorStop(1, '#0d0a2a'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 34; i++) { ctx.fillStyle = `rgba(255,255,255,${0.12 + (hash(i * 7) % 50) / 130})`; ctx.fillRect((hash(i) % 1000) / 1000 * W, (hash(i + 99) % 1000) / 1000 * FY, 1.2, 1.2); }
      // le cœur de la cuve : se remplit avec la masse du serveur (une galaxie = un plein) ; brille quand un astre y entre
      { const f = (shownMass % GAL_MASS) / GAL_MASS, y0 = FY + coreH * (1 - Math.max(0.06, f)); ctx.save(); ctx.beginPath(); ctx.rect(0, FY, W, coreH); ctx.clip(); ctx.fillStyle = 'rgba(40,20,100,.55)'; ctx.fillRect(0, FY, W, coreH);
        const gg = ctx.createLinearGradient(0, y0, 0, H); gg.addColorStop(0, `rgba(${150 + corePulse * 100 | 0},${110 + corePulse * 110 | 0},255,1)`); gg.addColorStop(1, '#3a1d8a'); ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W + 4; x += 4) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + t * 2) * 2.2); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 40; i++) { const h = hash(i * 31); const c = api.colors[h % 4]; ctx.fillStyle = `rgba(${c.join(',')},.55)`; ctx.fillRect((h % 997) / 997 * W, y0 + 4 + ((h >>> 9) % 97) / 97 * Math.max(2, H - y0 - 6), 2, 2); }
        ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(`Galaxie n°${Math.floor(shownMass / GAL_MASS) + 1} · ${Math.floor(f * 100)} %`, W / 2, FY + coreH / 2 + 4); ctx.shadowBlur = 0; }
      const fl = ctx.createLinearGradient(0, 0, W, 0); fl.addColorStop(0, 'rgba(120,200,255,.0)'); fl.addColorStop(0.5, `rgba(190,170,255,${0.55 + corePulse * 0.4})`); fl.addColorStop(1, 'rgba(255,120,220,.0)'); ctx.fillStyle = fl; ctx.fillRect(0, FY - 1, W, 2);
      if (pct() >= 100) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,120,${0.06 + 0.035 * Math.sin(t * 3)})`; ctx.fillRect(0, 0, W, FY); ctx.globalCompositeOperation = 'source-over'; }
      if (ev.active) { const ax = F.clampX({ k: 'c', tier: nextT }, aimS * F.W) * U; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(ax, F.DROP_Y * U); ctx.lineTo(ax, FY); ctx.stroke(); ctx.setLineDash([]); }
      for (const b of G.bodies) { const r = b.r * U, S = info(b.tier), s = S.c, a = b.tag ? Math.min(1, (now - b.tag.t) / 160) : 1; ctx.save(); ctx.translate(b.x * U, b.y * U); ctx.rotate(b.ang || 0); const k = r * S.k * (0.75 + 0.25 * a); ctx.drawImage(s, -k / 2, -k / 2, k, k); ctx.restore();
        if (b.tag && now - b.tag.t < 1500) { ctx.globalAlpha = 1 - (now - b.tag.t) / 1500; ctx.strokeStyle = `rgb(${b.tag.rgb.join(',')})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x * U, b.y * U, r * 1.12, 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; } }
      for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; g.t += dt / 0.55; if (g.t >= 1) { ghosts.splice(i, 1); sent++; corePulse = Math.min(1, corePulse + (g.big ? 0.8 : 0.25)); fx.push({ x: g.x, y: (FY + coreH * 0.4) / U, r: 0.5, rgb: api.colors[Math.min(12, g.tier)], t: 0, big: g.big }); if (g.big && api.vib) api.vib(8); continue; }
        const e = g.t * g.t, k = 1 - 0.85 * e; ctx.globalAlpha = 1 - 0.5 * e; const y = g.y * U + (FY + coreH * 0.4 - g.y * U) * e, kk = g.r * U * info(g.tier).k * k; ctx.drawImage(sprite(g.tier), g.x * U - kk / 2, y - kk / 2, kk, kk); ctx.globalAlpha = 1; }
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; if (f.t > 0.6) { fx.splice(i, 1); continue; } const k = f.t / 0.6; ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = `rgb(${f.rgb.join(',')})`; ctx.lineWidth = f.big ? 4 : 2; ctx.beginPath(); ctx.arc(f.x * U, f.y * U, f.r * U * (1 + k * 1.5), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }
      for (let i = labels.length - 1; i >= 0; i--) { const l = labels[i]; l.l += dt; if (l.l > 1.5) { labels.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, (1.5 - l.l) * 2); ctx.fillStyle = `rgb(${l.rgb.join(',')})`; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(l.txt, Math.max(26, Math.min(W - 26, l.x)), F.DROP_Y * U - 24 + l.l * 10); ctx.globalAlpha = 1; }
      if (ev.active) { const R = F.TIERS[nextT].r, ax = F.clampX({ k: 'c', tier: nextT }, aimS * F.W) * U, k = Math.max(0.01, back(Math.min(1, (now - handAt) / 260))) * R * U * info(nextT).k; ctx.save(); ctx.translate(ax, F.DROP_Y * U + Math.sin(t * 3) * 1.5); ctx.rotate(t * 0.4); ctx.globalAlpha = now - lastShot < 1000 / MAXRATE ? 0.7 : 1; ctx.drawImage(sprite(nextT), -k / 2, -k / 2, k, k); ctx.restore(); }
    }
    const onPoll = async () => { const e = await load(); if (!e || !root) return; if (ev) { const arr = []; for (const a of ev.act || []) { const p0 = prev.get(a.n); if (p0 != null && a.n !== api.name() && a.a > p0) { const k = Math.min(24, a.a - p0), rgb = (api.accent(a.c) || '255,255,255').split(',').map(Number); for (let i = 0; i < k; i++) arr.push({ n: a.n, rgb, first: i === 0 }); } prev.set(a.n, a.a); }
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } const show = arr.slice(0, 14), sp = 1900 / Math.max(1, show.length), now = performance.now(), named = new Set(); // l'affichage est un échantillon : les compteurs, eux, sont exacts
      show.forEach((s, i) => { const nm = !named.has(s.n); named.add(s.n); spawnQ.push({ at: now + i * sp + Math.random() * sp * 0.5, t: pick(Math.random()), name: nm ? s.n : '', rgb: s.rgb }); }); if (spawnQ.length > 40) spawnQ.splice(0, spawnQ.length - 40);
      me.astres = Math.max(me.astres, ev.me ? ev.me.astres : 0); } render(); };
    poll = setInterval(onPoll, 2000); flushT = setInterval(flush, 2500); raf = requestAnimationFrame(frame);
    (async () => { await load(); if (ev) { shownMass = ev.mass * 0.985; for (const a of ev.act || []) prev.set(a.n, a.a); me.astres = ev.me ? ev.me.astres : 0; } render(); })();
    root._cleanup = () => { window.removeEventListener('resize', onResize); if (ro) ro.disconnect(); };
  }
  function close() { if (!root) return; flush(); clearInterval(poll); clearInterval(flushT); cancelAnimationFrame(raf); if (root._cleanup) root._cleanup(); root.remove(); root = null; }
  return { open, close, async check() { const e = await load(); info = e ? { id: e.id, name: e.name, active: e.active, pct: pct(), left: left() } : null; return info; }, info: () => info };
}
