import {
  downloadPrivateQuestionWorkbook,
  getRemoteCurrentUser,
  isRemoteBackendEnabled,
  listRemoteSessions,
  remoteRequestPasswordReset,
  remoteSignIn,
  remoteSignOut,
  remoteSignUp,
  upsertRemoteSession,
} from "./backend.js";
import { requestCorrection } from "./correction-client.js";
import { CASE_DIFFICULTIES, CASE_THEMES, generateCaseStatement } from "./case-templates.js";
import { extractKeywords, normalizeText, unique } from "./keywords.js";

const STORAGE_KEY = "interviewplus-state-v4";
const SOURCE_LABEL = "Questions_InterviewPlus_Bilingual.xlsx";
const DATA_FILE = encodeURI(`./${SOURCE_LABEL}`);
const appConfig = window.INTERVIEWPLUS_CONFIG || {};

const fallbackDataset = [
  {
    id: "demo-1",
    category: "Behavioral / Fit",
    subcategory: "Why Banking / Career Motivation",
    question: "Why do you want to work in M&A rather than another area of finance?",
    answer:
      "A strong answer should connect interest in strategy, valuation, execution and live deals, while explaining why M&A combines client exposure, analysis and impact.",
    document: "Demo",
  },
];

const financeConcepts = [
  {
    id: "equity_value",
    label: "equity value / valeur des capitaux propres",
    aliases: ["equity value", "market capitalization", "market cap", "valeur des capitaux propres", "valeur des fonds propres", "valeur actionnariale", "valeur attribuable aux actionnaires"],
  },
  {
    id: "enterprise_value",
    label: "enterprise value",
    aliases: ["enterprise value", "ev", "valeur d entreprise", "valeur entreprise"],
  },
  {
    id: "shareholders",
    label: "actionnaires",
    aliases: ["shareholder", "shareholders", "equity shareholders", "actionnaire", "actionnaires"],
  },
  {
    id: "share_price",
    label: "prix de l'action",
    aliases: ["share price", "stock price", "closing share price", "latest closing share price", "prix de l action", "cours de l action", "dernier cours"],
  },
  {
    id: "diluted_shares",
    label: "actions diluees en circulation",
    aliases: ["diluted shares", "shares outstanding", "diluted shares outstanding", "total diluted shares outstanding", "actions diluees", "nombre d actions", "actions en circulation"],
  },
  {
    id: "net_debt",
    label: "dette nette",
    aliases: ["net debt", "dette nette", "debt less cash", "dette moins cash", "dette moins tresorerie"],
  },
  {
    id: "debt",
    label: "dette",
    aliases: ["debt", "financial debt", "dette", "endettement"],
  },
  {
    id: "cash",
    label: "cash / tresorerie",
    aliases: ["cash", "cash equivalent", "cash equivalents", "tresorerie", "equivalents de tresorerie"],
  },
  {
    id: "minority_interest",
    label: "minority interest",
    aliases: ["minority interest", "minority interests", "interets minoritaires"],
  },
  {
    id: "preferred_stock",
    label: "preferred stock",
    aliases: ["preferred stock", "preferred equity", "actions preferentielles"],
  },
  {
    id: "wacc",
    label: "WACC",
    aliases: ["wacc", "weighted average cost of capital", "cout moyen pondere du capital", "cmpc"],
  },
  {
    id: "free_cash_flow",
    label: "free cash flow",
    aliases: ["free cash flow", "fcf", "unlevered free cash flow", "cash flow libre", "flux de tresorerie disponible"],
  },
  {
    id: "terminal_value",
    label: "terminal value",
    aliases: ["terminal value", "valeur terminale", "perpetuity growth", "exit multiple"],
  },
  {
    id: "ebitda",
    label: "EBITDA",
    aliases: ["ebitda", "ebitda multiple", "multiple d ebitda"],
  },
  {
    id: "synergies",
    label: "synergies",
    aliases: ["synergy", "synergies", "cost synergies", "revenue synergies", "synergie", "synergies de couts", "synergies de revenus"],
  },
  {
    id: "eps",
    label: "EPS / BPA",
    aliases: ["eps", "earnings per share", "bpa", "benefice par action", "accretion", "dilution", "accretive", "dilutive"],
  },
];

const defaultState = {
  localUsers: [],
  currentLocalUserId: null,
  guestUser: null,
  sessionConfig: {
    questionCount: 5,
    questionLanguage: "en",
    theme: "Aleatoire",
    timerMinutes: 10,
  },
  caseConfig: {
    theme: "dcf",
    difficulty: "easy",
    timerMinutes: 60,
  },
  activeSession: null,
  localSessions: [],
};

let state = loadState();
let currentUser = null;
let datasetCache = null;
let datasetMeta = {
  sourceLabel: SOURCE_LABEL,
  questionCount: 0,
  themeCount: 0,
  themes: [],
  themesByLanguage: {},
  languages: [],
  questionCountsByLanguage: {},
  dynamicQuestionCountsByLanguage: {},
  dynamicQuestionCount: 0,
};
let datasetPromise = null;
let remoteSessionsCache = [];
let datasetLoadError = "";

export async function initializeApp({ loadDataset = true } = {}) {
  await hydrateCurrentUser();
  if (loadDataset && (!isRestrictedAccess() || currentUser)) {
    await ensureDatasetLoaded();
  }
  try {
    await syncActiveSession();
  } catch (error) {
    if (state.activeSession?.sessionType !== "case") throw error;
    // A timed session remains a saved draft when automatic correction is unavailable.
  }
  return {
    currentUser: getCurrentUser(),
    datasetMeta: getDatasetMeta(),
    backendMode: isRemoteBackendEnabled()
      ? (appConfig.backendMode === "server" ? "server" : "supabase")
      : "local",
  };
}

export function getDatasetMeta() {
  return structuredClone(datasetMeta);
}

export function getCurrentUser() {
  return currentUser ? structuredClone(currentUser) : null;
}

export function isGuestUser(user = currentUser) {
  return Boolean(user?.isGuest);
}

export function isRestrictedAccess() {
  return appConfig.restrictedAccess === true;
}

export function requireAuthorizedAccess(returnTo = "setup.html") {
  if (!isRestrictedAccess() || (currentUser && !isGuestUser(currentUser))) return;
  const destination = encodeURIComponent(safeAuthReturnDestination(returnTo));
  window.location.replace(`./auth.html?returnTo=${destination}`);
  throw new Error("ACCESS_REDIRECT");
}

export function safeAuthReturnDestination(requested) {
  return new Set(["new-session.html", "setup.html", "session.html", "results.html", "profile.html", "case-setup.html", "case-session.html"]).has(requested)
    ? requested
    : "setup.html";
}

