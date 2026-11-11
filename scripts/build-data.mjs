// Сборка данных: research/e1 + content/regions + map/layout.json → src/data/world.generated.json.
// Формат входа и правила — docs/ARCHITECTURE.md §A3. Без зависимостей, Node 22.
//
//   node scripts/build-data.mjs            собрать и записать
//   node scripts/build-data.mjs --root DIR  взять файлы из другого корня (для тестов)
//
// Ошибка (exit 1) — ссылка на несуществующий регион, место или героя и неверный формат.
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
const ROLES = ['origin', 'home', 'link'];
const BASES = ['infobox', 'bio', 'page', 'ours'];

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

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isUnit = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isPoint = (v) => Array.isArray(v) && v.length === 2 && v.every(isUnit);

function localized(value, where, errors) {
  if (!isObject(value) || !isNonEmptyString(value.ru) || !isNonEmptyString(value.en)) {
    errors.push(`${where}: нужен объект { ru, en } с непустыми строками`);
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
          if (!PLACE_TEXT.includes(key)) errors.push(`${where}: places["${name}"] — неизвестный ключ "${key}"`);
        }
        const t = compact(
          Object.fromEntries(
            PLACE_TEXT.filter((k) => text[k] !== undefined).map((k) => [
              k,
              localized(text[k], `${where}: places["${name}"].${k}`, errors),
            ]),
          ),
        );
        if (Object.keys(t).length > 0) out.places.set(name, t);
      }
    }
  }
  return out;
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

/**
 * Собирает мир из уже прочитанных исходников. Ничего не пишет на диск.
 * @returns {{ world: object, errors: string[] }}
 */
export function buildWorld({ heroes, regions, heroPlaces, contents = [], layout = null }) {
  const errors = [];

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

  const heroByName = new Map(heroes.heroes.map((h) => [h.name, h]));
  const linksByKey = new Map();
  for (const [name, links] of Object.entries(heroPlaces.heroes)) {
    const hero = heroByName.get(name);
    const where = `research/e1/hero-places.json: ${name}`;
    if (!hero) {
      errors.push(`${where}: героя нет в heroes.json`);
      continue;
    }
    const out = [];
    for (const link of links) {
      if (!ROLES.includes(link.role) || !BASES.includes(link.basis)) {
        errors.push(`${where}: неверный role/basis`);
        continue;
      }
      let regionId;
      let slug;
      if (link.place !== undefined && link.region === undefined) {
        regionId = placeRegion.get(link.place);
        if (!regionId) {
          errors.push(`${where}: неизвестное место "${link.place}"`);
          continue;
        }
        slug = placeSlug(link.place);
      } else if (link.region !== undefined && link.place === undefined) {
        if (!regionById.has(link.region)) {
          errors.push(`${where}: неизвестный регион "${link.region}"`);
          continue;
        }
        regionId = link.region;
      } else {
        errors.push(`${where}: нужно ровно одно из place/region`);
        continue;
      }
      out.push(compact({ regionId, placeSlug: slug, role: link.role, basis: link.basis, note: link.note }));
    }
    linksByKey.set(hero.key, out);
  }

  const heroList = heroes.heroes.map((h) => ({
    key: h.key,
    name: h.name,
    slug: heroSlug(h.name),
    links: linksByKey.get(h.key) ?? [],
  }));

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
      moreLink: c?.moreLink,
      layout: map?.regions.get(r.id),
      places: r.locations.map((l) =>
        compact({
          name: l.name,
          slug: placeSlug(l.name),
          capital: l.capital === true,
          placement: l.placement,
          note: l.note,
          text: c?.places.get(l.name),
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
  });
  return { world, errors };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Читает исходники из корня репозитория. content/ и map/ необязательны. */
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
  return { sources: { heroes, regions, heroPlaces, contents, layout }, errors };
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
  return { errors: [], out, world: result.world };
}

function main(argv) {
  const i = argv.indexOf('--root');
  const root = i >= 0 ? resolve(argv[i + 1]) : fileURLToPath(new URL('..', import.meta.url));
  const { errors, world } = run(root);
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
      `${places} мест, ${world.heroes.length} героев → ${OUTPUT}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
