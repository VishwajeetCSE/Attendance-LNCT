// attendance_scraper.js - Scrapes attendance % from the attendance page
// Injected on: StuAttendanceStatus.aspx

(function () {
  "use strict";
  console.log("[LNCT] Attendance page scraper running.");

  function extractAttendancePercent() {
    // Strategy 1: Look for elements containing % symbol
    const allText = document.body.innerText;
    
    // Try to find overall/total attendance percentage
    // Common patterns in ASP.NET attendance tables:
    // "Overall Attendance: 78.5%"  |  "75%"  |  "Total: 80.00%"

    // ── Pattern A: Explicit "Overall" or "Total" label ──
    const overallPattern = /(?:overall|total|grand)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*%/gi;
    let match = overallPattern.exec(allText);
    if (match) {
      const pct = parseFloat(match[1]);
      console.log("[LNCT] Found overall attendance (pattern A):", pct);
      return pct;
    }

    // ── Pattern B: Look in table cells for percentage values ──
    const cells = document.querySelectorAll("td, th, span, label, div");
    let percentages = [];

    cells.forEach(cell => {
      const text = cell.textContent.trim();
      // Match "78.5%" or "78%" patterns
      const pctMatch = text.match(/^(\d{1,3}(?:\.\d{1,2})?)%$/);
      if (pctMatch) {
        percentages.push(parseFloat(pctMatch[1]));
      }
    });

    if (percentages.length > 0) {
      // Use the last or minimum percentage found (often "overall" is at bottom)
      // Filter to valid attendance range (1-100)
      const valid = percentages.filter(p => p >= 1 && p <= 100);
      if (valid.length > 0) {
        // Return the overall (often the last percentage in the table represents total)
        const overall = valid[valid.length - 1];
        console.log("[LNCT] Found attendance (pattern B):", overall, "from", valid);
        return overall;
      }
    }

    // ── Pattern C: Scan all text nodes for % patterns ──
    const genericPct = allText.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/g);
    if (genericPct && genericPct.length > 0) {
      const nums = genericPct.map(s => parseFloat(s)).filter(n => n >= 1 && n <= 100);
      if (nums.length > 0) {
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        console.log("[LNCT] Found attendance (pattern C) - avg:", avg, "from", nums);
        return Math.round(avg * 10) / 10;
      }
    }

    console.warn("[LNCT] Could not extract attendance percentage from page.");
    return null;
  }

  function extractSubjectWise() {
    // Try to extract subject-wise attendance for the popup detail view
    const rows = document.querySelectorAll("table tr");
    const subjects = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 3) {
        const lastCell = cells[cells.length - 1].textContent.trim();
        const pctMatch = lastCell.match(/(\d{1,3}(?:\.\d{1,2})?)%?/);
        const subjectName = cells[0].textContent.trim();
        
        if (pctMatch && subjectName && subjectName.length > 2 && subjectName.length < 100) {
          const pct = parseFloat(pctMatch[1]);
          if (pct >= 0 && pct <= 100) {
            subjects.push({ name: subjectName, percent: pct });
          }
        }
      }
    });

    return subjects.slice(0, 10); // Max 10 subjects
  }

  // Wait for page to fully render (tables may load after DOM)
  function runScraper() {
    const percent = extractAttendancePercent();
    const subjects = extractSubjectWise();

    if (percent !== null) {
      chrome.runtime.sendMessage({
        action: "attendanceData",
        percent: percent,
        subjects: subjects,
        pageUrl: window.location.href
      });
    } else {
      // Retry once after a delay (some pages render tables late)
      setTimeout(() => {
        const retryPct = extractAttendancePercent();
        if (retryPct !== null) {
          chrome.runtime.sendMessage({
            action: "attendanceData",
            percent: retryPct,
            subjects: extractSubjectWise(),
            pageUrl: window.location.href
          });
        }
      }, 2000);
    }
  }

  // Run after DOM is settled
  if (document.readyState === "complete") {
    setTimeout(runScraper, 1000);
  } else {
    window.addEventListener("load", () => setTimeout(runScraper, 1000));
  }

})();
