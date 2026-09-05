/*
 * Telegram Discovery — Creator Center v5 — Studio Depth
 * Dense / Deep / Premium creator analytics UI + host-app visual depth layer.
 * Keeps "Add Channel to Discovery" separate from Creator Center.
 * Compatible with current /api/creator/* routes and /api/add-channel.
 */
(() => {
  "use strict";

  const tg = window.Telegram?.WebApp || null;
  const CREATOR_API = "/api/creator";
  const ADD_CHANNEL_API = "/api/add-channel";

  const S = {
    channels: [],
    selectedChannelId: "",
    days: 30,
    dashboard: null,
    content: [],
    loading: false
  };

  const fmt = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const percent = v => {
    const n = num(v);
    const normalized = n > 1 ? n : n * 100;
    return `${normalized.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
  };

  function initData() {
    return tg?.initData || "";
  }

  async function request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    const data = initData();
    if (data) headers.set("x-telegram-init-data", data);

    const res = await fetch(url, { ...options, headers });
    const raw = await res.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; }
    catch { body = { error: raw || "پاسخ نامعتبر از سرور" }; }

    if (!res.ok || body?.ok === false) {
      const err = new Error(body?.error || body?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  const api = (path, options) => request(`${CREATOR_API}${path}`, options);

  function applyDiscoveryDepthV4() {
    if (document.getElementById("discoveryDepthV4")) return;

    const style = document.createElement("style");
    style.id = "discoveryDepthV4";
    style.textContent = `
      /* =========================================================
         TELEGRAM DISCOVERY — DEPTH v4
         Dense Instagram × Telegram visual layer.
         Visual only: preserves existing DOM, APIs and interactions.
      ========================================================= */

      :root{
        --bg:#050a12!important;
        --surface:#0a1420!important;
        --surface-strong:#0d1b2a!important;
        --surface-soft:#07101a!important;
        --text:#f5f8fb!important;
        --muted:#778b9f!important;
        --accent:#38a9f4!important;
        --cyan:#62d5ff!important;
        --violet:#866df2!important;
        --line:rgba(139,190,224,.115)!important;
        --line-strong:rgba(139,198,236,.22)!important;
        --shadow:0 10px 26px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.028)!important;
        --radius-card:18px!important;
        --radius-hero:21px!important;
        --nav-h:62px!important;
      }

      html{
        background:
          radial-gradient(620px 300px at 92% -8%,rgba(48,151,236,.17),transparent 68%),
          radial-gradient(520px 360px at -12% 70%,rgba(105,77,224,.10),transparent 72%),
          #050a12!important;
      }

      body{
        background:
          radial-gradient(500px 260px at 96% -4%,rgba(49,153,238,.12),transparent 72%),
          radial-gradient(420px 320px at -12% 72%,rgba(111,83,229,.08),transparent 74%),
          linear-gradient(180deg,#07101a 0%,#050a12 100%)!important;
      }

      body:before{
        opacity:.68!important;
        background-size:20px 20px!important;
      }

      body:after{
        content:"";
        position:fixed;
        inset:0;
        z-index:0;
        pointer-events:none;
        box-shadow:inset 0 0 110px rgba(0,0,0,.22);
      }

      .app{
        width:min(100%,700px)!important;
        padding:calc(var(--safe-t) + 2px) 10px 18px!important;
        scrollbar-width:none;
      }

      /* compact top identity */
      .top{
        min-height:50px!important;
        gap:9px!important;
        margin:0!important;
        padding:3px 1px 7px!important;
        background:linear-gradient(180deg,rgba(5,10,18,.97) 62%,rgba(5,10,18,.72) 82%,transparent)!important;
        backdrop-filter:blur(18px)!important;
      }

      .brand{gap:8px!important}
      .mark{
        width:40px!important;
        height:40px!important;
        flex-basis:40px!important;
        border-radius:14px!important;
        font-size:19px!important;
        box-shadow:0 9px 22px rgba(52,116,220,.25),inset 0 1px rgba(255,255,255,.24)!important;
      }
      h1{font-size:1.04rem!important;letter-spacing:-.018em!important}
      .eyebrow{margin-top:2px!important;font-size:.64rem!important;line-height:1.35!important}
      .status{
        min-height:32px!important;
        padding:0 9px!important;
        gap:5px!important;
        border-radius:999px!important;
        font-size:.61rem!important;
        background:rgba(11,26,41,.62)!important;
      }
      .status:before{width:6px!important;height:6px!important;flex-basis:6px!important}

      /* search is visually deep but vertically small */
      .searchbar{
        top:50px!important;
        min-height:44px!important;
        margin:0 0 9px!important;
        padding:3px 4px!important;
        border-radius:15px!important;
        background:
          linear-gradient(145deg,rgba(13,30,46,.93),rgba(7,18,29,.95))!important;
        box-shadow:
          0 9px 22px rgba(0,0,0,.23),
          inset 0 1px rgba(255,255,255,.035),
          inset 0 -1px rgba(0,0,0,.18)!important;
      }
      .searchbar input{
        min-height:36px!important;
        padding:0 10px!important;
        font-size:.78rem!important;
      }
      .icon{
        width:36px!important;
        min-width:36px!important;
        min-height:36px!important;
        border-radius:11px!important;
        font-size:1.05rem!important;
      }

      /* segmented discovery modes */
      .tabs{
        min-height:40px!important;
        gap:3px!important;
        margin-bottom:10px!important;
        padding:3px!important;
        border-radius:14px!important;
        background:rgba(3,11,19,.62)!important;
      }
      .tab{
        min-height:34px!important;
        border-radius:11px!important;
        padding:0 5px!important;
        font-size:.69rem!important;
      }
      .tab.active{
        background:
          radial-gradient(90px 48px at 50% 0,rgba(98,213,255,.12),transparent 72%),
          linear-gradient(145deg,rgba(42,151,225,.85),rgba(48,95,190,.80))!important;
        box-shadow:0 6px 14px rgba(33,117,199,.20),inset 0 1px rgba(255,255,255,.14)!important;
      }

      .head{
        margin:0 2px 7px!important;
        align-items:center!important;
      }
      .head h2{font-size:.94rem!important}
      .head h2:after{
        width:5px!important;height:5px!important;margin-inline-start:6px!important;
      }
      .head span{font-size:.61rem!important}

      /* feed: denser, layered, less vertical waste */
      .grid{
        gap:8px!important;
        padding-bottom:5px!important;
      }
      .card{
        border-radius:18px!important;
        border-color:rgba(135,189,224,.11)!important;
        background:
          linear-gradient(150deg,rgba(11,25,39,.98),rgba(6,16,27,.99))!important;
        box-shadow:
          0 9px 23px rgba(0,0,0,.29),
          inset 0 1px rgba(255,255,255,.026)!important;
      }
      .card:before{
        content:"";
        position:absolute;
        inset:0;
        z-index:2;
        border-radius:inherit;
        pointer-events:none;
        background:
          linear-gradient(135deg,rgba(255,255,255,.035),transparent 25%,transparent 74%,rgba(95,205,255,.018));
        mix-blend-mode:screen;
      }
      .card.hero{border-radius:21px!important}
      .mediaStage{aspect-ratio:1.28/1!important}
      .hero .mediaStage,.wide .mediaStage{aspect-ratio:16/8.6!important}
      .copy{
        padding:8px 9px 9px!important;
        border-top-color:rgba(135,190,224,.085)!important;
        background:
          linear-gradient(150deg,rgba(13,28,43,.98),rgba(7,18,29,.99))!important;
      }
      .hero .copy{padding:9px 11px 11px!important}
      .channel{
        gap:5px!important;
        margin-bottom:5px!important;
        font-size:.65rem!important;
      }
      .avatar,.nativeAvatar{
        width:27px!important;height:27px!important;flex-basis:27px!important;
        box-shadow:0 5px 12px rgba(0,0,0,.18)!important;
      }
      .hero .avatar{width:30px!important;height:30px!important;flex-basis:30px!important}
      .reason{
        padding:3px 6px!important;
        font-size:.55rem!important;
        border-radius:999px!important;
      }
      .title{
        font-size:.76rem!important;
        line-height:1.62!important;
        display:-webkit-box!important;
        overflow:hidden!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:4!important;
        line-clamp:4!important;
      }
      .hero .title{
        font-size:.88rem!important;
        line-height:1.68!important;
        -webkit-line-clamp:4!important;
        line-clamp:4!important;
      }
      .meta{
        gap:4px!important;
        margin-top:6px!important;
        font-size:.59rem!important;
      }
      .type,.freshness{
        top:7px!important;
        left:7px!important;
        min-height:23px!important;
        padding:0 7px!important;
        border-radius:8px!important;
        font-size:.56rem!important;
      }
      .mode-fresh .freshness{top:auto!important;bottom:7px!important;left:7px!important}
      .save{
        top:7px!important;
        right:7px!important;
        width:34px!important;
        height:34px!important;
        border-radius:11px!important;
        font-size:1rem!important;
      }
      .hero .save{top:8px!important;right:8px!important}

      .videoPlay{
        width:42px!important;height:42px!important;border-radius:13px!important;
      }
      .videoPlay:after{
        border-top-width:7px!important;border-bottom-width:7px!important;border-left-width:11px!important;
      }

      /* native telegram posts */
      .nativePreview{
        min-height:150px!important;
        gap:7px!important;
        padding:10px!important;
        background:
          radial-gradient(180px 110px at 0 0,rgba(255,255,255,.07),transparent 72%),
          radial-gradient(180px 120px at 100% 100%,rgba(96,84,232,.08),transparent 74%),
          linear-gradient(145deg,var(--g1,#153850),var(--g2,#0a1d2d))!important;
      }
      .hero .nativePreview{min-height:186px!important;padding:12px!important}
      .nativeHead{gap:7px!important;padding-inline-end:38px!important}
      .nativeName{font-size:.67rem!important}
      .nativeMeta{font-size:.55rem!important}
      .nativeMessage{
        padding:2px 0!important;
        font-size:.75rem!important;
        line-height:1.68!important;
        display:-webkit-box!important;
        overflow:hidden!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:6!important;
        line-clamp:6!important;
        white-space:pre-wrap!important;
      }
      .hero .nativeMessage{font-size:.84rem!important;-webkit-line-clamp:7!important;line-clamp:7!important}
      .nativeFoot{
        gap:6px!important;
        padding-top:7px!important;
        font-size:.57rem!important;
      }

      /* explore = compact visual discovery */
      .mode-explore .app{padding-right:7px!important;padding-left:7px!important}
      .mode-explore .grid{gap:6px!important}
      .mode-explore .card{border-radius:16px!important}
      .mode-explore .mediaStage{aspect-ratio:1/1!important}
      .mode-explore .hero .mediaStage,.mode-explore .wide .mediaStage{aspect-ratio:16/8.8!important}
      .mode-explore .copy{padding:7px 8px 8px!important}
      .mode-explore .title{font-size:.70rem!important;line-height:1.55!important}
      .mode-explore .hero .title{font-size:.81rem!important}
      .mode-explore .nativePreview{min-height:142px!important;padding:9px!important}
      .mode-explore .nativeMessage{font-size:.70rem!important;line-height:1.58!important}

      /* search results */
      .mode-search .globalSearchPanel{
        gap:8px!important;
        margin-bottom:9px!important;
        padding:9px!important;
        border-radius:16px!important;
        box-shadow:0 9px 23px rgba(0,0,0,.2),inset 0 1px rgba(255,255,255,.025)!important;
      }
      .globalSearchIntro{gap:8px!important}
      .globalSearchGlyph{
        width:34px!important;height:34px!important;flex-basis:34px!important;
        border-radius:11px!important;font-size:1rem!important;
      }
      .globalSearchCopy b{font-size:.76rem!important}
      .globalSearchCopy span{margin-top:2px!important;font-size:.61rem!important;line-height:1.45!important}
      .searchFilters{gap:5px!important}
      .searchFilter{
        min-height:31px!important;
        padding:0 8px!important;
        font-size:.62rem!important;
      }
      .searchFilter span{min-width:17px!important;padding:1px 5px!important;font-size:.53rem!important}

      /* Add Channel = tiny creator-economy CTA, not a hero block */
      .add-channel-card{
        min-height:40px!important;
        margin:0 0 8px!important;
        padding:6px 8px!important;
        gap:7px!important;
        border-radius:14px!important;
        border-color:rgba(112,193,238,.13)!important;
        background:
          radial-gradient(120px 70px at 100% 0,rgba(54,168,239,.12),transparent 72%),
          linear-gradient(145deg,rgba(12,31,47,.96),rgba(13,19,37,.97))!important;
        box-shadow:0 8px 20px rgba(0,0,0,.20),inset 0 1px rgba(255,255,255,.025)!important;
      }
      .add-channel-icon{
        width:31px!important;height:31px!important;border-radius:10px!important;font-size:13px!important;
        box-shadow:0 6px 15px rgba(52,113,220,.18)!important;
      }
      .add-channel-content{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        column-gap:7px!important;
        align-items:center!important;
      }
      .add-channel-content h3{
        grid-column:1!important;
        margin:0!important;
        font-size:10.5px!important;
        line-height:1.25!important;
      }
      .add-channel-content p{
        grid-column:1!important;
        margin:2px 0 0!important;
        font-size:7.8px!important;
        line-height:1.35!important;
        color:#748a9e!important;
      }
      .add-channel-content button{
        grid-column:2!important;
        grid-row:1/3!important;
        height:28px!important;
        min-height:28px!important;
        padding:0 9px!important;
        border-radius:9px!important;
        font-size:8px!important;
      }
      .add-channel-box{
        width:min(100%,380px)!important;
        padding:12px!important;
        border-radius:18px!important;
        background:
          radial-gradient(220px 100px at 100% 0,rgba(53,167,255,.10),transparent 70%),
          #081522!important;
      }
      .add-channel-box h3{font-size:13px!important;margin-bottom:9px!important}
      .add-channel-box input{height:39px!important;border-radius:11px!important;font-size:11px!important}
      .add-channel-actions{gap:7px!important;margin-top:9px!important}
      .add-channel-actions button{height:35px!important;border-radius:10px!important;font-size:10px!important}

      /* personal hub: smaller panels, stronger hierarchy */
      .hub{gap:8px!important}
      .hubHero,.hubPanel{
        border-radius:17px!important;
        box-shadow:0 9px 24px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.025)!important;
      }
      .hubHero{padding:11px!important}
      .hubAvatar{
        width:45px!important;height:45px!important;flex-basis:45px!important;border-radius:15px!important;
      }
      .hubQuick{gap:6px!important}
      .hubQuick button,.hubButton{
        min-height:40px!important;
        padding:6px 8px!important;
        border-radius:12px!important;
        font-size:.67rem!important;
      }
      .hubPanel{padding:10px!important}
      .hubPanelHead{margin-bottom:8px!important}
      .hubPanelHead h3{font-size:.78rem!important}
      .hubPanelHead button{min-height:31px!important;border-radius:9px!important;font-size:.62rem!important}
      .hubList{gap:6px!important}
      .hubRow{
        min-height:46px!important;
        padding:7px!important;
        border-radius:11px!important;
      }
      .hubRowCopy b{font-size:.69rem!important}
      .hubRowCopy span{margin-top:2px!important;font-size:.58rem!important}
      .topicPicker{gap:5px!important}
      .topicChip{min-height:33px!important;padding:0 9px!important;font-size:.62rem!important}
      .settingRow{min-height:40px!important;font-size:.68rem!important}

      .creatorMetricGrid{gap:6px!important}
      .creatorCard{
        gap:7px!important;
        padding:9px!important;
        border-radius:14px!important;
      }
      .creatorCardHead b{font-size:.72rem!important}
      .creatorCardHead button{
        min-height:31px!important;
        padding:0 8px!important;
        border-radius:9px!important;
        font-size:.60rem!important;
      }
      .creatorMetric{
        padding:8px 4px!important;
        border-radius:11px!important;
      }
      .creatorMetric b{font-size:.82rem!important}
      .creatorMetric span{font-size:.53rem!important}
      .claimForm{gap:5px!important;margin-top:7px!important}
      .claimForm input,.claimForm button{
        min-height:38px!important;
        border-radius:10px!important;
        font-size:.67rem!important;
      }

      /* bottom navigation */
      .nav{
        width:min(calc(100% - 14px),686px)!important;
        height:62px!important;
        min-height:62px!important;
        gap:2px!important;
        margin:5px auto max(var(--safe-b),6px)!important;
        padding:4px!important;
        border-radius:21px!important;
        background:
          linear-gradient(155deg,rgba(11,25,39,.97),rgba(6,16,27,.98))!important;
        box-shadow:0 13px 36px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.032)!important;
      }
      .nav button{
        min-height:52px!important;
        border-radius:16px!important;
        font-size:.54rem!important;
        gap:2px!important;
      }
      .nav svg{width:20px!important;height:20px!important;stroke-width:1.65!important}
      .nav button.active:after{width:16px!important}

      /* viewer / detail */
      .back{position:fixed!important;background:rgba(1,5,10,.78)!important;backdrop-filter:blur(9px)!important}
      .viewer{
        position:fixed!important;
        width:min(100%,700px)!important;
        background:
          radial-gradient(340px 200px at 100% 0,rgba(49,144,222,.09),transparent 72%),
          #050d16!important;
      }
      .viewerMedia{
        width:calc(100% - 16px)!important;
        border-radius:20px!important;
        box-shadow:0 15px 38px rgba(0,0,0,.42)!important;
      }
      .viewerBody{padding:12px 12px 22px!important}
      .viewer h3{font-size:.96rem!important}
      .desc{font-size:.78rem!important;line-height:1.82!important}
      .feedback button{min-height:36px!important;border-radius:11px!important;font-size:.64rem!important}
      .actions button{min-height:42px!important;border-radius:13px!important;font-size:.70rem!important}

      .toast{
        position:fixed!important;
        border-radius:12px!important;
        font-size:.68rem!important;
        box-shadow:0 10px 28px rgba(0,0,0,.34)!important;
      }

      @media(max-width:390px){
        .app{padding-right:8px!important;padding-left:8px!important}
        .grid{gap:7px!important}
        .status{padding:0 7px!important;font-size:.57rem!important}
        .mark{width:38px!important;height:38px!important;flex-basis:38px!important}
        .creatorMetricGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }

      @media(min-width:520px){
        .creatorMetricGrid{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      }

      @media(hover:hover){
        .card:hover{
          transform:translateY(-1px)!important;
          border-color:rgba(99,195,244,.22)!important;
          box-shadow:0 12px 28px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.035)!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function firstDefined(obj, keys, fallback = 0) {
    if (!obj || typeof obj !== "object") return fallback;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return fallback;
  }


  function applyStudioDepthV5() {
    if (document.getElementById("discoveryStudioDepthV5")) return;

    const style = document.createElement("style");
    style.id = "discoveryStudioDepthV5";
    style.textContent = `
      /* =========================================================
         TELEGRAM DISCOVERY — STUDIO DEPTH v5
         Dense, layered, premium mobile UI.
         Visual-only override: existing DOM/API behavior is preserved.
      ========================================================= */

      :root{
        --bg:#03070d!important;
        --surface:#09111b!important;
        --surface-strong:#0d1724!important;
        --surface-soft:#060d16!important;
        --text:#f7f9fc!important;
        --muted:#6f8296!important;
        --accent:#35b7ff!important;
        --cyan:#67ddff!important;
        --violet:#8b6fff!important;
        --success:#5be6a8!important;
        --line:rgba(135,191,228,.105)!important;
        --line-strong:rgba(135,203,241,.19)!important;
        --radius-card:16px!important;
        --radius-hero:19px!important;
        --nav-h:58px!important;
      }

      html,body{background:#03070d!important}
      body{
        isolation:isolate;
        background:
          radial-gradient(520px 260px at 96% -6%,rgba(52,166,244,.13),transparent 70%),
          radial-gradient(440px 280px at -12% 46%,rgba(116,83,237,.075),transparent 72%),
          linear-gradient(180deg,#050b13 0%,#03070d 100%)!important;
      }
      body:before{
        background-image:
          linear-gradient(rgba(255,255,255,.010) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.008) 1px,transparent 1px)!important;
        background-size:18px 18px!important;
        opacity:.45!important;
      }
      body:after{
        content:"";
        position:fixed;inset:0;pointer-events:none;z-index:0;
        background:
          linear-gradient(180deg,rgba(255,255,255,.008),transparent 14%),
          radial-gradient(70% 44% at 50% 120%,rgba(21,82,120,.11),transparent 72%);
        box-shadow:inset 0 0 130px rgba(0,0,0,.30);
      }

      .app{
        width:min(100%,700px)!important;
        padding:calc(var(--safe-t) + 1px) 8px 14px!important;
      }

      .top{
        min-height:46px!important;
        gap:7px!important;
        padding:2px 0 6px!important;
        background:
          linear-gradient(180deg,rgba(3,7,13,.985) 66%,rgba(3,7,13,.76) 84%,transparent)!important;
        backdrop-filter:blur(22px) saturate(120%)!important;
      }
      .brand{gap:7px!important}
      .mark{
        width:36px!important;height:36px!important;flex-basis:36px!important;
        border-radius:12px!important;font-size:17px!important;
        border:1px solid rgba(255,255,255,.12)!important;
        background:
          radial-gradient(circle at 30% 18%,rgba(255,255,255,.28),transparent 24%),
          linear-gradient(145deg,#2eaaff 0%,#6672f0 56%,#a55ee0 100%)!important;
        box-shadow:
          0 8px 18px rgba(49,117,231,.21),
          inset 0 1px 0 rgba(255,255,255,.24)!important;
      }
      h1{font-size:.98rem!important;letter-spacing:-.022em!important}
      .eyebrow{margin-top:1px!important;font-size:.58rem!important;line-height:1.25!important}
      .status{
        min-height:28px!important;padding:0 8px!important;gap:5px!important;
        font-size:.56rem!important;border-radius:10px!important;
        background:linear-gradient(145deg,rgba(11,25,39,.72),rgba(6,16,27,.70))!important;
        box-shadow:inset 0 1px rgba(255,255,255,.025)!important;
      }

      .searchbar{
        top:46px!important;
        min-height:40px!important;
        margin:0 0 7px!important;
        padding:2px 3px!important;
        border-radius:13px!important;
        border-color:rgba(121,190,230,.14)!important;
        background:
          linear-gradient(145deg,rgba(11,25,39,.96),rgba(6,16,27,.97))!important;
        box-shadow:
          0 8px 18px rgba(0,0,0,.24),
          inset 0 1px rgba(255,255,255,.035),
          inset 0 -1px rgba(0,0,0,.28)!important;
      }
      .searchbar:focus-within{
        border-color:rgba(83,196,255,.38)!important;
        box-shadow:
          0 0 0 2px rgba(53,183,255,.07),
          0 10px 24px rgba(0,0,0,.28)!important;
      }
      .searchbar input{
        min-height:34px!important;padding:0 9px!important;font-size:.72rem!important;
      }
      .icon{
        width:34px!important;min-width:34px!important;min-height:34px!important;
        border-radius:10px!important;font-size:.98rem!important;
        color:#70d4ff!important;background:rgba(53,157,216,.055)!important;
      }

      .tabs{
        min-height:36px!important;gap:2px!important;margin-bottom:8px!important;
        padding:2px!important;border-radius:12px!important;
        background:linear-gradient(145deg,rgba(5,14,23,.88),rgba(3,10,17,.9))!important;
        box-shadow:inset 0 1px rgba(255,255,255,.018)!important;
      }
      .tab{
        min-height:32px!important;padding:0 4px!important;border-radius:10px!important;
        font-size:.64rem!important;font-weight:680!important;
      }
      .tab.active{
        background:
          radial-gradient(86px 42px at 50% 0,rgba(103,221,255,.13),transparent 73%),
          linear-gradient(145deg,rgba(38,159,231,.88),rgba(55,94,188,.80))!important;
        box-shadow:
          0 5px 12px rgba(29,108,192,.18),
          inset 0 1px rgba(255,255,255,.12)!important;
      }

      .head{margin:0 1px 6px!important}
      .head h2{font-size:.86rem!important;font-weight:790!important;letter-spacing:-.015em!important}
      .head h2:after{width:4px!important;height:4px!important;margin-inline-start:5px!important}
      .head span{font-size:.56rem!important}

      .grid{gap:6px!important;padding-bottom:4px!important}
      .card{
        border-radius:16px!important;
        border-color:rgba(132,188,224,.095)!important;
        background:
          radial-gradient(120px 80px at 100% 0,rgba(67,174,236,.035),transparent 72%),
          linear-gradient(150deg,rgba(10,23,35,.98),rgba(5,14,23,.99))!important;
        box-shadow:
          0 7px 18px rgba(0,0,0,.28),
          0 1px 0 rgba(255,255,255,.012) inset,
          0 -1px 0 rgba(0,0,0,.25) inset!important;
      }
      .card:before{
        content:"";position:absolute;inset:0;z-index:1;pointer-events:none;border-radius:inherit;
        background:linear-gradient(135deg,rgba(255,255,255,.025),transparent 24%,transparent 74%,rgba(86,185,245,.018));
      }
      .card.hero{
        border-radius:19px!important;
        box-shadow:
          0 10px 26px rgba(0,0,0,.33),
          0 0 0 1px rgba(92,193,244,.025) inset!important;
      }

      .mediaStage{aspect-ratio:1/1!important}
      .hero .mediaStage,.wide .mediaStage{aspect-ratio:16/8.8!important}
      .mediaStage:after{
        content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
        background:
          linear-gradient(180deg,transparent 58%,rgba(3,8,14,.34)),
          linear-gradient(120deg,rgba(80,184,248,.025),transparent 35%);
      }
      .videoPlay{
        width:40px!important;height:40px!important;border-radius:13px!important;
        border-color:rgba(255,255,255,.18)!important;
        background:rgba(4,12,21,.66)!important;
        box-shadow:0 8px 20px rgba(0,0,0,.28)!important;
      }
      .videoPlay:after{
        border-top-width:7px!important;border-bottom-width:7px!important;border-left-width:11px!important;
      }

      .copy{
        padding:8px 9px 9px!important;
        border-top-color:rgba(136,190,224,.08)!important;
        background:
          linear-gradient(180deg,rgba(11,24,36,.98),rgba(5,14,23,.99))!important;
      }
      .hero .copy{padding:9px 10px 11px!important}
      .channel{
        gap:5px!important;margin-bottom:5px!important;
        color:#72d1ff!important;font-size:.64rem!important;
      }
      .avatar,.nativeAvatar{
        width:27px!important;height:27px!important;flex-basis:27px!important;
        border-color:rgba(255,255,255,.14)!important;
        box-shadow:0 4px 10px rgba(0,0,0,.18)!important;
      }
      .hero .avatar{width:30px!important;height:30px!important;flex-basis:30px!important}
      .reason{
        padding:3px 6px!important;border-radius:8px!important;font-size:.53rem!important;
        color:#9aacbd!important;background:rgba(255,255,255,.024)!important;
      }
      .title{
        font-size:.76rem!important;line-height:1.62!important;font-weight:750!important;
        letter-spacing:-.006em!important;
      }
      .hero .title{font-size:.86rem!important;line-height:1.7!important}
      .meta{gap:4px!important;margin-top:6px!important;font-size:.57rem!important}

      .save{
        top:7px!important;right:7px!important;width:34px!important;height:34px!important;
        border-radius:11px!important;font-size:1rem!important;
        background:rgba(3,10,17,.72)!important;
        box-shadow:0 6px 16px rgba(0,0,0,.26)!important;
      }
      .type,.freshness{
        top:7px!important;left:7px!important;min-height:22px!important;
        padding:0 7px!important;border-radius:8px!important;font-size:.54rem!important;
        background:rgba(3,10,17,.72)!important;
      }

      .nativePreview{
        min-height:148px!important;padding:10px!important;gap:6px!important;
        background:
          radial-gradient(150px 90px at 0 0,rgba(255,255,255,.075),transparent 70%),
          radial-gradient(160px 100px at 100% 100%,rgba(103,99,255,.07),transparent 72%),
          linear-gradient(145deg,var(--g1,#17374f),var(--g2,#0b1f31))!important;
      }
      .hero .nativePreview{min-height:180px!important;padding:12px!important}
      .nativeHead{gap:6px!important;padding-inline-end:38px!important}
      .nativeName{font-size:.66rem!important}
      .nativeMeta{margin-top:2px!important;font-size:.54rem!important}
      .nativeMessage{
        padding:2px 0!important;font-size:.74rem!important;line-height:1.66!important;font-weight:690!important;
      }
      .hero .nativeMessage{font-size:.84rem!important}
      .nativeFoot{
        gap:6px!important;padding-top:6px!important;font-size:.56rem!important;
        border-top-color:rgba(255,255,255,.075)!important;
      }

      .mode-explore .app{padding-right:6px!important;padding-left:6px!important}
      .mode-explore .grid{gap:5px!important}
      .mode-explore .card{border-radius:15px!important}
      .mode-explore .copy{padding:7px 8px 8px!important}
      .mode-explore .nativePreview{min-height:140px!important;padding:9px!important}
      .mode-explore .title{font-size:.70rem!important;line-height:1.58!important}
      .mode-explore .nativeMessage{font-size:.70rem!important;line-height:1.6!important}

      .globalSearchPanel{
        gap:7px!important;margin-bottom:8px!important;padding:9px!important;
        border-radius:16px!important;
        background:
          radial-gradient(150px 90px at 100% 0,rgba(59,176,244,.11),transparent 72%),
          linear-gradient(150deg,rgba(10,24,37,.98),rgba(5,14,23,.99))!important;
        box-shadow:0 8px 20px rgba(0,0,0,.22)!important;
      }
      .globalSearchIntro{gap:7px!important}
      .globalSearchGlyph{
        width:34px!important;height:34px!important;flex-basis:34px!important;border-radius:11px!important;font-size:1rem!important;
      }
      .globalSearchCopy b{font-size:.74rem!important}
      .globalSearchCopy span{margin-top:2px!important;font-size:.58rem!important;line-height:1.45!important}
      .searchFilters{gap:4px!important}
      .searchFilter{
        min-height:30px!important;padding:0 8px!important;border-radius:10px!important;font-size:.60rem!important;
      }
      .searchFilter span{min-width:17px!important;padding:1px 5px!important;font-size:.50rem!important}

      .add-channel-card{
        position:relative!important;overflow:hidden!important;
        min-height:38px!important;margin:0 0 7px!important;padding:6px 7px!important;
        border-radius:13px!important;
        border:1px solid rgba(112,194,239,.13)!important;
        background:
          radial-gradient(130px 70px at 100% 0,rgba(65,188,249,.08),transparent 72%),
          radial-gradient(120px 70px at 0 100%,rgba(130,87,244,.06),transparent 72%),
          linear-gradient(145deg,rgba(10,25,38,.97),rgba(7,16,29,.98))!important;
        box-shadow:0 6px 16px rgba(0,0,0,.20),inset 0 1px rgba(255,255,255,.02)!important;
      }
      .add-channel-card:before{
        content:"";position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(100deg,transparent 0 38%,rgba(93,214,255,.025) 50%,transparent 62%);
      }
      .add-channel-icon{
        width:30px!important;height:30px!important;border-radius:10px!important;font-size:13px!important;
        background:linear-gradient(145deg,rgba(42,168,233,.30),rgba(118,79,224,.28))!important;
      }
      .add-channel-content{
        display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
        column-gap:7px!important;align-items:center!important;
      }
      .add-channel-content h3{grid-column:1;margin:0!important;font-size:.69rem!important}
      .add-channel-content p{
        grid-column:1;margin:1px 0 0!important;color:#6f8498!important;font-size:.50rem!important;line-height:1.35!important;
      }
      .add-channel-content button{
        grid-column:2;grid-row:1/3;
        min-height:28px!important;height:28px!important;padding:0 8px!important;
        border-radius:9px!important;font-size:.55rem!important;
        background:linear-gradient(145deg,#249ee6,#565fe3)!important;
        box-shadow:0 5px 12px rgba(44,109,216,.18)!important;
      }

      .hub{gap:8px!important}
      .hubHero,.hubPanel{
        border-radius:16px!important;
        background:
          radial-gradient(160px 90px at 100% 0,rgba(54,165,235,.08),transparent 72%),
          linear-gradient(150deg,rgba(10,24,37,.98),rgba(5,14,23,.99))!important;
        box-shadow:0 8px 20px rgba(0,0,0,.20),inset 0 1px rgba(255,255,255,.02)!important;
      }
      .hubHero{padding:11px!important}
      .hubAvatar{width:44px!important;height:44px!important;flex-basis:44px!important;border-radius:14px!important}
      .hubPanel{padding:10px!important}
      .hubQuick{gap:5px!important}
      .hubQuick button,.hubButton{
        min-height:39px!important;padding:6px 8px!important;border-radius:12px!important;font-size:.64rem!important;
      }
      .hubRow{min-height:45px!important;padding:7px!important;border-radius:11px!important}
      .topicChip{min-height:31px!important;padding:0 9px!important;font-size:.61rem!important}

      .nav{
        width:min(calc(100% - 12px),686px)!important;
        height:58px!important;min-height:58px!important;
        gap:2px!important;margin:5px auto max(var(--safe-b),5px)!important;padding:4px!important;
        border-radius:20px!important;
        border-color:rgba(126,190,229,.13)!important;
        background:
          radial-gradient(220px 70px at 50% 110%,rgba(48,131,212,.08),transparent 72%),
          linear-gradient(155deg,rgba(9,21,34,.96),rgba(5,13,22,.975))!important;
        box-shadow:
          0 13px 32px rgba(0,0,0,.43),
          inset 0 1px rgba(255,255,255,.026)!important;
        backdrop-filter:blur(24px) saturate(120%)!important;
      }
      .nav button{
        min-height:50px!important;border-radius:15px!important;font-size:.54rem!important;gap:2px!important;
      }
      .nav svg{width:20px!important;height:20px!important;stroke-width:1.75!important}
      .nav button.active{
        background:
          radial-gradient(62px 34px at 50% 0,rgba(95,214,255,.11),transparent 74%),
          linear-gradient(145deg,rgba(31,135,211,.33),rgba(47,73,149,.27))!important;
      }
      .nav button.active:after{width:18px!important}

      .viewer{
        width:min(100%,700px)!important;
        background:
          radial-gradient(360px 220px at 100% 0,rgba(45,145,224,.08),transparent 72%),
          linear-gradient(180deg,#050d16,#03070d)!important;
      }
      .viewerMedia{
        width:calc(100% - 14px)!important;border-radius:19px!important;
        box-shadow:0 14px 36px rgba(0,0,0,.38)!important;
      }
      .viewerBody{padding:12px 12px 20px!important}
      .viewer h3{font-size:.93rem!important}
      .desc{font-size:.76rem!important;line-height:1.72!important}
      .feedback button{min-height:34px!important;border-radius:11px!important;font-size:.62rem!important}
      .actions button{min-height:40px!important;border-radius:13px!important;font-size:.70rem!important}

      @media(max-width:390px){
        .app{padding-right:7px!important;padding-left:7px!important}
        .grid{gap:5px!important}
        .mark{width:35px!important;height:35px!important;flex-basis:35px!important}
        .status{padding:0 7px!important}
        .nav{width:calc(100% - 10px)!important}
      }

      @media(min-width:680px){
        .mode-explore .grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }

      @media(hover:hover){
        .card:hover{
          transform:translateY(-1px)!important;
          border-color:rgba(105,200,248,.20)!important;
          box-shadow:
            0 10px 24px rgba(0,0,0,.30),
            inset 0 1px rgba(255,255,255,.026)!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeDashboard(raw) {
    const d = raw?.dashboard || raw?.data || raw?.analytics || raw?.summary || raw || {};
    const m = d?.metrics || d?.totals || d;

    return {
      title: firstDefined(d, ["title", "channel_title", "name"], ""),
      username: firstDefined(d, ["username", "channel_username"], ""),
      views: num(firstDefined(m, ["views", "impressions", "total_views"])),
      uniqueViewers: num(firstDefined(m, ["unique_viewers", "unique_views", "unique_users"])),
      telegramOpens: num(firstDefined(m, ["telegram_opens", "opens", "open_count"])),
      joinClicks: num(firstDefined(m, ["join_clicks", "clicks_telegram", "telegram_clicks", "clicks"])),
      telegramJoins: num(firstDefined(m, ["telegram_joins", "joins", "join_count"])),
      activeJoins: num(firstDefined(m, ["active_joins", "active_members", "current_joins"])),
      leaves: num(firstDefined(m, ["leaves", "leave_count"])),
      saves: num(firstDefined(m, ["saves", "save_count"])),
      botStarts: num(firstDefined(m, ["starts_bot", "bot_starts", "starts"])),
      conversion: firstDefined(m, ["join_conversion_rate", "join_rate", "conversion_rate", "conversion"], 0),
      ctr: firstDefined(m, ["ctr", "click_through_rate"], 0),
      range7: d?.last_7_days || d?.days_7 || d?.range_7d || null,
      range30: d?.last_30_days || d?.days_30 || d?.range_30d || null,
      raw
    };
  }

  function normalizeContent(raw) {
    const list =
      raw?.items ||
      raw?.content ||
      raw?.contents ||
      raw?.rows ||
      raw?.data ||
      [];
    if (!Array.isArray(list)) return [];
    return list.map(item => ({
      id: item.id || item.content_id || "",
      title: item.title || item.text || item.caption || "بدون عنوان",
      views: num(firstDefined(item, ["views", "impressions"])),
      unique: num(firstDefined(item, ["unique_viewers", "unique_views"])),
      opens: num(firstDefined(item, ["telegram_opens", "opens"])),
      clicks: num(firstDefined(item, ["join_clicks", "clicks_telegram", "clicks"])),
      joins: num(firstDefined(item, ["telegram_joins", "joins"])),
      active: num(firstDefined(item, ["active_joins"])),
      leaves: num(firstDefined(item, ["leaves"])),
      saves: num(firstDefined(item, ["saves"])),
      ctr: firstDefined(item, ["ctr"], 0),
      conversion: firstDefined(item, ["join_conversion_rate", "join_rate", "conversion_rate"], 0)
    }));
  }

  function normalizeChannels(raw) {
    const list = raw?.channels || raw?.items || raw?.data || [];
    if (!Array.isArray(list)) return [];
    return list.map(ch => ({
      id: ch.id || ch.creator_channel_id || ch.channel_id || "",
      title: ch.title || ch.name || ch.username || "کانال",
      username: ch.username || ch.channel_username || "",
      verified: !!(ch.verified || ch.ownership_verified),
      botAdmin: !!(ch.bot_admin || ch.is_bot_admin),
      tracking: ch.tracking_available ?? ch.is_bot_admin ?? false
    })).filter(ch => ch.id);
  }

  applyDiscoveryDepthV4();
  applyStudioDepthV5();

  const host = document.createElement("div");
  host.id = "creatorCenterV3Root";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      button,select{font:inherit}
      .fab{
        position:fixed;z-index:2147483000;left:12px;bottom:78px;
        height:38px;padding:0 13px;border-radius:14px;border:1px solid rgba(120,196,255,.24);
        display:flex;align-items:center;gap:7px;color:#eef8ff;cursor:pointer;
        background:linear-gradient(145deg,rgba(15,53,82,.96),rgba(48,34,96,.96));
        box-shadow:0 10px 28px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.05);
        font:750 11px/1 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif
      }
      .fab i{
        width:20px;height:20px;display:grid;place-items:center;border-radius:8px;
        background:linear-gradient(145deg,#29a7ec,#7b5df0);font-style:normal;font-size:11px
      }
      .backdrop{
        position:fixed;z-index:2147483001;inset:0;display:none;
        background:rgba(2,7,14,.74);backdrop-filter:blur(10px)
      }
      .backdrop.open{display:block}
      .sheet{
        position:absolute;inset:auto 0 0;max-height:91dvh;overflow:auto;
        direction:rtl;color:#eef5fb;background:
          radial-gradient(700px 240px at 95% -5%,rgba(36,142,221,.12),transparent 65%),
          radial-gradient(560px 220px at 15% 0,rgba(112,78,214,.10),transparent 65%),
          #07121e;
        border:1px solid rgba(129,182,222,.14);border-radius:24px 24px 0 0;
        box-shadow:0 -24px 70px rgba(0,0,0,.48);
        font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif
      }
      .wrap{width:min(100%,700px);margin:auto;padding:12px 10px 24px}
      .top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .title{display:flex;align-items:center;gap:9px}
      .logo{
        width:36px;height:36px;border-radius:13px;display:grid;place-items:center;
        background:linear-gradient(145deg,#289fe5,#6c5fe8);
        box-shadow:0 8px 20px rgba(61,120,220,.25);font-weight:900
      }
      .title b{display:block;font-size:15px;line-height:1.2}
      .title span{display:block;margin-top:3px;color:#8196a9;font-size:9px}
      .close{
        width:34px;height:34px;border-radius:12px;border:1px solid rgba(139,191,230,.14);
        color:#c9d7e2;background:#0d1e2d;cursor:pointer
      }
      .toolbar{
        display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-bottom:8px
      }
      .channels{
        display:flex;gap:6px;overflow:auto;padding:1px 1px 3px;scrollbar-width:none
      }
      .channels::-webkit-scrollbar{display:none}
      .chip{
        flex:0 0 auto;height:32px;padding:0 10px;border-radius:12px;
        border:1px solid rgba(130,187,226,.13);color:#9fb1c1;background:#0b1a28;cursor:pointer;
        font-size:10px;white-space:nowrap
      }
      .chip.active{color:#fff;border-color:rgba(71,181,244,.55);background:#102c43}
      .chip em{font-style:normal;color:#58dda6;margin-inline-start:4px;font-size:9px}
      select{
        height:32px;padding:0 8px;border-radius:11px;border:1px solid rgba(130,187,226,.13);
        color:#d9e4ec;background:#0b1a28;outline:0;font-size:10px
      }
      .status{
        display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:8px 9px;
        border:1px solid rgba(130,187,226,.11);border-radius:13px;background:rgba(255,255,255,.018)
      }
      .status .dot{width:7px;height:7px;border-radius:50%;background:#54dca0;box-shadow:0 0 14px rgba(84,220,160,.55)}
      .status b{font-size:10px}
      .status span{color:#7f94a7;font-size:9px;margin-inline-start:auto}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .metric{
        position:relative;overflow:hidden;min-height:74px;padding:10px;border-radius:15px;
        border:1px solid rgba(127,184,225,.11);
        background:linear-gradient(145deg,rgba(17,39,58,.86),rgba(8,24,37,.92));
        box-shadow:inset 0 1px rgba(255,255,255,.025)
      }
      .metric:after{
        content:"";position:absolute;width:70px;height:70px;left:-28px;top:-32px;border-radius:50%;
        background:rgba(73,155,226,.045)
      }
      .metric small{display:block;color:#7890a4;font-size:9px}
      .metric strong{display:block;margin-top:7px;font-size:20px;line-height:1;font-weight:850}
      .metric .hint{display:block;margin-top:6px;color:#6f8498;font-size:8px}
      .metric.primary{
        background:linear-gradient(145deg,rgba(23,62,91,.95),rgba(22,31,66,.92));
        border-color:rgba(76,177,240,.18)
      }
      .section{
        margin-top:8px;padding:9px;border-radius:16px;border:1px solid rgba(128,185,224,.10);
        background:rgba(255,255,255,.015)
      }
      .sectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
      .sectionHead b{font-size:11px}
      .sectionHead span{color:#788da1;font-size:8px}
      .list{display:grid;gap:6px}
      .item{
        padding:8px;border-radius:13px;border:1px solid rgba(128,185,224,.09);
        background:#081724
      }
      .itemTitle{font-size:10px;font-weight:700;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mini{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:6px}
      .mini div{padding:5px 3px;border-radius:8px;background:#0c1e2d;text-align:center;min-width:0}
      .mini span{display:block;color:#71879a;font-size:7px;white-space:nowrap}
      .mini b{display:block;margin-top:2px;font-size:9px;white-space:nowrap}
      .empty,.error,.loading{padding:18px;text-align:center;color:#8499ab;font-size:10px}
      .error{color:#ff91a2}
      .foot{
        display:flex;align-items:center;gap:6px;margin-top:8px;color:#71879a;font-size:8px
      }
      .foot button{
        margin-inline-start:auto;height:30px;padding:0 9px;border-radius:10px;
        border:1px solid rgba(125,187,228,.14);color:#cfe1ed;background:#102437;cursor:pointer;font-size:9px
      }
      @media(min-width:560px){
        .sheet{inset:4dvh max(12px,calc((100vw - 720px)/2)) auto;border-radius:24px;max-height:92dvh}
        .grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      }
    </style>

    <button class="fab" id="open" type="button"><i>↗</i> Creator Center</button>
    <div class="backdrop" id="backdrop">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Creator Center">
        <div class="wrap">
          <header class="top">
            <div class="title">
              <div class="logo">C</div>
              <div>
                <b>Creator Center</b>
                <span>رشد، عضویت و عملکرد محتوا</span>
              </div>
            </div>
            <button class="close" id="close" type="button">✕</button>
          </header>

          <div class="toolbar">
            <div class="channels" id="channels"></div>
            <select id="days">
              <option value="7">۷ روز</option>
              <option value="30" selected>۳۰ روز</option>
              <option value="90">۹۰ روز</option>
              <option value="365">۱ سال</option>
            </select>
          </div>

          <div id="body"><div class="loading">در حال دریافت اطلاعات…</div></div>
        </div>
      </section>
    </div>
  `;

  const creatorDepth = document.createElement("style");
  creatorDepth.textContent = `
    .fab{
      left:9px;bottom:69px;height:34px;padding:0 10px;border-radius:12px;
      border-color:rgba(112,197,244,.18);
      background:
        radial-gradient(70px 36px at 20% 0,rgba(101,214,255,.14),transparent 72%),
        linear-gradient(145deg,rgba(12,45,68,.97),rgba(39,29,82,.97));
      box-shadow:0 8px 22px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.04);
      font-size:9px;letter-spacing:.01em
    }
    .fab i{
      width:18px;height:18px;border-radius:6px;font-size:9px;
      box-shadow:0 5px 12px rgba(51,112,218,.22)
    }
    .backdrop{background:rgba(1,5,11,.78);backdrop-filter:blur(12px)}
    .sheet{
      max-height:89dvh;
      border-radius:20px 20px 0 0;
      border-color:rgba(124,187,227,.12);
      background:
        radial-gradient(460px 170px at 92% -4%,rgba(45,158,231,.10),transparent 68%),
        radial-gradient(360px 180px at 10% 0,rgba(111,79,226,.08),transparent 70%),
        linear-gradient(180deg,#07131f,#050d16);
      box-shadow:0 -18px 52px rgba(0,0,0,.50),inset 0 1px rgba(255,255,255,.025)
    }
    .wrap{width:min(100%,700px);padding:9px 8px 18px}
    .top{gap:7px;margin-bottom:7px}
    .title{gap:7px}
    .logo{
      width:31px;height:31px;border-radius:10px;font-size:12px;
      box-shadow:0 7px 17px rgba(52,115,221,.22)
    }
    .title b{font-size:12px}
    .title span{margin-top:2px;font-size:7px}
    .close{width:30px;height:30px;border-radius:9px;font-size:10px}
    .toolbar{gap:5px;margin-bottom:6px}
    .channels{gap:4px}
    .chip{
      height:28px;padding:0 8px;border-radius:9px;font-size:8px;
      background:linear-gradient(145deg,#0b1a28,#08131e)
    }
    .chip.active{
      border-color:rgba(74,190,248,.42);
      background:linear-gradient(145deg,rgba(18,53,79,.96),rgba(20,35,69,.96));
      box-shadow:inset 0 1px rgba(255,255,255,.025)
    }
    .chip em{font-size:7px}
    select{height:28px;padding:0 7px;border-radius:9px;font-size:8px}
    .status{
      gap:5px;margin-bottom:6px;padding:6px 7px;border-radius:10px;
      background:linear-gradient(145deg,rgba(255,255,255,.018),rgba(255,255,255,.008))
    }
    .status .dot{width:5px;height:5px}
    .status b{font-size:8px}
    .status span{font-size:7px}
    .grid{
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:5px
    }
    .metric{
      min-height:60px;padding:7px;border-radius:11px;
      border-color:rgba(126,187,226,.09);
      background:
        radial-gradient(70px 50px at 100% 0,rgba(75,174,236,.04),transparent 72%),
        linear-gradient(150deg,rgba(14,34,51,.92),rgba(7,20,31,.96));
      box-shadow:0 5px 14px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.018)
    }
    .metric:after{width:52px;height:52px;left:-23px;top:-25px}
    .metric small{font-size:7px;line-height:1.2}
    .metric strong{margin-top:5px;font-size:15px}
    .metric .hint{margin-top:4px;font-size:6px;line-height:1.2}
    .metric.primary{
      background:
        radial-gradient(90px 60px at 100% 0,rgba(70,193,249,.09),transparent 70%),
        linear-gradient(145deg,rgba(17,53,78,.95),rgba(20,27,60,.94))
    }
    .section{
      margin-top:6px;padding:7px;border-radius:12px;
      background:linear-gradient(145deg,rgba(255,255,255,.015),rgba(255,255,255,.006))
    }
    .sectionHead{gap:6px;margin-bottom:5px}
    .sectionHead b{font-size:9px}
    .sectionHead span{font-size:6px}
    .list{gap:4px}
    .item{
      padding:6px;border-radius:9px;
      background:linear-gradient(145deg,#081724,#07131e)
    }
    .itemTitle{font-size:8px;line-height:1.45}
    .mini{gap:3px;margin-top:4px}
    .mini div{padding:4px 2px;border-radius:6px;background:#0b1d2b}
    .mini span{font-size:5.5px}
    .mini b{font-size:7.5px}
    .empty,.error,.loading{padding:14px;font-size:8px}
    .foot{gap:4px;margin-top:6px;font-size:6.5px}
    .foot button{height:27px;padding:0 8px;border-radius:8px;font-size:7px}
    @media(max-width:359px){
      .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(min-width:560px){
      .sheet{
        inset:4dvh max(10px,calc((100vw - 710px)/2)) auto;
        border-radius:20px;
        max-height:90dvh
      }
    }
  `;
  root.appendChild(creatorDepth);

  const studioCreatorDepth = document.createElement("style");
  studioCreatorDepth.textContent = `
    .fab{
      left:7px;bottom:63px;height:31px;padding:0 8px;border-radius:10px;
      border-color:rgba(108,199,246,.15);
      background:
        radial-gradient(60px 30px at 10% 0,rgba(103,221,255,.11),transparent 70%),
        linear-gradient(145deg,rgba(10,39,59,.97),rgba(32,24,70,.98));
      box-shadow:0 7px 18px rgba(0,0,0,.36),inset 0 1px rgba(255,255,255,.035);
      font-size:8px
    }
    .fab i{width:16px;height:16px;border-radius:5px;font-size:8px}
    .sheet{
      max-height:88dvh;border-radius:18px 18px 0 0;
      background:
        radial-gradient(360px 130px at 94% -2%,rgba(48,166,236,.085),transparent 70%),
        radial-gradient(300px 140px at 6% 0,rgba(119,82,228,.06),transparent 72%),
        linear-gradient(180deg,#06111b,#030a11);
      box-shadow:0 -16px 44px rgba(0,0,0,.52),inset 0 1px rgba(255,255,255,.018)
    }
    .wrap{padding:8px 7px 15px}
    .top{margin-bottom:6px}
    .logo{width:28px;height:28px;border-radius:9px;font-size:11px}
    .title b{font-size:11px}
    .title span{font-size:6.5px}
    .close{width:28px;height:28px;border-radius:8px}
    .toolbar{gap:4px;margin-bottom:5px}
    .chip{height:26px;padding:0 7px;border-radius:8px;font-size:7.5px}
    select{height:26px;border-radius:8px;font-size:7.5px}
    .status{padding:5px 6px;border-radius:9px;margin-bottom:5px}
    .status b{font-size:7.5px}
    .status span{font-size:6.5px}
    .grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
    .metric{
      min-height:54px;padding:6px;border-radius:10px;
      background:
        radial-gradient(62px 42px at 100% 0,rgba(72,184,241,.05),transparent 72%),
        linear-gradient(150deg,rgba(12,31,47,.95),rgba(5,17,27,.98));
      box-shadow:0 4px 11px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.015)
    }
    .metric small{font-size:6.5px}
    .metric strong{font-size:14px;margin-top:4px}
    .metric .hint{font-size:5.5px;margin-top:3px}
    .metric.primary{
      border-color:rgba(78,198,251,.15);
      background:
        radial-gradient(72px 48px at 100% 0,rgba(86,204,255,.08),transparent 70%),
        linear-gradient(145deg,rgba(14,48,72,.97),rgba(18,24,53,.96))
    }
    .section{margin-top:5px;padding:6px;border-radius:10px}
    .sectionHead{margin-bottom:4px}
    .sectionHead b{font-size:8.5px}
    .sectionHead span{font-size:5.5px}
    .item{padding:5px;border-radius:8px}
    .itemTitle{font-size:7.5px}
    .mini{gap:2px;margin-top:3px}
    .mini div{padding:3px 2px;border-radius:5px}
    .mini span{font-size:5px}
    .mini b{font-size:7px}
    .foot{margin-top:5px;font-size:6px}
    .foot button{height:25px;border-radius:7px;font-size:6.5px}
    @media(max-width:340px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(min-width:560px){
      .sheet{inset:4dvh max(8px,calc((100vw - 704px)/2)) auto;border-radius:18px}
    }
  `;
  root.appendChild(studioCreatorDepth);


  const $ = id => root.getElementById(id);

  function renderChannels() {
    const el = $("channels");
    if (!S.channels.length) {
      el.innerHTML = `<span class="empty" style="padding:7px">کانالی ثبت نشده</span>`;
      return;
    }
    el.innerHTML = S.channels.map(ch => `
      <button class="chip ${ch.id === S.selectedChannelId ? "active" : ""}" data-id="${escapeHtml(ch.id)}" type="button">
        ${escapeHtml(ch.title || ch.username || "کانال")}
        ${ch.verified ? `<em>✓</em>` : ""}
      </button>
    `).join("");

    el.querySelectorAll("[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        S.selectedChannelId = btn.dataset.id || "";
        renderChannels();
        await loadSelected();
      });
    });
  }

  function metric(label, value, hint = "", primary = false) {
    return `
      <div class="metric ${primary ? "primary" : ""}">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
        ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ""}
      </div>
    `;
  }

  function render() {
    const body = $("body");
    const d = S.dashboard;
    if (!d) {
      body.innerHTML = `<div class="empty">برای مشاهده آمار، یک کانال را انتخاب کن.</div>`;
      return;
    }

    const ch = S.channels.find(x => x.id === S.selectedChannelId);
    const statusText = ch?.botAdmin
      ? "Tracking دقیق عضویت فعال"
      : "Discovery فعال؛ Tracking عضویت محدود";

    body.innerHTML = `
      <div class="status">
        <span class="dot"></span>
        <b>${escapeHtml(ch?.title || d.title || "کانال")}</b>
        ${ch?.username ? `<span>@${escapeHtml(ch.username)}</span>` : ""}
        <span>${escapeHtml(statusText)}</span>
      </div>

      <div class="grid">
        ${metric("Views", fmt.format(d.views), "نمایش محتوا", true)}
        ${metric("Unique Viewers", fmt.format(d.uniqueViewers), "کاربر یکتا")}
        ${metric("Telegram Opens", fmt.format(d.telegramOpens), "بازشدن تلگرام")}
        ${metric("Join Clicks", fmt.format(d.joinClicks), "کلیک مسیر عضویت")}
        ${metric("Telegram Joins", fmt.format(d.telegramJoins), "عضویت ثبت‌شده", true)}
        ${metric("Active Joins", fmt.format(d.activeJoins), "عضویت فعال")}
        ${metric("Leaves", fmt.format(d.leaves), "خروج")}
        ${metric("Join Conversion", percent(d.conversion), "Join / Click")}
      </div>

      <section class="section">
        <div class="sectionHead">
          <b>عملکرد محتوا</b>
          <span>${Number(S.days).toLocaleString("fa-IR")} روز اخیر</span>
        </div>
        <div class="list">
          ${S.content.length ? S.content.map(item => `
            <article class="item">
              <div class="itemTitle">${escapeHtml(item.title)}</div>
              <div class="mini">
                <div><span>Views</span><b>${fmt.format(item.views)}</b></div>
                <div><span>Unique</span><b>${fmt.format(item.unique)}</b></div>
                <div><span>Clicks</span><b>${fmt.format(item.clicks)}</b></div>
                <div><span>Joins</span><b>${fmt.format(item.joins)}</b></div>
                <div><span>Conv.</span><b>${percent(item.conversion)}</b></div>
              </div>
            </article>
          `).join("") : `<div class="empty">هنوز داده‌ای برای عملکرد محتوا ثبت نشده است.</div>`}
        </div>
      </section>

      <div class="foot">
        <span>${ch?.botAdmin ? "✓ Bot Admin" : "Bot Admin لازم برای Join Tracking دقیق"}</span>
        <button id="tracking" type="button" ${ch?.botAdmin ? "" : "disabled"}>ساخت Tracking Link</button>
      </div>
    `;

    root.getElementById("tracking")?.addEventListener("click", createTrackingLink);
  }

  async function loadChannels() {
    const raw = await api("/channels");
    S.channels = normalizeChannels(raw);
    if (!S.selectedChannelId || !S.channels.some(x => x.id === S.selectedChannelId)) {
      S.selectedChannelId = S.channels[0]?.id || "";
    }
    renderChannels();
  }

  async function loadDashboardForChannel() {
    const id = encodeURIComponent(S.selectedChannelId);
    const days = encodeURIComponent(S.days);

    // Prefer v3 dashboard route; fall back to analytics route for compatibility.
    try {
      const raw = await api(`/dashboard?channel_id=${id}&days=${days}`);
      return normalizeDashboard(raw);
    } catch (e) {
      const raw = await api(`/analytics?channel_id=${id}&days=${days}`);
      const candidates = raw?.channels || raw?.items || raw?.data || raw;
      const selected = Array.isArray(candidates)
        ? candidates.find(x => (x.channel_id || x.id || x.creator_channel_id) === S.selectedChannelId) || candidates[0] || {}
        : candidates;
      return normalizeDashboard(selected);
    }
  }

  async function loadContentForChannel() {
    const id = encodeURIComponent(S.selectedChannelId);
    const days = encodeURIComponent(S.days);
    try {
      const raw = await api(`/content?channel_id=${id}&days=${days}&limit=50`);
      return normalizeContent(raw);
    } catch {
      const raw = await api(`/content-performance?channel_id=${id}&days=${days}&limit=50`);
      return normalizeContent(raw);
    }
  }

  async function loadSelected() {
    if (!S.selectedChannelId) {
      S.dashboard = null;
      S.content = [];
      render();
      return;
    }

    $("body").innerHTML = `<div class="loading">در حال دریافت آمار…</div>`;
    try {
      const [dashboard, content] = await Promise.all([
        loadDashboardForChannel(),
        loadContentForChannel()
      ]);
      S.dashboard = dashboard;
      S.content = content;
      render();
    } catch (err) {
      $("body").innerHTML = `<div class="error">${escapeHtml(err?.message || String(err))}</div>`;
    }
  }

  async function refreshAll() {
    try {
      await loadChannels();
      await loadSelected();
    } catch (err) {
      $("body").innerHTML = `<div class="error">${escapeHtml(err?.message || String(err))}</div>`;
    }
  }

  async function createTrackingLink() {
    const ch = S.channels.find(x => x.id === S.selectedChannelId);
    if (!ch?.botAdmin) return;
    const btn = root.getElementById("tracking");
    if (!btn) return;

    btn.disabled = true;
    try {
      const raw = await api("/tracking-link", {
        method: "POST",
        body: JSON.stringify({
          channel_id: S.selectedChannelId,
          source: "creator_center_v3"
        })
      });
      const url = raw?.url || raw?.tracking_url || raw?.link || "";
      if (!url) throw new Error("لینک Tracking ساخته نشد.");

      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "کپی شد ✓";
      } catch {
        tg?.openTelegramLink?.(url);
        btn.textContent = "باز شد ✓";
      }
      setTimeout(() => { btn.textContent = "ساخت Tracking Link"; }, 1600);
    } catch (err) {
      btn.textContent = err?.message || "خطا";
      setTimeout(() => { btn.textContent = "ساخت Tracking Link"; }, 1800);
    } finally {
      btn.disabled = false;
    }
  }

  // Separate "Add Channel to Discovery" flow in the host page.
  function upgradeAddChannelFlow() {
    const style = document.createElement("style");
    style.id = "creatorV3HostPatch";
    style.textContent = `
      .add-channel-card{
        min-height:42px!important;margin:0 0 9px!important;padding:7px 9px!important;
        border-radius:15px!important;gap:8px!important;
        background:linear-gradient(145deg,rgba(13,35,53,.96),rgba(18,25,48,.96))!important;
        box-shadow:0 8px 24px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.025)!important
      }
      .add-channel-icon{
        width:34px!important;height:34px!important;border-radius:12px!important;font-size:15px!important
      }
      .add-channel-content h3{font-size:12px!important;margin:0 0 1px!important}
      .add-channel-content p{font-size:9px!important;line-height:1.4!important;margin:0!important;color:#7e94a7!important}
      .add-channel-content button{
        min-height:30px!important;height:30px!important;padding:0 10px!important;border-radius:10px!important;
        font-size:9px!important;white-space:nowrap!important
      }
      .add-channel-content{
        display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;column-gap:8px!important;align-items:center!important
      }
      .add-channel-content h3,.add-channel-content p{grid-column:1}
      .add-channel-content button{grid-column:2;grid-row:1/3}
      .add-channel-box{width:min(100%,390px)!important;padding:14px!important;border-radius:20px!important}
      .add-channel-box h3{font-size:14px!important}
      .add-channel-box input{height:42px!important;border-radius:12px!important;font-size:12px!important}
      .add-channel-actions button{height:38px!important;border-radius:12px!important;font-size:11px!important}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const openBtn = document.getElementById("openAddChannel");
    const closeBtn = document.getElementById("addChannelClose");
    const submit = document.getElementById("addChannelSubmit");
    const input = document.getElementById("addChannelInput");
    const msg = document.getElementById("addChannelMessage");
    const modal = document.getElementById("addChannelModal");

    if (!openBtn || !closeBtn || !submit || !input || !msg || !modal) return;

    // The legacy handler inside index.html is created before the modal HTML exists,
    // so it captures null references and breaks the Add Channel button.
    // Handle the whole modal lifecycle here in capture phase and block that legacy handler.
    openBtn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      modal.classList.add("open");
      requestAnimationFrame(() => input.focus());
    }, true);

    closeBtn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      modal.classList.remove("open");
    }, true);

    modal.addEventListener("click", ev => {
      if (ev.target === modal) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        modal.classList.remove("open");
      }
    }, true);

    submit.addEventListener("click", async ev => {
      // Block the old /api/creator/channel/add handler in index.html.
      ev.preventDefault();
      ev.stopImmediatePropagation();

      let channel = input.value.trim()
        .replace(/^https?:\/\/t\.me\//i, "")
        .replace(/^t\.me\//i, "")
        .replace(/^@/, "")
        .split(/[/?#]/)[0]
        .trim();

      if (!channel) {
        msg.textContent = "نام کاربری یا لینک کانال را وارد کن.";
        return;
      }

      submit.disabled = true;
      msg.textContent = "در حال بررسی و ثبت کانال…";

      try {
        const data = await request(ADD_CHANNEL_API, {
          method: "POST",
          body: JSON.stringify({
            username: channel,
            channel,
            channel_username: channel
          })
        });

        const botAdmin = !!(data?.bot_admin || data?.is_bot_admin);
        const verified = !!(data?.verified || data?.ownership_verified);

        msg.textContent = botAdmin
          ? "✓ کانال ثبت شد؛ Sync و Join Tracking دقیق فعال است."
          : verified
            ? "✓ کانال ثبت شد؛ برای Join Tracking دقیق، ربات را Admin کن."
            : "✓ کانال عمومی ثبت شد و Sync می‌شود؛ مالکیت هنوز تایید نشده است.";

        input.value = "";
        setTimeout(() => {
          modal?.classList.remove("open");
          msg.textContent = "";
        }, 2100);
      } catch (err) {
        msg.textContent = `✕ ${err?.message || "ثبت کانال انجام نشد."}`;
      } finally {
        submit.disabled = false;
      }
    }, true);
  }

  $("open").addEventListener("click", async () => {
    $("backdrop").classList.add("open");
    tg?.expand?.();
    await refreshAll();
  });

  $("close").addEventListener("click", () => $("backdrop").classList.remove("open"));
  $("backdrop").addEventListener("click", e => {
    if (e.target === $("backdrop")) $("backdrop").classList.remove("open");
  });

  $("days").addEventListener("change", async e => {
    S.days = Number(e.target.value || 30);
    await loadSelected();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", upgradeAddChannelFlow, { once: true });
  } else {
    upgradeAddChannelFlow();
  }

  tg?.ready?.();
})();
