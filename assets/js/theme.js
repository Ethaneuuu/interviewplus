import { t } from "./i18n.js";

const STORAGE_KEY = "ip-theme";

function currentTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / storage disabled: theme still applies for this page view
  }
}

function injectThemeToggle() {
  const bar = document.querySelector(".topbar");
  if (!bar || document.getElementById("themeToggle")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "themeToggle";
  button.className = "theme-toggle";
  button.setAttribute("aria-label", t("Basculer entre thème clair et sombre", "Toggle light and dark theme"));
  button.innerHTML = `
    <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
    <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.2a7 7 0 0 0 11 11.3Z"/></svg>
  `;
  document.addEventListener("interviewplus:languagechange", () => {
    button.setAttribute("aria-label", t("Basculer entre thème clair et sombre", "Toggle light and dark theme"));
  });
  button.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  bar.append(button);
}

injectThemeToggle();
