# Annotations intégrées

Correspondance avec les couleurs de l’image fournie par l’étudiant. Les couleurs sont des annotations de travail ; elles ne sont pas ajoutées à l’illustration affichée. Le plan de l’application reste tourné à 180° avec l’entrée principale en bas.

| Annotation | Lieu dans l’application | Identifiant |
| --- | --- | --- |
| Marron, numéro 1 | Amphithéâtre 1 | AMPHI01 |
| Marron, numéro 2 | Amphithéâtre 2 | AMPHI02 |
| Marron, numéro 3 | Amphithéâtre 3 | B01 |
| Marron, numéro 4 | Amphithéâtre 4 | AMPHI04 |
| Rectangle rouge sous les arbres, près des amphis | Toilettes des amphis ; petit bâtiment ajouté au plan | WC01 |
| Orange | Administration | B03 |
| Rose | Internat des filles | B09 |
| Cadre rouge de la nouvelle capture rapprochée | Buvette des étudiants | BUV01 |
| Rectangle vert dans ce cadre rouge | Toilettes de la buvette | WC03 |
| Rectangle violet dans ce cadre rouge | Local de l’ADE | ADE01 |
| Cadre bleu de la nouvelle capture rapprochée | Administration des internats | ADMIN02 |
| Cadre orange de la nouvelle capture rapprochée | Salle d’étude : bloc complet | STUDY01 |
| Cyan | Terrain multisport | SPORT02 |
| Mauve | Internat des garçons : pavillons marqués uniquement | B10 |
| Violet sur le terrain | Terrain de football | SPORT01 |
| Noir sous l’orange | Département électrique | B04 |
| Gris sous le département électrique | Grand amphithéâtre | B05 |
| Jaune dans le gris | Mosquée | MOSQUE01 |
| Rouge sous le gris | Toilettes du hall | WC02 |
| Or | Département mécanique | B02 |
| Bleu dans l’or | Buvette des professeurs et cadres | BUV02 |

Les deux entrées conservent leurs identifiants GATE01 et GATE02. Les voisins restent exclus. Les zones non annotées B06, B07, B08 et B18 sont supprimées des lieux et ne sont plus cliquables. Le long bâtiment diagonal voisin des internats n’est pas inclus dans l’internat des garçons.

Pour corriger un emplacement, modifier la géométrie du lieu dans `data/campus.geojson`. Les coordonnées sont `[longitude, latitude]`. `label_position` place son nom sur la carte. Les fonctions `geographic_position(x, y)` et `image_position(coordinates)` de `data.py` font la conversion avec l’image originale de 1420 × 1108 pixels, avant rotation. Voir `GEOJSON.md` pour un exemple. Redémarrer le serveur après une modification.

Les contours des petits locaux suivent les annotations. L’alignement géographique est approximatif ; il ne confirme pas les portes ni les chemins praticables.
