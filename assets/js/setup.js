import {
  getCurrentUser,
  getDatasetMeta,
  getAvailableQuestionCount,
  getSessionConfig,
  getThemeOptions,
  initializeApp,
  continueAsGuest,
  requireAuthorizedAccess,
  isGuestUser,
  setSessionConfig,
  startSession,
} from "./store.js";
import { setUiLanguage, t } from "./i18n.js";

const summary = document.getElementById("setupSummary");
const questionCount = document.getElementById("questionCount");
const questionLanguage = document.getElementById("questionLanguage");
const themeSelect = document.getElementById("themeSelect");
const timerMinutes = document.getElementById("timerMinutes");
const setupMessage = document.getElementById("setupMessage");
const startButton = document.getElementById("startSession");

await initializeApp();
requireAuthorizedAccess("setup.html");

let user = getCurrentUser();
if (!user) {
  user = await continueAsGuest();
}
hydrate();
bindEvents();

function hydrate() {
  const meta = getDatasetMeta();
  const config = getSessionConfig();
  const languages = getLanguageOptions(meta.languages);
  const selectedLanguage = languages.includes(config.questionLanguage) ? config.questionLanguage : languages[0];
  const themes = getThemeOptions(selectedLanguage);
  const selectedTheme = themes.includes(config.theme) ? config.theme : "Aleatoire";
  const perLanguageCount = meta.questionCountsByLanguage?.[selectedLanguage] || meta.questionCount;
  const dynamicCount = meta.dynamicQuestionCountsByLanguage?.[selectedLanguage] || 0;

  summary.innerHTML = `
    <span class="pill">${perLanguageCount} ${t("questions en", "questions in")} ${languageLabel(selectedLanguage).toLowerCase()}</span>
    <span class="pill">${meta.themeCount} ${t("catégories + tirage aléatoire", "categories + random draw")}</span>
    <span class="pill">${languages.map(languageLabel).join(" / ")}</span>
    <span class="pill">${dynamicCount} ${t("questions à actualiser", "questions to refresh")}</span>
    <span class="pill">${t("Profil", "Profile")}: ${isGuestUser(user) ? t("Invité", "Guest") : escapeHtml(user.name)}</span>
    ${isGuestUser(user) ? `<a class="pill pill-link" href="./auth.html">${t("Créer un compte pour synchroniser", "Create an account to sync")}</a>` : ""}
  `;

  fillSelect(questionLanguage, languages, selectedLanguage, languageLabel);
  fillSelect(themeSelect, themes, selectedTheme, themeLabel);
  startButton.disabled = themes.length === 0 || meta.degraded;
  if (meta.degraded) {
    setupMessage.textContent = t(
      "La base Excel n'a pas pu être chargée. Vérifiez Questions_InterviewPlus.xlsx puis relancez l'application.",
      "The Excel database could not be loaded. Check Questions_InterviewPlus.xlsx and restart the application."
    );
  } else if (!themes.length) {
    setupMessage.textContent = t("Aucun thème n'a pu être chargé depuis la base Excel.", "No topic could be loaded from the Excel database.");
  }
  questionCount.value = String(config.questionCount || 5);
  questionLanguage.value = selectedLanguage;
  timerMinutes.value = String(config.timerMinutes || 10);
  refreshQuestionCountOptions();
}

function bindEvents() {
  themeSelect.addEventListener("change", refreshQuestionCountOptions);
  questionLanguage.addEventListener("change", () => {
    setUiLanguage(questionLanguage.value);
    setSessionConfig({
      questionLanguage: questionLanguage.value,
      theme: "Aleatoire",
    });
    hydrate();
  });

  startButton.addEventListener("click", async () => {
    try {
      const config = {
        questionCount: Number(questionCount.value),
        questionLanguage: questionLanguage.value,
        theme: themeSelect.value,
        timerMinutes: Number(timerMinutes.value),
      };
      if (!config.theme) {
        setupMessage.textContent = t("Choisissez un thème avant de lancer la session.", "Choose a topic before starting the session.");
        return;
      }
      if (!config.questionCount || !config.timerMinutes) {
        setupMessage.textContent = t("Vérifiez le nombre de questions et le timer.", "Check the number of questions and the timer.");
        return;
      }
      setSessionConfig(config);
      const session = await startSession(config);
      const params = new URLSearchParams({
        session: session.id,
        questions: String(config.questionCount),
        language: config.questionLanguage,
        theme: config.theme,
        timer: String(config.timerMinutes),
      });
      window.location.href = `./session.html?${params.toString()}`;
    } catch (error) {
      setupMessage.textContent = error?.message === "NOT_ENOUGH_QUESTIONS"
        ? t("Ce thème ne contient pas assez de questions pour la taille demandée.", "This topic does not contain enough questions for the requested session size.")
        : t("Impossible de lancer la session avec ces paramètres.", "Unable to start the session with these settings.");
    }
  });
}

function refreshQuestionCountOptions() {
  const available = getAvailableQuestionCount(themeSelect.value, questionLanguage.value);
  const options = Array.from(questionCount.options);
  options.forEach((option) => {
    option.disabled = Number(option.value) > available;
  });

  if (questionCount.selectedOptions[0]?.disabled) {
    const largestAvailable = [...options]
      .filter((option) => !option.disabled)
      .sort((a, b) => Number(b.value) - Number(a.value))[0];
    if (largestAvailable) questionCount.value = largestAvailable.value;
  }

  if (available > 0 && !getDatasetMeta().degraded) {
    setupMessage.textContent = t(
      `${available} question${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""} pour ce choix.`,
      `${available} question${available > 1 ? "s" : ""} available for this selection.`
    );
  }
}

function fillSelect(select, values, selectedValue, labelFormatter = (value) => value) {
  select.innerHTML = "";
  if (!values.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("Aucun thème disponible", "No topic available");
    select.append(option);
    return;
  }
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelFormatter(value);
    if (value === selectedValue) {
      option.selected = true;
    }
    select.append(option);
  });
}

function getLanguageOptions(languages) {
  const available = new Set(languages.length ? languages : ["en"]);
  const ordered = ["en", "fr"].filter((language) => available.has(language));
  return ordered.length ? ordered : ["en"];
}

function languageLabel(language) {
  return language === "fr" ? t("Français", "French") : t("Anglais", "English");
}

function themeLabel(theme) {
  if (theme !== "Aleatoire") return theme;
  return questionLanguage.value === "en" ? "Random" : "Aléatoire";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
