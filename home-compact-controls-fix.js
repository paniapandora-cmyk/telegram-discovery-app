/*
 * Telegram Discovery — Home Compact Controls + Save Position Fix
 *
 * Load AFTER creator-growth-ui.js.
 * - Moves save/heart away from the channel avatar.
 * - Collapses search to a single icon until needed.
 * - Turns Add Channel into a compact standalone button.
 * - Keeps Feed / Explore / Creator Center data logic untouched.
 */
(() => {
  "use strict";

  const STYLE_ID = "tdHomeCompactControlsStyle";
  const TOOLBAR_ID = "tdHomeQuickTools";

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* ---------------------------------------------------------
         1) Save / heart button — never sit on channel avatar
      ---------------------------------------------------------- */
      #grid .card .save{
        top:8px!important;
        left:8px!important;
        right:auto!important;
        width:30px!important;
        height:30px!important;
        min-width:30px!important;
        min-height:30px!important;
        margin:0!important;
        z-index:12!important;
      }

      /* Keep card header/avatar side clean on compact 2-col feed. */
      body.mode-feed #grid .channel,
      body.mode-feed #grid .nativeHead{
        padding-left:38px!important;
        padding-right:0!important;
      }

      /* ---------------------------------------------------------
         2) Compact utility row
         Search icon on one side, Add Channel on the other.
      ---------------------------------------------------------- */
      #${TOOLBAR_ID}{
        display:flex!important;
        align-items:center!important;
        justify-content:space-between!important;
        gap:8px!important;
        width:100%!important;
        min-height:40px!important;
        margin:0 0 8px!important;
        padding:0 1px!important;
      }

      #${TOOLBAR_ID} .searchbar{
        position:relative!important;
        inset:auto!important;
        top:auto!important;
        left:auto!important;
        right:auto!important;
        width:38px!important;
        min-width:38px!important;
        max-width:38px!important;
        height:38px!important;
        min-height:38px!important;
        margin:0!important;
        padding:1px!important;
        border:1px solid #343434!important;
        border-radius:12px!important;
        background:#161616!important;
        overflow:hidden!important;
        box-shadow:none!important;
        transition:
          width .18s ease,
          max-width .18s ease,
          border-color .18s ease!important;
        z-index:20!important;
      }

      #${TOOLBAR_ID} .searchbar input{
        position:absolute!important;
        inset:1px 38px 1px 1px!important;
        width:calc(100% - 42px)!important;
        height:34px!important;
        min-height:34px!important;
        padding:0 10px!important;
        opacity:0!important;
        pointer-events:none!important;
        color:#F5F5F5!important;
        background:transparent!important;
        transition:opacity .12s ease!important;
      }

      #${TOOLBAR_ID} .searchbar .icon{
        position:absolute!important;
        top:1px!important;
        right:1px!important;
        left:auto!important;
        width:34px!important;
        min-width:34px!important;
        height:34px!important;
        min-height:34px!important;
        margin:0!important;
        border-radius:10px!important;
        display:grid!important;
        place-items:center!important;
        color:#C8C8C8!important;
        background:transparent!important;
        z-index:3!important;
      }

      #${TOOLBAR_ID} .searchbar.td-search-open{
        width:min(78vw,390px)!important;
        max-width:min(78vw,390px)!important;
        border-color:#454545!important;
        background:#202020!important;
      }

      #${TOOLBAR_ID} .searchbar.td-search-open input{
        opacity:1!important;
        pointer-events:auto!important;
      }

      /* ---------------------------------------------------------
         3) Add Channel becomes only one compact button
      ---------------------------------------------------------- */
      #${TOOLBAR_ID} #addChannelCard{
        display:flex!important;
        align-items:center!important;
        justify-content:flex-end!important;
        width:auto!important;
        min-width:0!important;
        min-height:38px!important;
        height:38px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
      }

      #${TOOLBAR_ID} #addChannelCard .add-channel-icon,
      #${TOOLBAR_ID} #addChannelCard h3,
      #${TOOLBAR_ID} #addChannelCard p{
        display:none!important;
      }

      #${TOOLBAR_ID} #addChannelCard .add-channel-content{
        display:block!important;
        width:auto!important;
        min-width:0!important;
        margin:0!important;
        padding:0!important;
      }

      #${TOOLBAR_ID} #addChannelCard #openAddChannel{
        position:static!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:auto!important;
        min-width:0!important;
        height:38px!important;
        min-height:38px!important;
        margin:0!important;
        padding:0 13px!important;
        border:0!important;
        border-radius:12px!important;
        background:#2AABEE!important;
        color:#fff!important;
        font-size:9px!important;
        font-weight:750!important;
        white-space:nowrap!important;
        box-shadow:none!important;
      }

      /* The old large Add Channel card must never reserve space. */
      body.mode-feed #addChannelCard,
      body.mode-explore #addChannelCard,
      body.mode-trending #addChannelCard,
      body.mode-fresh #addChannelCard{
        margin-bottom:0!important;
      }

      @media(max-width:360px){
        #${TOOLBAR_ID} .searchbar.td-search-open{
          width:calc(100vw - 122px)!important;
          max-width:calc(100vw - 122px)!important;
        }
        #${TOOLBAR_ID} #addChannelCard #openAddChannel{
          padding:0 10px!important;
          font-size:8px!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        #${TOOLBAR_ID} .searchbar{
          transition:none!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function setupSearch(searchbar) {
    if (!searchbar || searchbar.dataset.tdCompactSearch === "1") return;
    searchbar.dataset.tdCompactSearch = "1";

    const input = searchbar.querySelector("input");
    const icon = searchbar.querySelector(".icon");

    const open = () => {
      searchbar.classList.add("td-search-open");
      requestAnimationFrame(() => input?.focus());
    };

    const close = () => {
      if (String(input?.value || "").trim()) return;
      searchbar.classList.remove("td-search-open");
      input?.blur();
    };

    icon?.addEventListener("click", (event) => {
      if (searchbar.classList.contains("td-search-open")) return;

      // First tap only opens search. Existing search behavior remains active
      // after the field has been opened.
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }, true);

    input?.addEventListener("focus", () => {
      searchbar.classList.add("td-search-open");
    });

    input?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (input) input.value = "";
        close();
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!searchbar.classList.contains("td-search-open")) return;
      if (searchbar.contains(event.target)) return;
      close();
    }, true);
  }

  function setupAddChannel(addCard) {
    if (!addCard) return;
    const button = addCard.querySelector("#openAddChannel");
    if (button) {
      button.textContent = "＋ افزودن کانال";
      button.setAttribute("aria-label", "افزودن کانال به Discovery");
      button.setAttribute("title", "افزودن کانال");
    }
  }

  function placeCompactTools() {
    const tabs = document.querySelector(".tabs");
    const searchbar = document.querySelector(".searchbar");
    const addCard = document.getElementById("addChannelCard");

    if (!tabs || !searchbar || !addCard) return false;

    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = TOOLBAR_ID;
      toolbar.setAttribute("aria-label", "ابزارهای سریع");
      tabs.parentNode?.insertBefore(toolbar, tabs);
    }

    if (searchbar.parentElement !== toolbar) {
      toolbar.appendChild(searchbar);
    }

    if (addCard.parentElement !== toolbar) {
      toolbar.appendChild(addCard);
    }

    setupSearch(searchbar);
    setupAddChannel(addCard);
    return true;
  }

  function boot() {
    installStyle();

    if (placeCompactTools()) return;

    const observer = new MutationObserver(() => {
      if (placeCompactTools()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
