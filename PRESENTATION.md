# Présenter ENSAMAP

## 1. Problématique

« Comment aider un nouvel étudiant à trouver les lieux du campus de l’ENSAM Rabat, avec une interface simple et lisible sur téléphone ? »

Le choix répond à une situation concrète : au début de l’année, on connaît mal les bâtiments et les accès. Une carte accompagnée d’une recherche permet de relier un nom à un emplacement. Évitez de présenter ce besoin comme une enquête déjà menée si vous n’avez pas interrogé d’étudiants.

## 2. Démonstration

1. Présenter le plan et les deux entrées.
2. Chercher `entree` : Python retrouve les deux entrées malgré l’accent.
3. Choisir un lieu et afficher sa fiche.
4. Centrer le plan, zoomer puis revenir à la vue complète.
5. Montrer un filtre et le fonctionnement sur téléphone.
6. Sur téléphone, appuyer sur la cible pour afficher sa position ; expliquer le cercle de précision et l’alignement approximatif.
7. Ouvrir `data/campus.geojson` pour montrer un lieu, son nom et ses coordonnées.

Les annotations fournies renseignent 23 lieux. Essayez aussi `amphi1`, `wc` ou `mosquee`, puis montrez la différence entre l’administration principale et celle des internats. Les zones non annotées ne sont pas proposées. Expliquez que la navigation par itinéraire est une amélioration future.

## 3. Expliquer le code Python

| Notion du cours | Utilisation réelle |
| --- | --- |
| Fichier JSON | `json.load` lit le GeoJSON sous forme de dictionnaires et de listes. |
| Liste | `places` contient les lieux ; `result` contient les réponses à une recherche. |
| Dictionnaire | Chaque lieu possède des clés : `id`, `name`, `category`, etc. |
| Ensemble | `categories()` rassemble les catégories sans doublon. |
| Boucle | On parcourt les lieux pour rechercher un nom ou un identifiant. |
| Condition | On ajoute un lieu seulement si le texte et la catégorie correspondent. |
| Fonction | `normalize`, `categories` et `search_places` découpent le travail. |
| Chaîne de caractères | `lower`, `strip` et `replace` facilitent la recherche. |
| Liste dans un dictionnaire | Les `aliases` donnent plusieurs mots pour retrouver un même lieu. |

Commencez par `data.py` : le début lit `data/campus.geojson`, puis convertit ses géométries en contours sur l’image. Les fonctions de recherche se trouvent à la fin. Montrez `search_places` avec deux ou trois lieux sur papier. Expliquez ensuite que Flask reçoit la recherche du navigateur et renvoie la liste calculée par Python. Le navigateur l’affiche avec JavaScript.

GeoJSON est un format de données, pas un moteur de carte. Il décrit les lieux avec des points et des polygones. La conversion des coordonnées sert à conserver les contours sur notre illustration ; les positions GPS restent approximatives.

**Trajet d’une recherche :** saisie → requête `/api/places` → fonction Python → liste de résultats → affichage.

Flask et JavaScript sont les outils nécessaires à l’interface web. Ne prétendez pas qu’ils ont été étudiés si ce n’est pas le cas ; validez ce point avec le cours ou l’enseignante.

## 4. Répartir le travail à trois

- Étudiant 1 : annotations, vérification sur place, mise à jour des dictionnaires.
- Étudiant 2 : Python, recherche, catégories et explication des fonctions.
- Étudiant 3 : interface, tests sur téléphone et préparation de la démonstration.

Chacun doit pouvoir expliquer le fonctionnement général et les fonctions Python, même s’il n’a pas écrit toute l’interface. Adaptez la répartition à vos contributions réelles.

## 5. Conclusion de la présentation

Présentez ce qui a été réalisé et testé, puis les limites : contours approximatifs et absence de calcul d’itinéraires. Une fois les chemins confirmés, vous pourrez discuter d’une navigation simple si les algorithmes nécessaires sont compatibles avec le cours.
