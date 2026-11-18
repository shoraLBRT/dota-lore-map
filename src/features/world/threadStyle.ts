// Рисунок нитей пути героя (#168, ARCHITECTURE A11): варианты на выбор владельца и порядок прорисовки.

/**
 * `ribbon` — лента с сужением к концу, наконечник-«перо», бегущая светящаяся точка;
 * `caravan` — караванная тропа: штрихи по тёмной подложке, шевроны по ходу, тот же наконечник и точка;
 * `legacy` — рисунок #67 (дуга, треугольник за значком, течение пунктира) — для сравнения «до/после».
 */
export type ThreadStyle = 'ribbon' | 'caravan' | 'legacy';

export const THREAD_STYLES: readonly ThreadStyle[] = ['ribbon', 'caravan', 'legacy'];

/** Вариант по умолчанию. Остальные — `?threads=<вариант>` в адресе до `#` (сравнение для владельца, #168). */
export const DEFAULT_THREAD_STYLE: ThreadStyle = 'ribbon';

/** Вариант из строки запроса страницы (`location.search`): `?threads=caravan`; иного или нет — по умолчанию. */
export function threadStyleFrom(search: string): ThreadStyle {
  const v = new URLSearchParams(search).get('threads');
  return THREAD_STYLES.includes(v as ThreadStyle) ? (v as ThreadStyle) : DEFAULT_THREAD_STYLE;
}

export interface StepTiming {
  /** Задержка начала прорисовки шага — доля --dur-thread. */
  delay: number;
  /** Длительность прорисовки шага — доля --dur-thread. */
  dur: number;
}

/**
 * Прорисовка шаг за шагом (#168): шаги пути по порядку остановок, каждый начинается, когда дорисован прошлый;
 * длинный путь идёт быстрее (шаг не короче 0.5 --dur-thread), весь — не дольше ~4 --dur-thread.
 * Прочие связи (пунктир) появляются после пути, вместе, со сдвигом в каскад (`index` среди них).
 */
export function stepTimings(kinds: readonly ('path' | 'aside')[]): StepTiming[] {
  const paths = kinds.filter((k) => k === 'path').length;
  const dur = paths > 0 ? Math.max(0.5, Math.min(1, 4 / paths)) : 1;
  const pathEnd = paths * dur;
  let p = 0;
  let q = 0;
  return kinds.map((k) =>
    k === 'path' ? { delay: dur * p++, dur } : { delay: pathEnd + 0.12 * q++, dur: 1 },
  );
}
