export const CASE_THEMES = ["dcf", "lbo", "merger-model"];
export const CASE_DIFFICULTIES = ["easy", "intermediate", "advanced"];

const COMPANIES = [
  { name: "Solstice Industrial Group", sectorFr: "industrie manufacturière", sectorEn: "industrial manufacturing" },
  { name: "Meridian Foods Holding", sectorFr: "agroalimentaire", sectorEn: "food and beverage" },
  { name: "Vantage Analytics Corp", sectorFr: "logiciels et données", sectorEn: "software and data" },
  { name: "Northbridge Materials", sectorFr: "matériaux de construction", sectorEn: "building materials" },
  { name: "Cobalt Health Systems", sectorFr: "santé et équipements médicaux", sectorEn: "healthcare and medical devices" },
  { name: "Palladium Logistics", sectorFr: "transport et logistique", sectorEn: "transportation and logistics" },
  { name: "Aurelia Consumer Brands", sectorFr: "biens de consommation", sectorEn: "consumer goods" },
  { name: "Ferrovia Energy Partners", sectorFr: "énergie", sectorEn: "energy" },
  { name: "Kestrel Aerospace", sectorFr: "aéronautique et défense", sectorEn: "aerospace and defense" },
  { name: "Bellweather Retail Group", sectorFr: "distribution spécialisée", sectorEn: "specialty retail" },
  { name: "Argent Telecom Holdings", sectorFr: "télécommunications", sectorEn: "telecommunications" },
  { name: "Hartline Chemicals", sectorFr: "chimie industrielle", sectorEn: "industrial chemicals" },
];

function pickCompany(random, excludeName) {
  const pool = excludeName ? COMPANIES.filter((company) => company.name !== excludeName) : COMPANIES;
  return pool[Math.floor(random() * pool.length)];
}

