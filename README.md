# ENSAMAP

Une petite application web pour retrouver ses repères sur le campus de l’ENSAM Rabat.
Python + Flask côté serveur ; HTML, CSS et JavaScript côté navigateur.
Pas de base de données, de compte utilisateur, de framework JavaScript ou de compilation.

Pour apprendre le code : ouvrir `COMPRENDRE_LE_CODE.md`. Il suit chaque fichier,
explique les fonctions et contient des exercices et des questions de présentation.

## Démarrer

Avec Python 3.9 ou plus récent, ouvrez un terminal dans ce dossier :

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Puis ouvrez **http://127.0.0.1:5000**. Pour arrêter le serveur : `Ctrl+C`.
Sur Windows, remplacez la deuxième commande par `.venv\Scripts\activate`.
Sur cet ordinateur, l’environnement et Flask sont déjà installés : `.venv/bin/python app.py` suffit.
Si le port 5000 est occupé, changez `port=5000` à la fin de `app.py` et ouvrez le nouveau port.

## Ce qui fonctionne

- Plan détaillé en plein écran, déplacement avec inertie, zoom fluide et recentrage animé.
- Fermer une fiche avec × ou Échap ramène progressivement à la vue du campus.
- Recherche, filtres et ouverture/repli du panneau recentrent le plan dans l’espace visible. Un lieu sélectionné reste au centre de cet espace.
- Version mobile : les fonds WebP totalisent environ 500 Ko au lieu de environ 6 Mo de PNG. Les effets de gris et les masques sont précalculés ; le navigateur ne les recalcule plus pendant le déplacement. Les fonds sont mis en cache et le déplacement est dessiné une fois par image.
- Le dézoom s’arrête à la vue du campus entier, avec le bouton, la molette et le pincement.
- L’illustration s’étend au-delà de son ancien cadre : les environs ajoutés sont un décor imaginé. Le plan original reste au-dessus pour conserver les contours cliquables. Seule la parcelle ENSAM reste en couleur ; les environs et les deux parcelles voisines sont grisées.
- Fiches et résultats animés et panneau mobile qui se déploie. Les lieux n’ont aucun point ou bouton rouge sur le plan.
- Survol limité aux contours des bâtiments : rouge à 40 % d’opacité (60 % transparent), sans bordure. Les noms n’agrandissent pas la zone de survol. La buvette exclut ses deux petits espaces ADE et toilettes, qui restent cliquables séparément.
- Les animations respectent le réglage système « Réduire les animations ».
- Bouton de rotation par quarts de tour : le plan, les noms d’avenues et les zones cliquables tournent ensemble. Les noms des lieux interactifs restent lisibles à l’horizontale.
- Recherche traitée par Python, avec prise en charge des accents.
- Filtres par catégorie : études, administration, internats, services, entrées et sport.
- Bouton « Afficher ma position » : point bleu, cercle de précision GPS, recentrage et suivi des déplacements. Appuyer de nouveau pour recentrer ; × arrête la localisation. La position reste dans le navigateur, sans stockage ni envoi à Flask. Le lien HTTPS est nécessaire sur téléphone.
- Chaque mise à jour GPS vérifie la limite ENSAM et signale une position hors campus. Près de la limite, ou si la précision GPS est insuffisante, la présence est indiquée comme incertaine. Les deux parcelles voisines et le terrain de gauche sont exclus.
- Données GeoJSON et coordonnées géographiques approximatives, utilisées pour les contours et la localisation. Export technique accessible par l’API.
- 23 lieux renseignés avec les annotations de l’étudiant, dont les quatre amphis, les buvettes et les toilettes.
- Recherche par nom ou alias : `amphi1`, `wc`, `mosquee`, `profs`, etc.
- Fiches accessibles depuis la liste ou le plan ; navigation au clavier.
- Recherche flottante, catégories et fiche d’un lieu directement au-dessus du plan.
- Seules les deux entrées gardent leur nom visible ; les autres noms apparaissent au survol, au focus clavier ou à la sélection. Panneau inférieur repliable sur téléphone.

La carte garde les limites corrigées, les parcelles voisines grisées, le terrain ENSAM sans séparation intérieure et la route dégagée près du voisin au sud-ouest. Les trois bâtiments au nord-est, le compound au sud-ouest et le terrain de gauche sont exclus des lieux interactifs.

## Les fichiers à comprendre

