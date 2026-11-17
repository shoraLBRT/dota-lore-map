import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { Hero, Region } from '../../data/types';
import { heroesOfPlace, heroesOfRegion } from '../../data/world';
import { useT } from '../../i18n';
import { AmbientCanvas } from '../atmosphere/AmbientCanvas';
import type { Spot } from '../search/search';
import type { HeroThreads } from '../search/threads';
import { preloadRegionArt } from './art';
import { STAGE_HEIGHT, STAGE_WIDTH, type Rect } from './camera';
import { EDGE_CLOUDS } from './cloudSets';
import { Clouds } from './Clouds';
import { EdgeLabels } from './EdgeLabels';
import styles from './MapStage.module.css';
import { useMarkerLabels } from './markerLayout';
import { MarkersLayer } from './MarkersLayer';
import type { MediaBadge } from './mediaBadge';
import { PlaceTooltip } from './PlaceTooltip';
import { RegionArt } from './RegionArt';
import { RegionList } from './RegionList';
import { RegionsLayer, UnmappedRegions, zoomedClass } from './RegionsLayer';
import { RegionTooltip } from './RegionTooltip';
import { Threads } from './Threads';
import { useCamera } from './useCamera';
import { useFontsTick, useMeasuredLabels } from './useMeasuredLabels';
import { usePlaceTooltip } from './usePlaceTooltip';
import { useRegionTooltip } from './useRegionTooltip';
import { useThreadLayout } from './useThreadLayout';

export { TOOLTIP_CLOSE_DELAY } from './useRegionTooltip';

interface Props {
  regions: Region[];
  activeRegionId?: string;
  activePlaceSlug?: string;
  /** `source` — откуда открыли: полигон на карте или пункт списка регионов (фокус при возврате, A14). */
  onSelectRegion: (regionId: string, source?: 'map' | 'list') => void;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
  /** Справа кадр закрыт панелью: камера региона и места кадрирует свободную часть (ARCHITECTURE A4). */
  panel?: boolean;
  /** Занять навигацию на время анимации камеры; возвращает «отпустить» (SPEC §7.1: клики не прерывают камеру). */
  onCameraBusy?: () => () => void;
  /** Герои для подсказки региона; по умолчанию — из данных мира. */
  heroesOf?: (regionId: string) => Hero[];
  /** Герои для подсказки места; по умолчанию — из данных мира. */
  heroesOfSpot?: (regionId: string, placeSlug: string) => Hero[];
  /** Выбран герой (SPEC §6.5): его регионы и места подсвечены, остальные приглушены. */
  focus?: Spot[];
  /** Нити героя (SPEC §6.6, #67): шаги пути и прочие связи; `threadsKey` перезапускает прорисовку. */
  threads?: HeroThreads;
  threadsKey?: string;
  /**
   * Герой под наведением или фокусом (портрет в панели, вариант поиска; SPEC §6.6, #66): в мире подсвечены
   * его регионы, в регионе и месте — пульсируют его маркеры, места за кадром получают метку у края.
   */
  preview?: Spot[];
  /** Нажат портрет в подсказке региона (#65): выбрать героя, не уходя из мира. Без него портреты не кликаются. */
  onPickHero?: (hero: Hero) => void;
  /** Клик по метке нити, ушедшей за край кадра. */
  onSelectSpot?: (spot: Spot) => void;
  /** Нажат значок медиа у маркера места или в подсказке региона (#69): открыть галерею. Без него значков нет. */
  onOpenMedia?: (regionId: string, open: MediaBadge['open']) => void;
  /** Телефон (#39, SPEC §13): в мире карта прижата к верху, под ней — список регионов. */
  regionList?: boolean;
  /** Сколько px сверху кадра занято (плашка героя): карта со списком встаёт ниже. */
  topInset?: number;
  /** Низ плашки героя или поиска над кадром, px от его верха (0 — плашки нет): метки «нить за краем» — ниже (#64). */
  coverTop?: number;
}

const noop = () => () => {};

const rectStyle = (r: Rect): CSSProperties => ({ top: r.top, left: r.left, width: r.width, height: r.height });

/**
 * Слой карты (ARCHITECTURE A4): SVG в координатах 1600×1000 под камерой — сборка слоёв.
 * Мир (S1): наведение и фокус подсвечивают регион и показывают подсказку (S1h).
 * Регион и место (S2/S3): соседи затемнены и не кликаются, маркеры мест с подсказкой героев.
 * Регионы без геометрии в map/layout.json показываются списком кнопок.
 */
