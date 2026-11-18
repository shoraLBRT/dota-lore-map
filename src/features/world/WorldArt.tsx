import { useEffect, useState, type RefObject } from 'react';
import { WORLD_ART, WORLD_PREVIEW } from './art';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import styles from './WorldArt.module.css';
import { tileKey, tileUrl, visibleTiles, WORLD_TILES, type TilePyramid, type TileRef } from './tiles';

interface Props {
  /** Слой камеры (его transform двигает мир) и кадр — по ним считаются видимые тайлы. */
  layerRef?: RefObject<HTMLElement | null>;
  viewportRef?: RefObject<HTMLElement | null>;
  /** Пирамида тайлов; по умолчанию — из манифеста (`undefined` — тайлов нет). */
  tiles?: TilePyramid;
}

/**
 * Картинка мира под полигонами (ARCHITECTURE A10): сначала лёгкое превью (его ждёт интро),
 * поверх — полная картинка, которая проявится, когда догрузится. При сильном приближении поверх неё —
 * видимые тайлы пирамиды (#164). Нет арта — ничего не рисуется.
 */
export function WorldArt({ layerRef, viewportRef, tiles = WORLD_TILES }: Props) {
  if (!WORLD_ART) return null;
  const box = { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT, preserveAspectRatio: 'none' } as const;
  return (
    <g aria-hidden="true" pointerEvents="none" data-world-art="">
      {WORLD_PREVIEW && <image href={WORLD_PREVIEW} {...box} />}
      <image href={WORLD_ART} {...box} />
      {tiles && layerRef && viewportRef && <WorldTiles pyramid={tiles} layerRef={layerRef} viewportRef={viewportRef} />}
    </g>
  );
}

/** Как часто сверять видимые тайлы с камерой, мс: камера двигается transform/WAAPI, без событий React. */
const POLL_MS = 150;

function useVisibleTiles(pyramid: TilePyramid, layerRef: RefObject<HTMLElement | null>, viewportRef: RefObject<HTMLElement | null>) {
  const [tiles, setTiles] = useState<TileRef[]>([]);
  useEffect(() => {
    let key = '';
    const check = () => {
      const layer = layerRef.current;
      const frame = viewportRef.current;
      if (!layer || !frame) return;
      const next = visibleTiles(pyramid, layer.getBoundingClientRect(), frame.getBoundingClientRect(), window.devicePixelRatio || 1);
      const nextKey = next.map(tileKey).join(',');
      if (nextKey !== key) {
        key = nextKey;
        setTiles(next);
      }
    };
    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [pyramid, layerRef, viewportRef]);
  return tiles;
}

/** Тайлы пирамиды: каждый проявляется, когда загружен; ушедшие из кадра снимаются (браузер их кэширует). */
function WorldTiles({ pyramid, layerRef, viewportRef }: { pyramid: TilePyramid; layerRef: RefObject<HTMLElement | null>; viewportRef: RefObject<HTMLElement | null> }) {
  const tiles = useVisibleTiles(pyramid, layerRef, viewportRef);
  return (
    <g data-world-tiles="">
      {tiles.map((t) => (
        <Tile key={tileKey(t)} tile={t} />
      ))}
    </g>
  );
}

function Tile({ tile }: { tile: TileRef }) {
  const [loaded, setLoaded] = useState(false);
  const side = STAGE_WIDTH / 2 ** tile.z;
  const sideY = STAGE_HEIGHT / 2 ** tile.z;
  return (
    <image
      href={tileUrl(tile)}
      x={tile.x * side}
      y={tile.y * sideY}
      width={side}
      height={sideY}
      preserveAspectRatio="none"
      className={loaded ? `${styles.tile} ${styles.loaded}` : styles.tile}
      onLoad={() => setLoaded(true)}
    />
  );
}
