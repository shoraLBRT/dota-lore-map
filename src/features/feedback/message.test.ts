import { describe, expect, it } from 'vitest';
import { parseHash } from '../../app/router';
import { getHero, getPlace, getRegion } from '../../data/world';
import { feedbackContext, heroBlock, mediaBlock, placeBlock, regionBlock } from './context';
import {
  contextLines,
  feedbackBody,
  feedbackIssue,
  feedbackLabels,
  feedbackTitle,
  feedbackUrl,
  MESSAGE_LIMIT,
  newIssueUrl,
  URL_LIMIT,
  type FeedbackContext,
} from './message';

const REPO = 'https://github.com/owner/repo';

const ctx: FeedbackContext = {
  screen: 'place',
  region: { id: 'icewrack', name: 'Ледяной Предел' },
  place: { id: 'tower', name: 'Башня' },
  hero: { id: 'crystal_maiden', name: 'Crystal Maiden', profile: true },
  lang: 'ru',
  address: 'https://example.test/dota-lore-map/#/r/icewrack/tower?hero=crystal_maiden&profile',
  version: '0.1.0+abc1234',
};

function params(url: string) {
  return new URL(url).searchParams;
}

describe('формат issue обратной связи (SPEC §6.9)', () => {
  it('заголовок — «Отзыв с карты: <первая строка>», выдержка не длиннее 60 символов', () => {
    expect(feedbackTitle('  Опечатка в регионе\nподробности', 'ru')).toBe('Отзыв с карты: Опечатка в регионе');
    expect(feedbackTitle('Typo', 'en')).toBe('Feedback from the map: Typo');
    const long = feedbackTitle('а'.repeat(200), 'ru');
    expect(long.length).toBe('Отзыв с карты: '.length + 60);
    expect(long.endsWith('…')).toBe(true);
  });

  it('текст: сообщение, контекст (экран, регион, место, герой, язык, адрес, версия), подпись', () => {
    const body = feedbackBody('Нашёл ошибку', ctx);
    expect(body.startsWith('Нашёл ошибку\n\n---\n\n**Контекст**')).toBe(true);
    for (const part of [
      'Экран: место',
      'Регион: Ледяной Предел (`icewrack`)',
      'Место: Башня (`tower`)',
      'Герой: Crystal Maiden (`crystal_maiden`), профиль открыт',
      'Язык: ru',
      `Адрес: ${ctx.address}`,
      'Версия сборки: 0.1.0+abc1234',
    ]) {
      expect(body).toContain(`- ${part}`);
    }
    expect(body.endsWith('_Отправлено кнопкой обратной связи._')).toBe(true);
  });

  it('по-английски — английские подписи; блок (#74) и вид отзыва — сразу после адреса', () => {
    const lines = contextLines({ ...ctx, lang: 'en', block: { type: 'place', id: 'icewrack/tower', name: 'Tower' }, kind: 'addition' });
    expect(lines[0]).toMatch(/^Address: /);
    expect(lines[1]).toBe('Block: place Tower (`icewrack/tower`)');
    expect(lines[2]).toBe('Kind: addition');
    expect(lines).toContain('Screen: place');
    expect(feedbackIssue('x', { ...ctx, lang: 'en' }).body).toContain('_Sent with the feedback button._');
  });

  it('отзыв о блоке (#74): заголовок по виду, метки feedback и content-fix, блок и вид в контексте', () => {
    const block = { type: 'region' as const, id: 'icewrack', name: 'Айсрак' };
    const withBlock = { ...ctx, block };
    expect(feedbackTitle('Не тот правитель', 'ru', true, block)).toBe('Ошибка в «Айсрак»: Не тот правитель');
    expect(feedbackTitle('x', 'ru', true, block, 'addition')).toBe('Дополнение к «Айсрак»: x');
    expect(feedbackTitle('x', 'ru', true, block, 'other')).toBe('Отзыв о «Айсрак»: x');
    expect(feedbackTitle('x', 'ru', false, block, 'other')).toBe('Отзыв о «Айсрак»');
    const en = { ...block, name: 'Icewrack' };
    expect(feedbackTitle('x', 'en', true, en)).toBe('Mistake in “Icewrack”: x');
    expect(feedbackTitle('x', 'en', true, en, 'addition')).toBe('Addition to “Icewrack”: x');
    expect(feedbackTitle('x', 'en', true, en, 'other')).toBe('Feedback on “Icewrack”: x');
    expect(feedbackTitle('x', 'ru', true, { ...block, name: 'б'.repeat(200) })).toBe(`Ошибка в «${'б'.repeat(59)}…»: x`);
    expect(feedbackTitle('x', 'ru', true, { ...block, name: '«Новые соседи»' })).toBe('Ошибка в «Новые соседи»: x');
    expect(feedbackTitle('x', 'en', true, { ...block, name: '“The New Neighbors”' })).toBe('Mistake in “The New Neighbors”: x');

    expect(feedbackLabels(ctx)).toEqual(['feedback']);
    expect(feedbackLabels(withBlock)).toEqual(['feedback', 'content-fix']);
    const issue = feedbackIssue('Не тот правитель', withBlock);
    expect(issue.title).toBe('Ошибка в «Айсрак»: Не тот правитель');
    expect(issue.body).toContain('- Блок: регион Айсрак (`icewrack`)\n- Вид: ошибка');
    const p = params(feedbackUrl(REPO, 'Не тот правитель', { ...withBlock, kind: 'other' })!.url);
    expect(p.get('labels')).toBe('feedback,content-fix');
    expect(p.get('title')).toBe('Отзыв о «Айсрак»: Не тот правитель');
    expect(p.get('body')).toContain('- Вид: другое');
  });

  it('длинный отзыв о блоке: выдержка уходит раньше адреса, название блока в заголовке остаётся', () => {
    const block = { type: 'hero' as const, id: 'crystal_maiden', name: 'Crystal Maiden' };
    const message = 'ж'.repeat(MESSAGE_LIMIT);
    const withBlock = { ...ctx, block };
    const minimal = newIssueUrl(REPO, {
      title: feedbackTitle(message, 'ru', false, block),
      body: feedbackBody(message, withBlock, contextLines(withBlock).slice(0, 1)),
      labels: feedbackLabels(withBlock),
    });
    const p = params(feedbackUrl(REPO, message, withBlock, minimal.length)!.url);
    expect(p.get('title')).toBe('Ошибка в «Crystal Maiden»');
    expect(p.get('body')).toContain('Адрес:');
  });

  it('ссылка — форма нового issue с заголовком, текстом и меткой feedback', () => {
    const url = newIssueUrl(REPO, { title: 'Т & т', body: 'a\nb #1' });
    expect(url.startsWith(`${REPO}/issues/new?`)).toBe(true);
    const p = params(url);
    expect(p.get('title')).toBe('Т & т');
    expect(p.get('body')).toBe('a\nb #1');
    expect(p.get('labels')).toBe('feedback');
  });

  it('пустое сообщение не отправляется', () => {
    expect(feedbackUrl(REPO, '   \n ', ctx)).toBeNull();
  });

  it('обычное сообщение — весь контекст, ссылка короче потолка', () => {
    const fitted = feedbackUrl(REPO, 'Спасибо!', ctx)!;
    expect(fitted.dropped).toBe(0);
    expect(params(fitted.url).get('body')).toBe(feedbackBody('Спасибо!', ctx));
  });

  it('1000 символов кириллицы — сообщение целиком, адрес на месте, ссылка не длиннее потолка', () => {
    const message = 'ж'.repeat(MESSAGE_LIMIT);
    const fitted = feedbackUrl(REPO, message, ctx)!;
    expect(fitted.url.length).toBeLessThanOrEqual(URL_LIMIT);
    const body = params(fitted.url).get('body')!;
    expect(body.startsWith(message)).toBe(true);
    expect(body).toContain(`Адрес: ${ctx.address}`);
  });

  it('значения контекста обрезаются до 300 символов', () => {
    const [address] = contextLines({ ...ctx, address: `https://x.test/#/${'a'.repeat(5000)}` });
    expect(address).toMatch(/^Адрес: https:\/\/x\.test\/#\/a+…$/);
    expect(address!.length).toBe('Адрес: '.length + 300);
  });

  it('длинная ссылка — строки контекста отбрасываются с наименее важной, сообщение не трогается', () => {
    const message = 'ж'.repeat(MESSAGE_LIMIT);
    const full = feedbackUrl(REPO, message, ctx, 100_000)!;
    const fitted = feedbackUrl(REPO, message, ctx, full.url.length - 1)!;
    expect(fitted.dropped).toBe(1);
    const body = params(fitted.url).get('body')!;
    expect(body.startsWith(message)).toBe(true);
    expect(body).not.toContain('Язык:');
    expect(body).toContain('Адрес:');
  });

  it('сообщение, которое само не помещается в ссылку, не обрезается: null', () => {
    // «€» — 3 байта UTF-8, 9 знаков в ссылке: 1000 таких — 9000 знаков.
    expect(feedbackUrl(REPO, '€'.repeat(MESSAGE_LIMIT), ctx)).toBeNull();
  });

  it('адрес важнее выдержки в заголовке: сначала уходит выдержка, потом адрес', () => {
    const message = 'ж'.repeat(MESSAGE_LIMIT);
    const withAddress = newIssueUrl(REPO, {
      title: feedbackTitle(message, 'ru', false),
      body: feedbackBody(message, ctx, contextLines(ctx).slice(0, 1)),
    });
    const fitted = feedbackUrl(REPO, message, ctx, withAddress.length)!;
    expect(fitted.url).toBe(withAddress);
    expect(params(fitted.url).get('title')).toBe('Отзыв с карты');
  });

  it('без места для контекста — голый заголовок и сообщение с подписью', () => {
    const message = 'ж'.repeat(MESSAGE_LIMIT);
    const bare = newIssueUrl(REPO, { title: feedbackTitle(message, 'ru', false), body: feedbackBody(message, ctx, []) });
    const fitted = feedbackUrl(REPO, message, ctx, bare.length)!;
    expect(fitted.url).toBe(bare);
    expect(params(fitted.url).get('title')).toBe('Отзыв с карты');
  });
});

describe('контекст из адреса', () => {
  it('имена региона, места и героя — на языке интерфейса, неизвестные id — как есть', () => {
    const route = parseHash('#/r/icewrack?hero=crystal_maiden&profile');
    const c = feedbackContext(route, 'en', 'https://x.test/', regionBlock(getRegion('icewrack')!));
    expect(c.screen).toBe('region');
    expect(c.region).toEqual({ id: 'icewrack', name: 'Icewrack' });
    expect(c.hero).toEqual({ id: 'crystal_maiden', name: 'Crystal Maiden', profile: true });
    expect(c.block).toEqual({ type: 'region', id: 'icewrack', name: 'Icewrack' });
    expect(c.kind).toBe('error');
    expect(feedbackContext(route, 'ru', 'https://x.test/').block).toBeUndefined();
    expect(c.version).toMatch(/^\d+\.\d+\.\d+/);
    const unknown = feedbackContext(parseHash('#/r/nowhere/void'), 'ru', 'https://x.test/');
    expect(unknown.region).toEqual({ id: 'nowhere', name: 'nowhere' });
    expect(unknown.place).toEqual({ id: 'void', name: 'void' });
    expect(unknown.hero).toBeUndefined();
  });
});

describe('блоки «Нашли ошибку?» (#74)', () => {
  it('регион, место, герой и медиа: тип, id в данных, название на обоих языках', () => {
    const region = getRegion('icewrack')!;
    expect(regionBlock(region)).toEqual({ type: 'region', id: 'icewrack', name: region.name });
    const place = region.places[0]!;
    const pb = placeBlock(region, place);
    expect(pb.type).toBe('place');
    expect(pb.id).toBe(`icewrack/${place.slug}`);
    expect(getPlace('icewrack', place.slug)).toBe(place);
    expect(pb.name.ru).toBeTruthy();
    expect(pb.name.en).toBeTruthy();
    const hero = getHero('crystal_maiden')!;
    expect(heroBlock(hero)).toEqual({ type: 'hero', id: 'crystal_maiden', name: { ru: hero.name, en: hero.name } });
    const media = { id: 'm1', type: 'image' as const, title: { ru: 'Арт', en: 'Art' }, subtitle: { ru: '', en: '' }, credit: 'x', sourceUrl: 'https://x.test/' };
    expect(mediaBlock(media)).toEqual({ type: 'media', id: 'm1', name: { ru: 'Арт', en: 'Art' } });
    const c = feedbackContext(parseHash('#/world?media=m1'), 'ru', 'https://x.test/', mediaBlock(media), 'addition');
    expect(c.block).toEqual({ type: 'media', id: 'm1', name: 'Арт' });
    expect(c.kind).toBe('addition');
  });
});
