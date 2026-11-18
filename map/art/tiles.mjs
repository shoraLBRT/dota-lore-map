// Дорисовка арта мира плитками и пирамида тайлов (#164, ARCHITECTURE A10, docs/map/README.md «Плитки арта»).
//
//   node map/art/tiles.mjs cut       — нарезать map/art/world.jpg на 4×4 плитки с перекрытием 128 px,
//                                      отметить море и космос, записать tiles.json, превью и README владельцу
//   node map/art/tiles.mjs stitch    — собрать мастер ×2 из map/art/tiles/refined/* (нет плитки — увеличенный
//                                      исходник), выровнять цвет, растушевать швы, проверить сдвиг берегов
//   node map/art/tiles.mjs pyramid   — тайлы WebP 512 px из мастера в public/map/tiles/{z}/{x}_{y}.webp,
//                                      манифест src/features/world/tiles.json; есть дорисованные — и world-4096.webp
//
// В Git: tiles.json, превью и README. Нарезка (cut/), дорисовка (refined/) и мастер — нет (.gitignore, сотни МБ).

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'map/art/world.jpg');
const DIR = join(ROOT, 'map/art/tiles');
const CUT = join(DIR, 'cut');
const REFINED = join(DIR, 'refined');
const PREVIEW = join(DIR, 'preview');
const MASTER = join(DIR, 'master.png');
const PUBLIC_TILES = join(ROOT, 'public/map/tiles');
const WORLD_4096 = join(ROOT, 'public/art/world-4096.webp');
const MANIFEST = join(ROOT, 'src/features/world/tiles.json');

export const GRID = 4;
export const OVERLAP = 128;
export const SCALE = 2;
export const TILE = 512;
/** Ниже этой стороны пирамиды хватает world-4096.webp — такие уровни не режем. */
export const WORLD_PX = 4096;
/** Плитка «однотонная», если доля ровных блоков не меньше этой — море или космос, не дорисовываем. */
export const FLAT_SHARE = 0.8;
/** Блок ровный, если разброс яркости в нём меньше этого (0..255). */
const FLAT_STD = 6;
/** Берега дорисованной плитки сдвинуты не больше этой доли ширины мира. */
export const COAST_LIMIT = 0.003;

const name = (row, col) => `r${row}c${col}`;

/** Границы ячеек сетки по одной оси: GRID + 1 чисел от 0 до size. */
export function cells(size, grid = GRID) {
  return Array.from({ length: grid + 1 }, (_, i) => Math.round((i * size) / grid));
}

/** Плитки сетки: ячейка плюс перекрытие с соседями, у края мира — без выхода за край. */
export function tileRects(size, grid = GRID, overlap = OVERLAP) {
  const b = cells(size, grid);
  const out = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = Math.max(0, b[col] - overlap);
      const y = Math.max(0, b[row] - overlap);
      out.push({
        name: name(row, col),
        row,
        col,
        x,
        y,
        w: Math.min(size, b[col + 1] + overlap) - x,
        h: Math.min(size, b[row + 1] + overlap) - y,
      });
    }
  }
  return out;
}

/**
 * Вес плитки `i` в точке `p` по одной оси (линейная растушёвка по зоне перекрытия).
 * У соседних плиток веса в сумме дают 1, поэтому мастер — их взвешенная сумма без деления.
 * `b` — границы ячеек, `ov` — перекрытие (в тех же единицах, что p).
 */
export function axisWeight(i, p, b, ov) {
  const last = b.length - 2;
  const ramp = (edge) => Math.min(1, Math.max(0, (p + 0.5 - (edge - ov)) / (2 * ov)));
  let w = 1;
  if (i > 0) w = Math.min(w, ramp(b[i]));
  if (i < last) w = Math.min(w, 1 - ramp(b[i + 1]));
  return w;
}

/** Доля ровных блоков 8×8 в картинке RGB (по яркости). */
export function flatShare(data, width, height, block = 8) {
  let flat = 0;
  let all = 0;
  for (let by = 0; by + block <= height; by += block) {
    for (let bx = 0; bx + block <= width; bx += block) {
      let s = 0;
      let s2 = 0;
      for (let y = by; y < by + block; y++) {
        for (let x = bx; x < bx + block; x++) {
          const i = (y * width + x) * 3;
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          s += l;
          s2 += l * l;
        }
      }
      const n = block * block;
      const std = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
      all++;
      if (std < FLAT_STD) flat++;
    }
  }
  return all ? flat / all : 1;
}

