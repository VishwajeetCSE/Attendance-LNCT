// Popup state and rendering for LNCT Attendance Helper.

const CIRC = 2 * Math.PI * 45;

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const portalSelect = $("portalSelect");
  const refreshButton = $("btnRefreshCircle");
  let currentPortal = "university";

  const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  const storageSet = (values) => new Promise((resolve) => chrome.storage.local.set(values, resolve));
  const message = (payload) => new Promise((resolve) => chrome.runtime.sendMessage(payload, resolve));

  function timeAgo(timestamp) {
    if (!timestamp) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "Updated just now";
    if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `Updated ${Math.floor(seconds / 3600)}h ago`;
    return `Updated ${Math.floor(seconds / 86400)}d ago`;
  }

  function statusColor(percent) {
    return percent >= 75 ? "#22c55e" : percent >= 60 ? "#f59e0b" : "#ef4444";
  }

  function formatHistoryTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "Saved";
    return date.toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  function renderRing(percent) {
    const ring = $("ringFill");
    const label = $("attBadge");
    if (!Number.isFinite(percent)) {
      $("pctText").textContent = "--";
      ring.style.strokeDashoffset = CIRC;
      ring.style.stroke = "#334155";
      label.textContent = "No data — refresh attendance";
      label.className = "att-badge badge-unknown";
      return;
    }

    const rounded = Math.round(percent);
    $("pctText").textContent = `${rounded}%`;
    ring.style.strokeDasharray = CIRC;
    ring.style.strokeDashoffset = CIRC - (percent / 100) * CIRC;
    ring.style.stroke = statusColor(percent);
    if (rounded >= 75) {
      label.textContent = `✅ Safe — ${rounded}%`;
      label.className = "att-badge badge-safe";
    } else if (rounded >= 60) {
      label.textContent = `⚠️ At Risk — ${rounded}%`;
      label.className = "att-badge badge-warn";
    } else {
      label.textContent = `🚨 Low — ${rounded}%`;
      label.className = "att-badge badge-danger";
    }
  }

  function renderSubjectBars(subjects) {
    const chart = $("subjectChart");
    const empty = $("noSubjects");
    chart.replaceChildren();
    if (!subjects || subjects.length === 0) {
      chart.style.display = "none";
      empty.style.display = "block";
      return;
    }

    chart.style.display = "grid";
    empty.style.display = "none";
    subjects.slice(0, 12).forEach((subject) => {
      const percent = Math.round(Number(subject.percent));
      const item = document.createElement("div");
      item.className = "subject-bar-item";
      item.title = `${subject.name}: ${percent}%`;

      const name = document.createElement("div");
      name.className = "subject-bar-name";
      name.textContent = subject.name;

      const value = document.createElement("span");
      value.className = "subject-bar-value";
      value.textContent = `${percent}%`;
      value.style.color = statusColor(percent);

      const track = document.createElement("div");
      track.className = "subject-bar-track";
      const fill = document.createElement("div");
      fill.className = "subject-bar-fill";
      fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      fill.style.background = statusColor(percent);
      track.append(fill);

      item.append(name, value, track);
      chart.append(item);
    });
  }

  function renderSemesterHistory(records) {
    const list = $("semesterHistory");
    const empty = $("noSemesterHistory");
    list.replaceChildren();
    if (!records || records.length === 0) {
      list.style.display = "none";
      empty.style.display = "block";
      return;
    }
    list.style.display = "block";
    empty.style.display = "none";
    records.forEach((record) => {
      const row = document.createElement("div");
      row.className = "semester-row";
      const name = document.createElement("span");
      name.textContent = record.semester;
      const value = document.createElement("strong");
      value.textContent = `${Math.round(record.percent)}%`;
      value.style.color = statusColor(record.percent);
      row.append(name, value);
      list.append(row);
    });
  }

  function renderAttendanceHistory(records) {
    const list = $("attendanceHistory");
    const empty = $("noAttendanceHistory");
    list.replaceChildren();
    const snapshots = (records || [])
      .filter((record) => Number.isFinite(Number(record.percent)) && Number.isFinite(Number(record.recordedAt)))
      .slice(-12);
    if (snapshots.length === 0) {
      list.style.display = "none";
      empty.style.display = "block";
      return;
    }
    list.style.display = "block";
    empty.style.display = "none";
    const chart = document.createElement("div");
    chart.className = "attendance-chart";
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Attendance percentage over saved update times");
    chart.append(createAttendanceChart(snapshots));
    list.append(chart);

    snapshots.slice(-6).reverse().forEach((record, reversedIndex) => {
      const index = snapshots.length - 1 - reversedIndex;
      const previous = snapshots[index - 1];
      const row = document.createElement("div");
      row.className = "attendance-history-row";
      const date = document.createElement("span");
      date.textContent = formatHistoryTime(record.recordedAt);
      const change = document.createElement("span");
      change.className = "attendance-history-change";
      const delta = previous ? Number(record.percent) - Number(previous.percent) : 0;
      if (previous && delta !== 0) {
        change.textContent = `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)}%`;
        change.classList.add(delta > 0 ? "is-up" : "is-down");
      } else {
        change.textContent = previous ? "No change" : "First record";
      }
      const value = document.createElement("strong");
      value.textContent = `${Math.round(record.percent)}%`;
      value.style.color = statusColor(record.percent);
      row.append(date, change, value);
      list.append(row);
    });
  }

  function createAttendanceChart(records) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 300 116");
    const values = records.map((record) => Number(record.percent));
    const minimum = Math.max(0, Math.floor((Math.min(...values) - 3) / 5) * 5);
    const maximum = Math.min(100, Math.ceil((Math.max(...values) + 3) / 5) * 5);
    const range = Math.max(5, maximum - minimum);
    const x = (index) => records.length === 1 ? 150 : 18 + (index * 264) / (records.length - 1);
    const y = (value) => 12 + ((maximum - value) / range) * 72;
    const element = (name, attributes) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", name);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    };
    [minimum, maximum].forEach((value) => {
      svg.append(element("line", { x1: 18, y1: y(value), x2: 282, y2: y(value), class: "attendance-chart-grid" }));
      const label = element("text", { x: 0, y: y(value) + 3, class: "attendance-chart-label" });
      label.textContent = `${value}%`;
      svg.append(label);
    });
    const line = element("polyline", { points: records.map((record, index) => `${x(index)},${y(Number(record.percent))}`).join(" "), class: "attendance-chart-line" });
    svg.append(line);
    records.forEach((record, index) => {
      const point = element("circle", { cx: x(index), cy: y(Number(record.percent)), r: 4, fill: statusColor(Number(record.percent)), class: "attendance-chart-point" });
      const title = element("title", {});
      title.textContent = `${formatHistoryTime(record.recordedAt)}: ${Number(record.percent).toFixed(1)}%`;
      point.append(title);
      svg.append(point);
    });
    const first = element("text", { x: 18, y: 108, class: "attendance-chart-label" });
    first.textContent = formatHistoryTime(records[0].recordedAt);
    const last = element("text", { x: 282, y: 108, class: "attendance-chart-label", "text-anchor": "end" });
    last.textContent = records.length > 1 ? formatHistoryTime(records.at(-1).recordedAt) : "";
    svg.append(first, last);
    return svg;
  }

  function renderProfile(data) {
    const name = data.studentName || "Student";
    const image = $("profileBigImg");
    const initial = $("profileBigInit");
    const headerImage = $("headerAvatar");
    const headerInitial = $("headerInitials");
    const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "👤";

    $("profileName").textContent = name;
    $("statOverall").textContent = Number.isFinite(data.attendancePercent) ? `${Math.round(data.attendancePercent)}%` : "--";
    const subjects = data.subjects || [];
    $("statSafe").textContent = subjects.length ? subjects.filter((subject) => subject.percent >= 75).length : "--";
    $("statLow").textContent = subjects.length ? subjects.filter((subject) => subject.percent < 60).length : "--";
    $("piSubjectCount").textContent = subjects.length || "--";
    $("piUpdated").textContent = timeAgo(data.lastUpdated) || "--";

    if (data.profileImage) {
      image.src = data.profileImage;
      image.style.display = "block";
      initial.style.display = "none";
      headerImage.src = data.profileImage;
      headerImage.style.display = "block";
      headerInitial.style.display = "none";
    } else {
      image.removeAttribute("src");
      image.style.display = "none";
      initial.textContent = initials;
      initial.style.display = "flex";
      headerImage.removeAttribute("src");
      headerImage.style.display = "none";
      headerInitial.textContent = initials;
      headerInitial.style.display = "flex";
    }
    renderSemesterHistory(data.semesterRecords || []);
    renderAttendanceHistory(data.attendanceHistory || []);
  }

  function updatePortalLabels(portal) {
    const college = portal === "college";
    $("headerPortalLabel").textContent = college ? "LNCT College Portal" : "LNCT University Portal";
    $("profilePortalBadge").textContent = college ? "LNCT College" : "LNCT University";
    $("piPortal").textContent = college ? "LNCT College" : "LNCT University";
    $("portalLogo").src = "icons/lnct-college-logo.png";
    $("portalLogo").alt = college ? "LNCT College" : "LNCT University";
  }

  function renderSession(session) {
    const status = session && session.status;
    const dot = $("sessionDot");
    if (status === "active") {
      dot.className = "dot";
      $("sessionTxt").textContent = "Portal session active";
    } else if (status === "expired") {
      dot.className = "dot off";
      $("sessionTxt").textContent = "Session expired — open Attendance to sign in";
    } else if (status === "error") {
      dot.className = "dot off";
      $("sessionTxt").textContent = "Portal unreachable — try Refresh again";
    } else {
      dot.className = "dot off";
      $("sessionTxt").textContent = "Refresh to check your session";
    }
  }

  async function loadPortal(portal) {
    const stored = await storageGet(["portalAttendance", "sessionStatus", "keepAlive", "autoLogin", "username"]);
    const data = (stored.portalAttendance && stored.portalAttendance[portal]) || {};
    portalSelect.value = portal;
    $("toggleKeepAlive").checked = Boolean(stored.keepAlive);
    $("toggleAutoLogin").checked = Boolean(stored.autoLogin);
    updatePortalLabels(portal);
    renderRing(data.attendancePercent);
    renderSubjectBars(data.subjects || []);
    renderProfile(data);
    $("lastUpd").textContent = timeAgo(data.lastUpdated);
    renderSession(stored.sessionStatus && stored.sessionStatus[portal]);
  }

  function mergeProfile(attendance, profile) {
    if (!profile) return attendance;
    return {
      ...attendance,
      studentName: profile.studentName || attendance.studentName,
      profileImage: profile.profileImage || attendance.profileImage,
      semesterRecords: profile.semesterRecords.length ? profile.semesterRecords : attendance.semesterRecords
    };
  }

  async function refresh() {
    refreshButton.disabled = true;
    refreshButton.classList.add("is-loading");
    refreshButton.title = "Refreshing live attendance…";
    $("sessionTxt").textContent = "Checking the LNCT portal…";
    try {
      const liveResult = await message({ action: "refreshActiveAttendance", portal: currentPortal });
      let data;
      let source = "live page";
      if (liveResult && liveResult.success) {
        data = liveResult.data;
      } else {
        const result = await message({ action: "refreshPortalData", portal: currentPortal });
        if (!result || !result.success) {
          throw new Error((liveResult && liveResult.message) || (result && result.message) || "Refresh failed. Please try again.");
        }
        data = globalThis.LNCTAttendanceParser.parseHtml(result.attendanceHtml, result.attendanceUrl);
        if (result.profileHtml) {
          data = mergeProfile(data, globalThis.LNCTAttendanceParser.parseHtml(result.profileHtml, result.profileUrl || result.attendanceUrl));
        }
        source = "portal session";
      }
      if (!data.hasAttendance) throw new Error("The portal page did not contain a recognised attendance table.");
      const saved = await message({ action: "attendanceData", portal: currentPortal, data });
      if (!saved || !saved.success) throw new Error((saved && saved.message) || "Could not save refreshed attendance.");
      renderRing(saved.data.attendancePercent);
      renderSubjectBars(saved.data.subjects || []);
      renderProfile(saved.data);
      $("lastUpd").textContent = timeAgo(saved.data.lastUpdated);
      renderSession({ status: "active" });
      $("sessionTxt").textContent = `Updated from ${source}`;
    } catch (error) {
      $("sessionTxt").textContent = error.message;
    } finally {
      refreshButton.classList.remove("is-loading");
      refreshButton.title = "Refresh live attendance";
      refreshButton.disabled = false;
    }
  }

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $(`tab-${button.dataset.tab}`).classList.add("active");
    });
  });

  portalSelect.addEventListener("change", async () => {
    currentPortal = portalSelect.value;
    await storageSet({ portal: currentPortal });
    await message({ action: "setActivePortal", portal: currentPortal });
    loadPortal(currentPortal);
  });

  refreshButton.addEventListener("click", refresh);
  $("btnAttendance").addEventListener("click", () => {
    $("btnAttendance").textContent = "⏳ Opening…";
    $("btnAttendance").disabled = true;
    chrome.runtime.sendMessage({ action: "openAttendance" }, () => window.close());
  });
  $("btnOptions").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });
  $("toggleKeepAlive").addEventListener("change", async function () {
    await storageSet({ keepAlive: this.checked });
    chrome.runtime.sendMessage({ action: this.checked ? "startPing" : "stopPing" });
  });
  $("toggleAutoLogin").addEventListener("change", function () { storageSet({ autoLogin: this.checked }); });

  $("btnLinkedIn").addEventListener("click", () => chrome.tabs.create({ url: "https://www.linkedin.com/in/vishwajeet-kumar-752606237/" }));
  $("btnDevGithub").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/VishwajeetCSE" }));
  $("btnTeam1").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/VishwajeetCSE" }));
  $("btnTeam2").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/utpalupadhyay" }));
  $("btnRepo").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/VishwajeetCSE/Attendance-LNCT" }));

  function closeAbout() {
    const overlay = $("aboutOverlay");
    overlay.classList.remove("is-open");
    overlay.hidden = true;
  }

  $("btnAboutFab").addEventListener("click", () => {
    const overlay = $("aboutOverlay");
    overlay.hidden = false;
    overlay.classList.add("is-open");
    $("btnCloseAbout").focus();
  });
  $("btnCloseAbout").addEventListener("click", closeAbout);
  $("aboutOverlay").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeAbout();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("aboutOverlay").hidden) closeAbout();
  });

  storageGet("portal").then((stored) => {
    currentPortal = stored.portal === "college" ? "college" : "university";
    loadPortal(currentPortal);
  });
});
