// Граница ошибок вокруг приложения (ARCHITECTURE A14, #107): исключение при отрисовке показывает экран
// «Что-то сломалось» вместо пустой страницы. Провайдеры могли упасть вместе с приложением, поэтому язык берётся
// прямо из `localStorage`/браузера (`detectLang`), а тексты лежат здесь же, на двух языках.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { feedbackUrl, type FeedbackContext } from '../features/feedback/message';
import { detectLang } from '../i18n';
import type { Lang } from '../data/types';
import { BUILD_VERSION, REPO_URL } from './project';
import { parseHash } from './router';
import styles from './ErrorBoundary.module.css';

/** Потолок длины текста ошибки в отчёте: сообщение и начало стека (A16 — значение контекста не длиннее 300). */
export const ERROR_TEXT_LIMIT = 300;

const TEXT = {
  ru: {
    title: 'Что-то сломалось',
    body: 'Карта не смогла показать этот экран. Попробуйте перезагрузить страницу или вернуться на карту мира.',
    reload: 'Перезагрузить',
    world: 'На карту мира',
    report: 'Сообщить об ошибке ↗',
    reportName: 'Сообщить об ошибке (откроется GitHub в новой вкладке)',
    message: 'Ошибка в приложении',
  },
  en: {
    title: 'Something went wrong',
    body: 'The map could not show this screen. Try reloading the page or going back to the world map.',
    reload: 'Reload',
    world: 'Back to the world map',
    report: 'Report the error ↗',
    reportName: 'Report the error (opens GitHub in a new tab)',
    message: 'Application error',
  },
} as const;

/** Текст ошибки для отчёта: имя, сообщение и начало стека, всего не длиннее `ERROR_TEXT_LIMIT`. */
export function errorText(error: unknown): string {
  let text: string;
  if (error instanceof Error) {
    const head = `${error.name}: ${error.message}`;
    // V8 начинает стек с той же строки «Имя: сообщение» — не повторяем её.
    let stack = error.stack ?? '';
    if (stack.startsWith(head)) stack = stack.slice(head.length);
    stack = stack.trim();
    text = stack ? `${head}\n${stack}` : head;
  } else {
    text = String(error);
  }
  return text.length > ERROR_TEXT_LIMIT ? `${text.slice(0, ERROR_TEXT_LIMIT - 1).trimEnd()}…` : text;
}

/** Ссылка на форму issue: сообщение — текст ошибки, контекст — адрес, экран, версия и язык (A16). */
export function errorReportUrl(error: unknown, lang: Lang, href: string, hash: string): string | null {
  let screen: FeedbackContext['screen'] = 'intro';
  try {
    screen = parseHash(hash).screen.name;
  } catch {
    // Адрес мог и сам быть причиной — тогда экран неизвестен, остаётся заставка.
  }
  const message = `${TEXT[lang].message}:\n\n\`\`\`\n${errorText(error)}\n\`\`\``;
  const ctx: FeedbackContext = { screen, lang, address: href, version: BUILD_VERSION };
  return feedbackUrl(REPO_URL, message, ctx)?.url ?? null;
}

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorScreen error={this.state.error} />;
  }
}

function ErrorScreen({ error }: { error: unknown }) {
  const lang = detectLang();
  const t = TEXT[lang];
  const report = errorReportUrl(error, lang, window.location.href, window.location.hash);
  const toWorld = () => {
    window.location.hash = '#/world';
    window.location.reload();
  };
  return (
    <main className={styles.screen} lang={lang}>
      <div className={styles.card} role="alert">
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.body}>{t.body}</p>
        <div className={styles.actions}>
          <Button onClick={() => window.location.reload()}>{t.reload}</Button>
          <Button variant="ghost" onClick={toWorld}>
            {t.world}
          </Button>
        </div>
        {report && (
          <a className={styles.report} href={report} target="_blank" rel="noopener noreferrer" aria-label={t.reportName}>
            {t.report}
          </a>
        )}
      </div>
    </main>
  );
}
