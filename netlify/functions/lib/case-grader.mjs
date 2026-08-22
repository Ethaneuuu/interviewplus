import { generateCaseStatement } from "../../../assets/js/case-templates.js";

export function calculateCaseSolution(statement) {
  const data = Object.fromEntries(statement.sections.flatMap((section) => section.fields).map(({ id, value }) => [id, value]));
  return statement.theme === "dcf" ? dcf(data) : statement.theme === "lbo" ? lbo(data) : merger(data);
}

export function gradeCase({ theme, difficulty, seed, answers = {}, narrativeScore } = {}) {
  const statement = generateCaseStatement({ theme, difficulty, seed });
  const solution = calculateCaseSolution(statement);
  const requestedNarrative = Boolean(statement.recommendation && typeof answers.recommendation === "string" && answers.recommendation.trim());
  const fields = statement.answerFields;
  const scoreCategory = (category) => {
    const categoryFields = fields.filter((field) => field.category === category);
    const credits = categoryFields.map((field) => credit(answers[field.id], solution[field.id], field.tolerance));
    return categoryFields.length ? credits.reduce((sum, value, index) => sum + value * categoryFields[index].weight, 0) * 100 : 0;
  };
  const results = scoreCategory("results");
  const method = scoreCategory("method");
  const justification = requestedNarrative && Number.isFinite(narrativeScore) ? clamp(narrativeScore, 0, 100) : 0;
  const resultsWeight = requestedNarrative ? 70 : 75;
  const score = round(results * resultsWeight / 100 + method * 25 / 100 + (requestedNarrative ? justification * 5 / 100 : 0), 2);
  return {
    score,
    passed: score >= 70,
    breakdown: { results: round(results, 2), method: round(method, 2), justification: round(justification, 2) },
    items: fields.map((field) => ({ id: field.id, category: field.category, credit: credit(answers[field.id], solution[field.id], field.tolerance), score: solution[field.id], tolerance: field.tolerance })),
    statement,
  };
}

function dcf(x) {
  const output = {}; let pv = 0; let revenue = x.revenue; let previousNwc = revenue * x.nwc_pct;
  for (let year = 1; year <= 5; year += 1) {
    revenue *= 1 + x.growth; const ebitda = revenue * x.ebitda_margin; const da = revenue * x.da_pct; const capex = revenue * x.capex_pct; const nwc = revenue * x.nwc_pct; const ufcf = (ebitda - da) * (1 - x.tax_rate) + da - capex - (nwc - previousNwc); const factor = 1 / (1 + x.wacc) ** year;
    output[`ufcf_y${year}`] = round(ufcf); output[`ebitda_y${year}`] = round(ebitda); output[`discount_factor_y${year}`] = round(factor, 6); if (year === 1) { output.capex_y1 = round(capex); output.nwc_y1 = round(nwc); } pv += ufcf * factor; previousNwc = nwc;
  }
  const terminal = output.ufcf_y5 * (1 + x.terminal_growth) / (x.wacc - x.terminal_growth); const terminalPv = terminal / (1 + x.wacc) ** 5; const ev = pv + terminalPv;
  Object.assign(output, { pv_ufcf: round(pv), terminal_value: round(terminal), enterprise_value: round(ev), equity_value: round(ev - x.debt + x.cash), share_price: round((ev - x.debt + x.cash) / x.shares), sensitivity_low: round(valueAtWacc(x, x.wacc + .01)), sensitivity_high: round(valueAtWacc(x, x.wacc - .01)) });
  return output;
}

function valueAtWacc(x, wacc) { let revenue = x.revenue; let priorNwc = revenue * x.nwc_pct; let pv = 0; let final; for (let year = 1; year <= 5; year += 1) { revenue *= 1 + x.growth; const nwc = revenue * x.nwc_pct; final = (revenue * (x.ebitda_margin - x.da_pct)) * (1 - x.tax_rate) + revenue * x.da_pct - revenue * x.capex_pct - (nwc - priorNwc); pv += final / (1 + wacc) ** year; priorNwc = nwc; } return (pv + final * (1 + x.terminal_growth) / (wacc - x.terminal_growth) / (1 + wacc) ** 5 - x.debt + x.cash) / x.shares; }

