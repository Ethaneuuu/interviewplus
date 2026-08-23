const STORAGE_KEY = "interviewplus-ui-language";

const caseOutputLabels = {
  ufcf_y1: ["Flux de trésorerie disponible non endetté A1", "Unlevered free cash flow Y1"], ufcf_y2: ["Flux de trésorerie disponible non endetté A2", "Unlevered free cash flow Y2"], ufcf_y3: ["Flux de trésorerie disponible non endetté A3", "Unlevered free cash flow Y3"], ufcf_y4: ["Flux de trésorerie disponible non endetté A4", "Unlevered free cash flow Y4"], ufcf_y5: ["Flux de trésorerie disponible non endetté A5", "Unlevered free cash flow Y5"],
  pv_ufcf: ["Valeur actuelle des flux de trésorerie", "Present value of free cash flow"], terminal_value: ["Valeur terminale", "Terminal value"], enterprise_value: ["Valeur d'entreprise", "Enterprise value"], equity_value: ["Valeur des capitaux propres", "Equity value"], share_price: ["Cours par action", "Share price"], sensitivity_low: ["Sensibilité basse", "Low sensitivity"], sensitivity_high: ["Sensibilité haute", "High sensitivity"],
  ebitda_y1: ["EBITDA A1", "EBITDA Y1"], ebitda_y2: ["EBITDA A2", "EBITDA Y2"], ebitda_y3: ["EBITDA A3", "EBITDA Y3"], discount_factor_y1: ["Facteur d'actualisation A1", "Discount factor Y1"], discount_factor_y5: ["Facteur d'actualisation A5", "Discount factor Y5"], capex_y1: ["Capex A1", "Capex Y1"], nwc_y1: ["BFR A1", "NWC Y1"],
  entry_ev: ["Valeur d'entreprise d'entrée", "Entry enterprise value"], entry_equity: ["Valeur des capitaux propres d'entrée", "Entry equity value"], sources_total: ["Total des sources", "Total sources"], uses_total: ["Total des emplois", "Total uses"], fcf_y1: ["Flux de trésorerie disponible A1", "Free cash flow Y1"], fcf_y2: ["Flux de trésorerie disponible A2", "Free cash flow Y2"], fcf_y3: ["Flux de trésorerie disponible A3", "Free cash flow Y3"], fcf_y4: ["Flux de trésorerie disponible A4", "Free cash flow Y4"], fcf_y5: ["Flux de trésorerie disponible A5", "Free cash flow Y5"],
  debt_y1: ["Dette A1", "Debt Y1"], debt_y2: ["Dette A2", "Debt Y2"], debt_y3: ["Dette A3", "Debt Y3"], debt_y4: ["Dette A4", "Debt Y4"], debt_y5: ["Dette A5", "Debt Y5"], exit_ev: ["Valeur d'entreprise de sortie", "Exit enterprise value"], exit_equity: ["Valeur des capitaux propres de sortie", "Exit equity value"], mom: ["Multiple de capital investi", "Money-on-money multiple"], irr: ["Taux de rentabilité interne", "Internal rate of return"],
  sponsor_equity: ["Fonds propres du sponsor", "Sponsor equity"], debt_paydown_y1: ["Remboursement de dette A1", "Debt paydown Y1"], interest_y1: ["Intérêts A1", "Interest Y1"], revolver_draw: ["Tirage de revolver", "Revolver draw"], pik_interest_y1: ["Intérêts PIK A1", "PIK interest Y1"], management_proceeds: ["Produit du management", "Management proceeds"],
  offer_price: ["Prix d'offre", "Offer price"], purchase_ev: ["Valeur d'acquisition", "Purchase enterprise value"], cash_funding: ["Financement en numéraire", "Cash funding"], debt_funding: ["Financement par dette", "Debt funding"], stock_funding: ["Financement en actions", "Stock funding"], new_shares: ["Nouvelles actions", "New shares"], pro_forma_net_income: ["Résultat net pro forma", "Pro forma net income"], pro_forma_eps: ["Bénéfice par action pro forma", "Pro forma earnings per share"], accretion_dilution_value: ["Accrétion / dilution par action", "Accretion / dilution per share"], accretion_dilution_pct: ["Accrétion / dilution (%)", "Accretion / dilution (%)"],
  buyer_eps: ["Bénéfice par action de l'acquéreur", "Buyer earnings per share"], synergy_after_tax: ["Synergies après impôt", "After-tax synergies"], fee_after_tax: ["Frais après impôt", "After-tax fees"], purchase_price_allocation: ["Allocation du prix d'acquisition", "Purchase price allocation"], integration_after_tax: ["Coûts d'intégration après impôt", "After-tax integration costs"], pro_forma_eps_y2: ["Bénéfice par action pro forma A2", "Pro forma earnings per share Y2"],
  terminal_value_multiple: ["Valeur terminale par multiple", "Terminal value by multiple"], comparable_value: ["Valeur issue des comparables", "Comparable valuation"],
  grid_wacc_high_growth_low: ["Grille : WACC haut / croissance basse", "Grid: high WACC / low growth"], grid_wacc_low_growth_high: ["Grille : WACC bas / croissance haute", "Grid: low WACC / high growth"], grid_wacc_high_multiple_low: ["Grille : WACC haut / multiple bas", "Grid: high WACC / low multiple"], grid_wacc_low_multiple_high: ["Grille : WACC bas / multiple haut", "Grid: low WACC / high multiple"],
  scenario_downside_ev: ["Valeur d'entreprise — scénario défavorable", "Enterprise value — downside scenario"], scenario_base_ev: ["Valeur d'entreprise — scénario central", "Enterprise value — base scenario"], scenario_upside_ev: ["Valeur d'entreprise — scénario favorable", "Enterprise value — upside scenario"],
  sponsor_bridge_entry_adjustment: ["Ajustement d'entrée du bridge sponsor", "Sponsor bridge entry adjustment"], value_creation_ebitda: ["Création de valeur — EBITDA", "Value creation — EBITDA"], value_creation_multiple: ["Création de valeur — multiple", "Value creation — multiple"], value_creation_deleveraging: ["Création de valeur — désendettement", "Value creation — deleveraging"], value_creation_cash: ["Création de valeur — trésorerie", "Value creation — cash"], value_creation_waterfall: ["Création de valeur — waterfall", "Value creation — waterfall"], ev_bridge_check: ["Contrôle du bridge de valeur d'entreprise", "Enterprise value bridge check"], sponsor_bridge_check: ["Contrôle du bridge sponsor", "Sponsor bridge check"],
  goodwill: ["Goodwill", "Goodwill"], ppa_step_up_value: ["Revalorisation PPA", "PPA step-up"], dtl_value: ["Passif d'impôt différé", "Deferred tax liability"], write_offs_value: ["Dépréciations", "Write-offs"], combined_assets: ["Actifs combinés", "Combined assets"], combined_liabilities: ["Passifs combinés", "Combined liabilities"], combined_equity: ["Capitaux propres combinés", "Combined equity"], combined_balance_check: ["Contrôle du bilan combiné", "Combined balance check"], synergy_npv: ["Valeur actuelle nette des synergies", "Synergy net present value"],
};

