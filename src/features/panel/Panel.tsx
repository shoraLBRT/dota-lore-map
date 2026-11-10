import type { ReactNode } from 'react';
import styles from './Panel.module.css';

/** Правая панель регионов и мест. Оформление и сворачивание — E5/E12. */
export function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className={styles.panel} aria-label={label}>
      {children}
    </aside>
  );
}

export { styles as panelStyles };