export async function continueAsGuest() {
  if (isRestrictedAccess() || appConfig.allowGuestAccess === false) {
    throw new Error("GUEST_ACCESS_DISABLED");
  }
  if (!state.guestUser) {
    state.guestUser = {
      id: `guest-${safeId()}`,
      name: "Invite",
      email: "Mode invite",
      createdAt: new Date().toISOString(),
      isGuest: true,
    };
  }
  state.currentLocalUserId = null;
  currentUser = sanitizeLocalUser(state.guestUser);
  persist();
  return structuredClone(currentUser);
}

export async function registerUser({ name, email, password }) {
  if (appConfig.allowPublicSignup === false) {
    throw new Error("PUBLIC_SIGNUP_DISABLED");
  }
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!name?.trim() || !isValidEmail(normalizedEmail) || !isStrongEnoughPassword(password)) {
    throw new Error("INVALID_FORM");
  }

  if (isRemoteBackendEnabled()) {
    const result = await remoteSignUp({ name: name.trim(), email: normalizedEmail, password });
    currentUser = result.session ? await getRemoteCurrentUser() : null;
    return {
      needsEmailConfirmation: !result.session,
      user: currentUser,
    };
  }

  if (state.localUsers.some((user) => user.email === normalizedEmail)) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const user = {
    id: safeId(),
    name: name.trim(),
    email: normalizedEmail,
    password: password.trim(),
    createdAt: new Date().toISOString(),
  };
  state.localUsers.push(user);
  state.currentLocalUserId = user.id;
  persist();
  currentUser = sanitizeLocalUser(user);
  return {
    needsEmailConfirmation: false,
    user: currentUser,
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!isValidEmail(normalizedEmail) || !String(password || "").trim()) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (isRemoteBackendEnabled()) {
    await remoteSignIn({ email: normalizedEmail, password });
    currentUser = await getRemoteCurrentUser();
    remoteSessionsCache = currentUser ? await listRemoteSessions(currentUser.id) : [];
    return structuredClone(currentUser);
  }

  const user = state.localUsers.find((item) => item.email === normalizedEmail && item.password === String(password || "").trim());
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }
  state.currentLocalUserId = user.id;
  persist();
  currentUser = sanitizeLocalUser(user);
  return structuredClone(currentUser);
}

export async function logoutUser() {
  if (isRemoteBackendEnabled() && !isGuestUser(currentUser)) {
    await remoteSignOut();
    currentUser = null;
    remoteSessionsCache = [];
  } else {
    state.currentLocalUserId = null;
    persist();
    currentUser = state.guestUser ? sanitizeLocalUser(state.guestUser) : null;
  }
}

export function getSessionConfig() {
  return structuredClone(state.sessionConfig);
}

export function setSessionConfig(config) {
  state.sessionConfig = {
    ...state.sessionConfig,
    ...config,
  };
  persist();
}

export function getCaseConfig() {
  return structuredClone(state.caseConfig);
}

export function setCaseConfig(config) {
  state.caseConfig = { ...state.caseConfig, ...config };
  persist();
}

export async function requestPasswordReset(email) {
  if (!isValidEmail(email)) {
    throw new Error("INVALID_EMAIL");
  }
  if (!isRemoteBackendEnabled()) {
    throw new Error("PASSWORD_RESET_REMOTE_ONLY");
  }
  await remoteRequestPasswordReset(email);
}

export function getThemeOptions(language = "en") {
  const themes = datasetMeta.themesByLanguage?.[language] || datasetMeta.themes;
  return ["Aleatoire", ...themes];
}

export function getAvailableQuestionCount(theme, language = "en") {
  if (!datasetCache) return 0;
  const languageRows = datasetCache.filter((row) => row.language === language);
  const sourceRows = languageRows.length ? languageRows : datasetCache;
  return theme === "Aleatoire"
    ? sourceRows.length
    : sourceRows.filter((row) => row.category === theme).length;
}

export async function startSession(config) {
  if (isRestrictedAccess() && !currentUser) {
    throw new Error("ACCESS_REQUIRED");
  }
  const user = currentUser || await continueAsGuest();
  await ensureDatasetLoaded();

  if (datasetMeta.degraded) {
    throw new Error("DATASET_UNAVAILABLE");
  }

  const sessionConfig = {
    ...state.sessionConfig,
    ...config,
  };
  state.sessionConfig = sessionConfig;

  const rows = pickRowsForSession(sessionConfig);
  if (!rows.length) {
    throw new Error("NO_QUESTIONS");
  }

  const now = Date.now();
  state.activeSession = {
    id: safeId(),
    userId: user.id,
    userName: user.name,
    sourceLabel: datasetMeta.sourceLabel,
    status: "running",
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + Number(sessionConfig.timerMinutes) * 60 * 1000).toISOString(),
    completedAt: null,
    currentIndex: 0,
    globalScore: null,
    config: {
      questionCount: rows.length,
      questionLanguage: sessionConfig.questionLanguage || "en",
      theme: sessionConfig.theme,
      timerMinutes: Number(sessionConfig.timerMinutes),
    },
    questions: rows.map((row, index) => ({
      index,
      questionId: row.id,
      category: row.category,
      subcategory: row.subcategory,
      question: row.question,
      expectedAnswer: row.answer,
      keyElements: row.keyElements,
      criticalConcept: row.criticalConcept,
      scoringRubric: row.scoringRubric,
      questionType: row.questionType,
      expectedLevel: row.expectedLevel,
      answerOrigin: row.answerOrigin,
      refreshBeforeInterview: row.refreshBeforeInterview,
      language: row.language,
      candidateAnswer: "",
      score: null,
      strengths: [],
      improvements: [],
      missingPoints: [],
    })),
  };

  persist();
  return getActiveSession();
}

