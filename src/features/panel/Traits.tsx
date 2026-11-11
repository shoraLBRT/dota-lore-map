import type { Region } from '../../data/types';
import { useT, type MessageKey } from '../../i18n';
import styles from './Blocks.module.css';

const SIDE: Record<Region['side'], MessageKey> = {
  radiant: 'side.radiant',
  dire: 'side.dire',
  neutral: 'side.neutral',
};

/**
 * Характеристики региона 2×2 (SPEC §4.2): сторона, власть, отношение к магии, среда.
 * Сторона известна всегда; не найденное в лоре значение — «Неизвестно».
 */
export function Traits({ region }: { region: Region }) {
  const { l, t } = useT();
  const unknown = t('traits.unknown');
  const items: [MessageKey, string][] = [
    ['traits.side', t(SIDE[region.side])],
    ['traits.rule', region.traits?.rule ? l(region.traits.rule) : unknown],
    ['traits.magic', region.traits?.magic ? l(region.traits.magic) : unknown],
    ['traits.biome', region.traits?.biome ? l(region.traits.biome) : unknown],
  ];
  return (
    <dl className={styles.traits}>
      {items.map(([key, value]) => (
        <div key={key} className={styles.trait}>
          <dt>{t(key)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
