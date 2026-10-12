// 1. Données de la page et état de l’interface.
// JavaScript relie les boutons au serveur Python et au plan.
const places = JSON.parse(document.getElementById('places-data').textContent);
const search = document.getElementById('search');
const results = document.getElementById('results');
const map = document.getElementById('campus-map');
const detail = document.getElementById('detail');
// Garder les références évite de rechercher les mêmes éléments à chaque image.
const mapLabels = places.map(place => {
  const element = map.querySelector('.map-place[data-id="' + place.id + '"]');
  return {place, element, group: element.querySelector('.map-label'), text: element.querySelector('.known-name')};
});
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
let hoveredPlace = null;
let drawFrame = null;
let category = 'all';
let selected = null;
let requestNumber = 0;
let searchTimer;

// Le recentrage ne doit pas créer un survol sur un autre bâtiment.
function clearHover() {
  if (hoveredPlace) hoveredPlace.classList.remove('hovered');
  hoveredPlace = null;
}
function updateHover(target) {
  const place = target.closest('.map-place');
  if (place === hoveredPlace) return;
  clearHover();
  hoveredPlace = place;
  if (place) {
    place.classList.add('hovered');
    updateLabels();
  }
}
function scheduleDraw() {
  if (drawFrame === null) drawFrame = requestAnimationFrame(drawView);
}

// De petits pictogrammes, dessinés ici pour éviter une bibliothèque.
const icons = {
  'Entrées': '<path d="M5 20V4h12v16M9 20V8h8M13 14h1M3 20h18"/>',
  'Sport': '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M3 9h3v6H3m18-6h-3v6h3"/><circle cx="12" cy="12" r="3"/>',
  'Bâtiments': '<path d="M4 20V5h10v15M14 10h6v10M2 20h20M7 9h4M7 13h4M7 17h4M17 14h1"/>'
};

// 2. Résultats de recherche et fiche du lieu choisi.
function makeCard(place) {
  const button = document.createElement('button');
  button.className = 'place-card';
  button.dataset.id = place.id;
  button.classList.toggle('selected', selected === place.id);
  button.setAttribute('aria-pressed', selected === place.id);
  button.innerHTML = '<span class="place-icon"><svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[place.category] || icons['Bâtiments']) + '</svg></span><span class="place-copy"><span class="place-name"></span><span class="place-subtitle"></span></span><span class="card-arrow" aria-hidden="true">↗</span>';
  button.querySelector('.place-name').textContent = place.name;
  button.querySelector('.place-subtitle').textContent = place.category + ' · Campus ENSAM';
  button.addEventListener('click', () => selectPlace(place.id));
  return button;
}

function renderResults(list) {
  results.replaceChildren();
  for (const place of list) results.append(makeCard(place));
  document.getElementById('result-count').textContent = list.length;
  document.getElementById('search-status').textContent = list.length ? '' : 'Aucun lieu trouvé. Essayez « amphi », « buvette » ou « toilettes ».';
  map.classList.toggle('filtered-view', category !== 'all' || search.value.trim() !== '');
  document.getElementById('clear-search').hidden = search.value === '';
  const ids = list.map(place => place.id);
  for (const element of document.querySelectorAll('.map-place')) {
    const matches = ids.includes(element.dataset.id);
    element.classList.toggle('filtered-out', !matches);
    element.setAttribute('tabindex', matches ? '0' : '-1');
    element.setAttribute('aria-hidden', !matches);
  }
  updateSheetHeight();
}

async function updateResults() {
  // Seule la réponse de la dernière recherche est affichée.
  const number = ++requestNumber;
  try {
    const url = '/api/places?q=' + encodeURIComponent(search.value) + '&category=' + encodeURIComponent(category);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Search unavailable');
    const list = await response.json();
    if (number === requestNumber) {
      renderResults(list);
      recenterMap();
    }
  } catch (error) {
    if (number === requestNumber) document.getElementById('search-status').textContent = 'La recherche est indisponible. Réessayez dans un instant.';
  }
}

