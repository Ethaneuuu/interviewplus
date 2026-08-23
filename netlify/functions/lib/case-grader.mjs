import { generateCaseStatement } from "../../../assets/js/case-templates.js";

export function calculateCaseSolution(statement) {
  const data = Object.fromEntries(statement.sections.flatMap((section) => section.fields).map(({ id, value }) => [id, value]));
  return statement.theme === "dcf" ? dcf(data) : statement.theme === "lbo" ? lbo(data) : merger(data);
}

export function gradeCase({ theme, difficulty, seed, answers = {}, narrativeScore } = {}) {
  const statement = generateCaseStatement({ theme, difficulty, seed });
  const solution = calculateCaseSolution(statement);
  const requiresNarrative = Boolean(statement.recommendation);
  const requestedNarrative = Boolean(requiresNarrative && typeof answers.recommendation === "string" && answers.recommendation.trim());
  const fields = statement.answerFields;
  const scoreCategory = (category) => {
    const categoryFields = fields.filter((field) => field.category === category);
    const credits = categoryFields.map((field) => credit(answers[field.id], solution[field.id], field.tolerance));
    return categoryFields.length ? credits.reduce((sum, value, index) => sum + value * categoryFields[index].weight, 0) * 100 : 0;
  };
  const results = scoreCategory("results");
  const method = scoreCategory("method");
  const justification = requestedNarrative && Number.isFinite(narrativeScore) ? clamp(narrativeScore, 0, 100) : 0;
  const resultsWeight = requiresNarrative ? 70 : 75;
  const score = round(results * resultsWeight / 100 + method * 25 / 100 + (requiresNarrative ? justification * 5 / 100 : 0), 2);
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
  const multipleValue = projection.exitEbitda * x.terminal_multiple;
  const down = dcfProjection({ ...x, terminal_growth: x.terminal_growth - x.sensitivity_growth_delta }, wacc + x.sensitivity_wacc_delta).enterpriseValue; const up = dcfProjection({ ...x, terminal_growth: x.terminal_growth + x.sensitivity_growth_delta }, wacc - x.sensitivity_wacc_delta).enterpriseValue;
  return { ...projection.output, pv_ufcf: round(projection.pv), terminal_value: round(projection.terminal), enterprise_value: round(projection.enterpriseValue), equity_value: round(equity), share_price: round(equity / x.shares), terminal_value_multiple: round(multipleValue), comparable_value: round(projection.pv + multipleValue * projection.terminalFactor), grid_wacc_high_growth_low: round(down), grid_wacc_low_growth_high: round(up), grid_wacc_high_multiple_low: round(projection.pv + projection.exitEbitda * (x.terminal_multiple - .5) * projection.terminalFactor), grid_wacc_low_multiple_high: round(projection.pv + projection.exitEbitda * (x.terminal_multiple + .5) * projection.terminalFactor), scenario_downside_ev: round(down), scenario_base_ev: round(projection.enterpriseValue), scenario_upside_ev: round(up), sensitivity_low: round(dcfProjection(x, wacc + x.sensitivity_wacc_delta).enterpriseValue / x.shares - (x.debt - x.cash) / x.shares), sensitivity_high: round(dcfProjection(x, wacc - x.sensitivity_wacc_delta).enterpriseValue / x.shares - (x.debt - x.cash) / x.shares) };
}

function dcfWacc(x) {
  if (Number.isFinite(x.wacc)) return x.wacc;
  const debtWeight = x.target_debt_pct; const peerBeta = Number.isFinite(x.comparable_beta) ? x.comparable_beta : x.beta;
  const peerDebtWeight = x.comparable_debt_pct ?? debtWeight;
  const unleveredBeta = peerBeta / (1 + (1 - x.tax_rate) * peerDebtWeight / (1 - peerDebtWeight));
  const releveredBeta = unleveredBeta * (1 + (1 - x.tax_rate) * debtWeight / (1 - debtWeight));
  return (x.risk_free_rate + releveredBeta * x.equity_risk_premium) * (1 - debtWeight) + x.cost_of_debt * (1 - x.tax_rate) * debtWeight;
}

