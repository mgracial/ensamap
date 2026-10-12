# Comprendre ENSAMAP

Ce guide suit le code du projet. Lis-le avec les fichiers ouverts à côté. Après chaque exemple, change une valeur, prédis le résultat puis vérifie-le. Le but est de pouvoir expliquer les choix et faire une petite modification sans assistance.

## 1. Ce que fait le projet

ENSAMAP aide à retrouver les lieux du campus : rechercher un nom, choisir une catégorie, cliquer sur un bâtiment, lire sa fiche et afficher sa position sur le plan.

Le projet contient un serveur Python et une page web. Le serveur conserve les informations sur les lieux et répond aux recherches. Le navigateur affiche la carte et réagit aux clics, aux doigts et aux mises à jour GPS.

```text
Fichiers GeoJSON
       ↓ json.load
data.py : liste des lieux et fonctions de recherche
       ↓
app.py : routes Flask
       ↓ render_template
index.html : image, contours et éléments de la page
       ↓
style.css : disposition, couleurs et animations des éléments
app.js : interactions, caméra de la carte et localisation
```

Une recherche fait un aller-retour avec Python. Un clic sur un bâtiment utilise les informations déjà chargées dans le navigateur. La position GPS reste dans le navigateur.

## 2. Trouver le bon fichier

| Fichier | Ce qu’on y cherche |
| --- | --- |
| `app.py` | Les URL de l’application et leurs réponses. |
| `data.py` | Lecture des données, conversions, catégories et recherche. |
| `data/campus.geojson` | Les 23 lieux, leurs noms, descriptions et contours. |
| `data/campus-boundary.geojson` | La limite ENSAM et les deux parcelles voisines exclues. |
| `templates/index.html` | Structure de la page et boucle qui dessine les zones cliquables. |
| `static/style.css` | Apparence, panneaux, mobile, survol et transitions. |
| `static/app.js` | Clics, recherche, caméra, gestes et GPS. |
| `static/logo.svg` | Symbole en trois plis, utilisé notamment comme favicon. |
| `static/logo-lockup.svg` | Symbole et lettres du nom ENSAMAP, dessinés en vectoriel. |
| `static/*.webp` | Images légères réellement chargées par la page. |
| `static/*.png` | Références et images de travail conservées. |
| `tests/test_geojson.py` | Vérifications Python des données et des routes. |
| `tests/test_location.cjs` | Vérifications JavaScript avec de faux résultats GPS. |
| `requirements.txt` | Flask, seule dépendance Python externe du serveur. |
| `README.md` | Installation et fonctionnement général. |
| `ANNOTATIONS.md` | Correspondance entre les annotations et les identifiants. |
| `GEOJSON.md` | Alignement géographique et limites de la localisation. |
| `PRESENTATION.md` | Démonstration et répartition du travail à trois. |

La page n’utilise pas une API Google Maps pour afficher la carte. Son fond est une illustration du campus. Le comportement est réalisé avec notre SVG et notre JavaScript.

## 3. Les notions Python du cours

Une **liste** conserve plusieurs éléments dans un ordre : `places`, les alias d’un lieu, les résultats d’une recherche.

Un **dictionnaire** associe des clés à des valeurs. Par exemple :

```python
place = {
    "id": "WC02",
    "name": "Toilettes du hall",
    "category": "Services",
    "aliases": ["wc hall", "sanitaires hall"],
}
print(place["name"])
```

Un **ensemble**, créé par `set()`, évite les doublons. Si trois lieux appartiennent à « Services », `categories()` n’ajoute cette catégorie qu’une fois.

Une **boucle** parcourt les lieux. Une **condition** décide si le lieu correspond à la recherche. Une **fonction** regroupe une tâche et peut recevoir des arguments, puis renvoyer un résultat avec `return`.

`query=""` dans une définition de fonction est une valeur par défaut. Si on appelle `search_places()` sans arguments, la recherche est vide et la catégorie vaut `"all"`.

## 4. `data.py`, du fichier aux lieux utilisables

### Lire les fichiers

`import json` fournit la lecture du format JSON. `Path` permet de construire un chemin de fichier.

```python
data_folder = Path(__file__).parent / "data"
```

`__file__` désigne ce fichier Python. `.parent` donne son dossier. `/ "data"` ajoute le sous-dossier. Cela évite de dépendre du dossier depuis lequel le terminal lance le programme.

```python
with (data_folder / "campus.geojson").open(encoding="utf-8") as file:
    campus = json.load(file)
```

