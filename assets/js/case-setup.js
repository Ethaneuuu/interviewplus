import { continueAsGuest, getCaseConfig, getCurrentUser, initializeApp, requireAuthorizedAccess, setCaseConfig, startCaseSession } from "./store.js";
import { CASE_DIFFICULTIES, CASE_THEMES } from "./case-templates.js";
import { t } from "./i18n.js";

const theme = document.getElementById("caseTheme");
const difficulty = document.getElementById("caseDifficulty");
const timer = document.getElementById("caseTimer");
const startButton = document.getElementById("startCase");
const message = document.getElementById("caseSetupMessage");

await initializeApp();
requireAuthorizedAccess("case-setup.html");
if (!getCurrentUser()) await continueAsGuest();

const config = getCaseConfig();
const query = new URLSearchParams(window.location.search);
theme.value = CASE_THEMES.includes(query.get("theme")) ? query.get("theme") : config.theme;
difficulty.value = CASE_DIFFICULTIES.includes(query.get("difficulty")) ? query.get("difficulty") : config.difficulty;
timer.value = String(config.timerMinutes);

startButton.addEventListener("click", async () => {
  const nextConfig = { theme: theme.value, difficulty: difficulty.value, timerMinutes: Number(timer.value) };
  try {
    startButton.disabled = true;
    setCaseConfig(nextConfig);
    const session = await startCaseSession(nextConfig);
    window.location.href = `./case-session.html?session=${encodeURIComponent(session.id)}`;
  } catch {
    message.textContent = t("Impossible de lancer le cas pratique avec ces paramètres.", "Unable to start the practical case with these settings.");
    startButton.disabled = false;
  }
});