function dcfProjection(x, wacc) {
  const advanced = Number.isFinite(x.segment_a_revenue); const growth = advanced ? x.growth + (1 - x.base_case_probability) * x.upside_growth : x.growth;
  let revenue = x.revenue; let segmentA = x.segment_a_revenue; let segmentB = x.segment_b_revenue; let previousNwc = revenue * x.nwc_pct; let pv = 0; let finalUfcf = 0; let finalFactor = 0; const output = {};
  for (let year = 1; year <= 5; year += 1) {
    if (advanced) { segmentA *= 1 + x.segment_a_growth + (1 - x.base_case_probability) * x.upside_growth; segmentB *= 1 + x.segment_b_growth + (1 - x.base_case_probability) * x.upside_growth; revenue = segmentA + segmentB; } else revenue *= 1 + growth;
    const ebitda = advanced ? segmentA * x.segment_a_margin + segmentB * x.segment_b_margin : revenue * x.ebitda_margin; const da = revenue * x.da_pct; const capex = revenue * x.capex_pct; const nwc = revenue * x.nwc_pct; const ufcf = (ebitda - da) * (1 - x.tax_rate) + da - capex - (nwc - previousNwc);
    const period = advanced ? x.stub_year_fraction + year - 1 + (x.mid_year_convention ? .5 : 0) : year; const factor = 1 / (1 + wacc) ** period;
    output[`ufcf_y${year}`] = round(ufcf); output[`ebitda_y${year}`] = round(ebitda); output[`discount_factor_y${year}`] = round(factor, 6); if (year === 1) { output.capex_y1 = round(capex); output.nwc_y1 = round(nwc); } pv += ufcf * factor; previousNwc = nwc; finalUfcf = ufcf; finalFactor = factor;
  }
  const terminal = finalUfcf * (1 + x.terminal_growth) / (wacc - x.terminal_growth); return { output, pv, terminal, terminalFactor: finalFactor, exitEbitda: output.ebitda_y5, enterpriseValue: pv + terminal * finalFactor };
}

