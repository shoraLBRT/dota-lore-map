import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigation } from '../../app/navigation';
import { REPO_URL } from '../../app/project';
import { Button } from '../../components/Button';
import buttonStyles from '../../components/Button.module.css';
import { DiamondButton } from '../../components/DiamondButton';
import { trapTab } from '../../components/focusTrap';
import { useT } from '../../i18n';
import { feedbackContext } from './context';
import { loadDraft, saveDraft } from './draft';
import { cleanMessage, feedbackUrl, MESSAGE_LIMIT } from './message';
import styles from './FeedbackWindow.module.css';

/** Кнопки-источники с этим атрибутом сами открывают и закрывают окно: клик по ним — не «клик вне окна». */
export const OPENER_ATTR = 'data-feedback-opener';

interface Props {
  /** Блок панели, к которому относится сообщение (#74). */
  block?: string;
  onClose: () => void;
}

/**
 * Окно обратной связи (SPEC §6.9): небольшое, в углу, без затемнения карты. Ловушка фокуса; Esc, × и клик вне
 * окна закрывают его, черновик остаётся. «Отправить» открывает в новой вкладке форму нового issue на GitHub.
 */
export function FeedbackWindow({ block, onClose }: Props) {
  const { t, lang } = useT();
  const { route } = useNavigation();
  const titleId = useId();
  const textId = useId();
  const fieldId = useId();
  const countId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(loadDraft);
  const [sent, setSent] = useState(false);

  // Фокус в поле (курсор в конце черновика); при закрытии — обратно на кнопку-источник, если фокус не ушёл
  // на то, по чему кликнули.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const field = dialog?.querySelector<HTMLTextAreaElement>('textarea');
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || dialog?.contains(active)) opener?.focus();
    };
  }, []);

  // Клик вне окна закрывает его. Кнопки-источники пропускаем: они переключают окно сами.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (dialogRef.current?.contains(target) || target.closest(`[${OPENER_ATTR}]`)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose]);

  const change = (value: string) => {
    const next = value.slice(0, MESSAGE_LIMIT);
    setText(next);
    setSent(false);
    saveDraft(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Окно закрывается первым: глобальный Esc (профиль, герой, уровень вверх) не срабатывает (A11).
      e.stopPropagation();
      onClose();
      return;
    }
    trapTab(e, dialogRef.current);
  };

  const message = cleanMessage(text);
  const fitted = message ? feedbackUrl(REPO_URL, text, feedbackContext(route, lang, window.location.href, block)) : null;

  // Вкладку открывает сама ссылка — её не режет блокировщик всплывающих окон. Черновик очищаем после клика
  // отдельной задачей: ссылка, убранная из DOM во время клика, никуда не переходит.
  const onSend = () => {
    window.setTimeout(() => {
      saveDraft('');
      setText('');
      setSent(true);
      // Ссылка сменится неактивной кнопкой — фокус остаётся в окне, на поле.
      dialogRef.current?.querySelector('textarea')?.focus();
    }, 0);
  };

  return createPortal(
    <div
      ref={dialogRef}
      className={styles.window}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={textId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <DiamondButton icon="close" label={t('feedback.close')} className={styles.close} onClick={onClose} />
      <h2 id={titleId} className={styles.title}>
        {t('feedback.title')}
      </h2>
      <div id={textId} className={styles.text}>
        <p>{t('feedback.text')}</p>
        <p>{t('feedback.account')}</p>
      </div>
      <label htmlFor={fieldId} className={styles.label}>
        {t('feedback.label')}
      </label>
      <textarea
        id={fieldId}
        className={styles.field}
        value={text}
        maxLength={MESSAGE_LIMIT}
        rows={6}
        placeholder={t('feedback.placeholder')}
        aria-describedby={countId}
        onChange={(e) => change(e.target.value)}
      />
      <div className={styles.footer}>
        <span id={countId} className={styles.count}>
          {t('feedback.count', { count: String(text.length), limit: String(MESSAGE_LIMIT) })}
        </span>
        {fitted ? (
          <a
            className={[buttonStyles.button, buttonStyles.primary, styles.send].join(' ')}
            href={fitted.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onSend}
          >
            {t('feedback.send')} ↗
          </a>
        ) : (
          <Button className={styles.send} disabled>
            {t('feedback.send')} ↗
          </Button>
        )}
      </div>
      {message && !fitted && (
        <p className={styles.note} role="alert">
          {t('feedback.tooLong')}
        </p>
      )}
      {/* Живая область есть всегда: так экранный диктор прочтёт сообщение, когда оно появится. */}
      <p className={styles.note} role="status">
        {sent ? t('feedback.sent') : ''}
      </p>
    </div>,
    document.body,
  );
}
