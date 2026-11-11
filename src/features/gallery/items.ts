import type { Route } from '../../app/router';
import type { Media } from '../../data/types';
import { getMedia, getPlace, getRegion, resolveMedia } from '../../data/world';

export interface GalleryState {
  items: Media[];
  index: number;
}

/**
 * Что показывает галерея по адресу `?media=<id>` (ARCHITECTURE A5): листаются медиа того экрана,
 * с которого она открыта (места или региона). Медиа не из этого списка (ссылка вручную) — одно, без листания.
 * Неизвестный id — галереи нет.
 */
export function galleryOf(route: Route): GalleryState | null {
  if (!route.media) return null;
  const current = getMedia(route.media);
  if (!current) return null;
  const s = route.screen;
  const ids =
    s.name === 'place' ? getPlace(s.regionId, s.placeSlug)?.media : s.name === 'region' ? getRegion(s.regionId)?.media : undefined;
  const items = resolveMedia(ids);
  const index = items.findIndex((m) => m.id === current.id);
  return index >= 0 ? { items, index } : { items: [current], index: 0 };
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
