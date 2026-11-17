// Процедурная карта мира (E2, #110; ARCHITECTURE A10, docs/map/README.md «Арт карты»).
// Вход — map/layout.json, биомы из content/regions/*.json, названия из research/e1/regions.json.
// Выход — public/map/world.svg (источник) и растр public/map/world-2560.webp, world-640.webp (превью),
// плюс map/art.lock.json — хеши файлов, чтобы --check видел, что растр собран из этого SVG.
//
//   node map/render-art.mjs          пересобрать SVG и растр (растр рисует Chromium из Playwright)
//   node map/render-art.mjs --check  SVG в репозитории совпадает с пересборкой, растр — с lock и бюджетом
//
// Всё детерминировано: случайность — только из seed ниже, повторный запуск даёт тот же SVG байт в байт.
// Растр байт в байт не сравнивается: движок рисования и кодек WebP на разных системах дают разные байты.
// На картинке нет текста (SPEC §9), подписи накладывает приложение.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/map');
const SVG_FILE = join(OUT_DIR, 'world.svg');
const LOCK_FILE = join(ROOT, 'map/art.lock.json');
export const RASTERS = [
  { file: 'world-2560.webp', width: 2560, height: 1600, budget: 700 * 1024 },
  { file: 'world-640.webp', width: 640, height: 400, budget: 60 * 1024 },
];
const SEED = 110;

const W = 1600, H = 1000;
/** Смещённый контур не дальше этого от исходного ребра (нормированные 0.006 по y = 6 единиц сцены). */
const MAX_SHIFT = 6;
/** Контур не подходит к месту или якорю подписи ближе этого (единицы сцены). */
const KEEP_CLEAR = 2.5;

