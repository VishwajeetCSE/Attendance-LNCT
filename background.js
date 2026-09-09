// background.js v3.0 — LNCT Attendance Helper
// Supports: LNCT University (accsoft.lnctu.ac.in) + LNCT College (portal.lnct.ac.in)

const PORTALS = {
  university: {
    login: "https://accsoft.lnctu.ac.in/AccSoft2/StudentLogin.aspx",
    attendance: "https://accsoft.lnctu.ac.in/AccSoft2/Parents/StuAttendanceStatus.aspx",
    domain: "accsoft.lnctu.ac.in"
  },
  college: {
    login: "https://portal.lnct.ac.in/Accsoft2/studentLogin.aspx",
    attendance: "https://portal.lnct.ac.in/Accsoft2/Parents/StuAttendanceStatus.aspx",
    domain: "portal.lnct.ac.in"
  }
};

const PING_ALARM = "session-ping";
const PING_INTERVAL = 4;

// ── Startup ──
chrome.runtime.onInstalled.addListener(() => { setupPingAlarm(); updateBadgeFromStorage(); });
chrome.runtime.onStartup.addListener(() => { setupPingAlarm(); updateBadgeFromStorage(); });

// ── Badge ──
function setBadge(text, color) {
  chrome.action.setBadgeText({ text: text || "" });
  chrome.action.setBadgeBackgroundColor({ color: color || "#1d4ed8" });
}
function updateBadgeFromStorage() {
  chrome.storage.local.get("attendancePercent", (d) => {
    if (d.attendancePercent != null) {
      const p = Math.round(d.attendancePercent);
      setBadge(p + "%", p >= 75 ? "#16a34a" : p >= 60 ? "#d97706" : "#dc2626");
    }
  });
}

// ── Alarm ──
function setupPingAlarm() {
  chrome.alarms.get(PING_ALARM, (ex) => {
    if (!ex) chrome.alarms.create(PING_ALARM, { delayInMinutes: PING_INTERVAL, periodInMinutes: PING_INTERVAL });
  });
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== PING_ALARM) return;
  chrome.storage.sync.get(["username", "password", "keepAlive", "portal"], (d) => {
    if (!d.username || !d.password || !d.keepAlive) return;
    const portal = PORTALS[d.portal || "university"];
    pingSession(portal.attendance);
  });
});
async function pingSession(url) {
  try {
    const r = await fetch(url, { method: "GET", credentials: "include" });
    if (r.url.toLowerCase().includes("login")) setBadge("!", "#dc2626");
  } catch(e) { console.warn("[LNCT] Ping error:", e.message); }
}

// ── Tab watcher: redirect to attendance after login ──
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  chrome.storage.local.get(["redirectAfterLogin", "targetAttendanceUrl"], (d) => {
    if (!d.redirectAfterLogin) return;
    const url = tab.url;
    const isLogin = url.toLowerCase().includes("login");
    const isLnct = url.includes("lnct.ac.in");
    const isAttendance = url.toLowerCase().includes("attendance") || url.toLowerCase().includes("stuattendancestatus");
    if (isLnct && !isLogin && !isAttendance) {
      chrome.storage.local.remove(["redirectAfterLogin"]);
      const target = d.targetAttendanceUrl || PORTALS.university.attendance;
      chrome.tabs.update(tabId, { url: target });
    } else if (isAttendance) {
      chrome.storage.local.remove(["redirectAfterLogin"]);
    }
  });
});

// ── Messages ──
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.action === "openAttendance")  { handleOpenAttendance(); reply({ success: true }); }
  if (msg.action === "attendanceData")  {
    chrome.storage.local.set({ attendancePercent: msg.percent, subjects: msg.subjects || [], profileImage: msg.profileImage || null, studentName: msg.studentName || null, lastUpdated: Date.now() });
    const p = Math.round(msg.percent);
    setBadge(p + "%", p >= 75 ? "#16a34a" : p >= 60 ? "#d97706" : "#dc2626");
    reply({ success: true });
  }
  if (msg.action === "startPing") { setupPingAlarm(); reply({ success: true }); }
  if (msg.action === "stopPing")  { chrome.alarms.clear(PING_ALARM); reply({ success: true }); }
  return true;
});

// ── Smart open: check session → navigate or login ──
async function handleOpenAttendance() {
  chrome.storage.sync.get(["portal"], async (d) => {
    const portal = PORTALS[d.portal || "university"];
    try {
      const res = await fetch(portal.attendance, { method: "GET", credentials: "include", redirect: "follow" });
      const isLogin = res.url.toLowerCase().includes("login");
      if (!isLogin && res.ok) {
        navigateTo(portal.attendance, portal.domain);
      } else {
        chrome.storage.local.set({ redirectAfterLogin: true, targetAttendanceUrl: portal.attendance });
        navigateTo(portal.login, portal.domain);
      }
    } catch(e) {
      navigateTo(portal.attendance, portal.domain);
    }
  });
}

function navigateTo(url, domain) {
  chrome.tabs.query({ url: `https://${domain}/*` }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { url, active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url });
    }
  });
}
