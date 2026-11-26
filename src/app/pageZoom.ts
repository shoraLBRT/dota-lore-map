/** Атрибут на `<html>`, пока страница приближена браузером (щипок, автоприближение поля ввода) — #252. */
export const PAGE_ZOOM_ATTR = 'data-page-zoom';

/** Запас на дробный масштаб `visualViewport` после возврата к 1. */
const EPS = 0.01;

/**
 * Приближена ли страница браузером (а не камера карты). Тогда карта отдаёт щипок браузеру: иначе её
 * `touch-action: none` и `preventDefault` у gesture* не дают отдалить страницу обратно (#252).
 */
export function pageZoomed(): boolean {
  const scale = typeof window === 'undefined' ? 1 : (window.visualViewport?.scale ?? 1);
  return scale > 1 + EPS;
}

/** Держит {@link PAGE_ZOOM_ATTR} в согласии с масштабом страницы. Возвращает «отписаться». */
export function watchPageZoom(root: HTMLElement = document.documentElement): () => void {
  const vv = window.visualViewport;
  const sync = () => {
    if (pageZoomed()) root.setAttribute(PAGE_ZOOM_ATTR, '');
    else root.removeAttribute(PAGE_ZOOM_ATTR);
  };
  sync();
  if (!vv) return () => undefined;
  vv.addEventListener('resize', sync);
  return () => {
    vv.removeEventListener('resize', sync);
    root.removeAttribute(PAGE_ZOOM_ATTR);
  };
}
