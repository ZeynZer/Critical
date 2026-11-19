// Critical — ouverture d'un pack, version immersive (V2). Tout se déroule dans une même scène en profondeur : une caméra virtuelle
// (inclinaison de l'appareil / souris / dérive lente) regarde un singularité qu'on charge en la maintenant, la galaxie s'allume, les astres
// orbitent en 3D et se lient, puis les cartes sortent du paquet une par une, en vraies cartes immersives, et se rangent d'un glissé gauche/droite.
// Le tirage est déjà décidé : l'animation le raconte (palette de la galaxie, pulsations prismatiques, supernova / trou noir / convergence,
// liseré de chaque dos de carte à sa vraie rareté). L'intro est une fonction pure du temps t (rejouable image par image pour les tests).
const CSS = `#pk{position:fixed;inset:0;z-index:88;background:#02020a;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;overflow:hidden}#pk>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#pk-deck{position:absolute;left:0;right:0;top:0;bottom:104px;pointer-events:none}
.pk-c{position:absolute;left:50%;top:50%;transform-origin:50% 50%;touch-action:none;pointer-events:auto;will-change:transform;cursor:grab}.pk-c .im-stage{position:absolute;left:0;top:0}
.pk-back{position:absolute;inset:0;border-radius:28px;background:radial-gradient(circle at 50% 46%,rgba(var(--c),.55),rgba(var(--c),0) 58%),linear-gradient(160deg,#101246,#07081f);border:3px solid rgb(var(--c));box-shadow:0 0 50px rgba(var(--c),.55),inset 0 0 40px rgba(0,0,0,.6);overflow:hidden}
.pk-back i{position:absolute;left:50%;top:46%;border:2px solid rgba(255,255,255,.35);border-radius:50%;transform:translate(-50%,-50%) rotate(var(--a)) scaleY(.36);width:var(--w);height:var(--w)}.pk-back.pr{animation:pk-hue 2.4s linear infinite}@keyframes pk-hue{to{filter:hue-rotate(360deg)}}
#pk-slots{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;justify-content:center;gap:6px;padding:0 10px;transition:transform .9s cubic-bezier(.2,.8,.2,1)}
#pk-slots.sum{transform:translateY(calc(-50vh + 60px))}#pk.sum #pk-hint{bottom:calc(env(safe-area-inset-bottom,0px) + 160px)}#pk-slots.sum.fix{pointer-events:auto}
.pk-sl{flex:0 0 auto;width:var(--sw);height:calc(var(--sw)*1.4);border-radius:12px;border:2px dashed rgba(255,255,255,.2);display:grid;place-items:center;overflow:hidden;background:rgba(255,255,255,.03);padding:0;color:#fff}
.pk-sl.on{border:2px solid var(--b);background:rgba(14,16,44,.92);box-shadow:0 0 14px var(--g);animation:pk-pop .5s cubic-bezier(.2,1.6,.4,1)}.pk-sl canvas{width:92%;height:auto;display:block}@keyframes pk-pop{from{transform:scale(.3);opacity:0}}
#pk-fl{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
#pk-title{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 22px);text-align:center;font:800 13px Orbitron,system-ui,sans-serif;letter-spacing:.2em;color:rgba(255,255,255,.7);pointer-events:none;text-transform:uppercase}
#pk-sum{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 52px);text-align:center;font:900 22px Orbitron,system-ui,sans-serif;color:#fff;text-shadow:0 0 22px var(--b);opacity:0;transition:opacity .8s .5s;pointer-events:none}#pk-sum.on{opacity:1}
#pk-skip{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 12px);height:36px;padding:0 14px;border-radius:18px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);font:700 11px system-ui,sans-serif;display:none}
#pk-ui{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 28px;opacity:0;pointer-events:none;transition:opacity .6s}#pk-ui.on{opacity:1;pointer-events:auto}
#pk-ui button{width:100%;max-width:330px;height:54px;border-radius:27px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:800 14px Orbitron,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}#pk-ui #pk-again{background:linear-gradient(135deg,#5b8cff,#b46bff);border:0}#pk-ui button:disabled{opacity:.4}
#pk.arming #pk-ui button,#pk.arming .pk-sl{pointer-events:none}
#pk-hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 128px);margin:0;text-align:center;font:700 13px system-ui,sans-serif;color:rgba(255,255,255,.6);pointer-events:none;letter-spacing:.04em;animation:pk-bl 1.8s ease-in-out infinite}@keyframes pk-bl{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){#pk-hint,.pk-back.pr{animation:none}}`;
let styled = false;
const TAU = Math.PI * 2, clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const eo = (x) => 1 - (1 - clamp(x)) ** 3, ei = (x) => clamp(x) ** 3, eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; }, ob = (x) => { x = clamp(x) - 1; return 1 + 2.4 * x ** 3 + 1.4 * x ** 2; };
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const COL = [[150, 170, 215], [77, 243, 255], [190, 120, 255], [255, 205, 80], [255, 120, 90], [255, 255, 255]]; // couleur d'une rareté
const hsl = (h, a = 1, l = 62) => `hsla(${((h % 360) + 360) % 360},100%,${l}%,${a})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const TA = { calm: 1.3, rare: 1.5, epic: 1.8, legend: 2.1, cosmic: 2.5 }; // durée de l'allumage : la galaxie accélère
const mk = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; return e; };

// o : { result:{cards:[{key,r,n,isNew,dup}], tell:{scene,best}, pack}, names:{pack,rar}, paintCard(canvas,key,px), buildCard(key,host,aim) → ctl immersive,
//       onView(key), sfx:{charge,place,rise,link,swallow,boom,hit}, vib(p), quick, lowFx, manual, onDone(action), canAgain(), root }
export function play(o) {
  const cards = o.result.cards, scene = o.result.tell.scene, best = o.result.tell.best, q = (o.quick ? 0.45 : 1) * (scene === 'calm' ? 0.8 : 1), N = cards.length, low = !!o.lowFx;
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), sfx = o.sfx || {}, vib = o.vib || (() => {}), pr = (i) => cards[i].r >= 3 || best >= 5;
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  const root = mk('div', 'pk'); root.className = 'im-host'; root.innerHTML = '<canvas></canvas><div id="pk-deck"></div><div id="pk-slots"></div><div id="pk-fl"></div><div id="pk-title"></div><div id="pk-sum"></div><button id="pk-skip">Tout ranger</button><div id="pk-ui"><button id="pk-again"></button><button id="pk-end">Terminer</button></div><p id="pk-hint"></p>'; (o.root || document.body).append(root);
  const $ = (s) => root.querySelector(s), cv = $('canvas'), ctx = cv.getContext('2d'), deck = $('#pk-deck'), slots = $('#pk-slots'), fl = $('#pk-fl'), hint = $('#pk-hint'), ui = $('#pk-ui'), skip = $('#pk-skip');
  $('#pk-title').textContent = o.names.pack;
  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, Rw = 0, S = 0, F = 1, gal = null, cw = 0, ch = 0;
  // — calendrier de l'intro (secondes après l'allumage), construit une fois
  const tA = TA[scene] * q, tB = 0.7 * q, L0 = tA + tB, ld = 0.55 * q, links = []; let tc = L0, bh = 0, cvg = 0;
  for (let i = 0; i < N; i++) {
    if (i === N - 1 && scene === 'epic') tc += 0.7 * q; // tension avant le dernier astre
    if (i === N - 1 && scene === 'legend') { bh = tc; tc += 3.3 * q; } // le trou noir avale l'astre le plus rare puis le recrache
    links.push(tc); tc += ld;
  }
  if (scene === 'cosmic') { cvg = tc; tc += 3.3 * q; } // convergence de tous les astres
  const D0 = tc + 0.45, tSum = D0 + 0.7; // D0 : les astres se condensent en paquet de cartes
  const sil = [], mini = [];
  cards.forEach((c, i) => { const m = document.createElement('canvas'); o.paintCard(m, c.key, 96); mini.push(m); const s = document.createElement('canvas'); s.width = m.width; s.height = m.height; const x = s.getContext('2d'); x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(28,32,70,.95)'; x.fillRect(0, 0, s.width, s.height); sil.push(s); });
  const stars = Array.from({ length: low ? 70 : 130 }, (_, i) => ({ x: (rnd(i * 3.7) - 0.5) * 2.4, y: (rnd(i * 5.9) - 0.5) * 2.4, z: rnd(i * 9.1), h: rnd(i * 2.2) }));
  // — caméra : inclinaison visée (gyroscope / souris / glissé), sinon dérive lente ; ressort pour la douceur
  let ax = 0, ay = 0, camX = 0, camY = 0, tick = 0, ptr = null, gyro = 0, g0 = null, drag = null;
  const aim = () => (drag ? [drag.ax, drag.ay] : performance.now() - gyro < 700 ? [ax, ay] : ptr && performance.now() - ptr.t < 2500 ? [ptr.x, ptr.y] : null);
  const onOri = (e) => { if (e.gamma == null) return; if (!g0) g0 = [e.gamma, e.beta]; gyro = performance.now(); ax = clamp((e.gamma - g0[0]) / 25, -1, 1); ay = clamp((e.beta - g0[1]) / 25, -1, 1); };
  function gyroOn() { if (!window.DeviceOrientationEvent) return; try { if (typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') window.addEventListener('deviceorientation', onOri); }).catch(() => {}); else window.addEventListener('deviceorientation', onOri); } catch (e) { /* sans gyroscope : dérive automatique */ } }
  function camStep(dt, t) { const a = aim(), dx = a ? a[0] : reduce ? 0 : Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.11) * 0.2, dy = a ? a[1] : reduce ? 0 : Math.cos(t * 0.27 + 0.7) * 0.4, k = Math.min(1, (1 - Math.pow(0.001, dt)) * 1.2); camX += (dx - camX) * k; camY += (dy - camY) * k; }
  // — projection : le monde (x, y, z) → écran ; la caméra pivote un peu autour de la scène (lacet, tangage), perspective 1 / (F + profondeur)
  let punch = 0;
  function proj(x, y, z) { const yaw = camX * 0.38, pit = 0.5 + camY * 0.16, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit); const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, k = (F * (1 + punch)) / (F + z2); return [cx + x1 * k, cy + y1 * k, k, z2]; }
  function plane(ang) { const o0 = proj(0, 0, 0), u = proj(50 * Math.cos(ang), 0, 50 * Math.sin(ang)), v = proj(-50 * Math.sin(ang), 0, 50 * Math.cos(ang)); ctx.transform((u[0] - o0[0]) / 50, (u[1] - o0[1]) / 50, (v[0] - o0[0]) / 50, (v[1] - o0[1]) / 50, o0[0], o0[1]); } // pose le plan horizontal (galaxie, disque) dans la perspective
  function build() { // tailles, fond, galaxie pré-rendue (palette selon la meilleure rareté)
    DPR = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.5); W = window.innerWidth; H = window.innerHeight; cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(H * DPR); cx = W / 2; cy = H * 0.42; Rw = Math.min(W * 0.34, H * 0.2); S = Math.min(W, H * 0.62) * 0.95; F = Math.min(W, H) * 1.3;
    cw = Math.round(Math.min(W * 0.86, 340, ((H - 104) * 0.84) / 1.42)); ch = Math.round(cw * 1.42); root.style.setProperty('--sw', Math.min(Math.floor((W - 20 - 6 * (N - 1)) / N), 74) + 'px');
    const g = document.createElement('canvas'); g.width = g.height = Math.ceil(S * DPR); const x = g.getContext('2d'); x.scale(DPR, DPR); x.globalCompositeOperation = 'lighter'; const arms = 2 + Math.min(4, best), dots = low ? 260 : 520, C = S / 2;
    for (let i = 0; i < dots; i++) {
      const t = rnd(i * 1.3) ** 0.75, a = ((i % arms) / arms) * TAU + t * 5 + (rnd(i * 7.7) - 0.5) * 0.45 * (1 - t * 0.4), d = C * (0.06 + t * 0.92); let col;
      if (best >= 5) col = hsl(((i % arms) / arms) * 360 + t * 120, 1, 66); else if (best === 4) col = rgba(t < 0.45 ? [255, 235, 190] : [255, 140 + t * 40, 60], 1); else if (best === 3) col = rgba(t < 0.4 ? [255, 235, 180] : [255, 90 + t * 60, 210], 1); else if (best === 2) col = rgba(t < 0.4 ? [210, 245, 255] : [150, 120 + t * 80, 255], 1); else col = rgba(t < 0.4 ? [235, 245, 255] : [110, 150 + t * 60, 255], 1);
      const px = C + Math.cos(a) * d, py = C + Math.sin(a) * d, rad = C * (0.012 + rnd(i * 3.1) * 0.03) * (i % 19 ? 1 : 2.6), gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, col.replace(/[\d.]+\)$/, '0.9)')); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    gal = g;
    const b = document.createElement('canvas'); b.width = Math.ceil(W * DPR); b.height = Math.ceil(H * DPR); const y = b.getContext('2d'); y.scale(DPR, DPR); const bgg = y.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75); bgg.addColorStop(0, '#120f3a'); bgg.addColorStop(0.5, '#080a22'); bgg.addColorStop(1, '#02020a'); y.fillStyle = bgg; y.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { y.fillStyle = `rgba(255,255,255,${0.12 + rnd(i * 2.3) * 0.4})`; y.fillRect(rnd(i * 5.1) * W, rnd(i * 8.9) * H, 1 + rnd(i) * 1.4, 1 + rnd(i) * 1.4); }
    root.style.background = `#02020a url(${b.toDataURL('image/jpeg', 0.85)}) center/100% 100% no-repeat`;
  }
  const bucketCol = COL[Math.min(best, 5)];
  const pcol = (i, t) => (pr(i) ? hsl(t * 140 + i * 70, 1, 64) : rgba(COL[cards[i].r], 1)); // couleur d'un astre : prismatique dès l'épique
  const sparks = (x, y, t0, n, col, sp, life, t, size = 2.2) => { const age = t - t0; if (age < 0 || age > life) return; const k = low ? Math.ceil(n / 2) : n; for (let i = 0; i < k; i++) { const a = rnd(i * 3.3 + t0 * 7) * TAU, v = sp * (0.35 + rnd(i * 5.7 + t0) * 0.65), al = 1 - age / life; ctx.fillStyle = typeof col === 'function' ? col(i) : col; ctx.globalAlpha = al; ctx.fillRect(x + Math.cos(a) * v * age - size / 2, y + Math.sin(a) * v * age + 90 * age * age - size / 2, size, size); } ctx.globalAlpha = 1; };
  const ring = (x, y, t0, dur, r1, col, w, t) => { const u = (t - t0) / dur; if (u < 0 || u > 1) return; ctx.strokeStyle = col; ctx.globalAlpha = (1 - u) * 0.9; ctx.lineWidth = w * (1 - u) + 0.5; ctx.beginPath(); ctx.arc(x, y, eo(u) * r1, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; };
  const glow = (x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace(/[\d.]+\)$/, a + ')')); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  function astre(i, p, sc, t, lit, hideAura) { // silhouette sombre + aura de la rareté (pas l'astre : il se dévoile sur la carte)
    const m = sil[i], w = (m.width / DPR) * sc * p[2], [x, y] = p;
    if (lit > 0 && !hideAura) { ctx.globalCompositeOperation = 'lighter'; glow(x, y, w * 1.25, pcol(i, t), (0.45 * lit).toFixed(2)); ctx.globalCompositeOperation = 'source-over'; }
    ctx.drawImage(m, x - w / 2, y - w / 2, w, w);
    if (lit > 0 && !hideAura) { ctx.strokeStyle = pr(i) ? hsl(t * 140 + i * 70, 1, 70) : rgba(COL[cards[i].r], 1); ctx.globalAlpha = lit; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, w * 0.4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  let flash = 0, tw = 0; // flash : fondu blanc de la frame (max des événements) ; tw : temps de la scène (dérive des étoiles)
  // — étoiles en profondeur : défilent lentement ; à l'allumage elles filent vers la caméra (traînées), de plus en plus vite
  function starfield(t, speed, travel, lim = stars.length) {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const s of stars.slice(0, lim)) { const z0 = (((s.z * 1400 - travel) % 1400) + 1400) % 1400 - 300, z1 = z0 + speed * 26; if (z0 < -F * 0.55) continue; const a = proj(s.x * W * 0.9, s.y * H * 0.7, z0), b = proj(s.x * W * 0.9, s.y * H * 0.7, Math.min(z1, 1400)); if (a[0] < -50 || a[0] > W + 50 || a[1] < -50 || a[1] > H + 50) continue;
      ctx.strokeStyle = best >= 5 && speed > 1.5 ? hsl(s.h * 360 + t * 120, 0.8, 78) : `rgba(${speed > 1.5 ? '190,215,255' : '255,255,255'},${(0.25 + 0.6 * clamp(a[2] - 0.5)) * 0.8})`; ctx.lineWidth = 0.8 + a[2] * 0.9 + clamp(speed / 6) * 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(speed > 0.4 ? b[0] : a[0] + 0.1, speed > 0.4 ? b[1] : a[1]); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // — attente : la singularité dormante ; p = charge (0..1) → anneaux plus vifs, étoiles qui accélèrent, halo qui monte
  function drawIdle(ct, p) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); punch = p * 0.06; const sh = reduce ? 0 : p * p * 3; ctx.save(); ctx.translate(Math.sin(ct * 61) * sh, Math.cos(ct * 53) * sh);
    starfield(ct, 0.25 + p * 3, ct * 28 + p * p * 700); const o0 = proj(0, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; glow(o0[0], o0[1], S * (0.12 + 0.2 * p), 'rgba(150,170,255,1)', (0.18 + 0.5 * p).toFixed(2));
    for (let k = 0; k < 3; k++) { ctx.save(); plane(ct * (0.6 + k * 0.3) * (1 + p * 6) * (k % 2 ? -1 : 1)); const r = S * (0.2 + k * 0.1) * (1 - p * 0.22); ctx.strokeStyle = `rgba(190,205,255,${0.28 + p * 0.5})`; ctx.lineWidth = (1.6 + p * 2.4) / Math.max(0.4, o0[2]); ctx.setLineDash([r * 0.5, r * 0.28]); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(o0[0], o0[1], S * 0.05 * (1 + p * 0.3), 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(255,255,255,${0.5 + p * 0.5})`; ctx.lineWidth = 2; ctx.stroke();
    if (p > 0.01) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(o0[0], o0[1], S * 0.19, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); } // jauge de maintien
    ctx.restore(); if (p > 0.9) { ctx.fillStyle = `rgba(255,255,255,${(p - 0.9) * 4})`; ctx.fillRect(0, 0, W, H); }
  }
  function draw(t) {
    flash = 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
    punch = t > tA && t < tA + 1.2 ? 0.16 * (1 - eo((t - tA) / 1.2)) * Math.min(1, (t - tA) / 0.12) : t < tA ? 0.06 + 0.1 * (t / tA) ** 2 : 0; // la caméra « encaisse » l'allumage
    let sh = reduce ? 0 : t < tA ? (t / tA) ** 3 * 5 : 0; if (!reduce) for (const l of links) if (t > l && t < l + 0.25) sh = Math.max(sh, 3 * (best >= 3 ? 1.6 : 1)); ctx.save(); ctx.translate(Math.sin(t * 61) * sh, Math.cos(t * 53) * sh);
    const u0 = clamp(t / tA); starfield(t, t < tA ? 0.5 + 6 * u0 ** 2 : Math.max(0.5, 6 * (1 - eo((t - tA) / 1.5))), t * 28 + 6 * tA * u0 ** 3 * 28 / 3 + (t > tA ? 6 * (t - tA) * 28 * 0.4 : 0));
    // — A · allumage : la galaxie (dans la perspective) tourne de plus en plus vite
    if (t < tA + tB) {
      const u = u0, spin = 0.35 * t + 13 * tA * (u ** 3.2) / 3.2, sc = (0.55 + 0.45 * eo(u)) * (t > tA ? 1 + 1.5 * eo((t - tA) / tB) : 1), fade = t > tA ? 1 - eo((t - tA) / (tB * 0.9)) : 1, w = S * sc, o0 = proj(0, 0, 0);
      ctx.globalCompositeOperation = 'lighter'; glow(o0[0], o0[1], S * (0.25 + 0.3 * u), rgba(bucketCol, 1), (0.25 + 0.4 * u).toFixed(2));
      const blur = low || reduce || u < 0.35 ? 1 : 3; for (let k = 0; k < blur; k++) { ctx.save(); plane(spin - k * 0.045 * (1 + 6 * u * u)); ctx.globalAlpha = fade * (k ? 0.32 / k : 1); ctx.drawImage(gal, -w / 2, -w / 2, w, w); ctx.restore(); }
      ctx.globalAlpha = 1; glow(o0[0], o0[1], S * 0.11 * (1 + u), best >= 5 ? hsl(t * 200, 1, 80) : 'rgba(255,255,255,1)', (0.5 + 0.5 * u).toFixed(2)); ctx.globalCompositeOperation = 'source-over';
      if (t > tA) { ring(o0[0], o0[1], tA, tB * 1.4, Math.max(W, H) * 0.7, 'rgba(255,255,255,1)', 6, t); flash = Math.max(flash, 0.5 * (1 - clamp((t - tA) / 0.25))); }
    }
    // — B/C : les astres jaillissent sur une orbite 3D, puis les liens de lumière les allument un à un
    if (t >= tA && t < D0 + 0.6) {
      const dissolve = t > D0 ? 1 - eo((t - D0) / 0.5) : 1; ctx.globalAlpha = dissolve; const hole = scene === 'legend' ? t - bh : -1, conv = scene === 'cosmic' ? t - cvg : -1, pos = [];
      const at = (i, rr, a2, bob) => proj(Math.cos(a2) * rr, bob, Math.sin(a2) * rr);
      for (let i = 0; i < N; i++) {
        const born = clamp((t - tA - i * 0.06) / (tB * 0.8)), a0 = -Math.PI / 2 + (i / N) * TAU + (t - tA) * 0.32, bob = Math.sin(t * 1.6 + i) * 5; let rr = Rw * ob(born), a2 = a0, sc = 0.2 + 0.8 * eo(born), sw = false;
        if (scene === 'legend' && i === N - 1 && hole >= 0) { const s0 = 0.7 * q, s1 = 2.1 * q, u2 = clamp((hole - s0) / (s1 - s0)); if (hole >= s0 && hole < 2.6 * q) { rr = Rw * (1 - u2 ** 1.4); a2 = a0 + u2 * TAU * 2.4; sc *= 1 - 0.92 * u2; sw = hole > s1; if (sw) sc = 0; } else if (hole >= 2.6 * q) { const u3 = clamp((hole - 2.6 * q) / (0.7 * q)); rr = Rw * eo(u3); sc = 0.1 + 0.9 * ob(u3); } }
        if (scene === 'cosmic' && conv >= 0) { const u = clamp(conv / (1.5 * q)); a2 = a0 + ei(u) * TAU * 1.6; rr = Rw * (1 - ei(u)); sc *= 1 - 0.85 * ei(u); if (conv > 2.2 * q) { const u3 = clamp((conv - 2.2 * q) / (0.8 * q)); rr = Rw * eo(u3); a2 = a0; sc = 0.1 + 0.9 * ob(u3); } }
        pos.push({ p: at(i, rr, a2, bob), sc, i });
      }
      const holeNow = scene === 'legend' && hole >= 0 && hole < 3.3 * q;
      if (holeNow) { const k = hole / (3.3 * q); ctx.globalAlpha = dissolve * Math.min(0.78, eio(Math.min(k * 4, 1)) * 0.78) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1); ctx.fillStyle = '#000006'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = dissolve; }
      for (const e of pos.slice().sort((a, b) => b.p[3] - a.p[3])) { // du plus loin au plus proche
        const i = e.i, lt = i === 0 ? links[0] : links[i - 1], lit = clamp((t - lt) / 0.4), hole2 = scene === 'legend' && i === N - 1 && hole >= 0 && hole < 2.6 * q;
        if (e.sc > 0.01) astre(i, e.p, e.sc, t, lit, hole2); sparks(e.p[0], e.p[1], lt, pr(i) ? 26 : 10, pr(i) ? (k) => hsl(k * 40 + t * 90, 1, 70) : rgba(COL[cards[i].r], 1), 70 + cards[i].r * 25, 0.7, t);
      }
      for (let i = 0; i < N; i++) { // un faisceau de i-1 vers i (le premier referme le polygone), pulsation de la meilleure des deux couleurs
        const ls = links[i], u = clamp((t - ls) / ld), a = i === 0 ? N - 1 : i - 1, b2 = i === 0 ? 0 : i; if (t < ls) continue;
        const [x0, y0] = pos[a].p, [x1, y1] = pos[b2].p, r2 = Math.max(cards[a].r, cards[b2].r), pm = r2 >= 3 || best >= 5, e = eo(u);
        if (holeNow && (a === N - 1 || b2 === N - 1)) continue; // pendant l'avalement, les liens de l'astre rare disparaissent
        const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, pm ? hsl(t * 160, 1, 70) : rgba(COL[cards[a].r], 1)); g.addColorStop(1, pm ? hsl(t * 160 + 120, 1, 70) : rgba(COL[cards[b2].r], 1));
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.globalAlpha = dissolve * (0.35 + 0.65 * (1 - clamp((t - ls - ld) / 2)) ** 0.5); ctx.lineWidth = pm ? 6 : 3.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); ctx.stroke(); ctx.lineWidth = pm ? 2 : 1.2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = dissolve;
        const tr = ls + ld; ring(x1, y1, tr, 0.7, Rw * (pm ? 0.9 : 0.55), pm ? hsl(t * 200, 1, 72) : rgba(COL[r2], 1), pm ? 7 : 3.5, t);
        if (pm && t > tr && t < tr + 0.25) flash = Math.max(flash, scene === 'epic' && i === N - 1 ? 0.8 : 0.16 * (1 - (t - tr) / 0.25));
        ctx.globalCompositeOperation = 'source-over';
      }
      if (holeNow) { // trou noir : disque d'accrétion horizontal en perspective + anneau de lentille vertical, au centre
        const h = hole, k = h / (3.3 * q), gr = k < 0.2 ? eo(k / 0.2) : k > 0.8 ? 1 - eo((k - 0.8) / 0.2) : 1, rr = Rw * 0.55 * gr, o0 = proj(0, 0, 0);
        ctx.globalCompositeOperation = 'lighter'; ctx.save(); plane(t * 2.6); const ac = ctx.createRadialGradient(0, 0, rr * 0.8, 0, 0, rr * 2.4); ac.addColorStop(0, 'rgba(255,255,255,.95)'); ac.addColorStop(0.2, 'rgba(255,200,110,.9)'); ac.addColorStop(0.55, 'rgba(255,110,40,.45)'); ac.addColorStop(1, 'rgba(120,30,200,0)'); ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(0, 0, rr * 2.4, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,170,.7)'; ctx.lineWidth = 2; for (let a = 0; a < 5; a++) { ctx.beginPath(); ctx.arc(0, 0, rr * (1.15 + a * 0.22), a, a + 1.4); ctx.stroke(); } ctx.restore();
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(o0[0], o0[1], rr, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,215,150,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o0[0], o0[1], rr * 1.08, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
        const out = 2.6 * q; if (h > out && h < out + 0.7 * q) { flash = Math.max(flash, 0.95 * (1 - (h - out) / (0.35 * q))); ring(o0[0], o0[1], bh + out, 0.9, Math.max(W, H) * 0.8, rgba(COL[4], 1), 10, t); }
        sparks(o0[0], o0[1], bh + out, 60, (kk) => hsl(30 + kk * 6, 1, 70), 260, 1.1, t, 3);
      }
      if (scene === 'cosmic' && conv >= 0 && conv < 3.3 * q) { // convergence : tous les astres fusionnent en une lumière unique
        const core = eio(clamp((conv - 1 * q) / (1.4 * q))), out = conv > 2.3 * q ? eo((conv - 2.3 * q) / (0.5 * q)) : 0, o0 = proj(0, 0, 0);
        ctx.globalCompositeOperation = 'lighter'; glow(o0[0], o0[1], S * (0.2 + 0.9 * core + 0.6 * out), hsl(t * 240, 1, 72), (0.85 * (1 - out * 0.4)).toFixed(2)); for (let a = 0; a < 12; a++) { ctx.save(); ctx.translate(o0[0], o0[1]); ctx.rotate(t * 1.3 + a * TAU / 12); ctx.fillStyle = hsl(a * 30 + t * 120, 1, 70, (0.3 * core).toFixed(2)); ctx.fillRect(S * 0.04, -1.5, S * (0.14 + 0.26 * core), 3); ctx.restore(); } ctx.globalCompositeOperation = 'source-over';
        flash = Math.max(flash, conv > 2.2 * q ? (conv < 2.7 * q ? eo((conv - 2.2 * q) / (0.5 * q)) : 1 - eo((conv - 2.7 * q) / (0.6 * q))) : 0);
      }
      ctx.globalAlpha = 1;
    }
    // — D · les astres se condensent en paquet de cartes (le dos de chacune est liséré de sa vraie rareté)
    if (t >= D0 - 0.1) { const u = eo((t - D0 + 0.1) / 0.7); stack(0, u, t); }
    ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flash)})`; ctx.fillRect(0, 0, W, H); }
  }
  const dcy = () => (H - 104) / 2; // centre vertical des cartes
  function stack(k, u, t) { // paquet : les cartes restantes (à partir de k), liseré coloré = rareté ; la carte du dessus est le DOM quand elle est active
    for (let j = N - 1; j >= k; j--) { const d = j - k, w = cw * 0.86 * (1 - 0.035 * d) * (0.4 + 0.6 * u), h = ch * 0.86 * (1 - 0.035 * d) * (0.4 + 0.6 * u), x = cx, y = dcy() + d * 9 * u, c = COL[cards[j].r], p = pr(j);
      ctx.save(); ctx.globalAlpha = u; ctx.translate(x + camX * 14 * (1 - d * 0.1), y + camY * 8); ctx.globalCompositeOperation = 'lighter'; glow(0, 0, w * 0.9, p ? hsl(t * 140 + j * 70, 1, 62) : rgba(c, 1), (0.22 + 0.04 * cards[j].r).toFixed(2)); ctx.globalCompositeOperation = 'source-over'; roundRect(-w / 2, -h / 2, w, h, 22); ctx.fillStyle = '#0a0b2a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = p ? hsl(t * 140 + j * 70, 1, 64) : rgba(c, 1); ctx.stroke(); ctx.restore(); }
  }
  // — cartes : une à la fois, vraie carte immersive ; glisser à gauche / droite pour la ranger
  let ph = o.quick || o.manual ? 'run' : 'idle', t = 0, ct = 0, p = 0, hold = null, auto = false, raf = 0, last = 0, ended = false, armed = 0, cur = null, placed = 0, fast = false, slotEl = [];
  for (let k = 0; k < N; k++) { const s = mk('div', '', 'pk-sl'); slots.append(s); slotEl.push(s); }
  const pend = new Array(N).fill(null);
  const mkCtl = (k) => { if (!pend[k]) { const c = o.buildCard(cards[k].key, deck, () => (cur && cur.k === k ? aim() : null), (H - 104) * 0.84); if (c) c.el.style.display = 'none'; pend[k] = c; } return pend[k]; }; // préparée cachée, posée dans sa carte au moment de l'entrée
  function backEl(k) { const c = COL[cards[k].r], b = mk('div', '', 'pk-back' + (pr(k) ? ' pr' : '')); b.style.setProperty('--c', `${c[0]},${c[1]},${c[2]}`); if (pr(k)) b.style.setProperty('--c', '255,120,230'); for (let a = 0; a < 3; a++) { const i = mk('i'); i.style.setProperty('--a', a * 60 + 'deg'); i.style.setProperty('--w', cw * (0.3 + a * 0.18) + 'px'); b.append(i); } return b; }
  function showCard(k) {
    const w = mk('div', '', 'pk-c'), best_ = k === N - 1 && cards[k].r >= 2, back = backEl(k), ctl = mkCtl(k); w.style.cssText += `width:${cw}px;height:${ch}px;margin:${-ch / 2}px 0 0 ${-cw / 2}px`; w.append(back); if (ctl) { ctl.el.style.visibility = 'hidden'; ctl.el.style.display = ''; w.append(ctl.el); } deck.append(w);
    cur = { k, w, back, ctl, t: 0, hold: best_ ? 1.5 : 0.4, flipped: false, out: 0, dx: 0, dy: 0 }; if (!o.manual && !fast && k === N - 1 && best_) vib([20, 40, 20]);
    w.addEventListener('pointerdown', (e) => { if (!cur || cur.w !== w || !cur.flipped || cur.out) return; w.setPointerCapture(e.pointerId); drag = { x0: e.clientX, y0: e.clientY, t0: performance.now(), ax: 0, ay: 0, x: 0, y: 0, id: e.pointerId }; });
    w.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId) return; drag.x = e.clientX - drag.x0; drag.y = (e.clientY - drag.y0) * 0.25; drag.ax = clamp(drag.x / (cw * 0.5), -1, 1); drag.ay = clamp(-(e.clientY - drag.y0) / (ch * 0.5), -1, 1) * 0.5; });
    const up = (e) => { if (!drag || drag.id !== e.pointerId) return; const d = drag, dt = Math.max(1, performance.now() - d.t0), v = d.x / dt; drag = null; if (!cur || cur.w !== w) return; if (Math.abs(d.x) > W * 0.27 || Math.abs(v) > 0.7 && Math.abs(d.x) > 36 || Math.abs(d.x) < 9 && dt < 260) fling(d.x < -9 ? -1 : 1, d.x); else cur.dx = d.x; };
    w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
    setTimeout(() => { if (!ended && k + 1 < N) mkCtl(k + 1); }, 120); // la carte suivante se prépare pendant qu'on regarde celle-ci
  }
  function fling(dir, from) { if (!cur || cur.out) return; cur.out = dir; cur.outT = 0; cur.from = from; if (sfx.place) sfx.place(cards[cur.k].r); vib(8); }
  function place(k) {
    const c = cards[k], s = slotEl[k], m = document.createElement('canvas'); o.paintCard(m, c.key, 96); m.style.width = '92%'; s.append(m); const col = COL[c.r]; s.style.setProperty('--b', pr(k) ? '#ff9af0' : rgba(col, 1)); s.style.setProperty('--g', rgba(col, 0.5)); s.classList.add('on'); s.setAttribute('aria-label', c.n); s.addEventListener('click', () => { if (o.onView && ph === 'sum') o.onView(c.key); });
    const ct2 = pend[k]; if (ct2) ct2.close(); if (cur && cur.w) cur.w.remove(); cur = null; placed++;
    if (placed >= N) summary(); else showCard(placed);
  }
  function revealBurst(k, t2) { const c = cards[k], col = COL[c.r]; ringAt.push({ t: t2, r: c.r, p: pr(k), k }); if (sfx.hit) sfx.hit(c.r); vib(c.r >= 4 ? [30, 40, 30, 40, 90] : c.r >= 2 ? [20, 30, 30] : 12); if (c.r >= 3) fl.animate([{ opacity: 0.35 + 0.1 * c.r }, { opacity: 0 }], { duration: 650 }); }
  const ringAt = [];
  function cardStep(dt) {
    if (!cur) return; const c = cur, k = c.k, e = eo(c.t / 0.35); c.t += dt * (fast ? 3 : 1); let ang = 0, sc = 1, ty = 0, rot = 0, tx = 0, op = 1;
    const tf = c.t - 0.35 - c.hold, fa = eio(tf / (fast ? 0.2 : 0.75)); ang = tf < 0 ? 180 : 180 * (1 - fa); sc = (0.8 + 0.2 * e) * (tf > 0 && tf < 0.75 ? 1 + 0.06 * Math.sin(fa * Math.PI) : 1); ty = (1 - e) * 36;
    if (c.t > 0.35 && !c.woke && c.ctl) { c.woke = true; c.ctl.wake(); }
    if (tf >= 0 && !c.flipped && fa > 0.5) { c.flipped = true; c.back.style.display = 'none'; if (c.ctl) c.ctl.el.style.visibility = ''; c.w.style.cursor = 'grab'; revealBurst(k, tw); if (!skip.style.display) { skip.style.display = 'block'; } hint.textContent = 'Glisse la carte à gauche ou à droite'; }
    if (c.flipped && !c.out) { tx = drag ? drag.x : c.dx; ty += drag ? drag.y : 0; rot = tx * 0.05; if (!drag) c.dx *= 0.82; }
    if (c.out) { c.outT += dt * (fast ? 2.5 : 1); const u = ei(c.outT / 0.32); tx = c.from + (c.out * W * 1.25 - c.from) * u; rot = tx * 0.05; ty += u * 40; op = 1 - u * 0.6; if (c.outT >= 0.32) { place(k); return; } }
    c.w.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) perspective(1100px) rotateY(${ang.toFixed(1)}deg) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`; c.w.style.opacity = op;
    if (tf > 0.75 && !c.hinted) { c.hinted = true; }
  }
  // — décor pendant les cartes : paquet restant (liseré = rareté à venir), éclats de rareté de la carte révélée, étincelles
  function drawCards(dt) {
    tw += dt; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); flash = 0; punch = 0;
    const kk = cur ? cur.k : N, w2 = 1, bestC = cur && cur.flipped ? COL[cards[cur.k].r] : null; starfield(tw, 0.15, tw * 18, 45);
    if (cur && cur.k === N - 1 && !cur.flipped && cards[N - 1].r >= 2) { const u = clamp(cur.t / (0.35 + cur.hold)); ctx.fillStyle = `rgba(0,0,8,${0.55 * u})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.translate(cx, dcy()); ctx.rotate(tw * 0.5); for (let a = 0; a < 14; a++) { ctx.rotate(TAU / 14); ctx.fillStyle = pr(N - 1) ? hsl(a * 26 + tw * 100, 1, 65, 0.1 + 0.16 * u) : rgba(COL[cards[N - 1].r], 0.1 + 0.14 * u); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ch * 1.1, -ch * 0.05 * u); ctx.lineTo(ch * 1.1, ch * 0.05 * u); ctx.fill(); } ctx.restore(); ctx.globalCompositeOperation = 'source-over'; }
    if (kk < N) stack(kk + 1, 1, tw);
    if (bestC) { ctx.globalCompositeOperation = 'lighter'; glow(cx, dcy(), ch * (0.7 + 0.06 * Math.sin(tw * 2)), pr(cur.k) ? hsl(tw * 120, 1, 62) : rgba(bestC, 1), (0.14 + 0.05 * cards[cur.k].r).toFixed(2)); ctx.globalCompositeOperation = 'source-over'; }
    for (const r of ringAt) { const c = cards[r.k], col = COL[c.r]; ring(cx, dcy(), r.t, 0.9, cw * (0.9 + c.r * 0.18), r.p ? hsl(tw * 200, 1, 72) : rgba(col, 1), 4 + c.r * 1.5, tw); sparks(cx, dcy(), r.t + 0.05, 14 + c.r * 14, r.p ? (i) => hsl(i * 33 + tw * 80, 1, 70) : rgba(col, 1), 150 + c.r * 55, 1.1, tw, 2.6); }
    if (ph === 'sum') { ctx.globalCompositeOperation = 'lighter'; glow(cx, H * 0.3, H * 0.4, pr(N - 1) ? hsl(tw * 90, 1, 60) : rgba(bucketCol, 1), '0.22'); ctx.globalCompositeOperation = 'source-over'; }
  }
  function summary() {
    ph = 'sum'; root.classList.add('sum'); hint.textContent = ''; skip.style.display = 'none'; slots.classList.add('sum'); const col = COL[best], s = $('#pk-sum'); s.style.setProperty('--b', best >= 5 ? '#fff' : rgba(col, 1)); s.textContent = 'Pack ouvert'; setTimeout(() => s.classList.add('on'), 30);
    setTimeout(() => { slots.classList.add('fix'); ui.classList.add('on'); armed = performance.now() + 700; root.classList.add('arming'); setTimeout(() => root.classList.remove('arming'), 700); const ag = $('#pk-again'), can = o.canAgain(); ag.textContent = can.label; ag.disabled = !can.ok; hint.textContent = o.onView ? 'Touche une carte pour l\'admirer' : ''; }, 700);
  }
  // — pilotage : maintien pour charger, intro (fonction de t), cartes
  const events = []; // sons et vibrations déclenchés une fois quand t franchit leur instant
  events.push([0, () => sfx.rise && sfx.rise(tA)]); for (let i = 0; i < links.length; i++) events.push([links[i] + ld, () => { const a = i === 0 ? N - 1 : i - 1, b2 = i === 0 ? 0 : i; sfx.link && sfx.link(i, Math.max(cards[a].r, cards[b2].r)); vib(cards[i].r >= 3 ? [12, 25, 12] : 8); }]);
  if (scene === 'legend') { events.push([bh + 0.7 * q, () => sfx.swallow && sfx.swallow()], [bh + 2.6 * q, () => { sfx.boom && sfx.boom(4); vib([40, 40, 80]); }]); }
  if (scene === 'cosmic') { events.push([cvg + 0.4, () => sfx.swallow && sfx.swallow()], [cvg + 2.3 * q, () => { sfx.boom && sfx.boom(5); vib([40, 30, 40, 30, 120]); }]); }
  if (scene === 'epic') events.push([links[N - 1], () => sfx.boom && sfx.boom(3)]);
  const fired = new Set();
  function advance(nt) { for (let i = 0; i < events.length; i++) if (!fired.has(i) && nt >= events[i][0]) { fired.add(i); if (!o.manual) events[i][1](); } t = nt; }
  function startCards() { if (ph === 'cards' || ph === 'sum') return; ph = 'cards'; tw = 0; root.classList.add('cards'); DPR = 1; /* décor plus léger pendant les cartes */ cv.width = Math.ceil(W); cv.height = Math.ceil(H); $('#pk-title').style.opacity = 0.5; showCard(0); }
  let lastCh = 0, cf = 0, cdt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame); if (ended || document.hidden) { last = now; return; } const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; tick += dt; camStep(dt, tick);
    if (ph === 'idle') { ct += dt; const prev = p; p = clamp(p + (hold || auto ? dt / (auto ? 0.8 : 1.1) : -dt * 1.6)); if (hold && !auto && now - hold.t > 220) hold.long = true; if ((hold || auto) && p > 0.02 && now - lastCh > 170) { lastCh = now; if (sfx.charge) sfx.charge(p); vib(Math.round(4 + p * 14)); } drawIdle(ct, p); if (prev < 1 && p >= 1) { ph = 'run'; hint.textContent = ''; hold = null; auto = false; t = 0; } return; }
    if (ph === 'run') { advance(t + dt); draw(t); if (t >= D0 + 0.7) startCards(); return; }
    cardStep(dt); cdt += dt; if (ringAt.length && tw - ringAt[ringAt.length - 1].t < 1.2 || (cf++ % 3) === 0) { drawCards(cdt); cdt = 0; } // décor à 20 images/s (60 pendant une explosion de rareté) : le GPU est pris par la carte immersive
  }
  function stop() { ended = true; cancelAnimationFrame(raf); window.removeEventListener('deviceorientation', onOri); window.removeEventListener('keydown', key); window.removeEventListener('resize', build); for (const c of pend) if (c) c.close(); root.remove(); }
  root.addEventListener('pointerdown', (e) => { if (ph !== 'idle' || e.target.closest('button')) return; gyroOn(); hold = { t: performance.now() }; });
  const rel = () => { if (ph === 'idle' && hold && !hold.long) auto = true; hold = null; }; root.addEventListener('pointerup', rel); root.addEventListener('pointercancel', () => { hold = null; });
  root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !drag) ptr = { x: clamp((e.clientX / W - 0.5) * 2, -1, 1), y: clamp(-(e.clientY / H - 0.5) * 2, -1, 1), t: performance.now() }; });
  const key = (e) => { if (ph === 'cards' && cur && cur.flipped) { if (e.key === 'ArrowLeft') fling(-1, 0); else if (e.key === 'ArrowRight' || e.key === 'Enter') fling(1, 0); } else if (ph === 'idle' && (e.key === ' ' || e.key === 'Enter')) auto = true; };
  window.addEventListener('keydown', key);
  skip.addEventListener('click', () => { fast = true; skip.style.display = 'none'; if (cur && !cur.flipped) cur.t = Math.max(cur.t, 0.35 + cur.hold); setTimeout(function go() { if (ended) return; if (cur && cur.flipped && !cur.out) fling(1, 0); if (placed < N) setTimeout(go, 160); }, 120); });
  $('#pk-end').addEventListener('click', () => { if (performance.now() < armed) return; stop(); o.onDone('end'); });
  $('#pk-again').addEventListener('click', () => { if (performance.now() < armed) return; stop(); o.onDone('again'); });
  build(); window.addEventListener('resize', build);
  hint.textContent = ph === 'idle' ? 'Maintiens pour ouvrir' : '';
  if (o.manual) { draw(0); } else { last = performance.now(); raf = requestAnimationFrame(frame); }
  return {
    duration: D0 + 0.7, marks: { tA, L0, links, bh, cvg, D0, tSum }, stop, get t() { return t; }, get phase() { return ph; },
    seek(nt) { advance(nt); draw(nt); }, // tests : image de l'intro à l'instant nt
    go(what) { if (what === 'cards') { ph = 'run'; startCards(); } }, // tests : passe directement aux cartes
    step(dt) { if (ph === 'cards' || ph === 'sum') { cardStep(dt); drawCards(dt); } },
  };
}