const caseInputLabels = {
  beta: ["Bêta", "Beta"], buyer_assets: ["Actifs de l'acquéreur", "Buyer assets"], buyer_cash: ["Trésorerie de l'acquéreur", "Buyer cash"], buyer_debt: ["Dette de l'acquéreur", "Buyer debt"], buyer_ebitda: ["EBITDA de l'acquéreur", "Buyer EBITDA"], buyer_equity: ["Capitaux propres de l'acquéreur", "Buyer equity"], buyer_growth: ["Croissance de l'acquéreur", "Buyer growth"], buyer_liabilities: ["Passifs de l'acquéreur", "Buyer liabilities"], buyer_net_income: ["Résultat net de l'acquéreur", "Buyer net income"], buyer_share_price: ["Cours de l'acquéreur", "Buyer share price"], buyer_shares: ["Actions de l'acquéreur", "Buyer shares"],
  call_premium: ["Prime de remboursement", "Call premium"], capex_pct: ["Capex en % du chiffre d'affaires", "CapEx as % of revenue"], cash: ["Trésorerie", "Cash"], cash_mix: ["Part financée en numéraire", "Cash mix"], cash_sweep: ["Part du cash affectée au remboursement", "Cash sweep"], cash_yield: ["Rendement de la trésorerie", "Cash yield"], comparable_beta: ["Bêta du comparable", "Comparable beta"], comparable_debt_pct: ["Dette cible du comparable", "Comparable debt percentage"], cost_of_debt: ["Coût de la dette", "Cost of debt"],
  da_pct: ["D&A en % du chiffre d'affaires", "D&A as % of revenue"], debt: ["Dette", "Debt"], debt_mix: ["Part financée par dette", "Debt mix"], debt_rate: ["Taux de la dette", "Debt rate"], downside_growth_delta: ["Écart de croissance défavorable", "Downside growth delta"], earnout: ["Complément de prix", "Earn-out"], ebitda: ["EBITDA", "EBITDA"], ebitda_growth: ["Croissance de l'EBITDA", "EBITDA growth"], ebitda_margin: ["Marge d'EBITDA", "EBITDA margin"], entry_multiple: ["Multiple d'entrée", "Entry multiple"], equity_risk_premium: ["Prime de risque actions", "Equity risk premium"], existing_debt: ["Dette existante", "Existing debt"], exit_multiple: ["Multiple de sortie", "Exit multiple"], fcf_margin: ["Marge de flux de trésorerie disponible", "Free cash flow margin"], fees: ["Frais", "Fees"], growth: ["Croissance", "Growth"],
  integration_cost_year: ["Année des coûts d'intégration", "Integration cost year"], integration_costs: ["Coûts d'intégration", "Integration costs"], junior_debt: ["Dette junior", "Junior debt"], junior_interest_rate: ["Taux de la dette junior", "Junior debt interest rate"], liquidity_shock: ["Choc de liquidité", "Liquidity shock"], management_hurdle: ["Seuil de rendement du management", "Management hurdle"], management_pool: ["Participation du management", "Management pool"], margin_expansion: ["Expansion de marge", "Margin expansion"], max_leverage: ["Levier maximal", "Maximum leverage"], mid_year_convention: ["Convention de milieu d'année", "Mid-year convention"], min_cash: ["Trésorerie minimale", "Minimum cash"], minimum_cash: ["Trésorerie minimale", "Minimum cash"], net_ppe: ["Immobilisations corporelles nettes", "Net PP&E"], nol: ["Déficits fiscaux reportables", "Net operating losses"], nwc_pct: ["BFR en % du chiffre d'affaires", "NWC as % of revenue"], other_assets: ["Autres actifs", "Other assets"], other_liabilities: ["Autres passifs", "Other liabilities"],
  pik_rate: ["Taux PIK", "PIK rate"], ppa_amortization_years: ["Durée d'amortissement PPA", "PPA amortization years"], ppa_step_up: ["Revalorisation PPA", "PPA step-up"], premium: ["Prime d'acquisition", "Acquisition premium"], revenue: ["Chiffre d'affaires", "Revenue"], revenue_growth: ["Croissance du chiffre d'affaires", "Revenue growth"], revolver_interest_rate: ["Taux du revolver", "Revolver interest rate"], revolver_limit: ["Plafond du revolver", "Revolver limit"], risk_free_rate: ["Taux sans risque", "Risk-free rate"], rollover: ["Réinvestissement des vendeurs", "Seller rollover"], scenario_margin_delta: ["Écart de marge du scénario", "Scenario margin delta"], scenario_revenue_growth_delta: ["Écart de croissance du scénario", "Scenario revenue growth delta"],
  segment_a_growth: ["Croissance du segment A", "Segment A growth"], segment_a_margin: ["Marge du segment A", "Segment A margin"], segment_a_revenue: ["Chiffre d'affaires du segment A", "Segment A revenue"], segment_b_growth: ["Croissance du segment B", "Segment B growth"], segment_b_margin: ["Marge du segment B", "Segment B margin"], segment_b_revenue: ["Chiffre d'affaires du segment B", "Segment B revenue"], senior_debt: ["Dette senior", "Senior debt"], senior_interest_rate: ["Taux de la dette senior", "Senior debt interest rate"], sensitivity_exit_multiple_delta: ["Écart de multiple de sortie", "Exit multiple sensitivity delta"], sensitivity_growth_delta: ["Écart de croissance terminale", "Terminal growth sensitivity delta"], sensitivity_multiple_delta: ["Écart de multiple terminal", "Terminal multiple sensitivity delta"], sensitivity_wacc_delta: ["Écart de WACC", "WACC sensitivity delta"], shares: ["Actions diluées", "Diluted shares"], stock_mix_floor: ["Part minimale financée en actions", "Minimum stock mix"], stub_year_fraction: ["Fraction d'année du stub", "Stub year fraction"], synergies: ["Synergies annuelles", "Annual synergies"], synergy_discount_rate: ["Taux d'actualisation des synergies", "Synergy discount rate"], synergy_horizon_years: ["Horizon des synergies", "Synergy horizon years"], synergy_ramp_years: ["Durée de montée en puissance des synergies", "Synergy ramp years"], synergy_year1_pct: ["Synergies réalisées en année 1", "Year 1 synergy realization"],
  target_assets: ["Actifs de la cible", "Target assets"], target_cash: ["Trésorerie de la cible", "Target cash"], target_debt: ["Dette de la cible", "Target debt"], target_debt_pct: ["Dette cible", "Target debt percentage"], target_equity: ["Capitaux propres de la cible", "Target equity"], target_growth: ["Croissance de la cible", "Target growth"], target_liabilities: ["Passifs de la cible", "Target liabilities"], target_net_income: ["Résultat net de la cible", "Target net income"], target_share_price: ["Cours de la cible", "Target share price"], target_shares: ["Actions de la cible", "Target shares"], tax_rate: ["Taux d'impôt", "Tax rate"], terminal_growth: ["Croissance terminale", "Terminal growth"], terminal_multiple: ["Multiple terminal", "Terminal multiple"], transaction_costs: ["Coûts de transaction", "Transaction costs"], upside_growth_delta: ["Écart de croissance favorable", "Upside growth delta"], wacc: ["WACC", "WACC"], write_offs: ["Dépréciations", "Write-offs"],
};

