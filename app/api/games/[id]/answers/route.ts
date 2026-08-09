import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { answerSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

function speedBonus(basePoints: number, elapsedMs: number, roundDurationSeconds: number) {
  if (![2, 4, 6].includes(basePoints)) return 0;
  const bonusWindowMs = Math.max(1000, (roundDurationSeconds * 1000) / 3);
  if (elapsedMs >= bonusWindowMs) return 0;
  const ratio = Math.max(0, Math.min(1, (bonusWindowMs - elapsedMs) / bonusWindowMs));
  return Math.max(1, Math.min(3, Math.ceil(ratio * 3)));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: gameId } = await context.params;
  let clientEventId: string | undefined;
  try {
    const parsed = answerSchema.safeParse(await request.json());
    if (!parsed.success) return fail("پاسخ معتبر نیست.", 422);
    const input = parsed.data;
    clientEventId = input.clientEventId;

    const existing = await prisma.gameAnswer.findUnique({ where: { clientEventId: input.clientEventId } });
    if (existing) return ok({ answer: existing, duplicate: true, awardedPoints: existing.points, speedBonus: 0 });

    const result = await prisma.$transaction(async (tx) => {
      const turn = await tx.gameTurn.findUnique({
        where: { id: input.turnId },
        include: { game: true, round: true, team: true }
      });
      if (!turn || turn.gameId !== gameId) throw new Error("TURN_NOT_FOUND");
      if (turn.status !== "ACTIVE") throw new Error("TURN_CLOSED");
      if (turn.teamId !== input.teamId || turn.game.currentTeamId !== input.teamId) throw new Error("TEAM_MISMATCH");
      if (turn.team.forfeited) throw new Error("TEAM_FORFEITED");

      const choice = await tx.gameChoice.findUnique({
        where: {
          gameId_teamId_roundNumber: {
            gameId,
            teamId: input.teamId,
            roundNumber: turn.roundNumber
          }
        }
      });
      if (!choice) throw new Error("CHOICE_NOT_FOUND");

      if (turn.game.playMode === "SINGLE") {
        const existingTurnAnswer = await tx.gameAnswer.findFirst({ where: { turnId: turn.id } });
        if (existingTurnAnswer) throw new Error("SINGLE_ALREADY_ANSWERED");
        if (input.result === "SKIPPED") throw new Error("SKIP_NOT_ALLOWED");
      }
      if (choice.points === 30 && input.result === "SKIPPED") throw new Error("SKIP_NOT_ALLOWED");

      const used = await tx.gameUsedWord.findUnique({
        where: { gameId_wordId: { gameId, wordId: input.wordId } }
      });
      if (!used) throw new Error("WORD_NOT_RESERVED");

      const previousAnswer = await tx.gameAnswer.findFirst({ where: { gameId, wordId: input.wordId } });
      if (previousAnswer) throw new Error("WORD_ALREADY_ANSWERED");

      const word = await tx.word.findUnique({ where: { id: input.wordId } });
      if (!word || word.status !== "ACTIVE") throw new Error("WORD_NOT_FOUND");
      if (choice.points !== 30 && (choice.categoryId !== word.categoryId || choice.points !== word.points)) {
        throw new Error("WORD_CHOICE_MISMATCH");
      }
      if (choice.points === 30 && word.points !== 6) throw new Error("WORD_CHOICE_MISMATCH");

      const now = Date.now();
      const answerAt = input.answeredAtMs && input.answeredAtMs >= turn.startedAt.getTime() - 1000 && input.answeredAtMs <= now + 5000
        ? input.answeredAtMs
        : now;
      const elapsedMs = Math.max(0, answerAt - turn.startedAt.getTime());
      if (elapsedMs > turn.game.roundDuration * 1000 + 1500) throw new Error("TURN_EXPIRED");
      const basePoints = input.result === "CORRECT" ? choice.points : 0;
      const bonus = input.result === "CORRECT" && turn.game.playMode === "SINGLE" && choice.points !== 30
        ? speedBonus(basePoints, elapsedMs, turn.game.roundDuration)
        : 0;
      const points = input.result === "CORRECT"
        ? basePoints + bonus
        : -Math.max(0, turn.game.skipPenalty);

      const answer = await tx.gameAnswer.create({
        data: {
          clientEventId: input.clientEventId,
          gameId,
          roundId: turn.roundId,
          turnId: turn.id,
          teamId: input.teamId,
          wordId: input.wordId,
          result: input.result,
          points
        }
      });

      await tx.gameUsedWord.update({
        where: { gameId_wordId: { gameId, wordId: input.wordId } },
        data: { shownAt: used.shownAt ?? new Date() }
      });
      await tx.team.update({ where: { id: input.teamId }, data: { score: { increment: points } } });
      await tx.gameRound.update({
        where: { id: turn.roundId },
        data: {
          score: { increment: points },
          ...(input.result === "CORRECT"
            ? { correctCount: { increment: 1 } }
            : { skippedCount: { increment: 1 } })
        }
      });

      const [team, round] = await Promise.all([
        tx.team.findUniqueOrThrow({ where: { id: input.teamId } }),
        tx.gameRound.findUniqueOrThrow({ where: { id: turn.roundId } })
      ]);
      return { answer, team, round, awardedPoints: points, speedBonus: bonus, basePoints };
    });

    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (clientEventId) {
        const existing = await prisma.gameAnswer.findUnique({ where: { clientEventId } });
        if (existing) return ok({ answer: existing, duplicate: true, awardedPoints: existing.points, speedBonus: 0 });
      }
      return fail("این کلمه قبلاً ثبت شده.", 409);
    }
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      TURN_NOT_FOUND: "این نوبت پیدا نشد.",
      TURN_CLOSED: "زمان این نوبت تموم شده.",
      TURN_EXPIRED: "زمان این نوبت تموم شده.",
      TEAM_MISMATCH: "الان نوبت این تیم نیست.",
      TEAM_FORFEITED: "این تیم از بازی خارج شده.",
      CHOICE_NOT_FOUND: "انتخاب این نوبت پیدا نشد.",
      SINGLE_ALREADY_ANSWERED: "این نوبت فقط یک کلمه داره.",
      SKIP_NOT_ALLOWED: "در این حالت رد کردن کلمه نداریم.",
      WORD_NOT_RESERVED: "این کلمه برای بازی رزرو نشده.",
      WORD_ALREADY_ANSWERED: "این کلمه قبلاً ثبت شده.",
      WORD_NOT_FOUND: "این کلمه دیگه در دسترس نیست.",
      WORD_CHOICE_MISMATCH: "این کلمه با انتخاب نوبت هماهنگ نیست."
    };
    if (messages[code]) return fail(messages[code], 409);
    console.error(error);
    return fail("ثبت پاسخ انجام نشد؛ نتیجه موقتاً روی گوشی نگه داشته می‌شه.", 500);
  }
}
