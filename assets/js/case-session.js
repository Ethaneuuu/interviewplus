import { continueAsGuest, discardActiveSession, finalizeCaseSession, getActiveSession, getCurrentUser, initializeApp, pauseActiveSession, requireAuthorizedAccess, resumeActiveSession, saveCaseAnswer } from "./store.js";
import { caseInputLabel, caseOutputLabel, caseSessionInstructions, caseSessionTitle, t } from "./i18n.js";
import { caseFyLabel } from "./case-templates.js";
import { wireAuthNavLink } from "./nav.js";
import { installSessionExit } from "./session-exit.js";
import "./theme.js";
import "./mobile-nav.js";

const title = document.getElementById("caseTitle");
const instructions = document.getElementById("caseInstructions");
const timer = document.getElementById("caseTimerDisplay");
const statementRoot = document.getElementById("caseStatement");
const answersRoot = document.getElementById("caseAnswers");
const finishButton = document.getElementById("finishCase");
const message = document.getElementById("caseMessage");
const exitContainer = document.getElementById("caseExit");
let isFinalizing = false;
let autoFinalizationAttempted = false;

await initializeApp({ loadDataset: false });
requireAuthorizedAccess("case-session.html");
if (!getCurrentUser()) await continueAsGuest();
wireAuthNavLink();
if (getActiveSession()?.status === "paused") resumeActiveSession();
installSessionExit({
  container: exitContainer,
  isRunning: () => getActiveSession()?.status === "running",
  onPause: () => {
    pauseActiveSession();
    window.location.href = "./profile.html";
  },
  onQuit: () => {
    discardActiveSession();
    window.location.href = "./index.html";
  },
});
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

function statementInputFields(statement) {
  return statement.sections.flatMap((section) => section.fields);
}

function renderStatement(statement) {
  statementRoot.replaceChildren();

  const context = document.createElement("div");
  context.className = "case-context";
  if (statement.companyName) {
    const companyHeading = document.createElement("h2");
    companyHeading.textContent = statement.targetName
      ? `${statement.companyName} × ${statement.targetName}`
      : statement.companyName;
    const sector = document.createElement("p");
    sector.className = "eyebrow";
    sector.textContent = t(statement.sectorFr, statement.sectorEn);
    context.append(sector, companyHeading);
  }

  const narrative = document.createElement("p");
  narrative.className = "case-narrative";
  narrative.textContent = t(statement.narrativeFr, statement.narrativeEn);
  context.append(narrative);

  // Remaining numeric inputs are woven into the prose as a readable run-in list
  // rather than a separate "Case inputs" table.
  const fields = statementInputFields(statement);
  if (fields.length) {
    const figures = document.createElement("p");
    figures.className = "case-figures";
    figures.innerHTML = `${t("Hypothèses retenues", "Working assumptions")} : ${fields
      .map((field) => `${caseInputLabel(field.id, field.label)} <b>${escapeHtml(formatValue(field.value, field.format))}</b>`)
      .join(" · ")}.`;
    context.append(figures);
  }

  statementRoot.append(context);
}

function renderInputReference(statement) {
  const fields = statementInputFields(statement);
  if (!fields.length) return;
  const details = document.createElement("details");
  details.className = "case-inputs-inline";
  const summary = document.createElement("summary");
  summary.textContent = t("Rappel des données chiffrées", "Key figures for reference");
  const list = document.createElement("dl");
  fields.forEach((field) => {
    const dt = document.createElement("dt");
    dt.textContent = caseInputLabel(field.id, field.label);
    const dd = document.createElement("dd");
    dd.textContent = formatValue(field.value, field.format);
    list.append(dt, dd);
  });
  details.append(summary, list);
  answersRoot.append(details);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function wrapScroll(table) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-scroll";
  wrapper.append(table);
  return wrapper;
}

