// popup.js v2.0 - Attendance ring, smart View button, session status

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const btnAttendance   = document.getElementById("btnAttendance");
  const btnOptions      = document.getElementById("btnOptions");
  const toggleKeepAlive = document.getElementById("toggleKeepAlive");
  const toggleAutoLogin = document.getElementById("toggleAutoLogin");
  const pctText         = document.getElementById("pctText");
  const ringFill        = document.getElementById("ringFill");
  const statusBadge     = document.getElementById("statusBadge");
  const lastUpdated     = document.getElementById("lastUpdated");
  const noDataMsg       = document.getElementById("noDataMsg");
  const sessionDot      = document.getElementById("sessionDot");
  const sessionText     = document.getElementById("sessionText");

  // SVG ring circumference = 2*pi*r = 2*pi*45 ≈ 282.7
  const CIRCUMFERENCE = 2 * Math.PI * 45;

  // ── Render the attendance ring ──
  function renderRing(percent) {
    if (percent == null) {
      pctText.textContent = "--";
      ringFill.style.strokeDashoffset = CIRCUMFERENCE;
      ringFill.style.stroke = "#334155";
      statusBadge.textContent = "No data yet";
      statusBadge.className = "attendance-status status-unknown";
      noDataMsg.style.display = "block";
      return;
    }

    noDataMsg.style.display = "none";
    const pct = Math.round(percent);
    pctText.textContent = pct + "%";

    // Animate ring
    const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
    ringFill.style.strokeDasharray = CIRCUMFERENCE;
    ringFill.style.strokeDashoffset = offset;

    // Color coding
    if (pct >= 75) {
      ringFill.style.stroke = "#22c55e";
      statusBadge.textContent = "✅ Safe (" + pct + "%)";
      statusBadge.className = "attendance-status status-safe";
    } else if (pct >= 60) {
      ringFill.style.stroke = "#f59e0b";
      statusBadge.textContent = "⚠️ At Risk (" + pct + "%)";
      statusBadge.className = "attendance-status status-warn";
    } else {
      ringFill.style.stroke = "#ef4444";
      statusBadge.textContent = "🚨 Low (" + pct + "%)";
      statusBadge.className = "attendance-status status-danger";
    }
  }

  // ── Format time ago ──
  function timeAgo(ts) {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)   return "Updated just now";
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Updated ${Math.floor(diff / 3600)}h ago`;
    return `Updated ${Math.floor(diff / 86400)}d ago`;
  }

  // ── Update session status indicator ──
  function updateSessionUI(keepAlive, hasCredentials) {
    if (keepAlive && hasCredentials) {
      sessionDot.classList.remove("off");
      sessionText.textContent = "Session keep-alive ON";
    } else if (!hasCredentials) {
      sessionDot.classList.add("off");
      sessionText.textContent = "Save credentials first";
    } else {
      sessionDot.classList.add("off");
      sessionText.textContent = "Keep-alive disabled";
    }
  }

  // ── Load saved data on popup open ──
  chrome.storage.sync.get(["keepAlive", "autoLogin", "username"], (syncData) => {
    toggleKeepAlive.checked = !!syncData.keepAlive;
    toggleAutoLogin.checked = !!syncData.autoLogin;

    chrome.storage.local.get(["attendancePercent", "lastUpdated"], (localData) => {
      renderRing(localData.attendancePercent ?? null);
      if (localData.lastUpdated) {
        lastUpdated.textContent = timeAgo(localData.lastUpdated);
      }
      updateSessionUI(!!syncData.keepAlive, !!syncData.username);
    });
  });

  // ── "View Attendance" — smart: auto-login if needed, then navigate ──
  btnAttendance.addEventListener("click", () => {
    // Show loading state on button
    btnAttendance.textContent = "⏳ Opening...";
    btnAttendance.disabled = true;

    chrome.runtime.sendMessage({ action: "openAttendance" }, () => {
      window.close();
    });
  });

  // ── Options page ──
  btnOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // ── Toggle: Keep-Alive ──
  toggleKeepAlive.addEventListener("change", () => {
    const enabled = toggleKeepAlive.checked;
    chrome.storage.sync.set({ keepAlive: enabled }, () => {
      chrome.runtime.sendMessage({ action: enabled ? "startPing" : "stopPing" });
      chrome.storage.sync.get("username", (d) => updateSessionUI(enabled, !!d.username));
    });
  });

  // ── Toggle: Auto-Login ──
  toggleAutoLogin.addEventListener("change", () => {
    chrome.storage.sync.set({ autoLogin: toggleAutoLogin.checked });
  });
});
