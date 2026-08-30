import {
  getCurrentUser,
  initializeApp,
} from "./store.js";
import { wireAuthNavLink } from "./nav.js";
import "./theme.js";
import "./mobile-nav.js";

const primarySessionLink = document.getElementById("primarySessionLink");
const finalCtaLink = document.getElementById("finalCtaLink");
const appConfig = window.INTERVIEWPLUS_CONFIG || {};

await initializeApp({ loadDataset: false });
renderHome();
animateHeroConsole();

function renderHome() {
  wireAuthNavLink();

  const target = getCurrentUser() || !appConfig.restrictedAccess
    ? "./new-session.html"
    : "./auth.html?returnTo=new-session.html";
  primarySessionLink.href = target;
  if (finalCtaLink) finalCtaLink.href = target;
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
