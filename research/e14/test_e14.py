"""Тесты модели связей E14: research/e1/build.py, research/e14/check.py, research/e14/fetch.py (без сети).

Запуск из корня репозитория: python research/e14/test_e14.py   (входит в npm run check)
"""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "research" / "e1"))
sys.path.insert(0, str(HERE))
import build  # noqa: E402
import check  # noqa: E402
import fetch  # noqa: E402

HEROES = {"heroes": [
    {"id": 1, "key": "crystal_maiden", "name": "Crystal Maiden"},
    {"id": 2, "key": "lina", "name": "Lina"},
    {"id": 3, "key": "witch_doctor", "name": "Witch Doctor"},
]}
REGIONS = {"regions": [
    {"id": "icewrack", "tier": "continent", "side": "radiant", "sideBasis": "position", "ru": "Айсрак",
     "en": "Icewrack", "geo": "", "locations": [
         {"name": "Icewrack", "placement": "lore", "capital": True},
         {"name": "Blueheart Glacier", "placement": "lore"}]},
    {"id": "misrule", "tier": "continent", "side": "dire", "sideBasis": "position", "ru": "Мисрул",
     "en": "Misrule", "geo": "", "locations": [{"name": "Misrule", "placement": "lore"}]},
    {"id": "uncharted", "tier": "continent", "side": "neutral", "sideBasis": "position", "ru": "Неизведанные",
     "en": "Uncharted", "geo": "", "locations": []},
]}
MEDIA = {"ice-comic"}
L = {"ru": "Короткий рассказ о герое.", "en": "A short note about the hero."}


def ctx():
    return build.Ctx(HEROES, REGIONS, MEDIA)


def places():
    return {"heroes": {
        "Crystal Maiden": {"links": [{"place": "Blueheart Glacier", "event": "origin", "source": "bio"},
                                     {"region": "icewrack", "event": "link", "source": "ours"}]},
        "Lina": {"links": [{"place": "Misrule", "event": "origin", "source": "liquipedia", "via": "infobox"}]},
        "Witch Doctor": {"links": [{"region": "uncharted", "event": "origin", "source": "ours", "note": "нет мест"}]},
    }}


def hero_file():
    return {
        "hero": "witch_doctor",
        "read": ["bio.ru", "bio.en", "liquipedia-lore"],
        "links": [
            {"region": "uncharted", "event": "origin", "source": "ours", "note": "родина — кандидат Arktura"},
            {"place": "Misrule", "event": "battle", "source": "liquipedia", "via": "lore",
             "url": "https://liquipedia.net/dota2/Witch_Doctor/Lore", "doubt": "по пересказу"},
        ],
        "path": [{"region": "uncharted"}, {"place": "Misrule"}],
        "relations": [{"hero": "lina", "type": "ally", "source": "comic:ice-comic"}],
        "profile": {"summary": dict(L)},
        "candidates": [{"name": "Arktura", "region": "uncharted", "event": "origin", "source": "bio",
                        "note": "островные нагорья, регион неясен"}],
        "unconfirmed": [],
    }


def errors_of(entry, strict=False):
    return "\n".join(build.validate_hero_entry("X", entry, ctx(), strict))


