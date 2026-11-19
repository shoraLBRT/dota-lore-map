import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero, Lang, Region } from '../../data/types';
import { useT, type MessageKey } from '../../i18n';
import { mediaKinds, type MediaBadge } from './mediaBadge';
import styles from './RegionTooltip.module.css';

/** Сколько портретов в подсказках карты (SPEC §6.2, #193); остальные — за плашкой «+N». */
export const TOOLTIP_HEROES = 5;

/** «8 героев · 3 места» (#193); нулевые счётчики не пишутся. */
export function regionCounts(lang: Lang, heroes: number, places: number, t: (key: MessageKey, vars?: Record<string, string>) => string): string {
  const plural = (n: number, key: 'list.heroes' | 'tooltip.places') => {
    const form = new Intl.PluralRules(lang).select(n);
    return t(`${key}.${form === 'one' ? 'one' : form === 'few' ? 'few' : 'many'}` as MessageKey, { n: String(n) });
  };
  return [heroes > 0 && plural(heroes, 'list.heroes'), places > 0 && plural(places, 'tooltip.places')].filter(Boolean).join(' · ');
}

/** Первые `max` героев и сколько осталось за плашкой «+N». */
export function splitHeroes(heroes: Hero[], max = TOOLTIP_HEROES): { shown: Hero[]; rest: number } {
  return { shown: heroes.slice(0, max), rest: Math.max(0, heroes.length - max) };
}

export interface Size {
  width: number;
  height: number;
}

/** Отступ подсказки от края окна и от якоря, px. */
const EDGE = 8;
const GAP = 18;
/** Зазор между подсказкой и подписью региона (#193): мало — мышь проходит его быстрее, чем подсказка закроется. */
const LABEL_GAP = 6;

/** Прямоугольник в координатах окна. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Якорь подсказки в координатах окна. `label` — подпись региона на экране (#193): подсказка встаёт у неё и не на ней;
 * `avoid` — соседние подписи, их подсказка по возможности не закрывает; `minLeft` — левая граница (правый край левой
 * полосы), подсказка не ближе `EDGE` к ней.
 */
export interface Anchor {
  x: number;
  y: number;
  label?: Box;
  avoid?: Box[];
  minLeft?: number;
}

/**
 * Позиция подсказки (клиентские координаты). Есть подпись региона — у неё: снизу, сверху, справа или слева; из сторон,
 * где подсказка целиком в окне, правее левой полосы и не на подписи, — та, что меньше всех закрывает соседние подписи
 * (при равенстве — по этому порядку, #193). Иначе — у якоря: по центру под ним, если не помещается снизу — над ним;
 * прижимается к краю окна (SPEC §6.2, §6.3).
 */
export function placeTooltip(anchor: Anchor, tip: Size, view: Size): { left: number; top: number } {
  const atLabel = anchor.label && besideLabel(anchor, anchor.label, tip, view);
  if (atLabel) return atLabel;
  const maxLeft = Math.max(EDGE, view.width - tip.width - EDGE);
  const left = Math.min(Math.max(anchor.x - tip.width / 2, EDGE), maxLeft);
  const below = anchor.y + GAP;
  const above = anchor.y - GAP - tip.height;
  let top = below + tip.height + EDGE <= view.height ? below : above;
  top = Math.min(Math.max(top, EDGE), Math.max(EDGE, view.height - tip.height - EDGE));
  return { left: Math.round(left), top: Math.round(top) };
}

/** Площадь пересечения двух прямоугольников. */
export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function besideLabel(anchor: Anchor, label: Box, tip: Size, view: Size): { left: number; top: number } | null {
  const minLeft = (anchor.minLeft ?? 0) + EDGE;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const cx = (label.left + label.right) / 2;
  const cy = (label.top + label.bottom) / 2;
  const rowLeft = clamp(cx - tip.width / 2, minLeft, view.width - tip.width - EDGE);
  const sideTop = clamp(cy - tip.height / 2, EDGE, view.height - tip.height - EDGE);
  const sides = [
    { left: rowLeft, top: label.bottom + LABEL_GAP },
    { left: rowLeft, top: label.top - LABEL_GAP - tip.height },
    { left: label.right + LABEL_GAP, top: sideTop },
    { left: label.left - LABEL_GAP - tip.width, top: sideTop },
  ];
  const boxAt = (p: { left: number; top: number }): Box => ({
    left: p.left,
    top: p.top,
    right: p.left + tip.width,
    bottom: p.top + tip.height,
  });
  const fits = (p: { left: number; top: number }) =>
    p.left >= minLeft &&
    p.left + tip.width + EDGE <= view.width &&
    p.top >= EDGE &&
    p.top + tip.height + EDGE <= view.height &&
    overlap(boxAt(p), label) === 0;
  let best: { left: number; top: number } | null = null;
  let bestCover = Infinity;
  for (const p of sides) {
    if (!fits(p)) continue;
    const cover = (anchor.avoid ?? []).reduce((sum, b) => sum + overlap(boxAt(p), b), 0);
    if (cover < bestCover) {
      best = p;
      bestCover = cover;
    }
    if (cover === 0) break;
  }
  return best ? { left: Math.round(best.left), top: Math.round(best.top) } : null;
}

