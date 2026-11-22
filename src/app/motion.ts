/**
 * Длительность из токена (`--dur-intro: 1800ms`) в миллисекундах.
 * Токены уже учитывают prefers-reduced-motion (ARCHITECTURE A8), поэтому JS берёт их, а не свои числа.
 * Нет токена (тесты в jsdom) — 0.
 *
 * Читается из кэша (#238): `getComputedStyle` после записи в DOM — принудительный пересчёт стилей всего
 * документа (~40 мс на клике «Начать»). Первый вызов берёт все токены длительностей разом, пока стили чистые
 * (карта под интро читает их при монтировании); кэш сбрасывает смена prefers-reduced-motion — от неё токены и зависят.
 */
export function cssDuration(token: string): number {
  if (typeof window === 'undefined') return 0;
  if (!durations) {
    durations = new Map();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    reduced?.addEventListener?.('change', () => (durations = null), { once: true });
  }
  if (!durations.has(token)) {
    const root = window.getComputedStyle(document.documentElement);
    for (const t of new Set([token, ...DURATION_TOKENS])) {
      if (durations.has(t)) continue;
      const ms = parseDuration(root.getPropertyValue(t));
      // Нет токена — не кэшируем: стили могли ещё не прийти.
      if (ms !== null) durations.set(t, ms);
    }
  }
  return durations.get(token) ?? 0;
}

/** Токены длительностей `tokens.css` (A8): читаются разом при первом `cssDuration`. */
const DURATION_TOKENS = ['--dur-hover', '--dur-fade', '--dur-panel', '--dur-panel-in', '--dur-thread', '--dur-place', '--dur-camera', '--dur-intro', '--dur-stagger', '--dur-hl-in', '--dur-hl-out', '--dur-breathe'];
let durations: Map<string, number> | null = null;

function parseDuration(text: string): number | null {
  const raw = text.trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value;
}

/** Длина из токена в px (`--panel-inset: 492px`, `--rail-width: 4rem`). Нет токена или не px/rem — 0. */
export function cssPixels(token: string): number {
  if (typeof window === 'undefined') return 0;
  const root = window.getComputedStyle(document.documentElement);
  const raw = root.getPropertyValue(token).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (raw.endsWith('rem')) return value * (parseFloat(root.fontSize) || 16);
  return raw.endsWith('px') ? value : 0;
}

/** Кривая из токена (`--ease-in-out`) для WAAPI: JS-анимации идут по тем же кривым, что и CSS (SPEC §7.5). */
export function cssEasing(token: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}
