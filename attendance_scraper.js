// attendance_scraper.js v3.0
// Extracts: overall %, subject-wise %, profile photo, student name

(function () {
  "use strict";
  console.log("[LNCT] Attendance scraper running on:", window.location.href);

  // ── Extract overall attendance % ──
  function getOverallPercent() {
    const bodyText = document.body.innerText;

    // Pattern A: explicit overall/total label
    const pA = /(?:overall|total|grand)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*%/gi;
    let m = pA.exec(bodyText);
    if (m) return parseFloat(m[1]);

    // Pattern B: cells with standalone "XX%" or "XX.XX%"
    const cells = [...document.querySelectorAll("td, th, span, div, label, p")];
    const pcts = [];
    cells.forEach(el => {
      const t = el.textContent.trim();
      if (/^(\d{1,3}(?:\.\d{1,2})?)%$/.test(t)) {
        const v = parseFloat(t);
        if (v >= 0 && v <= 100) pcts.push(v);
      }
    });
    if (pcts.length) return pcts[pcts.length - 1];

    // Pattern C: generic % in text
    const all = bodyText.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/g) || [];
    const nums = all.map(s => parseFloat(s)).filter(n => n >= 0 && n <= 100);
    if (nums.length) return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;

    return null;
  }

  // ── Extract subject-wise attendance ──
  function getSubjects() {
    const subjects = [];
    const rows = [...document.querySelectorAll("table tr")];
    rows.forEach(row => {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 3) return;
      const nameCell = cells[0].textContent.trim();
      const lastCell = cells[cells.length - 1].textContent.trim();
      const pctMatch = lastCell.match(/(\d{1,3}(?:\.\d{1,2})?)/);
      if (!pctMatch || !nameCell || nameCell.length < 2 || nameCell.length > 80) return;
      const pct = parseFloat(pctMatch[1]);
      // Skip header rows and invalid values
      if (isNaN(pct) || pct > 100 || /subject|name|course|sr|s\.no/i.test(nameCell)) return;
      subjects.push({ name: nameCell.replace(/^\d+[\.\)]\s*/, "").trim(), percent: pct });
    });
    return subjects.slice(0, 12);
  }

  // ── Extract profile image ──
  function getProfileImage() {
    // Look for student photo — common patterns in AccSoft
    const selectors = [
      "img[id*='photo' i]",
      "img[id*='Photo' i]",
      "img[id*='image' i]",
      "img[id*='Image' i]",
      "img[id*='pic' i]",
      "img[id*='avatar' i]",
      "img[src*='photo' i]",
      "img[src*='Photo' i]",
      "img[src*='student' i]",
      "img[src*='Student' i]",
      ".student-photo img",
      ".profile-img img",
      "#imgPhoto",
      "#imgStudentPhoto"
    ];
    for (const sel of selectors) {
      const img = document.querySelector(sel);
      if (img && img.src && !img.src.includes("logo") && img.naturalWidth > 30) {
        return img.src;
      }
    }
    return null;
  }

  // ── Extract student name ──
  function getStudentName() {
    const patterns = [
      /(?:name|student)\s*[:\-]\s*([A-Za-z\s]{3,40})/i,
      /welcome[,\s]+([A-Za-z\s]{3,30})/i
    ];
    const text = document.body.innerText;
    for (const p of patterns) {
      const m = p.exec(text);
      if (m) return m[1].trim();
    }
    // Try heading/span elements with a proper name
    const headings = [...document.querySelectorAll("h1, h2, h3, span.student-name, #lblStudentName, #lblName")];
    for (const h of headings) {
      const t = h.textContent.trim();
      if (t.length > 3 && t.length < 50 && /^[A-Za-z\s]+$/.test(t)) return t;
    }
    return null;
  }

  function run() {
    const percent  = getOverallPercent();
    const subjects = getSubjects();
    const profileImage = getProfileImage();
    const studentName  = getStudentName();

    console.log("[LNCT] Scraped — %:", percent, "| Subjects:", subjects.length, "| Photo:", !!profileImage, "| Name:", studentName);

    if (percent !== null || subjects.length > 0) {
      chrome.runtime.sendMessage({ action: "attendanceData", percent: percent || 0, subjects, profileImage, studentName });
    } else {
      setTimeout(() => {
        const p2 = getOverallPercent();
        if (p2 !== null) chrome.runtime.sendMessage({ action: "attendanceData", percent: p2, subjects: getSubjects(), profileImage: getProfileImage(), studentName: getStudentName() });
      }, 2500);
    }
  }

  if (document.readyState === "complete") setTimeout(run, 1200);
  else window.addEventListener("load", () => setTimeout(run, 1200));
})();
