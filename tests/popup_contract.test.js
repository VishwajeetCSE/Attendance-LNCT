const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const popupHtml = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const popupScript = fs.readFileSync(path.join(root, "popup.js"), "utf8");

test("the popup contains every statically referenced element", () => {
  const ids = [...popupScript.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]);
  const missing = [...new Set(ids)].filter((id) => !popupHtml.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
});

test("the shared parser is loaded before the popup controller", () => {
  assert.ok(popupHtml.indexOf('src="attendance_parser.js"') < popupHtml.indexOf('src="popup.js"'));
});

test("the popup exposes circular refresh and floating About controls", () => {
  assert.match(popupHtml, /id="btnRefreshCircle"/);
  assert.match(popupHtml, /id="btnAboutFab"/);
  assert.match(popupHtml, /id="aboutOverlay"/);
});
