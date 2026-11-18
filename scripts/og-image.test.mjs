// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { OG_H, OG_W, SITE, cardProblems, cropBox, metaTags } from './og-image.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// Собранную страницу проверяет `node scripts/og-image.mjs --check` после сборки (в `npm run check`).
describe('превью для соцсетей (#116)', () => {
  it('index.html несёт Open Graph, Twitter-карточку, theme-color и noscript на двух языках', () => {
    expect(cardProblems(readFileSync(root('index.html'), 'utf8'))).toEqual([]);
  });

  it('находит пропавшие и неверные поля', () => {
    const html = `<meta property="og:url" content="${SITE}x" /><meta name="twitter:card" content="summary" />`;
    const problems = cardProblems(html);
    expect(problems).toContain('нет og:title');
    expect(problems).toContain('нет <noscript> на ru и en');
    expect(problems.some((p) => p.startsWith('og:url:'))).toBe(true);
    expect(problems.some((p) => p.startsWith('twitter:card:'))).toBe(true);
    expect(metaTags('<meta name="a" content="" />')).toEqual({ a: '' });
  });

  it('public/og.png — 1200×630', async () => {
    const { width, height, format } = await sharp(root('public/og.png')).metadata();
    expect([width, height, format]).toEqual([OG_W, OG_H, 'png']);
  });

  it('полоса арта — пропорция превью и в пределах картинки', () => {
    for (const size of [5016, 1024]) {
      const box = cropBox(size);
      expect(box.width / box.height).toBeCloseTo(OG_W / OG_H, 2);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.top + box.height).toBeLessThanOrEqual(size);
    }
    expect(cropBox(1000, 0).top).toBe(0);
    expect(cropBox(1000, 1).top + cropBox(1000, 1).height).toBe(1000);
  });
});
