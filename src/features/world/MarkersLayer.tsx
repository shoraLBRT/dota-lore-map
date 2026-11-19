import { Fragment, type CSSProperties } from 'react';
import { useSfx } from '../../app/sound';
import type { Place } from '../../data/types';
import { placeName } from '../../data/world';
import { useT } from '../../i18n';
import type { LabelSide } from './labels';
import { fontOf, kindOf, markerLabelAttrs, ringOf, significance } from './markerLayout';
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
/** Ромб места события (#191), полудиагональ 1. */
const DIAMOND = '0,-1 1,0 0,1 -1,0';
/** Зона нажатия маркера, px: больше фигуры; на сенсорном экране CSS растит её до 44 px (MarkersLayer.module.css: .hit). */
const HIT_RADIUS = 16;
/** Значок галереи (#191): страница 5×4 и край второй под ней, центр — в (0, 0). */
const GALLERY = 'M-3 -2.5h5v4h-5z M-1.5 -3.5h4.5v4';

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
  /** Строка места в панели региона под наведением или фокусом (#99): маркер выглядит как под наведением. */
  litPlaceSlug?: string;
  /** Места региона, место под наведением или фокусом и его подсказка героев. */
  place: Pick<ReturnType<typeof usePlaceTooltip>, 'id' | 'spots' | 'spotId' | 'heroes' | 'setHover' | 'setFocus'>;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
  onOpenMedia?: (regionId: string, open: MediaBadge['open']) => void;
}

/**
 * Маркеры мест открытого региона (S2/S3, SPEC §6.3): звезда столицы, ромб места события или точка места,
 * подпись без плашки (с ореолом) и значок медиа на углу фигуры.
 * Группа каждого маркера — `translate(pos) scale(markerScale)`: размер не зависит от приближения (ARCHITECTURE A4).
 */
export function MarkersLayer({
  regionId,
  activePlaceSlug,
  sides,
  markerScale,
  focusPlaces,
  previewPlaces,
  litPlaceSlug,
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
    const ring = ringOf(p, isActive);
    const sig = significance(p);
    const kind = kindOf(p);
    const size = fontOf(p, isActive);
    const label = markerLabelAttrs(side === 'hidden' ? 'right' : side, ring, size);
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
            kind === 'event' && styles.event,
            kind === 'place' && styles.minor,
            isActive && styles.current,
            side === 'hidden' && styles.labelHidden,
            focusPlaces && (focusPlaces.has(`${regionId}/${p.slug}`) ? styles.heroSpot : styles.mutedMarker),
            previewed && styles.previewed,
            p.slug === litPlaceSlug && styles.lit,
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
          data-lit={p.slug === litPlaceSlug ? '' : undefined}
          data-significance={sig}
          data-kind={kind}
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
          <circle className={styles.hit} r={HIT_RADIUS} data-hit="" />
          {previewed && <circle className={styles.pulse} r={ring} data-pulse="" />}
          {/* Фигура маркера (#191): .pin — мягкое появление с масштабом, .hop — подпрыгивание при наведении (SPEC §7.5).
              Два слоя, а не один: у каждого своя CSS-анимация transform, и transform-атрибут маркера они не трогают.
              Выбранное место — та же фигура в кольце радиуса `ring`. */}
          <g className={styles.pin}>
            <g className={styles.hop}>
              {isActive && <circle className={styles.selection} r={ring} />}
              {kind === 'capital' ? (
                <polygon className={styles.ring} points={STAR} transform={`scale(${isActive ? 7 : ring})`} data-shape="star" />
              ) : kind === 'event' ? (
                <>
                  <polygon className={styles.ring} points={DIAMOND} transform={`scale(${isActive ? 6 : ring})`} data-shape="diamond" />
                  <circle className={styles.dot} r={1.6} />
                </>
              ) : (
                <circle className={styles.ring} r={isActive ? 4.5 : ring} data-shape="dot" />
              )}
            </g>
          </g>
          <g className={styles.label}>
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
        </g>
        {media && (
          // Значок медиа (#69, SPEC §6.3) — отдельная кнопка сразу за маркером (Tab: место → его медиа),
          // на верхнем правом углу фигуры, внутри зазора до рамок подписей (labels.ts: LABEL_GAP), без плашки (#191).
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
            <g transform={`translate(${(ring * 0.6).toFixed(2)} ${(-ring * 0.6).toFixed(2)})`}>
              <circle className={styles.badgeHit} r={6} />
              {/* Галерея — две страницы стопкой: тёмный ореол под светлым контуром. */}
              <path className={styles.badgeHalo} d={GALLERY} />
              <path className={styles.badgeLines} d={GALLERY} />
            </g>
          </g>
        )}
      </Fragment>
    );
  };

  return <g className={styles.markers}>{spots.map(marker)}</g>;
}
