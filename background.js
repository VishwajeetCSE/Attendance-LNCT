// Service worker for LNCT Attendance Helper.
// All portal data is isolated by portal key, never by the currently open tab.

const PORTALS = Object.freeze({
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
});

const PING_ALARM = "session-ping";
const PING_INTERVAL = 4;
const MAX_PROFILE_IMAGE_BYTES = 1500000;

const localGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const localSet = (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve));
const localRemove = (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
const syncGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const legacySyncGet = (keys) => new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
const legacySyncRemove = (keys) => new Promise((resolve) => chrome.storage.sync.remove(keys, resolve));

function validPortal(value) {
  return Object.prototype.hasOwnProperty.call(PORTALS, value) ? value : "university";
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text: text || "" });
  chrome.action.setBadgeBackgroundColor({ color: color || "#1d4ed8" });
}

function setBadgeForPercent(percent) {
  if (!Number.isFinite(percent)) return setBadge("", "#1d4ed8");
  const rounded = Math.round(percent);
  setBadge(`${rounded}%`, rounded >= 75 ? "#16a34a" : rounded >= 60 ? "#d97706" : "#dc2626");
}

async function updateBadgeFromStorage() {
  const [settings, stored] = await Promise.all([syncGet("portal"), localGet("portalAttendance")]);
  const portal = validPortal(settings.portal);
  setBadgeForPercent(stored.portalAttendance && stored.portalAttendance[portal] && stored.portalAttendance[portal].attendancePercent);
}

async function migrateLegacyData() {
  const stored = await localGet(["portalAttendance", "attendancePercent", "subjects", "profileImage", "studentName", "lastUpdated"]);
  const legacy = await legacySyncGet(["username", "password", "autoLogin", "keepAlive", "portal"]);
  const updates = {};

  if (!stored.portalAttendance && stored.attendancePercent != null) {
    const settings = await syncGet("portal");
    const portal = validPortal(settings.portal || legacy.portal);
    updates.portalAttendance = {
      [portal]: {
        attendancePercent: stored.attendancePercent,
        subjects: Array.isArray(stored.subjects) ? stored.subjects : [],
        profileImage: stored.profileImage || null,
        studentName: stored.studentName || null,
        semesterRecords: [],
        lastUpdated: stored.lastUpdated || Date.now()
      }
    };
  }

  const localCredentials = await localGet(["username", "password", "portal"]);
  if (!localCredentials.portal && legacy.portal) updates.portal = validPortal(legacy.portal);
  const shouldClearLegacyCredentials = !localCredentials.username && !localCredentials.password && legacy.username && legacy.password;
  if (shouldClearLegacyCredentials) {
    updates.username = legacy.username;
    updates.password = legacy.password;
    updates.autoLogin = Boolean(legacy.autoLogin);
    updates.keepAlive = Boolean(legacy.keepAlive);
    updates.portal = validPortal(legacy.portal);
  }
  if (Object.keys(updates).length) await localSet(updates);
  if (shouldClearLegacyCredentials) await legacySyncRemove(["username", "password", "autoLogin", "keepAlive", "portal"]);
}

function setupPingAlarm() {
  chrome.alarms.get(PING_ALARM, (existing) => {
    if (!existing) chrome.alarms.create(PING_ALARM, { delayInMinutes: PING_INTERVAL, periodInMinutes: PING_INTERVAL });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  setupPingAlarm();
  await migrateLegacyData();
  updateBadgeFromStorage();
});
chrome.runtime.onStartup.addListener(() => {
  setupPingAlarm();
  updateBadgeFromStorage();
});

function isLoginResponse(response, html = "") {
  return /studentlogin|\/login/i.test(response.url || "") || /ctl00_cph1_txtStuPsw|student.?login.?id/i.test(html);
}

async function setSessionStatus(portal, status) {
  const stored = await localGet("sessionStatus");
  await localSet({ sessionStatus: { ...(stored.sessionStatus || {}), [portal]: { status, checkedAt: Date.now() } } });
}

async function pingSession(portal) {
  const config = PORTALS[portal];
  try {
    const response = await fetch(config.attendance, { method: "GET", credentials: "include", redirect: "follow" });
    if (!response.ok || isLoginResponse(response)) {
      await setSessionStatus(portal, "expired");
      const settings = await syncGet("portal");
      if (validPortal(settings.portal) === portal) setBadge("!", "#dc2626");
      return;
    }
    await setSessionStatus(portal, "active");
  } catch (error) {
    console.warn("[LNCT] Session ping failed:", error.message);
    await setSessionStatus(portal, "error");
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PING_ALARM) return;
  const settings = await syncGet(["username", "password", "keepAlive", "portal"]);
  if (!settings.username || !settings.password || !settings.keepAlive) return;
  pingSession(validPortal(settings.portal));
});

