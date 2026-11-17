import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Ширины подписей на карте по `data-measure` (getComputedTextLength — в единицах своей системы координат,
 * без учёта transform). Без измерений (jsdom) — пусто, подписи стоят как в данных.
 */
function measureTexts(root: Element | null): Record<string, number> {
  const out: Record<string, number> = {};
  root?.querySelectorAll<SVGTextContentElement>('[data-measure]').forEach((el) => {
    if (typeof el.getComputedTextLength !== 'function') return;
    const width = el.getComputedTextLength();
    const key = el.getAttribute('data-measure')!;
    if (width > 0) out[key] = Math.max(out[key] ?? 0, width);
  });
  return out;
}

/** Ширины (`w:key`) и высоты (`h:key`) элементов, px. Без измерений (jsdom, offsetWidth 0) — пусто. */
function measureBoxes(els: Map<string, HTMLElement>): Record<string, number> {
  const out: Record<string, number> = {};
  els.forEach((el, key) => {
    if (el.offsetWidth > 0) {
      out[`w:${key}`] = el.offsetWidth;
      out[`h:${key}`] = el.offsetHeight;
    }
  });
  return out;
}

const sameRecord = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((k) => Math.abs((a[k] ?? -1) - b[k]!) < 0.5);
};

/** Счётчик, который растёт, когда загрузились шрифты (`document.fonts.ready`): после него подписи меряют заново. */
export function useFontsTick(): number {
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setFontsTick((n) => n + 1));
    return () => {
      alive = false;
    };
  }, []);
  return fontsTick;
}

/** Ширины подписей SVG с `data-measure` внутри `rootRef`; меряются заново при смене `key` (ARCHITECTURE A4). */
export function useMeasuredLabels(rootRef: RefObject<Element | null>, key: string): Record<string, number> {
  const [widths, setWidths] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const next = measureTexts(rootRef.current);
    setWidths((prev) => (sameRecord(prev, next) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- меряем по ключу (язык, регион, шрифты), не на каждый рендер
  }, [key]);
  return widths;
}

/**
 * Размеры HTML-элементов (`w:…`, `h:…`), которые кладутся в возвращённый `elsRef` по ключу;
 * меряются заново при смене `key`.
 */
export function useMeasuredBoxes(key: string) {
  const elsRef = useRef(new Map<string, HTMLElement>());
  const [sizes, setSizes] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const next = measureBoxes(elsRef.current);
    setSizes((prev) => (sameRecord(prev, next) ? prev : next));
  }, [key]);
  return [sizes, elsRef] as const;
}
