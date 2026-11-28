// Critical — verre liquide physique (réfraction de Snell par canal RVB, biseau convexe, Fresnel, reflet, flou), d'après le skill « liquid-glass ».
// Différences avec le moteur d'origine : le calque est TRANSPARENT hors du verre (seuls le verre et son ombre sont dessinés), le fond est un
// morceau d'une toile du jeu (fond étoilé de l'accueil, cuve en partie) et il n'y a pas de boucle propre : c'est le jeu qui demande un rendu.
// Réservé à l'administrateur pour l'instant (Réglages › Verre liquide) ; repli automatique sur le verre dépoli habituel sans WebGL2.
const MAX = 8;
const fsFor = (max) => FS.replace('#define MAX 8', '#define MAX ' + max);
const VS = `#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FS = `#version 300 es
precision highp float;
#define MAX ${MAX}
uniform sampler2D uBg;uniform vec2 uRes;uniform vec4 uS[MAX];uniform float uR[MAX];uniform int uN;
uniform float uK,uIor,uBezel,uDepth,uDisp,uBlur,uTint,uLight,uSpec,uDpr,uShadow;uniform int uEdge;
out vec4 o;
float sdBox(vec2 p,vec2 b,float r){r=min(r,min(b.x,b.y));vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float map(vec2 p){float d=1e5;for(int i=0;i<MAX;i++){if(i>=uN)break;float di=sdBox(p-uS[i].xy,uS[i].zw,uR[i]);d=i==0?di:smin(d,di,uK);}return d;}
vec3 tex(vec2 p,float lod){return textureLod(uBg,vec2(p.x/uRes.x,1.-p.y/uRes.y),lod).rgb;}
vec3 blurTex(vec2 p,float rad){
 if(rad<.5)return tex(p,0.);
 float lod=max(log2(rad/3.),0.);vec3 c=tex(p,lod);
 for(int i=0;i<10;i++){float f=float(i)+.5;float a=f*2.39996;c+=tex(p+vec2(cos(a),sin(a))*sqrt(f/10.)*rad,lod);}
 return c/11.;}
vec2 refrOff(vec3 n,float eta,float dist){vec3 r=refract(vec3(0,0,-1),n,eta);vec2 v=r.xy/max(-r.z,.08)*dist;float m=length(v),cap=dist*3.;return m>cap?v*cap/m:v;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
 float d=map(p),ds=map(p-vec2(0.,8.*uDpr));
 float sh=(1.-smoothstep(-8.*uDpr,26.*uDpr,ds))*uShadow;
 if(d>1.5*uDpr){o=vec4(0.,0.,0.,sh);return;}
 if(uEdge==1&&-d>uBezel*uDpr+1.){o=vec4(0.);return;} // vitre : le centre plat ne déforme rien, on y laisse l'image d'origine (nette, et rien à calculer)
 float bez=uBezel*uDpr,t=clamp(-d/bez,0.,1.),e=1.-t,root=sqrt(max(1.-e*e,1e-4));
 float h=bez*root,slope=min(e/root,40.);
 vec2 gd=vec2(map(p+vec2(1,0))-map(p-vec2(1,0)),map(p+vec2(0,1))-map(p-vec2(0,1)));gd/=max(length(gd),1e-5);
 vec3 n=normalize(vec3(gd*slope,1.));
 float dist=h+uDepth*uDpr,br=uBlur*uDpr;
 vec3 col=vec3(blurTex(p+refrOff(n,1./(uIor-uDisp),dist),br).r,blurTex(p+refrOff(n,1./uIor,dist),br).g,blurTex(p+refrOff(n,1./(uIor+uDisp),dist),br).b);
 float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,1.18);col=mix(col,vec3(1.),uTint);
 float F=.04+.96*pow(1.-n.z,5.);col=mix(col,tex(p-n.xy*bez*2.,6.)*1.1+.12,clamp(F,0.,1.)*.7);
 float a=radians(uLight);vec2 L2=vec2(cos(a),sin(a));vec3 Hh=normalize(normalize(vec3(L2,.9))+vec3(0,0,1));
 float spec=pow(max(dot(n,Hh),0.),80.)*1.2,face=dot(gd,L2);
 float rim=exp(d/(1.2*uDpr))*(.35+.65*pow(abs(face),1.5))*(face>0.?1.:.6);
 col+=(spec+rim*.9)*uSpec;col*=1.-.08*e*e;
 float m=clamp(.5-d/uDpr,0.,1.);
 o=vec4(col*m,m+sh*(1.-m));
}`;
let ok = null;
export function supported() { if (ok === null) { try { ok = !!document.createElement('canvas').getContext('webgl2'); } catch (e) { ok = false; } } return ok; }
let enabled = false;
export const on = () => enabled && supported();
export function setOn(v) { enabled = !!v; }

// Crée un rendu de verre sur `canvas`. Renvoie null sans WebGL2.
// render(src, sx, sy, sw, sh, shapes, cssW, cssH, dpr) : src = toile de fond, (sx, sy, sw, sh) = la zone de src derrière le calque (pixels de src),
// shapes = [{ x, y, w, h, r }] en px CSS dans le calque (centre, demi-largeur, demi-hauteur, rayon d'angle).
export function glass(canvas, params = {}, max = MAX) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const P = Object.assign({ ior: 1.5, bezel: 30, depth: 40, disp: 0.04, blur: 1.5, tint: 0.06, fuse: 60, light: -45, spec: 1, shadow: 0.25 }, params);
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  let prog; try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsFor(max))); gl.linkProgram(prog); gl.useProgram(prog); } catch (e) { return null; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uBg', 'uRes', 'uS', 'uR', 'uN', 'uK', 'uIor', 'uBezel', 'uDepth', 'uDisp', 'uBlur', 'uTint', 'uLight', 'uSpec', 'uDpr', 'uShadow', 'uEdge']) U[n] = gl.getUniformLocation(prog, n);
  const tx = gl.createTexture(), bc = document.createElement('canvas'), bx = bc.getContext('2d');
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  const a = new Float32Array(max * 4), r = new Float32Array(max);
  function render(src, sx, sy, sw, shh, shapes, W, H, dpr) {
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (bc.width !== cw || bc.height !== ch) { bc.width = cw; bc.height = ch; }
    bx.clearRect(0, 0, cw, ch); if (src && sw > 0 && shh > 0) bx.drawImage(src, sx, sy, sw, shh, 0, 0, cw, ch);
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc); gl.generateMipmap(gl.TEXTURE_2D);
    gl.viewport(0, 0, cw, ch); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const s = shapes.slice(0, max); a.fill(0); r.fill(0);
    s.forEach((q, i) => { a.set([q.x * dpr, q.y * dpr, q.w * dpr, q.h * dpr], i * 4); r[i] = (q.r == null ? 20 : q.r) * dpr; });
    gl.uniform1i(U.uBg, 0); gl.uniform2f(U.uRes, cw, ch); gl.uniform4fv(U.uS, a); gl.uniform1fv(U.uR, r); gl.uniform1i(U.uN, s.length);
    gl.uniform1f(U.uK, Math.max(P.fuse, 0.01) * dpr); gl.uniform1f(U.uIor, P.ior); gl.uniform1f(U.uBezel, P.bezel); gl.uniform1f(U.uDepth, P.depth);
    gl.uniform1f(U.uDisp, P.disp); gl.uniform1f(U.uBlur, P.blur); gl.uniform1f(U.uTint, P.tint); gl.uniform1f(U.uLight, P.light);
    gl.uniform1f(U.uSpec, P.spec); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uShadow, P.shadow); gl.uniform1i(U.uEdge, P.edge ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { render, params: P, destroy() { gl.deleteProgram(prog); gl.deleteTexture(tx); gl.deleteBuffer(buf); } };
}

// Barre d'onglets de l'accueil en verre liquide : un calque WebGL sous les boutons, qui réfracte le fond étoilé (toile .hm-space).
// update() est appelé par le fond étoilé après chaque image (30 i/s sur la page Jouer, 15 ailleurs).
let tab = null;
export function tabBar(on) {
  const nav = document.querySelector('.hm-tabs'), space = document.querySelector('.hm-space');
  if (!on || !supported() || !nav || !space) { if (tab) { tab.cv.remove(); tab.g.destroy(); tab = null; } if (nav) nav.classList.remove('lq'); return null; }
  if (tab) return tab;
  const cv = document.createElement('canvas'); cv.className = 'lq-cv'; const g = glass(cv, { ior: 1.5, bezel: 22, depth: 30, disp: 0.045, blur: 2.2, tint: 0.07, fuse: 40, spec: 1, shadow: 0.35 });
  if (!g) return null;
  nav.prepend(cv); nav.classList.add('lq');
  if (!document.getElementById('lq-css')) { const st = document.createElement('style'); st.id = 'lq-css'; st.textContent = '.hm-tabs.lq{background:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:none!important;border-color:transparent!important}.hm-tabs.lq::before,.hm-tabs.lq::after{display:none!important}.lq-cv{position:absolute;left:-14px;top:-14px;width:calc(100% + 28px);height:calc(100% + 28px);pointer-events:none;z-index:0}.hm-tabs.lq>button{position:relative;z-index:1}.hm-tabs.lq>.hm-ind{z-index:1}'; document.head.append(st); }
  tab = { cv, g, update() {
    const r = nav.getBoundingClientRect(); if (!r.width) return; const W = r.width + 28, H = r.height + 28, k = space.width / (space.clientWidth || 1), sr = space.getBoundingClientRect();
    g.render(space, (r.left - 14 - sr.left) * k, (r.top - 14 - sr.top) * k, W * k, H * k, [{ x: W / 2, y: H / 2, w: r.width / 2, h: r.height / 2, r: r.height / 2 }], W, H, Math.min(devicePixelRatio || 1, 2));
  } };
  tab.update(); return tab;
}
export const tabUpdate = () => { if (tab) tab.update(); if (full) full.dirty = true; }; // appelé par le fond étoilé après chaque image

// ============ Astres en verre liquide (privé, réservé à l'administrateur) ============
// Chaque astre devient une sphère de verre qui réfracte la cuve (dispersion RVB), teintée de la couleur de son rang, avec un cœur lumineux
// qui grossit avec le rang (la galaxie : une spirale qui tourne) ; deux astres proches se fondent comme deux gouttes (union lisse).
// Normales et teintes calculées en une seule boucle (moyenne pondérée des sphères voisines) : jusqu'à 48 astres par image.
const OMAX = 48;
const OFS = `#version 300 es
precision highp float;
#define N ${OMAX}
uniform sampler2D uBg;uniform vec2 uRes;uniform vec4 uC[N];uniform vec3 uK[N];uniform int uN;uniform float uDpr,uT,uFuse;
out vec4 o;
vec3 tex(vec2 p){return texture(uBg,vec2(p.x/uRes.x,1.-p.y/uRes.y)).rgb;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
 float d=1e5,ws=0.,rl=0.,core=0.,hole=0.,ring=0.,jet=0.,kf=uFuse*uDpr;vec2 g=vec2(0.);vec3 tc=vec3(0.),cc=vec3(0.),gal=vec3(0.);
 for(int i=0;i<N;i++){ if(i>=uN)break; vec4 c=uC[i]; vec2 q=p-c.xy; float l=max(length(q),1e-3), di=l-c.z;
  d=i==0?di:smin(d,di,kf);
  float w=exp(-max(di,-c.z)/(c.z*.35+6.*uDpr)); ws+=w; g+=w*q/l; tc+=w*uK[i]; rl+=w*c.z;
  float tier=c.w, rr=l/c.z, cr=c.z*(.16+.022*min(tier,12.)), e=exp(-(l*l)/(cr*cr));
  if(tier>11.5){                                                    // galaxie : bras en spirale colorés qui tournent, petit bulbe
   float a=atan(q.y,q.x), arm=pow(.5+.5*sin(2.*a+9.*rr-uT*1.6),3.)*smoothstep(.95,.15,rr);
   gal+=arm*mix(vec3(.55,.75,1.),uK[i]*1.3+.2,rr)+vec3(1.,.9,.75)*exp(-rr*rr*40.)*1.2; e*=.15;
  } else if(tier>9.5&&tier<10.5){                                   // trou noir : cœur noir, anneau de lumière
   hole=max(hole,1.-smoothstep(.36,.46,rr)); ring+=exp(-pow((rr-.5)/.05,2.)); e=0.;
  } else if(tier>10.5){                                             // quasar : cœur aveuglant et deux jets
   jet+=exp(-abs(q.x)/(c.z*.05))*exp(-abs(q.y)/(c.z*.9))*smoothstep(1.05,.2,rr); e*=.55;
  } else if(tier>8.5&&tier<9.5){ e*=.6+.5*pow(.5+.5*sin(uT*5.+c.x*.01),4.); } // étoile à neutrons : pulsation
  core+=e; cc+=e*uK[i];
 }
 if(d>1.5*uDpr||ws<1e-5){o=vec4(0.);return;}
 g/=max(length(g),1e-4); tc/=ws; rl/=ws;
 float bez=rl*.95, t=clamp(-d/bez,0.,1.), e=1.-t, root=sqrt(max(1.-e*e,1e-4)), h=bez*root, slope=min(e/root,30.);
 vec3 n=normalize(vec3(g*slope,1.));
 float dist=h*.9+8.*uDpr;
 vec2 o1=refract(vec3(0,0,-1),n,1./1.46).xy, o2=refract(vec3(0,0,-1),n,1./1.5).xy, o3=refract(vec3(0,0,-1),n,1./1.54).xy;
 vec3 bg=vec3(tex(p+o1*dist*2.2).r,tex(p+o2*dist*2.2).g,tex(p+o3*dist*2.2).b);
 vec3 col=mix(bg,bg*(.55+tc*1.1)+tc*.22,.62);                                   // verre teinté par le rang
 float F=.04+.96*pow(1.-n.z,5.); col=mix(col,tc*.9+.25,clamp(F,0.,1.)*.55);     // Fresnel : bords plus clairs et colorés
 col+=cc/max(core,1e-4)*min(core,1.)*1.15;                                       // cœur lumineux
 col+=gal*.95;                                                                     // galaxie
 col=mix(col,vec3(.01,.0,.03),hole*.96)+vec3(1.,.8,.55)*ring*1.1+vec3(.75,.9,1.)*jet*.9; // trou noir, quasar
 vec3 L=normalize(vec3(-.55,-.7,.9)); float sp=pow(max(dot(n,normalize(L+vec3(0,0,1))),0.),70.)*1.4;
 float sp2=pow(max(dot(n,normalize(vec3(.5,.6,.9)+vec3(0,0,1))),0.),25.)*.18;   // contre-jour doux en bas à droite
 float rim=exp(d/(1.1*uDpr))*.55;
 col+=vec3(sp)+tc*sp2+(tc*.6+.4)*rim;
 float m=clamp(.5-d/uDpr,0.,1.);
 o=vec4(col*m,m);
}`;
export function orbs(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  let prog; try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, OFS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null; gl.useProgram(prog); } catch (e) { return null; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uBg', 'uRes', 'uC', 'uK', 'uN', 'uDpr', 'uT', 'uFuse']) U[n] = gl.getUniformLocation(prog, n);
  const tx = gl.createTexture(), bc = document.createElement('canvas'), bx = bc.getContext('2d');
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  const C = new Float32Array(OMAX * 4), K = new Float32Array(OMAX * 3);
  // list : [{ x, y, r, tier, col:[r,g,b] }] en px CSS dans le calque
  function render(src, sx, sy, sw, shh, list, W, H, dpr, t) {
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (bc.width !== cw || bc.height !== ch) { bc.width = cw; bc.height = ch; }
    bx.clearRect(0, 0, cw, ch); bx.drawImage(src, sx, sy, sw, shh, 0, 0, cw, ch);
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);
    gl.viewport(0, 0, cw, ch); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const L = list.slice(0, OMAX); C.fill(0); K.fill(0);
    L.forEach((q, i) => { C.set([q.x * dpr, q.y * dpr, q.r * dpr, q.tier], i * 4); K.set([q.col[0] / 255, q.col[1] / 255, q.col[2] / 255], i * 3); });
    gl.uniform1i(U.uBg, 0); gl.uniform2f(U.uRes, cw, ch); gl.uniform4fv(U.uC, C); gl.uniform3fv(U.uK, K); gl.uniform1i(U.uN, L.length);
    gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uT, t); gl.uniform1f(U.uFuse, 3.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { render };
}
let orbsEnabled = false;
export const orbsOn = () => orbsEnabled && supported();
export function setOrbs(v) { orbsEnabled = !!v; }
let paneEnabled = false;
export const paneOn = () => paneEnabled && supported();
export function setPane(v) { paneEnabled = !!v; }

// ============ Mode « Full Glass » (console admin) ============
// Tout le verre dépoli de l'accueil (barre du haut, pastilles, boutons, barre d'onglets, cartes) devient du verre liquide : un seul calque WebGL
// posé juste au-dessus du fond étoilé et sous l'interface ; il dessine un vrai verre sous chaque élément, qui le suit (défilement, pages).
// Seul l'élément le plus extérieur est transformé (les boutons dans une carte gardent leur style). Les fenêtres (modales) restent en verre dépoli.
let full = null;
export const fullOn = () => !!full;
const FULL_CSS = '.lq-off{background:transparent!important;background-color:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:none!important;border-color:rgba(255,255,255,.14)!important}.lq-off::before,.lq-off::after{opacity:0!important}.lq-full-cv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}';
function glassy(e) { if (e.classList.contains('gl') || e.classList.contains('glass')) return true; const cs = getComputedStyle(e); const bf = cs.backdropFilter || cs.webkitBackdropFilter; return !!bf && bf !== 'none'; }
export function setFull(on) {
  const scr = document.getElementById('s-title'), bg = scr && scr.querySelector('.hm-bg'), space = scr && scr.querySelector('.hm-space');
  if (!on || !supported() || !scr || !bg || !space) { if (full) { cancelAnimationFrame(full.raf); clearInterval(full.iv); full.cv.remove(); full.els.forEach((e) => e.classList.remove('lq-off')); full = null; } return false; }
  if (full) return true;
  if (!document.getElementById('lq-full-css')) { const st = document.createElement('style'); st.id = 'lq-full-css'; st.textContent = FULL_CSS; document.head.append(st); }
  const cv = document.createElement('canvas'); cv.className = 'lq-full-cv'; const g = glass(cv, { ior: 1.5, bezel: 20, depth: 26, disp: 0.04, blur: 1.2, tint: 0.09, fuse: 1, spec: 1, shadow: 0.22 }, 24);
  if (!g) return false;
  space.after(cv);
  const R = new WeakMap(); // rayon d'angle de chaque élément
  full = { cv, g, els: [], raf: 0, iv: 0, dirty: true, sig: '' };
  const collect = () => { // éléments en verre de l'accueil, hors fenêtres et messages ; seulement les plus extérieurs
    const all = [...scr.querySelectorAll('*')].filter((e) => !e.closest('.modal,#toast,.lq-full-cv') && glassy(e));
    const outer = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
    for (const e of full.els) if (!outer.includes(e)) e.classList.remove('lq-off');
    for (const e of outer) { e.classList.add('lq-off'); if (!R.has(e)) R.set(e, parseFloat(getComputedStyle(e).borderTopLeftRadius) || 16); }
    full.els = outer;
  };
  collect(); full.iv = setInterval(collect, 1500);
  const loop = () => {
    full.raf = requestAnimationFrame(loop);
    if (!scr.classList.contains('on') || document.hidden || document.documentElement.classList.contains('mn-open')) return;
    const base = bg.getBoundingClientRect(), W = base.width, H = base.height, sh = [];
    for (const e of full.els) { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.right < base.left || r.left > base.right || r.bottom < base.top || r.top > base.bottom) continue;
      sh.push({ x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, w: r.width / 2, h: r.height / 2, r: Math.min(R.get(e) || 16, r.width / 2, r.height / 2), a: r.width * r.height }); }
    sh.sort((p, q) => q.a - p.a);
    const sig = sh.map((q) => Math.round(q.x) + ',' + Math.round(q.y)).join(';'); // rien n'a bougé et le fond est le même : on garde l'image
    if (!full.dirty && sig === full.sig) return; full.dirty = false; full.sig = sig;
    g.render(space, 0, 0, space.width, space.height, sh.slice(0, 24), W, H, Math.min(devicePixelRatio || 1, 1.25));
  };
  loop(); return true;
}

// ============ Lentille gravitationnelle (secteur Horizon) ============
// Autour de chaque trou noir / quasar de la cuve, la lumière se courbe : l'image de la cuve est déplacée vers l'astre (anneau d'Einstein),
// un anneau de photons brille faiblement. Hors de la zone d'influence, le calque est transparent (l'image d'origine reste nette).
// Purement visuel : la physique ne change pas ; déplacement volontairement modéré pour ne jamais tromper la visée.
const LMAX = 6;
const LFS = `#version 300 es
precision highp float;
uniform sampler2D uBg;uniform vec2 uRes;uniform vec4 uL[${LMAX}];uniform int uN;uniform float uDpr,uT,uK;
out vec4 o;
vec4 tex(vec2 p){return texture(uBg,vec2(p.x/uRes.x,1.-p.y/uRes.y));}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y), off=vec2(0.); float inf=0., ring=0.;
 for(int i=0;i<${LMAX};i++){ if(i>=uN)break; if(length(p-uL[i].xy)<uL[i].z*1.02){o=vec4(0.);return;} } // l'intérieur d'un trou noir ou d'un quasar n'est jamais déformé
 for(int i=0;i<${LMAX};i++){ if(i>=uN)break; vec2 v=p-uL[i].xy; float d=max(length(v),1.), r=uL[i].z, R=r*2.4;
  if(d<r*1.02||d>R)continue;                                   // l'astre lui-même et le lointain : intacts
  float f=smoothstep(R,r*1.15,d);                               // influence qui s'éteint en douceur
  off+=-v/d*(uK*r*r/d)*f*uL[i].w; inf=max(inf,f);
  ring+=exp(-pow((d-r*1.55)/(r*.07),2.))*.35*uL[i].w;
 }
 if(inf<.003){o=vec4(0.);return;}
 vec4 c=tex(p+off); vec3 col=c.rgb+vec3(1.,.85,.65)*ring;
 float a=clamp(inf*1.4,0.,1.); o=vec4(col*a,a);
}`;
export function lens(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  let prog; try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, LFS)); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null; gl.useProgram(prog); } catch (e) { return null; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uBg', 'uRes', 'uL', 'uN', 'uDpr', 'uT', 'uK']) U[n] = gl.getUniformLocation(prog, n);
  const tx = gl.createTexture(), bc = document.createElement('canvas'), bx = bc.getContext('2d');
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  const L = new Float32Array(LMAX * 4);
  // list : [{ x, y, r, s }] en px CSS dans le calque (s = intensité 0..1, pour l'apparition en fondu)
  function render(src, sx, sy, sw, shh, list, W, H, dpr, k = 0.42) {
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (bc.width !== cw || bc.height !== ch) { bc.width = cw; bc.height = ch; }
    bx.clearRect(0, 0, cw, ch); bx.drawImage(src, sx, sy, sw, shh, 0, 0, cw, ch);
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);
    gl.viewport(0, 0, cw, ch); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const ls = list.slice(0, LMAX); L.fill(0); ls.forEach((q, i) => L.set([q.x * dpr, q.y * dpr, q.r * dpr, q.s], i * 4));
    gl.uniform1i(U.uBg, 0); gl.uniform2f(U.uRes, cw, ch); gl.uniform4fv(U.uL, L); gl.uniform1i(U.uN, ls.length); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uK, k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { render };
}

// ============ Banc de shaders (console admin › Shaders) : post-traitements de la cuve, à tester ============
// Chaque effet est un petit programme appliqué à l'image de la cuve à chaque image (purement visuel). Compilés à la demande.
export const POST = {
  aberration: ['Aberration chromatique', 'Les couleurs se séparent vers les bords, comme une lentille imparfaite.',
    'vec2 d=uv-.5; float k=.006+.004*sin(uT*1.3); c=vec3(tex(p+d*uRes*k).r,tex(p).g,tex(p-d*uRes*k).b);'],
  onde: ['Onde de choc', 'Des ondes partent du bas de la cuve et déforment tout sur leur passage.',
    'vec2 cc=vec2(.5,.92)*uRes; float d=length(p-cc), w=mod(uT*260.,length(uRes)*1.3), f=exp(-pow((d-w)/16.,2.)); vec2 dir=(p-cc)/max(d,1.); c=tex(p-dir*f*11.)+f*.10;'],
  eau: ['Sous l\'eau', 'Tout ondule doucement, reflets de lumière dansants et teinte bleutée.',
    'vec2 q=p+vec2(sin(p.y*.045+uT*1.6),cos(p.x*.04+uT*1.3))*3.; c=tex(q); float ca=pow(abs(sin(p.x*.05+uT)+sin(p.y*.06-uT*1.3)+sin((p.x+p.y)*.03+uT*.7))/3.,3.); c=c*vec3(.78,.95,1.1)+vec3(.2,.5,.6)*ca*.45;'],
  chaleur: ['Mirage de chaleur', 'L\'air tremble en montant, comme au-dessus d\'un brasier.',
    'float n=sin(p.y*.09-uT*6.)*sin(p.x*.05+uT*2.)+.5*sin(p.y*.21-uT*9.); c=tex(p+vec2(n*2.4,0.)*smoothstep(0.,1.,uv.y))*vec3(1.08,1.,.9);'],
  crt: ['Vieil écran (CRT)', 'Écran bombé, lignes de balayage, sous-pixels rouges, verts et bleus.',
    'vec2 cu=uv*2.-1.; cu*=1.+dot(cu,cu)*.05; c=tex((cu*.5+.5)*uRes); c*=.8+.2*sin(p.y*3.14159); float s=mod(floor(p.x),3.); c*=s<1.?vec3(1.25,.9,.9):s<2.?vec3(.9,1.25,.9):vec3(.9,.9,1.25); c*=1.-dot(cu,cu)*.22; if(abs(cu.x)>1.||abs(cu.y)>1.)c=vec3(0.);'],
  cinema: ['Cinéma', 'Contraste de film, teintes orangées et bleutées, vignette et grain.',
    'c=tex(p); float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,1.25); c=c*vec3(1.06,1.,.9)+vec3(-.03,.01,.06)*(1.-l); c*=mix(.5,1.,smoothstep(.95,.35,length(uv-.5))); c+=(hash(p+fract(uT*7.))-.5)*.07;'],
  bloom: ['Éclat (bloom)', 'Tout ce qui brille déborde de lumière.',
    'c=tex(p); vec3 b=vec3(0.); for(int i=0;i<12;i++){ float a=float(i)*.5236; for(int j=0;j<3;j++){ float r=4.+float(j)*6.; b+=max(tex(p+vec2(cos(a),sin(a))*r)-.5,0.);} } c+=b/36.*2.4;'],
  nuit: ['Vision nocturne', 'Monochrome vert, grain et lunette sombre.',
    'float l=dot(tex(p),vec3(.3,.6,.1)); c=vec3(.15,1.,.35)*pow(l,.8)*1.5; c+=(hash(p*.5+floor(uT*24.))-.5)*.12; c*=.85+.15*sin(p.y*1.5); c*=smoothstep(.78,.3,length(uv-.5));'],
  thermique: ['Caméra thermique', 'Les astres brillent selon leur « chaleur » (luminosité).',
    'float l=dot(tex(p),vec3(.3,.6,.1)); c=l<.33?mix(vec3(0.,0.,.25),vec3(.6,0.,.8),l*3.):l<.66?mix(vec3(.6,0.,.8),vec3(1.,.5,0.),(l-.33)*3.):mix(vec3(1.,.5,0.),vec3(1.,1.,.85),(l-.66)*3.);'],
  pixel: ['Rétro pixel', 'Gros pixels et couleurs réduites, façon console 16 bits.',
    'vec2 q=(floor(p/6.)+.5)*6.; c=floor(tex(q)*6.+.5)/6.;'],
  aurore: ['Aurore', 'Des voiles de couleur ondulent au-dessus de la cuve.',
    'c=tex(p); float b1=sin(uv.x*6.+uT*.6+sin(uv.y*3.+uT*.4)*2.); float band=smoothstep(.6,1.,b1)*smoothstep(1.,.15,uv.y); c+=mix(vec3(.2,1.,.6),vec3(.6,.3,1.),.5+.5*sin(uv.x*3.+uT))*band*.35;'],
  holo: ['Hologramme', 'Image projetée : teinte cyan, lignes qui défilent, petits sauts d\'image.',
    'float g=step(.985,hash(vec2(floor(p.y/6.),floor(uT*8.)))); c=tex(p+vec2(g*14.,0.)); float l=dot(c,vec3(.3,.6,.1)); c=mix(c,vec3(.3,.9,1.)*l*1.5,.6); c*=.82+.18*sin(p.y*.8+uT*10.);'],
};
const PFS = (body) => `#version 300 es
precision highp float;
uniform sampler2D uBg;uniform vec2 uRes;uniform float uT;
out vec4 o;
vec3 tex(vec2 p){return texture(uBg,vec2(clamp(p.x,0.,uRes.x)/uRes.x,1.-clamp(p.y,0.,uRes.y)/uRes.y)).rgb;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y),uv=p/uRes;vec3 c;${body}o=vec4(c,1.);}`;
export function post(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const progs = {}, buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const get = (name) => { if (progs[name] !== undefined) return progs[name]; let pr = null;
    try { pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, PFS(POST[name][2]))); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) pr = null; } catch (e) { pr = null; }
    if (pr) { const al = gl.getAttribLocation(pr, 'a'); pr.U = { bg: gl.getUniformLocation(pr, 'uBg'), res: gl.getUniformLocation(pr, 'uRes'), t: gl.getUniformLocation(pr, 'uT'), al }; }
    return (progs[name] = pr); };
  const tx = gl.createTexture(), bc = document.createElement('canvas'), bx = bc.getContext('2d');
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  function render(name, src, sx, sy, sw, shh, W, H, dpr, t) {
    const pr = POST[name] && get(name); if (!pr) return false;
    const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    if (bc.width !== cw || bc.height !== ch) { bc.width = cw; bc.height = ch; }
    bx.clearRect(0, 0, cw, ch); bx.drawImage(src, sx, sy, sw, shh, 0, 0, cw, ch);
    gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(pr.U.al); gl.vertexAttribPointer(pr.U.al, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);
    gl.viewport(0, 0, cw, ch); gl.uniform1i(pr.U.bg, 0); gl.uniform2f(pr.U.res, cw, ch); gl.uniform1f(pr.U.t, t); gl.drawArrays(gl.TRIANGLES, 0, 3); return true;
  }
  return { render };
}
