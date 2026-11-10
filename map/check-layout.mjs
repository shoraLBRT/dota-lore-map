// Проверка геометрии карты map/layout.json против research/e1/regions.json.
// Запуск из корня репозитория: node map/check-layout.mjs   (Node 22, без зависимостей)
// Exit 1, если найдена хотя бы одна ошибка.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = JSON.parse(readFileSync(join(ROOT, 'map/layout.json'), 'utf8'));
const { regions } = JSON.parse(readFileSync(join(ROOT, 'research/e1/regions.json'), 'utf8'));

const MIN_PLACE_DIST = 0.012; // между местами одного региона, в нормированных координатах
const EDGE_MARGIN = 0.004; // место и подпись не ближе этого к краю своего полигона
const VERTICES = [8, 30];
const EPS = 1e-9;

const errors = [];
const err = (m) => errors.push(m);

// --- геометрия
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const same = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
function onSeg(p, a, b) {
  return Math.abs(cross(a, b, p)) < EPS &&
    Math.min(a[0], b[0]) - EPS <= p[0] && p[0] <= Math.max(a[0], b[0]) + EPS &&
    Math.min(a[1], b[1]) - EPS <= p[1] && p[1] <= Math.max(a[1], b[1]) + EPS;
}
// любое касание или пересечение отрезков
function touches(a, b, c, d) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true;
  return onSeg(a, c, d) || onSeg(b, c, d) || onSeg(c, a, b) || onSeg(d, a, b);
}
// собственное пересечение: отрезки пересекаются во внутренних точках обоих (общие вершины и общие рёбра соседей — не ошибка)
function crosses(a, b, c, d) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}
function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const edges = (poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
const edgeDist = (p, poly) => Math.min(...edges(poly).map(([a, b]) => segDist(p, a, b)));
const strictlyInside = (p, poly) => inside(p, poly) && edgeDist(p, poly) > 1e-7;
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v));
const inUnit = (p) => p.every((v) => v >= 0 && v <= 1);

// --- верхний уровень
if (layout.aspect !== 1.6) err(`aspect должен быть 1.6, сейчас ${layout.aspect}`);
const bands = layout.bands || {};
for (const k of ['upper', 'abyss']) if (!Array.isArray(bands[k]) || bands[k].length !== 2) err(`bands.${k}: нужен [y0, y1]`);

const known = new Map(regions.map((r) => [r.id, r]));
for (const id of Object.keys(layout.regions || {})) if (!known.has(id)) err(`регион ${id} есть в layout, но нет в regions.json`);

// --- регионы
const polys = {};
for (const r of regions) {
  const L = layout.regions?.[r.id];
  if (!L) { err(`регион ${r.id}: нет в layout.json`); continue; }
  const poly = L.polygon;
  if (!Array.isArray(poly) || !poly.every(isPoint)) { err(`регион ${r.id}: polygon — массив [x, y]`); continue; }
  if (poly.length < VERTICES[0] || poly.length > VERTICES[1]) err(`регион ${r.id}: ${poly.length} вершин (нужно ${VERTICES[0]}–${VERTICES[1]})`);
  if (!poly.every(inUnit)) err(`регион ${r.id}: координаты полигона вне [0, 1]`);
  polys[r.id] = poly;

  // самопересечения и повторы вершин
  const E = edges(poly);
  for (let i = 0; i < E.length; i++) {
    if (same(E[i][0], E[i][1])) err(`регион ${r.id}: повтор вершины ${i}`);
    for (let j = i + 1; j < E.length; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === E.length - 1);
      if (adjacent) continue;
      if (touches(E[i][0], E[i][1], E[j][0], E[j][1])) err(`регион ${r.id}: самопересечение рёбер ${i} и ${j}`);
    }
  }

  // ярус: полигон в своей полосе
  const ys = poly.map((p) => p[1]);
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (r.tier === 'upper' && bands.upper && y1 > bands.upper[1] + EPS) err(`регион ${r.id}: выходит из полосы upper (y до ${y1})`);
  if (r.tier === 'abyss' && bands.abyss && y0 < bands.abyss[0] - EPS) err(`регион ${r.id}: выходит из полосы abyss (y от ${y0})`);
  if (r.tier === 'continent' && bands.upper && bands.abyss && (y0 < bands.upper[1] || y1 > bands.abyss[0]))
    err(`регион ${r.id}: материк заходит в полосу яруса (y ${y0}–${y1})`);

  // подпись
  if (!isPoint(L.label) || !inUnit(L.label)) err(`регион ${r.id}: label — [x, y] в [0, 1]`);
  else if (!strictlyInside(L.label, poly) || edgeDist(L.label, poly) < EDGE_MARGIN) err(`регион ${r.id}: label вне полигона или на краю`);

  // камера
  const c = L.camera;
  if (!c || ![c.x, c.y, c.zoom].every((v) => typeof v === 'number' && Number.isFinite(v))) err(`регион ${r.id}: camera {x, y, zoom}`);
  else {
    if (!inUnit([c.x, c.y])) err(`регион ${r.id}: camera вне [0, 1]`);
    if (c.zoom < 1 || c.zoom > 8) err(`регион ${r.id}: camera.zoom ${c.zoom} вне [1, 8]`);
  }
}

// --- полигоны не пересекаются друг с другом (общие рёбра и вершины соседей допустимы)
const ids = Object.keys(polys);
for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
  const P = polys[ids[a]], Q = polys[ids[b]];
  const EP = edges(P), EQ = edges(Q);
  let bad = EP.some(([p1, p2]) => EQ.some(([q1, q2]) => crosses(p1, p2, q1, q2)));
  // вершина или середина ребра одного полигона внутри другого
  const probes = (X) => [...X, ...edges(X).map(([u, v]) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2])];
  bad ||= probes(P).some((p) => strictlyInside(p, Q)) || probes(Q).some((p) => strictlyInside(p, P));
  if (bad) err(`полигоны ${ids[a]} и ${ids[b]} пересекаются`);
}

// --- места
const placeRegion = new Map();
for (const r of regions) for (const l of r.locations) placeRegion.set(l.name, r.id);
const places = layout.places || {};
for (const name of Object.keys(places)) if (!placeRegion.has(name)) err(`место «${name}» есть в layout, но нет в regions.json`);
for (const r of regions) {
  const poly = polys[r.id];
  const placed = [];
  for (const l of r.locations) {
    const pos = places[l.name]?.pos;
    if (!isPoint(pos)) { err(`место «${l.name}» (${r.id}): нет позиции`); continue; }
    if (!inUnit(pos)) { err(`место «${l.name}»: координаты вне [0, 1]`); continue; }
    if (poly && (!strictlyInside(pos, poly) || edgeDist(pos, poly) < EDGE_MARGIN)) err(`место «${l.name}»: не внутри полигона ${r.id}`);
    for (const [other, q] of placed) {
      const d = Math.hypot(pos[0] - q[0], pos[1] - q[1]);
      if (d < MIN_PLACE_DIST) err(`места «${l.name}» и «${other}» ближе ${MIN_PLACE_DIST} (${d.toFixed(4)})`);
    }
    placed.push([l.name, pos]);
  }
}

const nPlaces = regions.reduce((n, r) => n + r.locations.length, 0);
if (errors.length) {
  console.error('ОШИБКИ layout.json:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`OK: ${ids.length} регионов, ${nPlaces} мест; полигоны без пересечений, места внутри своих регионов`);
