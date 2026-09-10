// options.js - Settings page for LNCT Attendance Helper

document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const btnSave = document.getElementById("btnSave");
  const btnClear = document.getElementById("btnClear");
  const togglePw = document.getElementById("togglePw");
  const alertSuccess = document.getElementById("alertSuccess");
  const alertError = document.getElementById("alertError");

  // Do not place the saved password back into the DOM when this page opens.
  chrome.storage.local.get(["username"], (data) => {
    if (data.username) usernameInput.value = data.username;
  });

  // ── Toggle password visibility ──
  togglePw.addEventListener("click", () => {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePw.textContent = "🙈";
    } else {
      passwordInput.type = "password";
      togglePw.textContent = "👁";
    }
  });

  // ── Show alert helper ──
  function showAlert(el, duration = 3000) {
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, duration);
  }

  // ── Save credentials ──
  btnSave.addEventListener("click", () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showAlert(alertError);
      return;
    }

    chrome.storage.local.set({ username, password }, () => {
      showAlert(alertSuccess);
      console.log("[LNCT Helper] Credentials saved.");
    });
  });

  // ── Clear credentials ──
  btnClear.addEventListener("click", () => {
    if (!confirm("Are you sure you want to clear saved credentials?")) return;

    chrome.storage.local.remove(["username", "password", "autoLogin", "keepAlive"], () => {
      usernameInput.value = "";
      passwordInput.value = "";
      alertSuccess.textContent = "🗑️ Credentials cleared.";
      showAlert(alertSuccess);
      console.log("[LNCT Helper] Credentials cleared.");
    });
  });
});
