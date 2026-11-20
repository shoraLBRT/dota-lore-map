import { useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { Hero, Region } from '../../data/types';
import { heroesOfPlace, heroesOfRegion } from '../../data/world';
import { useT } from '../../i18n';
import { AmbientCanvas } from '../atmosphere/AmbientCanvas';
import type { Spot } from '../search/search';
import type { HeroThreads } from '../search/threads';
import { preloadRegionArt } from './art';
import { polygonBox, STAGE_HEIGHT, STAGE_WIDTH, WORLD_ASPECT } from './camera';
import { EdgeLabels } from './EdgeLabels';
import { MapAtmosphere } from './MapAtmosphere';
import styles from './MapStage.module.css';
import { useMarkerLabels } from './markerLayout';
import { MarkersLayer } from './MarkersLayer';
import type { MediaBadge } from './mediaBadge';
import { PlaceTooltip } from './PlaceTooltip';
import { RegionArt } from './RegionArt';
import { WorldArt } from './WorldArt';
import { ZoomControls } from './ZoomControls';
import { RegionList } from './RegionList';
import { labelMetrics } from './labels';
import { useRegionNames } from './regionLabelLayout';
import { RegionLabels, RegionsLayer, UnmappedRegions, zoomedClass } from './RegionsLayer';
import { RegionTooltip } from './RegionTooltip';
import { Threads } from './Threads';
import { threadStyleFrom } from './threadStyle';
import { depthFlagsFrom } from './depth';
import { useDepth } from './useDepth';
import { useCamera } from './useCamera';
import { useFontsTick, useMeasuredLabels } from './useMeasuredLabels';
import { usePlaceTooltip } from './usePlaceTooltip';
import { useRegionTooltip } from './useRegionTooltip';
import { useThreadLayout } from './useThreadLayout';
import { WorldMarkers, WorldPlaceMeasure } from './WorldMarkers';
import { placeThreshold, regionUnder, useWorldPlaces } from './worldPlaces';

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
  /** Строка места в панели региона под наведением или фокусом (#99): маркер выглядит как под наведением. */
  litPlace?: string;
  /** Нажат портрет в подсказке региона (#65): выбрать героя, не уходя из мира. Без него портреты не кликаются. */
  onPickHero?: (hero: Hero) => void;
  /** Клик по метке нити, ушедшей за край кадра. */
  onSelectSpot?: (spot: Spot) => void;
  /** Нажат значок медиа у маркера места или в подсказке региона (#69): открыть галерею. Без него значков нет. */
  onOpenMedia?: (regionId: string, open: MediaBadge['open']) => void;
  /** Телефон (#196, SPEC §13): в мире карта во весь кадр, список регионов — в нижней шторке. */
  regionList?: boolean;
  /** Шторка списка регионов развёрнута; без `onRegionsOpen` — своё состояние. */
  regionsOpen?: boolean;
  onRegionsOpen?: (open: boolean) => void;
  /** Низ плашки героя или поиска над кадром, px от его верха (0 — плашки нет): метки «нить за краем» — ниже (#64). */
  coverTop?: number;
  /** Панель свёрнута ромбом (#195): кнопки зума уезжают к краю окна вместе с ней, камера не перекадрируется. */
  panelCollapsed?: boolean;
  /** Колесо наружу с нижнего упора региона или места (#190): вернуться в мир. */
  onLeaveRegion?: () => void;
}

const noop = () => () => {};


