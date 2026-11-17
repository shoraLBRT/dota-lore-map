import { useRef, useState } from 'react';
import { useNavigation } from '../../app/navigation';
import type { Lang, Place, Region } from '../../data/types';
import { heroesOfPlace, placeName } from '../../data/world';
import { useT, type MessageKey } from '../../i18n';
import { significance } from '../world/markerLayout';
import styles from './PlaceList.module.css';

/** Сколько мест видно до кнопки «Все места (N)» (SPEC §5.4 п. 7). */
export const PLACES_SHOWN = 8;

type Kind = 'capital' | 'event' | 'link' | 'minor';

const kindOf = (p: Place): Kind => (p.capital ? 'capital' : significance(p));

const RANK: Record<Kind, number> = { capital: 0, event: 1, link: 2, minor: 3 };

const KIND_LABEL: Partial<Record<Kind, MessageKey>> = {
  capital: 'places.capital',
  event: 'places.event',
  minor: 'places.minor',
};

/** Порядок списка: столица, места событий, обычные, второстепенные; внутри — по алфавиту языка, кавычки не в счёт. */
export function sortPlaces(places: Place[], lang: Lang): Place[] {
  return [...places].sort(
    (a, b) => RANK[kindOf(a)] - RANK[kindOf(b)] || placeName(a, lang).localeCompare(placeName(b, lang), lang, { ignorePunctuation: true }),
  );
}

/** Значок значимости — как маркер на карте (SPEC §6.3): звезда, яркое кольцо, кольцо, малое тусклое кольцо. */
function KindIcon({ kind }: { kind: Kind }) {
  return (
    <svg className={styles.icon} data-kind={kind} viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
      <circle className={styles.ring} r={kind === 'minor' ? 5 : 7.5} />
      {kind === 'capital' ? (
        <polygon
          className={styles.dot}
          points="0,-5 1.2,-1.6 4.8,-1.5 1.9,0.6 2.9,4 0,2 -2.9,4 -1.9,0.6 -4.8,-1.5 -1.2,-1.6"
        />
      ) : (
        <circle className={styles.dot} r={kind === 'minor' ? 2 : 3} />
      )}
    </svg>
  );
}

interface Props {
  region: Region;
  /** Место под наведением или фокусом строки (null — ни одно): маркер на карте подсвечен (SPEC §5.4). */
  onPreview?: (slug: string | null) => void;
}

/**
 * Блок «Места» панели региона (SPEC §5.4 п. 7, #99): строки-кнопки со значком значимости, названием,
 * типом, числом героев и значком медиа. Нажатие — как клик по маркеру. Регион без мест — блока нет.
 */
export function PlaceList({ region, onPreview }: Props) {
  const { l, lang, t } = useT();
  const { open } = useNavigation();
  const [all, setAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  if (region.places.length === 0) return null;

  const sorted = sortPlaces(region.places, lang);
  const shown = all ? sorted : sorted.slice(0, PLACES_SHOWN);
  const leave = () => onPreview?.(null);

  const expand = () => {
    setAll(true);
    // Кнопка «Все места» исчезает: фокус — на первое открывшееся место, а не в никуда.
    requestAnimationFrame(() => listRef.current?.querySelectorAll('button')[PLACES_SHOWN]?.focus());
  };

  return (
    <section data-testid="place-list">
      <h3>{t('panel.places')}</h3>
      <ul ref={listRef} className={styles.list}>
        {shown.map((p) => {
          const kind = kindOf(p);
          const label = KIND_LABEL[kind];
          const heroes = heroesOfPlace(region.id, p.slug).length;
          return (
            <li key={p.slug}>
              <button
                type="button"
                className={styles.row}
                data-place-row={p.slug}
                onClick={() => open({ name: 'place', regionId: region.id, placeSlug: p.slug })}
                onPointerEnter={(e) => e.pointerType !== 'touch' && onPreview?.(p.slug)}
                onPointerLeave={leave}
                onFocus={() => onPreview?.(p.slug)}
                onBlur={leave}
              >
                <KindIcon kind={kind} />
                <span className={styles.text}>
                  <span className={styles.name}>{placeName(p, lang)}</span>
                  {label && <span className="visually-hidden">, {t(label)}</span>}
                  {p.text?.type && <span className={styles.type}>{l(p.text.type)}</span>}
                </span>
                {heroes > 0 && (
                  <span className={styles.heroes}>
                    <span className="visually-hidden">{t('places.heroes', { n: String(heroes) })}</span>
                    <svg className={styles.person} viewBox="-6 -6 12 12" aria-hidden="true" focusable="false">
                      <circle cy={-2.5} r={2.5} />
                      <path d="M-5 6a5 5 0 0 1 10 0z" />
                    </svg>
                    <span aria-hidden="true">{heroes}</span>
                  </span>
                )}
                {p.media && p.media.length > 0 && (
                  <svg className={styles.media} viewBox="-6 -6 12 12" aria-hidden="true" focusable="false">
                    <rect x={-5} y={-5} width={10} height={10} />
                    <path d="M-5 0h10M0 0v5" />
                  </svg>
                )}
                {p.media && p.media.length > 0 && <span className="visually-hidden">, {t('places.media')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!all && sorted.length > PLACES_SHOWN && (
        <button type="button" className={styles.all} onClick={expand}>
          {t('panel.allPlaces', { n: String(sorted.length) })}
        </button>
      )}
    </section>
  );
}
