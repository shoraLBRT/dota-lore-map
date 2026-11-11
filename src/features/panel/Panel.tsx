import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useMediaQuery } from '../../app/media';
import { DiamondButton } from '../../components/DiamondButton';
import { PanelFrame } from '../../components/PanelFrame';
import { useT } from '../../i18n';
import { MOBILE_QUERY } from '../world/camera';
import styles from './Panel.module.css';
import { Sheet } from './Sheet';

interface Props {
  label: string;
  /** Панель свёрнута: уехала за правый край, на виду только кнопка-ромб (SPEC §5.4). */
  collapsed: boolean;
  onToggle: () => void;
  /** Смена ключа — кроссфейд содержимого (A4, 250 мс). */
  contentKey: string;
  children: ReactNode;
}

/**
 * Правая панель регионов и мест: лежит поверх карты, выезжает справа (A3, 400 мс),
 * сворачивается кнопкой-ромбом на левом краю без смещения карты (SPEC §5.4).
 */
export function Panel({ label, collapsed, onToggle, contentKey, children }: Props) {
  const { t } = useT();
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);

  // Свёрнутая панель недоступна мыши и клавиатуре. React 18 не знает inert — свойство DOM напрямую.
  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = collapsed;
  }, [collapsed, contentKey, mobile]);

  // Телефон: нижняя шторка со своим «свернуть / развернуть» (SPEC §13); collapsed десктопа к ней не относится.
  if (mobile) {
    return (
      <Sheet id={id} label={label} contentKey={contentKey}>
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
        <PanelFrame id={id} label={label} className={styles.panel}>
          <div key={contentKey} className={styles.content}>
            {children}
          </div>
        </PanelFrame>
      </div>
    </div>
  );
}

export { styles as panelStyles };