function selectPlace(id) {
  const place = places.find(place => place.id === id);
  if (!place) return;
  clearHover();
  selected = id;
  for (const element of document.querySelectorAll('[data-id]')) {
    const active = element.dataset.id === id;
    element.classList.toggle('selected', active);
    element.setAttribute('aria-pressed', active);
  }
  document.getElementById('detail-category').textContent = place.category;
  document.getElementById('detail-title').textContent = place.name;
  document.getElementById('detail-description').textContent = place.description;
  document.getElementById('detail-id').textContent = 'Lieu du campus';
  detail.hidden = false;
  document.getElementById('results-area').hidden = true;
  document.body.classList.add('has-selection');
  document.body.classList.remove('detail-collapsed');
  document.getElementById('close-detail').focus({preventScroll: true});
  updateSheetHeight();
  focusSelected();
}

document.getElementById('close-detail').addEventListener('click', () => {
  selected = null;
  detail.hidden = true;
  document.getElementById('results-area').hidden = false;
  document.body.classList.remove('has-selection', 'detail-collapsed');
  updateSheetHeight();
  for (const element of document.querySelectorAll('[data-id]')) {
    element.classList.remove('selected');
    element.setAttribute('aria-pressed', 'false');
  }
  // Revenir au campus après la fermeture, avec la nouvelle hauteur du panneau.
  recenterMap();
});

// 3. Recherche, filtres, clavier et panneau mobile.
search.addEventListener('input', () => {
  document.body.classList.remove('panel-collapsed');
  document.body.classList.toggle('sheet-expanded', search.value.trim() !== '' || category !== 'all');
  if (selected) document.getElementById('close-detail').click();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(updateResults, 150);
});
for (const button of document.querySelectorAll('.filter')) {
  button.addEventListener('click', () => {
    category = button.dataset.category;
    document.body.classList.remove('panel-collapsed');
    document.body.classList.toggle('sheet-expanded', category !== 'all' || search.value.trim() !== '');
    if (selected) document.getElementById('close-detail').click();
    for (const filter of document.querySelectorAll('.filter')) {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', active);
    }
    updateResults();
  });
}
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === 'Escape' && selected) document.getElementById('close-detail').click();
});
document.getElementById('clear-search').addEventListener('click', () => {
  search.value = '';
  search.dispatchEvent(new Event('input'));
  search.focus();
});
function togglePanel() {
  const phone = window.matchMedia('(max-width: 720px)').matches;
  if (phone && selected) document.body.classList.toggle('detail-collapsed');
  else document.body.classList.toggle(phone ? 'sheet-expanded' : 'panel-collapsed');
  updateSheetHeight();
  recenterMap();
}
document.getElementById('toggle-panel').addEventListener('click', togglePanel);
document.getElementById('toggle-sheet').addEventListener('click', togglePanel);

