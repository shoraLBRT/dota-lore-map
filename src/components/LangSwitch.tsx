import { LANGS, useT } from '../i18n';
import styles from './LangSwitch.module.css';

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div className={styles.switch} role="group" aria-label={t('lang.label')}>
      {LANGS.map((code) => (
        <button key={code} type="button" aria-pressed={code === lang} onClick={() => setLang(code)}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
