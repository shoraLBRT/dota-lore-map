import { expect, stubNetwork, test, waitForSettled } from './fixtures';

// Легенда нитей на карте (#254, SPEC §6.6): при выбранном герое она видна, и у каждого вида линии,
// значка события и цвета на карте есть строка. На компьютере — раскрыта, на телефоне — кнопка «?».

test('выбран герой: легенда видна, у каждой линии, значка и цвета на карте — строка', async ({ page, isMobile }) => {
  await stubNetwork(page);
  await page.goto('./#/r/cladd?hero=kunkka&profile');
  const legend = page.getByRole('region', { name: 'Нити героя' });
  await expect(legend).toBeVisible();
  const toggle = legend.getByRole('button', { name: 'Как читать нити' });
  const list = legend.getByRole('list');
  if (isMobile) {
    await expect(list).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  } else {
    await expect(toggle).toBeHidden();
  }
  await expect(list).toBeVisible();

  const threads = page.getByTestId('threads');
  await expect(threads.locator('[data-thread]').first()).toBeAttached();
  // Значки встают после посадки камеры: ждём, пока появится хотя бы один (у Kunkka в Кладде их несколько).
  await expect(threads.locator('[data-badge]').first()).toBeAttached();
  const kinds = await threads.locator('[data-step]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-step')))]);
  for (const kind of kinds) await expect(legend.locator(`[data-legend-kind="${kind}"]`)).toBeVisible();
  const badges = await threads.locator('[data-badge]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-badge')))]);
  for (const event of badges) await expect(legend.locator(`[data-legend-event="${event}"]`)).toBeVisible();
  const tone = await legend.locator('[data-legend-tone]').getAttribute('data-legend-tone');
  await expect(threads).toHaveAttribute('data-tone', tone!);

  // Значок на карте крупнее (#254): круг 30 px, поле значка 22 px — меряем круг после посадки камеры.
  await waitForSettled(page);
  const size = await threads.locator('[data-badge] circle').first().boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(28);

  // Легенда не заходит под кнопки зума.
  const zoom = page.getByRole('group', { name: 'Масштаб карты' });
  if (await zoom.isVisible()) {
    const [a, b] = [await legend.boundingBox(), await zoom.boundingBox()];
    const overlap = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
    expect(overlap).toBe(false);
  }
});
