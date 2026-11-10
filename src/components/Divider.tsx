import styles from './Divider.module.css';

/** Тонкая металлическая линия с ромбами на концах (SPEC §8.5). */
export function Divider({ className }: { className?: string }) {
  return <hr className={[styles.divider, className].filter(Boolean).join(' ')} />;
}
