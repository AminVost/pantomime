import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/utils/http";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        teams: { orderBy: { position: "asc" } },
        categories: { select: { categoryId: true } }
      }
    });
    if (!game) return fail("این بازی پیدا نشد.", 404);
    return ok(game);
  } catch (error) {
    console.error(error);
    return fail("اطلاعات بازی در دسترس نیست.", 500);
  }
}