function cleanSubjects(subjects) {
  if (!Array.isArray(subjects)) return null;
  return subjects
    .filter((subject) => subject && typeof subject.name === "string" && Number.isFinite(Number(subject.percent)))
    .map((subject) => ({ name: subject.name.trim().slice(0, 120), percent: Number(subject.percent) }))
    .filter((subject) => subject.name && subject.percent >= 0 && subject.percent <= 100)
    .slice(0, 20);
}

function cleanSemesters(records) {
  if (!Array.isArray(records)) return null;
  return records
    .filter((record) => record && typeof record.semester === "string" && Number.isFinite(Number(record.percent)))
    .map((record) => ({ semester: record.semester.trim().slice(0, 50), percent: Number(record.percent) }))
    .filter((record) => record.semester && record.percent >= 0 && record.percent <= 100)
    .slice(0, 20);
}

function semesterOrder(record) {
  const match = String(record.semester || "").match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function mergeSemesterRecord(records, record) {
  const all = Array.isArray(records) ? [...records] : [];
  const index = all.findIndex((item) => item.semester.toLowerCase() === record.semester.toLowerCase());
  if (index === -1) all.push(record);
  else all[index] = record;
  return all.sort((a, b) => semesterOrder(a) - semesterOrder(b)).slice(0, 20);
}

function appendAttendanceSnapshot(history, percent, recordedAt) {
  const all = Array.isArray(history) ? history.filter((item) => Number.isFinite(Number(item.percent)) && Number.isFinite(Number(item.recordedAt))) : [];
  const previous = all.at(-1);
  // Preserve actual changes immediately; avoid filling storage with identical refreshes.
  if (!previous || Number(previous.percent) !== percent || recordedAt - Number(previous.recordedAt) >= 6 * 60 * 60 * 1000) {
    all.push({ percent, recordedAt });
  }
  return all.slice(-40);
}

async function imageAsDataUrl(imageUrl, portal) {
  if (typeof imageUrl !== "string" || imageUrl.startsWith("data:image/")) return imageUrl;
  const url = new URL(imageUrl);
  const portalOrigin = new URL(PORTALS[portal].attendance).origin;
  if (url.origin !== portalOrigin) throw new Error("Profile image has an unexpected origin");

  const response = await fetch(url.href, { credentials: "include" });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) throw new Error("Profile image could not be read");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) throw new Error("Profile image is too large to store");

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function persistPortalData(portalValue, data, source) {
  const portal = validPortal(portalValue);
  const stored = await localGet("portalAttendance");
  const allData = stored.portalAttendance || {};
  const previous = allData[portal] || {};
  const next = { ...previous };
  let hasAttendanceUpdate = false;
  let hasProfileUpdate = false;

  const rawPercent = data && data.attendancePercent;
  const percent = rawPercent !== null && rawPercent !== undefined && rawPercent !== "" ? Number(rawPercent) : null;
  const hasPercent = Number.isFinite(percent) && percent >= 0 && percent <= 100;
  if (hasPercent) {
    next.attendancePercent = percent;
    hasAttendanceUpdate = true;
  }

  const subjects = cleanSubjects(data && data.subjects);
  if (subjects !== null && (source === "attendance" || data.hasAttendance)) {
    next.subjects = subjects;
    hasAttendanceUpdate = true;
  }

  const semesters = cleanSemesters(data && data.semesterRecords);
  if (semesters !== null && semesters.length) {
    next.semesterRecords = semesters.reduce((records, record) => mergeSemesterRecord(records, record), next.semesterRecords || []);
    hasAttendanceUpdate = true;
  }

  if (data && typeof data.selectedSemester === "string" && data.selectedSemester.trim() && hasPercent) {
    next.semesterRecords = mergeSemesterRecord(next.semesterRecords || [], {
      semester: data.selectedSemester.trim().slice(0, 80),
      percent
    });
    hasAttendanceUpdate = true;
  }

  if (data && typeof data.studentName === "string" && data.studentName.trim()) {
    next.studentName = data.studentName.trim().slice(0, 80);
    hasProfileUpdate = true;
  }

  if (data && data.profileImage) {
    try {
      next.profileImage = await imageAsDataUrl(data.profileImage, portal);
      hasProfileUpdate = true;
    } catch (error) {
      console.warn("[LNCT] Could not cache profile image:", error.message);
    }
  }

  if (!hasAttendanceUpdate && !hasProfileUpdate) return previous;
  if (hasAttendanceUpdate) {
    const now = Date.now();
    next.lastUpdated = now;
    if (hasPercent) next.attendanceHistory = appendAttendanceSnapshot(next.attendanceHistory, percent, now);
  }
  if (hasProfileUpdate) next.lastProfileUpdated = Date.now();
  allData[portal] = next;
  await localSet({ portalAttendance: allData });

  const settings = await syncGet("portal");
  if (portal === validPortal(settings.portal) && Number.isFinite(next.attendancePercent)) setBadgeForPercent(next.attendancePercent);
  return next;
}

