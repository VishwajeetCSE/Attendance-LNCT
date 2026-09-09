// popup.js v3.0 — Tabs, ring, subject bar graph, profile, about links

const CIRC = 2 * Math.PI * 45; // SVG ring circumference

document.addEventListener("DOMContentLoaded", () => {

  // ── Element refs ──
  const $ = id => document.getElementById(id);
  const ringFill      = $("ringFill");
  const pctText       = $("pctText");
  const attBadge      = $("attBadge");
  const lastUpd       = $("lastUpd");
  const barChart      = $("barChart");
  const noSubjects    = $("noSubjects");
  const sessionDot    = $("sessionDot");
  const sessionTxt    = $("sessionTxt");
  const portalSelect  = $("portalSelect");
  const headerAvatar  = $("headerAvatar");
  const headerInitials= $("headerInitials");
  const headerPortal  = $("headerPortalLabel");

  // ── Tab switching ──
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      $("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ── Time ago ──
  function timeAgo(ts) {
    if (!ts) return "";
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return "Updated just now";
    if (d < 3600) return `Updated ${Math.floor(d/60)}m ago`;
    if (d < 86400) return `Updated ${Math.floor(d/3600)}h ago`;
    return `Updated ${Math.floor(d/86400)}d ago`;
  }

  // ── Render ring ──
  function renderRing(pct) {
    if (pct == null) {
      pctText.textContent = "--";
      ringFill.style.strokeDashoffset = CIRC;
      ringFill.style.stroke = "#334155";
      attBadge.textContent = "No data — click View Attendance";
      attBadge.className = "att-badge badge-unknown";
      return;
    }
    const p = Math.round(pct);
    pctText.textContent = p + "%";
    ringFill.style.strokeDasharray  = CIRC;
    ringFill.style.strokeDashoffset = CIRC - (pct / 100) * CIRC;
    if (p >= 75) {
      ringFill.style.stroke = "#22c55e";
      attBadge.textContent = "✅ Safe — " + p + "%";
      attBadge.className = "att-badge badge-safe";
    } else if (p >= 60) {
      ringFill.style.stroke = "#f59e0b";
      attBadge.textContent = "⚠️ At Risk — " + p + "%";
      attBadge.className = "att-badge badge-warn";
    } else {
      ringFill.style.stroke = "#ef4444";
      attBadge.textContent = "🚨 Low — " + p + "%";
      attBadge.className = "att-badge badge-danger";
    }
  }

  // ── Render subject bar chart ──
  function renderBars(subjects) {
    if (!subjects || subjects.length === 0) {
      barChart.style.display = "none";
      noSubjects.style.display = "block";
      return;
    }
    barChart.style.display = "flex";
    noSubjects.style.display = "none";
    barChart.innerHTML = "";

    // Show max 10 subjects
    const list = subjects.slice(0, 10);
    const maxPct = Math.max(...list.map(s => s.percent), 100);

    list.forEach(sub => {
      const pct = Math.round(sub.percent);
      const heightPct = (pct / maxPct) * 100;
      const color = pct >= 75 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";

      const col = document.createElement("div");
      col.className = "bar-col";
      col.title = `${sub.name}: ${pct}%`;

      col.innerHTML = `
        <div class="bar-pct-label">${pct}%</div>
        <div class="bar-track">
          <div class="danger-line"></div>
          <div class="bar-fill" style="height:${heightPct}%;background:${color};"></div>
        </div>
        <div class="bar-name">${sub.name}</div>`;
      barChart.appendChild(col);
    });
  }

  // ── Render profile tab ──
  function renderProfile(data) {
    const name = data.studentName || "Student";
    $("profileName").textContent = name;
    $("statOverall").textContent = data.attendancePercent != null ? Math.round(data.attendancePercent) + "%" : "--";

    const subs = data.subjects || [];
    const safe = subs.filter(s => s.percent >= 75).length;
    const low  = subs.filter(s => s.percent < 60).length;
    $("statSafe").textContent = subs.length ? safe : "--";
    $("statLow").textContent  = subs.length ? low  : "--";
    $("piSubjectCount").textContent = subs.length || "--";
    $("piUpdated").textContent = timeAgo(data.lastUpdated) || "--";

    if (data.profileImage) {
      $("profileBigImg").src = data.profileImage;
      $("profileBigImg").style.display = "block";
      $("profileBigInit").style.display = "none";
      headerAvatar.src = data.profileImage;
      headerAvatar.style.display = "block";
      headerInitials.style.display = "none";
    } else {
      const initials = name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "👤";
      headerInitials.textContent = initials;
      $("profileBigInit").textContent = initials;
    }
  }

  // ── Load all data ──
  chrome.storage.sync.get(["keepAlive","autoLogin","username","portal"], syncData => {
    $("toggleKeepAlive").checked = !!syncData.keepAlive;
    $("toggleAutoLogin").checked = !!syncData.autoLogin;
    portalSelect.value = syncData.portal || "university";
    updatePortalLabel(syncData.portal || "university");

    const hasCredentials = !!syncData.username;
    if (syncData.keepAlive && hasCredentials) {
      sessionDot.classList.remove("off"); sessionTxt.textContent = "Keep-alive active";
    } else if (!hasCredentials) {
      sessionDot.classList.add("off"); sessionTxt.textContent = "Save credentials first";
    } else {
      sessionDot.classList.add("off"); sessionTxt.textContent = "Keep-alive disabled";
    }

    chrome.storage.local.get(["attendancePercent","subjects","profileImage","studentName","lastUpdated"], localData => {
      renderRing(localData.attendancePercent ?? null);
      renderBars(localData.subjects || []);
      renderProfile({ ...localData, ...syncData });
      if (localData.lastUpdated) lastUpd.textContent = timeAgo(localData.lastUpdated);
    });
  });

  // ── Portal label ──
  function updatePortalLabel(val) {
    if (val === "college") {
      headerPortal.textContent = "LNCT College Portal";
      $("profilePortalBadge").textContent = "LNCT College";
      $("piPortal").textContent = "LNCT College";
    } else {
      headerPortal.textContent = "University Portal";
      $("profilePortalBadge").textContent = "LNCT University";
      $("piPortal").textContent = "LNCT University";
    }
  }

  // ── Portal switch ──
  portalSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ portal: portalSelect.value });
    updatePortalLabel(portalSelect.value);
  });

  // ── Buttons ──
  $("btnAttendance").addEventListener("click", () => {
    $("btnAttendance").textContent = "⏳ Opening...";
    $("btnAttendance").disabled = true;
    chrome.runtime.sendMessage({ action: "openAttendance" }, () => window.close());
  });
  $("btnOptions").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });

  // ── Toggles ──
  $("toggleKeepAlive").addEventListener("change", function() {
    chrome.storage.sync.set({ keepAlive: this.checked });
    chrome.runtime.sendMessage({ action: this.checked ? "startPing" : "stopPing" });
  });
  $("toggleAutoLogin").addEventListener("change", function() {
    chrome.storage.sync.set({ autoLogin: this.checked });
  });

  // ── About links ──
  $("btnLinkedIn").addEventListener("click", () => chrome.tabs.create({ url: "https://www.linkedin.com/in/vishwajeet-kumar-752606237/" }));
  $("btnDevGithub").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/VishwajeetCSE" }));
  $("btnTeam1").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/VishwajeetCSE" }));
  $("btnTeam2").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/utpalupadhyay" }));
  $("btnRepo").addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/VishwajeetCSE/Attendance-LNCT" }));
});