/** Подсказка выросла («+N» раскрыт): остаётся на месте и только сдвигается внутрь окна (#65). */
export function clampTooltip(pos: { left: number; top: number }, tip: Size, view: Size): { left: number; top: number } {
  const clamp = (v: number, size: number, max: number) => Math.min(Math.max(v, EDGE), Math.max(EDGE, max - size - EDGE));
  return { left: Math.round(clamp(pos.left, tip.width, view.width)), top: Math.round(clamp(pos.top, tip.height, view.height)) };
}

interface Props {
  id: string;
  region: Region;
  heroes: Hero[];
  /** Якорь региона в координатах окна (с габаритом региона, #101); null — неизвестен (до первой раскладки). */
  getAnchor: () => Anchor | null;
  /** Корень подсказки: карта переводит в неё фокус по Tab с региона (#65). */
  tipRef?: RefObject<HTMLDivElement>;
  /** Нажат портрет: герой выбран на карте (#65). Без него портреты не кликаются. */
  onPick?: (hero: Hero) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Фокус ушёл из подсказки наружу. */
  onFocusOut?: () => void;
  /** Медиа региона и его мест (#69): значок-кнопка рядом с названием. */
  media?: MediaBadge | null;
  /** Нажат значок медиа: открыть галерею. Без него значка нет. */
  onOpenMedia?: (badge: MediaBadge) => void;
}

/**
 * Позиция подсказки-портала у якоря на карте; пересчитывается при смене ключа и размера окна.
 * `grow` — подсказка выросла на месте («+N»): не пересчитывать от якоря, только вдвинуть в окно.
 */
