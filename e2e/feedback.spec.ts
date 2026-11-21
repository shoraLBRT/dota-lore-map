import AxeBuilder from '@axe-core/playwright';
import { test, expect, panelHeading } from './fixtures';

// Отзыв без аккаунта GitHub (#75): сборка e2e знает адрес функции (`VITE_FEEDBACK_URL` в playwright.config.ts),
// а функция и Turnstile подменены здесь. Окно в режиме прямой отправки — без серьёзных нарушений axe.

const ENDPOINT = 'https://feedback.e2e.test/';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Turnstile, который сразу выдаёт токен: проверка «не робот» невидима, как обычно и бывает. */
const FAKE_TURNSTILE = `window.turnstile = {
  render(el, o) { setTimeout(() => o.callback('e2e-token'), 50); return 'w1'; },
  reset() {}, remove() {},
};`;

test('отзыв уходит в функцию: токен, текст с контекстом, ссылка на issue; axe чисто', async ({ page, consoleErrors }) => {
  void consoleErrors;
  const posted: unknown[] = [];
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_TURNSTILE }),
  );
  await page.route(ENDPOINT, (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    posted.push(request.postDataJSON());
    return route.fulfill({
      status: 201,
      headers: CORS,
      contentType: 'application/json',
      body: JSON.stringify({ number: 42, url: 'https://github.com/shoraLBRT/dota-lore-map/issues/42' }),
    });
  });

  await page.goto('./#/r/icewrack');
  await expect(panelHeading(page)).toHaveText('Айсрак');
  await page.getByRole('button', { name: 'Обратная связь' }).click();
  const win = page.getByRole('dialog', { name: 'Обратная связь' });
  await expect(win).toContainText('Аккаунт не нужен');
  await win.getByRole('textbox', { name: 'Сообщение' }).fill('Опечатка в описании');
  const send = win.getByRole('button', { name: 'Отправить' });
  await expect(send).toBeEnabled();

  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const serious = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(serious).toEqual([]);

  await send.click();
  await expect(win.getByRole('status')).toContainText('Отзыв отправлен: issue #42');
  await expect(win.getByRole('link', { name: 'Открыть на GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/shoraLBRT/dota-lore-map/issues/42',
  );
  await expect(win.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('');
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ title: 'Отзыв с карты: Опечатка в описании', labels: ['feedback'], token: 'e2e-token' });
  expect((posted[0] as { body: string }).body).toContain('- Регион: Айсрак (`icewrack`)');
});