// 4. Vue de la carte : position, zoom, rotation et recentrage.
// Le viewBox est la fenêtre visible du plan : x, y, largeur, hauteur.
const phoneLayout = window.matchMedia('(max-width: 720px)');
let rotation = 180; // L’entrée principale apparaît en bas du plan.
// La rotation reste visuelle : les coordonnées originales ne sont pas modifiées.
function rotatedPoint(x, y) {
  if (rotation === 90) return [1310 - y, x - 110];
  if (rotation === 180) return [1420 - x, 1200 - y];
  if (rotation === 270) return [y + 110, 1310 - x];
  return [x, y];
}
function updateSheetHeight() {
  const height = document.getElementById('panel-content').getBoundingClientRect().height;
  document.body.style.setProperty('--sheet-height', height + 'px');
  const expanded = phoneLayout.matches ? (selected ? !document.body.classList.contains('detail-collapsed') : document.body.classList.contains('sheet-expanded')) : !document.body.classList.contains('panel-collapsed');
  document.getElementById('toggle-panel').setAttribute('aria-expanded', expanded);
  document.getElementById('toggle-panel').setAttribute('aria-label', expanded ? 'Réduire la liste des lieux' : 'Développer la liste des lieux');
  document.getElementById('toggle-sheet').setAttribute('aria-expanded', expanded);
  document.getElementById('toggle-sheet').setAttribute('aria-label', expanded ? 'Réduire le panneau' : 'Développer le panneau');
}
function visibleSheetHeight() {
  const panel = document.getElementById('panel-content');
  const expanded = document.body.classList.contains('sheet-expanded') || selected;
  const limit = document.body.classList.contains('detail-collapsed') ? 190 : (expanded ? map.clientHeight * .6 : 200);
  const content = selected ? detail : document.getElementById('results-area');
  // Mesurer le contenu permet de connaître la hauteur finale pendant l’animation.
  const height = content.offsetHeight + document.getElementById('toggle-sheet').offsetHeight + parseFloat(getComputedStyle(panel).paddingBottom);
  return Math.min(height, limit);
}
function visibleMapArea() {
  const rect = map.getBoundingClientRect();
  const filters = document.querySelector('.filters').getBoundingClientRect();
  return {
    left: phoneLayout.matches ? 16 : document.querySelector('.search-panel').getBoundingClientRect().right - rect.left + 24,
    right: rect.width - (phoneLayout.matches ? 16 : 48),
    top: filters.bottom - rect.top + 16,
    bottom: rect.height - (phoneLayout.matches ? visibleSheetHeight() + 20 : 30)
  };
}
function visibleCenter() {
  const area = visibleMapArea();
  return [(area.left + area.right) / 2, (area.top + area.bottom) / 2];
}
// Le déplacement reste dans le décor étendu autour du campus.
function limitPan(target, area = visibleMapArea()) {
  const corners = [rotatedPoint(-253.84, -31.69), rotatedPoint(1670.62, 1202.07)];
  if (!phoneLayout.matches) { area.top = 0; area.bottom = lastSize[1]; }
  const scale = target[2] / lastSize[0];
  const limits = [
    [Math.min(corners[0][0], corners[1][0]) - area.left * scale, Math.max(corners[0][0], corners[1][0]) - area.right * scale],
    [Math.min(corners[0][1], corners[1][1]) - area.top * scale, Math.max(corners[0][1], corners[1][1]) - area.bottom * scale]
  ];
  return target.map((value, index) => index < 2 && limits[index][0] <= limits[index][1]
    ? Math.max(limits[index][0], Math.min(limits[index][1], value)) : value);
}
function campusView() {
  const rect = map.getBoundingClientRect();
  const area = visibleMapArea();
  const width = Math.max(40, area.right - area.left);
  const height = Math.max(40, area.bottom - area.top);
  const sideways = rotation === 90 || rotation === 270;
  const scale = Math.max(.03, Math.min(width / (sideways ? 835 : 855), height / (sideways ? 855 : 835)));
  const center = [(area.left + area.right) / 2, (area.top + area.bottom) / 2];
  const campus = rotatedPoint(785, 625);
  return [campus[0] - center[0] / scale, campus[1] - center[1] / scale, rect.width / scale, rect.height / scale];
}
function recenterMap() {
  initialView = campusView();
  if (selected) focusSelected();
  else moveView(initialView, 500);
}
let initialView = campusView();
let view = [...initialView];
let cameraFrame = null;
let cameraTarget = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function stopCamera() {
  cancelAnimationFrame(cameraFrame);
  cameraFrame = null;
  cameraTarget = null;
}
// Une seule animation de caméra : zoom, sélection et retour au campus.
function moveView(target, duration = 350) {
  stopCamera();
  clearHover();
  if (reducedMotion.matches) { view = [...target]; drawView(); return; }
  const start = [...view];
  const time = performance.now();
  cameraTarget = [...target];
  function step(now) {
    const progress = Math.min(1, (now - time) / duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    view = start.map((value, index) => value + (target[index] - value) * ease);
    drawView();
    if (progress < 1) cameraFrame = requestAnimationFrame(step);
    else { cameraFrame = null; cameraTarget = null; }
  }
  cameraFrame = requestAnimationFrame(step);
}
let lastSize = [map.clientWidth, map.clientHeight];
window.addEventListener('resize', () => {
  if (map.clientWidth === lastSize[0] && map.clientHeight === lastSize[1]) return;
  lastSize = [map.clientWidth, map.clientHeight];
  stopCamera();
  if (phoneLayout.matches) document.body.classList.remove('panel-collapsed');
  updateSheetHeight();
  initialView = campusView();
  view = [...initialView];
  if (selected) focusSelected();
  else drawView();
});

function drawView() {
  cancelAnimationFrame(drawFrame);
  drawFrame = null;
  map.setAttribute('viewBox', view.join(' '));
  zoomInButton.disabled = view[2] <= initialView[2] / 4;
  zoomOutButton.disabled = view[2] >= initialView[2];
  updateLabels();
  updateLocationMarker();
}
function updateLabels() {
  // Seuls les noms visibles sont mis à jour ; aucune mesure de mise en page ici.
  const scale = view[2] / lastSize[0];
  for (const item of mapLabels) {
    const {place, element, group, text} = item;
    if (!place.id.startsWith('GATE') && selected !== place.id && hoveredPlace !== element && document.activeElement !== element) continue;
    const point = rotatedPoint(place.x, place.y);
    group.setAttribute('transform', 'translate(' + point[0] + ' ' + point[1] + ') scale(' + scale + ')');
    text.setAttribute('y', selected === place.id ? '4' : '12');
    const screenX = (point[0] - view[0]) / scale;
    const anchor = screenX < 80 ? 'start' : (screenX > lastSize[0] - 80 ? 'end' : 'middle');
    text.setAttribute('text-anchor', anchor);
    text.setAttribute('x', anchor === 'start' ? '12' : (anchor === 'end' ? '-12' : '0'));
  }
}
map.addEventListener('focusin', updateLabels);

function zoom(factor, point, smooth = true, area) {
  const rect = {width: lastSize[0], height: lastSize[1]};
  const anchor = point || [rect.width / 2, rect.height / 2];
  const base = cameraTarget || view;
  const width = Math.max(initialView[2] / 4, Math.min(initialView[2], base[2] * factor));
  // Le campus entier est le niveau maximal de dézoom, pour tous les gestes.
  if (width === base[2]) {
    if (!smooth) scheduleDraw();
    return;
  }
  const height = width * rect.height / rect.width;
  const target = limitPan([base[0] + (base[2] - width) * anchor[0] / rect.width, base[1] + (base[3] - height) * anchor[1] / rect.height, width, height], area);
  if (smooth) moveView(target, 240);
  else { stopCamera(); view = target; scheduleDraw(); }
}
document.getElementById('zoom-in').addEventListener('click', () => zoom(0.8));
document.getElementById('zoom-out').addEventListener('click', () => zoom(1.25));
function applyRotation() {
  const transform = 'rotate(' + rotation + ' 710 600)';
  document.getElementById('map-artwork').setAttribute('transform', transform);
  for (const outline of document.querySelectorAll('.hit-area')) outline.setAttribute('transform', transform);
  // Les noms suivent leur avenue et restent lisibles dans les quatre orientations.
  for (const name of document.querySelectorAll('.avenue-names text')) {
    const point = rotatedPoint(Number(name.dataset.x), Number(name.dataset.y));
    let angle = Number(name.dataset.angle) + rotation;
    while (angle > 90) angle -= 180;
    name.setAttribute('transform', 'translate(' + point.join(' ') + ') rotate(' + angle + ')');
  }
  document.getElementById('rotate-map').title = 'Pivoter de 90° · Orientation actuelle : ' + rotation + '°';
}
document.getElementById('rotate-map').addEventListener('click', () => {
  stopCamera();
  rotation = (rotation + 90) % 360;
  applyRotation();
  initialView = campusView();
  if (selected) focusSelected();
  else moveView(initialView, 400);
});
function focusSelected() {
  const place = places.find(place => place.id === selected);
  if (!place) return;
  const rect = map.getBoundingClientRect();
  const area = visibleMapArea();
  const center = visibleCenter();
  const bounds = document.querySelector('.map-place[data-id="' + selected + '"] .hit-area').getBBox();
  const sideways = rotation === 90 || rotation === 270;
  const roomWidth = Math.max(80, area.right - area.left - 32);
  const roomHeight = Math.max(80, area.bottom - area.top - 32);
  const fit = Math.max(((sideways ? bounds.height : bounds.width) + 80) * rect.width / roomWidth, ((sideways ? bounds.width : bounds.height) + 80) * rect.width / Math.max(roomHeight, 120));
  const width = Math.min(initialView[2], Math.max(initialView[2] * .3, fit));
  const scale = width / rect.width;
  const point = rotatedPoint(place.x, place.y);
  const target = [point[0] - center[0] * scale, point[1] - center[1] * scale, width, rect.height * scale];
  moveView(target, 600);
}
document.getElementById('focus-place').addEventListener('click', focusSelected);

// 5. GPS et vérification de la limite du campus.
// Localisation : uniquement dans le navigateur, jamais envoyée au serveur.
const locationReference = JSON.parse(document.getElementById('location-data').textContent);
const locateButton = document.getElementById('locate-me');
const locationMarker = document.getElementById('my-location');
const locationStatus = document.getElementById('location-status');
let locationWatch = null;
let locationRequest = 0;
let currentPosition = null;
let centerNextPosition = false;

function locationImagePoint(longitude, latitude) {
  const [a, b, c] = locationReference.longitude;
  const [d, e, f] = locationReference.latitude;
  const determinant = a * e - b * d;
  return [((longitude - c) * e - (latitude - f) * b) / determinant,
    ((latitude - f) * a - (longitude - c) * d) / determinant];
}
function locationMessage(message) {
  const element = document.getElementById('location-message');
  if (element.textContent !== message) element.textContent = message;
  locationStatus.hidden = false;
}
function campusPosition(position) {
  const {longitude, latitude, accuracy} = position;
  const metersEast = 111320 * Math.cos(latitude * Math.PI / 180);
  let inside = false;
  let distance = Infinity;
  // Un contour extérieur et deux trous pour les parcelles voisines.
  for (const ring of locationReference.boundary) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lonA, latA] = ring[i], [lonB, latB] = ring[i+1];
      if ((latA > latitude) !== (latB > latitude) && longitude < (lonB-lonA) * (latitude-latA) / (latB-latA) + lonA) inside = !inside;
      // Distance au segment en mètres, pour tenir compte de la précision GPS.
      const ax = (lonA-longitude) * metersEast, ay = (latA-latitude) * 111320;
      const dx = (lonB-lonA) * metersEast, dy = (latB-latA) * 111320;
      const length = dx*dx + dy*dy;
      const t = length ? Math.max(0, Math.min(1, -(ax*dx + ay*dy) / length)) : 0;
      distance = Math.min(distance, Math.hypot(ax + t*dx, ay + t*dy));
    }
  }
  // La marge est une précaution autour du dessin, pas une précision mesurée.
  if (distance <= accuracy + locationReference.margin_m) return 'uncertain';
  return inside ? 'inside' : 'outside';
}
function showCampusLocation() {
  const state = campusPosition(currentPosition);
  const precision = 'GPS ±' + Math.ceil(currentPosition.accuracy) + ' m';
  locationStatus.dataset.campus = state;
  if (state === 'outside') locationMessage('Vous êtes en dehors de l’ENSAM Rabat · ' + precision);
  else if (currentPosition.accuracy > 200) locationMessage('Position trop imprécise (' + precision + '). Présence sur le campus incertaine.');
  else if (state === 'uncertain') locationMessage('Près de la limite : présence dans l’ENSAM incertaine · ' + precision);
  else locationMessage('Vous êtes dans l’ENSAM Rabat · ' + precision + ' · Plan approximatif');
}
function locationOnMap() {
  if (!currentPosition) return false;
  const [x, y] = locationImagePoint(currentPosition.longitude, currentPosition.latitude);
  // Le décor ajouté est imaginé : ne pas y afficher une position GPS.
  return x >= 0 && x <= 1420 && y >= 140 && y <= 1060;
}
function updateLocationMarker() {
  const visible = locationOnMap() && currentPosition.accuracy <= 200;
  locationMarker.setAttribute('visibility', visible ? 'visible' : 'hidden');
  if (!visible) return;
  const {longitude, latitude, accuracy} = currentPosition;
  const image = locationImagePoint(longitude, latitude);
  const point = rotatedPoint(...image);
  // Deux rayons perpendiculaires en mètres deviennent une ellipse sur l’image.
  const north = rotatedPoint(...locationImagePoint(longitude, latitude + accuracy / 111320));
  const east = rotatedPoint(...locationImagePoint(longitude + accuracy / (111320 * Math.cos(latitude * Math.PI / 180)), latitude));
  document.getElementById('location-accuracy').setAttribute('transform',
    'matrix(' + [east[0]-point[0], east[1]-point[1], north[0]-point[0], north[1]-point[1], ...point].join(' ') + ')');
  document.getElementById('location-dot').setAttribute('transform', 'translate(' + point.join(' ') + ') scale(' + view[2] / lastSize[0] + ')');
}
function centerLocation() {
  if (!locationOnMap() || currentPosition.accuracy > 200) return;
  if (selected) document.getElementById('close-detail').click();
  const point = rotatedPoint(...locationImagePoint(currentPosition.longitude, currentPosition.latitude));
  const center = visibleCenter();
  const width = Math.min(initialView[2] * .55, Math.max(initialView[2] / 4, view[2]));
  const scale = width / lastSize[0];
  moveView([point[0] - center[0] * scale, point[1] - center[1] * scale, width, lastSize[1] * scale], 500);
}
function stopLocation() {
  if (locationWatch !== null) navigator.geolocation.clearWatch(locationWatch);
  locationWatch = null;
  locationRequest++; // Ignorer une réponse arrivée après l’arrêt.
  currentPosition = null;
  centerNextPosition = false;
  locateButton.setAttribute('aria-pressed', 'false');
  locateButton.removeAttribute('aria-busy');
  locationMarker.setAttribute('visibility', 'hidden');
  locationStatus.hidden = true;
  delete locationStatus.dataset.campus;
}
locateButton.addEventListener('click', () => {
  if (!window.isSecureContext || !navigator.geolocation) {
    locationMessage('La localisation nécessite HTTPS et un navigateur compatible. Ouvrez le lien public.');
    return;
  }
  if (locationWatch !== null) {
    if (currentPosition) { showCampusLocation(); centerLocation(); }
    else locationMessage('Recherche de votre position… Placez-vous à l’extérieur.');
    return;
  }
  const request = ++locationRequest;
  centerNextPosition = true;
  locateButton.setAttribute('aria-pressed', 'true');
  locateButton.setAttribute('aria-busy', 'true');
  locationMessage('Recherche de votre position…');
  locationWatch = navigator.geolocation.watchPosition(position => {
    if (request !== locationRequest) return;
    const {longitude, latitude, accuracy} = position.coords;
    if (![longitude, latitude, accuracy].every(Number.isFinite) || accuracy <= 0) return;
    currentPosition = {longitude, latitude, accuracy};
    locateButton.removeAttribute('aria-busy');
    showCampusLocation();
    updateLocationMarker();
    if (centerNextPosition && locationOnMap() && accuracy <= 200) {
      centerNextPosition = false;
      centerLocation();
    }
  }, error => {
    if (request !== locationRequest) return;
    stopLocation();
    const messages = {1: 'Localisation refusée. Autorisez-la dans les réglages du navigateur pour réessayer.',
      2: 'Position indisponible. Placez-vous à l’extérieur et réessayez.',
      3: 'La recherche a expiré. Appuyez sur le bouton pour réessayer.'};
    locationMessage(messages[error.code] || 'Localisation indisponible. Réessayez.');
  }, {enableHighAccuracy: true, timeout: 15000, maximumAge: 5000});
});
document.getElementById('stop-location').addEventListener('click', stopLocation);
window.addEventListener('pagehide', stopLocation);
// Fin de la localisation.

