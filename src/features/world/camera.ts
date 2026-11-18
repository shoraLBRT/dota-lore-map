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
}

/** Высота свёрнутой шторки — доля высоты кадра (SPEC §13: ~30 %). */
export const SHEET_PEEK = 0.3;
/** Высота развёрнутой шторки (SPEC §13: ~90 %). */
export const SHEET_FULL = 0.9;
/** Телефон: правая панель становится нижней шторкой (SPEC §13). */
export const MOBILE_QUERY = '(max-width: 767px)';

/** Камера места: ближе какой доли видимой части к её краю не встаёт выбранное место (#96). */
const PLACE_MARGIN = 0.2;
/** Пикселей арта по стороне мира с запасом на приближение: ближе картинка уже расплывается. */
export const ART_PIXELS = 4096 * 1.5;

export const UNMEASURED: View = { width: 0, height: 0, layerWidth: 0, layerHeight: 0, inset: 0 };

const measured = (view: View) => view.layerWidth > 0 && view.layerHeight > 0 && view.width > 0 && view.height > 0;

/**
 * Слой карты покрывает кадр (cover, #165): zoom 1 — мир во весь кадр без пустоты вокруг.
 * `containScale` — во сколько раз слой надо уменьшить, чтобы мир целиком вписался в кадр (≤ 1).
 */
export function containScale(view: View): number {
  return measured(view) ? Math.min(1, view.width / view.layerWidth, view.height / view.layerHeight) : 1;
}

/** Наибольшее приближение: 1 px экрана ≈ 1 px арта (с запасом ART_PIXELS), не меньше 2. */
export function maxZoom(view: View): number {
  return view.layerWidth > 0 ? Math.max(2, ART_PIXELS / view.layerWidth) : 8;
}

/**
 * Камера без пустоты за краем мира (#165): zoom в [1, maxZoom], а центр кадра — с учётом сдвигов `offset`/`offsetY`
 * (cameraTransform) — так, чтобы **видимая часть** кадра целиком лежала на картинке. Видимая часть — кадр без панели
 * справа (`view.inset`) и шторки снизу (`view.insetBottom`): под ними мир может кончиться, зато регион у края мира
 * встаёт в свободную часть, а не под панель (#112). Без измерений — как есть.
 */
export function clampCamera(camera: Camera, view: View, offset = 0, offsetY = 0): Camera {
  if (!measured(view)) return camera;
  const zoom = Math.min(Math.max(camera.zoom, 1), maxZoom(view));
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

/**
 * Камера с учётом панели: рамка региона (1/zoom мира, вписанного в кадр) должна поместиться в свободную часть кадра,
 * поэтому zoom уменьшается в (ширина − панель) / размер вписанного мира раз; больше задуманного не приближаем
 * (правило кадра — map/cameras.mjs, #112). Камера мира (zoom 1) — весь кадр.
 * `keep` — рамка региона и точка места (доли мира) у камеры места: центр сдвигается не дальше, чем нужно, чтобы регион
 * остался в видимой части кадра, а если не помещается — вылезал из неё как можно меньше, не уводя к краю само место (#96).
 * В конце камера прижимается к картинке (`clampCamera`): за краем мира пустоты нет.
 * Возвращает камеру и сдвиг центра для cameraTransform.
 */
export function frameCamera(
  camera: Camera,
  view: View,
  keep?: { box: WorldBox; place: Point },
): { camera: Camera; offset: number; offsetY?: number } {
  if (!measured(view)) return { camera, offset: 0 };
  const bottom = view.insetBottom ?? 0;
  const inset = Math.max(view.inset, 0);
  const contain = containScale(view);
  const fitted = view.layerWidth * contain;
  const free = inset > 0 ? Math.max(view.width - inset, fitted * 0.25) : view.width;
  const freeY = bottom > 0 ? Math.max(view.height - bottom, fitted * 0.25) : view.height;
  const zoom =
    camera.zoom <= 1
      ? 1
      : Math.max(1, camera.zoom * contain * Math.min(1, free / fitted, freeY / fitted));
  // Рамка региона держит центр так, чтобы за видимую часть (`size` — её доля мира) уходило не больше, чем нужно:
  // помещается — целиком в кадре; не помещается — вылезает поровну за оба края, но само место остаётся
  // не ближе PLACE_MARGIN видимой части к её краю (рядом с ним — подпись).
  const hold = (c: number, from: number, to: number, size: number, place: number) => {
    if (to - from <= size) return Math.min(Math.max(c, to - size / 2), from + size / 2);
    const even = Math.min(Math.max(c, from + size / 2), to - size / 2);
    const reach = size / 2 - size * PLACE_MARGIN;
    return Math.min(Math.max(even, place - reach), place + reach);
  };
  let { x, y } = camera;
  if (keep) {
    x = hold(x, keep.box.left, keep.box.right, free / (view.layerWidth * zoom), keep.place[0]);
    y = hold(y, keep.box.top, keep.box.bottom, freeY / (view.layerHeight * zoom), keep.place[1]);
  }
  const offset = inset / 2;
  const offsetY = bottom / 2;
  return {
    // Камера мира (#97) держит на картинке весь кадр, и под панелью — тоже арт; кадр региона — только видимую часть.
    camera: clampCamera({ x, y, zoom }, camera.zoom > 1 ? view : wholeFrame(view), offset, offsetY),
    offset,
    ...(bottom > 0 ? { offsetY } : {}),
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

/** Прямоугольник в px внутри кадра карты. */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Мир на телефоне со списком регионов (#39, SPEC §13): мир целиком (слой уменьшен до вписанного размера)
 * прижимается к верху кадра (ниже `top` — плашки героя), а список занимает пустое место под ним. Если кадр шире,
 * чем выше (телефон боком), карта прижимается влево, список — справа. Возвращает камеру мира и сдвиг для
 * cameraTransform, рамку карты и рамку списка. Без измерений (jsdom) — без сдвига, список на весь кадр.
 */
export function worldListLayout(
  view: View,
  top = 0,
): { camera: Camera; offset: number; offsetY: number; map: Rect; list: Rect } {
  const { width, height } = view;
  if (!measured(view)) {
    const box = { top: 0, left: 0, width, height };
    return { camera: WORLD_CAMERA, offset: 0, offsetY: 0, map: box, list: box };
  }
  const size = Math.min(width, height);
  const camera = { x: 0.5, y: 0.5, zoom: size / view.layerWidth };
  if (width > height) {
    // Карта у левого края: её центр левее центра кадра на половину свободной ширины.
    const freeX = width - size;
    return {
      camera,
      offset: freeX / 2,
      offsetY: 0,
      map: { top: 0, left: 0, width: size, height: size },
      list: { top: 0, left: size, width: freeX, height },
    };
  }
  const freeY = height - size;
  const mapTop = Math.min(Math.max(top, 0), freeY);
  return {
    camera,
    offset: 0,
    offsetY: freeY / 2 - mapTop,
    map: { top: mapTop, left: 0, width: size, height: size },
    list: { top: mapTop + size, left: 0, width, height: height - mapTop - size },
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