function findProfileUrl(html, baseUrl, portal) {
  const anchorPattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  const expectedOrigin = new URL(PORTALS[portal].attendance).origin;
  for (const match of html.matchAll(anchorPattern)) {
    const label = match[3].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!/profile|my\s*details|student\s*details|personal\s*details/i.test(label)) continue;
    try {
      const url = new URL(match[2], baseUrl);
      if (url.origin === expectedOrigin) return url.href;
    } catch (_) { /* Ignore malformed portal links. */ }
  }
  return null;
}

async function refreshPortalData(portalValue) {
  const portal = validPortal(portalValue);
  const config = PORTALS[portal];
  try {
    const response = await fetch(config.attendance, { method: "GET", credentials: "include", redirect: "follow" });
    const attendanceHtml = await response.text();
    if (!response.ok || isLoginResponse(response, attendanceHtml)) {
      await setSessionStatus(portal, "expired");
      return { success: false, code: "session-expired", message: "Your portal session has expired. Open Attendance to sign in." };
    }

    let profileHtml = "";
    const profileUrl = findProfileUrl(attendanceHtml, response.url || config.attendance, portal);
    if (profileUrl) {
      try {
        const profileResponse = await fetch(profileUrl, { credentials: "include", redirect: "follow" });
        if (profileResponse.ok && !isLoginResponse(profileResponse)) profileHtml = await profileResponse.text();
      } catch (_) { /* Attendance data remains useful if the profile request fails. */ }
    }
    await setSessionStatus(portal, "active");
    return { success: true, attendanceHtml, attendanceUrl: response.url || config.attendance, profileHtml, profileUrl };
  } catch (error) {
    await setSessionStatus(portal, "error");
    return { success: false, code: "network-error", message: "Could not reach the LNCT portal. Please try again." };
  }
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve) => chrome.tabs.update(tabId, updateProperties, resolve));
}

function createTab(createProperties) {
  return new Promise((resolve) => chrome.tabs.create(createProperties, resolve));
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) resolve({ success: false, message: error.message });
      else resolve(response || { success: false, message: "The attendance page did not respond." });
    });
  });
}

async function refreshActiveAttendance(portalValue) {
  const portal = validPortal(portalValue);
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  if (!tab || !tab.url) return { success: false, message: "No active attendance tab was found." };
  const url = new URL(tab.url);
  if (url.hostname !== PORTALS[portal].domain || !/attendance|stuattendancestatus/i.test(url.href)) {
    return { success: false, message: "Open the selected portal's Attendance Status page for an instant live refresh." };
  }
  return sendTabMessage(tab.id, { action: "getLiveAttendance" });
}

async function navigateTo(url, domain) {
  const tabs = await queryTabs({ url: `https://${domain}/*` });
  if (tabs.length) {
    const tab = await updateTab(tabs[0].id, { url, active: true });
    chrome.windows.update(tab.windowId, { focused: true });
    return tab;
  }
  return createTab({ url });
}

async function handleOpenAttendance() {
  const settings = await syncGet("portal");
  const portal = validPortal(settings.portal);
  const result = await refreshPortalData(portal);
  if (result.success) return navigateTo(PORTALS[portal].attendance, PORTALS[portal].domain);

  const tab = await navigateTo(PORTALS[portal].login, PORTALS[portal].domain);
  await localSet({ pendingLogin: { tabId: tab.id, portal, targetUrl: PORTALS[portal].attendance, expiresAt: Date.now() + 5 * 60 * 1000 } });
  return tab;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  const stored = await localGet("pendingLogin");
  const pending = stored.pendingLogin;
  if (!pending) return;
  if (pending.expiresAt < Date.now() || pending.tabId !== tabId) {
    if (pending.expiresAt < Date.now()) await localRemove("pendingLogin");
    return;
  }

  const config = PORTALS[validPortal(pending.portal)];
  const url = new URL(tab.url);
  if (url.hostname !== config.domain || /login/i.test(url.pathname)) return;
  if (url.href.startsWith(pending.targetUrl)) {
    await localRemove("pendingLogin");
    return;
  }
  await localRemove("pendingLogin");
  updateTab(tabId, { url: pending.targetUrl });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === "openAttendance") {
    handleOpenAttendance().then(() => sendResponse({ success: true })).catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }
  if (message.action === "refreshPortalData") {
    refreshPortalData(message.portal).then(sendResponse);
    return true;
  }
  if (message.action === "refreshActiveAttendance") {
    refreshActiveAttendance(message.portal).then(sendResponse);
    return true;
  }
  if (message.action === "attendanceData" || message.action === "profileData") {
    persistPortalData(message.portal, message.data || {}, message.action === "attendanceData" ? "attendance" : "profile")
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }
  if (message.action === "setActivePortal") {
    chrome.storage.local.set({ portal: validPortal(message.portal) }, async () => {
      await updateBadgeFromStorage();
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.action === "startPing") {
    setupPingAlarm();
    sendResponse({ success: true });
    return false;
  }
  if (message.action === "stopPing") {
    chrome.alarms.clear(PING_ALARM, () => sendResponse({ success: true }));
    return true;
  }
  return false;
});
