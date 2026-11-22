import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { navNew } from '../../app/flags';
import { listenOutsideTap } from '../../app/outsideTap';
import type { Screen } from '../../app/router';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero } from '../../data/types';
import { placeName } from '../../data/world';
import { useT, type MessageKey } from '../../i18n';
import { KindIcon, kindOf } from '../panel/PlaceList';
import styles from './HeroBar.module.css';
import { searchAll, toneOf, type SearchMatch } from './search';

const GROUP_LABEL: Record<SearchMatch['kind'], MessageKey> = {
  hero: 'search.heroes',
  region: 'search.regions',
  place: 'search.places',
};

const matchKey = (m: SearchMatch): string =>
  m.kind === 'hero' ? m.hero.key : m.kind === 'region' ? `r:${m.region.id}` : `p:${m.region.id}/${m.place.slug}`;

/** Экран варианта региона или места. */
const matchScreen = (m: Exclude<SearchMatch, { kind: 'hero' }>): Screen =>
  m.kind === 'region'
    ? { name: 'region', regionId: m.region.id }
    : { name: 'place', regionId: m.region.id, placeSlug: m.place.slug };

interface Props {
  /** Выбран герой. */
  onPick: (hero: Hero) => void;
  /** Выбран регион или место: открыть экран (`open`), выбранного героя не трогать. */
  onOpen: (screen: Screen) => void;
  onClose: () => void;
  /** Текущий вариант (стрелки, курсор) — экран показывает героя на карте (SPEC §6.6, #66); null — вариантов нет. */
  onPreview?: (hero: Hero | null) => void;
}

/**
 * Поле поиска с автодополнением (SPEC §6.5): герои (имена, ключи, алиасы), регионы и места на RU/EN — группами.
 * ↑ / ↓ — выбор варианта по всем группам, Enter — выбрать, Esc или уход фокуса — закрыть.
 */
export function HeroSearch({ onPick, onOpen, onClose, onPreview }: Props) {
  const { t, l, lang } = useT();
  const listId = useId();
  const optionId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchAll(query, lang), [query, lang]);
  const open = query.trim() !== '';
  const current = Math.min(active, Math.max(results.length - 1, 0));
  // Показ на карте (#66) — только у варианта-героя; регион или место ничего не показывают.
  const currentMatch = open ? results[current] : undefined;
  const shown = currentMatch?.kind === 'hero' ? currentMatch.hero : undefined;
  const choose = (m: SearchMatch) => (m.kind === 'hero' ? onPick(m.hero) : onOpen(matchScreen(m)));
  const groups = (['hero', 'region', 'place'] as const)
    .map((kind) => ({ kind, items: results.map((m, i) => ({ m, i })).filter(({ m }) => m.kind === kind) }))
    .filter((g) => g.items.length > 0);
  useEffect(() => {
    onPreview?.(shown ?? null);
  }, [shown, onPreview]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Esc закрывает только поиск, не уводит на уровень вверх и не снимает героя.
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      const match = results[current];
      if (match) {
        e.preventDefault();
        choose(match);
      }
    }
  };

  // `?nav=new` (#230, Н11): поиск закрывают Esc, тап вне поля без перетаскивания и выбор варианта — как окно
  // обратной связи и меню языка (#229). Нажатие на карту фокус уводит в никуда — это не закрытие; уход фокуса
  // клавишей Tab на другой элемент — закрытие, как и без флага.
  const nav = navNew();
  const frameRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });
  const searchLabel = t('rail.search');
  useEffect(() => {
    if (!nav) return;
    return listenOutsideTap(
      (target) => Boolean(frameRef.current?.contains(target) || target.closest(`button[aria-label="${searchLabel}"]`)),
      () => closeRef.current(),
    );
  }, [nav, searchLabel]);

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget as Node | null;
    if (nav && !to) return;
    if (!e.currentTarget.contains(to)) onClose();
  };

  return (
    <div ref={frameRef} className={styles.frame} role="search" onBlur={onBlur}>
      <input
        className={styles.input}
        type="search"
        role="combobox"
        aria-label={t('search.label')}
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results.length > 0 ? `${optionId}-${current}` : undefined}
        placeholder={t('search.placeholder')}
        autoComplete="off"
        spellCheck={false}
        // Поле появляется по клику на лупу — фокус сразу в нём.
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} className={styles.results} role="listbox" aria-label={t('search.label')}>
          {results.length === 0 && <li className={styles.empty}>{t('search.empty')}</li>}
          {groups.map((g) => (
            <li key={g.kind} role="presentation">
              {/* Заголовки групп — только когда групп несколько; при одной группе выдача как раньше. */}
              {groups.length > 1 && (
                <span className={styles.groupTitle} id={`${optionId}-${g.kind}`}>
                  {t(GROUP_LABEL[g.kind])}
                </span>
              )}
              <ul
                className={styles.group}
                role="group"
                {...(groups.length > 1 ? { 'aria-labelledby': `${optionId}-${g.kind}` } : { 'aria-label': t(GROUP_LABEL[g.kind]) })}
              >
                {g.items.map(({ m, i }) => (
                  <li
                    key={matchKey(m)}
                    id={`${optionId}-${i}`}
                    role="option"
                    aria-selected={i === current}
                    className={styles.option}
                    // Клик не должен уводить фокус из поля до выбора.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(m)}
                  >
                    {m.kind === 'hero' ? (
                      <>
                        <HeroPortrait hero={m.hero} link={false} className={styles.optionPortrait} />
                        <span className={styles.optionName}>{m.hero.name}</span>
                        {m.alias && <span className={styles.optionAlias}>{m.alias}</span>}
                      </>
                    ) : m.kind === 'region' ? (
                      <>
                        <span className={styles.optionIcon} aria-hidden="true">
                          <span className={styles.diamond} data-tone={toneOf(m.region)} />
                        </span>
                        <span className={styles.optionName}>{l(m.region.name)}</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.optionIcon} aria-hidden="true">
                          <KindIcon kind={kindOf(m.place)} />
                        </span>
                        <span className={styles.optionText}>
                          <span className={styles.optionName}>{placeName(m.place, lang)}</span>
                          <span className={styles.optionAlias}>
                            <span className="visually-hidden">, </span>
                            {l(m.region.name)}
                          </span>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
