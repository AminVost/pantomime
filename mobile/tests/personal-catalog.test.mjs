import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/offline/personal-catalog.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const catalog = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const base = JSON.parse(readFileSync(new URL("../public/data/catalog.json", import.meta.url), "utf8"));
let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
});
test("personal catalog merges with bundled words without mutation or id collisions", () => {
  const before = JSON.stringify(base);
  const c = catalog.addPersonalCategory(base, "خاطره‌های ما");
  assert.ok(c.id < 0);
  assert.equal(catalog.addPersonalWords(base, c.id, "دوچرخه بازی\nباز کردن هدیه", 2), 2);
  catalog.addPersonalWords(base, base.categories[0].id, "تمرین ویژه دوستان", 6);
  const pack = catalog.mergePersonalCatalog(base, catalog.readPersonalCatalog());
  assert.equal(pack.words.length, base.words.length + 3);
  assert.equal(pack.categories.find(item => item.id === c.id).counts.points2, 2);
  assert.equal(new Set(pack.words.map(w => w.id)).size, pack.words.length);
  assert.equal(JSON.stringify(base), before);
});
test("Persian normalization rejects cross-difficulty and batch duplicates atomically", () => {
  const c = catalog.addPersonalCategory(base, "یادگاری");
  assert.throws(() => catalog.addPersonalCategory(base, "يادگاري"), /قبلاً/);
  catalog.addPersonalWords(base, c.id, "كودك شاد", 2);
  assert.throws(() => catalog.addPersonalWords(base, c.id, "یک کلمه تازه\nکودک شاد", 6), /تکراری/);
  assert.equal(catalog.readPersonalCatalog().words.length, 1);
  assert.throws(() => catalog.addPersonalWords(base, c.id, "آب بازی\nآب‌بازی", 4), /تکراری/);
  assert.throws(() => catalog.addPersonalWords(base, c.id, "کلمه", 30), /امتیاز/);
});
test("edit keeps word identity; deletion cascades and never recycles ids", () => {
  const c = catalog.addPersonalCategory(base, "دوستان من");
  catalog.addPersonalWords(base, c.id, "بازی با توپ", 2);
  const id = catalog.readPersonalCatalog().words[0].id;
  catalog.editPersonalWord(base, id, "بازی با بادکنک", 4);
  assert.equal(catalog.readPersonalCatalog().words[0].id, id);
  catalog.deletePersonalItem("category", c.id);
  assert.equal(catalog.readPersonalCatalog().words.length, 0);
  const next = catalog.addPersonalCategory(base, "دوستان تازه");
  assert.ok(next.id < id);
});
test("active snapshot protects edits/deletions while allowing additions", () => {
  const c = catalog.addPersonalCategory(base, "داستان ما");
  catalog.addPersonalWords(base, c.id, "پرواز با بادکنک", 6);
  storage.set("pantomin-active-game-v1", JSON.stringify({ game: { status: "ACTIVE" } }));
  const id = catalog.readPersonalCatalog().words[0].id;
  assert.throws(() => catalog.deletePersonalItem("category", c.id), /پایان/);
  assert.throws(() => catalog.editPersonalWord(base, id, "کلمه تازه", 4), /پایان/);
  catalog.addPersonalWords(base, c.id, "دویدن در باران", 2);
  assert.equal(catalog.readPersonalCatalog().words.length, 2);
});
test("invalid content and storage failures preserve the prior library", () => {
  assert.throws(() => catalog.addPersonalCategory(base, " "));
  const c = catalog.addPersonalCategory(base, "موضوع تازه");
  const before = storage.get(catalog.PERSONAL_CATALOG_KEY);
  localStorage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => catalog.addPersonalWords(base, c.id, "کلمه تازه", 2), /فضای/);
  assert.equal(storage.get(catalog.PERSONAL_CATALOG_KEY), before);
  storage.set(catalog.PERSONAL_CATALOG_KEY, '{"version":2}');
  assert.throws(() => catalog.readPersonalCatalog(), /حفظ/);
  assert.equal(storage.get(catalog.PERSONAL_CATALOG_KEY), '{"version":2}');
});
