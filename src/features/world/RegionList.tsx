import { useId, useMemo, type CSSProperties } from 'react';
import type { Lang, Region } from '../../data/types';
import { useT, type MessageKey } from '../../i18n';
import styles from './RegionList.module.css';

// Список регионов под картой мира на телефоне (#39, решение владельца 2026-11-12; SPEC §13, ARCHITECTURE A13).
// Карта на 375 px — 375×234, подписи ≈ 7 px: список даёт читаемые названия и цели нажатия ≥ 44 px.
// Порядок групп — сверху вниз, как на карте: Верхний ярус, Radiant, нейтральные земли, Dire, Бездна.

type Group = 'upper' | 'radiant' | 'neutral' | 'dire' | 'abyss';

const GROUPS: { key: Group; label: MessageKey }[] = [
  { key: 'upper', label: 'list.upper' },
  { key: 'radiant', label: 'list.radiant' },
  { key: 'neutral', label: 'list.neutral' },
  { key: 'dire', label: 'list.dire' },
  { key: 'abyss', label: 'list.abyss' },
];

/** Группа и цвет подсветки — как на карте (SPEC §8.3): ярусы — свой цвет, материк — по стороне. */
export const regionGroup = (r: Region): Group => (r.tier === 'continent' ? r.side : r.tier);

/** Ключ сортировки: без английского артикля («The Free Cities» — на F). */
const sortKey = (name: string) => name.replace(/^the\s+/i, '');

function heroCount(lang: Lang, n: number, t: (key: MessageKey, vars?: Record<string, string>) => string): string {
  const form = new Intl.PluralRules(lang).select(n);
  const key: MessageKey = form === 'one' ? 'list.heroes.one' : form === 'few' ? 'list.heroes.few' : 'list.heroes.many';
  return t(key, { n: String(n) });
}

interface Props {
  regions: Region[];
  onSelect: (regionId: string) => void;
  /** Наведение мышью или фокус на пункте подсвечивает регион на карте; null — снять. */
  onHighlight: (regionId: string | null) => void;
  /** Число героев региона. */
  heroCountOf: (regionId: string) => number;
  /** Выбран герой (SPEC §6.5): его регионы отмечены, остальные приглушены, но нажимаются. */
  focus?: Set<string> | null;
  /** Камера ещё летит в мир: список проявится после посадки. */
  waiting?: boolean;
  style?: CSSProperties;
}

export function RegionList({ regions, onSelect, onHighlight, heroCountOf, focus, waiting = false, style }: Props) {
  const { l, lang, t } = useT();
  const titleId = useId();
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: regions
          .filter((r) => regionGroup(r) === g.key)
          .sort((a, b) => sortKey(l(a.name)).localeCompare(sortKey(l(b.name)), lang)),
      })).filter((g) => g.items.length > 0),
    [regions, l, lang],
  );

  return (
    <nav
      className={[styles.list, waiting && styles.waiting].filter(Boolean).join(' ')}
      style={style}
      aria-labelledby={titleId}
      data-testid="region-list"
    >
      <h2 id={titleId} className={styles.title}>
        {t('world.regions')}
      </h2>
      {groups.map((g) => (
        <section key={g.key} className={styles.group} aria-labelledby={`${titleId}-${g.key}`}>
          <h3 id={`${titleId}-${g.key}`} className={[styles.groupTitle, styles[g.key]].join(' ')}>
            {t(g.label)}
          </h3>
          <ul className={styles.items}>
            {g.items.map((r) => {
              const mark = focus ? (focus.has(r.id) ? styles.heroRegion : styles.muted) : undefined;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={[styles.item, styles[regionGroup(r)], mark].filter(Boolean).join(' ')}
                    data-list-region={r.id}
                    onClick={() => onSelect(r.id)}
                    onPointerEnter={(e) => e.pointerType !== 'touch' && onHighlight(r.id)}
                    onPointerLeave={() => onHighlight(null)}
                    onFocus={() => onHighlight(r.id)}
                    onBlur={() => onHighlight(null)}
                  >
                    <span className={styles.swatch} aria-hidden="true" />
                    <span className={styles.name}>{l(r.name)}</span>
                    <span className={styles.count}>{heroCount(lang, heroCountOf(r.id), t)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
