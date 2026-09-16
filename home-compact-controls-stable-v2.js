/*
 * Telegram Discovery — Stable Compact Home Controls v2
 *
 * Load AFTER creator-growth-ui.js.
 * Keeps the original Add Channel card in place but hidden, then creates
 * a stable proxy button in the compact toolbar. This avoids DOM fighting
 * with creator-growth-ui.js relocateDiscoveryModules().
 */
(() => {
  "use strict";

  const STYLE_ID = "tdHomeCompactControlsStyleV2";
  const TOOLBAR_ID = "tdHomeQuickTools";
  const ADD_PROXY_ID = "tdAddChannelProxy";

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Heart/save position */
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

      body.mode-feed #grid .channel,
      body.mode-feed #grid .nativeHead{
        padding-left:38px!important;
        padding-right:0!important;
      }

      /* Hide the original big Add Channel card permanently.
         creator-growth-ui.js may still move it, but it never becomes visible. */
      #addChannelCard{
        display:none!important;
      }

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

      /* Collapsed search */
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
        transition:width .18s ease,max-width .18s ease,border-color .18s ease!important;
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

      #${ADD_PROXY_ID}{
        flex:0 0 auto!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        height:38px!important;
        min-height:38px!important;
        padding:0 13px!important;
        border:0!important;
        border-radius:12px!important;
        color:#fff!important;
        background:#2AABEE!important;
        font-size:9px!important;
        font-weight:750!important;
        white-space:nowrap!important;
        cursor:pointer!important;
        box-shadow:none!important;
      }

      @media(max-width:360px){
        #${TOOLBAR_ID} .searchbar.td-search-open{
          width:calc(100vw - 122px)!important;
          max-width:calc(100vw - 122px)!important;
        }
        #${ADD_PROXY_ID}{
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
    if (!searchbar || searchbar.dataset.tdCompactSearchV2 === "1") return;
    searchbar.dataset.tdCompactSearchV2 = "1";

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

  function ensureToolbar() {
    const tabs = document.querySelector(".tabs");
    const searchbar = document.querySelector(".searchbar");
    const originalAddButton = document.getElementById("openAddChannel");

    if (!tabs || !searchbar || !originalAddButton) return false;

    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = TOOLBAR_ID;
      toolbar.setAttribute("aria-label", "ابزارهای سریع");
      tabs.parentNode?.insertBefore(toolbar, tabs);
    }

    if (searchbar.parentElement !== toolbar) {
      toolbar.insertBefore(searchbar, toolbar.firstChild);
    }

    let proxy = document.getElementById(ADD_PROXY_ID);
    if (!proxy) {
      proxy = document.createElement("button");
      proxy.id = ADD_PROXY_ID;
      proxy.type = "button";
      proxy.textContent = "＋ افزودن کانال";
      proxy.setAttribute("aria-label", "افزودن کانال به Discovery");

      proxy.addEventListener("click", () => {
        // Use the existing, already-bound Add Channel flow.
        document.getElementById("openAddChannel")?.click();
      });

      toolbar.appendChild(proxy);
    } else if (proxy.parentElement !== toolbar) {
      toolbar.appendChild(proxy);
    }

    setupSearch(searchbar);
    return true;
  }

  function boot() {
    installStyle();

    // Keep the compact toolbar stable even if the host app re-renders/moves
    // its original elements. We only reposition search; Add Channel is a proxy.
    const observer = new MutationObserver(() => {
      ensureToolbar();
    });

    ensureToolbar();

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
