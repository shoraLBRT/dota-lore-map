import type { CSSProperties } from 'react';
import { useT } from '../../i18n';
import type { FreeCameraControls } from './freeCamera';
import styles from './ZoomControls.module.css';

/** Кнопки свободной камеры (#165): приблизить, отдалить, весь мир. Справа внизу, левее панели. */
export function ZoomControls({ controls, right }: { controls: FreeCameraControls; right: number }) {
  const { t } = useT();
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div className={styles.controls} role="group" aria-label={t('world.zoom')} style={{ '--shift': `${right}px` } as CSSProperties} onClick={stop}>
      <button type="button" className={styles.button} aria-label={t('world.zoomIn')} title={t('world.zoomIn')} onClick={controls.zoomIn}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
      </button>
      <button type="button" className={styles.button} aria-label={t('world.zoomOut')} title={t('world.zoomOut')} onClick={controls.zoomOut}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg>
      </button>
      <button type="button" className={styles.button} aria-label={t('world.home')} title={t('world.home')} onClick={controls.home}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" /></svg>
      </button>
    </div>
  );
}
