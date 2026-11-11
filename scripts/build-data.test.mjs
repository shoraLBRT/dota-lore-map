// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildWorld, heroSlug, normalizeAlias, OUTPUT, placeSlug, readSources, run, serialize } from './build-data.mjs';

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

  it('пробрасывает алиасы героев, без файла алиасов поля нет', () => {
    const heroAliases = { aliases: { crystal_maiden: ['CM', 'Райлай', ' Rylai '], furion: ['Фурион'] } };
    const { world, errors, warnings } = buildWorld({ ...fixture(), heroAliases });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    const byKey = Object.fromEntries(world.heroes.map((h) => [h.key, h]));
    expect(byKey.crystal_maiden.aliases).toEqual(['CM', 'Райлай', 'Rylai']);
    expect(byKey.furion.aliases).toEqual(['Фурион']);
    expect(byKey.alchemist).not.toHaveProperty('aliases');
    expect(buildWorld(fixture()).world.heroes[0]).not.toHaveProperty('aliases');
  });

  it('ошибка на неизвестного героя, пустой и повторный алиас; предупреждение на общий алиас', () => {
    const heroAliases = {
      aliases: {
        nobody: ['X'],
        crystal_maiden: ['CM', '', 'cm', 'crystal maiden', 'Общий'],
        alchemist: ['общий'],
        furion: 'NP',
      },
    };
    const { errors, warnings } = buildWorld({ ...fixture(), heroAliases });
    expect(errors).toHaveLength(5);
    expect(errors.join('\n')).toMatch(/nobody/);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/crystal_maiden, alchemist/);
  });

  describe('медиа', () => {
    const image = (id = 'ice-comic') => ({
      id,
      type: 'image',
      src: 'https://cdn.example.com/a.jpg',
      title: L('t'),
      subtitle: L('Комикс'),
      description: L('d'),
      credit: 'Valve Corporation',
      sourceUrl: 'https://www.dota2.com/x',
    });
    const video = { id: 'ice-video', type: 'youtube', youtubeId: 'abcDEF_12-x', title: L('v'), subtitle: L('s'), credit: 'Valve Corporation', sourceUrl: 'https://www.youtube.com/watch?v=abcDEF_12-x' };
    const withMedia = (regionMedia, placeMedia) => {
      const c = content();
      if (regionMedia) c.data.media = regionMedia;
      if (placeMedia) c.data.places['Blueheart Glacier'].media = placeMedia;
      return c;
    };

    it('пробрасывает media.json и ссылки региона и места', () => {
      const media = { media: [image(), video] };
      const { world, errors, warnings } = buildWorld({ ...fixture(), contents: [withMedia(['ice-comic'], ['ice-video'])], media });
      expect(errors).toEqual([]);
      expect(warnings).toEqual([]);
      expect(world.media).toEqual([image(), video]);
      expect(world.regions[0].media).toEqual(['ice-comic']);
      expect(world.regions[0].places[1].media).toEqual(['ice-video']);
      expect(world.regions[0].places[1].text.name).toEqual(L('glacier'));
      expect(world.regions[0].places[0]).not.toHaveProperty('media');
    });

    it('без media.json полей media нет', () => {
      const { world } = buildWorld({ ...fixture(), contents: [content()] });
      expect(world).not.toHaveProperty('media');
      expect(world.regions[0]).not.toHaveProperty('media');
    });

    it('место только с медиа, без текста', () => {
      const c = content();
      c.data.places = { Icewrack: { media: ['ice-comic'] } };
      const { world, errors } = buildWorld({ ...fixture(), contents: [c], media: { media: [image()] } });
      expect(errors).toEqual([]);
      expect(world.regions[0].places[0]).not.toHaveProperty('text');
      expect(world.regions[0].places[0].media).toEqual(['ice-comic']);
    });

    it('ошибка на неизвестный id, больше 3 медиа и повтор в списке', () => {
      const media = { media: [image('a'), image('b'), image('c'), image('d')] };
      const { errors } = buildWorld({ ...fixture(), contents: [withMedia(['a', 'b', 'c', 'd'], ['nope', 'a', 'a'])], media });
      const text = errors.join('\n');
      expect(errors).toHaveLength(3);
      expect(text).toMatch(/больше 3/);
      expect(text).toMatch(/"nope"/);
      expect(text).toMatch(/"a" повторяется/);
    });

    it('ошибка на медиа без src и youtubeId, http-ссылки и неверный youtubeId', () => {
      const noSrc = { ...image('no-src'), src: undefined };
      const httpSrc = { ...image('http-src'), src: 'http://cdn.example.com/a.jpg' };
      const httpSource = { ...image('http-source'), sourceUrl: 'http://www.dota2.com/x' };
      const badVideo = { ...video, id: 'bad-video', youtubeId: 'short' };
      const mixed = { ...video, id: 'mixed', src: 'https://cdn.example.com/a.jpg' };
      const noCredit = { ...image('no-credit'), credit: '' };
      const media = { media: [noSrc, httpSrc, httpSource, badVideo, mixed, noCredit, image('Bad Id'), image('ok'), image('ok')] };
      const refs = ['no-src', 'http-src', 'http-source'];
      const { errors, world } = buildWorld({ ...fixture(), contents: [withMedia(refs)], media });
      expect(errors).toHaveLength(8);
      const text = errors.join('\n');
      expect(text).toMatch(/no-src.*нет ни src, ни youtubeId/);
      expect(text).toMatch(/http-src.*src/);
      expect(text).toMatch(/http-source.*sourceUrl/);
      expect(text).toMatch(/bad-video.*youtubeId/);
      expect(text).toMatch(/mixed.*src/);
      expect(text).toMatch(/no-credit.*credit/);
      expect(text).toMatch(/kebab-case/);
      expect(text).toMatch(/id повторяется/);
      expect(world.media.map((m) => m.id)).toEqual(['ok']);
    });

    it('разрешает относительный путь к ассету в src', () => {
      const media = { media: [{ ...image(), src: 'assets/media/ice.webp' }] };
      const { errors } = buildWorld({ ...fixture(), contents: [withMedia(['ice-comic'])], media });
      expect(errors).toEqual([]);
    });

    it('src на двух языках: { ru, en }; без одного из языков — ошибка', () => {
      const both = { ...image(), src: { ru: 'https://cdn.example.com/ru.jpg', en: 'https://cdn.example.com/en.jpg' } };
      const ok = buildWorld({ ...fixture(), contents: [withMedia(['ice-comic'])], media: { media: [both] } });
      expect(ok.errors).toEqual([]);
      expect(ok.world.media[0].src).toEqual(both.src);
      const half = { ...image(), src: { en: 'https://cdn.example.com/en.jpg' } };
      const bad = buildWorld({ ...fixture(), contents: [withMedia(['ice-comic'])], media: { media: [half] } });
      expect(bad.errors.join(' ')).toMatch(/src/);
    });

    it('предупреждение на медиа без привязки', () => {
      const { errors, warnings } = buildWorld({ ...fixture(), contents: [content()], media: { media: [image()] } });
      expect(errors).toEqual([]);
      expect(warnings).toEqual([expect.stringMatching(/ice-comic/)]);
    });
  });

  it('нормализует алиас для сравнения', () => {
    expect(normalizeAlias('  Ёжик   Ёж ')).toBe('ежик еж');
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
    const { world, errors, warnings } = buildWorld(sources);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(world.heroes.filter((h) => !h.aliases?.length).map((h) => h.key)).toEqual([]);
    const committed = readFileSync(join(REPO, OUTPUT), 'utf8').replace(/\r\n/g, '\n');
    expect(committed, 'запустите npm run data и закоммитьте результат').toBe(serialize(world));
  });
});
