// Shared, DOM-based parser for LNCT AccSoft attendance and profile pages.
// It supports both percentage columns and the live portal's Total Class Held / Present Count layout.
(function () {
  "use strict";

  function normalise(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function numberFrom(value) {
    const match = normalise(value).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function percentFrom(value, allowPlainNumber) {
    const text = normalise(value);
    const match = text.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/);
    const plain = allowPlainNumber && text.match(/^(\d{1,3}(?:\.\d{1,2})?)$/);
    const number = Number(match ? match[1] : plain ? plain[1] : NaN);
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
  }

  function percentFromCounts(total, present) {
    if (!Number.isFinite(total) || !Number.isFinite(present) || total <= 0 || present < 0 || present > total) return null;
    return Math.round((present / total) * 10000) / 100;
  }

  function cells(row) {
    return Array.from(row.querySelectorAll(":scope > th, :scope > td"));
  }

  function findIndex(labels, pattern) {
    return labels.findIndex((label) => pattern.test(label));
  }

  function headerFor(table) {
    const rows = Array.from(table.querySelectorAll("tr")).slice(0, 6);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const rowCells = cells(rows[rowIndex]);
      const labels = rowCells.map((cell) => normalise(cell.textContent).toLowerCase());
      const subjectIndex = findIndex(labels, /\b(subject|course|paper|module)\b/);
      const semesterIndex = findIndex(labels, /\b(semester|sem\.?|term|class)\b/);
      const percentIndex = findIndex(labels, /attendance|percentage|percent|\b%\b/);
      const totalIndex = findIndex(labels, /total\s*(class|classes|held)|classes?\s*held|\btotal\b/);
      let presentIndex = findIndex(labels, /net\s*present/);
      if (presentIndex === -1) presentIndex = findIndex(labels, /present\s*(count|class|classes)?/);

      const supportsSubjects = subjectIndex !== -1 && (percentIndex !== -1 || (totalIndex !== -1 && presentIndex !== -1));
      const supportsSemesters = semesterIndex !== -1 && percentIndex !== -1;
      if (supportsSubjects || supportsSemesters) {
        return { rowIndex, subjectIndex, semesterIndex, percentIndex, totalIndex, presentIndex };
      }
    }
    return null;
  }

  function cleanSubjectName(value) {
    return normalise(value)
      .replace(/^\d+\s*[.)-]\s*/, "")
      .replace(/^(subject|course)\s*[:-]\s*/i, "");
  }

  function subjectDataFrom(document) {
    let best = { subjects: [], totalClasses: 0, presentClasses: 0 };
    Array.from(document.querySelectorAll("table")).forEach((table) => {
      const header = headerFor(table);
      if (!header || header.subjectIndex === -1) return;

      const subjects = [];
      let totalClasses = 0;
      let presentClasses = 0;
      Array.from(table.querySelectorAll("tr")).slice(header.rowIndex + 1).forEach((row) => {
        const rowCells = cells(row);
        const nameCell = rowCells[header.subjectIndex];
        if (!nameCell) return;

        const name = cleanSubjectName(nameCell.textContent);
        if (!name || name.length > 120 || /^(total|overall|grand total)$/i.test(name)) return;

        let percent = header.percentIndex !== -1 && rowCells[header.percentIndex]
          ? percentFrom(rowCells[header.percentIndex].textContent, true)
          : null;
        const total = header.totalIndex !== -1 && rowCells[header.totalIndex]
          ? numberFrom(rowCells[header.totalIndex].textContent)
          : null;
        const present = header.presentIndex !== -1 && rowCells[header.presentIndex]
          ? numberFrom(rowCells[header.presentIndex].textContent)
          : null;

        if (percent === null) percent = percentFromCounts(total, present);
        if (percent === null) return;
        subjects.push({ name, percent });
        if (Number.isFinite(total) && Number.isFinite(present) && total > 0 && present >= 0 && present <= total) {
          totalClasses += total;
          presentClasses += present;
        }
      });

      if (subjects.length > best.subjects.length) best = { subjects, totalClasses, presentClasses };
    });

    const unique = new Map();
    best.subjects.forEach((subject) => {
      const key = subject.name.toLowerCase();
      if (!unique.has(key)) unique.set(key, subject);
    });
    return { subjects: Array.from(unique.values()).slice(0, 20), totalClasses: best.totalClasses, presentClasses: best.presentClasses };
  }

  function overallFrom(document, subjectData) {
    const explicitPattern = /\b(?:present|attendance)\s*%\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*%?/i;
    for (const element of document.querySelectorAll("td, th, div, span, label, p, li")) {
      const match = normalise(element.textContent).match(explicitPattern);
      if (match) return percentFrom(match[1], true);
    }

    const labelPattern = /\b(overall|grand|total)\b.*\b(attendance|percentage|percent)\b|\b(attendance|percentage|percent)\b.*\b(overall|grand|total)\b/i;
    for (const row of document.querySelectorAll("tr")) {
      const rowCells = cells(row);
      const labelCell = rowCells.find((cell) => labelPattern.test(normalise(cell.textContent)));
      if (!labelCell) continue;
      for (const cell of rowCells) {
        if (cell === labelCell) continue;
        const percentage = percentFrom(cell.textContent, true);
        if (percentage !== null) return percentage;
      }
    }

    const text = normalise(document.body ? document.body.textContent : "");
    const match = text.match(/(?:overall|grand|total)\s+(?:attendance\s+)?(?:percentage\s+)?[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*%/i);
    if (match) return percentFrom(match[1], true);

    return percentFromCounts(subjectData.totalClasses, subjectData.presentClasses);
  }

  function selectedSemesterFrom(document) {
    for (const select of document.querySelectorAll("select")) {
      const options = Array.from(select.options || []);
      const looksLikeSemester = options.some((option) => /\b\d+(?:st|nd|rd|th)\s+semester\b|\bsemester\b/i.test(normalise(option.textContent)));
      if (!looksLikeSemester) continue;
      const selected = options.find((option) => option.selected) || options.find((option) => option.value === select.value);
      const semester = selected && normalise(selected.textContent);
      if (semester && !/^--\s*select/i.test(semester)) return semester;
    }
    return null;
  }

  function semesterNumber(label) {
    const match = normalise(label).match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  }

  function semesterRecordsFrom(document) {
    const records = [];
    Array.from(document.querySelectorAll("table")).forEach((table) => {
      const header = headerFor(table);
      if (!header || header.semesterIndex === -1 || header.percentIndex === -1) return;
      Array.from(table.querySelectorAll("tr")).slice(header.rowIndex + 1).forEach((row) => {
        const rowCells = cells(row);
        const semesterCell = rowCells[header.semesterIndex];
        const percentCell = rowCells[header.percentIndex];
        if (!semesterCell || !percentCell) return;
        const semester = normalise(semesterCell.textContent);
        const percent = percentFrom(percentCell.textContent, true);
        if (semester && semester.length < 80 && percent !== null) records.push({ semester, percent });
      });
    });

    const unique = new Map();
    records.forEach((record) => unique.set(record.semester.toLowerCase(), record));
    return Array.from(unique.values()).sort((a, b) => semesterNumber(a.semester) - semesterNumber(b.semester));
  }

  function absoluteUrl(value, baseUrl) {
    try { return new URL(value, baseUrl).href; } catch (_) { return null; }
  }

  function profileImageFrom(document, baseUrl) {
    const selector = [
      "img[id*='photo' i]", "img[id*='image' i]", "img[id*='pic' i]", "img[id*='avatar' i]",
      "img[class*='photo' i]", "img[class*='profile' i]", "img[src*='student' i]", ".student-photo img", ".profile-img img"
    ].join(",");
    for (const image of document.querySelectorAll(selector)) {
      const source = image.getAttribute("src");
      if (!source || /\b(logo|icon|default|blank)\b/i.test(source)) continue;
      const url = absoluteUrl(source, baseUrl);
      if (url) return url;
    }
    return null;
  }

  function studentNameFrom(document) {
    for (const row of document.querySelectorAll("tr")) {
      const rowCells = cells(row);
      const labelIndex = rowCells.findIndex((cell) => /^(student\s*)?name\s*:?$/i.test(normalise(cell.textContent)));
      if (labelIndex !== -1 && rowCells[labelIndex + 1]) {
        const name = normalise(rowCells[labelIndex + 1].textContent);
        if (/^[A-Za-z][A-Za-z .'-]{2,79}$/.test(name)) return name;
      }
    }
    const text = normalise(document.body ? document.body.textContent : "");
    const match = text.match(/(?:student\s*)?name\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,79})/i);
    return match ? normalise(match[1]) : null;
  }

  function parseDocument(document, baseUrl) {
    const subjectData = subjectDataFrom(document);
    const attendancePercent = overallFrom(document, subjectData);
    return {
      attendancePercent,
      subjects: subjectData.subjects,
      selectedSemester: selectedSemesterFrom(document),
      semesterRecords: semesterRecordsFrom(document),
      profileImage: profileImageFrom(document, baseUrl),
      studentName: studentNameFrom(document),
      hasAttendance: attendancePercent !== null || subjectData.subjects.length > 0
    };
  }

  function parseHtml(html, baseUrl) {
    if (typeof DOMParser === "undefined") throw new Error("DOMParser is unavailable");
    return parseDocument(new DOMParser().parseFromString(html, "text/html"), baseUrl);
  }

  globalThis.LNCTAttendanceParser = {
    parseDocument,
    parseHtml,
    __test: { normalise, numberFrom, percentFrom, percentFromCounts, semesterNumber }
  };
})();
