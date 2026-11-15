// Профиль героя (E15, SPEC §6.8, ARCHITECTURE A15): что показать — арты, связи с героями, места по порядку пути.
// Всё считается из данных мира; нет данных — нет блока (партии E14 идут постепенно).

import type { Hero, Media, RelationType } from '../../data/types';
import { getMedia, heroCrop, heroPortrait, heroRender, world } from '../../data/world';
import type { Spot } from '../search/search';
import { OFF_PATH } from '../search/threads';

/** Кем этот герой приходится тому, если тот приходится этому `type` (A3: симметричные и парные типы). */
export const RELATION_INVERSE: Record<RelationType, RelationType> = {
  ally: 'ally',
  enemy: 'enemy',
  rival: 'rival',
  family: 'family',
  love: 'love',
  mentor: 'student',
  student: 'mentor',
  master: 'servant',
  servant: 'master',
};

/** Порядок типов связи в профиле: сначала близкие, потом враги. */
const RELATION_ORDER: RelationType[] = ['family', 'love', 'mentor', 'student', 'master', 'servant', 'ally', 'rival', 'enemy'];

export interface ProfileRelation {
  hero: Hero;
  /** Кем `hero` приходится герою профиля. */
  type: RelationType;
}

/**
 * Связи героя с другими героями: его собственные `relations` и обратные — записи других героев о нём
 * (Invoker записал Kael врагом → у Kael в профиле Invoker тоже враг; mentor ↔ student, master ↔ servant).
 * Своя запись важнее обратной; неизвестные герои пропускаются. Порядок — по типу, внутри — по имени.
 */
export function heroRelations(hero: Hero, heroes: Hero[] = world.heroes): ProfileRelation[] {
  const byKey = new Map<string, ProfileRelation>();
  const add = (key: string, type: RelationType) => {
    if (key === hero.key || byKey.has(`${key}/${type}`)) return;
    const other = heroes.find((h) => h.key === key);
    if (other) byKey.set(`${key}/${type}`, { hero: other, type });
  };
  for (const r of hero.relations ?? []) add(r.hero, r.type);
  for (const other of heroes) {
    if (other.key === hero.key) continue;
    for (const r of other.relations ?? []) {
      if (r.hero === hero.key) add(other.key, RELATION_INVERSE[r.type]);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => RELATION_ORDER.indexOf(a.type) - RELATION_ORDER.indexOf(b.type) || a.hero.name.localeCompare(b.hero.name),
  );
}

/** Подпись и источник артов героя: правообладатель — Valve (SPEC §15), страница — герой на dota2.com. */
const ART_SUBTITLE = { ru: 'Арт', en: 'Art' };
const heroPage = (hero: Hero) => `https://www.dota2.com/hero/${hero.slug}`;

/** id арта героя в адресе галереи: `?hero=<key>&media=hero-<key>-<n>`. */
export const artId = (hero: Hero, n: number | 'render') => `hero-${hero.key}-${n}`;

/**
 * Арты профиля (A6: только официальные изображения Valve, по ссылке):
 * рендер героя с CDN Valve, арты из `profile.art` (кроме портрета и рендера —
 * они уже в шапке и первым артом), затем официальные комиксы, где герой есть: медиа из источников `comic:<id>` его связей.
 */
export function heroMedia(hero: Hero): Media[] {
  const name = { ru: hero.name, en: hero.name };
  const art = (id: string, src: string): Media => ({
    id,
    type: 'image',
    src,
    title: name,
    subtitle: ART_SUBTITLE,
    credit: 'Valve',
    sourceUrl: heroPage(hero),
  });
  const items: Media[] = [art(artId(hero, 'render'), heroRender(hero))];
  const known = new Set([heroPortrait(hero), heroCrop(hero), heroRender(hero)]);
  (hero.profile?.art ?? []).forEach((src, i) => {
    if (known.has(src)) return;
    known.add(src);
    items.push(art(artId(hero, i + 1), src));
  });
  const comics = new Set<string>();
  for (const r of [...hero.links, ...(hero.relations ?? [])]) {
    if (r.source.startsWith('comic:')) comics.add(r.source.slice('comic:'.length));
  }
  for (const id of comics) {
    const m = getMedia(id);
    if (m) items.push(m);
  }
  return items;
}

export interface ProfilePlace {
  spot: Spot;
  /** Остановка пути героя (там он был); иначе — прочая связь: упоминание или тип не уточнён (A11). */
  onPath: boolean;
}

const refKey = (r: { regionId: string; placeSlug?: string }) => (r.placeSlug ? `${r.regionId}/${r.placeSlug}` : r.regionId);

/**
 * Места героя по порядку пути (SPEC §6.8): остановки `path` по первому появлению, затем остальные места
 * по порядку связей. Пути нет — места по порядку связей (он и есть хронология, A3). Остановка — как у нитей (A11):
 * место из `path`, а без пути — любое, кроме `mention` и `link`.
 */
export function profilePlaces(hero: Hero, spots: Spot[]): ProfilePlace[] {
  if (!hero.path) return spots.map((spot) => ({ spot, onPath: !OFF_PATH.has(spot.event) }));
  const byKey = new Map(spots.map((s) => [s.key, s]));
  const stops: Spot[] = [];
  for (const ref of hero.path) {
    const s = byKey.get(refKey(ref));
    if (s && !stops.includes(s)) stops.push(s);
  }
  return [
    ...stops.map((spot) => ({ spot, onPath: true })),
    ...spots.filter((s) => !stops.includes(s)).map((spot) => ({ spot, onPath: false })),
  ];
}
