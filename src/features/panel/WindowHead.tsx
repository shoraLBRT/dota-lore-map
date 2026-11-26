import { DiamondButton } from '../../components/DiamondButton';
import { useT } from '../../i18n';
import styles from './WindowHead.module.css';

interface Props {
  /** Название окна — заголовок панели (h2): единственный, в тексте окна его нет (#230). */
  title: string;
  /** Доступное имя ×: «Закрыть регион», «Закрыть профиль». */
  closeLabel: string;
  onClose: () => void;
  /** Профиль (Н7): кнопка «свернуть до шапки» — смотреть нити героя на карте. */
  minimized?: boolean;
  onMinimize?: () => void;
}

/**
 * Шапка окна (#230, Н2, SPEC §5.1 «Правила окон»): название слева и × справа в одной строке, тот же ромб, что
 * у галереи, «О проекте» и окна отзыва (Н12); × закрывает окно и ведёт на шаг вверх. «Назад» — строка пути
 * вверху карты (PathBar). Заголовок принимает фокус после перехода (A14, `data-panel-heading`).
 */
export function WindowHead({ title, closeLabel, onClose, minimized = false, onMinimize }: Props) {
  const { t } = useT();
  return (
    <div className={styles.head} data-window-head>
      <h2 className={styles.title} tabIndex={-1} data-panel-heading>
        {title}
      </h2>
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
