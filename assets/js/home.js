import {
  getCurrentUser,
  initializeApp,
  isGuestUser,
} from "./store.js";
import { t } from "./i18n.js";
import { wireAuthNavLink } from "./nav.js";
import "./theme.js";
import "./mobile-nav.js";

const navCasePratiques = document.getElementById("navCasePratiques");
const navProfil = document.getElementById("navProfil");
const primarySessionLink = document.getElementById("primarySessionLink");
const finalCtaLink = document.getElementById("finalCtaLink");
const heroAccountNote = document.getElementById("heroAccountNote");
const appConfig = window.INTERVIEWPLUS_CONFIG || {};

const bootstrap = await initializeApp({ loadDataset: false });
renderHome(bootstrap.backendMode);
animateHeroConsole();

function renderHome(backendMode) {
  const user = getCurrentUser();
  const authenticated = Boolean(user) && !isGuestUser(user);
  navCasePratiques.classList.toggle("hidden", !authenticated);
  navProfil.classList.toggle("hidden", !authenticated);
  wireAuthNavLink();

  if (user) {
    primarySessionLink.href = "./setup.html";
    if (finalCtaLink) finalCtaLink.href = "./setup.html";
    heroAccountNote.textContent = isGuestUser(user)
      ? t("Mode invité actif : sessions conservées sur cet appareil.", "Guest mode active: sessions are stored on this device.")
      : `${escapeHtml(user.name)} | ${backendMode === "supabase" ? t("compte synchronisé", "synced account") : t("mode local", "local mode")}`;
    return;
  }

  primarySessionLink.href = appConfig.restrictedAccess ? "./auth.html?returnTo=setup.html" : "./setup.html";
  if (finalCtaLink) finalCtaLink.href = primarySessionLink.href;
  heroAccountNote.textContent = appConfig.restrictedAccess
    ? t("Accès réservé aux personnes autorisées.", "Access is limited to authorized users.")
    : t(
      "Utilisable sans compte. Créez un compte pour synchroniser vos sessions.",
      "Usable without an account. Create one to sync your sessions."
    );
}

function animateHeroConsole() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bars = [...document.querySelectorAll(".console-bars > div")];
  const question = document.querySelector(".console-question p");
  if (reduceMotion || !bars.length) return;

  let active = 0;
  bars[active].classList.add("is-active");
  setInterval(() => {
    bars[active].classList.remove("is-active");
    active = (active + 1) % bars.length;
    bars[active].classList.add("is-active");
  }, 1800);

  if (question) {
    const fullText = question.textContent;
    question.textContent = "";
    question.classList.add("is-typing");
    let i = 0;
    const typer = setInterval(() => {
      i += 1;
      question.textContent = fullText.slice(0, i);
      if (i >= fullText.length) {
        clearInterval(typer);
        question.classList.remove("is-typing");
      }
    }, 28);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
