import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Кнопка в стиле Dota (SPEC §8.5): срезанные углы, металлическая рамка, подсветка при наведении. */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: Props) {
  const cls = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
