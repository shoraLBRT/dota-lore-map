import { test, expect } from './fixtures';

// Высокая картинка (карточка Artifact, 526×890) целиком внутри окна галереи и экрана (#114).
const TALL = `<svg xmlns="http://www.w3.org/2000/svg" width="526" height="890"><rect width="526" height="890" fill="#456"/></svg>`;

test('высокая картинка не вылезает за окно галереи', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.route(
    (url) => url.pathname.startsWith('/apps/583950/'),
    (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TALL }),
  );
  // Экран ниже картинки: без ограничения строк сетки окно вытягивалось по её высоте.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width >= 768 ? 1024 : size.width, height: 600 });
  await page.goto('./#/r/quoidge/quoidge?media=artifact-pit-fighter-quoidge');
  const dialog = page.getByRole('dialog');
  const img = dialog.locator('img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(890);

  const viewport = page.viewportSize()!;
  const d = (await dialog.boundingBox())!;
  const i = (await img.boundingBox())!;
  expect(d.y + d.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(i.y).toBeGreaterThanOrEqual(d.y - 1);
  expect(i.y + i.height).toBeLessThanOrEqual(d.y + d.height + 1);
});
