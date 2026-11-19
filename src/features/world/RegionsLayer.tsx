import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Region } from '../../data/types';
import { useT } from '../../i18n';
import { WORLD_ART, WORLD_PREVIEW } from './art';
import { biomeColor } from './biomes';
import { clampLabelX, splitLabel } from './labels';
import styles from './RegionsLayer.module.css';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import { onActivate, points, smoothPath, toStage } from './stage';
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
  tip: Pick<RegionTooltipState, 'shownId' | 'focusId' | 'tooltipId' | 'litId' | 'region'>;
  /** Пункт списка регионов под наведением или фокусом (только в мире). */
  litId: string | null;
  /** Регионы выбранного героя и героя под наведением. */
  focusRegions: Set<string> | null;
  previewRegions: Set<string> | null;
  onSelectRegion: (regionId: string, source?: 'map' | 'list') => void;
}

/**
 * Слой регионов (ARCHITECTURE A4): сверху вниз — заливка подсветки S1h, полигоны-кнопки
 * (в DOM — в обратном порядке); названия — `RegionLabels` в экранном слое (#180).
 * В S2/S3 полигоны не кнопки: соседи затемнены, активный — «пустое место».
 */
export function RegionsLayer({ drawn, activeId, inWorld, tip, litId, focusRegions, previewRegions, onSelectRegion }: Props) {
  const { l } = useT();
  // Есть арт — полигоны прозрачны поверх картинки и только затемняют соседей; нет — заглушка цветом биома.
  const onArt = WORLD_ART ? styles.onArt : undefined;
  const fillOf = (r: Region) => (WORLD_ART ? '#000' : biomeColor(r.biome));
  const { shownId, focusId, tooltipId, litId: overId, region: on } = tip;
  const active = drawn.find((r) => r.id === activeId);
  // #188, #207: подсветка и кольцо по фокусу — только для фокуса с клавиатуры. Фокус от клика, тапа или возврата
  // в мир после кнопки «назад» мышью не подсвечивает регион: последним вводом был указатель, а не клавиша.
  const pointerFocus = useRef(false);
  useEffect(() => {
    const onPointer = () => {
      pointerFocus.current = true;
    };
    const onKey = () => {
      pointerFocus.current = false;
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);
  const isLit = (id: string) => id === shownId || id === overId || id === litId || (inWorld && (focusRegions?.has(id) || previewRegions?.has(id)));
  // Свечение появляется в DOM при первой подсветке и остаётся (для угасания): 27 погасших свечений под clipPath
  // дорого стоят кадру входа (A14). Состояние правится во время рендера — штатный приём React.
  const [everLit, setEverLit] = useState<ReadonlySet<string>>(() => new Set());
  const newlyLit = drawn.filter((r) => isLit(r.id) && !everLit.has(r.id));
  if (newlyLit.length) setEverLit(new Set([...everLit, ...newlyLit.map((r) => r.id)]));
  /** Класс приглушения или подсветки при выбранном герое. */
  const heroClass = (regionId: string) =>
    focusRegions ? (focusRegions.has(regionId) ? styles.heroRegion : styles.muted) : undefined;

  // S2/S3: активный регион — последним, чтобы границы соседей не перекрывали его рамку (#94).
  const polygons = inWorld ? drawn : [...drawn.filter((r) => r.id !== activeId), ...drawn.filter((r) => r.id === activeId)];

  return (
    <>
      <g>
        {polygons.map((r) => {
          const isActive = r.id === activeId;
          // S2/S3: соседи затемнены и не кликаются, активный регион — «пустое место» карты (SPEC §5.4)
          // в рамке цвета своей стороны или яруса (SPEC §8.3, #94).
          if (!inWorld) {
            return (
              <polygon
                key={r.id}
                className={[styles.region, onArt, isActive ? [styles.active, tones[highlight(r)]].join(' ') : styles.dimmed].filter(Boolean).join(' ')}
                points={points(r.layout!.polygon)}
                fill={fillOf(r)}
                aria-hidden="true"
                data-region={r.id}
              />
            );
          }
          return (
            <polygon
              key={r.id}
              className={[styles.region, onArt, heroClass(r.id)].filter(Boolean).join(' ')}
              points={points(r.layout!.polygon)}
              fill={fillOf(r)}
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
              // SPEC §5.3: на тач-устройствах подсветки и подсказки нет, тап сразу открывает регион.
              // #193: мышь на полигоне — только подсветка; подсказку вызывает подпись (`RegionLabels`).
              onPointerEnter={(e) => e.pointerType !== 'touch' && on.onEnter(r)}
              onPointerLeave={(e) => e.pointerType !== 'touch' && on.onLeave(r)}
              onFocus={() => {
                if (!pointerFocus.current) on.onFocus(r);
              }}
              onBlur={() => on.onBlur(r)}
            />
          );
        })}
      </g>
      {/* S2/S3 (#188): всё вне открытого региона затемнено и слегка размыто, край растушёван по форме региона;
          чужие ярусы гаснут целиком (#192). */}
      {WORLD_ART && !inWorld && active?.layout && (
        <RegionVeil
          d={smoothPath(active.layout.polygon)}
          tiers={foreignTiers(drawn, active).map((r) => smoothPath(r.layout!.polygon))}
          art={WORLD_PREVIEW ?? WORLD_ART}
        />
      )}
      {/* Подсветка S1h поверх всех полигонов, чтобы граница не пряталась под соседями (#188): мягкое свечение
          изнутри по сглаженной кривой и тонкий контур постоянной толщины на экране. */}
      <g aria-hidden="true">
        {drawn.map((r) => {
          const lit = isLit(r.id);
          if (!lit && !everLit.has(r.id)) return <g key={r.id} className={styles.tint} data-tint={r.id} />;
          const d = smoothPath(r.layout!.polygon);
          return (
            <g
              key={r.id}
              className={[
                styles.tint,
                onArt,
                tones[highlight(r)],
                lit && styles.lit,
                r.id === shownId && r.id === focusId && styles.focused,
              ]
                .filter(Boolean)
                .join(' ')}
              data-tint={r.id}
            >
              <clipPath id={`rl-clip-${r.id}`}>
                <path d={d} />
              </clipPath>
              <g className={styles.glow} clipPath={`url(#rl-clip-${r.id})`}>
                <path className={styles.glowFill} d={d} />
                <path className={styles.glowWide} d={d} />
                <path className={styles.glowNear} d={d} />
              </g>
              <path className={styles.outline} d={d} />
            </g>
          );
        })}
      </g>
    </>
  );
}

interface LabelProps {
  drawn: Region[];
  inWorld: boolean;
  /** Подсказка и наведение: что показано и что под мышью (#193: подсказку вызывает габарит подписи, `useRegionTooltip`). */
  tip: Pick<RegionTooltipState, 'shownId' | 'litId'>;
  litId: string | null;
  focusRegions: Set<string> | null;
  previewRegions: Set<string> | null;
  /** Измеренные ширины подписей (`r:id`). */
  widths: Record<string, number>;
}

/**
 * Названия регионов (ARCHITECTURE A4, #180): рисуются в экранном слое над слоем карты, а не в его растре,
 * поэтому чёткие на любом приближении. Координаты — те же единицы сцены.
 */
export function RegionLabels({ drawn, inWorld, tip, litId, focusRegions, previewRegions, widths }: LabelProps) {
  const { l } = useT();
  const { shownId, litId: overId } = tip;
  const heroClass = (regionId: string) =>
    focusRegions ? (focusRegions.has(regionId) ? styles.heroRegion : styles.muted) : undefined;
  return (
    <g aria-hidden="true" className={styles.labels}>
      {drawn.map((r, index) => {
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
              (r.id === shownId || r.id === overId || r.id === litId || (inWorld && previewRegions?.has(r.id))) && styles.lit,
              inWorld && heroClass(r.id),
            ]
              .filter(Boolean)
              .join(' ')}
            x={x}
            y={ly}
            textAnchor="middle"
            data-label={r.id}
            // Номер в каскаде проявления подписей после интро (#187, WorldScreen `unveiling`).
            style={{ '--i': index } as CSSProperties}
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
  );
}

/** Ярусы, чужие открытому региону (#192): верхний и нижний — для региона континента, другой ярус — для яруса. */
export function foreignTiers(drawn: Region[], active: Region): Region[] {
  return drawn.filter((r) => r.layout && r.tier !== 'continent' && r.tier !== active.tier && r.id !== active.id);
}

/**
 * Вуаль режима региона (#188): затемнение и лёгкое размытие арта вне региона. Размытие — превью мира 1024 px,
 * растянутое на сцену (фильтр по полной картинке не укладывается в бюджет кадра, A14). Маска — сцена целиком
 * минус растушёванная кривая региона; области фильтра и маски — вся сцена, а не габарит региона.
 * Чужие ярусы (`tiers`, #192) сверху гаснут целиком — цветом фона с широкой растушёвкой, без шва яруса на арте.
 */
function RegionVeil({ d, tiers, art }: { d: string; tiers: string[]; art: string }) {
  const stage = { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT };
  return (
    <g aria-hidden="true" className={styles.veil} data-testid="region-veil">
      <defs>
        <filter id="rl-feather" filterUnits="userSpaceOnUse" {...stage}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <mask id="rl-veil" maskUnits="userSpaceOnUse" {...stage}>
          <rect {...stage} fill="#fff" />
          <path d={d} fill="#000" filter="url(#rl-feather)" />
        </mask>
        {tiers.length > 0 && (
          <>
            <filter id="rl-tier-feather" filterUnits="userSpaceOnUse" {...stage}>
              <feGaussianBlur stdDeviation="28" />
            </filter>
            <mask id="rl-tiers" maskUnits="userSpaceOnUse" {...stage}>
              <g filter="url(#rl-tier-feather)">
                {tiers.map((t, i) => (
                  <path key={i} d={t} fill="#fff" />
                ))}
                <path d={d} fill="#000" />
              </g>
            </mask>
          </>
        )}
      </defs>
      <g mask="url(#rl-veil)">
        <image href={art} {...stage} preserveAspectRatio="none" />
        <rect className={styles.veilShade} {...stage} />
      </g>
      {tiers.length > 0 && <rect className={styles.tierShade} {...stage} mask="url(#rl-tiers)" data-testid="tier-shade" />}
    </g>
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
