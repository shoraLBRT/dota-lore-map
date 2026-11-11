import { useEffect, useId, useRef, type ReactNode } from 'react';
import { DiamondButton } from '../../components/DiamondButton';
import { PanelFrame } from '../../components/PanelFrame';
import { useT } from '../../i18n';
import styles from './Panel.module.css';

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

  // Свёрнутая панель недоступна мыши и клавиатуре. React 18 не знает inert — свойство DOM напрямую.
  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = collapsed;
  }, [collapsed, contentKey]);

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
