import { createContext, useContext } from 'react';
import type { Hero } from '../../data/types';

// Нити при наведении на портрет героя в панели (SPEC §6.6): панель сообщает, над каким героем курсор или фокус.
const PreviewContext = createContext<(hero: Hero | null) => void>(() => undefined);

export const HeroPreviewProvider = PreviewContext.Provider;

/** Сообщить экрану, чей портрет под курсором (null — ничей). Без провайдера — ничего не делает. */
export function useHeroPreview(): (hero: Hero | null) => void {
  return useContext(PreviewContext);
}
