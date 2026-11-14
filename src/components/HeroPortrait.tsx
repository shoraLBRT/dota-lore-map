import { useState } from 'react';
import type { Hero } from '../data/types';
import { heroPortrait, heroUrl } from '../data/world';
import { useT } from '../i18n';
import styles from './HeroPortrait.module.css';
import { Tooltip } from './Tooltip';

interface Props {
  hero: Hero;
  /** false — только картинка, без ссылки и подсказки (подсказка места, SPEC §5.4). */
  link?: boolean;
  /** Кнопка вместо ссылки: выбрать героя на карте (подсказка региона, SPEC §5.3, #65). Имя — из alt картинки. */
  onPick?: () => void;
  className?: string;
}

/** Портрет героя с CDN Valve (ARCHITECTURE A6): ссылка на официальную страницу в новой вкладке, заглушка при ошибке. */
export function HeroPortrait({ hero, link: linkProp = true, onPick, className }: Props) {
  const { lang, t } = useT();
  const [failed, setFailed] = useState(false);
  const cls = [styles.portrait, className].filter(Boolean).join(' ');
  // Ссылка — только когда нет кнопки: у кнопки и картинки без ссылки имя героя в alt.
  const link = linkProp && !onPick;
  const picture = failed ? (
    <span
      className={styles.fallback}
      data-testid="hero-fallback"
      role={link ? undefined : 'img'}
      aria-label={link ? undefined : hero.name}
      aria-hidden={link ? 'true' : undefined}
    >
      {hero.name.charAt(0)}
    </span>
  ) : (
    <img
      className={styles.image}
      src={heroPortrait(hero)}
      alt={link ? '' : hero.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );

  if (onPick) {
    return (
      <button type="button" className={`${cls} ${styles.button}`} onClick={onPick}>
        {picture}
      </button>
    );
  }

  if (!link) return <span className={`${cls} ${styles.still}`}>{picture}</span>;

  return (
    <Tooltip content={hero.name}>
      <a
        className={cls}
        href={heroUrl(hero, lang)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('hero.newTab', { name: hero.name })}
      >
        {picture}
      </a>
    </Tooltip>
  );
}
