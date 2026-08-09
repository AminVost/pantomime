import { PenaltyType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { faultSchema } from "@/lib/game/validation";
import { fail, ok } from "@/lib/utils/http";

export async function POST(request: Request, context: { params: Promise<{ id: string; turnId: string }> }) {
  try {
    const { id: gameId, turnId } = await context.params;
    const parsed = faultSchema.safeParse(await request.json());
    if (!parsed.success) return fail("خطا معتبر نیست.", 422);
    const input = parsed.data;
    if (input.turnId !== turnId) return fail("نوبت معتبر نیست.", 422);

    const existing = await prisma.gamePenalty.findUnique({ where: { clientEventId: input.clientEventId } });
    if (existing) return ok({ duplicate: true, penalty: existing.points });

    const result = await prisma.$transaction(async (tx) => {
      const turn = await tx.gameTurn.findUnique({
        where: { id: turnId },
        include: { game: true, team: true }
      });
      if (!turn || turn.gameId !== gameId) throw new Error("TURN_NOT_FOUND");
      if (turn.status !== "ACTIVE") throw new Error("TURN_CLOSED");
      if (turn.teamId !== input.teamId || turn.game.currentTeamId !== input.teamId) throw new Error("TEAM_MISMATCH");
      if (turn.team.forfeited) throw new Error("TEAM_FORFEITED");
      const now = Date.now();
      const occurredAt = input.occurredAtMs && input.occurredAtMs >= turn.startedAt.getTime() - 1000 && input.occurredAtMs <= now + 5000
        ? input.occurredAtMs
        : now;
      if (occurredAt - turn.startedAt.getTime() > turn.game.roundDuration * 1000 + 1500) throw new Error("TURN_EXPIRED");

      await tx.gamePenalty.create({
        data: {
          clientEventId: input.clientEventId,
          gameId,
          roundId: turn.roundId,
          turnId: turn.id,
          teamId: input.teamId,
          type: PenaltyType.FAULT,
          points: -1
        }
      });
      await tx.gameTurn.update({ where: { id: turn.id }, data: { faultCount: { increment: 1 } } });
      await tx.team.update({ where: { id: input.teamId }, data: { score: { decrement: 1 } } });
      await tx.gameRound.update({ where: { id: turn.roundId }, data: { score: { decrement: 1 } } });
      const [team, round] = await Promise.all([
        tx.team.findUniqueOrThrow({ where: { id: input.teamId } }),
        tx.gameRound.findUniqueOrThrow({ where: { id: turn.roundId } })
      ]);
      return { team, round };
    });

    return ok({ penalty: -1, team: result.team, round: result.round });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      TURN_NOT_FOUND: "این نوبت پیدا نشد.",
      TURN_CLOSED: "این نوبت تموم شده.",
      TURN_EXPIRED: "زمان این نوبت تموم شده.",
      TEAM_MISMATCH: "الان نوبت این تیم نیست.",
      TEAM_FORFEITED: "این تیم از بازی خارج شده."
    };
    if (messages[code]) return fail(messages[code], 409);
    console.error(error);
    return fail("ثبت خطا انجام نشد.", 500);
  }
}
