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

const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  const { files, total } = measure(dist);
  const fonts = measureFonts(dist);
  const art = measureArt(dist);
  for (const f of files) console.log(`  ${f.file}: ${kb(f.gzip)}`);
  console.log(`  fonts/*.woff2 (${fonts.files.length}): ${kb(fonts.total)}`);
  for (const f of art.files) console.log(`  ${f.file}: ${kb(f.size)}`);
  const errors = [];
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
