// Critical — la Grande Cuve : événement collaboratif de plusieurs jours. Tous les joueurs posent des astres dans une cuve géante ; les astres des autres tombent en direct (l'état est relevé toutes les 2 s),
// le classement et la jauge d'objectif se mettent à jour sous les yeux. Règles et chiffres : js/cuve.js ; serveur : supabase/schema.sql (event_current, event_drop, event_claim).
// api : { call(fn, args), name(), askName(), claim() → texte, colors[rang] = [r,g,b], accent(i) = 'r,g,b', toast(txt), vib(n), sfx() }
import { GAL_MASS, TIERS, MILESTONES, MIN_PART, pick } from './cuve.js';
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const CW = 120, CH = 200, MAXRATE = 4; // colonnes et lignes de la cuve ; 4 astres par seconde au plus par joueur
const dur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d} j ${String(h).padStart(2, '0')} h` : h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min ${String(s % 60).padStart(2, '0')} s`; };
const CSS = `
#ev{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;background:radial-gradient(80% 50% at 50% 0,rgba(110,80,255,.25),transparent 70%),#04040f;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px calc(env(safe-area-inset-bottom,0px) + 10px);gap:8px;animation:ev-in .4s ease;touch-action:none;user-select:none;-webkit-user-select:none;color:#fff}@keyframes ev-in{from{opacity:0;transform:scale(1.03)}}
.ev-hd{display:flex;align-items:center;gap:10px}.ev-hd h2{flex:1;margin:0;font:900 17px var(--disp);letter-spacing:.08em;background:linear-gradient(90deg,#fff,#9ff9ff 50%,#ff9ae8);-webkit-background-clip:text;background-clip:text;color:transparent}.ev-hd small{display:block;font:500 11px var(--font);letter-spacing:0;color:rgba(255,255,255,.55);-webkit-text-fill-color:rgba(255,255,255,.55)}
.ev-x{width:42px;height:42px;border-radius:21px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font-size:17px;flex:none}
.ev-prog{position:relative;height:22px;border-radius:11px;background:rgba(255,255,255,.1);overflow:hidden}.ev-prog i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#4df3ff,#b46bff,#ff4fd8);border-radius:11px;transition:width .8s}.ev-prog b{position:absolute;inset:0;display:grid;place-items:center;font:800 11px var(--disp);text-shadow:0 1px 4px #000}.ev-prog u{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.4)}
.ev-main{flex:1;min-height:0;display:flex;gap:8px}.ev-side{flex:0 0 36%;max-width:170px;display:flex;flex-direction:column;gap:4px;overflow:hidden}.ev-side h3{margin:0 0 2px;font:800 10px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.ev-r{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:10px;background:rgba(255,255,255,.06);font-size:11px;border:1px solid transparent}.ev-r.me{border-color:#5dffc0;background:rgba(93,255,192,.12)}.ev-r i{font:900 10px var(--disp);font-style:normal;color:rgba(255,255,255,.5);width:14px;text-align:right}.ev-r span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.ev-r b{font:800 10px var(--disp)}.ev-r.up{animation:ev-up .6s}@keyframes ev-up{from{background:rgba(255,255,255,.35)}}
.ev-st{margin-top:auto;font-size:10.5px;line-height:1.45;color:rgba(255,255,255,.65)}.ev-st b{color:#fff}
.ev-cv{flex:1;min-width:0;position:relative;border-radius:14px;overflow:hidden;border:1.5px solid rgba(255,255,255,.2);background:#05061a;touch-action:none}.ev-cv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
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
      + `<div class="ev-main"><div class="ev-side"><h3>Bâtisseurs</h3><div id="ev-b"></div><div class="ev-st" id="ev-st"></div></div><div class="ev-cv" id="ev-cv"><canvas></canvas></div></div><div class="ev-ft"><div class="ev-nx"><i id="ev-ni"></i><span id="ev-nt"></span></div><button class="ev-go g" id="ev-cl" hidden>Récompenses</button></div>`;
    document.body.append(root); root.querySelector('.ev-x').addEventListener('click', close); MILESTONES.forEach(([p]) => { if (p <= 100) { const u = make('u'); u.style.left = (p / 100 * 100) + '%'; root.querySelector('.ev-prog').append(u); } });
    const cv = root.querySelector('canvas'), box = root.querySelector('#ev-cv'), ctx = cv.getContext('2d'), heap = document.createElement('canvas'); heap.width = CW; heap.height = CH; const hx = heap.getContext('2d'); let W = 0, H = 0, D = 1, hrows = -1, aim = 0.5, holding = false, hold = 0, lastShot = 0;
    const fit = () => { D = Math.min(window.devicePixelRatio || 1, 2); W = box.clientWidth; H = box.clientHeight; cv.width = Math.ceil(W * D); cv.height = Math.ceil(H * D); hrows = -1; }; fit(); window.addEventListener('resize', fit);
    const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; };
    const paintHeap = (rows) => { // le tas : chaque cellule est un astre minuscule, teinté selon la répartition des astres posés
      const im = hx.createImageData(CW, CH), d = im.data; for (let r = 0; r < rows; r++) { const y = CH - 1 - r; for (let c = 0; c < CW; c++) { const h = hash(y * CW + c), t = TIERS[h % TIERS.length] + ((h >>> 8) % 11 === 0 ? 2 : 0), col = api.colors[Math.min(12, t)] || [200, 200, 255], k = 0.45 + 0.45 * (1 - r / Math.max(1, rows)) + ((h >>> 12) % 7) / 40, i = (y * CW + c) * 4; d[i] = col[0] * k; d[i + 1] = col[1] * k; d[i + 2] = col[2] * k; d[i + 3] = 255; } } hx.putImageData(im, 0, 0); hrows = rows; };
    const colX = (c) => (c + 0.5) / CW * W, surf = (c, t) => { const p = Math.min(1, shownMass / (ev.goal * GAL_MASS)), r = p * CH * 0.92; return H - (r / CH) * H - 2 - Math.sin(c * 0.21 + t * 1.3) * 1.5 - Math.sin(c * 0.07 - t * 0.8) * 2; };
    function shoot(ax, own, name, tier, rgb) { falls.push({ x: ax * W, y: -4, vy: 40, t: tier, rgb: rgb || api.colors[Math.min(12, tier)], own, name, w: own ? 1 : 0 }); }
    const drop = () => { if (!ev || !ev.active || over) return; if (!api.name()) { api.askName(); return; } const now = performance.now(); if (now - lastShot < 1000 / MAXRATE) return; lastShot = now; const t = nextT; pend[t]++; me.astres++; ev.mass += 2 ** t; shoot(aim, true, '', t); nextT = pick(Math.random()); api.vib && me.astres % 6 === 0 && api.vib(5); if (pend.reduce((a, b) => a + b, 0) >= 30) flush(); };
    const aimAt = (e) => { const r = box.getBoundingClientRect(); aim = Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width)); };
    box.addEventListener('pointerdown', (e) => { aimAt(e); holding = true; try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } drop(); clearInterval(hold); hold = setInterval(drop, 1000 / MAXRATE + 5); });
    box.addEventListener('pointermove', (e) => { if (holding) aimAt(e); }); const rel = () => { holding = false; clearInterval(hold); }; box.addEventListener('pointerup', rel); box.addEventListener('pointercancel', rel);
    root.querySelector('#ev-cl').addEventListener('click', async () => { const b = root.querySelector('#ev-cl'); b.disabled = true; try { claimMsg = await api.claim(); api.toast(claimMsg); } catch (e) { api.toast(e.message); } b.disabled = false; render(); });
    // — affichage
    function render() {
      if (!ev) return; const p = pct(), g = Math.floor(ev.mass / GAL_MASS); root.querySelector('#ev-t').textContent = esc(ev.name).toUpperCase(); root.querySelector('#ev-s').textContent = ev.active ? `Il reste ${dur(left())} · ${fmt(ev.players)} joueur${ev.players > 1 ? 's' : ''}` : 'Événement terminé';
      root.querySelector('#ev-pi').style.width = Math.min(100, p) + '%'; root.querySelector('#ev-pb').textContent = `${fmt(g)} / ${fmt(ev.goal)} galaxies · ${Math.floor(p)} %`;
      const bd = root.querySelector('#ev-b'); const top = ev.board.slice(0, 8), mineIn = top.some((x) => x.n === api.name()); bd.textContent = '';
      top.forEach((x, i) => { const r = make('div', 'ev-r' + (x.n === api.name() ? ' me' : '')); r.innerHTML = `<i>${i + 1}</i><span>${esc(x.n)}</span><b>${fmt(x.a)}</b>`; const was = bd.dataset['k' + x.n]; if (was && +was < x.a) r.classList.add('up'); bd.dataset['k' + x.n] = x.a; bd.append(r); });
      if (api.name() && !mineIn) { const r = make('div', 'ev-r me'); r.innerHTML = `<i>${ev.me ? ev.me.rank : '–'}</i><span>Toi</span><b>${fmt(me.astres)}</b>`; bd.append(r); }
      root.querySelector('#ev-st').innerHTML = `<b>${fmt(Math.max(me.astres, 0))}</b> astres posés par toi<br><b>${fmt(ev.astres)}</b> au total`;
      const nt = root.querySelector('#ev-nt'), ni = root.querySelector('#ev-ni'), c = api.colors[Math.min(12, nextT)]; ni.style.color = ni.style.background = `rgb(${c.join(',')})`; nt.textContent = ev.active ? 'Prochain astre · touche la cuve, maintiens pour enchaîner' : 'La cuve est figée';
      const claimable = me.astres >= MIN_PART && (!ev.active || p >= MILESTONES[0][0]); const cl = root.querySelector('#ev-cl'); cl.hidden = !claimable; cl.textContent = ev.active ? 'Récompenses de palier' : 'Mes récompenses';
      let fin = root.querySelector('.ev-fin'); if (!ev.active && !fin) { fin = make('div', 'ev-fin'); fin.innerHTML = `<h3>${p >= 100 ? 'Objectif atteint !' : 'Événement terminé'}</h3><p>${fmt(g)} galaxies formées par ${fmt(ev.players)} joueurs, ${fmt(ev.astres)} astres posés.${ev.board[0] ? ` Bâtisseur n° 1 : <b>${esc(ev.board[0].n)}</b> (${fmt(ev.board[0].a)}).` : ''}</p>`; box.append(fin); } else if (ev.active && fin) fin.remove();
    }
    // — dessin (30 images/s)
    let last = performance.now(), t0 = last, tick = 0; const spawnQ = [];
    function frame(now) {
      raf = requestAnimationFrame(frame); if (document.hidden || !ev) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; if ((tick++ & 1) && dt < 0.03) return; const t = (now - t0) / 1000;
      shownMass += (ev.mass - shownMass) * Math.min(1, dt * 1.5); const p = Math.min(1, shownMass / (ev.goal * GAL_MASS)), rows = Math.round(p * CH * 0.92 / 2) * 2; if (rows !== hrows) paintHeap(rows);
      ctx.setTransform(D, 0, 0, D, 0, 0); ctx.clearRect(0, 0, W, H); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#080a26'); g.addColorStop(1, '#0b0820'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(255,255,255,${0.15 + (hash(i * 7) % 50) / 120})`; ctx.fillRect((hash(i) % 1000) / 1000 * W, (hash(i + 99) % 1000) / 1000 * H * 0.7, 1, 1); }
      ctx.imageSmoothingEnabled = false; ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 4) ctx.lineTo(x, surf(Math.floor(x / W * CW), t)); ctx.lineTo(W, H); ctx.closePath(); ctx.clip(); ctx.drawImage(heap, 0, 0, W, H); ctx.restore();
      ctx.strokeStyle = 'rgba(180,200,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = surf(Math.floor(x / W * CW), t); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      if (p >= 1) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,120,${0.08 + 0.05 * Math.sin(t * 3)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      // astres qui tombent (les autres arrivent par lots, étalés sur ~2 s)
      for (let i = spawnQ.length - 1; i >= 0; i--) if (now >= spawnQ[i].at) { const s = spawnQ[i]; spawnQ.splice(i, 1); shoot(s.x, false, s.name, s.t, s.rgb); if (s.name) labels.push({ x: s.x * W, y: 14, txt: s.name, rgb: s.rgb, l: 0 }); }
      for (let i = falls.length - 1; i >= 0; i--) { const f = falls[i]; f.vy += 520 * dt; f.y += f.vy * dt; const sy = surf(Math.floor(f.x / W * CW), t); if (f.y >= sy - 2) { falls.splice(i, 1); continue; } ctx.fillStyle = `rgb(${f.rgb.join(',')})`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = f.own ? 8 : 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.own ? 2.6 : 2, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0; }
      for (let i = labels.length - 1; i >= 0; i--) { const l = labels[i]; l.l += dt; if (l.l > 1.6) { labels.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, (1.6 - l.l) * 2); ctx.fillStyle = `rgb(${l.rgb.join(',')})`; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(l.txt, Math.max(24, Math.min(W - 24, l.x)), l.y + l.l * 18); ctx.globalAlpha = 1; }
      if (ev.active) { const ax = aim * W; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, Math.min(H, surf(Math.floor(aim * CW), t))); ctx.stroke(); ctx.setLineDash([]); const c = api.colors[Math.min(12, nextT)]; ctx.fillStyle = `rgb(${c.join(',')})`; ctx.beginPath(); ctx.arc(ax, 8, 3.4, 0, 6.3); ctx.fill(); }
    }
    const onPoll = async () => { const e = await load(); if (!e || !root) return; if (ev) { for (const a of ev.act || []) { const p0 = prev.get(a.n); if (p0 != null && a.n !== api.name() && a.a > p0) { const n = Math.min(24, a.a - p0), rgb = (api.accent(a.c) || '255,255,255').split(',').map(Number); for (let i = 0; i < n; i++) spawnQ.push({ at: performance.now() + i * (1900 / n) + Math.random() * 120, x: 0.04 + Math.random() * 0.92, t: pick(Math.random()), name: i === 0 ? a.n : '', rgb }); } prev.set(a.n, a.a); } me.astres = Math.max(me.astres, ev.me ? ev.me.astres : 0); } render(); };
    poll = setInterval(onPoll, 2000); flushT = setInterval(flush, 2500); raf = requestAnimationFrame(frame);
    (async () => { await load(); if (ev) { shownMass = ev.mass * 0.98; for (const a of ev.act || []) prev.set(a.n, a.a); me.astres = ev.me ? ev.me.astres : 0; } render(); })();
    root._cleanup = () => { window.removeEventListener('resize', fit); clearInterval(hold); };
  }
  function close() { if (!root) return; flush(); clearInterval(poll); clearInterval(flushT); cancelAnimationFrame(raf); if (root._cleanup) root._cleanup(); root.remove(); root = null; }
  return { open, close, async check() { const e = await load(); info = e ? { id: e.id, name: e.name, active: e.active, pct: pct(), left: left() } : null; return info; }, info: () => info };
}
