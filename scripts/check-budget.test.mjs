// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { measure, measureArt, measureFirstScreen, measureFonts, measureTiles, TILE_BUDGET } from './check-budget.mjs';

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

  it('первый экран — index.html и то, что он просит; отложенные части — отдельными файлами (#186)', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(dir, 'assets'));
    const page = (extra) =>
      `<script type="module" crossorigin src="/base/assets/index-1.js"></script><link rel="modulepreload" href="/base/assets/world-1.js">${extra}<link rel="stylesheet" href="/base/assets/index-1.css">`;
    for (const f of ['index-1.js', 'world-1.js', 'index-1.css', 'Gallery-1.js', 'HeroProfile-1.js', 'HeroSearch-1.js']) writeFileSync(join(dir, 'assets', f), 'x');
    writeFileSync(join(dir, 'index.html'), page(''));
    const ok = measureFirstScreen(dir);
    expect(ok.files.map((f) => f.file)).toEqual(['index.html', 'assets/index-1.js', 'assets/world-1.js', 'assets/index-1.css']);
    expect(ok.errors).toEqual([]);
    writeFileSync(join(dir, 'index.html'), page('<link rel="modulepreload" href="/base/assets/Gallery-1.js">'));
    rmSync(join(dir, 'assets', 'HeroSearch-1.js'));
    const bad = measureFirstScreen(dir);
    expect(bad.errors).toHaveLength(2);
    expect(bad.errors.join(' ')).toMatch(/Gallery грузится с первым экраном/);
    expect(bad.errors.join(' ')).toMatch(/нет отдельного куска HeroSearch/);
  });

  it('шрифты — настоящий размер woff2 из dist/fonts, без gzip и без файлов лицензии', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(dir, 'fonts'));
    writeFileSync(join(dir, 'fonts', 'a-latin.woff2'), Buffer.alloc(1500));
    writeFileSync(join(dir, 'fonts', 'a-cyrillic.woff2'), Buffer.alloc(500));
    writeFileSync(join(dir, 'fonts', 'OFL.txt'), 'license');
    const { files, total } = measureFonts(dir);
    expect(files.map((f) => f.file).sort()).toEqual(['fonts/a-cyrillic.woff2', 'fonts/a-latin.woff2']);
    expect(total).toBe(2000);
  });

  it('без dist/fonts — пусто', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    expect(measureFonts(dir)).toEqual({ files: [], total: 0 });
  });

  it('арт мира — размер webp из dist/art (A10)', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(dir, 'art'));
    writeFileSync(join(dir, 'art', 'world-1024.webp'), Buffer.alloc(300));
    writeFileSync(join(dir, 'art', 'world-4096.webp'), Buffer.alloc(700));
    const { files, total } = measureArt(dir);
    expect(files.map((f) => f.file).sort()).toEqual(['art/world-1024.webp', 'art/world-4096.webp']);
    expect(total).toBe(1000);
  });

  it('тайлы пирамиды (#164) — отдельно от арта мира; полный уровень из манифеста, без лишних и тяжёлых', () => {
    dir = mkdtempSync(join(tmpdir(), 'budget-'));
    expect(measureTiles(dir, [])).toEqual({ files: [], total: 0, errors: [] });
    mkdirSync(join(dir, 'map', 'tiles', '1'), { recursive: true });
    for (const n of ['0_0', '1_0', '0_1', '1_1']) writeFileSync(join(dir, 'map', 'tiles', '1', `${n}.webp`), Buffer.alloc(100));
    const ok = measureTiles(dir, [1]);
    expect(ok.files).toHaveLength(4);
    expect(ok.total).toBe(400);
    expect(ok.errors).toEqual([]);
    // Уровня 2 из манифеста нет, а уровня 1 нет в манифесте.
    expect(measureTiles(dir, [2]).errors).toHaveLength(2);
    writeFileSync(join(dir, 'map', 'tiles', '1', '1_1.webp'), Buffer.alloc(TILE_BUDGET + 1));
    expect(measureTiles(dir, [1]).errors[0]).toMatch(/1_1\.webp/);
    // Арт мира тайлы не считает.
    expect(measureArt(dir).files).toEqual([]);
  });
});
