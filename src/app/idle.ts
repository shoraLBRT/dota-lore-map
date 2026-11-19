/**
 * Вызвать `fn` после события `load` страницы, когда браузер свободен (#186): то, что не нужно первому экрану,
 * не спорит за сеть и поток с ним и не держит `load`. Без requestIdleCallback — через `fallbackMs` после `load`.
 * Возвращает отмену.
 */
export function afterLoadIdle(fn: () => void, timeout = 1000, fallbackMs = 200): () => void {
  let idle: number | undefined;
  let timer: number | undefined;
  const schedule = () => {
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(fn, { timeout });
    else timer = window.setTimeout(fn, fallbackMs);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
  return () => {
    window.removeEventListener('load', schedule);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    window.clearTimeout(timer);
  };
}
