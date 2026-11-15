import type { Route } from '../../app/router';
import { BUILD_VERSION } from '../../app/project';
import type { Hero, Lang, Localized, Media, Place, Region } from '../../data/types';
import { getHero, getPlace, getRegion, pick, placeName } from '../../data/world';
import type { FeedbackBlockType, FeedbackContext, FeedbackKind } from './message';

/**
 * Блок, о котором отзыв («Нашли ошибку?», #74): тип, id в данных и название на обоих языках — окно показывает его
 * на языке интерфейса, и смена языка при открытом окне меняет и подпись, и текст issue.
 */
export interface FeedbackBlockRef {
  type: FeedbackBlockType;
  id: string;
  name: Localized;
}

/** Контекст сообщения из адреса: имена региона, места и героя на языке интерфейса (неизвестные id — как есть). */
export function feedbackContext(
  route: Route,
  lang: Lang,
  address: string,
  block?: FeedbackBlockRef,
  kind?: FeedbackKind,
): FeedbackContext {
  const s = route.screen;
  const ctx: FeedbackContext = { screen: s.name, lang, address, version: BUILD_VERSION };
  if (s.name === 'region' || s.name === 'place') {
    const region = getRegion(s.regionId);
    ctx.region = { id: s.regionId, name: region ? pick(region.name, lang) : s.regionId };
  }
  if (s.name === 'place') {
    const place = getPlace(s.regionId, s.placeSlug);
    ctx.place = { id: s.placeSlug, name: place ? placeName(place, lang) : s.placeSlug };
  }
  if (route.hero) {
    const hero = getHero(route.hero);
    ctx.hero = { id: route.hero, name: hero?.name ?? route.hero, profile: route.profile };
  }
  if (route.media) ctx.media = route.media;
  if (block) {
    ctx.block = { type: block.type, id: block.id, name: pick(block.name, lang) };
    ctx.kind = kind ?? 'error';
  }
  return ctx;
}

/** Блок панели региона. */
export function regionBlock(region: Region): FeedbackBlockRef {
  return { type: 'region', id: region.id, name: region.name };
}

/** Блок панели места: id — `<регион>/<место>`, как в адресе. */
export function placeBlock(region: Region, place: Place): FeedbackBlockRef {
  return { type: 'place', id: `${region.id}/${place.slug}`, name: { ru: placeName(place, 'ru'), en: placeName(place, 'en') } };
}

/** Профиль героя. */
export function heroBlock(hero: Hero): FeedbackBlockRef {
  return { type: 'hero', id: hero.key, name: { ru: hero.name, en: hero.name } };
}

/** Медиа в галерее (и арты профиля героя — у них свои id, в World.media их нет). */
export function mediaBlock(media: Media): FeedbackBlockRef {
  return { type: 'media', id: media.id, name: media.title };
}