// ---------- случайность и шум ----------
function hashStr(s) {
  let h = 2166136261 ^ SEED;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rngOf(key) {
  let a = hashStr(key);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lattice = (ix, iy) => {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + SEED * 1013;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = lattice(ix, iy), b = lattice(ix + 1, iy), c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1 + 5, y * 2.1 + 9) * 0.3 + noise(x * 4.3 + 1, y * 4.3 + 3) * 0.1;

// ---------- геометрия ----------
const f = (n) => {
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s === '-0' ? '0' : s;
};
const toStage = ([x, y]) => [x * W, y * H];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}
function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function edgeDist(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}
function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}
function bbox(poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const pathOf = (poly) => 'M' + poly.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const lineOf = (pts) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');
const onFrame = (a, b) =>
  (a[0] === 0 && b[0] === 0) || (a[0] === W && b[0] === W) || (a[1] === 0 && b[1] === 0) || (a[1] === H && b[1] === H);

// ---------- данные ----------
const layout = JSON.parse(readFileSync(join(ROOT, 'map/layout.json'), 'utf8'));
const names = Object.fromEntries(
  JSON.parse(readFileSync(join(ROOT, 'research/e1/regions.json'), 'utf8')).regions.map((r) => [r.id, r]),
);
const regions = Object.entries(layout.regions).map(([id, r]) => {
  const content = JSON.parse(readFileSync(join(ROOT, `content/regions/${id}.json`), 'utf8'));
  return {
    id,
    biome: content.biome,
    tier: names[id]?.tier ?? 'continent',
    poly: r.polygon.map(toStage),
    label: toStage(r.label),
    names: [names[id]?.ru ?? id, names[id]?.en ?? id],
  };
});
const places = Object.values(layout.places).map((p) => toStage(p.pos));
/** Регион-вода: «Глубины» — открытое море; Тропические острова — лагуна с островками (архипелаг). */
const WATER = new Set(['the-deep']);
const ARCHIPELAGO = new Set(['tropic-isles']);
const isLand = (r) => r.tier === 'continent' && !WATER.has(r.id) && !ARCHIPELAGO.has(r.id);

// ---------- рёбра: общее ребро дробится один раз ----------
const vkey = (p) => `${f(p[0])},${f(p[1])}`;
const edges = new Map();
for (const r of regions) {
  r.poly.forEach((a, i) => {
    const b = r.poly[(i + 1) % r.poly.length];
    const [ka, kb] = [vkey(a), vkey(b)];
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const e = edges.get(key) ?? { key, a: ka < kb ? a : b, b: ka < kb ? b : a, owners: [] };
    e.owners.push(r);
    edges.set(key, e);
  });
}
const anchors = [...places, ...regions.map((r) => r.label)];
for (const e of edges.values()) {
  const land = e.owners.filter(isLand).length;
  e.kind = onFrame(e.a, e.b)
    ? 'frame'
    : e.owners.some((r) => r.tier !== 'continent')
      ? 'tier'
      : land === 2
        ? 'border'
        : land === 1
          ? 'coast'
          : 'water';
  const strong = e.kind === 'coast';
  // Ближайшее место или якорь подписи ограничивает смещение, чтобы точка не оказалась за границей.
  const near = Math.min(...anchors.map((p) => segDist(p, e.a, e.b)));
  e.cap = e.kind === 'frame' ? 0 : Math.max(0, Math.min(strong ? MAX_SHIFT : MAX_SHIFT * 0.6, near - KEEP_CLEAR));
  e.pts = e.cap ? displace(e.a, e.b, strong ? 0.2 : 0.12, e.cap, rngOf(e.key)) : [e.a, e.b];
}

/** Midpoint displacement: амплитуда ∝ длине отрезка, отклонение от исходного ребра не больше cap. */
function displace(a, b, rough, cap, rnd) {
  const len = dist(a, b);
  const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  const off = new Map([[0, 0], [1, 0]]);
  const rec = (t0, t1, amp) => {
    if ((t1 - t0) * len < 3) return;
    const tm = (t0 + t1) / 2;
    off.set(tm, (off.get(t0) + off.get(t1)) / 2 + (rnd() * 2 - 1) * amp);
    rec(t0, tm, amp * 0.55);
    rec(tm, t1, amp * 0.55);
  };
  rec(0, 1, rough * len * 0.5);
  return [...off.keys()]
    .sort((x, y) => x - y)
    .map((t) => {
      // Концы ребра неподвижны, у концов отклонение сходит на нет — вершины соседей совпадают.
      const o = Math.max(-cap, Math.min(cap, off.get(t))) * Math.min(1, Math.min(t, 1 - t) * len / 8);
      return [a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o];
    });
}

function outline(r) {
  const out = [];
  r.poly.forEach((a, i) => {
    const b = r.poly[(i + 1) % r.poly.length];
    const [ka, kb] = [vkey(a), vkey(b)];
    const e = edges.get(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`);
    const pts = ka < kb ? e.pts : [...e.pts].reverse();
    out.push(...pts.slice(0, -1));
  });
  return out;
}
for (const r of regions) {
  r.shape = outline(r);
  r.area = area(r.poly);
  r.box = bbox(r.poly);
  r.places = places.filter((p) => inside(p, r.poly));
}

// ---------- палитра (приглушённая, согласована с src/styles/tokens.css) ----------
const BIOME = {
  snow: { base: '#6c7b88', lite: '#c3ced8', dark: '#3f4a55' },
  forest: { base: '#24382a', lite: '#4f6b42', dark: '#121d14' },
  jungle: { base: '#1d3d2c', lite: '#46713f', dark: '#0d1f15' },
  desert: { base: '#735a37', lite: '#b8955f', dark: '#4a3820' },
  mountains: { base: '#4a463f', lite: '#8c8170', dark: '#25221e' },
  plains: { base: '#465230', lite: '#7c8650', dark: '#282f1b' },
  swamp: { base: '#2f3a2b', lite: '#5a6a4e', dark: '#182016' },
  islands: { base: '#3d5638', lite: '#728b5a', dark: '#22321f' },
  volcanic: { base: '#2e1a15', lite: '#6a3e2c', dark: '#140b09' },
  city: { base: '#544c40', lite: '#9a8b6f', dark: '#2f2a22' },
  sky: { base: '#141c36', lite: '#c9b98a', dark: '#090d1c' },
  void: { base: '#191330', lite: '#8f74c4', dark: '#0b0818' },
  hell: { base: '#2a0d09', lite: '#f07a32', dark: '#120504' },
  fog: { base: '#5f666e', lite: '#c4ccd6', dark: '#3a3f45' },
  sea: { base: '#0a1620', lite: '#3d6478', dark: '#050b10' },
};
const INK = '#120f0c';

// ---------- условные знаки ----------
// Каждый знак — функция (x, y, s, rnd, c) → SVG; s — масштаб, c — цвета биома. 3–5 вариантов на биом.
const P = (pts, fill, extra = '') => `<path d="${pathOf(pts)}" fill="${fill}"${extra}/>`;
const ink = (w) => ` stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-opacity=".7"`;

function peak(x, y, w, h, c, rnd, snowCap) {
  const tip = [x + (rnd() - 0.5) * w * 0.2, y - h];
  const l = [x - w / 2, y], rr = [x + w / 2, y];
  const mid = [tip[0] + (rnd() - 0.4) * w * 0.15, y - h * 0.05];
  let s = P([l, tip, mid], c.lite) + P([tip, rr, mid], c.dark);
  if (snowCap) {
    const k = 0.32;
    const a = [tip[0] + (l[0] - tip[0]) * k, tip[1] + (l[1] - tip[1]) * k];
    const b = [tip[0] + (rr[0] - tip[0]) * k, tip[1] + (rr[1] - tip[1]) * k];
    s += P([a, tip, b, [tip[0] + w * 0.05, a[1] + h * 0.06], [tip[0] - w * 0.08, a[1] + h * 0.1]], '#dfe6ec', ' fill-opacity=".85"');
  }
  return s + `<path d="${lineOf([l, tip, rr])}" fill="none"${ink(0.7)}/>`;
}
const GLYPHS = {
  mountains: [
    (x, y, s, r, c, n) => peak(x, y, 18 * s, 16 * s, c, r, n),
    (x, y, s, r, c, n) => peak(x - 7 * s, y, 15 * s, 12 * s, c, r, n) + peak(x + 4 * s, y + 1 * s, 18 * s, 17 * s, c, r, n),
    (x, y, s, r, c, n) =>
      peak(x - 10 * s, y, 13 * s, 10 * s, c, r, n) + peak(x, y + 1, 17 * s, 18 * s, c, r, n) + peak(x + 10 * s, y + 2 * s, 13 * s, 11 * s, c, r, n),
    (x, y, s, r, c) => P([[x - 12 * s, y], [x - 5 * s, y - 6 * s], [x + 3 * s, y - 7 * s], [x + 12 * s, y]], c.lite, ink(0.6)),
  ],
  snow: [
    (x, y, s, r, c) => peak(x, y, 16 * s, 13 * s, { ...c, lite: '#e3e9ee', dark: '#8798a8' }, r, false),
    (x, y, s, r) => P([[x - 6 * s, y], [x - 2 * s, y - 6 * s], [x + 4 * s, y - 4 * s], [x + 6 * s, y]], '#d6dee6', ink(0.5)) +
      P([[x + 2 * s, y], [x + 6 * s, y - 4 * s], [x + 9 * s, y]], '#a7b5c2', ink(0.5)),
    (x, y, s, r) => P([[x - 4 * s, y], [x - 1 * s, y - 8 * s], [x + 3 * s, y]], '#e8edf1', ink(0.5)) +
      P([[x + 1 * s, y], [x + 5 * s, y - 5 * s], [x + 7 * s, y]], '#b9c6d1', ink(0.5)),
    (x, y, s, r) => {
      const a = r() * Math.PI;
      const dx = Math.cos(a) * 9 * s, dy = Math.sin(a) * 4 * s;
      return `<path d="M${f(x - dx)} ${f(y - dy)}L${f(x + dx * 0.1)} ${f(y + 2 * s)}L${f(x + dx)} ${f(y + dy)}" fill="none" stroke="#3e4b57" stroke-width="${f(0.8 * s)}" stroke-opacity=".7"/>`;
    },
  ],
  forest: [
    (x, y, s, r, c) => tree(x, y, s, c),
    (x, y, s, r, c) => tree(x - 4 * s, y, s * 0.9, c) + tree(x + 4 * s, y + 2 * s, s, c),
    (x, y, s, r, c) => tree(x - 6 * s, y + 1, s * 0.85, c) + tree(x, y - 2 * s, s, c) + tree(x + 6 * s, y + 2 * s, s * 0.9, c),
    (x, y, s, r, c) => bush(x - 3 * s, y, 4.5 * s, c) + bush(x + 4 * s, y + 1 * s, 4 * s, c),
  ],
  jungle: [
    (x, y, s, r, c) => bush(x - 4 * s, y, 5 * s, c) + bush(x + 3 * s, y - 2 * s, 5.5 * s, c) + bush(x + 1, y + 3 * s, 4.5 * s, c),
    (x, y, s, r, c) => palm(x, y, s, c, r),
    (x, y, s, r, c) => palm(x - 4 * s, y, s * 0.9, c, r) + bush(x + 5 * s, y + 1, 4 * s, c),
    (x, y, s, r, c) => bush(x, y, 6 * s, c) + bush(x - 6 * s, y + 2 * s, 4 * s, c),
  ],
  desert: [
    (x, y, s, r, c) => dune(x, y, 16 * s, c),
    (x, y, s, r, c) => dune(x - 5 * s, y, 12 * s, c) + dune(x + 6 * s, y + 4 * s, 10 * s, c),
    (x, y, s, r, c) => P([[x - 8 * s, y], [x - 6 * s, y - 6 * s], [x + 5 * s, y - 6 * s], [x + 8 * s, y]], c.lite, ink(0.6)) +
      P([[x + 5 * s, y - 6 * s], [x + 8 * s, y], [x + 3 * s, y]], c.dark, ' fill-opacity=".7"'),
    (x, y, s, r, c) => P([[x - 3 * s, y], [x - 1 * s, y - 4 * s], [x + 3 * s, y - 3 * s], [x + 4 * s, y]], c.dark, ink(0.5)),
  ],
  plains: [
    (x, y, s, r, c) => tuft(x, y, s, c),
    (x, y, s, r, c) => hill(x, y, 14 * s, 5 * s, c),
    (x, y, s, r, c) => tuft(x - 4 * s, y, s, c) + tuft(x + 4 * s, y + 2 * s, s * 0.8, c),
    (x, y, s, r, c) => bush(x, y, 3.2 * s, c),
    (x, y, s, r, c) => fields(x, y, s, c, r),
  ],
  swamp: [
    (x, y, s, r, c) => tussock(x, y, s, c),
    (x, y, s, r, c) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(7 * s)}" ry="${f(2.6 * s)}" fill="#14211f" fill-opacity=".75"/>` +
      `<path d="M${f(x - 4 * s)} ${f(y - 0.6 * s)}h${f(5 * s)}" stroke="#5f7d77" stroke-width=".6" stroke-opacity=".7"/>`,
    (x, y, s, r, c) => tussock(x - 4 * s, y, s * 0.8, c) + tussock(x + 4 * s, y + 2 * s, s, c),
    (x, y, s) => `<path d="M${f(x)} ${f(y)}v${f(-9 * s)}M${f(x)} ${f(y - 6 * s)}l${f(-3 * s)} ${f(-3 * s)}M${f(x)} ${f(y - 4 * s)}l${f(3 * s)} ${f(-3 * s)}" fill="none" stroke="#1c1914" stroke-width="${f(0.9 * s)}" stroke-linecap="round"/>`,
  ],
  islands: [
    (x, y, s, r, c) => palm(x, y, s * 0.9, c, r),
    (x, y, s, r, c) => hill(x, y, 12 * s, 5 * s, c),
    (x, y, s, r, c) => bush(x - 3 * s, y, 4 * s, c) + palm(x + 4 * s, y, s * 0.8, c, r),
  ],
  volcanic: [
    (x, y, s, r, c) => volcano(x, y, s, c),
    (x, y, s, r, c) => crack(x, y, 12 * s, r),
    (x, y, s, r, c) => peak(x, y, 14 * s, 9 * s, { ...c, lite: '#5a3a2c', dark: '#1c100c' }, r, false),
  ],
  city: [
    (x, y, s, r, c) => houses(x, y, s, c, r),
    (x, y, s, r, c) => ruins(x, y, s, c, r),
    (x, y, s, r, c) => houses(x - 5 * s, y, s * 0.8, c, r) + houses(x + 5 * s, y + 3 * s, s * 0.7, c, r),
    (x, y, s, r, c) => tuft(x, y, s * 0.8, { lite: '#7d7a56', dark: '#3b3a28' }),
  ],
  fog: [
    (x, y, s, r, c) => hill(x, y, 12 * s, 5 * s, c),
    (x, y, s, r, c) => peak(x, y, 12 * s, 10 * s, c, r, false),
  ],
  hell: [
    (x, y, s) => flame(x, y, s),
    (x, y, s, r) => crack(x, y, 14 * s, r),
    (x, y, s, r, c) => peak(x, y, 10 * s, 12 * s, { ...c, lite: '#4a1c12', dark: '#120504' }, r, false),
  ],
  void: [
    (x, y, s, r) => shard(x, y, s, r),
    (x, y, s) => whirl(x, y, 8 * s, '#9f86d6'),
  ],
  sea: [
    (x, y, s) => whirl(x, y, 7 * s),
    (x, y, s) => wave(x, y, 10 * s, '#5e8aa0', 0.5),
    (x, y, s) => wave(x - 4 * s, y, 8 * s, '#5e8aa0', 0.4) + wave(x + 5 * s, y + 4 * s, 8 * s, '#5e8aa0', 0.4),
  ],
};
function fields(x, y, s, c, r) {
  const a = f((r() - 0.5) * 50);
  let out = '';
  for (let i = 0; i < 3; i++) {
    out += `<rect x="${f(x - 9 * s + i * 6 * s)}" y="${f(y - 4 * s + (i % 2) * 1.5 * s)}" width="${f(5.4 * s)}" height="${f(6 * s)}" fill="${i % 2 ? c.lite : c.dark}" fill-opacity=".45"/>`;
  }
  return `<g transform="rotate(${a} ${f(x)} ${f(y)})">${out}</g>`;
}
function flame(x, y, s) {
  return `<path d="M${f(x - 3 * s)} ${f(y)}Q${f(x - 4 * s)} ${f(y - 5 * s)} ${f(x)} ${f(y - 10 * s)}Q${f(x + 1 * s)} ${f(y - 5 * s)} ${f(x + 3 * s)} ${f(y - 6 * s)}Q${f(x + 4 * s)} ${f(y - 2 * s)} ${f(x + 3 * s)} ${f(y)}Z" fill="#e2602a" fill-opacity=".85" filter="url(#glow)"/>` +
    `<path d="M${f(x - 1.2 * s)} ${f(y)}Q${f(x - 1.5 * s)} ${f(y - 3 * s)} ${f(x)} ${f(y - 5.5 * s)}Q${f(x + 1.5 * s)} ${f(y - 2.5 * s)} ${f(x + 1.2 * s)} ${f(y)}Z" fill="#ffc27a"/>`;
}
function shard(x, y, s, r) {
  const h = (6 + r() * 6) * s;
  return P([[x - 2.5 * s, y], [x - 0.5 * s, y - h], [x + 2.5 * s, y - h * 0.3], [x + 1 * s, y + 1.5 * s]], '#3b2c62', ink(0.5)) +
    P([[x - 0.5 * s, y - h], [x + 2.5 * s, y - h * 0.3], [x + 0.6 * s, y - h * 0.4]], '#9f86d6', ' fill-opacity=".7"');
}
function tree(x, y, s, c) {
  return `<path d="M${f(x)} ${f(y)}v${f(2 * s)}" stroke="#1d1712" stroke-width="${f(1.1 * s)}"/>` +
    P([[x - 4.5 * s, y], [x, y - 11 * s], [x + 4.5 * s, y]], c.dark, ink(0.5)) +
    P([[x - 3.2 * s, y - 4 * s], [x, y - 11 * s], [x + 0.4 * s, y - 4.5 * s]], c.lite, ' fill-opacity=".85"');
}
function bush(x, y, r, c) {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c.dark}"${ink(0.5)}/>` +
    `<circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.55)}" fill="${c.lite}" fill-opacity=".8"/>`;
}
function palm(x, y, s, c) {
  const top = [x + 1.5 * s, y - 10 * s];
  const leaf = (dx, dy) => `M${f(top[0])} ${f(top[1])}q${f(dx * 0.5)} ${f(-3 * s)} ${f(dx)} ${f(dy)}`;
  return `<path d="M${f(x)} ${f(y)}Q${f(x - 0.5 * s)} ${f(y - 6 * s)} ${f(top[0])} ${f(top[1])}" fill="none" stroke="#3a2a1a" stroke-width="${f(1.1 * s)}"/>` +
    `<path d="${leaf(-6 * s, 3 * s)}${leaf(6 * s, 3 * s)}${leaf(-4 * s, -2 * s)}${leaf(4 * s, -2 * s)}" fill="none" stroke="${c.lite}" stroke-width="${f(1.3 * s)}" stroke-linecap="round"/>`;
}
function dune(x, y, w, c) {
  const h = w * 0.32;
  return `<path d="M${f(x - w / 2)} ${f(y)}Q${f(x - w * 0.1)} ${f(y - h * 1.6)} ${f(x + w / 2)} ${f(y)}Q${f(x)} ${f(y - h * 0.5)} ${f(x - w / 2)} ${f(y)}Z" fill="${c.lite}" fill-opacity=".8"/>` +
    `<path d="M${f(x - w / 2)} ${f(y)}Q${f(x - w * 0.1)} ${f(y - h * 1.6)} ${f(x + w / 2)} ${f(y)}" fill="none" stroke="${c.dark}" stroke-width=".8"/>`;
}
function hill(x, y, w, h, c) {
  return `<path d="M${f(x - w / 2)} ${f(y)}Q${f(x)} ${f(y - h * 2)} ${f(x + w / 2)} ${f(y)}Z" fill="${c.base}"${ink(0.6)}/>` +
    `<path d="M${f(x - w / 2)} ${f(y)}Q${f(x - w * 0.15)} ${f(y - h * 1.5)} ${f(x + w * 0.05)} ${f(y - h * 0.95)}Q${f(x - w * 0.1)} ${f(y - h * 0.3)} ${f(x - w / 2)} ${f(y)}Z" fill="${c.lite}" fill-opacity=".7"/>`;
}
function tuft(x, y, s, c) {
  return `<path d="M${f(x - 3 * s)} ${f(y)}l${f(-1 * s)} ${f(-4 * s)}M${f(x)} ${f(y)}v${f(-5 * s)}M${f(x + 3 * s)} ${f(y)}l${f(1 * s)} ${f(-4 * s)}" fill="none" stroke="${c.lite}" stroke-width="${f(0.9 * s)}" stroke-linecap="round" stroke-opacity=".85"/>`;
}
function tussock(x, y, s, c) {
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(4 * s)}" ry="${f(1.8 * s)}" fill="${c.dark}"/>` + tuft(x, y - 0.5 * s, s * 0.8, c);
}
function volcano(x, y, s, c) {
  return P([[x - 10 * s, y], [x - 2.5 * s, y - 10 * s], [x + 2.5 * s, y - 10 * s], [x + 10 * s, y]], c.lite, ink(0.7)) +
    P([[x + 2.5 * s, y - 10 * s], [x + 10 * s, y], [x + 1 * s, y]], c.dark, ' fill-opacity=".8"') +
    `<ellipse cx="${f(x)}" cy="${f(y - 10 * s)}" rx="${f(2.6 * s)}" ry="${f(1 * s)}" fill="#ff8a3a" filter="url(#glow)"/>` +
    `<path d="M${f(x - 0.5 * s)} ${f(y - 9.5 * s)}l${f(-1.5 * s)} ${f(4 * s)}l${f(1 * s)} ${f(3 * s)}" fill="none" stroke="#f07a32" stroke-width="${f(0.8 * s)}" stroke-opacity=".8"/>`;
}
function crack(x, y, len, r) {
  const pts = [[x - len / 2, y]];
  for (let i = 1; i <= 4; i++) pts.push([x - len / 2 + (len * i) / 4, y + (r() - 0.5) * len * 0.35]);
  return `<path d="${lineOf(pts)}" fill="none" stroke="#ff9442" stroke-width="1.1" stroke-linecap="round" filter="url(#glow)"/>`;
}
function houses(x, y, s, c, r) {
  let out = '';
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const hx = x + (i - (n - 1) / 2) * 5 * s, hy = y + (r() - 0.5) * 2 * s, w = 4 * s, h = (3 + r() * 1.5) * s;
    out += `<path d="M${f(hx - w / 2)} ${f(hy)}v${f(-h)}l${f(w / 2)} ${f(-2.4 * s)}l${f(w / 2)} ${f(2.4 * s)}v${f(h)}Z" fill="${c.lite}"${ink(0.5)}/>` +
      `<path d="M${f(hx)} ${f(hy - h - 2.4 * s)}l${f(w / 2)} ${f(2.4 * s)}v${f(h)}h${f(-w / 2)}Z" fill="${c.dark}" fill-opacity=".6"/>`;
  }
  return out;
}
function ruins(x, y, s, c, r) {
  let out = `<path d="M${f(x - 9 * s)} ${f(y)}h${f(18 * s)}" stroke="${c.dark}" stroke-width="${f(1.4 * s)}"/>`;
  for (let i = 0; i < 4; i++) {
    const h = (3 + r() * 6) * s;
    out += `<rect x="${f(x - 8 * s + i * 4.6 * s)}" y="${f(y - h)}" width="${f(2.2 * s)}" height="${f(h)}" fill="${c.lite}"${ink(0.4)}/>`;
  }
  return out;
}
function whirl(x, y, r, color = '#6f9bb0') {
  let d = '';
  for (let i = 0; i <= 24; i++) {
    const a = i * 0.55, rr = (r * i) / 24;
    d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr * 0.6)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width=".8" stroke-opacity=".55"/>`;
}
function wave(x, y, w, color, op) {
  return `<path d="M${f(x - w / 2)} ${f(y)}q${f(w / 4)} ${f(-w * 0.22)} ${f(w / 2)} 0t${f(w / 2)} 0" fill="none" stroke="${color}" stroke-width=".7" stroke-opacity="${op}" stroke-linecap="round"/>`;
}

// ---------- раскладка знаков ----------
/** Прямоугольник подписи региона (как в приложении: 22 px капителью, перенос после 14 знаков). */
function labelBox(r) {
  const lines = r.names.map((n) => (n.length > 14 ? Math.ceil(n.length / 2) + 1 : n.length));
  const rows = r.names.some((n) => n.length > 14) ? 2 : 1;
  return { cx: r.label[0], cy: r.label[1], hw: Math.max(...lines) * 8 + 10, hh: rows * 14 + 6 };
}
const placeClear = (p) => places.every((q) => Math.hypot((p[0] - q[0]) / W, (p[1] - q[1]) / H) >= 0.015);

/** Знаки, разбросанные по региону: с отступом от границ, подписи и мест. */
function scatter(r, spacing, margin, extraOk = () => true) {
  const rnd = rngOf(`glyphs:${r.id}`);
  const s = Math.max(0.75, Math.min(1.25, Math.sqrt(r.area / 9000)));
  const lb = labelBox(r);
  const [x0, y0, x1, y1] = r.box;
  const tries = Math.ceil(((x1 - x0) * (y1 - y0)) / (spacing * spacing)) * 6;
  const pts = [];
  for (let i = 0; i < tries; i++) {
    const p = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    if (!inside(p, r.shape) || edgeDist(p, r.shape) < margin * s) continue;
    if (Math.abs(p[0] - lb.cx) < lb.hw && Math.abs(p[1] - lb.cy) < lb.hh) continue;
    if (!placeClear(p) || !extraOk(p)) continue;
    // Плотность «дышит» шумом: группы знаков и пустые поляны вместо ровной сетки.
    const local = spacing * s * (0.75 + fbm(p[0] / 90, p[1] / 90) * 0.7);
    if (pts.some((q) => dist(p, q) < local)) continue;
    pts.push(p);
  }
  return { pts: pts.sort((a, b) => a[1] - b[1]), s, rnd };
}

// ---------- сборка SVG ----------
const land = regions.filter(isLand);
const upper = regions.filter((r) => r.tier === 'upper');
const abyss = regions.filter((r) => r.tier === 'abyss');
const archi = regions.filter((r) => ARCHIPELAGO.has(r.id));
const water = regions.filter((r) => WATER.has(r.id));

/** Островки архипелага: у каждого места свой островок, плюс несколько пустых. */
function islets(r) {
  const rnd = rngOf(`islets:${r.id}`);
  const centers = r.places.map((p) => ({ p, rad: 11 + rnd() * 5 }));
  const lb = labelBox(r);
  for (let i = 0; i < 80 && centers.length < r.places.length + 9; i++) {
    const p = [r.box[0] + rnd() * (r.box[2] - r.box[0]), r.box[1] + rnd() * (r.box[3] - r.box[1])];
    const rad = 4 + rnd() * 6;
    if (!inside(p, r.shape) || edgeDist(p, r.shape) < rad + 4) continue;
    if (Math.abs(p[0] - lb.cx) < lb.hw && Math.abs(p[1] - lb.cy) < lb.hh) continue;
    if (centers.some((c) => dist(c.p, p) < c.rad + rad + 5)) continue;
    centers.push({ p, rad });
  }
  return centers.map(({ p, rad }, k) => {
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const rr = rad * (0.78 + fbm(Math.cos(a) * 1.3 + k * 7, Math.sin(a) * 1.3 + k * 3) * 0.45);
      pts.push([p[0] + Math.cos(a) * rr * 1.15, p[1] + Math.sin(a) * rr]);
    }
    return pts;
  });
}
const isletShapes = archi.flatMap(islets);

function stars(r, count) {
  const rnd = rngOf(`stars:${r.id}`);
  const [x0, y0, x1, y1] = r.box;
  let out = '';
  for (let i = 0, n = 0; i < count * 3 && n < count; i++) {
    const p = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    if (!inside(p, r.shape)) continue;
    n++;
    const big = rnd() < 0.06;
    const rr = big ? 1.1 + rnd() * 0.6 : 0.3 + rnd() * 0.5;
    out += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(rr)}" fill="#f2efe4" fill-opacity="${f(0.35 + rnd() * 0.6)}"${big ? ' filter="url(#glow)"' : ''}/>`;
  }
  return out;
}

