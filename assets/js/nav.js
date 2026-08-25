import { getCurrentUser, isGuestUser } from "./store.js";
import { t } from "./i18n.js";

export function wireAuthNavLink() {
  const authNavLink = document.getElementById("authNavLink");
  if (!authNavLink) return;
  const user = getCurrentUser();
  const authenticated = Boolean(user) && !isGuestUser(user);
  authNavLink.textContent = authenticated ? t("Mon espace", "My account") : t("Connexion", "Sign in");
  authNavLink.href = authenticated ? "./profile.html" : "./auth.html";
}
