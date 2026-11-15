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

/** Откуда открыли регион: с карты или из списка регионов под картой на телефоне (#39). */
export interface FocusOrigin {
  /** Регион открыт пунктом списка: вверх в мир — на этот пункт, а не на полигон. */
  listRegionId?: string | null;
}

/**
 * Куда поставить фокус после перехода `prev` → `next`:
 * вверх (место → регион, регион → мир) — на маркер места или регион, откуда пришли
 * (полигон; пункт списка регионов, если регион открыли из него и список на экране);
 * вниз и вбок — на заголовок правой панели (скринридер прочитает, куда попали, Tab ведёт по панели).
 */
export function focusTarget(
  root: ParentNode,
  prev: Screen,
  next: Screen,
  origin: FocusOrigin = {},
): HTMLElement | SVGElement | null {
  if (next.name === 'world' || next.name === 'intro') {
    if (prev.name !== 'region' && prev.name !== 'place') return null;
    if (origin.listRegionId === prev.regionId) {
      const item = root.querySelector<HTMLElement>(`[data-list-region="${prev.regionId}"]`);
      if (item) return item;
    }
    return root.querySelector<SVGElement>(`[data-region="${prev.regionId}"][tabindex]`);
  }
  if (next.name === 'region' && prev.name === 'place' && prev.regionId === next.regionId) {
    const marker = root.querySelector<SVGElement>(`[data-place="${prev.placeSlug}"][tabindex]`);
    if (marker) return marker;
  }
  return root.querySelector<HTMLElement>('[data-panel-heading]');
}

/** Переносит фокус после перехода, только если он потерян: фокус, который пользователь держит, не трогаем. */
export function restoreFocus(root: HTMLElement, prev: Screen, next: Screen, origin: FocusOrigin = {}): void {
  if (!focusLost(root.ownerDocument.activeElement)) return;
  const target = focusTarget(root, prev, next, origin);
  target?.focus({ preventScroll: true });
  // Пункт списка прокручиваем только внутри самого списка: focus() со скроллом сдвинул бы и кадр карты (overflow: hidden).
  const list = target?.closest<HTMLElement>('[data-region-list]');
  if (target instanceof HTMLElement && list) {
    const top = target.offsetTop;
    if (top < list.scrollTop || top + target.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, top - (list.clientHeight - target.offsetHeight) / 2);
    }
  }
}

/**
 * Tab с последнего элемента подсказки региона (#65): подсказка — портал в конце документа, поэтому фокус
 * ставим на следующий по порядку Tab элемент после полигона, будто подсказка стояла сразу за ним.
 * Элементы внутри `skip` пропускаются; не нашлось — фокус возвращается на `from`.
 */
export function focusAfter(from: HTMLElement | SVGElement, skip?: Element | null): void {
  const doc = from.ownerDocument;
  const all = Array.from(doc.querySelectorAll<HTMLElement | SVGElement>(`${NATIVE_FOCUSABLE}, [tabindex]`)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && !skip?.contains(el),
  );
  for (const el of all.slice(all.indexOf(from) + 1)) {
    el.focus();
    if (doc.activeElement === el) return;
  }
  from.focus();
}
