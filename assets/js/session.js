import {
  finalizeSession,
  getActiveSession,
  getCurrentUser,
  initializeApp,
  continueAsGuest,
  requireAuthorizedAccess,
  startSession,
  nextQuestion,
  previousQuestion,
  saveAnswer,
  goToQuestion,
} from "./store.js";
import { t } from "./i18n.js";

const elements = {
  sessionTitle: document.getElementById("sessionTitle"),
  sessionSubtitle: document.getElementById("sessionSubtitle"),
  timerDisplay: document.getElementById("timerDisplay"),
  progressChip: document.getElementById("progressChip"),
  themePill: document.getElementById("themePill"),
  questionModeLabel: document.getElementById("questionModeLabel"),
  questionText: document.getElementById("questionText"),
  questionMeta: document.getElementById("questionMeta"),
  candidateAnswer: document.getElementById("candidateAnswer"),
  prevQuestion: document.getElementById("prevQuestion"),
  nextQuestion: document.getElementById("nextQuestion"),
  finishNow: document.getElementById("finishNow"),
  questionNav: document.getElementById("questionNav"),
  globalScorePill: document.getElementById("globalScorePill"),
  sideTitle: document.getElementById("sideTitle"),
  sideHint: document.getElementById("sideHint"),
};

let timerId = null;
let isFinalizing = false;

await initializeApp();
requireAuthorizedAccess("session.html");
if (!getCurrentUser()) {
  await continueAsGuest();
}
await hydrateSessionFromQuery();
bindEvents();
await render();
startTimer();

async function hydrateSessionFromQuery() {
  if (getActiveSession()) return;

  const params = new URLSearchParams(window.location.search);
  const questionCount = Number(params.get("questions"));
  const questionLanguage = params.get("language") || "en";
  const theme = params.get("theme");
  const timerMinutes = Number(params.get("timer"));
  if (!questionCount || !theme || !timerMinutes) return;

  await startSession({ questionCount, questionLanguage, theme, timerMinutes });
}

function bindEvents() {
  elements.candidateAnswer.addEventListener("input", () => {
    const session = getActiveSession();
    if (!session || session.status !== "running") return;
    saveAnswer(session.currentIndex, elements.candidateAnswer.value);
    renderNavigator();
  });

  elements.nextQuestion.addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session || session.status !== "running") return;
    saveAnswer(session.currentIndex, elements.candidateAnswer.value);
    nextQuestion();
    await render();
  });

  elements.prevQuestion.addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session || session.status !== "running") return;
    saveAnswer(session.currentIndex, elements.candidateAnswer.value);
    previousQuestion();
    await render();
  });

  elements.finishNow.addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session || session.status !== "running") return;
    saveAnswer(session.currentIndex, elements.candidateAnswer.value);
    await finalizeAndRedirect();
  });
}

async function finalizeAndRedirect() {
  if (isFinalizing) return;
  isFinalizing = true;
  clearInterval(timerId);
  elements.finishNow.disabled = true;
  elements.nextQuestion.disabled = true;
  elements.prevQuestion.disabled = true;
  elements.candidateAnswer.disabled = true;
  elements.sessionSubtitle.textContent = t("Correction en cours...", "Evaluation in progress...");

  try {
    const finalized = await finalizeSession();
    redirectToResults(finalized);
  } catch {
    isFinalizing = false;
    elements.finishNow.disabled = false;
    elements.sessionSubtitle.textContent = t(
      "La correction a échoué. Vous pouvez réessayer sans perdre vos réponses.",
      "The evaluation failed. You can try again without losing your answers."
    );
  }
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(async () => {
    const session = getActiveSession();
    if (!session) {
      clearInterval(timerId);
      return;
    }
    if (session.status === "running") {
      elements.timerDisplay.textContent = formatTime(session.remainingMs);
      if (session.remainingMs <= 0) {
        await finalizeAndRedirect();
      }
      return;
    }
    elements.timerDisplay.textContent = "00:00";
  }, 1000);
}

