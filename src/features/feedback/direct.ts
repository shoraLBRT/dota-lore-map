// Отправка отзыва без аккаунта GitHub (#75, ARCHITECTURE A16): окно шлёт готовое issue в функцию
// `feedback-worker/`, она проверяет Turnstile и заводит issue от имени GitHub App. Не настроено или
// не вышло — прежний путь, ссылка на форму issue (#73).

import type { FeedbackIssue } from './message';

export interface DirectConfig {
  /** Адрес функции отзыва. */
  endpoint: string;
  /** Публичный ключ сайта Cloudflare Turnstile. */
  siteKey: string;
}

/**
 * Настройки из `.env` (`VITE_FEEDBACK_URL`, `VITE_TURNSTILE_SITE_KEY`); без адреса или ключа — `null`,
 * и окно отправляет ссылкой. Читаются при каждом открытии окна: тесты подменяют их `vi.stubEnv`.
 */
export function directConfig(): DirectConfig | null {
  const endpoint = String(import.meta.env.VITE_FEEDBACK_URL ?? '').trim();
  const siteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();
  return endpoint && siteKey ? { endpoint, siteKey } : null;
}

export interface SentIssue {
  number: number;
  url: string;
}

/** Ответ функции, кроме успеха: `captcha` — проверка не прошла, `rate` — лимит, остальное — сбой. */
export class DirectError extends Error {
  constructor(readonly reason: string) {
    super(`feedback: ${reason}`);
  }
}

/** Отправляет issue и токен Turnstile в функцию; ошибка сети или ответа — `DirectError`. */
export async function sendDirect(
  endpoint: string,
  issue: FeedbackIssue,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SentIssue> {
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: issue.title, body: issue.body, labels: issue.labels, token }),
    });
  } catch {
    throw new DirectError('network');
  }
  const data = (await response.json().catch(() => null)) as Partial<SentIssue> & { error?: string } | null;
  if (response.status !== 201 || typeof data?.number !== 'number' || typeof data.url !== 'string') {
    throw new DirectError(data?.error ?? `status ${response.status}`);
  }
  return { number: data.number, url: data.url };
}
