import { describe, expect, it } from 'vitest';
import { DEFAULT_THREAD_STYLE, stepTimings, threadStyleFrom } from './threadStyle';

describe('рисунок пути (#168)', () => {
  it('вариант из ?threads=, иначе — по умолчанию', () => {
    expect(threadStyleFrom('?threads=caravan')).toBe('caravan');
    expect(threadStyleFrom('?threads=legacy&x=1')).toBe('legacy');
    expect(threadStyleFrom('?threads=nope')).toBe(DEFAULT_THREAD_STYLE);
    expect(threadStyleFrom('')).toBe(DEFAULT_THREAD_STYLE);
  });

  it('шаги пути — по порядку, один за другим; прочие связи — после пути каскадом', () => {
    const t = stepTimings(['path', 'path', 'aside', 'path', 'aside']);
    expect(t[0]).toEqual({ delay: 0, dur: 1 });
    expect(t[1]!.delay).toBe(t[0]!.delay + t[0]!.dur);
    expect(t[3]!.delay).toBe(t[1]!.delay + t[1]!.dur);
    expect(t[2]!.delay).toBe(t[3]!.delay + t[3]!.dur);
    expect(t[4]!.delay).toBeGreaterThan(t[2]!.delay);
  });

  it('длинный путь — быстрее, весь не дольше 4 --dur-thread, шаг не короче половины', () => {
    const long = stepTimings(Array(12).fill('path'));
    expect(long[0]!.dur).toBe(0.5);
    expect(stepTimings(Array(6).fill('path')).at(-1)!.delay + stepTimings(Array(6).fill('path')).at(-1)!.dur).toBeCloseTo(4);
  });
});
