import { prisma } from "@/lib/db/prisma";
import { startTurnSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

function safeStartedAt(startedAtMs?: number) {
  const now = Date.now();
  if (!startedAtMs) return new Date(now);
  const min = now - 24 * 60 * 60 * 1000;
  const max = now + 5000;
  return new Date(Math.min(max, Math.max(min, startedAtMs)));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await context.params;
    const parsed = startTurnSchema.safeParse(await request.json());
    if (!parsed.success) return fail("تیم معتبر نیست.", 422);
    const input = parsed.data;

    if (input.turnId) {
      const existingById = await prisma.gameTurn.findUnique({ where: { id: input.turnId }, include: { round: true } });
      if (existingById) {
        if (existingById.gameId !== gameId || existingById.teamId !== input.teamId) return fail("نوبت معتبر نیست.", 409);
        return ok({ turn: existingById, round: existingById.round });
      }
    }

    const game = await prisma.game.findUnique({ where: { id: gameId }, include: { teams: true } });
    if (!game) return fail("بازی پیدا نشد.", 404);
    if (game.status !== "ACTIVE") return fail("این بازی فعال نیست.", 409);
    if (game.currentTeamId !== input.teamId) return fail("الان نوبت این تیم نیست.", 409);
    const team = game.teams.find((item) => item.id === input.teamId);
    if (!team || team.forfeited) return fail("این تیم توی بازی نیست.", 403);

    const choice = await prisma.gameChoice.findUnique({
      where: { gameId_teamId_roundNumber: { gameId, teamId: input.teamId, roundNumber: game.currentRound } }
    });
    if (!choice) return fail("اول موضوع و امتیاز این نوبت رو انتخاب کن.", 409);

    const existingTurn = await prisma.gameTurn.findUnique({
      where: { gameId_teamId_roundNumber: { gameId, teamId: input.teamId, roundNumber: game.currentRound } },
      include: { round: true }
    });
    if (existingTurn) return ok({ turn: existingTurn, round: existingTurn.round });

    const result = await prisma.$transaction(async (tx) => {
      const round = await tx.gameRound.upsert({
        where: { gameId_teamId_roundNumber: { gameId, teamId: input.teamId, roundNumber: game.currentRound } },
        update: {},
        create: { gameId, teamId: input.teamId, roundNumber: game.currentRound, startedAt: safeStartedAt(input.startedAtMs) }
      });
      const turn = await tx.gameTurn.create({
        data: {
          ...(input.turnId ? { id: input.turnId } : {}),
          gameId,
          roundId: round.id,
          teamId: input.teamId,
          roundNumber: game.currentRound,
          specialThirty: choice.points === 30,
          startedAt: safeStartedAt(input.startedAtMs)
        }
      });
      return { turn, round };
    });

    return ok(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return fail("شروع این نوبت انجام نشد.", 500);
  }
}
