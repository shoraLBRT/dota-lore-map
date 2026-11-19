import { test, expect, expectHash } from './fixtures';

// Свободная камера (#165): арт во весь кадр, колесо, перетаскивание, клавиши и кнопки; перетаскивание — не клик.
// На телефоне мир — список регионов под картой, свободная камера работает в регионе.

const layer = (page: import('@playwright/test').Page) => page.locator('[data-world-art]').locator('xpath=ancestor::div[1]');
const scale = async (page: import('@playwright/test').Page) => {
  const t = await layer(page).evaluate((el) => (el as HTMLElement).style.transform);
  return Number(/scale\(([\d.]+)\)/.exec(t)?.[1] ?? NaN);
};

test('мир во весь кадр; колесо, перетаскивание, клавиши; клик по региону и назад', async ({ page, consoleErrors }, info) => {
  test.skip(info.project.name === 'mobile', 'на телефоне мир — список регионов');
  void consoleErrors;
  await page.goto('./#/world');
  const viewport = page.locator('[data-world-art]').locator('xpath=ancestor::div[2]');
  await expect(viewport).toBeVisible();

  // Арт покрывает кадр: слой не меньше кадра по обеим осям.
  const [vp, ly] = await Promise.all([viewport.boundingBox(), layer(page).boundingBox()]);
  expect(ly!.width).toBeGreaterThanOrEqual(vp!.width - 1);
  expect(ly!.height).toBeGreaterThanOrEqual(vp!.height - 1);

  // Колесо приближает: три щелчка мыши с паузой (не больше щелчка за событие и за 120 мс, #179) — ×1.2³.
  await page.mouse.move(vp!.x + vp!.width / 2, vp!.y + vp!.height / 2);
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(150);
  }
  await expect.poll(() => scale(page)).toBeGreaterThan(1.5);

  // Перетаскивание двигает карту и не открывает регион.
  const before = await layer(page).evaluate((el) => (el as HTMLElement).style.transform);
  await page.mouse.down();
  await page.mouse.move(vp!.x + vp!.width / 2 - 200, vp!.y + vp!.height / 2 - 100, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => layer(page).evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  await expectHash(page, '#/world');
  // Подписи — в экранном слое (#180): та же рамка и тот же transform, что у слоя карты, а не его растр.
  await expect(page.locator('[data-screen-layer] [data-label="stonehall"]')).toHaveCount(1);
  const twin = await page.evaluate(() => {
    const map = document.querySelector('[data-world-art]')!.parentElement!;
    const screen = document.querySelector('[data-screen-layer]')!.parentElement!;
    const [a, b] = [map, screen].map((el) => el.getBoundingClientRect());
    return { same: map.style.transform === screen.style.transform, dx: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.width - b.width) };
  });
  expect(twin.same).toBe(true);
  expect(twin.dx).toBeLessThan(1);

  // Кнопка «Показать мир целиком» и клавиша «+».
  await page.getByRole('button', { name: 'Показать мир целиком' }).click();
  await expect.poll(() => scale(page)).toBeCloseTo(1, 2);
  // Клавиши работают, когда фокус внутри карты (Safari не ставит фокус на кнопку по клику).
  await page.getByRole('button', { name: 'Приблизить' }).focus();
  await page.keyboard.press('+');
  await expect.poll(() => scale(page)).toBeGreaterThan(1.2);

  // Клик по региону — перелёт, «‹ Мир» — снова весь мир.
  await page.getByRole('button', { name: 'Показать мир целиком' }).click();
  await expect.poll(() => scale(page)).toBeCloseTo(1, 2);
  await page.locator('[role="button"][data-region="stonehall"]').click();
  await expectHash(page, '#/r/stonehall');
  await page.getByRole('button', { name: /Мир/ }).first().click();
  await expectHash(page, '#/world');
  await expect.poll(() => scale(page)).toBeCloseTo(1, 2);
});

test('подсказка региона одного размера на любом зуме и в окне; щипок над ней — зум камеры (#208)', async ({ page, consoleErrors }, info) => {
  test.skip(info.project.name === 'mobile', 'на телефоне подсказки нет');
  void consoleErrors;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#/world');
  const tip = page.locator('[data-map-tip]');
  const zoomIn = page.getByRole('button', { name: 'Приблизить' });
  const measure = async () => {
    // Регион под центром кадра: наводим мышь на его полигон заново на каждом зуме.
    const viewport = await page.locator('[data-world-art]').locator('xpath=ancestor::div[2]').boundingBox();
    const at = { x: viewport!.x + viewport!.width / 2, y: viewport!.y + viewport!.height / 2 };
    await page.mouse.move(at.x - 40, at.y - 40);
    await page.mouse.move(at.x, at.y, { steps: 2 });
    await expect(tip).toBeVisible();
    await page.waitForTimeout(400); // появление: 80 мс задержки + fade со сдвигом
    return tip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    });
  };
  const one = await measure();
  while ((await scale(page)) < 2) await zoomIn.click();
  await expect.poll(() => scale(page)).toBeGreaterThanOrEqual(2);
  const two = await measure();
  while (await zoomIn.isEnabled()) {
    const s = await scale(page);
    await zoomIn.click();
    await page.waitForTimeout(300);
    if ((await scale(page)) <= s) break;
  }
  const max = await measure();
  for (const m of [one, two, max]) expect(m.inside).toBe(true);
  expect(Math.abs(two.width - one.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(max.width - one.width)).toBeLessThanOrEqual(1);

  // Щипок тачпада (ctrl+колесо) над подсказкой — зум камеры, а не страницы: иначе вся страница с подсказкой растёт.
  await page.getByRole('button', { name: 'Показать мир целиком' }).click();
  await expect.poll(() => scale(page)).toBeCloseTo(1, 2);
  await measure();
  const prevented = await tip.evaluate((el) => {
    const e = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true, clientX: 700, clientY: 450 });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect.poll(() => scale(page)).toBeGreaterThan(1.05);
});