function lbo(x) {
  const output = {}; const entryEv = x.ebitda * x.entry_multiple; const entryEquity = entryEv - x.existing_debt + x.cash; const uses = entryEquity + x.fees; const debtStart = x.senior_debt ? x.senior_debt + x.junior_debt : x.debt; const sponsorEquity = uses - debtStart - x.rollover; let debt = debtStart; let ebitda = x.ebitda;
  Object.assign(output, { entry_ev: round(entryEv), entry_equity: round(entryEquity), uses_total: round(uses), sources_total: round(debtStart + sponsorEquity + x.rollover), sponsor_equity: round(sponsorEquity) });
  for (let year = 1; year <= 5; year += 1) { ebitda *= 1 + x.ebitda_growth; const fcf = ebitda * x.fcf_margin; const interest = debt * (x.pik_rate || .06); const paydown = Math.min(debt, Math.max(0, fcf - interest)); debt -= paydown; output[`fcf_y${year}`] = round(fcf); output[`debt_y${year}`] = round(debt); if (year === 1) { output.debt_paydown_y1 = round(paydown); output.interest_y1 = round(interest); output.pik_interest_y1 = round(debtStart * (x.pik_rate || 0)); output.revolver_draw = 0; } }
  const exitEv = ebitda * x.exit_multiple; const exitEquity = exitEv - debt + x.cash; const sponsorProceeds = exitEquity * (1 - x.management_pool); const mom = sponsorProceeds / sponsorEquity;
  Object.assign(output, { exit_ev: round(exitEv), exit_equity: round(exitEquity), mom: round(mom, 4), irr: round(mom ** .2 - 1, 6), sensitivity_low: round((ebitda * (x.exit_multiple - .5) - debt + x.cash) * (1 - x.management_pool) / sponsorEquity, 4), sensitivity_high: round((ebitda * (x.exit_multiple + .5) - debt + x.cash) * (1 - x.management_pool) / sponsorEquity, 4), management_proceeds: round(exitEquity * x.management_pool) });
  return output;
}

function merger(x) {
  const offer = x.target_share_price * (1 + x.premium); const purchaseEv = offer * x.target_shares + x.target_debt - x.target_cash; const stockMix = 1 - x.cash_mix - x.debt_mix; const cashFunding = purchaseEv * x.cash_mix; const debtFunding = purchaseEv * x.debt_mix; const stockFunding = purchaseEv * stockMix; const newShares = stockFunding / x.buyer_share_price; const buyerEps = x.buyer_net_income / x.buyer_shares; const synergyAfterTax = x.synergies * (1 - x.tax_rate); const feeAfterTax = (x.fees + (x.transaction_costs || 0)) * (1 - x.tax_rate); const integrationAfterTax = (x.integration_costs || 0) * (1 - x.tax_rate); const ppa = (x.ppa_step_up || 0) + (x.dtl || 0) + (x.write_offs || 0); const proFormaNi = x.buyer_net_income + x.target_net_income + synergyAfterTax - feeAfterTax - integrationAfterTax - ppa * .1; const proFormaEps = proFormaNi / (x.buyer_shares + newShares); const accretion = proFormaEps - buyerEps;
  return { offer_price: round(offer), purchase_ev: round(purchaseEv), cash_funding: round(cashFunding), debt_funding: round(debtFunding), stock_funding: round(stockFunding), new_shares: round(newShares), pro_forma_net_income: round(proFormaNi), pro_forma_eps: round(proFormaEps, 4), accretion_dilution_value: round(accretion, 4), accretion_dilution_pct: round(accretion / buyerEps, 6), buyer_eps: round(buyerEps, 4), synergy_after_tax: round(synergyAfterTax), fee_after_tax: round(feeAfterTax), purchase_price_allocation: round(ppa), integration_after_tax: round(integrationAfterTax), pro_forma_eps_y2: round((proFormaNi + (x.synergies || 0) * .25) / (x.buyer_shares + newShares), 4) };
}

function credit(value, expected, tolerance) { if (!Number.isFinite(value)) return 0; const difference = Math.abs(value - expected); return difference <= tolerance ? 1 : difference <= tolerance * 2 ? .5 : 0; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
