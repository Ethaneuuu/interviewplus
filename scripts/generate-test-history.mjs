// One-off: generates SQL to seed ~20 realistic completed sessions (mixed difficulty,
// some question sessions, some case sessions) into a test account, so the Profil/Sessions
// UI can be previewed as if a heavy user had been through the app for a couple of months.
//
// Usage: node scripts/generate-test-history.mjs > seed-test-history.sql
// Then open the Supabase SQL Editor, replace REPLACE_WITH_USER_ID below with the target
// account's auth.users id (Authentication > Users > copy the UUID), and run the script.

import { randomUUID } from "node:crypto";
import { generateCaseStatement } from "../assets/js/case-templates.js";
import { calculateCaseSolution, gradeCase } from "../netlify/functions/lib/case-grader.mjs";

const USER_ID = "REPLACE_WITH_USER_ID";

const QUESTION_BANK = [
  { id: "q-1", category: "Behavioral / Fit", subcategory: "Why Banking", question: "Why do you want to work in M&A rather than another area of finance?", answer: "Connect interest in strategy, valuation, execution and live deals; explain why M&A combines client exposure, analysis and impact.", good: "I want the mix of strategic thinking and hands-on execution: M&A lets me work on live transactions, build valuation models, and see the direct impact of the advice we give clients.", weak: "I like finance and M&A seems interesting and fast-paced." },
  { id: "q-2", category: "Behavioral / Fit", subcategory: "Teamwork", question: "Tell me about a time you had to work under pressure with a tight deadline.", answer: "Should show ownership, prioritization, communication with the team, and a concrete positive outcome.", good: "During a case competition, our team lost a member two days before the deadline. I reassigned the workload, worked through the night on the valuation section, and we delivered a complete deck that placed in the top three.", weak: "I had a lot of homework once and I managed to finish it before the deadline." },
  { id: "q-3", category: "Technical", subcategory: "Valuation", question: "Walk me through how you would value a company.", answer: "Should cover comparable companies, precedent transactions, and DCF, with tradeoffs between each.", good: "Three core approaches: comparable companies for a relative market view, precedent transactions for control premiums, and a DCF for an intrinsic, cash-flow-based value. I'd triangulate across all three and sanity-check against the current trading multiple.", weak: "You look at the company's financials and figure out what it's worth." },
  { id: "q-4", category: "Technical", subcategory: "Accounting", question: "Walk me through how a $10 increase in depreciation flows through the three financial statements.", answer: "Should cover the pre-tax income reduction, tax shield, net income impact, cash flow add-back, and the resulting change in PP&E and cash.", good: "On the income statement, EBIT falls by $10, and net income falls by $10 times (1 minus the tax rate) after the tax shield. On the cash flow statement, depreciation is added back since it's non-cash, so cash from operations only falls by the tax savings. On the balance sheet, PP&E falls by $10, cash rises by the tax shield versus net income alone, and retained earnings falls by net income, keeping it balanced.", weak: "It reduces net income and lowers the value of the assets on the balance sheet." },
  { id: "q-5", category: "Technical", subcategory: "LBO", question: "What makes a good LBO candidate?", answer: "Should mention stable, predictable cash flows, low existing leverage, strong market position, and clear value-creation levers.", good: "Stable and predictable free cash flow to service debt, low starting leverage, a defensible market position, and identifiable levers for value creation such as margin improvement or add-on acquisitions.", weak: "A company that makes a lot of money and isn't too risky." },
  { id: "q-6", category: "Industry Specific", subcategory: "Market Trends", question: "What trends are currently shaping the M&A market?", answer: "Should reference financing conditions, sector consolidation themes, regulatory scrutiny, and cross-border activity.", good: "Elevated rates have slowed sponsor-led LBOs but strategic acquirers with strong balance sheets are still active, particularly around consolidation in fragmented sectors. Antitrust scrutiny has also lengthened deal timelines, and take-private activity has picked up as public valuations lag private market expectations.", weak: "There have been a lot of mergers happening in tech and healthcare lately." },
  { id: "q-7", category: "Industry Specific", subcategory: "Sector Knowledge", question: "How would you evaluate a target in the healthcare sector differently from a typical industrial company?", answer: "Should mention regulatory/reimbursement risk, IP and patent cliffs, payer mix, and longer diligence cycles.", good: "Healthcare targets carry regulatory and reimbursement risk that industrials don't, so I'd weight payer mix, patent cliffs for pharma, and FDA/regulatory pathway risk heavily, and expect longer diligence given compliance requirements.", weak: "Healthcare companies are more regulated so you have to be more careful." },
  { id: "q-8", category: "Technical", subcategory: "Merger Model", question: "What determines whether a merger is accretive or dilutive?", answer: "Should cover the P/E of acquirer vs target, the financing mix, and synergies.", good: "It mainly comes down to whether the acquirer's P/E is higher than the target's, since a higher-multiple acquirer buying a lower-multiple target using stock tends to be accretive. The financing mix — cash, debt, or stock — and any run-rate synergies also shift the math.", weak: "If the deal makes the company earn more money per share it's accretive." },
  { id: "q-9", category: "Behavioral / Fit", subcategory: "Motivation", question: "Why our bank specifically?", answer: "Should reference specific deals, culture, or group strengths rather than generic praise.", good: "Your recent cross-border consolidation deals in the industrials space stood out to me, and speaking with two analysts on your team, the culture of hands-on mentorship for juniors is exactly what I'm looking for early in my career.", weak: "You are a top bank with a great reputation." },
  { id: "q-10", category: "Technical", subcategory: "Capital Structure", question: "How do you decide between debt and equity financing for an acquisition?", answer: "Should cover cost of capital, existing leverage, cash flow stability, and dilution tradeoffs.", good: "It's a tradeoff between the lower after-tax cost of debt and preserving financial flexibility. If the combined entity has stable cash flow and low existing leverage, debt is cheaper and avoids dilution; if leverage is already high or cash flows are volatile, equity protects the balance sheet at the cost of diluting existing shareholders.", weak: "Debt is usually cheaper than equity so companies prefer it." },
];

