import { describe, expect, it } from 'vitest';
import { smoothPath } from './stage';

describe('smoothPath (#188)', () => {
  const square: [number, number][] = [
    [0.1, 0.1],
    [0.2, 0.1],
    [0.2, 0.2],
    [0.1, 0.2],
  ];

  it('замкнутая кривая из кубических сегментов — по одному на сторону', () => {
    const d = smoothPath(square);
    expect(d.startsWith('M160,160')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(4);
  });

  it('проходит через те же точки layout.json', () => {
    const ends = [...smoothPath(square).matchAll(/C[^C]* (\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/g)].map((m) => `${m[1]},${m[2]}`);
    expect(ends).toEqual(['320,160', '320,320', '160,320', '160,160']);
  });

  it('меньше трёх точек — пустой путь', () => {
    expect(smoothPath(square.slice(0, 2))).toBe('');
  });
});
