import { continueAsGuest, finalizeCaseSession, getActiveSession, getCurrentUser, initializeApp, requireAuthorizedAccess, saveCaseAnswer } from "./store.js";
import { caseInputLabel, caseOutputLabel, caseSectionLabel, caseSessionInstructions, caseSessionTitle, t } from "./i18n.js";

const title = document.getElementById("caseTitle");
const instructions = document.getElementById("caseInstructions");
const timer = document.getElementById("caseTimerDisplay");
const statementRoot = document.getElementById("caseStatement");
const answersRoot = document.getElementById("caseAnswers");
const finishButton = document.getElementById("finishCase");
const message = document.getElementById("caseMessage");
let isFinalizing = false;
let autoFinalizationAttempted = false;

await initializeApp();
requireAuthorizedAccess("case-session.html");
if (!getCurrentUser()) await continueAsGuest();
render();
startTimer();

finishButton.addEventListener("click", finalizeAndRedirect);

function render() {
  const session = getActiveSession();
  if (!session || session.sessionType !== "case") {
    title.textContent = t("Cas pratique introuvable", "Practical case not found");
    instructions.textContent = t("Relancez un cas pratique depuis les paramètres.", "Start a practical case from settings.");
    finishButton.disabled = true;
    return;
  }
  const { statement, answers } = session.caseData;
  if (session.status !== "running") {
    window.location.href = `./results.html?session=${encodeURIComponent(session.id)}`;
    return;
  }
  title.textContent = caseSessionTitle(statement.theme, statement.difficulty);
  instructions.textContent = caseSessionInstructions(statement.theme, statement.difficulty, statement.instructions);
  timer.textContent = formatTime(session.remainingMs);
  renderStatement(statement);
  renderAnswers(statement, answers);
  if (session.remainingMs <= 0) {
    autoFinalizationAttempted = true;
    message.textContent = t("La correction automatique a échoué. Vos réponses sont sauvegardées : vous pouvez réessayer.", "Automatic evaluation failed. Your answers are saved; you can try again.");
  }
}

function renderStatement(statement) {
  statementRoot.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = t("Données du cas", "Case inputs");
  statementRoot.append(heading);
  statement.sections.forEach((section) => {
    const sectionTitle = document.createElement("h3");
    sectionTitle.textContent = caseSectionLabel(section.id, section.title);
    const table = document.createElement("table");
    table.className = "case-table";
    table.innerHTML = `<thead><tr><th scope="col">${t("Poste", "Item")}</th><th scope="col">${t("Valeur", "Value")}</th></tr></thead>`;
    const body = document.createElement("tbody");
    section.fields.forEach((field) => {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = caseInputLabel(field.id, field.label);
      const value = document.createElement("td");
      value.textContent = formatValue(field.value, field.format);
      row.append(label, value);
      body.append(row);
    });
    table.append(body);
    statementRoot.append(sectionTitle, table);
  });
}

function renderAnswers(statement, answers) {
  answersRoot.replaceChildren();
  statement.answerFields.forEach((field) => {
    const label = document.createElement("label");
    label.className = "field";
    label.htmlFor = `case-answer-${field.id}`;
    const labelText = document.createElement("span");
    labelText.textContent = caseOutputLabel(field.id, field.label);
    const input = document.createElement("input");
    input.id = label.htmlFor;
    input.type = "number";
    input.step = "any";
    input.inputMode = "decimal";
    input.value = answers[field.id] || "";
    input.addEventListener("input", () => saveCaseAnswer(field.id, input.value));
    label.append(labelText, input);
    answersRoot.append(label);
  });
  if (!statement.recommendation) return;
  const label = document.createElement("label");
  label.className = "field";
  label.htmlFor = "case-answer-recommendation";
  const labelText = document.createElement("span");
  labelText.textContent = t("Recommandation", "Recommendation");
  const input = document.createElement("textarea");
  input.id = label.htmlFor;
  input.rows = 7;
  input.value = answers.recommendation || "";
  input.addEventListener("input", () => saveCaseAnswer("recommendation", input.value));
  label.append(labelText, input);
  answersRoot.append(label);
}

async function finalizeAndRedirect() {
  if (isFinalizing) return;
  isFinalizing = true;
  finishButton.disabled = true;
  message.textContent = t("Correction en cours…", "Evaluation in progress…");
  try {
    const session = await finalizeCaseSession();
    window.location.href = `./results.html?session=${encodeURIComponent(session.id)}`;
  } catch {
    isFinalizing = false;
    finishButton.disabled = false;
    message.textContent = t("La correction a échoué. Vos réponses sont sauvegardées : vous pouvez réessayer.", "The evaluation failed. Your answers are saved; you can try again.");
  }
}

function startTimer() {
  window.setInterval(() => {
    const session = getActiveSession();
    if (!session || session.sessionType !== "case" || session.status !== "running") return;
    timer.textContent = formatTime(session.remainingMs);
    if (session.remainingMs <= 0 && !autoFinalizationAttempted) {
      autoFinalizationAttempted = true;
      finalizeAndRedirect();
    }
  }, 1000);
}

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatValue(value, format) {
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  return String(value);
}
