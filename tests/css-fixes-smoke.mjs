import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = await fs.readFile(path.join(projectRoot, "assets/css/app.css"), "utf8");

assert(
  /\.section-head\s*{[^}]*justify-content:\s*space-between/s.test(css),
  "Expected a .section-head rule with justify-content: space-between"
);

assert(
  /\.topic-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,/s.test(css),
  "Expected .topic-grid to use a 3-column grid"
);
assert(
  /\.feature-grid\s*{[^}]*grid-template-columns:\s*repeat\(4,/s.test(css),
  "Expected .feature-grid to keep its 4-column grid"
);

console.log("css-fixes-smoke: OK");