const CASE_THEMES = ["dcf", "lbo", "merger-model"];
const CASE_DIFFICULTIES = ["easy", "intermediate", "advanced"];

// quality: fraction of fields answered exactly correctly (rest left blank) — drives the score.
function buildCaseAnswers(statement, solution, quality) {
  const answers = {};
  statement.answerFields.forEach((field, index) => {
    const shouldAnswer = index / statement.answerFields.length < quality;
    if (shouldAnswer && Number.isFinite(solution[field.id])) {
      answers[field.id] = solution[field.id];
    }
  });
  if (statement.recommendation && quality > 0.5) {
    answers.recommendation = "Based on the model, I would recommend proceeding, though I'd flag the sensitivity to the discount rate and terminal assumptions as the key risks to monitor.";
  }
  return answers;
}

function buildCaseSession({ theme, difficulty, seed, quality, daysAgo, timerMinutes }) {
  const statement = generateCaseStatement({ theme, difficulty, seed });
  const solution = calculateCaseSolution(statement);
  const answers = buildCaseAnswers(statement, solution, quality);
  const grade = gradeCase({ theme, difficulty, seed, answers });
  const startedAt = daysAgoIso(daysAgo, 0);
  const completedAt = daysAgoIso(daysAgo, timerMinutes * 60 * 1000 * (0.4 + quality * 0.5));
  const session = {
    id: randomUUID(),
    userId: USER_ID,
    sessionType: "case",
    status: "review",
    startedAt,
    endsAt: daysAgoIso(daysAgo, -timerMinutes * 60 * 1000),
    completedAt,
    currentIndex: 0,
    globalScore: grade.score,
    config: { theme, difficulty, timerMinutes },
    questions: [],
    caseData: { templateId: statement.templateId, difficulty, seed, statement, answers, grade },
  };
  return session;
}

function buildQuestionSession({ questionCount, theme, timerMinutes, quality, daysAgo }) {
  const pool = shuffle([...QUESTION_BANK]).slice(0, questionCount);
  const startedAt = daysAgoIso(daysAgo, 0);
  const questions = pool.map((item, index) => {
    const answered = Math.random() < quality + 0.15;
    const score = answered ? Math.round(clamp(quality * 100 + (Math.random() * 30 - 15), 5, 100)) : 0;
    return {
      index,
      questionId: item.id,
      category: item.category,
      subcategory: item.subcategory,
      question: item.question,
      expectedAnswer: item.answer,
      keyElements: [],
      criticalConcept: null,
      scoringRubric: null,
      questionType: null,
      expectedLevel: null,
      answerOrigin: null,
      refreshBeforeInterview: null,
      language: "en",
      candidateAnswer: answered ? (score >= 60 ? item.good : item.weak) : "",
      score,
      strengths: score >= 60 ? ["Covers the core concept clearly"] : [],
      improvements: score < 60 ? ["Needs more structure and specific detail"] : [],
      missingPoints: score < 40 ? ["Key technical detail missing"] : [],
      evaluationMode: "local-degraded",
      correctionProvider: "local",
      correctionModel: null,
    };
  });
  const globalScore = Math.round(questions.reduce((sum, q) => sum + q.score, 0) / questions.length);
  const completedAt = daysAgoIso(daysAgo, timerMinutes * 60 * 1000 * (0.5 + quality * 0.4));
  return {
    id: randomUUID(),
    userId: USER_ID,
    sourceLabel: "Questions_InterviewPlus_Bilingual.xlsx",
    status: "review",
    startedAt,
    endsAt: daysAgoIso(daysAgo, -timerMinutes * 60 * 1000),
    completedAt,
    currentIndex: 0,
    globalScore,
    config: { theme, questionLanguage: "en", questionCount, timerMinutes },
    questions,
  };
}

