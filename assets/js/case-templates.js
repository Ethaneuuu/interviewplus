export const CASE_THEMES = ["dcf", "lbo", "merger-model"];
export const CASE_DIFFICULTIES = ["easy", "intermediate", "advanced"];

export const CORE_OUTPUTS = {
  dcf: ["ufcf_y1", "ufcf_y2", "ufcf_y3", "ufcf_y4", "ufcf_y5", "pv_ufcf", "terminal_value", "enterprise_value", "equity_value", "share_price", "sensitivity_low", "sensitivity_high"],
  lbo: ["entry_ev", "entry_equity", "sources_total", "uses_total", "fcf_y1", "fcf_y2", "fcf_y3", "fcf_y4", "fcf_y5", "debt_y1", "debt_y2", "debt_y3", "debt_y4", "debt_y5", "exit_ev", "exit_equity", "mom", "irr", "sensitivity_low", "sensitivity_high"],
  "merger-model": ["offer_price", "purchase_ev", "cash_funding", "debt_funding", "stock_funding", "new_shares", "pro_forma_net_income", "pro_forma_eps", "accretion_dilution_value", "accretion_dilution_pct"],
};

const METHOD_OUTPUTS = {
  dcf: [["ebitda_y1", "discount_factor_y1"], ["ebitda_y1", "discount_factor_y1", "ebitda_y2", "capex_y1", "terminal_value_multiple", "comparable_value", "grid_wacc_high_growth_low", "grid_wacc_low_growth_high", "grid_wacc_high_multiple_low", "grid_wacc_low_multiple_high"], ["ebitda_y1", "discount_factor_y1", "ebitda_y2", "capex_y1", "terminal_value_multiple", "comparable_value", "grid_wacc_high_growth_low", "grid_wacc_low_growth_high", "grid_wacc_high_multiple_low", "grid_wacc_low_multiple_high", "ebitda_y3", "nwc_y1", "discount_factor_y5", "scenario_downside_ev", "scenario_base_ev", "scenario_upside_ev"]],
  lbo: [["sponsor_equity", "debt_paydown_y1"], ["sponsor_equity", "debt_paydown_y1", "interest_y1", "revolver_draw"], ["sponsor_equity", "debt_paydown_y1", "interest_y1", "revolver_draw", "pik_interest_y1", "management_proceeds", "revenue_y1", "ebitda_y1", "assets_y1", "cash_flow_y1", "balance_check_y1", "value_creation_ebitda", "value_creation_multiple", "value_creation_deleveraging"]],
  "merger-model": [["buyer_eps", "synergy_after_tax"], ["buyer_eps", "synergy_after_tax", "fee_after_tax", "purchase_price_allocation"], ["buyer_eps", "synergy_after_tax", "fee_after_tax", "purchase_price_allocation", "integration_after_tax", "pro_forma_eps_y2", "goodwill", "combined_assets", "synergy_npv", "accretion_dilution_y2_pct"]],
};

export function generateCaseStatement({ theme, difficulty, seed }) {
  if (!CASE_THEMES.includes(theme)) throw new Error("INVALID_CASE_THEME");
  if (!CASE_DIFFICULTIES.includes(difficulty)) throw new Error("INVALID_CASE_DIFFICULTY");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("INVALID_CASE_SEED");
  const random = mulberry32(seed ^ hash(`${theme}:${difficulty}`));
  const data = publicInputs(theme, difficulty, random);
  const index = CASE_DIFFICULTIES.indexOf(difficulty);
  const coreOutputIds = CORE_OUTPUTS[theme];
  const methodOutputIds = METHOD_OUTPUTS[theme][index];
  const answerFields = [
    ...coreOutputIds.map((id) => answerField(id, "results", 1 / coreOutputIds.length)),
    ...methodOutputIds.map((id) => answerField(id, "method", 1 / methodOutputIds.length)),
  ];
  return {
    templateId: `${theme}-${difficulty}-v1`,
    theme,
    difficulty,
    seed,
    title: `${title(theme)} — ${difficulty}`,
    durationOptions: [30, 45, 60],
    instructions: instructions(theme, difficulty),
    sections: [{ id: "inputs", title: "Inputs (USD millions, except per-share data)", fields: Object.entries(data).map(([id, value]) => inputField(id, value)) }],
    answerFields,
    coreOutputIds,
    recommendation: theme === "merger-model" && difficulty === "advanced" ? {
      rubric: "Assess whether the recommendation follows the stated EPS accretion/dilution, leverage constraints, synergies, and integration costs. Return JSON with score (0-100) and concise feedback.",
    } : null,
  };
}

