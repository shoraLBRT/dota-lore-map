import type { Screen } from '../../app/router';

// Фокус после перехода между экранами карты (SPEC §14, ARCHITECTURE A14).
// Элемент с фокусом часто пропадает при переходе: полигон региона в S2 перестаёт быть кнопкой,
// крошки уезжают вместе с панелью. Тогда фокус ставится туда, где продолжать естественно.

// id регионов и slug мест — kebab-case (ARCHITECTURE A5), экранировать в селекторе нечего.
const NATIVE_FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select, textarea, iframe';

/** Фокус потерян: его нет, он на body, на удалённом, скрытом или больше не фокусируемом элементе. */
export function focusLost(active: Element | null): boolean {
  if (!active || active === active.ownerDocument.body || !active.isConnected) return true;
  if (active.closest('[aria-hidden="true"], [inert]')) return true;
  return !active.hasAttribute('tabindex') && !active.matches(NATIVE_FOCUSABLE);
}

/**
 * Куда поставить фокус после перехода `prev` → `next`:
 * вверх (место → регион, регион → мир) — на маркер места или полигон региона, откуда пришли;
 * вниз и вбок — на заголовок правой панели (скринридер прочитает, куда попали, Tab ведёт по панели).
 */
export function focusTarget(root: ParentNode, prev: Screen, next: Screen): HTMLElement | SVGElement | null {
  if (next.name === 'world' || next.name === 'intro') {
    if (prev.name !== 'region' && prev.name !== 'place') return null;
    return root.querySelector<SVGElement>(`[data-region="${prev.regionId}"][tabindex]`);
  }
  if (next.name === 'region' && prev.name === 'place' && prev.regionId === next.regionId) {
    const marker = root.querySelector<SVGElement>(`[data-place="${prev.placeSlug}"][tabindex]`);
    if (marker) return marker;
  }
  return root.querySelector<HTMLElement>('[data-panel-heading]');
}

/** Переносит фокус после перехода, только если он потерян: фокус, который пользователь держит, не трогаем. */
export function restoreFocus(root: HTMLElement, prev: Screen, next: Screen): void {
  if (!focusLost(root.ownerDocument.activeElement)) return;
  focusTarget(root, prev, next)?.focus({ preventScroll: true });
}
