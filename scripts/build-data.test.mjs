// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildWorld, heroSlug, OUTPUT, placeSlug, readSources, run, serialize } from './build-data.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = fileURLToPath(new URL('./build-data.mjs', import.meta.url));

const L = (s) => ({ ru: `${s} ru`, en: `${s} en` });

function fixture() {
  return {
    heroes: {
      heroes: [
        { id: 1, key: 'crystal_maiden', name: 'Crystal Maiden' },
        { id: 2, key: 'furion', name: "Nature's Prophet" },
        { id: 3, key: 'alchemist', name: 'Alchemist' },
      ],
    },
    regions: {
      regions: [
        {
          id: 'icewrack',
          tier: 'continent',
          side: 'radiant',
          en: 'Icewrack',
          ru: 'Ледяная пустошь',
          geo: 'Север.',
          locations: [
            { name: 'Icewrack', capital: true, placement: 'lore' },
            { name: 'Blueheart Glacier', placement: 'lore', note: 'заметка' },
          ],
        },
        {
          id: 'tomokan',
          tier: 'continent',
          side: 'neutral',
          en: "Tomo'kan",
          ru: 'Томокан',
          geo: 'Запад.',
          locations: [{ name: "Tomo'kan", placement: 'ours' }],
        },
        { id: 'uncharted', tier: 'continent', side: 'neutral', en: 'Uncharted', ru: 'Неизведанные', geo: '', locations: [] },
      ],
    },
    heroPlaces: {
      heroes: {
        'Crystal Maiden': [
          { place: 'Blueheart Glacier', role: 'origin', basis: 'bio' },
          { region: 'icewrack', role: 'link', basis: 'ours', note: 'сестра' },
        ],
        "Nature's Prophet": [{ place: "Tomo'kan", role: 'home', basis: 'page' }],
        Alchemist: [{ region: 'uncharted', role: 'origin', basis: 'ours', note: 'нет мест' }],
      },
    },
  };
}

const content = () => ({
  file: 'content/regions/icewrack.json',
  data: {
    id: 'icewrack',
    subtitle: L('sub'),
    biome: 'snow',
    ambient: { type: 'snow', density: 0.6 },
    traits: { magic: L('magic'), rule: L('rule') },
    description: L('desc'),
    places: { 'Blueheart Glacier': { name: L('glacier'), type: L('type'), description: L('pdesc') } },
  },
});

const layout = () => ({
  aspect: 1.6,
  bands: { upper: [0, 0.13], abyss: [0.87, 1] },
  regions: {
    icewrack: { polygon: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]], label: [0.2, 0.2], camera: { x: 0.2, y: 0.2, zoom: 3 } },
  },
  places: { 'Blueheart Glacier': { pos: [0.22, 0.18] } },
});

describe('slug', () => {
  it('переводит имя места в kebab-case (A5)', () => {
    expect(placeSlug("Tomo'kan")).toBe('tomokan');
    expect(placeSlug('Ember (City)')).toBe('ember-city');
    expect(placeSlug("Selemene's Moon")).toBe('selemenes-moon');
    expect(placeSlug('Zaru’Kina')).toBe('zarukina');
  });
  it('делает slug героя для dota2.com (A6)', () => {
    expect(heroSlug("Nature's Prophet")).toBe('naturesprophet');
    expect(heroSlug('Anti-Mage')).toBe('antimage');
  });
});

