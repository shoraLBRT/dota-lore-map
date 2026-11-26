import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, expectHash, panelHeading, waitForSettled } from './fixtures';

// Навигация (#230, SPEC §5.1 «Правила окон»): «мир → регион → место → герой → закрыть всё»
// каждым способом закрытия — ×, Esc, «назад» браузера, путь вверху карты. На `mobile` — тапы и шторки.

const PROFILE = /^#\/r\/icewrack\/frostreach\?hero=[a-z_]+&profile$/;

async function reachProfile(page: Page, mobile: boolean): Promise<string> {
  const tap = async (locator: ReturnType<typeof page.locator>) => {
    if (mobile) await locator.tap();
    else await locator.click();
  };
  await page.goto('./#/world');
  await expect(page.locator('[data-region]').first()).toBeAttached();
  if (mobile) {
    const list = page.getByRole('navigation', { name: 'Регионы' });
    await tap(list.getByRole('button', { name: 'Регионы' }));
    await tap(list.getByRole('button', { name: 'Айсрак' }));
  } else {
    await page.locator('[role="button"][data-region="icewrack"]').click();
  }
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');

  await tap(page.locator('[role="button"][data-place="frostreach"] [data-hit]'));
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');

  const portrait = page.getByRole('complementary').getByRole('button', { name: /: открыть профиль/ }).first();
  const hero = (await portrait.getAttribute('aria-label'))!.split(':')[0]!;
  await tap(portrait);
  await expectHash(page, PROFILE);
  await expect(panelHeading(page)).toHaveText(hero);
  // Путь вверху карты, крошек в шапке нет (Н1).
  await expect(page.getByRole('navigation', { name: 'Путь' })).toContainText(hero);
  await expect(page.getByRole('navigation', { name: 'Навигация по уровням' })).toHaveCount(0);
  return hero;
}

test('× закрывает каждое окно на шаг вверх, чипа героя нет', async ({ page, consoleErrors }, info) => {
  void consoleErrors;
  const mobile = info.project.name === 'mobile';
  const tap = async (locator: ReturnType<typeof page.locator>) => {
    if (mobile) await locator.tap();
    else await locator.click();
  };
  await reachProfile(page, mobile);

  // Профиль поверх места: axe без серьёзных нарушений. В Firefox на CI страница падала внутри axe (Page crashed,
  // PR #249) — нарушения там не ищем, остальной сценарий идёт; axe — в Chromium, WebKit и на телефоне.
  if (info.project.name !== 'firefox') {
    await waitForSettled(page); // панель профиля въезжает
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  }

  await tap(page.getByRole('button', { name: 'Закрыть профиль' }));
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');
  await expect(page.getByRole('region', { name: 'Выбранный герой' })).toHaveCount(0);

  await tap(page.getByRole('button', { name: 'Закрыть: Фростреч' }));
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');

  await tap(page.getByRole('button', { name: 'Закрыть: Айсрак' }));
  await expectHash(page, '#/world');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('Esc и «назад» браузера — на шаг назад, профиль закрывается вместе с героем', async ({ page, consoleErrors }, info) => {
  void consoleErrors;
  const mobile = info.project.name === 'mobile';
  await reachProfile(page, mobile);

  await page.keyboard.press('Escape');
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');
  await page.goBack();
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await page.keyboard.press('Escape');
  await expectHash(page, '#/world');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('путь вверху карты: «Мир» из профиля — сразу в мир', async ({ page, consoleErrors }, info) => {
  void consoleErrors;
  const mobile = info.project.name === 'mobile';
  await reachProfile(page, mobile);
  const world = page.getByRole('navigation', { name: 'Путь' }).getByRole('button', { name: 'Мир' });
  if (mobile) await world.tap();
  else await world.click();
  await expectHash(page, '#/world');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('шапка окна: название и × в одной строке, название один раз; «Мир» на месте и над развёрнутой шторкой', async ({
  page,
  consoleErrors,
}, info) => {
  void consoleErrors;
  const mobile = info.project.name === 'mobile';
  await page.goto('./#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  const panel = page.getByRole('complementary', { name: 'Айсрак' });
  await expect(panel.getByRole('heading', { level: 2 })).toHaveCount(1);
  const title = (await panelHeading(page).boundingBox())!;
  const close = (await panel.getByRole('button', { name: 'Закрыть: Айсрак' }).boundingBox())!;
  // Одна строка: × по высоте пересекается с названием и стоит правее.
  expect(close.y).toBeLessThan(title.y + title.height);
  expect(close.y + close.height).toBeGreaterThan(title.y);
  expect(close.x).toBeGreaterThan(title.x + title.width - 1);

  const world = page.getByRole('navigation', { name: 'Путь' }).getByRole('button', { name: 'Мир' });
  const at = (await world.boundingBox())!;
  await page.locator('[role="button"][data-place="frostreach"] [data-hit]').click();
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');
  const next = (await world.boundingBox())!;
  expect([next.x, next.y]).toEqual([at.x, at.y]);
  if (mobile) {
    // Развёрнутая шторка «Мир» не закрывает.
    await page.getByTestId('panel-sheet').locator('button').first().click();
    await expect(page.getByTestId('panel-sheet')).toHaveAttribute('data-state', 'full');
    await waitForSettled(page);
    const sheetTop = (await page.getByTestId('panel-sheet').getByRole('complementary').boundingBox())!.y;
    expect(next.y + next.height).toBeLessThanOrEqual(sheetTop);
    await world.click();
    await expectHash(page, '#/world');
  }
});
