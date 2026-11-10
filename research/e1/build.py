"""Проверка и сборка исследования E1.

Проверяет, что каждый герой из официального списка (heroes.json) привязан к месту
или явно числится в `unplaced`, и что все места и регионы существуют.
Затем генерирует таблицы в docs/research/E1-places.md (между маркерами).

Запуск из корня репозитория:  python research/e1/build.py
Только проверка, без записи:   python research/e1/build.py --check
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DOC = ROOT / "docs" / "research" / "E1-places.md"
BEGIN, END = "<!-- GENERATED:BEGIN -->", "<!-- GENERATED:END -->"

ROLE = {"origin": "", "home": " (живёт)", "link": " (связь)"}
BASIS = {"infobox": "", "bio": "", "page": "†", "ours": "*"}
PLACEMENT = {"lore": "лор", "s1map": "карта S1", "ours": "наше"}
SIDE = {"radiant": "Radiant", "dire": "Dire", "neutral": "нейтрально"}
TIER = {"upper": "Верхний ярус", "continent": "Материк и острова", "abyss": "Бездна"}


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def validate(heroes, regions, places):
    errors = []
    official = {h["name"] for h in heroes["heroes"]}
    placed, unplaced = set(places["heroes"]), set(places["unplaced"])
    for name in sorted(official - placed - unplaced):
        errors.append(f"герой не распределён: {name}")
    for name in sorted((placed | unplaced) - official):
        errors.append(f"нет в официальном списке: {name}")
    for name in sorted(placed & unplaced):
        errors.append(f"герой и привязан, и в unplaced: {name}")

    region_ids = {r["id"] for r in regions["regions"]}
    loc_region = {}
    for r in regions["regions"]:
        if r["tier"] not in TIER or r["side"] not in SIDE:
            errors.append(f"регион {r['id']}: неверный tier/side")
        if sum(1 for l in r["locations"] if l.get("capital")) > 1:
            errors.append(f"регион {r['id']}: больше одной столицы")
        for l in r["locations"]:
            if l["name"] in loc_region:
                errors.append(f"место в двух регионах: {l['name']}")
            if l["placement"] not in PLACEMENT:
                errors.append(f"место {l['name']}: неверный placement")
            loc_region[l["name"]] = r["id"]

    for hero, links in places["heroes"].items():
        if not links:
            errors.append(f"{hero}: пустой список мест")
        for link in links:
            if link.get("role") not in ROLE or link.get("basis") not in BASIS:
                errors.append(f"{hero}: неверный role/basis")
            if "place" in link and link["place"] not in loc_region:
                errors.append(f"{hero}: неизвестное место {link['place']}")
            if "region" in link and link["region"] not in region_ids:
                errors.append(f"{hero}: неизвестный регион {link['region']}")
            if ("place" in link) == ("region" in link):
                errors.append(f"{hero}: нужно ровно одно из place/region")
    return errors, loc_region


def hero_tag(hero, link):
    return f"{hero}{ROLE[link['role']]}{BASIS[link['basis']]}"


def render(heroes, regions, places, loc_region):
    by_place, by_region = {}, {}
    for hero, links in sorted(places["heroes"].items()):
        for link in links:
            if "place" in link:
                by_place.setdefault(link["place"], []).append(hero_tag(hero, link))
            else:
                by_region.setdefault(link["region"], []).append(hero_tag(hero, link))

    def region_heroes(r):
        names = set()
        for hero, links in places["heroes"].items():
            for link in links:
                if link.get("region") == r["id"] or loc_region.get(link.get("place")) == r["id"]:
                    names.add(hero)
        return names

    out = []
    total_locs = sum(len(r["locations"]) for r in regions["regions"])
    out.append(f"Регионов: **{len(regions['regions'])}**, мест: **{total_locs}**, "
               f"героев привязано: **{len(places['heroes'])}** из {len(heroes['heroes'])}, "
               f"без места: **{len(places['unplaced'])}**.\n")

    out.append("### Сводка по регионам\n")
    out.append("| Ярус | Регион | Сторона | Мест | Героев |")
    out.append("|---|---|---|---|---|")
    for r in regions["regions"]:
        out.append(f"| {TIER[r['tier']]} | {r['ru']} ({r['en']}) | {SIDE[r['side']]} | "
                   f"{len(r['locations'])} | {len(region_heroes(r))} |")
    out.append("")

    tier = None
    for r in regions["regions"]:
        if r["tier"] != tier:
            tier = r["tier"]
            out.append(f"### {TIER[tier]}\n")
        out.append(f"#### {r['ru']} · {r['en']}\n")
        out.append(f"Сторона: **{SIDE[r['side']]}**. {r['geo']}\n")
        if r["id"] in by_region:
            out.append(f"Герои всего региона: {', '.join(by_region[r['id']])}\n")
        out.append("| Место | Расположение | Герои | Заметка |")
        out.append("|---|---|---|---|")
        for l in r["locations"]:
            name = ("★ " if l.get("capital") else "") + l["name"]
            out.append(f"| {name} | {PLACEMENT[l['placement']]} | "
                       f"{', '.join(by_place.get(l['name'], [])) or '—'} | {l.get('note', '')} |")
        out.append("")

    out.append("### Герои без места\n")
    out.append("| Герой | Почему |")
    out.append("|---|---|")
    for hero, why in sorted(places["unplaced"].items()):
        out.append(f"| {hero} | {why} |")
    out.append("")

    out.append("### Указатель: герой → места\n")
    out.append("| Герой | Места |")
    out.append("|---|---|")
    region_name = {r["id"]: r["ru"] for r in regions["regions"]}
    for hero, links in sorted(places["heroes"].items()):
        parts = []
        for link in links:
            if "place" in link:
                where = f"{link['place']} ({region_name[loc_region[link['place']]]})"
            else:
                where = f"весь регион «{region_name[link['region']]}»"
            parts.append(where + ROLE[link["role"]] + BASIS[link["basis"]])
        out.append(f"| {hero} | {'; '.join(parts)} |")
    return "\n".join(out) + "\n"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    heroes, regions, places = load("heroes.json"), load("regions.json"), load("hero-places.json")
    errors, loc_region = validate(heroes, regions, places)
    if errors:
        print("ОШИБКИ:\n" + "\n".join(f"  - {e}" for e in errors))
        sys.exit(1)
    print(f"OK: {len(places['heroes'])} привязано + {len(places['unplaced'])} без места "
          f"= {len(heroes['heroes'])} героев; {len(loc_region)} мест в {len(regions['regions'])} регионах")
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
