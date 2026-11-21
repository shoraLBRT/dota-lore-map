import { defineConfig, devices } from '@playwright/test';

// e2e (ARCHITECTURE A7, A14): дымовые сценарии и axe в трёх движках и на «телефоне».
// Сервер — `vite preview` по собранному dist; сборку делает сам webServer.
const PORT = 4183;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/results',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // Больше двух потоков WebKit под Windows падает (Target crashed) — держим два везде.
  workers: 2,
  reporter: CI ? [['github'], ['list']] : [['line']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}/dota-lore-map/`,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, browserName: 'webkit' },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    // Адрес функции отзыва (#75) — подменный: e2e/feedback.spec.ts отвечает за неё и за Turnstile.
    env: { VITE_FEEDBACK_URL: 'https://feedback.e2e.test/' },
    url: `http://localhost:${PORT}/dota-lore-map/`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'ignore',
  },
});
