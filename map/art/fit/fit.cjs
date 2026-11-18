// Перевод map/layout.json в квадратный кадр и подгонка берегов к маске суши арта.
const fs = require('fs');
const [S, layoutPath] = process.argv.slice(2);
const N = 1000;
const lab = new Int32Array(fs.readFileSync(S + '/lab.bin').buffer.slice(0));
const { comps } = JSON.parse(fs.readFileSync(S + '/lab.json', 'utf8'));
for (let i = 0; i < 258 * N; i++) if (lab[i] === 27) lab[i] = -1; // облако у северного берега
const L = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const { regions: meta } = JSON.parse(fs.readFileSync('research/e1/regions.json', 'utf8'));
const tierOf = Object.fromEntries(meta.map((r) => [r.id, r.tier]));
const r4 = (v) => Math.round(v * 10000) / 10000;
const ty = (y) => (y * 1000 + 290) / 1600;
const TIERS = ['heavens', 'planes', 'underdark', 'hells'];

// ---------- 1. перенос материка
for (const [id, r] of Object.entries(L.regions)) {
  if (TIERS.includes(id)) continue;
  r.polygon = r.polygon.map(([x, y]) => [x, ty(y)]);
  r.label = [r.label[0], ty(r.label[1])];
}
const placeRegion = {};
for (const m of meta) for (const p of m.locations) placeRegion[p.name] = m.id;
for (const [name, p] of Object.entries(L.places)) if (!TIERS.includes(placeRegion[name])) p.pos = [p.pos[0], ty(p.pos[1])];

// ---------- 2. контуры компонент маски (Moore tracing)
const COMP = { north: 27, south: 35, tropic: 33, cladd: 39, unch: 31 };
function trace(id) {
  let start = -1;
  for (let i = 0; i < N * N; i++) if (lab[i] === id) { start = i; break; }
  const inC = (x, y) => x >= 0 && y >= 0 && x < N && y < N && lab[y * N + x] === id;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  let x = start % N, y = (start / N) | 0, d = 7; const sx = x, sy = y; const out = [];
  do {
    out.push([(x + 0.5) / N, (y + 0.5) / N]);
    let k = (d + 6) % 8, found = false;
    for (let t = 0; t < 8; t++) { const [dx, dy] = dirs[(k + t) % 8]; if (inC(x + dx, y + dy)) { x += dx; y += dy; d = (k + t) % 8; found = true; break; } }
    if (!found) break;
  } while (!(x === sx && y === sy) && out.length < 200000);
  return out;
}
const contours = Object.fromEntries(Object.entries(COMP).map(([k, id]) => [k, trace(id)]));
const landRegions = Object.keys(L.regions).filter((id) => !TIERS.includes(id) && id !== 'the-deep');
const compOf = (id) => {
  if (id === 'cladd') return 'tropic'; if (id === 'tropic-isles') return 'cladd'; if (id === 'uncharted') return 'unch';
  const SOUTH = ['hoven', 'fellstrath', 'empire-of-bone', 'scintillant', 'druud', 'tomokan', 'wailing-mountains', 'shadeshore'];
  return SOUTH.includes(id) ? 'south' : 'north';
};

// ---------- 3. Дуглас—Пекер
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
function dp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  let best = 0, bi = 0; for (let i = 1; i < pts.length - 1; i++) { const d = segD(pts[i], pts[0], pts[pts.length - 1]); if (d > best) { best = d; bi = i; } }
  if (best <= eps) return [pts[0], pts[pts.length - 1]];
  const a = dp(pts.slice(0, bi + 1), eps), b = dp(pts.slice(bi), eps); return [...a.slice(0, -1), ...b];
}
const simplify = (pts, maxInner) => { let eps = 0.0025; let s; do { s = dp(pts, eps); eps *= 1.15; } while (s.length - 2 > maxInner); return s; };
const nearestIdx = (c, p) => { let bi = 0, bd = 1e9; c.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };

