import { useNavigation } from '../../app/navigation';
import { DiamondButton } from '../../components/DiamondButton';
import type { Place, Region } from '../../data/types';
import { useT } from '../../i18n';
import styles from './Blocks.module.css';

interface Props {
  region: Region;
  /** Открыто место — крошка ведёт в его регион, иначе в мир (SPEC §6.4). */
  place?: Place | null;
}

/**
 * Хлебные крошки в шапке панели (SPEC §6.4): «‹ Мир» в регионе, «‹ Регион» в месте.
 * Стоят над прокруткой — видны всегда, рядом с кнопкой «Свернуть».
 */
export function Breadcrumbs({ region, place }: Props) {
  const { l, t } = useT();
  const { open } = useNavigation();
  const text = place ? l(region.name) : t('panel.world');
  const onClick = () => open(place ? { name: 'region', regionId: region.id } : { name: 'world' });
  return (
    <nav className={styles.crumbs} aria-label={t('panel.breadcrumbs')}>
      <DiamondButton icon="back" label={t('panel.backTo', { name: text })} onClick={onClick}>
        {text}
      </DiamondButton>
    </nav>
  );
}
