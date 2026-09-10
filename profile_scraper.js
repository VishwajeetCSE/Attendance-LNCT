// Captures student details whenever an authenticated AccSoft profile page is visited.
(function () {
  "use strict";
  const portal = location.hostname === "portal.lnct.ac.in" ? "college" : "university";

  function capture() {
    const data = globalThis.LNCTAttendanceParser.parseDocument(document, location.href);
    if (!data.studentName && !data.profileImage && !data.semesterRecords.length) return;
    chrome.runtime.sendMessage({ action: "profileData", portal, data });
  }

  if (document.readyState === "complete") {
    setTimeout(capture, 1200);
    setTimeout(capture, 3000);
  } else {
    window.addEventListener("load", () => {
      setTimeout(capture, 1200);
      setTimeout(capture, 3000);
    }, { once: true });
  }
})();
