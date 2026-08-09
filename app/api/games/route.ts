import { GameStatus, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createGameSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

export async function POST(request: Request) {
  try {
    const parsed = createGameSchema.safeParse(await request.json());
    if (!parsed.success) return fail("تنظیمات بازی کامل نیست.", 422, parsed.error.flatten());

    const input = parsed.data;
    const uniqueCategoryIds = [...new Set(input.categoryIds)];
    const validCategoryCount = await prisma.category.count({
      where: { id: { in: uniqueCategoryIds }, status: RecordStatus.ACTIVE }
    });
    if (validCategoryCount !== uniqueCategoryIds.length) {
      return fail("یکی از دسته‌بندی‌ها دیگه قابل استفاده نیست.", 409);
    }

    const playableCombinations = await prisma.word.groupBy({
      by: ["categoryId", "points"],
      where: { categoryId: { in: uniqueCategoryIds }, status: RecordStatus.ACTIVE },
      _count: { _all: true }
    });
    const requiredChoicesPerTeam = input.roundCount;
    if (playableCombinations.length < requiredChoicesPerTeam) {
      return fail(`برای هر تیم ${requiredChoicesPerTeam} انتخاب متفاوت لازم داری. دسته‌های بیشتری رو روشن کن یا تعداد دورها رو کم کن.`, 422);
    }

    const game = await prisma.$transaction(async (tx) => {
      const created = await tx.game.create({
        data: {
          roundCount: input.roundCount,
          roundDuration: input.roundDuration,
          playMode: input.playMode,
          status: GameStatus.SETUP,
          categories: {
            create: uniqueCategoryIds.map((categoryId) => ({ categoryId }))
          }
        }
      });

      await tx.team.createMany({
        data: input.teams.map((team, index) => ({
          gameId: created.id,
          name: team.name,
          colorKey: team.colorKey,
          position: index
        }))
      });

      const teams = await tx.team.findMany({
        where: { gameId: created.id },
        orderBy: { position: "asc" }
      });

      return tx.game.update({
        where: { id: created.id },
        data: {
          status: GameStatus.ACTIVE,
          startedAt: new Date(),
          currentTeamId: teams[0].id
        },
        include: { teams: { orderBy: { position: "asc" } } }
      });
    });

    return ok(game, { status: 201 });
  } catch (error) {
    console.error(error);
    return fail("نتونستیم بازی رو بسازیم. دوباره امتحان کنیم؟", 500);
  }
}
