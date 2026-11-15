// Значки событий героя (модель связей A3, нити A11, #67) — inline SVG 24×24, цвет через currentColor (A8).

import type { HeroEvent } from '../data/types';

/** У `link` (тип не уточнён) значка нет. */
export type BadgeEvent = Exclude<HeroEvent, 'link'>;

export const EVENT_PATHS: Record<BadgeEvent, string> = {
  // Родина — звезда.
  origin: 'M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2Z',
  // Дом — домик.
  home: 'M4 11.5 12 4.5l8 7 M6.5 9.5V19.5h11V9.5 M10.5 19.5v-5h3v5',
  // Путь — флажок цели.
  journey: 'M6.5 20.5v-16 M6.5 4.5h11l-2.5 4 2.5 4h-11',
  // Сражение — скрещённые клинки.
  battle: 'M4.5 4.5l11 11 M13.5 17.5l4-4 M16.5 16.5l3 3 M19.5 4.5l-11 11 M6.5 13.5l4 4 M7.5 16.5l-3 3',
  // Служба — щит.
  service: 'M12 3.5l7 2.8v5c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2v-5Z',
  // Изгнание, заточение — замок.
  exile: 'M8 11V8.5a4 4 0 0 1 8 0V11 M5.5 11h13v9.5h-13Z M12 14.5v2.5',
  // Гибель, перерождение — череп.
  death: 'M12 3.5a7 7 0 0 0-7 7c0 2.4 1.1 4 3 5v3.5h8v-3.5c1.9-1 3-2.6 3-5a7 7 0 0 0-7-7Z M9.3 11h.01 M14.7 11h.01 M12 19v-2',
  // Бывал — метка на карте.
  visit: 'M12 20.5s-6-6-6-10.5a6 6 0 0 1 12 0c0 4.5-6 10.5-6 10.5Z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  // Упомянуто — реплика.
  mention: 'M4.5 5.5h15v10h-8l-4 4v-4h-3Z',
};

export const hasBadge = (e: HeroEvent): e is BadgeEvent => e !== 'link';

/** Значок события для HTML (плашка героя, легенда). Для SVG карты — EVENT_PATHS напрямую. */
export function EventIcon({ event, className }: { event: BadgeEvent; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-event={event}
    >
      <path d={EVENT_PATHS[event]} />
    </svg>
  );
}
