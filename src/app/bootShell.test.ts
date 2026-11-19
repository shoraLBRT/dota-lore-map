import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries, type Lang } from '../i18n';

// Статичная оболочка интро в index.html (#186, ARCHITECTURE A14): тексты — те же, что у Intro и Disclaimer,
// иначе при подхвате React заголовок сменится на глазах.
const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');
const boot = doc.querySelector('#root [data-boot]')!;
const text = (selector: string, lang: Lang) => boot.querySelector(`${selector} [data-l="${lang}"]`)?.textContent;

describe('оболочка интро в index.html', () => {
  it('лежит внутри #root — React заменит её первой отрисовкой', () => {
    expect(boot).not.toBeNull();
  });

  it.each(['ru', 'en'] as const)('тексты %s совпадают со словарём', (lang) => {
    const d = dictionaries[lang];
    expect(text('.boot-kicker', lang)).toBe(d['intro.kicker']);
    expect(text('h1', lang)).toBe(d['intro.title']);
    expect(text('.boot-tagline', lang)).toBe(d['intro.tagline']);
    expect(boot.querySelector(`.boot-footer [lang="${lang}"]`)?.textContent).toBe(d.disclaimer);
  });

  it('превью мира и шрифт заголовка предзагружаются', () => {
    const preloads = [...doc.querySelectorAll('link[rel="preload"]')].map((l) => l.getAttribute('href'));
    expect(preloads).toContain('/art/world-1024.webp');
    expect(preloads).toContain('/fonts/cormorant-sc-latin-700-normal.woff2');
    expect(preloads).toContain('/fonts/cormorant-sc-cyrillic-700-normal.woff2');
  });
});
