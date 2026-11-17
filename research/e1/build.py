"""Отчёт исследования E1 и проверка кандидатов в места (docs/ARCHITECTURE.md §A3).

Генерирует таблицы в docs/research/E1-places.md (между маркерами) по regions.json и hero-places.json
и проверяет place-candidates.json. Правила модели связей (hero-places.json, regions.json, алиасы,
файлы героев E14) проверяет только scripts/build-data.mjs (npm run data; файлы E14 — --check-hero).

Запуск из корня репозитория:  python research/e1/build.py
Только проверка, без записи:   python research/e1/build.py --check

Функцию validate_candidate использует и research/e14/check.py.
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
}
SOURCES = ("bio", "liquipedia", "ours")       # плюс comic:<id медиа>
VIA = ("infobox", "lore", "place")            # где на Liquipedia; только у source = liquipedia
CANDIDATE_KEYS = {"name", "hero", "region", "event", "source", "via", "url", "note", "doubt"}
LIQUIPEDIA_URL = re.compile(r"^https://liquipedia\.net/dota2/\S+$")
HTTPS = re.compile(r"^https://[^\s/]+\.[^\s]+$")

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


def unknown_keys(rec, allowed, where, errors):
    if not isinstance(rec, dict):
        errors.append(f"{where}: ожидается объект")
        return True
    for k in sorted(set(rec) - allowed):
        errors.append(f"{where}: неизвестный ключ {k}")
    return False


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
    if cand.get("event") not in EVENTS:
        errors.append(f"{where}: event — тип события ({' | '.join(EVENTS)})")
    check_source(cand, where, ctx, errors, strict=True)
    return errors


def validate_candidates(candidates, ctx):
    """place-candidates.json: каждый кандидат по правилам validate_candidate, с героем, без повторов."""
    errors, seen = [], set()
    for i, cand in enumerate((candidates or {}).get("candidates", [])):
        where = f"place-candidates.json: candidates[{i}]"
        errors += validate_candidate(cand, where, ctx)
        if not cand.get("hero"):
            errors.append(f"{where}: hero — key героя, из лора которого место")
        k = (norm_place(str(cand.get("name"))), cand.get("hero"))
        if k in seen:
            errors.append(f"{where}: {cand.get('name')} у {cand.get('hero')} уже записан")
        seen.add(k)
    return errors


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
    return (f"связей {len(links)}, "
            f"путей {sum(1 for e in entries if e.get('path'))}, "
            f"связей героев {sum(len(e.get('relations') or []) for e in entries)}, "
            f"профилей {sum(1 for e in entries if (e.get('profile') or {}).get('summary'))}, "
            f"кандидатов в места {len(candidates.get('candidates', []))}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    heroes, regions, places = load("heroes.json"), load("regions.json"), load("hero-places.json")
    candidates = load_optional(HERE / "place-candidates.json", {"candidates": []})
    ctx = Ctx(heroes, regions, media_ids())
    errors = validate_candidates(candidates, ctx)
    if errors:
        print("ОШИБКИ:\n" + "\n".join(f"  - {e}" for e in errors))
        sys.exit(1)
    print(f"OK: {len(places['heroes'])} из {len(heroes['heroes'])} героев привязаны; "
          f"{len(ctx.loc_region)} мест в {len(regions['regions'])} регионах; {summary(places, candidates)}")
    if "--check" in sys.argv:
        return
    doc = DOC.read_text(encoding="utf-8")
    head, rest = doc.split(BEGIN, 1)
    _, tail = rest.split(END, 1)
    DOC.write_text(head + BEGIN + "\n" + render(heroes, regions, places, ctx.loc_region) + END + tail,
                   encoding="utf-8")
    print(f"обновлено: {DOC.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