const caseYearOutputLabels = {
  ufcf: ["Flux de trésorerie disponible non endetté", "Unlevered free cash flow"], ebitda: ["EBITDA", "EBITDA"], fcf: ["Flux de trésorerie disponible", "Free cash flow"], debt: ["Dette", "Debt"], debt_paydown: ["Remboursement de dette", "Debt paydown"], interest: ["Intérêts", "Interest"], cash: ["Trésorerie", "Cash"], net_income: ["Résultat net", "Net income"], nwc: ["BFR", "NWC"], net_ppe: ["Immobilisations corporelles nettes", "Net PP&E"], other_assets: ["Autres actifs", "Other assets"], assets: ["Actifs", "Assets"], liabilities: ["Passifs", "Liabilities"], equity: ["Capitaux propres", "Equity"], balance_check: ["Contrôle du bilan", "Balance check"], discount_factor: ["Facteur d'actualisation", "Discount factor"], buyer_eps: ["Bénéfice par action de l'acquéreur", "Buyer earnings per share"], pro_forma_eps: ["Bénéfice par action pro forma", "Pro forma earnings per share"], accretion_dilution: ["Accrétion / dilution", "Accretion / dilution"],
};

const caseThemeLabels = { dcf: ["Évaluation DCF", "DCF valuation"], lbo: ["Modèle LBO", "LBO model"], "merger-model": ["Modèle de fusion", "Merger model"] };
const caseDifficultyLabels = { easy: ["Débutant", "Easy"], intermediate: ["Intermédiaire", "Intermediate"], advanced: ["Avancé", "Advanced"] };
const frenchCaseInstructions = {
  "dcf:easy": "Construisez le DCF à partir des données en millions de dollars et calculez toutes les sorties demandées.",
  "dcf:intermediate": "Construisez le DCF et le WACC. Si la convention de milieu d'année vaut 1, actualisez l'année n à la fraction du stub + n − 0,5 ; sinon à la fraction du stub + n. Croisez WACC haut avec croissance ou multiple bas, puis WACC bas avec croissance ou multiple haut.",
  "dcf:advanced": "Construisez le DCF par segment, le WACC, les deux valeurs terminales et les scénarios. Le scénario défavorable réduit les croissances des deux segments et retient WACC haut et croissance terminale basse ; le scénario favorable applique l'inverse. Désendettez puis réendettez le bêta comparable selon les ratios fournis.",
  "lbo:easy": "Construisez le LBO à partir des données en millions de dollars et calculez toutes les sorties demandées.",
  "lbo:intermediate": "Construisez le LBO et affectez la trésorerie au revolver, puis à la dette junior, puis à la dette senior. Ne tirez le revolver que pour restaurer la trésorerie minimale, dans sa limite, et appliquez le cash sweep à l'excédent. Le management reçoit sa quote-part de la valeur des capitaux propres à la sortie.",
  "lbo:advanced": "Construisez le LBO intégré et les scénarios. Appliquez la priorité revolver, dette junior, dette senior, la prime de remboursement et le cash sweep. Faites évoluer les trois états financiers avec les hypothèses publiées, puis attribuez les produits au management au-delà de son hurdle et répartissez le solde au prorata entre sponsor et rollover.",
  "merger-model:easy": "Construisez le modèle de fusion à partir des données en millions de dollars, sauf les données par action, et calculez toutes les sorties demandées.",
  "merger-model:intermediate": "Construisez le modèle de fusion. Plafonnez le numéraire à la trésorerie disponible et à la part minimale en actions, plafonnez la dette au mix annoncé, puis utilisez les actions comme solde. Déduisez les charges après impôt, les coûts de transaction et l'amortissement PPA du résultat net pro forma.",
  "merger-model:advanced": "Construisez le modèle pluriannuel et le bilan combiné. Appliquez aussi la contrainte de levier maximal. Calculez DTL, PPA et goodwill selon les hypothèses visibles. Faites monter les synergies linéairement, actualisez-les sur l'horizon fourni, déduisez les coûts d'intégration à l'année indiquée et comparez chaque BPA pro forma au BPA autonome de l'acquéreur.",
};

