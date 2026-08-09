import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ok, fail } from "@/lib/utils/http";

export async function GET() {
  try {
    const [categories, grouped] = await Promise.all([
      prisma.category.findMany({
        where: { status: RecordStatus.ACTIVE },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.word.groupBy({
        by: ["categoryId", "points"],
        where: { status: RecordStatus.ACTIVE },
        _count: { _all: true }
      })
    ]);

    const countMap = new Map<string, number>();
    for (const row of grouped) countMap.set(`${row.categoryId}:${row.points}`, row._count._all);

    return ok(categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      counts: {
        points2: countMap.get(`${category.id}:2`) ?? 0,
        points4: countMap.get(`${category.id}:4`) ?? 0,
        points6: countMap.get(`${category.id}:6`) ?? 0
      }
    })));
  } catch (error) {
    console.error(error);
    return fail("دسته‌بندی‌ها فعلاً در دسترس نیستن.", 500);
  }
}
