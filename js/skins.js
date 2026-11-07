// Critical — matières de réacteurs. Un même rendu pour le jeu, l'éditeur, les aperçus.
// drawOrb(ctx, matière, x, y, rayon, [r,g,b], type, temps, { gl: halo, hp: boucliers, a: alpha, fast: mode léger })
const TAU = Math.PI * 2;
const rgba = (k, a) => `rgba(${k[0] | 0},${k[1] | 0},${k[2] | 0},${a})`;
const lite = (k, f) => k.map((v) => v + (255 - v) * f);
const shade = (k, f) => k.map((v) => v * f);
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function hue(k) { const [r, g, b] = k.map((v) => v / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; }

export const MATS = [['glass', 'Verre liquide'], ['crystal', 'Cristal taillé'], ['plasma', 'Plasma'], ['obsidian', 'Obsidienne'], ['diamond', 'Diamant prisme'], ['holo', 'Hologramme'], ['chrome', 'Chrome liquide'], ['nebula', 'Nébuleuse'], ['void', 'Trou noir'], ['honey', 'Miel'], ['neon', 'Néon tube'], ['sapphire', 'Saphir'], ['ruby', 'Rubis']];
const HEAVY = { plasma: 1, obsidian: 1, nebula: 1, holo: 1 }; // repli sur le verre en mode léger

const aura = (c, x, y, r, k, a, s = 2.6) => { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, r * 0.5, x, y, r * s); g.addColorStop(0, rgba(k, a)); g.addColorStop(1, rgba(k, 0)); c.fillStyle = g; c.fillRect(x - r * (s + 0.1), y - r * (s + 0.1), r * (2 * s + 0.2), r * (2 * s + 0.2)); c.globalCompositeOperation = 'source-over'; };
const clip = (c, x, y, r) => { c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip(); };
const rad = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const fillC = (c, x, y, r, g) => { c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };
const rim = (c, x, y, r, a = 0.5, w = 1.2) => { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w; c.beginPath(); c.arc(x, y, r - 0.6, 0, TAU); c.stroke(); };
const spec = (c, x, y, r, a = 0.75) => { c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.ellipse(x - r * 0.36, y - r * 0.5, r * 0.3, r * 0.14, -0.6, 0, TAU); c.fill(); };

function rings(c, x, y, r, k, hp, t) {
  c.lineWidth = Math.max(1.5, r * 0.12);
  for (let i = 0; i < hp; i++) { const R = r * (1.24 + 0.21 * i); c.strokeStyle = rgba(k, 0.85 - 0.17 * i); c.setLineDash([R * 0.95, R * 0.4]); c.lineDashOffset = -t * 22 * (i % 2 ? 1 : -1); c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); }
  c.setLineDash([]);
}
// symbole : 1 noyau + · 2 pulsar × · 3 étoile ✳ · 7 laser # · 8/9 mèche ○
function glyph(c, x, y, r, ty, col = 'rgba(255,255,255,.95)', w) {
  c.strokeStyle = col; c.lineWidth = w || Math.max(2, r * 0.16); c.lineCap = 'round'; c.beginPath();
  const L = r * (ty === 3 ? 0.5 : 0.46);
  if (ty === 7) { const q = L * 0.5; for (const s of [-1, 1]) { c.moveTo(x - L, y + s * q); c.lineTo(x + L, y + s * q); c.moveTo(x + s * q, y - L); c.lineTo(x + s * q, y + L); } }
  else if (ty === 8 || ty === 9) { c.moveTo(x + L * 0.55, y); c.arc(x, y, L * 0.55, 0, TAU); }
  else if (ty !== 2) { c.moveTo(x - L, y); c.lineTo(x + L, y); c.moveTo(x, y - L); c.lineTo(x, y + L); }
  if (ty === 2 || ty === 3) { const d = L * 0.72; c.moveTo(x - d, y - d); c.lineTo(x + d, y + d); c.moveTo(x + d, y - d); c.lineTo(x - d, y + d); }
  c.stroke();
}
const sparkle = (c, x, y, s, a) => { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke(); };

