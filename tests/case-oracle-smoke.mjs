import { equal, ok } from "node:assert/strict";
import { CASE_DIFFICULTIES, CASE_THEMES, generateCaseStatement } from "../assets/js/case-templates.js";
import { createCorrectionService } from "../netlify/functions/lib/correction-service.mjs";

const round = (value, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const inputs = (statement) => Object.fromEntries(statement.sections.flatMap(({ fields }) => fields).map(({ id, value }) => [id, value]));
const answerIds = (statement) => new Set(statement.answerFields.map(({ id }) => id));
const answersFor = (statement, solution) => Object.fromEntries(Object.entries(solution).filter(([id]) => answerIds(statement).has(id)));
const close = (actual, expected, tolerance, message) => ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} !== ${expected}`);

function dcfWacc(x) {
  if (Number.isFinite(x.wacc)) return x.wacc;
  let beta = x.beta;
  if (Number.isFinite(x.comparable_beta)) {
    beta = x.comparable_beta / (1 + (1 - x.tax_rate) * x.comparable_debt_pct / (1 - x.comparable_debt_pct));
    beta *= 1 + (1 - x.tax_rate) * x.target_debt_pct / (1 - x.target_debt_pct);
  }
  const costOfEquity = x.risk_free_rate + beta * x.equity_risk_premium;
  return costOfEquity * (1 - x.target_debt_pct) + x.cost_of_debt * (1 - x.tax_rate) * x.target_debt_pct;
}

function dcfSchedule(x, wacc, { growthShift = 0, terminalGrowth = x.terminal_growth } = {}) {
  let revenue = x.revenue;
  let segmentA = x.segment_a_revenue;
  let segmentB = x.segment_b_revenue;
  let priorNwc = revenue * x.nwc_pct;
  const years = [];

  for (let year = 1; year <= 5; year += 1) {
    if (Number.isFinite(segmentA)) {
      segmentA *= 1 + x.segment_a_growth + growthShift;
      segmentB *= 1 + x.segment_b_growth + growthShift;
      revenue = segmentA + segmentB;
    } else {
      revenue *= 1 + x.growth + growthShift;
    }
    const ebitda = Number.isFinite(segmentA) ? segmentA * x.segment_a_margin + segmentB * x.segment_b_margin : revenue * x.ebitda_margin;
    const da = revenue * x.da_pct;
    const capex = revenue * x.capex_pct;
    const nwc = revenue * x.nwc_pct;
    const ufcf = (ebitda - da) * (1 - x.tax_rate) + da - capex - (nwc - priorNwc);
    const period = Number.isFinite(x.stub_year_fraction) ? x.stub_year_fraction + year - (x.mid_year_convention ? .5 : 0) : year;
    const discountFactor = 1 / (1 + wacc) ** period;
    years.push({ year, revenue, ebitda, capex, nwc, ufcf, discountFactor });
    priorNwc = nwc;
  }

  const pvUfcf = years.reduce((sum, row) => sum + row.ufcf * row.discountFactor, 0);
  const last = years.at(-1);
  const terminalValue = last.ufcf * (1 + terminalGrowth) / (wacc - terminalGrowth);
  const enterpriseValue = pvUfcf + terminalValue * last.discountFactor;
  return { years, pvUfcf, terminalValue, enterpriseValue };
}

function oracleDcf(statement) {
  const x = inputs(statement);
  const wacc = dcfWacc(x);
  const base = dcfSchedule(x, wacc);
  const highWacc = dcfSchedule(x, wacc + x.sensitivity_wacc_delta);
  const lowWacc = dcfSchedule(x, wacc - x.sensitivity_wacc_delta);
  const lowGrowth = dcfSchedule(x, wacc + x.sensitivity_wacc_delta, { terminalGrowth: x.terminal_growth - x.sensitivity_growth_delta });
  const highGrowth = dcfSchedule(x, wacc - x.sensitivity_wacc_delta, { terminalGrowth: x.terminal_growth + x.sensitivity_growth_delta });
  const last = base.years.at(-1);
  const multipleValue = Number.isFinite(x.terminal_multiple) ? last.ebitda * x.terminal_multiple : 0;
  const result = {};

  for (const row of base.years) {
    result[`ufcf_y${row.year}`] = round(row.ufcf);
    result[`ebitda_y${row.year}`] = round(row.ebitda);
    result[`discount_factor_y${row.year}`] = round(row.discountFactor, 6);
  }
  Object.assign(result, {
    capex_y1: round(base.years[0].capex),
    nwc_y1: round(base.years[0].nwc),
    pv_ufcf: round(base.pvUfcf),
    terminal_value: round(base.terminalValue),
    enterprise_value: round(base.enterpriseValue),
    equity_value: round(base.enterpriseValue - x.debt + x.cash),
    share_price: round((base.enterpriseValue - x.debt + x.cash) / x.shares),
    grid_wacc_high_growth_low: round(lowGrowth.enterpriseValue),
    grid_wacc_low_growth_high: round(highGrowth.enterpriseValue),
    sensitivity_low: round((lowGrowth.enterpriseValue - x.debt + x.cash) / x.shares),
    sensitivity_high: round((highGrowth.enterpriseValue - x.debt + x.cash) / x.shares),
  });
  if (Number.isFinite(x.terminal_multiple)) Object.assign(result, {
    terminal_value_multiple: round(multipleValue),
    comparable_value: round(base.pvUfcf + multipleValue * last.discountFactor),
    grid_wacc_high_multiple_low: round(highWacc.pvUfcf + last.ebitda * (x.terminal_multiple - x.sensitivity_multiple_delta) * highWacc.years.at(-1).discountFactor),
    grid_wacc_low_multiple_high: round(lowWacc.pvUfcf + last.ebitda * (x.terminal_multiple + x.sensitivity_multiple_delta) * lowWacc.years.at(-1).discountFactor),
  });
  if (statement.difficulty === "advanced") Object.assign(result, {
    scenario_downside_ev: round(dcfSchedule(x, wacc + x.sensitivity_wacc_delta, { growthShift: -x.downside_growth_delta, terminalGrowth: x.terminal_growth - x.sensitivity_growth_delta }).enterpriseValue),
    scenario_base_ev: round(base.enterpriseValue),
    scenario_upside_ev: round(dcfSchedule(x, wacc - x.sensitivity_wacc_delta, { growthShift: x.upside_growth_delta, terminalGrowth: x.terminal_growth + x.sensitivity_growth_delta }).enterpriseValue),
  });
  return result;
}

function lboWaterfall(equity, sponsorEquity, rollover, managementPool, managementHurdle) {
  const management = Math.max(0, equity - sponsorEquity * managementHurdle) * managementPool;
  const residual = Math.max(0, equity - management);
  const rolloverProceeds = sponsorEquity + rollover > 0 ? residual * rollover / (sponsorEquity + rollover) : 0;
  return { management, rollover: rolloverProceeds, sponsor: residual - rolloverProceeds };
}

function oracleLbo(statement, overrides = {}, scenario = false) {
  const x = { ...inputs(statement), ...overrides };
  const advanced = statement.difficulty === "advanced";
  const seniorStart = x.senior_debt ?? x.debt;
  const juniorStart = x.junior_debt ?? 0;
  const minCash = x.min_cash ?? 0;
  const rollover = x.rollover ?? 0;
  const entryEv = x.ebitda * x.entry_multiple;
  const entryEquity = entryEv - x.existing_debt + x.cash;
  const uses = entryEquity + x.existing_debt + x.fees + (x.earnout ?? 0) + minCash;
  const sponsorEquity = uses - seniorStart - juniorStart - rollover - x.cash;
  let senior = seniorStart;
  let junior = juniorStart;
  let revolver = 0;
  let cash = minCash;
  let nol = x.nol ?? 0;
  let revenue = x.revenue;
  let ebitda = x.ebitda;
  let priorNwc = advanced ? revenue * x.nwc_pct : 0;
  let netPpe = x.net_ppe ?? 0;
  let otherAssets = advanced ? x.other_assets + x.ppa_step_up : 0;
  const otherLiabilities = x.other_liabilities ?? 0;
  let equity = advanced ? cash + priorNwc + netPpe + otherAssets - senior - junior - otherLiabilities : 0;
  const years = [];

  for (let year = 1; year <= 5; year += 1) {
    if (advanced) {
      revenue *= 1 + x.revenue_growth;
      ebitda = revenue * (x.ebitda_margin + x.margin_expansion * year);
    } else {
      ebitda *= 1 + x.ebitda_growth;
    }
    const cashInterest = senior * x.senior_interest_rate + junior * (x.junior_interest_rate ?? 0) + revolver * (x.revolver_interest_rate ?? 0);
    const pikInterest = junior * (x.pik_rate ?? 0);
    junior += pikInterest;
    const depreciation = advanced ? revenue * x.da_pct : 0;
    const ppaAmortization = advanced ? x.ppa_step_up / x.ppa_amortization_years : 0;
    const taxableIncome = Math.max(0, ebitda - depreciation - ppaAmortization - cashInterest - pikInterest);
    const nolUsed = Math.min(nol, taxableIncome);
    nol -= nolUsed;
    const taxes = (taxableIncome - nolUsed) * x.tax_rate;
    const capex = advanced ? revenue * x.capex_pct : 0;
    const nwc = advanced ? revenue * x.nwc_pct : priorNwc;
    const shock = year === 1 ? x.liquidity_shock ?? 0 : 0;
    const netIncome = ebitda - depreciation - ppaAmortization - cashInterest - pikInterest - taxes - shock;
    const fcf = advanced ? netIncome + depreciation + ppaAmortization + pikInterest - capex - (nwc - priorNwc) : ebitda * x.fcf_margin - cashInterest - taxes - shock;
    cash += fcf;
    const draw = Math.min(Math.max(0, minCash - cash), Math.max(0, (x.revolver_limit ?? 0) - revolver));
    revolver += draw;
    cash += draw;
    const sweep = Math.max(0, cash - minCash) * (x.cash_sweep ?? 1);
    let remaining = sweep;
    const revolverPaydown = Math.min(revolver, remaining);
    revolver -= revolverPaydown;
    remaining -= revolverPaydown;
    const juniorPaydown = Math.min(junior, remaining / (1 + (x.call_premium ?? 0)));
    junior -= juniorPaydown;
    remaining -= juniorPaydown * (1 + (x.call_premium ?? 0));
    const seniorPaydown = Math.min(senior, remaining);
    senior -= seniorPaydown;
    const callPremium = juniorPaydown * (x.call_premium ?? 0);
    cash -= revolverPaydown + juniorPaydown + seniorPaydown + callPremium;
    priorNwc = nwc;

    let balance = {};
    if (advanced) {
      netPpe += capex - depreciation;
      otherAssets -= ppaAmortization;
      equity += netIncome - callPremium;
      const debt = senior + junior + revolver;
      const assets = cash + nwc + netPpe + otherAssets;
      const liabilities = debt + otherLiabilities;
      balance = { assets, liabilities, equity, nwc, netPpe, otherAssets, balanceCheck: assets - liabilities - equity };
    }
    years.push({ year, revenue, ebitda, netIncome, fcf, cash, sweep, draw, cashInterest, pikInterest, debt: senior + junior + revolver, paydown: revolverPaydown + juniorPaydown + seniorPaydown, ...balance });
  }

  const last = years.at(-1);
  const exitEv = last.ebitda * x.exit_multiple;
  const exitEquity = exitEv - last.debt + last.cash;
  const waterfall = lboWaterfall(exitEquity, sponsorEquity, rollover, x.management_pool ?? 0, x.management_hurdle ?? 0);
  const sensitivity = (multiple) => lboWaterfall(multiple * last.ebitda - last.debt + last.cash, sponsorEquity, rollover, x.management_pool ?? 0, x.management_hurdle ?? 0).sponsor / sponsorEquity;
  const sensitivityLow = advanced && !scenario ? oracleLbo(statement, { revenue_growth: x.revenue_growth - x.scenario_revenue_growth_delta, ebitda_margin: x.ebitda_margin - x.scenario_margin_delta, exit_multiple: x.exit_multiple - x.sensitivity_exit_multiple_delta }, true).mom : sensitivity(x.exit_multiple - x.sensitivity_exit_multiple_delta);
  const sensitivityHigh = advanced && !scenario ? oracleLbo(statement, { revenue_growth: x.revenue_growth + x.scenario_revenue_growth_delta, ebitda_margin: x.ebitda_margin + x.scenario_margin_delta, exit_multiple: x.exit_multiple + x.sensitivity_exit_multiple_delta }, true).mom : sensitivity(x.exit_multiple + x.sensitivity_exit_multiple_delta);
  const ebitdaCreation = (last.ebitda - x.ebitda) * x.entry_multiple;
  const multipleCreation = last.ebitda * (x.exit_multiple - x.entry_multiple);
  const deleveraging = seniorStart + juniorStart - last.debt;
  const cashCreation = last.cash - minCash;
  const waterfallDeduction = waterfall.management + waterfall.rollover;
  const entryAdjustment = entryEv - seniorStart - juniorStart + minCash - sponsorEquity;
  const result = {
    entry_ev: round(entryEv), entry_equity: round(entryEquity), uses_total: round(uses),
    sources_total: round(seniorStart + juniorStart + rollover + sponsorEquity + x.cash), sponsor_equity: round(sponsorEquity),
    exit_ev: round(exitEv), exit_equity: round(exitEquity), exit_debt: round(last.debt), exit_cash: round(last.cash),
    management_proceeds: round(waterfall.management), rollover_proceeds: round(waterfall.rollover), sponsor_proceeds: round(waterfall.sponsor),
    mom: round(waterfall.sponsor / sponsorEquity, 4), irr: round((waterfall.sponsor / sponsorEquity) ** .2 - 1, 6),
    sensitivity_low: round(sensitivityLow, 4), sensitivity_high: round(sensitivityHigh, 4),
    value_creation_ebitda: round(ebitdaCreation), value_creation_multiple: round(multipleCreation),
    ev_bridge_check: round(entryEv + ebitdaCreation + multipleCreation - exitEv),
    value_creation_deleveraging: round(deleveraging), value_creation_cash: round(cashCreation), value_creation_waterfall: round(waterfallDeduction),
    sponsor_bridge_entry_adjustment: round(entryAdjustment),
    sponsor_bridge_check: round(sponsorEquity + entryAdjustment + ebitdaCreation + multipleCreation + deleveraging + cashCreation - waterfallDeduction - waterfall.sponsor),
  };
  for (const row of years) {
    Object.assign(result, {
      [`fcf_y${row.year}`]: round(row.fcf), [`cash_y${row.year}`]: round(row.cash), [`sweep_y${row.year}`]: round(row.sweep),
      [`debt_y${row.year}`]: round(row.debt), [`revolver_y${row.year}`]: row.year === 1 ? round(row.draw) : undefined,
      [`revenue_y${row.year}`]: round(row.revenue ?? 0), [`ebitda_y${row.year}`]: round(row.ebitda), [`net_income_y${row.year}`]: round(row.netIncome),
    });
    if (advanced) Object.assign(result, {
      [`nwc_y${row.year}`]: round(row.nwc), [`net_ppe_y${row.year}`]: round(row.netPpe), [`other_assets_y${row.year}`]: round(row.otherAssets),
      [`assets_y${row.year}`]: round(row.assets), [`liabilities_y${row.year}`]: round(row.liabilities), [`equity_y${row.year}`]: round(row.equity),
      [`balance_check_y${row.year}`]: round(row.balanceCheck),
    });
  }
  Object.assign(result, {
    debt_paydown_y1: round(years[0].paydown), interest_y1: round(years[0].cashInterest), pik_interest_y1: round(years[0].pikInterest),
    revolver_draw: round(years[0].draw), cash_flow_y1: round(years[0].fcf),
  });
  return result;
}

function mergerFunding(x) {
  const offerPrice = x.target_share_price * (1 + x.premium);
  const equityPurchasePrice = offerPrice * x.target_shares;
  const purchaseEv = equityPurchasePrice + x.target_debt - x.target_cash;
  const cashFunding = Math.min(purchaseEv * x.cash_mix, Math.max(0, (x.buyer_cash ?? purchaseEv) - (x.minimum_cash ?? 0)), purchaseEv * (1 - (x.stock_mix_floor ?? 0)));
  const debtCapacity = Number.isFinite(x.max_leverage) ? Math.max(0, x.max_leverage * x.buyer_ebitda - x.buyer_debt) : purchaseEv;
  const debtFunding = Math.min(purchaseEv * x.debt_mix, debtCapacity, purchaseEv * (1 - (x.stock_mix_floor ?? 0)) - cashFunding);
  return { offerPrice, equityPurchasePrice, purchaseEv, cashFunding, debtFunding, stockFunding: purchaseEv - cashFunding - debtFunding };
}

function synergyRamp(x, year) {
  if (!Number.isFinite(x.synergy_ramp_years) || x.synergy_ramp_years <= 1) return 1;
  return Math.min(1, x.synergy_year1_pct + (1 - x.synergy_year1_pct) * (year - 1) / (x.synergy_ramp_years - 1));
}

function oracleMerger(statement) {
  const x = inputs(statement);
  const funding = mergerFunding(x);
  const newShares = funding.stockFunding / x.buyer_share_price;
  const feeAfterTax = (x.fees + (x.transaction_costs ?? 0)) * (1 - x.tax_rate);
  const financingAfterTax = (funding.debtFunding * (x.debt_rate ?? 0) + funding.cashFunding * (x.cash_yield ?? 0)) * (1 - x.tax_rate);
  const ppaAmortization = (x.ppa_step_up ?? 0) / (x.ppa_amortization_years ?? 1) * (1 - x.tax_rate);
  const integrationAfterTax = (x.integration_costs ?? 0) * (1 - x.tax_rate);
  const eps = [];
  for (let year = 1; year <= 3; year += 1) {
    const buyerNetIncome = x.buyer_net_income * (1 + (x.buyer_growth ?? 0)) ** (year - 1);
    const targetNetIncome = x.target_net_income * (1 + (x.target_growth ?? 0)) ** (year - 1);
    const synergyAfterTax = x.synergies * synergyRamp(x, year) * (1 - x.tax_rate);
    const oneTimeCosts = year === 1 ? feeAfterTax : 0;
    const integrationCosts = year === (x.integration_cost_year ?? 1) ? integrationAfterTax : 0;
    const proFormaNetIncome = buyerNetIncome + targetNetIncome + synergyAfterTax - financingAfterTax - ppaAmortization - oneTimeCosts - integrationCosts;
    const buyerEps = buyerNetIncome / x.buyer_shares;
    const proFormaEps = proFormaNetIncome / (x.buyer_shares + newShares);
    eps.push({ year, buyerEps, proFormaEps, proFormaNetIncome, synergyAfterTax, accretion: proFormaEps - buyerEps });
  }
  const first = eps[0];
  const result = {
    offer_price: round(funding.offerPrice), purchase_ev: round(funding.purchaseEv), cash_funding: round(funding.cashFunding),
    debt_funding: round(funding.debtFunding), stock_funding: round(funding.stockFunding), new_shares: round(newShares),
    pro_forma_net_income: round(first.proFormaNetIncome), pro_forma_eps: round(first.proFormaEps, 4),
    accretion_dilution_value: round(first.accretion, 4), accretion_dilution_pct: round(first.accretion / first.buyerEps, 6),
    buyer_eps: round(first.buyerEps, 4), synergy_after_tax: round(first.synergyAfterTax), fee_after_tax: round(feeAfterTax),
    integration_after_tax: round(integrationAfterTax),
  };
  if (Number.isFinite(x.ppa_step_up)) result.purchase_price_allocation = round(x.ppa_step_up - (Number.isFinite(x.target_equity) ? x.ppa_step_up * x.tax_rate + x.write_offs : 0));
  if (statement.difficulty === "advanced") {
    const dtl = x.ppa_step_up * x.tax_rate;
    const netPpa = x.ppa_step_up - dtl - x.write_offs;
    const goodwill = funding.equityPurchasePrice - x.target_equity - netPpa;
    const combinedAssets = x.buyer_assets - funding.cashFunding - feeAfterTax + x.target_assets - x.target_cash + x.ppa_step_up - x.write_offs + goodwill;
    const combinedLiabilities = x.buyer_liabilities + funding.debtFunding + x.target_liabilities - x.target_debt + dtl;
    const combinedEquity = x.buyer_equity + funding.stockFunding - feeAfterTax;
    let synergyNpv = 0;
    for (let year = 1; year <= x.synergy_horizon_years; year += 1) synergyNpv += x.synergies * synergyRamp(x, year) * (1 - x.tax_rate) / (1 + x.synergy_discount_rate) ** year;
    synergyNpv -= integrationAfterTax / (1 + x.synergy_discount_rate) ** x.integration_cost_year;
    Object.assign(result, {
      ppa_step_up_value: round(x.ppa_step_up), dtl_value: round(dtl), write_offs_value: round(x.write_offs), goodwill: round(goodwill),
      combined_assets: round(combinedAssets), combined_liabilities: round(combinedLiabilities), combined_equity: round(combinedEquity),
      combined_balance_check: round(combinedAssets - combinedLiabilities - combinedEquity), synergy_npv: round(synergyNpv),
      buyer_eps_y2: round(eps[1].buyerEps, 4), buyer_eps_y3: round(eps[2].buyerEps, 4),
      pro_forma_eps_y2: round(eps[1].proFormaEps, 4), pro_forma_eps_y3: round(eps[2].proFormaEps, 4),
      accretion_dilution_y2_pct: round(eps[1].accretion / eps[1].buyerEps, 6),
      accretion_dilution_y3_pct: round(eps[2].accretion / eps[2].buyerEps, 6),
    });
  }
  return result;
}

const ORACLES = { dcf: oracleDcf, lbo: oracleLbo, "merger-model": oracleMerger };
const service = createCorrectionService({ fetchImpl: async () => { throw new Error("numeric oracle must not call a provider"); } });
const scores = {};

for (const theme of CASE_THEMES) {
  for (const difficulty of CASE_DIFFICULTIES) {
    const statement = generateCaseStatement({ theme, difficulty, seed: 424242 });
    ok(!JSON.stringify(statement).includes("expectedValue"), `${theme}/${difficulty} statement leaks no solution`);
    if (theme === "dcf" && difficulty !== "easy") ok(statement.instructions.includes("STUB YEAR FRACTION + n - 0.5"), `${theme}/${difficulty} publishes its mid-year timing formula`);
    if (theme === "dcf" && difficulty === "advanced") ok(statement.instructions.includes("Downside combines"), "DCF publishes scenario cross-assumptions");
    if (theme === "lbo" && difficulty !== "easy") ok(statement.instructions.includes("revolver, then junior debt, then senior debt"), `${difficulty} LBO publishes debt priority`);
    if (theme === "lbo" && difficulty === "advanced") ok(statement.instructions.includes("pro rata"), "LBO publishes its shareholder waterfall");
    if (theme === "merger-model" && difficulty !== "easy") ok(statement.instructions.includes("stock is residual"), `${difficulty} Merger publishes funding constraints`);
    if (theme === "merger-model" && difficulty === "intermediate") ok(statement.instructions.includes("PURCHASE PRICE ALLOCATION equals PPA STEP UP."), "intermediate Merger publishes its gross PPA convention");
    if (theme === "merger-model" && difficulty === "advanced") {
      ok(statement.instructions.includes("linearly"), "Merger publishes its synergy ramp convention");
      ok(statement.instructions.includes("PURCHASE PRICE ALLOCATION equals PPA STEP UP less DTL and WRITE OFFS"), "advanced Merger publishes its net PPA convention");
      ok(!statement.instructions.includes("PURCHASE PRICE ALLOCATION equals PPA STEP UP."), "advanced Merger does not publish the intermediate PPA convention");
    }
    for (const field of statement.sections.flatMap(({ fields }) => fields).filter(({ id }) => id.endsWith("_year") || id.endsWith("_years"))) equal(field.format, "number", `${field.id} is a public numeric convention`);
    for (const field of statement.sections.flatMap(({ fields }) => fields).filter(({ id }) => id.endsWith("_rate") || id === "cost_of_debt" || id === "sensitivity_wacc_delta")) equal(field.format, "percent", `${field.id} is a public percentage convention`);
    for (const field of statement.answerFields.filter(({ id }) => id.includes("_eps"))) { equal(field.format, "per-share", `${field.id} is per-share`); equal(field.tolerance, .05, `${field.id} uses the per-share tolerance`); }
    if (theme === "lbo" && difficulty === "advanced") ok(answerIds(statement).has("sponsor_bridge_entry_adjustment"), "LBO sponsor bridge publishes its entry adjustment");
    const answer = answersFor(statement, ORACLES[theme](statement));
    equal(answerIds(statement).size, Object.keys(answer).length, `${theme}/${difficulty} oracle covers every public answer`);
    ok(Object.values(answer).every(Number.isFinite), `${theme}/${difficulty} oracle answers are finite`);
    const grade = await service.correct({ type: "case", theme, difficulty, seed: statement.seed, answers: answer, recommendation: "" });
    const maximum = theme === "merger-model" && difficulty === "advanced" ? 95 : 100;
    equal(grade.score, maximum, `${theme}/${difficulty} independent oracle reaches ${maximum}`);
    equal(grade.breakdown.results, 100, `${theme}/${difficulty} result oracle`);
    equal(grade.breakdown.method, 100, `${theme}/${difficulty} method oracle`);
    scores[`${theme}/${difficulty}`] = grade.score;
  }
}

let checked = 0;
for (let seed = 0; seed < 10_000; seed += 1) {
  const dcfStatement = generateCaseStatement({ theme: "dcf", difficulty: "advanced", seed });
  const dcf = oracleDcf(dcfStatement);
  ok(dcf.scenario_downside_ev < dcf.scenario_base_ev && dcf.scenario_base_ev < dcf.scenario_upside_ev, `DCF scenarios ordered for seed ${seed}`);
  ok(Object.values(dcf).every(Number.isFinite), `DCF finite for seed ${seed}`);
  equal((await service.correct({ type: "case", theme: "dcf", difficulty: "advanced", seed, answers: answersFor(dcfStatement, dcf), recommendation: "" })).score, 100, `DCF public grader agrees for seed ${seed}`);

  const lboStatement = generateCaseStatement({ theme: "lbo", difficulty: "advanced", seed });
  const lbo = oracleLbo(lboStatement);
  close(lbo.ev_bridge_check, 0, .02, `LBO EV bridge for seed ${seed}`);
  close(lbo.sponsor_bridge_check, 0, .02, `LBO sponsor bridge for seed ${seed}`);
  for (let year = 1; year <= 5; year += 1) {
    close(lbo[`balance_check_y${year}`], 0, .02, `LBO balance for seed ${seed}, year ${year}`);
    for (const field of ["cash", "nwc", "net_ppe", "other_assets", "assets", "liabilities", "equity", "debt"]) ok(lbo[`${field}_y${year}`] >= 0, `LBO ${field} nonnegative for seed ${seed}, year ${year}`);
  }
  ok(lbo.sponsor_equity > 0 && lbo.sponsor_proceeds >= 0, `LBO sponsor values nonnegative for seed ${seed}`);
  ok(lbo.sensitivity_low < lbo.mom && lbo.mom < lbo.sensitivity_high, `LBO integrated scenarios ordered for seed ${seed}`);
  equal((await service.correct({ type: "case", theme: "lbo", difficulty: "advanced", seed, answers: answersFor(lboStatement, lbo), recommendation: "" })).score, 100, `LBO public grader agrees for seed ${seed}`);

  const mergerStatement = generateCaseStatement({ theme: "merger-model", difficulty: "advanced", seed });
  const merger = oracleMerger(mergerStatement);
  close(merger.combined_balance_check, 0, .02, `Merger balance for seed ${seed}`);
  close(merger.cash_funding + merger.debt_funding + merger.stock_funding, merger.purchase_ev, .02, `Merger funding for seed ${seed}`);
  for (const field of ["goodwill", "combined_assets", "combined_liabilities", "combined_equity", "synergy_npv"]) ok(merger[field] >= 0, `Merger ${field} nonnegative for seed ${seed}`);
  equal((await service.correct({ type: "case", theme: "merger-model", difficulty: "advanced", seed, answers: answersFor(mergerStatement, merger), recommendation: "" })).score, 95, `Merger public grader agrees for seed ${seed}`);
  checked += 1;
}

console.log(JSON.stringify({ ok: true, oracle: scores, invariants: checked }));
