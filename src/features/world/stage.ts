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
