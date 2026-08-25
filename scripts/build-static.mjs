import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
const publicFiles = [
  "auth.html", "case-session.html", "case-setup.html", "index.html", "new-session.html", "profile.html", "results.html", "session.html", "setup.html",
  "assets/css/app.css",
  "assets/img/interviewplus-logo.svg",
  "assets/img/logos/blackstone.svg", "assets/img/logos/evercore.svg", "assets/img/logos/goldman-sachs.svg", "assets/img/logos/jp-morgan.svg",
  "assets/img/logos/kkr.svg", "assets/img/logos/lazard.svg", "assets/img/logos/morgan-stanley.svg", "assets/img/logos/rothschild.svg",
  "assets/js/auth.js", "assets/js/backend.js", "assets/js/case-session.js", "assets/js/case-setup.js", "assets/js/case-templates.js",
  "assets/js/config.js", "assets/js/correction-client.js", "assets/js/home.js", "assets/js/i18n.js", "assets/js/keywords.js",
  "assets/js/mobile-nav.js", "assets/js/nav.js", "assets/js/new-session.js", "assets/js/profile.js", "assets/js/results.js", "assets/js/session.js", "assets/js/setup.js",
  "assets/js/store.js", "assets/js/theme.js", "assets/js/xlsx.full.min.js",
];

await rm(output, { recursive: true, force: true });
for (const file of publicFiles) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, file), destination);
}

console.log(`Built ${publicFiles.length} public files in dist`);