const pairs = [
  ["Accueil", "Home"],
  ["Nouvelle session", "New session"],
  ["Profil", "Profile"],
  ["Connexion", "Sign in"],
  ["Mon espace", "My account"],
  ["Commencer une session", "Start a session"],
  ["Préparation d'élite aux entretiens M&A", "Elite M&A Interview Prep"],
  ["Entraînez-vous comme les candidats qui arrivent prêts aux entretiens les plus exigeants.", "Train like the candidates who walk into top-tier interviews ready."],
  ["InterviewPlus transforme une base M&A unique en sessions chronometrees, corrections detaillees et suivi de progression par categorie. Un entrainement exigeant, structure, sans bruit inutile.", "InterviewPlus turns a unique M&A database into timed sessions, detailed feedback and category-based progress tracking. Focused, structured and demanding training."],
  ["Apercu session", "Session preview"],
  ["Expliquez-moi comment une analyse d'accrétion / dilution évolue après un financement par dette.", "Walk me through how an accretion / dilution analysis changes after debt financing."],
  ["Profondeur technique", "Technical depth"],
  ["Les blocs classiques d'un process M&A exigeant.", "The core areas of a demanding M&A interview process."],
  ["Technique", "Technical"],
  ["Comportemental / Fit", "Behavioral / Fit"],
  ["Processus de transaction", "Deal Process"],
  ["Marchés / Investissement", "Markets / Investing"],
  ["Questions sectorielles", "Industry Specific"],
  ["Logique / Créativité", "Brain Teaser / Creative"],
  ["Valorisation, DCF, LBO, comptabilité, passage EV / Equity Value.", "Valuation, DCF, LBO, accounting, EV / equity bridge."],
  ["Motivation, leadership, intérêt pour les transactions, communication.", "Motivation, leadership, deal interest, communication."],
  ["Sell-side, buy-side, exécution de transaction, due diligence.", "Sell-side, buy-side, transaction execution, diligence."],
  ["Vue de marché, jugement d'investissement, actualité.", "Market views, investment judgement, current events."],
  ["Logique sectorielle, modèles économiques, leviers stratégiques.", "Sector logic, business models, strategic drivers."],
  ["Market sizing, logique et créativité sous pression.", "Market sizing, logic, creativity under pressure."],
  ["Un entrainement court, net, mesurable.", "Short, focused and measurable training."],
  ["Choisir la session", "Choose the session"],
  ["Nombre de questions, theme cible ou tirage aleatoire, timer global.", "Number of questions, target topic or random draw, and an overall timer."],
  ["Repondre sous pression", "Answer under pressure"],
  ["Les questions s'enchainent sans correction immediate pour simuler un vrai entretien.", "Questions follow one another without immediate feedback to simulate a real interview."],
  ["Recevoir la correction", "Get feedback"],
  ["Score par question, reponse attendue, points forts, axes d'amelioration et manques.", "Score by question, expected answer, strengths, areas for improvement and missing points."],
  ["Suivre la progression", "Track progress"],
  ["Le profil montre les categories fortes et les zones a renforcer.", "Your profile highlights strong categories and areas to improve."],
  ["Construire une reponse banker-ready, etape par etape.", "Build a banker-ready answer, step by step."],
  ["Base technique", "Technical foundations"],
  ["Reprendre les fondamentaux valuation, accounting, deal mechanics.", "Review valuation, accounting and deal-mechanics fundamentals."],
  ["Sessions chronometrees", "Timed sessions"],
  ["Travailler la vitesse, la clarte et la priorisation sous timer.", "Improve speed, clarity and prioritisation under time pressure."],
  ["Corrections ciblees", "Targeted feedback"],
  ["Identifier les ecarts entre votre reponse et le standard attendu.", "Identify the gaps between your answer and the expected standard."],
  ["Progression par categorie", "Progress by category"],
  ["Concentrer les repetitions sur les themes qui font perdre des points.", "Focus repetitions on the topics that cost you points."],
  ["Des feedbacks rapides pour rendre chaque repetition utile.", "Fast feedback that makes every repetition useful."],
  ["\"Le timer force a repondre comme en entretien. J'ai enfin vu ou mes reponses manquaient de structure.\"", "\"The timer forces me to answer as I would in an interview. I finally saw where my answers lacked structure.\""],
  ["\"Les corrections par question m'ont aide a isoler mes faiblesses en DCF et accounting.\"", "\"Question-by-question feedback helped me isolate my weaknesses in DCF and accounting.\""],
  ["\"Le format est direct: question, reponse, score, correction. Exactement ce qu'il faut pour repeter.\"", "\"The format is direct: question, answer, score, feedback. Exactly what I need to practise.\""],
  ["Preparation M&A premium", "Premium M&A preparation"],
  ["Themes couverts", "Covered topics"],
  ["Fonctionnement", "How it works"],
  ["Retours candidats", "Candidate feedback"],
  ["Espace candidat", "Candidate area"],
  ["Retrouvez vos sessions et votre progression.", "Access your sessions and progress."],
  ["Connectez-vous pour reprendre l'entrainement, ou creez un compte en quelques secondes.", "Sign in to continue training, or create an account in seconds."],
  ["Mode invite", "Guest mode"],
  ["Essayer sans compte", "Try without an account"],
  ["Lancez une session immediatement. Vos resultats restent sauvegardes localement sur cet appareil.", "Start a session immediately. Your results remain saved locally on this device."],
  ["Continuer en invite", "Continue as guest"],
  ["Bon retour parmi nous", "Welcome back"],
  ["Mot de passe", "Password"],
  ["Afficher", "Show"],
  ["Masquer", "Hide"],
  ["Se connecter", "Sign in"],
  ["Mot de passe oublie ?", "Forgot password?"],
  ["Inscription", "Sign up"],
  ["Creer mon profil", "Create my profile"],
  ["Nom", "Name"],
  ["Confirmer le mot de passe", "Confirm password"],
  ["Minimum 8 caracteres, avec idealement chiffre et majuscule.", "At least 8 characters, ideally with a number and an uppercase letter."],
  ["Creer mon compte", "Create my account"],
  ["Parametres", "Settings"],
  ["Configurer la session", "Configure the session"],
  ["Choisissez seulement le nombre de questions, le theme et le timer.", "Choose the number of questions, topic and timer."],
  ["Nombre de questions", "Number of questions"],
  ["Langue des questions", "Question language"],
  ["Anglais", "English"],
  ["Francais", "French"],
  ["Theme", "Topic"],
  ["Chargement des themes...", "Loading topics..."],
  ["Lancer la session", "Start session"],
  ["Session en cours", "Session in progress"],
  ["Repondez aux questions avant la fin du compte a rebours.", "Answer the questions before time runs out."],
  ["Temps restant", "Time remaining"],
  ["Chargement de la session...", "Loading session..."],
  ["Votre reponse", "Your answer"],
  ["Question precedente", "Previous question"],
  ["Question suivante", "Next question"],
  ["Terminer maintenant", "Finish now"],
  ["Navigation", "Navigation"],
  ["Questions", "Questions"],
  ["Score global --", "Overall score --"],
  ["Historique", "History"],
  ["Vos sessions enregistrees", "Your saved sessions"],
  ["Retrouvez vos scores globaux et les derniers entrainements effectues.", "Review your overall scores and latest training sessions."],
  ["Correction detaillee", "Detailed feedback"],
  ["Resultats de la session", "Session results"],
  ["Liste", "List"],
  ["Dernieres sessions", "Latest sessions"],
  ["Votre progression", "Your progress"],
  ["Identifiez vos categories fortes et celles a retravailler.", "Identify your strongest categories and those to improve."],
  ["Points forts", "Strengths"],
  ["Categories ou vous excellez", "Categories where you excel"],
  ["Axes de travail", "Areas to improve"],
  ["Categories a renforcer", "Categories to strengthen"],
  ["Score moyen", "Average score"],
  ["Session active", "Active session"],
  ["Aucune", "None"],
  ["En cours", "In progress"],
  ["Correction", "Feedback"],
  ["Niveau", "Level"],
  ["Compte", "Account"],
  ["Se deconnecter", "Sign out"],
  ["Correctif attendu", "Expected answer"],
  ["Points manquants", "Missing points"],
  ["Axes d'amelioration", "Areas for improvement"],
  ["Correction locale gratuite", "Free local scoring"],
  ["Correction IA", "AI feedback"],
  ["Correction locale dégradée", "Degraded local feedback"],
  ["Correction numérique", "Numeric feedback"],
  ["Recorriger", "Regrade"],
  ["Recorrection...", "Regrading..."],
  ["Redigez votre reponse ici...", "Write your answer here..."],
  ["Votre mot de passe", "Your password"],
  ["Votre nom", "Your name"],
  ["Choisissez un mot de passe", "Choose a password"],
  ["Confirmez le mot de passe", "Confirm the password"],
  ["Cas pratiques", "Practical cases"],
  ["Construire un modèle sous pression", "Build a model under pressure"],
  ["S'entraîner sur des cas chronométrés développe les automatismes, la rigueur des calculs et la capacité à justifier une recommandation en entretien.", "Timed case practice develops fluency, calculation discipline and the ability to justify a recommendation in an interview."],
  ["Difficulté", "Difficulty"],
  ["Débutant", "Easy"],
  ["Intermédiaire", "Intermediate"],
  ["Avancé", "Advanced"],
  ["Lancer le cas pratique", "Start practical case"],
  ["Cas pratique en cours", "Practical case in progress"],
  ["Données du cas", "Case inputs"],
  ["Réponses", "Answers"],
  ["Calculs", "Calculations"],
  ["Recommandation", "Recommendation"],
  ["Valider et recevoir la correction", "Submit and get feedback"],
  ["Cas pratique", "Practical case"],
  ["Résultats du cas", "Case results"],
  ["Réussi", "Passed"],
  ["À retravailler", "To revisit"],
  ["Résultats", "Results"],
  ["Méthode", "Method"],
  ["Justification", "Justification"],
  ["Réponses détaillées", "Detailed answers"],
  ["Sortie", "Output"],
  ["Valeur attendue", "Expected value"],
  ["Points", "Points"],
  ["Retour", "Feedback"],
  ["Dans la tolérance", "Within tolerance"],
  ["Dans la tolérance élargie", "Within extended tolerance"],
  ["Hors tolérance", "Outside tolerance"],
  ["Retour sur la recommandation", "Recommendation feedback"],
  ["Refaire ce cas", "Start another case"],
  ["Modèle de fusion", "Merger model"],
];

