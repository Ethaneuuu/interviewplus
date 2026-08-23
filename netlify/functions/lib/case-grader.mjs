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
  const down = dcfProjection({ ...x, terminal_growth: x.terminal_growth - x.sensitivity_growth_delta }, wacc + x.sensitivity_wacc_delta).enterpriseValue; const up = dcfProjection({ ...x, terminal_growth: x.terminal_growth + x.sensitivity_growth_delta }, wacc - x.sensitivity_wacc_delta).enterpriseValue;
  const highWacc = dcfProjection(x, wacc + x.sensitivity_wacc_delta); const lowWacc = dcfProjection(x, wacc - x.sensitivity_wacc_delta);
  const result = { ...projection.output, pv_ufcf: round(projection.pv), terminal_value: round(projection.terminal), enterprise_value: round(projection.enterpriseValue), equity_value: round(equity), share_price: round(equity / x.shares), grid_wacc_high_growth_low: round(down), grid_wacc_low_growth_high: round(up), sensitivity_low: round((down - x.debt + x.cash) / x.shares), sensitivity_high: round((up - x.debt + x.cash) / x.shares) };
  if (Number.isFinite(x.terminal_multiple)) {
    const multipleValue = projection.exitEbitda * x.terminal_multiple;
    Object.assign(result, { terminal_value_multiple: round(multipleValue), comparable_value: round(projection.pv + multipleValue * projection.terminalFactor), grid_wacc_high_multiple_low: round(highWacc.pv + highWacc.exitEbitda * (x.terminal_multiple - x.sensitivity_multiple_delta) * highWacc.terminalFactor), grid_wacc_low_multiple_high: round(lowWacc.pv + lowWacc.exitEbitda * (x.terminal_multiple + x.sensitivity_multiple_delta) * lowWacc.terminalFactor) });
  }
  if (Number.isFinite(x.segment_a_revenue)) Object.assign(result, { scenario_downside_ev: round(dcfProjection({ ...x, terminal_growth: x.terminal_growth - x.sensitivity_growth_delta }, wacc + x.sensitivity_wacc_delta, -x.downside_growth_delta).enterpriseValue), scenario_base_ev: round(projection.enterpriseValue), scenario_upside_ev: round(dcfProjection({ ...x, terminal_growth: x.terminal_growth + x.sensitivity_growth_delta }, wacc - x.sensitivity_wacc_delta, x.upside_growth_delta).enterpriseValue) });
  return result;
}

function dcfWacc(x) {
  if (Number.isFinite(x.wacc)) return x.wacc;
  const debtWeight = x.target_debt_pct; const peerBeta = Number.isFinite(x.comparable_beta) ? x.comparable_beta : x.beta;
  const peerDebtWeight = x.comparable_debt_pct ?? debtWeight;
  const unleveredBeta = peerBeta / (1 + (1 - x.tax_rate) * peerDebtWeight / (1 - peerDebtWeight));
  const releveredBeta = unleveredBeta * (1 + (1 - x.tax_rate) * debtWeight / (1 - debtWeight));
  return (x.risk_free_rate + releveredBeta * x.equity_risk_premium) * (1 - debtWeight) + x.cost_of_debt * (1 - x.tax_rate) * debtWeight;
}

function dcfProjection(x, wacc, growthShift = 0) {
  const advanced = Number.isFinite(x.segment_a_revenue); const growth = x.growth + growthShift;
  let revenue = x.revenue; let segmentA = x.segment_a_revenue; let segmentB = x.segment_b_revenue; let previousNwc = revenue * x.nwc_pct; let pv = 0; let finalUfcf = 0; let finalFactor = 0; const output = {};
  for (let year = 1; year <= 5; year += 1) {
    if (advanced) { segmentA *= 1 + x.segment_a_growth + growthShift; segmentB *= 1 + x.segment_b_growth + growthShift; revenue = segmentA + segmentB; } else revenue *= 1 + growth;
    const ebitda = advanced ? segmentA * x.segment_a_margin + segmentB * x.segment_b_margin : revenue * x.ebitda_margin; const da = revenue * x.da_pct; const capex = revenue * x.capex_pct; const nwc = revenue * x.nwc_pct; const ufcf = (ebitda - da) * (1 - x.tax_rate) + da - capex - (nwc - previousNwc);
    const period = Number.isFinite(x.stub_year_fraction) ? x.stub_year_fraction + year - (x.mid_year_convention ? .5 : 0) : year; const factor = 1 / (1 + wacc) ** period;
    output[`ufcf_y${year}`] = round(ufcf); output[`ebitda_y${year}`] = round(ebitda); output[`discount_factor_y${year}`] = round(factor, 6); if (year === 1) { output.capex_y1 = round(capex); output.nwc_y1 = round(nwc); } pv += ufcf * factor; previousNwc = nwc; finalUfcf = ufcf; finalFactor = factor;
  }
  const terminal = finalUfcf * (1 + x.terminal_growth) / (wacc - x.terminal_growth); return { output, pv, terminal, terminalFactor: finalFactor, exitEbitda: output.ebitda_y5, enterpriseValue: pv + terminal * finalFactor };
}

