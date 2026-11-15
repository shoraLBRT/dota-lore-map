import { describe, expect, it } from 'vitest';
import { parseHash } from '../../app/router';
import { feedbackContext } from './context';
import {
  contextLines,
  feedbackBody,
  feedbackIssue,
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

  it('по-английски — английские подписи; блок панели (#74) — вторая строка после адреса', () => {
    const lines = contextLines({ ...ctx, lang: 'en', block: 'Traits' });
    expect(lines[0]).toMatch(/^Address: /);
    expect(lines[1]).toBe('Block: Traits');
    expect(lines).toContain('Screen: place');
    expect(feedbackIssue('x', { ...ctx, lang: 'en' }).body).toContain('_Sent with the feedback button._');
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
    const c = feedbackContext(route, 'en', 'https://x.test/', 'Block');
    expect(c.screen).toBe('region');
    expect(c.region).toEqual({ id: 'icewrack', name: 'Icewrack' });
    expect(c.hero).toEqual({ id: 'crystal_maiden', name: 'Crystal Maiden', profile: true });
    expect(c.block).toBe('Block');
    expect(c.version).toMatch(/^\d+\.\d+\.\d+/);
    const unknown = feedbackContext(parseHash('#/r/nowhere/void'), 'ru', 'https://x.test/');
    expect(unknown.region).toEqual({ id: 'nowhere', name: 'nowhere' });
    expect(unknown.place).toEqual({ id: 'void', name: 'void' });
    expect(unknown.hero).toBeUndefined();
  });
});
