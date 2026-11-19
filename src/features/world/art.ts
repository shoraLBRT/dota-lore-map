// Арт карты и его предзагрузка (SPEC §14, ARCHITECTURE A4, A10).
// Картинка мира — растровый арт 1:1 (#163, исходник — map/art/world.jpg, файлы — public/art/).
// Детальных картинок регионов пока нет: поле `layout.art` пустое, и их функции ничего не делают.

import type { Region } from '../../data/types';

const BASE = import.meta.env.BASE_URL;

/** Картинка мира целиком (S1, приближение региона). `undefined` — арта нет, карта — процедурная заглушка. */
export const WORLD_ART: string | undefined = `${BASE}art/world-4096.webp`;
/** Лёгкое превью мира: его ждёт кнопка «Начать», пока полная картинка догружается. */
export const WORLD_PREVIEW: string | undefined = `${BASE}art/world-1024.webp`;

/** Детальная картинка региона для приближения (A3). */
export function regionArt(region: Region): string | undefined {
  return region.layout?.art;
}

const loading = new Map<string, Promise<void>>();

/**
 * Загружает картинку в кэш браузера один раз на адрес.
 * Ошибка загрузки не ломает ожидание: промис всегда выполняется.
 */
export function preloadImage(url: string | undefined, priority?: 'low'): Promise<void> {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  let pending = loading.get(url);
  if (!pending) {
    pending = new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      if (priority) img.setAttribute('fetchpriority', priority);
      // Готово — когда картинка не только загружена, но и декодирована: иначе первый кадр с ней дёрнется (#187).
      img.onload = () => {
        if (typeof img.decode === 'function') img.decode().then(resolve, resolve);
        else resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
    loading.set(url, pending);
  }
  return pending;
}

/** Предзагрузка детальной картинки региона при наведении (SPEC §14). */
export function preloadRegionArt(region: Region): Promise<void> {
  return preloadImage(regionArt(region));
}

/** Сколько адресов уже запрошено — для тестов. */
export function preloadedCount(): number {
  return loading.size;
}
