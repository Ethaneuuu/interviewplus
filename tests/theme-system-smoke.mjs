import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(testsDir);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const css = await fs.readFile(path.join(projectRoot, "assets/css/app.css"), "utf8");

assert(/:root\s*{[^}]*color-scheme:\s*light dark/s.test(css), "Expected :root to default to a light theme with color-scheme: light dark");
assert(
  /@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)/.test(css),
  "Expected a prefers-color-scheme dark override guarded by :not([data-theme=\"light\"])"
);
assert(/:root\[data-theme="dark"\]\s*{/.test(css), "Expected an explicit :root[data-theme=\"dark\"] override block");
assert(/\.theme-toggle\s*{/.test(css), "Expected .theme-toggle button styles");
assert(/:root\[data-theme="dark"\] \.theme-toggle \.icon-sun\s*{\s*display: block/.test(css), "Expected the sun icon to show in dark theme");

assert(
  !/\.feature-grid\s*{\s*grid-template-columns:\s*repeat\(2,[^}]*}\s*\n\s*\.feature-card strong/.test(css),
  "Regression: a stray top-level .feature-grid override was silently downgrading the theme grid back to 2 columns"
);

const themeJs = await fs.readFile(path.join(projectRoot, "assets/js/theme.js"), "utf8");
assert(themeJs.includes("ip-theme"), "Expected theme.js to persist under the ip-theme localStorage key");
assert(themeJs.includes("injectThemeToggle"), "Expected theme.js to inject the toggle button");

const buildScript = await fs.readFile(path.join(projectRoot, "scripts/build-static.mjs"), "utf8");
assert(buildScript.includes("assets/js/theme.js"), "Expected build-static.mjs to ship assets/js/theme.js");

const pageEntries = [
  "auth.js",
  "case-session.js",
  "case-setup.js",
  "home.js",
  "profile.js",
  "results.js",
  "session.js",
  "setup.js",
];
for (const entry of pageEntries) {
  const source = await fs.readFile(path.join(projectRoot, "assets/js", entry), "utf8");
  assert(source.includes('import "./theme.js";'), `Expected assets/js/${entry} to import theme.js`);
}

const pages = [
  "auth.html",
  "case-session.html",
  "case-setup.html",
  "index.html",
  "profile.html",
  "results.html",
  "session.html",
  "setup.html",
];
for (const page of pages) {
  const html = await fs.readFile(path.join(projectRoot, page), "utf8");
  assert(html.includes('localStorage.getItem("ip-theme")'), `Expected ${page} to carry the anti-FOUC theme snippet in <head>`);
}

const logos = [
  "goldman-sachs.svg",
  "jp-morgan.svg",
  "morgan-stanley.svg",
  "evercore.svg",
  "lazard.svg",
  "rothschild.svg",
  "blackstone.svg",
  "kkr.svg",
];
for (const logo of logos) {
  const logoPath = path.join(projectRoot, "assets/img/logos", logo);
  const content = await fs.readFile(logoPath, "utf8");
  const stats = await fs.stat(logoPath);
  assert(stats.size > 800, `Expected ${logo} to be a real logo, not the old placeholder (${stats.size} bytes)`);
  assert(!content.includes("Georgia, 'Times New Roman', serif"), `Expected ${logo} to no longer be the fake text-in-a-box placeholder`);
}

console.log("theme-system-smoke: OK");
