// Камера карты (ARCHITECTURE A4): CSS transform на слое карты + Web Animations API.
// Слой карты имеет пропорции мира (`world.aspect`, SPEC §4: квадрат) и transform-origin: 0 0, поэтому
// нормированные координаты камеры напрямую переводятся в проценты размера слоя.
// Слой покрывает кадр (cover, #165): за краем мира пустоты нет, камеру можно тянуть и приближать (freeCamera.ts).
// Правая панель лежит поверх карты (ARCHITECTURE A4): камера региона и места кадрирует
// свободную часть кадра слева от панели — `frameCamera` и сдвиг `offset` в cameraTransform.

import { cssEasing } from '../../app/motion';
import type { Camera, Point } from '../../data/types';
import { world } from '../../data/world';

/** Ширина мира к высоте — из `map/layout.json` (SPEC §4). */
export const WORLD_ASPECT = world.aspect;
export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = Math.round(STAGE_WIDTH / WORLD_ASPECT);

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
  /** Размер слоя карты (пропорции мира) без камеры. */
  layerWidth: number;
  layerHeight: number;
  /** Сколько px справа закрывает панель. */
  inset: number;
  /** Сколько px снизу закрывает шторка панели на телефоне (SPEC §13). */
  insetBottom?: number;
  /** Пределы зума свободной камеры на этом уровне (#209, `zoomLevels`); нет — [1, maxZoom]. */
  zoomMin?: number;
  zoomMax?: number;
}

/** Высота шторки в среднем положении — доля высоты кадра (SPEC §13: половина экрана, #230). */
export const SHEET_PEEK = 0.5;
/** Высота развёрнутой шторки (SPEC §13): ~80 % — сверху остаются верхняя полоса и строка пути с «Мир» (#230). */
export const SHEET_FULL = 0.8;
/** Телефон: правая панель становится нижней шторкой (SPEC §13). */
export const MOBILE_QUERY = '(max-width: 767px)';

/** Пикселей арта по стороне мира с запасом на приближение: ближе картинка уже расплывается. */
export const ART_PIXELS = 4096 * 1.5;

// Потолки зума (#179, #209, SPEC §8.6, ARCHITECTURE A4) — во сколько раз ближе, чем «мир целиком» (zoom 1, слой покрывает кадр).
/** Предел любой камеры: ближе арт расплывается. */
export const FREE_ZOOM_MAX = 3;
/** Кадр региона: маленький регион не заполняет экран. */
export const REGION_ZOOM_MAX = 2.5;
/** Камера места — на ступень ближе кадра региона (и его потолка): ровно потолок свободной камеры региона (REGION_ZOOM_IN). */
export const PLACE_ZOOM = 1.15;
/** Кадр региона (#192, SPEC §8.6): габарит региона занимает эту долю свободной области по ведущей стороне (60–75 %). */
export const REGION_FILL = 0.7;
/** Уровни зума вложены (#209): потолок мира — эта доля медианы кадров регионов, мир не доходит до кадра региона. */
export const WORLD_SHARE = 0.93;
/** В регионе и месте свободная камера приближает не больше чем в столько раз от кадра региона. */
export const REGION_ZOOM_IN = 1.15;

export const UNMEASURED: View = { width: 0, height: 0, layerWidth: 0, layerHeight: 0, inset: 0 };

const measured = (view: View) => view.layerWidth > 0 && view.layerHeight > 0 && view.width > 0 && view.height > 0;

/**
 * Слой карты покрывает кадр (cover, #165): zoom 1 — мир во весь кадр без пустоты вокруг.
 * `containScale` — во сколько раз слой надо уменьшить, чтобы мир целиком вписался в кадр (≤ 1).
 */
export function containScale(view: View): number {
  return measured(view) ? Math.min(1, view.width / view.layerWidth, view.height / view.layerHeight) : 1;
}

/**
 * Наибольшее приближение: FREE_ZOOM_MAX, но не ближе, чем 1 px экрана ≈ 1 px арта (с запасом ART_PIXELS, не меньше 2),
 * и не ближе потолка уровня `view.zoomMax` (#209).
 */
