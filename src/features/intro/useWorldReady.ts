import { useEffect, useState } from 'react';
import { preloadImage, WORLD_ART } from '../world/art';

// Готовность мира для кнопки «Начать» (SPEC §5.2): шрифты дизайн-системы и картинка мира.
// Данные мира собраны в бандл (world.generated.json) и готовы сразу.

/** Шрифты, без которых подписи карты «прыгнут» при появлении (ARCHITECTURE A8). */
export const WORLD_FONTS = ['700 1em "Cormorant SC"', '400 1em Manrope'];

/** Дольше не ждём: медленная сеть не должна запирать пользователя на интро. */
export const READY_TIMEOUT = 4000;

function fontsApi(): FontFaceSet | undefined {
  return typeof document !== 'undefined' && 'fonts' in document ? document.fonts : undefined;
}

/** Всё уже на месте — кнопку можно включить сразу, без мигания индикатора. */
export function worldReadyNow(): boolean {
  const fonts = fontsApi();
  const fontsReady = !fonts || WORLD_FONTS.every((f) => fonts.check(f));
  return fontsReady && !WORLD_ART;
}

/** Ждёт шрифты и картинку мира; никогда не отклоняется и не ждёт дольше READY_TIMEOUT. */
export function waitForWorld(timeout = READY_TIMEOUT): Promise<void> {
  const fonts = fontsApi();
  const tasks: Promise<unknown>[] = [preloadImage(WORLD_ART)];
  if (fonts) tasks.push(...WORLD_FONTS.map((f) => fonts.load(f)), fonts.ready);
  const all = Promise.all(tasks.map((p) => p.catch(() => undefined))).then(() => undefined);
  const limit = new Promise<void>((resolve) => setTimeout(resolve, timeout));
  return Promise.race([all, limit]);
}

export function useWorldReady(): boolean {
  const [ready, setReady] = useState(worldReadyNow);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void waitForWorld().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);
  return ready;
}
