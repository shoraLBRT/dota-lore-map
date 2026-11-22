import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Region } from '../../data/types';
import { useT } from '../../i18n';
import { WORLD_ART, WORLD_PREVIEW } from './art';
import { biomeColor } from './biomes';
import { crestPath } from './crests';
import { nameLines, type RegionNames } from './regionLabelLayout';
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
  tip: Pick<RegionTooltipState, 'shownId' | 'litId' | 'region'>;
  litId: string | null;
  focusRegions: Set<string> | null;
  previewRegions: Set<string> | null;
  /** Уровни, размеры и стороны названий (#189, `useRegionNames`). */
  names: RegionNames;
  /** Приближение мира на экране. */
  zoom: number;
  onSelectRegion: (regionId: string, source?: 'map' | 'list') => void;
}

/** Герб не меньше этого — кнопка для мыши (цель ≥ 44 px); меньше (телефон) — знак, нажатие ловит полигон под ним. */
const CREST_BUTTON = 40;
/** Цель нажатия герба, px. */
const CREST_HIT = 44;
/** Базовая линия первой строки от верха рамки названия — доля кегля (капители Cormorant SC). */
const BASELINE = 0.8;

/**
 * Названия регионов (ARCHITECTURE A4, #180, #189): в экранном слое над слоем карты, поэтому чёткие на любом
 * приближении. Группа названия стоит в точке `layout.label` и масштабирована в px экрана: размеры и стороны —
 * `useRegionNames`. Первый уровень — с гербом; второй и третий видны с порога приближения (`from`).
 * Регион под мышью, фокусом или пунктом списка (#243) в мире подписан всегда, даже до своего порога: его название
 * рисуется последним, поверх соседей. Герб — цель для мыши (aria-hidden: клавиатура и диктор ходят по полигонам-кнопкам).
 */
export function RegionLabels({ drawn, inWorld, tip, litId, focusRegions, previewRegions, names, zoom, onSelectRegion }: LabelProps) {
  const { l } = useT();
  const { shownId, litId: overId, region: on } = tip;
  const heroClass = (regionId: string) =>
    focusRegions ? (focusRegions.has(regionId) ? styles.heroRegion : styles.muted) : undefined;
  const hovered = (id: string) => inWorld && (id === shownId || id === overId || id === litId);
  // Название под наведением — последним в DOM: в SVG порядок — это слой, и оно встаёт поверх соседей.
  const order = drawn.map((r, index) => ({ r, index })).sort((a, b) => Number(hovered(a.r.id)) - Number(hovered(b.r.id)));
  return (
    <g aria-hidden="true" className={styles.labels}>
      {order.map(({ r, index }) => {
        const spot = names.spots.get(r.id);
        const metrics = names.metrics.get(r.id);
        if (!spot || !metrics) return null;
        const [lx, ly] = toStage(r.layout!.label);
        const name = l(r.name);
        const lines = nameLines(r, name);
        const level = names.levels.get(r.id) ?? 2;
        const shown = zoom >= spot.from - 1e-6 || hovered(r.id);
        const { box } = spot;
        const anchor = spot.side === 'right' ? 'start' : spot.side === 'left' ? 'end' : 'middle';
        const tx = spot.side === 'right' ? box.left + 3 : spot.side === 'left' ? box.right - 3 : (box.left + box.right) / 2;
        const ty = box.top + 3 + metrics.font * BASELINE;
        const c = metrics.crest;
        const button = c >= CREST_BUTTON && inWorld && shown;
        return (
          <g
            key={r.id}
            // Сдвиг и масштаб пишет камера (`placeAnchors`): слой подписей камерой не масштабируется (A4, #231).
            data-at={`${lx} ${ly}`}
            className={[styles.spot, !shown && styles.off].filter(Boolean).join(' ')}
            // Скрытое название не ловит наведение и не мешает подсказке (#193): у него нет `data-label`.
            data-label={shown ? r.id : undefined}
            data-label-off={shown ? undefined : r.id}
            data-level={level}
            // Номер в каскаде проявления подписей после интро (#187, WorldScreen `unveiling`).
            style={{ '--i': index } as CSSProperties}
          >
            <g
              className={[
                styles.label,
                tones[highlight(r)],
                r.tier !== 'continent' && styles.tierLabel,
                level === 3 && styles.level3,
                (r.id === shownId || r.id === overId || r.id === litId || (inWorld && previewRegions?.has(r.id))) && styles.lit,
                inWorld && heroClass(r.id),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {c > 0 && (
                <g
                  className={[styles.crest, button && styles.crestButton].filter(Boolean).join(' ')}
                  data-crest={r.id}
                  onClick={button ? () => onSelectRegion(r.id, 'map') : undefined}
                  onPointerEnter={button ? (e) => e.pointerType !== 'touch' && on.onEnter(r) : undefined}
                  onPointerLeave={button ? (e) => e.pointerType !== 'touch' && on.onLeave(r) : undefined}
                >
                  {button && <circle className={styles.crestHit} r={Math.max(c, CREST_HIT) / 2} />}
                  <circle className={styles.crestDisc} r={c / 2 - 0.75} />
                  <circle className={styles.crestRing} r={c / 2 - 3.5} />
                  <path className={styles.crestGlyph} d={crestPath(r.id)} transform={`scale(${(c / 40).toFixed(3)}) translate(-12 -12)`} />
                </g>
              )}
              <text className={styles.name} x={tx} y={ty} textAnchor={anchor} style={{ fontSize: `${metrics.font}px` }}>
                {lines.map((line, i) => (
                  <tspan key={i} x={tx} dy={i === 0 ? undefined : metrics.line} data-measure={`r:${r.id}`}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** Ширины ступеней растушёвки чужого яруса, единицы сцены: половина обводки ложится внутрь яруса. */
const TIER_FEATHER = [120, 80, 48, 20];

/** Ярусы, чужие открытому региону (#192): верхний и нижний — для региона континента, другой ярус — для яруса. */
export function foreignTiers(drawn: Region[], active: Region): Region[] {
  return drawn.filter((r) => r.layout && r.tier !== 'continent' && r.tier !== active.tier && r.id !== active.id);
}

/**
 * Вуаль режима региона (#188): затемнение и лёгкое размытие арта вне региона. Размытие — превью мира 1024 px,
 * растянутое на сцену (фильтр по полной картинке не укладывается в бюджет кадра, A14). Маска — сцена целиком
 * минус растушёванная кривая региона; области фильтра и маски — вся сцена, а не габарит региона.
 * Чужие ярусы (`tiers`, #192) сверху гаснут целиком — цветом фона, край растушёван внутрь ступенями обводки в маске
 * (`TIER_FEATHER`), без шва яруса на арте. Полигоны регионов не пересекаются — свой регион вычитать не нужно.
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
            <mask id="rl-tiers" maskUnits="userSpaceOnUse" {...stage}>
              {tiers.map((t, i) => (
                <g key={i}>
                  <path d={t} fill="#fff" />
                  {/* Край гаснет внутрь ступенями обводки, без фильтра: размытие маски на всю сцену дорого (A14). */}
                  {TIER_FEATHER.map((w) => (
                    <path key={w} d={t} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={w} />
                  ))}
                </g>
              ))}
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