`open` ouvre le fichier. `encoding="utf-8"` permet de lire les accents. `with` ferme automatiquement le fichier après lecture. `json.load` transforme le JSON en listes, dictionnaires, chaînes, nombres et booléens Python.

Les fichiers sont lus au démarrage du serveur, pas à chaque frappe. Après une modification des données, on redémarre Flask.

### Préparer `places`

Le fichier GeoJSON contient une liste nommée `features`. La boucle parcourt cette liste et construit `places` :

```python
places = []
for feature in campus["features"]:
    place = feature["properties"].copy()
    place["id"] = feature["id"]
    place["x"], place["y"] = image_position(place["label_position"])
    place["outline"] = image_outline(feature)
    places.append(place)
```

`copy()` crée un nouveau dictionnaire afin d’ajouter des informations d’affichage sans modifier directement `properties`. C’est une copie superficielle : les listes internes ne sont pas copiées en profondeur, mais le code ne les modifie pas.

`x` et `y` placent le nom du lieu sur l’image. `outline` décrit son contour cliquable. `append` ajoute le dictionnaire à la liste.

### `normalize(text)`

Cette fonction facilite la comparaison des noms : elle passe en minuscules, enlève les espaces au début et à la fin, puis remplace les accents présents dans sa petite table.

```python
normalize("  ENTRÉE  ")  # donne "entree"
```

`lower()` donne les minuscules. `strip()` retire les espaces extérieurs. `replace("é", "e")` remplace une lettre. La boucle applique chaque paire de la table. Cette fonction couvre les accents listés ; ce n’est pas une correction orthographique générale.

### `categories()`

```python
result = set()
for place in places:
    result.add(place["category"])
return sorted(result)
```

`add()` ajoute une valeur à l’ensemble. `sorted()` renvoie une liste triée, pratique pour afficher les boutons de catégories dans un ordre stable.

### `search_places(query, category)`

La fonction commence avec une liste de résultats vide, normalise la recherche, puis examine chaque lieu. Elle assemble le nom, l’identifiant et les alias dans une chaîne.

`place.get("aliases", [])` lit les alias et fournit une liste vide si cette clé manque. `" ".join(...)` rassemble ces mots avec des espaces.

```python
matches_text = query in text
matches_category = category == "all" or place["category"] == category
if matches_text and matches_category:
    result.append(place)
```

`in` vérifie si la recherche est une sous-chaîne du texte. `or` accepte toutes les catégories si la valeur est `"all"`. `and` impose que les deux conditions soient vraies.

Exemple : `search_places("toilettes", "Services")` renvoie les toilettes des amphis, du hall et de la buvette. `search_places("toilettes", "Sport")` renvoie une liste vide. Une chaîne vide est contenue dans toutes les chaînes : une recherche vide retrouve donc tous les lieux de la catégorie choisie.

La fonction retrouve un alias comme `wc`. Elle ne devine pas automatiquement un mot mal orthographié.

### `geojson_places(query, category)`

Cette fonction utilise la même recherche, conserve les identifiants dans un ensemble puis parcourt les features d’origine pour sélectionner les mêmes lieux. Elle copie le dictionnaire de la collection et remplace sa liste `features`.

L’ensemble permet de tester `feature["id"] in ids`. La collection originale conserve ses 23 lieux : les exports ne la réduisent pas pour les recherches suivantes.

L’API d’export existe encore, même si son bouton a été retiré de la page.

### Les trois fonctions de géométrie

`geographic_position(x, y)` convertit les pixels de l’image originale en longitude et latitude. `image_position(coordinates)` fait l’opération inverse. `image_outline(feature)` transforme les sommets géographiques d’un lieu en instructions SVG.

Le détail mathématique se trouve en section 10. Pour expliquer le fonctionnement général : les lieux sont enregistrés dans un format géographique, puis convertis pour être dessinés exactement dans le repère de l’illustration.

## 5. `app.py`, le serveur Flask

`Flask(__name__)` crée l’application. `__name__` aide Flask à trouver les fichiers de ce module, dont les dossiers `templates` et `static`.

`@app.get(...)` associe une URL à la fonction qui suit. C’est un décorateur : quand une requête GET arrive sur cette URL, Flask appelle la fonction.

| URL | Fonction | Réponse |
| --- | --- | --- |
| `/` | `home()` | La page HTML construite avec les lieux. |
| `/api/places?q=wc&category=Services` | `find_places()` | Liste JSON des résultats. |
| `/api/places/WC02` | `place_details(place_id)` | Dictionnaire d’un lieu, ou erreur 404. |
| `/api/map.geojson` | `map_geojson()` | Les données géographiques, filtrables aussi. |

### La page d’accueil

