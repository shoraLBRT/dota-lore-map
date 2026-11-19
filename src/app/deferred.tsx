import { createElement, lazy, Suspense, type ComponentType } from 'react';
import { afterLoadIdle } from './idle';

// Отложенные части бандла (#186, ARCHITECTURE A14): галерея, профиль героя и поиск не нужны первому экрану.
// Их куски грузятся в простое после `load` (`prefetchDeferred`), так что к первому клику они уже на месте;
// загруженный модуль рисуется сразу, без Suspense.

interface Deferred<P> {
  (props: P): JSX.Element;
  preload: () => Promise<unknown>;
}

function deferred<M, P extends object>(load: () => Promise<M>, pick: (m: M) => ComponentType<P>): Deferred<P> {
  let mod: M | undefined;
  let pending: Promise<M> | undefined;
  const preload = () =>
    (pending ??= load().then(
      (m) => (mod = m),
      (e: unknown) => {
        pending = undefined; // сеть моргнула — следующая попытка загрузит заново
        throw e;
      },
    ));
  const Lazy = lazy(() => preload().then((m) => ({ default: pick(m) })));
  const Component = (props: P) =>
    mod ? createElement(pick(mod), props) : createElement(Suspense, { fallback: null }, createElement(Lazy as unknown as ComponentType<P>, props));
  Component.preload = preload;
  return Component;
}

export const Gallery = deferred(
  () => import('../features/gallery/Gallery'),
  (m) => m.Gallery,
);
export const HeroProfile = deferred(
  () => import('../features/hero/HeroProfile'),
  (m) => m.HeroProfile,
);
export const HeroSearch = deferred(
  () => import('../features/search/HeroSearch'),
  (m) => m.HeroSearch,
);


/** Загрузить все отложенные части; ошибки сети не важны — компонент попробует ещё раз при показе. */
export function preloadDeferred(): Promise<void> {
  return Promise.all([Gallery, HeroProfile, HeroSearch].map((c) => c.preload().catch(() => undefined))).then(() => undefined);
}

/** Загрузить отложенные части в простое после `load` страницы; возвращает отмену. */
export function prefetchDeferred(): () => void {
  return afterLoadIdle(() => void preloadDeferred(), 2000, 500);
}
