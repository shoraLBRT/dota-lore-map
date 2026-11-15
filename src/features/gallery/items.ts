import type { Route } from '../../app/router';
import type { Media } from '../../data/types';
import { getHero, getMedia, getPlace, getRegion, resolveMedia } from '../../data/world';
import { heroMedia } from '../hero/profile';

export interface GalleryState {
  items: Media[];
  index: number;
}

/**
 * Что показывает галерея по адресу `?media=<id>` (ARCHITECTURE A5): листаются медиа того экрана,
 * с которого она открыта (места или региона). Открыта из профиля героя (`?hero=`, E15) и медиа не с экрана —
 * листаются арты и комиксы героя (`heroMedia`). Медиа не из этих списков (ссылка вручную) — одно, без листания.
 * Неизвестный id — галереи нет.
 */
export function galleryOf(route: Route): GalleryState | null {
  if (!route.media) return null;
  const s = route.screen;
  const ids =
    s.name === 'place' ? getPlace(s.regionId, s.placeSlug)?.media : s.name === 'region' ? getRegion(s.regionId)?.media : undefined;
  const items = resolveMedia(ids);
  const index = items.findIndex((m) => m.id === route.media);
  if (index >= 0) return { items, index };
  const hero = route.hero ? getHero(route.hero) : undefined;
  if (hero) {
    const own = heroMedia(hero);
    const at = own.findIndex((m) => m.id === route.media);
    if (at >= 0) return { items: own, index: at };
  }
  const current = getMedia(route.media);
  return current ? { items: [current], index: 0 } : null;
}

/** Счётчик «01 / 03» (SPEC §5.6). */
export function counter(index: number, total: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(index + 1)} / ${pad(total)}`;
}

/** Встраивание YouTube без cookies до воспроизведения (SPEC §5.6). */
export function youtubeEmbed(id: string, lang: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&hl=${lang}`;
}
