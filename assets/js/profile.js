import { continueAsGuest, getCurrentUser, getProfileAnalytics, getResultsOverview, initializeApp, isGuestUser, logoutUser, requireAuthorizedAccess } from "./store.js";
import { t } from "./i18n.js";
import { wireAuthNavLink } from "./nav.js";
import "./theme.js";
import "./mobile-nav.js";

const title = document.getElementById("profileTitle");
const metrics = document.getElementById("profileMetrics");
const strongChart = document.getElementById("strongChart");
const weakChart = document.getElementById("weakChart");
const sessionsList = document.getElementById("sessionsList");
const resumeSection = document.getElementById("resumeSection");
const resumeTitle = document.getElementById("resumeTitle");
const resumeLink = document.getElementById("resumeLink");
const resumeMeta = document.getElementById("resumeMeta");

await initializeApp({ loadDataset: false });
requireAuthorizedAccess("profile.html");
if (!getCurrentUser()) {
  await continueAsGuest();
}
wireAuthNavLink();
document.getElementById("authNavLink")?.classList.add("is-active");
await render();

async function render() {
  const analytics = await getProfileAnalytics();
  const overview = await getResultsOverview();

  const guest = isGuestUser(analytics.user);
  title.textContent = guest
    ? t("Progression invité", "Guest progress")
    : t(`Progression de ${analytics.user.name}`, `${analytics.user.name}'s progress`);
  metrics.innerHTML = `
    <article class="metric-card">
      <span class="eyebrow">Sessions</span>
      <strong>${analytics.sessionsCount}</strong>
    </article>
    <article class="metric-card">
      <span class="eyebrow">${t("Score moyen", "Average score")}</span>
      <strong>${analytics.averageScore === null ? "--" : `${analytics.averageScore}%`}</strong>
    </article>
    <article class="metric-card">
      <span class="eyebrow">${t("Niveau", "Level")}</span>
      <strong>${getLevelLabel(analytics.averageScore, analytics.sessionsCount)}</strong>
      <p class="chart-meta">${getLevelHint(analytics.sessionsCount)}</p>
    </article>
    <article class="metric-card">
      <span class="eyebrow">${t("Compte", "Account")}</span>
      <strong>${guest ? t("Mode invité", "Guest mode") : escapeHtml(analytics.user.email)}</strong>
      ${guest ? `<p class="chart-meta">${t("Données conservées uniquement sur cet appareil.", "Data is stored only on this device.")}</p>` : ""}
      <div class="button-row">
        ${guest ? `<a class="button button-primary" href="./auth.html">${t("Créer un compte", "Create an account")}</a>` : `<button class="button button-ghost" id="logoutProfile" type="button">${t("Se déconnecter", "Sign out")}</button>`}
      </div>
    </article>
  `;

  const logoutButton = document.getElementById("logoutProfile");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await logoutUser();
      window.location.href = "./auth.html";
    });
  }

  renderResume(overview.activeSession);
  renderHistory(overview.sessions);

  renderChart(strongChart, analytics.strongest, false, t("Complétez au moins 3 sessions pour obtenir une lecture fiable de vos points forts.", "Complete at least 3 sessions for a reliable view of your strengths."));
  renderChart(weakChart, analytics.weakest, true, t("Complétez au moins 3 sessions pour faire apparaître vos priorités de travail.", "Complete at least 3 sessions to identify your work priorities."));
}

function renderResume(activeSession) {
  if (!activeSession || activeSession.status === "review") {
    resumeSection.hidden = true;
    return;
  }
  const isCase = activeSession.sessionType === "case";
  const paused = activeSession.status === "paused";
  resumeSection.hidden = false;
  resumeTitle.textContent = paused
    ? t("Session en pause", "Paused session")
    : t("Session en cours", "Session in progress");
  resumeLink.href = isCase
    ? `./case-session.html?session=${encodeURIComponent(activeSession.id)}`
    : `./session.html?session=${encodeURIComponent(activeSession.id)}`;
  const kind = isCase ? t("Cas pratique", "Practical case") : t("Session questions", "Question session");
  const progress = isCase
    ? `${Object.keys(activeSession.caseData?.answers || {}).length} ${t("champs saisis", "fields filled")}`
    : `${activeSession.answeredCount || 0}/${activeSession.totalQuestions || 0} ${t("réponses", "answers")}`;
  resumeMeta.textContent = `${kind} — ${progress}`;
}

