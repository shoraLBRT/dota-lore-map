import type { Region } from '../../data/types';
import { useT } from '../../i18n';
import { biomeColor } from './biomes';
import { clampLabelX, splitLabel } from './labels';
import styles from './RegionsLayer.module.css';
import { onActivate, points, toStage } from './stage';
import tones from './tones.module.css';
import type { RegionTooltipState } from './useRegionTooltip';

/** Класс кадра карты в регионе и месте (S2/S3): полигоны не кликаются, названия регионов гаснут. */
export const zoomedClass = styles.zoomed;

/** Цвет подсветки (SPEC §8.3): ярусы — своё свечение, остальные — по стороне. */
const highlight = (r: Region) => (r.tier === 'continent' ? r.side : r.tier);

interface Props {
  /** Регионы с геометрией. */
  drawn: Region[];
  activeId: string | undefined;
  inWorld: boolean;
  /** Подсказка региона: что показано и обработчики полигонов. */
  tip: Pick<RegionTooltipState, 'shownId' | 'focusId' | 'tooltipId' | 'region'>;
  /** Пункт списка регионов под наведением или фокусом (только в мире). */
  litId: string | null;
  /** Регионы выбранного героя и героя под наведением. */
  focusRegions: Set<string> | null;
  previewRegions: Set<string> | null;
  /** Измеренные ширины подписей (`r:id`). */
  widths: Record<string, number>;
  onSelectRegion: (regionId: string, source?: 'map' | 'list') => void;
}

/**
 * Слой регионов (ARCHITECTURE A4): сверху вниз — подписи, заливка подсветки S1h, полигоны-кнопки
 * (в DOM — в обратном порядке). В S2/S3 полигоны не кнопки: соседи затемнены, активный — «пустое место».
 */
export function RegionsLayer({ drawn, activeId, inWorld, tip, litId, focusRegions, previewRegions, widths, onSelectRegion }: Props) {
  const { l } = useT();
  const { shownId, focusId, tooltipId, region: on } = tip;
  /** Класс приглушения или подсветки при выбранном герое. */
  const heroClass = (regionId: string) =>
    focusRegions ? (focusRegions.has(regionId) ? styles.heroRegion : styles.muted) : undefined;

  return (
    <>
      <g>
        {drawn.map((r) => {
          const isActive = r.id === activeId;
          // S2/S3: соседи затемнены и не кликаются, активный регион — «пустое место» карты (SPEC §5.4).
          if (!inWorld) {
            return (
              <polygon
                key={r.id}
                className={[styles.region, isActive ? styles.active : styles.dimmed].join(' ')}
                points={points(r.layout!.polygon)}
                fill={biomeColor(r.biome)}
                aria-hidden="true"
                data-region={r.id}
              />
            );
          }
          return (
            <polygon
              key={r.id}
              className={[styles.region, heroClass(r.id)].filter(Boolean).join(' ')}
              points={points(r.layout!.polygon)}
              fill={biomeColor(r.biome)}
              role="button"
              tabIndex={0}
              aria-label={l(r.name)}
              aria-describedby={r.id === shownId ? tooltipId : undefined}
              data-region={r.id}
              onClick={() => onSelectRegion(r.id, 'map')}
              onKeyDown={(e) => {
                if (on.onKeyDown(r, e)) return;
                onActivate(() => onSelectRegion(r.id, 'map'))(e);
              }}
              // SPEC §5.3: на тач-устройствах подсказки нет, тап сразу открывает регион.
              onPointerEnter={(e) => e.pointerType !== 'touch' && on.onEnter(r)}
              onPointerLeave={(e) => e.pointerType !== 'touch' && on.onLeave(r)}
              onFocus={() => on.onFocus(r)}
              onBlur={() => on.onBlur(r)}
            />
          );
        })}
      </g>
      {/* Заливка цветом стороны поверх всех полигонов, чтобы светлая граница не пряталась под соседями. */}
      <g aria-hidden="true">
        {drawn.map((r) => (
          <polygon
            key={r.id}
            className={[
              styles.tint,
              tones[highlight(r)],
              (r.id === shownId || r.id === litId || (inWorld && (focusRegions?.has(r.id) || previewRegions?.has(r.id)))) &&
                styles.lit,
              r.id === shownId && r.id === focusId && styles.focused,
            ]
              .filter(Boolean)
              .join(' ')}
            points={points(r.layout!.polygon)}
            data-tint={r.id}
          />
        ))}
      </g>
      <g aria-hidden="true" className={styles.labels}>
        {drawn.map((r) => {
          const [lx, ly] = toStage(r.layout!.label);
          // Длинные названия регионов — в две строки (ярусам, широким полосам, не нужно); подпись не выходит за край.
          const name = l(r.name);
          const lines = r.tier === 'continent' ? splitLabel(name) : [name];
          const width = widths[`r:${r.id}`];
          const x = width ? clampLabelX(lx, width) : lx;
          return (
            <text
              key={r.id}
              className={[
                styles.label,
                tones[highlight(r)],
                r.tier !== 'continent' && styles.tierLabel,
                (r.id === shownId || r.id === litId || (inWorld && previewRegions?.has(r.id))) && styles.lit,
                inWorld && heroClass(r.id),
              ]
                .filter(Boolean)
                .join(' ')}
              x={x}
              y={ly}
              textAnchor="middle"
              data-label={r.id}
              data-measure={lines.length === 1 ? `r:${r.id}` : undefined}
            >
              {lines.length === 1
                ? name
                : lines.map((line, i) => (
                    <tspan key={i} x={x} dy={i === 0 ? '-0.45em' : '1.05em'} data-measure={`r:${r.id}`}>
                      {line}
                    </tspan>
                  ))}
            </text>
          );
        })}
      </g>
    </>
  );
}

/** Регионы без геометрии в `map/layout.json` — списком кнопок под картой. */
export function UnmappedRegions({
  regions,
  activeId,
  onSelect,
}: {
  regions: Region[];
  activeId: string | undefined;
  onSelect: (regionId: string) => void;
}) {
  const { l, t } = useT();
  return (
    <nav className={styles.list} aria-label={t('world.regions')}>
      <ul>
        {regions.map((r) => (
          <li key={r.id}>
            <button type="button" aria-current={r.id === activeId ? 'true' : undefined} onClick={() => onSelect(r.id)}>
              {l(r.name)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
