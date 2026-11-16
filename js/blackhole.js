// Critical — un vrai trou noir (WebGL), en deux temps pour que la qualité ne dépende pas de la vitesse de l'appareil.
//
// 1. CUISSON (une seule fois, par petites tranches pour ne jamais geler l'écran) : chaque pixel d'une carte haute définition suit un rayon
//    de lumière remonté depuis la caméra, courbé par la gravité du trou noir (accélération de Schwarzschild a = -1,5·h²·r̂/r⁵, rayon du
//    trou = 1). On range, pour chaque pixel : où le rayon croise le disque d'accrétion (1ère puis 2ᵉ fois : le disque et son image
//    déformée au-dessus de l'ombre), avec le décalage Doppler/gravitationnel, et dans quelle direction du ciel il repart (étoiles courbées).
// 2. AFFICHAGE (à chaque image, très léger) : on relit ces cartes, on anime la turbulence du disque (qui tourne plus vite près du centre),
//    on ajoute l'anneau de photons, le halo, et un ciel d'étoiles déformées par la lentille. Suréchantillonnage 2×2 : bords nets.
//
// Les cartes stockent des entiers dans des textures RGBA8 (lecture sans filtrage, DITHER coupé).
// Renvoie null si l'appareil ne sait pas faire (pas de WebGL, ou pas de calcul flottant assez précis) : l'appelant garde l'image fixe.

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

const BAKE = `
precision highp float;
uniform vec2 res; uniform float mode, order, steps;
const float RIN = 3.0, ROUT = 9.2, EL = 0.157;
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * res) / (.5 * res.y);
  vec3 o = vec3(0., sin(EL), cos(EL)), fw = -o, rt = vec3(1., 0., 0.), up = vec3(0., cos(EL), -sin(EL));
  vec3 pos = o * 30., vel = normalize(fw * 30. + (rt * p.x + up * p.y) * 11.);
  vec3 hv = cross(pos, vel); float h2 = dot(hv, hv);
  float n = 0.; bool cap = false, esc = false; vec4 hit = vec4(0.);
  for (int i = 0; i < 480; i++){
    if (float(i) > steps) break;
    float r2 = dot(pos, pos), r = sqrt(r2);
    if (r < 1.) { cap = true; break; }
    if (r > 36. && dot(pos, vel) > 0.) { esc = true; break; }
    float dt = clamp(.055 * r, .03, 1.);
    vel = normalize(vel - 1.5 * h2 * pos / (r2 * r2 * r) * dt);
    vec3 np = pos + vel * dt;
    if (pos.y * np.y < 0.){ // traversée du plan du disque
      vec3 hp = mix(pos, np, pos.y / (pos.y - np.y)); float rr = length(hp.xz);
      if (rr > RIN && rr < ROUT){
        if (mode < .5 && n == order){
          float beta = sqrt(.5 / rr);
          vec3 vor = normalize(vec3(-hp.z, 0., hp.x));
          float dop = 1. / (sqrt(1. - beta * beta) * (1. - beta * dot(vor, -vel)));
          hit = vec4(rr, atan(hp.z, hp.x), pow(dop * sqrt(max(1. - 1. / rr, 0.)), 3.), 1.);
          break;
        }
        n += 1.;
      }
    }
    pos = np;
  }
  vec4 o4 = vec4(0.);
  if (mode < .5){
    if (hit.w > .5){ // 1 + 11 bits de rayon, 12 bits d'angle, 7 bits de facteur
      float q1 = floor((hit.x - RIN) / (ROUT - RIN) * 2046. + .5) + 1.;
      float q2 = floor((hit.y / 6.2831853 + .5) * 4095. + .5);
      float q3 = floor(clamp(hit.z / 8., 0., 1.) * 127. + .5);
      o4 = vec4(floor(q1 / 8.), floor(q2 / 16.), mod(q1, 8.) * 32. + mod(q2, 16.) * 2., q3 * 2.) / 255.;
    }
  } else if (esc){ // direction de sortie du rayon : 2 × 16 bits (toujours non nulle ; tout zéro = rayon capturé = ombre)
    float th = floor(acos(clamp(vel.y, -1., 1.)) / 3.14159265 * 65534. + .5) + 1.;
    float ph = floor((atan(vel.z, vel.x) / 6.2831853 + .5) * 65534. + .5) + 1.;
    o4 = vec4(floor(th / 256.), mod(th, 256.), floor(ph / 256.), mod(ph, 256.)) / 255.;
  }
  gl_FragColor = o4;
}`;