function lbo(x, scenario = false) {
  const advanced = Number.isFinite(x.revenue_growth); const entryEv = x.ebitda * x.entry_multiple; const entryEquity = entryEv - x.existing_debt + x.cash; const seniorStart = x.senior_debt ?? x.debt; const juniorStart = x.junior_debt ?? 0; const minCash = x.min_cash ?? 0; const rollover = x.rollover ?? 0; const uses = entryEquity + x.existing_debt + x.fees + (x.earnout ?? 0) + minCash; const sponsorEquity = uses - seniorStart - juniorStart - rollover - x.cash;
  let senior = seniorStart; let junior = juniorStart; let revolver = 0; let cash = minCash; let nol = x.nol ?? 0; let ebitda = x.ebitda; let revenue = x.revenue; let previousNwc = advanced ? revenue * x.nwc_pct : 0; let netPpe = x.net_ppe ?? 0; let otherAssets = advanced ? x.other_assets + x.ppa_step_up : 0; const otherLiabilities = x.other_liabilities ?? 0; let equity = advanced ? cash + previousNwc + netPpe + otherAssets - senior - junior - otherLiabilities : 0; const output = { entry_ev: round(entryEv), entry_equity: round(entryEquity), uses_total: round(uses), sources_total: round(senior + junior + rollover + sponsorEquity + x.cash), sponsor_equity: round(sponsorEquity) };
  for (let year = 1; year <= 5; year += 1) {
    if (advanced) { revenue *= 1 + x.revenue_growth; ebitda = revenue * (x.ebitda_margin + x.margin_expansion * year); } else ebitda *= 1 + x.ebitda_growth;
    const cashInterest = senior * x.senior_interest_rate + junior * (x.junior_interest_rate ?? 0) + revolver * (x.revolver_interest_rate ?? 0); const pikInterest = junior * (x.pik_rate ?? 0); junior += pikInterest; const depreciation = advanced ? revenue * x.da_pct : 0; const ppaAmortization = advanced ? x.ppa_step_up / x.ppa_amortization_years : 0; const taxableIncome = Math.max(0, ebitda - depreciation - ppaAmortization - cashInterest - pikInterest); const nolUsed = Math.min(nol, taxableIncome); nol -= nolUsed; const taxes = (taxableIncome - nolUsed) * x.tax_rate; const capex = advanced ? revenue * x.capex_pct : 0; const nwc = advanced ? revenue * x.nwc_pct : previousNwc; const shock = year === 1 ? x.liquidity_shock ?? 0 : 0; const netIncome = ebitda - depreciation - ppaAmortization - cashInterest - pikInterest - taxes - shock; const fcf = advanced ? netIncome + depreciation + ppaAmortization + pikInterest - capex - (nwc - previousNwc) : ebitda * x.fcf_margin - cashInterest - taxes - shock;
    cash += fcf; const requiredDraw = Math.max(0, minCash - cash); const draw = Math.min(requiredDraw, Math.max(0, (x.revolver_limit ?? 0) - revolver)); revolver += draw; cash += draw;
    const sweep = Math.max(0, cash - minCash) * (x.cash_sweep ?? 1); let remaining = sweep; const revolverPaydown = Math.min(revolver, remaining); revolver -= revolverPaydown; remaining -= revolverPaydown; const juniorPaydown = Math.min(junior, remaining / (1 + (x.call_premium ?? 0))); junior -= juniorPaydown; remaining -= juniorPaydown * (1 + (x.call_premium ?? 0)); const seniorPaydown = Math.min(senior, remaining); senior -= seniorPaydown; const callPremium = juniorPaydown * (x.call_premium ?? 0); cash -= revolverPaydown + juniorPaydown + seniorPaydown + callPremium; previousNwc = nwc;
    const debt = senior + junior + revolver; output[`fcf_y${year}`] = round(fcf); output[`cash_y${year}`] = round(cash); output[`sweep_y${year}`] = round(sweep); output[`debt_y${year}`] = round(debt); output[`revolver_y${year}`] = round(revolver); output[`revenue_y${year}`] = round(revenue ?? 0); output[`ebitda_y${year}`] = round(ebitda); output[`net_income_y${year}`] = round(netIncome);
    if (advanced) { netPpe += capex - depreciation; otherAssets -= ppaAmortization; equity += netIncome - callPremium; const assets = cash + nwc + netPpe + otherAssets; const liabilities = debt + otherLiabilities; Object.assign(output, { [`nwc_y${year}`]: round(nwc), [`net_ppe_y${year}`]: round(netPpe), [`other_assets_y${year}`]: round(otherAssets), [`assets_y${year}`]: round(assets), [`liabilities_y${year}`]: round(liabilities), [`equity_y${year}`]: round(equity), [`balance_check_y${year}`]: round(assets - liabilities - equity) }); }
    if (year === 1) Object.assign(output, { debt_paydown_y1: round(revolverPaydown + juniorPaydown + seniorPaydown), interest_y1: round(cashInterest), pik_interest_y1: round(pikInterest), revolver_draw: round(draw), cash_flow_y1: round(fcf) });
  }
  const debt = senior + junior + revolver; const exitEv = ebitda * x.exit_multiple; const exitEquity = exitEv - debt + cash; const waterfall = (value) => { const management = Math.max(0, value - sponsorEquity * (x.management_hurdle ?? 0)) * (x.management_pool ?? 0); const residual = Math.max(0, value - management); const rolloverProceeds = sponsorEquity + rollover > 0 ? residual * rollover / (sponsorEquity + rollover) : 0; return { management, rollover: rolloverProceeds, sponsor: residual - rolloverProceeds }; }; const exitWaterfall = waterfall(exitEquity); const mom = exitWaterfall.sponsor / sponsorEquity; const sensitivity = (multiple) => waterfall(multiple * ebitda - debt + cash).sponsor / sponsorEquity; const sensitivityLow = advanced && !scenario ? lbo({ ...x, revenue_growth: x.revenue_growth - x.scenario_revenue_growth_delta, ebitda_margin: x.ebitda_margin - x.scenario_margin_delta, exit_multiple: x.exit_multiple - x.sensitivity_exit_multiple_delta }, true).mom : sensitivity(x.exit_multiple - x.sensitivity_exit_multiple_delta); const sensitivityHigh = advanced && !scenario ? lbo({ ...x, revenue_growth: x.revenue_growth + x.scenario_revenue_growth_delta, ebitda_margin: x.ebitda_margin + x.scenario_margin_delta, exit_multiple: x.exit_multiple + x.sensitivity_exit_multiple_delta }, true).mom : sensitivity(x.exit_multiple + x.sensitivity_exit_multiple_delta);
  const ebitdaCreation = (ebitda - x.ebitda) * x.entry_multiple; const multipleCreation = ebitda * (x.exit_multiple - x.entry_multiple); const deleveraging = seniorStart + juniorStart - debt; const cashCreation = cash - minCash; const waterfallDeduction = exitWaterfall.management + exitWaterfall.rollover; const entryAdjustment = entryEv - seniorStart - juniorStart + minCash - sponsorEquity;
  return { ...output, exit_ev: round(exitEv), exit_equity: round(exitEquity), exit_debt: round(debt), exit_cash: round(cash), sponsor_proceeds: round(exitWaterfall.sponsor), mom: round(mom, 4), irr: round(mom ** .2 - 1, 6), sensitivity_low: round(sensitivityLow, 4), sensitivity_high: round(sensitivityHigh, 4), management_proceeds: round(exitWaterfall.management), rollover_proceeds: round(exitWaterfall.rollover), value_creation_ebitda: round(ebitdaCreation), value_creation_multiple: round(multipleCreation), ev_bridge_check: round(entryEv + ebitdaCreation + multipleCreation - exitEv), value_creation_deleveraging: round(deleveraging), value_creation_cash: round(cashCreation), value_creation_waterfall: round(waterfallDeduction), sponsor_bridge_entry_adjustment: round(entryAdjustment), sponsor_bridge_check: round(sponsorEquity + entryAdjustment + ebitdaCreation + multipleCreation + deleveraging + cashCreation - waterfallDeduction - exitWaterfall.sponsor) };
}

