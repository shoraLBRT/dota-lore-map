import type { Screen } from '../../app/router';
import type { Hero, HeroEvent, Lang, Place, Point, Region } from '../../data/types';
import { getPlace, getRegion, placeName, world } from '../../data/world';

/** Сколько вариантов показывает автодополнение. */
export const MAX_RESULTS = 8;
/** Сколько героев остаётся в выдаче, даже если регионов и мест много (SPEC §6.5). */
export const MIN_HEROES = 4;

/** Сравнение без регистра, «ё» и знаков: «Nature's Prophet» = «natures prophet», «Рики» = «рики». */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface HeroMatch {
  hero: Hero;
  /** Алиас, по которому нашёлся герой, если не по имени (показывается рядом: «Пудж»). */
  alias?: string;
}

/** 0 — точное совпадение, 1 — начало, 2 — начало слова, 3 — внутри; null — нет. */
function score(candidate: string, query: string): number | null {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.split(' ').some((w) => w.startsWith(query))) return 2;
  // Без пробелов: «antimage» находит «Anti-Mage».
  if (candidate.replace(/ /g, '').startsWith(query.replace(/ /g, ''))) return 2;
  if (candidate.includes(query)) return 3;
  return null;
}

/**
 * Поиск героя (SPEC §6.5) по английскому имени, ключу и алиасам (кириллица, сокращения, прозвища).
 * Лучшие совпадения первыми; при равенстве — по имени.
 */
export function searchHeroes(query: string, heroes: Hero[] = world.heroes): HeroMatch[] {
  const q = normalize(query);
  if (q === '') return [];
  const found: { match: HeroMatch; score: number }[] = [];
  for (const hero of heroes) {
    let best: { score: number; alias?: string } | null = null;
    for (const name of [hero.name, hero.key.replace(/_/g, ' ')]) {
      const s = score(normalize(name), q);
      if (s !== null && (best === null || s < best.score)) best = { score: s };
    }
    for (const alias of hero.aliases ?? []) {
      const s = score(normalize(alias), q);
      if (s !== null && (best === null || s < best.score)) best = { score: s, alias };
    }
    if (best) found.push({ match: best.alias ? { hero, alias: best.alias } : { hero }, score: best.score });
  }
  found.sort((a, b) => a.score - b.score || a.match.hero.name.localeCompare(b.match.hero.name));
  return found.slice(0, MAX_RESULTS).map((f) => f.match);
}

/** Вариант общего поиска (SPEC §6.5): герой, регион или место. */
export type SearchMatch =
  | ({ kind: 'hero' } & HeroMatch)
  | { kind: 'region'; region: Region }
  | { kind: 'place'; region: Region; place: Place };

