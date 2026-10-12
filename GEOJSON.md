# GeoJSON dans ENSAMAP

Les 23 lieux annotés sont enregistrés dans `data/campus.geojson`. Ce fichier est la source des informations et des contours : Python le lit avec `json.load`, puis prépare la liste des lieux et les zones cliquables. Aucune nouvelle bibliothèque n’est nécessaire côté serveur.

## Télécharger

L’export technique reste disponible par l’API. Sans paramètres de recherche ou de catégorie, il exporte les 23 lieux. Les boutons de téléchargement et de vue complète ont été retirés du plan.

- `/api/map.geojson` : collection complète.
- `/api/map.geojson?download=1` : fichier à télécharger.
- `/api/map.geojson?download=1&q=toilettes` : les trois toilettes.
- `/api/map.geojson?category=Sport` : les deux terrains.

Les bâtiments sont des `Polygon`, ou des `MultiPolygon` quand un lieu regroupe plusieurs surfaces. Les deux entrées sont des `Point`. Les voisins sont exclus. Les trous dans les contours conservent les petits lieux séparés, par exemple ADE et toilettes dans la buvette.

## Coordonnées et alignement

Les positions GeoJSON sont `[longitude, latitude]`, en degrés. Une transformation affine relie ces coordonnées aux pixels de l’illustration originale, avant rotation. La rotation et les animations du navigateur restent indépendantes de ces données.

Trois repères ont été comparés manuellement à la vue satellite Google Maps le 8 octobre 2026 :

| Repère | Pixel x, y | Longitude | Latitude |
| --- | --- | --- | --- |
| Jonction nord-est FAR / Allal Al Fassi | 1204, 204 | −6.874472 | 33.969090 |
| Rond-point sud-est Azzaitoune / Allal Al Fassi | 1205, 908 | −6.875931 | 33.967301 |
| Centre du grand amphithéâtre | 682, 581 | −6.877111 | 33.969001 |

Le centre du terrain de football a servi de vérification séparée : l’écart était d’environ 1,7 m à ce point. Cela ne mesure pas la précision de tous les bâtiments. L’illustration et les contours fournis restent approximatifs ; les coordonnées ne constituent pas un relevé topographique ni une navigation GPS validée.

Les coefficients, les repères et cette vérification sont conservés dans le champ supplémentaire `image_reference`. La structure des géométries suit [GeoJSON, RFC 7946](https://www.rfc-editor.org/rfc/rfc7946.html).

## Modifier un lieu

Chercher son `id` dans le fichier. Modifier son nom, sa catégorie, sa description ou ses alias dans `properties`. Conserver son identifiant.

Pour convertir une annotation en pixels de l’image originale vers une position géographique :

```python
from data import geographic_position, image_position

coordinates = geographic_position(682, 581)
print(coordinates)               # [longitude, latitude]
print(image_position(coordinates))  # (682.0, 581.0)
```

Les sommets se trouvent dans `geometry.coordinates`. Chaque anneau de polygone est fermé : son dernier point répète le premier. Le premier anneau est le contour extérieur ; les suivants sont les trous. `properties.label_position` définit l’emplacement du nom. Pour un MultiPolygon, les anneaux sont regroupés par surface.

Redémarrer Flask après une modification : le fichier est chargé au démarrage. Le fond illustré doit être corrigé séparément si un bâtiment y est redessiné.

## Vérifier

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Les cinq tests vérifient les identifiants, les coordonnées et anneaux, la conversion aller-retour, l’exclusion des voisins, les filtres et le téléchargement. Les contours ont aussi été comparés aux anciennes zones : les emplacements des noms sont identiques et l’écart des surfaces est inférieur à 0,1 pixel carré par lieu.

Le GeoJSON ne fournit pas encore les portes ou les chemins praticables nécessaires au calcul d’itinéraires.

## Ma position

Le bouton en forme de cible demande l’autorisation de localisation après un clic. Le navigateur utilise `watchPosition` : le point bleu s’actualise lorsque la position change. Le premier résultat utilisable recentre le plan ; les mises à jour suivantes laissent l’utilisateur déplacer la carte. Un nouveau clic sur la cible recentre. × arrête le suivi.

Le cercle représente la précision estimée par le téléphone, en mètres, projetée sur l’image. Il n’inclut pas les erreurs d’alignement de l’illustration. Les positions hors de l’image originale sont signalées sans point dans le décor imaginé. Les résultats dont la précision dépasse 200 m sont signalés comme trop imprécis sans afficher de point.

Sur téléphone, utiliser le lien HTTPS public et autoriser la localisation. Un refus, une indisponibilité ou un délai dépassé produit un message et permet de réessayer. Aucune coordonnée de l’utilisateur n’est envoyée à Flask ou enregistrée par notre application. Les services de localisation du téléphone et du navigateur restent responsables de l’obtention de la position.

Les tests utilisent des positions simulées : conversion, quatre rotations, erreurs, arrêt du suivi, absence de demande au chargement et recentrage sans interruption du déplacement manuel. Vérification en conditions réelles à faire sur le campus.

## Détection hors campus

Chaque résultat GPS est comparé au polygone de `data/campus-boundary.geojson`. Ce contour provient du même masque que les couleurs de la carte. Il inclut le terrain ENSAM et contient deux trous pour les parcelles voisines. Il reste séparé des 23 lieux exportés.

Un test de point dans le polygone distingue intérieur et extérieur. La distance au segment de limite le plus proche sert à tenir compte de l’incertitude : si elle est inférieure à la précision GPS plus une marge de 10 m, le message indique une présence incertaine. Cette marge est une précaution autour du dessin approximatif, pas une précision mesurée ni une garantie GPS. Sinon, le message indique « Vous êtes dans l’ENSAM Rabat » ou « Vous êtes en dehors de l’ENSAM Rabat ».

La vérification démarre après autorisation de localisation et se met à jour automatiquement. Elle s’effectue dans le navigateur sans envoyer la position au serveur. Les tests couvrent les deux parcelles exclues, les deux terrains de football, les positions lointaines, les bords et le retour sur le campus.
