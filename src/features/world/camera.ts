// Камера карты (ARCHITECTURE A4): CSS transform на слое карты + Web Animations API.
// Слой карты имеет соотношение сторон 16:10 и transform-origin: 0 0, поэтому
// нормированные координаты камеры напрямую переводятся в проценты размера слоя.
// Детали анимаций (очередь кликов, кроссфейды, §7.1) — задача E4.

import type { Camera, Point } from '../../data/types';

export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 1000;

/** Весь мир в кадре. */
export const WORLD_CAMERA: Camera = { x: 0.5, y: 0.5, zoom: 1 };

/** Длительности переходов камеры, мс (SPEC §7.1: A3 1.0–1.4 с, A4 600–800 мс). */
export const DURATION = { region: 1200, place: 700 } as const;

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Transform, который ставит точку (x, y) в центр кадра с масштабом zoom. */
export function cameraTransform(camera: Camera): string {
  const tx = (0.5 - camera.x * camera.zoom) * 100;
  const ty = (0.5 - camera.y * camera.zoom) * 100;
  return `translate(${round(tx)}%, ${round(ty)}%) scale(${round(camera.zoom)})`;
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
 * Плавно переводит слой карты из камеры `from` в камеру `to`.
 * Без поддержки WAAPI или при prefers-reduced-motion — мгновенно.
 */
export function animateCamera(el: HTMLElement, from: Camera, to: Camera, duration: number): Animation | null {
  const target = cameraTransform(to);
  if (typeof el.animate !== 'function' || duration <= 0 || prefersReducedMotion()) {
    el.style.transform = target;
    return null;
  }
  const animation = el.animate([{ transform: cameraTransform(from) }, { transform: target }], {
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