export function maxZoom(view: View): number {
  const art = view.layerWidth > 0 ? Math.max(2, ART_PIXELS / view.layerWidth) : FREE_ZOOM_MAX;
  return Math.max(1, Math.min(FREE_ZOOM_MAX, art, view.zoomMax ?? Infinity));
}

/**
 * Камера без пустоты за краем мира (#165): zoom в [1, maxZoom], а центр кадра — с учётом сдвигов `offset`/`offsetY`
 * (cameraTransform) — так, чтобы **видимая часть** кадра целиком лежала на картинке. Видимая часть — кадр без панели
 * справа (`view.inset`) и шторки снизу (`view.insetBottom`): под ними мир может кончиться, зато регион у края мира
 * встаёт в свободную часть, а не под панель (#112). Без измерений — как есть.
 */
export function clampCamera(camera: Camera, view: View, offset = 0, offsetY = 0): Camera {
  if (!measured(view)) return camera;
  const top = maxZoom(view);
  const zoom = Math.min(Math.max(camera.zoom, 1, Math.min(view.zoomMin ?? 1, top)), top);
  const kx = view.layerWidth * zoom;
  const ky = view.layerHeight * zoom;
  // c — точка мира в центре всего кадра (size px); видимая часть — [0, seen] px от левого (верхнего) края.
  const fit = (c: number, size: number, seen: number, k: number) => {
    const before = size / 2 / k;
    const after = (seen - size / 2) / k;
    if (seen / k >= 1) return 0.5 + (before - after) / 2;
    return Math.min(Math.max(c, before), 1 - after);
  };
  const seenX = Math.max(view.width - Math.max(view.inset, 0), 1);
  const seenY = Math.max(view.height - Math.max(view.insetBottom ?? 0, 0), 1);
  const cx = fit(camera.x + offset / kx, view.width, seenX, kx);
  const cy = fit(camera.y + offsetY / ky, view.height, seenY, ky);
  return { x: cx - offset / kx, y: cy - offsetY / ky, zoom };
}

/** Кадр без панели и шторки: камера держит на картинке его целиком. */
export function wholeFrame(view: View): View {
  return { ...view, inset: 0, insetBottom: 0 };
}

const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
};

/**
 * Пределы свободной камеры по уровням (#209, SPEC §8.6): уровни вложены и не заходят друг на друга.
 * Мир — [1, WORLD_SHARE × медиана кадров регионов на этом кадре]; регион и место — от потолка мира (не дальше кадра
 * региона) до кадра региона × REGION_ZOOM_IN. `regions` — рамки регионов (`polygonBox`), `region` — открытого,
 * `stage` — кадр с панелью и шторкой региона: кадры считает `regionFrame`, как при перелёте.
 */
export function zoomLevels(regions: WorldBox[], stage: View, region?: WorldBox): { zoomMin: number; zoomMax: number } {
  if (!measured(stage) || regions.length === 0) return { zoomMin: 1, zoomMax: FREE_ZOOM_MAX };
  const world = Math.max(1, WORLD_SHARE * median(regions.map((b) => regionFrame(b, stage).camera.zoom)));
  if (!region) return { zoomMin: 1, zoomMax: world };
  const frame = regionFrame(region, stage).camera.zoom;
  return { zoomMin: Math.min(world, frame), zoomMax: frame * REGION_ZOOM_IN };
}

/** Свободная часть кадра (без панели и шторки), px; узкий кадр не ужимается меньше четверти вписанного мира. */
function freeArea(view: View): { free: number; freeY: number } {
  const fitted = view.layerWidth * containScale(view);
  const inset = Math.max(view.inset, 0);
  const bottom = view.insetBottom ?? 0;
  return {
    free: inset > 0 ? Math.max(view.width - inset, fitted * 0.25) : view.width,
    freeY: bottom > 0 ? Math.max(view.height - bottom, fitted * 0.25) : view.height,
  };
}

