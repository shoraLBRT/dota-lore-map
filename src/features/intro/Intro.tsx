import { useEffect } from 'react';
import { cssDuration } from '../../app/motion';
import { Button } from '../../components/Button';
import { Disclaimer } from '../../components/Disclaimer';
import { Divider } from '../../components/Divider';
import { LangSwitch } from '../../components/LangSwitch';
import { useT } from '../../i18n';
import { VEIL_CLOUDS } from '../world/cloudSets';
import { Clouds } from '../world/Clouds';
import styles from './Intro.module.css';
import { useWorldReady } from './useWorldReady';

interface Props {
  /** Идёт A1: облака разъезжаются, текст уходит вверх. */
  leaving: boolean;
  onStart: () => void;
  /** A1 закончилась — интро можно убрать. */
  onLeft: () => void;
}

/**
 * S0 — Интро (SPEC §5.2): слой поверх экрана мира. Сама карта под ним размыта (WorldScreen `veiled`),
 * так что «размытая карта на фоне» — это настоящая карта, и A1 проявляет её без подмены.
 */
export function Intro({ leaving, onStart, onLeft }: Props) {
  const { t } = useT();
  const ready = useWorldReady();

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onLeft, cssDuration('--dur-intro'));
    return () => window.clearTimeout(timer);
  }, [leaving, onLeft]);

  return (
    <div className={[styles.intro, leaving && styles.leaving].filter(Boolean).join(' ')} data-testid="intro">
      <div className={styles.veil} aria-hidden="true" />
      <Clouds clouds={VEIL_CLOUDS} mode="veil" parting={leaving} />
      <header className={styles.top}>
        <LangSwitch />
      </header>
      <main className={styles.center}>
        <p className={styles.kicker}>{t('intro.kicker')}</p>
        <h1 className={styles.title}>{t('intro.title')}</h1>
        <p className={styles.tagline}>{t('intro.tagline')}</p>
        <Divider className={styles.divider} />
        <Button
          className={styles.start}
          disabled={!ready || leaving}
          aria-busy={!ready}
          onClick={onStart}
        >
          {!ready && <span className={styles.spinner} aria-hidden="true" />}
          {t('intro.start')}
        </Button>
        <p className={styles.status} role="status">
          {ready ? '' : t('intro.loading')}
        </p>
      </main>
      <Disclaimer className={styles.footer} />
    </div>
  );
}