function nebula(r, colors) {
  const rnd = rngOf(`nebula:${r.id}`);
  const [x0, y0, x1, y1] = r.box;
  let out = '';
  for (let i = 0; i < 9; i++) {
    const cx = x0 + rnd() * (x1 - x0), cy = y0 + rnd() * (y1 - y0);
    out += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(50 + rnd() * 90)}" ry="${f(12 + rnd() * 22)}" fill="${colors[i % colors.length]}" fill-opacity="${f(0.18 + rnd() * 0.2)}" transform="rotate(${f((rnd() - 0.5) * 20)} ${f(cx)} ${f(cy)})"/>`;
  }
  return `<g filter="url(#haze)">${out}</g>`;
}

function lavaVeins(r) {
  const rnd = rngOf(`lava:${r.id}`);
  const [x0, y0, x1, y1] = r.box;
  let out = '';
  for (let i = 0; i < 34; i++) {
    let p = [x0 + rnd() * (x1 - x0), y0 + 8 + rnd() * (y1 - y0 - 8)];
    const pts = [p];
    let a = (rnd() - 0.5) * 1.2 + (rnd() < 0.5 ? 0 : Math.PI);
    for (let k = 0; k < 6; k++) {
      a += (rnd() - 0.5) * 1.1;
      p = [p[0] + Math.cos(a) * (8 + rnd() * 10), p[1] + Math.sin(a) * (4 + rnd() * 5)];
      pts.push(p);
    }
    out += `<path d="${lineOf(pts)}" fill="none" stroke="#ff8a3a" stroke-width="${f(0.8 + rnd() * 1.2)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${f(0.55 + rnd() * 0.4)}"/>`;
  }
  return `<g filter="url(#glow)">${out}</g>`;
}