`home()` prépare `location_reference` : les coefficients de conversion, la limite du campus et sa marge. Puis `render_template` lit `index.html` et lui transmet `places`, les catégories et cette référence.

Ce dictionnaire contient les paramètres de la carte. Il ne contient pas la position réelle d’un visiteur.

### La recherche

```python
query = request.args.get("q", "")
category = request.args.get("category", "all")
return jsonify(search_places(query, category))
```

`request.args` donne les paramètres de l’URL après `?`. `get` utilise la valeur par défaut quand un paramètre manque. `jsonify` transforme le résultat Python en une réponse JSON que le navigateur peut lire.

### La fiche et l’export

`place_details` parcourt les lieux et compare l’identifiant. Le premier lieu correspondant est renvoyé. Sinon, la fonction renvoie un message avec le statut HTTP 404, qui signifie « introuvable ».

La page actuelle dispose déjà des fiches chargées avec son HTML : cliquer un bâtiment utilise `selectPlace` en JavaScript. Cette route individuelle reste disponible, mais ce clic n’en a pas besoin.

`map_geojson` utilise la même recherche, indique le type de contenu `application/geo+json` et ajoute un en-tête de téléchargement si `download=1`.

### Lancer le serveur

`if __name__ == "__main__"` lance le serveur quand on exécute `python app.py`. Il ne le lance pas quand un test importe `app`.

`127.0.0.1` est l’adresse locale de cet ordinateur. `5000` est le port. Un téléphone doit passer par le lien public ou un autre hébergement adapté ; son propre `127.0.0.1` ne désigne pas ton ordinateur.

`SEND_FILE_MAX_AGE_DEFAULT = 86400` permet aux ressources statiques d’être conservées en cache pendant une journée. Le `?v=...` des fichiers CSS et JS permet de demander une nouvelle version après une modification.

## 6. Les données GeoJSON

JSON est un format texte. GeoJSON utilise JSON pour représenter des objets géographiques. Chaque lieu a un `id`, une `geometry` et des `properties`.

Dans `properties`, on trouve le nom, la catégorie, la description, les alias et `label_position`, qui place le nom sur le plan. L’identifiant relie le contour, le résultat de recherche et la fiche. Ce n’est pas un numéro officiel de bâtiment.

Les coordonnées sont toujours dans l’ordre **longitude, latitude**. Exemple du centre de référence du grand amphithéâtre : `[-6.877111, 33.969001]`.

Les 23 lieux sont répartis en deux points, dix-neuf polygones et deux multipolygones :

- `Point` : les deux entrées. Une petite zone carrée est créée pour faciliter le clic.
- `Polygon` : un contour extérieur et éventuellement des trous. La buvette possède des zones exclues pour l’ADE et les toilettes.
- `MultiPolygon` : plusieurs surfaces. L’internat des garçons regroupe ses pavillons. Le grand amphithéâtre possède également une géométrie composée issue de la découpe de son contour.

Un anneau répète son premier point à la fin pour être fermé. La collection contient aussi `image_reference`, un champ supplémentaire propre au projet avec l’alignement et ses sources.

Le champ `overview` reste dans les données et ajoute une classe HTML. La visibilité permanente des noms est aujourd’hui décidée par le CSS des identifiants `GATE`, pas par ce champ.

Le fichier de limite est séparé : il contient un contour extérieur et deux trous, les parcelles voisines au nord-est et au sud-ouest. Le terrain de football ENSAM est inclus, celui de gauche est exclu.

## 7. `index.html`, le squelette de la page

Le HTML décrit les éléments : la carte, la recherche, les filtres, les résultats, la fiche et les outils.

`lang="fr"` indique la langue. Le titre d’onglet est « ENSAMAP · Explorer le campus ». `viewport` permet une mise en page adaptée au téléphone. `defer` fait exécuter `app.js` après la lecture du HTML.

Les expressions `{{ ... }}` et les blocs `{% ... %}` sont traités par Jinja, le moteur de templates utilisé par Flask. Ils ne sont pas exécutés par le navigateur.

```html
{% for place in places %}
  ... un groupe pour ce lieu ...
{% endfor %}
```

Cette boucle crée 23 groupes SVG. `data-id` conserve leur identifiant pour JavaScript. Chaque groupe contient un `<path>` cliquable et un nom.

SVG décrit des dessins par coordonnées. Un `<g>` regroupe plusieurs éléments. `<image>` affiche le fond raster. `<path d="...">` décrit un contour. `<text>` affiche un nom. Le fond et les zones cliquables sont donc deux couches différentes : une jolie image dessous, des contours interactifs au-dessus.