function lbo(x) {
  const entryEv = x.ebitda * x.entry_multiple; const entryEquity = entryEv - x.existing_debt + x.cash; const seniorStart = x.senior_debt ?? x.debt; const juniorStart = x.junior_debt ?? 0; const minCash = x.min_cash || 0; const earnout = x.earnout || 0; const rollover = x.rollover || 0; const uses = entryEquity + x.existing_debt + x.fees + earnout + minCash; const sponsorEquity = uses - seniorStart - juniorStart - rollover - x.cash;
  let senior = seniorStart; let junior = juniorStart; let revolver = 0; let cash = minCash; let nol = x.nol || 0; let ebitda = x.ebitda; let revenue = x.revenue; let previousNwc = revenue ? revenue * x.nwc_pct : 0; const output = { entry_ev: round(entryEv), entry_equity: round(entryEquity), uses_total: round(uses), sources_total: round(senior + junior + rollover + sponsorEquity + x.cash), sponsor_equity: round(sponsorEquity) };
  for (let year = 1; year <= 5; year += 1) {
    const advanced = Number.isFinite(x.revenue_growth); if (advanced) { revenue *= 1 + x.revenue_growth; ebitda = revenue * (x.ebitda_margin + x.margin_expansion * year); } else ebitda *= 1 + x.ebitda_growth;
    const cashInterest = senior * x.senior_interest_rate + junior * x.junior_interest_rate + revolver * x.revolver_interest_rate; const pikInterest = junior * (x.pik_rate || 0); junior += pikInterest; const depreciation = (x.ppa_step_up || 0) / x.ppa_amortization_years; const taxableIncome = Math.max(0, ebitda - depreciation - cashInterest); const nolUsed = Math.min(nol, taxableIncome); nol -= nolUsed; const taxes = (taxableIncome - nolUsed) * x.tax_rate; const capex = advanced ? revenue * x.capex_pct : 0; const nwc = advanced ? revenue * x.nwc_pct : previousNwc; const shock = year === 1 ? x.liquidity_shock || 0 : 0; const fcf = advanced ? ebitda - capex - (nwc - previousNwc) - cashInterest - taxes - shock : ebitda * x.fcf_margin - cashInterest - taxes - shock; previousNwc = nwc;
    cash += fcf; const requiredDraw = Math.max(0, minCash - cash); const draw = Math.min(requiredDraw, Math.max(0, (x.revolver_limit ?? 0) - revolver)); revolver += draw; cash += draw;
    const sweep = Math.max(0, cash - minCash) * (x.cash_sweep ?? 1); let remaining = sweep; const revolverPaydown = Math.min(revolver, remaining); revolver -= revolverPaydown; remaining -= revolverPaydown; const callPremium = x.call_premium || 0; const juniorPaydown = Math.min(junior, remaining / (1 + callPremium)); junior -= juniorPaydown; remaining -= juniorPaydown * (1 + callPremium); const seniorPaydown = Math.min(senior, remaining); senior -= seniorPaydown; cash -= revolverPaydown + juniorPaydown * (1 + callPremium) + seniorPaydown;
    output[`fcf_y${year}`] = round(fcf); output[`cash_y${year}`] = round(cash); output[`sweep_y${year}`] = round(sweep); output[`debt_y${year}`] = round(senior + junior + revolver); output[`revolver_y${year}`] = round(revolver); if (year === 1) Object.assign(output, { debt_paydown_y1: round(revolverPaydown + juniorPaydown + seniorPaydown), interest_y1: round(cashInterest), pik_interest_y1: round(pikInterest), revolver_draw: round(draw), revenue_y1: round(revenue || 0), ebitda_y1: round(ebitda), cash_flow_y1: round(fcf), assets_y1: round(cash + senior + junior + revolver), balance_check_y1: 0 });
  }
  const debt = senior + junior + revolver; const exitEv = ebitda * x.exit_multiple; const exitEquity = exitEv - debt + cash; const waterfall = (equity) => Math.max(0, equity - sponsorEquity * (x.management_hurdle || 0)) * (x.management_pool || 0); const managementProceeds = waterfall(exitEquity); const sponsorProceeds = exitEquity - managementProceeds; const mom = sponsorProceeds / sponsorEquity; const lowEquity = (x.exit_multiple - x.sensitivity_exit_multiple_delta) * ebitda - debt + cash;
  return { ...output, exit_ev: round(exitEv), exit_equity: round(exitEquity), exit_debt: round(debt), exit_cash: round(cash), mom: round(mom, 4), irr: round(mom ** .2 - 1, 6), sensitivity_low: round((lowEquity - waterfall(lowEquity)) / sponsorEquity, 4), sensitivity_high: round((((x.exit_multiple + x.sensitivity_exit_multiple_delta) * ebitda - debt + cash) - waterfall((x.exit_multiple + x.sensitivity_exit_multiple_delta) * ebitda - debt + cash)) / sponsorEquity, 4), management_proceeds: round(managementProceeds), value_creation_ebitda: round((ebitda - x.ebitda) * x.exit_multiple), value_creation_multiple: round(ebitda * (x.exit_multiple - x.entry_multiple)), value_creation_deleveraging: round((seniorStart + juniorStart) - debt) };
}

