// Иконки интерфейса — inline SVG, цвет через currentColor (ARCHITECTURE A8).

export type IconName = 'logo' | 'globe' | 'search' | 'sound' | 'soundOff' | 'info';

const PATHS: Record<IconName, string> = {
  // Ромб-эмблема с вписанной «D» из двух дуг: узнаваемо, но не копирует логотип Valve.
  logo: 'M12 2 22 12 12 22 2 12Z M9 7.5v9 M9 7.5h2.5a4.5 4.5 0 0 1 0 9H9',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3c-2.6 2.6-3.8 5.6-3.8 9s1.2 6.4 3.8 9 M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z M15.3 15.3 20 20',
  sound: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4Z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
  soundOff: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4Z M16 9.5l5 5 M21 9.5l-5 5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 11v5.5 M12 7.5v.5',
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
