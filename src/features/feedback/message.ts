// Заголовок, текст и ссылка issue обратной связи (SPEC §6.9, ARCHITECTURE A16). Чистые функции: их же
// возьмут кнопки «Нашли ошибку?» у блоков (#74, поле `block`) и отправка через сервер (#75, `feedbackIssue`).

import type { Lang } from '../../data/types';

/** Потолок длины сообщения, символов (как в Transliterator). */
export const MESSAGE_LIMIT = 1000;
/** Сколько символов первой строки попадает в заголовок. */
export const TITLE_EXCERPT = 60;
/** Потолок длины ссылки на форму issue: GitHub отвечает ошибкой на адреса длиннее ~8 КБ (8192), берём с запасом. */
export const URL_LIMIT = 8000;
/** Потолок длины одного значения контекста (адрес может быть любым, его набирает пользователь). */
const VALUE_LIMIT = 300;

export const FEEDBACK_LABEL = 'feedback';

export type FeedbackScreen = 'intro' | 'world' | 'region' | 'place';

export interface Named {
  id: string;
  name: string;
}

/** Где был пользователь, когда писал. Имена — на языке интерфейса, id — для поиска в данных. */
export interface FeedbackContext {
  screen: FeedbackScreen;
  region?: Named;
  place?: Named;
  hero?: Named & { profile?: boolean };
  /** Открытое медиа галереи (`?media=`). */
  media?: string;
  /** Блок панели, к которому относится сообщение («Нашли ошибку?», #74). */
  block?: string;
  lang: Lang;
  address: string;
  version: string;
}

export interface FeedbackIssue {
  title: string;
  body: string;
}

const TEXT = {
  ru: {
    title: 'Отзыв с карты',
    context: 'Контекст',
    screen: 'Экран',
    screens: { intro: 'заставка', world: 'мир', region: 'регион', place: 'место' },
    region: 'Регион',
    place: 'Место',
    hero: 'Герой',
    profile: 'профиль открыт',
    media: 'Медиа',
    block: 'Блок',
    lang: 'Язык',
    address: 'Адрес',
    version: 'Версия сборки',
    signature: 'Отправлено кнопкой обратной связи.',
  },
  en: {
    title: 'Feedback from the map',
    context: 'Context',
    screen: 'Screen',
    screens: { intro: 'intro', world: 'world', region: 'region', place: 'place' },
    region: 'Region',
    place: 'Place',
    hero: 'Hero',
    profile: 'profile open',
    media: 'Media',
    block: 'Block',
    lang: 'Language',
    address: 'Address',
    version: 'Build version',
    signature: 'Sent with the feedback button.',
  },
} as const;

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

/** Сообщение без пробелов по краям; пустое — отправлять нечего. */
export function cleanMessage(message: string): string {
  return message.trim();
}

/** Заголовок: «Отзыв с карты: <первая непустая строка, не длиннее TITLE_EXCERPT>». */
export function feedbackTitle(message: string, lang: Lang, excerpt = true): string {
  const prefix = TEXT[lang].title;
  const first = cleanMessage(message).split('\n')[0]!.replace(/\s+/g, ' ').trim();
  return excerpt && first ? `${prefix}: ${clip(first, TITLE_EXCERPT)}` : prefix;
}

/** Строки контекста по важности: при длинной ссылке отбрасываются с конца. */
export function contextLines(ctx: FeedbackContext): string[] {
  const t = TEXT[ctx.lang];
  const named = (n: Named) => `${clip(n.name, VALUE_LIMIT)} (\`${clip(n.id, VALUE_LIMIT)}\`)`;
  const lines: string[] = [`${t.address}: ${clip(ctx.address, VALUE_LIMIT)}`];
  if (ctx.block) lines.push(`${t.block}: ${clip(ctx.block, VALUE_LIMIT)}`);
  lines.push(`${t.screen}: ${t.screens[ctx.screen]}`);
  if (ctx.region) lines.push(`${t.region}: ${named(ctx.region)}`);
  if (ctx.place) lines.push(`${t.place}: ${named(ctx.place)}`);
  if (ctx.hero) lines.push(`${t.hero}: ${named(ctx.hero)}${ctx.hero.profile ? `, ${t.profile}` : ''}`);
  if (ctx.media) lines.push(`${t.media}: \`${clip(ctx.media, VALUE_LIMIT)}\``);
  lines.push(`${t.version}: ${clip(ctx.version, VALUE_LIMIT)}`);
  lines.push(`${t.lang}: ${ctx.lang}`);
  return lines;
}

/** Текст issue: сообщение, контекст (`lines` — его строки, по умолчанию все), подпись. */
export function feedbackBody(message: string, ctx: FeedbackContext, lines = contextLines(ctx)): string {
  const t = TEXT[ctx.lang];
  const parts = [cleanMessage(message), '---'];
  if (lines.length > 0) parts.push(`**${t.context}**\n${lines.map((l) => `- ${l}`).join('\n')}`);
  parts.push(`_${t.signature}_`);
  return parts.join('\n\n');
}

/** Заголовок и текст issue целиком — для отправки без ограничений длины ссылки (#75). */
export function feedbackIssue(message: string, ctx: FeedbackContext): FeedbackIssue {
  return { title: feedbackTitle(message, ctx.lang), body: feedbackBody(message, ctx) };
}

/** Ссылка на форму нового issue с заполненными заголовком, текстом и меткой. */
export function newIssueUrl(repo: string, issue: FeedbackIssue, label = FEEDBACK_LABEL): string {
  const q = (s: string) => encodeURIComponent(s);
  return `${repo}/issues/new?title=${q(issue.title)}&body=${q(issue.body)}&labels=${q(label)}`;
}

export interface FittedUrl {
  url: string;
  /** Сколько строк контекста не поместилось в ссылку. */
  dropped: number;
}

/**
 * Ссылка на форму issue не длиннее `limit`. Сообщение не сокращается никогда: сначала отбрасываются строки
 * контекста с наименее важной, затем выдержка в заголовке. Не помещается и так — `null` (сообщение
 * слишком длинное для ссылки, обычно из-за символов, которые кодируются в 9–12 знаков).
 */
export function feedbackUrl(repo: string, message: string, ctx: FeedbackContext, limit = URL_LIMIT): FittedUrl | null {
  if (!cleanMessage(message)) return null;
  const all = contextLines(ctx);
  for (let keep = all.length; keep >= 0; keep -= 1) {
    const url = newIssueUrl(repo, { title: feedbackTitle(message, ctx.lang), body: feedbackBody(message, ctx, all.slice(0, keep)) });
    if (url.length <= limit) return { url, dropped: all.length - keep };
  }
  const bare = newIssueUrl(repo, { title: feedbackTitle(message, ctx.lang, false), body: feedbackBody(message, ctx, []) });
  return bare.length <= limit ? { url: bare, dropped: all.length } : null;
}
