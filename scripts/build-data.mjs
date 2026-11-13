// Сборка данных: research/e1 + content/regions + content/media.json + map/layout.json → src/data/world.generated.json.
// Формат входа и правила — docs/ARCHITECTURE.md §A3. Без зависимостей, Node 22.
//
//   node scripts/build-data.mjs            собрать и записать
//   node scripts/build-data.mjs --root DIR  взять файлы из другого корня (для тестов)
//
// Ошибка (exit 1) — ссылка на несуществующий регион, место, героя или медиа и неверный формат.
// Предупреждение (без exit 1) — один алиас у нескольких героев, медиа ни к чему не привязано.
// Отсутствующий контент или позиция на карте — не ошибка.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const OUTPUT = 'src/data/world.generated.json';
export const ASPECT = 1.6;

export const BIOMES = [
  'snow', 'forest', 'jungle', 'desert', 'mountains', 'plains', 'swamp', 'sea',
  'islands', 'volcanic', 'city', 'sky', 'void', 'hell', 'fog',
];
export const AMBIENTS = ['snow', 'ash', 'embers', 'fog', 'rain', 'sparkles', 'stars', 'leaves', 'sand', 'none'];
export const TRAITS = ['rule', 'magic', 'biome'];
const PLACE_TEXT = ['name', 'type', 'description'];
const PLACE_KEYS = [...PLACE_TEXT, 'media'];
export const MEDIA_TYPES = ['image', 'youtube'];
export const MAX_MEDIA = 3;
const MEDIA_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const isHttps = (v) => typeof v === 'string' && /^https:\/\/[^\s/]+\.[^\s]+$/.test(v);
/** src картинки: https-ссылка или относительный путь без схемы (ARCHITECTURE A3). */
const isMediaSrc = (v) => isHttps(v) || (isNonEmptyString(v) && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(v) && !/\s/.test(v));
// Модель связей героя (E14, ARCHITECTURE A3). Те же правила проверяет research/e1/build.py.
export const EVENTS = ['origin', 'home', 'journey', 'battle', 'service', 'exile', 'death', 'visit', 'mention', 'link'];
/** Кем другой герой приходится этому → обратный тип. */
export const RELATIONS = {
  ally: 'ally',
  enemy: 'enemy',
  rival: 'rival',
  family: 'family',
  love: 'love',
  mentor: 'student',
  student: 'mentor',
  master: 'servant',
  servant: 'master',
};
const SOURCES = ['bio', 'liquipedia', 'ours'];
const VIA = ['infobox', 'lore', 'place'];
const LINK_KEYS = ['place', 'region', 'event', 'source', 'via', 'url', 'note', 'doubt'];
const RELATION_KEYS = ['hero', 'type', 'place', 'region', 'source', 'via', 'url', 'note', 'doubt'];
const ENTRY_KEYS = ['links', 'path', 'relations', 'profile'];
export const SUMMARY_MAX = 500;
/** Арты профиля — только официальные ссылки Valve (A6). */
const VALVE_ART = /^https:\/\/(www\.dota2\.com|([a-z0-9-]+\.)*steamstatic\.com|steamcdn-a\.akamaihd\.net)\/\S+$/;
const LIQUIPEDIA_URL = /^https:\/\/liquipedia\.net\/dota2\/\S+$/;