function publicInputs(theme, difficulty, random) {
  const n = (min, max) => integer(random, min, max);
  const p = (min, max, step = 0.005) => decimal(random, min, max, step);
  if (theme === "dcf") {
    const data = { revenue: n(900, 1500), growth: p(.04, .10), ebitda_margin: p(.18, .30), da_pct: p(.02, .05), capex_pct: p(.03, .07), nwc_pct: p(.08, .16), tax_rate: .25, terminal_growth: p(.02, .035), terminal_multiple: decimal(random, 8, 12, .5), sensitivity_wacc_delta: .01, sensitivity_growth_delta: .005, debt: n(100, 350), cash: n(30, 130), shares: n(70, 160) };
    if (difficulty === "easy") data.wacc = p(.08, .12);
    if (difficulty !== "easy") Object.assign(data, { risk_free_rate: p(.025, .04), beta: decimal(random, .8, 1.4, .1), equity_risk_premium: p(.045, .065), cost_of_debt: p(.04, .07), target_debt_pct: p(.25, .45), stub_year_fraction: .5, mid_year_convention: 1 });
    if (difficulty === "advanced") {
      const segmentA = n(450, 800); const segmentB = n(300, 650);
      Object.assign(data, { revenue: segmentA + segmentB, segment_a_revenue: segmentA, segment_b_revenue: segmentB, segment_a_growth: p(.04, .10), segment_b_growth: p(.02, .08), segment_a_margin: p(.20, .32), segment_b_margin: p(.14, .26), base_case_probability: p(.45, .65), upside_growth: p(.01, .03), comparable_beta: decimal(random, .9, 1.5, .1), comparable_debt_pct: p(.15, .35), stub_year_fraction: .5, mid_year_convention: 1 });
      delete data.growth; delete data.ebitda_margin; delete data.beta;
    }
    return data;
  }
  if (theme === "lbo") {
    const data = { ebitda: n(180, 320), entry_multiple: decimal(random, 8, 11, .5), exit_multiple: decimal(random, 8, 11, .5), existing_debt: n(100, 250), cash: n(20, 80), debt: n(500, 800), fcf_margin: p(.36, .50), ebitda_growth: p(.04, .10), fees: n(15, 35), tax_rate: .25, senior_interest_rate: .06, junior_interest_rate: .10, revolver_interest_rate: .08, ppa_amortization_years: 5, sensitivity_exit_multiple_delta: .5, min_cash: 0, management_pool: 0, pik_rate: 0, rollover: 0 };
    if (difficulty !== "easy") { const cash = data.cash; Object.assign(data, { senior_debt: n(300, 500), junior_debt: n(50, 150), min_cash: n(20, Math.max(20, cash)), liquidity_shock: random() < .15 ? n(100, 200) : 0, nol: n(20, 90), management_pool: p(.06, .12), revolver_limit: n(50, 150) }); }
    if (difficulty === "advanced") { Object.assign(data, { revenue: n(700, 1200), revenue_growth: p(.04, .10), ebitda_margin: p(.18, .28), margin_expansion: p(.005, .02), capex_pct: p(.03, .07), nwc_pct: p(.06, .14), liquidity_shock: random() < .35 ? n(120, 220) : 0, management_hurdle: decimal(random, 1.2, 1.8, .1), ppa_step_up: n(20, 80), earnout: n(10, 60), rollover: n(30, 120), pik_rate: p(.08, .12), cash_sweep: p(.60, .90), call_premium: p(.01, .04) }); delete data.debt; delete data.fcf_margin; delete data.ebitda_growth; }
    return data;
  }
  const data = { buyer_share_price: n(45, 95), buyer_shares: n(300, 650), buyer_net_income: n(650, 1200), target_share_price: n(18, 50), target_shares: n(90, 240), target_net_income: n(100, 350), target_debt: n(80, 300), target_cash: n(20, 100), premium: p(.20, .40), cash_mix: p(.25, .55), debt_mix: p(.10, .35), tax_rate: .25, synergies: n(30, 120), fees: n(15, 55) };
  if (difficulty !== "easy") { const minimumCash = n(100, 250); Object.assign(data, { minimum_cash: minimumCash, buyer_cash: minimumCash + n(100, 450), debt_rate: p(.045, .075), cash_yield: p(.02, .04), ppa_step_up: n(20, 100), stock_mix_floor: p(.15, .35), transaction_costs: n(10, 35) }); }
  if (difficulty === "advanced") { const purchaseEv = data.target_share_price * (1 + data.premium) * data.target_shares + data.target_debt - data.target_cash; const mode = n(0, 2); const floorMode = n(0, 2); const leverageMode = n(0, 2); const baseStock = 1 - data.cash_mix - data.debt_mix; const stockFloor = floorMode === 0 ? Math.min(.55, baseStock + .08) : Math.max(.05, baseStock - .08); const maxLeverage = decimal(random, 3, 5, .25); const buyerDebt = n(300, 900); const cashAvailable = mode === 0 ? purchaseEv * data.cash_mix * .6 : purchaseEv * data.cash_mix * 1.4; const debtCapacity = purchaseEv * data.debt_mix * (leverageMode === 0 ? .7 : 1.4); Object.assign(data, { stock_mix_floor: stockFloor, buyer_cash: data.minimum_cash + cashAvailable, buyer_growth: p(.03, .08), target_growth: p(.04, .10), buyer_ebitda: (debtCapacity + buyerDebt) / maxLeverage, buyer_debt: buyerDebt, max_leverage: maxLeverage, dtl: n(10, 60), write_offs: n(10, 45), synergy_year1_pct: p(.35, .65), integration_costs: n(20, 90) }); }
  return data;
}

