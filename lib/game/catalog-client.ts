"use client";

import type { CatalogPackDTO, CatalogWordDTO, RuntimeMode } from "@/types/game";
import { apiGet } from "@/lib/game/client-sync";

const ONLINE_PACK_KEY = "pantomin-online-catalog-v1";
let staticPackPromise: Promise<CatalogPackDTO> | null = null;

async function readStaticPack() {
  if (!staticPackPromise) {
    staticPackPromise = fetch("/data/catalog.json", { cache: "force-cache" }).then(async (response) => {
      if (!response.ok) throw new Error("بسته آفلاین بازی آماده نیست.");
      return response.json() as Promise<CatalogPackDTO>;
    });
  }
  return staticPackPromise;
}

export function readCachedOnlinePack(): CatalogPackDTO | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(ONLINE_PACK_KEY) || "null") as CatalogPackDTO | null; }
  catch { return null; }
}

export async function refreshOnlinePack() {
  const pack = await apiGet<CatalogPackDTO>("/api/catalog/pack");
  localStorage.setItem(ONLINE_PACK_KEY, JSON.stringify(pack));
  return pack;
}

export async function loadCatalogPack(mode: RuntimeMode): Promise<CatalogPackDTO> {
  if (mode === "local") return readStaticPack();
  const cached = readCachedOnlinePack();
  if (cached?.words?.length) return cached;
  return refreshOnlinePack();
}

export function pickCatalogWords(
  pack: CatalogPackDTO,
  activeCategoryIds: number[],
  categoryId: number | null,
  points: 2 | 4 | 6 | 30,
  usedWordIds: number[],
  count: number
): CatalogWordDTO[] {
  const used = new Set(usedWordIds);
  const candidates = pack.words.filter((word) => {
    if (used.has(word.id)) return false;
    if (points === 30) return activeCategoryIds.includes(word.categoryId) && word.points === 6;
    return word.categoryId === categoryId && word.points === points;
  });
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}