/** Выровнять цвет `data` под `ref`: среднее и разброс по каждому каналу (RGB, на месте). */
export function matchColor(data, ref) {
  const stats = (buf) => {
    const m = [0, 0, 0];
    const v = [0, 0, 0];
    const n = buf.length / 3;
    for (let i = 0; i < buf.length; i++) m[i % 3] += buf[i];
    for (let c = 0; c < 3; c++) m[c] /= n;
    for (let i = 0; i < buf.length; i++) v[i % 3] += (buf[i] - m[i % 3]) ** 2;
    return { m, s: v.map((x) => Math.sqrt(x / n) || 1) };
  };
  const a = stats(data);
  const r = stats(ref);
  for (let i = 0; i < data.length; i++) {
    const c = i % 3;
    data[i] = Math.min(255, Math.max(0, Math.round(((data[i] - a.m[c]) / a.s[c]) * r.s[c] + r.m[c])));
  }
  return data;
}

/** Уровни пирамиды: z, у которых сторона 512·2^z больше world-4096 и не больше мастера. */
export function pyramidLevels(masterSize, tile = TILE) {
  const out = [];
  for (let z = 0; tile * 2 ** z <= masterSize; z++) if (tile * 2 ** z > WORLD_PX) out.push(z);
  return out;
}

async function readSource() {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== info.height) throw new Error(`world.jpg не квадратный: ${info.width}×${info.height}`);
  return { data, size: info.width };
}

const rawOf = (data, width, height) => sharp(data, { raw: { width, height, channels: 3 } });

// ─── cut ─────────────────────────────────────────────────────────────────────

async function cut() {
  const { data, size } = await readSource();
  mkdirSync(CUT, { recursive: true });
  mkdirSync(PREVIEW, { recursive: true });
  const tiles = [];
  for (const t of tileRects(size)) {
    const piece = rawOf(data, size, size).extract({ left: t.x, top: t.y, width: t.w, height: t.h });
    await piece.clone().png({ compressionLevel: 6 }).toFile(join(CUT, `${t.name}.png`));
    const small = await piece.clone().resize(Math.round(t.w / 4), Math.round(t.h / 4)).raw().toBuffer({ resolveWithObject: true });
    const flat = flatShare(small.data, small.info.width, small.info.height);
    await piece.clone().resize(256).webp({ quality: 70 }).toFile(join(PREVIEW, `${t.name}.webp`));
    tiles.push({ ...t, flat: Math.round(flat * 1000) / 1000, skip: flat >= FLAT_SHARE });
  }
  const meta = { source: 'map/art/world.jpg', size, grid: GRID, overlap: OVERLAP, scale: SCALE, tiles };
  writeFileSync(join(DIR, 'tiles.json'), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(DIR, 'README.md'), readme(meta));
  const todo = tiles.filter((t) => !t.skip).length;
  console.log(`tiles cut: ${tiles.length} плиток в map/art/tiles/cut/, дорисовать ${todo}, пропустить ${tiles.length - todo}`);
}

