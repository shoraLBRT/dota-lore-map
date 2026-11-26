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
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current && !onTop()) {
      const state: unknown = window.history.state;
      window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), [LAYER]: true }, '', window.location.href);
    } else if (!open && wasOpen.current && onTop()) {
      window.history.back();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (!onTop()) close.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
