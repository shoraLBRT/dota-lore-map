import { useEffect, useState } from 'react';
import type { Region } from '../../data/types';
import { preloadImage, regionArt } from './art';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import styles from './MapStage.module.css';

/**
 * Детальная картинка региона поверх общей (SPEC §7.1 A3, ARCHITECTURE A10): SVG `<image>` под маркерами,
 * покрывает рамку `layout.camera` и проявляется кроссфейдом, когда загружена и камера долетела.
 * Нет арта — ничего не рисует.
 */
export function RegionArt({ region }: { region: Region }) {
  const url = regionArt(region);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    void preloadImage(url).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [url]);

  const camera = region.layout?.camera;
  if (!url || !ready || !camera) return null;
  const w = STAGE_WIDTH / camera.zoom;
  const h = STAGE_HEIGHT / camera.zoom;
  return (
    <image
      className={styles.art}
      href={url}
      x={camera.x * STAGE_WIDTH - w / 2}
      y={camera.y * STAGE_HEIGHT - h / 2}
      width={w}
      height={h}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-testid="region-art"
    />
  );
}
