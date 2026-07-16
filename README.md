# InterviewPlus

Application web statique pour s'entrainer aux entretiens M&A avec :

- une base Excel unique embarquee dans le projet
- 1 741 questions et réponses disponibles en français et en anglais
- une interface FR/EN avec mémorisation de la langue choisie
- inscription / connexion utilisateur
- mode invite sans compte, avec sessions conservees localement
- sessions chronometrees
- correction sémantique locale et gratuite après le timer
- aucune clé API, aucun modèle externe et aucun coût par session
- historique partageable entre appareils via Supabase
- profil avec progression par categorie

## Parcours utilisateur

- [index.html](C:\Users\esmad\Documents\InterviewPlus\index.html) : accueil produit simple
- [auth.html](C:\Users\esmad\Documents\InterviewPlus\auth.html) : inscription / connexion
- [setup.html](C:\Users\esmad\Documents\InterviewPlus\setup.html) : choix du nombre de questions, du theme et du timer
- [session.html](C:\Users\esmad\Documents\InterviewPlus\session.html) : session active avec compte a rebours
- [results.html](C:\Users\esmad\Documents\InterviewPlus\results.html) : historique des sessions
- [profile.html](C:\Users\esmad\Documents\InterviewPlus\profile.html) : graphiques de progression

## Base de questions

- source utilisée par l'application : `Questions_InterviewPlus_Bilingual.xlsx`
- sauvegarde anglaise d'origine : `Questions_InterviewPlus.xlsx`
- guide du correcteur : `CORRECTION_LOCALE_GRATUITE.md`
- aucune importation de fichier par l'utilisateur
- la lecture du fichier se fait dans le navigateur via SheetJS
- le chargement utilise `EN_QA_FINAL` pour l'anglais et `FR_QR` pour le français
- les thèmes, sous-thèmes et réponses attendues sont filtrés dans la langue de la session

## Backend partage

Le projet supporte maintenant 3 modes :

- `local` : tout reste dans le navigateur
- `server` : authentification et sessions via la DB locale du serveur `serve-local.ps1`
- `supabase` : authentification et sessions synchronisees entre appareils

Le mode invite fonctionne sans compte dans les deux cas : les sessions sont conservees dans le navigateur de l'utilisateur et ne sont pas synchronisees.

En local, `backendMode: "server"` est active par defaut. La base est stockee dans `data/interviewplus-db.json` et creee automatiquement au lancement du serveur.

### Fichiers backend

- [assets/js/config.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\config.js) : configuration active
- [assets/js/config.example.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\config.example.js) : exemple de configuration Supabase
- [assets/js/backend.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\backend.js) : client backend
- [supabase/schema.sql](C:\Users\esmad\Documents\InterviewPlus\supabase\schema.sql) : schema SQL et policies RLS

## Activation de Supabase

1. Creez un projet Supabase.
2. Dans l'editor SQL de Supabase, executez [supabase/schema.sql](C:\Users\esmad\Documents\InterviewPlus\supabase\schema.sql).
3. Copiez [assets/js/config.example.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\config.example.js) vers `assets/js/config.js`.
4. Renseignez :
   - `supabaseUrl`
   - `supabaseAnonKey`
5. Passez `backendMode` a `"supabase"`.
6. Dans Supabase Auth, configurez votre `Site URL` et vos redirect URLs.

## Correction locale gratuite

La correction s'exécute directement dans le navigateur. Elle compare la réponse du candidat au corrigé à partir des concepts financiers, des points clés, des formules, de la structure et des contresens détectés.

- aucune réponse n'est envoyée à un fournisseur de modèle ;
- aucune clé API ou variable secrète n'est requise ;
- aucun abonnement et aucun coût par correction ;
- fonctionnement identique en français et en anglais ;
- publication possible sur un hébergement statique gratuit.

Le guide complet est disponible dans `CORRECTION_LOCALE_GRATUITE.md`.

### Lancement rapide sur macOS

Double-cliquez sur `start-local.command`. Le lanceur crée automatiquement une configuration locale au premier démarrage, attend que le serveur soit prêt, puis ouvre `http://localhost:4173/`.

La version fonctionnelle historique est servie à la racine. Le prototype React, conservé pour la future refonte visuelle, reste accessible sous `http://localhost:4173/modern/` après compilation de `Nouveau site`.

Test de non-regression du moteur, sans modifier la base des comptes :

```bash
node tests/engine-smoke.mjs
```

## Architecture front

- [assets/js/store.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\store.js) : logique metier et orchestration
- `assets/js/i18n.js` : interface bilingue, sélecteur FR/EN et traductions des parcours
- [assets/js/home.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\home.js) : accueil et acces au compte
- [assets/js/auth.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\auth.js) : inscription / connexion et retour vers la page demandee
- [assets/js/setup.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\setup.js) : configuration des sessions
- [assets/js/session.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\session.js) : timer, questions, correction
- [assets/js/results.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\results.js) : historique
- [assets/js/profile.js](C:\Users\esmad\Documents\InterviewPlus\assets\js\profile.js) : progression par categorie
- [assets/css/app.css](C:\Users\esmad\Documents\InterviewPlus\assets\css\app.css) : style global

## Deploiement

Le projet reste statique et deployable sur :

- Netlify via [netlify.toml](C:\Users\esmad\Documents\InterviewPlus\netlify.toml)
- Vercel via [vercel.json](C:\Users\esmad\Documents\InterviewPlus\vercel.json)
- GitHub Pages

Pour une publication GitHub Pages réservée à des utilisateurs précis, utiliser le mode Supabase privé décrit dans `ACCES_PRIVE_GITHUB_PAGES.md`. Dans ce mode, l'inscription et l'accès invité sont désactivés, et le classeur de questions reste dans un bucket privé.

## Limites actuelles

- le correcteur local est particulièrement adapté aux réponses techniques, mais moins fin pour les réponses comportementales très personnelles
- la base de questions reste servie par le front, pas depuis la base de donnees
