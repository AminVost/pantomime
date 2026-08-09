import { prisma } from "@/lib/db/prisma";
import { releaseWordsSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await context.params;
    const parsed = releaseWordsSchema.safeParse(await request.json());
    if (!parsed.success) return fail("لیست کلمه‌ها معتبر نیست.", 422);

    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
    if (!game) return fail("بازی پیدا نشد.", 404);

    const wordIds = [...new Set(parsed.data.wordIds)];
    const released = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const wordId of wordIds) {
        const deleted = await tx.gameUsedWord.deleteMany({
          where: { gameId, wordId, shownAt: null }
        });
        if (!deleted.count) continue;

        await tx.word.updateMany({
          where: { id: wordId, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } }
        });
        count += 1;
      }
      return count;
    });

    return ok({ released });
  } catch (error) {
    console.error(error);
    return fail("آزادسازی کلمه‌های استفاده‌نشده انجام نشد.", 500);
  }
}
