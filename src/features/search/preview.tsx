import { createContext, useContext } from 'react';
import type { Hero } from '../../data/types';

// Нити при наведении на портрет героя в панели (SPEC §6.6): панель сообщает, над каким героем курсор или фокус.
const PreviewContext = createContext<(hero: Hero | null) => void>(() => undefined);

export const HeroPreviewProvider = PreviewContext.Provider;

/** Сообщить экрану, чей портрет под курсором (null — ничей). Без провайдера — ничего не делает. */
export function useHeroPreview(): (hero: Hero | null) => void {
  return useContext(PreviewContext);
}

// Профиль героя (E15, SPEC §6.8): нажатие на портрет в панели открывает его. Без провайдера портрет — ссылка на dota2.com.
const PickContext = createContext<((hero: Hero) => void) | undefined>(undefined);

export const HeroPickProvider = PickContext.Provider;

/** Открыть профиль героя, не двигая камеру; undefined — открывать некому (портрет остаётся ссылкой). */
export function useHeroPick(): ((hero: Hero) => void) | undefined {
  return useContext(PickContext);
}