class HeroEntry(unittest.TestCase):
    def test_migrated_shape_is_valid(self):
        errors, _ = build.validate(HEROES, REGIONS, places(), {"candidates": []}, MEDIA)
        self.assertEqual(errors, [])

    def test_full_entry_is_valid(self):
        entry = check.entry_of(hero_file())
        self.assertEqual(build.validate_hero_entry("X", entry, ctx()), [])

    def test_errors(self):
        base = {"links": [{"place": "Icewrack", "event": "home", "source": "bio"}]}
        cases = [
            ({"links": [{"place": "Icewrack", "event": "moved", "source": "bio"}]}, "event"),
            ({"links": [{"place": "Icewrack", "event": "home", "source": "wiki"}]}, "source"),
            ({"links": [{"place": "Icewrack", "event": "home", "source": "comic:nope"}]}, "неизвестное медиа"),
            ({"links": [{"place": "Icewrack", "event": "home", "source": "bio", "via": "lore"}]}, "via"),
            ({"links": [{"place": "Icewrack", "event": "home", "source": "liquipedia",
                         "url": "https://dota2.fandom.com/x"}]}, "url Liquipedia"),
            ({"links": [{"place": "Icewrack", "region": "icewrack", "event": "home", "source": "bio"}]}, "ровно одно"),
            ({"links": [{"place": "Nowhere", "event": "home", "source": "bio"}]}, "неизвестное место"),
            ({"links": [{"place": "Icewrack", "event": "home", "source": "bio", "role": "origin"}]}, "неизвестный ключ"),
            ({"links": [{"place": "Icewrack", "event": "home", "source": "bio"},
                        {"place": "Icewrack", "event": "battle", "source": "bio"}]}, "одно место"),
            ({"links": [{"region": "uncharted", "event": "origin", "source": "ours"}]}, "заметка note"),
            ({"links": []}, "пустой список"),
            ({**base, "path": [{"place": "Icewrack"}]}, "2 и больше"),
            ({**base, "path": [{"place": "Icewrack"}, {"place": "Misrule"}]}, "нет в links"),
            ({"links": base["links"] + [{"place": "Misrule", "event": "mention", "source": "bio"}],
              "path": [{"place": "Icewrack"}, {"place": "Misrule"}]}, "mention"),
            ({"links": base["links"] + [{"place": "Misrule", "event": "visit", "source": "bio"}],
              "path": [{"place": "Icewrack"}, {"place": "Icewrack"}, {"place": "Misrule"}]}, "повторяет"),
            ({**base, "relations": [{"hero": "Lina", "type": "ally", "source": "bio"}]}, "нужен key"),
            ({**base, "relations": [{"hero": "lina", "type": "friend", "source": "bio"}]}, "type"),
            ({**base, "relations": [{"hero": "lina", "type": "ally", "source": "bio"}] * 2}, "повторяется"),
            ({**base, "profile": {"summary": {"ru": "Да", "en": "Да"}}}, "кириллица"),
            ({**base, "profile": {"summary": {"ru": "я" * 501, "en": "x"}}}, "длиннее"),
            ({**base, "profile": {"art": ["https://dota2.fandom.com/a.png"]}}, "Valve"),
            ({**base, "extra": 1}, "неизвестный ключ"),
        ]
        for entry, message in cases:
            with self.subTest(message=message):
                self.assertIn(message, errors_of(entry))

    def test_strict_rules(self):
        self.assertIn("event link", errors_of({"links": [{"place": "Icewrack", "event": "link", "source": "bio"}]}, True))
        self.assertIn("нужна ссылка url", errors_of(
            {"links": [{"place": "Icewrack", "event": "home", "source": "liquipedia", "via": "lore"}]}, True))
        self.assertIn("ours нужна заметка", errors_of(
            {"links": [{"place": "Icewrack", "event": "home", "source": "ours"}]}, True))
        self.assertEqual(errors_of({"links": [{"place": "Icewrack", "event": "link", "source": "ours"}]}), "")

    def test_relation_pairs(self):
        p = places()
        p["heroes"]["Lina"]["relations"] = [{"hero": "crystal_maiden", "type": "mentor", "source": "ours"}]
        p["heroes"]["Crystal Maiden"]["relations"] = [{"hero": "lina", "type": "mentor", "source": "ours"}]
        errors, _ = build.validate(HEROES, REGIONS, p, None, MEDIA)
        self.assertEqual(len(errors), 1)
        self.assertIn("student", errors[0])
        p["heroes"]["Crystal Maiden"]["relations"][0]["type"] = "student"
        self.assertEqual(build.validate(HEROES, REGIONS, p, None, MEDIA)[0], [])

    def test_candidates(self):
        good = {"name": "Arktura", "hero": "witch_doctor", "region": "uncharted", "event": "origin", "source": "bio"}
        self.assertEqual(build.validate(HEROES, REGIONS, places(), {"candidates": [good]}, MEDIA)[0], [])
        cases = [
            ({**good, "name": "blueheart  glacier"}, "уже есть на схеме"),
            ({**good, "region": "atlantis"}, "region"),
            ({**good, "event": "link"}, "event"),
            ({**good, "hero": "nobody"}, "неизвестный герой"),
            ({k: v for k, v in good.items() if k != "hero"}, "hero"),
        ]
        for cand, message in cases:
            with self.subTest(message=message):
                errors, _ = build.validate(HEROES, REGIONS, places(), {"candidates": [cand]}, MEDIA)
                self.assertIn(message, "\n".join(errors))
        errors, _ = build.validate(HEROES, REGIONS, places(), {"candidates": [good, good]}, MEDIA)
        self.assertIn("уже записан", "\n".join(errors))

    def test_render_marks_match_e1(self):
        self.assertEqual(build.mark({"source": "liquipedia", "via": "place"}), "†")
        self.assertEqual(build.mark({"source": "ours"}), "*")
        self.assertEqual(build.mark({"source": "liquipedia", "via": "infobox"}), "")
        self.assertEqual(build.hero_tag("Lina", {"event": "home", "source": "bio"}), "Lina (живёт)")


