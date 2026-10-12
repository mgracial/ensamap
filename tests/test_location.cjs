// Tests sans bibliothèque : positions simulées, aucune localisation personnelle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const reference = JSON.parse(fs.readFileSync(path.join(root, 'data/campus.geojson'))).image_reference;
const boundary = JSON.parse(fs.readFileSync(path.join(root, 'data/campus-boundary.geojson')));
reference.boundary = boundary.geometry.coordinates;
reference.margin_m = boundary.properties.classification_margin_m;
const source = fs.readFileSync(path.join(root, 'static/app.js'), 'utf8');
const locationCode = source.slice(source.indexOf('// Localisation :'), source.indexOf('// Fin de la localisation.'));

function fixture(secure = true) {
  const elements = {};
  function element(id) {
    if (!elements[id]) elements[id] = {
      attrs: {}, events: {}, dataset: {}, hidden: false, textContent: '',
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      addEventListener(key, fn) { this.events[key] = fn; }
    };
    return elements[id];
  }
  element('location-data').textContent = JSON.stringify(reference);
  const watches = [], stopped = [], moves = [];
  const context = vm.createContext({
    document: {getElementById: element},
    navigator: {geolocation: {
      watchPosition(success, error, options) { watches.push({success, error, options}); return watches.length; },
      clearWatch(id) { stopped.push(id); }
    }},
    window: {isSecureContext: secure, addEventListener() {}},
    rotation: 180, view: [0, 0, 1800, 1200], initialView: [0, 0, 1800, 1200],
    lastSize: [900, 600], selected: null,
    visibleCenter: () => [600, 300],
    moveView(target) { context.view = target; moves.push(target); },
    rotatedPoint(x, y) {
      return context.rotation === 90 ? [1310-y, x-110] : context.rotation === 180 ? [1420-x, 1200-y] : context.rotation === 270 ? [y+110, 1310-x] : [x,y];
    }
  });
  vm.runInContext(locationCode, context);
  return {context, element, watches, stopped, moves, click: () => element('locate-me').events.click()};
}
function position(x, y, accuracy = 10) {
  const [a,b,c] = reference.longitude, [d,e,f] = reference.latitude;
  return {coords: {longitude: a*x+b*y+c, latitude: d*x+e*y+f, accuracy}};
}

const f = fixture();
assert.equal(f.watches.length, 0, 'Pas de demande GPS au chargement');
f.click();
assert.equal(f.watches.length, 1);
assert.equal(f.watches[0].options.enableHighAccuracy, true);
f.watches[0].success(position(682,581));
assert.equal(f.element('my-location').attrs.visibility, 'visible');
assert.match(f.element('location-message').textContent, /GPS ±10 m/);
assert.equal(f.element('location-status').dataset.campus, 'inside');
assert.equal(f.moves.length, 1);
for (const rotation of [0,90,180,270]) {
  f.context.rotation = rotation;
  vm.runInContext('updateLocationMarker()', f.context);
  const [x,y] = f.context.rotatedPoint(682,581);
  const numbers = f.element('location-dot').attrs.transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
  assert.ok(Math.abs(numbers[0]-x) < .0001 && Math.abs(numbers[1]-y) < .0001);
  const matrix = f.element('location-accuracy').attrs.transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
  assert.equal(matrix.length, 6);
  assert.ok(matrix.every(Number.isFinite));
}
f.watches[0].success(position(700,600));
assert.equal(f.moves.length, 1, 'Les mises à jour GPS ne déplacent pas la caméra');
f.click();
assert.equal(f.moves.length, 2, 'Le bouton recentre sur la dernière position');
assert.equal(f.watches.length, 1, 'Un seul suivi GPS');
f.watches[0].success(position(509,855,300));
assert.equal(f.element('my-location').attrs.visibility, 'hidden');
assert.match(f.element('location-message').textContent, /trop imprécise/);
f.watches[0].success(position(5000,5000));
assert.match(f.element('location-message').textContent, /en dehors/);
assert.equal(f.element('location-status').dataset.campus, 'outside');
assert.equal(f.element('my-location').attrs.visibility, 'hidden');
f.element('stop-location').events.click();
assert.deepEqual(f.stopped, [1]);
assert.equal(f.element('location-status').hidden, true);
f.watches[0].success(position(682,581));
assert.equal(f.element('my-location').attrs.visibility, 'hidden', 'Une réponse après arrêt est ignorée');

for (const code of [1,2,3]) {
  const e = fixture(); e.click(); e.watches[0].error({code});
  assert.equal(e.element('locate-me').attrs['aria-pressed'], 'false');
  assert.equal(e.element('my-location').attrs.visibility, 'hidden');
  assert.deepEqual(e.stopped, [1]);
  e.click(); assert.equal(e.watches.length, 2, 'Réessai possible après erreur');
}
const insecure = fixture(false); insecure.click();
assert.equal(insecure.watches.length, 0);
assert.match(insecure.element('location-message').textContent, /HTTPS/);
const unsupported = fixture(); delete unsupported.context.navigator.geolocation; unsupported.click();
assert.equal(unsupported.watches.length, 0);

const campus = fixture(); campus.click();
for (const [x, y, accuracy, expected] of [
  [700,400,3,'inside'],
  [509,855,.5,'inside'],       // Le terrain de football ENSAM appartient au campus.
  [415,850,1,'outside'],      // Le terrain de gauche est celui du voisin.
  [1105,450,1,'outside'],     // Parcelle voisine nord-est.
  [650,930,1,'outside'],      // Parcelle voisine sud-ouest.
  [300,300,3,'outside'],      // Dehors, mais toujours visible sur l’image.
  [736,242,3,'uncertain'],    // Entrée principale, près de la limite.
  [700,400,100,'uncertain'],  // Le cercle GPS atteint la limite.
  [5000,5000,10,'outside']
]) {
  campus.watches[0].success(position(x,y,accuracy));
  assert.equal(campus.element('location-status').dataset.campus, expected, `Position ${x},${y}, précision ${accuracy}`);
  if (expected === 'outside') assert.match(campus.element('location-message').textContent, /en dehors de l’ENSAM/);
  if (expected === 'uncertain') assert.match(campus.element('location-message').textContent, /incertaine/);
}
campus.watches[0].success(position(700,400,3));
assert.equal(campus.element('location-status').dataset.campus, 'inside', 'Le message change lors du retour sur le campus');
console.log('Location checks passed: consent, coordinates, rotations, accuracy, camera, errors, HTTPS, campus boundary and excluded neighbours.');
