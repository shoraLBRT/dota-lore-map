import type { ReactNode } from 'react';
import styles from './PanelFrame.module.css';

interface Props {
  id?: string;
  label: string;
  className?: string;
  children: ReactNode;
}

/** Рамка правой панели (SPEC §8.5): графитовая подложка, металлический кант, срезанный угол. */
export function PanelFrame({ id, label, className, children }: Props) {
  return (
    <aside id={id} className={[styles.frame, className].filter(Boolean).join(' ')} aria-label={label}>
      <div className={styles.inner}>{children}</div>
    </aside>
  );
}
