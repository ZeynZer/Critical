// Critical — ouverture d'un pack : l'animation raconte un tirage déjà décidé. Tout se calcule à partir du temps t (fonction pure de t),
// donc elle est rejouable image par image (tests, captures). Les indices sont honnêtes : la couleur de la galaxie, les pulsations des
// liaisons et les scènes spéciales (supernova, trou noir qui avale un astre, convergence) annoncent la vraie meilleure rareté.
const CSS = `#pk{position:fixed;inset:0;z-index:88;background:#02020a;touch-action:manipulation;-webkit-tap-highlight-color:transparent}#pk canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#pk-ui{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 28px;opacity:0;pointer-events:none;transition:opacity .6s}#pk-ui.on{opacity:1;pointer-events:auto}
#pk-ui button{width:100%;max-width:330px;height:54px;border-radius:27px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:800 14px Orbitron,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}#pk-ui #pk-again{background:linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.36));border-color:rgba(255,255,255,.45)}#pk-ui button:disabled{opacity:.4}#pk-ui button:active{transform:scale(.96)}#pk.arming #pk-ui button{pointer-events:none;opacity:.4}
#pk-hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 30px);margin:0;text-align:center;font:600 12px system-ui,sans-serif;color:rgba(255,255,255,.45);pointer-events:none}`;
let styled = false;
const TAU = Math.PI * 2, clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const eo = (x) => 1 - (1 - clamp(x)) ** 3, ei = (x) => clamp(x) ** 3, eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; }, ob = (x) => { x = clamp(x) - 1; return 1 + 2.4 * x ** 3 + 1.4 * x ** 2; };
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const COL = [[150, 170, 215], [77, 243, 255], [190, 120, 255], [255, 205, 80], [255, 120, 90], [255, 255, 255]]; // couleur d'une rareté
const hsl = (h, a = 1, l = 62) => `hsla(${((h % 360) + 360) % 360},100%,${l}%,${a})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const TA = { calm: 1.7, rare: 1.9, epic: 2.2, legend: 2.6, cosmic: 3.0 }; // durée de l'allumage : la galaxie accélère

// o : { result:{cards:[{key,r,n,isNew,dup}], tell:{scene,best}, pack}, paintCard(canvas, key, px), sfx:{rise,link,swallow,boom,hit}, vib(p), quick, lowFx, manual, onDone(action), canAgain(), root }
export function play(o) {
  const cards = o.result.cards, scene = o.result.tell.scene, best = o.result.tell.best, q = (o.quick ? 0.45 : 1) * (o.result.tell.scene === 'calm' ? 0.8 : 1), N = cards.length, low = !!o.lowFx;
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.id = 'pk'; root.innerHTML = '<canvas></canvas><div id="pk-ui"><button id="pk-again"></button><button id="pk-end">Terminer</button></div><p id="pk-hint"></p>'; (o.root || document.body).append(root);
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), ui = root.querySelector('#pk-ui'), hint = root.querySelector('#pk-hint');
  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0, S = 0, gal = null, bg = null;
  // — calendrier (en secondes), construit une fois
  const tA = TA[scene] * q, tB = 0.75 * q, L0 = tA + tB, ld = 0.55 * q, links = []; let tc = L0, bh = 0, cvg = 0;
  for (let i = 0; i < N; i++) {
    if (i === N - 1 && scene === 'epic') tc += 0.7 * q; // tension avant le dernier astre
    if (i === N - 1 && scene === 'legend') { bh = tc; tc += 3.3 * q; } // le trou noir avale l'astre le plus rare puis le recrache
    links.push(tc); tc += ld;
  }
  if (scene === 'cosmic') { cvg = tc; tc += 3.3 * q; } // convergence de tous les astres
  const D0 = tc + 0.45, step = 1.0, dk = Array.from({ length: N }, (_, k) => (k < N - 1 ? D0 + k * step : D0 + (N - 2) * step + step + 0.8)), tSum = dk[N - 1] + 2.2;
  // — images
  const big = [], mini = [], sil = [];
  cards.forEach((c, i) => { const b = document.createElement('canvas'), m = document.createElement('canvas'); o.paintCard(b, c.key, 170); o.paintCard(m, c.key, 96); big.push(b); mini.push(m); const s = document.createElement('canvas'); s.width = m.width; s.height = m.height; const x = s.getContext('2d'); x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(28,32,70,.95)'; x.fillRect(0, 0, s.width, s.height); sil.push(s); });
  const pos = (i, k = 1) => [cx + Math.cos(-Math.PI / 2 + (i / N) * TAU) * R * k, cy + Math.sin(-Math.PI / 2 + (i / N) * TAU) * R * k];
  function build() { // tailles, fond, galaxie pré-rendue (palette selon la meilleure rareté)
    DPR = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.5); W = window.innerWidth; H = window.innerHeight; cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(H * DPR); cx = W / 2; cy = H * 0.42; R = Math.min(W * 0.34, H * 0.2); S = Math.min(W, H * 0.62) * 0.92;
    const g = document.createElement('canvas'); g.width = g.height = Math.ceil(S * DPR); const x = g.getContext('2d'); x.scale(DPR, DPR); x.globalCompositeOperation = 'lighter'; const arms = 2 + Math.min(4, best), dots = low ? 260 : 520, C = S / 2;
    for (let i = 0; i < dots; i++) {
      const t = rnd(i * 1.3) ** 0.75, a = ((i % arms) / arms) * TAU + t * 5 + (rnd(i * 7.7) - 0.5) * 0.45 * (1 - t * 0.4), d = C * (0.06 + t * 0.92); let col;
      if (best >= 5) col = hsl(((i % arms) / arms) * 360 + t * 120, 1, 66); else if (best === 4) col = rgba(t < 0.45 ? [255, 235, 190] : [255, 140 + t * 40, 60], 1); else if (best === 3) col = rgba(t < 0.4 ? [255, 235, 180] : [255, 90 + t * 60, 210], 1); else if (best === 2) col = rgba(t < 0.4 ? [210, 245, 255] : [150, 120 + t * 80, 255], 1); else col = rgba(t < 0.4 ? [235, 245, 255] : [110, 150 + t * 60, 255], 1);
      const px = C + Math.cos(a) * d, py = C + Math.sin(a) * d * 0.96, rad = C * (0.012 + rnd(i * 3.1) * 0.03) * (i % 19 ? 1 : 2.6), gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, col.replace(/[\d.]+\)$/, '0.9)')); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    gal = g;
    const b = document.createElement('canvas'); b.width = Math.ceil(W * DPR); b.height = Math.ceil(H * DPR); const y = b.getContext('2d'); y.scale(DPR, DPR); const bgg = y.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75); bgg.addColorStop(0, '#120f3a'); bgg.addColorStop(0.5, '#080a22'); bgg.addColorStop(1, '#02020a'); y.fillStyle = bgg; y.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { y.fillStyle = `rgba(255,255,255,${0.15 + rnd(i * 2.3) * 0.5})`; y.fillRect(rnd(i * 5.1) * W, rnd(i * 8.9) * H, 1 + rnd(i) * 1.6, 1 + rnd(i) * 1.6); }
    bg = b; root.style.background = `#02020a url(${b.toDataURL('image/jpeg', 0.85)}) center/100% 100% no-repeat`;
  }
  const bucketCol = COL[Math.min(best, 5)];
  const prism = (i, t) => (best >= 5 || cards[i].r >= 3 ? hsl(t * 140 + i * 70, 1, 64) : rgba(COL[cards[i].r], 1)); // couleur d'un astre : prismatique dès l'épique
  const lightAt = (i) => (i === 0 ? links[0] : links[i - 1]); // un astre s'allume quand le lien qui l'atteint est arrivé (le 1er avec le 1er lien)
  const sparks = (x, y, t0, n, col, sp, life, t, size = 2.2) => { const age = t - t0; if (age < 0 || age > life) return; const k = low ? Math.ceil(n / 2) : n; for (let i = 0; i < k; i++) { const a = rnd(i * 3.3 + t0 * 7) * TAU, v = sp * (0.35 + rnd(i * 5.7 + t0) * 0.65), al = 1 - age / life; ctx.fillStyle = typeof col === 'function' ? col(i) : col; ctx.globalAlpha = al; ctx.fillRect(x + Math.cos(a) * v * age - size / 2, y + Math.sin(a) * v * age + 90 * age * age - size / 2, size, size); } ctx.globalAlpha = 1; };
  const ring = (x, y, t0, dur, r1, col, w, t) => { const u = (t - t0) / dur; if (u < 0 || u > 1) return; ctx.strokeStyle = col; ctx.globalAlpha = (1 - u) * 0.9; ctx.lineWidth = w * (1 - u) + 0.5; ctx.beginPath(); ctx.arc(x, y, eo(u) * r1, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; };
  const glow = (x, y, r, col, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace(/[\d.]+\)$/, a + ')')); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const wcol = (a) => `rgba(255,255,255,${a})`;
  let flash = 0; // fondu blanc de la frame (max des événements)
  function astre(i, x, y, sc, t, lit, hideAura) { // silhouette sombre + aura de la rareté (pas l'astre : il se dévoile à la fin)
    const m = sil[i], w = (m.width / DPR) * sc, c = COL[cards[i].r];
    if (lit > 0 && !hideAura) { ctx.globalCompositeOperation = 'lighter'; glow(x, y, w * 1.25, prism(i, t), (0.45 * lit).toFixed(2)); ctx.globalCompositeOperation = 'source-over'; }
    ctx.drawImage(m, x - w / 2, y - w / 2, w, w);
    if (lit > 0 && !hideAura) { ctx.strokeStyle = cards[i].r >= 3 || best >= 5 ? hsl(t * 140 + i * 70, 1, 70) : rgba(c, 1); ctx.globalAlpha = lit; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, w * 0.4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  function draw(t) {
    flash = 0; const lw = W, lh = H; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, lw, lh);
    // secousse : monte avec l'accélération de la galaxie, éclate aux grands moments
    let sh = t < tA ? (t / tA) ** 3 * 5 : 0; for (const l of links) if (t > l && t < l + 0.25) sh = Math.max(sh, 3 * (best >= 3 ? 1.6 : 1)); ctx.save(); ctx.translate(Math.sin(t * 61) * sh, Math.cos(t * 53) * sh);
    // — A · allumage : la galaxie tourne de plus en plus vite
    if (t < tA + tB) {
      const u = clamp(t / tA), spin = 0.35 * t + 13 * tA * (u ** 3.2) / 3.2, sc = (0.55 + 0.45 * eo(u)) * (t > tA ? 1 + 1.5 * eo((t - tA) / tB) : 1), fade = t > tA ? 1 - eo((t - tA) / (tB * 0.9)) : 1, w = S * sc;
      ctx.globalCompositeOperation = 'lighter'; glow(cx, cy, S * (0.25 + 0.3 * u), rgba(bucketCol, 1), (0.25 + 0.4 * u).toFixed(2));
      const blur = low || u < 0.35 ? 1 : 3; for (let k = 0; k < blur; k++) { const a = spin - k * 0.045 * (1 + 6 * u * u); ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.globalAlpha = fade * (k ? 0.32 / k : 1); ctx.drawImage(gal, -w / 2, -w / 2, w, w); ctx.restore(); }
      ctx.globalAlpha = 1; glow(cx, cy, S * 0.11 * (1 + u), best >= 5 ? hsl(t * 200, 1, 80) : rgba([255, 255, 255], 1), (0.5 + 0.5 * u).toFixed(2)); ctx.globalCompositeOperation = 'source-over';
      if (t > tA) { ring(cx, cy, tA, tB * 1.4, Math.max(W, H) * 0.7, wcol(1), 6, t); flash = Math.max(flash, 0.5 * (1 - clamp((t - tA) / 0.25))); }
    }
    // — B/C : les astres jaillissent, puis les liens de lumière les allument un à un
    if (t >= tA && t < dk[0] + 0.6) {
      const dissolve = t > D0 ? 1 - eo((t - D0) / 0.5) : 1; ctx.globalAlpha = dissolve;
      const hole = scene === 'legend' ? t - bh : -1, conv = scene === 'cosmic' ? t - cvg : -1;
      if (hole >= 0 && hole < 3.3 * q) { const k = hole / (3.3 * q); ctx.fillStyle = `rgba(0,0,6,${Math.min(0.78, eio(Math.min(k * 4, 1)) * 0.78) * (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1)})`; ctx.fillRect(0, 0, lw, lh); }
      for (let i = 0; i < N; i++) {
        const born = clamp((t - tA - i * 0.06) / (tB * 0.8)), [bx, by] = pos(i), j = 0.0;
        let x = cx + (bx - cx) * ob(born), y = cy + (by - cy) * ob(born) + Math.sin(t * 1.6 + i) * 3, sc = 0.2 + 0.8 * eo(born), swallowed = false;
        if (scene === 'legend' && i === N - 1 && hole >= 0) { // le trou noir avale l'astre le plus rare
          const s0 = 0.7 * q, s1 = 2.1 * q, u2 = clamp((hole - s0) / (s1 - s0));
          if (hole >= s0 && hole < 2.6 * q) { const rr = R * (1 - u2 ** 1.4), a = -Math.PI / 2 + (i / N) * TAU + u2 * TAU * 2.4; x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr; sc *= 1 - 0.92 * u2; swallowed = hole > s1; if (swallowed) sc = 0; }
          else if (hole >= 2.6 * q) { const u3 = clamp((hole - 2.6 * q) / (0.7 * q)); x = cx + (bx - cx) * eo(u3); y = cy + (by - cy) * eo(u3); sc = 0.1 + 0.9 * ob(u3); }
        }
        if (scene === 'cosmic' && conv >= 0) { const u = clamp(conv / (1.5 * q)), a = -Math.PI / 2 + (i / N) * TAU + ei(u) * TAU * 1.6, rr = R * (1 - ei(u)); x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr; sc *= 1 - 0.85 * ei(u); if (conv > 2.2 * q) { const u3 = clamp((conv - 2.2 * q) / (0.8 * q)); x = cx + (bx - cx) * eo(u3); y = cy + (by - cy) * eo(u3); sc = 0.1 + 0.9 * ob(u3); } }
        const lt = lightAt(i), lit = clamp((t - lt) / 0.4), hiddenAura = scene === 'legend' && i === N - 1 && hole >= 0 && hole < 2.6 * q + 0.1 && hole < 3.3 * q && lit < 1;
        if (sc > 0.01) astre(i, x, y, sc, t, lit, scene === 'legend' && i === N - 1 && hole >= 0 && hole < 2.6 * q ? true : false);
        // astre allumé : étincelles à son arrivée
        if (i > 0 || true) sparks(x, y, lt, cards[i].r >= 3 ? 26 : 10, cards[i].r >= 3 ? (k) => hsl(k * 40 + t * 90, 1, 70) : rgba(COL[cards[i].r], 1), 70 + cards[i].r * 25, 0.7, t);
      }
      // liens : un faisceau de i-1 vers i (le dernier referme le polygone), pulsation de la meilleure des deux couleurs
      for (let i = 0; i < N; i++) {
        const ls = links[i], u = clamp((t - ls) / ld), a = i === 0 ? N - 1 : i - 1, b2 = i === 0 ? 0 : i; if (t < ls || (i === 0 && false)) continue;
        const [x0, y0] = pos(a), [x1, y1] = pos(b2), r2 = Math.max(cards[a].r, cards[b2].r), pr = r2 >= 3 || best >= 5, e = eo(u);
        if (scene === 'legend' && hole >= 0 && hole < 3.3 * q && (a === N - 1 || b2 === N - 1)) continue; // pendant l'avalement, les liens de l'astre rare disparaissent
        const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, pr ? hsl(t * 160, 1, 70) : rgba(COL[cards[a].r], 1)); g.addColorStop(1, pr ? hsl(t * 160 + 120, 1, 70) : rgba(COL[cards[b2].r], 1));
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = g; ctx.globalAlpha = (0.35 + 0.65 * (1 - clamp((t - ls - ld) / 2)) ** 0.5) * 1; ctx.lineWidth = pr ? 6 : 3.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); ctx.stroke(); ctx.lineWidth = pr ? 2 : 1.2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = 1;
        const tr = ls + ld; ring(x1, y1, tr, 0.7, R * (pr ? 0.9 : 0.55), pr ? hsl(t * 200, 1, 72) : rgba(COL[r2], 1), pr ? 7 : 3.5, t);
        if (pr && t > tr && t < tr + 0.25) flash = Math.max(flash, scene === 'epic' && i === N - 1 ? 0.8 : 0.16 * (1 - (t - tr) / 0.25));
        ctx.globalCompositeOperation = 'source-over';
      }
      // trou noir (légendaire)
      if (scene === 'legend' && bh && t >= bh && t < bh + 3.3 * q) {
        const h = t - bh, k = h / (3.3 * q), gr = k < 0.2 ? eo(k / 0.2) : k > 0.8 ? 1 - eo((k - 0.8) / 0.2) : 1, rr = R * 0.55 * gr;
        ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 2.6); const ac = ctx.createRadialGradient(0, 0, rr * 0.8, 0, 0, rr * 2); ac.addColorStop(0, 'rgba(255,255,255,.95)'); ac.addColorStop(0.2, 'rgba(255,200,110,.9)'); ac.addColorStop(0.55, 'rgba(255,110,40,.45)'); ac.addColorStop(1, 'rgba(120,30,200,0)'); ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(0, 0, rr * 2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,170,.7)'; ctx.lineWidth = 2; for (let a = 0; a < 5; a++) { ctx.beginPath(); ctx.arc(0, 0, rr * (1.15 + a * 0.2), a, a + 1.4); ctx.stroke(); } ctx.restore(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
        const out = 2.6 * q; if (h > out && h < out + 0.7 * q) { flash = Math.max(flash, 0.95 * (1 - (h - out) / (0.35 * q))); ring(cx, cy, bh + out, 0.9, Math.max(W, H) * 0.8, rgba(COL[4], 1), 10, t); }
        sparks(cx, cy, bh + out, 60, (k) => hsl(30 + k * 6, 1, 70), 260, 1.1, t, 3);
      }
      // convergence (cosmique) : tous les astres fusionnent en une lumière unique
      if (scene === 'cosmic' && conv >= 0 && conv < 3.3 * q) { const u = conv / (3.3 * q), core = eio(clamp((conv - 1 * q) / (1.4 * q))), out = conv > 2.3 * q ? eo((conv - 2.3 * q) / (0.5 * q)) : 0;
        ctx.globalCompositeOperation = 'lighter'; glow(cx, cy, S * (0.2 + 0.9 * core + 0.6 * out), hsl(t * 240, 1, 72), (0.85 * (1 - out * 0.4)).toFixed(2)); for (let a = 0; a < 12; a++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 1.3 + a * TAU / 12); ctx.fillStyle = hsl(a * 30 + t * 120, 1, 70, (0.3 * core).toFixed(2)); ctx.fillRect(S * 0.04, -1.5, S * (0.14 + 0.26 * core), 3); ctx.restore(); } ctx.globalCompositeOperation = 'source-over';
        flash = Math.max(flash, conv > 2.2 * q ? (conv < 2.7 * q ? eo((conv - 2.2 * q) / (0.5 * q)) : 1 - eo((conv - 2.7 * q) / (0.6 * q))) : 0); }
      ctx.globalAlpha = 1;
    }
    // — D · révélation : une carte retournée à la fois, la meilleure en dernier
    if (t >= D0 - 0.2) for (let k = 0; k < N; k++) {
      const tk = t - dk[k]; if (tk < -0.2) continue; const c = cards[k], isBest = k === N - 1, cw = Math.min(W * 0.6, 240), chh = cw * 1.38, cxk = cx, cyk = H * 0.4;
      const [sx, sy] = [(W / (N + 1)) * (k + 1), H * 0.74]; // sa place dans la rangée du bas
      const holdEnd = isBest ? tSum : 1.15, fly = isBest ? 0 : eio((tk - 0.95) / 0.35), appear = clamp((tk + 0.2) / 0.3);
      if (tk > holdEnd + (isBest ? 99 : 0.35) && !isBest) { cardMini(k, sx, sy, 1, t); continue; }
      const flip = clamp(tk / 0.7), face = flip > 0.5, sxs = Math.abs(Math.cos(flip * Math.PI)), k2 = isBest && t > tSum - 0.8 ? 1 - eio((t - (tSum - 0.8)) / 0.8) : 1;
      if (isBest && t > tSum) { cardMini(k, sx, sy, 1, t); continue; }
      let x = cxk + (sx - cxk) * fly, y = cyk + (sy - cyk) * fly, sc = (1 - 0.72 * fly) * (isBest ? 1.06 : 1) * (isBest && tk < 0.4 ? 0.9 + 0.1 * ob(tk / 0.4) : 1) * k2 + (1 - k2) * 0.3;
      if (isBest && t > tSum - 0.8) { x = cxk + (sx - cxk) * (1 - k2); y = cyk + (sy - cyk) * (1 - k2); }
      ctx.save(); ctx.globalAlpha = appear; ctx.translate(x, y); ctx.scale(sc * Math.max(0.02, sxs), sc);
      const col = COL[c.r], pc = c.r >= 3 || best >= 5 ? hsl(t * 150 + k * 50, 1, 66) : rgba(col, 1);
      if (face && isBest && c.r >= 2 && k2 > 0.01) { ctx.globalAlpha = appear * k2; ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.rotate(t * 0.6); for (let a = 0; a < 14; a++) { ctx.rotate(TAU / 14); ctx.fillStyle = c.r >= 3 ? hsl(a * 26 + t * 100, 1, 65, 0.16 + c.r * 0.03) : rgba(col, 0.15); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(chh * 1.1, -chh * 0.05); ctx.lineTo(chh * 1.1, chh * 0.05); ctx.fill(); } ctx.restore(); glow(0, 0, chh * 0.95, pc, (0.35 + c.r * 0.06).toFixed(2)); ctx.globalCompositeOperation = 'source-over'; }
      roundRect(-cw / 2, -chh / 2, cw, chh, 22); ctx.fillStyle = face ? 'rgba(14,16,44,.94)' : 'rgba(20,18,60,.96)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = pc; ctx.stroke();
      if (!face) { ctx.globalCompositeOperation = 'lighter'; glow(0, 0, cw * 0.5, rgba(col, 1), 0.4); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let a = 0; a < 3; a++) { ctx.beginPath(); ctx.ellipse(0, 0, cw * (0.14 + a * 0.08), cw * (0.05 + a * 0.03), a * 1.05, 0, TAU); ctx.stroke(); } }
      else { ctx.scale(1 / 1, 1); const b = big[k], bw = b.width / DPR; ctx.drawImage(b, -bw / 2, -chh / 2 + 18, bw, bw);
        ctx.textAlign = 'center'; ctx.fillStyle = pc; ctx.font = '800 12px Orbitron,sans-serif'; ctx.fillText(o.names.rar[c.r].toUpperCase(), 0, chh / 2 - 104);
        ctx.fillStyle = '#fff'; ctx.font = '900 19px Orbitron,sans-serif'; wrap(c.n.toUpperCase(), 0, chh / 2 - 78, cw - 24, 22);
        for (let d = 0; d < 6; d++) { ctx.fillStyle = d <= c.r ? pc : 'rgba(255,255,255,.18)'; ctx.beginPath(); const px = (d - 2.5) * 20, py = chh / 2 - 36; ctx.moveTo(px, py - 6); ctx.lineTo(px + 4.5, py); ctx.lineTo(px, py + 6); ctx.lineTo(px - 4.5, py); ctx.fill(); }
        ctx.font = '700 11px Orbitron,sans-serif'; ctx.fillStyle = c.isNew ? '#5dffc0' : '#ffc247'; ctx.fillText(c.isNew ? 'NOUVEAU' : 'DOUBLON · +1 EXEMPLAIRE', 0, chh / 2 - 12);
      }
      ctx.restore();
      if (face && tk > 0.5 && tk < 1.5) { const pr2 = c.r >= 3 || best >= 5; ring(x, y, dk[k] + 0.5, 0.9, cw * (0.8 + c.r * 0.15), pr2 ? hsl(t * 200, 1, 72) : rgba(col, 1), 4 + c.r * 1.5, t); sparks(x, y, dk[k] + 0.5, 14 + c.r * 14, pr2 ? (i) => hsl(i * 33 + t * 80, 1, 70) : rgba(col, 1), 140 + c.r * 50, 1.1, t, 2.6); if (isBest && c.r >= 3) flash = Math.max(flash, 0.5 * (1 - clamp((tk - 0.5) / 0.35))); }
      ctx.globalAlpha = 1;
    }
    if (t >= tSum - 0.4) for (let k = 0; k < N; k++) { /* récapitulatif : les cartes déjà rangées en bas sont déjà dessinées ; la meilleure s'y range à son tour */ }
    ctx.restore();
    if (flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flash)})`; ctx.fillRect(0, 0, lw, lh); }
    // titre
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '800 13px Orbitron,sans-serif'; const tt = o.names.pack; ctx.globalAlpha = t < D0 ? 1 : 0.5; ctx.fillText(tt.toUpperCase(), cx, 52 + 0); ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrap(txt, x, y, maxW, lh) { const words = txt.split(' '); let line = '', yy = y - (txt.length > 18 ? lh / 2 : 0); for (const w of words) { if (line && ctx.measureText(line + ' ' + w).width > maxW) { ctx.fillText(line, x, yy); yy += lh; line = w; } else line = line ? line + ' ' + w : w; } ctx.fillText(line, x, yy); }
  function cardMini(k, x, y, a, t) { const c = cards[k], w = Math.min(W / N - 8, 76), pc = c.r >= 3 || best >= 5 ? hsl(t * 150 + k * 50, 1, 66) : rgba(COL[c.r], 1); ctx.save(); ctx.translate(x, y); roundRect(-w / 2, -w * 0.72, w, w * 1.44, 12); ctx.fillStyle = 'rgba(14,16,44,.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = pc; ctx.stroke(); const m = mini[k], mw = (m.width / DPR) * (w / 96) * 0.95; ctx.drawImage(m, -mw / 2, -mw / 2 - 4, mw, mw); ctx.fillStyle = pc; ctx.font = '800 6.5px Orbitron,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.names.rar[c.r].toUpperCase(), 0, w * 0.62); ctx.restore(); }
  // — pilotage : boucle d'animation, tap pour accélérer la révélation, boutons de fin inertes un instant
  let t = 0, raf = 0, last = 0, done = false, ticked = -1, armed = 0, ended = false;
  const cue = (t0, f) => { if (t >= t0 && ticked < t0) { f(); } };
  const events = []; // sons et vibrations déclenchés une fois quand t franchit leur instant
  events.push([0, () => o.sfx.rise(tA)]); for (let i = 0; i < links.length; i++) events.push([links[i] + ld, () => { o.sfx.link(i, cards[Math.max(0, i === 0 ? N - 1 : i - 1)].r > cards[i === 0 ? 0 : i].r ? cards[i === 0 ? N - 1 : i - 1].r : cards[i === 0 ? 0 : i].r); o.vib(cards[i].r >= 3 ? [12, 25, 12] : 8); }]);
  if (scene === 'legend') { events.push([bh + 0.7 * q, () => o.sfx.swallow()], [bh + 2.6 * q, () => { o.sfx.boom(4); o.vib([40, 40, 80]); }]); }
  if (scene === 'cosmic') { events.push([cvg + 0.4, () => o.sfx.swallow()], [cvg + 2.3 * q, () => { o.sfx.boom(5); o.vib([40, 30, 40, 30, 120]); }]); }
  if (scene === 'epic') events.push([links[N - 1], () => o.sfx.boom(3)]);
  for (let k = 0; k < N; k++) events.push([dk[k] + 0.5, () => { o.sfx.hit(cards[k].r); o.vib(cards[k].r >= 4 ? [30, 40, 30, 40, 90] : cards[k].r >= 2 ? [20, 30, 30] : 12); }]);
  const fired = new Set();
  function advance(nt) { for (let i = 0; i < events.length; i++) if (!fired.has(i) && nt >= events[i][0]) { fired.add(i); if (!o.manual) events[i][1](); } t = nt; }
  function frame(now) { raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; if (!ended) advance(t + dt); draw(t); if (t >= D0 && !done && !hint.textContent) hint.textContent = 'Touche pour accélérer'; if (t >= tSum && !done) finish(); }
  function finish() { done = true; hint.textContent = o.onView ? 'Touche une carte pour l\'admirer' : ''; ui.classList.add('on'); armed = performance.now() + 700; root.classList.add('arming'); setTimeout(() => root.classList.remove('arming'), 700); const ag = root.querySelector('#pk-again'); const can = o.canAgain(); ag.textContent = can.label; ag.disabled = !can.ok; ag.hidden = false; }
  root.addEventListener('pointerdown', (e) => { if (done && o.onView) { const x = e.clientX, y = e.clientY, w = Math.min(W / N - 8, 76); for (let k = 0; k < N; k++) { const mx = (W / (N + 1)) * (k + 1), my = H * 0.74; if (Math.abs(x - mx) < w / 2 + 4 && Math.abs(y - my) < w * 0.72 + 4) { o.onView(cards[k].key); return; } } } if (done || t < D0 - 0.1) return; const nxt = dk.find((d) => d > t + 0.05); if (nxt !== undefined && nxt - t > 0.4) { advance(nxt - 0.0); } else if (t < tSum) advance(tSum); }); // toucher accélère : carte suivante, puis récapitulatif
  root.querySelector('#pk-end').addEventListener('click', () => { if (performance.now() < armed) return; stop(); o.onDone('end'); });
  root.querySelector('#pk-again').addEventListener('click', () => { if (performance.now() < armed) return; stop(); o.onDone('again'); });
  function stop() { ended = true; cancelAnimationFrame(raf); root.remove(); }
  build(); window.addEventListener('resize', build); hint.textContent = '';
  if (o.manual) { draw(0); } else { last = performance.now(); raf = requestAnimationFrame(frame); setTimeout(() => { if (!ended && t < tSum) hint.textContent = ''; }, 0); }
  return { duration: tSum, marks: { tA, L0, links, bh, cvg, D0, dk, tSum }, seek(nt) { advance(nt); draw(t); }, stop, get t() { return t; } };
}
