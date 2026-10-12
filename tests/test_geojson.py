import unittest

from app import app
from data import campus, places, geographic_position, image_position


class GeoJSONTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_locations_and_geographic_coordinates(self):
        self.assertEqual(campus["type"], "FeatureCollection")
        self.assertEqual(len(campus["features"]), 23)
        self.assertEqual(len({feature["id"] for feature in campus["features"]}), 23)
        for feature in campus["features"]:
            geometry = feature["geometry"]
            if geometry["type"] == "Point":
                points = [geometry["coordinates"]]
            else:
                polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
                points = []
                for polygon in polygons:
                    for index, ring in enumerate(polygon):
                        self.assertGreaterEqual(len(ring), 4)
                        self.assertEqual(ring[0], ring[-1])
                        # Vérifier l’orientation des contours extérieurs et des trous.
                        x0, y0 = ring[0]
                        area = sum((a[0]-x0)*(b[1]-y0) - (b[0]-x0)*(a[1]-y0) for a, b in zip(ring, ring[1:]))
                        self.assertGreater(area if index == 0 else -area, 0)
                        points.extend(ring)
            for longitude, latitude in points:
                self.assertTrue(-6.89 < longitude < -6.86)
                self.assertTrue(33.96 < latitude < 33.98)

    def test_image_coordinates_round_trip_and_controls(self):
        for place in places:
            self.assertEqual(image_position(geographic_position(place["x"], place["y"])), (place["x"], place["y"]))
        for point in campus["image_reference"]["control_points"]:
            for actual, expected in zip(geographic_position(*point["image"]), point["coordinates"]):
                self.assertAlmostEqual(actual, expected, places=10)

    def test_entrances_are_points_and_neighbours_are_excluded(self):
        features = {feature["id"]: feature for feature in campus["features"]}
        for gate in ["GATE01", "GATE02"]:
            self.assertEqual(features[gate]["geometry"]["type"], "Point")
        for excluded in ["B06", "B07", "B08", "B18"]:
            self.assertNotIn(excluded, features)

    def test_export_matches_search_and_filter(self):
        for query in ["", "?q=toilettes", "?category=Sport", "?q=amphi&category=Études", "?q=unknown-place"]:
            places_response = self.client.get("/api/places" + query).get_json()
            response = self.client.get("/api/map.geojson" + query)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.mimetype, "application/geo+json")
            exported = response.get_json()["features"]
            self.assertEqual([feature["id"] for feature in exported], [place["id"] for place in places_response])

    def test_download_and_page_render(self):
        response = self.client.get("/api/map.geojson?download=1")
        self.assertIn("ensammap.geojson", response.headers["Content-Disposition"])
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.data.count(b'class="hit-area"'), 23)
        self.assertNotIn(b'id="export-map"', page.data)
        self.assertNotIn(b'id="reset-map"', page.data)
        self.assertNotIn(b'<filter', page.data)


if __name__ == "__main__":
    unittest.main()
