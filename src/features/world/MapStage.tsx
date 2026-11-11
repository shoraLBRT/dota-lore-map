import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Camera, Hero, Point, Region } from '../../data/types';
import { heroesOfRegion, placeName } from '../../data/world';
import { useT } from '../../i18n';
import { preloadRegionArt } from './art';
import { biomeColor } from './biomes';
import { animateCamera, cameraTransform, DURATION, placeCamera, STAGE_HEIGHT, STAGE_WIDTH, WORLD_CAMERA } from './camera';
import { EDGE_CLOUDS } from './cloudSets';
import { Clouds } from './Clouds';
import styles from './MapStage.module.css';
import { RegionTooltip } from './RegionTooltip';

interface Props {
  regions: Region[];
  activeRegionId?: string;
  activePlaceSlug?: string;
  onSelectRegion: (regionId: string) => void;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
  /** Герои для подсказки региона; по умолчанию — из данных мира. */
  heroesOf?: (regionId: string) => Hero[];
}

const toStage = ([x, y]: Point): [number, number] => [x * STAGE_WIDTH, y * STAGE_HEIGHT];
const points = (polygon: Point[]) => polygon.map((p) => toStage(p).join(',')).join(' ');

/** Цвет подсветки (SPEC §8.3): ярусы — своё свечение, остальные — по стороне. */
const highlight = (r: Region) => (r.tier === 'continent' ? r.side : r.tier);

function onActivate(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}

/**
 * Слой карты (ARCHITECTURE A4): SVG в координатах 1600×1000 под камерой.
 * В мире (нет активного региона) наведение и фокус подсвечивают регион и показывают подсказку (S1h).
 * Регионы без геометрии в map/layout.json показываются списком кнопок.
 */
export function MapStage({
  regions,
  activeRegionId,
  activePlaceSlug,
  onSelectRegion,
  onSelectPlace,
  heroesOf = heroesOfRegion,
}: Props) {
  const { l, lang, t } = useT();
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shownCamera = useRef<Camera>(WORLD_CAMERA);
  const tooltipId = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const drawn = regions.filter((r) => r.layout);
  const listed = regions.filter((r) => !r.layout);
  const active = regions.find((r) => r.id === activeRegionId);

  // S1h только в мире; наведение мышью важнее фокуса.
  const inWorld = !active;
  const shownId = inWorld ? (hoverId ?? focusId) : null;
  const shown = useMemo(() => regions.find((r) => r.id === shownId && r.layout), [regions, shownId]);
  const shownHeroes = useMemo(() => (shown ? heroesOf(shown.id) : []), [shown, heroesOf]);

  const getAnchor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !shown?.layout) return null;
    const rect = svg.getBoundingClientRect();
    const [x, y] = shown.layout.label;
    return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
  }, [shown]);

  const camera = useMemo<Camera>(() => {
    if (!active?.layout) return WORLD_CAMERA;
    const pos = active.places.find((p) => p.slug === activePlaceSlug)?.pos;
    return pos ? placeCamera(active.layout.camera, pos) : active.layout.camera;
  }, [active, activePlaceSlug]);

  useEffect(() => {
    const el = layerRef.current;
    const from = shownCamera.current;
    if (!el || from === camera) return;
    const toPlace = activePlaceSlug !== undefined || from.zoom > camera.zoom * 1.01;
    const animation = animateCamera(el, from, camera, toPlace ? DURATION.place : DURATION.region);
    shownCamera.current = camera;
    return () => animation?.cancel();
  }, [camera, activePlaceSlug]);

  const enter = (r: Region) => {
    setHoverId(r.id);
    void preloadRegionArt(r);
  };

  return (
    <div className={styles.stage}>
      {drawn.length > 0 && (
        <div className={styles.viewport}>
          <div ref={layerRef} className={styles.layer} style={{ transform: cameraTransform(camera) }}>
            <svg
              ref={svgRef}
              className={styles.svg}
              viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
              role="group"
              aria-label={t('world.map')}
            >
              <g>
                {drawn.map((r) => {
                  const isActive = r.id === activeRegionId;
                  return (
                    <polygon
                      key={r.id}
                      className={[styles.region, isActive && styles.active].filter(Boolean).join(' ')}
                      points={points(r.layout!.polygon)}
                      fill={biomeColor(r.biome)}
                      role="button"
                      tabIndex={0}
                      aria-label={l(r.name)}
                      aria-current={isActive ? 'true' : undefined}
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
              <g aria-hidden="true">
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
              {active?.places
                .filter((p) => p.pos)
                .map((p) => {
                  const [x, y] = toStage(p.pos!);
                  const isActive = p.slug === activePlaceSlug;
                  return (
                    <g
                      key={p.slug}
                      className={styles.marker}
                      role="button"
                      tabIndex={0}
                      aria-label={placeName(p, lang)}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => onSelectPlace(active.id, p.slug)}
                      onKeyDown={onActivate(() => onSelectPlace(active.id, p.slug))}
                    >
                      <circle cx={x} cy={y} r={isActive ? 7 : 5} />
                      <text x={x} y={y - 10} textAnchor="middle">
                        {placeName(p, lang)}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>
          <div className={styles.vignette} aria-hidden="true" />
          <Clouds clouds={EDGE_CLOUDS} mode="drift" hidden={!inWorld} />
        </div>
      )}
      {shown && <RegionTooltip id={tooltipId} region={shown} heroes={shownHeroes} getAnchor={getAnchor} />}
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
