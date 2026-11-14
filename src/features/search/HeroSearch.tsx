import { useEffect, useId, useMemo, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero } from '../../data/types';
import { useT } from '../../i18n';
import styles from './HeroBar.module.css';
import { searchHeroes } from './search';

interface Props {
  onPick: (hero: Hero) => void;
  onClose: () => void;
  /** Текущий вариант (стрелки, курсор) — экран показывает героя на карте (SPEC §6.6, #66); null — вариантов нет. */
  onPreview?: (hero: Hero | null) => void;
}

/**
 * Поле поиска героя с автодополнением (SPEC §6.5): имена, ключи и алиасы на RU/EN.
 * ↑ / ↓ — выбор варианта, Enter — выбрать, Esc или уход фокуса — закрыть.
 */
export function HeroSearch({ onPick, onClose, onPreview }: Props) {
  const { t } = useT();
  const listId = useId();
  const optionId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchHeroes(query), [query]);
  const open = query.trim() !== '';
  const current = Math.min(active, Math.max(results.length - 1, 0));
  const shown = open ? results[current]?.hero : undefined;
  useEffect(() => {
    onPreview?.(shown ?? null);
  }, [shown, onPreview]);
  // Поиск закрыли — героя под курсором больше нет.
  useEffect(() => () => onPreview?.(null), [onPreview]);

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
        onPick(match.hero);
      }
    }
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose();
  };

  return (
    <div className={styles.frame} role="search" onBlur={onBlur}>
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
          {results.map((m, i) => (
            <li
              key={m.hero.key}
              id={`${optionId}-${i}`}
              role="option"
              aria-selected={i === current}
              className={styles.option}
              // Клик не должен уводить фокус из поля до выбора.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(m.hero)}
            >
              <HeroPortrait hero={m.hero} link={false} className={styles.optionPortrait} />
              <span className={styles.optionName}>{m.hero.name}</span>
              {m.alias && <span className={styles.optionAlias}>{m.alias}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
