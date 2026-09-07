/*
 * Telegram Discovery — Cinematic UI System v2
 * Production visual layer for Home / Explore / Search / Saved / History / Hub / Viewer.
 *
 * Load AFTER:
 *   creator-growth-ui.js
 *   home-compact-controls-stable-v2.js
 *   media-consistency-v1.js
 *
 * Presentation only: keeps existing APIs, ranking, tracking, save/open handlers,
 * Creator Center logic, Add Channel, Discovery channels, and Telegram navigation.
 */
(() => {
  "use strict";

  const VERSION = "2.2.0";
  const STYLE_ID = "tdCinematicUiV2Style";
  const SHELF_ID = "tdCinematicChannelShelfV2";
  const MOTTO_ID = "tdCinematicMottoV2";
  const CREATOR_STYLE_ID = "tdCinematicCreatorV2";

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  let raf = 0;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --td2-bg:#02070d;
        --td2-bg-2:#04101a;
        --td2-panel:#08131f;
        --td2-panel-2:#0b1825;
        --td2-card:#091520;
        --td2-card-2:#07111a;
        --td2-line:rgba(125,171,205,.22);
        --td2-line-soft:rgba(125,171,205,.12);
        --td2-text:#f6f8fb;
        --td2-muted:#8f9ca9;
        --td2-muted-2:#667786;
        --td2-blue:#22b7ff;
        --td2-blue-2:#118ee4;
        --td2-cyan:#6bd7ff;
        --td2-green:#37d99a;
        --td2-red:#ff6b82;
        --td2-radius:20px;
        --td2-radius-sm:15px;
        --td2-shadow:0 18px 45px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.025);
        --td2-glow:0 0 0 1px rgba(34,183,255,.10),0 0 28px rgba(20,159,237,.12);
      }

      html,body{
        background:#02070d!important;
      }

      body{
        color:var(--td2-text)!important;
        background:
          radial-gradient(480px 290px at 88% -10%,rgba(37,126,201,.13),transparent 70%),
          linear-gradient(180deg,#020812 0%,#02070d 100%)!important;
      }

      /* ========== App atmosphere ========== */
      body > .app{
        position:relative!important;
        width:min(100%,760px)!important;
        padding:
          calc(var(--safe-t) + 3px)
          clamp(11px,3vw,22px)
          24px!important;
        isolation:isolate!important;
        scrollbar-width:none!important;
        background:
          linear-gradient(180deg,rgba(2,8,14,.02),rgba(2,8,14,.60) 275px,#02070d 440px)!important;
      }
      body > .app::-webkit-scrollbar{display:none!important}

      body > .app::before{
        content:"";
        position:absolute;
        z-index:-2;
        top:0;
        inset-inline:0;
        height:330px;
        pointer-events:none;
        background:
          radial-gradient(circle at 8% 11%,rgba(255,255,255,.34) 0 1px,transparent 1.4px),
          radial-gradient(circle at 17% 5%,rgba(90,184,255,.24) 0 1.2px,transparent 1.7px),
          radial-gradient(circle at 42% 16%,rgba(255,255,255,.22) 0 1px,transparent 1.5px),
          radial-gradient(circle at 58% 6%,rgba(119,204,255,.22) 0 1px,transparent 1.6px),
          radial-gradient(circle at 77% 13%,rgba(255,255,255,.18) 0 1px,transparent 1.5px),
          radial-gradient(circle at 91% 5%,rgba(100,187,255,.30) 0 1.2px,transparent 1.8px),
          radial-gradient(ellipse 315px 280px at -4% -14%,#153b5d 0 41%,#0b263f 42% 54%,rgba(5,18,31,.64) 55% 63%,transparent 64%),
          radial-gradient(ellipse 600px 165px at 92% -5%,rgba(29,80,121,.42) 0 24%,rgba(11,38,62,.27) 33%,transparent 59%),
          linear-gradient(180deg,#020914,#02070d 100%);
        opacity:.98;
      }

      body > .app::after{
        content:"";
        position:absolute;
        z-index:-1;
        top:0;
        inset-inline:0;
        height:340px;
        pointer-events:none;
        background:
          radial-gradient(250px 100px at 80% 15%,rgba(61,155,228,.10),transparent 70%),
          linear-gradient(180deg,transparent 66%,#02070d 100%);
      }

      /* ========== Header ========== */
      body .top{
        position:relative!important;
        top:auto!important;
        z-index:10!important;
        min-height:92px!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:space-between!important;
        gap:12px!important;
        margin:0!important;
        padding:11px 4px 13px!important;
        background:transparent!important;
        background-image:none!important;
        box-shadow:none!important;
        backdrop-filter:none!important;
      }

      body .brand{
        min-width:0!important;
        display:flex!important;
        align-items:center!important;
        gap:11px!important;
      }

      body .mark{
        width:48px!important;
        height:48px!important;
        flex:0 0 48px!important;
        display:grid!important;
        place-items:center!important;
        border:1px solid rgba(125,216,255,.20)!important;
        border-radius:50%!important;
        color:#fff!important;
        background:
          radial-gradient(circle at 34% 28%,rgba(182,237,255,.88) 0 8%,transparent 9%),
          linear-gradient(145deg,#2cc4ff 0%,#1696ed 72%,#0d76cf 100%)!important;
        box-shadow:0 10px 32px rgba(18,155,235,.28),inset 0 1px rgba(255,255,255,.35)!important;
        font-size:23px!important;
      }

      body .top h1{
        margin:0!important;
        color:#fff!important;
        font-size:1.72rem!important;
        line-height:1.12!important;
        font-weight:920!important;
        letter-spacing:-.04em!important;
      }

      body .top .eyebrow{
        margin-top:7px!important;
        color:#a8b4bf!important;
        font-size:.88rem!important;
        line-height:1.5!important;
      }

      body .status{
        display:none!important;
      }

      #${MOTTO_ID}{display:none}
      @media(min-width:560px){
        #${MOTTO_ID}{
          display:flex!important;
          align-items:center!important;
          gap:9px!important;
          margin-inline-start:auto!important;
          padding-top:6px!important;
          color:#c1cbd4!important;
          font-size:.72rem!important;
          line-height:1.55!important;
          white-space:pre-line!important;
        }
        #${MOTTO_ID} .td2-plane{
          width:52px!important;
          height:40px!important;
          display:grid!important;
          place-items:center!important;
          color:#9fc8e8!important;
          font-size:35px!important;
          filter:drop-shadow(0 8px 18px rgba(56,134,202,.26));
          transform:rotate(-15deg)!important;
        }
      }

      /* ========== Quick tools / search ========== */
      #tdHomeQuickTools{
        position:relative!important;
        z-index:12!important;
        width:100%!important;
        display:flex!important;
        align-items:stretch!important;
        gap:9px!important;
        margin:0 0 15px!important;
        padding:0!important;
      }

      body.mode-feed #tdHomeQuickTools,
      body.mode-explore #tdHomeQuickTools{
        direction:ltr!important;
        min-height:58px!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar,
      body.mode-feed #tdHomeQuickTools .searchbar.td-search-open,
      body.mode-explore #tdHomeQuickTools .searchbar,
      body.mode-explore #tdHomeQuickTools .searchbar.td-search-open{
        position:relative!important;
        inset:auto!important;
        flex:1 1 auto!important;
        width:auto!important;
        min-width:0!important;
        max-width:none!important;
        height:58px!important;
        min-height:58px!important;
        margin:0!important;
        padding:5px 6px!important;
        overflow:hidden!important;
        border:1px solid rgba(116,171,213,.34)!important;
        border-radius:18px!important;
        background:linear-gradient(135deg,rgba(15,31,49,.97),rgba(6,18,30,.99))!important;
        box-shadow:inset 0 1px rgba(255,255,255,.035),0 11px 30px rgba(0,0,0,.22)!important;
        transition:border-color .16s ease,box-shadow .16s ease!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar input,
      body.mode-feed #tdHomeQuickTools .searchbar.td-search-open input,
      body.mode-explore #tdHomeQuickTools .searchbar input,
      body.mode-explore #tdHomeQuickTools .searchbar.td-search-open input{
        position:static!important;
        inset:auto!important;
        width:100%!important;
        height:46px!important;
        min-height:46px!important;
        padding:0 50px 0 14px!important;
        direction:rtl!important;
        opacity:1!important;
        pointer-events:auto!important;
        color:#edf2f6!important;
        background:transparent!important;
        font-size:.9rem!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar input::placeholder,
      body.mode-explore #tdHomeQuickTools .searchbar input::placeholder{
        color:#8f9daa!important;
      }

      body.mode-feed #tdHomeQuickTools .searchbar .icon,
      body.mode-explore #tdHomeQuickTools .searchbar .icon{
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
        color:#b5c1cc!important;
        background:transparent!important;
        font-size:1.35rem!important;
      }

      #tdAddChannelProxy{
        flex:0 0 auto!important;
        border:1px solid rgba(110,209,255,.34)!important;
        color:#fff!important;
        background:linear-gradient(145deg,#27b5f6 0%,#1699eb 60%,#0f84dc 100%)!important;
        box-shadow:0 10px 26px rgba(19,157,235,.22),inset 0 1px rgba(255,255,255,.22)!important;
        font-weight:800!important;
      }

      body.mode-feed #tdAddChannelProxy,
      body.mode-explore #tdAddChannelProxy{
        min-width:136px!important;
        height:58px!important;
        min-height:58px!important;
        padding:0 19px!important;
        border-radius:18px!important;
        font-size:.84rem!important;
      }

      body:not(.mode-feed):not(.mode-explore) #tdHomeQuickTools{
        min-height:42px!important;
      }
      body:not(.mode-feed):not(.mode-explore) #tdAddChannelProxy{
        height:42px!important;
        min-height:42px!important;
        padding:0 14px!important;
        border-radius:14px!important;
        font-size:.74rem!important;
      }

      #addChannelCard{display:none!important}

      /* ========== Tabs ========== */
      body.mode-feed .tabs,
      body.mode-trending .tabs,
      body.mode-fresh .tabs{
        position:relative!important;
        z-index:11!important;
        min-height:56px!important;
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:10px!important;
        margin:0 0 16px!important;
        padding:0!important;
        overflow:visible!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        box-shadow:none!important;
      }

      body.mode-feed .tab,
      body.mode-trending .tab,
      body.mode-fresh .tab{
        min-width:0!important;
        min-height:54px!important;
        height:auto!important;
        padding:0 10px!important;
        border:1px solid rgba(130,162,188,.28)!important;
        border-radius:18px!important;
        color:#e0e6eb!important;
        background:linear-gradient(145deg,rgba(13,25,38,.93),rgba(7,16,26,.96))!important;
        box-shadow:inset 0 1px rgba(255,255,255,.025)!important;
        font-size:.86rem!important;
        font-weight:760!important;
      }

      body.mode-feed .tab.active,
      body.mode-trending .tab.active,
      body.mode-fresh .tab.active{
        border-color:#22b8ff!important;
        color:#fff!important;
        background:
          radial-gradient(120px 55px at 50% 110%,rgba(40,186,255,.34),transparent 70%),
          linear-gradient(145deg,#08243d,#0a365a)!important;
        box-shadow:var(--td2-glow)!important;
      }

      /* ========== Section headings ========== */
      body .head{
        position:relative!important;
        z-index:9!important;
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:12px!important;
        margin:0 4px 12px!important;
      }

      body .head h2{
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        margin:0!important;
        color:#fff!important;
        font-size:1.34rem!important;
        line-height:1.35!important;
        font-weight:900!important;
        letter-spacing:-.035em!important;
      }

      body .head h2::after{
        content:"✦"!important;
        width:auto!important;
        height:auto!important;
        margin:0!important;
        border:0!important;
        color:#2db9ff!important;
        background:none!important;
        box-shadow:none!important;
        font-size:1.12rem!important;
      }

      body .head span{
        display:inline-flex!important;
        align-items:center!important;
        color:#8997a4!important;
        font-size:.72rem!important;
      }

      body.mode-search .head h2::after{content:"⌕"!important}
      body.mode-saved .head h2::after{content:"♥"!important;color:#ff6d86!important}
      body.mode-history .head h2::after{content:"◷"!important;color:#69d5ff!important}
      body.mode-hub .head h2::after{content:"◎"!important;color:#69d5ff!important}
      body.mode-explore .head h2::after{content:"✦"!important}

      body.mode-explore .head{
        display:flex!important;
        margin-top:3px!important;
      }

      /* ========== Channel shelf ========== */
      #${SHELF_ID}{display:none}
      body.mode-feed #${SHELF_ID}{
        display:block!important;
        position:relative!important;
        z-index:10!important;
        margin:0 0 22px!important;
        padding:12px 12px 13px!important;
        overflow:hidden!important;
        border:1px solid rgba(115,153,185,.20)!important;
        border-radius:20px!important;
        background:linear-gradient(145deg,rgba(9,20,31,.98),rgba(5,14,23,.99))!important;
        box-shadow:var(--td2-shadow)!important;
      }

      #${SHELF_ID} .td2-shelf-head{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:12px!important;
        margin:0 2px 10px!important;
      }
      #${SHELF_ID} .td2-shelf-head strong{
        color:#f4f6f8!important;
        font-size:.91rem!important;
        font-weight:850!important;
      }
      #${SHELF_ID} .td2-shelf-head button{
        min-height:30px!important;
        padding:0 6px!important;
        border:0!important;
        color:#9ca8b3!important;
        background:transparent!important;
        font-size:.71rem!important;
      }

      body.mode-feed #v6CreatorRail{
        width:100%!important;
        display:grid!important;
        grid-template-columns:repeat(4,minmax(0,1fr))!important;
        gap:8px!important;
        margin:0!important;
        padding:0!important;
        overflow:visible!important;
      }

      body.mode-feed #v6CreatorRail .v6-creator-card{
        min-width:0!important;
        min-height:151px!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        padding:10px 7px 9px!important;
        border:1px solid rgba(123,160,189,.18)!important;
        border-radius:16px!important;
        background:linear-gradient(145deg,#0d1a27,#07111b)!important;
        box-shadow:inset 0 1px rgba(255,255,255,.02)!important;
      }
      body.mode-feed #v6CreatorRail .v6-creator-card img,
      body.mode-feed #v6CreatorRail .v6-creator-avatar-fallback{
        width:61px!important;
        height:61px!important;
        flex:0 0 61px!important;
        border:1px solid rgba(255,255,255,.23)!important;
        border-radius:16px!important;
        object-fit:cover!important;
        background:#172431!important;
        box-shadow:0 8px 20px rgba(0,0,0,.20)!important;
      }
      body.mode-feed #v6CreatorRail .v6-creator-card strong{
        width:100%!important;
        margin-top:8px!important;
        overflow:hidden!important;
        color:#fff!important;
        font-size:.76rem!important;
        line-height:1.25!important;
        font-weight:800!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }
      body.mode-feed #v6CreatorRail .v6-creator-card small{
        width:100%!important;
        margin-top:3px!important;
        overflow:hidden!important;
        color:#82919f!important;
        font-size:.65rem!important;
        line-height:1.25!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
        direction:ltr!important;
      }
      body.mode-feed #v6CreatorRail .v6-creator-card button{
        width:100%!important;
        min-height:32px!important;
        margin-top:auto!important;
        border:0!important;
        border-radius:11px!important;
        color:#fff!important;
        background:linear-gradient(145deg,#218fd9,#126db5)!important;
        font-size:.68rem!important;
        font-weight:780!important;
      }

      /* ========== Shared card system ========== */
      body #grid{
        position:relative!important;
        z-index:8!important;
      }

      body.mode-feed #grid,
      body.mode-explore #grid{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        grid-auto-flow:row!important;
        gap:12px!important;
        align-items:stretch!important;
      }

      body.mode-feed #grid .card,
      body.mode-explore #grid .card,
      body.mode-saved #grid .card,
      body.mode-history #grid .card,
      body.mode-trending #grid .card,
      body.mode-fresh #grid .card,
      body.mode-search #grid .card{
        position:relative!important;
        min-width:0!important;
        height:auto!important;
        overflow:hidden!important;
        border:1px solid rgba(121,161,191,.23)!important;
        border-radius:var(--td2-radius)!important;
        color:#fff!important;
        background:linear-gradient(150deg,var(--td2-card),var(--td2-card-2))!important;
        box-shadow:var(--td2-shadow)!important;
        transform:none!important;
      }
      body #grid .card::before,
      body #grid .card::after{display:none!important}
      body.mode-feed #grid .card.hero,
      body.mode-feed #grid .card.wide,
      body.mode-explore #grid .card.hero,
      body.mode-explore #grid .card.wide{
        grid-column:auto!important;
      }

      /* Critical: media first, text second — matching approved reference. */
      body #grid .media-card{
        display:flex!important;
        flex-direction:column!important;
      }
      body #grid .media-card .mediaStage,
      body #grid .media-card .v6-auto-media-stage,
      body #grid .media-card .td-media-stage{
        order:0!important;
      }
      body #grid .media-card .copy{
        order:1!important;
      }
      body #grid .media-card .v6-card-actions{
        order:2!important;
      }

      body.mode-feed #grid .mediaStage,
      body.mode-feed #grid .v6-auto-media-stage,
      body.mode-feed #grid .td-media-stage,
      body.mode-explore #grid .mediaStage,
      body.mode-explore #grid .v6-auto-media-stage,
      body.mode-explore #grid .td-media-stage{
        width:100%!important;
        aspect-ratio:16/9!important;
        min-height:0!important;
        overflow:hidden!important;
        border:0!important;
        border-radius:0!important;
        background:#09131d!important;
      }

      body #grid .mediaStage img,
      body #grid .mediaStage video,
      body #grid .v6-auto-media-stage img,
      body #grid .td-media-stage img,
      body #grid .td-media-stage video{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:center!important;
        filter:saturate(.92) contrast(1.03)!important;
      }

      body #grid .copy,
      body #grid .nativePreview{
        position:relative!important;
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        gap:8px!important;
        padding:11px 12px 12px!important;
        border:0!important;
        border-top:1px solid rgba(120,158,186,.13)!important;
        background:linear-gradient(180deg,#09141f 0%,#071019 100%)!important;
      }

      body #grid .nativeHead,
      body #grid .channel{
        min-width:0!important;
        display:flex!important;
        align-items:center!important;
        gap:8px!important;
        margin:0!important;
        padding-inline-end:34px!important;
        color:#f3f5f7!important;
      }

      body #grid .avatar,
      body #grid .nativeAvatar{
        width:36px!important;
        height:36px!important;
        flex:0 0 36px!important;
        overflow:hidden!important;
        border:1px solid rgba(255,255,255,.24)!important;
        border-radius:12px!important;
        background:#e7edf2!important;
        box-shadow:none!important;
      }

      body #grid .nativeName,
      body #grid .channel>span:not(.avatar):not(.reason){
        min-width:0!important;
        overflow:hidden!important;
        color:#f5f7f9!important;
        font-size:.78rem!important;
        line-height:1.35!important;
        font-weight:820!important;
        text-overflow:ellipsis!important;
        white-space:nowrap!important;
      }

      body #grid .nativeMeta,
      body #grid .meta{
        color:#83919d!important;
        font-size:.66rem!important;
        line-height:1.4!important;
      }

      body #grid .nativeMessage,
      body #grid .title,
      body #grid .hero .nativeMessage,
      body #grid .hero .title{
        margin:0!important;
        padding:2px 0 4px!important;
        color:#edf1f4!important;
        font-size:.81rem!important;
        font-weight:470!important;
        line-height:1.84!important;
        display:-webkit-box!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:4!important;
        line-clamp:4!important;
        overflow:hidden!important;
      }

      body #grid .reason,
      body #grid .type,
      body #grid .freshness,
      body #grid .rank{display:none!important}

      body #grid .videoPlay{
        width:48px!important;
        height:48px!important;
        border:1px solid rgba(255,255,255,.76)!important;
        border-radius:50%!important;
        background:rgba(0,0,0,.48)!important;
        box-shadow:0 7px 18px rgba(0,0,0,.26)!important;
        backdrop-filter:blur(4px)!important;
      }

      /* Social-like footer while preserving actual Open/Save/Details semantics. */
      body #grid .v6-card-actions{
        position:relative!important;
        z-index:9!important;
        min-height:43px!important;
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        border-top:1px solid rgba(122,158,186,.12)!important;
        background:#06101a!important;
      }
      body #grid .v6-card-actions button{
        min-height:43px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:5px!important;
        padding:0 5px!important;
        border:0!important;
        border-inline-start:1px solid rgba(122,158,186,.10)!important;
        color:#a9b5bf!important;
        background:transparent!important;
        font-size:.66rem!important;
      }
      body #grid .v6-card-actions button:first-child{border-inline-start:0!important}
      body #grid .v6-card-actions b{
        color:#e5edf3!important;
        font-size:1.12rem!important;
        line-height:1!important;
        font-weight:500!important;
      }
      body #grid .v6-card-actions button[data-v6-save].saved b{color:#ff7289!important}

      body #grid .card>.save{
        z-index:12!important;
        top:10px!important;
        right:auto!important;
        left:10px!important;
        width:34px!important;
        min-width:34px!important;
        height:34px!important;
        min-height:34px!important;
        display:grid!important;
        place-items:center!important;
        border:1px solid rgba(255,255,255,.17)!important;
        border-radius:50%!important;
        color:#d4dce3!important;
        background:rgba(4,11,18,.58)!important;
        backdrop-filter:blur(8px)!important;
        font-size:1.2rem!important;
      }
      body #grid .card>.save.saved{color:#ff6f88!important;border-color:rgba(255,111,136,.34)!important}
      body #grid .media-card>.save{display:none!important}

      /* Real text-only posts receive a quote visual made from their own text. */
      body #grid .td2-quote-stage{
        position:relative!important;
        order:0!important;
        width:100%!important;
        aspect-ratio:16/9!important;
        display:flex!important;
        align-items:flex-end!important;
        padding:18px!important;
        overflow:hidden!important;
        border-bottom:1px solid rgba(120,158,186,.12)!important;
        background:
          radial-gradient(220px 140px at 15% 0%,rgba(69,162,225,.28),transparent 68%),
          radial-gradient(180px 140px at 100% 100%,rgba(70,87,165,.20),transparent 72%),
          linear-gradient(145deg,#102333,#07131f)!important;
      }
      body #grid .td2-quote-stage::before{
        content:"✦";
        position:absolute;
        top:16px;
        left:18px;
        color:rgba(105,215,255,.78);
        font-size:1.25rem;
      }
      body #grid .td2-quote-stage::after{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background:linear-gradient(180deg,transparent 12%,rgba(2,8,14,.08) 55%,rgba(2,8,14,.55) 100%);
      }
      body #grid .td2-quote-stage span{
        position:relative!important;
        z-index:1!important;
        max-width:90%!important;
        color:#f2f6f9!important;
        font-size:1rem!important;
        font-weight:760!important;
        line-height:1.7!important;
        display:-webkit-box!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:3!important;
        line-clamp:3!important;
        overflow:hidden!important;
        text-shadow:0 2px 10px rgba(0,0,0,.42)!important;
      }
      body #grid .td2-quote-card .nativePreview{
        order:1!important;
      }
      body #grid .td2-quote-card .nativeMessage{
        -webkit-line-clamp:3!important;
        line-clamp:3!important;
      }

      /* ========== Feed / Explore density ========== */
      body.mode-feed #grid .card,
      body.mode-explore #grid .card{
        min-height:310px!important;
      }

      body.mode-explore .tabs{display:none!important}
      body.mode-explore .globalSearchPanel{display:none!important}
      body.mode-explore #v6CreatorRail{display:none!important}

      /* ========== Saved / History / Trending / Fresh ========== */
      body.mode-saved #grid,
      body.mode-history #grid,
      body.mode-trending #grid,
      body.mode-fresh #grid{
        grid-template-columns:minmax(0,1fr)!important;
        gap:14px!important;
      }
      body.mode-saved #grid .card,
      body.mode-history #grid .card,
      body.mode-trending #grid .card,
      body.mode-fresh #grid .card{
        grid-column:1/-1!important;
        min-height:0!important;
      }
      body.mode-saved #grid .mediaStage,
      body.mode-saved #grid .v6-auto-media-stage,
      body.mode-saved #grid .td-media-stage,
      body.mode-history #grid .mediaStage,
      body.mode-history #grid .v6-auto-media-stage,
      body.mode-history #grid .td-media-stage,
      body.mode-trending #grid .mediaStage,
      body.mode-trending #grid .v6-auto-media-stage,
      body.mode-trending #grid .td-media-stage,
      body.mode-fresh #grid .mediaStage,
      body.mode-fresh #grid .v6-auto-media-stage,
      body.mode-fresh #grid .td-media-stage{
        aspect-ratio:16/9!important;
      }
      body.mode-saved .tabs,
      body.mode-history .tabs{display:none!important}

      /* ========== Search ========== */
      body.mode-search .tabs{display:none!important}
      body.mode-search .globalSearchPanel{
        display:grid!important;
        gap:11px!important;
        margin:0 0 14px!important;
        padding:14px!important;
        border:1px solid var(--td2-line)!important;
        border-radius:20px!important;
        background:
          radial-gradient(190px 120px at 100% 0,rgba(54,163,236,.15),transparent 72%),
          linear-gradient(145deg,#0a1927,#06111b)!important;
        box-shadow:var(--td2-shadow)!important;
      }
      body.mode-search .globalSearchGlyph{
        border-color:rgba(98,204,255,.22)!important;
        color:#dff6ff!important;
        background:linear-gradient(145deg,rgba(35,156,225,.30),rgba(84,97,184,.26))!important;
      }
      body.mode-search .searchFilter{
        min-height:38px!important;
        padding:0 11px!important;
        border:1px solid rgba(131,174,205,.14)!important;
        border-radius:999px!important;
        color:#b5c0ca!important;
        background:rgba(255,255,255,.018)!important;
      }
      body.mode-search .searchFilter.active{
        border-color:rgba(56,187,249,.40)!important;
        color:#fff!important;
        background:linear-gradient(145deg,rgba(35,151,222,.36),rgba(27,91,152,.34))!important;
      }
      body.mode-search #grid{
        grid-template-columns:minmax(0,1fr)!important;
        gap:11px!important;
      }
      body.mode-search #grid .card{grid-column:1/-1!important}
      body.mode-search .search-peer-card .nativePreview{
        min-height:145px!important;
        border:1px solid rgba(125,171,205,.12)!important;
        border-radius:18px!important;
        background:
          radial-gradient(210px 130px at 100% 0,rgba(84,181,240,.14),transparent 70%),
          linear-gradient(145deg,#0b1d2d,#07131f)!important;
      }
      body.mode-search .searchWelcome{
        border:1px solid rgba(125,171,205,.18)!important;
        border-radius:20px!important;
        color:#a9b4be!important;
        background:linear-gradient(145deg,#091723,#06101a)!important;
        box-shadow:var(--td2-shadow)!important;
      }

      /* ========== Hub / Me ========== */
      body.mode-hub .tabs,
      body.mode-hub .globalSearchPanel,
      body.mode-hub .searchbar,
      body.mode-history .globalSearchPanel{
        display:none!important;
      }
      body.mode-hub #grid,
      body.mode-history #grid{
        grid-template-columns:minmax(0,1fr)!important;
      }
      body.mode-hub #grid>* ,
      body.mode-history #grid>*{
        grid-column:1/-1!important;
        width:100%!important;
        min-width:0!important;
      }
      body.mode-hub .hub{
        display:grid!important;
        gap:13px!important;
      }
      body.mode-hub .hubHero,
      body.mode-hub .hubPanel,
      body.mode-hub .v6-hub-creator-entry,
      body.mode-hub #botOwnerAnalyticsV1{
        overflow:hidden!important;
        border:1px solid rgba(125,171,205,.18)!important;
        border-radius:20px!important;
        background:
          radial-gradient(220px 130px at 100% 0,rgba(38,141,215,.10),transparent 72%),
          linear-gradient(145deg,#0a1926,#07121d)!important;
        box-shadow:var(--td2-shadow)!important;
      }
      body.mode-hub .hubHero{
        position:relative!important;
        min-height:116px!important;
        padding:18px!important;
        gap:12px!important;
      }
      body.mode-hub .hubHero::after{
        content:"";
        position:absolute;
        width:150px;
        height:150px;
        top:-74px;
        left:-52px;
        border:1px solid rgba(82,199,255,.09);
        border-radius:50%;
        pointer-events:none;
      }
      body.mode-hub .hubAvatar{
        width:58px!important;
        height:58px!important;
        flex:0 0 58px!important;
        border:1px solid rgba(81,199,255,.20)!important;
        border-radius:18px!important;
        color:#72d9ff!important;
        background:linear-gradient(145deg,#0e2a40,#112035)!important;
        box-shadow:none!important;
        font-size:1.35rem!important;
      }
      body.mode-hub .hubIdentity b{font-size:1.02rem!important}
      body.mode-hub .hubIdentity span,
      body.mode-hub .hubHint{color:#8696a4!important}
      body.mode-hub .hubStats b{color:#65d2ff!important}
      body.mode-hub .hubQuick{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:9px!important;
      }
      body.mode-hub .hubQuick button,
      body.mode-hub .hubButton{
        min-height:54px!important;
        padding:9px 12px!important;
        border:1px solid rgba(125,171,205,.15)!important;
        border-radius:16px!important;
        color:#e7edf2!important;
        background:linear-gradient(145deg,#0a1722,#07121c)!important;
        box-shadow:none!important;
      }
      body.mode-hub .hubQuick button b{color:#67d2ff!important;font-size:1.05rem!important}
      body.mode-hub .hubPanel{padding:15px!important}
      body.mode-hub .hubPanelHead h3{font-size:.95rem!important}
      body.mode-hub .hubPanelHead button{
        border:1px solid rgba(85,189,241,.14)!important;
        border-radius:12px!important;
        color:#73d6ff!important;
        background:rgba(64,168,226,.07)!important;
      }
      body.mode-hub .hubRow{
        min-height:62px!important;
        padding:11px!important;
        border:1px solid rgba(125,171,205,.10)!important;
        border-radius:15px!important;
        background:rgba(255,255,255,.018)!important;
      }
      body.mode-hub .hubRowDot.unread{
        background:#56c8ff!important;
        box-shadow:0 0 12px rgba(86,200,255,.55)!important;
      }
      body.mode-hub .topicChip{
        min-height:38px!important;
        padding:0 12px!important;
        border:1px solid rgba(125,171,205,.16)!important;
        border-radius:999px!important;
        color:#aeb8c1!important;
        background:#07121c!important;
      }
      body.mode-hub .topicChip.selected{
        border-color:rgba(41,187,250,.44)!important;
        color:#fff!important;
        background:linear-gradient(145deg,#0d3a59,#0b273d)!important;
      }
      body.mode-hub .hubSave{
        color:#fff!important;
        border:0!important;
        background:linear-gradient(145deg,#22aaf0,#147bc7)!important;
      }

      body.mode-hub .v6-hub-creator-entry{
        display:grid!important;
        grid-template-columns:44px minmax(0,1fr) auto!important;
        align-items:center!important;
        gap:10px!important;
        padding:11px!important;
      }
      body.mode-hub .v6-hub-creator-entry i{
        width:44px!important;
        height:44px!important;
        display:grid!important;
        place-items:center!important;
        border:1px solid rgba(67,185,242,.16)!important;
        border-radius:14px!important;
        color:#66d4ff!important;
        background:#0b1a26!important;
      }
      body.mode-hub .v6-hub-creator-entry b{font-size:.86rem!important}
      body.mode-hub .v6-hub-creator-entry span{color:#7f8f9d!important;font-size:.68rem!important}
      body.mode-hub .v6-hub-creator-entry button{
        min-height:38px!important;
        padding:0 12px!important;
        border:0!important;
        border-radius:12px!important;
        color:#fff!important;
        background:linear-gradient(145deg,#25acf0,#1479c5)!important;
        font-size:.72rem!important;
      }

      /* Bot owner analytics — regular DOM panel. */
      body.mode-hub #botOwnerAnalyticsV1{
        margin-top:0!important;
        padding:14px!important;
      }
      body.mode-hub #botOwnerAnalyticsV1 .boa-icon{
        width:40px!important;
        height:40px!important;
        border:1px solid rgba(73,191,245,.16)!important;
        border-radius:13px!important;
        color:#67d4ff!important;
        background:#0a1a27!important;
      }
      body.mode-hub #botOwnerAnalyticsV1 .boa-badge{
        color:#54e2a5!important;
        background:rgba(55,217,154,.10)!important;
      }
      body.mode-hub #botOwnerAnalyticsV1 .boa-card{
        border:1px solid rgba(125,171,205,.12)!important;
        border-radius:14px!important;
        background:#07131d!important;
      }
      body.mode-hub #botOwnerAnalyticsV1 .boa-card.accent{
        border-color:rgba(61,190,244,.23)!important;
        background:#081823!important;
      }
      body.mode-hub #botOwnerAnalyticsV1 .boa-mini{
        border:1px solid rgba(125,171,205,.07)!important;
        border-radius:11px!important;
        background:#06111a!important;
      }

      /* ========== Viewer / post detail ========== */
      .back{
        background:rgba(0,4,8,.78)!important;
        backdrop-filter:blur(8px)!important;
      }
      .viewer{
        width:min(100%,760px)!important;
        color:#fff!important;
        background:
          radial-gradient(420px 250px at 92% -4%,rgba(37,126,201,.13),transparent 70%),
          linear-gradient(180deg,#020914,#02070d)!important;
      }
      .viewerMedia{
        width:calc(100% - 24px)!important;
        margin:0 auto!important;
        overflow:hidden!important;
        border:1px solid rgba(125,171,205,.20)!important;
        border-radius:24px!important;
        background:#05101a!important;
        box-shadow:0 22px 54px rgba(0,0,0,.38)!important;
      }
      .viewerBody{
        padding:18px 16px 30px!important;
      }
      .viewerChannel{
        gap:10px!important;
        margin-bottom:14px!important;
        color:#69d3ff!important;
      }
      .viewerChannel .avatar{
        width:44px!important;
        height:44px!important;
        flex:0 0 44px!important;
        border-radius:14px!important;
      }
      .viewerFollow{
        border-color:rgba(72,191,247,.24)!important;
        color:#dff7ff!important;
        background:#0b2132!important;
      }
      .viewer h3{
        color:#fff!important;
        font-size:1.08rem!important;
        line-height:1.85!important;
      }
      .desc{
        margin:10px 0 18px!important;
        color:#d7e0e7!important;
        font-size:.92rem!important;
        line-height:2!important;
      }
      .feedback button{
        min-height:42px!important;
        border:1px solid rgba(125,171,205,.14)!important;
        border-radius:13px!important;
        color:#9facb7!important;
        background:#07131d!important;
      }
      .actions{
        gap:9px!important;
        background:linear-gradient(transparent,#02070d 34%)!important;
      }
      .actions button{
        min-height:54px!important;
        border:1px solid rgba(125,171,205,.17)!important;
        border-radius:17px!important;
        color:#fff!important;
        background:#0a1926!important;
      }
      .actions .primary{
        border:0!important;
        background:linear-gradient(145deg,#27b3f4,#168fe0)!important;
        box-shadow:0 12px 28px rgba(19,157,235,.20)!important;
      }
      .close{
        border-color:rgba(255,255,255,.18)!important;
        background:rgba(4,12,20,.72)!important;
      }

      /* ========== Bottom navigation ========== */
      body > .nav{
        z-index:45!important;
        width:min(calc(100% - 14px),746px)!important;
        height:72px!important;
        min-height:72px!important;
        gap:2px!important;
        margin:5px auto var(--safe-b)!important;
        padding:5px 7px!important;
        border:1px solid rgba(116,151,181,.23)!important;
        border-radius:28px!important;
        background:rgba(2,8,14,.97)!important;
        box-shadow:0 18px 42px rgba(0,0,0,.44),inset 0 1px rgba(255,255,255,.03)!important;
        backdrop-filter:blur(18px)!important;
      }
      body > .nav button{
        min-width:0!important;
        min-height:58px!important;
        gap:4px!important;
        border-radius:18px!important;
        color:#a4afb8!important;
        background:transparent!important;
        font-size:.67rem!important;
      }
      body > .nav svg{
        width:26px!important;
        height:26px!important;
        stroke:#a7b1ba!important;
        stroke-width:1.85!important;
      }
      body > .nav button.active{
        color:#2eb8ff!important;
        background:transparent!important;
        box-shadow:none!important;
      }
      body > .nav button.active svg{
        stroke:#2eb8ff!important;
        filter:drop-shadow(0 0 7px rgba(46,184,255,.35));
      }
      body > .nav button.active::after{display:none!important}

      /* ========== Responsive ========== */
      @media(max-width:520px){
        body > .app{padding-right:10px!important;padding-left:10px!important}
        body .top h1{font-size:1.58rem!important}
        body.mode-feed #tdHomeQuickTools,
        body.mode-explore #tdHomeQuickTools{gap:8px!important}
        body.mode-feed #tdAddChannelProxy,
        body.mode-explore #tdAddChannelProxy{
          min-width:112px!important;
          padding:0 13px!important;
          font-size:.75rem!important;
        }
        body.mode-feed #v6CreatorRail{
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:6px!important;
        }
        body.mode-feed #v6CreatorRail .v6-creator-card{
          min-height:136px!important;
          padding:8px 5px 7px!important;
          border-radius:14px!important;
        }
        body.mode-feed #v6CreatorRail .v6-creator-card img,
        body.mode-feed #v6CreatorRail .v6-creator-avatar-fallback{
          width:50px!important;height:50px!important;flex-basis:50px!important;border-radius:14px!important;
        }
        body.mode-feed #v6CreatorRail .v6-creator-card strong{font-size:.68rem!important}
        body.mode-feed #v6CreatorRail .v6-creator-card small{font-size:.58rem!important}
        body.mode-feed #v6CreatorRail .v6-creator-card button{min-height:29px!important;font-size:.62rem!important}
        body.mode-feed #grid,
        body.mode-explore #grid{gap:9px!important}
        body.mode-feed #grid .card,
        body.mode-explore #grid .card{
          min-height:286px!important;
          border-radius:17px!important;
        }
        body #grid .copy,
        body #grid .nativePreview{padding:9px 10px 11px!important}
        body #grid .nativeMessage,
        body #grid .title,
        body #grid .hero .nativeMessage,
        body #grid .hero .title{
          font-size:.74rem!important;
          line-height:1.74!important;
        }
        body #grid .td2-quote-stage{padding:14px!important}
        body #grid .td2-quote-stage span{font-size:.87rem!important}
      }

      @media(max-width:370px){
        body.mode-feed #tdHomeQuickTools,
        body.mode-explore #tdHomeQuickTools{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) 104px!important;
        }
        body.mode-feed #tdAddChannelProxy,
        body.mode-explore #tdAddChannelProxy{
          min-width:0!important;width:104px!important;
        }
        body.mode-feed .tabs,
        body.mode-trending .tabs,
        body.mode-fresh .tabs{gap:6px!important}
        body.mode-feed .tab,
        body.mode-trending .tab,
        body.mode-fresh .tab{
          min-height:50px!important;
          padding:0 6px!important;
          font-size:.76rem!important;
        }
        body.mode-feed #grid,
        body.mode-explore #grid{gap:7px!important}
      }

      @media(max-width:330px){
        body.mode-feed #grid,
        body.mode-explore #grid{grid-template-columns:minmax(0,1fr)!important}
        body.mode-feed #v6CreatorRail{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }

      @media(prefers-reduced-motion:reduce){
        *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
      }
    `;

    document.head.appendChild(style);
  }

  function ensureMotto() {
    const top = q("body > .app > .top");
    if (!top || document.getElementById(MOTTO_ID)) return;

    const motto = document.createElement("div");
    motto.id = MOTTO_ID;
    motto.setAttribute("aria-hidden", "true");
    motto.innerHTML = `<span class="td2-plane">➤</span><span>کانال‌های بهتر\nدنیای بزرگ‌تر</span>`;
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
      head.className = "td2-shelf-head";
      head.innerHTML = `<strong>کانال‌های پیشنهادی</strong><button type="button" aria-expanded="false">همه را ببین ‹</button>`;

      head.querySelector("button")?.addEventListener("click", () => {
        const expanded = shelf.classList.toggle("td2-expanded");
        const button = head.querySelector("button");
        if (button) {
          button.setAttribute("aria-expanded", String(expanded));
          button.textContent = expanded ? "کمتر ›" : "همه را ببین ‹";
        }
      });

      rail.parentNode?.insertBefore(shelf, rail);
      shelf.appendChild(head);
      shelf.appendChild(rail);
    } else if (rail.parentElement !== shelf) {
      shelf.appendChild(rail);
    }

    return true;
  }

  function compactText(value, max = 86) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function decorateTextOnlyCards() {
    qa("#grid .card.native-card:not(.search-peer-card)").forEach((card, index) => {
      if (card.querySelector(".mediaStage,.v6-auto-media-stage,.td-media-stage,.td2-quote-stage")) return;

      const message = q(".nativeMessage,.title", card)?.textContent || "";
      const quote = compactText(message, 96);
      if (!quote) return;

      const stage = document.createElement("div");
      stage.className = "td2-quote-stage";
      stage.style.setProperty("--td2-q", String(index % 5));
      stage.innerHTML = `<span></span>`;
      stage.querySelector("span").textContent = quote;

      const first = card.firstElementChild;
      if (first) card.insertBefore(stage, first);
      else card.appendChild(stage);

      card.classList.add("td2-quote-card");
    });
  }

  function normalizeCopy() {
    const body = document.body;
    const search = document.getElementById("search");
    if (search) {
      if (body.classList.contains("mode-feed")) {
        search.placeholder = "کانال، موضوع یا کلمه کلیدی جستجو کن…";
      } else if (body.classList.contains("mode-explore")) {
        search.placeholder = "در اکسپلور جستجو کن…";
      }
    }

    const count = document.getElementById("count");
    if (body.classList.contains("mode-feed") && count) {
      const raw = count.textContent.trim();
      if (raw && raw !== "—" && !/محتوا/.test(raw)) count.textContent = `${raw} محتوا`;
    }
  }

  function modeName() {
    return [...document.body.classList].find(name => name.startsWith("mode-"))?.slice(5) || "feed";
  }

  function syncModeDataset() {
    document.documentElement.dataset.tdCinematicMode = modeName();
  }

  function setNavText(button, label) {
    if (!button) return;
    button.setAttribute("aria-label", label);
    const textNode = [...button.childNodes].find(
      node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    );
    if (textNode) textNode.textContent = `\n    ${label}\n  `;
  }

  function normalizeNavigationLabels() {
    setNavText(document.querySelector('[data-nav="feed"]'), "خانه");
    setNavText(document.querySelector('[data-nav="explore"]'), "کشف");
    setNavText(document.getElementById("focusSearch"), "جستجو");
    setNavText(document.getElementById("saved"), "علاقه‌مندی‌ها");
    setNavText(document.getElementById("hub"), "پروفایل");
  }

  function syncTelegramChrome() {
    const tg = window.Telegram?.WebApp;
    try { tg?.setHeaderColor?.("#02070d"); } catch {}
    try { tg?.setBackgroundColor?.("#02070d"); } catch {}
    try { tg?.setBottomBarColor?.("#02070d"); } catch {}
  }

  function patchCreatorShadow() {
    const host = document.getElementById("creatorCenterV6Root");
    const root = host?.shadowRoot;
    if (!root || root.getElementById(CREATOR_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = CREATOR_STYLE_ID;
    style.textContent = `
      .backdrop{background:rgba(1,6,10,.92)!important;backdrop-filter:blur(7px)!important}
      .sheet{color:#f5f8fb!important;background:linear-gradient(180deg,#03101a,#02070d)!important}
      .wrap{width:min(100%,760px)!important;padding:14px 11px 26px!important}
      .top{padding:4px 0 12px!important;background:rgba(2,7,13,.94)!important;backdrop-filter:blur(14px)!important}
      .logo{width:42px!important;height:42px!important;border-radius:14px!important;background:linear-gradient(145deg,#26b5f4,#147dc9)!important;box-shadow:0 9px 24px rgba(27,158,230,.22)!important}
      .title b{font-size:16px!important}.title span{color:#8494a2!important;font-size:9px!important}
      .close{border-color:rgba(125,171,205,.18)!important;border-radius:13px!important;background:#081722!important;color:#dce5eb!important}
      .creatorScope,.channelState,.section,.metric,.item{
        border-color:rgba(125,171,205,.15)!important;
        background:linear-gradient(145deg,#091823,#06111b)!important;
        box-shadow:inset 0 1px rgba(255,255,255,.02)!important;
      }
      .creatorScope,.section{border-radius:18px!important}
      .creatorOwnerAvatar{border:1px solid rgba(81,199,255,.22)!important;border-radius:14px!important;background:linear-gradient(145deg,#22b4f4,#1479c7)!important}
      select{border-color:rgba(125,171,205,.18)!important;border-radius:12px!important;color:#eaf0f4!important;background:#06121c!important}
      .metric{min-height:86px!important;border-radius:14px!important}
      .metric.accent{border-color:rgba(60,193,248,.25)!important;background:#081b28!important}
      .metric small{color:#8292a0!important}.metric strong{color:#f5f9fc!important}.metric .hint{color:#657887!important}
      .track{background:#0d2231!important}.bar{background:#25b5f3!important}.bar.orange{background:#ff8a5d!important}.bar.purple{background:#8e75ff!important}.bar.green{background:#38dc9b!important}
      .item{border-radius:13px!important}.mini div{background:#06101a!important;border:1px solid rgba(125,171,205,.07)!important}
      .foot button{border-radius:11px!important;background:linear-gradient(145deg,#26b1f1,#147bc8)!important}
      @media(min-width:560px){.sheet{border-color:rgba(125,171,205,.18)!important;background:linear-gradient(180deg,#03101a,#02070d)!important}}
    `;
    root.appendChild(style);
  }

  function apply() {
    syncModeDataset();
    normalizeNavigationLabels();
    syncTelegramChrome();
    ensureMotto();
    ensureShelf();
    normalizeCopy();
    decorateTextOnlyCards();
    patchCreatorShadow();
  }

  function scheduleApply() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  }

  function boot() {
    installStyle();
    apply();

    const bodyObserver = new MutationObserver(scheduleApply);
    bodyObserver.observe(document.body, { attributes:true, attributeFilter:["class"] });

    const grid = document.getElementById("grid");
    if (grid) {
      const gridObserver = new MutationObserver(scheduleApply);
      gridObserver.observe(grid, { childList:true });
    }

    const app = q("body > .app");
    if (app) {
      const appObserver = new MutationObserver(scheduleApply);
      appObserver.observe(app, { childList:true });
    }

    setTimeout(scheduleApply, 250);
    setTimeout(scheduleApply, 900);

    console.info(`Telegram Discovery cinematic UI ${VERSION}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  } else {
    boot();
  }
})();

/* =========================================================
 * Telegram Discovery — Cinematic UI System v2.2 final polish
 * No data fetching. Presentation/state hooks only.
 * ========================================================= */
(() => {
  "use strict";

  const STYLE_ID = "tdCinematicUiV22FinalStyle";
  const STATE_LAYER_ID = "tdCinematicStateV22";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* --- Reference-locked density / hierarchy --- */
      @media(max-width:559px){
        body > .app{padding-inline:12px!important;padding-bottom:82px!important}
        body .top{min-height:72px!important;padding:5px 3px 7px!important;align-items:flex-start!important}
        body .brand{gap:9px!important}
        body .mark{width:43px!important;height:43px!important;flex-basis:43px!important;font-size:20px!important}
        body .top h1{font-size:1.52rem!important;letter-spacing:-.035em!important}
        body .top .eyebrow{margin-top:5px!important;font-size:.75rem!important}

        body.mode-feed #tdHomeQuickTools,
        body.mode-explore #tdHomeQuickTools{min-height:48px!important;gap:8px!important;margin-bottom:9px!important}
        body.mode-feed #tdHomeQuickTools .searchbar,
        body.mode-explore #tdHomeQuickTools .searchbar{min-height:48px!important;border-radius:15px!important}
        body.mode-feed #tdHomeQuickTools #tdAddChannelProxy,
        body.mode-explore #tdHomeQuickTools #tdAddChannelProxy{min-width:116px!important;min-height:48px!important;border-radius:15px!important;font-size:.76rem!important}
        body.mode-feed .tabs{gap:7px!important;margin:0 0 10px!important}
        body.mode-feed .tabs button{min-height:44px!important;border-radius:15px!important;font-size:.78rem!important}

        #tdCinematicChannelShelfV2{padding:11px 10px 10px!important;border-radius:18px!important;margin-bottom:13px!important}
        #tdCinematicChannelShelfV2 .td2-shelf-head{margin:0 2px 8px!important}
        body.mode-feed #v6CreatorRail{display:flex!important;grid-template-columns:none!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important}
        body.mode-feed #v6CreatorRail::-webkit-scrollbar{display:none!important}
        body.mode-feed #v6CreatorRail .v6-creator-card{flex:1 0 0!important;min-width:79px!important;min-height:122px!important;padding:7px 5px 6px!important;border-radius:14px!important}
        body.mode-feed #v6CreatorRail .v6-creator-card img,
        body.mode-feed #v6CreatorRail .v6-creator-avatar-fallback{width:46px!important;height:46px!important;flex-basis:46px!important;border-radius:13px!important}
        body.mode-feed #v6CreatorRail .v6-creator-card strong{margin-top:6px!important;font-size:.68rem!important}
        body.mode-feed #v6CreatorRail .v6-creator-card small{font-size:.57rem!important}
        body.mode-feed #v6CreatorRail .v6-creator-card button{min-height:27px!important;border-radius:9px!important;font-size:.59rem!important}

        body.mode-feed .head{margin-top:12px!important;margin-bottom:8px!important}
        body.mode-feed .head h2{font-size:1.33rem!important}
        body.mode-feed .head #count{font-size:.66rem!important}

        body.mode-feed #grid,
        body.mode-explore #grid{gap:9px!important}
        body.mode-feed #grid .card,
        body.mode-explore #grid .card{border-radius:17px!important}
        body.mode-feed #grid .mediaStage,
        body.mode-feed #grid .v6-auto-media-stage,
        body.mode-feed #grid .td-media-stage,
        body.mode-feed #grid .td2-quote-stage,
        body.mode-explore #grid .mediaStage,
        body.mode-explore #grid .v6-auto-media-stage,
        body.mode-explore #grid .td-media-stage,
        body.mode-explore #grid .td2-quote-stage{aspect-ratio:1.8/1!important}
        body.mode-feed #grid .copy,
        body.mode-feed #grid .nativePreview{min-height:142px!important;padding:9px 10px 10px!important;gap:7px!important}
        body.mode-feed #grid .nativeMessage,
        body.mode-feed #grid .title{font-size:.74rem!important;line-height:1.82!important;-webkit-line-clamp:4!important;line-clamp:4!important}
        body.mode-feed #grid .avatar,
        body.mode-feed #grid .nativeAvatar{width:31px!important;height:31px!important;flex-basis:31px!important;border-radius:10px!important}
        body.mode-feed #grid .v6-card-actions{min-height:39px!important}
        body.mode-feed #grid .v6-card-actions button{min-height:39px!important;font-size:.59rem!important}
      }

      /* --- Media/content variants: renderer can add these classes without changing markup --- */
      body #grid .card.td-state-video .mediaStage::after,
      body #grid .card.td-state-video .v6-auto-media-stage::after,
      body #grid .card.td-state-video .td-media-stage::after{
        content:"▶"!important;position:absolute!important;inset:50% auto auto 50%!important;transform:translate(-50%,-50%)!important;
        width:46px!important;height:46px!important;display:grid!important;place-items:center!important;border:1px solid rgba(255,255,255,.65)!important;
        border-radius:50%!important;color:#fff!important;background:rgba(1,8,14,.48)!important;backdrop-filter:blur(6px)!important;z-index:5!important;font-size:17px!important;
      }
      body #grid .card.td-state-long .nativeMessage,
      body #grid .card.td-state-long .title{-webkit-line-clamp:6!important;line-clamp:6!important}
      body #grid .card.td-state-fallback .mediaStage,
      body #grid .card.td-state-fallback .v6-auto-media-stage,
      body #grid .card.td-state-fallback .td-media-stage{
        position:relative!important;background:radial-gradient(circle at 50% 40%,rgba(62,183,239,.11),transparent 28%),linear-gradient(145deg,#0d2030,#07131d)!important;
      }
      body #grid .card.td-state-fallback .mediaStage::before,
      body #grid .card.td-state-fallback .v6-auto-media-stage::before,
      body #grid .card.td-state-fallback .td-media-stage::before{
        content:"تصویر تلگرام"!important;position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;color:#8397a7!important;font-size:.72rem!important;z-index:4!important;
      }
      body #grid .card.td-state-loading{pointer-events:none!important}
      body #grid .card.td-state-loading .mediaStage,
      body #grid .card.td-state-loading .v6-auto-media-stage,
      body #grid .card.td-state-loading .td-media-stage,
      body #grid .card.td-state-loading .td2-quote-stage,
      body #grid .card.td-state-loading .copy>*{
        color:transparent!important;border-color:transparent!important;background:linear-gradient(100deg,#0b1925 18%,#10283a 38%,#0b1925 58%)!important;background-size:220% 100%!important;animation:td22Shimmer 1.25s linear infinite!important;
      }
      @keyframes td22Shimmer{to{background-position:-220% 0}}

      /* --- Whole-list loading / empty / error state API --- */
      #grid[data-td22-state]:not([data-td22-state="ready"]) > :not(#${STATE_LAYER_ID}){display:none!important}
      #${STATE_LAYER_ID}{grid-column:1/-1!important;min-height:265px!important;display:grid!important;place-items:center!important;padding:18px!important;border:1px solid rgba(126,169,200,.16)!important;border-radius:19px!important;background:radial-gradient(circle at 50% 8%,rgba(47,169,229,.08),transparent 34%),linear-gradient(145deg,#081722,#051019)!important;box-shadow:0 14px 30px rgba(0,0,0,.20)!important}
      #${STATE_LAYER_ID} .td22-state-message{max-width:310px!important;display:grid!important;justify-items:center!important;gap:9px!important;text-align:center!important}
      #${STATE_LAYER_ID} .td22-state-icon{width:48px!important;height:48px!important;display:grid!important;place-items:center!important;border:1px solid rgba(73,194,247,.17)!important;border-radius:15px!important;color:#66d2ff!important;background:#0d2537!important;font-size:21px!important}
      #${STATE_LAYER_ID} b{font-size:.92rem!important}
      #${STATE_LAYER_ID} p{margin:0!important;color:#8393a1!important;font-size:.73rem!important;line-height:1.9!important}
      #${STATE_LAYER_ID} button{min-height:36px!important;padding:0 14px!important;border:1px solid rgba(90,207,255,.25)!important;border-radius:11px!important;color:#fff!important;background:linear-gradient(145deg,#188fd0,#0d73b4)!important;font-family:inherit!important;font-size:.7rem!important}
      #${STATE_LAYER_ID}.loading .td22-state-message{width:100%!important;max-width:none!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      #${STATE_LAYER_ID}.loading i{display:block!important;min-height:170px!important;border-radius:16px!important;background:linear-gradient(100deg,#0a1824 18%,#10283a 38%,#0a1824 58%)!important;background-size:220% 100%!important;animation:td22Shimmer 1.25s linear infinite!important}

      /* --- Press/focus feedback, presentation only --- */
      body #grid .card.td22-pressed,
      body #v6CreatorRail .v6-creator-card.td22-pressed{transform:scale(.988)!important;border-color:rgba(64,190,245,.35)!important;box-shadow:0 8px 20px rgba(0,0,0,.23)!important}
      body #grid .card:focus-visible,
      body #v6CreatorRail .v6-creator-card:focus-visible,
      body .viewer button:focus-visible{outline:2px solid rgba(62,196,255,.72)!important;outline-offset:2px!important}

      /* --- Final Viewer / Post Detail pass --- */
      .back.show{background:rgba(0,4,9,.78)!important;backdrop-filter:blur(10px)!important}
      .viewer.show{border:1px solid rgba(126,176,210,.16)!important;background:radial-gradient(430px 220px at 94% -2%,rgba(37,137,207,.12),transparent 72%),linear-gradient(180deg,#061420,#02070d)!important;box-shadow:0 0 70px rgba(0,0,0,.48)!important}
      .viewerMedia{position:relative!important;min-height:245px!important;max-height:52dvh!important;border-radius:22px!important;background:radial-gradient(circle at 75% 25%,rgba(77,179,225,.16),transparent 26%),#07131d!important}
      .viewerMedia img,.viewerMedia video{object-fit:cover!important;object-position:center!important}
      .viewerMedia iframe{min-height:330px!important;background:#06111a!important}
      .viewerBody{padding:16px 16px calc(92px + env(safe-area-inset-bottom))!important}
      .viewerChannel{display:grid!important;grid-template-columns:44px minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important;color:#fff!important}
      .viewerChannel .avatar{width:44px!important;height:44px!important;flex-basis:44px!important;border-radius:14px!important}
      .viewerChannel #viewerChannel{font-size:.88rem!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      .viewerChannel .eyebrow{font-size:.68rem!important;color:#8494a2!important}
      .viewerFollow{min-height:34px!important;border-radius:11px!important;font-size:.68rem!important}
      .viewer h3{margin:17px 0 5px!important;font-size:1.08rem!important;line-height:1.7!important}
      .desc{margin:5px 0 16px!important;font-size:.88rem!important;line-height:2.05!important;color:#d5dee5!important;white-space:pre-wrap!important}
      .feedback{display:flex!important;gap:7px!important;overflow-x:auto!important;scrollbar-width:none!important;padding-top:12px!important;border-top:1px solid rgba(124,165,196,.10)!important}
      .feedback::-webkit-scrollbar{display:none!important}
      .feedback button{flex:0 0 auto!important;min-height:34px!important;padding:0 12px!important;border-radius:999px!important;font-size:.67rem!important}
      .actions{position:fixed!important;z-index:80!important;left:50%!important;bottom:0!important;transform:translateX(-50%)!important;width:min(100%,760px)!important;display:grid!important;grid-template-columns:minmax(0,1fr) 54px 54px!important;gap:8px!important;padding:10px 14px calc(11px + env(safe-area-inset-bottom))!important;background:linear-gradient(180deg,rgba(2,7,13,.12),#02070d 29%)!important;backdrop-filter:blur(16px)!important}
      .actions button{min-height:48px!important;border-radius:15px!important}
      .actions .primary{font-weight:820!important}
      @media(max-width:559px){
        .viewer{width:100%!important;border-radius:24px 24px 0 0!important}
        .viewerMedia{width:calc(100% - 20px)!important;margin:8px auto 0!important;min-height:220px!important;border-radius:19px!important}
        .viewerBody{padding-inline:13px!important}
        .actions{width:100%!important;padding-inline:11px!important;grid-template-columns:minmax(0,1fr) 49px 49px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function bindPress(root = document) {
    root.querySelectorAll("#grid .card, #v6CreatorRail .v6-creator-card").forEach((node) => {
      if (!(node instanceof HTMLElement) || node.dataset.td22Press === "1") return;
      node.dataset.td22Press = "1";
      if (!node.hasAttribute("tabindex")) node.tabIndex = 0;
      const clear = () => node.classList.remove("td22-pressed");
      node.addEventListener("pointerdown", () => node.classList.add("td22-pressed"));
      node.addEventListener("pointerup", clear);
      node.addEventListener("pointercancel", clear);
      node.addEventListener("pointerleave", clear);
      node.addEventListener("blur", clear);
    });
  }

  function setGridState(state = "ready", options = {}) {
    const grid = document.getElementById("grid");
    if (!grid) return;

    const old = document.getElementById(STATE_LAYER_ID);
    if (state === "ready") {
      grid.dataset.td22State = "ready";
      old?.remove();
      grid.removeAttribute("aria-busy");
      return;
    }

    const defaults = state === "error"
      ? { icon:"!", title:"بارگذاری انجام نشد", description:"اتصال را بررسی کن و دوباره تلاش کن.", retryLabel:"تلاش دوباره" }
      : { icon:"○", title:"فعلاً چیزی اینجا نیست", description:"وقتی محتوا برسد، همین‌جا نمایش داده می‌شود.", retryLabel:"تلاش دوباره" };

    grid.dataset.td22State = state;
    grid.setAttribute("aria-busy", state === "loading" ? "true" : "false");

    const layer = old || document.createElement("div");
    layer.id = STATE_LAYER_ID;
    layer.className = state;

    if (state === "loading") {
      layer.innerHTML = '<div class="td22-state-message"><i></i><i></i><i></i><i></i></div>';
    } else {
      const data = { ...defaults, ...options };
      layer.innerHTML = `
        <div class="td22-state-message">
          <span class="td22-state-icon">${String(data.icon || "○")}</span>
          <b>${String(data.title || "")}</b>
          <p>${String(data.description || "")}</p>
          ${state === "error" ? `<button type="button">${String(data.retryLabel || "تلاش دوباره")}</button>` : ""}
        </div>`;
      layer.querySelector("button")?.addEventListener("click", () => {
        grid.dispatchEvent(new CustomEvent("td:retry", { bubbles:true }));
      }, { once:true });
    }

    if (!old) grid.appendChild(layer);
  }

  window.TelegramDiscoveryVisualV22 = Object.freeze({ setGridState });

  function bootV22() {
    bindPress();
    const grid = document.getElementById("grid");
    if (grid) {
      const observer = new MutationObserver(() => requestAnimationFrame(() => bindPress(grid)));
      observer.observe(grid, { childList:true });
    }
    const rail = document.getElementById("v6CreatorRail");
    if (rail) {
      const observer = new MutationObserver(() => requestAnimationFrame(() => bindPress(rail)));
      observer.observe(rail, { childList:true });
    }
    console.info("Telegram Discovery cinematic UI v2.2 final polish");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootV22, { once:true });
  } else {
    bootV22();
  }
})();
