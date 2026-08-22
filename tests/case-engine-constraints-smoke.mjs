import { equal, ok } from "node:assert/strict";
import { generateCaseStatement } from "../assets/js/case-templates.js";
import { calculateCaseSolution } from "../netlify/functions/lib/case-grader.mjs";

function inputMap(statement) {
  return Object.fromEntries(statement.sections.flatMap((section) => section.fields).map(({ id, value }) => [id, value]));
}

function withInput(statement, id, value) {
  const changed = structuredClone(statement);
  const field = changed.sections.flatMap((section) => section.fields).find((entry) => entry.id === id);
  if (!field) throw new Error(`Missing input ${id}`);
  field.value = value;
  return changed;
}

function changedValue(id, value) {
  if (id === "mid_year_convention" || id === "revolver_limit" || id === "max_leverage") return 0;
  return value + (id.includes("rate") || id.includes("yield") || id.includes("pct") || id.includes("margin") || id.includes("growth") || id.includes("mix") || id.includes("pool") || id.includes("probability") || id.includes("sweep") || id.includes("premium") ? .01 : 10);
}

function assertInfluences(theme, difficulty, ids) {
  const statement = generateCaseStatement({ theme, difficulty, seed: 17 });
  const values = inputMap(statement);
  for (const id of ids) {
    const driverStatement = id === "revolver_limit" ? withInput(statement, "fcf_margin", .01) : id === "stock_mix_floor" ? withInput(statement, "debt_mix", .8) : ["buyer_ebitda", "buyer_debt", "max_leverage"].includes(id) ? withInput(withInput(statement, "stock_mix_floor", 0), "debt_mix", .99) : statement;
    const baseline = calculateCaseSolution(driverStatement);
    const changed = calculateCaseSolution(withInput(driverStatement, id, changedValue(id, values[id])));
    ok(Object.keys(baseline).some((key) => baseline[key] !== changed[key]), `${theme}/${difficulty} input ${id} has no model effect`);
  }
}

assertInfluences("dcf", "intermediate", ["risk_free_rate", "beta", "equity_risk_premium", "cost_of_debt", "target_debt_pct"]);
assertInfluences("dcf", "advanced", ["segment_a_revenue", "segment_b_revenue", "base_case_probability", "upside_growth", "comparable_beta", "stub_year_fraction", "mid_year_convention"]);
assertInfluences("lbo", "intermediate", ["senior_debt", "junior_debt", "min_cash", "nol", "management_pool", "revolver_limit", "existing_debt"]);
assertInfluences("lbo", "advanced", ["revenue_growth", "margin_expansion", "ppa_step_up", "earnout", "rollover", "pik_rate", "cash_sweep", "call_premium"]);
assertInfluences("merger-model", "intermediate", ["minimum_cash", "debt_rate", "cash_yield", "ppa_step_up", "stock_mix_floor", "transaction_costs"]);
assertInfluences("merger-model", "advanced", ["buyer_growth", "target_growth", "buyer_ebitda", "buyer_debt", "max_leverage", "dtl", "write_offs", "synergy_year1_pct", "integration_costs", "buyer_cash"]);

for (let seed = 0; seed < 1000; seed += 1) {
  const dcf = inputMap(generateCaseStatement({ theme: "dcf", difficulty: "advanced", seed }));
  equal(dcf.revenue, dcf.segment_a_revenue + dcf.segment_b_revenue, `DCF segments must reconcile for seed ${seed}`);

  const lboStatement = generateCaseStatement({ theme: "lbo", difficulty: "advanced", seed });
  const lbo = calculateCaseSolution(lboStatement);
  equal(lbo.sources_total, lbo.uses_total, `LBO sources and uses must reconcile for seed ${seed}`);

  const mergerStatement = generateCaseStatement({ theme: "merger-model", difficulty: "advanced", seed });
  const mergerInputs = inputMap(mergerStatement);
  const merger = calculateCaseSolution(mergerStatement);
  ok(merger.cash_funding <= mergerInputs.buyer_cash - mergerInputs.minimum_cash + .01, `Merger cash exceeds availability for seed ${seed}`);
  ok(merger.stock_funding / merger.purchase_ev >= mergerInputs.stock_mix_floor - .0001, `Merger stock mix below floor for seed ${seed}`);
  ok(merger.debt_funding <= mergerInputs.max_leverage * mergerInputs.buyer_ebitda - mergerInputs.buyer_debt + .01, `Merger leverage exceeds cap for seed ${seed}`);
  equal(Math.round((merger.cash_funding + merger.debt_funding + merger.stock_funding) * 100) / 100, merger.purchase_ev, `Merger funding must reconcile for seed ${seed}`);
}

const dcfFormats = inputMap(generateCaseStatement({ theme: "dcf", difficulty: "advanced", seed: 1 }));
const dcfFields = generateCaseStatement({ theme: "dcf", difficulty: "advanced", seed: 1 }).sections[0].fields;
const mergerFields = generateCaseStatement({ theme: "merger-model", difficulty: "advanced", seed: 1 });
equal(dcfFields.find(({ id }) => id === "shares").format, "number");
equal(dcfFields.find(({ id }) => id === "comparable_beta").format, "multiple");
equal(dcfFields.find(({ id }) => id === "stub_year_fraction").format, "number");
equal(mergerFields.sections[0].fields.find(({ id }) => id === "buyer_shares").format, "number");
equal(mergerFields.answerFields.find(({ id }) => id === "new_shares").format, "number");
ok(dcfFormats.revenue > 0);

console.log(JSON.stringify({ ok: true, constraints: 1000, drivers: "all" }));