/** Имя места → slug в kebab-case (ARCHITECTURE A5): "Tomo'kan" → "tomokan". */
export function placeSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Имя героя → slug для dota2.com (ARCHITECTURE A6): "Nature's Prophet" → "naturesprophet". */
export function heroSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Ключ сравнения алиасов: регистр, ё/е и лишние пробелы не важны (ARCHITECTURE A3). */
export function normalizeAlias(s) {
  return s.toLowerCase().replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isUnit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isPoint = (v) => Array.isArray(v) && v.length === 2 && v.every(isUnit);

const CYRILLIC = /[А-Яа-яЁё]/;

function localized(value, where, errors) {
  if (!isObject(value) || !isNonEmptyString(value.ru) || !isNonEmptyString(value.en)) {
    errors.push(`${where}: нужен объект { ru, en } с непустыми строками`);
    return undefined;
  }
  // Кириллица в английском тексте — почти наверняка забытый перевод (SPEC §12).
  if (CYRILLIC.test(value.en)) {
    errors.push(`${where}: в en кириллица — текст не переведён?`);
    return undefined;
  }
  return { ru: value.ru, en: value.en };
}

function point(value, where, errors) {
  if (!isPoint(value)) {
    errors.push(`${where}: нужна точка [x, y] с координатами в [0, 1]`);
    return undefined;
  }
  return [value[0], value[1]];
}

/** Убирает ключи со значением undefined, сохраняя порядок остальных. */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function buildContent(file, data, regionById, errors) {
  const where = file;
  if (!isObject(data)) {
    errors.push(`${where}: ожидается объект`);
    return null;
  }
  const region = regionById.get(data.id);
  if (!region) {
    errors.push(`${where}: неизвестный регион "${data.id}"`);
    return null;
  }
  if (basename(file, '.json') !== data.id) {
    errors.push(`${where}: имя файла должно совпадать с id "${data.id}"`);
  }

  const out = { id: data.id };
  if (data.subtitle !== undefined) out.subtitle = localized(data.subtitle, `${where}: subtitle`, errors);
  if (data.biome !== undefined) {
    if (BIOMES.includes(data.biome)) out.biome = data.biome;
    else errors.push(`${where}: неизвестный biome "${data.biome}"`);
  }
  if (data.ambient !== undefined) {
    const a = data.ambient;
    if (!isObject(a) || !AMBIENTS.includes(a.type) || (a.density !== undefined && !isUnit(a.density))) {
      errors.push(`${where}: ambient — нужен { type: ${AMBIENTS.join('|')}, density: 0..1 }`);
    } else {
      out.ambient = compact({ type: a.type, density: a.density });
    }
  }
  if (data.traits !== undefined) {
    if (!isObject(data.traits)) {
      errors.push(`${where}: traits — ожидается объект`);
    } else {
      for (const key of Object.keys(data.traits)) {
        if (!TRAITS.includes(key)) errors.push(`${where}: traits — неизвестный ключ "${key}"`);
      }
      out.traits = compact(
        Object.fromEntries(
          TRAITS.filter((k) => data.traits[k] !== undefined).map((k) => [
            k,
            localized(data.traits[k], `${where}: traits.${k}`, errors),
          ]),
        ),
      );
    }
  }
  if (data.description !== undefined) {
    out.description = localized(data.description, `${where}: description`, errors);
  }
  if (data.media !== undefined) out.media = mediaRefs(data.media, `${where}: media`, errors);
  if (data.moreLink !== undefined) {
    if (typeof data.moreLink === 'string' && /^https:\/\/\S+$/.test(data.moreLink)) out.moreLink = data.moreLink;
    else errors.push(`${where}: moreLink — нужна ссылка https://…`);
  }

  out.places = new Map();
  if (data.places !== undefined) {
    if (!isObject(data.places)) {
      errors.push(`${where}: places — ожидается объект`);
    } else {
      const names = new Set(region.locations.map((l) => l.name));
      for (const [name, text] of Object.entries(data.places)) {
        if (!names.has(name)) {
          errors.push(`${where}: место "${name}" не найдено в регионе ${region.id}`);
          continue;
        }
        if (!isObject(text)) {
          errors.push(`${where}: places["${name}"] — ожидается объект`);
          continue;
        }
        for (const key of Object.keys(text)) {
          if (!PLACE_KEYS.includes(key)) errors.push(`${where}: places["${name}"] — неизвестный ключ "${key}"`);
        }
        const t = compact(
          Object.fromEntries(
            PLACE_TEXT.filter((k) => text[k] !== undefined).map((k) => [
              k,
              localized(text[k], `${where}: places["${name}"].${k}`, errors),
            ]),
          ),
        );
        const media = text.media !== undefined ? mediaRefs(text.media, `${where}: places["${name}"].media`, errors) : undefined;
        if (Object.keys(t).length > 0 || media) out.places.set(name, { text: Object.keys(t).length > 0 ? t : undefined, media });
      }
    }
  }
  return out;
}

/** Список ссылок на медиа у региона или места: ≤ MAX_MEDIA разных id (SPEC §10). */
function mediaRefs(value, where, errors) {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    errors.push(`${where}: ожидается список id медиа`);
    return undefined;
  }
  if (value.length > MAX_MEDIA) errors.push(`${where}: больше ${MAX_MEDIA} медиа (${value.length})`);
  const seen = new Set();
  for (const id of value) {
    if (seen.has(id)) errors.push(`${where}: медиа "${id}" повторяется`);
    seen.add(id);
  }
  return value.length > 0 ? [...value] : undefined;
}

