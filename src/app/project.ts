// Сведения о проекте, нужные интерфейсу: репозиторий и версия сборки (ARCHITECTURE A16).

declare const __APP_VERSION__: string;

export const REPO_URL = 'https://github.com/shoraLBRT/dota-lore-map';

/** Версия сборки: `<version из package.json>+<короткий хеш коммита>` (`vite.config.ts`). */
export const BUILD_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
