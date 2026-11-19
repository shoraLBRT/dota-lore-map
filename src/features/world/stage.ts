import type { KeyboardEvent } from 'react';
import type { Point } from '../../data/types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';

/** Нормированная точка данных → координаты сцены STAGE_WIDTH×STAGE_HEIGHT (ARCHITECTURE A4). */
export const toStage = ([x, y]: Point): [number, number] => [x * STAGE_WIDTH, y * STAGE_HEIGHT];
export const points = (polygon: Point[]) => polygon.map((p) => toStage(p).join(',')).join(' ');

/** Enter и пробел на SVG-кнопке (`role="button"`) — как клик. */
export function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action();
    }
  };
}

const num = (v: number) => Math.round(v * 10) / 10;

/**
 * Замкнутая гладкая кривая через точки многоугольника (#188): Catmull-Rom → кубические Безье, проходит
 * через те же точки `map/layout.json`, без изломов на углах. Для подсветки и маски региона; кнопка
 * региона (зона клика) остаётся многоугольником.
 */
export function smoothPath(polygon: Point[], tension = 0.5): string {
  const p = polygon.map(toStage);
  const n = p.length;
  if (n < 3) return '';
  const k = tension / 3;
  let d = `M${num(p[0]![0])},${num(p[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p[(i - 1 + n) % n]!, p[i]!, p[(i + 1) % n]!, p[(i + 2) % n]!];
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${num(c1[0]!)},${num(c1[1]!)} ${num(c2[0]!)},${num(c2[1]!)} ${num(p2[0])},${num(p2[1])}`;
  }
  return `${d}Z`;
}
