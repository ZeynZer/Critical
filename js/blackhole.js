// Critical — un vrai trou noir, calculé pixel par pixel (WebGL).
// Chaque pixel suit un rayon de lumière remonté depuis la caméra ; la gravité le courbe (accélération de Schwarzschild
// a = -1,5·h²·r̂/r⁵, rayon du trou = 1). On obtient sans rien truquer : l'ombre (rayon ≈ 2,6), l'anneau de photons, et l'image
// du disque d'accrétion déformée au-dessus et au-dessous du trou. Le disque tourne plus vite près du centre (turbulence qui
// s'étire en spirale), un côté est plus brillant (effet Doppler) et le centre est plus chaud.
// Renvoie null si WebGL n'est pas disponible : l'appelant dessine alors un repli en 2D.

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 res; uniform float t; uniform float steps;
const float RIN = 3.0, ROUT = 9.2;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + vec2(7.1, 3.3); a *= .5; } return s; }
vec3 ramp(float k){ vec3 c = mix(vec3(.5, .07, .03), vec3(1., .4, .07), smoothstep(0., .5, k)); return mix(c, vec3(1., .93, .8), smoothstep(.5, 1., k)); }
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * res) / (.5 * res.y);
  float e = radians(8.) + .03 * sin(t * .21);
  vec3 o = vec3(0., sin(e), cos(e)), fw = -o, rt = vec3(1., 0., 0.), up = vec3(0., cos(e), -sin(e));
  vec3 pos = o * 30., vel = normalize(fw * 30. + (rt * p.x + up * p.y) * 11.);
  vec3 hv = cross(pos, vel); float h2 = dot(hv, hv);
  vec3 col = vec3(0.); float trans = 1.; bool cap = false;
  for (int i = 0; i < 150; i++){
    if (float(i) > steps) break;
    float r2 = dot(pos, pos), r = sqrt(r2);
    if (r < 1.) { cap = true; break; }
    if (r > 36. && dot(pos, vel) > 0.) break;
    float dt = clamp(.09 * r, .04, 1.4);
    vel = normalize(vel - 1.5 * h2 * pos / (r2 * r2 * r) * dt);
    vec3 np = pos + vel * dt;
    if (pos.y * np.y < 0.){ // le rayon traverse le plan du disque
      vec3 hp = mix(pos, np, pos.y / (pos.y - np.y)); float rr = length(hp.xz);
      if (rr > RIN && rr < ROUT){
        float k = 1. - (rr - RIN) / (ROUT - RIN);
        float a = t * .55 * 2.2 / (rr * sqrt(rr)); float ca = cos(a), sa = sin(a);
        float dens = .45 + .9 * fbm(vec2(ca * hp.x - sa * hp.z, sa * hp.x + ca * hp.z) * 1.7);
        vec3 vor = normalize(vec3(-hp.z, 0., hp.x)); float beta = sqrt(.5 / rr);
        float dop = 1. / (sqrt(1. - beta * beta) * (1. - beta * dot(vor, -vel)));
        float g = sqrt(max(1. - 1. / rr, 0.));
        vec3 c = ramp(k) * (pow(k, 1.5) * 1.9 + .22) * dens * pow(dop * g, 3.);
        float al = smoothstep(RIN, RIN + .5, rr) * (1. - smoothstep(ROUT - 2.2, ROUT, rr)) * clamp(dens, 0., 1.) * .93;
        col += trans * c * al; trans *= 1. - al;
      }
    }
    pos = np;
  }
  float d = length(p) * 11.;
  vec3 rgb = col;
  if (!cap) rgb += vec3(1., .5, .22) * exp(-max(d - 2.5, 0.) * .5) * .15 * trans; // halo de lumière autour de l'ombre
  rgb = 1. - exp(-rgb * 1.15);
  float al = cap ? 1. : max(1. - trans, max(rgb.r, max(rgb.g, rgb.b)));
  gl_FragColor = vec4(rgb, al);
}`;

export function createBlackHole(cv) {
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = { res: gl.getUniformLocation(pr, 'res'), t: gl.getUniformLocation(pr, 't'), steps: gl.getUniformLocation(pr, 'steps') };
  const o = { lost: false, dirty: true, steps: 120,
    size(px) { px = Math.max(64, Math.round(px)); if (cv.width !== px) { cv.width = cv.height = px; gl.viewport(0, 0, px, px); o.dirty = true; } }, // dirty : le contenu est à redessiner (redimensionner l'efface)
    draw(t) { if (o.lost) return; o.dirty = false; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(U.res, cv.width, cv.height); gl.uniform1f(U.t, t); gl.uniform1f(U.steps, o.steps); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } };
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); o.lost = true; });
  return o;
}