const MEDIA_KEYS = ['id', 'type', 'src', 'youtubeId', 'excerpt', 'title', 'subtitle', 'description', 'credit', 'sourceUrl'];

/** content/media.json → Map id → медиа (формат — ARCHITECTURE A3). */
function buildMedia(media, errors) {
  const where = 'content/media.json';
  const out = new Map();
  const ids = new Set();
  if (media === undefined) return { byId: out, ids };
  if (!isObject(media) || !Array.isArray(media.media)) {
    errors.push(`${where}: ожидается { media: [ ... ] }`);
    return { byId: out, ids };
  }
  media.media.forEach((m, i) => {
    const w = `${where}: media[${i}]${isObject(m) && isNonEmptyString(m.id) ? ` "${m.id}"` : ''}`;
    if (!isObject(m)) {
      errors.push(`${w}: ожидается объект`);
      return;
    }
    const before = errors.length;
    for (const key of Object.keys(m)) {
      if (!MEDIA_KEYS.includes(key)) errors.push(`${w}: неизвестный ключ "${key}"`);
    }
    if (!isNonEmptyString(m.id) || !MEDIA_ID.test(m.id)) errors.push(`${w}: id — нужна строка в kebab-case`);
    else if (ids.has(m.id)) errors.push(`${w}: id повторяется`);
    else ids.add(m.id);
    if (!MEDIA_TYPES.includes(m.type)) errors.push(`${w}: type — ${MEDIA_TYPES.join(' | ')}`);
    if (m.src === undefined && m.youtubeId === undefined) {
      errors.push(`${w}: нет ни src, ни youtubeId`);
    } else if (m.type === 'image') {
      if (m.youtubeId !== undefined) errors.push(`${w}: у картинки не должно быть youtubeId`);
      // src — строка или { ru, en }, если у картинки есть версии на двух языках (страницы комиксов).
      const srcs = m.src !== null && typeof m.src === 'object' ? [m.src.ru, m.src.en] : [m.src];
      if (typeof m.src === 'object' && m.src !== null && Object.keys(m.src).some((k) => k !== 'ru' && k !== 'en')) {
        errors.push(`${w}: src — в объекте только ключи ru и en`);
      }
      if (!srcs.every(isMediaSrc)) errors.push(`${w}: src — https-ссылка или относительный путь (http:// нельзя), строкой или { ru, en }`);
    } else if (m.type === 'youtube') {
      if (m.src !== undefined) errors.push(`${w}: у видео не должно быть src, только youtubeId`);
      if (!isNonEmptyString(m.youtubeId) || !YOUTUBE_ID.test(m.youtubeId)) errors.push(`${w}: youtubeId — 11 символов [A-Za-z0-9_-]`);
    }
    // excerpt: в галерее одна страница комикса, целиком — по sourceUrl (решение владельца в #7).
    if (m.excerpt !== undefined && m.excerpt !== true) errors.push(`${w}: excerpt — только true или поля нет`);
    if (m.excerpt === true && m.type !== 'image') errors.push(`${w}: excerpt бывает только у картинки`);
    const title = localized(m.title, `${w}: title`, errors);
    const subtitle = localized(m.subtitle, `${w}: subtitle`, errors);
    const description = m.description !== undefined ? localized(m.description, `${w}: description`, errors) : undefined;
    if (!isNonEmptyString(m.credit)) errors.push(`${w}: credit — нужен правообладатель (SPEC §15)`);
    if (!isHttps(m.sourceUrl)) errors.push(`${w}: sourceUrl — нужна https-ссылка на источник (SPEC §15)`);
    if (errors.length !== before) return;
    out.set(
      m.id,
      compact({
        id: m.id,
        type: m.type,
        src: m.src,
        youtubeId: m.youtubeId,
        excerpt: m.excerpt,
        title,
        subtitle,
        description,
        credit: m.credit,
        sourceUrl: m.sourceUrl,
      }),
    );
  });
  return { byId: out, ids };
}

