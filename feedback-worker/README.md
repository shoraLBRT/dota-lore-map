# Функция обратной связи

Маленькая функция на Cloudflare Workers (#75, по образцу `Transliterator/feedback-worker`).
Окно «Обратная связь» на карте присылает ей отзыв, она проверяет «не робот» (Cloudflare
Turnstile) и заводит issue в этом репозитории от имени GitHub App. Аккаунт GitHub человеку
не нужен, а ключ GitHub живёт только в секретах функции — на страницу он не попадает.

Пока функция не развёрнута и её адрес не прописан в `.env` (`VITE_FEEDBACK_URL`), окно
работает по-старому: «Отправить» открывает заполненную форму issue на GitHub (#73). Тот же
путь остаётся запасным, если функция или Turnstile недоступны.

```
карта ──POST {title, body, labels, token}──▶ функция ──siteverify──▶ Turnstile
                                                └──JWT → токен установки → POST /issues──▶ GitHub
```

Что функция проверяет, прежде чем завести issue:

- **Origin** — запрос пришёл с выложенной карты или с локального запуска (`ALLOWED_ORIGINS`
  в `wrangler.toml`: `https://shoralbrt.github.io`, `http://localhost:5183` — `npm run dev`,
  `http://localhost:4173` — `vite preview`). Чужому сайту она не отвечает;
- **лимит** — не больше пяти сообщений в минуту с одного адреса;
- **длину** — заголовок до 200 знаков, текст до 12 000 (`src/contract.js`; что самый длинный
  отзыв карты в них укладывается, сверяет тест страницы `src/features/feedback/direct.test.ts`);
- **Turnstile** — токен проверки подтверждён Cloudflare;
- **упоминания** `@кто-то` обезврежены: issue не рассылает уведомлений;
- **метки** — `feedback` всегда, `content-fix` — если её попросила страница (отзыв о блоке);
  других меток функция не ставит.

Зависимостей нет: обычный JavaScript и Web Crypto. Тесты — встроенный в Node раннер, они
входят в `npm run check` в корне репозитория и идут в CI:

```bash
node --test
```

## Общее с Transliterator

Transliterator живёт на том же `shoralbrt.github.io`, и решение владельца (2026-11-21) —
переиспользовать его **GitHub App** и **виджет Turnstile**, а функцию держать **отдельную**:
`dota-lore-map-feedback`, репозиторий `shoraLBRT/dota-lore-map` вписан в её `wrangler.toml`.
Функция каждого проекта заводит issue только в свой репозиторий.

- App ID в `wrangler.toml` — тот же, что у Transliterator (`5514770`, не секрет).
- Ключ сайта Turnstile — тот же, что у Transliterator (публичный, вписан в
  `.env` как `VITE_TURNSTILE_SITE_KEY`). Hostname `shoralbrt.github.io` у виджета уже есть.
  Поэтому и `TURNSTILE_SECRET` этой функции — секрет **того же** виджета.

## Развёртывание

Всё бесплатно: Workers и Turnstile на бесплатном тарифе Cloudflare с запасом покрывают такой
сайт. Понадобятся аккаунт Cloudflare (тот же, что для Transliterator), аккаунт GitHub и Node.js.
Команды запускаются из папки `feedback-worker`.

В Windows PowerShell по умолчанию запрещены сценарии, и `npx` там падает с «выполнение
сценариев отключено в этой системе». Пишите `npx.cmd` вместо `npx` — это та же команда,
запрет её не касается.

### 1. Turnstile — ничего нового

Виджет Transliterator уже пускает `shoralbrt.github.io`. Нужен только его **Secret Key**
(панель Cloudflare → **Turnstile** → виджет → **Settings**) — он пойдёт в секрет на шаге 3.
Если для `npm run dev` нужна настоящая проверка, добавьте в Hostnames виджета `localhost`
(у Transliterator он уже там).

Отдельный виджет тоже можно: тогда новый Site Key — в `VITE_TURNSTILE_SITE_KEY`
в `.env` (шаг 4), а его Secret Key — в секрет.

### 2. GitHub App — поставить на этот репозиторий

Приложение уже есть (у Transliterator), и право **Issues: Read and write** у него есть.
Его нужно только установить на `dota-lore-map`:

1. GitHub: **Settings → Applications → Installed GitHub Apps** → приложение Transliterator
   → **Configure**.
2. **Repository access → Only select repositories → Select repositories** → добавить
   `dota-lore-map` → **Save**.

Без этого шага функция ответит «сервер ответил ошибкой»: GitHub не найдёт установку
приложения на репозиторий (`/repos/shoraLBRT/dota-lore-map/installation` — 404).

Закрытый ключ приложения (`.pem`) — тот же, что положен в секрет функции Transliterator.
Если файла под рукой нет: страница приложения (**Settings → Developer settings → GitHub
Apps** → приложение) → **Generate a private key**. Новый ключ не отменяет старый, функция
Transliterator продолжит работать. Файл никуда не коммитить (`*.pem` в `.gitignore`).

### 3. Функция

1. Войти в Cloudflare и развернуть:

   ```bash
   npx wrangler@4 login
   npx wrangler@4 deploy
   ```

   В конце wrangler напечатает адрес функции, вида
   `https://dota-lore-map-feedback.<ваш-поддомен>.workers.dev`.
2. Положить секреты. Ключ GitHub App — содержимым файла:

   ```bash
   npx wrangler@4 secret put GITHUB_APP_PRIVATE_KEY < путь/к/ключу.pem
   ```

   В PowerShell перенаправления `<` нет, там так:

   ```powershell
   Get-Content путь\к\ключу.pem -Raw | npx.cmd wrangler@4 secret put GITHUB_APP_PRIVATE_KEY
   ```

   Только целиком, одной строкой: `Get-Content` без `| npx.cmd …` напечатает ключ
   в терминал. Ключ, который попал на экран, в чат или в журнал, считайте раскрытым —
   сгенерируйте новый, старый удалите и положите новый в секреты **обеих** функций.

   Секрет Turnstile — вставить, когда команда спросит:

   ```bash
   npx wrangler@4 secret put TURNSTILE_SECRET
   ```

### 4. Страница

Адрес функции — `VITE_FEEDBACK_URL` в файле `.env` в корне репозитория (одно место на всё
приложение; читает его `src/features/feedback/direct.ts`). Он публичный, его видно в коде
страницы. Вписать адрес из шага 3 и влить PR в `main` — карта выложится сама. Там же
`VITE_TURNSTILE_SITE_KEY`, если виджет Turnstile свой.

Проверка: открыть карту, отправить пробный отзыв — в репозитории появится issue от бота
с меткой `feedback` и блоком «Контекст». Пробное issue потом закрыть.

## Если что-то не так

- `npx wrangler@4 tail` показывает запросы к функции и ошибки в реальном времени.
- Окно пишет «не отправилось» и предлагает форму GitHub — функция не смогла завести issue.
  Чаще всего: приложение не установлено на `dota-lore-map` (шаг 2), не тот ключ.
- Проверка «не робот» не проходит — не тот `TURNSTILE_SECRET` (не от того виджета, чей
  Site Key на странице) или в виджете нет домена страницы.
- Отправка падает сразу — неверный `VITE_FEEDBACK_URL` или страница открыта не с адреса из
  `ALLOWED_ORIGINS`.

## Локальный запуск

`npx wrangler@4 dev` поднимает функцию на `http://localhost:8787`. Секреты для неё берутся из
файла `.dev.vars` (он в `.gitignore`). У Turnstile есть тестовые ключи, которые всегда проходят:
Site Key `1x00000000000000000000AA`, Secret Key `1x0000000000000000000000000000000AA`. Чтобы
карта слала в локальную функцию, положите в корень репозитория `.env.local` (он в `.gitignore` и перекрывает `.env`):

```
VITE_FEEDBACK_URL=http://localhost:8787/
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```
