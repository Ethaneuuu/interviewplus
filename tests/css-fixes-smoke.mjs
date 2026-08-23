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

console.log("css-fixes-smoke: OK");
