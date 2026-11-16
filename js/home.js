// Critical — écran d'accueil « Liquid Glass ».
// Non destructif : il réorganise les boutons EXISTANTS (mêmes identifiants, mêmes actions) et ajoute des décors.
// Il doit être lancé après CH.init() et ED.init() (qui ajoutent leurs boutons au menu).
import { createBlackHole } from './blackhole.js';
const $ = (s, r = document) => r.querySelector(s);
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const ico = (p) => `<svg class="hm-ic" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICONS = {
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  levels: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  atelier: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5z"/><path d="M14.5 6l3.5 3.5"/>',
  coll: '<path d="M7 4h10l3.5 5L12 20.5 3.5 9z"/><path d="M3.5 9h17M9.5 9L12 20.5M14.5 9L12 20.5M7 4l2.5 5M17 4l-2.5 5"/>',
  casc: '<path d="M6 3v6M12 3v11M18 3v4"/><circle cx="6" cy="13" r="3"/><circle cx="12" cy="18.5" r="3"/><circle cx="18" cy="11" r="3"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 000 17c2 0 2.4-1.6 1.4-2.8-1-1.3 0-3 1.8-3h2.3a3 3 0 003-3"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.2-6 8-6s6.8 1.8 8 6"/>',
  rank: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4"/>',
  more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
  code: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
};
const CHEV = '<svg class="hm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ORB = '<svg class="hm-orb" viewBox="0 0 96 96" aria-hidden="true"><defs><filter id="hm-goo" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b"/><feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -9"/></filter></defs><g filter="url(#hm-goo)"><circle cx="48" cy="48" r="25" fill="#3be8ff"/><circle class="o1" cx="48" cy="25" r="13" fill="#ff4fd8"/><circle class="o2" cx="48" cy="72" r="11" fill="#ffc247"/><circle class="o3" cx="25" cy="48" r="9" fill="#7a6bff"/></g><ellipse cx="37" cy="34" rx="13" ry="7" fill="#fff" opacity=".55" transform="rotate(-28 37 34)"/><path d="M48 36v24M36 48h24" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';

const CSS = `
#s-title.hm{padding-top:calc(env(safe-area-inset-top,0px) + clamp(0px,calc(100vh - 720px),90px));padding-bottom:calc(env(safe-area-inset-bottom,0px) + 108px);overflow:hidden}
.hm-bh{position:absolute;pointer-events:none;display:block;transition:opacity .9s ease}.hm-bh-gl{opacity:0}.hm-bh-gl.on{opacity:1}
#s-title.hm>*{z-index:1}
#s-title.hm .hm-bg{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.hm-space{position:absolute;inset:0;width:100%;height:100%;display:block}
@keyframes hm-fl{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(14px,-28px) rotate(14deg)}}
@keyframes hm-in{from{opacity:0;transform:translateY(28px) scale(.94);filter:blur(12px)}}
.hm-in{animation:hm-in .95s cubic-bezier(.2,.9,.2,1) backwards;animation-delay:var(--e,0s)}

/* verre liquide */
.gl{position:relative;display:block;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.24),rgba(255,255,255,.06) 42%,rgba(255,255,255,.12));border:1px solid rgba(255,255,255,.2);background-color:rgba(14,16,46,.5);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(255,255,255,.1),inset 1px 0 0 rgba(255,255,255,.2),inset 0 0 26px rgba(255,255,255,.08),0 16px 40px rgba(0,0,0,.42);overflow:hidden;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:transform .55s cubic-bezier(.2,1.6,.4,1),filter .3s}
.gl::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.42),rgba(255,255,255,0) 55%),radial-gradient(90% 60% at 95% 110%,rgba(255,255,255,.16),rgba(255,255,255,0) 60%);pointer-events:none}
.gl::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(112deg,rgba(255,255,255,0) 36%,rgba(255,255,255,.34) 50%,rgba(255,255,255,0) 64%) 160% 0/260% 100% no-repeat;animation:hm-sh 7s ease-in-out infinite;animation-delay:var(--d,0s);pointer-events:none}
@keyframes hm-sh{0%,55%{background-position:160% 0}100%{background-position:-60% 0}}
.gl>*{position:relative;z-index:1}
.gl:active{transform:scale(.955);filter:brightness(1.22)}