function readme(meta) {
  const rows = meta.tiles
    .map((t) => `| ${t.name} | ![${t.name}](preview/${t.name}.webp) | ${t.w}×${t.h} | ${Math.round(t.flat * 100)} % | ${t.skip ? 'не дорисовывать' : '**дорисовать**'} |`)
    .join('\n');
  return `# Плитки арта мира (#164)

Файл создаёт \`node map/art/tiles.mjs cut\` — руками не править, перезапуск перепишет. Как устроены скрипты — [docs/map/README.md](../../../docs/map/README.md), раздел «Плитки арта».

Исходник \`${meta.source}\` (${meta.size}×${meta.size}) разрезан сеткой ${meta.grid}×${meta.grid}, у каждой плитки перекрытие с соседями ${meta.overlap} px. Плитки — в \`map/art/tiles/cut/\` (в Git не хранятся: после свежего клона сначала \`cut\`).

## Инструкция владельцу

1. \`npm ci\`, затем \`node map/art/tiles.mjs cut\` — появятся \`map/art/tiles/cut/r{ряд}c{столбец}.png\`.
2. Каждую плитку с пометкой **дорисовать** (таблица ниже) прогнать через **creative upscale ×${meta.scale} с низкой креативностью**:
   - **Krea Enhancer**: upscale ×${meta.scale}, creativity / strength 0.2–0.3, resemblance высокий;
   - или **Stable Diffusion + Ultimate SD Upscale** с ControlNet **tile** (вес 0.8–1.0), denoising 0.25–0.35, апскейлер 4x-UltraSharp или ESRGAN, тайл 1024, seam fix — band pass.
   - **Не ChatGPT** и не другие генераторы «по образу»: они сдвигают берега, и плитка не пройдёт проверку.
   - Промпт один для всех плиток (ниже), сид — один и тот же.
3. Результат сохранить в \`map/art/tiles/refined/\` под тем же именем (\`r1c2.png\`, PNG или WebP). Размер — примерно ×${meta.scale} от плитки; точный не важен, сборка подгонит. Плитки с пометкой «не дорисовывать» не нужны: на их месте будет увеличенный исходник.
4. \`node map/art/tiles.mjs stitch\` — собирает мастер и печатает сдвиг берегов по каждой плитке. Плитку со сдвигом больше ${COAST_LIMIT * 100} % ширины мира переделать (ниже creativity) и запустить снова.
5. \`node map/art/tiles.mjs pyramid\` — тайлы в \`public/map/tiles/\`, манифест \`src/features/world/tiles.json\` и новый \`public/art/world-4096.webp\`. Затем \`npm run check\` и PR с этими файлами.

Дорисованные плитки и мастер в Git не идут (\`.gitignore\`, сотни мегабайт): сохраните \`refined/\` у себя, чтобы пересобрать позже.

### Промпт

\`\`\`
Realistic fantasy world seen from orbit, strictly top-down satellite imagery, rich natural relief:
sharp mountain ridges, river valleys, forests, glaciers, deserts, coastlines with surf, cities at map scale.
Dark fantasy mood, Dota 2 inspired palette. Keep every coastline, river and city exactly where it is.
No text, no letters, no labels, no runes, no frame, no border, no watermark, no moons.
\`\`\`

Отрицательный промпт (SD): \`text, letters, watermark, frame, border, moon, blurry, painting, cartoon\`.

## Плитки

«Ровно» — доля спокойных блоков (море, космос); от ${Math.round(FLAT_SHARE * 100)} % плитку не дорисовываем.

| Плитка | Превью | Размер, px | Ровно | Что делать |
|---|---|---|---|---|
${rows}
`;
}

// ─── stitch ──────────────────────────────────────────────────────────────────

function readMeta() {
  const file = join(DIR, 'tiles.json');
  if (!existsSync(file)) throw new Error('нет map/art/tiles/tiles.json — сначала node map/art/tiles.mjs cut');
  return JSON.parse(readFileSync(file, 'utf8'));
}

function refinedFile(tileName) {
  if (!existsSync(REFINED)) return undefined;
  const f = readdirSync(REFINED).find((n) => n.replace(/\.(png|webp|jpe?g|tiff?)$/i, '') === tileName);
  return f && join(REFINED, f);
}