Dans un path, `M` déplace le début du tracé, `L` trace une ligne, `Z` ferme le contour. Les commandes minuscules utilisent des déplacements relatifs ; `h` et `v` servent au petit carré des entrées.

`fill-rule="evenodd"` permet les trous : une zone couverte par deux contours emboîtés n’est pas remplie. Ainsi, le grand contour de la buvette ne prend pas les clics destinés à l’ADE ou aux toilettes.

Les deux blocs `<script type="application/json">` ne sont pas des programmes. Ce sont des données. `tojson` les sérialise proprement. JavaScript les récupère avec `JSON.parse`.

`id` désigne un élément unique. `class` rassemble des éléments ayant le même rôle. `aria-label`, `aria-pressed`, `aria-live` et `tabindex` aident les lecteurs d’écran et la navigation au clavier. `hidden` cache un panneau qui n’est pas utilisé.

## 8. `style.css`, l’apparence

Les variables de `:root` contiennent les couleurs : rouge ENSAM `#CA0D23`, gris `#7D7C82`, texte `#262626`. Une variable comme `var(--red)` permet de réutiliser la même couleur.

Les blocs de recherche et les outils sont placés au-dessus du plan. `position: absolute` ou `fixed` contrôle leur placement ; `z-index` contrôle l’ordre des couches. `flex` aligne les éléments ; `gap` règle l’espace entre eux. `border-radius` arrondit les panneaux et `box-shadow` crée leur ombre.

Le texte courant utilise Arial/Helvetica. Le nom angulaire dans le logo est dessiné dans `logo-lockup.svg` : ce n’est pas une police chargée par JavaScript.

Les contours sont transparents au repos. La couleur au survol ou à la sélection vaut `rgb(202 13 35 / 40%)`, soit 40 % d’opacité et 60 % de transparence. Le nom ne capture pas les clics : `pointer-events: none` garde le contour comme vraie zone interactive.

JavaScript ajoute `.hovered` au bon lieu. Le CSS applique sa couleur. Ce choix évite que le déplacement automatique du plan déclenche un faux survol sous une souris restée immobile.

Les noms sont cachés au repos, sauf ceux des deux entrées. Les classes `.selected`, `.hovered` et le focus clavier les font apparaître.

`transition` anime le passage entre deux états, par exemple la couleur ou la hauteur du panneau. `@keyframes` décrit une animation, comme l’entrée d’une fiche. Le zoom de la carte a son animation en JavaScript, car il fait varier le `viewBox` SVG.

À moins de 720 pixels de largeur, la recherche passe en haut et la liste devient un panneau inférieur. `sheet-expanded` agrandit ce panneau, `detail-collapsed` réduit la fiche. `100dvh` suit la hauteur visible du navigateur mobile. `env(safe-area-inset-bottom)` tient compte de la zone réservée en bas sur certains téléphones.

JavaScript met à jour `--sheet-height`, puis le CSS l’utilise pour garder les outils au-dessus du panneau. Le champ de recherche mobile est à 16 pixels pour éviter le zoom automatique habituel de Safari sur les petits champs.

Le réglage `prefers-reduced-motion` désactive les animations CSS et est aussi consulté par la caméra JavaScript.

## 9. `app.js`, les interactions

### Le vocabulaire utile

`const` crée une référence qu’on ne réaffecte pas ; `let` une variable qu’on peut réaffecter. Un objet JavaScript ressemble à un dictionnaire Python ; un tableau ressemble à une liste. `===` compare strictement. `=>` définit une fonction courte. `[...view]` copie les éléments d’un tableau. `null` représente une absence de valeur.

`document.getElementById` retrouve un élément HTML. `querySelector` utilise un sélecteur CSS. `textContent` change son texte. `classList.add/remove/toggle` change ses classes. `addEventListener` associe une fonction à un événement.

### Les variables qui mémorisent l’état

| Variable | Signification |
| --- | --- |
| `places` | Lieux reçus avec le HTML. |
| `category` | Filtre actuel, ou `all`. |
| `selected` | Identifiant du lieu choisi, ou `null`. |
| `hoveredPlace` | Groupe SVG actuellement survolé. |
| `rotation` | Orientation : 0, 90, 180 ou 270 degrés. |
| `view` | Fenêtre visible : x, y, largeur, hauteur. |
| `initialView` | Vue qui montre le campus dans l’espace disponible. |
| `cameraTarget` | Destination d’une animation en cours. |
| `requestNumber` | Numéro de la recherche la plus récente. |
| `locationWatch` | Identifiant du suivi GPS, ou `null`. |
| `currentPosition` | Dernier résultat GPS reçu. |

