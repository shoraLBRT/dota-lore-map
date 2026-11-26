import AxeBuilder from '@axe-core/playwright';
import { test, expect, expectHash, panelHeading, waitForSettled } from './fixtures';

// Окна и история браузера (#182, docs/research/E18-windows-audit.md): «назад» — всегда шаг назад,
// закрытое окно (галерея, профиль) «назадом» не возвращается. Один сценарий на проект; на `mobile` — тапы и шторка.

test('мир → регион → место → герой → назад ×3', async ({ page, consoleErrors }, info) => {
  const mobile = info.project.name === 'mobile';
  const tap = async (locator: ReturnType<typeof page.locator>) => {
    if (mobile) await locator.tap();
    else await locator.click();
  };
  void consoleErrors;

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

  const portrait = page
    .getByRole('complementary')
    .getByRole('button', { name: /: открыть профиль/ })
    .first();
  const hero = (await portrait.getAttribute('aria-label'))!.split(':')[0]!;
  await tap(portrait);
  await expectHash(page, /^#\/r\/icewrack\/frostreach\?hero=[a-z_]+&profile$/);
  await expect(panelHeading(page)).toHaveText(hero);

  // Профиль открыт поверх места: axe без серьёзных нарушений.
  await waitForSettled(page); // панель профиля въезжает
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  await page.goBack();
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');
  await page.goBack();
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await page.goBack();
  await expectHash(page, '#/world');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('закрытые галерея и профиль «назадом» не возвращаются', async ({ page, consoleErrors }, info) => {
  const mobile = info.project.name === 'mobile';
  const tap = async (locator: ReturnType<typeof page.locator>) => {
    if (mobile) await locator.tap();
    else await locator.click();
  };
  void consoleErrors;

  await page.goto('./#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await tap(page.locator('[role="button"][data-place="frostreach"] [data-hit]'));
  await expectHash(page, '#/r/icewrack/frostreach');

  // Галерея: открыть, закрыть крестиком — «назад» ведёт в регион, а не на копию места.
  await tap(page.getByRole('complementary').getByRole('button', { name: /«Дракон»/ }));
  const gallery = page.getByRole('dialog');
  await expect(gallery).toBeVisible();
  await tap(gallery.getByRole('button', { name: 'Закрыть' }));
  await expect(gallery).toBeHidden();
  await expectHash(page, '#/r/icewrack/frostreach');

  // Профиль: открыть, закрыть × — профиль закрывается вместе с героем (#230); «назад» не открывает профиль снова.
  await tap(
    page
      .getByRole('complementary')
      .getByRole('button', { name: /: открыть профиль/ })
      .first(),
  );
  await expectHash(page, /\?hero=[a-z_]+&profile$/);
  await tap(page.getByRole('button', { name: 'Закрыть профиль' }));
  await expectHash(page, '#/r/icewrack/frostreach');
  await expect(panelHeading(page)).toHaveText('Фростреч');

  // Шаг назад — регион; галерея и профиль не появляются.
  await page.goBack();
  await expectHash(page, '#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await expect(gallery).toBeHidden();
});