export async function startCaseSession(config = {}) {
  if (isRestrictedAccess() && !currentUser) throw new Error("ACCESS_REQUIRED");
  const user = currentUser || await continueAsGuest();
  const caseConfig = { ...state.caseConfig, ...config };
  if (!CASE_THEMES.includes(caseConfig.theme)) throw new Error("INVALID_CASE_THEME");
  if (!CASE_DIFFICULTIES.includes(caseConfig.difficulty)) throw new Error("INVALID_CASE_DIFFICULTY");
  if (![30, 45, 60].includes(Number(caseConfig.timerMinutes))) throw new Error("INVALID_CASE_TIMER");

  const seed = config.seed === undefined ? randomCaseSeed() : config.seed;
  const statement = generateCaseStatement({ theme: caseConfig.theme, difficulty: caseConfig.difficulty, seed });
  const now = Date.now();
  state.caseConfig = {
    theme: caseConfig.theme,
    difficulty: caseConfig.difficulty,
    timerMinutes: Number(caseConfig.timerMinutes),
  };
  state.activeSession = {
    id: safeId(),
    userId: user.id,
    userName: user.name,
    sourceLabel: "Cas pratiques",
    sessionType: "case",
    status: "running",
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + state.caseConfig.timerMinutes * 60 * 1000).toISOString(),
    completedAt: null,
    currentIndex: 0,
    globalScore: null,
    correctionMode: null,
    correctionProvider: null,
    correctionModel: null,
    config: { theme: statement.theme, difficulty: statement.difficulty, timerMinutes: state.caseConfig.timerMinutes, questionCount: 0 },
    questions: [],
    caseData: { templateId: statement.templateId, difficulty: statement.difficulty, seed, statement, answers: {}, grade: null },
  };
  persist();
  return getActiveSession();
}

export function getActiveSession() {
  if (!state.activeSession) {
    return null;
  }
  if (currentUser && state.activeSession.userId !== currentUser.id) {
    return null;
  }
  return buildSessionView(state.activeSession);
}

export function saveAnswer(index, answer) {
  if (!state.activeSession || state.activeSession.status !== "running") {
    return null;
  }
  const question = state.activeSession.questions[index];
  if (!question) {
    return null;
  }
  question.candidateAnswer = String(answer || "");
  persist();
  return getActiveSession();
}

export function saveCaseAnswer(fieldId, value) {
  if (!state.activeSession || state.activeSession.sessionType !== "case" || state.activeSession.status !== "running") return null;
  const { statement } = state.activeSession.caseData;
  const valid = fieldId === "recommendation" ? Boolean(statement.recommendation) : statement.answerFields.some((field) => field.id === fieldId);
  if (!valid) return null;
  state.activeSession.caseData.answers[fieldId] = String(value ?? "");
  persist();
  return getActiveSession();
}

export function goToQuestion(index) {
  if (!state.activeSession || !state.activeSession.questions[index]) {
    return null;
  }
  state.activeSession.currentIndex = index;
  persist();
  return getActiveSession();
}

export function nextQuestion() {
  if (!state.activeSession) {
    return null;
  }
  if (state.activeSession.currentIndex < state.activeSession.questions.length - 1) {
    state.activeSession.currentIndex += 1;
    persist();
  }
  return getActiveSession();
}

export function previousQuestion() {
  if (!state.activeSession) {
    return null;
  }
  if (state.activeSession.currentIndex > 0) {
    state.activeSession.currentIndex -= 1;
    persist();
  }
  return getActiveSession();
}

export function getUnansweredQuestions() {
  const session = state.activeSession;
  if (!session || session.sessionType === "case" || !Array.isArray(session.questions)) return [];
  return session.questions
    .map((question, index) => (String(question.candidateAnswer || "").trim() ? null : index + 1))
    .filter((number) => number !== null);
}

let finalizeInFlight = null;

export async function finalizeSession({ requireComplete = true } = {}) {
  if (finalizeInFlight) return finalizeInFlight;
  finalizeInFlight = (async () => {
    const session = state.activeSession;
    if (requireComplete && session && session.status === "running" && session.sessionType !== "case") {
      const missing = getUnansweredQuestions();
      if (missing.length) {
        throw Object.assign(new Error("INCOMPLETE_ANSWERS"), { missing });
      }
    }
    await syncActiveSession(true);
    return getActiveSession();
  })();
  try {
    return await finalizeInFlight;
  } finally {
    finalizeInFlight = null;
  }
}

export async function finalizeCaseSession() {
  const session = state.activeSession;
  if (!session || session.sessionType !== "case" || session.status !== "running") return getActiveSession();
  persist();
  const { statement, answers, seed } = session.caseData;
  const numericAnswers = Object.fromEntries(statement.answerFields.flatMap((field) => {
    const value = answers[field.id];
    return value === undefined || String(value).trim() === "" ? [] : [[field.id, Number(value)]];
  }));
  const result = await requestCorrection({
    type: "case",
    sessionId: session.id,
    theme: statement.theme,
    difficulty: statement.difficulty,
    seed,
    answers: numericAnswers,
    ...(statement.recommendation ? { recommendation: answers.recommendation || "" } : {}),
  });
  const completed = structuredClone(session);
  completed.caseData.grade = result;
  completed.globalScore = result.score;
  completed.correctionMode = result.mode || "deterministic";
  completed.correctionProvider = result.provider || null;
  completed.correctionModel = result.model || null;
  completed.status = "review";
  completed.completedAt = new Date().toISOString();

  await commitCompletedSession(completed);
  return getActiveSession();
}

export async function recorrectSession(sessionId) {
  const user = getCurrentUser();
  if (!user || !sessionId) return null;

  const activeSession = getActiveSession();
  const session = activeSession?.id === sessionId
    ? activeSession
    : (await getUserSessions(user.id)).find((item) => item.id === sessionId);
  if (!isCompletedQuestionSession(session)) return session || null;

  try {
    const questions = await correctQuestions(session, false);
    const updated = { ...session, questions, globalScore: calculateGlobalScore(questions) };

    if (isRemoteBackendEnabled() && !isGuestUser(currentUser)) {
      await upsertRemoteSession(updated);
      try {
        remoteSessionsCache = await listRemoteSessions(user.id);
      } catch {
        // The remote upsert already committed the correction.
      }
      replaceRemoteSession(updated);
      if (state.activeSession?.id === updated.id) {
        state.activeSession = structuredClone(updated);
      }
      try {
        persist();
      } catch {
        // The remote upsert remains committed if local cache persistence fails.
      }
      return buildSessionView(updated);
    }

    const nextState = structuredClone(state);
    const index = nextState.localSessions.findIndex((item) => item.id === updated.id);
    if (index >= 0) nextState.localSessions[index] = structuredClone(updated);
    else nextState.localSessions.unshift(structuredClone(updated));
    if (nextState.activeSession?.id === updated.id) nextState.activeSession = structuredClone(updated);
    persist(nextState);
    state = nextState;
    return buildSessionView(updated);
  } catch {
    return session;
  }
}

export async function getResultsOverview() {
  const user = getCurrentUser();
  const sessions = user ? await getUserSessions(user.id) : [];
  const scoreList = sessions.map((session) => session.globalScore).filter(isNumber);
  return {
    currentUser: user,
    activeSession: getActiveSession(),
    sessions,
    completedSessions: sessions.length,
    averageScore: scoreList.length ? Math.round(scoreList.reduce((sum, score) => sum + score, 0) / scoreList.length) : null,
  };
}

