"""Проверка и сборка исследования E1 (модель связей — E14, docs/ARCHITECTURE.md §A3).

Проверяет, что каждый герой из официального списка (heroes.json) привязан к месту
или региону (герои без места в лоре — к региону `uncharted` с пояснением),
что все места, регионы, герои и медиа в связях существуют, и формат модели связей:
тип события, источник, путь героя, связи герой–герой, профиль (hero-places.json),
кандидаты в места (place-candidates.json). Проверяет алиасы поиска (hero-aliases.json).
Затем генерирует таблицы в docs/research/E1-places.md (между маркерами).

Запуск из корня репозитория:  python research/e1/build.py
Только проверка, без записи:   python research/e1/build.py --check

Функции validate_hero_entry / validate_candidate использует и research/e14/check.py.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DOC = ROOT / "docs" / "research" / "E1-places.md"
MEDIA = ROOT / "content" / "media.json"
BEGIN, END = "<!-- GENERATED:BEGIN -->", "<!-- GENERATED:END -->"

# Тип события связи герой–место (A3). Значение — пометка в таблицах E1-places.md.
EVENTS = {
    "origin": "",               # родина
    "home": " (живёт)",
    "journey": " (путь)",       # путь или переезд
    "battle": " (сражение)",    # сражение или нападение
    "service": " (служба)",
    "exile": " (изгнание)",     # изгнание или заточение
    "death": " (гибель)",       # гибель или перерождение
    "visit": " (бывал)",
    "mention": " (упоминание)",
    "link": " (связь)",         # из E1, тип не уточнён; в файлах героев E14 запрещён
}
# Кем другой герой приходится этому (A3). Значение — обратный тип.
RELATIONS = {
    "ally": "ally", "enemy": "enemy", "rival": "rival", "family": "family", "love": "love",
    "mentor": "student", "student": "mentor", "master": "servant", "servant": "master",
}
SOURCES = ("bio", "liquipedia", "ours")       # плюс comic:<id медиа>
VIA = ("infobox", "lore", "place")            # где на Liquipedia; только у source = liquipedia
LINK_KEYS = {"place", "region", "event", "source", "via", "url", "note", "doubt"}
RELATION_KEYS = {"hero", "type", "place", "region", "source", "via", "url", "note", "doubt"}
ENTRY_KEYS = {"links", "path", "relations", "profile"}
PROFILE_KEYS = {"summary", "art"}
CANDIDATE_KEYS = {"name", "hero", "region", "event", "source", "via", "url", "note", "doubt"}
SUMMARY_MAX = 500
# Арты профиля — только официальные ссылки Valve (A6).
VALVE_ART = re.compile(r"^https://(www\.dota2\.com|([a-z0-9-]+\.)*steamstatic\.com|steamcdn-a\.akamaihd\.net)/\S+$")
LIQUIPEDIA_URL = re.compile(r"^https://liquipedia\.net/dota2/\S+$")
HTTPS = re.compile(r"^https://[^\s/]+\.[^\s]+$")
CYRILLIC = re.compile(r"[А-Яа-яЁё]")

PLACEMENT = {"lore": "лор", "s1map": "карта S1", "ours": "наше"}
SIDE = {"radiant": "Radiant", "dire": "Dire", "neutral": "нейтрально"}
SIDE_BASIS = {"s1map": "карта S1", "position": "по схеме E2", "tier": "ярус"}
TIER = {"upper": "Верхний ярус", "continent": "Материк и острова", "abyss": "Бездна"}


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def load_optional(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def media_ids():
    return {m["id"] for m in load_optional(MEDIA, {"media": []}).get("media", [])}


def norm_place(s):
    return " ".join(s.lower().replace("’", "'").split())


class Ctx:
    """Справочники для проверки: места, регионы, герои, медиа."""

    def __init__(self, heroes, regions, media):
        self.region_ids = {r["id"] for r in regions["regions"]}
        self.loc_region = {l["name"]: r["id"] for r in regions["regions"] for l in r["locations"]}
        self.place_norm = {norm_place(n) for n in self.loc_region}
        self.hero_keys = {h["key"] for h in heroes["heroes"]}
        self.media = media


def is_text(v):
    return isinstance(v, str) and v.strip() != ""


def check_source(rec, where, ctx, errors, strict=False):
    """source / via / url. strict — файл героя E14: у Liquipedia обязательна ссылка."""
    src, via, url = rec.get("source"), rec.get("via"), rec.get("url")
    if isinstance(src, str) and src.startswith("comic:"):
        if src[6:] not in ctx.media:
            errors.append(f"{where}: неизвестное медиа {src} (content/media.json)")
    elif src not in SOURCES:
        errors.append(f"{where}: source — bio | liquipedia | comic:<id> | ours, а не {src!r}")
    if via is not None and (src != "liquipedia" or via not in VIA):
        errors.append(f"{where}: via ({' | '.join(VIA)}) — только у source liquipedia")
    if url is not None:
        if not isinstance(url, str) or not HTTPS.match(url):
            errors.append(f"{where}: url — нужна https-ссылка")
        elif src == "liquipedia" and not LIQUIPEDIA_URL.match(url):
            errors.append(f"{where}: url Liquipedia — https://liquipedia.net/dota2/…")
    elif strict and src == "liquipedia":
        errors.append(f"{where}: у источника liquipedia нужна ссылка url")
    if strict and src == "ours" and not is_text(rec.get("note")):
        errors.append(f"{where}: у источника ours нужна заметка note — почему так решили")
    for key in ("note", "doubt"):
        if key in rec and not is_text(rec[key]):
            errors.append(f"{where}: {key} — непустая строка")


def spot_of(rec, where, ctx, errors, required=True):
    """Ровно одно из place / region → ключ места героя ('place:<name>' | 'region:<id>') или None."""
    has_place, has_region = "place" in rec, "region" in rec
    if has_place and has_region or required and not (has_place or has_region):
        errors.append(f"{where}: нужно ровно одно из place/region")
        return None
    if has_place:
        if rec["place"] not in ctx.loc_region:
            errors.append(f"{where}: неизвестное место {rec['place']}")
            return None
        return "place:" + rec["place"]
    if has_region:
        if rec["region"] not in ctx.region_ids:
            errors.append(f"{where}: неизвестный регион {rec['region']}")
            return None
        return "region:" + rec["region"]
    return None


def unknown_keys(rec, allowed, where, errors):
    if not isinstance(rec, dict):
        errors.append(f"{where}: ожидается объект")
        return True
    for k in sorted(set(rec) - allowed):
        errors.append(f"{where}: неизвестный ключ {k}")
    return False


def check_localized(value, where, errors, limit=None):
    if not isinstance(value, dict) or set(value) != {"ru", "en"} or not all(is_text(value[k]) for k in ("ru", "en")):
        errors.append(f"{where}: нужен объект {{ ru, en }} с непустыми строками")
        return
    if CYRILLIC.search(value["en"]):
        errors.append(f"{where}: в en кириллица — текст не переведён?")
    if limit:
        for lang in ("ru", "en"):
            if len(value[lang]) > limit:
                errors.append(f"{where}.{lang}: длиннее {limit} знаков — нужно короткое описание")


def validate_hero_entry(hero, entry, ctx, strict=False):
    """Запись героя модели связей: { links, path?, relations?, profile? }.
    hero — имя или ключ для сообщений; strict — файл героя E14 (тип link запрещён, у Liquipedia нужна url)."""
    errors = []
    if unknown_keys(entry, ENTRY_KEYS | ({"hero", "read", "candidates", "unconfirmed"} if strict else set()),
                    hero, errors):
        return errors
    links = entry.get("links")
    spots = {}
    if not isinstance(links, list) or not links:
        errors.append(f"{hero}: пустой список мест links")
        links = []
    for i, link in enumerate(links):
        w = f"{hero}: links[{i}]"
        if unknown_keys(link, LINK_KEYS, w, errors):
            continue
        if link.get("event") not in EVENTS:
            errors.append(f"{w}: event — {' | '.join(EVENTS)}, а не {link.get('event')!r}")
        elif strict and link["event"] == "link":
            errors.append(f"{w}: event link (без уточнения) остался от E1 — выберите тип события")
        check_source(link, w, ctx, errors, strict)
        spot = spot_of(link, w, ctx, errors)
        if spot in spots:
            errors.append(f"{w}: место {spot.split(':', 1)[1]} уже есть в links — одно место, одна связь")
        if spot:
            spots[spot] = link.get("event")
        if link.get("region") == "uncharted" and not link.get("note"):
            errors.append(f"{w}: у героя «Неизведанных земель» нужна заметка note")

    path = entry.get("path")
    if path is not None:
        if not isinstance(path, list) or len(path) < 2:
            errors.append(f"{hero}: path — список из 2 и больше остановок")
        else:
            prev = None
            for i, stop in enumerate(path):
                w = f"{hero}: path[{i}]"
                if unknown_keys(stop, {"place", "region"}, w, errors):
                    continue
                spot = spot_of(stop, w, ctx, errors)
                if spot and spot not in spots:
                    errors.append(f"{w}: остановки {spot.split(':', 1)[1]} нет в links героя")
                elif spot and spots[spot] == "mention":
                    errors.append(f"{w}: {spot.split(':', 1)[1]} только упомянуто (mention) — в путь не входит")
                if spot and spot == prev:
                    errors.append(f"{w}: остановка повторяет предыдущую")
                prev = spot

    relations = entry.get("relations")
    if relations is not None:
        if not isinstance(relations, list):
            errors.append(f"{hero}: relations — список")
            relations = []
        seen = set()
        for i, rel in enumerate(relations):
            w = f"{hero}: relations[{i}]"
            if unknown_keys(rel, RELATION_KEYS, w, errors):
                continue
            if rel.get("hero") not in ctx.hero_keys:
                errors.append(f"{w}: неизвестный герой {rel.get('hero')!r} (нужен key из heroes.json)")
            if rel.get("type") not in RELATIONS:
                errors.append(f"{w}: type — {' | '.join(RELATIONS)}, а не {rel.get('type')!r}")
            if (rel.get("hero"), rel.get("type")) in seen:
                errors.append(f"{w}: связь {rel.get('hero')} / {rel.get('type')} повторяется")
            seen.add((rel.get("hero"), rel.get("type")))
            check_source(rel, w, ctx, errors, strict)
            spot_of(rel, w, ctx, errors, required=False)

    profile = entry.get("profile")
    if profile is not None and not unknown_keys(profile, PROFILE_KEYS, f"{hero}: profile", errors):
        if "summary" in profile:
            check_localized(profile["summary"], f"{hero}: profile.summary", errors, SUMMARY_MAX)
        art = profile.get("art")
        if art is not None:
            if not isinstance(art, list) or not art:
                errors.append(f"{hero}: profile.art — непустой список ссылок")
            else:
                for a in art:
                    if not isinstance(a, str) or not VALVE_ART.match(a):
                        errors.append(f"{hero}: profile.art — только официальные ссылки Valve (A6): {a!r}")
                if len(set(art)) != len(art):
                    errors.append(f"{hero}: profile.art — ссылка повторяется")
    return errors


def validate_candidate(cand, where, ctx):
    """Кандидат в места: место из лора, которого нет на схеме (решается в #59)."""
    errors = []
    if unknown_keys(cand, CANDIDATE_KEYS, where, errors):
        return errors
    if not is_text(cand.get("name")):
        errors.append(f"{where}: name — название места из лора")
    elif norm_place(cand["name"]) in ctx.place_norm:
        errors.append(f"{where}: {cand['name']} уже есть на схеме — это связь links, а не кандидат")
    if "hero" in cand and cand["hero"] not in ctx.hero_keys:
        errors.append(f"{where}: неизвестный герой {cand['hero']!r}")
    if cand.get("region") not in ctx.region_ids:
        errors.append(f"{where}: region — предполагаемый регион, id из regions.json")
    if cand.get("event") not in EVENTS or cand.get("event") == "link":
        errors.append(f"{where}: event — тип события ({' | '.join(e for e in EVENTS if e != 'link')})")
    check_source(cand, where, ctx, errors, strict=True)
    return errors


def validate_relations_pairs(entries, key_of):
    """Противоречие между двумя героями: оба называют друг друга наставником (хозяином)."""
    errors = []
    types = {}
    for hero, entry in entries.items():
        for rel in entry.get("relations") or []:
            types.setdefault((key_of[hero], rel.get("hero")), set()).add(rel.get("type"))
    for (a, b), ts in sorted(types.items(), key=lambda kv: kv[0]):
        if a < b:
            for t in sorted(ts & types.get((b, a), set())):
                if RELATIONS.get(t) != t:
                    errors.append(f"связи {a} и {b}: оба называют друг друга {t} — у одного должно быть {RELATIONS[t]}")
    return errors


def validate(heroes, regions, places, candidates=None, media=None):
    errors = []
    official = {h["name"] for h in heroes["heroes"]}
    placed, unplaced = set(places["heroes"]), set(places.get("unplaced", {}))
    for name in sorted(official - placed - unplaced):
        errors.append(f"герой не распределён: {name}")
    for name in sorted((placed | unplaced) - official):
        errors.append(f"нет в официальном списке: {name}")
    for name in sorted(placed & unplaced):
        errors.append(f"герой и привязан, и в unplaced: {name}")

    loc_region = {}
    for r in regions["regions"]:
        if r["tier"] not in TIER or r["side"] not in SIDE:
            errors.append(f"регион {r['id']}: неверный tier/side")
        if r.get("sideBasis") not in SIDE_BASIS:
            errors.append(f"регион {r['id']}: неверный sideBasis")
        elif (r["tier"] != "continent") != (r["sideBasis"] == "tier"):
            errors.append(f"регион {r['id']}: sideBasis «tier» — только у ярусов, и у ярусов — только он")
        elif r["sideBasis"] == "tier" and r["side"] != "neutral":
            errors.append(f"регион {r['id']}: ярус должен быть нейтральным")
        if sum(1 for l in r["locations"] if l.get("capital")) > 1:
            errors.append(f"регион {r['id']}: больше одной столицы")
        for l in r["locations"]:
            if l["name"] in loc_region:
                errors.append(f"место в двух регионах: {l['name']}")
            if l["placement"] not in PLACEMENT:
                errors.append(f"место {l['name']}: неверный placement")
            loc_region[l["name"]] = r["id"]

    ctx = Ctx(heroes, regions, media if media is not None else media_ids())
    for hero, entry in places["heroes"].items():
        errors += validate_hero_entry(hero, entry, ctx)
    key_of = {h["name"]: h["key"] for h in heroes["heroes"]}
    errors += validate_relations_pairs({h: e for h, e in places["heroes"].items() if h in key_of}, key_of)

    seen = set()
    for i, cand in enumerate((candidates or {}).get("candidates", [])):
        where = f"place-candidates.json: candidates[{i}]"
        errors += validate_candidate(cand, where, ctx)
        if not cand.get("hero"):
            errors.append(f"{where}: hero — key героя, из лора которого место")
        k = (norm_place(str(cand.get("name"))), cand.get("hero"))
        if k in seen:
            errors.append(f"{where}: {cand.get('name')} у {cand.get('hero')} уже записан")
        seen.add(k)
    return errors, loc_region


def norm_alias(s):
    """Ключ сравнения алиасов: регистр, ё/е и лишние пробелы не важны (как в поиске)."""
    return " ".join(s.lower().replace("ё", "е").split())


def validate_aliases(heroes, aliases):
    """Ошибки: неизвестный герой, не список, пустая строка, повтор внутри героя или совпадение с именем.
    Предупреждение: один и тот же алиас у двух героев."""
    errors, warnings = [], []
    names = {h["key"]: h["name"] for h in heroes["heroes"]}
    owners = {}
    for key, items in aliases.get("aliases", {}).items():
        if key not in names:
            errors.append(f"алиасы: неизвестный герой {key}")
            continue
        if not isinstance(items, list):
            errors.append(f"алиасы {key}: ожидается список строк")
            continue
        seen = set()
        for a in items:
            if not isinstance(a, str) or not a.strip():
                errors.append(f"алиасы {key}: пустой алиас")
                continue
            n = norm_alias(a)
            if n in seen:
                errors.append(f"алиасы {key}: повтор «{a}»")
            elif n == norm_alias(names[key]):
                errors.append(f"алиасы {key}: «{a}» совпадает с именем героя")
            seen.add(n)
            owners.setdefault(n, set()).add(key)
    for n, keys in sorted(owners.items()):
        if len(keys) > 1:
            warnings.append(f"алиас «{n}» у нескольких героев: {', '.join(sorted(keys))}")
    return errors, warnings


def mark(link):
    """Пометка силы источника: † — герой только упомянут на странице места Liquipedia, * — наше решение."""
    if link["source"] == "ours":
        return "*"
    if link["source"] == "liquipedia" and link.get("via") == "place":
        return "†"
    return ""


def hero_tag(hero, link):
    return f"{hero}{EVENTS[link['event']]}{mark(link)}"


def render(heroes, regions, places, loc_region):
    links_of = {hero: entry["links"] for hero, entry in places["heroes"].items()}
    by_place, by_region = {}, {}
    for hero, links in sorted(links_of.items()):
        for link in links:
            if "place" in link:
                by_place.setdefault(link["place"], []).append(hero_tag(hero, link))
            else:
                by_region.setdefault(link["region"], []).append(hero_tag(hero, link))

    def region_heroes(r):
        names = set()
        for hero, links in links_of.items():
            for link in links:
                if link.get("region") == r["id"] or loc_region.get(link.get("place")) == r["id"]:
                    names.add(hero)
        return names

    out = []
    total_locs = sum(len(r["locations"]) for r in regions["regions"])
    uncharted = {h: l for h, links in links_of.items() for l in links if l.get("region") == "uncharted"}
    out.append(f"Регионов: **{len(regions['regions'])}**, мест: **{total_locs}**, "
               f"героев привязано: **{len(links_of)}** из {len(heroes['heroes'])}, "
               f"из них в «Неизведанных землях»: **{len(uncharted)}**.\n")

    out.append("### Сводка по регионам\n")
    out.append("| Ярус | Регион | Сторона | Мест | Героев |")
    out.append("|---|---|---|---|---|")
    for r in regions["regions"]:
        out.append(f"| {TIER[r['tier']]} | {r['ru']} ({r['en']}) | {SIDE[r['side']]} ({SIDE_BASIS[r['sideBasis']]}) | "
                   f"{len(r['locations'])} | {len(region_heroes(r))} |")
    out.append("")

    tier = None
    for r in regions["regions"]:
        if r["tier"] != tier:
            tier = r["tier"]
            out.append(f"### {TIER[tier]}\n")
        out.append(f"#### {r['ru']} · {r['en']}\n")
        out.append(f"Сторона: **{SIDE[r['side']]}** ({SIDE_BASIS[r['sideBasis']]}). {r['geo']}\n")
        if r["id"] == "uncharted":
            out.append("| Герой | Почему здесь |")
            out.append("|---|---|")
            for hero, link in sorted(uncharted.items()):
                out.append(f"| {hero} | {link['note']} |")
            out.append("")
            continue
        if r["id"] in by_region:
            out.append(f"Герои всего региона: {', '.join(by_region[r['id']])}\n")
        out.append("| Место | Расположение | Герои | Заметка |")
        out.append("|---|---|---|---|")
        for l in r["locations"]:
            name = ("★ " if l.get("capital") else "") + l["name"]
            out.append(f"| {name} | {PLACEMENT[l['placement']]} | "
                       f"{', '.join(by_place.get(l['name'], [])) or '—'} | {l.get('note', '')} |")
        out.append("")

    out.append("### Указатель: герой → места\n")
    out.append("| Герой | Места |")
    out.append("|---|---|")
    region_name = {r["id"]: r["ru"] for r in regions["regions"]}
    for hero, links in sorted(links_of.items()):
        parts = []
        for link in links:
            if "place" in link:
                where = f"{link['place']} ({region_name[loc_region[link['place']]]})"
            else:
                where = f"весь регион «{region_name[link['region']]}»"
            parts.append(where + EVENTS[link["event"]] + mark(link))
        out.append(f"| {hero} | {'; '.join(parts)} |")
    return "\n".join(out) + "\n"


def summary(places, candidates):
    entries = places["heroes"].values()
    links = [l for e in entries for l in e["links"]]
    unspecified = sum(1 for l in links if l["event"] == "link")
    return (f"связей {len(links)} (без уточнения типа — {unspecified}), "
            f"путей {sum(1 for e in entries if e.get('path'))}, "
            f"связей героев {sum(len(e.get('relations') or []) for e in entries)}, "
            f"профилей {sum(1 for e in entries if (e.get('profile') or {}).get('summary'))}, "
            f"кандидатов в места {len(candidates.get('candidates', []))}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    heroes, regions, places = load("heroes.json"), load("regions.json"), load("hero-places.json")
    candidates = load_optional(HERE / "place-candidates.json", {"candidates": []})
    errors, loc_region = validate(heroes, regions, places, candidates)
    aliases = load("hero-aliases.json")
    alias_errors, alias_warnings = validate_aliases(heroes, aliases)
    errors += alias_errors
    for w in alias_warnings:
        print(f"ПРЕДУПРЕЖДЕНИЕ: {w}")
    if errors:
        print("ОШИБКИ:\n" + "\n".join(f"  - {e}" for e in errors))
        sys.exit(1)
    print(f"OK: {len(places['heroes'])} из {len(heroes['heroes'])} героев привязаны; "
          f"{len(loc_region)} мест в {len(regions['regions'])} регионах; "
          f"алиасы у {len(aliases['aliases'])} героев; {summary(places, candidates)}")
    if "--check" in sys.argv:
        return
    doc = DOC.read_text(encoding="utf-8")
    head, rest = doc.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    DOC.write_text(head + BEGIN + "\n" + render(heroes, regions, places, loc_region) + END + tail,
                   encoding="utf-8")
    print(f"обновлено: {DOC.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
