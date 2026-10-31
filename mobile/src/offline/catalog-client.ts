import type { CatalogPackDTO, CatalogWordDTO, RuntimeMode } from "@/types/game";
import { mergePersonalCatalog, readPersonalCatalog } from "./personal-catalog";
let promise: Promise<CatalogPackDTO> | undefined;
export function readCachedOnlinePack(): CatalogPackDTO | null { return null; }
export function loadBundledCatalogPack(): Promise<CatalogPackDTO> {
  if (!promise) {
    promise = fetch("/data/catalog.json", { cache: "force-cache" }).then(async response => {
      if (!response.ok) throw new Error("کلمات بازی در دسترس نیستند.");
      const pack: CatalogPackDTO = await response.json();
      if (!pack.categories?.length || !pack.words?.length) throw new Error("کاتالوگ بازی نامعتبر است.");
      return pack;
    }).catch((error: unknown) => {
      promise = undefined;
      throw error;
    });
  }
  return promise;
}
export function loadCatalogPack(_mode?: RuntimeMode): Promise<CatalogPackDTO> {
  return loadBundledCatalogPack().then(pack => {
    try { return mergePersonalCatalog(pack, readPersonalCatalog()); }
    catch { return pack; } // A damaged personal library must not prevent bundled gameplay.
  });
}
export function refreshOnlinePack(): Promise<CatalogPackDTO> { return loadCatalogPack("local"); }
export function pickCatalogWords(
  pack: CatalogPackDTO, activeCategoryIds: number[], categoryId: number | null,
  points: 2 | 4 | 6 | 30, usedWordIds: number[], count: number
): CatalogWordDTO[] {
  const used = new Set(usedWordIds);
  const allowed = new Set(activeCategoryIds);
  const candidates = pack.words.filter(word => {
    if (used.has(word.id)) return false;
    return points === 30 ? allowed.has(word.categoryId) && word.points === 6
      : word.categoryId === categoryId && word.points === points;
  });
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, Math.max(0, count));
}
