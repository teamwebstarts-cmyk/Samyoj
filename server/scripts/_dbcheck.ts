import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const enums = await prisma.$queryRawUnsafe<{ typname: string; label: string }[]>(
    `SELECT t.typname::text, e.enumlabel::text AS label
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname ILIKE '%job%' OR t.typname ILIKE '%generation%'
     ORDER BY 1, e.enumsortorder`,
  );
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name::text FROM information_schema.columns WHERE table_name='generation_jobs' ORDER BY 1`,
  );
  console.log(JSON.stringify({ enums, cols }, null, 2));
}

main().finally(() => prisma.$disconnect());
