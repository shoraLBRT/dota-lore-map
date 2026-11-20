import { memo, useCallback, useLayoutEffect, useRef } from 'react';
import { useSfx } from '../../app/sound';
import type { Region } from '../../data/types';
import { placeName } from '../../data/world';
import { useT } from '../../i18n';
import { kindOf, markerLabelAttrs } from './markerLayout';
import { MarkerFigure } from './MarkersLayer';
import styles from './MarkersLayer.module.css';
import type { View } from './camera';
import { toStage } from './stage';
import { toScreen } from './threadGeometry';
import type { Frame } from './useCamera';
import type { WorldPlaceItem, WorldPlaceSpot } from './worldPlaces';

/** Зона нажатия маркера мира, px (как у маркера региона, MarkersLayer: HIT_RADIUS). */
const HIT_RADIUS = 16;

interface Props {
  items: WorldPlaceItem[];
  spots: Map<string, WorldPlaceSpot>;
  /** Приближение мира на экране и 1 px экрана в единицах сцены. */
  zoom: number;
  pxScale: number;
  /** Кадр: маркеры за его краем не рисуются (`inView`). Без замера (`view.width` 0) — все в кадре. */
  view: View;
  framed: Frame['framed'];
  /** Места выбранного героя (`region/slug`): остальные приглушены. */
  focusPlaces: Set<string> | null;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
}

/** Запас за краем кадра, px: подпись маркера у края ещё видна. */
const VIEW_MARGIN = 160;

/**
 * Маркер в кадре (с запасом под подпись). За краем маркер не рисуется (`display: none`): запись отрисовки экранного
 * слоя на каждом кадре зума — по маркерам в кадре, а не по всем местам мира (бюджет A14).
 */
export function inView(m: Pick<WorldPlaceItem, 'x' | 'y'>, view: View, framed: Frame['framed']): boolean {
  if (view.width <= 0) return true;
  const [x, y] = toScreen([m.x, m.y], framed.camera, framed.offset, view, framed.offsetY);
  return x > -VIEW_MARGIN && x < view.width + VIEW_MARGIN && y > -VIEW_MARGIN && y < view.height + VIEW_MARGIN;
}

interface MarkerProps {
  m: WorldPlaceItem;
  side: WorldPlaceSpot['side'];
  shown: boolean;
  /** Выбран герой: `hero` — место героя, `muted` — чужое. */
  focus: 'hero' | 'muted' | null;
  name: string;
  select: (regionId: string, placeSlug: string) => void;
}

/**
 * Один маркер мира. Его transform (`translate(x y) scale(k)`, A4) пишет группа (`WorldMarkers`) прямо в DOM: на кадре
 * зума React маркеры не перерисовывает, а у элементов меняется только transform — без пересчёта стилей поддерева,
 * как было бы с CSS-переменной масштаба у группы.
 */
const WorldMarker = memo(function WorldMarker({ m, side, shown, focus, name, select }: MarkerProps) {
  const sfx = useSfx();
  const [x, y] = toStage(m.place.pos!);
  const kind = kindOf(m.place);
  const label = markerLabelAttrs(side === 'hidden' ? 'right' : side, m.ring, m.size);
  return (
    <g
      className={[
        styles.marker,
        styles.worldMarker,
        !shown && styles.worldOff,
        m.place.capital && styles.capital,
        kind === 'event' && styles.event,
        kind === 'place' && styles.minor,
        side === 'hidden' && styles.labelHidden,
        focus === 'hero' && styles.heroSpot,
        focus === 'muted' && styles.mutedMarker,
      ]
        .filter(Boolean)
        .join(' ')}
      data-x={x.toFixed(2)}
      data-y={y.toFixed(2)}
      data-world-place={m.key}
      data-shown={shown ? '' : undefined}
      data-kind={kind}
      onClick={(e) => {
        e.stopPropagation();
        if (shown) select(m.regionId, m.place.slug);
      }}
      onPointerEnter={(e) => shown && e.pointerType !== 'touch' && sfx('hover')}
    >
      <circle className={styles.hit} r={HIT_RADIUS} data-hit="" />
      <MarkerFigure kind={kind} ring={m.ring} label={label} side={side} name={name} />
    </g>
  );
});

/**
 * Маркеры мест в режиме мира (#190, SPEC §8.6): видны с порога своего вида (`useWorldPlaces`), проявляются мягко;
 * клик сразу открывает место. Маркеры, у которых в мире есть место, смонтированы всегда и скрыты до порога и за краем
 * кадра (`display: none`) — переход порога меняет класс, а не монтирует сотню узлов на кадре зума. Экранный слой мира скрыт от чтения с экрана
 * (`aria-hidden`), поэтому маркеры здесь — цели только для мыши и пальца: с клавиатуры места открываются через регион.
 */
export function WorldMarkers({ items, spots, zoom, pxScale, view, framed, focusPlaces, onSelectPlace }: Props) {
  const { lang } = useT();
  // Обработчик из WorldScreen — новый на каждый рендер; через ref маркеры остаются мемоизированными.
  const selectRef = useRef(onSelectPlace);
  useLayoutEffect(() => {
    selectRef.current = onSelectPlace;
  });
  const select = useCallback((regionId: string, slug: string) => selectRef.current(regionId, slug), []);
  const groupRef = useRef<SVGGElement>(null);
  const k = pxScale.toFixed(5);
  useLayoutEffect(() => {
    // Скрытые (`display: none`) не трогаем: показанный маркер React перерисовывает в том же кадре, что и масштаб.
    for (const el of groupRef.current?.children ?? []) {
      const g = el as SVGGElement;
      if (g.dataset.shown === undefined) continue;
      g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) scale(${k})`);
    }
  }, [k, items, spots, zoom, view, framed]);
  return (
    <g ref={groupRef} className={styles.markers} data-world-places="">
      {items.map((m) => {
        const spot = spots.get(m.key);
        if (!spot || spot.from === Infinity) return null;
        return (
          <WorldMarker
            key={m.key}
            m={m}
            side={spot.side}
            shown={zoom >= spot.from - 1e-6 && inView(m, view, framed)}
            focus={focusPlaces ? (focusPlaces.has(m.key) ? 'hero' : 'muted') : null}
            name={placeName(m.place, lang)}
            select={select}
          />
        );
      })}
    </g>
  );
}

/**
 * Невидимые подписи всех мест мира — для замера ширин (`useMeasuredLabels`, ключ `wp:регион/место`): маркеры мира
 * рисуются только с порога, а расстановке (`placeWorldPlaces`) ширины нужны заранее. Кегль — по виду места, как у маркера.
 */
export const WorldPlaceMeasure = memo(function WorldPlaceMeasure({ regions }: { regions: Region[] }) {
  const { lang } = useT();
  return (
    <g visibility="hidden" aria-hidden="true" pointerEvents="none">
      {regions.flatMap((r) =>
        r.places.flatMap((p) => {
          if (!p.pos) return [];
          const kind = kindOf(p);
          return [
            <g key={`${r.id}/${p.slug}`} className={kind === 'capital' ? styles.capital : kind === 'event' ? styles.event : styles.minor}>
              <text className={styles.markerLabel} data-measure={`wp:${r.id}/${p.slug}`}>
                {placeName(p, lang)}
              </text>
            </g>,
          ];
        }),
      )}
    </g>
  );
});
