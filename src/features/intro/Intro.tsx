import { useNavigation } from '../../app/navigation';
import { Disclaimer } from '../../components/Disclaimer';
import { LangSwitch } from '../../components/LangSwitch';
import { useT } from '../../i18n';
import styles from './Intro.module.css';

/** S0 — Интро (SPEC §5.2). Фон, облака и анимация A1 — E4. */
export function Intro() {
  const { t } = useT();
  const { open } = useNavigation();
  return (
    <div className={styles.intro}>
      <header className={styles.top}>
        <LangSwitch />
      </header>
      <main className={styles.center}>
        <p className={styles.kicker}>{t('intro.kicker')}</p>
        <h1 className={styles.title}>{t('intro.title')}</h1>
        <button type="button" className={styles.start} onClick={() => open({ name: 'world' })}>
          {t('intro.start')}
        </button>
      </main>
      <Disclaimer className={styles.footer} />
    </div>
  );
}