const SHOW = `
precision highp float;
uniform sampler2D mA, mB, mS, nz;
uniform vec2 res; uniform float t;
const float RIN = 3.0, ROUT = 9.2, PI2 = 6.2831853;
const vec4 W = vec4(.5, .27, .15, .08);
vec3 ramp(float k){
  vec3 c = mix(vec3(.4, .05, .02), vec3(1., .34, .05), smoothstep(0., .35, k));
  c = mix(c, vec3(1., .7, .28), smoothstep(.3, .65, k));
  return mix(c, vec3(1., .96, .9), smoothstep(.62, 1., k));
}
vec4 disk(vec4 tx){
  vec4 b = floor(tx * 255. + .5);
  float q1 = b.x * 8. + floor(b.z / 32.);
  if (q1 < .5) return vec4(0.);
  float q2 = b.y * 16. + mod(floor(b.z / 2.), 16.), q3 = floor(b.w / 2.);
  float rr = RIN + (q1 - 1.) / 2046. * (ROUT - RIN), ph = (q2 / 4095. - .5) * PI2, f = q3 / 127. * 8.;
  float k = 1. - (rr - RIN) / (ROUT - RIN);
  vec2 xz = rr * vec2(cos(ph), sin(ph));
  float om = 4.2 / (rr * sqrt(rr));
  float p1 = fract(t / 12.), p2 = fract(t / 12. + .5), w1 = 1. - abs(2. * p1 - 1.); // deux couches de turbulence qui se relaient : la torsion ne s'accumule jamais
  float a1 = p1 * 12. * om, a2 = p2 * 12. * om;
  vec2 u1 = vec2(cos(a1) * xz.x - sin(a1) * xz.y, sin(a1) * xz.x + cos(a1) * xz.y);
  vec2 u2 = vec2(cos(a2) * xz.x - sin(a2) * xz.y, sin(a2) * xz.x + cos(a2) * xz.y);
  float n = mix(dot(texture2D(nz, u2 * .105 + .37), W), dot(texture2D(nz, u1 * .105), W), w1);
  float dens = .3 + 1.25 * n;
  float dg = pow(max(f, .001), .3333);
  float kk = clamp(k * .88 + (dg - 1.) * .5 + .08, 0., 1.);
  float I = pow(k, 1.4) * 1.7 + .2 + 1.1 * exp(-(rr - RIN) * 2.4);
  float al = smoothstep(RIN, RIN + .45, rr) * (1. - smoothstep(ROUT - 2.4, ROUT, rr)) * clamp(dens * .9, 0., 1.) * .95;
  return vec4(ramp(kk) * I * dens * f * al, al);
}
float h31(vec3 p){ p = fract(p * vec3(.1031, .103, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec3 stars(vec3 d){
  vec3 p = d * 72., i = floor(p), f = fract(p);
  float h = h31(i); if (h < .86) return vec3(0.);
  vec3 c = vec3(h31(i + 1.7), h31(i + 5.3), h31(i + 9.1)) * .6 + .2;
  float m = smoothstep(.25, 0., length(f - c)) * (.35 + .65 * h31(i + 3.3));
  return mix(vec3(.7, .8, 1.), vec3(1., .85, .6), h31(i + 7.7)) * m * 1.9;
}
vec4 shade(vec2 uv){
  vec2 p = (uv - .5) * 2.; float bp = length(p) * 11.;
  vec4 tS = texture2D(mS, uv);
  bool cap = dot(tS, vec4(1.)) < .001;
  vec3 col = vec3(0.); float al = 0.;
  if (!cap){
    vec4 b = floor(tS * 255. + .5);
    float th = ((b.x * 256. + b.y) - 1.) / 65534. * 3.14159265, ph = ((b.z * 256. + b.w) - 1.) / 65534. * PI2 - 3.14159265;
    vec3 d = vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
    float an = t * .02; d.xz = vec2(cos(an) * d.x - sin(an) * d.z, sin(an) * d.x + cos(an) * d.z); // le ciel dérive lentement
    col = stars(d) * (1. + 2.4 * exp(-max(bp - 2.6, 0.) * 1.1)) * (1. - smoothstep(.72, .98, length(p))); // les étoiles brillent près de l'ombre (lentille)
    al = max(col.r, max(col.g, col.b));
  }
  vec4 d1 = disk(texture2D(mB, uv)), d0 = disk(texture2D(mA, uv));
  col = d1.rgb + (1. - d1.a) * col; al = d1.a + (1. - d1.a) * al;
  col = d0.rgb + (1. - d0.a) * col; al = d0.a + (1. - d0.a) * al;
  if (cap) al = 1.;
  float side = .55 + .45 * clamp(p.x * 3., -1., 1.); // l'anneau de photons est plus brillant du côté où le disque s'approche de nous
  col += vec3(1., .82, .55) * (exp(-pow((bp - 2.7) / .11, 2.)) * .85 + exp(-pow((bp - 2.95) / .4, 2.)) * .22) * side;
  col += mix(vec3(1., .5, .2), vec3(.5, .3, 1.), smoothstep(2.6, 8., bp)) * exp(-max(bp - 2.55, 0.) * .45) * .2 * smoothstep(2.5, 2.66, bp);
  col = 1. - exp(-col * 1.15);
  return vec4(col, max(al, max(col.r, max(col.g, col.b))));
}
void main(){
  vec4 acc = vec4(0.);
  for (int j = 0; j < 4; j++){
    vec2 o = vec2((j == 0 || j == 2) ? -.25 : .25, j < 2 ? -.25 : .25);
    acc += shade((gl_FragCoord.xy + o) / res);
  }
  gl_FragColor = acc * .25;
}`;