| Fichier | Rôle |
| --- | --- |
| `app.py` | Quatre routes Flask : page, recherche, fiche et export GeoJSON. |
| `data.py` | Lecture GeoJSON, conversion des coordonnées et recherche dans une liste de dictionnaires. |
| `COMPRENDRE_LE_CODE.md` | Explication complète du projet et exercices pour apprendre à le modifier. |
| `data/campus-boundary.geojson` | Limite ENSAM corrigée, avec les deux parcelles voisines exclues. |
| `data/campus.geojson` | Source des 23 lieux : géométries et informations. |
| `GEOJSON.md` | Alignement géographique, export et modifications. |
| `tests/test_location.cjs` | Tests du GPS avec des positions simulées, sans nouvelle dépendance. |
| `tests/test_geojson.py` | Vérifications de la conversion et de l’export. |
| `templates/index.html` | Structure de la page et zones cliquables du plan. |
| `static/style.css` | Couleurs, disposition et adaptation au téléphone. |
| `static/app.js` | Interactions dans le navigateur. |
| `static/campus-map-enhanced.png` | Illustration de référence (1420 × 1108), conservée ; le navigateur charge les WebP. |
| `static/campus-layer-v1.webp` | Plan précalculé léger, avec les couleurs ENSAM et les voisins gris. |
| `static/campus-context-v1.webp` | Décor extérieur gris précalculé. |
| `static/neighborhood-v1.webp` | Petite tuile grise couvrant les bords éloignés. |
| `static/campus-surroundings-v1.png` | Environs illustrés générés pour prolonger le fond et éviter les marges vides. |
| `static/campus-map.png` | Illustration précédente, conservée comme référence. |
| `static/logo.svg` | Reproduction vectorielle des trois plis fournis. |
| `static/logo-lockup.svg` | Trois plis et lettres angulaires redessinées d’après le mot-symbole fourni. |

## Ajouter les annotations

Dans `data/campus.geojson`, cherchez le `id` du lieu, par exemple `B05`.
Changez `name`, `description` et éventuellement `category` dans son dictionnaire `properties`.
Gardez l’identifiant : il relie la fiche à son emplacement. Redémarrez le serveur après une modification du fichier, qui est chargé au démarrage.

Les géométries utilisent `[longitude, latitude]`. Python reconvertit leurs sommets en pixels pour garder les mêmes contours sur l’illustration. Les détails et un exemple de conversion sont dans `GEOJSON.md`.

Les 23 lieux sont ceux annotés par l’étudiant et les deux entrées. Les anciennes zones B06, B07, B08 et B18 sont retirées de la liste, de la recherche et des zones cliquables. Les bâtiments non annotés restent pâles dans le fond. L’internat des garçons regroupe uniquement les pavillons marqués ; le long bâtiment diagonal est exclu. Les identifiants internes ne sont pas des numéros officiels. Les contours sont tracés sur l’illustration et restent approximatifs. L’application tourne localement ; un tunnel ngrok peut la rendre accessible temporairement tant que cet ordinateur et le serveur restent actifs.

Le petit bâtiment des toilettes des amphis, masqué par les arbres sur la référence, est intégré au fond WebP précalculé à l’emplacement du rectangle rouge fourni. Seuls les noms des deux entrées sont permanents ; les autres apparaissent au survol ou à la sélection. Le tableau de correspondance est dans `ANNOTATIONS.md`.

Le plan s’ouvre à 180° pour placer l’entrée principale en bas. L’image et les zones cliquables pivotent ensemble ; les noms des avenues sont du texte vectoriel et restent lisibles. L’amélioration de l’illustration a conservé ses dimensions de 1420 × 1108 pixels : elle n’ajoute pas de précision géographique. Le GeoJSON est aligné approximativement à partir de trois repères Google Maps ; ce n’est pas un relevé topographique.

## Avant dimanche

1. Tester la localisation dehors aux deux entrées et à plusieurs repères, puis vérifier les petits contours autour de la buvette sur place.
2. Comparer le petit code Python avec les notions réellement vues en cours, en particulier l’autorisation d’utiliser Flask.
3. Faire tester recherche et sélection par un autre étudiant.
4. Répéter la démonstration et l’explication du code avec `PRESENTATION.md`.

Le calcul d’itinéraires n’est pas encore implémenté. Il demande les portes et chemins praticables confirmés ; un itinéraire déduit uniquement de l’illustration serait peu fiable. Une recherche de salles demandera aussi la liste des salles et leur bâtiment.

Tests GeoJSON : `.venv/bin/python -m unittest discover -s tests -v`. Tests navigateur simulés : `node tests/test_location.cjs` (Node est seulement un outil de test, le serveur reste Python).

Validation effectuée : réponses de la page et des fichiers statiques, recherche sans accents, combinaison recherche/catégorie, exclusion des voisins, réponse 404, sélection à la souris et au clavier, zoom et recentrage, mise en page bureau/téléphone.
# ensamap
