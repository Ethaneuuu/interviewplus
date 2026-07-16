import {
  getCurrentUser,
  getDatasetMeta,
  initializeApp,
  isGuestUser,
} from "./store.js";
import { t } from "./i18n.js";

const datasetStats = document.getElementById("datasetStats");
const authNavLink = document.getElementById("authNavLink");
const primarySessionLink = document.getElementById("primarySessionLink");
const heroAccountNote = document.getElementById("heroAccountNote");
const appConfig = window.INTERVIEWPLUS_CONFIG || {};

const bootstrap = await initializeApp();
renderHome(bootstrap.backendMode);

function renderHome(backendMode) {
  const meta = getDatasetMeta();
  const user = getCurrentUser();

  if (datasetStats) {
    const questionsPerLanguage = Math.max(0, ...Object.values(meta.questionCountsByLanguage || {}));
    datasetStats.innerHTML = `
      <span class="pill">${questionsPerLanguage || meta.questionCount} ${t("questions par langue", "questions per language")}</span>
      <span class="pill">${meta.themeCount} ${t("thèmes", "topics")}</span>
      <span class="pill">${meta.sourceLabel}</span>
    `;
  }

  if (user) {
    authNavLink.textContent = isGuestUser(user) ? t("Connexion", "Sign in") : t("Mon espace", "My account");
    authNavLink.href = isGuestUser(user) ? "./auth.html" : "./profile.html";
    primarySessionLink.href = "./setup.html";
    heroAccountNote.textContent = isGuestUser(user)
      ? t("Mode invité actif : sessions conservées sur cet appareil.", "Guest mode active: sessions are stored on this device.")
      : `${escapeHtml(user.name)} | ${backendMode === "supabase" ? t("compte synchronisé", "synced account") : t("mode local", "local mode")}`;
    return;
  }

  authNavLink.textContent = t("Connexion", "Sign in");
  authNavLink.href = "./auth.html";
  primarySessionLink.href = appConfig.restrictedAccess ? "./auth.html?returnTo=setup.html" : "./setup.html";
  heroAccountNote.textContent = appConfig.restrictedAccess
    ? t("Accès réservé aux personnes autorisées.", "Access is limited to authorized users.")
    : t(
      "Utilisable sans compte. Créez un compte pour synchroniser vos sessions.",
      "Usable without an account. Create one to sync your sessions."
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
