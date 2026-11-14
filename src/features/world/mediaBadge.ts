import type { Lang, Media, Place, Region } from '../../data/types';
import { resolveMedia } from '../../data/world';

/**
 * Значок медиа на карте (#69, SPEC §6.3): что он открывает и как называется.
 * `media` — все медиа, о которых говорит значок (для имени); галерея открывается на `open`
 * на экране, которому оно принадлежит: место (`placeSlug`) или регион.
 */
export interface MediaBadge {
  media: Media[];
  open: { mediaId: string; placeSlug?: string };
}

/** Значок у маркера места: только своё медиа места. */
export function placeMediaBadge(place: Place): MediaBadge | null {
  const media = resolveMedia(place.media);
  return media.length ? { media, open: { mediaId: media[0]!.id, placeSlug: place.slug } } : null;
}

/**
 * Значок в подсказке региона: медиа региона и его мест. Открывает медиа региона,
 * а если своего нет — первое место с медиа (галерея листает медиа того экрана, A5).
 */
export function regionMediaBadge(region: Region): MediaBadge | null {
  const own = resolveMedia(region.media);
  const places = region.places.map(placeMediaBadge).filter((b): b is MediaBadge => b !== null);
  const media = [...own, ...places.flatMap((b) => b.media)].filter((m, i, all) => all.findIndex((o) => o.id === m.id) === i);
  if (media.length === 0) return null;
  return { media, open: own.length ? { mediaId: own[0]!.id } : places[0]!.open };
}

/** Виды медиа для имени значка: «комикс», «комикс, синематик» — по подзаголовкам, без повторов. */
export function mediaKinds(media: Media[], lang: Lang): string {
  const kinds = media.map((m) => m.subtitle[lang].toLocaleLowerCase(lang));
  return [...new Set(kinds)].join(', ');
}
