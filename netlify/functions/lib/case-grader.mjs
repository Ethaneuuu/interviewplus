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
  const wacc = dcfWacc(x); const projection = dcfProjection(x, wacc); const equity = projection.enterpriseValue - x.debt + x.cash;
  return { ...projection.output, pv_ufcf: round(projection.pv), terminal_value: round(projection.terminal), enterprise_value: round(projection.enterpriseValue), equity_value: round(equity), share_price: round(equity / x.shares), sensitivity_low: round(dcfProjection(x, wacc + .01).enterpriseValue / x.shares - (x.debt - x.cash) / x.shares), sensitivity_high: round(dcfProjection(x, wacc - .01).enterpriseValue / x.shares - (x.debt - x.cash) / x.shares) };
}

function dcfWacc(x) {
  if (Number.isFinite(x.wacc)) return x.wacc;
  const debtWeight = x.target_debt_pct; const peerBeta = Number.isFinite(x.comparable_beta) ? (x.beta + x.comparable_beta) / 2 : x.beta;
  const unleveredBeta = peerBeta / (1 + (1 - x.tax_rate) * debtWeight / (1 - debtWeight));
  const releveredBeta = unleveredBeta * (1 + (1 - x.tax_rate) * debtWeight / (1 - debtWeight));
  return x.risk_free_rate + releveredBeta * x.equity_risk_premium * (1 - debtWeight) + x.cost_of_debt * (1 - x.tax_rate) * debtWeight;
}

function dcfProjection(x, wacc) {
  const advanced = Number.isFinite(x.segment_a_revenue); const growth = advanced ? x.growth + (1 - x.base_case_probability) * x.upside_growth : x.growth;
  let revenue = advanced ? x.segment_a_revenue + x.segment_b_revenue : x.revenue; let previousNwc = revenue * x.nwc_pct; let pv = 0; let finalUfcf = 0; let finalFactor = 0; const output = {};
  for (let year = 1; year <= 5; year += 1) {
    revenue *= 1 + growth; const ebitda = revenue * x.ebitda_margin; const da = revenue * x.da_pct; const capex = revenue * x.capex_pct; const nwc = revenue * x.nwc_pct; const ufcf = (ebitda - da) * (1 - x.tax_rate) + da - capex - (nwc - previousNwc);
    const period = advanced ? x.stub_year_fraction + year - 1 + (x.mid_year_convention ? .5 : 0) : year; const factor = 1 / (1 + wacc) ** period;
    output[`ufcf_y${year}`] = round(ufcf); output[`ebitda_y${year}`] = round(ebitda); output[`discount_factor_y${year}`] = round(factor, 6); if (year === 1) { output.capex_y1 = round(capex); output.nwc_y1 = round(nwc); } pv += ufcf * factor; previousNwc = nwc; finalUfcf = ufcf; finalFactor = factor;
  }
  const terminal = finalUfcf * (1 + x.terminal_growth) / (wacc - x.terminal_growth); return { output, pv, terminal, enterpriseValue: pv + terminal * finalFactor };
}

function lbo(x) {
  const entryEv = x.ebitda * x.entry_multiple; const entryEquity = entryEv - x.existing_debt + x.cash; const seniorStart = x.senior_debt ?? x.debt; const juniorStart = x.junior_debt ?? 0; const minCash = x.min_cash || 0; const earnout = x.earnout || 0; const rollover = x.rollover || 0; const uses = entryEquity + x.existing_debt + x.fees + earnout + minCash; const sponsorEquity = uses - seniorStart - juniorStart - rollover;
  let senior = seniorStart; let junior = juniorStart; let revolver = 0; let cash = minCash; let nol = x.nol || 0; let ebitda = x.ebitda; const output = { entry_ev: round(entryEv), entry_equity: round(entryEquity), uses_total: round(uses), sources_total: round(senior + junior + rollover + sponsorEquity), sponsor_equity: round(sponsorEquity) };
  for (let year = 1; year <= 5; year += 1) {
    const advanced = Number.isFinite(x.revenue_growth); const growth = advanced ? (1 + x.revenue_growth) * (1 + x.margin_expansion) - 1 : x.ebitda_growth; ebitda *= 1 + growth;
    const cashInterest = senior * .06 + junior * .10 + revolver * .08; const pikInterest = junior * (x.pik_rate || 0); junior += pikInterest; const depreciation = (x.ppa_step_up || 0) / 5; const taxableIncome = Math.max(0, ebitda - depreciation - cashInterest); const nolUsed = Math.min(nol, taxableIncome); nol -= nolUsed; const taxes = (taxableIncome - nolUsed) * .25; const fcf = ebitda * x.fcf_margin - cashInterest - taxes;
    cash += fcf; const requiredDraw = Math.max(0, minCash - cash); const draw = Math.min(x.revolver_limit ?? 0, requiredDraw); revolver += draw; cash += draw;
    const sweep = Math.max(0, cash - minCash) * (x.cash_sweep ?? 1); const callPremium = x.call_premium || 0; const juniorPaydown = Math.min(junior, sweep / (1 + callPremium)); junior -= juniorPaydown; cash -= juniorPaydown * (1 + callPremium); const seniorPaydown = Math.min(senior, Math.max(0, cash - minCash)); senior -= seniorPaydown; cash -= seniorPaydown;
    output[`fcf_y${year}`] = round(fcf); output[`debt_y${year}`] = round(senior + junior + revolver); if (year === 1) Object.assign(output, { debt_paydown_y1: round(juniorPaydown + seniorPaydown), interest_y1: round(cashInterest), pik_interest_y1: round(pikInterest), revolver_draw: round(draw) });
  }
  const debt = senior + junior + revolver; const exitEv = ebitda * x.exit_multiple; const exitEquity = exitEv - debt + cash; const managementProceeds = exitEquity * (x.management_pool || 0); const sponsorProceeds = exitEquity - managementProceeds; const mom = sponsorProceeds / sponsorEquity;
  return { ...output, exit_ev: round(exitEv), exit_equity: round(exitEquity), mom: round(mom, 4), irr: round(mom ** .2 - 1, 6), sensitivity_low: round((ebitda * (x.exit_multiple - .5) - debt + cash - managementProceeds) / sponsorEquity, 4), sensitivity_high: round((ebitda * (x.exit_multiple + .5) - debt + cash - managementProceeds) / sponsorEquity, 4), management_proceeds: round(managementProceeds) };
}