function embers(r, n) {
  const rnd = rngOf(`embers:${r.id}`);
  const [x0, y0, x1, y1] = r.box;
  let out = '';
  for (let i = 0; i < n; i++) {
    const p = [x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0)];
    if (inside(p, r.shape)) out += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(0.4 + rnd() * 0.8)}" fill="#ffb36a" fill-opacity="${f(0.4 + rnd() * 0.5)}"/>`;
  }
  return out;
}

/** Рябь на открытой воде: короткие дуги, реже у берегов. */
function ripples() {
  const rnd = rngOf('ripples');
  let out = '';
  const solid = [...land, ...upper, ...abyss];
  for (let i = 0, n = 0; i < 2600 && n < 380; i++) {
    const p = [rnd() * W, 130 + rnd() * 740];
    if (solid.some((r) => inside(p, r.poly) || edgeDist(p, r.poly) < 10)) continue;
    n++;
    out += wave(p[0], p[1], 5 + rnd() * 7, '#6b93a8', f(0.12 + rnd() * 0.18));
  }
  return out;
}

/** Свой оттенок и свой «главный» знак у каждого региона: соседи одного биома не сливаются. */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
function look(r) {
  const rnd = rngOf(`look:${r.id}`);
  const k = 0.86 + rnd() * 0.28;
  const c = BIOME[r.biome];
  return { colors: { base: shade(c.base, k), lite: shade(c.lite, 0.94 + rnd() * 0.12), dark: c.dark }, main: rnd() };
}

