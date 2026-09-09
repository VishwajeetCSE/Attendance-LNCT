// content_script.js v3.0 — Auto-login for both LNCT portals
// LNCT University: accsoft.lnctu.ac.in/AccSoft2/StudentLogin.aspx
// LNCT College:    portal.lnct.ac.in/Accsoft2/studentLogin.aspx

(function () {
  "use strict";
  const HOST = window.location.hostname;
  const IS_COLLEGE = HOST.includes("portal.lnct.ac.in");
  console.log("[LNCT] Login script loaded on:", HOST, IS_COLLEGE ? "(College)" : "(University)");

  function waitForEl(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const f = document.querySelector(selector);
        if (f) { obs.disconnect(); resolve(f); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error("Timeout: " + selector)); }, timeout);
    });
  }

  function fillInput(el, value) {
    el.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (nativeSetter && nativeSetter.set) nativeSetter.set.call(el, value);
    else el.value = value;
    ["input", "change", "keyup", "keydown", "blur"].forEach(e => el.dispatchEvent(new Event(e, { bubbles: true })));
    el.blur();
  }

  async function doLogin(username, password) {
    // ── College portal (portal.lnct.ac.in) has known IDs from page source ──
    // IDs: ctl00_cph1_txtStuUser, ctl00_cph1_txtStuPsw, btnStuLogin
    const userSelectors = IS_COLLEGE ? [
      "#ctl00_cph1_txtStuUser",
      "input[id*='txtStuUser']",
      "input[id*='StuUser']",
      "input[placeholder*='Login Id' i]",
      "input[type='text']:not([style*='display:none'])"
    ] : [
      "input[placeholder*='Login Id' i]",
      "input[placeholder*='Student' i]",
      "input[placeholder*='user' i]",
      "#txtLoginId", "#txtUsername",
      "input[id*='user' i]",
      "input[type='text']:not([style*='display:none'])"
    ];

    const passSelectors = IS_COLLEGE ? [
      "#ctl00_cph1_txtStuPsw",
      "input[id*='txtStuPsw']",
      "input[type='password']"
    ] : [
      "input[type='password']",
      "input[placeholder*='password' i]"
    ];

    const btnSelectors = IS_COLLEGE ? [
      "#btnStuLogin",
      "input[id*='btnStuLogin']",
      "#ctl00_cph1_btnStuProceed",
      "input[value*='Login' i]",
      "input[type='submit']"
    ] : [
      "input[value*='Login' i]",
      "button[id*='login' i]",
      "#btnLogin",
      "input[type='submit']",
      "button[type='submit']"
    ];

    let userEl = null, passEl = null, btnEl = null;
    for (const s of userSelectors) { try { const e = document.querySelector(s); if (e && e.offsetParent !== null) { userEl = e; break; } } catch {} }
    for (const s of passSelectors) { try { const e = document.querySelector(s); if (e) { passEl = e; break; } } catch {} }
    for (const s of btnSelectors)  { try { const e = document.querySelector(s); if (e) { btnEl = e; break; } } catch {} }

    if (!userEl || !passEl) {
      console.error("[LNCT] Fields not found. Available inputs:");
      document.querySelectorAll("input").forEach(i => console.log(" →", i.type, "| id:", i.id, "| placeholder:", i.placeholder));
      return;
    }

    console.log("[LNCT] Filling:", userEl.id || userEl.placeholder, "/", passEl.id);
    fillInput(userEl, username);
    await new Promise(r => setTimeout(r, 300));
    fillInput(passEl, password);
    await new Promise(r => setTimeout(r, 500));

    if (btnEl) {
      console.log("[LNCT] Submitting:", btnEl.id || btnEl.value);
      btnEl.click();
      if (typeof window.__doPostBack === "function" && btnEl.name)
        try { window.__doPostBack(btnEl.name, ""); } catch(e) {}
    } else {
      const form = userEl.closest("form");
      if (form) form.submit();
    }
  }

  // ── Run ──
  chrome.storage.sync.get(["username", "password", "autoLogin"], (data) => {
    if (!data.autoLogin) { console.log("[LNCT] Auto-login OFF."); return; }
    if (!data.username || !data.password) { console.warn("[LNCT] No credentials saved."); return; }

    waitForEl("input[type='password']")
      .then(() => setTimeout(() => doLogin(data.username, data.password), 800))
      .catch(e => console.error("[LNCT] Form not ready:", e.message));
  });
})();
