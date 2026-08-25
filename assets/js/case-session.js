import { continueAsGuest, finalizeCaseSession, getActiveSession, getCurrentUser, initializeApp, requireAuthorizedAccess, saveCaseAnswer } from "./store.js";
import { caseInputLabel, caseOutputLabel, caseSectionLabel, caseSessionInstructions, caseSessionTitle, t } from "./i18n.js";
import { caseFyLabel } from "./case-templates.js";
import { wireAuthNavLink } from "./nav.js";
import "./theme.js";
import "./mobile-nav.js";

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
wireAuthNavLink();
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

  if (statement.companyName) {
    const context = document.createElement("div");
    context.className = "case-context";
    const companyHeading = document.createElement("h2");
    companyHeading.textContent = statement.targetName
      ? `${statement.companyName} × ${statement.targetName}`
      : statement.companyName;
    const sector = document.createElement("p");
    sector.className = "eyebrow";
    sector.textContent = t(statement.sectorFr, statement.sectorEn);
    const narrative = document.createElement("p");
    narrative.className = "case-narrative";
    narrative.textContent = t(statement.narrativeFr, statement.narrativeEn);
    context.append(sector, companyHeading, narrative);
    statementRoot.append(context);
  }

  const heading = document.createElement("h3");
  heading.textContent = t("Données du cas", "Case inputs");
  statementRoot.append(heading);
  statement.sections.forEach((section) => {
    const sectionTitle = document.createElement("h4");
    sectionTitle.textContent = caseSectionLabel(section.id, section.title);
    const table = document.createElement("table");
    table.className = "case-table case-table-excel";
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
    statementRoot.append(sectionTitle, wrapScroll(table));
  });
}

function wrapScroll(table) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-scroll";
  wrapper.append(table);
  return wrapper;
}

function renderAnswers(statement, answers) {
  answersRoot.replaceChildren();

  const resultsFields = statement.answerFields.filter((field) => field.category === "results");
  const methodFields = statement.answerFields.filter((field) => field.category === "method");

  if (resultsFields.length) {
    const heading = document.createElement("h3");
    heading.textContent = t("Résultats", "Results");
    answersRoot.append(heading, wrapScroll(buildFieldsTable(resultsFields, answers, statement.baseYear)));
  }
  if (methodFields.length) {
    const heading = document.createElement("h3");
    heading.textContent = t("Méthode", "Method");
    answersRoot.append(heading, wrapScroll(buildFieldsTable(methodFields, answers, statement.baseYear)));
  }

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

function buildFieldsTable(fields, answers, baseYear) {
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
    if (!seriesBases.has(base)) seriesBases.set(base, []);
    seriesBases.get(base)[Number(yearIndex) - 1] = field;
  });

  const hasSeries = seriesBases.size > 0;
  const table = document.createElement("table");
  table.className = "case-table case-table-excel case-table-grid";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = `<th scope="col">${t("Sortie", "Output")}</th>`;
  if (hasSeries) {
    for (let year = 1; year <= 5; year += 1) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = caseFyLabel(baseYear, year);
      headRow.append(th);
    }
  } else {
    headRow.innerHTML += `<th scope="col">${t("Valeur", "Value")}</th>`;
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");

  seriesBases.forEach((yearFields, base) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = caseOutputLabel(`${base}_y1`, base.replaceAll("_", " ").toUpperCase()).replace(/\s(A|Y)1$/, "");
    row.append(label);
    for (let year = 1; year <= 5; year += 1) {
      const cell = document.createElement("td");
      const field = yearFields[year - 1];
      if (field) cell.append(buildAnswerInput(field, answers));
      row.append(cell);
    }
    tbody.append(row);
  });

  singles.forEach((field) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = caseOutputLabel(field.id, field.label);
    const cell = document.createElement("td");
    if (hasSeries) cell.colSpan = 5;
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
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  return String(value);
}
