import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero, Region } from '../../data/types';
import { useT } from '../../i18n';
import styles from './RegionTooltip.module.css';

/** Сколько портретов в подсказке региона (SPEC §5.3, §6.2). */
export const TOOLTIP_HEROES = 6;

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

/**
 * Позиция подсказки у якоря региона (клиентские координаты): по центру под названием,
 * если не помещается снизу — над ним; по горизонтали прижимается к краю окна (SPEC §5.3).
 */
export function placeTooltip(anchor: { x: number; y: number }, tip: Size, view: Size): { left: number; top: number } {
  const maxLeft = Math.max(EDGE, view.width - tip.width - EDGE);
  const left = Math.min(Math.max(anchor.x - tip.width / 2, EDGE), maxLeft);
  const below = anchor.y + GAP;
  const above = anchor.y - GAP - tip.height;
  let top = below + tip.height + EDGE <= view.height ? below : above;
  top = Math.min(Math.max(top, EDGE), Math.max(EDGE, view.height - tip.height - EDGE));
  return { left: Math.round(left), top: Math.round(top) };
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
  /** Якорь региона в координатах окна; null — неизвестен (до первой раскладки). */
  getAnchor: () => { x: number; y: number } | null;
  /** Корень подсказки: карта переводит в неё фокус по Tab с региона (#65). */
  tipRef?: RefObject<HTMLDivElement>;
  /** Нажат портрет: герой выбран на карте (#65). Без него портреты не кликаются. */
  onPick?: (hero: Hero) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** Фокус ушёл из подсказки наружу. */
  onFocusOut?: () => void;
}

/**
 * Позиция подсказки-портала у якоря на карте; пересчитывается при смене ключа и размера окна.
 * `grow` — подсказка выросла на месте («+N»): не пересчитывать от якоря, только вдвинуть в окно.
 */
export function useAnchoredPosition(
  ref: RefObject<HTMLElement | null>,
  getAnchor: () => { x: number; y: number } | null,
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
    <ul className={styles.heroes}>
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
 * Подсказка региона S1h (SPEC §5.3, §6.2): название, подзаголовок, до 6 портретов и «+N».
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
}: Props) {
  const { l, t } = useT();
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = tipRef ?? ownRef;
  const nameId = `${id}-name`;
  // «+N» раскрыт у этого региона; другой регион — снова свёрнуто.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expanded = expandedId === region.id;
  const [named, setNamed] = useState<Hero | null>(null);
  const pos = useAnchoredPosition(ref, getAnchor, region.id, expanded ? region.id : '');
  const interactive = Boolean(onPick) && heroes.length > 0;

  // «+N» нажат с клавиатуры: кнопка пропала — фокус на первый раскрытый портрет.
  const focusRevealed = useRef(false);
  useLayoutEffect(() => {
    if (!expanded || !focusRevealed.current) return;
    focusRevealed.current = false;
    ref.current?.querySelectorAll<HTMLElement>('button')[TOOLTIP_HEROES]?.focus();
  }, [expanded, ref]);

  return createPortal(
    <div
      ref={ref}
      id={id}
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
      <p id={nameId} className={styles.name}>
        {l(region.name)}
      </p>
      {region.subtitle && <p className={styles.subtitle}>{l(region.subtitle)}</p>}
      <TooltipHeroes
        heroes={heroes}
        onPick={interactive ? onPick : undefined}
        expanded={expanded}
        onExpand={
          interactive
            ? () => {
                focusRevealed.current = ref.current?.contains(document.activeElement) ?? false;
                setExpandedId(region.id);
              }
            : undefined
        }
        onName={interactive ? setNamed : undefined}
      />
      {interactive && (
        <p className={styles.caption} aria-hidden="true">
          {named && heroes.includes(named) ? named.name : t('tooltip.pick')}
        </p>
      )}
    </div>,
    document.body,
  );
}