const lookup = new Map();
pairs.forEach(([fr, en]) => {
  lookup.set(normalizeText(fr), { fr, en });
  lookup.set(normalizeText(en), { fr, en });
});

let uiLanguage = normalizeLanguage(localStorage.getItem(STORAGE_KEY) || navigator.language);
let applying = false;

export function getUiLanguage() {
  return uiLanguage;
}

export function setUiLanguage(language) {
  uiLanguage = normalizeLanguage(language);
  localStorage.setItem(STORAGE_KEY, uiLanguage);
  applyTranslations();
  document.dispatchEvent(new CustomEvent("interviewplus:languagechange", { detail: { language: uiLanguage } }));
}

export function t(fr, en = fr) {
  return uiLanguage === "en" ? en : fr;
}

export function caseOutputLabel(id, fallback = id) {
  const pair = caseOutputLabels[id];
  if (pair) return t(...pair);
  const year = String(id).match(/^(.+)_y([1-5])(?:_pct)?$/);
  const yearPair = year && caseYearOutputLabels[year[1]];
  if (yearPair) return `${t(...yearPair)} ${t("A", "Y")}${year[2]}${id.endsWith("_pct") ? " (%)" : ""}`;
  return fallback;
}

export function caseInputLabel(id, fallback = id) {
  const pair = caseInputLabels[id];
  return pair ? t(...pair) : fallback;
}

