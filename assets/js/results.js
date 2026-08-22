import {
  getCurrentUser,
  getResultsOverview,
  getSessionDetails,
  initializeApp,
  recorrectSession,
  continueAsGuest,
  isGuestUser,
  requireAuthorizedAccess,
} from "./store.js";
import { evaluationLabel, t } from "./i18n.js";

const metrics = document.getElementById("resultsMetrics");
const resultsList = document.getElementById("resultsList");
const detailPanel = document.getElementById("sessionDetailPanel");
const detailTitle = document.getElementById("detailTitle");
const detailScore = document.getElementById("detailScore");
const recorrectButton = document.getElementById("recorrectSession");
const detailQuestionNav = document.getElementById("detailQuestionNav");
const detailCorrection = document.getElementById("detailCorrection");

let selectedQuestionIndex = 0;

await initializeApp();
requireAuthorizedAccess("results.html");
if (!getCurrentUser()) {
  await continueAsGuest();
}
await render();

recorrectButton.addEventListener("click", async () => {
  const sessionId = recorrectButton.dataset.sessionId;
  if (!sessionId) return;
  recorrectButton.disabled = true;
  recorrectButton.textContent = t("Recorrection...", "Regrading...");
  try {
    await recorrectSession(sessionId);
  } finally {
    await render();
  }
});

async function render() {
  const overview = await getResultsOverview();
  const selectedSession = await getSelectedSession(overview);

  renderMetrics(overview);
  renderHistory(overview.sessions, selectedSession);

  if (selectedSession) {
    renderSessionDetail(selectedSession);
  } else {
    detailPanel.classList.add("hidden");
    recorrectButton.classList.add("hidden");
  }
}

function renderMetrics(overview) {
  metrics.innerHTML = `
    <article class="metric-card">
      <span class="eyebrow">Sessions</span>
      <strong>${overview.completedSessions}</strong>
    </article>
    <article class="metric-card">
      <span class="eyebrow">${t("Score moyen", "Average score")}</span>
      <strong>${overview.averageScore === null ? "--" : `${overview.averageScore}%`}</strong>
    </article>
    <article class="metric-card">
      <span class="eyebrow">${t("Session active", "Active session")}</span>
      <strong>${overview.activeSession ? (overview.activeSession.status === "running" ? t("En cours", "In progress") : t("Correction", "Feedback")) : t("Aucune", "None")}</strong>
    </article>
    ${isGuestUser(overview.currentUser) ? `
      <article class="metric-card">
        <span class="eyebrow">${t("Mode invité", "Guest mode")}</span>
        <strong>Local</strong>
        <p class="chart-meta">${t("Créez un compte pour synchroniser vos sessions.", "Create an account to sync your sessions.")}</p>
      </article>
    ` : ""}
  `;
}