class HeroFile(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def errors(self, data, key="witch_doctor"):
        return "\n".join(check.check_hero_file(key, data, ctx(), self.cache))

    def test_valid_file(self):
        self.assertEqual(self.errors(hero_file()), "")

    def test_file_rules(self):
        cases = [
            (lambda d: d.update(hero="lina"), "именем файла"),
            (lambda d: d.update(read=["bio.en"]), "нужно прочитать bio.ru"),
            (lambda d: d.update(read=["bio.ru", "bio.en", "fandom"]), "неизвестный источник"),
            (lambda d: d.pop("profile"), "profile.summary"),
            (lambda d: d["relations"].append({"hero": "witch_doctor", "type": "ally", "source": "bio"}), "самим собой"),
            (lambda d: d["candidates"][0].update(hero="lina"), "hero не пишем"),
            (lambda d: d["candidates"][0].update(name="Misrule"), "уже есть на схеме"),
            (lambda d: d.update(unconfirmed=[""]), "unconfirmed"),
            (lambda d: d["links"][1].pop("url"), "нужна ссылка url"),
        ]
        for change, message in cases:
            with self.subTest(message=message):
                d = hero_file()
                change(d)
                self.assertIn(message, self.errors(d))
        self.assertIn("нет в research/e1/heroes.json", self.errors({**hero_file(), "hero": "nobody"}, "nobody"))

    def test_copy_detection(self):
        folder = self.cache / "witch_doctor"
        folder.mkdir()
        (folder / "bio.en.txt").write_text(
            "It is a body of magical knowledge learned and perfected over several lifetimes in the highlands.",
            encoding="utf-8")
        d = hero_file()
        self.assertEqual(self.errors(d), "")
        d["profile"]["summary"]["en"] = "His craft is a body of Magical knowledge, learned and perfected over many years."
        self.assertIn("повторяет источник", self.errors(d))
        d = hero_file()
        d["unconfirmed"] = ["knowledge learned and perfected over several lifetimes in the highlands"]
        self.assertIn("unconfirmed[0]", self.errors(d))

    def test_merge(self):
        p = places()
        cands = {"note": "n", "candidates": [
            {"name": "Old", "hero": "witch_doctor", "region": "uncharted", "event": "origin", "source": "bio"},
            {"name": "Keep", "hero": "lina", "region": "misrule", "event": "visit", "source": "bio"}]}
        name_of = {h["key"]: h["name"] for h in HEROES["heroes"]}
        new_p, new_c = check.merge(["witch_doctor"], {"witch_doctor": hero_file()}, p, cands, name_of)
        wd = new_p["heroes"]["Witch Doctor"]
        self.assertEqual(set(wd), {"links", "path", "relations", "profile"})
        self.assertEqual(list(new_p["heroes"]), list(p["heroes"]))
        self.assertEqual([c["name"] for c in new_c["candidates"]], ["Keep", "Arktura"])
        self.assertEqual(new_c["candidates"][1]["hero"], "witch_doctor")
        self.assertEqual(new_c["note"], "n")
        self.assertEqual(build.validate(HEROES, REGIONS, new_p, new_c, MEDIA)[0], [])
        self.assertEqual(p, places(), "вход не меняется")

    def test_template_documents_every_field(self):
        t = json.loads((HERE / "template.json").read_text(encoding="utf-8"))
        self.assertEqual(set(t), set(check.ENTRY) | {"hero", "read", "candidates", "unconfirmed"})
        self.assertEqual(set().union(*(set(l) for l in t["links"])), build.LINK_KEYS)
        self.assertEqual(set().union(*(set(r) for r in t["relations"])) | {"region", "via", "url"},
                         build.RELATION_KEYS)
        self.assertEqual(set(t["profile"]), build.PROFILE_KEYS)
        self.assertEqual(set(t["read"]), set(check.READ))
        for link in t["links"]:
            self.assertIn(link["event"], build.EVENTS)


class Fetch(unittest.TestCase):
    def test_polite_client(self):
        self.assertEqual(fetch.USER_AGENT, "DotaLoreMapResearch/0.1 (non-commercial fan project)")
        self.assertGreaterEqual(fetch.PAUSE, 2)
        self.assertEqual(fetch.LIQUIPEDIA_API, "https://liquipedia.net/dota2/api.php")
        self.assertTrue(fetch.liquipedia_url(["Lina/Lore", "Lina"]).startswith(fetch.LIQUIPEDIA_API + "?action=query"))

    def test_urls(self):
        self.assertEqual(fetch.dota2_url(30, "ru"),
                         "https://www.dota2.com/datafeed/herodata?language=russian&hero_id=30")
        self.assertEqual(fetch.page_url("Nature's Prophet/Lore"), "https://liquipedia.net/dota2/Nature's_Prophet/Lore")

    def test_bio_parsing(self):
        data = {"result": {"data": {"heroes": [{"id": 30, "bio_loc": "One<br>Two &amp; three<br/><br/><b>x</b>"}]}}}
        self.assertEqual(fetch.strip_markup(fetch.find_bio(data)), "One\nTwo & three\n\nx\n")
        self.assertIsNone(fetch.find_bio({"result": {}}))

    def test_cache_is_ignored(self):
        gitignore = (HERE.parents[1] / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("research/e14/cache/", gitignore.splitlines())


class RepoData(unittest.TestCase):
    def test_repository_data_valid(self):
        heroes, regions, p = build.load("heroes.json"), build.load("regions.json"), build.load("hero-places.json")
        cands = build.load_optional(build.HERE / "place-candidates.json", {"candidates": []})
        errors, _ = build.validate(heroes, regions, p, cands)
        self.assertEqual(errors, [])
        for name, entry in p["heroes"].items():
            for link in entry["links"]:
                self.assertNotIn("role", link, name)
                self.assertNotIn("basis", link, name)

    def test_hero_files_pass_check(self):
        self.assertEqual(check.main([]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
