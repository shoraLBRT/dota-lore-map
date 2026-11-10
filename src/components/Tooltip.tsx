import { cloneElement, useId, type ReactElement } from 'react';
import styles from './Tooltip.module.css';

interface Props {
  content: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

/**
 * Подсказка над элементом при наведении и фокусе (SPEC §7.1 A2: fade + сдвиг 8 px).
 * Дочерний элемент получает aria-describedby.
 */
export function Tooltip({ content, children }: Props) {
  const id = useId();
  return (
    <span className={styles.wrap}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span id={id} role="tooltip" className={styles.tip}>
        {content}
      </span>
    </span>
  );
}
