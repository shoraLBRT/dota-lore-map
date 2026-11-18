/**
 * Длительность из токена (`--dur-intro: 1800ms`) в миллисекундах.
 * Токены уже учитывают prefers-reduced-motion (ARCHITECTURE A8), поэтому JS берёт их, а не свои числа.
 * Нет токена (тесты в jsdom) — 0.
 */
export function cssDuration(token: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
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