function merger(x) {
  const offer = x.target_share_price * (1 + x.premium); const purchaseEv = offer * x.target_shares + x.target_debt - x.target_cash; const stockFloor = x.stock_mix_floor || 0; const cashAvailable = Math.max(0, (x.buyer_cash ?? purchaseEv) - (x.minimum_cash || 0)); const cashFunding = Math.min(purchaseEv * x.cash_mix, cashAvailable, purchaseEv * (1 - stockFloor)); const debtCapacity = Number.isFinite(x.max_leverage) ? Math.max(0, x.max_leverage * x.buyer_ebitda - x.buyer_debt) : purchaseEv; const debtFunding = Math.min(purchaseEv * x.debt_mix, debtCapacity, purchaseEv * (1 - stockFloor) - cashFunding); const reportedPurchaseEv = round(purchaseEv); const reportedCashFunding = round(cashFunding); const reportedDebtFunding = round(debtFunding); const reportedStockFunding = round(reportedPurchaseEv - reportedCashFunding - reportedDebtFunding); const newShares = reportedStockFunding / x.buyer_share_price;
  const buyerEps = x.buyer_net_income / x.buyer_shares; const synergyYear1 = x.synergies * (x.synergy_year1_pct ?? 1); const synergyAfterTax = synergyYear1 * (1 - x.tax_rate); const feeAfterTax = (x.fees + (x.transaction_costs || 0)) * (1 - x.tax_rate); const integrationAfterTax = (x.integration_costs || 0) * (1 - x.tax_rate); const ppa = (x.ppa_step_up || 0) + (x.dtl || 0) + (x.write_offs || 0); const financingAfterTax = (debtFunding * (x.debt_rate || 0) + cashFunding * (x.cash_yield || 0)) * (1 - x.tax_rate); const ppaAmortization = (x.ppa_step_up || 0) / 5 * (1 - x.tax_rate); const proFormaNi = x.buyer_net_income + x.target_net_income + synergyAfterTax - feeAfterTax - integrationAfterTax - financingAfterTax - ppaAmortization; const proFormaEps = proFormaNi / (x.buyer_shares + newShares); const accretion = proFormaEps - buyerEps;
  const year2Ni = x.buyer_net_income * (1 + (x.buyer_growth || 0)) + x.target_net_income * (1 + (x.target_growth || 0)) + x.synergies * (1 - x.tax_rate) - financingAfterTax - ppaAmortization;
  return { offer_price: round(offer), purchase_ev: reportedPurchaseEv, cash_funding: reportedCashFunding, debt_funding: reportedDebtFunding, stock_funding: reportedStockFunding, new_shares: round(newShares), pro_forma_net_income: round(proFormaNi), pro_forma_eps: round(proFormaEps, 4), accretion_dilution_value: round(accretion, 4), accretion_dilution_pct: round(accretion / buyerEps, 6), buyer_eps: round(buyerEps, 4), synergy_after_tax: round(synergyAfterTax), fee_after_tax: round(feeAfterTax), purchase_price_allocation: round(ppa), integration_after_tax: round(integrationAfterTax), pro_forma_eps_y2: round(year2Ni / (x.buyer_shares + newShares), 4) };
}

function credit(value, expected, tolerance) { if (!Number.isFinite(value)) return 0; const difference = Math.abs(value - expected); return difference <= tolerance ? 1 : difference <= tolerance * 2 ? .5 : 0; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
