// Камеры регионов в map/layout.json — по правилу кадра (#112, docs/map/README.md «Камера»).
// Запуск из корня репозитория: node map/cameras.mjs — пересчитать и записать; правило проверяет check-layout.
//
// Правило: центр — середина габарита полигона; габарит вписан в мир, вписанный в кадр, с полем REGION_MARGIN
// с каждой стороны: zoom = (1 − 2·поле) / max(ширина, высота габарита), в пределах [ZOOM_MIN, ZOOM_MAX].
// Под панель и шторку кадр ужимает `frameCamera` в коде (src/features/world/camera.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Поле вокруг габарита региона — доля кадра с каждой стороны. */
export const REGION_MARGIN = 0.12;
/** Мельче этого маленький регион не приближается: дальше арт расплывается. */
export const ZOOM_MAX = 5;
export const ZOOM_MIN = 1;

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** Камера региона по его полигону (доли мира). */
export function regionCamera(polygon) {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = Math.max(right - left, bottom - top);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (1 - 2 * REGION_MARGIN) / size));
  return { x: r4((left + right) / 2), y: r4((top + bottom) / 2), zoom: r2(zoom) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'layout.json');
  const text = readFileSync(file, 'utf8');
  const cameras = Object.values(JSON.parse(text).regions).map((r) => regionCamera(r.polygon));
  let i = 0;
  const next = text.replace(/"camera": \{[^}]*\}/g, () => {
    const c = cameras[i++];
    return `"camera": { "x": ${c.x}, "y": ${c.y}, "zoom": ${c.zoom} }`;
  });
  if (i !== cameras.length) throw new Error(`камер в тексте ${i}, регионов ${cameras.length}`);
  writeFileSync(file, next);
  console.log(`камеры пересчитаны: ${cameras.length}`);
}
