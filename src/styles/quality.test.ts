/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Качество (SPEC §14, ARCHITECTURE A14): контраст токенов, prefers-reduced-motion, alt у картинок.
// Проверки по исходникам: jsdom не считает стили и не рисует, а эти правила легко нарушить новой правкой.
// Читаем файлы с диска: CSS через import в Vitest приходит пустым.

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function sources(ext: string) {
  return walk(SRC)
    .filter((p) => p.endsWith(ext) && !p.includes('.test.'))
    .map((p) => ({ path: relative(SRC, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));
}

const CSS = sources('.css');
const TSX = sources('.tsx');
const css = (path: string) => CSS.find((f) => f.path === path)!.text;

/** Токены цвета с `:root` (первый блок tokens.css — основные значения). */
function tokens(): Record<string, string> {
  const file = css('styles/tokens.css');
  const root = file.slice(file.indexOf(':root'), file.indexOf('}'));
  return Object.fromEntries([...root.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1]!, m[2]!]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('контраст WCAG AA (SPEC §14)', () => {
  const t = tokens();
  const backgrounds = ['--bg-0', '--bg-1', '--bg-2'];

  it('формула: белый на чёрном — 21:1, красный акцент на --bg-2 — меньше 4.5', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast(t['--accent']!, t['--bg-2']!)).toBeLessThan(4.5);
  });

  // Цвета, которыми пишется текст интерфейса: ≥ 4.5:1 на любом фоне панели.
  it.each(['--text-1', '--text-2', '--text-3', '--metal-bright', '--neutral', '--radiant'])('%s — текст ≥ 4.5:1', (fg) => {
    for (const bg of backgrounds) expect(contrast(t[fg]!, t[bg]!), `${fg} на ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('кольцо фокуса --accent-bright — ≥ 3:1 к фонам (WCAG 1.4.11)', () => {
    for (const bg of backgrounds) expect(contrast(t['--accent-bright']!, t[bg]!)).toBeGreaterThanOrEqual(3);
    expect(css('styles/global.css')).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent-bright\)/);
  });

  it('красный --accent и тёмный металл не служат цветом текста', () => {
    const bad = CSS.flatMap((f) =>
      [...f.text.matchAll(/(?<![-\w])color:\s*var\((--accent|--accent-dim|--metal|--metal-dim|--border)\)/g)].map(
        (m) => `${f.path}: ${m[0]}`,
      ),
    );
    expect(bad).toEqual([]);
  });
});

describe('prefers-reduced-motion (SPEC §7.1, §14)', () => {
  // Движение — бесконечная анимация или ключевые кадры со сдвигом/масштабом. Такой файл обязан выключать его сам.
  it('каждый CSS с движением содержит блок prefers-reduced-motion', () => {
    const moving = CSS.filter(({ text }) => {
      const keyframes = [...text.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1]!).join('\n');
      return /infinite/.test(text) || /transform|scale|translate/.test(keyframes);
    });
    // Проверка видит файлы: движение есть как минимум в облаках, нитях, панели и галерее.
    expect(moving.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        'features/world/Clouds.module.css',
        'features/world/MapStage.module.css',
        'features/panel/Panel.module.css',
        'features/gallery/Gallery.module.css',
      ]),
    );
    const missing = moving.filter((f) => !f.text.includes('@media (prefers-reduced-motion: reduce)'));
    expect(missing.map((f) => f.path)).toEqual([]);
  });

  it('global.css укорачивает длительности-токены', () => {
    const global = css('styles/global.css');
    const block = global.slice(global.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const token of ['--dur-hover', '--dur-panel', '--dur-thread', '--dur-camera', '--dur-intro']) {
      expect(block).toContain(token);
    }
  });
});

describe('alt у картинок (SPEC §14)', () => {
  it('каждый <img> в разметке — с alt', () => {
    const imgs = TSX.flatMap((f) => [...f.text.matchAll(/<img\b[\s\S]*?\/>/g)].map((m) => ({ path: f.path, tag: m[0] })));
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    expect(imgs.filter((i) => !/\balt=/.test(i.tag)).map((i) => i.path)).toEqual([]);
  });
});
