import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Tooltip } from '../../components/Tooltip';
import type { Lang } from '../../data/types';
import { LANGS, useT } from '../../i18n';
import styles from './LangMenu.module.css';

/** Названия языков — каждый на самом себе (самоназвание), поэтому не из словаря. */
const NAMES: Record<Lang, string> = { ru: 'Русский', en: 'English' };

/**
 * Язык в левой панели (SPEC §6.1, #195): один значок с подписью текущего языка («RU»), по нажатию —
 * меню языков. Клавиатура: Enter / пробел / ↓ открывают меню с фокусом на текущем языке, ↑ / ↓ листают,
 * Esc и Tab закрывают; выбор закрывает меню и возвращает фокус на значок.
 */
export function LangMenu({ buttonClassName }: { buttonClassName?: string }) {
  const { lang, setLang, t } = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, LANGS.indexOf(lang))]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // Фокус ставится только при открытии меню.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (focusButton: boolean) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  const choose = (code: Lang) => {
    setLang(code);
    close(true);
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = items.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'Escape') {
      // Esc закрывает только меню, не уводит экран уровнем выше (глобальный Esc — на window).
      e.stopPropagation();
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items.current[(at + step + LANGS.length) % LANGS.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items.current[e.key === 'Home' ? 0 : LANGS.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrap} className={[styles.wrap, open && styles.open].filter(Boolean).join(' ')}>
      <Tooltip content={t('rail.lang', { code: lang.toUpperCase() })} placement="right" mode="label">
        <button
          ref={button}
          type="button"
          className={[buttonClassName, styles.button].filter(Boolean).join(' ')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span aria-hidden="true">{lang.toUpperCase()}</span>
        </button>
      </Tooltip>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t('lang.label')} onKeyDown={onMenuKey}>
          {LANGS.map((code, i) => (
            <button
              key={code}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={code === lang}
              lang={code}
              tabIndex={-1}
              className={styles.item}
              onClick={() => choose(code)}
            >
              <span className={styles.code} aria-hidden="true">
                {code.toUpperCase()}
              </span>
              {NAMES[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
