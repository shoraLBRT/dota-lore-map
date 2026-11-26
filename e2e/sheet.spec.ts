import type { Page } from '@playwright/test';
import { test, expect, panelHeading, waitForSettled } from './fixtures';

// #253: свайп по тексту шторки на телефоне. Пока шторка не наверху, палец тянет её целиком,
// текст не прокручивается; наверху свайп вниз по тексту, прокрученному к началу, опускает шторку.
// Playwright умеет только тап, поэтому свайп — события касания, отправленные в текст шторки
// (touchstart → touchmove → touchend); отменённый touchmove — браузер не прокручивает текст.

test.skip(({ isMobile }) => !isMobile, 'шторка только на телефоне');

/** Свайп пальцем по элементу от y0 до y1 (координаты окна); вернёт, отменён ли хоть один touchmove. */
async function swipe(page: Page, selector: string, y0: number, y1: number): Promise<boolean> {
  return page.evaluate(
    async ({ selector, y0, y1 }) => {
      const el = document.querySelector(selector)!;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      // В WebKit без iOS конструкторы Touch и TouchEvent недоступны — событие с полем touches, как у касания.
      const fire = (type: string, y: number) => {
        const t = { identifier: 1, target: el, clientX: x, clientY: y };
        const e = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] });
        Object.defineProperty(e, 'changedTouches', { value: [t] });
        el.dispatchEvent(e);
        return e.defaultPrevented;
      };
      const frame = () => new Promise((done) => requestAnimationFrame(done));
      fire('touchstart', y0);
      let prevented = false;
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        prevented = fire('touchmove', y0 + ((y1 - y0) * i) / steps) || prevented;
        await frame();
      }
      fire('touchend', y1);
      return prevented;
    },
    { selector, y0, y1 },
  );
}

test('свайп по тексту в среднем положении поднимает шторку, текст не прокручивается; вниз от начала — опускает', async ({
  page,
  consoleErrors,
}) => {
  void consoleErrors;
  await page.goto('./#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  const sheet = page.getByTestId('panel-sheet');
  await expect(sheet).toHaveAttribute('data-state', 'peek');
  await waitForSettled(page);
  const text = '[data-testid="panel-sheet"] aside > :last-child';
  const scrollTop = () => page.locator(text).evaluate((el) => el.scrollTop);
  const box = (await page.locator(text).boundingBox())!;
  const vh = page.viewportSize()!.height;

  // Вверх по тексту из середины: шторка поднимается целиком, прокрутка текста отменена.
  const y0 = Math.min(box.y + 120, vh - 40);
  expect(await swipe(page, text, y0, y0 - vh * 0.35)).toBe(true);
  await expect(sheet).toHaveAttribute('data-state', 'full');
  expect(await scrollTop()).toBe(0);
  await waitForSettled(page);

  // Наверху — свайп вниз по тексту в начале опускает шторку.
  const top = (await page.locator(text).boundingBox())!.y;
  expect(await swipe(page, text, top + 40, top + 40 + vh * 0.35)).toBe(true);
  await expect(sheet).toHaveAttribute('data-state', 'peek');
});