export async function getSessionDetails(sessionId) {
  const user = getCurrentUser();
  if (!user || !sessionId) {
    return null;
  }

  const activeSession = getActiveSession();
  if (activeSession?.id === sessionId && activeSession.status === "review") {
    return activeSession;
  }

  const sessions = await getUserSessions(user.id);
  return sessions.find((session) => session.id === sessionId) || null;
}

export async function getProfileAnalytics() {
  const user = currentUser || await continueAsGuest();
  const sessions = await getUserSessions(user.id);
  const categoryMap = new Map();

  sessions.forEach((session) => {
    if (session.sessionType === "case") return;
    session.questions.forEach((question) => {
      if (!isNumber(question.score)) return;
      if (!categoryMap.has(question.category)) {
        categoryMap.set(question.category, { category: question.category, total: 0, count: 0 });
      }
      const entry = categoryMap.get(question.category);
      entry.total += question.score;
      entry.count += 1;
    });
  });

  const categories = Array.from(categoryMap.values())
    .map((entry) => ({
      category: entry.category,
      averageScore: Math.round(entry.total / entry.count),
      count: entry.count,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);

  const allScores = sessions.map((session) => session.globalScore).filter(isNumber);

  return {
    user,
    sessionsCount: sessions.length,
    averageScore: allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : null,
    strongest: categories.slice(0, 5),
    weakest: [...categories].reverse().slice(0, 5),
    categories,
  };
}

async function hydrateCurrentUser() {
  if (isRemoteBackendEnabled()) {
    currentUser = await getRemoteCurrentUser();
    remoteSessionsCache = currentUser ? await getUserSessions(currentUser.id) : [];
    const remoteActiveSession = remoteSessionsCache.find((session) => session.id === state.activeSession?.id && session.status === "review");
    if (remoteActiveSession) {
      state.activeSession = structuredClone({
        ...state.activeSession,
        ...remoteActiveSession,
        config: { ...state.activeSession.config, ...remoteActiveSession.config },
      });
    }
    if (!currentUser && state.guestUser) {
      currentUser = sanitizeLocalUser(state.guestUser);
    }
    return;
  }
  const local = state.localUsers.find((user) => user.id === state.currentLocalUserId);
  currentUser = local ? sanitizeLocalUser(local) : (state.guestUser ? sanitizeLocalUser(state.guestUser) : null);
}

async function getUserSessions(userId) {
  if (isRemoteBackendEnabled() && !isGuestUser(currentUser)) {
    remoteSessionsCache = await listRemoteSessions(userId);
    return structuredClone(remoteSessionsCache);
  }
  return structuredClone(state.localSessions.filter((session) => session.userId === userId));
}

async function syncActiveSession(forceFinalize = false) {
  if (!state.activeSession || state.activeSession.status !== "running") {
    return;
  }
  if (currentUser && state.activeSession.userId !== currentUser.id) {
    return;
  }

  const expired = Date.now() >= new Date(state.activeSession.endsAt).getTime();
  if (!expired && !forceFinalize) {
    return;
  }

  if (state.activeSession.sessionType === "case") {
    await finalizeCaseSession();
    return;
  }

  const completed = structuredClone(state.activeSession);
  completed.questions = await correctQuestions(completed);
  completed.globalScore = calculateGlobalScore(completed.questions);
  completed.status = "review";
  completed.completedAt = new Date().toISOString();

  await commitCompletedSession(completed);
}

async function commitCompletedSession(completed) {
  if (isRemoteBackendEnabled() && !isGuestUser(currentUser)) {
    await upsertRemoteSession(completed);
    replaceRemoteSession(completed);
    if (currentUser) {
      try {
        remoteSessionsCache = await listRemoteSessions(currentUser.id);
      } catch {
        // The remote upsert is the commit point; refresh can reconcile later.
      }
    }
    state.activeSession = structuredClone(completed);
    try {
      persist();
    } catch {
      // The remote upsert remains authoritative when the local cache is unavailable.
    }
    return;
  }

  const nextState = structuredClone(state);
  const index = nextState.localSessions.findIndex((session) => session.id === completed.id);
  if (index >= 0) nextState.localSessions[index] = structuredClone(completed);
  else nextState.localSessions.unshift(structuredClone(completed));
  nextState.activeSession = structuredClone(completed);
  persist(nextState);
  state = nextState;
}

async function ensureDatasetLoaded() {
  if (datasetCache) {
    return datasetCache;
  }
  if (datasetPromise) {
    return datasetPromise;
  }

  datasetPromise = (async () => {
    try {
      if (typeof XLSX === "undefined") {
        throw new Error("XLSX_NOT_AVAILABLE");
      }
      let buffer;
      if (isRestrictedAccess()) {
        if (!currentUser) throw new Error("ACCESS_REQUIRED");
        buffer = await downloadPrivateQuestionWorkbook();
      } else {
        const response = await fetch(DATA_FILE);
        if (!response.ok) {
          throw new Error("DATA_FILE_UNAVAILABLE");
        }
        buffer = await response.arrayBuffer();
      }
      const workbook = XLSX.read(buffer, { type: "array" });
      datasetCache = buildDatasetFromWorkbook(workbook);
      if (!datasetCache.length) {
        datasetCache = isRestrictedAccess() ? [] : fallbackDataset;
      }
    } catch (error) {
      datasetLoadError = error instanceof Error ? error.message : "DATASET_LOAD_FAILED";
      datasetCache = isRestrictedAccess() ? [] : fallbackDataset;
    }

    const languages = Array.from(new Set(datasetCache.map((row) => row.language).filter(Boolean))).sort();
    const themesByLanguage = Object.fromEntries(languages.map((language) => [
      language,
      Array.from(new Set(datasetCache
        .filter((row) => row.language === language)
        .map((row) => row.category)
        .filter(Boolean)))
        .sort(),
    ]));
    const questionCountsByLanguage = Object.fromEntries(languages.map((language) => [
      language,
      datasetCache.filter((row) => row.language === language).length,
    ]));
    const dynamicQuestionCountsByLanguage = Object.fromEntries(languages.map((language) => [
      language,
      datasetCache.filter((row) => row.language === language && isRefreshRequired(row.refreshBeforeInterview)).length,
    ]));
    const themes = Array.from(new Set(datasetCache.map((row) => row.category).filter(Boolean))).sort();
    datasetMeta = {
      sourceLabel: SOURCE_LABEL,
      questionCount: datasetCache.length,
      themeCount: Math.max(0, ...Object.values(themesByLanguage).map((items) => items.length)),
      themes,
      themesByLanguage,
      languages,
      questionCountsByLanguage,
      dynamicQuestionCountsByLanguage,
      dynamicQuestionCount: datasetCache.filter((row) => isRefreshRequired(row.refreshBeforeInterview)).length,
      degraded: Boolean(datasetLoadError),
      loadError: datasetLoadError,
    };
    return datasetCache;
  })();

  return datasetPromise;
}

function pickRowsForSession(config) {
  const language = config.questionLanguage || "en";
  const languageRows = datasetCache.filter((row) => row.language === language);
  const sourceRows = languageRows.length ? languageRows : datasetCache;
  const rows = config.theme === "Aleatoire"
    ? sourceRows
    : sourceRows.filter((row) => row.category === config.theme);
  const requestedCount = Number(config.questionCount || 5);
  if (requestedCount > rows.length) {
    throw new Error("NOT_ENOUGH_QUESTIONS");
  }
  return shuffle(rows).slice(0, requestedCount);
}

async function correctQuestions(session, fallback = true) {
  persist();
  const response = await requestCorrection({
    type: "questions",
    sessionId: session.id,
    items: session.questions.map(({ questionId, language, candidateAnswer }) => ({
      questionId,
      language,
      answer: candidateAnswer || "",
    })),
  }).catch(() => null);
  const corrections = correctionMap(response, session.questions);
  if (corrections) {
    return session.questions.map((question) => ({ ...question, ...corrections.get(question.questionId) }));
  }
  if (!fallback) throw new Error("CORRECTION_UNAVAILABLE");
  return session.questions.map((question) => {
    const evaluation = localizeEvaluation(evaluateAnswerLocally(
      question.candidateAnswer || "",
      buildExpectedReference(question),
      question.question || ""
    ), question.language);
    return {
      ...question,
      ...evaluation,
      evaluationMode: "local-degraded",
      correctionProvider: "local",
      correctionModel: null,
    };
  });
}

function correctionMap(response, questions) {
  if (!response || response.mode !== "openrouter" || response.provider !== "openrouter" || typeof response.model !== "string" || !Array.isArray(response.items) || response.items.length !== questions.length) {
    return null;
  }
  const expected = new Set(questions.map((question) => question.questionId));
  const corrections = new Map();
  for (const item of response.items) {
    if (!item || !expected.has(item.questionId) || corrections.has(item.questionId) || !isNumber(item.score) || item.score < 0 || item.score > 100 || !Array.isArray(item.recognizedConcepts) || !item.recognizedConcepts.every((value) => typeof value === "string") || !Array.isArray(item.missingElements) || !item.missingElements.every((value) => typeof value === "string") || typeof item.feedback !== "string") {
      return null;
    }
    corrections.set(item.questionId, {
      score: item.score,
      strengths: item.recognizedConcepts,
      improvements: [item.feedback],
      missingPoints: item.missingElements,
      evaluationMode: response.mode,
      correctionProvider: response.provider,
      correctionModel: response.model,
    });
  }
  return corrections.size === expected.size ? corrections : null;
}

function calculateGlobalScore(questions) {
  const scored = questions.filter((question) => isNumber(question.score));
  return scored.length
    ? Math.round(scored.reduce((sum, question) => sum + question.score, 0) / scored.length)
    : 0;
}

function isCompletedQuestionSession(session) {
  return Boolean(session && session.status === "review" && session.sessionType !== "case" && Array.isArray(session.questions));
}

function localizeEvaluation(evaluation, language) {
  if (!evaluation || language !== "en") return evaluation;
  return {
    ...evaluation,
    strengths: evaluation.strengths.map(localizeFeedbackToEnglish),
    improvements: evaluation.improvements.map(localizeFeedbackToEnglish),
    missingPoints: evaluation.missingPoints.map(localizeFeedbackToEnglish),
  };
}

function localizeFeedbackToEnglish(value) {
  const text = String(value || "");
  const exact = {
    "Fournir une reponse complete et specifique a la question.": "Provide a complete answer that is specific to the question.",
    "Citer les concepts financiers attendus et expliquer le raisonnement.": "Mention the expected financial concepts and explain the reasoning.",
    "L'evaluation IA obligatoire n'est pas disponible. Verifier la configuration de l'endpoint d'evaluation.": "The required AI evaluation is unavailable. Check the evaluation endpoint configuration.",
    "Evaluation non realisee par l'IA.": "The AI evaluation could not be completed.",
    "La formule principale de l'equity value est identifiee.": "The main Equity Value formula is identified.",
    "La reponse tente de relier equity value et enterprise value.": "The answer attempts to bridge Equity Value and Enterprise Value.",
    "Ajouter la formule directe: Equity Value = share price x diluted shares outstanding.": "Add the direct formula: Equity Value = share price × diluted shares outstanding.",
    "Donner la formule de calcul attendue et pas seulement une definition generale.": "Provide the expected calculation formula, not only a general definition.",
    "Le cash ne doit pas etre traite comme de la dette dans le bridge EV -> Equity Value.": "Cash must not be treated as debt in the EV-to-Equity Value bridge.",
    "Equity Value et Enterprise Value ne sont pas interchangeables.": "Equity Value and Enterprise Value are not interchangeable.",
    "Reponse bien structuree.": "Well-structured answer.",
    "Les termes du corrige sont bien repris.": "The answer uses the key terms from the expected answer.",
    "La reponse s'appuie sur un exemple concret.": "The answer uses a concrete example.",
    "Developper davantage le raisonnement.": "Develop the reasoning further.",
    "Structurer la reponse en etapes claires.": "Structure the answer in clear steps.",
    "Ajouter plus de precision, de logique financiere ou un exemple.": "Add more precision, financial reasoning or an example.",
    "Les concepts cles attendus sont globalement couverts.": "The expected key concepts are broadly covered.",
  };
  let localized = exact[text] || text;
  if (localized.startsWith("Concept reconnu: ")) localized = localized.replace("Concept reconnu: ", "Recognized concept: ");
  if (localized.startsWith("Point bien traite: ")) localized = localized.replace("Point bien traite: ", "Well-covered point: ");
  if (localized.startsWith("Inclure explicitement le concept: ")) localized = localized.replace("Inclure explicitement le concept: ", "Explicitly include the concept: ");
  if (localized.startsWith("Inclure explicitement: ")) localized = localized.replace("Inclure explicitement: ", "Explicitly include: ");
  if (localized === "dette") localized = "debt";
  return localized
    .replaceAll("equity value / valeur des capitaux propres", "Equity Value")
    .replaceAll("prix de l'action", "share price")
    .replaceAll("actions diluees en circulation", "diluted shares outstanding")
    .replaceAll("dette nette", "net debt")
    .replaceAll("cash / tresorerie", "cash")
    .replaceAll("actionnaires", "shareholders");
}

function evaluateAnswerLocally(candidateAnswer, expectedAnswer, questionText = "") {
  if (isLowEffortAnswer(candidateAnswer)) {
    const expectedPoints = extractKeyPoints(expectedAnswer);
    return {
      score: 0,
      strengths: [],
      improvements: ["Fournir une reponse complete et specifique a la question.", "Citer les concepts financiers attendus et expliquer le raisonnement."],
      missingPoints: expectedPoints.slice(0, 4),
      evaluationMode: "semantic-local",
    };
  }

  const idealTokens = extractKeywords(expectedAnswer);
  const candidateTokens = extractKeywords(candidateAnswer);
  const expectedPoints = extractKeyPoints(expectedAnswer);
  const expectedConcepts = detectFinanceConcepts(expectedAnswer);
  const candidateConcepts = detectFinanceConcepts(candidateAnswer);
  const matchedConcepts = [...expectedConcepts].filter((concept) => candidateConcepts.has(concept));
  const missingConcepts = [...expectedConcepts].filter((concept) => !candidateConcepts.has(concept));
  const formulaAssessment = assessFormulaMatch(questionText, candidateAnswer, expectedConcepts, candidateConcepts);
  const contradictions = detectFinancialContradictions(candidateAnswer);
  const matchedPoints = [];
  const missingPoints = [];

  expectedPoints.forEach((point) => {
    const overlap = computeOverlap(extractKeywords(point), candidateTokens);
    if (overlap >= 0.38) {
      matchedPoints.push(point);
    } else {
      missingPoints.push(point);
    }
  });

  const keywordCoverage = computeOverlap(idealTokens, candidateTokens);
  const structureScore = scoreStructure(candidateAnswer);
  const detailScore = scoreSpecificity(candidateAnswer);
  const pointCoverage = expectedPoints.length ? matchedPoints.length / expectedPoints.length : keywordCoverage;
  const conceptCoverage = expectedConcepts.size ? matchedConcepts.length / expectedConcepts.size : keywordCoverage;

  if (keywordCoverage === 0 && pointCoverage === 0 && conceptCoverage === 0) {
    return {
      score: 0,
      strengths: [],
      improvements: buildSemanticImprovements(candidateAnswer, missingPoints, missingConcepts, formulaAssessment, contradictions, structureScore, detailScore),
      missingPoints: buildSemanticMissingPoints(missingPoints, missingConcepts, formulaAssessment).slice(0, 5),
      evaluationMode: "semantic-local",
    };
  }

  const score = computeSemanticScore({
    keywordCoverage,
    pointCoverage,
    conceptCoverage,
    structureScore,
    detailScore,
    formulaAssessment,
    contradictionCount: contradictions.length,
  });

  return {
    score,
    strengths: buildSemanticStrengths(candidateAnswer, matchedPoints, matchedConcepts, formulaAssessment, keywordCoverage, structureScore),
    improvements: buildSemanticImprovements(candidateAnswer, missingPoints, missingConcepts, formulaAssessment, contradictions, structureScore, detailScore),
    missingPoints: buildSemanticMissingPoints(missingPoints, missingConcepts, formulaAssessment).slice(0, 5),
    evaluationMode: "semantic-local",
  };
}

function computeSemanticScore({
  keywordCoverage,
  pointCoverage,
  conceptCoverage,
  structureScore,
  detailScore,
  formulaAssessment,
  contradictionCount,
}) {
  const hasFormulaCheck = formulaAssessment.isRelevant;
  const rawScore = hasFormulaCheck
    ? conceptCoverage * 30 + pointCoverage * 18 + formulaAssessment.score * 32 + keywordCoverage * 8 + structureScore * 6 + detailScore * 6
    : conceptCoverage * 40 + pointCoverage * 25 + keywordCoverage * 15 + structureScore * 10 + detailScore * 10;
  const penalty = contradictionCount * 12 + (hasFormulaCheck && formulaAssessment.hasWrongBridge ? 10 : 0);
  return clamp(Math.round(rawScore - penalty), 0, 100);
}

function detectFinanceConcepts(text) {
  const normalized = normalizeText(text);
  return new Set(financeConcepts
    .filter((concept) => concept.aliases.some((alias) => normalized.includes(normalizeText(alias))))
    .map((concept) => concept.id));
}

function assessFormulaMatch(questionText, candidateAnswer, expectedConcepts, candidateConcepts) {
  const normalizedQuestion = normalizeText(questionText);
  const candidate = normalizeText(candidateAnswer);
  const asksForEquityValueCalculation = (
    normalizedQuestion.includes("calculate equity value") ||
    normalizedQuestion.includes("calculated equity value") ||
    normalizedQuestion.includes("equity value calculated") ||
    normalizedQuestion.includes("equity value formula") ||
    normalizedQuestion.includes("formula for equity value") ||
    normalizedQuestion.includes("calculer l equity value") ||
    normalizedQuestion.includes("formule de l equity value")
  );
  const isEquityValueFormula =
    expectedConcepts.has("equity_value") && asksForEquityValueCalculation;

  if (!isEquityValueFormula) {
    return { isRelevant: false, score: 0, strengths: [], improvements: [], missingPoints: [], hasWrongBridge: false };
  }

  const hasDirectFormula = candidateConcepts.has("share_price") && candidateConcepts.has("diluted_shares");
  const hasMarketCapShortcut = candidate.includes("market cap") || candidate.includes("market capitalization") || candidate.includes("capitalisation boursiere");
  const hasEvBridge = candidateConcepts.has("enterprise_value") && (candidateConcepts.has("debt") || candidateConcepts.has("cash") || candidateConcepts.has("net_debt"));
  const hasWrongBridge = /\b(moins|minus|subtract|soustrait|retire)\b.{0,24}\b(cash|tresorerie|cash equivalents)\b/.test(candidate);

  if (hasDirectFormula || hasMarketCapShortcut) {
    return {
      isRelevant: true,
      score: 1,
      strengths: ["La formule principale de l'equity value est identifiee."],
      improvements: [],
      missingPoints: [],
      hasWrongBridge,
    };
  }

  if (hasEvBridge) {
    return {
      isRelevant: true,
      score: hasWrongBridge ? 0.22 : 0.38,
      strengths: ["La reponse tente de relier equity value et enterprise value."],
      improvements: ["Ajouter la formule directe: Equity Value = share price x diluted shares outstanding."],
      missingPoints: ["Equity Value = Latest Closing Share Price x Total Diluted Shares Outstanding."],
      hasWrongBridge,
    };
  }

  return {
    isRelevant: true,
    score: 0,
    strengths: [],
    improvements: ["Donner la formule de calcul attendue et pas seulement une definition generale."],
    missingPoints: ["Equity Value = Latest Closing Share Price x Total Diluted Shares Outstanding."],
    hasWrongBridge,
  };
}

function detectFinancialContradictions(answer) {
  const normalized = normalizeText(answer);
  const contradictions = [];
  if (/\b(moins|minus|subtract|soustrait|retire)\b.{0,24}\b(cash|tresorerie|cash equivalents)\b/.test(normalized)) {
    contradictions.push("Le cash ne doit pas etre traite comme de la dette dans le bridge EV -> Equity Value.");
  }
  if (/\b(equity value)\b.{0,35}\b(enterprise value)\b/.test(normalized) && /\bidentique|same|equivalent\b/.test(normalized)) {
    contradictions.push("Equity Value et Enterprise Value ne sont pas interchangeables.");
  }
  return contradictions;
}

function buildSemanticStrengths(answer, matchedPoints, matchedConcepts, formulaAssessment, keywordCoverage, structureScore) {
  const strengths = [];
  if (structureScore > 0.72) strengths.push("Reponse bien structuree.");
  if (keywordCoverage > 0.42) strengths.push("Les termes du corrige sont bien repris.");
  matchedConcepts.slice(0, 3).forEach((conceptId) => strengths.push(`Concept reconnu: ${getConceptLabel(conceptId)}.`));
  formulaAssessment.strengths.forEach((item) => strengths.push(item));
  matchedPoints.slice(0, 2).forEach((point) => strengths.push(`Point bien traite: ${cleanPoint(point)}`));
  if (/\b(example|for instance|for example|par exemple)\b/i.test(answer)) {
    strengths.push("La reponse s'appuie sur un exemple concret.");
  }
  return unique(strengths).slice(0, 4);
}

function buildSemanticImprovements(answer, missingPoints, missingConcepts, formulaAssessment, contradictions, structureScore, detailScore) {
  const improvements = [];
  if (answer.trim().split(/\s+/).length < 50) improvements.push("Developper davantage le raisonnement.");
  if (structureScore < 0.65) improvements.push("Structurer la reponse en etapes claires.");
  if (detailScore < 0.5) improvements.push("Ajouter plus de precision, de logique financiere ou un exemple.");
  formulaAssessment.improvements.forEach((item) => improvements.push(item));
  contradictions.forEach((item) => improvements.push(item));
  missingConcepts.slice(0, 3).forEach((conceptId) => improvements.push(`Inclure explicitement le concept: ${getConceptLabel(conceptId)}.`));
  missingPoints.slice(0, 2).forEach((point) => improvements.push(`Inclure explicitement: ${cleanPoint(point)}`));
  return unique(improvements).slice(0, 5);
}

function buildSemanticMissingPoints(missingPoints, missingConcepts, formulaAssessment) {
  return unique([
    ...formulaAssessment.missingPoints,
    ...missingConcepts.slice(0, 3).map((conceptId) => getConceptLabel(conceptId)),
    ...missingPoints.map((point) => cleanPoint(point)),
  ]);
}

function getConceptLabel(conceptId) {
  const concept = financeConcepts.find((item) => item.id === conceptId);
  return concept ? concept.label : conceptId;
}

function isLowEffortAnswer(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  const uniqueWords = unique(words);
  const repeatedShare = words.length ? 1 - uniqueWords.length / words.length : 1;

  return (
    words.length < 8 ||
    uniqueWords.length < 4 ||
    repeatedShare > 0.9 ||
    uniqueWords.every((word) => ["test", "na", "none", "vide"].includes(word))
  );
}

function buildSessionView(session) {
  if (!session) return null;
  const cloned = structuredClone(session);
  const current = cloned.questions[cloned.currentIndex] || null;
  return {
    ...cloned,
    current,
    totalQuestions: cloned.questions.length,
    answeredCount: cloned.questions.filter((question) => question.candidateAnswer.trim()).length,
    remainingMs: cloned.status === "running" ? Math.max(0, new Date(cloned.endsAt).getTime() - Date.now()) : 0,
  };
}

function replaceRemoteSession(session) {
  const index = remoteSessionsCache.findIndex((item) => item.id === session.id);
  if (index >= 0) remoteSessionsCache[index] = structuredClone(session);
  else remoteSessionsCache.unshift(structuredClone(session));
}

function sanitizeLocalUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    isGuest: Boolean(user.isGuest),
  };
}

