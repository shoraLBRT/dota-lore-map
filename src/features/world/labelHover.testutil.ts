import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// Тесты: мышь на подписи региона (#193). Подсказку вызывает габарит подписи на экране (`useRegionTooltip`),
// а в jsdom габаритов нет — подписи раскладываются в ряд по 100 px, мышь ставится в центр нужной.

const LABEL = { width: 60, height: 20, step: 100, top: 100 };

function placeLabels(): Map<string, DOMRect> {
  const boxes = new Map<string, DOMRect>();
  document.querySelectorAll('[data-label]').forEach((el, i) => {
    const box = new DOMRect(100 + i * LABEL.step, LABEL.top, LABEL.width, LABEL.height);
    boxes.set(el.getAttribute('data-label')!, box);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(box);
  });
  return boxes;
}

/** Мышь над картой: в центр подписи региона `id` или (null) мимо всех подписей. */
export function pointAtLabel(id: string | null, pointerType = 'mouse') {
  const boxes = placeLabels();
  const box = id ? boxes.get(id)! : new DOMRect(100, LABEL.top + 300, 1, 1);
  const map = document.querySelector('[data-map-viewport] svg')!;
  fireEvent.pointerMove(map, { pointerType, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
}
