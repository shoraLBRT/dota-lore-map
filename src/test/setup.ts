import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