/** Сдвиги центра для cameraTransform: к середине свободной части кадра. */
function offsets(view: View): { offset: number; offsetY?: number } {
  const bottom = view.insetBottom ?? 0;
  return { offset: Math.max(view.inset, 0) / 2, ...(bottom > 0 ? { offsetY: bottom / 2 } : {}) };
}

/**
 * Кадр региона и места (#192, SPEC §8.6, ARCHITECTURE A4). Регион: центр — середина габарита `box`, zoom такой, чтобы
 * габарит занял REGION_FILL свободной области по ведущей стороне (вытянутый регион — по большей), в пределах
 * [1, REGION_ZOOM_MAX]. Место (`place`): камера встаёт точно на место (центр свободной области), на ступень ближе —
 * × PLACE_ZOOM. В конце камера прижимается к картинке (`clampCamera`) по видимой части кадра.
 */
export function regionFrame(box: WorldBox, view: View, place?: Point): { camera: Camera; offset: number; offsetY?: number } {
  const x = place ? place[0] : (box.left + box.right) / 2;
  const y = place ? place[1] : (box.top + box.bottom) / 2;
  if (!measured(view)) return { camera: { x, y, zoom: 1 }, offset: 0 };
  const { free, freeY } = freeArea(view);
  const w = Math.max((box.right - box.left) * view.layerWidth, 1);
  const h = Math.max((box.bottom - box.top) * view.layerHeight, 1);
  const zoom = Math.min(REGION_ZOOM_MAX, Math.max(1, REGION_FILL * Math.min(free / w, freeY / h)));
  const shift = offsets(view);
  return {
    camera: clampCamera({ x, y, zoom: place ? zoom * PLACE_ZOOM : zoom }, view, shift.offset, shift.offsetY ?? 0),
    ...shift,
  };
}

/**
 * Камера мира и камера по готовому `layout.camera` с учётом панели: рамка (1/zoom мира, вписанного в кадр) должна
 * поместиться в свободную часть кадра, поэтому zoom уменьшается в (ширина − панель) / размер вписанного мира раз;
 * не ближе REGION_ZOOM_MAX. Камера мира (zoom 1) — весь кадр. Кадр региона и места считает `regionFrame` (#192).
 * В конце камера прижимается к картинке (`clampCamera`): за краем мира пустоты нет.
 * Возвращает камеру и сдвиг центра для cameraTransform.
 */
export function frameCamera(camera: Camera, view: View): { camera: Camera; offset: number; offsetY?: number } {
  if (!measured(view)) return { camera, offset: 0 };
  const contain = containScale(view);
  const fitted = view.layerWidth * contain;
  const { free, freeY } = freeArea(view);
  const zoom =
    camera.zoom <= 1
      ? 1
      : Math.min(REGION_ZOOM_MAX, Math.max(1, camera.zoom * contain * Math.min(1, free / fitted, freeY / fitted)));
  const shift = offsets(view);
  return {
    // Камера мира (#97) держит на картинке весь кадр, и под панелью — тоже арт; кадр региона — только видимую часть.
    camera: clampCamera({ x: camera.x, y: camera.y, zoom }, camera.zoom > 1 ? view : wholeFrame(view), shift.offset, shift.offsetY ?? 0),
    ...shift,
  };
}

/** Прямоугольник в долях мира (0..1). */
export interface WorldBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Рамка многоугольника региона в долях мира. */
export function polygonBox(polygon: Point[]): WorldBox {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** Кадр места как ключ перелёта (A4, #192): камера встаёт на место и на ступень ближе региона; zoom считает `regionFrame`. */
export function placeCamera(region: Camera, pos: Point): Camera {
  return { x: pos[0], y: pos[1], zoom: region.zoom * PLACE_ZOOM };
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
    // Кривая перелёта — токен --ease-in-out, как у CSS-переходов карты (SPEC §7.5).
    easing: cssEasing('--ease-in-out', 'ease-in-out'),
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
