import { describe, expect, it } from 'vitest';
import type { Hero } from '../../data/types';
import { getHero, heroPortrait, heroRender } from '../../data/world';
import { heroSpots } from '../search/search';
import { artId, heroMedia, heroRelations, profilePlaces, RELATION_INVERSE } from './profile';

// Профиль героя (E15, SPEC §6.8, ARCHITECTURE A15): что показать — из данных, без ручной разметки.

const hero = (key: string, extra: Partial<Hero> = {}): Hero => ({
  key,
  name: key.toUpperCase(),
  slug: key,
  links: [{ regionId: 'icewrack', event: 'origin', source: 'bio' }],
  ...extra,
});

describe('связи героев (heroRelations)', () => {
  it('свои связи и обратные из записей других героев; mentor ↔ student, master ↔ servant', () => {
    const a = hero('a', { relations: [{ hero: 'b', type: 'mentor', source: 'bio' }] });
    const b = hero('b', { relations: [{ hero: 'c', type: 'servant', source: 'bio' }] });
    const c = hero('c', { relations: [{ hero: 'a', type: 'enemy', source: 'bio' }] });
    const all = [a, b, c];
    expect(heroRelations(a, all).map((r) => `${r.hero.key}:${r.type}`)).toEqual(['b:mentor', 'c:enemy']);
    // b — наставник a, значит a — ученик b; c — слуга b.
    expect(heroRelations(b, all).map((r) => `${r.hero.key}:${r.type}`)).toEqual(['a:student', 'c:servant']);
    // b записал c слугой → для c b — господин.
    expect(heroRelations(c, all).map((r) => `${r.hero.key}:${r.type}`)).toEqual(['b:master', 'a:enemy']);
  });

  it('своя запись и обратная того же типа — одна строка; неизвестный герой и связь с собой пропускаются', () => {
    const a = hero('a', {
      relations: [
        { hero: 'b', type: 'ally', source: 'bio' },
        { hero: 'ghost', type: 'enemy', source: 'bio' },
      ],
    });
    const b = hero('b', { relations: [{ hero: 'a', type: 'ally', source: 'bio' }] });
    expect(heroRelations(a, [a, b]).map((r) => `${r.hero.key}:${r.type}`)).toEqual(['b:ally']);
    expect(heroRelations(hero('lonely'), [a, b])).toEqual([]);
  });

  it('обратный тип обратного — исходный', () => {
    for (const [type, inverse] of Object.entries(RELATION_INVERSE)) expect(RELATION_INVERSE[inverse]).toBe(type);
  });

  it('в данных: у Ursa нет своих связей, но её записала Enchantress (союзник)', () => {
    const ursa = getHero('ursa')!;
    expect(ursa.relations).toBeUndefined();
    const rel = heroRelations(ursa).map((r) => `${r.hero.key}:${r.type}`);
    expect(rel).toContain('enchantress:ally');
  });
});

describe('арты профиля (heroMedia, A6)', () => {
  it('рендер Valve первым; портрет и повторы из profile.art пропускаются', () => {
    const extra = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/some-art.jpg';
    const h = hero('drow_ranger', { profile: { art: [heroPortrait(hero('drow_ranger')), extra, extra] } });
    const media = heroMedia(h);
    expect(media.map((m) => m.id)).toEqual([artId(h, 'render'), artId(h, 2)]);
    expect(media[0]).toMatchObject({ type: 'image', src: heroRender(h), credit: 'Valve' });
    expect(media[0]!.sourceUrl).toBe('https://www.dota2.com/hero/drow_ranger');
    expect(media[1]!.src).toBe(extra);
  });

  it('официальные комиксы, где герой есть: медиа из источников comic:<id>', () => {
    const h = hero('x', {
      links: [
        { regionId: 'icewrack', event: 'origin', source: 'comic:icewrack-new-neighbors' },
        { regionId: 'druud', event: 'visit', source: 'comic:nope' },
      ],
      relations: [{ hero: 'y', type: 'ally', source: 'comic:icewrack-new-neighbors' }],
    });
    expect(heroMedia(h).map((m) => m.id)).toEqual([artId(h, 'render'), 'icewrack-new-neighbors']);
  });
});

describe('места по порядку пути (profilePlaces)', () => {
  it('без пути — по порядку связей; упоминание и связь без типа — не остановки', () => {
    const techies = getHero('techies')!;
    const places = profilePlaces(techies, heroSpots(techies));
    expect(places.map((p) => p.spot.key)).toEqual(heroSpots(techies).map((s) => s.key));
    for (const p of places) expect(p.onPath).toBe(p.spot.event !== 'mention');
  });

  it('с путём — сначала остановки по первому появлению, потом остальные места', () => {
    const h = hero('p', {
      links: [
        { regionId: 'icewrack', placeSlug: 'icewrack', event: 'origin', source: 'bio' },
        { regionId: 'icewrack', placeSlug: 'cobalt', event: 'mention', source: 'bio' },
        { regionId: 'druud', event: 'battle', source: 'bio' },
      ],
      path: [{ regionId: 'druud' }, { regionId: 'icewrack', placeSlug: 'icewrack' }, { regionId: 'druud' }],
    });
    const places = profilePlaces(h, heroSpots(h));
    expect(places.map((p) => [p.spot.key, p.onPath])).toEqual([
      ['druud', true],
      ['icewrack/icewrack', true],
      ['icewrack/cobalt', false],
    ]);
  });
});
