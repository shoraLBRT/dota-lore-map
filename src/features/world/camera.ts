// Камера карты (ARCHITECTURE A4): CSS transform на слое карты + Web Animations API.
// Слой карты имеет соотношение сторон 16:10 и transform-origin: 0 0, поэтому
// нормированные координаты камеры напрямую переводятся в проценты размера слоя.
// Правая панель лежит поверх карты (ARCHITECTURE A4): камера региона и места кадрирует
// свободную часть кадра слева от панели — `frameCamera` и сдвиг `offset` в cameraTransform.

import type { Camera, Point } from '../../data/types';

export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 1000;

/** Весь мир в кадре. */
export const WORLD_CAMERA: Camera = { x: 0.5, y: 0.5, zoom: 1 };

/** Длительности переходов камеры, мс (SPEC §7.1: A3 1.0–1.4 с, A4 600–800 мс). */
export const DURATION = { region: 1200, place: 700 } as const;

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Transform, который ставит точку (x, y) в центр кадра с масштабом zoom.
 * `offset` (px) сдвигает центр влево — к середине части кадра, не закрытой панелью;
 * `offsetY` (px) — вверх (шторка, список регионов на телефоне), отрицательный — вниз.
 */
export function cameraTransform(camera: Camera, offset = 0, offsetY = 0): string {
  const tx = (0.5 - camera.x * camera.zoom) * 100;
  const ty = (0.5 - camera.y * camera.zoom) * 100;
  const x = offset > 0 ? `calc(${round(tx)}% - ${round(offset)}px)` : `${round(tx)}%`;
  const dy = round(offsetY);
  const y = dy !== 0 ? `calc(${round(ty)}% ${dy > 0 ? '-' : '+'} ${Math.abs(dy)}px)` : `${round(ty)}%`;
  return `translate(${x}, ${y}) scale(${round(camera.zoom)})`;
}

/** Размеры кадра карты, px. Нули — ещё не измерено (или jsdom). */
export interface View {
  /** Размер кадра (viewport). */
  width: number;
  height: number;
  /** Размер слоя карты 16:10 без камеры. */
  layerWidth: number;
  layerHeight: number;
  /** Сколько px справа закрывает панель. */
  inset: number;
  /** Сколько px снизу закрывает шторка панели на телефоне (SPEC §13). */
  insetBottom?: number;
}

/** Высота свёрнутой шторки — доля высоты кадра (SPEC §13: ~30 %). */
export const SHEET_PEEK = 0.3;
/** Высота развёрнутой шторки (SPEC §13: ~90 %). */
export const SHEET_FULL = 0.9;
/** Телефон: правая панель становится нижней шторкой (SPEC §13). */
export const MOBILE_QUERY = '(max-width: 767px)';

/** Сколько пустоты (доля мира) допускается за краем картинки при кадрировании под панель. */
const EDGE_MARGIN = 0.05;

export const UNMEASURED: View = { width: 0, height: 0, layerWidth: 0, layerHeight: 0, inset: 0 };

/**
 * Камера с учётом панели: рамка региона (1/zoom ширины мира) должна поместиться в свободную часть кадра,
 * поэтому zoom уменьшается в (ширина − панель) / ширина слоя раз; больше задуманного не приближаем.
 * Центр затем сдвигается к середине мира настолько, чтобы за краем картинки было как можно меньше пустоты;
 * рамка региона при этом остаётся в кадре. Возвращает камеру и сдвиг центра для cameraTransform.
 */
