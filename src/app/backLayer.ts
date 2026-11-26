import { useEffect, useLayoutEffect, useRef } from 'react';

/** Ключ `history.state`: запись истории, которую добавила раскрытая шторка (адрес тот же). */
const LAYER = 'dlmLayer';

const onTop = (): boolean => {
  const s: unknown = window.history.state;
  return Boolean(s && typeof s === 'object' && (s as Record<string, unknown>)[LAYER]);
};

/**
 * «Назад» браузера и Android сворачивает раскрытую шторку (#230, Н8): раскрылась — в историю ложится
 * запись с тем же адресом и пометкой; «назад» снимает её (popstate без hashchange) — шторка сворачивается.
 * Свернули иначе (тап по затемнению, Esc, палец) — запись снимается шагом назад, чтобы «назад» не тратился впустую.
 * Ушли со шторки переходом (выбрали регион) — запись остаётся под новым экраном: «назад» вернёт мир с раскрытым
 * списком (#196). Смонтировались раскрытыми на такой записи — второй не кладём.
 */
export function useBackLayer(open: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  // Смонтировались раскрытыми — вернулись «назад» на запись шторки (#196): шаг назад ещё идёт (history.back асинхронный),
  // и новая запись отменила бы его — оставили бы на экране региона. Своей записи при монтировании не кладём.
  const wasOpen = useRef(open);
  /** Адрес, на котором лежит запись шторки: «назад» с неё приходит на тот же адрес (popstate без hashchange). */
  const home = useRef<string | null>(null);

  useEffect(() => {
    if (open && !wasOpen.current && !onTop()) {
      const state: unknown = window.history.state;
      home.current = window.location.hash;
      window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), [LAYER]: true }, '', window.location.href);
    } else if (!open && wasOpen.current && onTop()) {
      window.history.back();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      // Вернулись на запись шторки — запомнили её адрес. Сворачивает только «назад» с неё на тот же адрес:
      // popstate шага назад между экранами (смонтировались раскрытыми, шаг ещё идёт) шторку не трогает.
      if (onTop()) home.current = window.location.hash;
      else if (window.location.hash === home.current) close.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
