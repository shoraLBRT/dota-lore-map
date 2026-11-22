import { DiamondButton } from '../../components/DiamondButton';
import { useT } from '../../i18n';
import styles from './WindowHead.module.css';

interface Props {
  /** Название окна: на телефоне — всегда (шторка в положении «заголовок»), на компьютере — у свёрнутого профиля. */
  title: string;
  /** Доступное имя ×: «Закрыть регион», «Закрыть профиль». */
  closeLabel: string;
  onClose: () => void;
  /** Профиль (Н7): кнопка «свернуть до шапки» — смотреть нити героя на карте. */
  minimized?: boolean;
  onMinimize?: () => void;
}

/**
 * Шапка окна с `?nav=new` (#230, Н2, SPEC §5.1 «Правила окон»): × в правом верхнем углу, тот же ромб, что у галереи,
 * «О проекте» и окна отзыва (Н12); × закрывает окно и ведёт на шаг вверх. Крошек «‹ Мир» / «‹ Закрыть профиль»
 * нет — путь стоит вверху карты (Н1, PathBar).
 */
export function WindowHead({ title, closeLabel, onClose, minimized = false, onMinimize }: Props) {
  const { t } = useT();
  return (
    <div className={[styles.head, minimized && styles.minimized].filter(Boolean).join(' ')} data-window-head>
      <span className={styles.title} aria-hidden="true">
        {title}
      </span>
      {onMinimize && (
        <DiamondButton
          icon={minimized ? 'restore' : 'minimize'}
          label={t(minimized ? 'panel.restore' : 'panel.minimize')}
          aria-expanded={!minimized}
          className={styles.minimize}
          onClick={onMinimize}
        />
      )}
      <DiamondButton icon="close" label={closeLabel} onClick={onClose} data-window-close />
    </div>
  );
}
