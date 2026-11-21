import { test, expect, expectHash } from './fixtures';

// Свободная камера (#165): арт во весь кадр, колесо, перетаскивание, клавиши и кнопки; перетаскивание — не клик.
// На телефоне (#196) мир тоже во весь кадр: палец, щипок, двойное касание; список регионов — в шторке.

const layer = (page: import('@playwright/test').Page) => page.locator('[data-world-art]').locator('xpath=ancestor::div[1]');
const scale = async (page: import('@playwright/test').Page) => {
  const t = await layer(page).evaluate((el) => (el as HTMLElement).style.transform);
  return Number(/scale\(([\d.]+)\)/.exec(t)?.[1] ?? NaN);
};

test('мир во весь кадр; колесо, перетаскивание, клавиши; клик по региону и назад', async ({ page, consoleErrors }, info) => {
  test.skip(info.project.name === 'mobile', 'колесо и мышь — компьютер; телефон — отдельный тест жестов');
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
  // Подписи — в экранном слое (#180, #231): слой камерой не масштабируется, а якорь названия стоит в той же точке
  // экрана, что и его точка на слое карты, — в любой момент жеста и инерции, между любыми задачами страницы (не только
  // после посадки): зонд перепроверяет это в каждой задаче, пока идёт жест.
  await expect(page.locator('[data-screen-layer] [data-label="stonehall"]')).toHaveCount(1);
  await page.evaluate(() => {
    const w = window as unknown as { twin: { dx: number; screen: string; on: boolean } };
    w.twin = { dx: 0, screen: '', on: true };
    const channel = new MessageChannel();
    const probe = () => {
      const mapSvg = document.querySelector<SVGSVGElement>('[data-world-art] ~ svg')!;
      const screen = document.querySelector('[data-screen-layer]')!.parentElement!;
      const label = document.querySelector<SVGGElement>('[data-screen-layer] [data-label="stonehall"]')!;
      const [x, y] = label.getAttribute('data-at')!.split(' ').map(Number) as [number, number];
      const p = new DOMPoint(x, y).matrixTransform(mapSvg.getScreenCTM()!);
      const ctm = label.getScreenCTM()!;
      w.twin.dx = Math.max(w.twin.dx, Math.abs(p.x - ctm.e) + Math.abs(p.y - ctm.f));
      if (!['', 'none'].includes(screen.style.transform)) w.twin.screen = screen.style.transform;
      if (w.twin.on) channel.port2.postMessage(0);
    };
    channel.port1.onmessage = probe;
    probe();
  });
  const before = await layer(page).evaluate((el) => (el as HTMLElement).style.transform);
  await page.mouse.down();
  await page.mouse.move(vp!.x + vp!.width / 2 - 200, vp!.y + vp!.height / 2 - 100, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => layer(page).evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
  await expectHash(page, '#/world');
  await page.waitForTimeout(1000);
  const twin = await page.evaluate(() => {
    const w = window as unknown as { twin: { dx: number; screen: string; on: boolean } };
    w.twin.on = false;
    return w.twin;
  });
  expect(twin.screen).toBe('');
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
  // Уровни зума вложены (#209): в регионе — не ближе кадра × 1.15, «Показать регион целиком» — снова кадр.
  const settled = async () => {
    await expect
      .poll(async () => {
        const before = await scale(page);
        await page.waitForTimeout(250);
        return (await scale(page)) === before;
      })
      .toBe(true);
    return scale(page);
  };
  const regionFrame = await settled();
  for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'Приблизить' }).click();
  const regionMax = await settled();
  expect(regionMax).toBeGreaterThan(regionFrame * 1.1);
  expect(regionMax).toBeLessThanOrEqual(regionFrame * 1.15 + 0.01);
  await page.getByRole('button', { name: 'Показать регион целиком' }).click();
  await expect.poll(() => scale(page)).toBeCloseTo(regionFrame, 2);
  await page.getByRole('button', { name: /Мир/ }).first().click();
  await expectHash(page, '#/world');
  await expect.poll(() => scale(page)).toBeCloseTo(1, 2);
});

