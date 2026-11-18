Скрипты построения основ для генерации арта (сессия 2026-11-18).
- base5.cjs — основа 1:1 (schema-base-v5.svg): два материка, ярусы в углах, номера регионов.
  Запуск: node base5.cjs map/layout.json docs/map/schema-base.svg out.svg out-numbers.svg
  Перевод координат материка: x' = x, y' = (y*1000 + 290) / 1600 (кадр 1600x1600).
- base4.cjs (5:4) и base2.cjs (16:10 с проливом) — промежуточные варианты.
Готовый арт мира: ../world.jpg (5016x5016, JPEG; до #163 лежал как world.png). Вариант до апскейла: ../variants/world-v5-nomoon.png.