function buildDatasetFromWorkbook(workbook) {
  const taxonomyMap = buildTaxonomyMap(workbook);
  const englishRowsById = buildEnglishRowsById(workbook, taxonomyMap);
  const preferredSheets = ["EN_QA_FINAL", "FR_QR", "EN_QA", "Q&A Extract", ...workbook.SheetNames];
  const seenSheets = new Set();

  const dataset = [];
  const seenIds = new Set();

  for (const sheetName of preferredSheets) {
    if (!sheetName || seenSheets.has(sheetName) || !workbook.Sheets[sheetName]) continue;
    seenSheets.add(sheetName);

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    const language = sheetName.startsWith("EN_") || sheetName === "Q&A Extract" ? "en" : "fr";
    const normalizedRows = rows
      .map((row) => normalizeRow(row, { language, taxonomyMap, englishRowsById }))
      .filter((row) => row.question && row.answer);

    normalizedRows.forEach((row) => {
      const key = `${row.language}:${row.id}`;
      if (seenIds.has(key)) return;
      seenIds.add(key);
      dataset.push(row);
    });
  }

  return dataset;
}

function buildEnglishRowsById(workbook, taxonomyMap) {
  const worksheet = workbook.Sheets?.EN_QA_FINAL || workbook.Sheets?.EN_QA;
  if (!worksheet) return new Map();

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return rows.reduce((map, row) => {
    const normalized = normalizeRow(row, { language: "en", taxonomyMap });
    if (normalized.id) {
      map.set(normalized.id, normalized);
    }
    return map;
  }, new Map());
}