function buildLayout(layout, regionById, placeRegion, errors) {
  const where = 'map/layout.json';
  const out = { regions: new Map(), places: new Map(), bands: undefined };
  if (!isObject(layout)) {
    errors.push(`${where}: ожидается объект`);
    return out;
  }
  if (layout.aspect !== undefined && layout.aspect !== ASPECT) {
    errors.push(`${where}: aspect должен быть ${ASPECT}`);
  }
  if (layout.bands !== undefined) {
    const b = layout.bands;
    const band = (v) => Array.isArray(v) && v.length === 2 && v.every(isUnit) && v[0] <= v[1];
    if (!isObject(b) || !band(b.upper) || !band(b.abyss)) {
      errors.push(`${where}: bands — нужен { upper: [y0, y1], abyss: [y0, y1] } в [0, 1]`);
    } else {
      out.bands = { upper: [b.upper[0], b.upper[1]], abyss: [b.abyss[0], b.abyss[1]] };
    }
  }
  for (const [id, r] of Object.entries(layout.regions ?? {})) {
    const w = `${where}: regions["${id}"]`;
    if (!regionById.has(id)) {
      errors.push(`${w}: неизвестный регион`);
      continue;
    }
    if (!isObject(r)) {
      errors.push(`${w}: ожидается объект`);
      continue;
    }
    const before = errors.length;
    let polygon;
    if (!Array.isArray(r.polygon) || r.polygon.length < 3 || !r.polygon.every(isPoint)) {
      errors.push(`${w}: polygon — нужно не меньше 3 точек [x, y] в [0, 1]`);
    } else {
      polygon = r.polygon.map((p) => [p[0], p[1]]);
    }
    const label = point(r.label, `${w}: label`, errors);
    const c = r.camera;
    let camera;
    if (!isObject(c) || !isUnit(c.x) || !isUnit(c.y) || typeof c.zoom !== 'number' || !(c.zoom > 0)) {
      errors.push(`${w}: camera — нужен { x, y в [0, 1], zoom > 0 }`);
    } else {
      camera = { x: c.x, y: c.y, zoom: c.zoom };
    }
    if (errors.length === before) out.regions.set(id, { polygon, label, camera });
  }
  for (const [name, p] of Object.entries(layout.places ?? {})) {
    const w = `${where}: places["${name}"]`;
    if (!placeRegion.has(name)) {
      errors.push(`${w}: неизвестное место`);
      continue;
    }
    const pos = point(isObject(p) ? p.pos : undefined, `${w}: pos`, errors);
    if (pos) out.places.set(name, pos);
  }
  return out;
}

/** Неизвестные ключи объекта — ошибка (ловит опечатки в данных исследования). */
function unknownKeys(obj, allowed, where, errors) {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) errors.push(`${where}: неизвестный ключ "${key}"`);
}

/** source / via / url / note / doubt записи модели связей (A3). Ошибка — undefined. */
function sourceOf(rec, where, mediaIds, errors) {
  const before = errors.length;
  const { source, via, url } = rec;
  if (typeof source === 'string' && source.startsWith('comic:')) {
    if (!mediaIds.has(source.slice(6))) errors.push(`${where}: неизвестное медиа "${source}"`);
  } else if (!SOURCES.includes(source)) {
    errors.push(`${where}: source — bio | liquipedia | comic:<id> | ours`);
  }
  if (via !== undefined && (source !== 'liquipedia' || !VIA.includes(via))) {
    errors.push(`${where}: via (${VIA.join(' | ')}) — только у source liquipedia`);
  }
  if (url !== undefined) {
    if (!isHttps(url)) errors.push(`${where}: url — нужна https-ссылка`);
    else if (source === 'liquipedia' && !LIQUIPEDIA_URL.test(url)) {
      errors.push(`${where}: url Liquipedia — https://liquipedia.net/dota2/…`);
    }
  }
  for (const key of ['note', 'doubt']) {
    if (rec[key] !== undefined && !isNonEmptyString(rec[key])) errors.push(`${where}: ${key} — непустая строка`);
  }
  return errors.length === before ? compact({ source, via, url, note: rec.note, doubt: rec.doubt }) : undefined;
}

