import { useId, useMemo } from "react";
import type { Lang, Region } from "../../data/types";
import { useT, type MessageKey } from "../../i18n";
import styles from "./RegionList.module.css";

// Список регионов на телефоне (#39) — нижняя шторка поверх карты во весь экран (#196, решение владельца 2026-11-19;
// SPEC §13, ARCHITECTURE A13): свёрнута до ручки «Регионы», развёрнута — названия и цели нажатия ≥ 44 px.
// Порядок групп — сверху вниз, как на карте: Верхний ярус, Radiant, нейтральные земли, Dire, Бездна.

type Group = "upper" | "radiant" | "neutral" | "dire" | "abyss";

const GROUPS: { key: Group; label: MessageKey }[] = [
  { key: "upper", label: "list.upper" },
  { key: "radiant", label: "list.radiant" },
  { key: "neutral", label: "list.neutral" },
  { key: "dire", label: "list.dire" },
  { key: "abyss", label: "list.abyss" },
];

/** Группа и цвет подсветки — как на карте (SPEC §8.3): ярусы — свой цвет, материк — по стороне. */
export const regionGroup = (r: Region): Group =>
  r.tier === "continent" ? r.side : r.tier;

/** Ключ сортировки: без английского артикля («The Free Cities» — на F). */
const sortKey = (name: string) => name.replace(/^the\s+/i, "");

function heroCount(
  lang: Lang,
  n: number,
  t: (key: MessageKey, vars?: Record<string, string>) => string,
): string {
  const form = new Intl.PluralRules(lang).select(n);
  const key: MessageKey =
    form === "one"
      ? "list.heroes.one"
      : form === "few"
        ? "list.heroes.few"
        : "list.heroes.many";
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
  /** Шторка развёрнута: видны пункты; свёрнута — только ручка. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegionList({
  regions,
  onSelect,
  onHighlight,
  heroCountOf,
  focus,
  waiting = false,
  open,
  onOpenChange,
}: Props) {
  const { l, lang, t } = useT();
  const titleId = useId();
  const bodyId = useId();
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: regions
          .filter((r) => regionGroup(r) === g.key)
          .sort((a, b) =>
            sortKey(l(a.name)).localeCompare(sortKey(l(b.name)), lang),
          ),
      })).filter((g) => g.items.length > 0),
    [regions, l, lang],
  );

  return (
    <nav
      className={[styles.list, open && styles.open, waiting && styles.waiting]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      data-testid="region-list"
      data-region-list
      data-state={open ? "open" : "closed"}
    >
      <h2 id={titleId} className={styles.title}>
        <button
          type="button"
          className={styles.handle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => onOpenChange(!open)}
        >
          <span className={styles.grip} aria-hidden="true" />
          {t("world.regions")}
          <svg
            className={styles.chevron}
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M4 10l4-4 4 4" />
          </svg>
        </button>
      </h2>
      <div id={bodyId} className={styles.body} hidden={!open}>
        {groups.map((g) => (
          <section
            key={g.key}
            className={styles.group}
            aria-labelledby={`${titleId}-${g.key}`}
          >
            <h3
              id={`${titleId}-${g.key}`}
              className={[styles.groupTitle, styles[g.key]].join(" ")}
            >
              {t(g.label)}
            </h3>
            <ul className={styles.items}>
              {g.items.map((r) => {
                const mark = focus
                  ? focus.has(r.id)
                    ? styles.heroRegion
                    : styles.muted
                  : undefined;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={[styles.item, styles[regionGroup(r)], mark]
                        .filter(Boolean)
                        .join(" ")}
                      data-list-region={r.id}
                      onClick={() => onSelect(r.id)}
                      onPointerEnter={(e) =>
                        e.pointerType !== "touch" && onHighlight(r.id)
                      }
                      onPointerLeave={() => onHighlight(null)}
                      onFocus={() => onHighlight(r.id)}
                      onBlur={() => onHighlight(null)}
                    >
                      <span className={styles.swatch} aria-hidden="true" />
                      <span className={styles.name}>{l(r.name)}</span>
                      <span className={styles.count}>
                        {heroCount(lang, heroCountOf(r.id), t)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