function glyphLayer(r) {
  const set = GLYPHS[r.biome];
  if (!set) return '';
  const tierSparse = r.tier === 'abyss' ? 1.6 : 1;
  const spacing = tierSparse * { mountains: 20, snow: 19, forest: 14, jungle: 14, desert: 21, plains: 20, swamp: 18, islands: 20, volcanic: 22, city: 22, fog: 30, sea: 26, hell: 34, void: 34 }[r.biome];
  const { pts, s, rnd } = scatter(r, spacing, 9);
  const { colors: c, main } = look(r);
  const dominant = Math.floor(main * set.length);
  const snowy = r.label[1] < 350;
  return pts
    .map((p) => {
      const g = set[rnd() < 0.5 ? dominant : Math.floor(rnd() * set.length)];
      return g(p[0], p[1], s * (0.85 + rnd() * 0.3), rnd, c, snowy);
    })
    .join('');
}

/** Рельеф биома: частота шума, высота «освещённого» рельефа (SVG feDiffuseLighting). */
const RELIEF = {
  high: { freq: '0.03', scale: 7, oct: 5, biomes: ['mountains', 'volcanic'] },
  snow: { freq: '0.028', scale: 4, oct: 5, biomes: ['snow'] },
  dunes: { freq: '0.008 0.045', scale: 4, oct: 3, biomes: ['desert'] },
  canopy: { freq: '0.09', scale: 2.2, oct: 3, biomes: ['forest', 'jungle', 'islands'] },
  low: { freq: '0.018', scale: 1.6, oct: 4, biomes: ['plains', 'city', 'swamp', 'fog'] },
};
const reliefOf = (b) => Object.keys(RELIEF).find((k) => RELIEF[k].biomes.includes(b)) ?? 'low';

