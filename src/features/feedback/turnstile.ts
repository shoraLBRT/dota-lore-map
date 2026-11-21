// Проверка «не робот» перед отправкой отзыва в функцию (#75) — Cloudflare Turnstile, как в Transliterator.
// Скрипт чужой и грузится только при открытии окна отзыва в режиме прямой отправки: кто окно не открывает,
// тот к Cloudflare не обращается. В режиме interaction-only виджет невидим, пока проверке хватает фона браузера.

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Lang } from '../../data/types';

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Та часть API Turnstile, которой пользуется окно. */
export interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widget: string): void;
  remove(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Грузит скрипт Turnstile один раз; не загрузился (блокировщик, нет сети) — следующая попытка грузит заново. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile is missing')));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Turnstile did not load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export interface Guard {
  /** Токен проверки; пусто — проверка ещё идёт. Токен одноразовый: после отправки — `renew()`. */
  token: string;
  /** Проверке нужен человек: виджет показал флажок. */
  interactive: boolean;
  /** Turnstile не загрузился или сломался — остаётся ссылка на форму GitHub. */
  failed: boolean;
  /** Новый токен после отправки (прежний функция уже потратила). */
  renew(): void;
}

/** Ошибок подряд, после которых проверка считается недоступной. */
const RETRIES = 3;

/** Виджет Turnstile в `ref`, пока окно открыто; `siteKey` пустой — проверки нет (отправка ссылкой). */
export function useTurnstile(ref: RefObject<HTMLDivElement>, siteKey: string | null, lang: Lang): Guard {
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const [token, setToken] = useState('');
  const [interactive, setInteractive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let errors = 0;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return;
        const id = api.render(ref.current, {
          sitekey: siteKey,
          language: lang,
          appearance: 'interaction-only',
          callback: (value: string) => {
            errors = 0;
            setToken(value);
            setInteractive(false);
          },
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
          'expired-callback': () => {
            setToken('');
            api.reset(id);
          },
          'timeout-callback': () => {
            setToken('');
            api.reset(id);
          },
          'error-callback': () => {
            setToken('');
            errors += 1;
            if (errors >= RETRIES) setFailed(true);
            else api.reset(id);
            return true; // ошибка обработана: Turnstile не бросает её в консоль
          },
        });
        widget.current = { api, id };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      const current = widget.current;
      widget.current = null;
      try {
        current?.api.remove(current.id);
      } catch {
        // Виджет уже убран вместе с окном.
      }
    };
    // Язык виджета — на момент открытия окна: смена языка при открытом окне проверку не перезапускает.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, siteKey]);

  const renew = () => {
    setToken('');
    const current = widget.current;
    current?.api.reset(current.id);
  };

  return { token, interactive, failed, renew };
}
