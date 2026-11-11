// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUNDLE_BUDGET, FONTS_ESTIMATE, measure, TOTAL_BUDGET } from './check-budget.mjs';

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

  it('бюджет бандла с шрифтами укладывается в ~3 МБ SPEC', () => {
    expect(BUNDLE_BUDGET + FONTS_ESTIMATE).toBeLessThanOrEqual(TOTAL_BUDGET);
  });
});
