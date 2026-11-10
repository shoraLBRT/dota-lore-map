import type { Hero } from '../data/types';
import { useT } from '../i18n';
import styles from './HeroList.module.css';
import { HeroPortrait } from './HeroPortrait';

/** Портреты героев в ряд со ссылками на официальные страницы (ARCHITECTURE A6). Пустой список не рисуется. */
export function HeroList({ heroes }: { heroes: Hero[] }) {
  const { t } = useT();
  if (heroes.length === 0) return null;
  return (
    <section>
      <h3>{t('panel.heroes')}</h3>
      <ul className={styles.row}>
        {heroes.map((h) => (
          <li key={h.key}>
            <HeroPortrait hero={h} />
          </li>
        ))}
      </ul>
    </section>
  );
}
