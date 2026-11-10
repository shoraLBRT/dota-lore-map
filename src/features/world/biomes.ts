import type { Biome } from '../../data/types';

/** Заливка полигонов процедурной заглушки карты (ARCHITECTURE A4). Финальные цвета — E12. */
export const BIOME_COLORS: Record<Biome, string> = {
  snow: '#c9d6df',
  forest: '#3f6b3a',
  jungle: '#2f7a4c',
  desert: '#c9a35b',
  mountains: '#7d756b',
  plains: '#8fa35a',
  swamp: '#4f5e3c',
  sea: '#2d5878',
  islands: '#4f9a8c',
  volcanic: '#7a3326',
  city: '#8a7f73',
  sky: '#8fb4d9',
  void: '#3b2e57',
  hell: '#5c1a1a',
  fog: '#6f7782',
};

export const UNKNOWN_BIOME_COLOR = '#55585e';

export function biomeColor(biome: Biome | undefined): string {
  return biome ? BIOME_COLORS[biome] : UNKNOWN_BIOME_COLOR;
}
