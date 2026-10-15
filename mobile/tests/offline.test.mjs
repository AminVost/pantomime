import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mobile = resolve(import.meta.dirname, "..");
const load = path => readFileSync(resolve(mobile, path), "utf8");
const pack = JSON.parse(load("public/data/catalog.json"));

test("expanded offline catalog: categories, words and ids", () => {
  assert.ok(pack.categories.length >= 33, String(pack.categories.length));
  assert.ok(pack.words.length >= 740, String(pack.words.length));
  assert.equal(new Set(pack.categories.map(c => c.id)).size, pack.categories.length);
  assert.equal(new Set(pack.categories.map(c => c.slug)).size, pack.categories.length);
  assert.equal(new Set(pack.words.map(w => w.id)).size, pack.words.length);
});
test("catalog validation, difficulty and exact category counts", () => {
  const ids = new Set(pack.categories.map(c => c.id));
  const used = new Set();
  for (const w of pack.words) {
    assert.ok(ids.has(w.categoryId));
    assert.ok([2,4,6].includes(w.points));
    assert.ok(w.title.trim().length > 1);
    const key = w.categoryId + ":" + w.title.normalize("NFKC").trim();
    assert.ok(!used.has(key), key);
    used.add(key);
  }
  for (const c of pack.categories) for (const points of [2,4,6]) {
    assert.equal(c.counts["points"+points], pack.words.filter(w=>w.categoryId===c.id&&w.points===points).length, c.slug);
    assert.ok(c.counts["points"+points] >= 5, c.slug);
  }
});
test("new and resumed games are strictly offline and preserve UX", () => {
  const code = load("generated/components/game/GameApp.tsx");
  assert.ok(code.includes('setRuntimeMode("local");'));
  assert.ok(code.includes('const restoredMode: RuntimeMode = "local";'));
  assert.ok(code.includes('void loadCategories("local");'));
  assert.ok(!code.includes('onClick={() => setRuntimeMode("online")}'));
  assert.ok(code.includes("pantomime:native-back"));
  assert.ok(!load("generated/lib/game/client-sync.ts").includes("fetch("));
});
test("RTL and native app id", () => {
  assert.ok(load("index.html").includes('dir="rtl"'));
  assert.ok(load("capacitor.config.ts").includes("ir.aminvost.pantomime"));
});
