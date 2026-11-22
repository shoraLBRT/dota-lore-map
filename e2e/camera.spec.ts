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
  const viewport = page.locator('[data-map-viewport]');
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
  // после посадки): зонд перепроверяет это в каждой задаче, пока идёт жест. Карта при этом наклонена (#232): точки
  // сверяются по меткам-точкам на карте и в подписи (габарит метки учитывает наклон, `getScreenCTM` — нет).
  await expect(page.locator('[data-screen-layer] [data-label="stonehall"]')).toHaveCount(1);
  await expect.poll(() => page.locator('[data-tilt]').first().evaluate((el) => (el as HTMLElement).style.transform)).toContain('rotateX');
  await page.evaluate(() => {
    const w = window as unknown as { twin: { dx: number; screen: string; on: boolean } };
    w.twin = { dx: 0, screen: '', on: true };
    const channel = new MessageChannel();
    const dot = (parent: Element, x: number, y: number, id: string) => {
      let c = parent.querySelector(`:scope > [data-probe="${id}"]`);
      if (!c) {
        c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('data-probe', id);
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        c.setAttribute('r', '0.5');
        parent.append(c);
      }
      const r = c.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2] as const;
    };
    const probe = () => {
      const mapSvg = document.querySelector<SVGSVGElement>('[data-world-art] ~ svg')!;
      const screen = document.querySelector('[data-screen-layer]')!.parentElement!;
      const label = document.querySelector<SVGGElement>('[data-screen-layer] [data-label="stonehall"]')!;
      const [x, y] = label.getAttribute('data-at')!.split(' ').map(Number) as [number, number];
      const [mx, my] = dot(mapSvg, x, y, 'map');
      const [lx, ly] = dot(label, 0, 0, 'label');
      w.twin.dx = Math.max(w.twin.dx, Math.abs(mx - lx) + Math.abs(my - ly));
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

test('наклон на приближении (#232): колесо держит точку под курсором, клик попадает в регион и в маркер', async ({ page, consoleErrors }, info) => {
  test.skip(info.project.name === 'mobile', 'колесо и мышь — компьютер');
  void consoleErrors;
  await page.goto('./#/world');
  const viewport = page.locator('[data-map-viewport]');
  await expect(viewport).toBeVisible();
  await expect(page.locator('[role="button"][data-region]').first()).toBeAttached();
  const tilt = () =>
    page.locator('[data-tilt]').first().evaluate((el) => Number(/rotateX\(([\d.]+)deg\)/.exec((el as HTMLElement).style.transform)?.[1] ?? 0));
  const settled = () =>
    expect
      .poll(async () => {
        // Перелёт — WAAPI (inline-стиль не меняется), жесты — inline-стиль: ждём, пока нет ни того, ни другого.
        const now = () => layer(page).evaluate((el) => `${(el as HTMLElement).style.transform}|${el.getAnimations().length}`);
        const before = await now();
        await page.waitForTimeout(300);
        return before.endsWith('|0') && (await now()) === before;
      })
      .toBe(true);
  expect(await tilt()).toBe(0);

  // Метка-точка на слое карты: её габарит на экране учитывает наклон — так видно, где точка карты на самом деле.
  const mark = (x: number, y: number, id: string) =>
    page.evaluate(
      ({ x, y, id }) => {
        const svg = document.querySelector<SVGSVGElement>('[data-world-art] ~ svg')!;
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('data-probe', id);
        c.setAttribute('r', '0.5');
        c.setAttribute('pointer-events', 'none');
        c.setAttribute('cx', String(x));
        c.setAttribute('cy', String(y));
        svg.append(c);
      },
      { x, y, id },
    );
  const where = (id: string) =>
    page.evaluate((id) => {
      const r = document.querySelector(`[data-probe="${id}"]`)!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, id);
  /** Регион карты, который браузер находит в точке экрана (под подписями экранного слоя). */
  const regionAt = (p: { x: number; y: number }) =>
    page.evaluate(
      ({ x, y }) =>
        document
          .elementsFromPoint(x, y)
          .map((e) => e.closest('polygon[data-region]')?.getAttribute('data-region'))
          .find(Boolean) ?? null,
      p,
    );

  // Пока карта плоская: точка внутри региона в верхней левой четверти кадра — там наклон уводит точки дальше всего.
  const pick = await page.evaluate(() => {
    const frame = document.querySelector('[data-map-viewport]')!.getBoundingClientRect();
    const svg = document.querySelector<SVGSVGElement>('[data-world-art] ~ svg')!;
    const ctm = svg.getScreenCTM()!;
    for (const poly of Array.from(document.querySelectorAll<SVGPolygonElement>('polygon[role="button"][data-region]'))) {
      const b = poly.getBBox();
      for (let fy = 0.3; fy <= 0.7; fy += 0.1)
        for (let fx = 0.3; fx <= 0.7; fx += 0.1) {
          const p = new DOMPoint(b.x + fx * b.width, b.y + fy * b.height);
          if (!poly.isPointInFill(p)) continue;
          const s = p.matrixTransform(ctm);
          const rx = (s.x - frame.left) / frame.width;
          const ry = (s.y - frame.top) / frame.height;
          if (rx > 0.15 && rx < 0.4 && ry > 0.15 && ry < 0.4) return { id: poly.getAttribute('data-region')!, x: p.x, y: p.y, sx: s.x, sy: s.y };
        }
    }
    return null;
  });
  expect(pick).not.toBeNull();
  const cursor = { x: pick!.sx, y: pick!.sy };
  expect(await regionAt(cursor)).toBe(pick!.id);
  await mark(pick!.x, pick!.y, 'cursor');
  await page.mouse.move(cursor.x, cursor.y);
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(150);
  }
  await settled();
  expect(await tilt()).toBeGreaterThan(10);
  const held = await where('cursor');
  expect(Math.abs(held.x - cursor.x)).toBeLessThan(2);
  expect(Math.abs(held.y - cursor.y)).toBeLessThan(2);
  // Клик под наклоном попадает в тот регион, который виден под курсором.
  expect(await regionAt(cursor)).toBe(pick!.id);

  // В регионе наклон полный; маркер места стоит над своей точкой карты, клик по этой точке открывает место.
  await page.goto('./#/r/stonehall');
  await expect(page.locator('[data-screen-layer] [data-place][data-at]').first()).toBeAttached();
  await settled();
  expect(await tilt()).toBeGreaterThan(8);
  const place = await page.evaluate(() => {
    const g = document.querySelector<SVGGElement>('[data-screen-layer] [data-place][data-at]')!;
    const [x, y] = g.getAttribute('data-at')!.split(' ').map(Number) as [number, number];
    const r = g.querySelector('[data-hit]')!.getBoundingClientRect();
    return { slug: g.getAttribute('data-place')!, x, y, hit: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
  });
  await mark(place.x, place.y, 'place');
  const spot = await where('place');
  expect(Math.abs(place.hit.x - spot.x)).toBeLessThan(1.5);
  expect(Math.abs(place.hit.y - spot.y)).toBeLessThan(1.5);
  await page.mouse.click(spot.x, spot.y);
  await expectHash(page, `#/r/stonehall/${place.slug}`);
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
  // Шаг — до остановки камеры: под наклоном (#232) кадры в безголовом Firefox без GPU реже, доезд дольше 300 мс.
  while (await zoomIn.isEnabled()) {
    const s = await scale(page);
    await zoomIn.click();
    let last = s;
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(250);
      const now = await scale(page);
      if (now === last && now !== s) break;
      last = now;
    }
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
