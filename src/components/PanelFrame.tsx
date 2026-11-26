import type { ReactNode } from 'react';
import styles from './PanelFrame.module.css';

interface Props {
  id?: string;
  label: string;
  className?: string;
  /** Шапка над прокруткой: всегда на виду (название окна и ×, #230). */
  header?: ReactNode;
  /** Свёрнута до шапки (профиль, #230 Н7): прокрутка скрыта, видна только шапка. */
  headOnly?: boolean;
  children: ReactNode;
}

/** Рамка правой панели (SPEC §8.5): графитовая подложка, металлический кант, срезанный угол. */
export function PanelFrame({ id, label, className, header, headOnly = false, children }: Props) {
  return (
    <aside id={id} className={[styles.frame, className].filter(Boolean).join(' ')} aria-label={label}>
      {header && <div className={styles.head}>{header}</div>}
      <div className={[styles.inner, header && styles.underHead].filter(Boolean).join(' ')} hidden={headOnly}>
        {children}
      </div>
    </aside>
  );
}