export function MapStage({
  regions,
  activeRegionId,
  activePlaceSlug,
  onSelectRegion,
  onSelectPlace,
  panel = false,
  onCameraBusy = noop,
  heroesOf = heroesOfRegion,
  heroesOfSpot = heroesOfPlace,
  focus,
  threads,
  threadsKey,
  preview,
  onPickHero,
  onSelectSpot,
  onOpenMedia,
  regionList = false,
  topInset = 0,
  coverTop = 0,
}: Props) {
  const { lang, t } = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  /** Пункт списка регионов под наведением или фокусом: регион подсвечен на карте, без подсказки. */
  const [listId, setListId] = useState<string | null>(null);

  const drawn = regions.filter((r) => r.layout);
  const listed = regions.filter((r) => !r.layout);
  const active = regions.find((r) => r.id === activeRegionId && r.layout);
  const hasMap = drawn.length > 0;
  const inWorld = !active;
  const litId = inWorld ? listId : null;

  const tip = useRegionTooltip({ regions, inWorld, svgRef, heroesOf, withMedia: !!onOpenMedia });
  const { shown } = tip;
  const place = usePlaceTooltip(active, svgRef, heroesOfSpot);
  const { spots, spot } = place;

  const focusRegions = useMemo(() => (focus ? new Set(focus.map((s) => s.regionId)) : null), [focus]);
  const focusPlaces = useMemo(() => (focus ? new Set(focus.map((s) => s.key)) : null), [focus]);
  const previewRegions = useMemo(() => (preview ? new Set(preview.map((s) => s.regionId)) : null), [preview]);
  const previewPlaces = useMemo(() => (preview ? new Set(preview.map((s) => s.key)) : null), [preview]);

  const cam = useCamera({ active, activePlaceSlug, panel, regionList, topInset, hasMap, onCameraBusy });
  const { viewportRef, layerRef, listLayout, flying, target, frame } = cam;

  // Ширины подписей: при смене языка, региона и после загрузки шрифтов (подписи не выходят за край и не налезают).
  const fontsTick = useFontsTick();
  const widths = useMeasuredLabels(svgRef, `${lang}|${active?.id ?? ''}|${fontsTick}|${hasMap}`);
  const labels = useMarkerLabels({ spots, activeId: active?.id, activePlaceSlug, focusPlaces, lang, widths, frame });
  const threadLayout = useThreadLayout({ threads, active, drawn, labels, widths, frame, coverTop, listed: !!listLayout });

  // S3 → S2: клик по пустому месту карты (SPEC §5.1). Маркеры клик не пропускают.
  const onBackground = (e: MouseEvent) => {
    if (active && activePlaceSlug !== undefined && !(e.target as Element).closest?.('[data-place]')) {
      onSelectRegion(active.id);
    }
  };

  return (
    <div className={[styles.stage, active && zoomedClass].filter(Boolean).join(' ')}>
      {hasMap && (
        <div ref={viewportRef} className={styles.viewport} onClick={onBackground}>
          <div ref={layerRef} className={styles.layer} style={{ transform: target }}>
            <svg
              ref={svgRef}
              className={styles.svg}
              viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
              role="group"
              aria-label={t('world.map')}
            >
              <RegionsLayer
                drawn={drawn}
                activeId={active?.id}
                inWorld={inWorld}
                tip={tip}
                litId={litId}
                focusRegions={focusRegions}
                previewRegions={previewRegions}
                widths={widths}
                onSelectRegion={onSelectRegion}
              />
              {active && <RegionArt key={`art-${active.id}`} region={active} />}
              {active && (
                <MarkersLayer
                  key={`markers-${active.id}`}
                  regionId={active.id}
                  activePlaceSlug={activePlaceSlug}
                  sides={labels.sides}
                  labelWidths={labels.labelWidths}
                  markerScale={frame.markerScale}
                  focusPlaces={focusPlaces}
                  previewPlaces={previewPlaces}
                  place={place}
                  onSelectPlace={onSelectPlace}
                  onOpenMedia={onOpenMedia}
                />
              )}
              {threads && (
                <Threads
                  key={threadsKey}
                  threads={threads}
                  scale={frame.threadScale}
                  obstacles={threadLayout.obstacles}
                  clip={threadLayout.clip}
                />
              )}
            </svg>
          </div>
          {active && <AmbientCanvas key={active.id} ambient={active.ambient} />}
          <div className={styles.vignette} style={listLayout ? rectStyle(listLayout.map) : undefined} aria-hidden="true" />
          <EdgeLabels
            active={active}
            threads={threads}
            threadsKey={threadsKey}
            preview={preview}
            frame={frame}
            coverTop={coverTop}
            fontsTick={fontsTick}
            onSelectSpot={onSelectSpot}
          />
          <div className={styles.cloudBox} style={listLayout ? rectStyle(listLayout.map) : undefined}>
            <Clouds clouds={EDGE_CLOUDS} mode="drift" hidden={!inWorld} />
          </div>
          {listLayout && (
            <RegionList
              regions={drawn}
              onSelect={(id) => onSelectRegion(id, 'list')}
              onHighlight={(id) => {
                setListId(id);
                if (!id) return;
                const r = drawn.find((d) => d.id === id);
                if (r) void preloadRegionArt(r);
              }}
              heroCountOf={(id) => heroesOf(id).length}
              focus={focusRegions}
              waiting={flying}
              style={rectStyle(listLayout.list)}
            />
          )}
        </div>
      )}
      {shown && !flying && (
        <RegionTooltip
          {...tip.tip}
          region={shown}
          heroes={tip.heroes}
          onPick={onPickHero}
          media={tip.media}
          onOpenMedia={onOpenMedia && ((b) => onOpenMedia(shown.id, b.open))}
        />
      )}
      {active && spot && !flying && (
        <PlaceTooltip id={place.id} placeKey={`${active.id}/${spot.slug}`} heroes={place.heroes} getAnchor={place.getAnchor} />
      )}
      {listed.length > 0 && <UnmappedRegions regions={listed} activeId={activeRegionId} onSelect={onSelectRegion} />}
    </div>
  );
}
