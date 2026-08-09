import { Difficulty, PenaltyType, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { changeWordSchema } from "@/lib/game/validation";
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
    const parsed = changeWordSchema.safeParse(await request.json());
    if (!parsed.success) return fail("درخواست تعویض معتبر نیست.", 422);
    const input = parsed.data;

    const existingPenalty = await prisma.gamePenalty.findUnique({ where: { clientEventId: input.clientEventId } });
    if (existingPenalty?.wordId) {
      const word = await prisma.word.findUnique({
        where: { id: existingPenalty.wordId },
        select: { id: true, title: true, points: true, category: { select: { name: true } } }
      });
      if (word) return ok({
        word: { id: word.id, title: word.title, points: word.points, categoryName: word.category.name },
        duplicate: true
      });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { categories: true, teams: true, usedWords: { select: { wordId: true } } }
    });
    if (!game || game.status !== "ACTIVE" || !game.currentTeamId) return fail("بازی فعال نیست.", 409);
    if (game.currentTeamId !== input.teamId) return fail("الان نوبت این تیم نیست.", 409);
    const team = game.teams.find((item) => item.id === input.teamId);
    if (!team || team.forfeited) return fail("این تیم دیگه توی بازی نیست.", 409);

    const choice = await prisma.gameChoice.findUnique({
      where: { gameId_teamId_roundNumber: { gameId, teamId: input.teamId, roundNumber: game.currentRound } }
    });
    if (!choice) return fail("انتخاب این نوبت پیدا نشد.", 409);
    if (choice.changeUsed) return fail("تعویض این نوبت قبلاً استفاده شده.", 409);

    const reserved = await prisma.gameUsedWord.findUnique({
      where: { gameId_wordId: { gameId, wordId: input.wordId } }
    });
    if (!reserved) return fail("کلمه فعلی پیدا نشد.", 409);

    const usedIds = [...new Set([...game.usedWords.map((item) => item.wordId), input.wordId])];
    const activeCategoryIds = game.categories.map((item) => item.categoryId);

    const candidates = await prisma.word.findMany({
      where: {
        ...(choice.points === 30
          ? { categoryId: { in: activeCategoryIds }, points: 6, difficulty: Difficulty.HARD }
          : {
              categoryId: choice.categoryId!,
              points: choice.points,
              difficulty: choice.points === 2 ? Difficulty.EASY : choice.points === 4 ? Difficulty.MEDIUM : Difficulty.HARD
            }),
        status: RecordStatus.ACTIVE,
        id: input.replacementWordId ? input.replacementWordId : { notIn: usedIds }
      },
      orderBy: [{ usageCount: "asc" }, { id: "asc" }],
      take: input.replacementWordId ? 1 : 48,
      select: { id: true, title: true, points: true, category: { select: { name: true } } }
    });
    const replacement = input.replacementWordId ? candidates[0] : shuffle(candidates)[0];
    if (!replacement || usedIds.includes(replacement.id)) return fail("کلمه جایگزین دیگه‌ای باقی نمونده.", 409);

    const result = await prisma.$transaction(async (tx) => {
      const freshChoice = await tx.gameChoice.findUniqueOrThrow({ where: { id: choice.id } });
      if (freshChoice.changeUsed) throw new Error("CHANGE_USED");

      const round = await tx.gameRound.upsert({
        where: { gameId_teamId_roundNumber: { gameId, teamId: input.teamId, roundNumber: game.currentRound } },
        update: {},
        create: { gameId, teamId: input.teamId, roundNumber: game.currentRound }
      });

      await tx.gameChoice.update({ where: { id: choice.id }, data: { changeUsed: true } });
      await tx.gameUsedWord.update({
        where: { gameId_wordId: { gameId, wordId: input.wordId } },
        data: { shownAt: reserved.shownAt ?? new Date() }
      });
      await tx.gameUsedWord.create({ data: { gameId, wordId: replacement.id } });
      await tx.word.update({ where: { id: replacement.id }, data: { usageCount: { increment: 1 } } });
      await tx.team.update({ where: { id: input.teamId }, data: { score: { decrement: 1 } } });
      await tx.gameRound.update({ where: { id: round.id }, data: { score: { decrement: 1 } } });
      await tx.gamePenalty.create({
        data: {
          clientEventId: input.clientEventId,
          gameId,
          roundId: round.id,
          teamId: input.teamId,
          type: PenaltyType.CHANGE,
          points: -1,
          wordId: replacement.id
        }
      });

      const updatedTeam = await tx.team.findUniqueOrThrow({ where: { id: input.teamId } });
      return { updatedTeam };
    });

    return ok({
      word: { id: replacement.id, title: replacement.title, points: replacement.points, categoryName: replacement.category.name },
      teamScore: result.updatedTeam.score,
      penalty: -1
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CHANGE_USED") return fail("تعویض این نوبت قبلاً استفاده شده.", 409);
    console.error(error);
    return fail("تعویض کلمه انجام نشد.", 500);
  }
}
