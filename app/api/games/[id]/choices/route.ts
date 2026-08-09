import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { selectionSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await context.params;
    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
    if (!game) return fail("بازی پیدا نشد.", 404);
    const choices = await prisma.gameChoice.findMany({ where: { gameId }, orderBy: { createdAt: "asc" }, select: { categoryId: true, points: true, teamId: true, roundNumber: true } });
    return ok({ choices });
  } catch (error) {
    console.error(error);
    return fail("انتخاب‌های بازی در دسترس نیستن.", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await context.params;
    const parsed = selectionSchema.safeParse(await request.json());
    if (!parsed.success) return fail("انتخاب معتبر نیست.", 422);
    const input = parsed.data;

    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { categories: true, teams: true } });
    if (!game || game.status !== "ACTIVE") return fail("بازی فعال نیست.", 409);
    const team = game.teams.find((item) => item.id === input.teamId);
    if (!team || team.forfeited) return fail("این تیم قابل بازی نیست.", 409);
    if (game.currentTeamId !== input.teamId || game.currentRound !== input.roundNumber) return fail("الان نوبت این تیم نیست.", 409);
    if (input.roundNumber > game.roundCount) return fail("شماره دور معتبر نیست.", 409);
    if (input.points !== 30 && !game.categories.some((item) => item.categoryId === input.categoryId)) return fail("این موضوع در بازی فعال نیست.", 409);

    const words = await prisma.word.findMany({ where: { id: { in: input.wordIds }, status: RecordStatus.ACTIVE }, select: { id: true, categoryId: true, points: true } });
    if (words.length !== new Set(input.wordIds).size) return fail("یکی از کلمه‌ها معتبر نیست.", 409);
    if (words.some((word) => input.points === 30 ? word.points !== 6 : word.categoryId !== input.categoryId || word.points !== input.points)) return fail("کلمه با موضوع یا امتیاز هماهنگ نیست.", 409);

    const existing = await prisma.gameChoice.findUnique({ where: { gameId_teamId_roundNumber: { gameId, teamId: input.teamId, roundNumber: input.roundNumber } } });
    if (existing && (existing.points !== input.points || existing.categoryId !== input.categoryId)) return fail("انتخاب این نوبت قبلاً ثبت شده.", 409);

    if (!existing && input.points === 30) {
      const usedThirty = await prisma.gameChoice.count({ where: { gameId, teamId: input.teamId, points: 30 } });
      if (usedThirty) return fail("این تیم قبلاً ریسک ۳۰ امتیازی رو استفاده کرده.", 409);
    }
    if (!existing && input.points !== 30) {
      const sameTeamChoice = await prisma.gameChoice.count({ where: { gameId, teamId: input.teamId, categoryId: input.categoryId, points: input.points } });
      if (sameTeamChoice) return fail("این تیم قبلاً این موضوع و امتیاز رو استفاده کرده.", 409);
    }

    const existingReservations = await prisma.gameUsedWord.findMany({ where: { gameId, wordId: { in: input.wordIds } }, select: { wordId: true } });
    if (!existing && existingReservations.length) return fail("یکی از کلمه‌ها قبلاً در همین بازی استفاده شده.", 409);
    const reservedIds = new Set(existingReservations.map((item) => item.wordId));
    const newWordIds = input.wordIds.filter((id) => !reservedIds.has(id));

    const choice = await prisma.$transaction(async (tx) => {
      const savedChoice = existing ?? await tx.gameChoice.create({ data: { gameId, teamId: input.teamId, roundNumber: input.roundNumber, categoryId: input.categoryId, points: input.points } });
      if (newWordIds.length) {
        await tx.gameUsedWord.createMany({ data: newWordIds.map((wordId) => ({ gameId, wordId })), skipDuplicates: true });
        await tx.word.updateMany({ where: { id: { in: newWordIds } }, data: { usageCount: { increment: 1 } } });
      }
      return savedChoice;
    });
    return ok({ choice, duplicate: Boolean(existing), reserved: newWordIds.length }, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail("این تیم قبلاً این انتخاب رو استفاده کرده.", 409);
    console.error(error);
    return fail("ثبت انتخاب انجام نشد.", 500);
  }
}