/**
 * { place } | { region } → { regionId, placeSlug? }. Ошибка — undefined.
 * optional — у связи героев места может не быть (тогда null).
 */
function spotOf(rec, where, { regionById, placeRegion }, errors, optional = false) {
  const hasPlace = rec.place !== undefined;
  const hasRegion = rec.region !== undefined;
  if ((hasPlace && hasRegion) || (!optional && !hasPlace && !hasRegion)) {
    errors.push(`${where}: нужно ровно одно из place/region`);
    return undefined;
  }
  if (hasPlace) {
    const regionId = placeRegion.get(rec.place);
    if (!regionId) {
      errors.push(`${where}: неизвестное место "${rec.place}"`);
      return undefined;
    }
    return { regionId, placeSlug: placeSlug(rec.place) };
  }
  if (hasRegion) {
    if (!regionById.has(rec.region)) {
      errors.push(`${where}: неизвестный регион "${rec.region}"`);
      return undefined;
    }
    return { regionId: rec.region };
  }
  return null;
}

const spotKey = (s) => (s.placeSlug ? `${s.regionId}/${s.placeSlug}` : s.regionId);

function buildLinks(entry, where, refs, errors) {
  const links = [];
  /** spotKey → event: путь идёт только по местам из links. */
  const spots = new Map();
  (Array.isArray(entry.links) ? entry.links : []).forEach((link, i) => {
    const w = `${where}: links[${i}]`;
    if (!isObject(link)) {
      errors.push(`${w}: ожидается объект`);
      return;
    }
    unknownKeys(link, LINK_KEYS, w, errors);
    const eventOk = EVENTS.includes(link.event);
    if (!eventOk) errors.push(`${w}: event — ${EVENTS.join(' | ')}`);
    const src = sourceOf(link, w, refs.mediaIds, errors);
    const spot = spotOf(link, w, refs, errors);
    if (link.region === 'uncharted' && !link.note) errors.push(`${w}: у героя «Неизведанных земель» нужна заметка note`);
    if (!spot || !src || !eventOk) return;
    if (spots.has(spotKey(spot))) {
      errors.push(`${w}: место уже есть в links — одно место, одна связь`);
      return;
    }
    spots.set(spotKey(spot), link.event);
    links.push(compact({ ...spot, event: link.event, ...src }));
  });
  return { links, spots };
}

function buildPath(entry, where, refs, spots, errors) {
  if (entry.path === undefined) return undefined;
  if (!Array.isArray(entry.path) || entry.path.length < 2) {
    errors.push(`${where}: path — список из 2 и больше остановок`);
    return undefined;
  }
  const path = [];
  entry.path.forEach((stop, i) => {
    const w = `${where}: path[${i}]`;
    if (!isObject(stop)) {
      errors.push(`${w}: ожидается объект`);
      return;
    }
    unknownKeys(stop, ['place', 'region'], w, errors);
    const spot = spotOf(stop, w, refs, errors);
    if (!spot) return;
    if (!spots.has(spotKey(spot))) errors.push(`${w}: остановки нет в links героя`);
    else if (spots.get(spotKey(spot)) === 'mention') errors.push(`${w}: место только упомянуто (mention) — в путь не входит`);
    const prev = path[path.length - 1];
    if (prev && spotKey(prev) === spotKey(spot)) errors.push(`${w}: остановка повторяет предыдущую`);
    path.push(compact(spot));
  });
  return path;
}

function buildRelations(entry, where, refs, heroKeys, errors) {
  if (entry.relations === undefined) return undefined;
  if (!Array.isArray(entry.relations)) {
    errors.push(`${where}: relations — список`);
    return undefined;
  }
  const relations = [];
  const seen = new Set();
  entry.relations.forEach((rel, i) => {
    const w = `${where}: relations[${i}]`;
    if (!isObject(rel)) {
      errors.push(`${w}: ожидается объект`);
      return;
    }
    unknownKeys(rel, RELATION_KEYS, w, errors);
    const heroOk = heroKeys.has(rel.hero);
    const typeOk = typeof rel.type === 'string' && Object.hasOwn(RELATIONS, rel.type);
    if (!heroOk) errors.push(`${w}: неизвестный герой "${rel.hero}" (нужен key из heroes.json)`);
    if (!typeOk) errors.push(`${w}: type — ${Object.keys(RELATIONS).join(' | ')}`);
    if (seen.has(`${rel.hero}/${rel.type}`)) errors.push(`${w}: связь ${rel.hero} / ${rel.type} повторяется`);
    seen.add(`${rel.hero}/${rel.type}`);
    const src = sourceOf(rel, w, refs.mediaIds, errors);
    const spot = spotOf(rel, w, refs, errors, true);
    if (!src || spot === undefined || !heroOk || !typeOk) return;
    relations.push(compact({ hero: rel.hero, type: rel.type, ...(spot ?? {}), ...src }));
  });
  return relations.length > 0 ? relations : undefined;
}

