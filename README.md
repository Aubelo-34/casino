# Roulette Casino

Jeu de roulette interactif en HTML / CSS / JavaScript, sans dépendance ni build.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Fonctionnement

- Roue américaine à 38 cases (0, 00, 1 à 36) dessinée en canvas, dans l'ordre réel des numéros.
- Un clic sur « Lancer la roulette » (ou la barre d'espace) fait tourner la roue dans un sens
  et la bille dans l'autre. La bille ralentit, descend de la piste, rebondit puis se pose
  dans une alvéole et suit la roue jusqu'à l'arrêt.
- Le numéro gagnant est tiré avec `crypto.getRandomValues` (tirage uniforme sur les 38 cases),
  puis l'animation est calculée pour s'arrêter exactement sur cette case.
- Le résultat affiche la couleur, pair/impair, manque/passe, douzaine et colonne.
- Historique des 12 derniers tirages et tic sonore de la bille (désactivable).

## Fichiers

- `index.html` : structure de la page.
- `style.css` : tapis vert, bouton, panneau de résultat, historique.
- `roulette.js` : dessin de la roue, animation, tirage, affichage du résultat.

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` publie le site à chaque push.
Dans les réglages du dépôt, onglet **Pages**, choisir la source **GitHub Actions**.
Le site est alors servi à l'adresse `https://aubelo-34.github.io/casino/`.
