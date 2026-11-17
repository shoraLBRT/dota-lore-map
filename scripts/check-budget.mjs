// Бюджет загрузки (SPEC §14, ARCHITECTURE A14): сколько весит собранный сайт до старта мира.
// Запуск после `vite build`: node scripts/check-budget.mjs — часть `npm run check`.
//
// До мира грузятся index.html, бандл JS и CSS (данные мира — внутри бандла), шрифты Google Fonts
// и картинка мира `map/world-2560.webp` (её ждёт кнопка «Начать», ARCHITECTURE A10; превью 640 — для README и интро).
// Портреты и картинки комиксов — с CDN Valve и только в панелях, подсказках и галерее, то есть уже в мире.
// Бюджет SPEC — ≤ ~3 МБ; бандлу даём 600 КБ gzip, чтобы рост был заметен задолго до предела.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUNDLE_BUDGET = 600 * 1024;
/** Шрифты Google Fonts (2 семейства, 5 начертаний, кириллица + латиница) — с запасом, их нет в dist. */
export const FONTS_ESTIMATE = 400 * 1024;
export const TOTAL_BUDGET = 3 * 1024 * 1024;
/** Картинки мира (#110): WebP уже сжат, считаем как есть. `beforeWorld` — грузится до мира. */
export const WORLD_ART = [
  { file: 'map/world-2560.webp', budget: 700 * 1024, beforeWorld: true },
  { file: 'map/world-640.webp', budget: 60 * 1024, beforeWorld: false },
];

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

/** Размеры картинок мира в dist; нет файла — `bytes: null`. */
export function measureArt(dist) {
  return WORLD_ART.map((a) => {
    const path = join(dist, a.file);
    return { ...a, bytes: existsSync(path) ? statSync(path).size : null };
  });
}

const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
  const { files, total: bundle } = measure(dist);
  for (const f of files) console.log(`  ${f.file}: ${kb(f.gzip)}`);
  const errors = [];
  const art = measureArt(dist);
  for (const a of art) {
    if (a.bytes === null) errors.push(`нет ${a.file} — node map/render-art.mjs`);
    else {
      console.log(`  ${a.file}: ${kb(a.bytes)}`);
      if (a.bytes > a.budget) errors.push(`${a.file} ${kb(a.bytes)} > бюджета ${kb(a.budget)}`);
    }
  }
  const total = bundle + art.filter((a) => a.beforeWorld).reduce((s, a) => s + (a.bytes ?? 0), 0);
  if (files.length === 0) errors.push('dist пуст — сначала npm run build');
  if (bundle > BUNDLE_BUDGET) errors.push(`бандл ${kb(bundle)} > бюджета ${kb(BUNDLE_BUDGET)}`);
  if (total + FONTS_ESTIMATE > TOTAL_BUDGET) errors.push(`с картинкой мира и шрифтами ${kb(total + FONTS_ESTIMATE)} > ${kb(TOTAL_BUDGET)}`);
  if (errors.length) {
    for (const e of errors) console.error(`check-budget: ${e}`);
    process.exit(1);
  }
  console.log(
    `check-budget: OK — бандл ${kb(bundle)} gzip (бюджет ${kb(BUNDLE_BUDGET)}), с картинкой мира и шрифтами ≈ ${kb(total + FONTS_ESTIMATE)} из ${kb(TOTAL_BUDGET)}`,
  );
}
