// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUNDLE_BUDGET, FONTS_ESTIMATE, measure, measureArt, TOTAL_BUDGET, WORLD_ART } from './check-budget.mjs';

// Бюджет загрузки до мира (SPEC §14, ARCHITECTURE A14).

describe('check-budget', () => {
  let dir;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('считает gzip только html, js и css из dist, с подпапками', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>'.repeat(100));
    writeFileSync(join(dir, 'assets', 'a.js'), 'const a = 1;\n'.repeat(1000));
    writeFileSync(join(dir, 'assets', 'a.css'), 'a{}');
    writeFileSync(join(dir, 'favicon.svg'), '<svg/>'.repeat(1000));
    const { files, total } = measure(dir);
    expect(files.map((f) => f.file).sort()).toEqual(['assets/a.css', 'assets/a.js', 'index.html']);
    expect(total).toBe(files.reduce((s, f) => s + f.gzip, 0));
    // gzip повторов маленький — считаем именно сжатый размер.
    expect(total).toBeLessThan(1000);
  });

  it('бюджет бандла, картинки мира и шрифтов укладывается в ~3 МБ SPEC', () => {
    const art = WORLD_ART.filter((a) => a.beforeWorld).reduce((s, a) => s + a.budget, 0);
    expect(BUNDLE_BUDGET + art + FONTS_ESTIMATE).toBeLessThanOrEqual(TOTAL_BUDGET);
  });

  it('картинки мира: размер файла как есть, нет файла — null', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(dir, 'map'));
    writeFileSync(join(dir, 'map', 'world-2560.webp'), Buffer.alloc(1234));
    const art = measureArt(dir);
    expect(art.map((a) => [a.file, a.bytes])).toEqual([
      ['map/world-2560.webp', 1234],
      ['map/world-640.webp', null],
    ]);
    // Бюджеты задачи #110: мир ≤ 700 КБ, превью ≤ 60 КБ.
    expect(art.map((a) => a.budget)).toEqual([700 * 1024, 60 * 1024]);
  });
});
