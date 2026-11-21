import type { Camera } from '../../data/types';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';

/**
 * Экранный слой (#180, #231, ARCHITECTURE A4, A14): названия регионов и маркеры мест в своём SVG поверх слоя карты.
 * Слой камерой не масштабируется: смена масштаба предка заставляет Blink заново раскладывать и растеризовать
 * каждый текст под ним, а сдвиг группы — нет. Поэтому камера ставит каждую группу с якорем (`data-at="x y"`,
 * единицы сцены) в её точку на экране: `translate(X Y) scale(S)` в единицах SVG слоя при zoom 1.
 * - По умолчанию группа — в экранных px: `S = k · STAGE_WIDTH / ширина слоя`, `k` — `data-k` (1, если нет);
 *   масштаб не зависит от приближения, на кадре зума у группы меняется только сдвиг.
 * - `data-at-zoom` — группа в единицах сцены (растёт с приближением, как нарисованная): `S = zoom`.
 */
export interface AnchorFrame {
  camera: Camera;
  offset?: number;
  offsetY?: number;
  /** Ширина слоя карты при zoom 1, px; 0 — ещё не измерено. */
  layerWidth: number;
}

const num = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(3)));

/** Точка сцены `(x, y)` под камерой — в единицах SVG экранного слоя (тот же бокс, что у слоя карты при zoom 1). */
export function anchorPoint(frame: AnchorFrame, x: number, y: number): [number, number] {
  const { camera: c, offset = 0, offsetY = 0, layerWidth } = frame;
  const unit = layerWidth > 0 ? STAGE_WIDTH / layerWidth : 0;
  return [(0.5 - c.x * c.zoom) * STAGE_WIDTH - offset * unit + x * c.zoom, (0.5 - c.y * c.zoom) * STAGE_HEIGHT - offsetY * unit + y * c.zoom];
}

/** Обратное к `cameraTransform`: экранный слой во время перелёта — `cameraTransform(откуда) cameraInverse(куда)`. */
export function cameraInverse(frame: AnchorFrame): string {
  const { camera: c, offset = 0, offsetY = 0 } = frame;
  const tx = num((c.x * c.zoom - 0.5) * 100);
  const ty = num((c.y * c.zoom - 0.5) * 100);
  const plus = (pct: number, px: number) => (px ? `calc(${pct}% ${px > 0 ? '+' : '-'} ${num(Math.abs(px))}px)` : `${pct}%`);
  const x = plus(tx, offset);
  const y = plus(ty, offsetY);
  return `scale(${num(1 / c.zoom)}) translate(${x}, ${y})`;
}

/** Ставит группы с `data-at` внутри `root` в их точки под камерой. */
export function placeAnchors(root: Element | null, frame: AnchorFrame) {
  if (!root) return;
  const px = frame.layerWidth > 0 ? STAGE_WIDTH / frame.layerWidth : 1;
  for (const el of root.querySelectorAll('[data-at]')) {
    const at = el.getAttribute('data-at')!;
    const space = at.indexOf(' ');
    const [x, y] = anchorPoint(frame, Number(at.slice(0, space)), Number(at.slice(space + 1)));
    const k = el.hasAttribute('data-at-zoom') ? frame.camera.zoom : px * Number(el.getAttribute('data-k') ?? 1);
    const value = `translate(${num(x)} ${num(y)}) scale(${Number(k.toFixed(5))})`;
    // Тот же кадр DOM не трогает.
    if (el.getAttribute('transform') !== value) el.setAttribute('transform', value);
  }
}