function buildTaxonomyMap(workbook) {
  const worksheet = workbook.Sheets?.Taxonomy_FR;
  if (!worksheet) return new Map();

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return rows.reduce((map, row) => {
    const mapped = mapRowKeys(row);
    const standardCategory = String(pickField(mapped, ["standardcategory"]) || "").trim();
    const standardSubcategory = String(pickField(mapped, ["standardsubcategory"]) || "").trim();
    const frenchCategory = String(pickField(mapped, ["categoriefr"]) || "").trim();
    const frenchSubcategory = String(pickField(mapped, ["souscategoriefr"]) || "").trim();

    if (standardCategory && frenchCategory) {
      map.set(`category:${standardCategory}`, frenchCategory);
    }
    if (standardSubcategory && frenchSubcategory) {
      map.set(`subcategory:${standardSubcategory}`, frenchSubcategory);
    }
    return map;
  }, new Map());
}

function normalizeRow(row, options = {}) {
  const mapped = mapRowKeys(row);
  const rawCategory = String(pickField(mapped, ["standardcategory", "category", "categorie", "categoriefr", "originalmajorsection"]) || "Non classe").trim();
  const rawSubcategory = String(pickField(mapped, ["standardsubcategory", "subcategory", "souscategorie", "souscategoriefr", "originalsection"]) || "Sans sous-categorie").trim();
  const id = String(pickField(mapped, ["", "global", "globalnumber", "id", "sectionq"]) || safeId());
  const englishReference = options.englishRowsById?.get(id);

  return {
    id,
    category: options.language === "fr"
      ? options.taxonomyMap?.get(`category:${rawCategory}`) || rawCategory
      : rawCategory,
    subcategory: options.language === "fr"
      ? options.taxonomyMap?.get(`subcategory:${rawSubcategory}`) || rawSubcategory
      : rawSubcategory,
    question: cleanCellValue(pickField(mapped, ["questionfr", "question", "questions", "prompt"])),
    answer: cleanCellValue(pickField(mapped, ["reponseattenduefr", "reponse", "answer", "expectedanswer", "idealanswer", "modelanswer", "sampleanswer"])) || englishReference?.answer || "",
    keyElements: cleanCellValue(pickField(mapped, ["elementscleaciterfr", "expectedkeyelementsen", "keyelements", "elementscleaciter"])),
    criticalConcept: cleanCellValue(pickField(mapped, ["conceptformulecritique", "criticalconceptformula", "criticalconcept"])),
    scoringRubric: cleanCellValue(pickField(mapped, ["grilledescoringiafr", "aiscoringrubricen", "scoringrubric"])),
    questionType: cleanCellValue(pickField(mapped, ["typedequestion", "questiontype"])),
    expectedLevel: cleanCellValue(pickField(mapped, ["niveauattendu", "expectedanswerlevel"])),
    answerOrigin: cleanCellValue(pickField(mapped, ["answerorigin"])),
    refreshBeforeInterview: cleanCellValue(pickField(mapped, ["refreshbeforeinterview"])),
    document: String(pickField(mapped, ["documentsource", "document", "source", "filename"]) || "").trim(),
    page: String(pickField(mapped, ["pagesource", "pagestart", "page"]) || "").trim(),
    language: options.language || "fr",
    referenceLanguage: cleanCellValue(pickField(mapped, ["reponseattenduefr", "reponse", "answer", "expectedanswer", "idealanswer", "modelanswer", "sampleanswer"])) ? options.language || "fr" : englishReference?.language || options.language || "fr",
  };
}

