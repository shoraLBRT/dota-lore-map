# E1 · Места мира и герои — исследование (часть 1)

| | |
|---|---|
| Эпик | #1 E1 · Исследование контента |
| Статус | Согласовано (решения — раздел 4) |
| Дата | 2026-11-11 |
| Данные | [`research/e1/`](../../research/e1/) — `regions.json`, `hero-places.json`, `heroes.json` |

Документ отвечает на два вопроса: **какие регионы и места будут на карте** и **где живёт каждый герой**. Описания на RU/EN, характеристики регионов, медиа и алиасы для поиска — следующие части E1 (см. в конце).

Таблицы ниже генерируются из JSON: правки вносятся в JSON, после чего запускается `python research/e1/build.py`. Скрипт заодно проверяет, что ни один из 127 героев не потерян.

## 1. Источники и метод

| Источник | Что взяли |
|---|---|
| [dota2.com — официальный список героев](https://www.dota2.com/datafeed/herolist?language=english) | Список 127 героев (`heroes.json`) |
| Liquipedia: все 217 страниц категории [World](https://liquipedia.net/dota2/Category:World) | Места, связи «место ↔ место», упомянутые герои, подсказки о географии |
| Liquipedia: лор-страницы всех героев (`<Герой>/Lore`) | Поле `origins` в инфобоксе |
| Liquipedia: главные страницы героев | Официальная биография (поле `lore`) — поиск упомянутых мест |
| Liquipedia: [The Earth](https://liquipedia.net/dota2/The_Earth) | Общая география: холодный север, леса на западе, жаркий юг, подземелья, герои-пришельцы |
| Официальная пергаментная карта из Dota 2 на Source 1 (по скриншотам «The Map of the Ancient» из Steam Workshop) | Деление мира на **Land of the Radiant** (север) и **Scorch of the Dire** (юг), подписанные места |

Данные Liquipedia получены через её открытый API. Фанатские карты из [поста ВКонтакте](https://vk.ru/wall-115027503_243167) автоматически прочитать не удалось — их стоит разобрать вручную на этапе схемы карты (E2).

Тексты Liquipedia (лицензия CC BY-SA) и официальные биографии **не копируем** в проект: берём только факты, описания пишем сами.

## 2. Главные выводы

1. **Координат в лоре нет, но есть относительные привязки.** Их достаточно, чтобы собрать правдоподобную карту:
   - север: Icewrack южнее хребта The Barrier, у Северного моря;
   - цепочка с севера на юг: Skywrath (в небе) → Quoidge → Hazhadal Barrens → Fields of Endless Carnage → Druud;
   - кластер Стоунхолла: два десятка городов и озёр с указанием сторон света относительно столицы; рядом — White Spire, Revtel, Weeping Rose;
   - экватор: Desert of Misrule и Scintillant Waste;
   - запад: леса (Western Forests, Vale of Augury), рядом королевство Слом;
   - тропики: Isle of Masks, Jidi Isle, Ash Archipelago, джунгли Феллстрата;
   - под землёй: Aziyog, Nether Reaches; на дне океана — затонувшие города слизеринов.
2. **Официальная карта Source 1 даёт сторону Radiant/Dire.** На ней «Land of the Radiant» — север (Pole, Violet Archives, Castle of the Fold, Home of the Keen Folk, Temple of Mene, Thousand Tarns, «холодное северное царство льда»), «Scorch of the Dire» — юг (Desert of Misrule, Riftshadow Ruins, Ruined City, Wailing Mountains, монастыри Turstarkuri, Mount Joerlak, Feral Road, The Slithereen). По ней размечены 6 регионов; стороны остальных присвоены по положению на схеме E2 (решение В10).
3. **Valve сама не довела карту мира до конца.** По словам бывшего сценариста Марка Лэйдло (страница The Earth), рассматривалась карта-свиток и карта-лента Мёбиуса, которую можно вращать и приближать, но на это не хватило людей и времени. Хорошая история для окна «О проекте».
4. **Связи «герой ↔ место» разной силы.** Самые надёжные — `origins` в инфобоксе и официальная биография. Упоминание героя на странице места часто объясняется предметом или репликой — такие связи помечены `†`.
5. **Много героев не из этого мира** — для них Верхний ярус (Небеса; Семь планов и Пустота) и Бездна (Подземье; Семь Преисподних и загробье), как договорились в ТЗ.

## 3. Как читать таблицы

| Обозначение | Значение |
|---|---|
| ★ | Столица или главное место региона |
| Расположение: **лор** | Где находится место, следует из лора |
| Расположение: **карта S1** | Место подписано на официальной карте Source 1 |
| Расположение: **наше** | В лоре расположение не указано — к региону отнесли мы |
| (живёт) | Герой живёт там сейчас |
| (связь) | Другая связь: служба, изгнание, основал, бывал. На карте — нить к основному месту |
| (путь), (сражение), (служба), (изгнание), (гибель), (бывал), (упоминание) | Тип события по модели связей E14 (ARCHITECTURE A3); появляется после сверки героя в партии E14 |
| без пометки | Родина героя |
| † | Связь только по упоминанию на странице места Liquipedia (слабая) |
| \* | Наше решение, в лоре прямо не сказано |

## 4. Принятые решения

Согласованы владельцем продукта 2026-11-11.

| # | Вопрос | Решение |
|---|---|---|
| В1 | 12 героев, у которых в лоре нет места | Отдельный регион **«Неизведанные земли»** — остров в тумане у края карты. Герои привязаны к нему целиком, у каждого записано, почему он здесь |
| В5 | Канон ли «DOTA: Dragon's Blood» | Кадры сериала — **только как медиа**; места из сериала на карту не добавляем. Marci — в «Неизведанных землях» |
| В8 | 26 регионов (у LoL — 13) — не много ли | Решаем на схеме карты (E2), когда станет видно, как регионы ложатся; мелкие можно объединить |
| В9 | «Срединные королевства» — сборный регион из мест без географии | На схеме E2 раскидать эти места по соседним регионам; до тех пор — как есть |
| В10 | Сторона у 20 регионов не определена картой S1 | **Решено в E2** ([схема](../map/README.md)): сторона по положению центроида региона на схеме — севернее y = 0.47 → Radiant (Стоунхолл, Вольные города, Слом и Эльзе, Западные леса, Кладд), южнее y = 0.53 → Dire (Друуд, Ховен и Нишай, Феллстрат, Тропические острова, Империя Костей, Томо'кан, Тенистый берег); экваториальный пояс (Квойдж и Поля Бойни, Хазадальские пустоши, Срединные королевства) — нейтральный, как и ярусы и «Неизведанные земли». Откуда взята сторона — поле `sideBasis` в `regions.json` |

## 5. Регионы, места и герои

<!-- GENERATED:BEGIN -->
Регионов: **26**, мест: **172**, героев привязано: **127** из 127, из них в «Неизведанных землях»: **12**.

### Сводка по регионам

| Ярус | Регион | Сторона | Мест | Героев |
|---|---|---|---|---|
| Верхний ярус | Небеса (The Heavens) | нейтрально (ярус) | 6 | 9 |
| Верхний ярус | Семь планов и Пустота (The Seven Planes and the Void) | нейтрально (ярус) | 13 | 18 |
| Материк и острова | Айсрак (Icewrack) | Radiant (карта S1) | 12 | 7 |
| Материк и острова | Земля Сияющих (Land of the Radiant) | Radiant (карта S1) | 8 | 7 |
| Материк и острова | Лес Найтсильвер (Nightsilver Woods) | Radiant (карта S1) | 3 | 2 |
| Материк и острова | Стоунхолл (Stonehall) | Radiant (по схеме E2) | 24 | 3 |
| Материк и острова | Вольные города (The Free Cities) | Radiant (по схеме E2) | 7 | 8 |
| Материк и острова | Квойдж и Поля Бойни (Quoidge and the Fields of Carnage) | нейтрально (по схеме E2) | 4 | 3 |
| Материк и острова | Хазадальские пустоши (Hazhadal Barrens) | нейтрально (по схеме E2) | 2 | 2 |
| Материк и острова | Друуд (Druud) | Dire (по схеме E2) | 2 | 2 |
| Материк и острова | Сверкающая пустошь (Scintillant Waste) | Dire (карта S1) | 9 | 5 |
| Материк и острова | Стонущие горы (Wailing Mountains) | Dire (карта S1) | 6 | 7 |
| Материк и острова | Тенистый берег (Shadeshore) | Dire (по схеме E2) | 5 | 4 |
| Материк и острова | Глубины (The Deep) | Dire (карта S1) | 7 | 4 |
| Материк и острова | Кладд и острова (Cladd and the Isles) | Radiant (по схеме E2) | 6 | 2 |
| Материк и острова | Тропические острова (Tropic Isles) | Dire (по схеме E2) | 7 | 3 |
| Материк и острова | Западные леса (Western Forests) | Radiant (по схеме E2) | 6 | 4 |
| Материк и острова | Слом и Эльзе (Slom and Elze) | Radiant (по схеме E2) | 3 | 4 |
| Материк и острова | Ховен и Нишай (The Hoven and Nishai) | Dire (по схеме E2) | 4 | 4 |
| Материк и острова | Феллстрат (Fellstrath) | Dire (по схеме E2) | 6 | 6 |
| Материк и острова | Томо'кан и Окраины (Tomo'kan and the Outlands) | Dire (по схеме E2) | 6 | 6 |
| Материк и острова | Империя Костей (Empire of Bone) | Dire (по схеме E2) | 3 | 1 |
| Материк и острова | Срединные королевства (The Middle Kingdoms) | нейтрально (по схеме E2) | 11 | 13 |
| Материк и острова | Неизведанные земли (The Uncharted Lands) | нейтрально (по схеме E2) | 0 | 12 |
| Бездна | Подземье (The Underdark) | нейтрально (ярус) | 4 | 4 |
| Бездна | Семь Преисподних и загробье (The Seven Hells and the Afterlife) | нейтрально (ярус) | 8 | 9 |

### Верхний ярус

#### Небеса · The Heavens

Сторона: **нейтрально** (ярус). Небо над миром и небесные тела: столица скайрасов высоко над землёй, Безумная Луна (разрушена, её осколки — Radiant Ore и Direstone), Луна Селемены, Солнце.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Ghastly Eyrie | лор | Kez, Skywrath Mage, Vengeful Spirit | столица расы скайрасов, «среди облаков и звёзд» |
| Mad Moon | лор | Arc Warden† |  |
| Selemene's Moon | лор | — | вместе с Demon Star |
| The Sun | лор | Dawnbreaker*, Phoenix* | Children of Light и солнечная кузня (страницы на Liquipedia нет) |
| Olympus | наше | Mars*, Zeus | небесная обитель Зевса; страницы на Liquipedia нет |
| Ultoria | лор | Spirit Breaker (связь)† | небесное тело со своими лунами |

#### Семь планов и Пустота · The Seven Planes and the Void

Сторона: **нейтрально** (ярус). Иные планы бытия и измерения вне Terrene Plane (наш мир).

Герои всего региона: Spectre

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| Fundamental Plane | лор | Chaos Knight, Enigma, Io, Keeper of the Light |  |
| Primordial Plane | лор | Elder Titan† |  |
| Elemental Plane | лор | Spirit Breaker |  |
| Astral Plane | лор | — |  |
| Fabric of Creation | лор | Weaver |  |
| Claszureme | лор | Faceless Void, Puck† | мир вне времени |
| The Void | лор | Ancient Apparition, Night Stalker†, Void Spirit |  |
| The Outworld | лор | Outworld Destroyer | «мир на краю Бездны», у границы Пустоты |
| Land Behind the Wall | лор | Dark Seer | родная реальность Dark Seer; страницы на Liquipedia нет |
| Ivory Incubarium | лор | Oracle | в другой вселенной |
| Heart of Nature | наше | Leshrac |  |
| Light's Keep | наше | Keeper of the Light (связь) |  |
| The Dream | наше | Bane* |  |

### Материк и острова

#### Айсрак · Icewrack

Сторона: **Radiant** (карта S1). Крайний север. Южнее горного хребта The Barrier, у Северного (Кипящего) моря. Единственный морской путь — порт Frostreach. На карте Source 1: «The cold northern realm of Ice» в половине Radiant.

Герои всего региона: Drow Ranger*

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Icewrack | лор | Crystal Maiden (живёт), Kez (живёт), Winter Wyvern (живёт)† |  |
| The Barrier | лор | — |  |
| Blueheart Glacier | лор | — |  |
| Black Pool | лор | Lich (живёт) |  |
| Cobalt | лор | Tusk |  |
| Azura | лор | — |  |
| White Fields | лор | — |  |
| Wolfsden Tavern | лор | Tusk (связь) |  |
| Njord's Hearth | лор | — |  |
| Boiling Sea | лор | — |  |
| Frostreach | лор | — | самый северный порт мира; страницы на Liquipedia нет |
| Onyx Grove | лор | Lone Druid (живёт)† | в северных сосновых лесах |

#### Земля Сияющих · Land of the Radiant

Сторона: **Radiant** (карта S1). Название и состав — с карты Source 1: Peaceful Village of Pole, Violet Archives, Castle of the Fold, Home of the Keen Folk, Thousand Tarns.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| Pole | карта S1 | Phantom Lancer |  |
| Violet Archives | карта S1 | Templar Assassin (связь) |  |
| Violet Plateau | лор | Tinker (живёт) | архивы находятся в нём или рядом |
| Castle of the Fold | карта S1 | — |  |
| Home of the Keen Folk | карта S1 | Clockwerk |  |
| Knollen | наше | Sniper | горные долины кинов |
| Dredger's Bight | наше | Techies | родина Techies (кины); страницы на Liquipedia нет |
| Thousand Tarns | карта S1 | Axe |  |

#### Лес Найтсильвер · Nightsilver Woods

Сторона: **Radiant** (карта S1). Священный лес Селемены. Temple of Mene на карте Source 1 — в половине Radiant.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Nightsilver Woods | лор | Luna (живёт), Mirana (живёт) |  |
| Temple of Mene | карта S1 | — |  |
| Shrine of Selemene | лор | — |  |

#### Стоунхолл · Stonehall

Сторона: **Radiant** (по схеме E2). Империя вокруг города Стоунхолл. Расположение городов относительно столицы известно точно (запад, юг, северо-восток и т. д.).

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Stonehall | лор | Legion Commander (живёт), Underlord (связь)† |  |
| Qine | лор | Legion Commander |  |
| Quath | лор | — |  |
| Tares | лор | Phantom Assassin | к югу от Стоунхолла |
| Roseleaf | лор | — |  |
| Tarrin | лор | — | к юго-западу |
| Sashire | лор | — | к югу |
| Milltown | лор | — | к западу, на реке между Roseleaf и Tarrin |
| Ember (City) | лор | — | к западу |
| Redmaw | лор | — | к западу от Roseleaf |
| Lormount | лор | — |  |
| Goldlake | лор | — |  |
| Lightglass | лор | — | озеро к северу |
| Lincastle | лор | — | к востоку |
| Mistmill | лор | — | к востоку |
| Pinelyn | лор | — | к северо-востоку |
| Crester | лор | — | к югу от Tares |
| Filedo | лор | — |  |
| Clacline | лор | — |  |
| Kailens | лор | — |  |
| Sloquoit | лор | — |  |
| Coldbank Plains | лор | — | к западу |
| Janau | лор | — |  |
| Leadbelly's | лор | — | таверна в Стоунхолле |

#### Вольные города · The Free Cities

Сторона: **Radiant** (по схеме E2). Города рядом со Стоунхоллом, но вне его власти: White Spire «сразу за пределами» Стоунхолла и Ревтела, севернее Hazhadal Barrens; Weeping Rose — соседний с White Spire город. Название региона — наше.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ White Spire | лор | Bounty Hunter (живёт)†, Monkey King (живёт), Pangolier (живёт)† |  |
| Revtel | лор | Dark Willow |  |
| Weeping Rose | лор | Lion, Queen of Pain (связь)† |  |
| Tyler Estate | лор | Anti-Mage (связь), Silencer (связь)† | в Weeping Rose |
| Sundered Moon | лор | — | таверна в White Spire |
| Iron Fog | наше | — |  |
| Highseat | наше | Bounty Hunter (связь) |  |

#### Квойдж и Поля Бойни · Quoidge and the Fields of Carnage

Сторона: **нейтрально** (по схеме E2). Квойдж — к югу от Skywrath, в дне пути от Smoke Harbor, далеко к северу от Полей. Поля — к югу от Hazhadal Barrens и к северу от Друуда.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Quoidge | лор | Mars (связь)†, Pudge (связь) |  |
| Smoke Harbor | лор | — |  |
| Fields of Endless Carnage | лор | Pudge (живёт) |  |
| Cathedral of Rumusque | лор | Necrophos |  |

#### Хазадальские пустоши · Hazhadal Barrens

Сторона: **нейтрально** (по схеме E2). К северу от Fields of Endless Carnage и к югу от места битвы Древних. Земля безбожных племён-изгоев.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Hazhadal Barrens | лор | Chen, Silencer |  |
| Fortress of Valhessi | лор | — | страницы на Liquipedia нет |

#### Друуд · Druud

Сторона: **Dire** (по схеме E2). Плоскогорье (Red Deserts of Druud) к югу от Fields of Endless Carnage. Земля кланов кентавров.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Druud | лор | Centaur Warrunner, Disruptor |  |
| Omexe | лор | — |  |

#### Сверкающая пустошь · Scintillant Waste

Сторона: **Dire** (карта S1). Экваториальные пустыни. Desert of Misrule — внутри или к западу от Scintillant Waste. На карте Source 1 Blazing Desert of Misrule и Riftshadow Ruins — в половине Dire.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Scintillant Waste | лор | Sand King |  |
| Desert of Misrule | карта S1 | Lina |  |
| Riftshadow Ruins | карта S1 | Meepo |  |
| Qaldin | лор | Pangolier (связь)†, Sand King (связь) |  |
| El'Harath | лор | — |  |
| The Barrens | лор | — |  |
| Halgalreh | наше | Templar Assassin (связь)† | руины пустынной империи |
| Bone Ruins | наше | — |  |
| Singer's Gulch | наше | Meepo (связь)† |  |

#### Стонущие горы · Wailing Mountains

Сторона: **Dire** (карта S1). На карте Source 1 в половине Dire: The Wailing Mountains, The Ruined City, The monasteries of Turstarkuri, The Mountain Joerlak, The Feral Road.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Ruined City | карта S1 | Brewmaster, Storm Spirit (живёт) |  |
| Fortress of Flares | лор | Ember Spirit (живёт) |  |
| Turstarkuri | карта S1 | Anti-Mage |  |
| Mount Joerlak | карта S1 | Magnus† |  |
| Feral Road | карта S1 | Sven (связь)† |  |
| The Upland | наше | Earth Spirit | нагорье священного нефрита |

#### Тенистый берег · Shadeshore

Сторона: **Dire** (по схеме E2). Приморский край. Tidemarsh связывает Shadeshore, Wailing Mountains и Ruelands.

Герои всего региона: Slark (живёт)

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Shadeshore Ruins | лор | Sven |  |
| Tidemarsh | лор | — |  |
| Ruelands | лор | Spectre (связь)†, Techies (связь)† |  |
| Vigil Keep | наше | Sven (связь) |  |
| Inner Colonnade | наше | — | при Vigil Keep |

#### Глубины · The Deep

Сторона: **Dire** (карта S1). Затонувшие города на дне океана под охраной слизеринов; ещё глубже — Infernal Hollow. На карте Source 1 «The Slithereen» — в половине Dire.

Герои всего региона: Morphling (живёт)

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Dark Reef | лор | Slark |  |
| Crey | лор | Naga Siren (живёт) |  |
| Deep Vault | лор | Slardar (живёт) | оно же Sunken Treasury |
| Coral Breach | лор | — |  |
| Reef's Edge | лор | — |  |
| Recluse Reef | лор | — |  |
| Infernal Hollow | лор | — | страницы на Liquipedia нет |

#### Кладд и острова · Cladd and the Isles

Сторона: **Radiant** (по схеме E2). Островное государство Кладд и окрестные острова и проливы.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Cladd | лор | Kunkka |  |
| Trembling Isle | лор | — |  |
| Sunken Isles | наше | Tidehunter |  |
| Isle of Songs | наше | — |  |
| Port Mignin | наше | — |  |
| Narrow Channel | наше | — |  |

#### Тропические острова · Tropic Isles

Сторона: **Dire** (по схеме E2). Острова в тропиках. Ash Archipelago — место отдыха кинов. Название региона — наше.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Isle of Masks | лор | Juggernaut |  |
| Temple of Masks | лор | — |  |
| Ivory Isles | лор | — |  |
| Jidi Isle | лор | — |  |
| Acid Jungles | лор | Venomancer |  |
| Bay of Fradj | лор | — |  |
| Ash Archipelago | лор | Gyrocopter (живёт) |  |

#### Западные леса · Western Forests

Сторона: **Radiant** (по схеме E2). На западе мира много лесов: Western Forests с деревней Zaru'Kina и высокие леса за Vale of Augury. Western Forests граничат с павшим королевством Слом.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Western Forests | лор | — |  |
| Zaru'Kina | лор | Windranger |  |
| Vale of Augury | лор | Treant Protector (живёт) |  |
| Augury Bay | лор | Timbersaw |  |
| Endless Copse | наше | Nature's Prophet (живёт)† |  |
| Manglewood Forest | наше | — |  |

#### Слом и Эльзе · Slom and Elze

Сторона: **Radiant** (по схеме E2). Два враждующих королевства-соседа, связанных дорогой с тавернами. Слом граничит с Western Forests.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Slom | лор | Beastmaster, Lycan |  |
| Elze | лор | Bristleback (живёт), Queen of Pain (связь) |  |
| Stone Hills | наше | — |  |

#### Ховен и Нишай · The Hoven and Nishai

Сторона: **Dire** (по схеме E2). Огромный лес Ховен у подножия Bleeding Hills; с холмов стекает чёрная смола. Страница Bleeding Hills связывает их с Нишаем — краем землетрясений.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ The Hoven | лор | Clinkz, Troll Warlord (живёт) |  |
| Bleeding Hills | лор | Clinkz (связь), Shadow Shaman |  |
| Nishai | лор | Earthshaker |  |
| The Red Mountain | лор | — | предположительно в Нишае |

#### Феллстрат · Fellstrath

Сторона: **Dire** (по схеме E2). Тропические джунгли с муссонами и руинами Overgrown Empire, за горами у Ашкавора.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Fellstrath | лор | Dazzle (живёт)† |  |
| Overgrown Empire | лор | — |  |
| Ashkavor | лор | Grimstroke |  |
| Yama Raskav Jungle | наше | Batrider, Medusa (живёт)† |  |
| Xhacatocatl | наше | Bloodseeker | окутанные туманом горы |
| Velu'Mar | наше | Largo | Murkroots of Velu'Mar, родина Largo; страницы на Liquipedia нет |

#### Томо'кан и Окраины · Tomo'kan and the Outlands

Сторона: **Dire** (по схеме E2). Туманный лес Томо'кан (Mistwood, Darkwood). К югу — королевство Кримвол в Окраинах. Окраины — всё, что за Dread Marsh, рядом с пустыней Nanarak. Сюда упали камни Неместиса.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Tomo'kan | лор | Arc Warden (связь)†, Hoodwink (живёт), Primal Beast (живёт), Puck (связь)†, Ursa (живёт) |  |
| Krimwohl | лор | Hoodwink |  |
| Outlands | лор | — |  |
| Nanarak | лор | Snapfire (живёт) |  |
| Dread Marsh | лор | — |  |
| Praxa'cia | лор | — |  |

#### Империя Костей · Empire of Bone

Сторона: **Dire** (по схеме E2). Владения Остариона: дворец, башни, мостовые и даже лес — из кости. Его армии разрушили Levinthal (Gleaming City).

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Throne of Bone | лор | Wraith King (живёт) |  |
| Ivory Forest | лор | — |  |
| Levinthal | наше | — | возможно, то же, что Gleaming City |

#### Срединные королевства · The Middle Kingdoms

Сторона: **нейтрально** (по схеме E2). Название и состав — наши. Здесь собраны королевства и места, расположение которых в лоре не указано. Регион можно разделить, когда будет готова схема карты (E2).

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| Candoness | наше | Dragon Knight (живёт)† |  |
| Devarque | наше | Lifestealer (связь) |  |
| Yoskreth | наше | — |  |
| Ultimyr Academy | наше | Invoker (связь)†, Warlock (живёт) |  |
| Emauracus | наше | Omniknight (живёт) |  |
| Font of Avernus | наше | Abaddon |  |
| Hidden Temple | наше | Spectre (связь)†, Templar Assassin (живёт), Void Spirit (связь) |  |
| Hidden Hive | наше | Nyx Assassin (живёт) |  |
| Mount Pyrotheos | наше | Broodmother (живёт) |  |
| Skirm | наше | Muerta | страницы на Liquipedia нет |
| Solar Throne | наше | Mirana | трон империи Helio Imperium |

#### Неизведанные земли · The Uncharted Lands

Сторона: **нейтрально** (по схеме E2). Остров в тумане у края карты — для героев, чья родина в лоре не названа (решение В1). Мест внутри нет: герои привязаны к региону целиком. Название и регион — наши.

| Герой | Почему здесь |
|---|---|
| Alchemist | в биографии нет мест (семья Darkbrew) |
| Death Prophet | в биографии нет мест |
| Enchantress | в биографии нет мест; по образу — лесные земли |
| Jakiro | в биографии нет мест (раса Pyrexae) |
| Marci | места есть только в сериале «DOTA: Dragon's Blood» (Hauptstadt, Barrowhaven и др.) — по решению В5 места сериала на карту не добавляем |
| Ogre Magi | в биографии нет мест |
| Riki | в биографии нет мест (Tahlin не описан как место) |
| Ringmaster | в биографии нет мест; кандидат — руины цирка в Ozenja (догадка) |
| Rubick | в биографии нет мест; Liquipedia связывает с Ultimyr Archives (слабая связь) |
| Tiny | в биографии нет мест |
| Undying | служит Мёртвому богу, чей легион разорил Turstarkuri; Liquipedia связывает с Seven Hells |
| Witch Doctor | в биографии нет мест |

### Бездна

#### Подземье · The Underdark

Сторона: **нейтрально** (ярус). Физическое подземелье мира: город Азийог под магмой и корнями вулканов, Nether Reaches у тектонических плит, пещеры Emerald Abyss. Название региона — наше.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Aziyog | лор | Underlord (живёт) |  |
| Nether Reaches | лор | Pugna, Spirit Breaker (связь), Viper |  |
| The Emerald Abyss | лор | — |  |
| The Underhollow | лор | — |  |

#### Семь Преисподних и загробье · The Seven Hells and the Afterlife

Сторона: **нейтрально** (ярус). Семь слоёв ада, тюрьма Foulfell, путь мёртвых душ (Narrow Maze → Underscape) и загробный мир Nothl.

| Место | Расположение | Герои | Заметка |
|---|---|---|---|
| ★ Seven Hells | лор | Shadow Demon† |  |
| Vashundol | лор | Doom |  |
| Abysm | лор | Shadow Fiend |  |
| Foulfell | лор | Terrorblade |  |
| Outer Hells | лор | Warlock (связь) |  |
| Narrow Maze | лор | Razor (живёт), Visage (живёт) |  |
| Underscape | лор | Razor (связь) |  |
| Nothl Realm | лор | Dazzle (связь), Huskar (связь) |  |

### Указатель: герой → места

| Герой | Места |
|---|---|
| Abaddon | Font of Avernus (Срединные королевства) |
| Alchemist | весь регион «Неизведанные земли»* |
| Ancient Apparition | The Void (Семь планов и Пустота) |
| Anti-Mage | Turstarkuri (Стонущие горы); Tyler Estate (Вольные города) (связь) |
| Arc Warden | Mad Moon (Небеса)†; Tomo'kan (Томо'кан и Окраины) (связь)† |
| Axe | Thousand Tarns (Земля Сияющих) |
| Bane | The Dream (Семь планов и Пустота)* |
| Batrider | Yama Raskav Jungle (Феллстрат) |
| Beastmaster | Slom (Слом и Эльзе) |
| Bloodseeker | Xhacatocatl (Феллстрат) |
| Bounty Hunter | White Spire (Вольные города) (живёт)†; Highseat (Вольные города) (связь) |
| Brewmaster | Ruined City (Стонущие горы) |
| Bristleback | Elze (Слом и Эльзе) (живёт) |
| Broodmother | Mount Pyrotheos (Срединные королевства) (живёт) |
| Centaur Warrunner | Druud (Друуд) |
| Chaos Knight | Fundamental Plane (Семь планов и Пустота) |
| Chen | Hazhadal Barrens (Хазадальские пустоши) |
| Clinkz | The Hoven (Ховен и Нишай); Bleeding Hills (Ховен и Нишай) (связь) |
| Clockwerk | Home of the Keen Folk (Земля Сияющих) |
| Crystal Maiden | Icewrack (Айсрак) (живёт) |
| Dark Seer | Land Behind the Wall (Семь планов и Пустота) |
| Dark Willow | Revtel (Вольные города) |
| Dawnbreaker | The Sun (Небеса)* |
| Dazzle | Nothl Realm (Семь Преисподних и загробье) (связь); Fellstrath (Феллстрат) (живёт)† |
| Death Prophet | весь регион «Неизведанные земли»* |
| Disruptor | Druud (Друуд) |
| Doom | Vashundol (Семь Преисподних и загробье) |
| Dragon Knight | Candoness (Срединные королевства) (живёт)† |
| Drow Ranger | весь регион «Айсрак»* |
| Earth Spirit | The Upland (Стонущие горы) |
| Earthshaker | Nishai (Ховен и Нишай) |
| Elder Titan | Primordial Plane (Семь планов и Пустота)† |
| Ember Spirit | Fortress of Flares (Стонущие горы) (живёт) |
| Enchantress | весь регион «Неизведанные земли»* |
| Enigma | Fundamental Plane (Семь планов и Пустота) |
| Faceless Void | Claszureme (Семь планов и Пустота) |
| Grimstroke | Ashkavor (Феллстрат) |
| Gyrocopter | Ash Archipelago (Тропические острова) (живёт) |
| Hoodwink | Krimwohl (Томо'кан и Окраины); Tomo'kan (Томо'кан и Окраины) (живёт) |
| Huskar | Nothl Realm (Семь Преисподних и загробье) (связь) |
| Invoker | Ultimyr Academy (Срединные королевства) (связь)† |
| Io | Fundamental Plane (Семь планов и Пустота) |
| Jakiro | весь регион «Неизведанные земли»* |
| Juggernaut | Isle of Masks (Тропические острова) |
| Keeper of the Light | Fundamental Plane (Семь планов и Пустота); Light's Keep (Семь планов и Пустота) (связь) |
| Kez | Ghastly Eyrie (Небеса); Icewrack (Айсрак) (живёт) |
| Kunkka | Cladd (Кладд и острова) |
| Largo | Velu'Mar (Феллстрат) |
| Legion Commander | Qine (Стоунхолл); Stonehall (Стоунхолл) (живёт) |
| Leshrac | Heart of Nature (Семь планов и Пустота) |
| Lich | Black Pool (Айсрак) (живёт) |
| Lifestealer | Devarque (Срединные королевства) (связь) |
| Lina | Desert of Misrule (Сверкающая пустошь) |
| Lion | Weeping Rose (Вольные города) |
| Lone Druid | Onyx Grove (Айсрак) (живёт)† |
| Luna | Nightsilver Woods (Лес Найтсильвер) (живёт) |
| Lycan | Slom (Слом и Эльзе) |
| Magnus | Mount Joerlak (Стонущие горы)† |
| Marci | весь регион «Неизведанные земли»* |
| Mars | Olympus (Небеса)*; Quoidge (Квойдж и Поля Бойни) (связь)† |
| Medusa | Yama Raskav Jungle (Феллстрат) (живёт)† |
| Meepo | Riftshadow Ruins (Сверкающая пустошь); Singer's Gulch (Сверкающая пустошь) (связь)† |
| Mirana | Nightsilver Woods (Лес Найтсильвер) (живёт); Solar Throne (Срединные королевства) |
| Monkey King | White Spire (Вольные города) (живёт) |
| Morphling | весь регион «Глубины» (живёт) |
| Muerta | Skirm (Срединные королевства) |
| Naga Siren | Crey (Глубины) (живёт) |
| Nature's Prophet | Endless Copse (Западные леса) (живёт)† |
| Necrophos | Cathedral of Rumusque (Квойдж и Поля Бойни) |
| Night Stalker | The Void (Семь планов и Пустота)† |
| Nyx Assassin | Hidden Hive (Срединные королевства) (живёт) |
| Ogre Magi | весь регион «Неизведанные земли»* |
| Omniknight | Emauracus (Срединные королевства) (живёт) |
| Oracle | Ivory Incubarium (Семь планов и Пустота) |
| Outworld Destroyer | The Outworld (Семь планов и Пустота) |
| Pangolier | White Spire (Вольные города) (живёт)†; Qaldin (Сверкающая пустошь) (связь)† |
| Phantom Assassin | Tares (Стоунхолл) |
| Phantom Lancer | Pole (Земля Сияющих) |
| Phoenix | The Sun (Небеса)* |
| Primal Beast | Tomo'kan (Томо'кан и Окраины) (живёт) |
| Puck | Claszureme (Семь планов и Пустота)†; Tomo'kan (Томо'кан и Окраины) (связь)† |
| Pudge | Fields of Endless Carnage (Квойдж и Поля Бойни) (живёт); Quoidge (Квойдж и Поля Бойни) (связь) |
| Pugna | Nether Reaches (Подземье) |
| Queen of Pain | Elze (Слом и Эльзе) (связь); Weeping Rose (Вольные города) (связь)† |
| Razor | Narrow Maze (Семь Преисподних и загробье) (живёт); Underscape (Семь Преисподних и загробье) (связь) |
| Riki | весь регион «Неизведанные земли»* |
| Ringmaster | весь регион «Неизведанные земли»* |
| Rubick | весь регион «Неизведанные земли»* |
| Sand King | Scintillant Waste (Сверкающая пустошь); Qaldin (Сверкающая пустошь) (связь) |
| Shadow Demon | Seven Hells (Семь Преисподних и загробье)† |
| Shadow Fiend | Abysm (Семь Преисподних и загробье) |
| Shadow Shaman | Bleeding Hills (Ховен и Нишай) |
| Silencer | Hazhadal Barrens (Хазадальские пустоши); Tyler Estate (Вольные города) (связь)† |
| Skywrath Mage | Ghastly Eyrie (Небеса) |
| Slardar | Deep Vault (Глубины) (живёт) |
| Slark | Dark Reef (Глубины); весь регион «Тенистый берег» (живёт) |
| Snapfire | Nanarak (Томо'кан и Окраины) (живёт) |
| Sniper | Knollen (Земля Сияющих) |
| Spectre | весь регион «Семь планов и Пустота»; Ruelands (Тенистый берег) (связь)†; Hidden Temple (Срединные королевства) (связь)† |
| Spirit Breaker | Elemental Plane (Семь планов и Пустота); Nether Reaches (Подземье) (связь); Ultoria (Небеса) (связь)† |
| Storm Spirit | Ruined City (Стонущие горы) (живёт) |
| Sven | Shadeshore Ruins (Тенистый берег); Vigil Keep (Тенистый берег) (связь); Feral Road (Стонущие горы) (связь)† |
| Techies | Dredger's Bight (Земля Сияющих); Ruelands (Тенистый берег) (связь)† |
| Templar Assassin | Hidden Temple (Срединные королевства) (живёт); Violet Archives (Земля Сияющих) (связь); Halgalreh (Сверкающая пустошь) (связь)† |
| Terrorblade | Foulfell (Семь Преисподних и загробье) |
| Tidehunter | Sunken Isles (Кладд и острова) |
| Timbersaw | Augury Bay (Западные леса) |
| Tinker | Violet Plateau (Земля Сияющих) (живёт) |
| Tiny | весь регион «Неизведанные земли»* |
| Treant Protector | Vale of Augury (Западные леса) (живёт) |
| Troll Warlord | The Hoven (Ховен и Нишай) (живёт) |
| Tusk | Cobalt (Айсрак); Wolfsden Tavern (Айсрак) (связь) |
| Underlord | Aziyog (Подземье) (живёт); Stonehall (Стоунхолл) (связь)† |
| Undying | весь регион «Неизведанные земли»* |
| Ursa | Tomo'kan (Томо'кан и Окраины) (живёт) |
| Vengeful Spirit | Ghastly Eyrie (Небеса) |
| Venomancer | Acid Jungles (Тропические острова) |
| Viper | Nether Reaches (Подземье) |
| Visage | Narrow Maze (Семь Преисподних и загробье) (живёт) |
| Void Spirit | The Void (Семь планов и Пустота); Hidden Temple (Срединные королевства) (связь) |
| Warlock | Ultimyr Academy (Срединные королевства) (живёт); Outer Hells (Семь Преисподних и загробье) (связь) |
| Weaver | Fabric of Creation (Семь планов и Пустота) |
| Windranger | Zaru'Kina (Западные леса) |
| Winter Wyvern | Icewrack (Айсрак) (живёт)† |
| Witch Doctor | весь регион «Неизведанные земли»* |
| Wraith King | Throne of Bone (Империя Костей) (живёт) |
| Zeus | Olympus (Небеса) |
<!-- GENERATED:END -->

## 6. Что осталось в E1

Эта часть закрывает пункты: список мест, группировка в регионы, привязка всех 127 героев, решения В1 и В5. Решения В8–В10 перенесены в E2 (#2). Остаётся:

- [ ] Характеристики регионов: власть, отношение к магии, среда (сторона — уже есть)
- [ ] Описания регионов и мест на RU и EN, своими словами
- [ ] Русские названия мест (официальная локализация, где она есть)
- [ ] Отбор медиа: ≤ 3 официальных арта/синематика на место
- [ ] Алиасы героев для поиска — на Liquipedia у каждого героя есть поле `alias` (например, «AM, Wei»), плюс русские прозвища
