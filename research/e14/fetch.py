"""Кэш источников лора героя для исследования E14 (#45, флоу партии — #44).

Для каждого героя скачивает:
  - официальную биографию dota2.com на русском и английском (datafeed herodata, поле bio_loc);
  - вики-текст двух страниц Liquipedia — `<Герой>/Lore` (инфобокс лора, поле origins) и `<Герой>`
    (главная страница) — одним запросом к API.

Правила (CLAUDE.md): Liquipedia — только через https://liquipedia.net/dota2/api.php, с User-Agent проекта,
последовательно, пауза ≥ 2 с между запросами. Здесь пауза ≥ 2 с между любыми двумя запросами, без потоков.
User-Agent браузера не подставляем. В запросах нет ничего, кроме названия страницы или id героя.

Кэш — research/e14/cache/<key>/ (в .gitignore, не коммитится):
  bio.ru.txt, bio.en.txt           биография без разметки
  liquipedia-lore.wiki             вики-текст <Герой>/Lore (нет страницы — файла нет)
  liquipedia-hero.wiki             вики-текст <Герой>
  meta.json                        ссылки, дата, какие страницы не нашлись

Запуск из корня репозитория:
  python research/e14/fetch.py <key> [<key> ...]     ключи из research/e1/heroes.json
  python research/e14/fetch.py --refresh <key> ...   скачать заново, даже если кэш есть
  python research/e14/fetch.py --dry-run <key> ...   только показать, что будет запрошено
"""
import gzip
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "cache"
HEROES = ROOT / "research" / "e1" / "heroes.json"

USER_AGENT = "DotaLoreMapResearch/0.1 (non-commercial fan project)"
PAUSE = 2.5          # секунды между запросами (правило — не меньше 2)
DOTA2 = "https://www.dota2.com/datafeed/herodata"
LIQUIPEDIA_API = "https://liquipedia.net/dota2/api.php"
LIQUIPEDIA_PAGE = "https://liquipedia.net/dota2/"
LANGS = {"ru": "russian", "en": "english"}
# Название страницы Liquipedia, если оно не совпадает с официальным именем героя.
TITLES = {}

_last_request = 0.0


def get(url):
    """Один GET с паузой ≥ PAUSE после предыдущего запроса. Возвращает текст ответа."""
    global _last_request
    wait = _last_request + PAUSE - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return body.decode("utf-8")
    finally:
        _last_request = time.monotonic()


def strip_markup(text):
    """bio_loc приходит с <br> и тегами — оставляем чистый текст с абзацами."""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p\s*>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"


def find_bio(data):
    """Первое поле bio_loc в ответе datafeed (result.data.heroes[0].bio_loc), где бы оно ни лежало."""
    if isinstance(data, dict):
        if isinstance(data.get("bio_loc"), str):
            return data["bio_loc"]
        values = data.values()
    elif isinstance(data, list):
        values = data
    else:
        return None
    for v in values:
        found = find_bio(v)
        if found is not None:
            return found
    return None


def dota2_url(hero_id, lang):
    return f"{DOTA2}?{urllib.parse.urlencode({'language': LANGS[lang], 'hero_id': hero_id})}"


def liquipedia_url(titles):
    params = {
        "action": "query",
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
        "titles": "|".join(titles),
        "redirects": "1",
        "format": "json",
        "formatversion": "2",
    }
    return f"{LIQUIPEDIA_API}?{urllib.parse.urlencode(params)}"


def page_url(title):
    return LIQUIPEDIA_PAGE + urllib.parse.quote(title.replace(" ", "_"), safe="/'()")


def fetch_hero(hero, refresh=False, dry_run=False):
    key, name = hero["key"], hero["name"]
    out = CACHE / key
    meta_path = out / "meta.json"
    if meta_path.exists() and not refresh and not dry_run:
        print(f"{key}: уже в кэше ({meta_path.relative_to(ROOT)}), пропуск (--refresh — скачать заново)")
        return True
    title = TITLES.get(key, name)
    titles = [f"{title}/Lore", title]
    plan = [dota2_url(hero["id"], lang) for lang in LANGS] + [liquipedia_url(titles)]
    if dry_run:
        for url in plan:
            print(f"{key}: GET {url}")
        return True

    out.mkdir(parents=True, exist_ok=True)
    meta = {"hero": key, "name": name, "retrieved": date.today().isoformat(), "sources": {}, "missing": []}
    ok = True
    for lang in LANGS:
        url = dota2_url(hero["id"], lang)
        try:
            bio = find_bio(json.loads(get(url)))
        except (urllib.error.URLError, ValueError) as e:
            print(f"{key}: dota2.com {lang} — ошибка: {e}")
            meta["missing"].append(f"bio.{lang}")
            ok = False
            continue
        if not bio:
            print(f"{key}: dota2.com {lang} — в ответе нет bio_loc")
            meta["missing"].append(f"bio.{lang}")
            ok = False
            continue
        (out / f"bio.{lang}.txt").write_text(strip_markup(bio), encoding="utf-8")
        meta["sources"][f"bio.{lang}"] = {
            "url": f"https://www.dota2.com/hero/{re.sub(r'[^a-z0-9]', '', name.lower())}?l={LANGS[lang]}",
            "api": url,
        }

    url = liquipedia_url(titles)
    try:
        data = json.loads(get(url))
    except (urllib.error.URLError, ValueError) as e:
        print(f"{key}: Liquipedia — ошибка: {e}")
        meta["missing"] += ["liquipedia-lore", "liquipedia-hero"]
        data, ok = {}, False
    # redirects=1: в ответе страницы под конечными названиями, сопоставляем через normalized/redirects.
    q = data.get("query", {})
    renamed = {r["from"]: r["to"] for r in q.get("normalized", []) + q.get("redirects", [])}
    pages = {p.get("title"): p for p in q.get("pages", [])}
    for file, t in (("liquipedia-lore", titles[0]), ("liquipedia-hero", titles[1])):
        final = renamed.get(t, t)
        final = renamed.get(final, final)
        page = pages.get(final)
        revs = (page or {}).get("revisions") or []
        text = revs[0].get("slots", {}).get("main", {}).get("content") if revs else None
        if page is None or page.get("missing") or not text:
            if data:
                print(f"{key}: на Liquipedia нет страницы «{t}»")
            if file not in meta["missing"]:
                meta["missing"].append(file)
            continue
        (out / f"{file}.wiki").write_text(text, encoding="utf-8")
        meta["sources"][file] = {"url": page_url(final), "title": final}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    got = ", ".join(meta["sources"]) or "ничего"
    print(f"{key}: {got}" + (f"; нет: {', '.join(meta['missing'])}" if meta["missing"] else ""))
    return ok


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8")
    flags = {a for a in argv if a.startswith("--")}
    keys = [a for a in argv if not a.startswith("--")]
    unknown_flags = flags - {"--refresh", "--dry-run"}
    if unknown_flags or not keys:
        print(__doc__)
        return 2
    heroes = {h["key"]: h for h in json.loads(HEROES.read_text(encoding="utf-8"))["heroes"]}
    unknown = [k for k in keys if k not in heroes]
    if unknown:
        print(f"неизвестные ключи героев: {', '.join(unknown)} (см. research/e1/heroes.json)")
        return 2
    ok = True
    for k in keys:  # строго по очереди: запросы к Liquipedia не распараллеливаются
        ok = fetch_hero(heroes[k], refresh="--refresh" in flags, dry_run="--dry-run" in flags) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
