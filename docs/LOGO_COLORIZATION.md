# Colorisation du nouveau mark ("Ascending Dialogue")

Spec de travail pour reprendre la colorisation du logo plus tard. Source actuelle : `New logo/Ascending Dialogue-blueprint.png` (croquis blueprint, deux ailes de bandes diagonales miroir ; dossier non versionné, voir `.gitignore`). Pas encore de fichier vectoriel dans le dépôt — le mark existe pour l'instant uniquement sur l'outil externe où l'utilisateur l'édite.

## Combien de fichiers sont nécessaires

- **1 SVG inline** dans le HTML du site pour l'usage en page (header, etc.) — en l'insérant en inline (pas via `<img src="...">`), il peut lire les variables CSS du thème (`--accent`, `--primary`, `data-theme`) et bascule clair/sombre tout seul, sans JS ni second fichier. C'est la même technique déjà utilisée pour les icônes soleil/lune du bouton de thème (`assets/js/theme.js`).
- **+2 exports statiques (PNG/SVG figés), seulement si utilisé hors-page** : favicon, image OG/réseaux sociaux, icône PWA/app. Ces contextes ne peuvent pas lire les variables CSS du site, donc il faut y figer une version claire et une version sombre à l'export.

Piège déjà identifié dans le code existant : le wordmark actuel (`assets/img/interviewplus-logo.svg`) a ses couleurs figées en dur et ne bascule pas en dark mode — il garde le dégradé clair sur fond noir, où il devient terne. Ne pas répéter cette erreur sur le nouveau mark.

## Stratégie de couleur

Un seul dégradé linéaire diagonal continu sur l'ensemble du mark (les deux ailes comme un seul groupe), même angle que l'icône actuelle du wordmark (haut-gauche → bas-droite, ~30°). Pas de couleurs plates choisies bande par bande à la main — chaque bande capte une teinte différente du même dégradé, ce qui donne l'effet de profondeur sans virer au patchwork.

**Dégradé clair** (fond `--bg: #fafafa`) : `#4d7cff` → `#0052ff` → `#0041cc`
(= tokens `--accent → --primary → --primary-strong` en light theme, identique au dégradé `logoBlue` du wordmark existant)

**Dégradé sombre** (fond `--bg: #000000`) : `#a9c1ff` → `#8fb4ff` → `#6d93ff`
(= tokens `--primary-strong → --accent → --primary` en dark theme, réordonnés par luminosité réelle pour rester monotone clair→foncé — l'ordre alphabétique des tokens ne l'est pas)

Symétrique des deux côtés : même rampe sur l'aile gauche et l'aile droite.

### Fallback couleurs plates (si l'outil externe n'accepte pas un dégradé sur un groupe entier)

5 teintes échantillonnées sur les rampes ci-dessus, du haut de chaque aile vers le bas :

| Bande | Clair | Sombre |
|---|---|---|
| 1 (haut, près du sommet) | `#4d7cff` | `#a9c1ff` |
| 2 | `#2767ff` | `#9cbbff` |
| 3 (milieu) | `#0052ff` | `#8fb4ff` |
| 4 | `#004ae6` | `#7ea4ff` |
| 5 (bas, la plus longue) | `#0041cc` | `#6d93ff` |

Si la forme finale a plus ou moins de 5 bandes par aile, ré-échantillonner proportionnellement sur les mêmes rampes plutôt que de réutiliser ce tableau tel quel.

### Implémentation technique (une fois le SVG en main)

Ne pas mettre `stop-color="var(--accent)"` en attribut brut sur les `<stop>` — utiliser une classe + `<style>` interne au SVG :

```html
<style>
  .g0 { stop-color: var(--accent); }
  .g1 { stop-color: var(--primary); }
  .g2 { stop-color: var(--primary-strong); }
</style>
<linearGradient id="markBlue" x1="..." y1="..." x2="..." y2="...">
  <stop class="g0" offset="0"/>
  <stop class="g1" offset="0.5"/>
  <stop class="g2" offset="1"/>
</linearGradient>
```

Cela ne fonctionne que si le SVG est inline dans le HTML (pas chargé via `<img src>`).

## Checklist "rendre premium" (le blueprint actuel est jugé trop simple)

1. Ombre portée douce, comme sur l'icône du wordmark actuel : `dy 10px, blur 12px, flood-color #3B82F6, opacity 0.22`. Sans ça, les bandes en aplat lisent comme un pictogramme d'app, pas un logo de marque.
2. En dark mode, remplacer l'ombre portée par une lueur (`glow`) — une ombre ne se voit pas sur fond noir. Réutiliser le token déjà existant `rgba(109, 147, 255, 0.28)`.
3. Coins légèrement arrondis sur les extrémités des bandes (`stroke-linejoin: round` ou équivalent) — angles nets à 90° = bon marché ; arrondi subtil = soigné.
4. Épaisseur des bandes légèrement dégressive (plus épaisses à la base, plus fines vers la pointe) plutôt qu'une largeur uniforme — casse la monotonie mécanique, renforce le sens "ascendant".
5. Espacement entre bandes parfaitement régulier de bout en bout (les écarts semblent inégaux sur le blueprint actuel).
6. Pointe de convergence nette au centre entre les deux ailes, pas un bord plat coupé.

Explicitement écarté pour l'instant : effet highlight façon verre/métal — trop tape-à-l'œil pour le registre finance/M&A du produit. À reconsidérer seulement si le résultat reste terne après les 6 points ci-dessus.

## Prochaines étapes pour reprendre

1. Récupérer/exporter le SVG réel du mark depuis l'outil externe et le déposer dans `New logo/` (ou directement dans `assets/img/`).
2. Appliquer le dégradé + les 6 points premium ci-dessus dans cet outil ou directement dans le SVG.
3. Intégrer le SVG en inline dans `index.html` (remplacer/compléter le `<img class="brand-logo" ...>` actuel) avec le bloc `<style>` de dégradé théma­ble.
4. Vérifier au bouton de bascule thème (`themeToggle`) que le mark change bien de rampe de couleur en direct, en clair et en sombre.
5. Envisager de corriger au passage le wordmark existant (`assets/img/interviewplus-logo.svg`), qui a le même défaut de dégradé figé non-thémable — actuellement hors scope, mentionné ici comme dette identifiée.
