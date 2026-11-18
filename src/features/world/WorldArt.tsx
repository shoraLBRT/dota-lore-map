import { WORLD_ART, WORLD_PREVIEW } from './art';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';

/**
 * Картинка мира под полигонами (ARCHITECTURE A10): сначала лёгкое превью (его ждёт интро),
 * поверх — полная картинка, которая проявится, когда догрузится. Нет арта — ничего не рисуется.
 */
export function WorldArt() {
  if (!WORLD_ART) return null;
  const box = { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT, preserveAspectRatio: 'none' } as const;
  return (
    <g aria-hidden="true" pointerEvents="none" data-world-art="">
      {WORLD_PREVIEW && <image href={WORLD_PREVIEW} {...box} />}
      <image href={WORLD_ART} {...box} />
    </g>
  );
}
