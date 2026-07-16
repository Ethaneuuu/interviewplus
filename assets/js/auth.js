import {
  continueAsGuest,
  getCurrentUser,
  initializeApp,
  isGuestUser,
  loginUser,
  requestPasswordReset,
  registerUser,
} from "./store.js";
import { t } from "./i18n.js";

const message = document.getElementById("authMessage");
const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const guestButton = document.getElementById("guestButton");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const signupPassword = document.getElementById("signupPassword");
const passwordMeter = document.getElementById("passwordMeter");
const passwordHint = document.getElementById("passwordHint");
const destination = getReturnDestination();
const appConfig = window.INTERVIEWPLUS_CONFIG || {};
const restrictedAccess = appConfig.restrictedAccess === true;

await initializeApp();

const activeUser = getCurrentUser();
if (activeUser && !isGuestUser(activeUser)) {
  redirectAfterAuth();
}
configureAccessMode();
bindPasswordToggles();
signupPassword?.addEventListener("input", renderPasswordStrength);
guestButton?.addEventListener("click", handleGuest);
loginButton.addEventListener("click", handleLogin);
signupButton?.addEventListener("click", handleSignup);
forgotPasswordButton.addEventListener("click", handlePasswordReset);

function configureAccessMode() {
  const guestAllowed = !restrictedAccess && appConfig.allowGuestAccess !== false;
  const signupAllowed = !restrictedAccess && appConfig.allowPublicSignup !== false;
  document.getElementById("guestCard")?.classList.toggle("hidden", !guestAllowed);
  document.getElementById("signupCard")?.classList.toggle("hidden", !signupAllowed);
  document.querySelector(".auth-grid")?.classList.toggle("restricted-auth-grid", restrictedAccess);
  if (restrictedAccess) {
    document.getElementById("authIntro").textContent = t(
      "Cet espace est privé. Utilisez les identifiants transmis par l'administrateur.",
      "This is a private area. Use the credentials provided by the administrator."
    );
  }
}

async function handleGuest() {
  await withLoading(guestButton, t("Ouverture...", "Opening..."), async () => {
    await continueAsGuest();
    redirectAfterAuth();
  });
}

async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!isValidEmail(email) || !password.trim()) {
    showMessage(t("Renseignez un email valide et votre mot de passe.", "Enter a valid email address and your password."), "error");
    return;
  }

  await withLoading(loginButton, t("Connexion...", "Signing in..."), async () => {
    await loginUser({
      email,
      password,
    });
    redirectAfterAuth();
  }, t("Email ou mot de passe incorrect.", "Incorrect email or password."));
}

async function handleSignup() {
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirmation = document.getElementById("signupPasswordConfirm").value;

  if (!name || !isValidEmail(email)) {
    showMessage(t("Ajoutez votre nom et un email valide.", "Enter your name and a valid email address."), "error");
    return;
  }
  if (scorePassword(password) < 2) {
    showMessage(t("Choisissez un mot de passe plus solide : 8 caractères minimum, idéalement un chiffre et une majuscule.", "Choose a stronger password: at least 8 characters, ideally with a number and an uppercase letter."), "error");
    return;
  }
  if (password !== confirmation) {
    showMessage(t("Les deux mots de passe ne correspondent pas.", "The passwords do not match."), "error");
    return;
  }

  await withLoading(signupButton, t("Création...", "Creating..."), async () => {
    const result = await registerUser({
      name,
      email,
      password,
    });

    if (result.needsEmailConfirmation) {
      showMessage(t("Compte créé. Confirmez votre email avant de vous connecter.", "Account created. Confirm your email before signing in."), "success");
      return;
    }

    redirectAfterAuth();
  }, t("Impossible de créer le compte. Vérifiez les champs ou utilisez un autre email.", "Unable to create the account. Check the fields or use another email address."));
}

async function handlePasswordReset() {
  const email = document.getElementById("loginEmail").value.trim();
  if (!isValidEmail(email)) {
    showMessage(t("Entrez d'abord votre email dans le champ connexion.", "Enter your email in the sign-in field first."), "error");
    return;
  }

  await withLoading(forgotPasswordButton, t("Envoi...", "Sending..."), async () => {
    await requestPasswordReset(email);
    showMessage(t("Email de réinitialisation envoyé si ce compte existe.", "A reset email was sent if this account exists."), "success");
  }, t("La réinitialisation est disponible une fois Supabase activé. En mode local, recréez un compte de test.", "Password reset is available once Supabase is enabled. In local mode, create a new test account."));
}

function redirectAfterAuth() {
  window.location.href = `./${destination}`;
}

function getReturnDestination() {
  const requested = new URLSearchParams(window.location.search).get("returnTo");
  const allowedPages = new Set(["setup.html", "session.html", "results.html", "profile.html"]);
  return allowedPages.has(requested) ? requested : "setup.html";
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.textContent = isHidden ? t("Masquer", "Hide") : t("Afficher", "Show");
    });
  });
}

function renderPasswordStrength() {
  const score = scorePassword(signupPassword.value);
  passwordMeter.dataset.score = String(score);
  passwordHint.textContent = [
    t("Minimum 8 caractères, avec idéalement un chiffre et une majuscule.", "At least 8 characters, ideally with a number and an uppercase letter."),
    t("Correct, mais ajoutez un chiffre ou une majuscule pour renforcer.", "Fair, but add a number or uppercase letter to strengthen it."),
    t("Bon mot de passe pour un compte candidat.", "Good password for a candidate account."),
    t("Très bon niveau de sécurité.", "Very strong security level."),
  ][score];
}

function scorePassword(password) {
  const value = String(password || "");
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 3);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function showMessage(text, tone) {
  message.textContent = text;
  message.dataset.tone = tone;
}

async function withLoading(button, loadingText, action, errorText) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;
  try {
    await action();
  } catch (error) {
    if (errorText) showMessage(errorText, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}