/** Плитка мастера (w·S × h·S, RGB): дорисованная с цветом исходника или увеличенный исходник. */
async function masterTile(src, size, t, s) {
  const W = t.w * s;
  const H = t.h * s;
  const base = await rawOf(src, size, size)
    .extract({ left: t.x, top: t.y, width: t.w, height: t.h })
    .resize(W, H, { kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  const file = refinedFile(t.name);
  if (!file) return { data: base, refined: false };
  const data = await sharp(file).removeAlpha().resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  return { data: matchColor(data, base), refined: true };
}

async function stitch() {
  const meta = readMeta();
  const { data: src, size } = await readSource();
  if (size !== meta.size) throw new Error(`world.jpg ${size} px, а tiles.json — ${meta.size}: перезапустить cut`);
  const s = meta.scale;
  const M = size * s;
  const b = cells(size, meta.grid).map((v) => v * s);
  const ov = meta.overlap * s;
  const master = Buffer.alloc(M * M * 3);
  const refined = [];
  // Полосами по ряду ячеек: в полосу пишут плитки своего ряда и соседних (растушёвка по вертикали).
  for (let row = 0; row < meta.grid; row++) {
    const y0 = b[row];
    const y1 = b[row + 1];
    const acc = new Float32Array((y1 - y0) * M * 3);
    for (const t of meta.tiles) {
      const ty0 = t.y * s;
      const ty1 = ty0 + t.h * s;
      if (ty1 <= y0 || ty0 >= y1) continue;
      const { data, refined: r } = await masterTile(src, size, t, s);
      if (r && !refined.includes(t.name)) refined.push(t.name);
      const tx0 = t.x * s;
      const W = t.w * s;
      const wx = Float32Array.from({ length: W }, (_, i) => axisWeight(t.col, tx0 + i, b, ov));
      for (let y = Math.max(y0, ty0); y < Math.min(y1, ty1); y++) {
        const wy = axisWeight(t.row, y, b, ov);
        if (wy === 0) continue;
        const srow = (y - ty0) * W * 3;
        const drow = ((y - y0) * M + tx0) * 3;
        for (let x = 0; x < W; x++) {
          const w = wx[x] * wy;
          if (w === 0) continue;
          const si = srow + x * 3;
          const di = drow + x * 3;
          acc[di] += data[si] * w;
          acc[di + 1] += data[si + 1] * w;
          acc[di + 2] += data[si + 2] * w;
        }
      }
    }
    const out = master.subarray(y0 * M * 3, y1 * M * 3);
    for (let i = 0; i < acc.length; i++) out[i] = Math.min(255, Math.max(0, Math.round(acc[i])));
  }
  await rawOf(master, M, M).png({ compressionLevel: 3 }).toFile(MASTER);
  console.log(`tiles stitch: мастер ${M}×${M} → map/art/tiles/master.png; дорисовано ${refined.length} из ${meta.tiles.length}${refined.length ? ` (${refined.sort().join(', ')})` : ' — весь мастер из увеличенного исходника'}`);
  const bad = await coastCheck(src, size, master, M, meta);
  if (bad.length) {
    console.error(`tiles stitch: берега сдвинуты больше ${COAST_LIMIT * 100} % — переделать: ${bad.join(', ')}`);
    process.exitCode = 1;
  }
}

// ─── проверка берегов ────────────────────────────────────────────────────────

/** Маска воды как в map/art/fit/mask.cjs: синеватое и тёмное — вода (0), остальное — суша (1). */
export function landMask(data, n) {
  const m = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const bl = data[i * 3 + 2];
    m[i] = bl - (r + g) / 2 > 12 && (r + g + bl) / 3 < 75 ? 0 : 1;
  }
  return m;
}

/** Береговые пиксели: у соседа по стороне другой тип. */
export function coastOf(m, n) {
  const c = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const v = m[i];
      if ((x > 0 && m[i - 1] !== v) || (x < n - 1 && m[i + 1] !== v) || (y > 0 && m[i - n] !== v) || (y < n - 1 && m[i + n] !== v)) c[i] = 1;
    }
  }
  return c;
}

/** Расстояние до ближайшего пикселя `on` (фаска 1/√2, два прохода). */
export function distanceTo(on, n) {
  const d = new Float32Array(n * n).fill(1e9);
  for (let i = 0; i < n * n; i++) if (on[i]) d[i] = 0;
  const D = Math.SQRT2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - n] + 1);
        if (x > 0) d[i] = Math.min(d[i], d[i - n - 1] + D);
        if (x < n - 1) d[i] = Math.min(d[i], d[i - n + 1] + D);
      }
    }
  }
  for (let y = n - 1; y >= 0; y--) {
    for (let x = n - 1; x >= 0; x--) {
      const i = y * n + x;
      if (x < n - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < n - 1) {
        d[i] = Math.min(d[i], d[i + n] + 1);
        if (x < n - 1) d[i] = Math.min(d[i], d[i + n + 1] + D);
        if (x > 0) d[i] = Math.min(d[i], d[i + n - 1] + D);
      }
    }
  }
  return d;
}

