import { getCurrentUser, isGuestUser } from "./store.js";
import { t } from "./i18n.js";

// The auth link ships hidden so no page ever paints "Connexion" for a signed-in
// user (or vice versa) while auth resolves. It is revealed only once resolved.
export function wireAuthNavLink() {
  const authNavLink = document.getElementById("authNavLink");
  if (!authNavLink) return;
  const user = getCurrentUser();
  const authenticated = Boolean(user) && !isGuestUser(user);
  authNavLink.textContent = authenticated ? t("Mon espace", "My account") : t("Connexion", "Sign in");
  authNavLink.href = authenticated ? "./profile.html" : "./auth.html";
  authNavLink.hidden = false;
}
