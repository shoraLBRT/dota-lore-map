// @vitest-environment node
import { describe, expect, it } from 'vitest';
import world from '../src/data/world.generated.json';
import { checkAll, checkUrl, collectUrls, isAllowedHost, USER_AGENT } from './check-links.mjs';

// Проверка внешних ссылок (#109): сбор адресов и логика запросов — без сети.

const sample = {
  heroes: [{ key: 'axe', profile: { art: ['https://cdn.steamstatic.com/apps/dota2/images/x.jpg'] } }, { key: 'lina' }],
  media: [
    { id: 'c', type: 'image', src: { ru: 'https://cdn.steamstatic.com/ru/01.jpg', en: 'https://cdn.steamstatic.com/en/01.jpg' }, sourceUrl: 'https://www.dota2.com/comics/c' },
    { id: 'a', type: 'image', src: 'https://clan.fastly.steamstatic.com/card.png', sourceUrl: 'https://store.steampowered.com/app/583950' },
    { id: 'v', type: 'youtube', youtubeId: '7QxnMnBYziA', sourceUrl: 'https://www.youtube.com/watch?v=7QxnMnBYziA' },
    { id: 'local', type: 'image', src: '/media/local.png' },
    { id: 'dup', type: 'image', src: 'https://cdn.steamstatic.com/en/01.jpg' },
  ],
  regions: [{ id: 'r', places: [{ slug: 'p', art: 'https://liquipedia.net/x.png' }] }],
};

describe('check-links: сбор адресов', () => {
  it('портрет, шапка и рендер героя, profile.art, src RU/EN, oEmbed; без повторов', () => {
    const urls = collectUrls(sample).map((i) => i.url);
    expect(urls).toContain('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png');
    expect(urls).toContain('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/crops/lina.png');
    expect(urls).toContain('https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/lina.png');
    expect(urls).toContain('https://cdn.steamstatic.com/apps/dota2/images/x.jpg');
    expect(urls).toContain('https://cdn.steamstatic.com/ru/01.jpg');
    expect(urls).toContain('https://clan.fastly.steamstatic.com/card.png');
    expect(urls).toContain(
      'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D7QxnMnBYziA&format=json',
    );
    expect(urls).toHaveLength(2 * 3 + 1 + 2 + 1 + 1);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('не опрашивает sourceUrl, Liquipedia, dota2.com и относительные пути', () => {
    const urls = collectUrls(sample).map((i) => i.url);
    expect(urls.some((u) => /dota2\.com|steampowered|liquipedia|watch\?v=/.test(u))).toBe(false);
    expect(urls.some((u) => !u.startsWith('https://'))).toBe(false);
    expect(isAllowedHost('https://liquipedia.net/dota2/api.php')).toBe(false);
    expect(isAllowedHost('https://evilsteamstatic.com/x')).toBe(false);
  });

  it('на настоящих данных: у каждого героя три картинки, все хосты разрешены', () => {
    const items = collectUrls(world);
    expect(items.length).toBeGreaterThanOrEqual(world.heroes.length * 3 + world.media.length);
    expect(items.every((i) => isAllowedHost(i.url))).toBe(true);
  });
});

const fakeFetch = (statusByMethod, calls = []) => async (url, init) => {
  calls.push({ url, method: init.method, headers: init.headers });
  const s = statusByMethod[init.method];
  if (s instanceof Error) throw s;
  return { status: typeof s === 'function' ? s(calls.length) : s, body: null };
};

describe('check-links: запросы', () => {
  it('HEAD 200 — ок, свой User-Agent', async () => {
    const calls = [];
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', fakeFetch({ HEAD: 200 }, calls))).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].headers['User-Agent']).toBe(USER_AGENT);
  });

  it('HEAD 405 — GET с Range: bytes=0-0', async () => {
    const calls = [];
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', fakeFetch({ HEAD: 405, GET: 206 }, calls))).toBeNull();
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
    expect(calls[1].headers.Range).toBe('bytes=0-0');
  });

  it('404 — сломан без повтора; 503 на HEAD — GET с Range; 5xx и ошибка сети — повторы', async () => {
    const noWait = [0, 0];
    let calls = [];
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', fakeFetch({ HEAD: 404 }, calls), noWait)).toBe('HTTP 404');
    expect(calls).toHaveLength(1);
    calls = [];
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', fakeFetch({ HEAD: 503, GET: 206 }, calls), noWait)).toBeNull();
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
    calls = [];
    const flaky = fakeFetch({ HEAD: 503, GET: (n) => (n < 4 ? 503 : 206) }, calls);
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', flaky, noWait)).toBeNull();
    expect(calls).toHaveLength(4);
    calls = [];
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', fakeFetch({ HEAD: 503, GET: 503 }, calls), noWait)).toBe('HTTP 503');
    expect(calls).toHaveLength(6);
    calls = [];
    expect(await checkUrl('https://cdn.steamstatic.com/a.png', fakeFetch({ HEAD: new Error('down') }, calls), noWait)).toBe('down');
    expect(calls).toHaveLength(3);
  });

  it('oEmbed опрашивается GET', async () => {
    const calls = [];
    await checkUrl('https://www.youtube.com/oembed?url=x&format=json', fakeFetch({ GET: 200 }, calls));
    expect(calls[0].method).toBe('GET');
  });

  it('checkAll возвращает только сломанные', async () => {
    const items = [
      { url: 'https://cdn.steamstatic.com/ok.png', where: 'a' },
      { url: 'https://cdn.steamstatic.com/bad.png', where: 'b' },
    ];
    const f = async (url) => ({ status: url.includes('bad') ? 404 : 200, body: null });
    expect(await checkAll(items, f)).toEqual([{ ...items[1], error: 'HTTP 404' }]);
  });
});
