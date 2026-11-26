import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useMediaQuery } from '../../app/media';
import { PanelFrame } from '../../components/PanelFrame';
import { useT } from '../../i18n';
import { MOBILE_QUERY } from '../world/camera';
import styles from './Panel.module.css';
import { Sheet } from './Sheet';
import { WindowHead } from './WindowHead';

interface Props {
  /** Название окна: заголовок в шапке рядом с × (#230) — в тексте панели его нет. */
  label: string;
  /** Профиль свёрнут до шапки (`minimizable`, #230 Н7): прокрутка скрыта, карта и нити героя видны. */
  collapsed: boolean;
  onToggle: () => void;
  /** Смена ключа — кроссфейд содержимого (A4, 250 мс). */
  contentKey: string;
  /** × в шапке: закрыть окно и подняться на шаг вверх (SPEC §5.1 «Правила окон»). */
  onClose: () => void;
  closeLabel?: string;
  minimizable?: boolean;
  children: ReactNode;
}

/**
 * Окно региона, места или профиля (SPEC §5.1, §5.4; ARCHITECTURE A4): на компьютере лежит поверх карты справа
 * (A3, 400 мс), на телефоне — нижняя шторка в три положения. Шапка — название и × в одной строке (#230).
 */
export function Panel({ label, collapsed, onToggle, contentKey, onClose, closeLabel, minimizable = false, children }: Props) {
  const { t } = useT();
  const id = useId();
  const mobile = useMediaQuery(MOBILE_QUERY);

  // Новый экран — текст снова сверху: из списка мест (#99) панель места иначе открылась бы прокрученной вниз.
  // Прокручивается внутренний блок рамки — последний: над ним стоит шапка.
  // Только смена экрана: новая панель и так сверху, а `scrollTo` — принудительная раскладка на кадре клика (#238).
  const shownKey = useRef(contentKey);
  useEffect(() => {
    if (shownKey.current === contentKey) return;
    shownKey.current = contentKey;
    document.getElementById(id)?.lastElementChild?.scrollTo?.({ top: 0 });
  }, [contentKey, id]);

  // Шапка меняется вместе с экраном: старая кнопка уходит, фокус возвращается туда, откуда пришли (§14).
  const head = (
    <div key={contentKey} className={styles.content}>
      <WindowHead
        title={label}
        closeLabel={closeLabel ?? t('panel.close', { name: label })}
        onClose={onClose}
        minimized={!mobile && minimizable && collapsed}
        onMinimize={minimizable ? onToggle : undefined}
      />
    </div>
  );
  const body = (
    <div key={contentKey} className={styles.content}>
      {children}
    </div>
  );

  if (mobile) {
    return (
      <Sheet id={id} label={label} contentKey={contentKey} header={head} onClose={onClose}>
        {body}
      </Sheet>
    );
  }
  const headOnly = minimizable && collapsed;
  return (
    <div className={[styles.dock, headOnly && styles.minimized].filter(Boolean).join(' ')} data-testid="panel-dock">
      <div className={styles.body}>
        <PanelFrame id={id} label={label} className={styles.panel} header={head} headOnly={headOnly}>
          {body}
        </PanelFrame>
      </div>
    </div>
  );
}

export { styles as panelStyles };
