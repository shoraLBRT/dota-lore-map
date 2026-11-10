import type { ReactNode } from 'react';
import { PanelFrame } from '../../components/PanelFrame';
import styles from './Panel.module.css';

/** Правая панель регионов и мест. Сворачивание и выезд — E5. */
export function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <PanelFrame label={label} className={styles.panel}>
      {children}
    </PanelFrame>
  );
}

export { styles as panelStyles };