test('подсказка региона у названия, одного размера на зуме и в окне, глубже порога её нет; щипок над ней — зум камеры (#208, #193)', async ({
  page,
  consoleErrors,
}, info) => {
  test.skip(info.project.name === 'mobile', 'на телефоне подсказки нет');
  void consoleErrors;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./#/world');
  const tip = page.locator('[data-map-tip]');
  const zoomIn = page.getByRole('button', { name: 'Приблизить' });
  /** #193: мышь на название региона, ближайшее к центру окна (подсказку вызывает только название). */
  const hoverLabel = async () => {
    await page.mouse.move(5, 5);
    const at = await page.locator('[data-label]').evaluateAll((els) => {
      const boxes = els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.left > 80 && r.right < innerWidth - 20 && r.top > 20 && r.bottom < innerHeight - 20);
      const d = (r: DOMRect) => Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
      const r = boxes.sort((a, b) => d(a) - d(b))[0]!;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(at.x, at.y, { steps: 2 });
  };
  const measure = async () => {
    // Камера ещё доезжает (под нагрузкой — дольше) — подсказка снимается; мышь двигается снова, как у человека.
    await expect(async () => {
      await hoverLabel();
      await expect(tip).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 20_000 });
    await page.waitForTimeout(400); // fade со сдвигом после задержки наведения
    return tip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    });
  };
  const one = await measure();
  // Полигон под мышью подсказку не вызывает — только название.
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
  const s1 = await scale(page);
  await zoomIn.click();
  await expect.poll(() => scale(page)).toBeGreaterThan(s1 * 1.2);
  // Доезд камеры: пока она движется, подсказки нет.
  await expect
    .poll(async () => {
      const before = await scale(page);
      await page.waitForTimeout(250);
      return (await scale(page)) === before;
    })
    .toBe(true);
  const two = await measure();
  while (await zoomIn.isEnabled()) {
    const s = await scale(page);
    await zoomIn.click();
    await page.waitForTimeout(300);
    if ((await scale(page)) <= s) break;
  }
  // Потолок мира (#209) — 0.93 медианы кадров регионов: на 1440×900 ≈ 2.2, а не 3 (#179).
  expect(await scale(page)).toBeGreaterThan(2);
  expect(await scale(page)).toBeLessThan(2.3);
  // Глубже порога (TOOLTIP_MAX_ZOOM) подсказки нет.
  await hoverLabel();
  await page.waitForTimeout(600);
  await expect(tip).toHaveCount(0);
  for (const m of [one, two]) expect(m.inside).toBe(true);
  expect(Math.abs(two.width - one.width)).toBeLessThanOrEqual(1);

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

test('телефон (#196): мир во весь кадр двигается пальцем и щипком, места появляются; шторка «Регионы» ведёт в регион', async ({
  page,
  consoleErrors,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'жесты пальцем — на телефоне');
  void consoleErrors;
  await page.goto('./#/world');
  const viewport = page.locator('[data-map-viewport]');
  await expect(viewport).toBeVisible();
  await expect.poll(() => scale(page)).toBe(1);
  const transform = () => layer(page).evaluate((el) => (el as HTMLElement).style.transform);

  // Касания — pointer events с pointerType touch (так их видит свободная камера во всех движках).
  const touch = (type: string, points: [number, number, number][]) =>
    viewport.evaluate(
      (el, { type, points }) => {
        for (const [id, x, y] of points)
          el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
      },
      { type, points },
    );

  // Один палец тянет карту.
  const before = await transform();
  await touch('pointerdown', [[1, 300, 400]]);
  for (let i = 1; i <= 6; i += 1) await touch('pointermove', [[1, 300 - i * 20, 400]]);
  await touch('pointerup', [[1, 180, 400]]);
  await expect.poll(transform).not.toBe(before);
  await expectHash(page, '#/world');

  // Щипок приближает — в мире появляются места (#190).
  await touch('pointerdown', [[1, 150, 400], [2, 220, 400]]);
  for (let i = 1; i <= 10; i += 1) await touch('pointermove', [[1, 150 - i * 8, 400], [2, 220 + i * 8, 400]]);
  await touch('pointerup', [[2, 300, 400], [1, 70, 400]]);
  await expect.poll(() => scale(page)).toBeGreaterThan(1.4);
  await expect(page.locator('[data-screen-layer] [data-world-place]').first()).toBeAttached();

  // Шторка свёрнута до ручки; ручка разворачивает, пункт открывает регион.
  const list = page.getByRole('navigation', { name: 'Регионы' });
  await expect(list).toHaveAttribute('data-state', 'closed');
  await list.getByRole('button', { name: 'Регионы' }).tap();
  await list.getByRole('button', { name: 'Айсрак' }).tap();
  await expectHash(page, '#/r/icewrack');
});
