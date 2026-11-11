import { DiamondButton } from '../../components/DiamondButton';
import { useT } from '../../i18n';
import styles from './Blocks.module.css';

interface Props {
  /** Куда ведёт: «Мир» в S2, название региона в S3 (SPEC §6.4). */
  text: string;
  onClick: () => void;
}

/** Хлебные крошки внизу панели (SPEC §6.4): «‹ Мир» в регионе, «‹ Регион» в месте. */
export function Breadcrumbs({ text, onClick }: Props) {
  const { t } = useT();
  return (
    <nav className={styles.crumbs} aria-label={t('panel.breadcrumbs')}>
      <DiamondButton icon="back" label={t('panel.backTo', { name: text })} onClick={onClick}>
        {text}
      </DiamondButton>
    </nav>
  );
}
