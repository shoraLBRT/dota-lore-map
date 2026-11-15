// Заголовок, текст и ссылка issue обратной связи (SPEC §6.9, ARCHITECTURE A16). Чистые функции: общий отзыв
// (кнопка в левой панели), отзыв о блоке («Нашли ошибку?», #74: поля `block` и `kind`) и отправка через сервер
// (#75, `feedbackIssue`) — один формат.

import type { Lang } from '../../data/types';

/** Потолок длины сообщения, символов (как в Transliterator). */
export const MESSAGE_LIMIT = 1000;
/** Сколько символов первой строки попадает в заголовок. */
export const TITLE_EXCERPT = 60;
/**
 * Потолок длины ссылки на форму issue. Замер 2026-11-15 (ARCHITECTURE A16): без входа в GitHub ссылка длиннее
 * ~6900 знаков отвечает 500 вместо переадресации ко входу, длиннее ~9000 — 414. Берём с запасом в 200 знаков.
 */
export const URL_LIMIT = 6700;
/** Потолок длины одного значения контекста (адрес может быть любым, его набирает пользователь). */
const VALUE_LIMIT = 300;

export const FEEDBACK_LABEL = 'feedback';
/** Вторая метка отзыва о блоке с контентом (#74): правка текста, а не интерфейса. */
export const CONTENT_FIX_LABEL = 'content-fix';
/** Потолок длины названия блока в заголовке issue. */
const NAME_LIMIT = 60;

export type FeedbackScreen = 'intro' | 'world' | 'region' | 'place';

export interface Named {
  id: string;
  name: string;
}

/** О каком блоке отзыв («Нашли ошибку?», #74): панель региона или места, профиль героя, медиа в галерее. */
export type FeedbackBlockType = 'region' | 'place' | 'hero' | 'media';

/** Что сообщают о блоке: ошибку, дополнение или другое. */
export type FeedbackKind = 'error' | 'addition' | 'other';

export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['error', 'addition', 'other'];

export interface FeedbackBlock extends Named {
  type: FeedbackBlockType;
}

/** Где был пользователь, когда писал. Имена — на языке интерфейса, id — для поиска в данных. */
export interface FeedbackContext {
  screen: FeedbackScreen;
  region?: Named;
  place?: Named;
  hero?: Named & { profile?: boolean };
  /** Открытое медиа галереи (`?media=`). */
  media?: string;
  /** Блок, к которому относится сообщение («Нашли ошибку?», #74); имя — на языке интерфейса. */
  block?: FeedbackBlock;
  /** Вид отзыва о блоке; без блока не используется. По умолчанию — ошибка. */
  kind?: FeedbackKind;
  lang: Lang;
  address: string;
  version: string;
}

export interface FeedbackIssue {
  title: string;
  body: string;
  /** Метки; без поля — только `feedback`. */
  labels?: string[];
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
    blocks: { region: 'регион', place: 'место', hero: 'профиль героя', media: 'медиа' },
    kind: 'Вид',
    kinds: { error: 'ошибка', addition: 'дополнение', other: 'другое' },
    /** Заголовок отзыва о блоке: «Ошибка в «Айсрак»». */
    blockTitles: { error: 'Ошибка в «{name}»', addition: 'Дополнение к «{name}»', other: 'Отзыв о «{name}»' },
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
    blocks: { region: 'region', place: 'place', hero: 'hero profile', media: 'media' },
    kind: 'Kind',
    kinds: { error: 'mistake', addition: 'addition', other: 'other' },
    blockTitles: { error: 'Mistake in “{name}”', addition: 'Addition to “{name}”', other: 'Feedback on “{name}”' },
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

/**
 * Заголовок: «<начало>: <первая непустая строка, не длиннее TITLE_EXCERPT>». Начало — «Отзыв с карты»,
 * у отзыва о блоке — по виду: «Ошибка в «Айсрак»», «Дополнение к «Айсрак»», «Отзыв о «Айсрак»» (SPEC §6.9).
 */
export function feedbackTitle(message: string, lang: Lang, excerpt = true, block?: FeedbackBlock, kind?: FeedbackKind): string {
  const t = TEXT[lang];
  // Название уже в кавычках («Новые соседи») — вторые не добавляем.
  const name = block ? clip(block.name.trim().replace(/^[«“"]+|[»”"]+$/g, ''), NAME_LIMIT) : '';
  const prefix = block ? t.blockTitles[kind ?? 'error'].replace('{name}', name) : t.title;
  const first = cleanMessage(message).split('\n')[0]!.replace(/\s+/g, ' ').trim();
  return excerpt && first ? `${prefix}: ${clip(first, TITLE_EXCERPT)}` : prefix;
}

/** Строки контекста по важности: при длинной ссылке отбрасываются с конца. */
export function contextLines(ctx: FeedbackContext): string[] {
  const t = TEXT[ctx.lang];
  const named = (n: Named) => `${clip(n.name, VALUE_LIMIT)} (\`${clip(n.id, VALUE_LIMIT)}\`)`;
  const lines: string[] = [`${t.address}: ${clip(ctx.address, VALUE_LIMIT)}`];
  if (ctx.block) {
    lines.push(`${t.block}: ${t.blocks[ctx.block.type]} ${named(ctx.block)}`);
    lines.push(`${t.kind}: ${t.kinds[ctx.kind ?? 'error']}`);
  }
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
  return {
    title: feedbackTitle(message, ctx.lang, true, ctx.block, ctx.kind),
    body: feedbackBody(message, ctx),
    labels: feedbackLabels(ctx),
  };
}

/** Метки issue: `feedback`, у отзыва о блоке ещё `content-fix` (при любом виде — речь о контенте). */
export function feedbackLabels(ctx: FeedbackContext): string[] {
  return ctx.block ? [FEEDBACK_LABEL, CONTENT_FIX_LABEL] : [FEEDBACK_LABEL];
}

/** Ссылка на форму нового issue с заполненными заголовком, текстом и метками (через запятую, как ждёт GitHub). */
export function newIssueUrl(repo: string, issue: FeedbackIssue): string {
  const q = (s: string) => encodeURIComponent(s);
  const labels = (issue.labels ?? [FEEDBACK_LABEL]).join(',');
  return `${repo}/issues/new?title=${q(issue.title)}&body=${q(issue.body)}&labels=${q(labels)}`;
}

export interface FittedUrl {
  url: string;
  /** Сколько строк контекста не поместилось в ссылку. */
  dropped: number;
}

/**
 * Ссылка на форму issue не длиннее `limit`. Сообщение не сокращается никогда: сначала отбрасываются строки
 * контекста с наименее важной (адрес остаётся), затем выдержка в заголовке, затем адрес. Не помещается
 * и так — `null`: сообщение слишком длинное для ссылки (кириллица — 6 знаков на букву, иероглифы и эмодзи — 9–12).
 */
export function feedbackUrl(repo: string, message: string, ctx: FeedbackContext, limit = URL_LIMIT): FittedUrl | null {
  if (!cleanMessage(message)) return null;
  const all = contextLines(ctx);
  const labels = feedbackLabels(ctx);
  const attempt = (excerpt: boolean, keep: number) =>
    newIssueUrl(repo, {
      title: feedbackTitle(message, ctx.lang, excerpt, ctx.block, ctx.kind),
      body: feedbackBody(message, ctx, all.slice(0, keep)),
      labels,
    });
  for (const excerpt of [true, false]) {
    for (let keep = all.length; keep >= (excerpt ? 1 : 0); keep -= 1) {
      const url = attempt(excerpt, keep);
      if (url.length <= limit) return { url, dropped: all.length - keep };
    }
  }
  return null;
}