function buildProfile(entry, where, errors) {
  const p = entry.profile;
  if (p === undefined) return undefined;
  if (!isObject(p)) {
    errors.push(`${where}: profile — ожидается объект`);
    return undefined;
  }
  unknownKeys(p, ['summary', 'art'], `${where}: profile`, errors);
  const summary = p.summary !== undefined ? localized(p.summary, `${where}: profile.summary`, errors) : undefined;
  for (const lang of ['ru', 'en']) {
    if (summary && summary[lang].length > SUMMARY_MAX) {
      errors.push(`${where}: profile.summary.${lang} длиннее ${SUMMARY_MAX} знаков — нужно короткое описание`);
    }
  }
  let art;
  if (p.art !== undefined) {
    if (!Array.isArray(p.art) || p.art.length === 0) errors.push(`${where}: profile.art — непустой список ссылок`);
    else if (!p.art.every((a) => typeof a === 'string' && VALVE_ART.test(a))) {
      errors.push(`${where}: profile.art — только официальные ссылки Valve (A6)`);
    } else if (new Set(p.art).size !== p.art.length) errors.push(`${where}: profile.art — ссылка повторяется`);
    else art = [...p.art];
  }
  const out = compact({ summary, art });
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * research/e1/hero-places.json → Map key → { links, path?, relations?, profile? } (модель связей, A3).
 * Порядок links сохраняется: по нему идут места героя и нити (A11).
 */
function buildHeroes(heroPlaces, heroes, refs, errors) {
  const file = 'research/e1/hero-places.json';
  const out = new Map();
  if (!isObject(heroPlaces) || !isObject(heroPlaces.heroes)) {
    errors.push(`${file}: ожидается { heroes: { <имя героя>: { links, ... } } }`);
    return out;
  }
  const heroByName = new Map(heroes.heroes.map((h) => [h.name, h]));
  const heroKeys = new Set(heroes.heroes.map((h) => h.key));
  for (const [name, entry] of Object.entries(heroPlaces.heroes)) {
    const hero = heroByName.get(name);
    const where = `${file}: ${name}`;
    if (!hero) {
      errors.push(`${where}: героя нет в heroes.json`);
      continue;
    }
    if (!isObject(entry)) {
      errors.push(`${where}: ожидается объект { links, path?, relations?, profile? }`);
      continue;
    }
    unknownKeys(entry, ENTRY_KEYS, where, errors);
    if (!Array.isArray(entry.links) || entry.links.length === 0) errors.push(`${where}: пустой список мест links`);
    const { links, spots } = buildLinks(entry, where, refs, errors);
    out.set(
      hero.key,
      compact({
        links,
        path: buildPath(entry, where, refs, spots, errors),
        relations: buildRelations(entry, where, refs, heroKeys, errors),
        profile: buildProfile(entry, where, errors),
      }),
    );
  }
  // Два героя не могут быть наставниками (хозяевами) друг друга.
  for (const [a, model] of out) {
    for (const rel of model.relations ?? []) {
      const back = out.get(rel.hero)?.relations ?? [];
      if (a < rel.hero && RELATIONS[rel.type] !== rel.type && back.some((r) => r.hero === a && r.type === rel.type)) {
        errors.push(`${file}: ${a} и ${rel.hero} оба называют друг друга ${rel.type} — у одного должно быть ${RELATIONS[rel.type]}`);
      }
    }
  }
  return out;
}

function buildAliases(heroAliases, heroes, errors, warnings) {
  const where = 'research/e1/hero-aliases.json';
  const out = new Map();
  if (heroAliases === undefined) return out;
  if (!isObject(heroAliases) || !isObject(heroAliases.aliases)) {
    errors.push(`${where}: ожидается { aliases: { <key>: [строки] } }`);
    return out;
  }
  const nameByKey = new Map(heroes.heroes.map((h) => [h.key, h.name]));
  const owners = new Map();
  for (const [key, list] of Object.entries(heroAliases.aliases)) {
    const w = `${where}: ${key}`;
    if (!nameByKey.has(key)) {
      errors.push(`${w}: героя нет в heroes.json`);
      continue;
    }
    if (!Array.isArray(list)) {
      errors.push(`${w}: ожидается список строк`);
      continue;
    }
    const seen = new Set();
    const items = [];
    for (const a of list) {
      if (!isNonEmptyString(a)) {
        errors.push(`${w}: пустой алиас`);
        continue;
      }
      const n = normalizeAlias(a);
      if (seen.has(n)) {
        errors.push(`${w}: алиас "${a}" повторяется`);
        continue;
      }
      if (n === normalizeAlias(nameByKey.get(key))) {
        errors.push(`${w}: алиас "${a}" совпадает с именем героя`);
        continue;
      }
      seen.add(n);
      items.push(a.trim());
      if (!owners.has(n)) owners.set(n, []);
      owners.get(n).push(key);
    }
    if (items.length > 0) out.set(key, items);
  }
  for (const [n, keys] of owners) {
    if (keys.length > 1) warnings.push(`${where}: алиас "${n}" у нескольких героев: ${keys.join(', ')}`);
  }
  return out;
}

/**
 * Собирает мир из уже прочитанных исходников. Ничего не пишет на диск.
 * @returns {{ world: object, errors: string[], warnings: string[] }}
 */
export function buildWorld({ heroes, regions, heroPlaces, heroAliases, contents = [], layout = null, media }) {
  const errors = [];
  const warnings = [];

  const regionById = new Map();
  const placeRegion = new Map();
  for (const r of regions.regions) {
    if (regionById.has(r.id)) errors.push(`research/e1/regions.json: регион "${r.id}" повторяется`);
    regionById.set(r.id, r);
    const slugs = new Set();
    for (const l of r.locations) {
      if (placeRegion.has(l.name)) errors.push(`research/e1/regions.json: место "${l.name}" в двух регионах`);
      placeRegion.set(l.name, r.id);
      const slug = placeSlug(l.name);
      if (!slug) errors.push(`research/e1/regions.json: у места "${l.name}" пустой slug`);
      if (slugs.has(slug)) errors.push(`research/e1/regions.json: slug "${slug}" повторяется в регионе ${r.id}`);
      slugs.add(slug);
    }
  }

  const contentById = new Map();
  for (const { file, data } of contents) {
    const c = buildContent(file, data, regionById, errors);
    if (!c) continue;
    if (contentById.has(c.id)) errors.push(`${file}: контент региона ${c.id} уже задан другим файлом`);
    contentById.set(c.id, c);
  }

  const map = layout ? buildLayout(layout, regionById, placeRegion, errors) : null;

  const mediaInfo = buildMedia(media, errors);
  const usedMedia = new Set();
  const checkRefs = (refs, where) => {
    for (const id of refs ?? []) {
      if (!mediaInfo.ids.has(id)) errors.push(`${where}: неизвестное медиа "${id}"`);
      usedMedia.add(id);
    }
  };
  for (const c of contentById.values()) {
    checkRefs(c.media, `content/regions/${c.id}.json: media`);
    for (const [name, p] of c.places) checkRefs(p.media, `content/regions/${c.id}.json: places["${name}"].media`);
  }
  for (const id of mediaInfo.ids) {
    if (!usedMedia.has(id)) warnings.push(`content/media.json: медиа "${id}" ни к чему не привязано`);
  }

  const heroModel = buildHeroes(heroPlaces, heroes, { regionById, placeRegion, mediaIds: mediaInfo.ids }, errors);

  const aliasesByKey = buildAliases(heroAliases, heroes, errors, warnings);

  const heroList = heroes.heroes.map((h) =>
    compact({
      key: h.key,
      name: h.name,
      slug: heroSlug(h.name),
      aliases: aliasesByKey.get(h.key),
      links: heroModel.get(h.key)?.links ?? [],
      path: heroModel.get(h.key)?.path,
      relations: heroModel.get(h.key)?.relations,
      profile: heroModel.get(h.key)?.profile,
    }),
  );

  const worldRegions = regions.regions.map((r) => {
    const c = contentById.get(r.id);
    return compact({
      id: r.id,
      tier: r.tier,
      side: r.side,
      sideBasis: r.sideBasis,
      name: { ru: r.ru, en: r.en },
      geo: r.geo,
      subtitle: c?.subtitle,
      biome: c?.biome,
      ambient: c?.ambient,
      traits: c?.traits,
      description: c?.description,
      media: c?.media,
      moreLink: c?.moreLink,
      layout: map?.regions.get(r.id),
      places: r.locations.map((l) =>
        compact({
          name: l.name,
          slug: placeSlug(l.name),
          capital: l.capital === true,
          placement: l.placement,
          note: l.note,
          text: c?.places.get(l.name)?.text,
          media: c?.places.get(l.name)?.media,
          pos: map?.places.get(l.name),
        }),
      ),
      regionHeroes: heroList
        .filter((h) => h.links.some((link) => link.regionId === r.id && link.placeSlug === undefined))
        .map((h) => h.key),
    });
  });

  const world = compact({
    aspect: ASPECT,
    bands: map?.bands,
    regions: worldRegions,
    heroes: heroList,
    media: mediaInfo.byId.size > 0 ? [...mediaInfo.byId.values()] : undefined,
  });
  return { world, errors, warnings };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Читает исходники из корня репозитория. content/, map/ и hero-aliases.json необязательны. */
export function readSources(root) {
  const errors = [];
  const tryRead = (rel) => {
    try {
      return readJson(join(root, rel));
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
      return undefined;
    }
  };
  const heroes = tryRead('research/e1/heroes.json');
  const regions = tryRead('research/e1/regions.json');
  const heroPlaces = tryRead('research/e1/hero-places.json');
  const aliasesRel = 'research/e1/hero-aliases.json';
  const heroAliases = existsSync(join(root, aliasesRel)) ? tryRead(aliasesRel) : undefined;

  const contents = [];
  const contentDir = join(root, 'content/regions');
  if (existsSync(contentDir)) {
    for (const name of readdirSync(contentDir).filter((n) => n.endsWith('.json')).sort()) {
      const rel = `content/regions/${name}`;
      const data = tryRead(rel);
      if (data !== undefined) contents.push({ file: rel, data });
    }
  }
  const layout = existsSync(join(root, 'map/layout.json')) ? (tryRead('map/layout.json') ?? null) : null;
  const media = existsSync(join(root, 'content/media.json')) ? tryRead('content/media.json') : undefined;
  return { sources: { heroes, regions, heroPlaces, heroAliases, contents, layout, media }, errors };
}

export function serialize(world) {
  return JSON.stringify(world, null, 2) + '\n';
}

/** Полный прогон: прочитать, собрать, записать. Возвращает список ошибок (пустой — успех). */
export function run(root) {
  const { sources, errors } = readSources(root);
  if (errors.length > 0) return { errors };
  const result = buildWorld(sources);
  if (result.errors.length > 0) return { errors: result.errors };
  const out = join(root, OUTPUT);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serialize(result.world), 'utf8');
  return { errors: [], warnings: result.warnings, out, world: result.world };
}

function main(argv) {
  const i = argv.indexOf('--root');
  const root = i >= 0 ? resolve(argv[i + 1]) : fileURLToPath(new URL('..', import.meta.url));
  const { errors, warnings = [], world } = run(root);
  for (const w of warnings) console.warn(`build-data: предупреждение — ${w}`);
  if (errors.length > 0) {
    console.error(`build-data: ${errors.length} ошибок`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const places = world.regions.reduce((n, r) => n + r.places.length, 0);
  const withText = world.regions.filter((r) => r.description).length;
  const withLayout = world.regions.filter((r) => r.layout).length;
  console.log(
    `build-data: OK — ${world.regions.length} регионов (с текстом ${withText}, на карте ${withLayout}), ` +
      `${places} мест, ${world.heroes.length} героев (с алиасами ${world.heroes.filter((h) => h.aliases).length}), ` +
      `${world.media?.length ?? 0} медиа → ${OUTPUT}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