function money(value) {
  return `$${Math.round(value).toLocaleString("en-US")}M`;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function fyLabel(baseYear, offset) {
  return `FY${String((baseYear + offset) % 100).padStart(2, "0")}`;
}

function generateNarrative({ theme, difficulty, data, random, baseYear }) {
  const company = pickCompany(random);
  if (theme === "merger-model") {
    const target = pickCompany(random, company.name);
    const narrativeFr = `${company.name}, acteur du secteur ${company.sectorFr}, envisage l'acquisition de ${target.name} (secteur ${target.sectorFr}). L'acquéreur, dont le cours de bourse s'établit à $${data.buyer_share_price}, propose une prime de ${pct(data.premium)} sur le cours actuel de la cible. Vous devez déterminer si l'opération est relutive ou dilutive pour le bénéfice par action pro forma de ${company.name} en ${fyLabel(baseYear, 1)}.`;
    const narrativeEn = `${company.name}, a ${company.sectorEn} company, is considering the acquisition of ${target.name} (${target.sectorEn}). The acquirer, trading at $${data.buyer_share_price} per share, is offering a ${pct(data.premium)} premium to the target's current price. Determine whether the deal is accretive or dilutive to ${company.name}'s pro forma earnings per share in ${fyLabel(baseYear, 1)}.`;
    return { companyName: company.name, targetName: target.name, sectorFr: company.sectorFr, sectorEn: company.sectorEn, narrativeFr, narrativeEn };
  }
  if (theme === "lbo") {
    const narrativeFr = `Un fonds de LBO étudie l'acquisition de ${company.name}, société du secteur ${company.sectorFr} générant un EBITDA de ${money(data.ebitda)}. L'opération serait financée à un multiple d'entrée de ${data.entry_multiple.toFixed(1)}x sur un horizon de détention de 5 ans (${fyLabel(baseYear, 1)}–${fyLabel(baseYear, 5)}). Construisez le modèle LBO pour déterminer le multiple de capital investi (MOM) et le taux de rentabilité interne (IRR) du sponsor à la sortie.`;
    const narrativeEn = `A private equity sponsor is evaluating the acquisition of ${company.name}, a ${company.sectorEn} company generating ${money(data.ebitda)} of EBITDA. The deal would be financed at an entry multiple of ${data.entry_multiple.toFixed(1)}x over a 5-year holding period (${fyLabel(baseYear, 1)}–${fyLabel(baseYear, 5)}). Build the LBO model to determine the sponsor's money-on-money multiple (MOM) and internal rate of return (IRR) at exit.`;
    return { companyName: company.name, sectorFr: company.sectorFr, sectorEn: company.sectorEn, narrativeFr, narrativeEn };
  }
  // dcf
  if (difficulty === "advanced") {
    const narrativeFr = `${company.name} regroupe deux activités dans le secteur ${company.sectorFr} : une division historique générant ${money(data.segment_a_revenue)} de chiffre d'affaires (marge d'EBITDA de ${pct(data.segment_a_margin)}) et une division de croissance générant ${money(data.segment_b_revenue)} (marge d'EBITDA de ${pct(data.segment_b_margin)}). Vous devez construire un DCF par segment sur l'horizon ${fyLabel(baseYear, 1)}–${fyLabel(baseYear, 5)} pour déterminer la valeur d'entreprise consolidée et le cours cible par action.`;
    const narrativeEn = `${company.name} operates two divisions in the ${company.sectorEn} sector: a legacy division generating ${money(data.segment_a_revenue)} of revenue (${pct(data.segment_a_margin)} EBITDA margin) and a growth division generating ${money(data.segment_b_revenue)} (${pct(data.segment_b_margin)} EBITDA margin). Build a segment-level DCF over ${fyLabel(baseYear, 1)}–${fyLabel(baseYear, 5)} to determine the consolidated enterprise value and target share price.`;
    return { companyName: company.name, sectorFr: company.sectorFr, sectorEn: company.sectorEn, narrativeFr, narrativeEn };
  }
  const narrativeFr = `Vous êtes analyste M&A et devez valoriser ${company.name}, un acteur du secteur ${company.sectorFr}. La société a réalisé un chiffre d'affaires de ${money(data.revenue)} sur le dernier exercice, avec une marge d'EBITDA de ${pct(data.ebitda_margin)} et une croissance annuelle attendue de ${pct(data.growth)}. Construisez une valorisation DCF sur l'horizon ${fyLabel(baseYear, 1)}–${fyLabel(baseYear, 5)} pour déterminer si le titre est sous-évalué au cours actuel.`;
  const narrativeEn = `You are an M&A analyst tasked with valuing ${company.name}, a ${company.sectorEn} company. The company generated ${money(data.revenue)} of revenue last fiscal year, with an EBITDA margin of ${pct(data.ebitda_margin)} and expected annual growth of ${pct(data.growth)}. Build a DCF valuation over ${fyLabel(baseYear, 1)}–${fyLabel(baseYear, 5)} to determine whether the stock is undervalued at the current price.`;
  return { companyName: company.name, sectorFr: company.sectorFr, sectorEn: company.sectorEn, narrativeFr, narrativeEn };
}

export const CORE_OUTPUTS = {
  dcf: ["ufcf_y1", "ufcf_y2", "ufcf_y3", "ufcf_y4", "ufcf_y5", "pv_ufcf", "terminal_value", "enterprise_value", "equity_value", "share_price", "sensitivity_low", "sensitivity_high"],
  lbo: ["entry_ev", "entry_equity", "sources_total", "uses_total", "fcf_y1", "fcf_y2", "fcf_y3", "fcf_y4", "fcf_y5", "debt_y1", "debt_y2", "debt_y3", "debt_y4", "debt_y5", "exit_ev", "exit_equity", "mom", "irr", "sensitivity_low", "sensitivity_high"],
  "merger-model": ["offer_price", "purchase_ev", "cash_funding", "debt_funding", "stock_funding", "new_shares", "pro_forma_net_income", "pro_forma_eps", "accretion_dilution_value", "accretion_dilution_pct"],
};

const METHOD_OUTPUTS = {
  dcf: [["ebitda_y1", "discount_factor_y1"], ["ebitda_y1", "discount_factor_y1", "ebitda_y2", "capex_y1", "terminal_value_multiple", "comparable_value", "grid_wacc_high_growth_low", "grid_wacc_low_growth_high", "grid_wacc_high_multiple_low", "grid_wacc_low_multiple_high"], ["ebitda_y1", "discount_factor_y1", "ebitda_y2", "capex_y1", "terminal_value_multiple", "comparable_value", "grid_wacc_high_growth_low", "grid_wacc_low_growth_high", "grid_wacc_high_multiple_low", "grid_wacc_low_multiple_high", "ebitda_y3", "nwc_y1", "discount_factor_y5", "scenario_downside_ev", "scenario_base_ev", "scenario_upside_ev"]],
  lbo: [["sponsor_equity", "debt_paydown_y1"], ["sponsor_equity", "debt_paydown_y1", "interest_y1", "revolver_draw"], [
    "sponsor_equity", "management_proceeds", "sponsor_bridge_entry_adjustment",
    ...Array.from({ length: 5 }, (_, index) => index + 1).flatMap((year) => [`ebitda_y${year}`, `net_income_y${year}`, `cash_y${year}`, `nwc_y${year}`, `net_ppe_y${year}`, `other_assets_y${year}`, `assets_y${year}`, `liabilities_y${year}`, `equity_y${year}`, `balance_check_y${year}`]),
    "value_creation_ebitda", "value_creation_multiple", "ev_bridge_check", "value_creation_deleveraging", "value_creation_cash", "value_creation_waterfall", "sponsor_bridge_check",
  ]],
  "merger-model": [["buyer_eps", "synergy_after_tax"], ["buyer_eps", "synergy_after_tax", "fee_after_tax", "purchase_price_allocation"], ["buyer_eps", "synergy_after_tax", "fee_after_tax", "purchase_price_allocation", "integration_after_tax", "buyer_eps_y2", "buyer_eps_y3", "pro_forma_eps_y2", "pro_forma_eps_y3", "goodwill", "ppa_step_up_value", "dtl_value", "write_offs_value", "combined_assets", "combined_liabilities", "combined_equity", "combined_balance_check", "synergy_npv", "accretion_dilution_y2_pct", "accretion_dilution_y3_pct"]],
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
  const baseYear = new Date().getFullYear();
  const narrative = generateNarrative({ theme, difficulty, data, random, baseYear });
  return {
    templateId: `${theme}-${difficulty}-v1`,
    theme,
    difficulty,
    seed,
    baseYear,
    title: `${title(theme)} — ${difficulty}`,
    ...narrative,
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

export function caseFyLabel(baseYear, offset) {
  return fyLabel(baseYear, offset);
}

function publicInputs(theme, difficulty, random) {
  const n = (min, max) => integer(random, min, max);
  const p = (min, max, step = 0.005) => decimal(random, min, max, step);
  if (theme === "dcf") {
    const data = { revenue: n(900, 1500), growth: p(.04, .10), ebitda_margin: p(.18, .30), da_pct: p(.02, .05), capex_pct: p(.03, .07), nwc_pct: p(.08, .16), tax_rate: .25, terminal_growth: p(.02, .035), sensitivity_wacc_delta: .01, sensitivity_growth_delta: .005, debt: n(100, 350), cash: n(30, 130), shares: n(70, 160) };
    if (difficulty === "easy") data.wacc = p(.08, .12);
    if (difficulty !== "easy") Object.assign(data, { terminal_multiple: decimal(random, 8, 12, .5), sensitivity_multiple_delta: .5, risk_free_rate: p(.025, .04), beta: decimal(random, .8, 1.4, .1), equity_risk_premium: p(.045, .065), cost_of_debt: p(.04, .07), target_debt_pct: p(.25, .45), stub_year_fraction: .5, mid_year_convention: 1 });
    if (difficulty === "advanced") {
      const segmentA = n(450, 800); const segmentB = n(300, 650);
      Object.assign(data, { revenue: segmentA + segmentB, segment_a_revenue: segmentA, segment_b_revenue: segmentB, segment_a_growth: p(.04, .10), segment_b_growth: p(.02, .08), segment_a_margin: p(.20, .32), segment_b_margin: p(.14, .26), downside_growth_delta: p(.01, .03), upside_growth_delta: p(.01, .03), comparable_beta: decimal(random, .9, 1.5, .1), comparable_debt_pct: p(.15, .35), stub_year_fraction: .5, mid_year_convention: 1 });
      delete data.growth; delete data.ebitda_margin; delete data.beta;
    }
    return data;
  }
  if (theme === "lbo") {
    const data = { ebitda: n(180, 320), entry_multiple: decimal(random, 8, 11, .5), exit_multiple: decimal(random, 8, 11, .5), existing_debt: n(100, 250), cash: n(20, 80), fees: n(15, 35), tax_rate: .25, senior_interest_rate: .06, sensitivity_exit_multiple_delta: .5 };
    if (difficulty === "easy") Object.assign(data, { debt: n(500, 800), fcf_margin: p(.36, .50), ebitda_growth: p(.04, .10) });
    if (difficulty !== "easy") {
      Object.assign(data, { fcf_margin: p(.36, .50), ebitda_growth: p(.04, .10), senior_debt: n(300, 500), junior_debt: n(50, 150), junior_interest_rate: .10, revolver_interest_rate: .08, min_cash: n(20, Math.max(20, data.cash)), liquidity_shock: random() < .15 ? n(80, 140) : 0, nol: n(20, 90), management_pool: p(.06, .12), revolver_limit: n(120, 220), cash_sweep: 1 });
    }
    if (difficulty === "advanced") {
      const revenue = n(700, 1200); const ebitdaMargin = p(.18, .28);
      Object.assign(data, { ebitda: Math.round(revenue * ebitdaMargin * 100) / 100, revenue, revenue_growth: p(.04, .10), ebitda_margin: ebitdaMargin, margin_expansion: p(.005, .02), scenario_revenue_growth_delta: p(.01, .03), scenario_margin_delta: p(.01, .03), da_pct: p(.02, .04), capex_pct: p(.03, .07), nwc_pct: p(.06, .14), net_ppe: n(650, 1000), other_assets: n(150, 300), other_liabilities: n(50, 180), liquidity_shock: random() < .35 ? n(100, 200) : 0, revolver_limit: n(180, 320), management_hurdle: decimal(random, 1.2, 1.8, .1), ppa_step_up: n(20, 80), ppa_amortization_years: 5, earnout: n(10, 60), rollover: n(30, 120), pik_rate: p(.08, .12), cash_sweep: p(.60, .90), call_premium: p(.01, .04) });
      delete data.fcf_margin; delete data.ebitda_growth;
    }
    return data;
  }
  const data = { buyer_share_price: n(45, 95), buyer_shares: n(300, 650), buyer_net_income: n(650, 1200), target_share_price: n(18, 50), target_shares: n(90, 240), target_net_income: n(100, 350), target_debt: n(80, 300), target_cash: n(20, 100), premium: p(.20, .40), cash_mix: p(.25, .55), debt_mix: p(.10, .35), tax_rate: .25, synergies: n(30, 120), fees: n(15, 55) };
  if (difficulty !== "easy") { const minimumCash = n(100, 250); Object.assign(data, { minimum_cash: minimumCash, buyer_cash: minimumCash + n(100, 450), debt_rate: p(.045, .075), cash_yield: p(.02, .04), ppa_amortization_years: 5, ppa_step_up: n(20, 100), stock_mix_floor: p(.15, .35), transaction_costs: n(10, 35) }); }
  if (difficulty === "advanced") {
    const equityPurchasePrice = data.target_share_price * (1 + data.premium) * data.target_shares; const purchaseEv = equityPurchasePrice + data.target_debt - data.target_cash; const mode = n(0, 2); const floorMode = n(0, 2); const leverageMode = n(0, 2); const baseStock = 1 - data.cash_mix - data.debt_mix; const stockFloor = floorMode === 0 ? Math.min(.55, baseStock + .08) : Math.max(.05, baseStock - .08); const maxLeverage = decimal(random, 3, 5, .25); const buyerDebt = n(300, 900); const cashAvailable = mode === 0 ? purchaseEv * data.cash_mix * .6 : purchaseEv * data.cash_mix * 1.4; const debtCapacity = purchaseEv * data.debt_mix * (leverageMode === 0 ? .7 : 1.4); const buyerCash = data.minimum_cash + cashAvailable; const buyerLiabilities = buyerDebt + n(500, 2000); const buyerAssets = buyerCash + n(4000, 9000); const targetEquity = n(400, Math.max(400, Math.min(1500, Math.floor(equityPurchasePrice * .6)))); const targetLiabilities = data.target_debt + n(200, 800);
    Object.assign(data, { stock_mix_floor: stockFloor, buyer_cash: buyerCash, buyer_growth: p(.03, .08), target_growth: p(.04, .10), buyer_ebitda: (debtCapacity + buyerDebt) / maxLeverage, buyer_debt: buyerDebt, max_leverage: maxLeverage, buyer_assets: buyerAssets, buyer_liabilities: buyerLiabilities, buyer_equity: buyerAssets - buyerLiabilities, target_assets: targetEquity + targetLiabilities, target_liabilities: targetLiabilities, target_equity: targetEquity, write_offs: n(10, 45), synergy_discount_rate: p(.08, .12), synergy_horizon_years: 5, synergy_ramp_years: 3, synergy_year1_pct: p(.35, .65), integration_costs: n(20, Math.max(20, data.synergies)), integration_cost_year: 1 });
  }
  return data;
}

function answerField(id, category, weight) {
  const percent = id === "irr" || id.endsWith("_pct");
  const perShare = id.includes("share_price") || id.includes("offer_price") || id.includes("_eps") || id.includes("accretion_dilution_value");
  const multiple = id === "mom";
  const number = id === "new_shares" || id.startsWith("discount_factor");
  return { id, label: id.replaceAll("_", " ").toUpperCase(), category, weight, format: percent ? "percent" : multiple ? "multiple" : perShare ? "per-share" : number ? "number" : "money", tolerance: percent ? .0025 : multiple ? .025 : perShare ? .05 : number ? .0001 : 1 };
}

function inputField(id, value) {
  const percent = id.includes("rate") || id.includes("margin") || id.includes("growth") || id.includes("wacc") || id.includes("pct") || id.includes("mix") || id.includes("premium") || id.includes("pool") || id.includes("probability") || id.includes("sweep") || id === "cash_yield" || id === "cost_of_debt";
  const multiple = id.includes("multiple") || id === "beta" || id === "comparable_beta" || id.includes("leverage") || id === "management_hurdle";
  const number = id.includes("shares") || id.endsWith("_year") || id.endsWith("_years") || id === "stub_year_fraction" || id === "mid_year_convention";
  return { id, label: id.replaceAll("_", " ").toUpperCase(), value, format: percent ? "percent" : multiple ? "multiple" : number ? "number" : "money" };
}

function title(theme) { return ({ dcf: "DCF valuation", lbo: "LBO model", "merger-model": "Merger model" })[theme]; }
function instructions(theme, difficulty) {
  const base = `Complete the ${title(theme).toLowerCase()} using the stated USD million inputs.`;
  if (theme === "dcf" && difficulty !== "easy") return `${base} When MID YEAR CONVENTION is 1, discount forecast year n at STUB YEAR FRACTION + n - 0.5; otherwise use STUB YEAR FRACTION + n. Pair high WACC with low terminal growth or multiple, and low WACC with high terminal growth or multiple.${difficulty === "advanced" ? " Downside combines both segment growth rates minus DOWNSIDE GROWTH DELTA, high WACC and low terminal growth; upside combines both segment growth rates plus UPSIDE GROWTH DELTA, low WACC and high terminal growth. Unlever COMPARABLE BETA at COMPARABLE DEBT PCT and relever it at TARGET DEBT PCT." : ""}`;
  if (theme === "lbo" && difficulty !== "easy") {
    const common = "Apply cash to the revolver, then junior debt, then senior debt. Draw the revolver only to restore MIN CASH, cap it at REVOLVER LIMIT, and apply CASH SWEEP to cash above MIN CASH.";
    if (difficulty === "advanced") return `${base} Downside/upside subtract/add SCENARIO REVENUE GROWTH DELTA, SCENARIO MARGIN DELTA and SENSITIVITY EXIT MULTIPLE DELTA. ${common} Include CALL PREMIUM on junior repayment. Opening OTHER ASSETS include PPA STEP UP and opening equity is the balance residual; roll net PPE by CapEx less D&A, other assets by PPA amortization, and equity by net income less call premium. Management receives MANAGEMENT POOL on equity above SPONSOR EQUITY × MANAGEMENT HURDLE; split the remaining proceeds pro rata between sponsor equity and rollover.`;
    return `${base} ${common} Management receives MANAGEMENT POOL × exit equity and sponsor receives the remainder. Low/high sensitivity subtracts/adds SENSITIVITY EXIT MULTIPLE DELTA from/to EXIT MULTIPLE.`;
  }
  if (theme === "merger-model" && difficulty !== "easy") {
    const common = "Cap cash funding at BUYER CASH less MINIMUM CASH and at the amount permitted by STOCK MIX FLOOR; cap debt funding at DEBT MIX and the remaining non-stock amount; stock is residual. Deduct after-tax debt interest, foregone cash yield, fees, TRANSACTION COSTS and PPA amortization from pro forma net income.";
    if (difficulty === "advanced") return `${base} ${common} Also cap debt funding at MAX LEVERAGE × BUYER EBITDA less BUYER DEBT. DTL equals PPA STEP UP × TAX RATE; PURCHASE PRICE ALLOCATION equals PPA STEP UP less DTL and WRITE OFFS; goodwill equals offer equity value less TARGET EQUITY and PURCHASE PRICE ALLOCATION. The combined balance removes target cash and target debt, adds new debt and stock, and charges after-tax fees to assets and equity. Ramp synergies linearly from SYNERGY YEAR1 PCT to 100% over SYNERGY RAMP YEARS, discount through SYNERGY HORIZON YEARS, deduct integration costs in INTEGRATION COST YEAR, and compare each pro forma EPS with buyer standalone EPS for that year.`;
    return `${base} ${common} PURCHASE PRICE ALLOCATION equals PPA STEP UP. Recognize all stated synergies in year 1.`;
  }
  return `${base} ${difficulty === "advanced" ? "Apply the additional scenario and transaction conditions." : difficulty === "intermediate" ? "Show the supporting method outputs." : "Calculate the requested outputs."}`;
}
function mulberry32(seed) { return () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function integer(random, min, max) { return Math.floor(random() * (max - min + 1)) + min; }
function decimal(random, min, max, step) { return Math.round((min + Math.round(random() * (max - min) / step) * step) * 10000) / 10000; }
function hash(value) { return [...value].reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0; }