#s-title.hm .gear{position:absolute;right:16px;top:calc(env(safe-area-inset-top,0px) + 12px);width:46px;height:46px;border-radius:23px;padding:0;display:grid;place-items:center;z-index:2}
#s-title.hm .gear svg{width:22px;height:22px}
#s-title.hm .hm-pill{position:absolute;left:16px;top:calc(env(safe-area-inset-top,0px) + 12px);height:46px;margin:0;border-radius:23px;padding:0 18px;display:flex;align-items:center;font:700 13px/1 var(--disp);color:rgba(238,244,255,.7);cursor:default;z-index:2}
#s-title.hm .hm-pill b{color:#ffc247;text-shadow:0 0 12px rgba(255,194,71,.7)}
#s-title.hm .ch-adm{left:50%;transform:translateX(-50%);z-index:2}
#s-title.hm .title-wrap{position:relative;gap:0}
#s-title.hm .logo{display:block;margin:0;text-align:center;font:900 min(13vw,52px)/1 var(--disp);letter-spacing:.03em;background:linear-gradient(100deg,#fff 0%,#7ff6ff 28%,#ff7be5 52%,#fff 76%,#7ff6ff 100%) 0 0/250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:hm-lg 7s linear infinite;filter:drop-shadow(0 0 14px rgba(77,243,255,.6)) drop-shadow(0 0 34px rgba(255,79,216,.4))}
@keyframes hm-lg{to{background-position:-250% 0}}
#s-title.hm .tag{margin:6px 0 14px}
#s-title.hm .menu{gap:14px}

