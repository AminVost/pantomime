import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/utils/http";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { status: RecordStatus.ACTIVE },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        words: {
          where: { status: RecordStatus.ACTIVE, points: { in: [2, 4, 6] } },
          select: { id: true, title: true, points: true }
        }
      }
    });

    return ok({
      version: Date.now(),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        counts: {
          points2: category.words.filter((word) => word.points === 2).length,
          points4: category.words.filter((word) => word.points === 4).length,
          points6: category.words.filter((word) => word.points === 6).length
        }
      })),
      words: categories.flatMap((category) => category.words.map((word) => ({
        id: word.id,
        title: word.title,
        categoryId: category.id,
        points: word.points,
        categoryName: category.name
      })))
    });
  } catch (error) {
    console.error(error);
    return fail("بسته بازی در دسترس نیست.", 500);
  }
}
