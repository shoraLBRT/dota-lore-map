import { describe, expect, it } from 'vitest';
import { getHero, getRegion } from '../../data/world';
import { heroScreen, heroSpots, MAX_RESULTS, normalize, searchHeroes, spotName, spotScreen, toneOf } from './search';

const keys = (q: string) => searchHeroes(q).map((m) => m.hero.key);

describe('поиск героя (SPEC §6.5)', () => {
  it('нормализация: регистр, ё, знаки', () => {
    expect(normalize("  Nature's  Prophet ")).toBe('nature s prophet');
    expect(normalize('Ёжик-Ёж')).toBe('ежик еж');
  });

  it('находит по английскому имени, ключу, сокращениям и русским прозвищам', () => {
    expect(keys('pudge')[0]).toBe('pudge');
    expect(keys('Пудж')[0]).toBe('pudge');
    expect(keys('cm')[0]).toBe('crystal_maiden');
    expect(keys('ЦМ')[0]).toBe('crystal_maiden');
    expect(keys('Рики')[0]).toBe('riki');
    expect(keys('antimage')[0]).toBe('antimage');
    expect(keys('anti')).toContain('antimage');
  });

  it('совпадение по алиасу показывает алиас, по имени — нет', () => {
    expect(searchHeroes('пудж')[0]).toEqual({ hero: getHero('pudge'), alias: expect.stringMatching(/^Пудж/) });
    expect(searchHeroes('Pudge')[0]).toEqual({ hero: getHero('pudge') });
  });

  it('пустой запрос — ничего; вариантов не больше MAX_RESULTS; точное совпадение раньше вхождения', () => {
    expect(searchHeroes('   ')).toEqual([]);
    expect(searchHeroes('a').length).toBe(MAX_RESULTS);
    expect(keys('axe')[0]).toBe('axe');
  });
});

describe('места героя', () => {
  it('Sven: три места в двух регионах, точки и стороны; экран — мир', () => {
    const spots = heroSpots(getHero('sven')!);
    expect(spots.map((s) => s.key)).toEqual(['shadeshore/shadeshore-ruins', 'shadeshore/vigil-keep', 'wailing-mountains/feral-road']);
    expect(spots.every((s) => s.point)).toBe(true);
    expect(spots[0]!.tone).toBe(toneOf(getRegion('shadeshore')!));
    expect(heroScreen(getHero('sven')!)).toEqual({ name: 'world' });
  });

  it('одно место — к нему; все места в одном регионе — регион', () => {
    expect(heroScreen(getHero('crystal_maiden')!)).toEqual({ name: 'place', regionId: 'icewrack', placeSlug: 'icewrack' });
    expect(heroScreen(getHero('pudge')!)).toEqual({ name: 'region', regionId: 'quoidge' });
  });

  it('связь с регионом целиком: точка — подпись региона, экран — регион, имя — имя региона', () => {
    const spot = heroSpots(getHero('slark')!).find((s) => s.key === 'shadeshore')!;
    expect(spot.placeSlug).toBeUndefined();
    expect(spot.point).toEqual(getRegion('shadeshore')!.layout!.label);
    expect(spotScreen(spot)).toEqual({ name: 'region', regionId: 'shadeshore' });
    expect(spotName(spot, 'en')).toBe(getRegion('shadeshore')!.name.en);
  });
});
