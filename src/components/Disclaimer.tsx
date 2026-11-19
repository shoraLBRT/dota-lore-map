import { dictionaries, useT } from '../i18n';

/**
 * Дисклеймер SPEC §15. В окне «О проекте» — на обоих языках; на интро (`single`) — одна строка
 * на языке интерфейса (#187).
 */
export function Disclaimer({ className, single = false }: { className?: string; single?: boolean }) {
  const { lang } = useT();
  const langs = single ? [lang] : (['ru', 'en'] as const);
  return (
    <footer className={className}>
      {langs.map((l) => (
        <p key={l} lang={l}>
          {dictionaries[l].disclaimer}
        </p>
      ))}
    </footer>
  );
}
