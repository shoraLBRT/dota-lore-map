import { dictionaries } from '../i18n';

/** Дисклеймер SPEC §15: всегда на обоих языках, независимо от выбранного. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <p lang="ru">{dictionaries.ru.disclaimer}</p>
      <p lang="en">{dictionaries.en.disclaimer}</p>
    </footer>
  );
}
