import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { cssDuration, cssPixels } from '../../app/motion';
import type { Camera, Hero, Place, Point, Region } from '../../data/types';
import { heroesOfPlace, heroesOfRegion, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { preloadRegionArt } from './art';
import { biomeColor } from './biomes';
import {
  animateCamera,
  cameraTransform,
  DURATION,
  frameCamera,
  placeCamera,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  UNMEASURED,
  WORLD_CAMERA,
  type View,
} from './camera';
import { EDGE_CLOUDS } from './cloudSets';
import { Clouds } from './Clouds';
import styles from './MapStage.module.css';
import { PlaceTooltip } from './PlaceTooltip';
import { RegionArt } from './RegionArt';
import { RegionTooltip } from './RegionTooltip';

interface Props {
  regions: Region[];
  activeRegionId?: string;
  activePlaceSlug?: string;
  onSelectRegion: (regionId: string) => void;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
  /** Справа кадр закрыт панелью: камера региона и места кадрирует свободную часть (ARCHITECTURE A4). */
  panel?: boolean;
  /** Занять навигацию на время анимации камеры; возвращает «отпустить» (SPEC §7.1: клики не прерывают камеру). */
  onCameraBusy?: () => () => void;
  /** Герои для подсказки региона; по умолчанию — из данных мира. */
  heroesOf?: (regionId: string) => Hero[];
  /** Герои для подсказки места; по умолчанию — из данных мира. */
  heroesOfSpot?: (regionId: string, placeSlug: string) => Hero[];
}

const toStage = ([x, y]: Point): [number, number] => [x * STAGE_WIDTH, y * STAGE_HEIGHT];
const points = (polygon: Point[]) => polygon.map((p) => toStage(p).join(',')).join(' ');

/** Цвет подсветки (SPEC §8.3): ярусы — своё свечение, остальные — по стороне. */
const highlight = (r: Region) => (r.tier === 'continent' ? r.side : r.tier);

/** Вершины пятиконечной звезды столицы (SPEC §6.3), радиус 1. */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 1 : 0.45;
  return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
}).join(' ');

function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action();
    }
  };
}

const noop = () => () => {};

