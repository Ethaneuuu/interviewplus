# Accès privé pour InterviewPlus

## Principe

Netlify héberge l'interface statique (`scripts/build-static.mjs` → `dist/`, 34 fichiers publics) et exécute la Function serveur `/api/correct`. Supabase fournit l'authentification, la sauvegarde des sessions et le stockage privé du classeur de questions.

La version privée applique les règles suivantes :

- inscription libre (n'importe quelle adresse peut créer un compte), mais l'accès reste bloqué tant que l'administrateur ne l'a pas activé ;
- à l'inscription, un déclencheur SQL (`handle_new_user`) crée automatiquement une ligne `authorized_users` avec `active = false` pour l'adresse (en minuscules), sauf si l'admin l'avait déjà ajoutée à l'avance ;
- l'administrateur active un compte en passant `active` à `true` sur la ligne correspondante dans `Table Editor > authorized_users` ; aucune interface d'administration n'existe dans l'app, ce tableau Supabase EST l'outil d'approbation ;
- aucun mode invité ;
- chaque utilisateur possède son propre email et son propre mot de passe ;
- les pages de session, résultats et profil refusent les visiteurs non connectés ou non activés ;
- le classeur de questions n'est pas publié dans le dépôt Git ni dans `dist/` ;
- le classeur est téléchargé depuis un bucket Supabase privé après authentification ;
- `/api/correct` exige un Bearer JWT Supabase valide et un compte actif dans `authorized_users` (voir `docs/PROJECT.md`).

## Configuration Supabase

1. Créer un projet gratuit sur Supabase.
2. Exécuter `supabase/schema.sql` dans l'éditeur SQL.
3. Ouvrir Storage, puis le bucket privé `interviewplus-private`.
4. Importer `Questions_InterviewPlus_Bilingual.xlsx` à la racine du bucket.
5. Dans Authentication > Providers > Email, activer `Allow new users to sign up`.
6. La personne crée elle-même son compte et son mot de passe sur InterviewPlus ; une ligne `authorized_users` est créée automatiquement avec `active = false`. Dans `Table Editor > authorized_users`, passer sa ligne à `active = true` pour l'activer. (Optionnel : ajouter l'adresse à l'avance dans ce même tableau avec `active = true` pour l'activer dès l'inscription, sans attendre.)
7. Copier l'URL du projet et la clé publique `anon` dans `assets/js/config.js`.
8. Appliquer cette configuration :

```js
window.INTERVIEWPLUS_CONFIG = {
  backendMode: "supabase",
  supabaseUrl: "https://VOTRE-PROJET.supabase.co",
  supabaseAnonKey: "VOTRE_CLE_PUBLIQUE_ANON",
  restrictedAccess: true,
  allowPublicSignup: true,
  allowGuestAccess: false,
  privateQuestionBucket: "interviewplus-private",
  privateQuestionPath: "Questions_InterviewPlus_Bilingual.xlsx",
};
```

La clé `anon` est conçue pour être publique. La sécurité repose sur l'authentification et les règles RLS du fichier `supabase/schema.sql`. Ne jamais placer la clé `service_role` dans le site.

Une personne peut créer un compte Auth librement puisque les inscriptions Supabase sont ouvertes ; le déclencheur `handle_new_user` lui crée automatiquement une ligne `authorized_users` avec `active = false`. Tant que l'administrateur ne passe pas cette ligne à `active = true`, elle est déconnectée après authentification et les règles RLS lui interdisent le classeur, les sessions et les profils.

## Configuration Netlify

En plus de `assets/js/config.js` (clés publiques ci-dessus), la Function `/api/correct` a besoin de trois variables **serveur**, à définir dans Netlify (Site configuration > Environment variables), jamais dans un fichier du dépôt :

```text
SUPABASE_URL=https://VOTRE-PROJET.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<clé service-role, jamais publique>
OPENROUTER_API_KEY=<clé OpenRouter, jamais publique>
```

Le reste des réglages (`CORRECTION_*`, `OPENROUTER_*`, timeouts, limites) a des valeurs par défaut documentées dans `docs/PROJECT.md`. Netlify build/déploie automatiquement `dist/` à chaque push sur `main` (`netlify.toml` pilote la commande et la publication).

## Approuver, ajouter ou retirer une personne

- Approuver une inscription : dans `Table Editor > authorized_users`, repérer la ligne (créée automatiquement, `active = false`) et passer `active` à `true`.
- Pré-approuver avant même l'inscription : créer directement son entrée dans `authorized_users` avec `active = true`, puis lui demander de s'inscrire.
- Retirer : passer `active` à `false` dans `authorized_users`, puis bannir l'utilisateur dans Authentication > Users.
- Réinitialiser son mot de passe : envoyer une récupération depuis Supabase ou utiliser le bouton prévu sur la page de connexion.

## Vérification avant publication

1. Ouvrir le site dans une fenêtre privée.
2. Vérifier que `setup.html`, `session.html`, `results.html`, `profile.html`, `case-setup.html` et `case-session.html` renvoient vers la connexion.
3. Vérifier que le mode invité est absent et que le formulaire d'inscription est présent (inscription ouverte, activation manuelle).
4. Tester un compte autorisé.
5. Tester une adresse non créée : la connexion doit échouer.
6. Vérifier que le classeur (`Questions_InterviewPlus_Bilingual.xlsx`) et le code serveur (`netlify/functions/**`, `docs/`, `tests/`) renvoient 404 sur le domaine Netlify — seuls les 34 fichiers de `dist/` doivent être servis.
7. Vérifier qu'une requête anonyme sur `/api/correct` renvoie `401 AUTH_REQUIRED`, pas `404` (sinon la Function ne tourne pas).