function mapRowKeys(row) {
  const mapped = {};
  Object.entries(row).forEach(([key, value]) => {
    mapped[slugify(key)] = value;
  });
  return mapped;
}

function pickField(row, candidates) {
  for (const candidate of candidates) {
    if (candidate in row && String(row[candidate]).trim()) {
      return row[candidate];
    }
  }
  return "";
}

function cleanCellValue(value) {
  const text = String(value || "").trim();
  return text.startsWith("=") ? "" : text;
}

function isRefreshRequired(value) {
  return ["yes", "oui", "true", "1"].includes(normalizeText(value));
}

function buildExpectedReference(question) {
  return [
    question.expectedAnswer,
    question.keyElements && `Elements cles attendus: ${question.keyElements}`,
    question.criticalConcept && `Concept critique: ${question.criticalConcept}`,
    question.scoringRubric && `Grille de scoring: ${question.scoringRubric}`,
  ].filter(Boolean).join("\n\n");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      sessionConfig: {
        ...defaultState.sessionConfig,
        ...(parsed.sessionConfig || {}),
      },
      caseConfig: {
        ...defaultState.caseConfig,
        ...(parsed.caseConfig || {}),
      },
    };
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function persist(snapshot = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function extractKeyPoints(text) {
  return unique(
    String(text || "")
      .replace(/\b(step\s*\d+)\b/gi, "$1:")
      .split(/[.;\u2022\n]/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.split(/\s+/).length >= 6)
  ).slice(0, 6);
}

function computeOverlap(sourceTokens, candidateTokens) {
  if (!sourceTokens.length || !candidateTokens.length) return 0;
  const candidateSet = new Set(candidateTokens);
  return sourceTokens.filter((token) => candidateSet.has(token)).length / sourceTokens.length;
}

function scoreStructure(text) {
  const wordCount = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  const hasTransitions = /\b(first|second|third|finally|step|then|because|therefore|however|d'abord|ensuite|enfin|parce que|donc)\b/i.test(text);
  const hasPunctuation = /[.;:]/.test(text);

  let score = 0;
  if (wordCount >= 40) score += 0.22;
  if (wordCount >= 90) score += 0.14;
  if (hasTransitions) score += 0.17;
  if (hasPunctuation) score += 0.12;
  return clamp(score, 0, 1);
}

function scoreSpecificity(text) {
  const hasNumbers = /\d/.test(text);
  const hasFinanceTerms = /\b(valuation|multiple|dcf|ebitda|eps|synergies|financing|deal|transaction|returns|compound|budget|clients|assumptions)\b/i.test(text);
  const hasExamples = /\b(example|for example|for instance|par exemple)\b/i.test(text);

  let score = 0;
  if (hasNumbers) score += 0.18;
  if (hasFinanceTerms) score += 0.3;
  if (hasExamples) score += 0.16;
  if (String(text || "").trim().split(/\s+/).length >= 70) score += 0.1;
  return clamp(score, 0, 1);
}

function slugify(text) {
  return normalizeText(text).replace(/\s+/g, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanPoint(text) {
  return String(text || "").replace(/\s+/g, " ").replace(/^[-:;,\s]+/, "").trim();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function safeId() {
  return window.crypto.randomUUID();
}

function randomCaseSeed() {
  return window.crypto.getRandomValues(new Uint32Array(1))[0];
}

function isNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isStrongEnoughPassword(password) {
  return String(password || "").trim().length >= 8;
}