/**
 * Слой карты (ARCHITECTURE A4): картинка мира и SVG в координатах сцены под камерой — сборка слоёв.
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
  litPlace,
  onPickHero,
  onSelectSpot,
  onOpenMedia,
  regionList = false,
  regionsOpen,
  onRegionsOpen,
  coverTop = 0,
  panelCollapsed = false,
  onLeaveRegion,
}: Props) {
  const { lang, l, t } = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  /** SVG экранного слоя (#180): названия регионов и маркеры мест — их ширины меряются здесь. */
  const screenSvgRef = useRef<SVGSVGElement>(null);
  /** Пункт списка регионов под наведением или фокусом: регион подсвечен на карте, без подсказки. */
  const [listId, setListId] = useState<string | null>(null);

  const drawn = useMemo(() => regions.filter((r) => r.layout), [regions]);
  const listed = regions.filter((r) => !r.layout);
  const active = regions.find((r) => r.id === activeRegionId && r.layout);
  const hasMap = drawn.length > 0;
  const inWorld = !active;
  const litId = inWorld ? listId : null;

  const place = usePlaceTooltip(active, svgRef, heroesOfSpot);
  const { spots, spot } = place;

  const focusRegions = useMemo(() => (focus ? new Set(focus.map((s) => s.regionId)) : null), [focus]);
  const focusPlaces = useMemo(() => (focus ? new Set(focus.map((s) => s.key)) : null), [focus]);
  const previewRegions = useMemo(() => (preview ? new Set(preview.map((s) => s.regionId)) : null), [preview]);
  const previewPlaces = useMemo(() => (preview ? new Set(preview.map((s) => s.key)) : null), [preview]);

  const regionBoxes = useMemo(() => regions.flatMap((r) => (r.layout ? [polygonBox(r.layout.polygon)] : [])), [regions]);
  const cam = useCamera({ active, regionBoxes, activePlaceSlug, panel, hasMap, onCameraBusy, onLeave: onLeaveRegion });
  const { viewportRef, layerRef, screenRef, flying, target, frame, controls } = cam;
  const [ownOpen, setOwnOpen] = useState(false);
  const sheetOpen = regionsOpen ?? ownOpen;
  const tip = useRegionTooltip({
    regions,
    inWorld,
    svgRef,
    labelsRef: screenSvgRef,
    camera: frame.framed.camera,
    heroesOf,
    withMedia: !!onOpenMedia,
  });
  const { shown } = tip;
  // Рисунок пути (#168): `?threads=<вариант>` до `#` — сравнение вариантов для владельца.
  const [threadVariant] = useState(() => threadStyleFrom(typeof location === 'undefined' ? '' : location.search));
  // Прототипы объёма (#197): `?depth=tilt,dof,water,clouds` или `?depth=all` до `#`; без флага карта прежняя.
  const [depth] = useState(() => depthFlagsFrom(typeof location === 'undefined' ? '' : location.search));
  const tiltRef = useRef<HTMLDivElement>(null);
  useDepth(depth, { viewportRef, layerRef, tiltRef, screenSvgRef });
  const landPolygons = useMemo(() => drawn.map((r) => r.layout!.polygon), [drawn]);

  // Ширины подписей: при смене языка, региона и после загрузки шрифтов (подписи не выходят за край и не налезают).
  const fontsTick = useFontsTick();
  // Кегли названий регионов зависят от размера мира в кадре (#189): другой кегль — мерить заново.
  const nameFonts = `${labelMetrics(1, frame.fitted).font}/${labelMetrics(2, frame.fitted).font}/${labelMetrics(3, frame.fitted).font}`;
  const widths = useMeasuredLabels(screenSvgRef, `${lang}|${active?.id ?? ''}|${fontsTick}|${hasMap}|${nameFonts}`);
  const names = useRegionNames(drawn, {
    lang,
    name: (r) => l(r.name),
    widths,
    fitted: frame.fitted,
    zoomFrom: Math.min(1, frame.worldZoom),
    zoomMax: frame.zoomMax,
    world: { width: frame.view.layerWidth, height: frame.view.layerHeight },
  });
  // Смысловой зум (#190): места в мире появляются по значимости с приближением; регион под камерой подписан по территории.
  const worldPlaces = useWorldPlaces(drawn, {
    lang,
    names,
    widths,
    zoomFrom: Math.min(1, frame.worldZoom),
    zoomMax: frame.zoomMax,
    world: { width: frame.view.layerWidth, height: frame.view.layerHeight },
    enabled: inWorld,
  });
  const deep = inWorld && frame.worldZoom >= placeThreshold('capital', Math.min(1, frame.worldZoom), frame.zoomMax) - 1e-6;
  const under = deep ? regionUnder(drawn, [frame.framed.camera.x, frame.framed.camera.y]) : undefined;
  const labels = useMarkerLabels({ spots, activeId: active?.id, activePlaceSlug, focusPlaces, lang, widths, frame });
  const threadLayout = useThreadLayout({ threads, active, drawn, labels, names, frame, coverTop });

  // S3 → S2: клик по пустому месту карты (SPEC §5.1). Маркеры клик не пропускают.
  const onBackground = (e: MouseEvent) => {
    if (active && activePlaceSlug !== undefined && !(e.target as Element).closest?.('[data-place]')) {
      onSelectRegion(active.id);
    }
  };

  const mapLayer = (
    <div ref={layerRef} className={styles.layer} style={{ transform: target, '--aspect': WORLD_ASPECT } as CSSProperties}>
      <WorldArt layerRef={layerRef} viewportRef={viewportRef} />
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
          onSelectRegion={onSelectRegion}
        />
        {active && <RegionArt key={`art-${active.id}`} region={active} />}
        {threads && (
          <Threads
            key={threadsKey}
            threads={threads}
            scale={frame.threadScale}
            obstacles={threadLayout.obstacles}
            clip={threadLayout.clip}
            variant={threadVariant}
          />
        )}
      </svg>
    </div>
  );
    {/* Экранный слой (#180, ARCHITECTURE A4): тот же кадр и transform, что у слоя карты, но без
        will-change — текст растеризуется в разрешении экрана при любом приближении. */}
  const screenLayer = (
    <div ref={screenRef} className={styles.screen} style={{ transform: target, '--aspect': WORLD_ASPECT } as CSSProperties}>
      <svg
        ref={screenSvgRef}
        className={styles.svg}
        viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
        role={active ? 'group' : undefined}
        aria-label={active ? l(active.name) : undefined}
        aria-hidden={active ? undefined : 'true'}
        data-screen-layer=""
      >
        <RegionLabels
          drawn={drawn}
          inWorld={inWorld}
          tip={tip}
          litId={litId}
          focusRegions={focusRegions}
          previewRegions={previewRegions}
          names={names}
          zoom={frame.worldZoom}
          pxScale={frame.pxScale}
          onSelectRegion={onSelectRegion}
          underId={under?.id}
        />
        {inWorld && <WorldPlaceMeasure regions={drawn} />}
        {inWorld && worldPlaces.items.length > 0 && (
          <WorldMarkers
            items={worldPlaces.items}
            spots={worldPlaces.spots}
            zoom={frame.worldZoom}
            pxScale={frame.pxScale}
            view={frame.view}
            framed={frame.framed}
            focusPlaces={focusPlaces}
            onSelectPlace={onSelectPlace}
          />
        )}
        {active && (
          <MarkersLayer
            key={`markers-${active.id}`}
            regionId={active.id}
            activePlaceSlug={activePlaceSlug}
            sides={labels.sides}
            markerScale={frame.markerScale}
            focusPlaces={focusPlaces}
            previewPlaces={previewPlaces}
            litPlaceSlug={litPlace}
            place={place}
            onSelectPlace={onSelectPlace}
            onOpenMedia={onOpenMedia}
          />
        )}
      </svg>
    </div>
  );

  return (
    <div className={[styles.stage, active && zoomedClass].filter(Boolean).join(' ')}>
      {hasMap && (
        <div ref={viewportRef} className={styles.viewport} onClick={onBackground} data-map-viewport="">
          {depth.tilt || depth.dof ? (
            // Прототипы #197: наклон и полосы глубины резкости — в обёртке слоя карты; подписи — плоские, над ней.
            <div ref={tiltRef} className={styles.tilt}>
              {mapLayer}
              {depth.dof && (
                <div className={styles.dof} aria-hidden="true">
                  <span data-edge="top" />
                  <span data-edge="bottom" />
                </div>
              )}
            </div>
          ) : (
            mapLayer
          )}
          {screenLayer}
          <div className={styles.cloudBox}>
            <MapAtmosphere layerRef={layerRef} activeId={active?.id} clear={Boolean(threads)} water={depth.water ? landPolygons : undefined} edgeClouds={depth.clouds} />
          </div>
          {active && (
            <AmbientCanvas
              key={active.id}
              ambient={active.ambient}
              region={active.layout ? { layerRef, polygon: active.layout.polygon } : undefined}
            />
          )}
          <div className={styles.vignette} aria-hidden="true" />
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
          {regionList && inWorld && (
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
              open={sheetOpen}
              onOpenChange={(open) => (onRegionsOpen ?? setOwnOpen)(open)}
            />
          )}
          <ZoomControls controls={controls} right={panelCollapsed ? 0 : frame.cover} region={!inWorld} />
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
