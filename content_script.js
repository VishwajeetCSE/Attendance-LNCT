// content_script.js - Auto-login for LNCT StudentLogin.aspx
// Triggered on: https://accsoft.lnctu.ac.in/AccSoft2/StudentLogin.aspx

(function () {
  "use strict";

  console.log("[LNCT] Login page detected. Content script running.");

  // ── Wait for a DOM element to appear ──
  function waitForElement(selector, timeout = 6000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Timed out waiting for: " + selector));
      }, timeout);
    });
  }

  // ── Fill input without triggering framework issues ──
  function fillInput(el, value) {
    el.focus();
    // Clear existing value
    el.value = "";

    // Use native setter to bypass React/Vue/ASP.NET event hijacking
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    );
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(el, value);
    } else {
      el.value = value;
    }

    // Fire all events ASP.NET WebForms might listen to
    ["input", "change", "keyup", "keydown", "keypress", "blur"].forEach((evt) => {
      el.dispatchEvent(new Event(evt, { bubbles: true }));
    });
    el.blur();
  }

  // ── Main auto-login logic ──
  async function doAutoLogin(username, password) {
    // ── Find username field ──
    // The screenshot shows placeholder "Student's Login Id"
    // We try multiple selectors in priority order
    const usernameSelectors = [
      "input[placeholder*=\"Login Id\" i]",
      "input[placeholder*=\"Student\" i]",
      "input[placeholder*=\"username\" i]",
      "input[placeholder*=\"user\" i]",
      "input[placeholder*=\"id\" i]",
      "#txtLoginId",
      "#txtUsername",
      "#ctl00_ContentPlaceHolder1_txtLoginId",
      "input[type=\"text\"]:not([style*=\"display:none\"]):not([style*=\"display: none\"])"
    ];

    // ── Find password field ──
    const passwordSelectors = [
      "input[type=\"password\"]",
      "input[placeholder*=\"password\" i]",
      "#txtPassword",
      "#ctl00_ContentPlaceHolder1_txtPassword"
    ];

    // ── Find submit/login button ──
    const submitSelectors = [
      "input[value*=\"Login\" i]",
      "input[value*=\"Sign\" i]",
      "button[id*=\"login\" i]",
      "button[id*=\"btn\" i]",
      "#btnLogin",
      "#ctl00_ContentPlaceHolder1_btnLogin",
      "input[type=\"submit\"]",
      "button[type=\"submit\"]",
      "a[id*=\"login\" i]"
    ];

    let usernameField = null;
    let passwordField = null;
    let submitBtn = null;

    for (const sel of usernameSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { // visible
          usernameField = el;
          break;
        }
      } catch (e) {}
    }

    for (const sel of passwordSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) { passwordField = el; break; }
      } catch (e) {}
    }

    for (const sel of submitSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) { submitBtn = el; break; }
      } catch (e) {}
    }

    if (!usernameField) {
      console.error("[LNCT] Username field not found! Check the login page selectors.");
      console.log("[LNCT] All inputs on page:", document.querySelectorAll("input").length);
      document.querySelectorAll("input").forEach(el => {
        console.log("[LNCT] Input:", el.type, "| id:", el.id, "| name:", el.name, "| placeholder:", el.placeholder);
      });
      return;
    }

    if (!passwordField) {
      console.error("[LNCT] Password field not found!");
      return;
    }

    console.log("[LNCT] Found username field:", usernameField.id || usernameField.name || usernameField.placeholder);
    console.log("[LNCT] Found password field:", passwordField.id || passwordField.name);

    // ── Fill credentials ──
    fillInput(usernameField, username);
    await new Promise(r => setTimeout(r, 200));
    fillInput(passwordField, password);
    await new Promise(r => setTimeout(r, 400));

    // ── Submit ──
    if (submitBtn) {
      console.log("[LNCT] Clicking submit:", submitBtn.id || submitBtn.value || submitBtn.textContent);
      submitBtn.click();

      // Also try __doPostBack for ASP.NET WebForms
      if (typeof window.__doPostBack === "function" && submitBtn.name) {
        try { window.__doPostBack(submitBtn.name, ""); } catch (e) {}
      }
    } else {
      console.warn("[LNCT] No submit button found. Trying form.submit()");
      const form = usernameField.closest("form");
      if (form) form.submit();
    }
  }

  // ── Entry point: load credentials and run ──
  chrome.storage.sync.get(["username", "password", "autoLogin"], (data) => {
    if (!data.autoLogin) {
      console.log("[LNCT] Auto-login is OFF. Skipping.");
      return;
    }
    if (!data.username || !data.password) {
      console.warn("[LNCT] No credentials saved. Open extension options to set them.");
      return;
    }

    // Wait for password field to appear (page might still be loading)
    waitForElement("input[type=\"password\"]")
      .then(() => {
        console.log("[LNCT] Form ready. Filling credentials...");
        // Extra short delay so ASP.NET page scripts fully initialize
        setTimeout(() => doAutoLogin(data.username, data.password), 800);
      })
      .catch((err) => {
        console.error("[LNCT] Login form not found:", err.message);
      });
  });

})();