export function useAnchoredPosition(
  ref: RefObject<HTMLElement | null>,
  getAnchor: () => Anchor | null,
  key: string,
  grow = '',
): { left: number; top: number } | null {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const sizes = () => {
    const rect = ref.current!.getBoundingClientRect();
    return [{ width: rect.width, height: rect.height }, { width: window.innerWidth, height: window.innerHeight }] as const;
  };
  useLayoutEffect(() => {
    const update = () => {
      const anchor = getAnchor();
      if (!ref.current || !anchor) return;
      setPos(placeTooltip(anchor, ...sizes()));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, getAnchor, key]);
  useLayoutEffect(() => {
    if (!grow || !ref.current) return;
    const [tip, view] = sizes();
    setPos((p) => (p ? clampTooltip(p, tip, view) : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, grow]);
  return pos;
}

interface HeroesProps {
  heroes: Hero[];
  /** Портреты-кнопки (подсказка региона, #65); без него — картинки и плашка «+N» без действия. */
  onPick?: (hero: Hero) => void;
  /** «+N» раскрыт: видны все герои. */
  expanded?: boolean;
  onExpand?: () => void;
  /** Портрет под курсором или фокусом — его имя в подписи подсказки. */
  onName?: (hero: Hero | null) => void;
}

/** Ряд портретов и плашка «+N» (подсказки на карте). */
export function TooltipHeroes({ heroes, onPick, expanded = false, onExpand, onName }: HeroesProps) {
  const { t } = useT();
  const { shown, rest } = splitHeroes(heroes, expanded ? heroes.length : TOOLTIP_HEROES);
  if (shown.length === 0) return null;
  return (
    <ul className={styles.heroes} data-heroes="">
      {shown.map((h) => (
        <li
          key={h.key}
          onPointerEnter={onName && (() => onName(h))}
          onPointerLeave={onName && (() => onName(null))}
          onFocus={onName && (() => onName(h))}
          onBlur={onName && (() => onName(null))}
        >
          <HeroPortrait hero={h} link={false} onPick={onPick && (() => onPick(h))} className={styles.portrait} />
        </li>
      ))}
      {rest > 0 &&
        (onExpand ? (
          <li>
            <button
              type="button"
              className={styles.more}
              aria-expanded="false"
              // Имя начинается с видимого «+N» (WCAG 2.5.3).
              aria-label={t('panel.allHeroes', { rest: String(rest), n: String(heroes.length) })}
              onClick={onExpand}
            >
              +{rest}
            </button>
          </li>
        ) : (
          <li className={styles.more} aria-label={t('tooltip.more', { n: String(rest) })}>
            +{rest}
          </li>
        ))}
    </ul>
  );
}

/**
 * Подсказка региона S1h (SPEC §5.3, §6.2, #193): название, одна строка подзаголовка, до 5 портретов и «+N»,
 * внизу — число героев и мест (портрет под курсором или фокусом — имя героя).
 * С `onPick` (#65) в неё можно зайти мышью и Tab: портрет выбирает героя, «+N» раскрывает всех героев на месте.
 */
export function RegionTooltip({
  id,
  region,
  heroes,
  getAnchor,
  tipRef,
  onPick,
  onPointerEnter,
  onPointerLeave,
  onKeyDown,
  onFocusOut,
  media,
  onOpenMedia,
}: Props) {
  const { l, lang, t } = useT();
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = tipRef ?? ownRef;
  const nameId = `${id}-name`;
  // «+N» раскрыт у этого региона; подсказка перешла на другой регион — снова свёрнуто, и при возврате тоже.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prevRegion, setPrevRegion] = useState(region.id);
  if (prevRegion !== region.id) {
    setPrevRegion(region.id);
    setExpandedId(null);
  }
  const expanded = expandedId === region.id;
  const [named, setNamed] = useState<Hero | null>(null);
  const pos = useAnchoredPosition(ref, getAnchor, region.id, expanded ? region.id : '');
  const pickable = Boolean(onPick) && heroes.length > 0;
  const badge = onOpenMedia && media ? media : null;
  const interactive = pickable || badge !== null;
  const kinds = badge ? mediaKinds(badge.media, lang) : '';
  const counts = regionCounts(lang, heroes.length, region.places.length, t);

  // «+N» нажат с клавиатуры: кнопка пропала — фокус на первый раскрытый портрет.
  const focusRevealed = useRef(false);
  useLayoutEffect(() => {
    if (!expanded || !focusRevealed.current) return;
    focusRevealed.current = false;
    ref.current?.querySelectorAll<HTMLElement>('[data-heroes] button')[TOOLTIP_HEROES]?.focus();
  }, [expanded, ref]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      data-map-tip=""
      role={interactive ? 'group' : 'tooltip'}
      aria-labelledby={interactive ? nameId : undefined}
      className={[styles.tooltip, interactive && styles.interactive].filter(Boolean).join(' ')}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      // Клик мышью не ставит фокус в подсказку: иначе она держалась бы открытой после ухода мыши.
      onMouseDown={interactive ? (e) => e.preventDefault() : undefined}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFocusOut?.();
      }}
    >
      <div className={styles.head}>
        <p id={nameId} className={styles.name}>
          {l(region.name)}
        </p>
        {badge && (
          <button
            type="button"
            className={styles.media}
            // Имя содержит видимый вид медиа (WCAG 2.5.3): «Есть медиа: комикс».
            aria-label={t('media.badge', { kinds })}
            onClick={() => onOpenMedia!(badge)}
          >
            <MediaIcon className={styles.mediaIcon} />
            <span aria-hidden="true">{kinds}</span>
          </button>
        )}
      </div>
      {region.subtitle && (
        <p className={styles.subtitle} title={l(region.subtitle)}>
          {l(region.subtitle)}
        </p>
      )}
      <TooltipHeroes
        heroes={heroes}
        onPick={pickable ? onPick : undefined}
        expanded={expanded}
        onExpand={
          pickable
            ? () => {
                focusRevealed.current = ref.current?.contains(document.activeElement) ?? false;
                setExpandedId(region.id);
              }
            : undefined
        }
        onName={pickable ? setNamed : undefined}
      />
      {(counts || pickable) && (
        <p className={styles.caption} data-counts="">
          {named && heroes.includes(named) ? named.name : counts}
        </p>
      )}
    </div>,
    document.body,
  );
}

/** Значок медиа (#69): страница комикса с панелями. Тот же рисунок — у маркера места на карте. */
export function MediaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 8h12M8 8v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