### Recherche et fiche

`makeCard` crée un bouton résultat. Son nom est écrit avec `textContent`, puis son clic appelle `selectPlace`.

`renderResults` remplace les anciens boutons, met à jour le nombre de lieux et masque les contours qui ne correspondent pas. Les lieux masqués ne restent pas accessibles au clic ou au clavier.

`updateResults` demande `/api/places` avec `fetch`. `await` attend la réponse sans bloquer toute l’interface. `encodeURIComponent` prépare le texte pour une URL. `try/catch` permet d’afficher une erreur quand la recherche échoue.

`requestNumber` évite un problème de concurrence : si la réponse à « bu » arrive après celle à « buvette », elle ne doit pas remplacer les résultats les plus récents.

La saisie attend 150 ms après la dernière frappe : `clearTimeout` annule la recherche prévue, puis `setTimeout` en programme une nouvelle. Cela réduit les requêtes pendant la frappe.

`selectPlace` cherche le lieu dans `places`, remplit la fiche, change les classes de sélection et appelle `focusSelected`. Fermer la fiche enlève la sélection et appelle `recenterMap`.

`togglePanel` change la classe correspondant au panneau ouvert ou fermé. Il recalcule l’espace disponible et recentre le plan.

### La caméra de la carte

Le `viewBox` SVG est une fenêtre dans le dessin. Avec `[0, 0, 1420, 1108]`, on observe cette zone du dessin. Réduire sa largeur montre une zone plus petite, donc agrandit les bâtiments à l’écran.

Exemple : une largeur passant de 1000 à 800 donne un agrandissement de `1000 / 800 = 1,25`. Le bouton + multiplie la largeur par 0,8. Le bouton − la multiplie par 1,25.

`zoom` garde la largeur entre `initialView[2] / 4` et `initialView[2]`. Les gestes peuvent donc aller jusqu’à environ quatre fois le zoom de la vue complète, et ne peuvent pas dézoomer au-delà de cette vue. Le centre du geste reste le point d’ancrage du zoom.

`visibleMapArea` retire l’espace occupé par la recherche, les filtres et le panneau. `visibleCenter` trouve le milieu de l’espace restant. Voilà pourquoi le lieu est centré dans la partie visible plutôt que derrière une fiche.

`campusView` calcule la vue complète. Ses dimensions de cadrage sont ajustées au campus. `focusSelected` utilise le rectangle englobant du contour, obtenu par `getBBox`, pour cadrer le bâtiment entier avec une marge.

`moveView` passe progressivement de la vue actuelle à la cible. `requestAnimationFrame` demande au navigateur de dessiner à son prochain cycle d’affichage. La progression est comprise entre 0 et 1 ; `1 - (1-progress)^3` ralentit l’arrivée. `stopCamera` annule une animation avant d’en démarrer une autre.

`drawView` applique le `viewBox`, règle les boutons désactivés et actualise les noms et le point GPS. `scheduleDraw` regroupe les dessins demandés par plusieurs mouvements rapides.

`limitPan` limite les déplacements manuels au décor étendu. Les noms sont mis à l’échelle inverse du zoom pour rester lisibles à taille presque constante sur l’écran.

### Rotation

Le plan tourne autour de `(710, 600)`. Le centre du cadrage vertical est 600, car la partie utile de l’image s’étend de y=140 à y=1060. La rotation à 180° donne :

```text
x' = 1420 - x
y' = 1200 - y
```

`applyRotation` tourne l’image et les contours ensemble. `rotatedPoint` place les noms et le point GPS dans le même repère. Les noms des avenues ont une orientation ajustée pour rester lisibles. Les noms interactifs restent horizontaux.

La rotation ne modifie pas les coordonnées sauvegardées dans le GeoJSON.

### Les gestes

`pointerdown` mémorise le point de départ. `pointermove` calcule le déplacement. `pointerup` termine le geste. `setPointerCapture` permet de continuer le geste même si le doigt ou la souris sort du contour initial.

Un déplacement supérieur à cinq pixels est traité comme un glissement. Sinon, le relâchement peut ouvrir une fiche. Cela évite d’ouvrir un bâtiment à chaque déplacement du plan.

Un doigt déplace la vue. Deux doigts comparent leur distance actuelle à la distance initiale : c’est le pincement. Au relâchement, la vitesse récente peut prolonger légèrement le mouvement, avec une distance limitée : c’est l’inertie.

La molette et le double-clic appellent `zoom`. Les touches + et − zooment. Entrée ou Espace sélectionnent un lieu au clavier. `/` donne le focus à la recherche ; Échap ferme la fiche.