export function frameCamera(camera: Camera, view: View): { camera: Camera; offset: number; offsetY?: number } {
  const bottom = view.insetBottom ?? 0;
  if ((view.inset <= 0 && bottom <= 0) || view.layerWidth <= 0 || view.layerHeight <= 0) return { camera, offset: 0 };
  const free = view.inset > 0 ? Math.max(view.width - view.inset, view.layerWidth * 0.25) : view.width;
  // Шторка снизу: рамка региона (1/zoom высоты мира) должна поместиться над ней.
  const freeY = bottom > 0 ? Math.max(view.height - bottom, view.layerHeight * 0.25) : view.height;
  const zoom = camera.zoom * Math.min(1, free / view.layerWidth, freeY / view.layerHeight);
  // Видимая часть мира (в долях) по осям.
  const seenX = free / (view.layerWidth * zoom);
  const seenY = Math.max(freeY, view.layerHeight) / (view.layerHeight * zoom);
  // Центр — как можно ближе к задуманному, но так, чтобы край мира не уходил вглубь кадра дальше чем на EDGE_MARGIN
  // (небольшой запас нужен ярусам: их места у самого края картинки, подписи — над точками).
  const clamp = (c: number, seen: number) => {
    const lo = Math.min(seen / 2, 1 - seen / 2) - EDGE_MARGIN;
    const hi = Math.max(seen / 2, 1 - seen / 2) + EDGE_MARGIN;
    return Math.min(Math.max(c, lo), hi);
  };
  return {
    camera: { x: clamp(camera.x, seenX), y: clamp(camera.y, seenY), zoom },
    offset: Math.max(view.inset, 0) / 2,
    ...(bottom > 0 ? { offsetY: bottom / 2 } : {}),
  };
}

/** Прямоугольник в px внутри кадра карты. */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Мир на телефоне со списком регионов (#39, SPEC §13): карта целиком прижимается к верху кадра
 * (ниже `top` — плашки героя), а список занимает пустое место под ней. Если кадр шире, чем нужно карте
 * (телефон боком), карта прижимается влево, список — справа. Возвращает сдвиг камеры мира для cameraTransform,
 * рамку карты и рамку списка. Без измерений (jsdom) — без сдвига, список на весь кадр.
 */
export function worldListLayout(view: View, top = 0): { offset: number; offsetY: number; map: Rect; list: Rect } {
  const { width, height, layerWidth, layerHeight } = view;
  if (width <= 0 || height <= 0 || layerWidth <= 0 || layerHeight <= 0) {
    const box = { top: 0, left: 0, width, height };
    return { offset: 0, offsetY: 0, map: box, list: box };
  }
  const freeX = width - layerWidth;
  const freeY = height - layerHeight;
  if (freeX > freeY) {
    // Слой по центру кадра: сдвиг на половину свободной ширины ставит его к левому краю.
    return {
      offset: freeX / 2,
      offsetY: 0,
      map: { top: freeY / 2, left: 0, width: layerWidth, height: layerHeight },
      list: { top: 0, left: layerWidth, width: freeX, height },
    };
  }
  const mapTop = Math.min(Math.max(top, 0), freeY);
  return {
    offset: 0,
    offsetY: freeY / 2 - mapTop,
    map: { top: mapTop, left: freeX / 2, width: layerWidth, height: layerHeight },
    list: { top: mapTop + layerHeight, left: 0, width, height: height - mapTop - layerHeight },
  };
}

/** Камера места: лёгкий сдвиг от камеры региона к месту и небольшой дозум (A4). */
export function placeCamera(region: Camera, pos: Point): Camera {
  return {
    x: (region.x + pos[0]) / 2,
    y: (region.y + pos[1]) / 2,
    zoom: region.zoom * 1.15,
  };
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Плавно переводит слой карты из transform `from` в `target` (строки cameraTransform или текущая матрица).
 * При prefers-reduced-motion — без движения: кадр гаснет и проявляется уже на месте (SPEC §7.1: кроссфейд 200 мс,
 * длительность берётся из токена). Без поддержки WAAPI или с нулевой длительностью — мгновенно.
 */
export function animateCamera(el: HTMLElement, from: string, target: string, duration: number): Animation | null {
  if (typeof el.animate !== 'function' || duration <= 0) {
    el.style.transform = target;
    return null;
  }
  const keyframes: Keyframe[] = prefersReducedMotion()
    ? [
        { transform: from, opacity: 1 },
        { transform: from, opacity: 0, offset: 0.5 },
        { transform: target, opacity: 0, offset: 0.5 },
        { transform: target, opacity: 1 },
      ]
    : [{ transform: from }, { transform: target }];
  const animation = el.animate(keyframes, {
    duration,
    easing: 'ease-in-out',
    fill: 'forwards',
  });
  animation.finished
    .then(() => {
      el.style.transform = target;
      animation.cancel();
    })
    .catch(() => {
      // Анимацию отменили (началась следующая) — ничего не делаем.
    });
  return animation;
}
