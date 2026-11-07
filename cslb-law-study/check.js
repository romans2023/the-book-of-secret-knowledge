const fs = require("fs");
const vm = require("vm");
const path = require("path");
const context = { window: {}, console };
vm.createContext(context);
["lessons.js", "cards.js", "questions.js"].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "js", file), "utf8"), context, { filename: file });
});
const sections = context.window.CSLB_SECTIONS;
const ids = new Set(sections.map(function (s) { return s.id; }));
const weight = sections.reduce(function (sum, s) { return sum + s.weight; }, 0);
const cards = context.window.CSLB_CARDS;
const questions = context.window.CSLB_QUESTIONS;
const errors = [];
if (weight !== 100) errors.push("weights sum to " + weight);
sections.forEach(function (s) {
  if (!context.window.CSLB_LESSONS[s.id]) errors.push("missing lesson " + s.id);
});
cards.forEach(function (c, i) {
  if (!ids.has(c[0])) errors.push("card section " + i);
  if (!c[1] || !c[2]) errors.push("empty card " + i);
});
questions.forEach(function (q, i) {
  if (!ids.has(q[0])) errors.push("question section " + i);
  if (!q[2] || q[2].length !== 4) errors.push("choices " + i);
  if (q[3] < 0 || q[3] > 3) errors.push("answer " + i);
  if (!q[4] || /TODO|recalculate|Wait,/i.test(q[4] + q[1])) errors.push("placeholder " + i);
});
const by = {};
questions.forEach(function (q) { by[q[0]] = (by[q[0]] || 0) + 1; });
console.log("sections", sections.length, "weight", weight);
console.log("cards", cards.length);
console.log("questions", questions.length, by);
console.log("plan", context.window.CSLB_PLAN.length, "formulas", context.window.CSLB_FORMULAS.length);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("bank ok");