/** Лучший балл по набору названий; null — ни одно не подошло. */
function bestScore(names: (string | undefined)[], q: string): number | null {
  let best: number | null = null;
  for (const name of names) {
    if (!name) continue;
    const s = score(normalize(name), q);
    if (s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

function rank<T>(items: { item: T; score: number; name: string }[], lang: Lang): T[] {
  items.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, lang));
  return items.map((i) => i.item);
}

/** Регионы по названию на обоих языках; при равенстве — по названию на языке интерфейса. */
export function searchRegions(query: string, lang: Lang, regions: Region[] = world.regions): Region[] {
  const q = normalize(query);
  if (q === '') return [];
  const found: { item: Region; score: number; name: string }[] = [];
  for (const region of regions) {
    const s = bestScore([region.name.ru, region.name.en], q);
    if (s !== null) found.push({ item: region, score: s, name: region.name[lang] });
  }
  return rank(found, lang);
}

/** Места по названию на обоих языках и имени из исследования. */
export function searchPlaces(
  query: string,
  lang: Lang,
  regions: Region[] = world.regions,
): { region: Region; place: Place }[] {
  const q = normalize(query);
  if (q === '') return [];
  const found: { item: { region: Region; place: Place }; score: number; name: string }[] = [];
  for (const region of regions) {
    for (const place of region.places) {
      const s = bestScore([place.name, place.text?.name?.ru, place.text?.name?.en], q);
      if (s !== null) found.push({ item: { region, place }, score: s, name: placeName(place, lang) });
    }
  }
  return rank(found, lang);
}

/**
 * Общий поиск (SPEC §6.5): тот же порядок совпадений, варианты группами — герои, регионы, места.
 * Всего не больше MAX_RESULTS; героев не меньше MIN_HEROES, если столько нашлось, остальное — регионам, затем местам,
 * а не занятое ими место снова отдаётся героям.
 */
export function searchAll(query: string, lang: Lang): SearchMatch[] {
  const heroes = searchHeroes(query);
  const regions = searchRegions(query, lang);
  const places = searchPlaces(query, lang);
  const others = Math.min(regions.length + places.length, MAX_RESULTS - Math.min(heroes.length, MIN_HEROES));
  const shownRegions = regions.slice(0, others);
  const shownPlaces = places.slice(0, others - shownRegions.length);
  return [
    ...heroes.slice(0, MAX_RESULTS - others).map((m): SearchMatch => ({ kind: 'hero', ...m })),
    ...shownRegions.map((region): SearchMatch => ({ kind: 'region', region })),
    ...shownPlaces.map(({ region, place }): SearchMatch => ({ kind: 'place', region, place })),
  ];
}

/** Тон подсветки (SPEC §8.3): ярусы — своё свечение, остальные — по стороне. */
export type Tone = 'radiant' | 'dire' | 'neutral' | 'upper' | 'abyss';
export const toneOf = (r: Region): Tone => (r.tier === 'continent' ? r.side : r.tier);

/** Место героя на карте: конкретное место или регион целиком (тогда точка — подпись региона). */
export interface Spot {
  /** `regionId` или `regionId/placeSlug`. */
  key: string;
  regionId: string;
  placeSlug?: string;
  /** Точка на карте; нет геометрии — нет точки (такое место только в списке плашки). */
  point?: Point;
  tone: Tone;
  /** Тип события связи с этим местом (A3); по нему — значок и стиль нити (A11, #67). */
  event: HeroEvent;
}

/** Все места героя по порядку связей, без повторов. */
export function heroSpots(hero: Hero): Spot[] {
  const seen = new Set<string>();
  const spots: Spot[] = [];
  for (const link of hero.links) {
    const region = getRegion(link.regionId);
    if (!region) continue;
    const place = link.placeSlug ? getPlace(region.id, link.placeSlug) : undefined;
    const key = place ? `${region.id}/${place.slug}` : region.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const point = place?.pos ?? region.layout?.label;
    spots.push({
      key,
      regionId: region.id,
      ...(place ? { placeSlug: place.slug } : {}),
      ...(point ? { point } : {}),
      tone: toneOf(region),
      event: link.event,
    });
  }
  return spots;
}

/** Экран места или региона. */
export function spotScreen(spot: Spot): Screen {
  return spot.placeSlug
    ? { name: 'place', regionId: spot.regionId, placeSlug: spot.placeSlug }
    : { name: 'region', regionId: spot.regionId };
}

/** Название места героя: место — его имя, регион целиком — имя региона. */
export function spotName(spot: Spot, lang: Lang): string {
  const region = getRegion(spot.regionId);
  const place = spot.placeSlug ? getPlace(spot.regionId, spot.placeSlug) : undefined;
  if (place) return placeName(place, lang);
  return region ? region.name[lang] : spot.regionId;
}

/**
 * Куда ведёт выбор героя (SPEC §6.5): одно место — к нему (S3 или S2);
 * несколько в одном регионе — регион; в разных — мир.
 */
export function heroScreen(hero: Hero): Screen {
  const spots = heroSpots(hero);
  if (spots.length === 0) return { name: 'world' };
  if (spots.length === 1) return spotScreen(spots[0]!);
  const regionId = spots[0]!.regionId;
  return spots.every((s) => s.regionId === regionId) ? { name: 'region', regionId } : { name: 'world' };
}
