# E1 · Источники медиа для регионов и мест (#114)

Проверено 2026-11-17. Правила — ARCHITECTURE A3 («Формат `content/media.json`») и A6: только официальные материалы Valve, по прямой https-ссылке, в репозиторий ничего не копируем, тексты — свои слова.

## Источники

| Источник | Пример ссылки | Как проверялось | Что дал |
|---|---|---|---|
| YouTube-канал Dota 2 (`@dota2`, канал `UCTQKT5QqO3h7y32G8VzuySQ`) | `youtubeId` `In5C2HWaWk8` | поиск по каналу (`/@dota2/search?query=…`: trailer, crownfall, cinematic, hero, update, arcana, события и имена героев); описание ролика; `https://www.youtube.com/oembed?url=…` — 200, автор `dota2`; встраивание разрешено (`playableInEmbed: true`) | 4 трейлера Crownfall — у них место действия названо в описании |
| Новости dota2.com (`/newsentry/<gid>`) с артом события | `https://clan.fastly.steamstatic.com/images/3703047/ba80…3b9a811b.jpg`, `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/blogfiles/blog_siltbreakerrises.jpg` | список новостей — Steam API `ISteamNews/GetNewsForApp` (appid 570, 772 записи с 2012 г.), поиск по названиям наших мест и регионов; картинку смотрели глазами; GET — 200, `image/*`; страница `www.dota2.com/newsentry/<gid события>` открывается и показывает ту же картинку | 3 арта, где место действия названо в тексте новости |
| Страницы событий dota2.com (`/crownfall`, `/darkcarnival`) | `…/dota_react/darkcarnival/overworld/dark_carnival_overworld_poster.jpg` | список картинок страницы в браузере, просмотр | ничего: на артах ярмарка, герои или интерфейс события, а не место карты. Старые страницы (`/darkmoon`, `/mistwoods`) перенаправляют на главную |
| Официальные комиксы | — | не трогали: их ведёт #60 | Акты Crownfall (`crownfall/act{2,3,4}_intro/<язык>/NNN.webp`, `comic_part1`) — кандидаты для #60 |
| Арт карточек Artifact (разрешён владельцем 2026-11-17, A3) | `https://cdn.cloudflare.steamstatic.com/apps/583950/icons/set01/10183_large_english.<хэш>.png` | API карточек `playartifact.com/cardset/0N/` больше не отвечает (ведёт в магазин); адрес JSON набора взят из его копии в Wayback Machine, сам JSON лежит на CDN Valve (`/apps/583950/resource/card_set_1.<хэш>.json`, 394 карточки базового набора). Искали названия наших мест и регионов в именах карточек; каждую картинку смотрели глазами; GET английской и русской версии — 200, `image/png` | 6 карточек, на которых место названо в имени |

Шапки большинства новостей — групповые рендеры героев (обновления 7.36, Mistwoods, Dark Moon, Wrath of the Mo'rokai, Dark Rift): к месту они не относятся, их не брали.

## Что добавлено

| id | Тип | Регион / место | Почему это место |
|---|---|---|---|
| `ghastly-eyrie-ascension-day` | арт | Небеса; Мрачное Гнездовье | новость «Ascension Day» (2024): башни Ghastly Eyrie |
| `crownfall-trailer` | трейлер | Мрачное Гнездовье | описание: улицы Скайрата |
| `crownfall-act-iv-trailer` | трейлер | Мрачное Гнездовье | акт IV «The Spires of Skywrath» |
| `crownfall-act-ii-trailer` | трейлер | Друуд | описание: пески Друуда |
| `crownfall-act-iii-trailer` | трейлер | Айсрак | акт III «The Frosts of Icewrack» |
| `dark-reef-siltbreaker` | арт | Глубины; Тёмный риф | новость Siltbreaker: Act I (2017): тюрьма Dark Reef |
| `underhollow-roshan` | арт | Подземье; Пещеры пустоши | новость «The Underhollow Beckons» (2018) |
| `artifact-omexe-arena` | арт Artifact | Друуд: Омекс | «The Omexe Arena» |
| `artifact-tyler-estate` | арт Artifact | Вольные города: Поместье Тайлер | «The Tyler Estate» |
| `artifact-iron-fog-goldmine` | арт Artifact | Вольные города: Железный Туман | «Iron Fog Goldmine» |
| `artifact-roseleaf-wall` | арт Artifact | Стоунхолл: Розолист | «Roseleaf Wall» |
| `artifact-stonehall-elite` | арт Artifact | Стоунхолл; Стоунхолл (город) | «Stonehall Elite» |
| `artifact-pit-fighter-quoidge` | арт Artifact | Квойдж; Квойдж (город) | «Pit Fighter of Quoidge» |

Арт места показан и в панели его региона, если у региона своего медиа не было. Не взяты карточки Artifact, на которых названо не наше место: «Altar of the Mad Moon» (алтарь на земле, а не сама Безумная луна), «Revtel Investments» (на картинке только сундук), «Keenfolk …», «Selemene's Favor», «Mist of Avernus», «Rumusque Blessing» (на них названы народ или божество, а не место).

## Итог по регионам

Медиа на уровне региона — у 8 из 26: Друуд, Семь Преисподних, Айсрак, Небеса, Глубины, Подземье, Стоунхолл, Квойдж. Ещё у двух регионов медиа есть только у мест: Вольные города (Sundered Moon, Поместье Тайлер, Железный Туман) и Хазадальские пустоши (Fortress of Valhessi). **Всего 10 регионов из 26.**

Регионы без медиа — что искали и почему не нашли. Во всех случаях искали на YouTube-канале Dota 2, в новостях dota2.com с 2012 года, на страницах событий и в именах карточек Artifact:

| Регион | Итог |
|---|---|
| Кладд, Ховен, Земля Сияющих, Тенистый берег, Слом и Эльзе, Сверкающая пустошь, Стонущие горы, Западные леса, Срединные королевства, Империя Костей, Семь планов | ни ролик, ни арт события не называет их места; упоминания в новостях — имена предметов и косметики (Riftshadow Ruins, Aziyog в Collector's Cache 2018) |
| Лес Найтсильвер | событие Dark Moon (2017) идёт в храме Селемены, но шапка новости — курьер, страница события удалена |
| Феллстрат | Wrath of the Mo'rokai (2019) — в джунглях Феллстрата, но шапка — рендеры героев, страница боевого пропуска 2019 удалена |
| Томо'кан | The Mistwoods (2020) — «между Нанараком и Кримволем», но арт — промо героя Hoodwink с надписью; страница удалена |
| Тропические острова | Bladeform Legacy (2017) — арт аркана Juggernaut, к Острову масок привязан только через героя |
| Неизведанные земли | мест нет |

Не взят ролик Dark Carnival (`3XW6rZHh8fA`): это то же событие, что и комикс Milltown, но место действия в ролике не названо.