/** 95-й перцентиль расстояний от берега `a` до берега `b` внутри прямоугольника (n px). */
function shiftP95(coastA, distB, n, x0, y0, x1, y1) {
  const v = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (coastA[y * n + x]) v.push(distB[y * n + x]);
  if (!v.length) return 0;
  v.sort((p, q) => p - q);
  return v[Math.floor(v.length * 0.95)];
}

async function coastCheck(src, size, master, M, meta) {
  const n = 2000;
  // Размытие убирает шум маски (лава, облака у порога цвета), берега оно почти не двигает.
  const small = async (data, s) => rawOf(data, s, s).resize(n, n, { kernel: 'lanczos3' }).blur(2).raw().toBuffer();
  const ca = coastOf(landMask(await small(src, size), n), n);
  const cb = coastOf(landMask(await small(master, M), n), n);
  const da = distanceTo(ca, n);
  const db = distanceTo(cb, n);
  const b = cells(n, meta.grid);
  const limit = COAST_LIMIT * n;
  const bad = [];
  const lines = [];
  for (const t of meta.tiles) {
    const [x0, x1, y0, y1] = [b[t.col], b[t.col + 1], b[t.row], b[t.row + 1]];
    const shift = Math.max(shiftP95(cb, da, n, x0, y0, x1, y1), shiftP95(ca, db, n, x0, y0, x1, y1));
    const pct = (shift / n) * 100;
    if (shift > limit) bad.push(t.name);
    lines.push(`${t.name} ${pct.toFixed(2)}%`);
  }
  console.log(`tiles stitch: сдвиг берегов (p95, % ширины, предел ${COAST_LIMIT * 100}): ${lines.join(', ')}`);
  return bad;
}

// ─── pyramid ─────────────────────────────────────────────────────────────────

async function pyramid() {
  if (!existsSync(MASTER)) throw new Error('нет map/art/tiles/master.png — сначала node map/art/tiles.mjs stitch');
  const meta = readMeta();
  const { data: master, info } = await sharp(MASTER, { limitInputPixels: false }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const M = info.width;
  const levels = pyramidLevels(M);
  rmSync(PUBLIC_TILES, { recursive: true, force: true });
  let count = 0;
  let bytes = 0;
  for (const z of levels) {
    const L = TILE * 2 ** z;
    const n = L / TILE;
    const level = await rawOf(master, M, M).resize(L, L, { kernel: 'lanczos3' }).raw().toBuffer();
    mkdirSync(join(PUBLIC_TILES, String(z)), { recursive: true });
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const buf = await rawOf(level, L, L)
          .extract({ left: x * TILE, top: y * TILE, width: TILE, height: TILE })
          .webp({ quality: 78, effort: 5 })
          .toBuffer();
        writeFileSync(join(PUBLIC_TILES, String(z), `${x}_${y}.webp`), buf);
        count++;
        bytes += buf.length;
      }
    }
  }
  const refined = meta.tiles.filter((t) => refinedFile(t.name)).length;
  writeFileSync(MANIFEST, `${JSON.stringify({ tile: TILE, levels, refined }, null, 2)}\n`);
  console.log(`tiles pyramid: уровни ${levels.join(', ')} — ${count} тайлов, ${(bytes / 1024 / 1024).toFixed(1)} МБ → public/map/tiles/`);
  // Без дорисованных плиток мастер — тот же исходник: world-4096.webp не трогаем, чтобы не плодить двоичные правки.
  if (refined > 0) {
    const buf = await rawOf(master, M, M).resize(WORLD_PX, WORLD_PX, { kernel: 'lanczos3' }).webp({ quality: 80, effort: 5 }).toBuffer();
    writeFileSync(WORLD_4096, buf);
    console.log(`tiles pyramid: public/art/world-4096.webp ${(buf.length / 1024).toFixed(0)} КБ (из мастера, дорисовано ${refined})`);
  } else {
    console.log('tiles pyramid: дорисованных плиток нет — world-4096.webp не перезаписан');
  }
}

const commands = { cut, stitch, pyramid };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = commands[process.argv[2]];
  if (!cmd) {
    console.error('usage: node map/art/tiles.mjs cut | stitch | pyramid');
    process.exit(2);
  }
  cmd().catch((e) => {
    console.error(`tiles ${process.argv[2]}: ${e.message}`);
    process.exit(1);
  });
}
