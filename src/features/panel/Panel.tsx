import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useMediaQuery } from '../../app/media';
import { DiamondButton } from '../../components/DiamondButton';
import { PanelFrame } from '../../components/PanelFrame';
import { useT } from '../../i18n';
import { MOBILE_QUERY } from '../world/camera';
import styles from './Panel.module.css';
import { Sheet } from './Sheet';
import { WindowHead } from './WindowHead';

interface Props {
  label: string;
  /** Панель свёрнута: уехала за правый край, на виду только кнопка-ромб (SPEC §5.4). */
  collapsed: boolean;
  onToggle: () => void;
  /** Смена ключа — кроссфейд содержимого (A4, 250 мс). */
  contentKey: string;
  /** Крошка «назад» в шапке, над прокруткой (SPEC §6.4). */
  back?: ReactNode;
  /**
   * `?nav=new` (#230, Н2, Н3, Н9): × в шапке закрывает окно и ведёт на шаг вверх; «Свернуть»-ромба нет,
   * на телефоне шторка в три положения. `collapsed` тогда — профиль свёрнут до шапки (`minimizable`, Н7).
   */
  onClose?: () => void;
  closeLabel?: string;
  minimizable?: boolean;
  children: ReactNode;
}

/**
 * Правая панель регионов и мест: лежит поверх карты, выезжает справа (A3, 400 мс),
 * сворачивается кнопкой-ромбом на левом краю без смещения карты (SPEC §5.4).
 */
export function Panel({ label, collapsed, onToggle, contentKey, back, onClose, closeLabel, minimizable = false, children }: Props) {
  const { t } = useT();
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);

  // Свёрнутая панель недоступна мыши и клавиатуре. React 18 не знает inert — свойство DOM напрямую.
  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = collapsed;
  }, [collapsed, contentKey, mobile]);

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
  const header = back && (
    <div key={contentKey} className={styles.content}>
      {back}
    </div>
  );

  if (onClose) {
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
    if (mobile) {
      return (
        <Sheet id={id} label={label} contentKey={contentKey} header={head} onClose={onClose}>
          <div key={contentKey} className={styles.content}>
            {children}
          </div>
        </Sheet>
      );
    }
    const headOnly = minimizable && collapsed;
    return (
      <div className={[styles.dock, headOnly && styles.minimized].filter(Boolean).join(' ')} data-testid="panel-dock">
        <div className={styles.body}>
          <PanelFrame id={id} label={label} className={styles.panel} header={head} headOnly={headOnly}>
            <div key={contentKey} className={styles.content}>
              {children}
            </div>
          </PanelFrame>
        </div>
      </div>
    );
  }

  // Телефон: нижняя шторка со своим «свернуть / развернуть» (SPEC §13); collapsed десктопа к ней не относится.
  if (mobile) {
    return (
      <Sheet id={id} label={label} contentKey={contentKey} header={header}>
        <div key={contentKey} className={styles.content}>
          {children}
        </div>
      </Sheet>
    );
  }

  return (
    <div className={[styles.dock, collapsed && styles.collapsed].filter(Boolean).join(' ')} data-testid="panel-dock">
      <DiamondButton
        icon={collapsed ? 'expand' : 'collapse'}
        label={t(collapsed ? 'panel.expand' : 'panel.collapse')}
        aria-expanded={!collapsed}
        aria-controls={id}
        className={styles.toggle}
        onClick={onToggle}
      />
      <div ref={contentRef} className={styles.body} aria-hidden={collapsed ? 'true' : undefined}>
        <PanelFrame id={id} label={label} className={styles.panel} header={header}>
          <div key={contentKey} className={styles.content}>
            {children}
          </div>
        </PanelFrame>
      </div>
    </div>
  );
}

export { styles as panelStyles };