describe('buildWorld', () => {
  it('собирает мир только из исследования, без content и map', () => {
    const { world, errors } = buildWorld(fixture());
    expect(errors).toEqual([]);
    expect(world.aspect).toBe(1.6);
    const ice = world.regions[0];
    expect(ice).toMatchObject({ id: 'icewrack', side: 'radiant', name: { ru: 'Ледяная пустошь', en: 'Icewrack' } });
    expect(ice.description).toBeUndefined();
    expect(ice.layout).toBeUndefined();
    expect(ice.places.map((p) => p.slug)).toEqual(['icewrack', 'blueheart-glacier']);
    expect(ice.places[0].capital).toBe(true);
    expect(ice.places[1]).toEqual({
      name: 'Blueheart Glacier',
      slug: 'blueheart-glacier',
      capital: false,
      placement: 'lore',
      note: 'заметка',
    });
    expect(ice.regionHeroes).toEqual(['crystal_maiden']);
    expect(world.regions[1].places[0].slug).toBe('tomokan');
  });

  it('разворачивает связи героев в regionId + placeSlug', () => {
    const { world } = buildWorld(fixture());
    const cm = world.heroes.find((h) => h.key === 'crystal_maiden');
    expect(cm).toEqual({
      key: 'crystal_maiden',
      name: 'Crystal Maiden',
      slug: 'crystalmaiden',
      links: [
        { regionId: 'icewrack', placeSlug: 'blueheart-glacier', role: 'origin', basis: 'bio' },
        { regionId: 'icewrack', role: 'link', basis: 'ours', note: 'сестра' },
      ],
    });
    expect(world.heroes.map((h) => h.key)).toEqual(['crystal_maiden', 'furion', 'alchemist']);
  });

  it('вливает content и layout', () => {
    const { world, errors } = buildWorld({ ...fixture(), contents: [content()], layout: layout() });
    expect(errors).toEqual([]);
    const ice = world.regions[0];
    expect(ice.biome).toBe('snow');
    expect(ice.subtitle).toEqual(L('sub'));
    expect(Object.keys(ice.traits)).toEqual(['rule', 'magic']);
    expect(ice.layout.camera).toEqual({ x: 0.2, y: 0.2, zoom: 3 });
    expect(ice.places[1].text).toEqual({ name: L('glacier'), type: L('type'), description: L('pdesc') });
    expect(ice.places[1].pos).toEqual([0.22, 0.18]);
    expect(ice.places[0].pos).toBeUndefined();
    expect(world.bands).toEqual({ upper: [0, 0.13], abyss: [0.87, 1] });
  });

  it('ошибка на неизвестный регион и место в content', () => {
    const bad = content();
    bad.data.places = { Nowhere: { name: L('x') }, "Tomo'kan": { name: L('y') } };
    const other = { file: 'content/regions/atlantis.json', data: { id: 'atlantis' } };
    const { errors } = buildWorld({ ...fixture(), contents: [bad, other] });
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/Nowhere/);
    expect(errors.join('\n')).toMatch(/Tomo'kan/);
    expect(errors.join('\n')).toMatch(/atlantis/);
  });

  it('ошибка на неполный перевод и неверный biome', () => {
    const bad = content();
    bad.data.description = { ru: 'только русский' };
    bad.data.biome = 'lava';
    const { errors } = buildWorld({ ...fixture(), contents: [bad] });
    expect(errors).toHaveLength(2);
  });

  it('moreLink: https-ссылка попадает в регион, другое — ошибка', () => {
    const good = content();
    good.data.moreLink = 'https://example.org/icewrack';
    const ok = buildWorld({ ...fixture(), contents: [good] });
    expect(ok.errors).toEqual([]);
    expect(ok.world.regions.find((r) => r.id === 'icewrack').moreLink).toBe('https://example.org/icewrack');

    const bad = content();
    bad.data.moreLink = 'javascript:alert(1)';
    expect(buildWorld({ ...fixture(), contents: [bad] }).errors).toHaveLength(1);
  });

  it('ошибка на неизвестный регион и место в layout', () => {
    const bad = layout();
    bad.regions.atlantis = bad.regions.icewrack;
    bad.places.Nowhere = { pos: [0.5, 0.5] };
    const { errors } = buildWorld({ ...fixture(), layout: bad });
    expect(errors).toHaveLength(2);
  });

  it('ошибка на неизвестного героя, место и регион в hero-places', () => {
    const f = fixture();
    f.heroPlaces.heroes['Nobody'] = [{ region: 'icewrack', role: 'origin', basis: 'ours' }];
    f.heroPlaces.heroes['Alchemist'] = [
      { place: 'Nowhere', role: 'origin', basis: 'ours' },
      { region: 'atlantis', role: 'origin', basis: 'ours' },
    ];
    const { errors } = buildWorld(f);
    expect(errors).toHaveLength(3);
  });

  it('детерминирован: порядок ключей во входе не влияет на выход', () => {
    const a = serialize(buildWorld({ ...fixture(), contents: [content()], layout: layout() }).world);
    const c = content();
    c.data = Object.fromEntries(Object.entries(c.data).reverse());
    c.data.traits = { magic: L('magic'), rule: L('rule') };
    const b = serialize(buildWorld({ ...fixture(), contents: [c], layout: layout() }).world);
    expect(b).toBe(a);
    expect(a.endsWith('}\n')).toBe(true);
  });
});

describe('run / CLI', () => {
  let root;
  afterEach(() => root && rmSync(root, { recursive: true, force: true }));

  function writeRoot(files) {
    root = mkdtempSync(join(tmpdir(), 'build-data-'));
    for (const [rel, data] of Object.entries(files)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), JSON.stringify(data));
    }
  }

  function research() {
    const f = fixture();
    return {
      'research/e1/heroes.json': f.heroes,
      'research/e1/regions.json': f.regions,
      'research/e1/hero-places.json': f.heroPlaces,
    };
  }

  it('пишет файл без content/ и map/', () => {
    writeRoot(research());
    const { errors } = run(root);
    expect(errors).toEqual([]);
    const out = JSON.parse(readFileSync(join(root, OUTPUT), 'utf8'));
    expect(out.regions).toHaveLength(3);
  });

  it('читает content/regions/*.json и map/layout.json', () => {
    writeRoot({ ...research(), 'content/regions/icewrack.json': content().data, 'map/layout.json': layout() });
    const { errors, world } = run(root);
    expect(errors).toEqual([]);
    expect(world.regions[0].layout).toBeDefined();
    expect(world.regions[0].description).toEqual(L('desc'));
  });

  it('завершается с кодом 1 на битой ссылке', () => {
    writeRoot({ ...research(), 'map/layout.json': { places: { Nowhere: { pos: [0.1, 0.1] } } } });
    const res = spawnSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/Nowhere/);
  });
});

describe('данные репозитория', () => {
  it('собираются без ошибок и совпадают с закоммиченным world.generated.json', () => {
    const { sources, errors: readErrors } = readSources(REPO);
    expect(readErrors).toEqual([]);
    const { world, errors } = buildWorld(sources);
    expect(errors).toEqual([]);
    const committed = readFileSync(join(REPO, OUTPUT), 'utf8').replace(/\r\n/g, '\n');
    expect(committed, 'запустите npm run data и закоммитьте результат').toBe(serialize(world));
  });
});
