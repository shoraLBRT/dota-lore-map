// Арт карты и его предзагрузка (SPEC §14, ARCHITECTURE A4, A10).
// Картинка мира — процедурная карта `public/map/world-2560.webp` (`node map/render-art.mjs`, #110);
// не загрузилась — карта остаётся процедурной заглушкой (`biomes.ts`). Детальных картинок регионов
// пока нет (#111): без `layout.art` функции ниже безопасно ничего не делают.
// В юнит-тестах WORLD_ART подменён на `undefined` (src/test/setup.ts): jsdom картинки не грузит.

import type { Region } from '../../data/types';

/** Картинка мира целиком для интро и S1. `undefined` — арта нет, рисуется заглушка. */
export const WORLD_ART: string | undefined = `${import.meta.env.BASE_URL}map/world-2560.webp`;

/** Детальная картинка региона для приближения (A3). */
export function regionArt(region: Region): string | undefined {
  return region.layout?.art;
}

const loading = new Map<string, Promise<void>>();

/**
 * Загружает картинку в кэш браузера один раз на адрес.
 * Ошибка загрузки не ломает ожидание: промис всегда выполняется.
 */
export function preloadImage(url: string | undefined): Promise<void> {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  let pending = loading.get(url);
  if (!pending) {
    pending = new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve();
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
