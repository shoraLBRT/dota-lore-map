import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom картинки не грузит: с адресом картинки мира «Начать» ждала бы её 4 с в каждом тесте.
// Карта в тестах — процедурная заглушка; картинку мира проверяют WorldArt и RegionsLayer с `art`.
vi.mock('../features/world/art', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/world/art')>()),
  WORLD_ART: undefined,
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
