// background.js - Service Worker for LNCT Attendance Helper v2.0
// Smart flow: detect session state, auto-login, redirect to attendance, show % badge.

// ─────────────────────────────────────────────────────────
// CONSTANTS - IMPORTANT: Update LOGIN_URL if your portal URL differs
// ─────────────────────────────────────────────────────────
const ATTENDANCE_URL = "https://accsoft.lnctu.ac.in/AccSoft2/Parents/StuAttendanceStatus.aspx";
const LOGIN_URL      = "https://accsoft.lnctu.ac.in/AccSoft2/StudentLogin.aspx";
const PING_ALARM_NAME      = "session-ping";
const PING_INTERVAL_MINUTES = 4;

// ─────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log("[LNCT] Extension installed v2.0");
  setupPingAlarm();
  updateBadgeFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  setupPingAlarm();
  updateBadgeFromStorage();
});

// ─────────────────────────────────────────────────────────
// Badge helpers
// ─────────────────────────────────────────────────────────
function setBadge(text, color) {
  chrome.action.setBadgeText({ text: text || "" });
  chrome.action.setBadgeBackgroundColor({ color: color || "#1d4ed8" });
}

function updateBadgeFromStorage() {
  chrome.storage.local.get("attendancePercent", (data) => {
    if (data.attendancePercent != null) {
      const pct = Math.round(data.attendancePercent);
      const color = pct >= 75 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
      setBadge(pct + "%", color);
    }
  });
}

// ─────────────────────────────────────────────────────────
// Alarm — session keep-alive ping
// ─────────────────────────────────────────────────────────
function setupPingAlarm() {
  chrome.alarms.get(PING_ALARM_NAME, (existing) => {
    if (!existing) {
      chrome.alarms.create(PING_ALARM_NAME, {
        delayInMinutes: PING_INTERVAL_MINUTES,
        periodInMinutes: PING_INTERVAL_MINUTES
      });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== PING_ALARM_NAME) return;
  chrome.storage.sync.get(["username", "password", "keepAlive"], (data) => {
    if (!data.username || !data.password || !data.keepAlive) return;
    pingSession();
  });
});

async function pingSession() {
  try {
    const res = await fetch(ATTENDANCE_URL, { method: "GET", credentials: "include" });
    console.log("[LNCT] Ping:", res.status, res.url);
    // If ping landed on login page → session expired, clear badge
    if (res.url.includes("Login") || res.url.includes("login")) {
      setBadge("!", "#dc2626");
    }
  } catch (e) {
    console.warn("[LNCT] Ping failed:", e.message);
  }
}

// ─────────────────────────────────────────────────────────
// TAB WATCHER — redirect to attendance after successful login
// ─────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  chrome.storage.local.get("redirectAfterLogin", (data) => {
    if (!data.redirectAfterLogin) return;

    const url = tab.url;
    // If the tab is no longer on the login page and still on the LNCT domain
    const isLoginPage = url.includes("StudentLogin") || url.includes("Login.aspx");
    const isLnctSite  = url.includes("accsoft.lnctu.ac.in");
    const isAlreadyAttendance = url.includes("StuAttendanceStatus");

    if (isLnctSite && !isLoginPage && !isAlreadyAttendance) {
      // Successfully logged in and landed on some dashboard → redirect to attendance
      console.log("[LNCT] Login success detected, redirecting to attendance...");
      chrome.storage.local.remove("redirectAfterLogin");
      chrome.tabs.update(tabId, { url: ATTENDANCE_URL });
    } else if (isAlreadyAttendance) {
      // Already on attendance page — clean up flag
      chrome.storage.local.remove("redirectAfterLogin");
    }
  });
});

// ─────────────────────────────────────────────────────────
// MESSAGE LISTENER — from popup.js / content scripts
// ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── "View Attendance" button clicked ──
  if (message.action === "openAttendance") {
    handleOpenAttendance();
    sendResponse({ success: true });
  }

  // ── Attendance % received from scraper content script ──
  if (message.action === "attendanceData") {
    const pct = message.percent;
    chrome.storage.local.set({ attendancePercent: pct, lastUpdated: Date.now() });
    const rounded = Math.round(pct);
    const color = rounded >= 75 ? "#16a34a" : rounded >= 60 ? "#d97706" : "#dc2626";
    setBadge(rounded + "%", color);
    console.log("[LNCT] Attendance %:", pct);
    sendResponse({ success: true });
  }

  // ── Alarm controls ──
  if (message.action === "startPing") {
    setupPingAlarm();
    sendResponse({ success: true });
  }

  if (message.action === "stopPing") {
    chrome.alarms.clear(PING_ALARM_NAME);
    sendResponse({ success: true });
  }

  return true;
});

// ─────────────────────────────────────────────────────────
// Smart open — check session, then navigate or login
// ─────────────────────────────────────────────────────────
async function handleOpenAttendance() {
  try {
    // Silently fetch attendance page; follow redirects
    const res = await fetch(ATTENDANCE_URL, {
      method: "GET",
      credentials: "include",
      redirect: "follow"
    });

    const finalUrl = res.url;
    const isRedirectedToLogin = finalUrl.includes("Login") || finalUrl.includes("login");

    if (!isRedirectedToLogin && res.ok) {
      // Session is alive — navigate directly to attendance
      console.log("[LNCT] Session active. Opening attendance.");
      navigateTo(ATTENDANCE_URL);
    } else {
      // Session expired or logged out — need to login first
      console.log("[LNCT] Session expired. Going to login with redirect flag.");
      chrome.storage.local.set({ redirectAfterLogin: true });
      navigateTo(LOGIN_URL);
    }
  } catch (err) {
    console.warn("[LNCT] Could not check session:", err.message);
    // On network error, just try opening attendance anyway
    navigateTo(ATTENDANCE_URL);
  }
}

// ─────────────────────────────────────────────────────────
// Navigation helper — reuse existing LNCT tab or open new
// ─────────────────────────────────────────────────────────
function navigateTo(url) {
  chrome.tabs.query({ url: "https://accsoft.lnctu.ac.in/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url, active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url });
    }
  });
}
