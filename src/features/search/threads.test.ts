import { describe, expect, it } from 'vitest';
import type { Hero, HeroEvent } from '../../data/types';
import { getHero } from '../../data/world';
import { heroSpots, type Spot } from './search';
import { heroThreads } from './threads';

// Нити со смыслом (#67, A11): шаги пути, прочие связи, значок — событие места, куда ведёт нить.

const lines = (key: string) => {
  const hero = getHero(key)!;
  return heroThreads(hero, heroSpots(hero))!;
};
const short = (t: ReturnType<typeof heroThreads>) =>
  t!.steps.map((s) => `${s.from.key}>${s.to.key}:${s.kind}:${s.event}`);

const spot = (key: string, event: HeroEvent, point: [number, number] | null = [0.5, 0.5]): Spot => ({
  key,
  regionId: key,
  ...(point ? { point } : {}),
  tone: 'neutral',
  event,
});
const hero = (path?: Hero['path']): Hero => ({ key: 'x', name: 'X', slug: 'x', links: [], ...(path ? { path } : {}) });

describe('нити героя (#67)', () => {
  it('Hoodwink: родина → дом — шаг пути со значком «дом»', () => {
    expect(short(lines('hoodwink'))).toEqual(['tomokan/krimwohl>tomokan/tomokan:path:home']);
  });

  it('Arc Warden: путь по порядку связей, значок — событие места, куда ведёт шаг', () => {
    expect(short(lines('arc_warden'))).toEqual([
      'heavens/mad-moon>free-cities/sundered-moon:path:visit',
      'free-cities/sundered-moon>druud/druud:path:visit',
      'druud/druud>tomokan/tomokan:path:battle',
    ]);
  });


  it('упоминание — пунктир со значком «упоминание»', () => {
    expect(short(lines('dragon_knight'))).toEqual(['middle-kingdoms/candoness>planes/elemental-plane:aside:mention']);
  });

  it('цвет — сторона первого места', () => {
    expect(lines('hoodwink').tone).toBe(heroSpots(getHero('hoodwink')!)[0]!.tone);
  });

  it('есть `path` — остановки из него (можно вернуться), остальные места — пунктир', () => {
    const spots = [spot('a', 'origin'), spot('b', 'battle'), spot('c', 'visit'), spot('d', 'mention')];
    const t = heroThreads(hero([{ regionId: 'a' }, { regionId: 'c' }, { regionId: 'a' }]), spots);
    expect(short(t)).toEqual(['a>c:path:visit', 'c>a:path:origin', 'a>b:aside:battle', 'c>d:aside:mention']);
  });

  it('остановок нет — пунктир цепочкой по порядку; мест без точки нет на нитях; одно место — нитей нет', () => {
    expect(short(heroThreads(hero(), [spot('a', 'mention'), spot('b', 'mention'), spot('c', 'mention')]))).toEqual([
      'a>b:aside:mention',
      'b>c:aside:mention',
    ]);
    expect(short(heroThreads(hero(), [spot('a', 'origin'), spot('b', 'home', null), spot('c', 'battle')]))).toEqual([
      'a>c:path:battle',
    ]);
    expect(heroThreads(hero(), [spot('a', 'origin'), spot('b', 'home', null)])).toBeUndefined();
  });

  it('связь до первой остановки — пунктир от первой остановки', () => {
    expect(short(heroThreads(hero(), [spot('a', 'mention'), spot('b', 'origin'), spot('c', 'home')]))).toEqual([
      'b>c:path:home',
      'b>a:aside:mention',
    ]);
  });
});
