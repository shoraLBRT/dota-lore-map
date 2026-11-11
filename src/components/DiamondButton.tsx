import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './DiamondButton.module.css';

export type DiamondIcon = 'close' | 'collapse' | 'expand' | 'back';

const GLYPH: Record<DiamondIcon, string> = { close: '×', collapse: '›', expand: '‹', back: '‹' };

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: DiamondIcon;
  /** Доступное имя кнопки. */
  label: string;
  /** Видимая подпись рядом с ромбом (например, «Мир» у «назад»). */
  children?: ReactNode;
}

/** Кнопка-ромб для «закрыть», «свернуть», «назад» (SPEC §8.5). */
export function DiamondButton({ icon, label, children, className, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={[styles.button, className].filter(Boolean).join(' ')} aria-label={label} {...rest}>
      <span className={styles.diamond} aria-hidden="true">
        <span className={styles.glyph}>{GLYPH[icon]}</span>
      </span>
      {children && (
        <span className={styles.text} aria-hidden="true">
          {children}
        </span>
      )}
    </button>
  );
}
