import { continueAsGuest, getCurrentUser, getProfileAnalytics, initializeApp, isGuestUser, logoutUser, requireAuthorizedAccess } from "./store.js";
import { t } from "./i18n.js";

const title = document.getElementById("profileTitle");
const metrics = document.getElementById("profileMetrics");
const strongChart = document.getElementById("strongChart");
const weakChart = document.getElementById("weakChart");

await initializeApp();
requireAuthorizedAccess("profile.html");
if (!getCurrentUser()) {
  await continueAsGuest();
}
await render();

async function render() {
  const analytics = await getProfileAnalytics();

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

  renderChart(strongChart, analytics.strongest, false, t("Complétez au moins 3 sessions pour obtenir une lecture fiable de vos points forts.", "Complete at least 3 sessions for a reliable view of your strengths."));
  renderChart(weakChart, analytics.weakest, true, t("Complétez au moins 3 sessions pour faire apparaître vos priorités de travail.", "Complete at least 3 sessions to identify your work priorities."));
}

function renderChart(target, rows, lowMode, emptyMessage) {
  if (!rows.length) {
    target.innerHTML = `
      <div class="empty-state compact">
        <span class="empty-icon">03</span>
        <h3>${t("Pas encore assez de données", "Not enough data yet")}</h3>
        <p>${emptyMessage}</p>
        <a class="button button-ghost" href="./setup.html">${t("Lancer une session", "Start a session")}</a>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
