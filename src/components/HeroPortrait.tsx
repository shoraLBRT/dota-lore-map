import { useState } from 'react';
import type { Hero } from '../data/types';
import { heroPortrait, heroUrl } from '../data/world';
import { useT } from '../i18n';
import styles from './HeroPortrait.module.css';
import { Tooltip } from './Tooltip';

/** Портрет героя с CDN Valve (ARCHITECTURE A6): ссылка на официальную страницу в новой вкладке, заглушка при ошибке. */
export function HeroPortrait({ hero }: { hero: Hero }) {
  const { lang, t } = useT();
  const [failed, setFailed] = useState(false);
  return (
    <Tooltip content={hero.name}>
      <a
        className={styles.portrait}
        href={heroUrl(hero, lang)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('hero.newTab', { name: hero.name })}
      >
        {failed ? (
          <span className={styles.fallback} data-testid="hero-fallback" aria-hidden="true">
            {hero.name.charAt(0)}
          </span>
        ) : (
          <img
            className={styles.image}
            src={heroPortrait(hero)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </a>
    </Tooltip>
  );
}
