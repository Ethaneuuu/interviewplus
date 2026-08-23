import { deepEqual, equal } from "node:assert/strict";
import { generateCaseStatement } from "../assets/js/case-templates.js";

globalThis.window = { INTERVIEWPLUS_CONFIG: { backendMode: "local" } };
const { mapRemoteSession, toRemoteSessionRow } = await import("../assets/js/backend.js");

const statement = generateCaseStatement({ theme: "dcf", difficulty: "easy", seed: 7 });
const session = {
  id: "00000000-0000-4000-8000-000000000007",
  userId: "00000000-0000-4000-8000-000000000001",
  userName: "Candidate",
  sourceLabel: "Cas pratiques",
  sessionType: "case",
  status: "review",
  startedAt: "2026-08-22T10:00:00.000Z",
  endsAt: "2026-08-22T11:00:00.000Z",
  completedAt: "2026-08-22T10:30:00.000Z",
  currentIndex: 0,
  globalScore: 87.5,
  correctionMode: "deterministic",
  correctionProvider: null,
  correctionModel: null,
  config: { theme: "dcf", difficulty: "easy", timerMinutes: 60, questionCount: 0 },
  questions: [],
  caseData: { templateId: statement.templateId, difficulty: "easy", seed: 7, statement, answers: { [statement.answerFields[0].id]: "42" }, grade: { score: 87.5 } },
};

const row = toRemoteSessionRow(session);
equal(row.session_json.sessionType, "case");
deepEqual(mapRemoteSession(row), session);

const historicFrench = mapRemoteSession({
  id: "historic-fr",
  user_id: session.userId,
  session_type: "questions",
  theme: "Technique",
  question_count: 1,
  timer_minutes: 10,
  global_score: 80,
  questions_json: [{ questionId: "1", language: "fr", question: "Question", candidateAnswer: "Réponse" }],
  started_at: session.startedAt,
  completed_at: session.completedAt,
});
equal(historicFrench.config.questionLanguage, "fr");

console.log(JSON.stringify({ ok: true, supabase: "case-envelope" }));
