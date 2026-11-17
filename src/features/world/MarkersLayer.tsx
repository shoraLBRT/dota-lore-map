import { Fragment, type CSSProperties } from 'react';
import { useSfx } from '../../app/sound';
import type { Place } from '../../data/types';
import { placeName } from '../../data/world';
import { useT } from '../../i18n';
import type { LabelSide } from './labels';
import { fontOf, markerLabelAttrs, ringOf, significance } from './markerLayout';
import styles from './MarkersLayer.module.css';
import { mediaKinds, placeMediaBadge, type MediaBadge } from './mediaBadge';
import { onActivate, toStage } from './stage';
import type { usePlaceTooltip } from './usePlaceTooltip';

/** Вершины пятиконечной звезды столицы (SPEC §6.3), радиус 1. */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 1 : 0.45;
  return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
}).join(' ');

interface Props {
  regionId: string;
  activePlaceSlug: string | undefined;
  /** Где подпись каждого маркера (markerLayout.ts). */
  sides: Map<string, LabelSide>;
  markerScale: number;
  /** Места выбранного героя (`region/slug`): подсвечены, остальные приглушены. */
  focusPlaces: Set<string> | null;
  /** Места героя под наведением: маркеры пульсируют (#66). */
  previewPlaces: Set<string> | null;
  /** Места региона, место под наведением или фокусом и его подсказка героев. */
  place: Pick<ReturnType<typeof usePlaceTooltip>, 'id' | 'spots' | 'spotId' | 'heroes' | 'setHover' | 'setFocus'>;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
  onOpenMedia?: (regionId: string, open: MediaBadge['open']) => void;
}

/**
 * Маркеры мест открытого региона (S2/S3, SPEC §6.3): точка или звезда в кольце, подпись, значок медиа.
 * Группа каждого маркера — `translate(pos) scale(markerScale)`: размер не зависит от приближения (ARCHITECTURE A4).
 */
export function MarkersLayer({
  regionId,
  activePlaceSlug,
  sides,
  markerScale,
  focusPlaces,
  previewPlaces,
  place,
  onSelectPlace,
  onOpenMedia,
}: Props) {
  const { lang, t } = useT();
  const sfx = useSfx();
  const { spots, spotId, setHover: onSpotHover, setFocus: onSpotFocus } = place;

  const marker = (p: Place, i: number) => {
    const [x, y] = toStage(p.pos!);
    const isActive = p.slug === activePlaceSlug;
    const name = placeName(p, lang);
    const select = () => onSelectPlace(regionId, p.slug);
    const side = sides.get(p.slug) ?? 'top';
    const ring = ringOf(p);
    const sig = significance(p);
    const label = markerLabelAttrs(side, ring, fontOf(p));
    const previewed = previewPlaces?.has(`${regionId}/${p.slug}`) ?? false;
    const muted = focusPlaces && !focusPlaces.has(`${regionId}/${p.slug}`);
    const media = onOpenMedia ? placeMediaBadge(p) : null;
    const transform = `translate(${x} ${y}) scale(${markerScale.toFixed(4)})`;
    return (
      <Fragment key={p.slug}>
        <g
          className={[
            styles.marker,
            p.capital && styles.capital,
            sig === 'event' && styles.event,
            sig === 'minor' && styles.minor,
            isActive && styles.current,
            side === 'hidden' && styles.labelHidden,
            focusPlaces && (focusPlaces.has(`${regionId}/${p.slug}`) ? styles.heroSpot : styles.mutedMarker),
            previewed && styles.previewed,
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ '--i': i } as CSSProperties}
          transform={transform}
          role="button"
          tabIndex={0}
          aria-label={name}
          aria-current={isActive ? 'true' : undefined}
          aria-describedby={p.slug === spotId && place.heroes.length > 0 ? place.id : undefined}
          data-place={p.slug}
          data-significance={sig}
          onClick={(e) => {
            e.stopPropagation();
            select();
          }}
          onKeyDown={onActivate(select)}
          onPointerEnter={(e) => {
            if (e.pointerType === 'touch') return;
            onSpotHover(p.slug);
            sfx('hover');
          }}
          onPointerLeave={() => onSpotHover((s) => (s === p.slug ? null : s))}
          onFocus={() => onSpotFocus(p.slug)}
          onBlur={() => onSpotFocus((s) => (s === p.slug ? null : s))}
        >
          <circle className={styles.hit} r={18} />
          {previewed && <circle className={styles.pulse} r={ring} data-pulse="" />}
          <circle className={styles.ring} r={ring} />
          {p.capital ? (
            <polygon className={styles.dot} points={STAR} transform="scale(7)" />
          ) : (
            <circle className={styles.dot} r={sig === 'minor' ? 3 : 4} />
          )}
          <text
            className={styles.markerLabel}
            x={label.x}
            y={label.y}
            textAnchor={label.textAnchor}
            data-measure={`m:${p.slug}`}
            data-side={side}
          >
            {name}
          </text>
        </g>
        {media && (
          // Значок медиа (#69, SPEC §6.3) — отдельная кнопка сразу за маркером (Tab: место → его медиа),
          // в верхнем правом углу кольца: между кольцом и рамками подписей сверху и справа (labels.ts).
          <g
            className={[styles.mediaBadge, muted && styles.mutedMarker].filter(Boolean).join(' ')}
            style={{ '--i': i } as CSSProperties}
            transform={transform}
            role="button"
            tabIndex={0}
            aria-label={t('media.badge', { kinds: mediaKinds(media.media, lang) })}
            data-media-badge={p.slug}
            onClick={(e) => {
              e.stopPropagation();
              onOpenMedia!(regionId, media.open);
            }}
            onKeyDown={onActivate(() => onOpenMedia!(regionId, media.open))}
          >
            <g transform={`translate(${(ring * 0.75).toFixed(2)} ${(-ring * 0.75).toFixed(2)})`}>
              <circle className={styles.hit} r={6.5} />
              <rect className={styles.badgeFrame} x={-5} y={-5} width={10} height={10} />
              <path className={styles.badgeLines} d="M-5 0h10M0 0v5" />
            </g>
          </g>
        )}
      </Fragment>
    );
  };

  return <g className={styles.markers}>{spots.map(marker)}</g>;
}
