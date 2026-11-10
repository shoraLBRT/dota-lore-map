import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import type { Camera, Point, Region } from '../../data/types';
import { placeName } from '../../data/world';
import { useT } from '../../i18n';
import { biomeColor } from './biomes';
import { animateCamera, cameraTransform, DURATION, placeCamera, STAGE_HEIGHT, STAGE_WIDTH, WORLD_CAMERA } from './camera';
import styles from './MapStage.module.css';

interface Props {
  regions: Region[];
  activeRegionId?: string;
  activePlaceSlug?: string;
  onSelectRegion: (regionId: string) => void;
  onSelectPlace: (regionId: string, placeSlug: string) => void;
}

const toStage = ([x, y]: Point): [number, number] => [x * STAGE_WIDTH, y * STAGE_HEIGHT];
const points = (polygon: Point[]) => polygon.map((p) => toStage(p).join(',')).join(' ');

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
 * Регионы без геометрии в map/layout.json показываются списком кнопок.
 */
export function MapStage({ regions, activeRegionId, activePlaceSlug, onSelectRegion, onSelectPlace }: Props) {
  const { l, lang, t } = useT();
  const layerRef = useRef<HTMLDivElement>(null);
  const shownCamera = useRef<Camera>(WORLD_CAMERA);

  const drawn = regions.filter((r) => r.layout);
  const listed = regions.filter((r) => !r.layout);
  const active = regions.find((r) => r.id === activeRegionId);

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

  return (
    <div className={styles.stage}>
      {drawn.length > 0 && (
        <div className={styles.viewport}>
          <div ref={layerRef} className={styles.layer} style={{ transform: cameraTransform(camera) }}>
            <svg
              className={styles.svg}
              viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
              role="group"
              aria-label={t('world.map')}
            >
              {drawn.map((r) => {
                const layout = r.layout!;
                const [lx, ly] = toStage(layout.label);
                const isActive = r.id === activeRegionId;
                return (
                  <g key={r.id} className={[styles[r.side], isActive && styles.active].filter(Boolean).join(' ')}>
                    <polygon
                      className={styles.region}
                      points={points(layout.polygon)}
                      fill={biomeColor(r.biome)}
                      role="button"
                      tabIndex={0}
                      aria-label={l(r.name)}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => onSelectRegion(r.id)}
                      onKeyDown={onActivate(() => onSelectRegion(r.id))}
                    />
                    <text className={styles.label} x={lx} y={ly} textAnchor="middle">
                      {l(r.name)}
                    </text>
                  </g>
                );
              })}
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
        </div>
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