function renderHistory(sessions) {
  if (!sessions.length) {
    sessionsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">01</span>
        <h3>${t("Aucune session enregistrée", "No saved sessions")}</h3>
        <p>${t("Lancez une première session pour voir vos scores et vos corrections ici.", "Start your first session to see scores and feedback here.")}</p>
        <a class="button button-primary" href="./new-session.html">${t("Commencer une session", "Start a session")}</a>
      </div>
    `;
    return;
  }

  sessionsList.innerHTML = "";
  sessions.forEach((session) => {
    const item = document.createElement("article");
    item.className = "history-item";
    if (session.sessionType === "case") {
      const grade = session.caseData?.grade;
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(caseThemeLabel(session.config.theme))} | ${session.globalScore ?? "--"}% | ${grade?.passed ? t("Réussi", "Passed") : t("À retravailler", "To revisit")}</strong>
          <p class="chart-meta">${escapeHtml(caseDifficultyLabel(session.config.difficulty))} | ${session.config.timerMinutes} min</p>
          <p class="chart-meta">${t("Le", "On")} ${formatDate(session.completedAt || session.startedAt)}</p>
        </div>
        <a class="button button-ghost" href="./results.html?session=${encodeURIComponent(session.id)}">${t("Voir le détail", "View details")}</a>
      `;
    } else {
      const answered = session.questions.filter((question) => question.candidateAnswer.trim()).length;
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(displayTheme(session.config.theme))} | ${session.globalScore ?? "--"}%</strong>
          <p class="chart-meta">${session.questions.length} questions | ${languageLabel(session.config.questionLanguage)} | ${session.config.timerMinutes} min | ${answered} ${t("réponses renseignées", "answers provided")}</p>
          <p class="chart-meta">${t("Le", "On")} ${formatDate(session.completedAt || session.startedAt)}</p>
        </div>
        <a class="button button-ghost" href="./results.html?session=${encodeURIComponent(session.id)}">${t("Voir le détail", "View details")}</a>
      `;
    }
    sessionsList.append(item);
  });
}

function renderChart(target, rows, lowMode, emptyMessage) {
  if (!rows.length) {
    target.innerHTML = `
      <div class="empty-state compact">
        <span class="empty-icon">03</span>
        <h3>${t("Pas encore assez de données", "Not enough data yet")}</h3>
        <p>${emptyMessage}</p>
        <a class="button button-ghost" href="./new-session.html">${t("Lancer une session", "Start a session")}</a>
      </div>
    `;
    return;
  }

  target.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "chart-row";
    item.innerHTML = `
      <div class="chart-head">
        <strong>${escapeHtml(row.category)}</strong>
        <span>${row.averageScore}%</span>
      </div>
      <div class="chart-track">
        <div class="chart-bar${lowMode ? " low" : ""}" style="width: ${row.averageScore}%"></div>
      </div>
      <div class="chart-meta">${row.count} ${t(`question${row.count > 1 ? "s" : ""} corrigée${row.count > 1 ? "s" : ""}`, `reviewed question${row.count > 1 ? "s" : ""}`)}</div>
    `;
    target.append(item);
  });
}

function getLevelLabel(score, sessionsCount) {
  if (!sessionsCount) return t("À calibrer", "To calibrate");
  if (score >= 80) return "Banker-ready";
  if (score >= 60) return "Analyst-ready";
  return t("En construction", "Developing");
}

function getLevelHint(sessionsCount) {
  if (sessionsCount >= 3) return t("Base suffisante pour lire vos tendances.", "Enough data to assess your trends.");
  return t(
    `${Math.max(0, 3 - sessionsCount)} session(s) avant un diagnostic fiable.`,
    `${Math.max(0, 3 - sessionsCount)} session(s) before a reliable assessment.`
  );
}

function languageLabel(language) {
  return language === "fr" ? "FR" : "EN";
}

function displayTheme(theme) {
  return theme === "Aleatoire" ? t("Aléatoire", "Random") : theme;
}

function caseThemeLabel(theme) {
  return theme === "merger-model" ? t("Modèle de fusion", "Merger model") : String(theme || t("Cas pratique", "Practical case")).toUpperCase();
}

function caseDifficultyLabel(difficulty) {
  return ({ easy: t("Débutant", "Easy"), intermediate: t("Intermédiaire", "Intermediate"), advanced: t("Avancé", "Advanced") })[difficulty] || String(difficulty || "");
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
