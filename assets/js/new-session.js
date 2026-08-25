import { continueAsGuest, getCurrentUser, initializeApp, requireAuthorizedAccess } from "./store.js";
import { wireAuthNavLink } from "./nav.js";
import "./theme.js";
import "./mobile-nav.js";

await initializeApp({ loadDataset: false });
requireAuthorizedAccess("new-session.html");

if (!getCurrentUser()) {
  await continueAsGuest();
}

wireAuthNavLink();
