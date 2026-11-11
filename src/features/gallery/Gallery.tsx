import { useEffect, useId, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import buttonStyles from '../../components/Button.module.css';
import { DiamondButton } from '../../components/DiamondButton';
import { trapTab } from '../../components/focusTrap';
import type { Media } from '../../data/types';
import { mediaSourceUrl, mediaSrc } from '../../data/world';
import { useT } from '../../i18n';
import styles from './Gallery.module.css';
import { counter, youtubeEmbed } from './items';

/** Сдвиг пальца, после которого свайп листает (px). */
export const SWIPE_MIN = 48;

interface Props {
  items: Media[];
  index: number;
  /** Показать другой элемент (листание). */
  onSelect: (mediaId: string) => void;
  onClose: () => void;
}

function canFullscreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

/**
 * Галерея S4 (SPEC §5.6, A6): затемнение, медиа слева, счётчик и описание справа.
 * Листание — стрелки на экране, ← / →, свайп; закрытие — ×, Esc, клик по затемнению.
 * Ролик живёт в iframe только пока показан: закрытие или листание его останавливает.
 */
export function Gallery({ items, index, onSelect, onClose }: Props) {
  const { l, lang, t } = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const item = items[index] ?? items[0]!;
  const many = items.length > 1;
  const step = (delta: number) => {
    if (!many) return;
    const next = items[(index + delta + items.length) % items.length]!;
    onSelect(next.id);
  };
  const stepRef = useRef(step);
  const closeRef = useRef(onClose);
  useEffect(() => {
    stepRef.current = step;
    closeRef.current = onClose;
  });

  // Фокус в окно при открытии и обратно на карточку при закрытии (как у «О проекте»).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
      opener?.focus();
    };
  }, []);

  // Клавиши слушаем на window: фокус может быть и вне окна (после клика по картинке — на body).
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') closeRef.current();
      else if (e.key === 'ArrowLeft') stepRef.current(-1);
      else if (e.key === 'ArrowRight') stepRef.current(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onDialogKeyDown = (e: KeyboardEvent) => trapTab(e, dialogRef.current);

  const onTouchStart = (e: TouchEvent) => {
    const p = e.touches[0];
    touch.current = p ? { x: p.clientX, y: p.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const p = e.changedTouches[0];
    touch.current = null;
    if (!start || !p) return;
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frameRef.current?.requestFullscreen().catch(() => undefined);
  };

  const src = item.type === 'image' ? mediaSrc(item, lang) : undefined;
  const source = mediaSourceUrl(item, lang);
  const subtitle = item.excerpt ? `${l(item.subtitle)} · ${t('gallery.excerpt')}` : l(item.subtitle);

  return createPortal(
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()} data-testid="gallery-backdrop">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
      >
        <DiamondButton icon="close" label={t('gallery.close')} className={styles.close} onClick={onClose} />

        <div
          ref={frameRef}
          className={styles.frame}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          data-testid="gallery-frame"
        >
          <div key={`${item.id}/${lang}`} className={styles.media}>
            {item.type === 'youtube' && item.youtubeId ? (
              <iframe
                className={styles.video}
                src={youtubeEmbed(item.youtubeId, lang)}
                title={l(item.title)}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : src && failed !== src ? (
              <img
                className={styles.image}
                src={src}
                alt={l(item.title)}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(src)}
              />
            ) : (
              <p className={styles.fallback}>
                {t('gallery.loadError')}{' '}
                <a href={source} target="_blank" rel="noopener noreferrer">
                  {t('gallery.source')}
                </a>
              </p>
            )}
          </div>
          {many && (
            <>
              <DiamondButton icon="prev" label={t('gallery.prev')} className={styles.prev} onClick={() => step(-1)} />
              <DiamondButton icon="next" label={t('gallery.next')} className={styles.next} onClick={() => step(1)} />
            </>
          )}
          {canFullscreen() && (
            <button type="button" className={styles.fullscreen} onClick={toggleFullscreen}>
              {t('gallery.fullscreen')}
            </button>
          )}
        </div>

        <aside className={styles.info}>
          <p className={styles.counter} aria-label={t('gallery.position', { n: String(index + 1), total: String(items.length) })}>
            {counter(index, items.length)}
          </p>
          <h2 id={titleId} className={styles.title}>
            {l(item.title)}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
          {item.description && <p className={styles.description}>{l(item.description)}</p>}
          {item.excerpt ? (
            <>
              <p className={styles.note}>{t('gallery.excerptNote')}</p>
              <a
                className={[buttonStyles.button, buttonStyles.primary, styles.read].join(' ')}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('gallery.readFull')}
              </a>
            </>
          ) : (
            <a className={styles.source} href={source} target="_blank" rel="noopener noreferrer">
              {t('gallery.source')}
            </a>
          )}
          <p className={styles.credit}>© {item.credit}</p>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
