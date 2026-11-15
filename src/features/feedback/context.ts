import type { Route } from '../../app/router';
import { BUILD_VERSION } from '../../app/project';
import type { Lang } from '../../data/types';
import { getHero, getPlace, getRegion, pick, placeName } from '../../data/world';
import type { FeedbackContext } from './message';

/** Контекст сообщения из адреса: имена региона, места и героя на языке интерфейса (неизвестные id — как есть). */
export function feedbackContext(route: Route, lang: Lang, address: string, block?: string): FeedbackContext {
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
  if (block) ctx.block = block;
  return ctx;
}
