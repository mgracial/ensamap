"""Lieux du campus lus depuis GeoJSON, avec un serveur Python simple.

Les coordonnées GeoJSON sont [longitude, latitude]. Leur alignement sur
l’illustration est approximatif ; les positions à l’écran restent en pixels.
"""

import json
from pathlib import Path

data_folder = Path(__file__).parent / "data"
with (data_folder / "campus.geojson").open(encoding="utf-8") as file:
    campus = json.load(file)
with (data_folder / "campus-boundary.geojson").open(encoding="utf-8") as file:
    campus_boundary = json.load(file)


def geographic_position(x, y):
    """Convertir un point de l’illustration en [longitude, latitude]."""
    a, b, c = campus["image_reference"]["longitude"]
    d, e, f = campus["image_reference"]["latitude"]
    return [round(a * x + b * y + c, 12), round(d * x + e * y + f, 12)]


def image_position(coordinates):
    """Revenir aux pixels de l’image originale, avant sa rotation visuelle."""
    a, b, c = campus["image_reference"]["longitude"]
    d, e, f = campus["image_reference"]["latitude"]
    longitude, latitude = coordinates
    longitude -= c
    latitude -= f
    determinant = a * e - b * d
    x = (longitude * e - latitude * b) / determinant
    y = (latitude * a - longitude * d) / determinant
    return round(x, 2), round(y, 2)


def image_outline(feature):
    """Les contours cliquables sont dessinés à partir des géométries GeoJSON."""
    geometry = feature["geometry"]
    if geometry["type"] == "Point":
        x, y = image_position(geometry["coordinates"])
        width, height = feature["properties"]["image_hit_size"]
        return f"M{x-width/2:g} {y-height/2:g}h{width:g}v{height:g}h{-width:g}Z"
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    else:
        polygons = geometry["coordinates"]
    outline = []
    for polygon in polygons:
        for ring in polygon:
            for index, coordinates in enumerate(ring[:-1]):
                x, y = image_position(coordinates)
                command = "M" if index == 0 else "L"
                outline.append(f"{command}{x:g} {y:g}")
            outline.append("Z")
    return "".join(outline)


# Préparer les lieux avec leur position et leur contour sur l’image.
places = []
for feature in campus["features"]:
    place = feature["properties"].copy()
    place["id"] = feature["id"]
    place["x"], place["y"] = image_position(place["label_position"])
    place["outline"] = image_outline(feature)
    places.append(place)


def normalize(text):
    """On peut chercher 'entree' même si le nom contient 'entrée'."""
    text = text.lower().strip()
    for accent, letter in [("é", "e"), ("è", "e"), ("ê", "e"), ("à", "a"), ("â", "a"), ("î", "i"), ("ô", "o"), ("ç", "c")]:
        text = text.replace(accent, letter)
    return text


def categories():
    # Un ensemble évite les doublons, puis sorted retourne une liste.
    result = set()
    for place in places:
        result.add(place["category"])
    return sorted(result)


def search_places(query="", category="all"):
    result = []
    query = normalize(query)
    for place in places:
        # Les alias permettent aussi de chercher « wc », « amphi1 » ou « profs ».
        text = normalize(place["name"] + " " + place["id"] + " " + " ".join(place.get("aliases", [])))
        matches_text = query in text
        matches_category = category == "all" or place["category"] == category
        if matches_text and matches_category:
            result.append(place)
    return result


def geojson_places(query="", category="all"):
    """Exporter les mêmes lieux que ceux affichés dans les résultats."""
    ids = set()
    for place in search_places(query, category):
        ids.add(place["id"])

    features = []
    for feature in campus["features"]:
        if feature["id"] in ids:
            features.append(feature)

    collection = campus.copy()
    collection["features"] = features
    return collection
