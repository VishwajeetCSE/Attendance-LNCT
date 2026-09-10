const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "attendance_parser.js"), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context, { filename: "attendance_parser.js" });
const parser = context.globalThis.LNCTAttendanceParser.__test;

test("accepts percentage text and valid numeric percentage cells", () => {
  assert.equal(parser.percentFrom(" 76.25% ", false), 76.25);
  assert.equal(parser.percentFrom("76.25", true), 76.25);
  assert.equal(parser.percentFrom("76.25", false), null);
});

test("rejects invalid attendance values", () => {
  assert.equal(parser.percentFrom("101%", true), null);
  assert.equal(parser.percentFrom("12 classes", true), null);
  assert.equal(parser.percentFrom("", true), null);
});

test("calculates real subject attendance from Total Class Held and Present Count", () => {
  assert.equal(parser.percentFromCounts(28, 25), 89.29);
  assert.equal(parser.percentFromCounts(35, 25), 71.43);
  assert.equal(parser.percentFromCounts(0, 0), null);
  assert.equal(parser.percentFromCounts(10, 11), null);
});

test("normalises portal whitespace and orders numerical semesters", () => {
  assert.equal(parser.normalise("  Data\u00a0  Structures \n"), "Data Structures");
  assert.equal(parser.semesterNumber("Semester 10"), 10);
  assert.equal(parser.semesterNumber("Semester 2"), 2);
});
