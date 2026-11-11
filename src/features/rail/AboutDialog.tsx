import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { DiamondButton } from '../../components/DiamondButton';
import { Disclaimer } from '../../components/Disclaimer';
import { Divider } from '../../components/Divider';
import { trapTab } from '../../components/focusTrap';
import { useT, type MessageKey } from '../../i18n';
import styles from './AboutDialog.module.css';

const SOURCES: { key: MessageKey; href: string }[] = [
  { key: 'about.source.official', href: 'https://www.dota2.com/heroes' },
  { key: 'about.source.wikis', href: 'https://liquipedia.net/dota2/' },
];

const REPO = 'https://github.com/shoraLBRT/dota-lore-map';

/** Окно «О проекте» (SPEC §6.1, §15): описание, источники, благодарности, дисклеймер. Esc и × закрывают. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Фокус внутрь окна (на «закрыть») при открытии и обратно на кнопку-источник при закрытии.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Не даём глобальному Esc («на уровень вверх») сработать вместе с закрытием окна.
      e.stopPropagation();
      onClose();
      return;
    }
    trapTab(e, dialogRef.current);
  };

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <DiamondButton icon="close" label={t('about.close')} className={styles.close} onClick={onClose} />
        <h2 id={titleId} className={styles.title}>
          {t('about.title')}
        </h2>
        <p>{t('about.text')}</p>
        <h3>{t('about.sources')}</h3>
        <ul className={styles.list}>
          {SOURCES.map((s) => (
            <li key={s.key}>
              <a href={s.href} target="_blank" rel="noopener noreferrer">
                {t(s.key)} ↗
              </a>
            </li>
          ))}
        </ul>
        <h3>{t('about.thanks')}</h3>
        <p>{t('about.thanksText')}</p>
        <p>
          <a href={REPO} target="_blank" rel="noopener noreferrer">
            {t('about.code')} ↗
          </a>
        </p>
        <Divider />
        <Disclaimer className={styles.disclaimer} />
      </div>
    </div>,
    document.body,
  );
}
