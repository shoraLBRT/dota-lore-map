// Форма src/data/world.generated.json (собирает scripts/build-data.mjs, формат входа — ARCHITECTURE A3).

export type Lang = 'ru' | 'en';
export type Localized = Record<Lang, string>;

export type Tier = 'upper' | 'continent' | 'abyss';
export type Side = 'radiant' | 'dire' | 'neutral';
export type SideBasis = 's1map' | 'position' | 'tier';
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
  /** Детальная картинка региона (появится с артом E2; ARCHITECTURE A10). */
  art?: string;
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
  /** id из World.media, ≤ 3 (SPEC §10). Нет медиа — поля нет. */
  media?: string[];
  pos?: Point;
  /** Шапка-картинка панели места (SPEC §5.5 п. 1), появится с артом. */
  art?: string;
}

export type MediaType = 'image' | 'youtube';

/** Медиа для галереи (SPEC §5.6, §10); источник — content/media.json (ARCHITECTURE A3). */
export interface Media {
  id: string;
  type: MediaType;
  /** Картинка: https-ссылка на официальный источник или путь к ассету. Только у type = image. */
  src?: string | Localized;
  /** Видео: id ролика YouTube, встраивается через youtube-nocookie.com. Только у type = youtube. */
  youtubeId?: string;
  /** Картинка — одна страница комикса; целиком он по sourceUrl (галерея показывает метку «отрывок»). */
  excerpt?: boolean;
  title: Localized;
  /** Тип для подзаголовка: «Комикс», «Синематик», «Арт». */
  subtitle: Localized;
  description?: Localized;
  /** Правообладатель (SPEC §15). */
  credit: string;
  /** Страница источника ↗. */
  sourceUrl: string;
}

export interface Region {
  id: string;
  tier: Tier;
  side: Side;
  /** Откуда взята сторона: s1map — карта Source 1, position — положение на схеме E2, tier — ярус. */
  sideBasis?: SideBasis;
  name: Localized;
  /** Справка исследования о географии (по-русски). */
  geo: string;
  subtitle?: Localized;
  biome?: Biome;
  ambient?: Ambient;
  traits?: Traits;
  description?: Localized;
  /** id из World.media для региона в целом, ≤ 3 (SPEC §10). Нет медиа — поля нет. */
  media?: string[];
  /** Ссылка «Подробнее ↗» на внешний источник (SPEC §5.4 п. 6), из content/regions. */
  moreLink?: string;
  layout?: RegionLayout;
  places: Place[];
  /** Герои, привязанные к региону целиком (без конкретного места). */
  regionHeroes: string[];
}

/** Тип события связи герой–место (модель связей E14, ARCHITECTURE A3). `link` — из E1, тип не уточнён. */
export type HeroEvent =
  | 'origin'
  | 'home'
  | 'journey'
  | 'battle'
  | 'service'
  | 'exile'
  | 'death'
  | 'visit'
  | 'mention'
  | 'link';

/** Откуда запись: официальная биография, Liquipedia, официальный комикс (`comic:<id медиа>`) или наше решение. */
export type HeroSource = 'bio' | 'liquipedia' | 'ours' | `comic:${string}`;
/** Где на Liquipedia: инфобокс лор-страницы героя, текст лор-страницы, страница места. */
export type LiquipediaVia = 'infobox' | 'lore' | 'place';

/** Источник записи модели связей. */
export interface Sourced {
  source: HeroSource;
  /** Только у `source: 'liquipedia'`. */
  via?: LiquipediaVia;
  url?: string;
  /** Заметка исследования (по-русски, для разработчиков). */
  note?: string;
  /** Что под сомнением и почему (по-русски); нет поля — запись подтверждена источником. */
  doubt?: string;
}

/** Место героя: конкретное место или регион целиком. */
export interface SpotRef {
  regionId: string;
  placeSlug?: string;
}

export interface HeroLink extends SpotRef, Sourced {
  event: HeroEvent;
}

/** Кем другой герой приходится этому. */
export type RelationType =
  | 'ally'
  | 'enemy'
  | 'rival'
  | 'family'
  | 'love'
  | 'mentor'
  | 'student'
  | 'master'
  | 'servant';

export interface HeroRelation extends Partial<SpotRef>, Sourced {
  /** key другого героя. */
  hero: string;
  type: RelationType;
}

export interface HeroProfile {
  /** Короткое описание своими словами (E15). */
  summary?: Localized;
  /** Официальные арты Valve по ссылке (A6). */
  art?: string[];
}

export interface Hero {
  key: string;
  name: string;
  /** Для https://www.dota2.com/hero/<slug>. */
  slug: string;
  /** Алиасы для поиска (SPEC §6.5): кириллица, сокращения, прозвища, личные имена. Нет — поле отсутствует. */
  aliases?: string[];
  /** Места героя по порядку (по нему идут места в плашке и нити, A11). */
  links: HeroLink[];
  /** Путь героя: остановки по порядку, стрелка — от остановки к следующей. Каждая остановка есть в links. */
  path?: SpotRef[];
  relations?: HeroRelation[];
  profile?: HeroProfile;
}

export interface World {
  aspect: number;
  bands?: { upper: [number, number]; abyss: [number, number] };
  regions: Region[];
  heroes: Hero[];
  /** Все медиа; регионы и места ссылаются на них по id. Нет медиа — поля нет. */
  media?: Media[];
}
