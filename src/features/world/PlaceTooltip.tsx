import { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Hero } from '../../data/types';
import styles from './RegionTooltip.module.css';
import { TooltipHeroes, useAnchoredPosition } from './RegionTooltip';

interface Props {
  id: string;
  /** Ключ места: позиция пересчитывается при смене места. */
  placeKey: string;
  heroes: Hero[];
  getAnchor: () => { x: number; y: number } | null;
}

/**
 * Маленькая подсказка маркера места (SPEC §5.4): портреты героев места, до 6 и «+N».
 * Без героев не рисуется — название места и так подписано у маркера.
 */
export function PlaceTooltip({ id, placeKey, heroes, getAnchor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(ref, getAnchor, placeKey);
  if (heroes.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={`${styles.tooltip} ${styles.small}`}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
    >
      <TooltipHeroes heroes={heroes} />
    </div>,
    document.body,
  );
}
