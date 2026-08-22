import fs from "node:fs/promises";
import { deepEqual, equal, ok, rejects } from "node:assert/strict";

const schema = await fs.readFile("supabase/schema.sql", "utf8");
for (const column of ["session_type", "difficulty", "template_id", "case_seed", "case_json", "score_json", "correction_mode", "correction_provider", "correction_model"]) {
  ok(schema.includes(column), `Missing Supabase column ${column}`);
}

const netlify = await fs.readFile("netlify.toml", "utf8");
ok(netlify.includes('from = "/api/correct"'));
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
