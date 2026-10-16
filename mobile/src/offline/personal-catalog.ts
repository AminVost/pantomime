import type { CatalogPackDTO, CatalogWordDTO } from "@/types/game";

export const PERSONAL_CATALOG_KEY = "pantomin-personal-catalog-v1";
type PersonalCategory = { id: number; name: string };
type PersonalWord = { id: number; title: string; categoryId: number; points: 2 | 4 | 6 };
export type PersonalCatalog = { version: 1; nextId: number; categories: PersonalCategory[]; words: PersonalWord[] };
const empty = (): PersonalCatalog => ({ version: 1, nextId: -1, categories: [], words: [] });
export function normalizeTitle(text: string) {
  return text.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[\s\u200c]+/g, " ").trim().toLocaleLowerCase("fa");
}
function clean(text: string, max: number) {
  const value = text.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  if (normalizeTitle(value).length < 2 || value.length > max) throw new Error(`متن باید بین ۲ تا ${max} نویسه باشه.`);
  return value;
}
export function readPersonalCatalog(): PersonalCatalog {
  const raw = localStorage.getItem(PERSONAL_CATALOG_KEY);
  if (!raw) return empty();
  try {
    const data = JSON.parse(raw) as PersonalCatalog;
    if (data.version !== 1 || !Number.isSafeInteger(data.nextId) || data.nextId >= 0 || !Array.isArray(data.categories) || !Array.isArray(data.words)) throw new Error();
    const ids = new Set<number>();
    for (const item of [...data.categories, ...data.words]) {
      if (!Number.isSafeInteger(item.id) || item.id >= 0 || item.id <= data.nextId || ids.has(item.id)) throw new Error();
      ids.add(item.id);
    }
    for (const c of data.categories) clean(c.name, 40);
    for (const w of data.words) {
      clean(w.title, 100);
      if (![2, 4, 6].includes(w.points) || !Number.isSafeInteger(w.categoryId) || w.categoryId === 0 || (w.categoryId < 0 && !data.categories.some(c => c.id === w.categoryId))) throw new Error();
    }
    return data;
  } catch { throw new Error("کلمات شخصی قابل خواندن نیستند؛ اطلاعات قبلی حفظ شده."); }
}
function save(data: PersonalCatalog) {
  try { localStorage.setItem(PERSONAL_CATALOG_KEY, JSON.stringify(data)); }
  catch { throw new Error("ذخیره انجام نشد؛ فضای ذخیره‌سازی گوشی رو بررسی کن."); }
  return data;
}
export function mergePersonalCatalog(base: CatalogPackDTO, personal: PersonalCatalog): CatalogPackDTO {
  const categories = [...base.categories.map(c => ({ ...c })), ...personal.categories.map(c => ({ ...c, slug: `personal-${-c.id}`, icon: "✦", counts: { points2: 0, points4: 0, points6: 0 } }))];
  const names = new Map(categories.map(c => [c.id, c.name]));
  const words: CatalogWordDTO[] = [...base.words, ...personal.words.filter(w => names.has(w.categoryId)).map(w => ({ ...w, categoryName: names.get(w.categoryId)! }))];
  const counts = new Map(categories.map(c => [c.id, { points2: 0, points4: 0, points6: 0 }]));
  for (const w of words) counts.get(w.categoryId)![`points${w.points}`] += 1;
  return { ...base, words, categories: categories.map(c => ({ ...c, counts: counts.get(c.id)! })) };
}
export function addPersonalCategory(base: CatalogPackDTO, name: string) {
  const data = readPersonalCatalog();
  const title = clean(name, 40);
  if (mergePersonalCatalog(base, data).categories.some(c => normalizeTitle(c.name) === normalizeTitle(title))) throw new Error("این موضوع قبلاً وجود داره.");
  if (data.categories.length >= 200) throw new Error("حداکثر ۲۰۰ موضوع شخصی می‌تونی داشته باشی.");
  const category = { id: data.nextId--, name: title };
  data.categories.push(category);
  save(data);
  return category;
}
export function addPersonalWords(base: CatalogPackDTO, categoryId: number, text: string, points: 2 | 4 | 6) {
  const data = readPersonalCatalog();
  const pack = mergePersonalCatalog(base, data);
  if (!pack.categories.some(c => c.id === categoryId) || ![2, 4, 6].includes(points)) throw new Error("موضوع و امتیاز رو انتخاب کن.");
  const titles = text.split(/\r?\n/).filter(t => t.trim()).map(t => clean(t, 100));
  if (!titles.length) throw new Error("حداقل یک کلمه بنویس.");
  if (data.words.length + titles.length > 5000) throw new Error("حداکثر ۵۰۰۰ کلمه شخصی می‌تونی داشته باشی.");
  const seen = new Set(pack.words.filter(w => w.categoryId === categoryId).map(w => normalizeTitle(w.title)));
  for (const title of titles) {
    const key = normalizeTitle(title);
    if (seen.has(key)) throw new Error(`«${title}» در این موضوع تکراریه؛ فهرست رو اصلاح کن.`);
    seen.add(key);
  }
  data.words.push(...titles.map(title => ({ id: data.nextId--, categoryId, title, points })));
  save(data);
  return titles.length;
}
export function hasSavedActiveGame() {
  try {
    const snapshot = JSON.parse(localStorage.getItem("pantomin-active-game-v1") || "null");
    return snapshot?.game?.status === "ACTIVE";
  } catch { return true; }
}
function allowDestructiveChange() {
  if (hasSavedActiveGame()) throw new Error("ویرایش و حذف بعد از پایان بازی فعلی در دسترسه؛ افزودن کلمه آزاده.");
}
export function deletePersonalItem(kind: "word" | "category", id: number) {
  allowDestructiveChange();
  const data = readPersonalCatalog();
  if (kind === "word") data.words = data.words.filter(w => w.id !== id);
  else {
    data.categories = data.categories.filter(c => c.id !== id);
    data.words = data.words.filter(w => w.categoryId !== id);
  }
  return save(data);
}
export function editPersonalWord(base: CatalogPackDTO, id: number, title: string, points: 2 | 4 | 6) {
  allowDestructiveChange();
  const data = readPersonalCatalog();
  const word = data.words.find(w => w.id === id);
  if (!word || ![2, 4, 6].includes(points)) throw new Error("کلمه پیدا نشد.");
  const value = clean(title, 100);
  if (mergePersonalCatalog(base, data).words.some(w => w.id !== id && w.categoryId === word.categoryId && normalizeTitle(w.title) === normalizeTitle(value))) throw new Error("این کلمه در این موضوع تکراریه.");
  word.title = value;
  word.points = points;
  return save(data);
}