/**
 * Слой карты (ARCHITECTURE A4): SVG в координатах 1600×1000 под камерой.
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
}: Props) {
  const { l, lang, t } = useT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipId = useId();
  const placeTipId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [spotHover, setSpotHover] = useState<string | null>(null);
  const [spotFocus, setSpotFocus] = useState<string | null>(null);
  const [view, setView] = useState<View>(UNMEASURED);

  const drawn = regions.filter((r) => r.layout);
  const listed = regions.filter((r) => !r.layout);
  const active = regions.find((r) => r.id === activeRegionId && r.layout);
  const hasMap = drawn.length > 0;

  // S1h только в мире; наведение мышью важнее фокуса.
  const inWorld = !active;
  const shownId = inWorld ? (hoverId ?? focusId) : null;
  const shown = useMemo(() => regions.find((r) => r.id === shownId && r.layout), [regions, shownId]);
  const shownHeroes = useMemo(() => (shown ? heroesOf(shown.id) : []), [shown, heroesOf]);

  const spots = useMemo(() => active?.places.filter((p) => p.pos) ?? [], [active]);
  const spotId = active ? (spotHover ?? spotFocus) : null;
  const spot = spots.find((p) => p.slug === spotId);
  const spotHeroes = useMemo(
    () => (active && spot ? heroesOfSpot(active.id, spot.slug) : []),
    [active, spot, heroesOfSpot],
  );

  // Кадр и панель: измеряем, чтобы камера региона не уходила под панель.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const layer = layerRef.current;
    if (!viewport || !layer) return;
    const measure = () =>
      setView((v) => {
        const next = { width: viewport.clientWidth, layerWidth: layer.offsetWidth, inset: cssPixels('--panel-inset') };
        return next.width === v.width && next.layerWidth === v.layerWidth && next.inset === v.inset ? v : next;
      });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [hasMap]);

  const camera = useMemo<Camera>(() => {
    if (!active?.layout) return WORLD_CAMERA;
    const pos = active.places.find((p) => p.slug === activePlaceSlug)?.pos;
    return pos ? placeCamera(active.layout.camera, pos) : active.layout.camera;
  }, [active, activePlaceSlug]);

  const inset = panel && active ? view.inset : 0;
  const framed = useMemo(() => frameCamera(camera, { ...view, inset }), [camera, view, inset]);
  const target = cameraTransform(framed.camera, framed.offset);
  /** Маркеры и их подписи — постоянного экранного размера, независимо от приближения. */
  const markerScale = active?.layout ? 1 / frameCamera(active.layout.camera, { ...view, inset }).camera.zoom : 1;

  // Анимация камеры (A3, A4). Пока она идёт, навигация занята: клики ставятся в очередь.
  const shownCamera = useRef<Camera>(camera);
  const shownTarget = useRef(target);
  const shownRegion = useRef(active?.id);
  const running = useRef<Animation | null>(null);
  const busy = useRef(onCameraBusy);
  useLayoutEffect(() => {
    busy.current = onCameraBusy;
  }, [onCameraBusy]);

  useLayoutEffect(() => {
    const el = layerRef.current;
    const prevCamera = shownCamera.current;
    const prevRegion = shownRegion.current;
    let from = shownTarget.current;
    shownCamera.current = camera;
    shownTarget.current = target;
    shownRegion.current = active?.id;
    // Тот же кадр, другой размер окна — без анимации, transform уже стоит в style.
    if (!el || prevCamera === camera) return;
    if (running.current) {
      // Новый переход посреди старого (кнопка «назад» браузера) — продолжаем с текущего положения.
      from = window.getComputedStyle(el).transform || from;
      running.current.cancel();
      running.current = null;
    }
    const withinRegion = prevRegion !== undefined && prevRegion === active?.id;
    const duration = withinRegion
      ? cssDuration('--dur-place') || DURATION.place
      : cssDuration('--dur-camera') || DURATION.region;
    const animation = animateCamera(el, from, target, duration);
    if (!animation) return;
    running.current = animation;
    const release = busy.current();
    animation.finished
      .catch(() => undefined)
      .finally(() => {
        if (running.current === animation) running.current = null;
        release();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- анимируем только смену кадра, не размер окна
  }, [camera]);

  useEffect(() => () => running.current?.cancel(), []);

  const getAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !shown?.layout) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = shown.layout.label;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  }, [shown]);

  const getSpotAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !spot?.pos) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = spot.pos;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  }, [spot]);

  const enter = (r: Region) => {
    setHoverId(r.id);
    void preloadRegionArt(r);
  };

  // S3 → S2: клик по пустому месту карты (SPEC §5.1). Маркеры клик не пропускают.
  const onBackground = (e: MouseEvent) => {
    if (active && activePlaceSlug !== undefined && !(e.target as Element).closest?.('[data-place]')) {
      onSelectRegion(active.id);
    }
  };

  const marker = (p: Place, i: number) => {
    const [x, y] = toStage(p.pos!);
    const isActive = p.slug === activePlaceSlug;
    const name = placeName(p, lang);
    const select = () => onSelectPlace(active!.id, p.slug);
    return (
      <g
        key={p.slug}
        className={[styles.marker, p.capital && styles.capital, isActive && styles.current].filter(Boolean).join(' ')}
        style={{ '--i': i } as CSSProperties}
        transform={`translate(${x} ${y}) scale(${markerScale.toFixed(4)})`}
        role="button"
        tabIndex={0}
        aria-label={name}
        aria-current={isActive ? 'true' : undefined}
        aria-describedby={p.slug === spotId && spotHeroes.length > 0 ? placeTipId : undefined}
        data-place={p.slug}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
        onKeyDown={onActivate(select)}
        onPointerEnter={(e) => e.pointerType !== 'touch' && setSpotHover(p.slug)}
        onPointerLeave={() => setSpotHover((s) => (s === p.slug ? null : s))}
        onFocus={() => setSpotFocus(p.slug)}
        onBlur={() => setSpotFocus((s) => (s === p.slug ? null : s))}
      >
        <circle className={styles.hit} r={18} />
        <circle className={styles.ring} r={p.capital ? 11 : 9} />
        {p.capital ? (
          <polygon className={styles.dot} points={STAR} transform="scale(7)" />
        ) : (
          <circle className={styles.dot} r={4} />
        )}
        <text className={styles.markerLabel} y={p.capital ? -17 : -15} textAnchor="middle">
          {name}
        </text>
      </g>
    );
  };

  return (
    <div className={[styles.stage, active && styles.zoomed].filter(Boolean).join(' ')}>
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
              <g>
                {drawn.map((r) => {
                  const isActive = r.id === active?.id;
                  // S2/S3: соседи затемнены и не кликаются, активный регион — «пустое место» карты (SPEC §5.4).
                  if (!inWorld) {
                    return (
                      <polygon
                        key={r.id}
                        className={[styles.region, isActive ? styles.active : styles.dimmed].join(' ')}
                        points={points(r.layout!.polygon)}
                        fill={biomeColor(r.biome)}
                        aria-hidden="true"
                        data-region={r.id}
                      />
                    );
                  }
                  return (
                    <polygon
                      key={r.id}
                      className={styles.region}
                      points={points(r.layout!.polygon)}
                      fill={biomeColor(r.biome)}
                      role="button"
                      tabIndex={0}
                      aria-label={l(r.name)}
                      aria-describedby={r.id === shownId ? tooltipId : undefined}
                      data-region={r.id}
                      onClick={() => onSelectRegion(r.id)}
                      onKeyDown={onActivate(() => onSelectRegion(r.id))}
                      // SPEC §5.3: на тач-устройствах подсказки нет, тап сразу открывает регион.
                      onPointerEnter={(e) => e.pointerType !== 'touch' && enter(r)}
                      onPointerLeave={() => setHoverId((id) => (id === r.id ? null : id))}
                      onFocus={() => {
                        setFocusId(r.id);
                        void preloadRegionArt(r);
                      }}
                      onBlur={() => setFocusId((id) => (id === r.id ? null : id))}
                    />
                  );
                })}
              </g>
              {/* Заливка цветом стороны поверх всех полигонов, чтобы светлая граница не пряталась под соседями. */}
              <g aria-hidden="true">
                {drawn.map((r) => (
                  <polygon
                    key={r.id}
                    className={[
                      styles.tint,
                      styles[highlight(r)],
                      r.id === shownId && styles.lit,
                      r.id === shownId && r.id === focusId && styles.focused,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    points={points(r.layout!.polygon)}
                    data-tint={r.id}
                  />
                ))}
              </g>
              <g aria-hidden="true" className={styles.labels}>
                {drawn.map((r) => {
                  const [lx, ly] = toStage(r.layout!.label);
                  return (
                    <text
                      key={r.id}
                      className={[
                        styles.label,
                        styles[highlight(r)],
                        r.tier !== 'continent' && styles.tierLabel,
                        r.id === shownId && styles.lit,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                    >
                      {l(r.name)}
                    </text>
                  );
                })}
              </g>
              {active && <RegionArt key={active.id} region={active} />}
              {active && (
                <g key={active.id} className={styles.markers}>
                  {spots.map(marker)}
                </g>
              )}
            </svg>
          </div>
          <div className={styles.vignette} aria-hidden="true" />
          <Clouds clouds={EDGE_CLOUDS} mode="drift" hidden={!inWorld} />
        </div>
      )}
      {shown && <RegionTooltip id={tooltipId} region={shown} heroes={shownHeroes} getAnchor={getAnchor} />}
      {active && spot && (
        <PlaceTooltip id={placeTipId} placeKey={`${active.id}/${spot.slug}`} heroes={spotHeroes} getAnchor={getSpotAnchor} />
      )}
      {listed.length > 0 && (
        <nav className={styles.list} aria-label={t('world.regions')}>
          <ul>
            {listed.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-current={r.id === activeRegionId ? 'true' : undefined}
                  onClick={() => onSelectRegion(r.id)}
                >
                  {l(r.name)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
