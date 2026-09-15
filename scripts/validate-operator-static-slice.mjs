import fs from "node:fs";

const failures = [];
const read = (path) => fs.readFileSync(path, "utf8");
const mustInclude = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(`${label}: missing ${needle}`);
};
const mustExclude = (text, needle, label) => {
  if (text.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
};

const index = read("index.html");
const protectedShell = read("protected-shell.html");
const systemCss = read("css/operator-system.css");
const surfaceCss = read("css/operator-surfaces.css");
const viewState = read("js/operator-view-state.js");

for (const [path, source] of [["index.html", index], ["protected-shell.html", protectedShell]]) {
  mustInclude(source, 'data-design-system="operator"', path);
  mustInclude(source, "css/operator-system.css", path);
  mustInclude(source, "css/operator-surfaces.css", path);
  mustExclude(source, "scan-line", path);
  mustExclude(source, "js/grid.js", path);
}

for (const token of [
  "--surface-page: var(--source-dove)",
  "--surface-plate: var(--source-dove)",
  "--surface-recess: var(--source-ivory)",
  "--action-primary: var(--source-oak)",
  "--content-primary: var(--source-espresso)",
  "--boundary-authority: var(--source-walnut)"
]) mustInclude(systemCss, token, "operator semantic tokens");

mustInclude(systemCss, "scroll-behavior: auto !important", "reduced-motion root override");
mustInclude(systemCss, ":focus-visible", "keyboard focus treatment");
mustInclude(`${systemCss}\n${surfaceCss}`, "overflow-x: clip", "horizontal overflow containment");
mustInclude(surfaceCss, "@media (max-width: 767px)", "narrow composition");

for (const phrase of [
  "operator-identity",
  "Explore a review",
  "Selected proof",
  "Current Work",
  "Inspect evidence",
  "Decision → Result"
]) mustInclude(`${index}\n${protectedShell}`, phrase, "bounded slice");

for (const hook of [
  'data-action="stage-local-candidate"',
  'data-action="run-local-review"',
  'data-action="save-workspace-state"',
  'data-action="load-saved-workspace-state"',
  "data-protected-shell-boundary"
]) mustInclude(protectedShell, hook, "protected behavior boundary");

for (const behavior of ["inspect-evidence", "back-to-work", "aetherus:review-complete", "focus({ preventScroll: true })"]) {
  mustInclude(viewState, behavior, "progressive disclosure behavior");
}

for (const forbidden of ["cyan", "neon", "scan line", "cyber grid"]) {
  mustExclude(`${index}\n${protectedShell}\n${systemCss}\n${surfaceCss}`.toLowerCase(), forbidden, "Operator slice atmosphere");
}

if (failures.length) {
  console.error("Operator static slice validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Operator static slice validation passed.");
