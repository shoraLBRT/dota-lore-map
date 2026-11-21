import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_LABELS,
  FEEDBACK_LABEL as WORKER_LABEL,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
} from '../../../feedback-worker/src/contract.js';
import { DirectError, directConfig, sendDirect } from './direct';
import { FEEDBACK_KINDS, FEEDBACK_LABEL, feedbackIssue, MESSAGE_LIMIT, type FeedbackContext } from './message';

// Договор окна и функции отзыва (#75): самое длинное, что соберёт окно, функция примет.

const long = (n: number) => 'я'.repeat(n);
const named = { id: long(400), name: long(400) };

/** Контекст, где каждое значение длиннее потолка (300): адрес и id набирает пользователь. */
function worstContext(lang: 'ru' | 'en', kind: FeedbackContext['kind'], block: boolean): FeedbackContext {
  return {
    screen: 'place',
    region: named,
    place: named,
    hero: { ...named, profile: true },
    media: long(400),
    ...(block ? { block: { type: 'hero' as const, ...named }, kind } : {}),
    lang,
    address: `https://shoralbrt.github.io/dota-lore-map/#/${long(2000)}`,
    version: long(400),
  };
}

describe('договор с функцией отзыва', () => {
  it('самый длинный заголовок и текст укладываются в потолки функции', () => {
    const message = `${'Щ'.repeat(MESSAGE_LIMIT - 1)}\n`;
    for (const lang of ['ru', 'en'] as const) {
      for (const block of [false, true]) {
        for (const kind of FEEDBACK_KINDS) {
          const issue = feedbackIssue(message, worstContext(lang, kind, block));
          expect(issue.title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
          expect(issue.body.length).toBeLessThanOrEqual(MAX_BODY_LENGTH);
        }
      }
    }
  });

  it('метки окна — те, что функция ставит, и `feedback` у неё та же', () => {
    expect(WORKER_LABEL).toBe(FEEDBACK_LABEL);
    for (const block of [false, true]) {
      const { labels } = feedbackIssue('текст', worstContext('ru', 'error', block));
      for (const label of labels ?? []) expect(ALLOWED_LABELS).toContain(label);
    }
  });
});

describe('настройки прямой отправки', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('без адреса функции или ключа Turnstile — null (отправка ссылкой)', () => {
    vi.stubEnv('VITE_FEEDBACK_URL', '');
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    expect(directConfig()).toBeNull();
    vi.stubEnv('VITE_FEEDBACK_URL', 'https://feedback.example/');
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', ' ');
    expect(directConfig()).toBeNull();
  });

  it('адрес и ключ заданы — прямая отправка', () => {
    vi.stubEnv('VITE_FEEDBACK_URL', ' https://feedback.example/ ');
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    expect(directConfig()).toEqual({ endpoint: 'https://feedback.example/', siteKey: 'site-key' });
  });
});

describe('sendDirect', () => {
  const issue = { title: 'Отзыв с карты: опечатка', body: 'опечатка', labels: ['feedback'] };

  it('шлёт заголовок, текст, метки и токен; возвращает номер и адрес issue', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ number: 7, url: 'https://github.com/shoraLBRT/dota-lore-map/issues/7' }, { status: 201 }),
    );
    const sent = await sendDirect('https://feedback.example/', issue, 'token', fetchImpl);
    expect(sent).toEqual({ number: 7, url: 'https://github.com/shoraLBRT/dota-lore-map/issues/7' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://feedback.example/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ...issue, token: 'token' });
  });

  it('ответ функции с ошибкой и сбой сети — DirectError с причиной', async () => {
    const rate = vi.fn(async () => Response.json({ error: 'rate' }, { status: 429 }));
    await expect(sendDirect('https://f/', issue, 't', rate)).rejects.toMatchObject({ reason: 'rate' });
    const broken = vi.fn(async () => new Response('oops', { status: 500 }));
    await expect(sendDirect('https://f/', issue, 't', broken)).rejects.toMatchObject({ reason: 'status 500' });
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(sendDirect('https://f/', issue, 't', offline)).rejects.toBeInstanceOf(DirectError);
  });
});
