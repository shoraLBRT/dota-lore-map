import { test as base, expect, type Page } from '@playwright/test';

// Картинка-заглушка 1×1 (прозрачный PNG) вместо портретов и медиа CDN Valve.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * Сеть наружу заглушена: тесты не зависят от CDN Valve и Google Fonts.
 * Картинка — 1×1, стили — пустые, остальное — пустой ответ.
 */
export async function stubNetwork(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) => {
      const type = route.request().resourceType();
      if (type === 'image') return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
      if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      if (type === 'font') return route.abort();
      return route.fulfill({ status: 204, body: '' });
    },
  );
}

/** Ни одной ошибки в консоли и ни одного необработанного исключения за тест. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await stubNetwork(page);
    await use(errors);
    expect(errors, 'ошибки в консоли').toEqual([]);
  },
});

export { expect };

/** Адрес — hash-маршрут (A5): `#/r/icewrack`, `#/world?hero=…`. */
export async function expectHash(page: Page, hash: string | RegExp): Promise<void> {
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).hash))
    .toMatch(typeof hash === 'string' ? new RegExp(`^${escape(hash)}$`) : hash);
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Страница не прокручивается по горизонтали. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
}

/** Заголовок панели (h2 с data-panel-heading, A14). */
export function panelHeading(page: Page) {
  return page.locator('h2[data-panel-heading]:visible').first();
}
