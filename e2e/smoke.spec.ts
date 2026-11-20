import { test, expect, expectHash, expectNoHorizontalScroll, panelHeading } from './fixtures';

// Дымовой сценарий (#105): интро → мир → Айсрак → Фростреч → галерея → назад → поиск → профиль.
// Один на проект; на `mobile` — тапы и шторка «Регионы» вместо полигона.

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

  // Регион: на компьютере — полигон, на телефоне — пункт шторки «Регионы».
  if (mobile) {
    const list = page.getByRole('navigation', { name: 'Регионы' });
    await tap(list.getByRole('button', { name: 'Регионы' }));
    await tap(list.getByRole('button', { name: 'Айсрак' }));
  } else {
    // Клик в середину полигона: подсказка региона встаёт рядом с ним и его не закрывает (#101).
    await page.locator('[role="button"][data-region="icewrack"]').click();
  }
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await expectNoHorizontalScroll(page);

  // Точка маркера, а не центр группы: подпись справа от точки сдвигает центр рамки маркера (#191).
  await tap(page.locator('[role="button"][data-place="frostreach"] [data-hit]'));
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
  await page.getByRole('combobox', { name: 'Герой, регион или место' }).fill('ww');
  await tap(page.getByRole('option', { name: /Winter Wyvern/ }));
  await expectHash(page, '#/r/icewrack/icewrack?hero=winter_wyvern&profile');
  await expect(panelHeading(page)).toHaveText('Winter Wyvern');
  await expectNoHorizontalScroll(page);
  await tap(page.getByRole('button', { name: 'Закрыть профиль' }));
  await expectHash(page, '#/r/icewrack/icewrack?hero=winter_wyvern');
  await expectNoHorizontalScroll(page);
});