function renderAnswers(statement, answers) {
  answersRoot.replaceChildren();

  renderInputReference(statement);

  // Answer tables for every field the model requires, no separate "Method"
  // block. Grading still reads field.category from the statement.
  buildFieldsTables(statement.answerFields, answers, statement.baseYear).forEach((table) => {
    answersRoot.append(wrapScroll(table));
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

// Two independent tables instead of one shared-width grid: a single-value row
// (e.g. Share price) used to inherit the 5-year series' column widths just to
// stay in the same table, forcing a horizontal scroll on mobile to fill in a
// value that only ever needed a label and one input.
function buildFieldsTables(fields, answers, baseYear) {
  const seriesMatch = (field) => field.id.match(/^(.+)_y([1-5])$/);
  const seriesBases = new Map();
  const singles = [];

  fields.forEach((field) => {
    const match = seriesMatch(field);
    if (!match) {
      singles.push(field);
      return;
    }
    const [, base, yearIndex] = match;
    if (!seriesBases.has(base)) seriesBases.set(base, new Array(5).fill(null));
    seriesBases.get(base)[Number(yearIndex) - 1] = field;
  });

  // Only keep a base as a 5-column grid row when every year is actually required.
  // A partial series (e.g. only N+1 and N+5) becomes individual labelled rows so
  // that every visible input cell is real and editable.
  for (const [base, yearFields] of [...seriesBases]) {
    if (yearFields.some((field) => field === null)) {
      yearFields.forEach((field) => { if (field) singles.push(field); });
      seriesBases.delete(base);
    }
  }

  const tables = [];
  if (seriesBases.size > 0) tables.push(buildSeriesTable(seriesBases, answers, baseYear));
  if (singles.length > 0) tables.push(buildSinglesTable(singles, answers));
  return tables;
}

function buildSeriesTable(seriesBases, answers, baseYear) {
  const table = document.createElement("table");
  table.className = "case-table case-table-excel case-table-grid";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = `<th scope="col">${t("Sortie", "Output")}</th>`;
  for (let year = 1; year <= 5; year += 1) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = caseFyLabel(baseYear, year);
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  seriesBases.forEach((yearFields, base) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = caseOutputLabel(`${base}_y1`, base.replaceAll("_", " ").toUpperCase()).replace(/\sN\+1$/, "");
    row.append(label);
    for (let year = 1; year <= 5; year += 1) {
      const cell = document.createElement("td");
      const field = yearFields[year - 1];
      if (field) cell.append(buildAnswerInput(field, answers));
      row.append(cell);
    }
    tbody.append(row);
  });
  table.append(tbody);
  return table;
}

function buildSinglesTable(singles, answers) {
  const table = document.createElement("table");
  table.className = "case-table case-table-excel case-table-grid";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th scope="col">${t("Sortie", "Output")}</th><th scope="col">${t("Valeur", "Value")}</th></tr>`;
  table.append(thead);

  const tbody = document.createElement("tbody");
  singles.forEach((field) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = caseOutputLabel(field.id, field.label);
    const cell = document.createElement("td");
    cell.append(buildAnswerInput(field, answers));
    row.append(label, cell);
    tbody.append(row);
  });
  table.append(tbody);
  return table;
}

function buildAnswerInput(field, answers) {
  const input = document.createElement("input");
  input.id = `case-answer-${field.id}`;
  input.type = "number";
  input.step = "any";
  input.inputMode = "decimal";
  input.className = "case-grid-input";
  input.value = answers[field.id] || "";
  input.ariaLabel = caseOutputLabel(field.id, field.label);
  input.addEventListener("input", () => saveCaseAnswer(field.id, input.value));
  return input;
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
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (format === "percent") return `${(number * 100).toFixed(1)}%`;
  if (format === "multiple") return `${number.toFixed(1)}x`;
  if (format === "number") return String(Math.round(number * 100) / 100);
  return `$${Math.round(number).toLocaleString("en-US")}M`;
}
