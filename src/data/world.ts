import raw from './world.generated.json';
import type { Hero, Lang, Localized, Place, Region, World } from './types';

export const world = raw as unknown as World;

const regionById = new Map<string, Region>(world.regions.map((r) => [r.id, r]));
const placeByKey = new Map<string, Place>(
  world.regions.flatMap((r) => r.places.map((p) => [placeKey(r.id, p.slug), p] as const)),
);
const heroByKey = new Map<string, Hero>(world.heroes.map((h) => [h.key, h]));

function placeKey(regionId: string, slug: string): string {
  return `${regionId}/${slug}`;
}

export function getRegion(id: string): Region | undefined {
  return regionById.get(id);
}

export function getPlace(regionId: string, slug: string): Place | undefined {
  return placeByKey.get(placeKey(regionId, slug));
}

export function getHero(key: string): Hero | undefined {
  return heroByKey.get(key);
}

/** Герои, связанные с конкретным местом. */
export function heroesOfPlace(regionId: string, slug: string): Hero[] {
  return world.heroes.filter((h) => h.links.some((l) => l.regionId === regionId && l.placeSlug === slug));
}

/** Герои региона: привязанные к нему целиком и к любому его месту (SPEC §5.4). */
export function heroesOfRegion(regionId: string): Hero[] {
  return world.heroes.filter((h) => h.links.some((l) => l.regionId === regionId));
}

/** Все места героя; `place` пуст, если герой привязан к региону целиком. */
export function placesOfHero(key: string): { region: Region; place?: Place }[] {
  const hero = heroByKey.get(key);
  if (!hero) return [];
  return hero.links.flatMap((l) => {
    const region = regionById.get(l.regionId);
    if (!region) return [];
    return [{ region, place: l.placeSlug ? getPlace(l.regionId, l.placeSlug) : undefined }];
  });
}

/** Ссылка на официальную страницу героя (ARCHITECTURE A6). */
export function heroUrl(hero: Hero, lang: Lang): string {
  return `https://www.dota2.com/hero/${hero.slug}?l=${lang === 'ru' ? 'russian' : 'english'}`;
}

/** Портрет героя с CDN Valve (ARCHITECTURE A6). */
export function heroPortrait(hero: Hero): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.key}.png`;
}

/** Название места на нужном языке; без контента — имя из исследования. */
export function placeName(place: Place, lang: Lang): string {
  return place.text?.name?.[lang] ?? place.name;
}

export function pick(text: Localized, lang: Lang): string {
  return text[lang];
}