### Toutes les fonctions JavaScript, pour les retrouver

| Fonction | Tâche |
| --- | --- |
| `clearHover` | Retirer le survol précédent. |
| `updateHover` | Identifier le contour réellement survolé. |
| `scheduleDraw` | Programmer un dessin sans doublon dans la même image. |
| `makeCard` | Créer un bouton résultat. |
| `renderResults` | Afficher les résultats et filtrer le plan. |
| `updateResults` | Demander les résultats à Python. |
| `selectPlace` | Ouvrir la fiche et cadrer le lieu. |
| `togglePanel` | Ouvrir ou réduire le panneau. |
| `rotatedPoint` | Transformer un point selon l’orientation. |
| `updateSheetHeight` | Mesurer le panneau et actualiser les attributs d’accessibilité. |
| `visibleSheetHeight` | Estimer sa hauteur finale pendant l’animation. |
| `visibleMapArea` | Calculer la zone de carte visible. |
| `visibleCenter` | Calculer son centre. |
| `limitPan` | Borner un déplacement manuel. |
| `campusView` | Calculer le cadrage complet. |
| `recenterMap` | Recentrer le campus ou le lieu sélectionné. |
| `stopCamera` | Arrêter l’animation de caméra. |
| `moveView` | Animer le passage à une autre vue. |
| `drawView` | Appliquer la vue et actualiser les éléments visibles. |
| `updateLabels` | Maintenir les noms lisibles et au bon endroit. |
| `zoom` | Calculer un zoom borné autour d’un point. |
| `applyRotation` | Tourner le fond, les contours et les avenues. |
| `focusSelected` | Cadrer le bâtiment sélectionné. |
| `locationImagePoint` | Convertir le GPS en pixels originaux. |
| `locationMessage` | Afficher un message sans répéter une modification identique. |
| `campusPosition` | Classer la position : intérieur, extérieur ou incertaine. |
| `showCampusLocation` | Choisir le message de présence sur le campus. |
| `locationOnMap` | Vérifier si la position est sur l’image originale. |
| `updateLocationMarker` | Dessiner le point et la précision. |
| `centerLocation` | Cadrer la dernière position utilisable. |
| `stopLocation` | Arrêter le suivi et supprimer le point. |

Les fonctions anonymes dans les gestionnaires d’événements exécutent ces fonctions selon l’action de l’utilisateur. Les dernières lignes appliquent la rotation, affichent les lieux et dessinent la vue initiale. `ResizeObserver` actualise la hauteur du panneau quand son contenu change.

## 10. Coordonnées et GPS, les parties plus avancées

### Relier l’image à la Terre

Trois repères ont servi à calculer six coefficients. La relation est :

```text
longitude = a*x + b*y + c
latitude  = d*x + e*y + f
```

Les coefficients combinent l’échelle, l’orientation et le décalage entre les deux repères. C’est une transformation affine. Les valeurs sont sauvegardées dans `image_reference` ; elles ne sont pas recalculées à chaque visite.

Pour revenir aux pixels, on résout ces deux équations. Après avoir retiré c et f :

```text
det = a*e - b*d
x = (longitude*e - latitude*b) / det
y = (latitude*a - longitude*d) / det
```

Le déterminant doit être non nul : les trois repères utilisés ne doivent pas être alignés. Python utilise ces formules pour les contours ; JavaScript utilise les mêmes pour le GPS. Les rotations visuelles viennent ensuite.

Exemple réel : `geographic_position(682, 581)` donne environ `[-6.877111, 33.969001]`. L’inverse revient à `(682, 581)`.

Arrondir les nombres à douze décimales conserve la stabilité de la conversion. Cela ne signifie pas une précision GPS de douze décimales. Un contrôle séparé au terrain de football avait un écart d’environ 1,7 m ; ce point ne prouve pas la précision de tout le campus.

### Obtenir la position

Le navigateur appelle `navigator.geolocation.watchPosition` après un clic sur la cible et l’autorisation de l’utilisateur. Il fournit longitude, latitude et une précision estimée en mètres. Selon le téléphone, la position peut venir du GPS et d’autres services de localisation.

Les options actuelles sont : précision élevée demandée, délai de recherche de 15 secondes et acceptation d’un résultat en cache datant de cinq secondes au maximum. Elles ne garantissent pas un résultat exact.

Le premier résultat utilisable recentre la carte. Les suivants actualisent le point sans déplacer automatiquement la caméra : l’utilisateur peut continuer à explorer. Un nouveau clic sur la cible recentre.