function daysAgoIso(daysAgo, offsetMs) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 + offsetMs).toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// A rough upward trend over ~2 months: struggled early, improving with scatter, a couple of bad days.
const PLAN = [
  { kind: "q", daysAgo: 58, quality: 0.35, theme: "Aleatoire", questionCount: 5, timerMinutes: 10 },
  { kind: "q", daysAgo: 55, quality: 0.3, theme: "Technical", questionCount: 6, timerMinutes: 15 },
  { kind: "case", daysAgo: 52, theme: "dcf", difficulty: "easy", quality: 0.3, timerMinutes: 30 },
  { kind: "q", daysAgo: 49, quality: 0.4, theme: "Behavioral / Fit", questionCount: 5, timerMinutes: 10 },
  { kind: "q", daysAgo: 45, quality: 0.45, theme: "Aleatoire", questionCount: 8, timerMinutes: 20 },
  { kind: "case", daysAgo: 42, theme: "lbo", difficulty: "easy", quality: 0.4, timerMinutes: 30 },
  { kind: "q", daysAgo: 39, quality: 0.5, theme: "Industry Specific", questionCount: 5, timerMinutes: 10 },
  { kind: "q", daysAgo: 35, quality: 0.35, theme: "Technical", questionCount: 6, timerMinutes: 15 },
  { kind: "case", daysAgo: 32, theme: "dcf", difficulty: "intermediate", quality: 0.5, timerMinutes: 45 },
  { kind: "q", daysAgo: 29, quality: 0.55, theme: "Aleatoire", questionCount: 8, timerMinutes: 20 },
  { kind: "q", daysAgo: 26, quality: 0.6, theme: "Behavioral / Fit", questionCount: 5, timerMinutes: 10 },
  { kind: "case", daysAgo: 23, theme: "merger-model", difficulty: "intermediate", quality: 0.55, timerMinutes: 45 },
  { kind: "q", daysAgo: 20, quality: 0.65, theme: "Technical", questionCount: 6, timerMinutes: 15 },
  { kind: "q", daysAgo: 17, quality: 0.5, theme: "Aleatoire", questionCount: 10, timerMinutes: 20 },
  { kind: "case", daysAgo: 14, theme: "lbo", difficulty: "intermediate", quality: 0.65, timerMinutes: 45 },
  { kind: "q", daysAgo: 11, quality: 0.75, theme: "Industry Specific", questionCount: 5, timerMinutes: 10 },
  { kind: "case", daysAgo: 8, theme: "dcf", difficulty: "advanced", quality: 0.6, timerMinutes: 60 },
  { kind: "q", daysAgo: 5, quality: 0.8, theme: "Aleatoire", questionCount: 8, timerMinutes: 20 },
  { kind: "q", daysAgo: 3, quality: 0.85, theme: "Technical", questionCount: 6, timerMinutes: 15 },
  { kind: "case", daysAgo: 1, theme: "merger-model", difficulty: "advanced", quality: 0.7, timerMinutes: 60 },
];

let caseSeed = 1000;
const sessions = PLAN.map((entry) => {
  if (entry.kind === "case") {
    return buildCaseSession({
      theme: entry.theme,
      difficulty: entry.difficulty,
      seed: caseSeed++,
      quality: entry.quality,
      daysAgo: entry.daysAgo,
      timerMinutes: entry.timerMinutes,
    });
  }
  return buildQuestionSession({
    questionCount: entry.questionCount,
    theme: entry.theme,
    timerMinutes: entry.timerMinutes,
    quality: entry.quality,
    daysAgo: entry.daysAgo,
  });
});

function toRow(session) {
  const isCase = session.sessionType === "case";
  const { grade, ...caseJson } = isCase ? session.caseData : {};
  return {
    id: session.id,
    user_id: session.userId,
    theme: session.config.theme,
    question_count: session.config.questionCount ?? null,
    timer_minutes: session.config.timerMinutes,
    global_score: session.globalScore,
    session_type: isCase ? "case" : "questions",
    difficulty: session.config.difficulty || null,
    template_id: isCase ? caseJson.templateId || null : null,
    case_seed: isCase ? caseJson.seed ?? null : null,
    case_json: isCase ? caseJson : null,
    score_json: isCase && grade ? grade : {},
    correction_mode: null,
    correction_provider: null,
    correction_model: null,
    questions_json: isCase ? [] : session.questions,
    session_json: session,
    started_at: session.startedAt,
    completed_at: session.completedAt,
  };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonLiteral(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

const columns = ["id", "user_id", "theme", "question_count", "timer_minutes", "global_score", "session_type", "difficulty", "template_id", "case_seed", "case_json", "score_json", "correction_mode", "correction_provider", "correction_model", "questions_json", "session_json", "started_at", "completed_at"];

const lines = sessions.map((session) => {
  const row = toRow(session);
  const values = columns.map((column) => {
    const value = row[column];
    if (column === "case_json" || column === "score_json" || column === "questions_json" || column === "session_json") {
      return value === null ? "NULL" : jsonLiteral(value);
    }
    return sqlLiteral(value);
  });
  return `insert into session_runs (${columns.join(", ")}) values (${values.join(", ")});`;
});

console.log(`-- Seeds ${sessions.length} completed sessions (mixed difficulty, question + case) for a test account.`);
console.log(`-- Replace ${USER_ID} throughout with the target account's auth.users id before running.`);
console.log(lines.join("\n"));
