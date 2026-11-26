import { test, expect, panelHeading } from './fixtures';

// #252: Safari на iPhone приближает страницу при фокусе на поле с кеглем меньше 16 px, а отдалить её
// поверх карты было нечем. Поля — не меньше 16 px; верхняя полоса и путь — в кадре, ниже safe-area.

test.skip(({ browserName, isMobile }) => !isMobile || browserName !== 'webkit', 'iPhone — WebKit на телефоне');

/** Масштаб страницы браузером (не камеры карты). */
const pageScale = (page: import('@playwright/test').Page) => page.evaluate(() => window.visualViewport?.scale ?? 1);

/** Кегль поля ввода, px. */
const fontPx = (loc: import('@playwright/test').Locator) => loc.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));

/** Элемент целиком в кадре по вертикали и горизонтали. */
async function inView(page: import('@playwright/test').Page, loc: import('@playwright/test').Locator) {
  const box = (await loc.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
}

test('поиск: поле 16 px, после ввода масштаб 1, полоса и путь в кадре', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('./#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  // Масштабирование не запрещено: вернуть масштаб жестом можно (и axe meta-viewport доволен).
  expect(meta).toContain('viewport-fit=cover');
  expect(meta).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);

  const rail = page.getByRole('navigation', { name: 'Навигация' });
  await inView(page, rail);
  await inView(page, page.getByTestId('path-bar'));

  await rail.getByRole('button', { name: 'Поиск' }).tap();
  const input = page.getByRole('combobox');
  await input.tap();
  expect(await fontPx(input)).toBeGreaterThanOrEqual(16);
  await input.pressSequentially('акс');
  expect(await pageScale(page)).toBe(1);
  await input.press('Escape');
  await inView(page, rail);
  await inView(page, page.getByTestId('path-bar'));
  expect(await pageScale(page)).toBe(1);
});

test('отзыв: поле сообщения 16 px, после ввода масштаб 1', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('./#/world');
  await expect(page.locator('[data-region]').first()).toBeAttached();
  await page.getByRole('button', { name: 'Обратная связь' }).tap();
  const field = page.getByRole('dialog', { name: 'Обратная связь' }).getByRole('textbox', { name: 'Сообщение' });
  await field.tap();
  expect(await fontPx(field)).toBeGreaterThanOrEqual(16);
  await field.pressSequentially('опечатка');
  expect(await pageScale(page)).toBe(1);
});

test('все поля ввода на телефоне — не меньше 16 px', async ({ page, consoleErrors }) => {
  void consoleErrors;
  const sizes = () =>
    page
      .locator('input:not([type="radio"]):not([type="checkbox"]), textarea, select')
      .evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  await page.goto('./#/world');
  await expect(page.locator('[data-region]').first()).toBeAttached();
  await page.getByRole('button', { name: 'Поиск' }).tap();
  await expect(page.getByRole('combobox')).toBeVisible();
  const search = await sizes();
  await page.getByRole('combobox').press('Escape');
  await page.getByRole('button', { name: 'Обратная связь' }).tap();
  await expect(page.getByRole('dialog', { name: 'Обратная связь' })).toBeVisible();
  const all = [...search, ...(await sizes())];
  expect(all.length).toBeGreaterThanOrEqual(2);
  for (const s of all) expect(s).toBeGreaterThanOrEqual(16);
});
