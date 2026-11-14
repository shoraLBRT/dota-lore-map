import type { ReactNode } from 'react';
import styles from './PanelFrame.module.css';

interface Props {
  id?: string;
  label: string;
  className?: string;
  /** Шапка над прокруткой: всегда на виду (крошка «назад», SPEC §6.4). */
  header?: ReactNode;
  children: ReactNode;
}

/** Рамка правой панели (SPEC §8.5): графитовая подложка, металлический кант, срезанный угол. */
export function PanelFrame({ id, label, className, header, children }: Props) {
  return (
    <aside id={id} className={[styles.frame, className].filter(Boolean).join(' ')} aria-label={label}>
      {header && <div className={styles.head}>{header}</div>}
      <div className={[styles.inner, header && styles.underHead].filter(Boolean).join(' ')}>{children}</div>
    </aside>
  );
}