function filters() {
  const full = 'filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"';
  const relief = Object.entries(RELIEF)
    .map(
      ([k, v], i) => `<filter id="relief-${k}" ${full} color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${v.freq}" numOctaves="${v.oct}" seed="${SEED + i}" result="n"/>` +
        `<feDiffuseLighting in="n" surfaceScale="${v.scale}" diffuseConstant="1" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="42"/></feDiffuseLighting>` +
        `<feComponentTransfer in="l" result="lc"><feFuncR type="linear" slope="1" intercept="-0.17"/><feFuncG type="linear" slope="1" intercept="-0.17"/><feFuncB type="linear" slope="1" intercept="-0.17"/></feComponentTransfer>` +
        `<feBlend in="lc" in2="SourceGraphic" mode="soft-light" result="b"/>` +
        `<feComposite in="b" in2="SourceAlpha" operator="in"/></filter>`,
    )
    .join('');
  return relief +
    // Изолинии глубины: размытая маска суши, из неё вырезаны 3 уровня — линии повторяют берег и сливаются между островами.
    `<filter id="depth" ${full}><feGaussianBlur in="SourceAlpha" stdDeviation="16" result="b"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${SEED}" result="t"/>` +
    `<feDisplacementMap in="b" in2="t" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
    `<feComponentTransfer in="d" result="rings"><feFuncA type="discrete" tableValues="0 0 0.5 0 0 0 0.7 0 0 0 0 0 0.9 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"/></feComponentTransfer>` +
    `<feFlood flood-color="#7fa3b5"/><feComposite in2="rings" operator="in"/></filter>` +
    `<filter id="shallow" ${full}><feMorphology in="SourceAlpha" operator="dilate" radius="3"/><feGaussianBlur stdDeviation="7" result="b"/>` +
    `<feFlood flood-color="#3c6a7d" flood-opacity=".55"/><feComposite in2="b" operator="in"/></filter>` +
    `<filter id="coastShade" ${full}><feGaussianBlur stdDeviation="3"/></filter>` +
    `<filter id="glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.6" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<filter id="haze" ${full}><feGaussianBlur stdDeviation="18"/></filter>` +
    `<filter id="soft" ${full}><feGaussianBlur stdDeviation="6"/></filter>` +
    `<filter id="rim" ${full}><feGaussianBlur stdDeviation="4"/></filter>` +
    `<filter id="fogf" ${full}><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="${SEED + 9}"/>` +
    `<feColorMatrix values="0 0 0 0 .82 0 0 0 0 .85 0 0 0 0 .89 0 0 0 1.4 -0.55"/><feComposite in2="SourceAlpha" operator="in"/><feGaussianBlur stdDeviation="2"/></filter>` +
    `<filter id="grain" ${full}><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="${SEED + 3}"/>` +
    `<feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .05"/></filter>`;
}