.hm-hero{position:relative;display:block;width:100%;height:132px;padding:0;border:0;border-radius:36px;background:none;overflow:hidden;color:inherit;cursor:pointer;transition:transform .55s cubic-bezier(.2,1.6,.4,1);box-shadow:0 0 50px rgba(77,243,255,.3),0 0 90px rgba(255,79,216,.22);animation:hm-in .95s cubic-bezier(.2,.9,.2,1) backwards,hm-br 4.5s ease-in-out infinite;animation-delay:.15s,1.2s}
@keyframes hm-br{50%{transform:scale(1.014)}}
.hm-hero::before{content:'';position:absolute;inset:-80%;background:conic-gradient(from 0deg,rgba(255,255,255,0) 0 52%,#4df3ff 68%,#ff4fd8 84%,#ffc247 94%,rgba(255,255,255,0));animation:hm-sp 5s linear infinite}
@keyframes hm-sp{to{transform:rotate(360deg)}}
.hm-hero:active{transform:scale(.96)}
.hm-hi{position:absolute;inset:2px;border-radius:34px;display:flex;align-items:center;gap:16px;padding:0 22px 0 14px;background:linear-gradient(145deg,rgba(40,60,120,.55),rgba(255,255,255,.08) 45%,rgba(255,79,216,.22))}
.hm-orb{flex:none;width:96px;height:96px;filter:drop-shadow(0 0 16px rgba(77,243,255,.7))}
.hm-orb .o1{transform-origin:48px 48px;animation:hm-or 5.5s linear infinite}
.hm-orb .o2{transform-origin:48px 48px;animation:hm-or 7.5s linear infinite reverse}
.hm-orb .o3{transform-origin:48px 48px;animation:hm-or 4.2s linear infinite}
@keyframes hm-or{to{transform:rotate(360deg)}}
.hm-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.hm-tx .hm-t{font:900 27px/1 var(--disp);letter-spacing:.06em;text-transform:uppercase}
.hm-tx small{font-size:13px;color:rgba(238,244,255,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-chip{align-self:flex-start;padding:4px 9px;border-radius:10px;font:700 10px/1 var(--disp);letter-spacing:.12em;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3)}
.hm-chev{flex:none;width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;opacity:.85}

.hm-camp{width:100%;height:84px;display:flex;align-items:center;gap:16px;padding:0 20px 0 16px;border-radius:28px}
.hm-camp .hm-tx .hm-t{font-size:15px;letter-spacing:.03em;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-ring{flex:none;position:relative;width:54px;height:54px;border-radius:50%;background:conic-gradient(var(--c,#9b8cff) 0 var(--p,0%),rgba(255,255,255,.14) 0);display:grid;place-items:center;filter:drop-shadow(0 0 10px var(--c,#9b8cff))}
.hm-ring::before{content:'';position:absolute;inset:5px;border-radius:50%;background:rgba(14,16,40,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.hm-ring b{position:relative;font:900 17px/1 var(--disp)}
.hm-core,.hm-tile .hm-ic{flex:none}
.hm-cascb{height:68px;background:linear-gradient(145deg,rgba(255,194,71,.3),rgba(255,255,255,.06) 45%,rgba(255,79,216,.2));border-color:rgba(255,220,150,.42)}.hm-cascb .hm-ic{flex:none;margin-left:6px;filter:drop-shadow(0 0 8px rgba(255,194,71,.8))}
.hm-row{display:flex;gap:14px;width:100%}
.hm-tile{flex:1;min-width:0;height:112px;border-radius:28px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start}
.hm-tile .hm-t{display:block;font:800 14px/1.1 var(--disp);letter-spacing:.03em;text-transform:uppercase}
#b-daily small{white-space:normal;line-height:1.25;font-size:11px}
.hm-tile small{display:block;margin-top:5px;font:500 12px/1.2 var(--font);color:rgba(238,244,255,.72)}
.hm-ic{width:34px;height:34px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.hm-live{position:absolute;right:16px;top:16px;width:10px;height:10px;border-radius:50%;background:#5dffc0;box-shadow:0 0 12px #5dffc0;animation:hm-pu 1.8s ease-in-out infinite}
@keyframes hm-pu{50%{transform:scale(1.7);opacity:.5}}
.hm-core{position:relative;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 32% 26%,#fff 0 7%,rgba(255,255,255,0) 8%),radial-gradient(ellipse 40% 22% at 34% 24%,rgba(255,255,255,.8),rgba(255,255,255,0)),radial-gradient(circle at 50% 50%,#bff8ff,#2ec9ff 60%,#6a4dff);box-shadow:inset 0 0 0 2px rgba(255,255,255,.3),0 0 22px #4df3ff;animation:hm-hu 5s linear infinite}
@keyframes hm-hu{to{filter:hue-rotate(360deg)}}
#s-title.hm .hm-tile .ch-badge{position:absolute;right:14px;top:14px;left:auto}
#s-title.hm .hm-tile .ch-bar{position:absolute;left:16px;right:16px;bottom:14px;width:auto;height:5px;margin:0}
#s-title.hm .hm-tile.ch-ready{border-color:rgba(255,255,255,.55);animation:hm-rb 3s linear infinite}
@keyframes hm-rb{0%,100%{box-shadow:inset 0 1.5px 0 rgba(255,255,255,.6),0 0 26px #4df3ff,0 16px 40px rgba(0,0,0,.42)}33%{box-shadow:inset 0 1.5px 0 rgba(255,255,255,.6),0 0 30px #ff4fd8,0 16px 40px rgba(0,0,0,.42)}66%{box-shadow:inset 0 1.5px 0 rgba(255,255,255,.6),0 0 30px #ffc247,0 16px 40px rgba(0,0,0,.42)}}
.hm-tile:has(.ch-bar) .hm-tt{margin-bottom:12px}

.hm-dock{position:absolute;left:18px;right:18px;max-width:420px;margin:0 auto;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);height:76px;border-radius:38px;display:flex;justify-content:space-around;align-items:center;padding:0 8px;cursor:default;z-index:2}
.hm-di{flex:none;width:78px;height:60px;border-radius:30px;border:0;background:none;box-shadow:none;color:#eef4ff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0;cursor:pointer;transition:transform .5s cubic-bezier(.2,1.6,.4,1),background .25s}
.hm-di .hm-ic{width:23px;height:23px;stroke-width:1.9}
.hm-di .hm-t{font:600 10.5px/1 var(--font);letter-spacing:.3px}
.hm-di small{display:none}.hm-av{width:26px;height:26px;border-radius:50%;display:block}
.hm-di:active{background:rgba(255,255,255,.26);transform:scale(.9)}
@media (hover:hover){.hm-di:hover{background:rgba(255,255,255,.14)}}
@media (max-height:700px){.hm-hero{height:96px!important}.hm-tile{height:86px!important}.hm-camp{height:62px!important}.hm-cascb{height:56px!important}#s-title.hm .tag{display:none}#s-title.hm .logo{margin-bottom:8px}#s-title.hm .menu{gap:9px!important}#b-quests{height:40px!important}}
@media (max-height:700px){.hm-hero{height:112px}.hm-tile{height:98px;padding:13px}.hm-camp{height:74px}#s-title.hm .menu{gap:11px}#s-title.hm .tag{margin-bottom:8px}.hm-orb{width:80px;height:80px}}
@media (prefers-reduced-motion:reduce){.hm-blob,.hm-gem,.hm-hero,.hm-hero::before,.hm-orb *,#s-title.hm .logo{animation:none!important}}
`;


// Liquid Glass global : les classes partagées (.glass .big .icon .pill .card .lv …) servent à TOUS les écrans
// (niveaux, réglages, résultats, HUD, coffre, Atelier) : les restyler ici les met tous au même niveau.
const GCSS = `
@keyframes glow{50%{box-shadow:0 0 36px rgba(255,79,216,.45),0 0 70px rgba(77,243,255,.28),inset 0 1.5px 0 rgba(255,255,255,.6)}}
.glass{background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.34),rgba(255,255,255,0) 55%),radial-gradient(90% 60% at 95% 110%,rgba(255,255,255,.12),rgba(255,255,255,0) 60%),linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.05) 42%,rgba(255,255,255,.1));border:1px solid rgba(255,255,255,.2);background-color:rgba(14,16,46,.5);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(255,255,255,.1),inset 1px 0 0 rgba(255,255,255,.18),inset 0 0 26px rgba(255,255,255,.07),0 14px 38px rgba(0,0,0,.42)}
.icon{border-radius:23px;transition:transform .55s cubic-bezier(.2,1.6,.4,1)}
.pill{transition:transform .55s cubic-bezier(.2,1.6,.4,1)}
.big{border-radius:26px;transition:transform .55s cubic-bezier(.2,1.6,.4,1),filter .3s}
.icon:active,.pill:active,.big:active{transform:scale(.95);filter:brightness(1.2)}
.big.primary{background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.4),rgba(255,255,255,0) 55%),linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.36));border:1px solid rgba(255,255,255,.45);box-shadow:0 0 26px rgba(77,243,255,.35),0 0 60px rgba(255,79,216,.22),inset 0 1.5px 0 rgba(255,255,255,.6),inset 0 0 22px rgba(255,255,255,.1);background-color:rgba(14,16,46,.5)}
.hud-title{border-radius:23px}.count{border-radius:23px}
.bar h2,.card h2{text-shadow:0 0 18px rgba(77,243,255,.35)}
.modal{background:rgba(3,4,12,.42);background-color:rgba(14,16,46,.5)}
.card{border-radius:34px;box-shadow:inset 0 1.5px 0 rgba(255,255,255,.55),inset 0 -1px 0 rgba(255,255,255,.1),inset 0 0 40px rgba(255,255,255,.06),0 24px 60px rgba(0,0,0,.5),0 0 70px rgba(77,243,255,.16),0 0 100px rgba(255,79,216,.12);animation:rise .6s cubic-bezier(.2,1.3,.3,1)}
.world{border-radius:28px}
.lv{border-radius:18px;background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.3),rgba(255,255,255,0) 55%),linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.4),0 6px 16px rgba(0,0,0,.3);transition:transform .55s cubic-bezier(.2,1.6,.4,1)}
.lv:active{transform:scale(.9)}
.lv.done{box-shadow:0 0 14px color-mix(in srgb,var(--acc) 40%,transparent),inset 0 0 14px color-mix(in srgb,var(--acc) 18%,transparent),inset 0 1.5px 0 rgba(255,255,255,.5)}
.stats div{border-radius:20px;background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.24),rgba(255,255,255,0) 55%),rgba(255,255,255,.05);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.4)}
.sw i{background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.2));box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -6px 10px rgba(0,0,0,.22)}
.sw i::after{background:radial-gradient(circle at 35% 26%,#fff,#e4edff 58%,#b4c2e2);box-shadow:0 2px 8px rgba(0,0,0,.45),inset 0 -2px 4px rgba(0,0,0,.12)}
.sw input:checked+i{box-shadow:0 0 18px rgba(77,243,255,.55),inset 0 1px 0 rgba(255,255,255,.5)}
.seg div{border-radius:16px;background:rgba(255,255,255,.05);box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.seg button.on{box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
#toast{border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.06)),rgba(20,22,40,.6);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.5),0 14px 34px rgba(0,0,0,.4)}
/* niveaux : même fond vivant que l'accueil */
#s-levels.hm2{overflow:hidden}
#s-levels.hm2>*{position:relative;z-index:1}
#s-levels.hm2>.hm-bg{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
/* coffre / collection */
.ch-it{border-radius:20px;background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.2),rgba(255,255,255,0) 55%),rgba(255,255,255,.05);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.35)}
#ch-banner{border-radius:24px}
/* Atelier */
.ed-tool,.ed-pill,.ed-hp{background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.22),rgba(255,255,255,0) 55%),rgba(255,255,255,.06);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.35)}
.ed-tool{border-radius:20px;transition:transform .5s cubic-bezier(.2,1.6,.4,1)}
.ed-tool.on{box-shadow:0 0 18px color-mix(in srgb,var(--acc,#4df3ff) 50%,transparent),inset 0 1.5px 0 rgba(255,255,255,.5)}
.ed-pill.on{background:radial-gradient(120% 70% at 18% -5%,rgba(255,255,255,.35),rgba(255,255,255,0) 55%),linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.34))}
.ed-card{border-radius:26px;transition:transform .55s cubic-bezier(.2,1.6,.4,1)}
.ed-dock{border-radius:32px 32px 0 0}
.ed-code,.ed-name,.ed-prev{box-shadow:inset 0 2px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.1)}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
`;

// Retire les classes de l'ancien style et pose les nouvelles
const reskin = (e, add, drop = ['big', 'glass', 'half', 'primary', 'hero', 'icon']) => { e.classList.remove(...drop); e.classList.add(...add); };
// Marque le premier <span> d'un bouton comme titre (hm-t)
const titleOf = (b, sel) => { const t = sel ? $(sel, b) : b.querySelector('span:not(.ch-badge)'); if (t) t.classList.add('hm-t'); return t; };
const grab = (...nodes) => nodes.filter(Boolean);

const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// Décor : un trou noir en haut de l'écran, son disque d'accrétion, et un champ d'étoiles qui spirale vers lui (elles s'étirent en arcs
// en s'approchant : la lumière est courbée). Un seul canvas, 30 images/s, à l'arrêt dès que l'écran n'est pas visible.
function space(cv, scr) {
  const x = cv.getContext('2d', { alpha: false }), TAU = Math.PI * 2; let W = 0, H = 0, last = 0;
  // Trou noir : l'image pré-rendue en très haute qualité est là dès la première image ; la version animée (WebGL, cuite en arrière-plan
  // par petites tranches) la remplace en fondu quand elle est prête. Sans WebGL, ou si l'on préfère moins de mouvement : l'image seule.
  const still = document.createElement('img'); still.className = 'hm-bh'; still.alt = ''; still.src = 'assets/blackhole.webp'; still.decoding = 'async'; cv.after(still);
  const glc = document.createElement('canvas'); glc.className = 'hm-bh hm-bh-gl'; still.after(glc);
  let bh = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? null : createBlackHole(glc);
  if (!bh) glc.remove();
  const DS = [640, 480, 360, 270]; // tailles d'affichage, abaissées si l'appareil peine ; la physique cuite, elle, ne change pas
  let ds = 0, bad = 0, ema = 33, cx = 0, cy = 0, tcy = 0, SZ = 340, since = 99, shown = false;
  const S = Array.from({ length: 230 }, (_, i) => ({ a: rnd(i) * TAU, r: 0.1 + rnd(i * 3) ** 0.7 * 1.35, z: 0.3 + rnd(i * 7) * 0.7 }));
  const place = () => {
    SZ = Math.min(W * 0.98, 420, H * 0.5); const lg = document.querySelector('#s-title .logo'), top = lg ? lg.getBoundingClientRect().top : H * 0.2;
    cx = W / 2; tcy = Math.max(SZ * 0.21, Math.min(H * 0.3, top - SZ * 0.2)); if (!cy) cy = tcy; // cible : au-dessus du titre, sans sortir de l'écran
    for (const e of [still, bh && glc]) if (e) { e.style.width = e.style.height = SZ + 'px'; e.style.left = cx - SZ / 2 + 'px'; }
    if (bh) bh.size(Math.min(DS[ds], Math.round(SZ * Math.min(window.devicePixelRatio || 1, 2.5))));
  };
  const fit = () => { const k = Math.min(1.5, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.ceil(W * k); cv.height = Math.ceil(H * k); x.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); }; // l'échelle suit la taille réelle en pixels : la dernière rangée est couverte en entier même avec un ratio fractionnaire (2,625…)
  window.addEventListener('resize', () => { W = 0; since = 99; });
  const glow = (px, py, r, col) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };
  const frame = (t) => {
    requestAnimationFrame(frame);
    if (t - last < 28 || !scr.classList.contains('on') || document.hidden || document.documentElement.classList.contains('mn-open')) return; // ~30 images/s, à l'arrêt hors de l'accueil
    if (!W) fit(); if (!W) return;
    const gap = t - last, dt = Math.min(0.1, gap / 1000) || 0.033; last = t;
    if (++since > 20) { since = 0; place(); } // se recale sur le titre (qui bouge à l'ouverture et selon la taille de l'écran)
    if (Math.abs(tcy - cy) > 0.3) cy += (tcy - cy) * 0.2; // glisse vers sa place au lieu de sauter quand le titre finit son animation
    still.style.top = cy - SZ / 2 + 'px'; if (bh) glc.style.top = cy - SZ / 2 + 'px';
    if (bh && !bh.lost) {
      if (!bh.ready) bh.step(); // cuisson : une petite tranche par image
      else {
        if (gap < 200) ema += (gap - ema) * 0.05; // cadence réelle : sous ~18 images/s, on réduit la taille d'affichage, puis on revient à l'image fixe
        if (ema > 55) { if (++bad > 60) { bad = 0; ema = 33; if (++ds >= DS.length) { bh = null; glc.remove(); still.style.opacity = 1; } else since = 99; } } else bad = 0;
        if (bh) { bh.draw(t / 1000); if (!shown) { shown = true; glc.classList.add('on'); setTimeout(() => { still.style.opacity = 0; }, 900); } }
      }
    } else if (bh && bh.lost) { bh = null; glc.remove(); still.style.opacity = 1; }
    const U = H * 0.8, T = t / 1000;
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a0b22'); bg.addColorStop(0.55, '#070818'); bg.addColorStop(1, '#03030c'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'lighter';
    glow(W * 0.12, H * 0.42, W * 0.75, 'rgba(40,120,255,.2)'); glow(W * 0.95, H * 0.62, W * 0.7, 'rgba(255,60,200,.16)'); glow(W * 0.3, H * 0.98, W * 0.6, 'rgba(255,170,50,.1)'); glow(cx, cy, SZ * 0.4, 'rgba(150,80,255,.26)');
    x.lineCap = 'round';
    for (const s of S) { // plus une étoile est près, plus elle tourne vite et plus son image s'étire
      s.a += dt * 0.05 / (s.r * s.r + 0.03); s.r -= dt * 0.012 * (0.4 + 0.6 / (s.r + 0.2)); if (s.r < 0.11) { s.r = 1.45; s.a = rnd(s.a) * TAU; }
      const rad = s.r * U, al = (0.4 + 0.6 * Math.abs(Math.sin(T * s.z * 1.7 + s.a))) * s.z * Math.min(1, (s.r - 0.1) * 12), len = 0.012 / (s.r * s.r);
      x.strokeStyle = `rgba(215,232,255,${al})`; x.lineWidth = 1 + s.z; x.beginPath(); x.ellipse(cx, cy, rad, rad * 0.92, 0, s.a - len, s.a + 0.002); x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(frame);
}
const bgLayer = (scr) => { const d = make('div', 'hm-bg', '<canvas class="hm-space"></canvas>'); space(d.firstChild, scr); return d; };

let ring = null, live = null;
export function init() {
  const scr = $('#s-title'); if (!scr || scr.classList.contains('hm')) return;
  const menu = $('.menu', scr), wrap = $('.title-wrap', scr); if (!menu || !wrap) return;
  const st = make('style'); st.textContent = CSS + GCSS; document.head.appendChild(st);
  scr.classList.add('hm');

  // décor : taches de couleur + sphères de verre qui flottent derrière le verre
  scr.prepend(bgLayer(scr));


  // logo + réglages + étoiles
  const logo = $('.logo', wrap); if (logo) { logo.textContent = 'CRITICAL'; }
  const gear = $('#b-set2'); if (gear) { reskin(gear, ['gl', 'hm-in'], ['glass', 'icon']); gear.style.setProperty('--e', '.1s'); gear.style.setProperty('--d', '2s'); }
  const stars = $('#t-stars'); if (stars) { reskin(stars, ['gl', 'hm-pill', 'hm-in'], ['foot']); stars.style.setProperty('--e', '.05s'); scr.appendChild(stars); }
  for (const e of [logo, $('.tag', wrap)]) if (e) { e.classList.add('hm-in'); e.style.setProperty('--e', '.1s'); }

  // Forage (mode principal ; Cascade devient un lien discret plus bas)
  const hero = $('#b-mine') || $('#b-endless');
  if (hero) {
    reskin(hero, ['hm-hero']);
    const t = titleOf(hero), s = $('#b-mine-s', hero) || $('#b-endless-s', hero), hi = make('span', 'gl hm-hi'), tx = make('span', 'hm-tx');
    hi.style.setProperty('--d', '.5s');
    tx.append(...grab(t, s));
    hi.insertAdjacentHTML('afterbegin', ORB); hi.append(tx); hi.insertAdjacentHTML('beforeend', CHEV);
    hero.textContent = ''; hero.appendChild(hi);
  }

  // Campagne : anneau de progression
  const play = $('#b-play');
  if (play) {
    reskin(play, ['gl', 'hm-camp', 'hm-in']); play.style.setProperty('--e', '.3s'); play.style.setProperty('--d', '1.5s');
    const t = titleOf(play, '#b-play-t'), s = $('#b-play-s', play), tx = make('span', 'hm-tx');
    ring = make('span', 'hm-ring', '<b>1</b>');
    tx.append(...grab(t, s)); play.textContent = ''; play.append(ring, tx); play.insertAdjacentHTML('beforeend', CHEV);
  }

  // Défi du jour + Noyaux : deux tuiles
  const daily = $('#b-daily'), chest = $('#b-themes'), row = make('div', 'hm-row');
  const tile = (b, icon, delay, d) => {
    reskin(b, ['gl', 'hm-tile', 'hm-in']); b.style.setProperty('--e', delay); b.style.setProperty('--d', d);
    const t = titleOf(b), s = b.querySelector('small'), tt = make('span', 'hm-tt');
    tt.append(...grab(t, s)); b.insertBefore(tt, b.firstChild);
    b.insertAdjacentHTML('afterbegin', icon);
    return b;
  };
  if (daily) { tile(daily, ico(ICONS.cal), '.42s', '3s'); live = make('span', 'hm-live'); daily.appendChild(live); row.appendChild(daily); }
  if (chest) { tile(chest, ico(ICONS.theme), '.5s', '4s'); row.appendChild(chest); }
  menu.appendChild(row);

  // dock flottant : Niveaux · Atelier · Collection · Code
  const dock = make('nav', 'gl hm-dock hm-in'); dock.style.setProperty('--e', '.6s'); dock.style.setProperty('--d', '5s'); dock.setAttribute('aria-label', 'Navigation');
  const di = (id, icon) => {
    const b = $(id); if (!b) return;
    if (!b.querySelector('span')) { const lbl = b.textContent.trim(); b.textContent = ''; b.appendChild(make('span', '', lbl)); }
    reskin(b, ['hm-di']); titleOf(b); b.insertAdjacentHTML('afterbegin', ico(icon)); dock.appendChild(b);
  };
  di('#b-profile', ICONS.user); di('#b-rank', ICONS.rank); di('#b-codex', ICONS.coll);
  scr.appendChild(dock);

  // anciennes rangées vides
  menu.querySelectorAll('.row,.ch-row').forEach((r) => { if (!r.children.length) r.remove(); });
}

// Appelé par refreshTitle() : anneau de progression de la campagne + point « défi disponible »
// Appelé par app.js : poussière d'étoile possédée et état du défi du jour
export function update({ dust = 0, daily = null } = {}) {
  const p = $('#t-stars'); if (p) p.innerHTML = `<b>✦</b>&nbsp;${Math.round(dust).toLocaleString('fr-FR')}`;
  const d = $('#b-daily small'); if (d && daily) { d.textContent = daily.done ? 'Réussi aujourd\'hui' : daily.txt; if (live) live.style.display = daily.done ? 'none' : ''; }
}
