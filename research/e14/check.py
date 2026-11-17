"""Машинная проверка файлов героев E14 и слияние в данные карты (#45, флоу партии — #44).

Файл героя — research/e14/heroes/<key>.json по шаблону research/e14/template.json, правила —
research/e14/README.md и docs/ARCHITECTURE.md §A3. Модель связей (links, path, relations, profile) проверяет
scripts/build-data.mjs --check-hero — строже, чем hero-places.json (url у liquipedia, note у ours); здесь — поля файла:
  - обязательны read (что прочитано, минимум обе биографии) и profile.summary;
  - если источники героя есть в кэше (research/e14/fetch.py), тексты исследователя — summary, note, doubt,
    unconfirmed — не должны повторять источник 8 словами подряд (тексты пишем своими словами).

Запуск из корня репозитория:
  python research/e14/check.py                  все файлы research/e14/heroes/*.json
  python research/e14/check.py <key> ...        только эти герои
  python research/e14/check.py --merge <key> ...  проверить и слить в research/e1/hero-places.json
                                                 и research/e1/place-candidates.json (запись героя заменяется целиком)
Код выхода 1 — есть ошибки (при --merge тогда ничего не записывается). Нужен node.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
E1 = ROOT / "research" / "e1"
sys.path.insert(0, str(E1))
import build  # noqa: E402  (research/e1/build.py — справочники и правила кандидатов в места)

BUILD_DATA = ROOT / "scripts" / "build-data.mjs"
HEROES_DIR = HERE / "heroes"
CACHE = HERE / "cache"
READ = ("bio.ru", "bio.en", "liquipedia-lore", "liquipedia-hero")
REQUIRED_READ = ("bio.ru", "bio.en")
ENTRY = ("links", "path", "relations", "profile")
SHINGLE = 8
WORD = re.compile(r"[0-9A-Za-zА-Яа-яЁё']+")


def words(text):
    return [w.lower().replace("ё", "е") for w in WORD.findall(text)]


def shingles(text, n=SHINGLE):
    w = words(text)
    return {" ".join(w[i:i + n]) for i in range(len(w) - n + 1)}


def source_shingles(key, cache=CACHE):
    """8-словные фрагменты всех источников героя из кэша (нет кэша — пусто)."""
    folder = cache / key
    out = set()
    if folder.is_dir():
        for f in sorted(folder.iterdir()):
            if f.suffix in (".txt", ".wiki"):
                out |= shingles(f.read_text(encoding="utf-8"))
    return out


def own_texts(data):
    """Тексты, которые пишет исследователь: (где, текст)."""
    out = []
    summary = (data.get("profile") or {}).get("summary")
    if isinstance(summary, dict):
        out += [(f"profile.summary.{k}", v) for k, v in summary.items() if isinstance(v, str)]
    for group in ("links", "relations", "candidates"):
        for i, rec in enumerate(data.get(group) or []):
            if isinstance(rec, dict):
                out += [(f"{group}[{i}].{k}", rec[k]) for k in ("note", "doubt") if isinstance(rec.get(k), str)]
    for i, t in enumerate(data.get("unconfirmed") or []):
        if isinstance(t, str):
            out.append((f"unconfirmed[{i}]", t))
    return out


def node_check(args, root=ROOT):
    """build-data.mjs в режиме проверки: ошибки — строки stdout."""
    r = subprocess.run(["node", str(BUILD_DATA), "--root", str(root), *args],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode not in (0, 1):
        return [f"build-data.mjs: {(r.stderr or r.stdout).strip() or 'сбой'}"]
    return [line for line in r.stdout.splitlines() if line.strip()]


def model_errors(files, root=ROOT):
    """Ошибки модели связей файлов героев {key: data} — scripts/build-data.mjs --check-hero (один вызов node)."""
    if not files:
        return []
    with tempfile.TemporaryDirectory() as d:
        paths = []
        for key, data in files.items():
            path = Path(d) / f"{key}.json"
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            paths.append(str(path))
        return node_check(["--check-hero", *paths], root)


def merged_errors(places, candidates, ctx, root=ROOT):
    """Ошибки данных после слияния: мир целиком — build-data.mjs --check, кандидаты — build.py."""
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "hero-places.json"
        path.write_text(json.dumps(places, ensure_ascii=False), encoding="utf-8")
        errors = node_check(["--check", "--hero-places", str(path)], root)
    return errors + build.validate_candidates(candidates, ctx)


def check_hero_file(key, data, ctx, cache=CACHE, model=None, root=ROOT):
    """Ошибки файла героя E14. key — имя файла без .json; model — уже посчитанные ошибки модели связей
    (нет — вызвать build-data.mjs для этого файла)."""
    where = f"heroes/{key}.json"
    if not isinstance(data, dict):
        return [f"{where}: ожидается объект"]
    errors = []
    if data.get("hero") != key:
        errors.append(f"{where}: hero должен совпадать с именем файла ({key})")
    if key not in ctx.hero_keys:
        errors.append(f"{where}: героя {key} нет в research/e1/heroes.json")
    read = data.get("read")
    if not isinstance(read, list) or not all(isinstance(r, str) for r in read):
        errors.append(f"{where}: read — список прочитанных источников ({', '.join(READ)}, comic:<id>)")
    else:
        for r in read:
            if r not in READ and not (r.startswith("comic:") and r[6:] in ctx.media):
                errors.append(f"{where}: read — неизвестный источник {r!r}")
        for r in REQUIRED_READ:
            if r not in read:
                errors.append(f"{where}: read — нужно прочитать {r}")
    errors += model if model is not None else model_errors({key: data}, root)
    if not (data.get("profile") or {}).get("summary"):
        errors.append(f"{where}: нужен profile.summary — короткое описание RU/EN своими словами")
    for rel in data.get("relations") or []:
        if isinstance(rel, dict) and rel.get("hero") == key:
            errors.append(f"{where}: связь героя с самим собой")
    cands = data.get("candidates", [])
    if not isinstance(cands, list):
        errors.append(f"{where}: candidates — список")
        cands = []
    for i, c in enumerate(cands):
        if isinstance(c, dict) and "hero" in c:
            errors.append(f"{where}: candidates[{i}]: hero не пишем — это герой файла")
            continue
        errors += build.validate_candidate(c, f"{where}: candidates[{i}]", ctx)
    unconfirmed = data.get("unconfirmed", [])
    if not isinstance(unconfirmed, list) or not all(build.is_text(t) for t in unconfirmed):
        errors.append(f"{where}: unconfirmed — список непустых строк")
    src = source_shingles(key, cache)
    if src:
        for field, text in own_texts(data):
            hit = shingles(text) & src
            if hit:
                errors.append(f"{where}: {field} повторяет источник {SHINGLE} словами подряд "
                              f"(«{sorted(hit)[0]}») — перескажите своими словами")
    return errors


def entry_of(data):
    return {k: data[k] for k in ENTRY if k in data}


def merge(keys, files, places, candidates, name_of):
    """Новые hero-places и place-candidates: запись героя заменяется целиком, его кандидаты — тоже."""
    heroes = dict(places["heroes"])
    for key in keys:
        heroes[name_of[key]] = entry_of(files[key])
    rest = [c for c in candidates.get("candidates", []) if c.get("hero") not in set(keys)]
    added = [{"name": c["name"], "hero": key, **{k: v for k, v in c.items() if k != "name"}}
             for key in keys for c in files[key].get("candidates", [])]
    return {**places, "heroes": heroes}, {**candidates, "candidates": rest + added}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8")
    do_merge = "--merge" in argv
    keys = [a for a in argv if not a.startswith("--")]
    if set(a for a in argv if a.startswith("--")) - {"--merge"} or (do_merge and not keys):
        print(__doc__)
        return 2
    if not keys:
        keys = sorted(p.stem for p in HEROES_DIR.glob("*.json"))
    heroes, regions = build.load("heroes.json"), build.load("regions.json")
    ctx = build.Ctx(heroes, regions, build.media_ids())
    files, errors, read_errors = {}, [], []
    for key in keys:
        path = HEROES_DIR / f"{key}.json"
        if not path.exists():
            read_errors.append(f"heroes/{key}.json: файла нет")
            continue
        try:
            files[key] = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as e:
            read_errors.append(f"heroes/{key}.json: не JSON — {e}")
    model = model_errors(files)
    errors = read_errors
    for key, data in files.items():
        own = [e for e in model if e.startswith(f"heroes/{key}.json:")]
        errors += check_hero_file(key, data, ctx, model=own)
    errors += [e for e in model if not any(e.startswith(f"heroes/{k}.json:") for k in files)]
    if not errors and do_merge:
        places = build.load("hero-places.json")
        candidates = build.load_optional(E1 / "place-candidates.json", {"candidates": []})
        name_of = {h["key"]: h["name"] for h in heroes["heroes"]}
        places, candidates = merge(keys, files, places, candidates, name_of)
        errors += [f"после слияния: {e}" for e in merged_errors(places, candidates, ctx)]
        if not errors:
            write_json(E1 / "hero-places.json", places)
            write_json(E1 / "place-candidates.json", candidates)
            print(f"слито: {', '.join(keys)} → research/e1/hero-places.json, place-candidates.json "
                  f"(дальше: python research/e1/build.py и npm run data)")
    if errors:
        print("ОШИБКИ:\n" + "\n".join(f"  - {e}" for e in errors))
        return 1
    print(f"OK: {len(files)} файлов героев")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
