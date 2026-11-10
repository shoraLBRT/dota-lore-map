import { describe, expect, it } from 'vitest';
import { parentScreen, parseHash, serializeRoute, type Route } from './router';

describe('parseHash', () => {
  it('разбирает адреса экранов (A5)', () => {
    expect(parseHash('')).toEqual({ screen: { name: 'intro' } });
    expect(parseHash('#/')).toEqual({ screen: { name: 'intro' } });
    expect(parseHash('#/world')).toEqual({ screen: { name: 'world' } });
    expect(parseHash('#/r/icewrack')).toEqual({ screen: { name: 'region', regionId: 'icewrack' } });
    expect(parseHash('#/r/tomokan/tomokan')).toEqual({
      screen: { name: 'place', regionId: 'tomokan', placeSlug: 'tomokan' },
    });
  });

  it('разбирает ?hero и ?media поверх адреса', () => {
    expect(parseHash('#/r/icewrack?hero=crystal_maiden&media=art-1')).toEqual({
      screen: { name: 'region', regionId: 'icewrack' },
      hero: 'crystal_maiden',
      media: 'art-1',
    });
    expect(parseHash('#/?hero=axe')).toEqual({ screen: { name: 'intro' }, hero: 'axe' });
  });

  it('неизвестный или битый адрес — интро', () => {
    expect(parseHash('#/nope')).toEqual({ screen: { name: 'intro' } });
    expect(parseHash('#/r')).toEqual({ screen: { name: 'intro' } });
    expect(parseHash('#/r/a/b/c')).toEqual({ screen: { name: 'intro' } });
    expect(parseHash('#/r/%E0%A4%A')).toEqual({ screen: { name: 'intro' } });
  });
});

describe('serializeRoute', () => {
  const routes: [Route, string][] = [
    [{ screen: { name: 'intro' } }, '#/'],
    [{ screen: { name: 'world' } }, '#/world'],
    [{ screen: { name: 'region', regionId: 'icewrack' } }, '#/r/icewrack'],
    [{ screen: { name: 'place', regionId: 'icewrack', placeSlug: 'blueheart-glacier' } }, '#/r/icewrack/blueheart-glacier'],
    [{ screen: { name: 'world' }, hero: 'crystal_maiden' }, '#/world?hero=crystal_maiden'],
    [{ screen: { name: 'region', regionId: 'icewrack' }, hero: 'axe', media: 'm1' }, '#/r/icewrack?hero=axe&media=m1'],
  ];

  it.each(routes)('%o → %s и обратно', (route, hash) => {
    expect(serializeRoute(route)).toBe(hash);
    expect(parseHash(hash)).toEqual(route);
  });
});

describe('parentScreen', () => {
  it('место → регион → мир', () => {
    expect(parentScreen({ name: 'place', regionId: 'a', placeSlug: 'b' })).toEqual({ name: 'region', regionId: 'a' });
    expect(parentScreen({ name: 'region', regionId: 'a' })).toEqual({ name: 'world' });
    const world = { name: 'world' } as const;
    expect(parentScreen(world)).toBe(world);
  });
});
