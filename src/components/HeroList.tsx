import type { Hero } from '../data/types';
import { heroUrl } from '../data/world';
import { useT } from '../i18n';

/** Список героев со ссылками на официальные страницы (ARCHITECTURE A6). Пустой список не рисуется. */
export function HeroList({ heroes }: { heroes: Hero[] }) {
  const { lang, t } = useT();
  if (heroes.length === 0) return null;
  return (
    <section>
      <h3>{t('panel.heroes')}</h3>
      <ul>
        {heroes.map((h) => (
          <li key={h.key}>
            <a
              href={heroUrl(h, lang)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('hero.newTab', { name: h.name })}
            >
              {h.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