function answerField(id, category, weight) {
  const percent = id === "irr" || id.endsWith("_pct");
  const perShare = id.includes("share_price") || id.includes("offer_price") || id.endsWith("_eps") || id.includes("accretion_dilution_value");
  const multiple = id === "mom";
  const number = id === "new_shares" || id.startsWith("discount_factor");
  return { id, label: id.replaceAll("_", " ").toUpperCase(), category, weight, format: percent ? "percent" : multiple ? "multiple" : perShare ? "per-share" : number ? "number" : "money", tolerance: percent ? .0025 : multiple ? .025 : perShare ? .05 : number ? .0001 : 1 };
}

function inputField(id, value) {
  const percent = id.includes("rate") || id.includes("margin") || id.includes("growth") || id.includes("pct") || id.includes("mix") || id.includes("premium") || id.includes("pool") || id.includes("probability") || id.includes("sweep") || id === "cash_yield";
  const multiple = id.includes("multiple") || id === "beta" || id === "comparable_beta" || id.includes("leverage") || id === "management_hurdle";
  const number = id.includes("shares") || id === "stub_year_fraction" || id === "mid_year_convention";
  return { id, label: id.replaceAll("_", " ").toUpperCase(), value, format: percent ? "percent" : multiple ? "multiple" : number ? "number" : "money" };
}

function title(theme) { return ({ dcf: "DCF valuation", lbo: "LBO model", "merger-model": "Merger model" })[theme]; }
function instructions(theme, difficulty) { return `Complete the ${title(theme).toLowerCase()} using the stated USD million inputs. ${difficulty === "advanced" ? "Apply the additional scenario and transaction conditions." : difficulty === "intermediate" ? "Show the supporting method outputs." : "Calculate the requested outputs."}`; }
function mulberry32(seed) { return () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function integer(random, min, max) { return Math.floor(random() * (max - min + 1)) + min; }
function decimal(random, min, max, step) { return Math.round((min + Math.round(random() * (max - min) / step) * step) * 10000) / 10000; }
function hash(value) { return [...value].reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0; }
