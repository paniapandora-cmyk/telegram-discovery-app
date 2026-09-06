/*
 * Telegram Discovery — Cinematic Home Redesign v1
 * Visual target: approved Persian dark/space discovery mockup.
 *
 * Load AFTER:
 *   1) creator-growth-ui.js
 *   2) home-compact-controls-stable-v2.js
 *   3) media-consistency-v1.js
 *
 * This patch changes presentation only. It does not replace Discovery/Search/
 * Creator APIs, ranking, tracking, Add Channel, or navigation handlers.
 */
(() => {
  "use strict";

  const STYLE_ID = "tdCinematicHomeV1Style";
  const SHELF_ID = "tdCinematicChannelShelf";
  const MOTTO_ID = "tdCinematicMotto";
  const VERSION = "1.0.0";

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ================================================================
         CINEMATIC HOME — approved dark-space direction
         Scoped to feed mode so Search / Explore / Saved / Hub stay stable.
         ================================================================ */

      #${MOTTO_ID},
      #${SHELF_ID}{
        display:none!important;
      }

      body.mode-feed{
        --td-c-bg:#02070d;
        --td-c-surface:#07111c;
        --td-c-surface-2:#0a1622;
        --td-c-surface-3:#0d1b28;
        --td-c-line:rgba(126,166,198,.24);
        --td-c-line-soft:rgba(126,166,198,.14);
        --td-c-text:#f5f8fb;
        --td-c-muted:#8c9baa;
        --td-c-blue:#21a7f4;
        --td-c-blue-2:#0d83dd;
        --td-c-glow:rgba(24,167,246,.32);
        --td-c-card-r:18px;
        background:#02070d!important;
      }

      body.mode-feed .app{
        position:relative!important;
        width:min(100%,760px)!important;
        padding:
          calc(var(--safe-t) + 2px)
          clamp(12px,3.2vw,22px)
          24px!important;
        background:
          linear-gradient(180deg,rgba(1,6,12,.04),rgba(1,6,12,.76) 265px,#02070d 410px)!important;
        isolation:isolate!important;
      }

      /* Space / planet atmosphere — decorative only, no external asset. */
      body.mode-feed .app::before{
        content:"";
        position:absolute;
        z-index:-2;
        top:0;
        left:0;
        right:0;
        height:315px;
        pointer-events:none;
        background:
          radial-gradient(circle at 7% 2%,rgba(111,178,237,.16) 0 1px,transparent 1.6px),
          radial-gradient(circle at 16% 15%,rgba(255,255,255,.16) 0 1px,transparent 1.5px),
          radial-gradient(circle at 41% 7%,rgba(123,194,255,.18) 0 1px,transparent 1.6px),
          radial-gradient(circle at 63% 11%,rgba(255,255,255,.13) 0 1px,transparent 1.5px),
          radial-gradient(circle at 81% 6%,rgba(119,190,255,.18) 0 1px,transparent 1.5px),
          radial-gradient(ellipse 280px 260px at -3% -16%,rgba(23,63,101,.82) 0 47%,rgba(6,23,39,.86) 48% 58%,transparent 59%),
          radial-gradient(ellipse 620px 180px at 92% -3%,rgba(31,79,122,.38) 0 25%,rgba(10,30,49,.32) 31%,transparent 57%),
          linear-gradient(180deg,#020812 0%,#02070d 100%);
        opacity:.98;
      }

      body.mode-feed .app::after{
        content:"";
        position:absolute;
        z-index:-1;
        top:0;
        inset-inline:0;
        height:300px;
        pointer-events:none;
        background:
          radial-gradient(290px 110px at 83% 13%,rgba(57,145,219,.09),transparent 68%),
          linear-gradient(180deg,transparent 66%,#02070d 100%);
      }

      /* ---------- header ---------- */
      body.mode-feed .top{
        position:relative!important;
        top:auto!important;
        z-index:3!important;
        min-height:92px!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:space-between!important;
        margin:0!important;
        padding:12px 4px 14px!important;
        background:transparent!important;
        backdrop-filter:none!important;
      }

      body.mode-feed .brand{
        gap:11px!important;
        align-items:center!important;
      }

      body.mode-feed .mark{
        width:46px!important;
        height:46px!important;
        flex-basis:46px!important;
        border:0!important;
        border-radius:50%!important;
        color:#fff!important;
        background:
          radial-gradient(circle at 34% 28%,#70d7ff 0 8%,transparent 9%),
          linear-gradient(145deg,#2bc1ff,#1287eb 72%)!important;
        box-shadow:0 10px 30px rgba(25,161,240,.28),inset 0 1px rgba(255,255,255,.38)!important;
        font-size:22px!important;
      }

      body.mode-feed .top h1{
        margin:0!important;
        color:var(--td-c-text)!important;
        font-size:1.7rem!important;
        line-height:1.12!important;
        font-weight:900!important;
        letter-spacing:-.035em!important;
      }

      body.mode-feed .top .eyebrow{
        margin-top:7px!important;
        color:#a8b3bf!important;
        font-size:.9rem!important;
        line-height:1.5!important;
      }

      body.mode-feed .status{
        display:none!important;
      }

      body.mode-feed #${MOTTO_ID}{
        display:none;
      }

      @media(min-width:520px){
        body.mode-feed #${MOTTO_ID}{
          display:flex!important;
          align-items:center;
          gap:10px;
          margin-inline-start:auto;
          padding-top:5px;
          color:#c2ccd5;
          font-size:.72rem;
          line-height:1.55;
          text-align:right;
          white-space:pre-line;
        }
        body.mode-feed #${MOTTO_ID} .td-plane{
          position:relative;
          width:54px;
          height:38px;
          display:grid;
          place-items:center;
          color:#9fc5e7;
          filter:drop-shadow(0 8px 18px rgba(56,134,202,.28));
          transform:rotate(-16deg);
          font-size:36px;
        }
      }

      /* ---------- search + Add Channel ---------- */
      body.mode-feed #tdHomeQuickTools{
        position:relative!important;
        z-index:4!important;
        direction:ltr!important;
        width:100%!important;
        min-height:58px!important;
        display:flex!important;
        align-items:stretch!important;
        justify-content:stretch!important;
        gap:12px!important;
        margin:0 0 16px!important;
        padding:0!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar,
      body.mode-feed #tdHomeQuickTools .searchbar.td-search-open{
        position:relative!important;
        inset:auto!important;
        top:auto!important;
        right:auto!important;
        left:auto!important;
        flex:1 1 auto!important;
        width:auto!important;
        min-width:0!important;
        max-width:none!important;
        height:58px!important;
        min-height:58px!important;
        margin:0!important;
        padding:5px 6px!important;
        border:1px solid rgba(116,171,213,.32)!important;
        border-radius:18px!important;
        background:linear-gradient(135deg,rgba(15,31,49,.97),rgba(6,18,30,.98))!important;
        box-shadow:inset 0 1px rgba(255,255,255,.035),0 10px 30px rgba(0,0,0,.2)!important;
        overflow:hidden!important;
        transition:border-color .16s ease,box-shadow .16s ease!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar:focus-within{
        border-color:rgba(44,174,250,.68)!important;
        box-shadow:0 0 0 3px rgba(28,157,234,.09),0 12px 34px rgba(0,0,0,.25)!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar input,
      body.mode-feed #tdHomeQuickTools .searchbar.td-search-open input{
        position:static!important;
        inset:auto!important;
        direction:rtl!important;
        width:100%!important;
        height:46px!important;
        min-height:46px!important;
        padding:0 50px 0 14px!important;
        opacity:1!important;
        pointer-events:auto!important;
        color:#e8edf2!important;
        background:transparent!important;
        font-size:.88rem!important;
        transition:none!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar input::placeholder{
        color:#8e9ba8!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar .icon{
        position:absolute!important;
        top:8px!important;
        right:8px!important;
        left:auto!important;
        width:40px!important;
        min-width:40px!important;
        height:40px!important;
        min-height:40px!important;
        display:grid!important;
        place-items:center!important;
        border:0!important;
        border-radius:13px!important;
        color:#aebbc7!important;
        background:transparent!important;
        font-size:1.4rem!important;
      }

      body.mode-feed #tdAddChannelProxy{
        order:2!important;
        flex:0 0 auto!important;
        min-width:136px!important;
        height:58px!important;
        min-height:58px!important;
        padding:0 20px!important;
        border:1px solid rgba(109,207,255,.36)!important;
        border-radius:18px!important;
        color:#fff!important;
        background:linear-gradient(145deg,#27b2f5 0%,#1698ea 58%,#0f85dd 100%)!important;
        box-shadow:0 10px 25px rgba(20,154,232,.24),inset 0 1px rgba(255,255,255,.22)!important;
        font-size:.84rem!important;
        font-weight:780!important;
      }

      body.mode-feed #addChannelCard{
        display:none!important;
      }

      /* ---------- top tabs ---------- */
      body.mode-feed .tabs{
        position:relative!important;
        z-index:3!important;
        min-height:56px!important;
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:10px!important;
        margin:0 0 17px!important;
        padding:0!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        box-shadow:none!important;
      }

      body.mode-feed .tab{
        min-height:54px!important;
        padding:0 10px!important;
        border:1px solid rgba(130,162,188,.28)!important;
        border-radius:18px!important;
        color:#e1e6eb!important;
        background:linear-gradient(145deg,rgba(13,25,38,.92),rgba(7,16,26,.94))!important;
        box-shadow:inset 0 1px rgba(255,255,255,.025)!important;
        font-size:.86rem!important;
        font-weight:730!important;
      }

      body.mode-feed .tab.active{
        border-color:#22b8ff!important;
        color:#fff!important;
        background:
          radial-gradient(120px 50px at 50% 110%,rgba(40,186,255,.34),transparent 70%),
          linear-gradient(145deg,#08223a,#0a3457)!important;
        box-shadow:0 0 0 1px rgba(16,180,255,.18),0 0 24px rgba(14,153,233,.14),inset 0 1px rgba(255,255,255,.08)!important;
      }

      /* ---------- channel shelf ---------- */
      body.mode-feed #${SHELF_ID}{
        display:block!important;
        position:relative!important;
        z-index:3!important;
        margin:0 0 22px!important;
        padding:12px 12px 13px!important;
        border:1px solid rgba(115,153,185,.2)!important;
        border-radius:20px!important;
        background:linear-gradient(145deg,rgba(9,20,31,.97),rgba(5,14,23,.98))!important;
        box-shadow:0 16px 38px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.025)!important;
        overflow:hidden!important;
      }

      body.mode-feed .td-cinematic-shelf-head{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:12px!important;
        margin:0 2px 10px!important;
      }

      body.mode-feed .td-cinematic-shelf-head strong{
        color:#f2f5f8!important;
        font-size:.9rem!important;
        font-weight:850!important;
      }

      body.mode-feed .td-cinematic-shelf-head button{
        min-height:30px!important;
        padding:0 8px!important;
        border:0!important;
        color:#9da9b5!important;
        background:transparent!important;
        font-size:.72rem!important;
        cursor:pointer!important;
      }

      body.mode-feed #v6CreatorRail{
        width:100%!important;
        display:grid!important;
        grid-template-columns:repeat(4,minmax(92px,1fr))!important;
        gap:8px!important;
        margin:0!important;
        padding:0!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        scroll-snap-type:x proximity!important;
        scrollbar-width:none!important;
      }

      body.mode-feed #v6CreatorRail::-webkit-scrollbar{display:none!important}

      body.mode-feed #v6CreatorRail .v6-creator-card{
        min-width:0!important;
        min-height:154px!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        padding:10px 8px 9px!important;
        border:1px solid rgba(123,160,189,.18)!important;
        border-radius:16px!important;
        background:linear-gradient(145deg,#0d1a27,#07111b)!important;
        box-shadow:inset 0 1px rgba(255,255,255,.02)!important;
        text-align:center!important;
        scroll-snap-align:start!important;
      }

      body.mode-feed #v6CreatorRail .v6-creator-card img,
      body.mode-feed #v6CreatorRail .v6-creator-avatar-fallback{
        width:64px!important;
        height:64px!important;
        flex:0 0 64px!important;
        border:1px solid rgba(255,255,255,.24)!important;
        border-radius:16px!important;
        object-fit:cover!important;
        background:#172431!important;
        box-shadow:0 8px 22px rgba(0,0,0,.22)!important;
      }

      body.mode-feed #v6CreatorRail .v6-creator-avatar-fallback{
        display:grid!important;
        place-items:center!important;
        color:#d4dce4!important;
        font-size:1rem!important;
      }

      body.mode-feed #v6CreatorRail .v6-creator-card strong{
        width:100%!important;
        margin-top:8px!important;
        overflow:hidden!important;
        color:#fff!important;
        font-size:.78rem!important;
        line-height:1.25!important;
        font-weight:780!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }

      body.mode-feed #v6CreatorRail .v6-creator-card small{
        width:100%!important;
        margin-top:3px!important;
        overflow:hidden!important;
        color:#82909d!important;
        font-size:.67rem!important;
        line-height:1.25!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
        direction:ltr!important;
      }

      body.mode-feed #v6CreatorRail .v6-creator-card button{
        width:100%!important;
        min-height:32px!important;
        margin-top:auto!important;
        padding:0 8px!important;
        border:0!important;
        border-radius:11px!important;
        color:#fff!important;
        background:linear-gradient(145deg,#218fd9,#126db5)!important;
        font-size:.7rem!important;
        font-weight:760!important;
      }

      body.mode-feed #${SHELF_ID}.td-expanded #v6CreatorRail{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        overflow:visible!important;
      }

      /* ---------- section heading ---------- */
      body.mode-feed .head{
        position:relative!important;
        z-index:3!important;
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        margin:0 4px 12px!important;
      }

      body.mode-feed .head h2{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        margin:0!important;
        color:#fff!important;
        font-size:1.32rem!important;
        line-height:1.35!important;
        font-weight:900!important;
        letter-spacing:-.03em!important;
      }

      body.mode-feed .head h2::after{
        content:"✦"!important;
        width:auto!important;
        height:auto!important;
        margin:0!important;
        border:0!important;
        color:#2eb6ff!important;
        background:none!important;
        box-shadow:none!important;
        font-size:1.2rem!important;
        line-height:1!important;
      }

      body.mode-feed .head span{
        display:inline-flex!important;
        align-items:center!important;
        color:#8d9aa6!important;
        font-size:.73rem!important;
      }

      body.mode-feed .globalSearchPanel{
        display:none!important;
      }

      /* ---------- feed grid ---------- */
      body.mode-feed #grid{
        position:relative!important;
        z-index:3!important;
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        grid-auto-flow:row!important;
        gap:12px!important;
        align-items:stretch!important;
        padding:0 0 8px!important;
      }

      body.mode-feed[data-discovery-channel-count="2"] #grid,
      body.mode-feed[data-discovery-channel-count="3"] #grid,
      body.mode-feed[data-discovery-channel-count="4"] #grid{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:12px!important;
      }

      body.mode-feed #grid .card,
      body.mode-feed #grid .card.hero,
      body.mode-feed #grid .card.wide{
        grid-column:auto!important;
        min-width:0!important;
        height:auto!important;
        min-height:330px!important;
        display:flex!important;
        flex-direction:column!important;
        overflow:hidden!important;
        border:1px solid rgba(122,161,190,.25)!important;
        border-radius:var(--td-c-card-r)!important;
        color:#fff!important;
        background:linear-gradient(145deg,#0a1621,#07111a)!important;
        box-shadow:0 16px 35px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.025)!important;
        transform:none!important;
      }

      body.mode-feed #grid .card:hover{
        transform:none!important;
      }

      body.mode-feed #grid .mediaStage,
      body.mode-feed #grid .v6-auto-media-stage,
      body.mode-feed #grid .td-media-stage{
        flex:0 0 auto!important;
        width:100%!important;
        aspect-ratio:16/9!important;
        min-height:0!important;
        overflow:hidden!important;
        border:0!important;
        border-radius:0!important;
        background:
          radial-gradient(circle at 70% 30%,rgba(45,139,198,.2),transparent 48%),
          #09131d!important;
      }

      body.mode-feed[data-discovery-channel-count="2"] #grid .mediaStage,
      body.mode-feed[data-discovery-channel-count="3"] #grid .mediaStage,
      body.mode-feed[data-discovery-channel-count="4"] #grid .mediaStage,
      body.mode-feed[data-discovery-channel-count="2"] #grid .v6-auto-media-stage,
      body.mode-feed[data-discovery-channel-count="3"] #grid .v6-auto-media-stage,
      body.mode-feed[data-discovery-channel-count="4"] #grid .v6-auto-media-stage,
      body.mode-feed[data-discovery-channel-count="2"] #grid .td-media-stage,
      body.mode-feed[data-discovery-channel-count="3"] #grid .td-media-stage,
      body.mode-feed[data-discovery-channel-count="4"] #grid .td-media-stage{
        aspect-ratio:16/9!important;
      }

      body.mode-feed #grid .mediaStage img,
      body.mode-feed #grid .mediaStage video,
      body.mode-feed #grid .v6-auto-media-stage img,
      body.mode-feed #grid .td-media-stage img,
      body.mode-feed #grid .td-media-stage video{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:center!important;
        filter:saturate(.9) contrast(1.03)!important;
      }

      body.mode-feed #grid .copy,
      body.mode-feed #grid .nativePreview{
        position:relative!important;
        flex:1 1 auto!important;
        min-height:0!important;
        display:flex!important;
        flex-direction:column!important;
        gap:8px!important;
        padding:10px 12px 12px!important;
        border:0!important;
        border-top:1px solid rgba(120,158,186,.14)!important;
        background:linear-gradient(180deg,#09141f 0%,#071019 100%)!important;
      }

      body.mode-feed #grid .nativeHead,
      body.mode-feed #grid .channel{
        min-width:0!important;
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        margin:0!important;
        padding:0 0 0 34px!important;
        color:#f3f5f7!important;
      }

      body.mode-feed #grid .avatar,
      body.mode-feed #grid .nativeAvatar{
        width:36px!important;
        height:36px!important;
        flex:0 0 36px!important;
        border:1px solid rgba(255,255,255,.26)!important;
        border-radius:12px!important;
        background:#e9edf1!important;
      }

      body.mode-feed #grid .nativeName,
      body.mode-feed #grid .channel>span:not(.avatar):not(.reason){
        color:#f5f7f9!important;
        font-size:.78rem!important;
        line-height:1.35!important;
        font-weight:800!important;
      }

      body.mode-feed #grid .nativeMeta,
      body.mode-feed #grid .meta{
        color:#8795a2!important;
        font-size:.67rem!important;
        line-height:1.4!important;
      }

      body.mode-feed #grid .nativeMessage,
      body.mode-feed #grid .title,
      body.mode-feed #grid .hero .nativeMessage,
      body.mode-feed #grid .hero .title{
        margin:0!important;
        padding:2px 0 4px!important;
        color:#eef1f4!important;
        font-size:.82rem!important;
        font-weight:450!important;
        line-height:1.85!important;
        display:-webkit-box!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:4!important;
        line-clamp:4!important;
        overflow:hidden!important;
      }

      body.mode-feed #grid .reason,
      body.mode-feed #grid .type,
      body.mode-feed #grid .freshness,
      body.mode-feed #grid .rank{
        display:none!important;
      }

      /* Save = bookmark on the lower edge, matching the approved mockup. */
      body.mode-feed #grid .card .save{
        position:absolute!important;
        z-index:14!important;
        top:auto!important;
        right:12px!important;
        left:auto!important;
        bottom:10px!important;
        width:30px!important;
        min-width:30px!important;
        height:30px!important;
        min-height:30px!important;
        display:grid!important;
        place-items:center!important;
        border:0!important;
        border-radius:9px!important;
        color:#d9e0e6!important;
        background:transparent!important;
        box-shadow:none!important;
        backdrop-filter:none!important;
        font-size:1.25rem!important;
      }

      body.mode-feed #grid .card .save.saved{
        color:#2eb7ff!important;
      }

      body.mode-feed #grid .cardOpen{
        z-index:3!important;
      }

      body.mode-feed #grid .save{
        z-index:14!important;
      }

      body.mode-feed #grid .card.td-text-only{
        min-height:280px!important;
        background:
          radial-gradient(240px 140px at 100% 0,rgba(32,113,172,.15),transparent 70%),
          linear-gradient(145deg,#0c1925,#07111a)!important;
      }

      body.mode-feed #grid .card.td-text-only .nativePreview,
      body.mode-feed #grid .card.td-text-only .copy{
        min-height:280px!important;
        justify-content:flex-start!important;
      }

      /* ---------- bottom navigation ---------- */
      body.mode-feed > .nav{
        width:min(calc(100% - 14px),746px)!important;
        height:72px!important;
        min-height:72px!important;
        gap:2px!important;
        margin:5px auto var(--safe-b)!important;
        padding:5px 7px!important;
        border:1px solid rgba(116,151,181,.24)!important;
        border-radius:28px!important;
        background:rgba(2,8,14,.96)!important;
        box-shadow:0 18px 42px rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.03)!important;
        backdrop-filter:blur(18px)!important;
      }

      body.mode-feed > .nav button{
        min-height:58px!important;
        gap:4px!important;
        border-radius:18px!important;
        color:#a8b2bc!important;
        background:transparent!important;
        font-size:.68rem!important;
      }

      body.mode-feed > .nav svg{
        width:26px!important;
        height:26px!important;
        stroke-width:1.85!important;
      }

      body.mode-feed > .nav button.active{
        color:#2eb7ff!important;
        background:transparent!important;
      }

      body.mode-feed > .nav button.active::after{
        display:none!important;
      }

      /* ---------- responsive ---------- */
      @media(max-width:520px){
        body.mode-feed .app{
          padding-right:10px!important;
          padding-left:10px!important;
        }

        body.mode-feed #tdHomeQuickTools{
          gap:8px!important;
        }

        body.mode-feed #tdAddChannelProxy{
          min-width:112px!important;
          padding:0 13px!important;
          font-size:.75rem!important;
        }

        body.mode-feed #v6CreatorRail{
          grid-template-columns:repeat(4,minmax(104px,1fr))!important;
        }

        body.mode-feed #grid{
          gap:9px!important;
        }

        body.mode-feed #grid .card,
        body.mode-feed #grid .card.hero,
        body.mode-feed #grid .card.wide{
          min-height:300px!important;
          border-radius:16px!important;
        }

        body.mode-feed #grid .copy,
        body.mode-feed #grid .nativePreview{
          padding:9px 10px 11px!important;
        }

        body.mode-feed #grid .nativeMessage,
        body.mode-feed #grid .title,
        body.mode-feed #grid .hero .nativeMessage,
        body.mode-feed #grid .hero .title{
          font-size:.76rem!important;
          line-height:1.78!important;
          -webkit-line-clamp:4!important;
          line-clamp:4!important;
        }
      }

      @media(max-width:370px){
        body.mode-feed #tdHomeQuickTools{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) 104px!important;
        }

        body.mode-feed #tdAddChannelProxy{
          min-width:0!important;
          width:104px!important;
        }

        body.mode-feed .tabs{
          gap:6px!important;
        }

        body.mode-feed .tab{
          min-height:50px!important;
          padding:0 6px!important;
          font-size:.77rem!important;
        }

        body.mode-feed #grid{
          gap:7px!important;
        }

        body.mode-feed #grid .card,
        body.mode-feed #grid .card.hero,
        body.mode-feed #grid .card.wide{
          min-height:278px!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        body.mode-feed *{
          scroll-behavior:auto!important;
          transition:none!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureMotto() {
    const top = q(".top");
    if (!top || document.getElementById(MOTTO_ID)) return;

    const motto = document.createElement("div");
    motto.id = MOTTO_ID;
    motto.setAttribute("aria-hidden", "true");
    motto.innerHTML = `<span class="td-plane">➤</span><span>کانال‌های بهتر\nدنیای بزرگ‌تر</span>`;
    top.appendChild(motto);
  }

  function ensureShelf() {
    const rail = document.getElementById("v6CreatorRail");
    if (!rail) return false;

    let shelf = document.getElementById(SHELF_ID);

    if (!shelf) {
      shelf = document.createElement("section");
      shelf.id = SHELF_ID;
      shelf.setAttribute("aria-label", "کانال‌های پیشنهادی");

      const head = document.createElement("div");
      head.className = "td-cinematic-shelf-head";
      head.innerHTML = `
        <strong>کانال‌های پیشنهادی</strong>
        <button type="button" aria-expanded="false">همه را ببین ‹</button>
      `;

      head.querySelector("button")?.addEventListener("click", () => {
        const expanded = shelf.classList.toggle("td-expanded");
        const button = head.querySelector("button");
        if (button) {
          button.setAttribute("aria-expanded", String(expanded));
          button.textContent = expanded ? "کمتر ›" : "همه را ببین ‹";
        }
      });

      shelf.appendChild(head);
      rail.parentNode?.insertBefore(shelf, rail);
      shelf.appendChild(rail);
    } else if (rail.parentElement !== shelf) {
      shelf.appendChild(rail);
    }

    return true;
  }

  function normalizeHomeCopy() {
    if (!document.body.classList.contains("mode-feed")) return;

    const search = document.getElementById("search");
    if (search) {
      search.placeholder = "کانال، موضوع یا کلمه کلیدی جستجو کن…";
    }

    const heading = document.getElementById("heading");
    if (heading && heading.textContent.trim() !== "منتخب برای تو") {
      heading.textContent = "منتخب برای تو";
    }

    const count = document.getElementById("count");
    if (count && count.textContent && !/محتوا/.test(count.textContent)) {
      const raw = count.textContent.trim();
      if (raw && raw !== "—") count.textContent = `${raw} محتوا`;
    }
  }

  function decorateCards() {
    if (!document.body.classList.contains("mode-feed")) return;

    qa("#grid .card").forEach((card) => {
      if (card.dataset.tdCinematicV1 === "1") return;
      card.dataset.tdCinematicV1 = "1";

      // Keep links, save behavior and card opener from the host application.
      // We only normalize tooltip/aria language for the visual redesign.
      const save = q(".save", card);
      if (save && !save.getAttribute("title")) {
        save.setAttribute("title", "ذخیره");
      }
    });
  }

  function applyHome() {
    if (!document.body.classList.contains("mode-feed")) return;
    ensureMotto();
    ensureShelf();
    normalizeHomeCopy();
    decorateCards();
  }

  function boot() {
    installStyle();
    applyHome();

    const bodyObserver = new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.type === "attributes" && m.attributeName === "class")) return;
      requestAnimationFrame(applyHome);
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const grid = document.getElementById("grid");
    if (grid) {
      const gridObserver = new MutationObserver(() => {
        if (!document.body.classList.contains("mode-feed")) return;
        requestAnimationFrame(decorateCards);
      });
      gridObserver.observe(grid, { childList: true });
    }

    // Creator rail is injected asynchronously by creator-growth-ui.js.
    const app = q(".app");
    if (app) {
      const appObserver = new MutationObserver((mutations) => {
        if (!document.body.classList.contains("mode-feed")) return;
        if (!mutations.some((m) => m.type === "childList" && m.addedNodes.length)) return;
        if (document.getElementById("v6CreatorRail")?.parentElement?.id === SHELF_ID) return;
        requestAnimationFrame(ensureShelf);
      });
      appObserver.observe(app, { childList: true });
    }

    // Small delayed pass for async channel rail / initial feed render.
    setTimeout(applyHome, 250);
    setTimeout(applyHome, 900);

    console.info(`Telegram Discovery cinematic home ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
