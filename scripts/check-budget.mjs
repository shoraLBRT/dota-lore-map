// Бюджет загрузки (SPEC §14, ARCHITECTURE A14): сколько весит собранный сайт до старта мира.
// Запуск после `vite build`: node scripts/check-budget.mjs — часть `npm run check`.
//
// До мира грузятся только index.html, бандл JS и CSS (данные мира — внутри бандла) и шрифты Google Fonts.
// Портреты и картинки комиксов — с CDN Valve и только в панелях, подсказках и галерее, то есть уже в мире.
// Бюджет SPEC — ≤ ~3 МБ; бандлу даём 600 КБ gzip, чтобы рост был заметен задолго до предела.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUNDLE_BUDGET = 600 * 1024;
/** Шрифты Google Fonts (2 семейства, 5 начертаний, кириллица + латиница) — с запасом, их нет в dist. */
export const FONTS_ESTIMATE = 400 * 1024;
export const TOTAL_BUDGET = 3 * 1024 * 1024;

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

const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  const { files, total } = measure(dist);
  for (const f of files) console.log(`  ${f.file}: ${kb(f.gzip)}`);
  const errors = [];
  if (files.length === 0) errors.push('dist пуст — сначала npm run build');
  if (total > BUNDLE_BUDGET) errors.push(`бандл ${kb(total)} > бюджета ${kb(BUNDLE_BUDGET)}`);
  if (total + FONTS_ESTIMATE > TOTAL_BUDGET) errors.push(`с шрифтами ${kb(total + FONTS_ESTIMATE)} > ${kb(TOTAL_BUDGET)}`);
  if (errors.length) {
    for (const e of errors) console.error(`check-budget: ${e}`);
    process.exit(1);
  }
  console.log(`check-budget: OK — бандл ${kb(total)} gzip (бюджет ${kb(BUNDLE_BUDGET)}), с шрифтами ≈ ${kb(total + FONTS_ESTIMATE)} из ${kb(TOTAL_BUDGET)}`);
}
