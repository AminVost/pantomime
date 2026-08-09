import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/utils/http";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "healthy", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    return fail("database_unavailable", 503);
  }
}