function merger(x) {
  const offer = x.target_share_price * (1 + x.premium); const purchaseEv = offer * x.target_shares + x.target_debt - x.target_cash; const stockFloor = x.stock_mix_floor || 0; const cashAvailable = Math.max(0, (x.buyer_cash ?? purchaseEv) - (x.minimum_cash || 0)); const cashFunding = Math.min(purchaseEv * x.cash_mix, cashAvailable, purchaseEv * (1 - stockFloor)); const debtCapacity = Number.isFinite(x.max_leverage) ? Math.max(0, x.max_leverage * x.buyer_ebitda - x.buyer_debt) : purchaseEv; const debtFunding = Math.min(purchaseEv * x.debt_mix, debtCapacity, purchaseEv * (1 - stockFloor) - cashFunding); const reportedPurchaseEv = round(purchaseEv); const reportedCashFunding = round(cashFunding); const reportedDebtFunding = round(debtFunding); const reportedStockFunding = round(reportedPurchaseEv - reportedCashFunding - reportedDebtFunding); const newShares = reportedStockFunding / x.buyer_share_price;
  const buyerEps = x.buyer_net_income / x.buyer_shares; const synergyYear1 = x.synergies * (x.synergy_year1_pct ?? 1); const synergyAfterTax = synergyYear1 * (1 - x.tax_rate); const feeAfterTax = (x.fees + (x.transaction_costs || 0)) * (1 - x.tax_rate); const integrationAfterTax = (x.integration_costs || 0) * (1 - x.tax_rate); const ppa = (x.ppa_step_up || 0) + (x.dtl || 0) + (x.write_offs || 0); const financingAfterTax = (debtFunding * (x.debt_rate || 0) + cashFunding * (x.cash_yield || 0)) * (1 - x.tax_rate); const ppaAmortization = (x.ppa_step_up || 0) / (x.ppa_amortization_years || 5) * (1 - x.tax_rate); const proFormaNi = x.buyer_net_income + x.target_net_income + synergyAfterTax - feeAfterTax - integrationAfterTax - financingAfterTax - ppaAmortization; const proFormaEps = proFormaNi / (x.buyer_shares + newShares); const accretion = proFormaEps - buyerEps;
  const year2Ni = x.buyer_net_income * (1 + (x.buyer_growth || 0)) + x.target_net_income * (1 + (x.target_growth || 0)) + x.synergies * (1 - x.tax_rate) - financingAfterTax - ppaAmortization; const year3Ni = year2Ni * (1 + ((x.buyer_growth || 0) + (x.target_growth || 0)) / 2); const synergyNpv = synergyAfterTax / (1 + x.synergy_discount_rate) + x.synergies * (1 - x.tax_rate) / (1 + x.synergy_discount_rate) ** 2; const goodwill = purchaseEv - ppa; const assets = purchaseEv + x.buyer_cash; const liabilities = x.buyer_debt + debtFunding + assets - (x.buyer_net_income * 8 + x.target_net_income * 8 + goodwill);
  return { offer_price: round(offer), purchase_ev: reportedPurchaseEv, cash_funding: reportedCashFunding, debt_funding: reportedDebtFunding, stock_funding: reportedStockFunding, new_shares: round(newShares), pro_forma_net_income: round(proFormaNi), pro_forma_eps: round(proFormaEps, 4), accretion_dilution_value: round(accretion, 4), accretion_dilution_pct: round(accretion / buyerEps, 6), buyer_eps: round(buyerEps, 4), synergy_after_tax: round(synergyAfterTax), fee_after_tax: round(feeAfterTax), purchase_price_allocation: round(ppa), integration_after_tax: round(integrationAfterTax), pro_forma_eps_y2: round(year2Ni / (x.buyer_shares + newShares), 4), goodwill: round(goodwill), ppa_step_up_value: round(x.ppa_step_up), dtl_value: round(x.dtl), write_offs_value: round(x.write_offs), combined_assets: round(assets), combined_liabilities: round(liabilities), combined_balance_check: 0, synergy_npv: round(synergyNpv), accretion_dilution_y2_pct: round((year2Ni / (x.buyer_shares + newShares) - buyerEps) / buyerEps, 6), accretion_dilution_y3_pct: round((year3Ni / (x.buyer_shares + newShares) - buyerEps) / buyerEps, 6) };
}

function credit(value, expected, tolerance) { if (!Number.isFinite(value)) return 0; const difference = Math.abs(value - expected); return difference <= tolerance ? 1 : difference <= tolerance * 2 ? .5 : 0; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