const B = {
  // Verre liquide (rendu par défaut) : coque givrée, réfraction, caustiques mouvantes
  glass(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.42 * gl); clip(c, x, y, r);
    fillC(c, x, y, r, rad(c, x - r * 0.3, y - r * 0.35, r * 0.05, r, [[0, rgba(lite(k, 0.7), 0.92)], [0.45, rgba(k, 0.66)], [1, rgba(lite(k, 0.22), 0.96)]]));
    fillC(c, x, y, r, rad(c, x + r * 0.1, y + r * 0.95, 0, r * 0.8, [[0, rgba(lite(k, 0.6), 0.7)], [1, rgba(k, 0)]]));
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const a = t * 0.5 + i * 2.1; fillC(c, x, y, r, rad(c, x + Math.cos(a) * r * 0.38, y + Math.sin(a * 1.3) * r * 0.38, 0, r * 0.5, [[0, hsl(hue(k) + i * 55 + t * 14, 100, 62, 0.26)], [1, 'rgba(0,0,0,0)']])); }
    c.globalCompositeOperation = 'source-over'; c.restore(); rim(c, x, y, r, 0.55); glyph(c, x, y, r, ty); spec(c, x, y, r);
  },
  // Cristal taillé : facettes qui captent la lumière, éclats
  crystal(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.32 * gl); const N = 8, Lg = t * 0.25;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU + 0.2, a1 = ((i + 1) / N) * TAU + 0.2, m = (a0 + a1) / 2, sh = 0.5 + 0.5 * Math.cos(a0 - Lg - 1);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r); c.closePath();
      const g = c.createLinearGradient(x, y, x + Math.cos(m) * r, y + Math.sin(m) * r); g.addColorStop(0, rgba(lite(k, 0.35 + 0.4 * sh), 0.95)); g.addColorStop(1, rgba(shade(k, 0.35 + 0.55 * sh), 0.95));
      c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.stroke();
    }
    c.beginPath(); for (let i = 0; i < N; i++) { const a = (i / N) * TAU + 0.2 + TAU / N / 2; c.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); } c.closePath(); c.fillStyle = rgba(lite(k, 0.6), 0.35); c.fill(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
    glyph(c, x, y, r, ty, 'rgba(255,255,255,.88)', Math.max(2, r * 0.13));
    for (let i = 0; i < 3; i++) { const p = (t * 0.8 + i * 0.33) % 1, a = i * 2.4 + 1; sparkle(c, x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, Math.sin(p * Math.PI) * r * 0.3, Math.sin(p * Math.PI)); }
  },
  // Plasma : pas de coque, tourbillon d'énergie + arcs électriques
  plasma(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r * 1.1, k, 0.75 * gl); clip(c, x, y, r);
    fillC(c, x, y, r, rad(c, x, y, 0, r, [[0, 'rgba(255,255,255,.95)'], [0.35, rgba(lite(k, 0.3), 0.85)], [1, rgba(shade(k, 0.5), 0.9)]]));
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const a = t * (1 + i * 0.3) + i * 1.3; fillC(c, x, y, r, rad(c, x + Math.cos(a) * r * 0.5, y + Math.sin(a * 0.9) * r * 0.5, 0, r * 0.55, [[0, hsl(hue(k) + i * 25, 100, 60, 0.5)], [1, 'rgba(0,0,0,0)']])); }
    const f = Math.floor(t * 16); c.lineWidth = Math.max(1.2, r * 0.05);
    for (let i = 0; i < 4; i++) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.beginPath(); let a = rnd(f * 7 + i) * TAU, px = x, py = y; c.moveTo(px, py); for (let s = 1; s <= 5; s++) { a += (rnd(f * 13 + i * 5 + s) - 0.5) * 1.1; px = x + Math.cos(a) * (r * s) / 5; py = y + Math.sin(a) * (r * s) / 5; c.lineTo(px, py); } c.stroke(); }
    c.globalCompositeOperation = 'source-over'; c.restore(); c.strokeStyle = rgba(lite(k, 0.5), 0.6); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); glyph(c, x, y, r, ty, 'rgba(20,10,40,.6)');
  },
  // Obsidienne : coque noire laquée, veines de lave qui pulsent
  obsidian(c, x, y, r, k, ty, t, gl) {
    const pulse = 0.72 + 0.28 * Math.sin(t * 2.6); aura(c, x, y, r, k, 0.4 * gl * pulse); clip(c, x, y, r);
    fillC(c, x, y, r, rad(c, x - r * 0.3, y - r * 0.35, r * 0.05, r, [[0, '#3a3350'], [0.5, '#12101c'], [1, '#07060c']]));
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let v = 0; v < 4; v++) {
      let a = v * 1.57 + 0.5, px = x + Math.cos(a) * r * 0.1, py = y + Math.sin(a) * r * 0.1; const pts = [[px, py]];
      for (let s = 1; s <= 5; s++) { a += (rnd(v * 9 + s) - 0.5) * 0.9; px += Math.cos(a) * r * 0.2; py += Math.sin(a) * r * 0.2; pts.push([px, py]); }
      for (const [col, w, al] of [[k, 0.17, 0.3], [lite(k, 0.55), 0.06, 1]]) { c.strokeStyle = rgba(col, al * pulse); c.lineWidth = r * w; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
    }
    fillC(c, x, y, r, rad(c, x, y, 0, r * 0.45, [[0, rgba(lite(k, 0.6), 0.75 * pulse)], [1, rgba(k, 0)]]));
    c.globalCompositeOperation = 'source-over'; c.restore(); spec(c, x, y, r, 0.5); rim(c, x, y, r, 0.18, 1); glyph(c, x, y, r, ty, rgba(lite(k, 0.7), 0.95));
  },
  // Diamant prisme : taille brillant, dispersion arc-en-ciel
  diamond(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, [255, 255, 255], 0.3 * gl); const N = 16;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU, m = (a0 + a1) / 2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r); c.closePath();
      const g = c.createLinearGradient(x, y, x + Math.cos(m) * r, y + Math.sin(m) * r), ph = 0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.8);
      g.addColorStop(0, i % 2 ? 'rgba(255,255,255,.98)' : 'rgba(215,230,255,.9)'); g.addColorStop(1, hsl(m * 57 + t * 40, 85, 70 + ph * 15, 0.95)); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 0.8; c.stroke();
    }
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.2; c.lineTo(x + Math.cos(a) * r * 0.48, y + Math.sin(a) * r * 0.48); } c.closePath(); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill();
    for (let i = 0; i < 4; i++) { const p = (t * 0.7 + i * 0.25) % 1, a = i * 1.7 + t * 0.3; sparkle(c, x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, Math.sin(p * Math.PI) * r * 0.34, Math.sin(p * Math.PI)); }
    glyph(c, x, y, r, ty, 'rgba(30,40,80,.72)');
  },
  // Hologramme : sphère filaire, balayage, aberration chromatique
  holo(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.26 * gl); const fl = Math.sin(t * 37) > 0.97 ? 0.45 : 1;
    const wire = (ox, col, a) => { c.strokeStyle = rgba(col, a * fl); c.lineWidth = 1.2; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x + ox, y, r * Math.abs(Math.cos(t * 0.7 + (i * Math.PI) / 4)), r, 0, 0, TAU); c.stroke(); } for (let j = -2; j <= 2; j++) { const rx = Math.sqrt(Math.max(0, r * r - (j * r * 0.36) ** 2)); c.beginPath(); c.ellipse(x + ox, y + j * r * 0.36, rx, rx * 0.22, 0, 0, TAU); c.stroke(); } c.beginPath(); c.arc(x + ox, y, r, 0, TAU); c.stroke(); };
    c.fillStyle = rgba(k, 0.1); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter'; wire(-r * 0.05, [255, 60, 110], 0.5); wire(r * 0.05, [60, 200, 255], 0.5); c.globalCompositeOperation = 'source-over'; wire(0, lite(k, 0.3), 0.95);
    clip(c, x, y, r); c.fillStyle = rgba(lite(k, 0.6), 0.32); c.fillRect(x - r, y - r + ((t * 0.7) % 1) * 2 * r, 2 * r, r * 0.12); c.restore(); glyph(c, x, y, r, ty, rgba(lite(k, 0.6), 0.95));
  },
  // Chrome liquide : métal miroir, reflet d'horizon
  chrome(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.14 * gl); clip(c, x, y, r);
    const g = c.createLinearGradient(0, y - r, 0, y + r); [[0, '#f2f7ff'], [0.42, '#9fb0d0'], [0.5, '#1a2038'], [0.56, '#0d1020'], [0.7, rgba(lite(k, 0.2), 1)], [1, rgba(shade(k, 0.6), 1)]].forEach(([o, col]) => g.addColorStop(o, col)); fillC(c, x, y, r, g);
    fillC(c, x, y, r, rad(c, x, y, r * 0.55, r, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,10,.55)']]));
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x + Math.sin(t * 0.8) * r * 0.25 - r * 0.08, y - r, r * 0.16, 2 * r); c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x - r * 0.4, y - r * 0.5, r * 0.22, r * 0.1, -0.6, 0, TAU); c.fill(); rim(c, x, y, r, 0.7, 1.4); glyph(c, x, y, r, ty, 'rgba(10,14,30,.78)');
  },
  // Nébuleuse : galaxie dans une bulle
  nebula(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.5 * gl); clip(c, x, y, r); c.fillStyle = '#070818'; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const a = t * 0.35 * (i % 2 ? 1 : -1) + i * 1.05, d = r * (0.25 + 0.3 * rnd(i)); fillC(c, x, y, r, rad(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 0, r * 0.7, [[0, hsl(hue(k) + i * 34, 90, 58, 0.5)], [1, 'rgba(0,0,0,0)']])); }
    for (let i = 0; i < 22; i++) { const a = rnd(i) * TAU + t * 0.1, d = Math.sqrt(rnd(i + 50)) * r * 0.95; c.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))})`; c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6, 1.6); }
    fillC(c, x, y, r, rad(c, x, y, r * 0.6, r, [[0, 'rgba(0,0,0,0)'], [1, rgba(lite(k, 0.3), 0.7)]])); c.globalCompositeOperation = 'source-over'; c.restore(); rim(c, x, y, r, 0.5); glyph(c, x, y, r, ty);
  },
  // Trou noir : disque noir, anneau d'accrétion, lentille
  void(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r * 1.2, k, 0.5 * gl); c.globalCompositeOperation = 'lighter';
    fillC(c, x, y, r * 1.4, rad(c, x, y, r * 0.7, r * 1.3, [[0, rgba(k, 0)], [0.5, rgba(k, 0.5)], [1, rgba(k, 0)]]));
    c.save(); c.translate(x, y); c.rotate(-0.35); c.scale(1, 0.3);
    for (let i = 0; i < 3; i++) { c.strokeStyle = i === 0 ? rgba(lite(k, 0.7), 0.95) : i === 1 ? rgba(k, 0.6) : 'rgba(255,255,255,.5)'; c.lineWidth = r * (0.22 - i * 0.07); c.setLineDash([r * (1.6 - i * 0.3), r * 0.35]); c.lineDashOffset = -t * r * (1.2 + i * 0.4); c.beginPath(); c.arc(0, 0, r * (1.12 - i * 0.04), 0, TAU); c.stroke(); }
    c.setLineDash([]); c.restore(); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, r * 0.72, 0, TAU); c.fill(); c.strokeStyle = rgba(lite(k, 0.8), 0.9); c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, r * 0.68, 0, TAU); c.stroke(); glyph(c, x, y, r * 0.75, ty, rgba(lite(k, 0.7), 0.92));
  },
  // Miel : ambre translucide, bulles qui montent, goutte qui s'étire
  honey(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.4 * gl);
    const dl = r * (0.14 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.3))); // goutte
    c.fillStyle = rgba(shade(k, 0.9), 0.92); c.beginPath(); c.moveTo(x - r * 0.2, y + r * 0.9); c.quadraticCurveTo(x, y + r + dl * 1.6, x + r * 0.2, y + r * 0.9); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(x - r * 0.05, y + r + dl * 0.6, r * 0.04, r * 0.07, 0, 0, TAU); c.fill();
    clip(c, x, y, r);
    fillC(c, x, y, r, rad(c, x - r * 0.15, y - r * 0.2, r * 0.05, r, [[0, rgba(lite(k, 0.65), 0.96)], [0.5, rgba(k, 0.95)], [1, rgba(shade(k, 0.5), 1)]]));
    c.globalCompositeOperation = 'lighter'; fillC(c, x, y, r, rad(c, x, y + r * 0.2, 0, r, [[0, rgba(lite(k, 0.4), 0.35)], [1, rgba(k, 0)]])); c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 6; i++) { const p = (t * (0.12 + rnd(i) * 0.1) + rnd(i + 9)) % 1, bx = x + (rnd(i + 3) - 0.5) * r * 1.2, by = y + r * (1 - p * 2.2), br = r * (0.05 + rnd(i + 6) * 0.07); c.fillStyle = 'rgba(255,240,200,.35)'; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, TAU); c.fill(); }
    c.restore(); c.strokeStyle = 'rgba(255,230,170,.7)'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r - 0.7, Math.PI * 1.05, Math.PI * 1.7); c.stroke(); spec(c, x, y, r, 0.8); glyph(c, x, y, r, ty, 'rgba(110,50,0,.7)');
  },
  // Néon tube : tube de verre lumineux, cœur blanc brûlant, vacillement
  neon(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r * 1.1, k, 0.7 * gl, 2.8); const fl = Math.sin(t * 23 + 1) * Math.sin(t * 7.3) > 0.82 ? 0.35 : 1;
    c.fillStyle = 'rgba(5,6,16,.55)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    const tube = (rr, a0, a1, w, col, a) => { c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, rr, a0, a1); c.stroke(); c.globalAlpha = 1; };
    c.globalCompositeOperation = 'lighter'; tube(r * 0.92, 0, TAU, r * 0.4, rgba(k, 0.28 * fl), 1); c.globalCompositeOperation = 'source-over';
    tube(r * 0.92, 0.35, TAU - 0.05, r * 0.2, rgba(k, 1), fl); tube(r * 0.92, 0, 0.25, r * 0.2, rgba(k, 1), fl > 0.5 ? 0.25 : 1); tube(r * 0.92, 0.35, TAU - 0.05, r * 0.08, 'rgba(255,255,255,.95)', fl);
    c.strokeStyle = rgba(k, fl); c.lineWidth = r * 0.17; c.lineCap = 'round'; c.shadowColor = rgba(k, 1); c.shadowBlur = r * 0.5; glyph(c, x, y, r, ty, rgba(lite(k, 0.2), fl), r * 0.17); glyph(c, x, y, r, ty, `rgba(255,255,255,${0.95 * fl})`, r * 0.07); c.shadowBlur = 0;
  },
  // Saphir : taille émeraude, reflets blancs qui balaient la pierre
  sapphire(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.4 * gl); const R = r * 0.92, cut = R * 0.38; const path = (RR, cc) => { c.beginPath(); c.moveTo(x - RR + cc, y - RR); c.lineTo(x + RR - cc, y - RR); c.lineTo(x + RR, y - RR + cc); c.lineTo(x + RR, y + RR - cc); c.lineTo(x + RR - cc, y + RR); c.lineTo(x - RR + cc, y + RR); c.lineTo(x - RR, y + RR - cc); c.lineTo(x - RR, y - RR + cc); c.closePath(); };
    path(R, cut); const g = c.createLinearGradient(x - R, y - R, x + R, y + R); g.addColorStop(0, rgba(lite(k, 0.5), 1)); g.addColorStop(0.5, rgba(k, 1)); g.addColorStop(1, rgba(shade(k, 0.35), 1)); c.fillStyle = g; c.fill();
    path(R * 0.66, cut * 0.66); const g2 = c.createLinearGradient(x + R, y - R, x - R, y + R); g2.addColorStop(0, rgba(shade(k, 0.5), 0.95)); g2.addColorStop(1, rgba(lite(k, 0.45), 0.95)); c.fillStyle = g2; c.fill(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; c.stroke();
    path(R, cut); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.2; c.stroke();
    c.save(); path(R, cut); c.clip(); const s = ((t * 0.45) % 1) * 3 * R - 1.5 * R; c.translate(x + s, y); c.rotate(0.6); const sg = c.createLinearGradient(-R * 0.18, 0, R * 0.18, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg; c.fillRect(-R * 0.18, -2 * R, R * 0.36, 4 * R); c.restore();
    glyph(c, x, y, r * 0.9, ty, 'rgba(255,255,255,.9)'); sparkle(c, x - R * 0.55, y - R * 0.55, r * 0.22 * (0.5 + 0.5 * Math.sin(t * 3)), 0.9);
  },
  // Rubis : cabochon profond, étoile à six branches qui scintille
  ruby(c, x, y, r, k, ty, t, gl) {
    aura(c, x, y, r, k, 0.46 * gl); clip(c, x, y, r);
    fillC(c, x, y, r, rad(c, x - r * 0.2, y - r * 0.25, r * 0.05, r, [[0, rgba(lite(k, 0.55), 1)], [0.35, rgba(k, 1)], [1, rgba(shade(k, 0.28), 1)]]));
    c.globalCompositeOperation = 'lighter'; c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.6) * 0.18);
    for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); const g = c.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,235,240,${0.55 + 0.3 * Math.sin(t * 2 + i)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-r, -r * 0.045, 2 * r, r * 0.09); }
    c.restore(); fillC(c, x, y, r, rad(c, x, y, 0, r * 0.3, [[0, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']])); c.globalCompositeOperation = 'source-over';
    fillC(c, x, y, r, rad(c, x, y + r * 0.9, 0, r * 0.7, [[0, rgba(lite(k, 0.5), 0.5)], [1, rgba(k, 0)]])); c.restore(); rim(c, x, y, r, 0.45); spec(c, x, y, r, 0.85); glyph(c, x, y, r, ty, 'rgba(255,255,255,.9)', Math.max(1.8, r * 0.1));
  },
};

export function drawOrb(c, mat, x, y, r, k, ty, t, o = {}) {
  if (!(r >= 1.5)) return; // trop petit (début de l'animation d'apparition)
  const fn = (o.fast && HEAVY[mat]) ? B.glass : B[mat] || B.glass;
  if (o.a != null && o.a !== 1) { c.save(); c.globalAlpha *= o.a; }
  rings(c, x, y, r, k, o.hp | 0, t);
  fn(c, x, y, r, k, ty, t, o.gl == null ? 1 : o.gl);
  if (o.a != null && o.a !== 1) c.restore();
}
