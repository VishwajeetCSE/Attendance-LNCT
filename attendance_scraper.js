// Reads only tables whose headers explicitly identify subject and attendance columns.
(function () {
  "use strict";
  const portal = location.hostname === "portal.lnct.ac.in" ? "college" : "university";
  let lastSignature = "";

  function report() {
    const data = globalThis.LNCTAttendanceParser.parseDocument(document, location.href);
    if (!data.hasAttendance) return false;
    const signature = JSON.stringify([data.attendancePercent, data.selectedSemester, data.subjects]);
    if (signature === lastSignature) return true;
    lastSignature = signature;
    chrome.runtime.sendMessage({ action: "attendanceData", portal, data });
    return true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== "getLiveAttendance") return false;
    const data = globalThis.LNCTAttendanceParser.parseDocument(document, location.href);
    sendResponse(data.hasAttendance
      ? { success: true, portal, data }
      : { success: false, message: "The attendance table has not finished loading." });
    return false;
  });

  function run() {
    if (report()) return;
    // AccSoft pages can populate the attendance table after the load event.
    setTimeout(report, 2500);
  }

  if (document.readyState === "complete") setTimeout(run, 1000);
  else window.addEventListener("load", () => setTimeout(run, 1000), { once: true });

  // The Class selector can update the attendance table without navigating away.
  // Capture each selected semester as soon as the portal redraws its table.
  let mutationTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(report, 700);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
