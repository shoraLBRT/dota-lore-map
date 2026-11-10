// Форма src/data/world.generated.json (собирает scripts/build-data.mjs, формат входа — ARCHITECTURE A3).

export type Lang = 'ru' | 'en';
export type Localized = Record<Lang, string>;

export type Tier = 'upper' | 'continent' | 'abyss';
export type Side = 'radiant' | 'dire' | 'neutral';
export type Biome =
  | 'snow'
  | 'forest'
  | 'jungle'
  | 'desert'
  | 'mountains'
  | 'plains'
  | 'swamp'
  | 'sea'
  | 'islands'
  | 'volcanic'
  | 'city'
  | 'sky'
  | 'void'
  | 'hell'
  | 'fog';
export type AmbientType = 'snow' | 'ash' | 'embers' | 'fog' | 'rain' | 'sparkles' | 'stars' | 'leaves' | 'sand' | 'none';

/** Нормированная точка: x, y ∈ [0, 1] относительно картинки мира 16:10. */
export type Point = [number, number];

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface RegionLayout {
  polygon: Point[];
  label: Point;
  camera: Camera;
}

export interface Ambient {
  type: AmbientType;
  density?: number;
}

export interface Traits {
  rule?: Localized;
  magic?: Localized;
  biome?: Localized;
}

export interface PlaceText {
  name?: Localized;
  type?: Localized;
  description?: Localized;
}

export type Placement = 'lore' | 's1map' | 'ours';

export interface Place {
  /** Имя из research/e1/regions.json (английское, служит ключом). */
  name: string;
  slug: string;
  capital: boolean;
  placement: Placement;
  /** Заметка исследования (по-русски, для разработчиков). */
  note?: string;
  text?: PlaceText;
  pos?: Point;
}

export interface Region {
  id: string;
  tier: Tier;
  side: Side;
  name: Localized;
  /** Справка исследования о географии (по-русски). */
  geo: string;
  subtitle?: Localized;
  biome?: Biome;
  ambient?: Ambient;
  traits?: Traits;
  description?: Localized;
  layout?: RegionLayout;
  places: Place[];
  /** Герои, привязанные к региону целиком (без конкретного места). */
  regionHeroes: string[];
}

export type HeroRole = 'origin' | 'home' | 'link';
export type HeroBasis = 'infobox' | 'bio' | 'page' | 'ours';

export interface HeroLink {
  regionId: string;
  placeSlug?: string;
  role: HeroRole;
  basis: HeroBasis;
  note?: string;
}

export interface Hero {
  key: string;
  name: string;
  /** Для https://www.dota2.com/hero/<slug>. */
  slug: string;
  links: HeroLink[];
}

export interface World {
  aspect: number;
  bands?: { upper: [number, number]; abyss: [number, number] };
  regions: Region[];
  heroes: Hero[];
}
