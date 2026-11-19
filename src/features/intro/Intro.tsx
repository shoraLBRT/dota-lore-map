import { useEffect, type MouseEvent } from 'react';
import { cssDuration } from '../../app/motion';
import { Button } from '../../components/Button';
import { Disclaimer } from '../../components/Disclaimer';
import { Divider } from '../../components/Divider';
import { LangSwitch } from '../../components/LangSwitch';
import { useT } from '../../i18n';
import { WORLD_PREVIEW } from '../world/art';
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

/** Клик или клавиша по этому элементу — его собственное действие, а не вход в мир. */
function ownAction(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="button"]'));
}

/**
 * S0 — Интро (SPEC §5.2): слой поверх экрана мира. Сама карта под ним размыта (WorldScreen `veiled`),
 * так что «размытая карта на фоне» — это настоящая карта, и A1 проявляет её без подмены.
 * В мир ведёт клик в любом месте, `Enter` или `Space` (#187); кнопка — видимая подсказка и цель для клавиатуры.
 */
export function Intro({ leaving, onStart, onLeft }: Props) {
  const { t } = useT();
  const ready = useWorldReady();

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onLeft, cssDuration('--dur-intro'));
    return () => window.clearTimeout(timer);
  }, [leaving, onLeft]);

  const canStart = ready && !leaving;

  useEffect(() => {
    if (!canStart) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || ownAction(e.target)) return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canStart, onStart]);

  const onClick = (e: MouseEvent) => {
    if (canStart && !ownAction(e.target)) onStart();
  };

  return (
    // Клик по фону — дублёр кнопки «Начать» для мыши; клавиатура идёт через кнопку и Enter/Space на окне.
    <div
      className={[styles.intro, canStart && styles.ready, leaving && styles.leaving].filter(Boolean).join(' ')}
      data-testid="intro"
      onClick={onClick}
    >
      {/* Телефон: карта мира под интро — узкая полоса над списком регионов, поэтому фон — своя копия арта
          на весь экран, как у оболочки в index.html (#187). На широком экране не показывается. */}
      <img className={styles.art} src={WORLD_PREVIEW} alt="" aria-hidden="true" decoding="async" />
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
          disabled={!canStart}
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
      <Disclaimer className={styles.footer} single />
    </div>
  );
}
