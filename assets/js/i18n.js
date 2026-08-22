const STORAGE_KEY = "interviewplus-ui-language";

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
