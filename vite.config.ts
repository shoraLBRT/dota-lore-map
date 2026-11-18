import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Версия сборки для обратной связи (ARCHITECTURE A16): версия из package.json (её ведёт release-please)
// и короткий хеш коммита — в CI из GITHUB_SHA, локально из git; без git — только версия.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const sha = commit();

export default defineConfig({
  base: '/dota-lore-map/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(sha ? `${pkg.version}+${sha}` : pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'map/**/*.test.mjs'],
  },
});