// bruit sans couture (4 fréquences dans les 4 canaux) : une seule lecture de texture donne 4 octaves
function noiseData(N) {
  const d = new Uint8Array(N * N * 4), rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  [6, 12, 24, 48].forEach((fq, ch) => {
    const lat = Array.from({ length: fq * fq }, (_, i) => rnd(i + ch * 977));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x / N) * fq, v = (y / N) * fq, i = Math.floor(u), j = Math.floor(v);
      let fx = u - i, fy = v - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const g = (a, b) => lat[((b % fq) * fq) + (a % fq)];
      d[(y * N + x) * 4 + ch] = 255 * ((g(i, j) * (1 - fx) + g(i + 1, j) * fx) * (1 - fy) + (g(i, j + 1) * (1 - fx) + g(i + 1, j + 1) * fx) * fy);
    }
  });
  return d;
}

export const TIERS = [{ D: 640, M: 1280, steps: 300 }, { D: 448, M: 896, steps: 250 }, { D: 320, M: 640, steps: 210 }];

export function createBlackHole(cv, opt = {}) {
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  if (!hp || hp.precision < 23) return null; // les cartes exigent des flottants précis
  const prog = (fsrc) => {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { if (opt.debug) console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const v = mk(gl.VERTEX_SHADER, VS), f = mk(gl.FRAGMENT_SHADER, fsrc); if (!v || !f) return null;
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const pb = prog(BAKE), ps = prog(SHOW); if (!pb || !ps) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.disable(gl.DITHER); gl.disable(gl.BLEND); // sinon les entiers rangés dans les textures seraient altérés
  const tex = (w, h, data, filter, wrap) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap); return t;
  };
  const noise = tex(256, 256, noiseData(256), gl.LINEAR, gl.REPEAT);
  const fbo = gl.createFramebuffer(), U = {}, uni = (p, names) => names.forEach((n) => { U[p === pb ? 'b' + n : 's' + n] = gl.getUniformLocation(p, n); });
  uni(pb, ['res', 'mode', 'order', 'steps']); uni(ps, ['mA', 'mB', 'mS', 'nz', 'res', 't']);
  let ti = Math.min(TIERS.length - 1, Math.max(0, opt.tier != null ? opt.tier : (navigator.hardwareConcurrency || 4) <= 4 ? 1 : 0)), cfg = opt.custom || TIERS[ti];
  let maps = [], pass = 0, row = 0, rows = 16, warm = 0, rate = 0;
  const alloc = () => { maps.forEach((m) => gl.deleteTexture(m)); maps = [0, 1, 2].map(() => tex(cfg.M, cfg.M, null, gl.NEAREST, gl.CLAMP_TO_EDGE)); pass = 0; row = 0; warm = 0; rows = Math.max(4, Math.round(cfg.M / 64)); };
  alloc();
  const px = new Uint8Array(4);
  const o = { ready: false, lost: false, dirty: true, D: 0,
    get tier() { return ti; },
    size(d) { d = Math.max(64, Math.round(d)); if (cv.width !== d) { cv.width = cv.height = d; o.dirty = true; } o.D = d; },
    // un pas de cuisson (≈ 14 ms) ; renvoie l'avancement de 0 à 1
    step() {
      if (o.ready || o.lost) return 1;
      const t0 = performance.now();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, maps[pass], 0);
      gl.viewport(0, 0, cfg.M, cfg.M); gl.useProgram(pb);
      const loc = gl.getAttribLocation(pb, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.bres, cfg.M, cfg.M); gl.uniform1f(U.bmode, pass === 2 ? 1 : 0); gl.uniform1f(U.border, pass); gl.uniform1f(U.bsteps, cfg.steps);
      const h = Math.min(rows, cfg.M - row);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, row, cfg.M, h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disable(gl.SCISSOR_TEST);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // force la fin du calcul pour mesurer sa durée
      const ms = Math.max(0.5, performance.now() - t0); row += h;
      if (pass === 0 && ++warm > 2) rate = ms / h; // coût d'une ligne, mesuré sur la passe la plus courte
      if (row >= cfg.M) { row = 0; if (++pass >= 3) { o.ready = true; o.dirty = true; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return 1; } }
      rows = Math.max(4, Math.min(cfg.M >> 1, Math.round(rows * 14 / ms)));
      // trop lent (plus de ~9 s de calcul prévus) : on recommence en plus petit, une seule fois par palier
      if (!opt.custom && !opt.noRetier && rate && pass === 0 && rate * cfg.M * 3 * 1.6 > 9000 && ti < TIERS.length - 1) { cfg = TIERS[++ti]; alloc(); rate = 0; }
      return (pass + row / cfg.M) / 3;
    },
    draw(t) {
      if (!o.ready || o.lost) return; o.dirty = false;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(ps);
      const loc = gl.getAttribLocation(ps, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      [maps[0], maps[1], maps[2], noise].forEach((m, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, m); });
      gl.uniform1i(U.smA, 0); gl.uniform1i(U.smB, 1); gl.uniform1i(U.smS, 2); gl.uniform1i(U.snz, 3); gl.uniform2f(U.sres, cv.width, cv.height); gl.uniform1f(U.st, t);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } };
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); o.lost = true; });
  return o;
}
