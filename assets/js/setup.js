import {
  getCurrentUser,
  getDatasetMeta,
  getAvailableQuestionCount,
  getSessionConfig,
  getThemeOptions,
  initializeApp,
  continueAsGuest,
  requireAuthorizedAccess,
  setSessionConfig,
  startSession,
} from "./store.js";
import { setUiLanguage, t } from "./i18n.js";
import { wireAuthNavLink } from "./nav.js";
import "./theme.js";
import "./mobile-nav.js";

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
wireAuthNavLink();
hydrate();
bindEvents();

function hydrate() {
  const meta = getDatasetMeta();
  const config = getSessionConfig();
  const languages = getLanguageOptions(meta.languages);
  const selectedLanguage = languages.includes(config.questionLanguage) ? config.questionLanguage : languages[0];
  const themes = getThemeOptions(selectedLanguage);
  const selectedTheme = themes.includes(config.theme) ? config.theme : "Aleatoire";
  fillSelect(questionLanguage, languages, selectedLanguage, languageLabel);
  fillSelect(themeSelect, themes, selectedTheme, themeLabel);
  startButton.disabled = themes.length === 0 || meta.degraded;
  if (meta.degraded) {
    setupMessage.textContent = t(
      "La base Excel n'a pas pu être chargée. Vérifiez Questions_InterviewPlus_Bilingual.xlsx puis relancez l'application.",
      "The Excel database could not be loaded. Check Questions_InterviewPlus_Bilingual.xlsx and restart the application."
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