function render() {
  const landPaths = land.map((r) => pathOf(r.shape)).join('');
  const isletPaths = isletShapes.map(pathOf).join('');
  const coast = [...edges.values()].filter((e) => e.kind === 'coast').map((e) => lineOf(e.pts)).join('');
  const borders = [...edges.values()].filter((e) => e.kind === 'border').map((e) => lineOf(e.pts)).join('');
  const tierEdges = (tier) =>
    [...edges.values()].filter((e) => e.kind === 'tier' && e.owners.length === 1 && e.owners.some((r) => r.tier === tier)).map((e) => lineOf(e.pts)).join('');

  const defs = `<defs>${filters()}` +
    `<radialGradient id="sea" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#16303c"/><stop offset=".6" stop-color="#0d1d27"/><stop offset="1" stop-color="#0c161e"/></radialGradient>` +
    `<linearGradient id="climate" x1="0" y1="0" x2="0" y2="1"><stop offset=".12" stop-color="#c9dcf0" stop-opacity=".16"/><stop offset=".45" stop-color="#9a9070" stop-opacity="0"/><stop offset=".88" stop-color="#7a2a10" stop-opacity=".22"/></linearGradient>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070f"/><stop offset="1" stop-color="#1a2547"/></linearGradient>` +
    `<linearGradient id="hell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a120a"/><stop offset=".4" stop-color="#1e0806"/><stop offset="1" stop-color="#0b0303"/></linearGradient>` +
    `<radialGradient id="vignette" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#0b0d11" stop-opacity="0"/><stop offset="1" stop-color="#0b0d11" stop-opacity=".45"/></radialGradient>` +
    `<clipPath id="land">${land.map((r) => `<path d="${pathOf(r.shape)}"/>`).join('')}${isletShapes.map((s) => `<path d="${pathOf(s)}"/>`).join('')}</clipPath>` +
    regions.map((r) => `<clipPath id="c-${r.id}"><path d="${pathOf(r.shape)}"/></clipPath>`).join('') +
    `</defs>`;

  const parts = [];
  // Море
  parts.push(`<rect width="1600" height="1000" fill="url(#sea)"/>`);
  parts.push(`<g>${ripples()}</g>`);
  for (const r of water) {
    parts.push(`<path d="${pathOf(r.shape)}" fill="#03090e" fill-opacity=".55" filter="url(#soft)"/>`);
    parts.push(`<g clip-path="url(#c-${r.id})">${glyphLayer(r)}</g>`);
  }
  for (const r of archi) parts.push(`<path d="${pathOf(r.shape)}" fill="#2f6a72" fill-opacity=".28" filter="url(#soft)"/>`);
  parts.push(`<path d="${landPaths}${isletPaths}" filter="url(#shallow)"/>`);
  parts.push(`<path d="${landPaths}${isletPaths}" filter="url(#depth)"/>`);

  // Суша: заливка по биомам с рельефом
  for (const [k] of Object.entries(RELIEF)) {
    const group = land.filter((r) => reliefOf(r.biome) === k);
    const isl = k === 'canopy' ? isletShapes : [];
    if (!group.length && !isl.length) continue;
    parts.push(`<g filter="url(#relief-${k})">` +
      group.map((r) => `<path d="${pathOf(r.shape)}" fill="${look(r).colors.base}"/>`).join('') +
      isl.map((s) => `<path d="${pathOf(s)}" fill="${BIOME.islands.base}"/>`).join('') + `</g>`);
  }
  parts.push(`<g clip-path="url(#land)"><rect width="1600" height="1000" fill="url(#climate)"/>` +
    `<path d="${coast}${isletPaths}" fill="none" stroke="#0a0806" stroke-opacity=".55" stroke-width="7" filter="url(#coastShade)"/></g>`);
  for (const r of land) parts.push(`<g clip-path="url(#c-${r.id})">${glyphLayer(r)}</g>`);
  for (const r of land.filter((x) => x.biome === 'fog')) {
    parts.push(`<path d="${pathOf(r.shape)}" fill="#fff" filter="url(#fogf)" opacity=".75"/>`);
  }
  // Границы и берега: внутренние — тоньше и слабее
  parts.push(`<path d="${borders}" fill="none" stroke="#14110d" stroke-opacity=".6" stroke-width="1.6" stroke-linejoin="round"/>`);
  parts.push(`<path d="${borders}" fill="none" stroke="#c9b88e" stroke-opacity=".22" stroke-width=".6" stroke-dasharray="3 2.5"/>`);
  parts.push(`<path d="${coast}${isletPaths}" fill="none" stroke="#a9c4cf" stroke-opacity=".35" stroke-width="2.6" filter="url(#coastShade)"/>`);
  parts.push(`<path d="${coast}${isletPaths}" fill="none" stroke="#0b0907" stroke-opacity=".85" stroke-width="1.2" stroke-linejoin="round"/>`);

  // Верхний ярус: звёздное небо с туманностью
  for (const r of upper) {
    const neb = r.biome === 'void' ? ['#5b3d9a', '#8a4fa8', '#2c3f8a'] : ['#2e4c9a', '#c9a35b', '#6a7fc4'];
    parts.push(`<g clip-path="url(#c-${r.id})"><rect x="${f(r.box[0])}" y="0" width="${f(r.box[2] - r.box[0])}" height="${f(r.box[3])}" fill="url(#sky)"/>` +
      nebula(r, neb) + stars(r, 420) + glyphLayer(r) + `</g>`);
  }
  parts.push(`<path d="${tierEdges('upper')}" fill="none" stroke="#e6dcb8" stroke-opacity=".55" stroke-width="4" filter="url(#rim)"/>`);
  parts.push(`<path d="${tierEdges('upper')}" fill="none" stroke="#efe2b4" stroke-opacity=".5" stroke-width=".9"/>`);
  // Бездна: разлом с огненной кромкой
  for (const r of abyss) {
    parts.push(`<g clip-path="url(#c-${r.id})"><rect x="${f(r.box[0])}" y="${f(r.box[1])}" width="${f(r.box[2] - r.box[0])}" height="${f(H - r.box[1])}" fill="url(#hell)"/>` +
      `<g filter="url(#relief-high)"><rect x="${f(r.box[0])}" y="${f(r.box[1])}" width="${f(r.box[2] - r.box[0])}" height="${f(H - r.box[1])}" fill="#1f0b07"/></g>` +
      `<path d="${tierEdges('abyss')}" fill="none" stroke="#c2361a" stroke-opacity=".4" stroke-width="34" filter="url(#haze)"/>` +
      lavaVeins(r) + `<g>${glyphLayer(r)}</g>` + embers(r, 160) + `</g>`);
  }
  parts.push(`<path d="${tierEdges('abyss')}" fill="none" stroke="#ff7a2a" stroke-opacity=".8" stroke-width="7" filter="url(#rim)"/>`);
  parts.push(`<path d="${tierEdges('abyss')}" fill="none" stroke="#ffc07a" stroke-opacity=".8" stroke-width="1.1"/>`);
  // Граница двух областей яруса — тонкая, как граница на суше
  parts.push(`<path d="${[...edges.values()].filter((e) => e.kind === 'tier' && e.owners.length === 2).map((e) => lineOf(e.pts)).join('')}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1.4"/>`);

  // Зернистость и виньетка
  parts.push(`<rect width="1600" height="1000" filter="url(#grain)"/>`);
  parts.push(`<rect width="1600" height="1000" fill="url(#vignette)"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1600" viewBox="0 0 1600 1000">` +
    `<!-- Процедурная карта мира: node map/render-art.mjs (не править руками). -->` +
    defs + parts.join('\n') + `</svg>\n`;
}

// ---------- запуск ----------
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** Ширина и высота WebP (VP8, VP8L, VP8X) — без зависимостей, для --check. */
export function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
  }
  if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

