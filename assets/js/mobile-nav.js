import { t } from "./i18n.js";

function injectNavToggle() {
  const bar = document.querySelector(".topbar");
  const nav = document.querySelector(".topnav");
  if (!bar || !nav || document.getElementById("navToggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "navToggle";
  button.className = "nav-toggle";
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = `
    <svg class="icon-burger" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    <svg class="icon-close" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
  `;

  function labelFor(open) {
    return open ? t("Fermer le menu", "Close menu") : t("Ouvrir le menu", "Open menu");
  }

  function closeNav() {
    bar.classList.remove("nav-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", labelFor(false));
  }

  button.setAttribute("aria-label", labelFor(false));
  document.addEventListener("interviewplus:languagechange", () => {
    button.setAttribute("aria-label", labelFor(bar.classList.contains("nav-open")));
  });

  button.addEventListener("click", () => {
    const open = bar.classList.toggle("nav-open");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", labelFor(open));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNav();
  });

  document.addEventListener("click", (event) => {
    if (bar.classList.contains("nav-open") && !bar.contains(event.target)) closeNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav();
  });

  bar.appendChild(button);
}

injectNavToggle();
