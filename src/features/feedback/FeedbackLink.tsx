import { useT } from '../../i18n';
import type { FeedbackBlockRef } from './context';
import { useFeedback } from './FeedbackProvider';
import styles from './FeedbackLink.module.css';

/**
 * «Нашли ошибку или знаете больше? Расскажите» — одна строка мелким текстом в конце блока (E17, #74; SPEC §6.9):
 * открывает окно обратной связи, уже привязанное к блоку. Фокус после закрытия окна возвращается сюда.
 */
export function FeedbackLink({ block }: { block: FeedbackBlockRef }) {
  const { t } = useT();
  const feedback = useFeedback();
  return (
    <div className={styles.line}>
      <button
        type="button"
        className={styles.link}
        aria-haspopup="dialog"
        onClick={() => feedback.open({ block })}
        // Кнопка-источник (OPENER_ATTR): клик по ней — не «клик вне окна», а переключение на этот блок.
        data-feedback-opener=""
      >
        {t('feedback.blockLink')}
      </button>
    </div>
  );
}