// 6. Molette, glissement à un doigt et pincement à deux doigts.
map.addEventListener('wheel', event => {
  event.preventDefault();
  const rect = map.getBoundingClientRect();
  zoom(event.deltaY < 0 ? .9 : 1.1, [event.clientX - rect.left, event.clientY - rect.top]);
}, {passive: false});
map.addEventListener('dblclick', event => {
  const rect = map.getBoundingClientRect();
  zoom(.7, [event.clientX - rect.left, event.clientY - rect.top]);
});

// Un glissement déplace le plan ; un clic ouvre une fiche.
let drag = null;
const touches = {};
let pinch = null;
map.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  stopCamera();
  touches[event.pointerId] = [event.clientX, event.clientY];
  const points = Object.values(touches);
  if (points.length === 2) {
    pinch = {distance: Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]), view: [...view], area: visibleMapArea(), rect: map.getBoundingClientRect()};
    drag = null;
    map.setPointerCapture(event.pointerId);
    return;
  }
  const matrix = map.getScreenCTM();
  drag = {x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, time: performance.now(), vx: 0, vy: 0, view: [...view], area: visibleMapArea(), scale: matrix.a, moved: false, target: event.target.closest('[data-id]'), pointerId: event.pointerId};
  map.setPointerCapture(event.pointerId);
});
map.addEventListener('pointermove', event => {
  if (!touches[event.pointerId]) {
    updateHover(event.target);
    return;
  }
  touches[event.pointerId] = [event.clientX, event.clientY];
  const points = Object.values(touches);
  if (pinch && points.length === 2) {
    const distance = Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]);
    view = [...pinch.view];
    const rect = pinch.rect;
    zoom(pinch.distance / Math.max(distance, 1), [(points[0][0] + points[1][0]) / 2 - rect.left, (points[0][1] + points[1][1]) / 2 - rect.top], false, pinch.area);
    return;
  }
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
  if (drag.moved) {
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.time);
    drag.vx = .5 * drag.vx + .5 * (event.clientX - drag.lastX) / elapsed;
    drag.vy = .5 * drag.vy + .5 * (event.clientY - drag.lastY) / elapsed;
    drag.lastX = event.clientX; drag.lastY = event.clientY; drag.time = now;
    map.classList.add('dragging');
    view = limitPan([drag.view[0] - dx / drag.scale, drag.view[1] - dy / drag.scale, drag.view[2], drag.view[3]], drag.area);
    scheduleDraw();
  }
});
map.addEventListener('pointerup', event => {
  delete touches[event.pointerId];
  if (pinch) { pinch = null; drag = null; return; }
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.moved && drag.target) selectPlace(drag.target.dataset.id);
  if (drag.moved && performance.now() - drag.time < 90) {
    const dx = Math.max(-180, Math.min(180, drag.vx * 150)) / drag.scale;
    const dy = Math.max(-180, Math.min(180, drag.vy * 150)) / drag.scale;
    moveView(limitPan([view[0] - dx, view[1] - dy, view[2], view[3]], drag.area), 400);
  }
  drag = null;
  map.classList.remove('dragging');
});
map.addEventListener('pointercancel', event => { delete touches[event.pointerId]; pinch = null; drag = null; map.classList.remove('dragging'); });
map.addEventListener('pointerleave', clearHover);
map.addEventListener('keydown', event => {
  const place = event.target.closest('[data-id]');
  if (place && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    selectPlace(place.dataset.id);
  }
  if (event.key === '+' || event.key === '=') zoom(.8);
  if (event.key === '-') zoom(1.25);
});

// 7. Affichage initial, une fois la page chargée.

applyRotation();
renderResults(places);
initialView = campusView();
view = [...initialView];
new ResizeObserver(updateSheetHeight).observe(document.getElementById('panel-content'));
drawView();
