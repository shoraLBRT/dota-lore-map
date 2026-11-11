import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
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

interface Props {
  id: string;
  region: Region;
  heroes: Hero[];
  /** Якорь региона в координатах окна; null — неизвестен (до первой раскладки). */
  getAnchor: () => { x: number; y: number } | null;
}

/** Позиция подсказки-портала у якоря на карте; пересчитывается при смене ключа и размера окна. */
export function useAnchoredPosition(
  ref: RefObject<HTMLElement | null>,
  getAnchor: () => { x: number; y: number } | null,
  key: string,
): { left: number; top: number } | null {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      const anchor = getAnchor();
      if (!el || !anchor) return;
      const rect = el.getBoundingClientRect();
      setPos(
        placeTooltip(
          anchor,
          { width: rect.width, height: rect.height },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref, getAnchor, key]);
  return pos;
}

/** Ряд портретов без ссылок и плашка «+N» (подсказки на карте). */
export function TooltipHeroes({ heroes }: { heroes: Hero[] }) {
  const { t } = useT();
  const { shown, rest } = splitHeroes(heroes);
  if (shown.length === 0) return null;
  return (
    <ul className={styles.heroes}>
      {shown.map((h) => (
        <li key={h.key}>
          <HeroPortrait hero={h} link={false} className={styles.portrait} />
        </li>
      ))}
      {rest > 0 && (
        <li className={styles.more} aria-label={t('tooltip.more', { n: String(rest) })}>
          +{rest}
        </li>
      )}
    </ul>
  );
}

/** Подсказка региона S1h (SPEC §6.2): название, подзаголовок, до 6 портретов и «+N». Портреты не кликаются. */
export function RegionTooltip({ id, region, heroes, getAnchor }: Props) {
  const { l } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(ref, getAnchor, region.id);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={styles.tooltip}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
    >
      <p className={styles.name}>{l(region.name)}</p>
      {region.subtitle && <p className={styles.subtitle}>{l(region.subtitle)}</p>}
      <TooltipHeroes heroes={heroes} />
    </div>,
    document.body,
  );
}
