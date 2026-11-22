import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, expectHash, panelHeading } from './fixtures';

// Прототип новой навигации за `?nav=new` (#230, SPEC §5.1 «Правила окон»): «мир → регион → место → герой → закрыть всё»
// каждым способом закрытия — ×, Esc, «назад» браузера, путь вверху карты. На `mobile` — тапы и шторки.

const PROFILE = /^#\/r\/icewrack\/frostreach\?hero=[a-z_]+&profile$/;

async function reachProfile(page: Page, mobile: boolean): Promise<string> {
  const tap = async (locator: ReturnType<typeof page.locator>) => {
    if (mobile) await locator.tap();
    else await locator.click();
  };
  await page.goto('./?nav=new#/world');
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
    await page.waitForTimeout(800); // панель профиля въезжает
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
  expect(new URL(page.url()).search).toBe('?nav=new');
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

test('без флага — прежняя навигация: крошки в шапке, пути нет', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('./#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await expect(page.getByRole('navigation', { name: 'Навигация по уровням' })).toBeVisible();
  await expect(page.getByTestId('path-bar')).toHaveCount(0);
});
