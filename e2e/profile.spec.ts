import { test as base } from '@playwright/test';
import { expect, stubNetwork } from './fixtures';

// Шапка профиля героя (#194): адрес арта недоступен или долго грузится — пустого блока нет, шапка не выше трети экрана.
// Без фикстуры `consoleErrors`: оборванная загрузка картинки — ожидаемая ошибка сети в консоли.

const test = base;
const ADDRESS = './#/r/icewrack/black-pool?hero=lich&profile';
const CROPS = (url: URL) => url.pathname.includes('/heroes/crops/');

async function headerBox(page: import('@playwright/test').Page) {
  const panel = page.getByRole('complementary', { name: 'Lich' });
  await expect(panel.getByRole('heading', { level: 2, name: 'Lich' })).toBeVisible();
  return panel.locator('[data-hero-header]');
}

// Панель профиля въезжает с анимацией: рамка шапки на миг бывает пустой — ждём её, а не читаем один раз.
async function expectHeaderFits(page: import('@playwright/test').Page, header: import('@playwright/test').Locator) {
  await expect(header).toBeVisible();
  await expect
    .poll(async () => (await header.boundingBox())?.height ?? Infinity)
    .toBeLessThanOrEqual(page.viewportSize()!.height / 3 + 1);
}

test('адрес арта с ошибкой — остаётся портрет', async ({ page }) => {
  await stubNetwork(page);
  await page.route(CROPS, (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(ADDRESS);
  const header = await headerBox(page);
  await expect(header).toHaveAttribute('data-hero-header', 'failed');
  await expect(header.locator('img')).toHaveCount(1);
  await expect(header.locator('img').first()).toBeVisible();
  await expectHeaderFits(page, header);
});

test('адрес арта заблокирован — виден портрет, пустого блока нет', async ({ page }) => {
  await stubNetwork(page);
  await page.route(CROPS, (route) => route.abort('blockedbyclient'));
  await page.goto(ADDRESS);
  const header = await headerBox(page);
  // Chromium и Firefox сообщают об ошибке (портрет становится чётким); WebKit в Playwright на обрыв молчит — шапка
  // остаётся в состоянии загрузки, под ней тот же портрет.
  await expect(header).toHaveAttribute('data-hero-header', /^(failed|loading)$/);
  const portrait = header.locator('img').first();
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test('арт грузится долго — портрет-заглушка, шапка не выше трети экрана', async ({ page }) => {
  await stubNetwork(page);
  // Ответа нет: картинка «грузится» весь тест.
  await page.route(CROPS, () => undefined);
  await page.goto(ADDRESS);
  const header = await headerBox(page);
  await expect(header).toHaveAttribute('data-hero-header', 'loading');
  const portrait = header.locator('img').first();
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expectHeaderFits(page, header);
});
