import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Тесты scripts/ идут в окружении node, где нет window.
if (typeof window !== 'undefined') {
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
