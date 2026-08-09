import { Difficulty, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { queueSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await context.params;
    const parsed = queueSchema.safeParse(await request.json());
    if (!parsed.success) return fail("موضوع یا امتیاز معتبر نیست.", 422);
    const input = parsed.data;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        status: true,
        playMode: true,
        currentRound: true,
        currentTeamId: true,
        categories: { select: { categoryId: true } },
        usedWords: { select: { wordId: true } },
        teams: { select: { id: true, forfeited: true } }
      }
    });
    if (!game) return fail("بازی پیدا نشد.", 404);
    if (game.status !== "ACTIVE") return fail("این بازی دیگه فعال نیست.", 409);
    if (!game.currentTeamId) return fail("نوبت فعالی وجود نداره.", 409);
    const currentTeam = game.teams.find((team) => team.id === game.currentTeamId);
    if (!currentTeam || currentTeam.forfeited) return fail("این تیم دیگه توی بازی نیست.", 409);

    if (input.points !== 30 && !game.categories.some((item) => item.categoryId === input.categoryId)) {
      return fail("این موضوع توی این بازی فعال نیست.", 409);
    }

    const usedIds = game.usedWords.map((item) => item.wordId);
    const activeCategoryIds = game.categories.map((item) => item.categoryId);
    const requestedCount = input.points === 30 || game.playMode === "SINGLE" ? 1 : input.count;

    const result = await prisma.$transaction(async (tx) => {
      const existingTurnChoice = await tx.gameChoice.findUnique({
        where: {
          gameId_teamId_roundNumber: {
            gameId,
            teamId: game.currentTeamId!,
            roundNumber: game.currentRound
          }
        }
      });

      if (existingTurnChoice) {
        const sameChoice = input.points === 30
          ? existingTurnChoice.points === 30
          : existingTurnChoice.categoryId === input.categoryId && existingTurnChoice.points === input.points;
        if (!sameChoice) throw new Error("TURN_CHOICE_LOCKED");
      }

      let choice = existingTurnChoice;
      if (!choice) {
        if (input.points === 30) {
          const alreadyUsedThirty = await tx.gameChoice.count({
            where: { gameId, teamId: game.currentTeamId!, points: 30 }
          });
          if (alreadyUsedThirty > 0) throw new Error("THIRTY_ALREADY_USED");
        }

        choice = await tx.gameChoice.create({
          data: {
            gameId,
            teamId: game.currentTeamId!,
            roundNumber: game.currentRound,
            categoryId: input.points === 30 ? null : input.categoryId,
            points: input.points
          }
        });
      }

      const difficulty = input.points === 2
        ? Difficulty.EASY
        : input.points === 4
          ? Difficulty.MEDIUM
          : Difficulty.HARD;

      const candidates = await tx.word.findMany({
        where: {
          ...(input.points === 30
            ? { categoryId: { in: activeCategoryIds }, points: 6, difficulty: Difficulty.HARD }
            : { categoryId: input.categoryId!, points: input.points, difficulty }),
          status: RecordStatus.ACTIVE,
          ...(usedIds.length ? { id: { notIn: usedIds } } : {})
        },
        orderBy: [{ usageCount: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          points: true,
          category: { select: { name: true } }
        },
        take: Math.max(requestedCount * 8, 48)
      });

      const selected = shuffle(candidates).slice(0, requestedCount);
      if (!selected.length) throw new Error("NO_WORDS");

      await tx.gameUsedWord.createMany({
        data: selected.map((word) => ({ gameId, wordId: word.id })),
        skipDuplicates: true
      });
      await tx.word.updateMany({
        where: { id: { in: selected.map((word) => word.id) } },
        data: { usageCount: { increment: 1 } }
      });

      return { choice, selected };
    });

    return ok({
      words: result.selected.map((word) => ({
        id: word.id,
        title: word.title,
        points: word.points,
        categoryName: word.category.name
      })),
      exhausted: result.selected.length < requestedCount,
      choice: {
        categoryId: result.choice.categoryId,
        points: result.choice.points,
        teamId: result.choice.teamId,
        roundNumber: result.choice.roundNumber
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("این تیم قبلاً این موضوع و امتیاز رو استفاده کرده.", 409);
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "TURN_CHOICE_LOCKED") return fail("انتخاب این نوبت قبلاً ثبت شده.", 409);
    if (code === "THIRTY_ALREADY_USED") return fail("این تیم قبلاً ریسک ۳۰ امتیازی رو استفاده کرده.", 409);
    if (code === "NO_WORDS") return fail("برای این انتخاب کلمه‌ای باقی نمونده.", 409);
    console.error(error);
    return fail("کلمه جدید پیدا نشد. دوباره امتحان کنیم؟", 500);
  }
}
