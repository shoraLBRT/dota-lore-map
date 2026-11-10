# dota-lore-map

Интерактивная карта лора Dota 2 — некоммерческий фанатский проект.

## Читать перед работой
1. [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) — что уже есть, что дальше, открытые вопросы.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — обязательные технические решения (стек, структура, форматы данных).
3. [docs/SPEC.md](docs/SPEC.md) — функциональные требования (разделы по номерам, например §5.4).
4. Бэклог — GitHub Issues, эпики E1–E12 в майлстоуне MVP. Порядок работ — в PROJECT_STATE.

## Правила
- Одна задача — одна ветка (`feat/`, `fix/`, `docs/`, `chore/`, `content/` + номер issue) — один PR. В `main` не коммитим.
- PR пишется по-русски: что вошло, что сознательно не вошло. `Closes #N` — только если эпик или задача закончены полностью, иначе `Refs #N`.
- Перед PR: `npm run check` зелёный (до появления `package.json` — только `python research/e1/build.py --check`).
- Тексты интерфейса и контент — всегда на двух языках (`ru`, `en`).
- Тексты лора пишем своими словами. Не копируем тексты Liquipedia, Fandom и официальные биографии.
- Liquipedia: автоматические запросы только через API `https://liquipedia.net/dota2/api.php` с User-Agent `DotaLoreMapResearch/0.1 (non-commercial fan project)` и паузой ≥ 2 с между запросами. Обходить защиту сайтов (подмена User-Agent браузера и т. п.) нельзя.
- Решение, которое переживёт задачу, записывается в ARCHITECTURE.md или SPEC.md, а не только в коммит.
- В конце задачи обновить docs/PROJECT_STATE.md в том же PR.

## Команды
- `python research/e1/build.py` — проверить данные исследования и перегенерировать docs/research/E1-places.md.
- После E3: `npm run dev`, `npm run data`, `npm run check`.
