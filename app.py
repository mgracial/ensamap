"""ENSAMAP : un petit serveur Python, sans base de données."""

from flask import Flask, jsonify, render_template, request
from data import campus, campus_boundary, places, categories, search_places, geojson_places

app = Flask(__name__)
# Les images optimisées restent en cache après la première visite.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 86400


@app.get("/")
def home():
    reference = campus["image_reference"]
    location_reference = {
        "longitude": reference["longitude"],
        "latitude": reference["latitude"],
        "boundary": campus_boundary["geometry"]["coordinates"],
        "margin_m": campus_boundary["properties"]["classification_margin_m"],
    }
    return render_template(
        "index.html",
        places=places,
        categories=categories(),
        location_reference=location_reference,
    )


@app.get("/api/places")
def find_places():
    query = request.args.get("q", "")
    category = request.args.get("category", "all")
    return jsonify(search_places(query, category))


@app.get("/api/map.geojson")
def map_geojson():
    collection = geojson_places(request.args.get("q", ""), request.args.get("category", "all"))
    response = jsonify(collection)
    response.mimetype = "application/geo+json"
    if request.args.get("download") == "1":
        response.headers["Content-Disposition"] = 'attachment; filename="ensammap.geojson"'
    return response


@app.get("/api/places/<place_id>")
def place_details(place_id):
    for place in places:
        if place["id"] == place_id:
            return jsonify(place)
    return jsonify({"error": "Lieu introuvable"}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
