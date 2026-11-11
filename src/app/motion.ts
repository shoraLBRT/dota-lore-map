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