// ---------- 4. береговые прогоны
const k = (p) => p.map((v) => v.toFixed(6)).join(',');
const moveVertex = (from, to) => { const kf = k(from); for (const id of landRegions) L.regions[id].polygon = L.regions[id].polygon.map((p) => (k(p) === kf ? to.slice() : p)); };
// Skywrath (#158) появился после основы арта: граница с Nightsilver и Quoidge — западнее, у берега
{
  const P = L.regions.skywrath.polygon.map((p) => p.slice());
  moveVertex(P[0], [0.733, P[0][1]]); moveVertex(P[1], [0.742, 0.322]); moveVertex(P[2], [0.75, 0.347]); moveVertex(P[3], [0.748, 0.372]);
}
// внутренние вершины (общие для двух регионов одного материка), попавшие в море или к самому берегу, — на сушу
{
  const owners = {};
  for (const id of landRegions) for (const p of L.regions[id].polygon) (owners[k(p)] ??= new Set()).add(id);
  const dist = (comp, p) => Math.min(...contours[comp].map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
  const isLand = (comp, p) => lab[Math.floor(p[1] * N) * N + Math.floor(p[0] * N)] === COMP[comp];
  const edgeSet = {};
  for (const id of landRegions) { const P = L.regions[id].polygon; P.forEach((a, i) => { const e = [k(a), k(P[(i + 1) % P.length])].sort().join('|'); (edgeSet[e] ??= []).push(id); }); }
  const sharedSameComp = (a, b) => (edgeSet[[k(a), k(b)].sort().join('|')] || []).filter((o, _, arr) => arr.length > 1 && arr.every((x) => compOf(x) === compOf(o))).length > 1;
  for (const id of landRegions) {
    const P = L.regions[id].polygon; const n = P.length; const comp = compOf(id);
    P.forEach((p, i) => {
      const prevIn = sharedSameComp(P[(i - 1 + n) % n], p), nextIn = sharedSameComp(p, P[(i + 1) % n]);
      if (!(prevIn && nextIn)) return; // стык с берегом или береговая вершина — их подгонит контур
      if ([...owners[k(p)]].some((o) => compOf(o) !== comp)) return; // стык с другим материком
      if (Math.abs(p[0] - 0.578) < 1e-6 && Math.abs(p[1] - 0.5156) < 0.001) { console.log('на сушу (вручную):', id); moveVertex(p, [0.582, 0.499]); for (const o of landRegions) for (const v of L.regions[o].polygon) if (Math.abs(v[0] - 0.59) < 1e-6 && Math.abs(v[1] - 0.5344) < 0.001) { moveVertex(v, [0.589, 0.509]); break; } return; }
      if (isLand(comp, p) && dist(comp, p) > 0.006) return;
      const regs = [...owners[k(p)]].filter((o) => compOf(o) === comp);
      const c = regs.flatMap((o) => L.regions[o].polygon).reduce((s, q, _, a) => [s[0] + q[0] / a.length, s[1] + q[1] / a.length], [0, 0]);
      let q = p.slice();
      for (let t = 0; t < 100 && !(isLand(comp, q) && dist(comp, q) > 0.009); t++) q = [q[0] + (c[0] - q[0]) * 0.04, q[1] + (c[1] - q[1]) * 0.04];
      console.log('на сушу:', id, p.map((v) => v.toFixed(4)).join(','), '→', q.map((v) => v.toFixed(4)).join(','));
      moveVertex(p, q);
    });
  }
}
const edgeOwners = {};
for (const id of landRegions) { const P = L.regions[id].polygon; P.forEach((a, i) => { const b = P[(i + 1) % P.length]; const e = [k(a), k(b)].sort().join('|'); (edgeOwners[e] ??= []).push(id); }); }
const interior = (id, a, b) => (edgeOwners[[k(a), k(b)].sort().join('|')] || []).some((o) => o !== id && compOf(o) === compOf(id));
const snap = new Map(); // старая вершина-стык -> новая
const newPolys = {};
for (const id of landRegions) {
  const P = L.regions[id].polygon; const n = P.length; const C = contours[compOf(id)];
  const coast = P.map((a, i) => !interior(id, a, P[(i + 1) % n]));
  if (coast.every(Boolean)) { // остров целиком
    const s = simplify([...C, C[0]], 22).slice(0, -1); newPolys[id] = s; continue;
  }
  // начать с вершины, перед которой ребро внутреннее
  let s0 = coast.findIndex((c, i) => !c && coast[(i + 1) % n]); s0 = (s0 + 1) % n;
  const runs = []; const keep = [];
  let t = 0;
  while (t < n) {
    if (coast[(s0 + t) % n]) { const run = [(s0 + t) % n]; while (t < n && coast[(s0 + t) % n]) { t++; run.push((s0 + t) % n); } runs.push(run); } else t++;
  }
  newPolys[id] = { P, coast, runs, C };
}
// стыки: одна и та же старая вершина → одна точка контура
const contourPoint = (comp, p) => { const C = contours[comp]; return C[nearestIdx(C, p)]; };
for (const id of landRegions) { const o = newPolys[id]; if (Array.isArray(o)) continue; for (const run of o.runs) for (const j of [run[0], run[run.length - 1]]) { const p = o.P[j]; const sk = compOf(id) + '|' + k(p); if (!snap.has(sk)) snap.set(sk, contourPoint(compOf(id), p)); } }
// полигоны
const totalCoastLen = {};
for (const id of landRegions) {
  const o = newPolys[id]; if (Array.isArray(o)) continue;
  const { P, runs, C } = o; const n = P.length;
  const inRun = new Set(runs.flatMap((r) => r.slice(1, -1)));
  const fixed = P.filter((_, i) => !inRun.has(i)).length;
  const budget = 30 - fixed;
  const lens = runs.map((r) => r.slice(1).reduce((s, j, t) => s + Math.hypot(P[j][0] - P[r[t]][0], P[j][1] - P[r[t]][1]), 0));
  const tot = lens.reduce((a, b) => a + b, 0);
  const paths = runs.map((run, ri) => {
    const a = snap.get(compOf(id) + '|' + k(P[run[0]])), b = snap.get(compOf(id) + '|' + k(P[run[run.length - 1]]));
    const ia = nearestIdx(C, a), ib = nearestIdx(C, b);
    const fwd = []; for (let i = ia; ; i = (i + 1) % C.length) { fwd.push(C[i]); if (i === ib) break; }
    const bwd = []; for (let i = ia; ; i = (i - 1 + C.length) % C.length) { bwd.push(C[i]); if (i === ib) break; }
    const mid = P[run[Math.floor(run.length / 2)]];
    const score = (path) => Math.min(...path.map((q) => Math.hypot(q[0] - mid[0], q[1] - mid[1]))) + 0.00001 * path.length;
    const path = score(fwd) <= score(bwd) ? fwd : bwd;
    const maxInner = Math.max(1, Math.floor((budget * lens[ri]) / tot));
    const s = simplify(path, maxInner); s[0] = a; s[s.length - 1] = b; return s;
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    if (inRun.has(i)) continue;
    const ri = runs.findIndex((r) => r[0] === i);
    const p = snap.get(compOf(id) + '|' + k(P[i])) || P[i];
    if (ri >= 0) out.push(...paths[ri].slice(0, -1)); else out.push(p);
  }
  newPolys[id] = out;
}
for (const id of landRegions) L.regions[id].polygon = newPolys[id].map((p) => p.map(r4));
// стыки, которые встречаются во внутренних рёбрах соседей, — заменить везде
for (const id of landRegions) L.regions[id].polygon = L.regions[id].polygon.map((p) => { const s = snap.get(compOf(id) + '|' + k(p)); return s ? s.map(r4) : p; });

// ---------- 5. ярусы в углах
const arc = (cx, cy, a, b, t0, t1, n) => Array.from({ length: n }, (_, i) => { const t = t0 + ((t1 - t0) * i) / (n - 1); return [r4(Math.min(1, Math.max(0, cx + a * Math.cos(t)))), r4(Math.min(1, Math.max(0, cy + b * Math.sin(t))))]; });
const H = Math.PI / 2;
// правый верхний угол: центр (1,0), углы от π (влево) до π/2 (вниз)
const skyIn = arc(1, 0, 0.42, 0.17, Math.PI, H, 11), skyOut = arc(1, 0, 0.7, 0.255, Math.PI, H, 13);
L.regions.planes.polygon = [[1, 0], ...skyIn.slice().reverse()].map((p) => p.slice()); // от (1,b1) к (1-a1,0)
L.regions.planes.polygon = [[1, 0], ...skyIn];
L.regions.heavens.polygon = [...skyOut, ...skyIn.slice().reverse()];
// левый нижний: центр (0,1), углы от 0 (вправо) до -π/2 (вверх)
const deepIn = arc(0, 1, 0.42, 0.15, 0, -H, 11), deepOut = arc(0, 1, 0.72, 0.245, 0, -H, 13);
L.regions.hells.polygon = [[0, 1], ...deepIn];
L.regions.underdark.polygon = [...deepOut, ...deepIn.slice().reverse()];
// разлом Глубин — по тёмному разлому восточнее материков
L.regions['the-deep'].polygon = [[0.835, 0.5], [0.88, 0.49], [0.93, 0.488], [0.975, 0.5], [0.995, 0.54], [0.99, 0.6], [0.975, 0.66], [0.945, 0.71], [0.905, 0.745], [0.86, 0.765], [0.825, 0.745], [0.815, 0.69], [0.82, 0.63], [0.818, 0.57], [0.825, 0.53]];

require('./places.cjs')(L, lab, N, placeRegion, TIERS, arc);
fs.writeFileSync(layoutPath + '.fit.json', JSON.stringify({ L, contours: Object.fromEntries(Object.entries(contours).map(([k2, c]) => [k2, c.filter((_, i) => i % 3 === 0)])) }));
console.log(Object.fromEntries(Object.entries(L.regions).map(([id, r]) => [id, r.polygon.length])));