function merger(x) {
  const advanced = Number.isFinite(x.target_equity); const offer = x.target_share_price * (1 + x.premium); const equityPurchasePrice = offer * x.target_shares; const purchaseEv = equityPurchasePrice + x.target_debt - x.target_cash; const stockFloor = x.stock_mix_floor ?? 0; const cashAvailable = Math.max(0, (x.buyer_cash ?? purchaseEv) - (x.minimum_cash ?? 0)); const cashFunding = Math.min(purchaseEv * x.cash_mix, cashAvailable, purchaseEv * (1 - stockFloor)); const debtCapacity = Number.isFinite(x.max_leverage) ? Math.max(0, x.max_leverage * x.buyer_ebitda - x.buyer_debt) : purchaseEv; const debtFunding = Math.min(purchaseEv * x.debt_mix, debtCapacity, purchaseEv * (1 - stockFloor) - cashFunding); const stockFunding = purchaseEv - cashFunding - debtFunding; const newShares = stockFunding / x.buyer_share_price;
  const feeAfterTax = (x.fees + (x.transaction_costs ?? 0)) * (1 - x.tax_rate); const financingAfterTax = (debtFunding * (x.debt_rate ?? 0) + cashFunding * (x.cash_yield ?? 0)) * (1 - x.tax_rate); const ppaAmortization = (x.ppa_step_up ?? 0) / (x.ppa_amortization_years ?? 1) * (1 - x.tax_rate); const integrationAfterTax = (x.integration_costs ?? 0) * (1 - x.tax_rate); const ramp = (year) => Number.isFinite(x.synergy_ramp_years) && x.synergy_ramp_years > 1 ? Math.min(1, x.synergy_year1_pct + (1 - x.synergy_year1_pct) * (year - 1) / (x.synergy_ramp_years - 1)) : 1;
  const years = Array.from({ length: 3 }, (_, index) => { const year = index + 1; const buyerNetIncome = x.buyer_net_income * (1 + (x.buyer_growth ?? 0)) ** index; const targetNetIncome = x.target_net_income * (1 + (x.target_growth ?? 0)) ** index; const synergyAfterTax = x.synergies * ramp(year) * (1 - x.tax_rate); const proFormaNetIncome = buyerNetIncome + targetNetIncome + synergyAfterTax - financingAfterTax - ppaAmortization - (year === 1 ? feeAfterTax : 0) - (year === (x.integration_cost_year ?? 1) ? integrationAfterTax : 0); const buyerEps = buyerNetIncome / x.buyer_shares; const proFormaEps = proFormaNetIncome / (x.buyer_shares + newShares); return { buyerEps, proFormaEps, proFormaNetIncome, synergyAfterTax, accretion: proFormaEps - buyerEps }; });
  const first = years[0]; const dtl = advanced ? x.ppa_step_up * x.tax_rate : 0; const ppa = (x.ppa_step_up ?? 0) - dtl - (x.write_offs ?? 0); const result = { offer_price: round(offer), purchase_ev: round(purchaseEv), cash_funding: round(cashFunding), debt_funding: round(debtFunding), stock_funding: round(stockFunding), new_shares: round(newShares), pro_forma_net_income: round(first.proFormaNetIncome), pro_forma_eps: round(first.proFormaEps, 4), accretion_dilution_value: round(first.accretion, 4), accretion_dilution_pct: round(first.accretion / first.buyerEps, 6), buyer_eps: round(first.buyerEps, 4), synergy_after_tax: round(first.synergyAfterTax), fee_after_tax: round(feeAfterTax), purchase_price_allocation: round(ppa), integration_after_tax: round(integrationAfterTax) };
  if (advanced) { const goodwill = equityPurchasePrice - x.target_equity - ppa; const assets = x.buyer_assets - cashFunding - feeAfterTax + x.target_assets - x.target_cash + x.ppa_step_up - x.write_offs + goodwill; const liabilities = x.buyer_liabilities + debtFunding + x.target_liabilities - x.target_debt + dtl; const equity = x.buyer_equity + stockFunding - feeAfterTax; let synergyNpv = 0; for (let year = 1; year <= x.synergy_horizon_years; year += 1) synergyNpv += x.synergies * ramp(year) * (1 - x.tax_rate) / (1 + x.synergy_discount_rate) ** year; synergyNpv -= integrationAfterTax / (1 + x.synergy_discount_rate) ** x.integration_cost_year; Object.assign(result, { buyer_eps_y2: round(years[1].buyerEps, 4), buyer_eps_y3: round(years[2].buyerEps, 4), pro_forma_eps_y2: round(years[1].proFormaEps, 4), pro_forma_eps_y3: round(years[2].proFormaEps, 4), goodwill: round(goodwill), ppa_step_up_value: round(x.ppa_step_up), dtl_value: round(dtl), write_offs_value: round(x.write_offs), combined_assets: round(assets), combined_liabilities: round(liabilities), combined_equity: round(equity), combined_balance_check: round(assets - liabilities - equity), synergy_npv: round(synergyNpv), accretion_dilution_y2_pct: round(years[1].accretion / years[1].buyerEps, 6), accretion_dilution_y3_pct: round(years[2].accretion / years[2].buyerEps, 6) }); }
  return result;
}

function credit(value, expected, tolerance) { if (!Number.isFinite(value)) return 0; const difference = Math.abs(value - expected); return difference <= tolerance ? 1 : difference <= tolerance * 2 ? .5 : 0; }
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((value + Number.EPSILON) * factor) / factor; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