async function rasterize(svg) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const out = {};
    for (const r of RASTERS) {
      let q = 0.86;
      for (;;) {
        const data = await page.evaluate(
          async ({ svg, width, height, q }) => {
            const img = new Image();
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            await img.decode();
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL('image/webp', q).split(',')[1];
          },
          { svg, width: r.width, height: r.height, q },
        );
        const buf = Buffer.from(data, 'base64');
        if (buf.length <= r.budget * 0.95 || q <= 0.5) {
          out[r.file] = buf;
          console.log(`render-art: ${r.file} ${(buf.length / 1024).toFixed(0)} КБ (качество ${q.toFixed(2)})`);
          break;
        }
        q -= 0.04;
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

function check(svg) {
  const errors = [];
  if (!existsSync(SVG_FILE) || readFileSync(SVG_FILE, 'utf8') !== svg) {
    errors.push('public/map/world.svg не совпадает с пересборкой — node map/render-art.mjs');
  }
  const lock = existsSync(LOCK_FILE) ? JSON.parse(readFileSync(LOCK_FILE, 'utf8')) : {};
  if (lock.svg !== sha(svg)) errors.push('map/art.lock.json собран не из текущего SVG — node map/render-art.mjs');
  for (const r of RASTERS) {
    const file = join(OUT_DIR, r.file);
    if (!existsSync(file)) {
      errors.push(`нет public/map/${r.file}`);
      continue;
    }
    const buf = readFileSync(file);
    const size = webpSize(buf);
    if (lock[r.file] !== sha(buf)) errors.push(`${r.file} не из этой сборки (хеш не совпадает с map/art.lock.json)`);
    if (!size || size.width !== r.width || size.height !== r.height) errors.push(`${r.file}: не WebP ${r.width}×${r.height}`);
    if (buf.length > r.budget) errors.push(`${r.file}: ${(buf.length / 1024).toFixed(0)} КБ > ${r.budget / 1024} КБ`);
  }
  // Смещённые контуры: не дальше MAX_SHIFT от исходного ребра.
  for (const e of edges.values()) {
    for (const p of e.pts) if (segDist(p, e.a, e.b) > MAX_SHIFT + 1e-6) errors.push(`ребро ${e.key} ушло дальше 0.006`);
  }
  // Места и якоря подписей остаются внутри своих регионов и после смещения границ.
  for (const r of regions) {
    for (const p of [...r.places, r.label]) if (!inside(p, r.shape)) errors.push(`${r.id}: точка ${vkey(p)} вне смещённого контура`);
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const svg = render();
  if (process.argv.includes('--check')) {
    const errors = check(svg);
    if (errors.length) {
      for (const e of errors) console.error(`render-art: ${e}`);
      process.exit(1);
    }
    console.log('render-art: OK — world.svg и растр совпадают с пересборкой');
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(SVG_FILE, svg);
    console.log(`render-art: world.svg ${(svg.length / 1024).toFixed(0)} КБ`);
    const lock = { svg: sha(svg) };
    if (!process.argv.includes('--svg-only')) {
      const rasters = await rasterize(svg);
      for (const [file, buf] of Object.entries(rasters)) {
        writeFileSync(join(OUT_DIR, file), buf);
        lock[file] = sha(buf);
      }
      writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n');
    }
  }
}
