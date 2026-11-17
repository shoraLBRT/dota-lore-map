import AxeBuilder from '@axe-core/playwright';
import { test, expect, panelHeading } from './fixtures';

// Доступность (#105, A14): axe на семи экранах без нарушений serious/critical
// и reduced motion — после посадки камеры на странице нет бегущих анимаций.

const screens: { name: string; hash: string; ready: (page: import('@playwright/test').Page) => Promise<void> }[] = [
  { name: 'интро', hash: '#/', ready: (p) => expect(p.getByRole('button', { name: 'Начать' })).toBeVisible() },
  { name: 'мир', hash: '#/world', ready: (p) => expect(p.locator('[data-region]').first()).toBeAttached() },
  { name: 'регион', hash: '#/r/icewrack', ready: (p) => expect(panelHeading(p)).toHaveText('Айсрак') },
  { name: 'место', hash: '#/r/icewrack/frostreach', ready: (p) => expect(panelHeading(p)).toHaveText('Фростреч') },
  {
    name: 'галерея',
    hash: '#/r/icewrack/frostreach?media=frostreach-the-dragon',
    ready: (p) => expect(p.getByRole('dialog')).toBeVisible(),
  },
  {
    name: 'профиль',
    hash: '#/world?hero=crystal_maiden&profile',
    ready: (p) => expect(panelHeading(p)).toHaveText('Crystal Maiden'),
  },
  {
    // Выдача с группами героев и регионов (#100).
    name: 'поиск',
    hash: '#/world',
    ready: async (p) => {
      await p.getByRole('button', { name: 'Поиск героя' }).click();
      await p.getByRole('combobox', { name: 'Герой, регион или место' }).fill('a');
      await expect(p.getByRole('group', { name: 'Регионы' })).toBeVisible();
    },
  },
];

for (const screen of screens) {
  test(`axe: ${screen.name}`, async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto(`./${screen.hash}`);
    await screen.ready(page);
    await page.waitForTimeout(1200); // посадка камеры и появление панели
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(serious).toEqual([]);
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const hash of ['#/world', '#/r/icewrack', '#/r/icewrack/frostreach']) {
    test(`нет бегущих анимаций: ${hash}`, async ({ page, consoleErrors }) => {
      void consoleErrors;
      await page.goto(`./${hash}`);
      await expect(page.locator('[data-region]').first()).toBeAttached();
      await page.waitForTimeout(1500);
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => {
            const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
            const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id;
            return `${name} on ${t?.tagName.toLowerCase() ?? '?'}.${t?.getAttribute('class') ?? ''}`;
          }),
      );
      expect(running).toEqual([]);
    });
  }
});
