import { describe, expect, it } from 'vitest';
import { getHero, getRegion } from '../../data/world';
import {
  heroScreen,
  heroSpots,
  MAX_RESULTS,
  MIN_HEROES,
  normalize,
  searchAll,
  searchHeroes,
  searchPlaces,
  searchRegions,
  spotName,
  spotScreen,
  toneOf,
  type SearchMatch,
} from './search';

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
    expect(heroScreen(getHero('winter_wyvern')!)).toEqual({ name: 'place', regionId: 'icewrack', placeSlug: 'icewrack' });
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

const label = (m: SearchMatch) =>
  m.kind === 'hero' ? m.hero.key : m.kind === 'region' ? `r:${m.region.id}` : `p:${m.region.id}/${m.place.slug}`;
const KIND_ORDER = { hero: 0, region: 1, place: 2 } as const;

describe('общий поиск: герои, регионы, места (SPEC §6.5, #100)', () => {
  it('место находится по началу названия, регион — по названию на другом языке', () => {
    expect(searchAll('турст', 'ru').map(label)).toEqual(['p:wailing-mountains/turstarkuri']);
    expect(searchAll('icew', 'ru').map(label)).toEqual(['r:icewrack', 'p:icewrack/icewrack']);
    expect(searchRegions('Айсрак', 'en').map((r) => r.id)).toEqual(['icewrack']);
    expect(searchPlaces('Turstarkuri', 'ru').map((m) => m.place.slug)).toEqual(['turstarkuri']);
  });

  it('герой — первым, даже если совпали регионы или места', () => {
    expect(label(searchAll('cm', 'ru')[0]!)).toBe('crystal_maiden');
  });

  it('порядок внутри группы — тот же, что у героев: начало строки раньше начала слова', () => {
    const regions = searchRegions('ice', 'en').map((r) => r.id);
    expect(regions[0]).toBe('icewrack');
  });

  it('группы по порядку, всего не больше 8, героев не меньше 4, если они есть', () => {
    for (const q of ['a', 'e', 'ро', 'ка', 'the', 'ice', 'ar', 'м']) {
      const all = searchAll(q, 'ru');
      const heroes = searchHeroes(q).length;
      const others = searchRegions(q, 'ru').length + searchPlaces(q, 'ru').length;
      const shownHeroes = all.filter((m) => m.kind === 'hero').length;
      expect(all.length).toBe(Math.min(MAX_RESULTS, heroes + others));
      expect(shownHeroes).toBeGreaterThanOrEqual(Math.min(heroes, MIN_HEROES));
      const order = all.map((m) => KIND_ORDER[m.kind]);
      expect(order).toEqual([...order].sort((x, y) => x - y));
      expect(new Set(all.map(label)).size).toBe(all.length);
    }
  });

  it('много регионов и мест — героев ровно 4, регионы раньше мест', () => {
    const all = searchAll('a', 'en');
    expect(all.length).toBe(MAX_RESULTS);
    expect(all.filter((m) => m.kind === 'hero').length).toBe(MIN_HEROES);
    expect(all[MIN_HEROES]!.kind).toBe('region');
  });

  it('пустой запрос — ничего', () => {
    expect(searchAll('  ', 'ru')).toEqual([]);
  });
});