Les erreurs 1, 2 et 3 correspondent au refus, à l’indisponibilité et au dépassement du délai. `stopLocation` appelle `clearWatch`, cache le point et invalide les réponses tardives avec `locationRequest`.

L’accès sur téléphone nécessite un contexte sécurisé, en pratique le lien HTTPS. Le développement sur `localhost` bénéficie d’un traitement particulier des navigateurs.

### Dessiner le cercle

La précision est une distance, mais l’illustration peut être inclinée et avoir des échelles différentes selon les axes. Le code convertit deux rayons : un vers l’est et un vers le nord. Une matrice SVG transforme le cercle en une ellipse adaptée au plan.

La conversion utilise environ 111 320 mètres par degré de latitude et une correction par le cosinus pour la longitude. C’est une approximation locale suffisante pour ce calcul à l’échelle du campus, pas une projection complète pour tous les pays.

Le petit point garde une taille lisible grâce à une mise à l’échelle inverse du zoom. Un résultat de précision supérieure à 200 m n’affiche pas de point. Une position hors de l’image originale non plus, car le décor ajouté est imaginé.

Le cercle représente l’incertitude annoncée par le téléphone. Il ne contient pas automatiquement l’erreur de notre illustration.

### Vérifier intérieur ou extérieur

`campusPosition` parcourt les segments de la limite. On imagine une ligne horizontale qui part du point et traverse les segments : chaque croisement inverse le booléen `inside`. Un nombre impair de croisements signifie intérieur ; un nombre pair signifie extérieur. Le traitement des trous exclut les parcelles voisines.

La fonction calcule aussi la distance au segment le plus proche. Elle projette le point sur chaque segment, limite la projection à ses deux extrémités avec `Math.min` et `Math.max`, puis conserve la plus petite distance avec `Math.hypot`.

Si cette distance est inférieure à `accuracy + 10 m`, le résultat est `uncertain`. Les dix mètres sont une marge choisie autour du dessin approximatif, pas une précision mesurée. Sinon, le résultat est `inside` ou `outside`.

La vérification utilise la position géographique, pas les coordonnées déjà tournées à l’écran. Tourner la carte ne change donc pas le résultat.

Ces calculs sont plus avancés que les listes et dictionnaires du cours. À l’oral, explique leur rôle et leurs limites, puis approfondis les formules si l’enseignante le demande.

## 11. Pourquoi le téléphone est plus rapide qu’au début

Le fond principal, les environs et la petite tuile WebP totalisent environ 500 Ko. L’ancien PNG chargé pour le plan faisait environ 6 Mo.

Les effets gris et les découpes sont déjà intégrés aux images. Le téléphone n’a plus à recalculer ces grands masques et filtres à chaque déplacement. Les anciennes images PNG restent comme fichiers de travail.

Le code garde les références des noms au lieu de rechercher tous les éléments à chaque image. Il actualise surtout les noms visibles. Les demandes de dessin sont regroupées et les images bénéficient du cache HTTP.

Les WebP améliorent le chargement et le rendu ; le format GeoJSON, à lui seul, n’accélère pas les animations.

## 12. Lancer, partager et tester

Depuis le dossier du projet, l’environnement déjà installé démarre avec :

```sh
.venv/bin/python app.py
```

Dans un deuxième terminal, ngrok partage ce serveur :

```sh
ngrok http http://127.0.0.1:5000
```

Ngrok n’est pas le serveur Python. C’est un tunnel entre son adresse publique HTTPS et ton serveur local. Le processus Python, ngrok, Internet et l’ordinateur doivent rester actifs. Le lien temporaire peut cesser de fonctionner après une coupure.

Les vérifications automatiques :

```sh
.venv/bin/python -m unittest discover -s tests -v
node tests/test_location.cjs
```

Le premier fichier contient cinq tests : structure et coordonnées, aller-retour de conversion, entrées et voisins exclus, export comparé à la recherche, réponse de la page et téléchargement technique.

`app.test_client()` fait des requêtes dans les tests sans lancer un véritable serveur public. `assertEqual`, `assertIn` et les autres assertions arrêtent le test si le résultat ne correspond pas à ce qu’on attend.

Le test JavaScript utilise les modules standard de Node : lecture du fichier, contexte d’exécution isolé et assertions. Il donne de fausses positions GPS pour vérifier les rotations, l’arrêt, les erreurs, les deux terrains, les parcelles exclues et les positions incertaines. Node sert aux tests ; le backend de l’application reste Python.

Un test simulé ne vérifie pas la précision de l’iPhone sur place. Il faut aussi tester les entrées et des repères du campus en conditions réelles.

