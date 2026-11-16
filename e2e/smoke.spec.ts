import { test, expect, expectHash, expectNoHorizontalScroll, panelHeading } from './fixtures';

// Дымовой сценарий (#105): интро → мир → Айсрак → Фростреч → галерея → назад → поиск → профиль.
// Один на проект; на `mobile` — тапы и список регионов вместо полигона.

test('интро → регион → место → галерея → поиск → профиль', async ({ page, consoleErrors }, info) => {
  const mobile = info.project.name === 'mobile';
  const tap = async (locator: ReturnType<typeof page.locator>) => {
    if (mobile) await locator.tap();
    else await locator.click();
  };
  void consoleErrors;

  await page.goto('./#/');
  const start = page.getByRole('button', { name: 'Начать' });
  await expect(start).toBeVisible();
  await expectNoHorizontalScroll(page);
  await tap(start);
  await expectHash(page, '#/world');
  await expectNoHorizontalScroll(page);

  // Регион: на компьютере — полигон, на телефоне — пункт списка регионов.
  if (mobile) {
    await tap(page.getByRole('navigation', { name: 'Регионы' }).getByRole('button', { name: 'Айсрак' }));
  } else {
    // Клик — в верхнюю часть полигона: подсказка региона (наведение) встаёт под его подписью
    // и перекрывает середину полигона (SPEC §5.3; место подсказки — #101).
    const region = page.locator('[role="button"][data-region="icewrack"]');
    const box = (await region.boundingBox())!;
    await region.click({ position: { x: box.width * 0.2, y: box.height * 0.25 } });
  }
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await expectNoHorizontalScroll(page);

  await tap(page.locator('[role="button"][data-place="frostreach"]'));
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');
  await expectNoHorizontalScroll(page);

  // Галерея места: открыть карточкой медиа, закрыть Esc.
  await tap(page.getByRole('complementary').getByRole('button', { name: /«Дракон»/ }));
  const gallery = page.getByRole('dialog');
  await expect(gallery).toBeVisible();
  await expectHash(page, /^#\/r\/icewrack\/frostreach\?media=.+$/);
  await page.keyboard.press('Escape');
  await expect(gallery).toBeHidden();
  await expectHash(page, '#/r/icewrack/frostreach');

  // Esc — на уровень вверх: место → регион → мир.
  await page.keyboard.press('Escape');
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await page.keyboard.press('Escape');
  await expectHash(page, '#/world');

  // Поиск героя: выбор открывает профиль на экране героя (место Айсрак в регионе Айсрак), закрытие оставляет героя.
  await tap(page.getByRole('button', { name: 'Поиск героя' }));
  await page.getByRole('combobox', { name: 'Поиск героя' }).fill('cm');
  await tap(page.getByRole('option', { name: /Crystal Maiden/ }));
  await expectHash(page, '#/r/icewrack/icewrack?hero=crystal_maiden&profile');
  await expect(panelHeading(page)).toHaveText('Crystal Maiden');
  await expectNoHorizontalScroll(page);
  await tap(page.getByRole('button', { name: /^Закрыть профиль героя/ }));
  await expectHash(page, '#/r/icewrack/icewrack?hero=crystal_maiden');
  await expectNoHorizontalScroll(page);
});
