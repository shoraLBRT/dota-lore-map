import { cloneElement, useId, type ReactElement } from 'react';
import styles from './Tooltip.module.css';

interface Props {
  content: string;
  /** Где показать: над элементом (по умолчанию) или справа (левая панель). */
  placement?: 'top' | 'right';
  /**
   * describe — подсказка дополняет имя элемента (aria-describedby);
   * label — подсказка и есть имя (иконки без текста, aria-labelledby).
   */
  mode?: 'describe' | 'label';
  children: ReactElement<{ 'aria-describedby'?: string; 'aria-labelledby'?: string }>;
}

/**
 * Подсказка у элемента при наведении и фокусе (SPEC §7.1 A2: fade + сдвиг 8 px).
 */
export function Tooltip({ content, placement = 'top', mode = 'describe', children }: Props) {
  const id = useId();
  const aria = mode === 'label' ? { 'aria-labelledby': id } : { 'aria-describedby': id };
  return (
    <span className={`${styles.wrap} ${styles[placement]}`}>
      {cloneElement(children, aria)}
      <span id={id} role="tooltip" className={styles.tip}>
        {content}
      </span>
    </span>
  );
}