function renderHistory(sessions, selectedSession) {
  if (!sessions.length) {
    resultsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">01</span>
        <h3>${t("Aucune session enregistrée", "No saved sessions")}</h3>
        <p>${t("Lancez une première session pour voir vos scores, vos corrections et vos axes de progression ici.", "Start your first session to see scores, feedback and areas for improvement here.")}</p>
        <a class="button button-primary" href="./setup.html">${t("Commencer une session", "Start a session")}</a>
      </div>
    `;
    return;
  }

  resultsList.innerHTML = "";
  sessions.forEach((session) => {
    if (session.sessionType === "case") {
      const item = document.createElement("article");
      item.className = session.id === selectedSession?.id ? "history-item is-selected" : "history-item";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(session.caseData?.statement?.title || "Cas pratique")} | ${session.globalScore ?? "--"}%</strong>
          <p class="chart-meta">${escapeHtml(session.config.difficulty || "")} | ${session.config.timerMinutes} min</p>
          <p class="chart-meta">${t("Le", "On")} ${formatDate(session.completedAt || session.startedAt)}</p>
        </div>
        <a class="button button-ghost" href="./results.html?session=${encodeURIComponent(session.id)}">${t("Voir le détail", "View details")}</a>
      `;
      resultsList.append(item);
      return;
    }
    const answered = session.questions.filter((question) => question.candidateAnswer.trim()).length;
    const item = document.createElement("article");
    item.className = session.id === selectedSession?.id ? "history-item is-selected" : "history-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(displayTheme(session.config.theme))} | ${session.globalScore ?? "--"}%</strong>
        <p class="chart-meta">${session.questions.length} questions | ${languageLabel(session.config.questionLanguage)} | ${session.config.timerMinutes} min | ${answered} ${t("réponses renseignées", "answers provided")}</p>
        <p class="chart-meta">${t("Le", "On")} ${formatDate(session.completedAt || session.startedAt)}</p>
      </div>
      <a class="button button-ghost" href="./results.html?session=${encodeURIComponent(session.id)}">${t("Voir le détail", "View details")}</a>
    `;
    resultsList.append(item);
  });
}

function renderSessionDetail(session) {
  if (session.sessionType === "case") {
    renderCaseDetail(session);
    return;
  }
  const currentQuestion = session.questions[selectedQuestionIndex] || session.questions[0];
  selectedQuestionIndex = currentQuestion?.index || 0;

  detailPanel.classList.remove("hidden");
  detailTitle.textContent = `${displayTheme(session.config.theme)} | ${languageLabel(session.config.questionLanguage)} | ${formatDate(session.completedAt || session.startedAt)}`;
  detailScore.textContent = `${t("Score global", "Overall score")} ${session.globalScore ?? "--"}%`;
  const canRecorrect = session.status === "review" && session.sessionType !== "case";
  recorrectButton.classList.toggle("hidden", !canRecorrect);
  recorrectButton.disabled = false;
  recorrectButton.dataset.sessionId = canRecorrect ? session.id : "";
  recorrectButton.textContent = t("Recorriger", "Regrade");

  detailQuestionNav.innerHTML = "";
  session.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === selectedQuestionIndex ? "is-current is-scored" : "is-scored";
    if (question.score < 60) button.classList.add("is-low");
    button.innerHTML = `<strong>Q${index + 1}</strong><div class="chart-meta">${question.score ?? "--"}% | ${escapeHtml(question.category)}</div>`;
    button.addEventListener("click", () => {
      selectedQuestionIndex = index;
      renderSessionDetail(session);
    });
    detailQuestionNav.append(button);
  });

  detailCorrection.innerHTML = `
    <div class="result-correction-head">
      <span class="pill">Question ${selectedQuestionIndex + 1} / ${session.questions.length}</span>
      <span class="pill">${evaluationLabel(currentQuestion.evaluationMode)}</span>
      <span class="pill score-pill ${scoreTone(currentQuestion.score)}">${currentQuestion.score ?? "--"}%</span>
    </div>
    <h2>${escapeHtml(currentQuestion.question)}</h2>
    <p class="inline-note">${escapeHtml(currentQuestion.category)} | ${escapeHtml(currentQuestion.subcategory)}${
      isRefreshRequired(currentQuestion.refreshBeforeInterview) ? t(" | À actualiser avant l'entretien", " | Refresh before the interview") : ""
    }</p>

    <div class="result-answer-grid">
      <section class="text-card">
        <h3>${t("Votre réponse", "Your answer")}</h3>
        <p>${escapeHtml(currentQuestion.candidateAnswer?.trim() || t("Aucune réponse n'a été fournie.", "No answer was provided."))}</p>
      </section>
      <section class="text-card">
        <h3>${t("Correctif attendu", "Expected answer")}</h3>
        <p>${escapeHtml(currentQuestion.expectedAnswer)}</p>
      </section>
    </div>

    <div class="feedback-stack result-feedback-stack">
      ${renderFeedbackCard(t("Points forts", "Strengths"), currentQuestion.strengths, "success", t("Aucun point fort distinctif détecté.", "No distinctive strength detected."))}
      ${renderFeedbackCard(t("Axes d'amélioration", "Areas for improvement"), currentQuestion.improvements, "warning", t("Aucun axe d'amélioration spécifique.", "No specific area for improvement."))}
      ${renderFeedbackCard(t("Points manquants", "Missing points"), currentQuestion.missingPoints, "danger", t("Aucun point manquant critique.", "No critical missing point."))}
    </div>
  `;
}

function renderCaseDetail(session) {
  const grade = session.caseData?.grade || {};
  const breakdown = grade.breakdown || {};
  detailPanel.classList.remove("hidden");
  detailTitle.textContent = `${session.caseData?.statement?.title || t("Cas pratique", "Practical case")} | ${formatDate(session.completedAt || session.startedAt)}`;
  detailScore.textContent = `${t("Score global", "Overall score")} ${session.globalScore ?? "--"}%`;
  recorrectButton.classList.add("hidden");
  recorrectButton.disabled = false;
  recorrectButton.dataset.sessionId = "";
  detailQuestionNav.innerHTML = "";
  detailCorrection.innerHTML = `
    <div class="result-correction-head">
      <span class="pill">${t("Résultats du cas", "Case results")}</span>
      <span class="pill">${evaluationLabel(session.correctionMode)}</span>
      <span class="pill score-pill ${scoreTone(session.globalScore)}">${session.globalScore ?? "--"}%</span>
    </div>
    <h2>${grade.passed ? t("Réussi", "Passed") : t("À retravailler", "To revisit")}</h2>
    <div class="feedback-stack result-feedback-stack">
      <article class="feedback-card"><h3>${t("Résultats", "Results")}</h3><p>${breakdown.results ?? "--"}%</p></article>
      <article class="feedback-card"><h3>${t("Méthode", "Method")}</h3><p>${breakdown.method ?? "--"}%</p></article>
      ${session.caseData?.statement?.recommendation ? `<article class="feedback-card"><h3>${t("Justification", "Justification")}</h3><p>${breakdown.justification ?? "--"}%</p></article>` : ""}
    </div>
  `;
}

async function getSelectedSession(overview) {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("session");

  if (requestedId) {
    const detailed = await getSessionDetails(requestedId);
    if (detailed) return detailed;
  }

  if (overview.activeSession?.status === "review") {
    return overview.activeSession;
  }

  return overview.sessions[0] || null;
}

function renderFeedbackCard(title, items, tone, emptyMessage) {
  const list = items?.length
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : `<li>${emptyMessage}</li>`;

  return `
    <article class="feedback-card feedback-card-${tone}">
      <h3>${title}</h3>
      <ul class="feedback-list ${items?.length ? "" : "empty"}">${list}</ul>
    </article>
  `;
}

function scoreTone(score) {
  if (typeof score !== "number") return "score-low";
  if (score >= 80) return "score-high";
  if (score >= 60) return "score-mid";
  return "score-low";
}

function languageLabel(language) {
  return language === "fr" ? "FR" : "EN";
}

function displayTheme(theme) {
  return theme === "Aleatoire" ? t("Aléatoire", "Random") : theme;
}

function isRefreshRequired(value) {
  return ["yes", "oui", "true", "1"].includes(String(value || "").trim().toLowerCase());
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString(document.documentElement.lang === "en" ? "en-GB" : "fr-FR");
  } catch (error) {
    return value || "-";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
