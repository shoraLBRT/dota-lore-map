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
        'Crystal Maiden': {
          links: [
            { place: 'Blueheart Glacier', event: 'origin', source: 'bio' },
            { region: 'icewrack', event: 'link', source: 'ours', note: 'сестра' },
          ],
        },
        "Nature's Prophet": { links: [{ place: "Tomo'kan", event: 'home', source: 'liquipedia', via: 'place' }] },
        Alchemist: { links: [{ region: 'uncharted', event: 'origin', source: 'ours', note: 'нет мест' }] },
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
        { regionId: 'icewrack', placeSlug: 'blueheart-glacier', event: 'origin', source: 'bio' },
        { regionId: 'icewrack', event: 'link', source: 'ours', note: 'сестра' },
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

  it('ошибка, если в английском тексте кириллица (забытый перевод)', () => {
    const bad = content();
    bad.data.description = { ru: 'Ледяной край', en: 'Ледяной край' };
    const { errors } = buildWorld({ ...fixture(), contents: [bad] });
    expect(errors).toEqual([expect.stringMatching(/description: в en кириллица/)]);
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
    f.heroPlaces.heroes['Nobody'] = { links: [{ region: 'icewrack', event: 'origin', source: 'ours' }] };
    f.heroPlaces.heroes['Alchemist'] = {
      links: [
        { place: 'Nowhere', event: 'origin', source: 'ours' },
        { region: 'atlantis', event: 'origin', source: 'ours' },
      ],
    };
    const { errors } = buildWorld(f);
    expect(errors).toHaveLength(3);
  });

  it('модель связей E14: путь, связи героев и профиль попадают в мир (A3)', () => {
    const f = fixture();
    f.heroPlaces.heroes['Crystal Maiden'] = {
      links: [
        { place: 'Blueheart Glacier', event: 'origin', source: 'bio' },
        {
          place: 'Icewrack',
          event: 'exile',
          source: 'liquipedia',
          via: 'lore',
          url: 'https://liquipedia.net/dota2/Crystal_Maiden/Lore',
          doubt: 'изгнание — по пересказу',
        },
      ],
      path: [{ place: 'Blueheart Glacier' }, { place: 'Icewrack' }],
      relations: [{ hero: 'furion', type: 'mentor', place: "Tomo'kan", source: 'ours' }],
      profile: {
        summary: L('cm'),
        art: ['https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/crystal_maiden.png'],
      },
    };
    f.heroPlaces.heroes["Nature's Prophet"].relations = [{ hero: 'crystal_maiden', type: 'student', source: 'ours' }];
    const { world, errors } = buildWorld(f);
    expect(errors).toEqual([]);
    const cm = world.heroes.find((h) => h.key === 'crystal_maiden');
    expect(cm.links[1]).toEqual({
      regionId: 'icewrack',
      placeSlug: 'icewrack',
      event: 'exile',
      source: 'liquipedia',
      via: 'lore',
      url: 'https://liquipedia.net/dota2/Crystal_Maiden/Lore',
      doubt: 'изгнание — по пересказу',
    });
    expect(cm.path).toEqual([
      { regionId: 'icewrack', placeSlug: 'blueheart-glacier' },
      { regionId: 'icewrack', placeSlug: 'icewrack' },
    ]);
    expect(cm.relations).toEqual([
      { hero: 'furion', type: 'mentor', regionId: 'tomokan', placeSlug: 'tomokan', source: 'ours' },
    ]);
    expect(cm.profile.summary).toEqual(L('cm'));
    expect(world.heroes.find((h) => h.key === 'furion').relations[0]).toEqual({
      hero: 'crystal_maiden',
      type: 'student',
      source: 'ours',
    });
    const alchemist = world.heroes.find((h) => h.key === 'alchemist');
    for (const key of ['path', 'relations', 'profile']) expect(alchemist).not.toHaveProperty(key);
  });

  it('источник comic:<id> ссылается на медиа', () => {
    const f = fixture();
    f.heroPlaces.heroes.Alchemist.links.push({ place: 'Icewrack', event: 'visit', source: 'comic:ice-comic' });
    const media = {
      media: [
        {
          id: 'ice-comic',
          type: 'image',
          src: 'https://cdn.steamstatic.com/x.jpg',
          title: L('t'),
          subtitle: L('s'),
          credit: 'Valve Corporation',
          sourceUrl: 'https://www.dota2.com/comics/x',
        },
      ],
    };
    expect(buildWorld({ ...f, media }).errors).toEqual([]);
    f.heroPlaces.heroes.Alchemist.links[1].source = 'comic:nope';
    expect(buildWorld({ ...f, media }).errors).toEqual([
      'research/e1/hero-places.json: Alchemist: links[1]: неизвестное медиа "comic:nope"',
    ]);
  });

  it('ловит ошибки модели связей (A3)', () => {
    const cases = [
      [{ links: [{ place: 'Icewrack', event: 'moved', source: 'bio' }] }, 'event'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'fandom' }] }, 'source'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'bio', via: 'infobox' }] }, 'via'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'liquipedia', url: 'https://example.com/x' }] }, 'url Liquipedia'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'bio', url: 'http://dota2.com' }] }, 'https'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'bio', role: 'origin' }] }, 'неизвестный ключ "role"'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'bio', doubt: ' ' }] }, 'doubt'],
      [
        {
          links: [
            { place: 'Icewrack', event: 'home', source: 'bio' },
            { place: 'Icewrack', event: 'battle', source: 'bio' },
          ],
        },
        'одно место',
      ],
      [{ links: [] }, 'пустой список'],
      [[{ place: 'Icewrack', role: 'origin', basis: 'bio' }], 'ожидается объект'],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'bio' }], path: [{ place: 'Icewrack' }] }, 'path'],
      [
        {
          links: [{ place: 'Icewrack', event: 'home', source: 'bio' }],
          path: [{ place: 'Icewrack' }, { place: 'Blueheart Glacier' }],
        },
        'нет в links',
      ],
      [
        {
          links: [{ place: 'Icewrack', event: 'home', source: 'bio' }],
          relations: [{ hero: 'Nature\'s Prophet', type: 'ally', source: 'bio' }],
        },
        'нужен key',
      ],
      [
        {
          links: [{ place: 'Icewrack', event: 'home', source: 'bio' }],
          relations: [{ hero: 'furion', type: 'friend', source: 'bio' }],
        },
        'type',
      ],
      [
        {
          links: [
            { place: 'Icewrack', event: 'home', source: 'bio' },
            { place: 'Blueheart Glacier', event: 'mention', source: 'bio' },
          ],
          path: [{ place: 'Icewrack' }, { place: 'Blueheart Glacier' }],
        },
        'только упомянуто',
      ],
      [{ links: [{ place: 'Icewrack', event: 'home', source: 'bio' }], profile: { summary: { ru: 'Да', en: 'Да' } } }, 'кириллица'],
      [
        { links: [{ place: 'Icewrack', event: 'home', source: 'bio' }], profile: { summary: { ru: 'я'.repeat(501), en: 'x' } } },
        'длиннее',
      ],
      [
        { links: [{ place: 'Icewrack', event: 'home', source: 'bio' }], profile: { art: ['https://dota2.fandom.com/x.png'] } },
        'Valve',
      ],
    ];
    for (const [entry, message] of cases) {
      const f = fixture();
      f.heroPlaces.heroes.Alchemist = entry;
      const { errors } = buildWorld(f);
      expect(errors.join('\n'), message).toContain(message);
    }
  });

  it('два героя не могут быть наставниками друг друга', () => {
    const f = fixture();
    f.heroPlaces.heroes.Alchemist.relations = [{ hero: 'furion', type: 'mentor', source: 'ours' }];
    f.heroPlaces.heroes["Nature's Prophet"].relations = [{ hero: 'alchemist', type: 'mentor', source: 'ours' }];
    expect(buildWorld(f).errors).toEqual([
      'research/e1/hero-places.json: alchemist и furion оба называют друг друга mentor — у одного должно быть student',
    ]);
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
      subtitle: { ru: 'Комикс', en: 'Comic' },
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

    it('excerpt: только true и только у картинки', () => {
      const page = { ...image(), excerpt: true };
      const ok = buildWorld({ ...fixture(), contents: [withMedia(['ice-comic'])], media: { media: [page] } });
      expect(ok.errors).toEqual([]);
      expect(ok.world.media[0].excerpt).toBe(true);
      const plain = buildWorld({ ...fixture(), contents: [withMedia(['ice-comic'])], media: { media: [image()] } });
      expect(plain.world.media[0]).not.toHaveProperty('excerpt');
      const media = { media: [{ ...image('a'), excerpt: false }, { ...video, excerpt: true }] };
      const bad = buildWorld({ ...fixture(), contents: [withMedia(['a'], [video.id])], media });
      expect(bad.errors).toEqual([expect.stringMatching(/"a".*excerpt/), expect.stringMatching(/excerpt.*картинки/)]);
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
