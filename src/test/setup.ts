import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom картинки не грузит: интро ждало бы превью мира до READY_TIMEOUT. В тестах превью нет — кнопка «Начать»
// зависит только от шрифтов, как до арта; полная картинка мира (WORLD_ART) рисуется как обычно (A10).
vi.mock('../features/world/art', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/world/art')>()),
  WORLD_PREVIEW: undefined,
}));

// Тесты scripts/ идут в окружении node, где нет window.
if (typeof window !== 'undefined') {
  // В jsdom нет canvas: без заглушки каждый регион с частицами пишет в консоль «Not implemented».
  // Тесты частиц подменяют getContext сами.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

  afterEach(() => {
    cleanup();
    window.location.hash = '';
    try {
      window.localStorage.clear();
    } catch {
      // jsdom без localStorage — нечего чистить.
    }
  });
}