## 13. Quatre actions à raconter à l’oral

**Je tape « toilettes ».** L’événement de saisie attend 150 ms, `updateResults` appelle Flask, `find_places` appelle `search_places`, Python examine sa liste, la réponse JSON revient, `renderResults` crée trois boutons et filtre les contours.

**Je clique le département mécanique.** Le clic fournit `B02`, `selectPlace` lit le dictionnaire déjà chargé, remplit la fiche et marque la sélection. `focusSelected` calcule le cadrage. `moveView` anime la caméra. Le CSS colore le contour et anime la fiche.

**Je ferme la fiche.** Le gestionnaire du bouton efface `selected`, cache la fiche, réaffiche les résultats et recalcule la vue du campus dans l’espace visible.

**J’autorise la localisation.** Le navigateur reçoit des coordonnées. `campusPosition` vérifie la limite. `showCampusLocation` affiche le message. `locationImagePoint`, puis `rotatedPoint`, placent le point. La position n’est pas transmise à Flask par notre code.

## 14. Exercices pour comprendre réellement

1. Prédis puis vérifie `normalize("  MOSQUÉE  ")`.
2. Explique pourquoi une recherche vide retrouve tous les lieux de la catégorie.
3. Ajoute provisoirement un alias à un lieu, redémarre et retrouve-le par ce mot. Remets ensuite les données d’origine.
4. Appelle `search_places("wc", "Services")` dans Python et affiche les noms avec une boucle.
5. Explique pourquoi le choix « Sport » exclut les toilettes même si le texte correspond.
6. Trouve dans le CSS la ligne des 40 % d’opacité. Distingue opacité et transparence.
7. Calcule la rotation à 180° du point `(500, 300)` : `(920, 900)`.
8. Si le viewBox passe d’une largeur de 1200 à 600, explique le zoom obtenu : deux fois plus grand.
9. Explique le problème évité par `requestNumber` avec deux recherches arrivant dans le mauvais ordre.
10. Dessine un rectangle et un trou sur papier. Compte les croisements pour un point à l’extérieur, à l’intérieur et dans le trou.
11. Si la distance à la limite vaut 8 m et la précision GPS 5 m, explique le résultat incertain : `8 <= 5 + 10`.
12. Trouve où arrêter le suivi GPS et explique pourquoi un résultat tardif doit être ignoré.

Pour lancer les petits exemples :

```sh
.venv/bin/python
```

Puis :

```python
from data import normalize, search_places, categories
print(normalize("  MOSQUÉE  "))
for place in search_places("wc", "Services"):
    print(place["name"])
print(categories())
```

## 15. Questions probables et réponses à reformuler

| Question | Idée à expliquer |
| --- | --- |
| Pourquoi ce projet ? | Aider les nouveaux étudiants à associer un nom à un lieu réel. |
| Où sont les notions Python du cours ? | Listes, dictionnaires, ensembles, boucles, conditions et fonctions dans `data.py`. |
| Pourquoi pas une base de données ? | Les 23 lieux changent peu ; un fichier suffit pour cette version. |
| Quel est le rôle de Flask ? | Recevoir les requêtes HTTP et renvoyer une page ou du JSON. |
| GeoJSON est-il une carte ? | C’est le format des données géographiques ; l’affichage est réalisé par notre page. |
| Pourquoi une image et du SVG ? | L’image fournit le détail visuel ; les contours SVG donnent des zones cliquables précises. |
| Toutes les animations sont-elles CSS ? | Panneaux et couleurs : CSS. Caméra du plan : JavaScript qui modifie le viewBox. |
| Pourquoi JavaScript alors que le module est Python ? | Le serveur et la recherche sont Python. Le navigateur utilise JS pour les interactions et sa géolocalisation. |
| Comment sont exclus les voisins ? | Trous dans le polygone du campus et absence des voisins dans les 23 lieux interactifs. |
| La localisation est-elle exacte ? | Position du téléphone et alignement du dessin ont des incertitudes ; le cercle et le message près des limites les rendent visibles. |
| Où est sauvegardée la position du visiteur ? | Elle n’est pas enregistrée par l’application ni envoyée à son serveur. |
| Peut-on trouver le chemin le plus court ? | Pas dans cette version : il faut d’abord les chemins et portes confirmés. |
| Quelle partie avez-vous réalisée ? | Décrire les contributions réelles : annotations, vérification, code, tests ou interface. |

Prépare une explication de la recherche sans regarder le fichier, une petite modification que tu sais réaliser, et une limite que tu sais justifier. Cela permet de montrer ta compréhension du projet avec tes propres mots.