export function caseSessionTitle(theme, difficulty) {
  return `${t(...(caseThemeLabels[theme] || [theme, theme]))} | ${t(...(caseDifficultyLabels[difficulty] || [difficulty, difficulty]))}`;
}

export function caseSessionInstructions(theme, difficulty, englishFallback = "") {
  return t(frenchCaseInstructions[`${theme}:${difficulty}`] || englishFallback, englishFallback);
}

export function caseSectionLabel(id, fallback = id) {
  return id === "inputs" ? t("Données (millions USD, sauf données par action)", "Inputs (USD millions, except per-share data)") : fallback;
}

export function evaluationLabel(mode, translate = t) {
  if (mode === "openrouter") return translate("Correction IA", "AI feedback");
  if (mode === "local-degraded") return translate("Correction locale dégradée", "Degraded local feedback");
  if (mode === "deterministic") return translate("Correction numérique", "Numeric feedback");
  return translate("Correction locale gratuite", "Free local scoring");
}

export function applyTranslations(root = document) {
  if (applying) return;
  applying = true;
  document.documentElement.lang = uiLanguage;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue;
    const trimmed = value.trim();
    const pair = lookup.get(normalizeText(trimmed));
    if (pair) {
      const translated = `${value.slice(0, value.indexOf(trimmed))}${pair[uiLanguage]}${value.slice(value.indexOf(trimmed) + trimmed.length)}`;
      if (translated !== value) node.nodeValue = translated;
    }
    node = walker.nextNode();
  }
  root.querySelectorAll?.("[placeholder]").forEach((element) => {
    const pair = lookup.get(normalizeText(element.placeholder));
    if (pair && element.placeholder !== pair[uiLanguage]) element.placeholder = pair[uiLanguage];
  });
  const selector = document.getElementById("uiLanguage");
  if (selector) selector.value = uiLanguage;
  applying = false;
}

function injectLanguageSelector() {
  const nav = document.querySelector(".topnav");
  if (!nav || document.getElementById("uiLanguage")) return;
  const label = document.createElement("label");
  label.className = "language-switcher";
  label.setAttribute("aria-label", "Language / Langue");
  label.innerHTML = `
    <span class="sr-only">Language / Langue</span>
    <select id="uiLanguage">
      <option value="fr">FR</option>
      <option value="en">EN</option>
    </select>
  `;
  nav.append(label);
  label.querySelector("select").addEventListener("change", (event) => {
    setUiLanguage(event.target.value);
    window.location.reload();
  });
}

function normalizeLanguage(language) {
  return String(language || "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

injectLanguageSelector();
applyTranslations();

new MutationObserver(() => applyTranslations()).observe(document.body, {
  childList: true,
  subtree: true,
});
