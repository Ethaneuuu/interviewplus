# Accès privé pour InterviewPlus

## Principe

GitHub Pages héberge l'interface statique. Supabase fournit gratuitement l'authentification, la sauvegarde des sessions et le stockage privé du classeur de questions.

La version privée applique les règles suivantes :

- inscription possible uniquement pour les adresses présentes dans `authorized_users` ;
- aucun mode invité ;
- seuls les comptes créés par l'administrateur peuvent se connecter ;
- chaque utilisateur possède son propre email et son propre mot de passe ;
- les pages de session, résultats et profil refusent les visiteurs non connectés ;
- le classeur de questions n'est pas publié dans le dépôt GitHub ;
- le classeur est téléchargé depuis un bucket Supabase privé après authentification.

## Configuration Supabase

1. Créer un projet gratuit sur Supabase.
2. Exécuter `supabase/schema.sql` dans l'éditeur SQL.
3. Ouvrir Storage, puis le bucket privé `interviewplus-private`.
4. Importer `Questions_InterviewPlus_Bilingual.xlsx` à la racine du bucket.
5. Dans Authentication > Providers > Email, activer `Allow new users to sign up`.
6. Dans Authentication > Hooks, activer `Before User Created` avec la fonction Postgres `hook_restrict_signup_to_authorized`.
7. Ajouter chaque adresse autorisée dans `Table Editor > authorized_users`.
8. La personne peut ensuite créer elle-même son compte et son mot de passe sur InterviewPlus.
9. Copier l'URL du projet et la clé publique `anon` dans `assets/js/config.js`.
10. Appliquer cette configuration :

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

## Ajouter ou retirer une personne

- Ajouter : créer son entrée dans `authorized_users`, puis lui demander de s'inscrire sur InterviewPlus.
- Retirer : passer `active` à `false` dans `authorized_users`, puis bannir l'utilisateur dans Authentication > Users.
- Réinitialiser son mot de passe : envoyer une récupération depuis Supabase ou utiliser le bouton prévu sur la page de connexion.

## Vérification avant publication

1. Ouvrir le site dans une fenêtre privée.
2. Vérifier que `setup.html`, `session.html`, `results.html` et `profile.html` renvoient vers la connexion.
3. Vérifier que le mode invité et le formulaire d'inscription sont absents.
4. Tester un compte autorisé.
5. Tester une adresse non créée : la connexion doit échouer.
6. Vérifier que l'URL GitHub du classeur retourne 404.
