import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/utils/http";

export async function POST(_: Request, context: { params: Promise<{ id: string; turnId: string }> }) {
  try {
    const { id: gameId, turnId } = await context.params;

    const turn = await prisma.gameTurn.findUnique({
      where: { id: turnId },
      include: {
        game: true,
        round: true,
        team: true,
        answers: { select: { result: true } }
      }
    });
    if (!turn || turn.gameId !== gameId) return fail("این نوبت پیدا نشد.", 404);

    if (turn.status === "COMPLETED") {
      const game = await prisma.game.findUniqueOrThrow({
        where: { id: gameId }, include: { teams: { orderBy: { position: "asc" } } }
      });
      return ok({ game, round: turn.round, teams: game.teams, forfeitedTeamId: turn.team.forfeited ? turn.teamId : null });
    }

    const specialFailed = turn.specialThirty && !turn.answers.some((answer) => answer.result === "CORRECT");
    const teams = await prisma.team.findMany({ where: { gameId }, orderBy: { position: "asc" } });
    const currentIndex = teams.findIndex((team) => team.id === turn.teamId);
    if (currentIndex < 0) return fail("ترتیب تیم‌ها درست نیست.", 409);

    const activeTeams = teams.filter((team) => !team.forfeited && (!specialFailed || team.id !== turn.teamId));
    let finished = activeTeams.length <= 1;
    let nextRound = turn.game.currentRound;
    let nextTeam = activeTeams[0] ?? null;

    if (!finished) {
      const laterActive = activeTeams.find((team) => team.position > teams[currentIndex].position);
      if (laterActive) {
        nextTeam = laterActive;
      } else {
        nextRound = turn.game.currentRound + 1;
        nextTeam = activeTeams[0];
        if (nextRound > turn.game.roundCount) finished = true;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.gameTurn.update({
        where: { id: turn.id },
        data: { status: "COMPLETED", finishedAt: new Date() }
      });
      const round = await tx.gameRound.update({
        where: { id: turn.roundId },
        data: { finishedAt: new Date() }
      });
      if (specialFailed) {
        await tx.team.update({ where: { id: turn.teamId }, data: { forfeited: true } });
      }
      const game = await tx.game.update({
        where: { id: gameId },
        data: finished
          ? { status: "FINISHED", finishedAt: new Date(), currentTeamId: null }
          : { currentRound: nextRound, currentTeamId: nextTeam!.id },
        include: { teams: { orderBy: { position: "asc" } } }
      });
      return { game, round, teams: game.teams };
    });

    return ok({ ...result, forfeitedTeamId: specialFailed ? turn.teamId : null });
  } catch (error) {
    console.error(error);
    return fail("پایان نوبت ثبت نشد. دوباره بزن.", 500);
  }
}
