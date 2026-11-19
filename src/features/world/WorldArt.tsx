import { useEffect, useState, type RefObject, type SyntheticEvent } from 'react';
import { afterLoadIdle } from '../../app/idle';
import { preloadImage, WORLD_ART, WORLD_PREVIEW } from './art';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import styles from './WorldArt.module.css';
import { tileKey, tileUrl, visibleTiles, WORLD_TILES, type TilePyramid, type TileRef } from './tiles';

interface Props {
  /** Слой камеры (его transform двигает мир) и кадр — по ним считаются видимые тайлы. */
  layerRef?: RefObject<HTMLElement | null>;
  viewportRef?: RefObject<HTMLElement | null>;
  /** Пирамида тайлов; по умолчанию — из манифеста (`undefined` — тайлов нет). */
  tiles?: TilePyramid;
  /**
   * Мир под интро (#186): полная картинка не вставляется в DOM, а только греется в кэше — иначе, проявившись
   * под интро, она становится элементом LCP. В DOM она попадает, когда интро снято (после клика «Начать»).
   */
  deferFull?: boolean;
}

/** Страница загружена (`load`) и браузер свободен: тогда и только тогда просить полную картинку мира (#186). */
function usePageLoaded(): boolean {
  const [loaded, setLoaded] = useState(() => typeof document === 'undefined' || document.readyState === 'complete');
  useEffect(() => {
    if (!loaded) return afterLoadIdle(() => setLoaded(true));
  }, [loaded]);
  return loaded;
}

/** `fetchpriority` строчными: React 18 не знает свойства `fetchPriority`. */
const LOW_PRIORITY = { fetchpriority: 'low' } as Record<string, string>;

/**
 * Картинка мира под полигонами (ARCHITECTURE A10): сначала лёгкое превью (его ждёт интро),
 * поверх — полная картинка, которая проявится, когда догрузится и декодируется. При сильном приближении
 * поверх неё — видимые тайлы пирамиды (#164). Нет арта — ничего не рисуется.
 *
 * Арт — HTML `<img>` в своём композитном слое под SVG-оверлеем, а не `<image>` внутри SVG (#185):
 * перерисовка подписей и подсветки не перерастеризует картинку 4096², а `decode()` до показа
 * уводит декодирование с кадра. Полную картинку (800 КБ) просим только после `load` страницы и с низким
 * приоритетом (#186): она не держит первую отрисовку и событие `load`, интро хватает превью. Под интро
 * (`deferFull`) её только греем в кэше: в DOM она попадает после «Начать» и не становится элементом LCP.
 */
export function WorldArt({ layerRef, viewportRef, tiles = WORLD_TILES, deferFull = false }: Props) {
  const [ready, setReady] = useState(false);
  const pageLoaded = usePageLoaded();
  // Пока мир под интро — только кэш, без элемента в DOM (#186); вставленная картинка остаётся навсегда.
  const [inserted, setInserted] = useState(false);
  const showFull = inserted || (pageLoaded && !deferFull);
  useEffect(() => {
    if (showFull && !inserted) setInserted(true);
  }, [showFull, inserted]);
  useEffect(() => {
    if (pageLoaded && deferFull && !inserted) void preloadImage(WORLD_ART, 'low');
  }, [pageLoaded, deferFull, inserted]);
  if (!WORLD_ART) return null;
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const show = () => setReady(true);
    if (typeof img.decode === 'function') img.decode().then(show, show);
    else show();
  };
  return (
    <div aria-hidden="true" className={styles.art} data-world-art="">
      {WORLD_PREVIEW && <img src={WORLD_PREVIEW} alt="" className={styles.img} decoding="async" draggable={false} />}
      {showFull && (
        <img
          src={WORLD_ART}
          alt=""
          className={ready ? `${styles.img} ${styles.full} ${styles.loaded}` : `${styles.img} ${styles.full}`}
          decoding="async"
          draggable={false}
          {...LOW_PRIORITY}
          onLoad={onLoad}
          data-ready={ready ? '' : undefined}
        />
      )}
      {tiles && layerRef && viewportRef && (
        <svg className={styles.img} viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} preserveAspectRatio="none">
          <WorldTiles pyramid={tiles} layerRef={layerRef} viewportRef={viewportRef} />
        </svg>
      )}
    </div>
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
