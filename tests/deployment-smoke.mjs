import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepEqual, equal, ok, rejects } from "node:assert/strict";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);

const docs = await fs.readFile("docs/PROJECT.md", "utf8");
for (const heading of ["Architecture", "Stack", "POST /api/correct", "Netlify", "Supabase", "OpenRouter", "Coûts et quotas", "Créer un template", "Sessions payantes"]) {
  ok(docs.includes(heading), `Missing documentation section ${heading}`);
}
ok(docs.includes("openai/gpt-oss-120b:free"));
ok(docs.includes("local-degraded"));

const schema = await fs.readFile("supabase/schema.sql", "utf8");
for (const column of ["session_type", "difficulty", "template_id", "case_seed", "case_json", "score_json", "correction_mode", "correction_provider", "correction_model"]) {
  ok(schema.includes(column), `Missing Supabase column ${column}`);
}

const netlify = await fs.readFile("netlify.toml", "utf8");
ok(netlify.includes('from = "/api/correct"'));
ok(netlify.includes('command = "node scripts/build-static.mjs"'));
ok(netlify.includes('publish = "dist"'));
ok(netlify.includes('included_files = ["assets/js/xlsx.full.min.js"]'));

const clientConfig = await fs.readFile("assets/js/config.example.js", "utf8");
ok(!clientConfig.includes("OPENROUTER_API_KEY"));
ok(!clientConfig.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok(!clientConfig.includes("sk-or-"));

globalThis.window = { INTERVIEWPLUS_CONFIG: { backendMode: "local" } };
const { mapRemoteSession, toRemoteSessionRow } = await import("../assets/js/backend.js");
const caseData = {
  templateId: "dcf-easy",
  difficulty: "easy",
  seed: 7,
  statement: { theme: "dcf" },
  answers: { enterprise_value: "42" },
  grade: { score: 80, breakdown: { results: 80 } },
};
const row = toRemoteSessionRow({
  id: "session-1",
  userId: "user-1",
  sessionType: "case",
  startedAt: "2026-08-22T10:00:00.000Z",
  completedAt: "2026-08-22T10:30:00.000Z",
  globalScore: 80,
  correctionMode: "deterministic",
  correctionProvider: null,
  correctionModel: null,
  config: { theme: "dcf", difficulty: "easy", questionCount: 0, timerMinutes: 60 },
  questions: [{ questionId: "must-not-persist" }],
  caseData,
});
equal(row.session_type, "case");
equal(row.difficulty, "easy");
equal(row.template_id, "dcf-easy");
equal(row.case_seed, 7);
deepEqual(row.questions_json, []);
deepEqual(row.case_json, {
  templateId: "dcf-easy",
  difficulty: "easy",
  seed: 7,
  statement: { theme: "dcf" },
  answers: { enterprise_value: "42" },
});
deepEqual(row.score_json, caseData.grade);
equal(row.correction_mode, "deterministic");

const { session_json, ...databaseRow } = row;
const restored = mapRemoteSession(databaseRow);
equal(restored.sessionType, "case");
equal(restored.config.difficulty, "easy");
deepEqual(restored.questions, []);
deepEqual(restored.caseData, caseData);

const { createQuestionBankLoader } = await import("../netlify/functions/lib/question-bank.mjs");
let storageUrl = "";
const loader = createQuestionBankLoader({
  env: { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test" },
  fetchImpl: async (url) => {
    storageUrl = url;
    return new Response(null, { status: 404 });
  },
});
await rejects(loader(), /PRIVATE_QUESTION_FILE_UNAVAILABLE:404/);
equal(storageUrl, "https://project.supabase.co/storage/v1/object/interviewplus-private/Questions_InterviewPlus_Bilingual.xlsx");

await fs.rm("dist", { recursive: true, force: true });
await run(process.execPath, ["scripts/build-static.mjs"]);
const manifest = await listFiles("dist");
const expected = [
  "auth.html", "case-session.html", "case-setup.html", "index.html", "profile.html", "results.html", "session.html", "setup.html",
  "assets/css/app.css", "assets/img/interviewplus-logo.svg", "assets/js/backend.js", "assets/js/config.js", "assets/js/store.js", "assets/js/xlsx.full.min.js",
];
expected.forEach((file) => ok(manifest.includes(file), `Missing public file ${file}`));
deepEqual(manifest.filter((file) => file.startsWith("netlify/") || file.startsWith("supabase/") || file.startsWith("tests/") || file.startsWith("docs/") || file.endsWith(".xlsx")), []);
ok(!manifest.includes("assets/js/config.example.js"));
ok(!manifest.includes("assets/js/keyword-overrides.js"));
for (const file of manifest) {
  const text = await fs.readFile(`dist/${file}`, "utf8");
  ["OPENROUTER_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", /sk-or-[A-Za-z0-9]+/].forEach((secret) => ok(!text.match(secret), `${file} exposes a server secret`));
}

const netlifyBundle = await verifyNetlifyBundle();

console.log(JSON.stringify({ ok: true, publicFiles: manifest.length, netlifyBundle }));

async function verifyNetlifyBundle() {
  try {
    await run("netlify", ["--version"]);
  } catch (error) {
    if (error?.code === "ENOENT") return "skipped-cli-missing";
    throw error;
  }

  await run("netlify", ["build", "--offline"]);
  const artifactDir = await fs.mkdtemp(join(tmpdir(), "interviewplus-correct-"));
  try {
    await run("unzip", ["-oq", ".netlify/functions/correct.zip", "-d", artifactDir]);
    const artifact = await import(`${pathToFileURL(join(artifactDir, "correct.js")).href}?${Date.now()}`);
    const handler = artifact.handler || artifact.default?.handler;
    equal(typeof handler, "function");
    const response = await handler({ httpMethod: "POST", body: "{}" });
    equal(response.statusCode, 400);
    deepEqual(JSON.parse(response.body), { error: "INVALID_CORRECTION_TYPE" });
    return "verified";
  } finally {
    await fs.rm(artifactDir, { recursive: true, force: true });
  }
}

async function listFiles(directory, prefix = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const file = `${prefix}${entry.name}`;
    return entry.isDirectory() ? listFiles(`${directory}/${entry.name}`, `${file}/`) : [file];
  }));
  return files.flat().sort();
}