async function render() {
  const session = getActiveSession();
  if (!session) {
    showSessionLoadError();
    return;
  }

  const current = session.current;
  elements.themePill.textContent = `${t("Thème", "Topic")}: ${displayTheme(session.config.theme)} | ${languageLabel(session.config.questionLanguage)}`;
  elements.progressChip.textContent = `Question ${session.currentIndex + 1} / ${session.totalQuestions}`;
  elements.questionText.textContent = current.question;
  elements.questionMeta.textContent = `${current.category} | ${current.subcategory}${
    isRefreshRequired(current.refreshBeforeInterview) ? t(" | À actualiser avant l'entretien", " | Refresh before the interview") : ""
  }`;
  elements.globalScorePill.textContent = session.globalScore === null
    ? t("Score global --", "Overall score --")
    : `${t("Score global", "Overall score")} ${session.globalScore}%`;

  if (session.status !== "running") {
    redirectToResults(session);
    return;
  }

  const isFirstQuestion = session.currentIndex === 0;
  const isLastQuestion = session.currentIndex === session.totalQuestions - 1;

  elements.sessionTitle.textContent = t("Session chronométrée", "Timed session");
  elements.sessionSubtitle.textContent = t("Répondez aux questions avant la fin du compte à rebours.", "Answer the questions before time runs out.");
  elements.questionModeLabel.textContent = t("Question", "Question");
  elements.sideTitle.textContent = t("Questions", "Questions");
  elements.sideHint.textContent = t(
    "Les corrections seront disponibles sur la page résultats une fois la session terminée.",
    "Feedback will be available on the results page once the session is complete."
  );
  elements.candidateAnswer.value = current.candidateAnswer || "";
  elements.timerDisplay.textContent = formatTime(session.remainingMs);
  elements.prevQuestion.classList.toggle("hidden", isFirstQuestion);
  elements.prevQuestion.disabled = isFirstQuestion;
  elements.nextQuestion.disabled = isLastQuestion;
  elements.nextQuestion.classList.toggle("hidden", isLastQuestion);
  elements.finishNow.classList.toggle("solo-action", isLastQuestion);

  renderNavigator();
}

function showSessionLoadError() {
  elements.sessionTitle.textContent = t("Session introuvable", "Session not found");
  elements.sessionSubtitle.textContent = t(
    "Impossible de charger cette session. Relancez un entraînement depuis les paramètres.",
    "Unable to load this session. Start a new training session from settings."
  );
  elements.timerDisplay.textContent = "--:--";
  elements.progressChip.textContent = t("Erreur", "Error");
  elements.themePill.textContent = t("Aucune session", "No session");
  elements.questionText.textContent = t("Impossible de charger la session.", "Unable to load the session.");
  elements.questionMeta.innerHTML = `<a class="button button-primary" href="./setup.html">${t("Relancer une session", "Start a new session")}</a>`;
  elements.candidateAnswer.disabled = true;
  elements.prevQuestion.disabled = true;
  elements.nextQuestion.disabled = true;
  elements.finishNow.disabled = true;
  elements.sideHint.textContent = t(
    "Si le problème persiste, rechargez la page ou revenez aux paramètres.",
    "If the problem persists, reload the page or return to settings."
  );
}

function renderNavigator() {
  const session = getActiveSession();
  if (!session) return;

  elements.questionNav.innerHTML = "";
  session.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === session.currentIndex ? "is-current" : "";
    const suffix = question.candidateAnswer.trim()
      ? t("Réponse renseignée", "Answered")
      : t("À compléter", "To complete");
    button.innerHTML = `<strong>Q${index + 1}</strong><div class="chart-meta">${suffix}</div>`;
    button.disabled = session.status === "running";
    button.addEventListener("click", async () => {
      if (session.status === "running") return;
      goToQuestion(index);
      await render();
    });
    elements.questionNav.append(button);
  });
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function redirectToResults(session) {
  const suffix = session?.id ? `?session=${encodeURIComponent(session.id)}` : "";
  window.location.href = `./results.html${suffix}`;
}
