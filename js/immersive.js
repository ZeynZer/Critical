// Critical — carte immersive : l'astre devient une petite scène vivante (profondeur 2,5D, caméra virtuelle, parallaxe, hologramme).
// Technique : la carte (aplatie, découpée dans son cadre arrondi) bascule en perspective 3D, et ~10 plans qui la composent se décalent
// chacun à leur vitesse (+ léger zoom différencié = la caméra avance dans l'illustration). Aucun WebGL : canvas 2D dessinés une fois,
// un seul canvas animé (le corps de l'astre) et des transformations composées par le GPU.
// show({ host? (mode intégré : la carte se pose dans ce conteneur ; aim() → [x,y] pilote la caméra ; wake() la réveille), rig, name, rar, rname, sub, info, col }) ; rig = { size, halo, haloSpin, over, tier, color, frame(ctx, t) } (voir mine.js : astreRig)
const TAU = Math.PI * 2, clamp = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const RC = [[150, 170, 215], [77, 243, 255], [190, 120, 255], [255, 205, 80], [255, 120, 90], [255, 255, 255]];
const hsl = (h, a = 1, l = 64) => `hsla(${((h % 360) + 360) % 360},100%,${l}%,${a})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const cvs = (w, h, d) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * d); c.height = Math.ceil(h * d); const x = c.getContext('2d'); x.scale(d, d); c.style.width = w + 'px'; c.style.height = h + 'px'; return [c, x]; };
const soft = (x, px, py, r, col, a) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };

const STYLE = `
#im{position:fixed;inset:0;z-index:92;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,rgba(18,14,54,.96),rgba(2,2,10,.98));animation:im-in .45s ease;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
@keyframes im-in{from{opacity:0}}#im.out{opacity:0;transition:opacity .35s}
#im .im-stage,.im-host .im-stage{perspective:1000px;perspective-origin:50% 45%}
#im .im-card,.im-host .im-card{position:relative;overflow:hidden;border-radius:28px;transform-style:flat;will-change:transform;box-shadow:0 30px 80px rgba(0,0,0,.65),0 0 60px var(--g);background:#05060f}
#im .im-card::after,.im-host .im-card::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2px var(--b),inset 0 0 40px rgba(0,0,0,.55);pointer-events:none;z-index:30}
#im .im-l,.im-host .im-l{position:absolute;left:50%;top:50%;will-change:transform;pointer-events:none}
#im .im-l canvas,.im-host .im-l canvas{display:block}
.im-spin{animation:im-sp var(--d,60s) linear infinite}@keyframes im-sp{to{transform:rotate(360deg)}}
.im-pulse{animation:im-pu var(--d,6s) ease-in-out infinite}@keyframes im-pu{50%{transform:scale(1.07);opacity:.82}}
.im-tw{animation:im-tw var(--d,4s) ease-in-out infinite alternate}@keyframes im-tw{from{opacity:.55}to{opacity:1}}
.im-orbit{position:absolute;left:0;top:0;animation:im-sp var(--d,18s) linear infinite}
.im-orbit i{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff,var(--c) 45%,#050510 100%);box-shadow:0 0 14px var(--c)}
.im-txt{position:absolute;left:0;right:0;bottom:0;padding:46px 18px 18px;text-align:center;background:linear-gradient(180deg,rgba(2,3,14,0),rgba(2,3,14,.82) 55%);z-index:25;pointer-events:none}
.im-txt small{display:block;font:800 10px Orbitron,system-ui,sans-serif;letter-spacing:.2em;color:var(--b)}.im-txt b{display:block;margin:4px 0 5px;font:900 21px/1.15 Orbitron,system-ui,sans-serif;color:#fff;text-shadow:0 0 18px var(--b);text-transform:uppercase}.im-txt span{display:block;font:500 12px/1.4 system-ui,sans-serif;color:rgba(255,255,255,.72)}
#im .im-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:14px;width:46px;height:46px;border-radius:23px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:20px;display:grid;place-items:center;z-index:5}#im.arming .im-x{pointer-events:none;opacity:.4}
#im .im-hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);margin:0;text-align:center;font:600 12px system-ui,sans-serif;color:rgba(255,255,255,.45);pointer-events:none;transition:opacity 1s}
@media (prefers-reduced-motion:reduce){.im-spin,.im-pulse,.im-tw,.im-orbit{animation:none!important}}
`;
let styled = false;

export function show(o) {
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st); }
  const rig = o.rig, rar = Math.max(0, Math.min(5, o.rar | 0)), col = RC[rar], rc = rar >= 5 ? hsl(0, 1) : rgba(col, 1);
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), flat = !(window.CSS && window.CSS.supports && window.CSS.supports('transform', 'rotateX(1deg)')), lite = (navigator.hardwareConcurrency || 4) <= 2; // flat : pas de 3D (repli : parallaxe seule) ; lite : appareil modeste, moins de particules
  const D = Math.min(window.devicePixelRatio || 1, lite || flat ? 1 : 1.5);
  const cw = Math.round(Math.min(window.innerWidth * 0.86, 340, (o.hmax || window.innerHeight * 0.74) / 1.42)), ch = Math.round(cw * 1.42), A = cw * 0.05;
  const root = o.host ? null : make('div', 'arming'), stage = make('div', 'im-stage'), card = make('div', 'im-card'); if (root) root.id = 'im'; card.style.width = cw + 'px'; card.style.height = ch + 'px'; card.style.setProperty('--g', rgba(col, 0.35)); card.style.setProperty('--b', rar >= 5 ? '#fff' : rgba(col, 1));
  if (root) setTimeout(() => root.classList.remove('arming'), 700);
  const L = []; // { el, d : profondeur (-1 loin … +1 près), z : zoom, a : amplitude }
  const sy = -ch * 0.07; // le sujet est un peu au-dessus du centre : le texte occupe le bas de la carte
  const layer = (el, d, o2 = {}) => { el.classList.add('im-l'); if (el.tagName === 'CANVAS') { el.style.marginLeft = -parseFloat(el.style.width) / 2 + 'px'; el.style.marginTop = -parseFloat(el.style.height) / 2 + 'px'; } if (o2.subj) el.style.marginTop = (parseFloat(el.style.marginTop) || 0) + sy + 'px'; L.push({ el, d, k: o2.k == null ? 1 : o2.k }); card.append(el); return el; };
  const OV = 1.22, bw = cw * OV, bh = ch * OV; // plans de fond plus grands que la carte : jamais de bord visible quand ils glissent
  // — 1 · nébuleuse de fond (couleurs : rareté + teinte de l'astre)
  { const [c, x] = cvs(bw, bh, D), tc = rig.color; const g = x.createLinearGradient(0, 0, 0, bh); g.addColorStop(0, '#05061a'); g.addColorStop(0.6, rgba([tc[0] * 0.18, tc[1] * 0.18, tc[2] * 0.28], 1)); g.addColorStop(1, '#02020a'); x.fillStyle = g; x.fillRect(0, 0, bw, bh); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) soft(x, rnd(i * 3.1) * bw, rnd(i * 7.7) * bh, bw * (0.3 + rnd(i) * 0.4), i % 3 === 0 ? col : i % 3 === 1 ? tc : [90, 60, 190], 0.1 + rnd(i * 2.3) * 0.16);
    if (rar >= 3) { x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { x.save(); x.translate(bw / 2, bh * 0.45); x.rotate(i * 0.9 + 0.3); const gg = x.createLinearGradient(0, 0, bw, 0); gg.addColorStop(0, rar >= 5 ? hsl(i * 50, 0.22) : rgba(col, 0.16)); gg.addColorStop(1, rgba(col, 0)); x.fillStyle = gg; x.beginPath(); x.moveTo(0, 0); x.lineTo(bw, -bw * 0.07); x.lineTo(bw, bw * 0.07); x.fill(); x.restore(); } }
    layer(c, -1, { k: 0.5 }); }
  // — 2/4 · champs d'étoiles (deux profondeurs ; scintillement CSS)
  const stars = (n, size, d, seed, k) => { const [c, x] = cvs(bw, bh, D); for (let i = 0; i < n; i++) { const px = rnd(i * 5.1 + seed) * bw, py = rnd(i * 8.9 + seed) * bh, s = size * (0.5 + rnd(i + seed)); x.fillStyle = `rgba(255,255,255,${0.35 + rnd(i * 2.2 + seed) * 0.65})`; x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill(); if (i % 9 === 0) { x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(px - s * 4, py); x.lineTo(px + s * 4, py); x.moveTo(px, py - s * 4); x.lineTo(px, py + s * 4); x.stroke(); } } c.classList.add('im-tw'); c.style.setProperty('--d', 3 + seed % 4 + 's'); layer(c, d, { k }); };
  stars(110, 0.9, -0.85, 3, 0.7); stars(46, 1.6, -0.35, 9, 0.9);
  // — 3 · décor lointain, propre au type d'astre
  const tier = rig.tier, cx = bw / 2, cy = bh * 0.45;
  { const S = Math.max(bw, bh), [c, x] = cvs(S, S, D); x.translate(S / 2, S / 2); x.globalCompositeOperation = 'lighter'; const tc = rig.color; let spin = 90;
    if (tier >= 12) { for (let i = 0; i < 360; i++) { const t = rnd(i * 1.3) ** 0.8, a = (i % 4) * 1.571 + t * 5, d = S * 0.46 * (0.1 + t * 0.9); soft(x, Math.cos(a) * d, Math.sin(a) * d * 0.9, 3 + rnd(i) * 7, i % 3 ? [200, 220, 255] : [255, 180, 220], 0.22 + rnd(i * 3) * 0.4); } spin = 120; }
    else if (tier >= 10) { x.lineCap = 'round'; for (let i = 0; i < 26; i++) { const r0 = S * (0.16 + rnd(i) * 0.3), a0 = rnd(i * 4) * TAU; x.strokeStyle = rgba(i % 3 ? [255, 190, 120] : [190, 120, 255], 0.1 + rnd(i * 2) * 0.28); x.lineWidth = 1 + rnd(i * 5) * 2.5; x.beginPath(); x.arc(0, 0, r0, a0, a0 + 0.5 + rnd(i * 7) * 1.4); x.stroke(); } spin = 40; }
    else if (tier >= 6) { for (let i = 0; i < 16; i++) { x.save(); x.rotate((i / 16) * TAU); const g = x.createLinearGradient(S * 0.1, 0, S * 0.5, 0); g.addColorStop(0, rgba(tc, 0.3)); g.addColorStop(1, rgba(tc, 0)); x.fillStyle = g; x.beginPath(); x.moveTo(S * 0.1, 0); x.lineTo(S * (0.4 + (i % 3) * 0.08), -S * 0.012); x.lineTo(S * (0.4 + (i % 3) * 0.08), S * 0.012); x.fill(); x.restore(); } spin = 160; }
    else { x.strokeStyle = rgba(tc, 0.35); for (const [k, w] of [[0.33, 2], [0.4, 1.2], [0.47, 0.8]]) { x.lineWidth = w; x.save(); x.scale(1, 0.32); x.beginPath(); x.arc(0, 0, S * k, 0, TAU); x.stroke(); x.restore(); } for (let i = 0; i < 18; i++) { const a = rnd(i * 3) * TAU, d = S * (0.25 + rnd(i) * 0.22); soft(x, Math.cos(a) * d, Math.sin(a) * d * 0.4, 4 + rnd(i * 2) * 6, tc, 0.5); } spin = 220; }
    c.style.width = c.style.height = S + 'px'; const wrap = make('div'); wrap.append(c); c.classList.add('im-spin'); c.style.setProperty('--d', spin + 's'); c.style.position = 'absolute'; c.style.left = c.style.top = -S / 2 + 'px'; layer(wrap, -0.55, { k: 0.8, subj: true }); }
  // — 5 · halo de l'astre (calque d'arrière du moteur de rendu), respire et tourne
  const S2 = Math.round(Math.min(cw * 0.92, rig.size * 1.5)), sub = S2 / rig.size; // taille d'affichage de l'astre
  if (rig.halo) { const [c, x] = cvs(S2, S2, D); x.drawImage(rig.halo, 0, 0, S2, S2); c.classList.add('im-pulse'); c.style.setProperty('--d', '7s'); c.style.position = 'absolute'; c.style.left = c.style.top = -S2 / 2 + 'px'; const w = make('div'); w.append(c); if (rig.haloSpin) { c.style.animation = 'im-sp ' + Math.abs(TAU / rig.haloSpin) + 's linear infinite' + (rig.haloSpin < 0 ? ' reverse' : ''); } layer(w, -0.18, { k: 1, subj: true }); }
  // — 6 · décor intermédiaire : une petite lune en orbite (planètes), éclairs de lumière (étoiles)…
  { const w = make('div'), orb = make('div', 'im-orbit'); orb.style.setProperty('--d', 16 + (tier % 5) * 3 + 's'); const m = make('i'); const R0 = S2 * 0.62, ms = 9 + (tier % 4) * 3; m.style.cssText = `width:${ms}px;height:${ms}px;left:${R0 - ms / 2}px;top:${-ms / 2}px;--c:${rgba(rig.color, 1)}`; orb.append(m); const sq = make('div'); sq.style.cssText = 'position:absolute;left:0;top:0;transform:scaleY(.32) rotate(-18deg)'; sq.append(orb); w.append(sq); w.style.cssText = 'width:0;height:0'; layer(w, 0.02, { k: 1, subj: true }); }
  // — 7 · le corps de l'astre : seul calque redessiné en continu
  const [bc, bx] = cvs(S2, S2, D); const body = layer(make('div'), 0.22, { k: 1, subj: true }); bc.style.position = 'absolute'; bc.style.left = bc.style.top = -S2 / 2 + 'px'; body.append(bc);
  // — 8 · lumière fixe (ombre portée, reflet, liseré) : au-dessus du corps, un peu plus près
  if (rig.over) { const [c, x] = cvs(S2, S2, D); x.drawImage(rig.over, 0, 0, S2, S2); c.style.position = 'absolute'; c.style.left = c.style.top = -S2 / 2 + 'px'; const w = make('div'); w.append(c); layer(w, 0.3, { k: 1, subj: true }); }
  // — 9 · lumière volumétrique : trois faisceaux qui traversent la scène (fondu additif)
  { const [c, x] = cvs(bw, bh, D); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { x.save(); x.translate(bw * (0.2 + i * 0.3), -bh * 0.1); x.rotate(-0.38 + i * 0.05); const g = x.createLinearGradient(0, 0, 0, bh * 1.3); g.addColorStop(0, rar >= 5 ? hsl(i * 120, 0.2) : rgba(col, 0.15)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(-bw * (0.05 + i * 0.015), 0, bw * (0.1 + i * 0.03), bh * 1.3); x.restore(); } c.classList.add('im-pulse'); c.style.setProperty('--d', '9s'); c.style.marginLeft = -bw / 2 + 'px'; c.style.marginTop = -bh / 2 + 'px'; c.style.position = 'absolute'; const sh = make('div'); sh.style.cssText = 'width:0;height:0'; sh.append(c); layer(sh, 0.55, { k: 1 }); }
  // — 10 · particules flottantes (profondeurs variées ; les plus proches, grosses et floues = profondeur de champ)
  const [pc, px2] = cvs(cw, ch, D); const P = Array.from({ length: reduce ? 0 : lite ? 18 : 46 }, (_, i) => ({ x: rnd(i * 4.3) * cw, y: rnd(i * 6.1) * ch, z: rnd(i * 9.7), s: rnd(i * 3.3), h: rnd(i * 5.5) })); pc.style.position = 'absolute'; pc.style.left = pc.style.top = '0'; const pl = make('div'); pl.style.cssText = `left:0;top:0;width:${cw}px;height:${ch}px`; pl.append(pc); layer(pl, 0.9, { k: 1.3 });
  // — hologramme : feuille arc-en-ciel (mélange « color-dodge ») qui glisse avec l'inclinaison + reflet blanc
  const foilS = Math.round(Math.max(cw, ch) * 1.9), [fc, fx] = cvs(foilS, foilS, 1); { const g = fx.createConicGradient ? fx.createConicGradient(0.4, foilS / 2, foilS / 2) : null; if (g) { for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, hsl(i * 45, 1, 56)); fx.fillStyle = g; fx.fillRect(0, 0, foilS, foilS); } else { fx.fillStyle = '#88f'; fx.fillRect(0, 0, foilS, foilS); } }
  const foil = make('div', 'im-l'), glare = make('div', 'im-l'); foil.style.cssText = `width:${foilS}px;height:${foilS}px;margin:-${foilS / 2}px 0 0 -${foilS / 2}px;mix-blend-mode:color-dodge;opacity:${rar < 2 ? 0 : 0.1 + rar * 0.06};z-index:20`; foil.append(fc); fc.style.cssText = 'width:100%;height:100%;filter:saturate(1.2)';
  glare.style.cssText = `width:${cw * 1.6}px;height:${cw * 1.6}px;margin:-${cw * 0.8}px 0 0 -${cw * 0.8}px;background:radial-gradient(circle,rgba(255,255,255,.55),rgba(255,255,255,0) 55%);mix-blend-mode:overlay;z-index:21;opacity:.7`; card.append(foil, glare);
  const txt = make('div', 'im-txt', `<small>${(o.rname || '').toUpperCase()}</small><b>${o.name}</b><span>${[o.sub, o.info].filter(Boolean).join(' · ')}</span>`); card.append(txt);
  const x = make('button', 'im-x', '✕'); x.setAttribute('aria-label', 'Fermer'); const hint = o.host ? null : make('p', 'im-hint', reduce ? 'Glisse pour incliner la carte' : 'Incline ton appareil ou glisse pour explorer la scène');
  stage.append(card); if (root) { root.append(stage, x, hint); document.body.append(root); } else o.host.append(stage);
  // — caméra : cible d'inclinaison (souris / doigt / gyroscope), sinon mouvement automatique lent ; ressort pour la douceur
  let tx = 0, ty = 0, cx2 = 0, cy2 = 0, active = 0, gyro = 0, g0 = null, t0 = performance.now() / 1000, raf = 0, frame = 0, closed = false, last = 0, awake = !o.host; // en mode hôte : la carte est préparée à l'avance, endormie, puis réveillée (wake) quand elle entre en scène
  const setPt = (e) => { const r = card.getBoundingClientRect(), px = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.7), py = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.7); tx = clamp(px); ty = clamp(py); active = performance.now(); };
  if (root) { root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) setPt(e); }); root.addEventListener('pointerdown', setPt); }
  const onOri = (e) => { if (e.gamma == null) return; if (!g0) g0 = [e.gamma, e.beta]; gyro = performance.now(); if (performance.now() - active > 1500) { tx = clamp((e.gamma - g0[0]) / 22); ty = clamp((e.beta - g0[1]) / 22); } };
  if (root && window.DeviceOrientationEvent) { try { if (typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') window.addEventListener('deviceorientation', onOri); }).catch(() => {}); else window.addEventListener('deviceorientation', onOri); } catch (e) { /* pas de gyroscope : mouvement automatique */ } }
  function loop(now) {
    raf = requestAnimationFrame(loop); if (document.hidden) return; if (!awake) { t0 = now / 1000; return; } const ext = o.aim && o.aim(); if (ext) { tx = ext[0]; ty = ext[1]; active = now; } const t = now / 1000 - t0, dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frame++;
    const enter = 1 - (1 - Math.min(1, t / 1.5)) ** 3, manual = now - active < 2200 || now - gyro < 600; // mouvement automatique quand personne ne touche
    const aimX = manual ? tx : reduce ? 0 : Math.sin(t * 0.33) * 0.55 + Math.sin(t * 0.13) * 0.2, aimY = manual ? ty : reduce ? 0 : Math.cos(t * 0.24 + 0.7) * 0.4;
    const k = 1 - Math.pow(0.001, dt); cx2 += (aimX - cx2) * Math.min(1, k * 1.2); cy2 += (aimY - cy2) * Math.min(1, k * 1.2);
    const dolly = reduce ? 0 : (Math.sin(t * 0.19) * 0.5 + 0.5), spread = 1 + 2.2 * (1 - enter), push = 1.28 - 0.28 * enter + dolly * 0.03; // à l'ouverture la caméra « entre » dans l'illustration
    if (!flat) card.style.transform = `rotateX(${(-cy2 * 11).toFixed(2)}deg) rotateY(${(cx2 * 14).toFixed(2)}deg) scale(${(0.9 + 0.1 * enter).toFixed(3)})`; else card.style.transform = `scale(${(0.9 + 0.1 * enter).toFixed(3)})`;
    card.style.opacity = Math.min(1, enter * 1.6);
    for (const l of L) { const m = -l.d, ax = cx2 * A * m * l.k * spread * 2.2, ay = cy2 * A * m * l.k * spread * 2.2, sc = push + l.d * 0.05 * (dolly + (1 - enter) * 1.5) + (l.d > 0.5 ? (1 - enter) * 0.5 : 0); l.el.style.transform = `translate3d(${ax.toFixed(1)}px,${ay.toFixed(1)}px,0) scale(${sc.toFixed(3)})`; }
    // hologramme et reflet : suivent l'inclinaison
    foil.style.transform = `translate3d(${(-cx2 * cw * 0.5).toFixed(1)}px,${(-cy2 * ch * 0.4).toFixed(1)}px,0) rotate(${(cx2 * 25 + t * 4).toFixed(1)}deg)`; glare.style.transform = `translate3d(${(cx2 * cw * 0.55).toFixed(1)}px,${(cy2 * ch * 0.45).toFixed(1)}px,0)`;
    // corps de l'astre : redessiné à 30 images/s (la surface défile = il bouge sans cesse) + léger flottement
    if (frame % 2 === 0 || reduce && frame < 3) { bx.setTransform(D, 0, 0, D, 0, 0); bx.clearRect(0, 0, S2, S2); bx.save(); bx.translate(S2 / 2, S2 / 2); bx.scale(sub, sub); rig.frame(bx, reduce ? 0 : now / 1000); bx.restore(); }
    if (!reduce) { const f = Math.sin(t * 0.9) * 4; body.style.transform += ` translateY(${f.toFixed(1)}px) rotate(${(Math.sin(t * 0.5) * 1.2).toFixed(2)}deg)`; }
    // particules (canvas léger, 30 images/s)
    if (P.length && frame % 2 === 1) { px2.setTransform(D, 0, 0, D, 0, 0); px2.clearRect(0, 0, cw, ch); px2.globalCompositeOperation = 'lighter'; for (const p of P) { const sp = 6 + p.z * 22; p.y -= sp * dt * 2; p.x += Math.sin(t * 0.6 + p.h * 9) * 0.25; if (p.y < -12) { p.y = ch + 12; p.x = rnd(p.h * 99 + frame) * cw; } const r0 = 1.2 + p.z * p.z * 9, tw = 0.5 + 0.5 * Math.sin(t * 2 + p.h * 30); px2.globalAlpha = (0.25 + 0.55 * tw) * (p.z > 0.8 ? 0.32 : 1); soft(px2, p.x, p.y, r0 * 2.4, rar >= 5 ? RC[(p.h * 6) | 0] : p.s > 0.6 ? col : [255, 255, 255], 0.9); } px2.globalAlpha = 1; }
  }
  raf = requestAnimationFrame(loop);
  const close = () => { if (closed) return; closed = true; cancelAnimationFrame(raf); window.removeEventListener('deviceorientation', onOri); if (root) { root.classList.add('out'); setTimeout(() => root.remove(), 350); } else stage.remove(); if (o.onClose) o.onClose(); };
  if (root) { x.addEventListener('click', close); root.addEventListener('dblclick', close); setTimeout(() => { hint.style.opacity = 0; }, 5000); }
  return { close, el: stage, wake() { awake = true; }, get camera() { return [cx2, cy2]; }, setCamera(a, b) { tx = a; ty = b; active = performance.now() + 1e9; } };
}
