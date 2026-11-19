// Бюджет загрузки (SPEC §14, ARCHITECTURE A14): сколько весит собранный сайт до старта мира.
// Запуск после `vite build`: node scripts/check-budget.mjs — часть `npm run check`.
//
// До мира грузятся index.html, бандл JS и CSS (данные мира — внутри бандла), свои шрифты из dist/fonts (A8)
// и картинка мира из dist/art (A10: превью ждёт интро, полная догружается в мире) — считаем обе целиком.
// Портреты и картинки комиксов — с CDN Valve и только в панелях, подсказках и галерее, то есть уже в мире.
// Бюджет SPEC — ≤ ~3 МБ; бандлу даём 600 КБ gzip, чтобы рост был заметен задолго до предела.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUNDLE_BUDGET = 600 * 1024;
export const TOTAL_BUDGET = 3 * 1024 * 1024;
/** Одна картинка мира: полная 4096×4096 WebP не тяжелее этого. */
export const ART_BUDGET = 1.5 * 1024 * 1024;
/** Один тайл пирамиды арта (#164): WebP 512×512 не тяжелее этого. */
export const TILE_BUDGET = 256 * 1024;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Что браузер скачивает до мира: html, js, css из dist (gzip, как отдаёт GitHub Pages). */
export function measure(dist) {
  const files = walk(dist)
    .filter((f) => /\.(html|js|css)$/.test(f))
    .map((f) => ({ file: relative(dist, f).replaceAll('\\', '/'), gzip: gzipSync(readFileSync(f)).length }));
  return { files, total: files.reduce((s, f) => s + f.gzip, 0) };
}

/** Части бандла, которые грузятся после первого экрана (#186, `src/app/deferred.tsx`). */
export const DEFERRED_CHUNKS = ['Gallery', 'HeroProfile', 'HeroSearch'];

/**
 * Первый экран (#186): index.html и то, что он просит сам — скрипт входа, modulepreload и стили (gzip).
 * Отложенные части (`DEFERRED_CHUNKS`) должны быть отдельными файлами и не попадать сюда.
 */
export function measureFirstScreen(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  const files = ['index.html', ...refs.map((r) => r.replace(/^.*?\/assets\//, 'assets/'))].map((file) => ({
    file,
    gzip: gzipSync(readFileSync(join(dist, file))).length,
  }));
  const assets = existsSync(join(dist, 'assets')) ? readdirSync(join(dist, 'assets')) : [];
  const errors = [];
  for (const name of DEFERRED_CHUNKS) {
    if (!assets.some((f) => f.startsWith(`${name}-`) && f.endsWith('.js'))) errors.push(`нет отдельного куска ${name}-*.js — его затянуло в бандл первого экрана`);
    if (files.some((f) => f.file.startsWith(`assets/${name}-`))) errors.push(`${name} грузится с первым экраном (index.html)`);
  }
  return { files, total: files.reduce((s, f) => s + f.gzip, 0), errors };
}

/**
 * Шрифты из dist/fonts — все woff2 целиком, как худший случай (браузер берёт только нужные подмножества).
 * woff2 уже сжат, поэтому считаем размер файла, а не gzip.
 */
export function measureFonts(dist) {
  const dir = join(dist, 'fonts');
  const files = existsSync(dir)
    ? walk(dir)
        .filter((f) => f.endsWith('.woff2'))
        .map((f) => ({ file: relative(dist, f).replaceAll('\\', '/'), size: statSync(f).size }))
    : [];
  return { files, total: files.reduce((s, f) => s + f.size, 0) };
}

/** Картинки мира из dist/art (WebP уже сжат — размер файла). */
export function measureArt(dist) {
  const dir = join(dist, 'art');
  const files = existsSync(dir)
    ? walk(dir)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => ({ file: relative(dist, f).replaceAll('\\', '/'), size: statSync(f).size }))
    : [];
  return { files, total: files.reduce((s, f) => s + f.size, 0) };
}

/**
 * Пирамида тайлов арта (#164, ARCHITECTURE A10): dist/map/tiles/{z}/{x}_{y}.webp. Тайлы грузятся лениво,
 * только при сильном приближении, поэтому в бюджет до мира не входят — считаются отдельно.
 * `levels` — уровни из манифеста `src/features/world/tiles.json`: на уровне z должно быть ровно (2^z)² тайлов.
 */
export function measureTiles(dist, levels = []) {
  const dir = join(dist, 'map', 'tiles');
  const files = existsSync(dir)
    ? walk(dir)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => ({ file: relative(dist, f).replaceAll('\\', '/'), size: statSync(f).size }))
    : [];
  const errors = [];
  for (const z of levels) {
    const n = 2 ** z;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!existsSync(join(dir, String(z), `${x}_${y}.webp`))) {
          errors.push(`нет тайла map/tiles/${z}/${x}_${y}.webp из манифеста — node map/art/tiles.mjs pyramid`);
          break;
        }
      }
      if (errors.length) break;
    }
  }
  const stray = files.filter((f) => !levels.includes(Number(f.file.split('/')[2])));
  if (stray.length) errors.push(`тайлы ${stray[0].file} и др. (${stray.length}) не в манифесте tiles.json`);
  for (const f of files) if (f.size > TILE_BUDGET) errors.push(`${f.file} ${kb(f.size)} > ${kb(TILE_BUDGET)}`);
  return { files, total: files.reduce((s, f) => s + f.size, 0), errors };
}

const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  const { files, total } = measure(dist);
  const fonts = measureFonts(dist);
  const art = measureArt(dist);
  const manifest = JSON.parse(readFileSync(resolve(fileURLToPath(new URL('..', import.meta.url)), 'src/features/world/tiles.json'), 'utf8'));
  const tiles = measureTiles(dist, manifest.levels);
  const first = measureFirstScreen(dist);
  for (const f of files) console.log(`  ${f.file}: ${kb(f.gzip)}`);
  console.log(`  fonts/*.woff2 (${fonts.files.length}): ${kb(fonts.total)}`);
  for (const f of art.files) console.log(`  ${f.file}: ${kb(f.size)}`);
  console.log(`  map/tiles (${tiles.files.length}, лениво, вне бюджета до мира): ${kb(tiles.total)}`);
  console.log(`  первый экран (index.html, вход, modulepreload, css): ${kb(first.total)}`);
  const errors = [...tiles.errors, ...first.errors];
  if (files.length === 0) errors.push('dist пуст — сначала npm run build');
  if (fonts.files.length === 0) errors.push('в dist/fonts нет woff2 — шрифты должны быть в public/fonts');
  if (total > BUNDLE_BUDGET) errors.push(`бандл ${kb(total)} > бюджета ${kb(BUNDLE_BUDGET)}`);
  for (const f of art.files) if (f.size > ART_BUDGET) errors.push(`${f.file} ${kb(f.size)} > ${kb(ART_BUDGET)}`);
  const all = total + fonts.total + art.total;
  if (all > TOTAL_BUDGET) errors.push(`с шрифтами и артом ${kb(all)} > ${kb(TOTAL_BUDGET)}`);
  if (errors.length) {
    for (const e of errors) console.error(`check-budget: ${e}`);
    process.exit(1);
  }
  console.log(`check-budget: OK — бандл ${kb(total)} gzip (бюджет ${kb(BUNDLE_BUDGET)}), шрифты ${kb(fonts.total)}, арт мира ${kb(art.total)}, вместе ${kb(all)} из ${kb(TOTAL_BUDGET)}`);
}
