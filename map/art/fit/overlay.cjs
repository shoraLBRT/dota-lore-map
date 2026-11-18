// Наложение разметки на арт + метрики совпадения берегов.
const fs = require('fs');
const [S, fitPath, outName, size = '1000'] = process.argv.slice(2);
const N = 1000;
const { L, contours } = JSON.parse(fs.readFileSync(fitPath, 'utf8'));
const img = Buffer.from(fs.readFileSync(S + '/w1000.rgb'));
const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= N || y >= N) return; const i = (y * N + x) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; };
const line = (a, b, c) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * N * 2) + 1; for (let i = 0; i <= n; i++) put((a[0] + (b[0] - a[0]) * i / n) * N, (a[1] + (b[1] - a[1]) * i / n) * N, c); };
const TIERS = ['heavens', 'planes', 'underdark', 'hells'];
for (const [id, r] of Object.entries(L.regions)) {
  const c = TIERS.includes(id) ? [120, 200, 255] : id === 'the-deep' ? [80, 255, 200] : [255, 220, 0];
  r.polygon.forEach((a, i) => line(a, r.polygon[(i + 1) % r.polygon.length], c));
}
for (const p of Object.values(L.places)) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) put(p.pos[0] * N + dx, p.pos[1] * N + dy, [255, 40, 40]);
fs.writeFileSync(S + '/ov.rgb', img);
// метрики: точки контура → ближайшая граница полигонов суши; вершины береговых рёбер → контур
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const land = Object.entries(L.regions).filter(([id]) => !TIERS.includes(id) && id !== 'the-deep');
const edges = land.flatMap(([, r]) => r.polygon.map((a, i) => [a, r.polygon[(i + 1) % r.polygon.length]]));
const all = Object.values(contours).flat();
const d1 = all.map((p) => Math.min(...edges.map(([a, b]) => segD(p, a, b))));
d1.sort((a, b) => a - b);
console.log(`контур→граница: max ${(d1[d1.length - 1] * 100).toFixed(2)}% p99 ${(d1[Math.floor(d1.length * 0.99)] * 100).toFixed(2)}% p95 ${(d1[Math.floor(d1.length * 0.95)] * 100).toFixed(2)}% (n=${d1.length})`);
