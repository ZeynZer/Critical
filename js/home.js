// Critical — écran d'accueil « Liquid Glass ».
// Non destructif : il réorganise les boutons EXISTANTS (mêmes identifiants, mêmes actions) et ajoute des décors.
// Il doit être lancé après CH.init() et ED.init() (qui ajoutent leurs boutons au menu).
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
  hole: '<circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="9.5" ry="3.6" transform="rotate(-18 12 12)"/>',
  duel: '<path d="M5 19L16 8M13 5h6v6M19 19L8 8M11 5H5v6"/>',
  code: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
};
const GEM = '<svg class="hm-gem" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="hm-gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff9ff"/><stop offset=".55" stop-color="#6f8cff"/><stop offset="1" stop-color="#ff6ee0"/></linearGradient></defs><path d="M7 3h10l4.5 6L12 21.5 2.5 9z" fill="url(#hm-gg)" stroke="rgba(255,255,255,.85)" stroke-width="1.2" stroke-linejoin="round"/><path d="M2.5 9h19M8.5 9L12 21.5M15.5 9L12 21.5M7 3l1.5 6M17 3l-1.5 6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/></svg>';
const CHEV = '<svg class="hm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

const CSS = `
#s-title.hm{padding:0;overflow:hidden}
.hm-bh{position:absolute;pointer-events:none;display:block;filter:drop-shadow(0 0 46px rgba(200,90,255,.38));animation:hm-hb 7s ease-in-out infinite}
@keyframes hm-hb{50%{transform:scale(1.035);filter:drop-shadow(0 0 70px rgba(255,120,220,.55)) brightness(1.08)}}
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

.hm-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.hm-tx .hm-t{font:900 27px/1 var(--disp);letter-spacing:.06em;text-transform:uppercase}
.hm-tx small{font-size:13px;color:rgba(238,244,255,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-chev{flex:none;width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;opacity:.85}

.hm-camp{width:100%;height:84px;display:flex;align-items:center;gap:16px;padding:0 20px 0 16px;border-radius:28px}
.hm-camp .hm-tx .hm-t{font-size:15px;letter-spacing:.03em;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-sbi{flex:none;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}.hm-sbi .hm-ic{width:26px;height:26px}
.hm-ic{width:34px;height:34px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.hm-live{position:absolute;right:16px;top:16px;width:10px;height:10px;border-radius:50%;background:#5dffc0;box-shadow:0 0 12px #5dffc0;animation:hm-pu 1.8s ease-in-out infinite}
@keyframes hm-pu{50%{transform:scale(1.7);opacity:.5}}

@media (prefers-reduced-motion:reduce){.hm-blob,.hm-gem,.hm-hero,.hm-hero::before,.hm-orb *,#s-title.hm .logo{animation:none!important}}

/* pager : trois pages qui glissent (aimantées), la page centrale est celle du jeu */
.hm-pager{position:absolute;inset:0;z-index:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;scrollbar-width:none;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}
.hm-pager::-webkit-scrollbar{display:none}
.hm-pg{flex:none;width:100%;height:100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;flex-direction:column;align-items:center;gap:14px;padding:calc(env(safe-area-inset-top,0px) + 76px) 20px calc(env(safe-area-inset-bottom,0px) + 112px);overflow-y:auto;scrollbar-width:none;max-width:100vw}
.hm-pg>*{width:100%;max-width:400px}
.hm-hd{text-align:left;margin:10px 4px 6px}.hm-hd h2{margin:0;font:900 30px/1 var(--disp);letter-spacing:.04em;text-transform:uppercase;text-shadow:0 0 24px rgba(77,243,255,.4)}.hm-hd p{margin:8px 0 0;color:rgba(238,244,255,.6);font-size:14px}
.hm-pg:nth-child(2){justify-content:flex-start;gap:0}
.hm-pg:nth-child(2) .logo{margin:calc(clamp(0px,100vh - 700px,40px)) 0 0;text-align:center;font:900 min(13vw,50px)/1 var(--disp);letter-spacing:.03em;background:linear-gradient(100deg,#fff 0%,#7ff6ff 28%,#ff7be5 52%,#fff 76%,#7ff6ff 100%) 0 0/250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:hm-lg 9s linear infinite}
.hm-pg:nth-child(2) .tag{margin:6px 0 0;text-align:center;color:rgba(238,244,255,.7);font-size:14px}
@keyframes hm-lg{to{background-position:-250% 0}}
.hm-hole{position:absolute;inset:0;pointer-events:none;opacity:var(--ho,1);transform:translate3d(var(--hx,0),0,0) rotate(var(--hr,0deg)) scale(var(--hs,1));transition:transform .35s cubic-bezier(.2,.9,.2,1);will-change:transform,opacity}
#s-title.hm:has(#b-mine:active){--hs:1.08}
.hm-slot{position:relative;flex:none;width:min(80vw,340px,40vh);height:min(80vw,340px,40vh);margin:2px 0 0}
.hm-core-btn{position:absolute;inset:27%;border-radius:50%;border:0;background:none;color:#fff;cursor:pointer;display:grid;place-items:center;transition:transform .5s cubic-bezier(.2,1.6,.4,1);-webkit-tap-highlight-color:transparent}
.hm-core-btn:active{transform:scale(.9)}
.hm-core-btn .hm-t{position:relative;font:900 clamp(15px,5.2vw,21px)/1 var(--disp);letter-spacing:.2em;padding-left:.2em;text-transform:uppercase;text-shadow:0 0 14px rgba(255,190,110,.9),0 0 30px rgba(255,120,60,.55);animation:hm-bt 3.6s ease-in-out infinite}
@keyframes hm-bt{50%{opacity:.72;letter-spacing:.26em}}
.hm-rec{margin:0;text-align:center;font:600 13px var(--font);color:rgba(238,244,255,.72)}.hm-rec small{font-size:13px}
.hm-chips{display:flex;gap:12px;margin-top:18px}.hm-chips>*{flex:1;min-width:0}
.hm-chip{height:64px;display:flex;align-items:center;gap:10px;padding:0 14px 0 10px;border-radius:24px;text-align:left}
.hm-chip .hm-sbi{width:40px;height:40px}.hm-chip .hm-sbi .hm-ic{width:20px;height:20px}
.hm-chip .hm-t{font:800 12px/1.1 var(--disp);letter-spacing:.04em;text-transform:uppercase}.hm-chip small{display:block;margin-top:4px;font:500 11.5px/1.2 var(--font);color:rgba(238,244,255,.7)}
#s-title.hm #b-quests{height:64px;border-radius:24px;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;padding:0 16px;font:800 12px/1.1 var(--disp)}#s-title.hm #b-quests em{font:500 11.5px/1.2 var(--font);font-style:normal;letter-spacing:0;text-transform:none;color:rgba(238,244,255,.7)}#s-title.hm #b-quests u{color:#5dffc0;text-decoration:none;font-weight:700}
.hm-camp{height:92px}.hm-av{width:44px;height:44px;border-radius:50%;display:block}
.set-h{align-self:flex-start;margin:12px 2px 0!important;font:700 11px var(--disp);letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.5)!important}
.sw small{display:block;margin-top:3px;font-size:12px;font-weight:500;line-height:1.3;color:rgba(255,255,255,.55);max-width:220px}
.set-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#fff;font:600 16px var(--font)}.set-row small{color:rgba(255,255,255,.6);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.set-row:active{transform:scale(.97)}
.hm-slot{width:min(86vw,400px,44vh)!important;height:min(86vw,400px,44vh)!important}.hm-chips{margin-top:auto!important}.hm-pg:nth-child(2){gap:0}.hm-core-btn .hm-t{text-shadow:0 0 6px rgba(0,0,0,.9),0 0 14px rgba(255,190,110,.9),0 0 30px rgba(255,120,60,.55)}.hm-camp .hm-tx small{white-space:normal}
/* onglets */
.hm-tabs{position:absolute;left:18px;right:18px;max-width:400px;margin:0 auto;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);height:68px;border-radius:34px;display:grid;grid-template-columns:repeat(3,1fr);padding:6px;z-index:3}
.hm-ind{position:absolute;left:6px;top:6px;bottom:6px;width:calc((100% - 12px) / 3);border-radius:28px;background:linear-gradient(135deg,rgba(77,243,255,.34),rgba(255,79,216,.3));box-shadow:0 0 22px rgba(77,243,255,.3),inset 0 1px 0 rgba(255,255,255,.5);transform:translate3d(calc(var(--p,1) * 100%),0,0);will-change:transform}
.hm-tab{position:relative;z-index:1;border:0;background:none;color:rgba(238,244,255,.62);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;cursor:pointer;transition:color .25s}.hm-tab.on{color:#fff}
.hm-tab .hm-ic{width:22px;height:22px;stroke-width:1.9}.hm-tab span{font:700 10.5px/1 var(--font);letter-spacing:.3px}
/* monnaie */
#s-title.hm .hm-pill{gap:8px;padding:0 16px 0 12px;font:800 15px/1 var(--disp);color:#fff}
#s-title.hm .hm-pill .hm-gem{width:22px;height:22px;filter:drop-shadow(0 0 8px rgba(120,160,255,.8));animation:hm-gm 4s ease-in-out infinite}
#s-title.hm .hm-pill b{color:#fff;text-shadow:0 0 12px rgba(120,200,255,.6);font-variant-numeric:tabular-nums}#s-title.hm .hm-pill span{font:600 10.5px var(--font);color:rgba(238,244,255,.6);letter-spacing:.04em}
@keyframes hm-gm{50%{transform:rotate(-8deg) scale(1.08)}}
#s-title.hm .hm-pill.pop{animation:hm-pop .7s cubic-bezier(.2,1.6,.4,1)}@keyframes hm-pop{30%{transform:scale(1.16);box-shadow:0 0 34px rgba(120,200,255,.8)}}
@media (max-height:700px){.hm-pg{padding-top:calc(env(safe-area-inset-top,0px) + 68px);gap:10px}.hm-camp{height:72px!important}.hm-pg:nth-child(2) .tag{display:none}.hm-chips{margin-top:10px}.hm-chip,#s-title.hm #b-quests{height:56px}.hm-hd{margin-top:2px}}
@media (prefers-reduced-motion:reduce){.hm-core-btn .hm-t,.hm-bh,.hm-gem{animation:none!important}}
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
  // Trou noir : l'image du logo (assets/hole.webp), posée sur le bouton Jouer ; elle respire doucement et glisse avec les pages.
  const still = document.createElement('img'); still.className = 'hm-bh'; still.alt = ''; still.src = 'assets/hole.webp'; still.decoding = 'async'; const hole = make('div', 'hm-hole'); cv.after(hole); hole.append(still);
  let cx = 0, cy = 0, tcy = 0, SZ = 340, since = 99;
  const S = Array.from({ length: 230 }, (_, i) => ({ a: rnd(i) * TAU, r: 0.1 + rnd(i * 3) ** 0.7 * 1.35, z: 0.3 + rnd(i * 7) * 0.7 }));
  const place = () => { // le trou noir se pose sur l'emplacement du bouton Jouer
    const sl = document.querySelector('.hm-slot'), r = sl && sl.getBoundingClientRect(); SZ = Math.min(W * 0.98, 440, sl && sl.clientWidth ? sl.clientWidth * 1.04 : 340);
    cx = W / 2; tcy = r && r.height ? r.top + r.height / 2 : H * 0.3; if (!cy) cy = tcy;
    still.style.width = still.style.height = SZ + 'px'; still.style.left = cx - SZ / 2 + 'px';
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
    still.style.top = cy - SZ / 2 + 'px';
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

let live = null, pager = null, shownDust = null, dustRaf = 0;
const PAGES = [['Social', ICONS.rank], ['Jouer', ICONS.hole], ['Collection', ICONS.coll]];
// Une ligne de verre : icône ronde, titre, sous-titre, valeur à droite
const row = (b, icon) => {
  reskin(b, ['gl', 'hm-camp', 'hm-in']); const t = titleOf(b), s = b.querySelector('small'), tx = make('span', 'hm-tx');
  tx.append(...grab(t, s || make('small', ''))); b.textContent = ''; b.append(make('span', 'hm-sbi', ico(icon)), tx); b.insertAdjacentHTML('beforeend', CHEV); return b;
};
export function init() {
  const scr = $('#s-title'); if (!scr || scr.classList.contains('hm')) return;
  const menu = $('.menu', scr), wrap = $('.title-wrap', scr); if (!menu || !wrap) return;
  const st = make('style'); st.textContent = CSS + GCSS; document.head.appendChild(st);
  scr.classList.add('hm'); scr.prepend(bgLayer(scr));

  // barre du haut : monnaie (Éclats) et réglages
  const gear = $('#b-set2'); if (gear) { reskin(gear, ['gl', 'hm-in'], ['glass', 'icon']); gear.style.setProperty('--e', '.1s'); }
  const stars = $('#t-stars'); if (stars) { reskin(stars, ['gl', 'hm-pill', 'hm-in'], ['foot']); stars.style.setProperty('--e', '.05s'); scr.appendChild(stars); }

  // pages
  pager = make('div', 'hm-pager'); const pg = PAGES.map(() => make('section', 'hm-pg')); pager.append(...pg);
  const head = (p, t, s) => p.append(make('div', 'hm-hd', `<h2>${t}</h2><p>${s}</p>`));
  head(pg[0], 'Social', 'Affronte les autres joueurs');
  head(pg[2], 'Collection', 'Tes astres, tes décors');
  const place = (p, id, icon, d) => { const b = $(id); if (b) { row(b, icon); b.style.setProperty('--e', d); p.append(b); } };
  place(pg[0], '#b-rank', ICONS.rank, '.15s'); place(pg[0], '#b-duel', ICONS.duel, '.22s'); place(pg[0], '#b-profile', ICONS.user, '.29s');
  place(pg[2], '#b-codex', ICONS.coll, '.15s'); place(pg[2], '#b-themes', ICONS.theme, '.22s'); place(pg[2], '#b-sandbox', ICONS.casc, '.29s');

  // page centrale : le trou noir EST le bouton Jouer
  const logo = $('.logo', wrap); if (logo) { logo.textContent = 'CRITICAL'; logo.classList.add('hm-in'); }
  const tag = $('.tag', wrap); if (tag) tag.classList.add('hm-in');
  const slot = make('div', 'hm-slot'), play = $('#b-mine') || $('#b-endless');
  const rec = play && ($('#b-mine-s', play) || $('#b-endless-s', play)), title = play && titleOf(play);
  if (play) { reskin(play, ['hm-core-btn']); play.textContent = ''; play.setAttribute('aria-label', 'Jouer'); play.append(title || make('span', 'hm-t', 'Jouer')); if (title) title.textContent = 'Jouer'; slot.append(play); }
  const chips = make('div', 'hm-chips'), daily = $('#b-daily'), qb = $('#b-quests');
  if (daily) { reskin(daily, ['gl', 'hm-chip', 'hm-in']); const t = titleOf(daily), s = daily.querySelector('small'), tx = make('span', 'hm-tx'); tx.append(...grab(t, s)); daily.textContent = ''; daily.append(make('span', 'hm-sbi', ico(ICONS.cal)), tx); live = make('span', 'hm-live'); daily.append(live); chips.append(daily); }
  if (qb) { qb.classList.remove('glass'); qb.classList.add('gl', 'hm-chip', 'hm-in'); chips.append(qb); }
  pg[1].append(...[logo, tag, slot, rec && make('p', 'hm-rec'), chips].filter(Boolean)); const rc = $('.hm-rec', pg[1]); if (rc && rec) rc.append(rec);
  wrap.remove(); menu.remove(); scr.append(pager);

  // barre d'onglets : l'indicateur suit le doigt (variable --p = position de la page, 0 à 2)
  const tabs = make('nav', 'gl hm-tabs hm-in', '<i class="hm-ind"></i>'); tabs.setAttribute('aria-label', 'Navigation');
  PAGES.forEach(([n, ic], i) => { const b = make('button', 'hm-tab', ico(ic) + `<span>${n}</span>`); b.addEventListener('click', () => pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' })); tabs.append(b); });
  scr.append(tabs);
  const go = () => { const p = pager.scrollLeft / (pager.clientWidth || 1); scr.style.setProperty('--p', p.toFixed(3)); scr.style.setProperty('--ho', Math.max(0, 1 - Math.abs(p - 1) * 1.5).toFixed(3)); scr.style.setProperty('--hr', ((1 - p) * 26).toFixed(1) + 'deg'); scr.style.setProperty('--hx', ((1 - p) * 34).toFixed(1) + 'vw'); tabs.querySelectorAll('.hm-tab').forEach((b, i) => b.classList.toggle('on', Math.abs(p - i) < 0.5)); };
  pager.addEventListener('scroll', go, { passive: true });
  const center = () => { pager.style.scrollBehavior = 'auto'; pager.scrollLeft = pager.clientWidth; go(); pager.style.scrollBehavior = ''; };
  window.addEventListener('resize', center); requestAnimationFrame(center); setTimeout(center, 300);
}

// Appelé par refreshTitle() : anneau de progression de la campagne + point « défi disponible »
// Appelé par app.js : poussière d'étoile possédée et état du défi du jour
export function update({ dust = 0, daily = null, codex = 0, themes = null } = {}) {
  const sub = (id, t) => { const e = $(id + ' small'); if (e && t) e.textContent = t; };
  sub('#b-codex', codex ? `${codex} découverte${codex > 1 ? 's' : ''}` : 'Fusionne pour découvrir'); if (themes) sub('#b-themes', `${themes[0]} sur ${themes[1]} possédés`); sub('#b-rank', 'Mondial et défi du jour'); sub('#b-profile', 'Ton astre, ta vitrine, ta devise');
  const p = $('#t-stars');
  if (p) {
    if (!p.firstChild) p.innerHTML = GEM + '<b class="hm-eclats">0</b><span>Éclats</span>';
    const n = Math.round(dust), el = $('.hm-eclats', p); cancelAnimationFrame(dustRaf);
    if (shownDust === null || document.hidden) { shownDust = n; el.textContent = n.toLocaleString('fr-FR'); }
    else if (shownDust !== n) { const from = shownDust, t0 = performance.now(); p.classList.remove('pop'); void p.offsetWidth; if (n > from) p.classList.add('pop');
      const step = (t) => { const k = Math.min(1, (t - t0) / 900); shownDust = Math.round(from + (n - from) * (1 - (1 - k) ** 3)); el.textContent = shownDust.toLocaleString('fr-FR'); if (k < 1) dustRaf = requestAnimationFrame(step); }; dustRaf = requestAnimationFrame(step); }
  }
  const d = $('#b-daily small'); if (d && daily) { d.textContent = daily.done ? 'Réussi aujourd\'hui' : 'Nouveau défi'; if (live) live.style.display = daily.done ? 'none' : ''; }
}
