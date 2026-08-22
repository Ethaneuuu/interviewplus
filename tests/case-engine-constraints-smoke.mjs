import { equal, ok } from "node:assert/strict";
import { generateCaseStatement } from "../assets/js/case-templates.js";
import { calculateCaseSolution } from "../netlify/functions/lib/case-grader.mjs";

function inputs(statement) {
  return Object.fromEntries(statement.sections.flatMap((section) => section.fields).map(({ id, value }) => [id, value]));
}

function close(actual, expected, message) {
  ok(Math.abs(actual - expected) <= .02, `${message}: ${actual} !== ${expected}`);
}

let cashBound = 0;
let stockFloorBound = 0;
let leverageBound = 0;
let revolverDrawn = 0;
let revolverRepaid = 0;
let distinctSegments = 0;

for (let seed = 0; seed < 1000; seed += 1) {
  const dcfStatement = generateCaseStatement({ theme: "dcf", difficulty: "advanced", seed });
  const dcf = inputs(dcfStatement);
  const dcfSolution = calculateCaseSolution(dcfStatement);
  equal(dcf.revenue, dcf.segment_a_revenue + dcf.segment_b_revenue, `DCF segments reconcile for seed ${seed}`);
  ok(!("growth" in dcf) && !("ebitda_margin" in dcf) && !("beta" in dcf), `DCF advanced inputs are not superseded for seed ${seed}`);
  if (dcf.segment_a_growth !== dcf.segment_b_growth && dcf.segment_a_margin !== dcf.segment_b_margin) distinctSegments += 1;
  const unleveredBeta = dcf.comparable_beta / (1 + (1 - dcf.tax_rate) * dcf.comparable_debt_pct / (1 - dcf.comparable_debt_pct));
  const releveredBeta = unleveredBeta * (1 + (1 - dcf.tax_rate) * dcf.target_debt_pct / (1 - dcf.target_debt_pct));
  const wacc = (dcf.risk_free_rate + releveredBeta * dcf.equity_risk_premium) * (1 - dcf.target_debt_pct) + dcf.cost_of_debt * (1 - dcf.tax_rate) * dcf.target_debt_pct;
  close(dcfSolution.discount_factor_y1, 1 / (1 + wacc) ** (dcf.stub_year_fraction + .5), `DCF WACC convention for seed ${seed}`);

  const lboStatement = generateCaseStatement({ theme: "lbo", difficulty: "advanced", seed });
  const lboInputs = inputs(lboStatement);
  const lbo = calculateCaseSolution(lboStatement);
  ok(!("debt" in lboInputs) && !("fcf_margin" in lboInputs) && !("ebitda_growth" in lboInputs), `LBO advanced inputs are not superseded for seed ${seed}`);
  close(lbo.uses_total, lbo.entry_equity + lboInputs.existing_debt + lboInputs.fees + lboInputs.earnout + lboInputs.min_cash, `LBO uses for seed ${seed}`);
  close(lbo.sources_total, lboInputs.senior_debt + lboInputs.junior_debt + lbo.sponsor_equity + lboInputs.rollover + lboInputs.cash, `LBO sources include target cash for seed ${seed}`);
  close(lbo.cash_y1, lboInputs.min_cash + lbo.fcf_y1 + lbo.revolver_draw - lbo.sweep_y1, `LBO year-one cash bridge for seed ${seed}`);
  ok(lbo.sweep_y1 <= Math.max(0, lboInputs.min_cash + lbo.fcf_y1 + lbo.revolver_draw - lboInputs.min_cash) * lboInputs.cash_sweep + .02, `LBO single sweep envelope for seed ${seed}`);
  if (lbo.revolver_draw > 0 && lbo.fcf_y1 < 0) { revolverDrawn += 1; if (lbo.revolver_y2 < lbo.revolver_draw) revolverRepaid += 1; }
  const exitEbitda = lbo.exit_ev / lboInputs.exit_multiple;
  const lowEquity = (lboInputs.exit_multiple - .5) * exitEbitda - lbo.exit_debt + lbo.exit_cash;
  const lowManagement = Math.max(0, lowEquity - lbo.sponsor_equity * lboInputs.management_hurdle) * lboInputs.management_pool;
  close(lbo.sensitivity_low, (lowEquity - lowManagement) / lbo.sponsor_equity, `LBO low waterfall for seed ${seed}`);

  const mergerStatement = generateCaseStatement({ theme: "merger-model", difficulty: "advanced", seed });
  const mergerInputs = inputs(mergerStatement);
  const merger = calculateCaseSolution(mergerStatement);
  const cashAvailable = mergerInputs.buyer_cash - mergerInputs.minimum_cash;
  const debtCapacity = mergerInputs.max_leverage * mergerInputs.buyer_ebitda - mergerInputs.buyer_debt;
  if (Math.abs(merger.cash_funding - cashAvailable) <= .02) cashBound += 1;
  if (Math.abs(merger.stock_funding / merger.purchase_ev - mergerInputs.stock_mix_floor) <= .0002) stockFloorBound += 1;
  if (Math.abs(merger.debt_funding - debtCapacity) <= .02) leverageBound += 1;
  close(merger.cash_funding + merger.debt_funding + merger.stock_funding, merger.purchase_ev, `Merger funding for seed ${seed}`);
}

ok(distinctSegments > 900, "Generated DCF cases need distinct segment forecasts");
ok(revolverDrawn > 100, "Generated LBO cases need FCF-driven liquidity draws");
ok(revolverRepaid > 50, "Generated LBO cases need revolver repayment priority");
ok(cashBound > 100, "Generated Merger cases need cash constraints that bind");
ok(stockFloorBound > 100, "Generated Merger cases need stock floors that bind");
ok(leverageBound > 100, "Generated Merger cases need leverage caps that bind");

console.log(JSON.stringify({ ok: true, generated: 1000, cashBound, stockFloorBound, leverageBound, revolverDrawn, revolverRepaid }));
