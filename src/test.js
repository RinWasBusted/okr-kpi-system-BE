import prisma from "./utils/prisma";

async function main() {
  // ── Lấy cycles bằng Prisma ORM (ngoài transaction, không bị RLS filter) ──
  const allCyclesPrisma = await prisma.cycles.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      company_id: true,
      is_locked: true,
      start_date: true,
      end_date: true,
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET ROLE app_user;`);
    await tx.$executeRawUnsafe(`SET LOCAL app.current_company_id = '2'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.user_role = 'ADMIN_COMPANY'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '11'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.skip_locked_filter = 'false'`);

    // Debug: lấy tất cả objectives bằng raw SQL
    const allObjectives = await tx.$queryRawUnsafe(`
      SELECT id, title, cycle_id, company_id, deleted_at
      FROM "Objectives"
      ORDER BY id
    `);

    // Debug: lấy tất cả cycles bằng raw SQL
    const allCyclesRaw = await tx.$queryRawUnsafe(`
      SELECT id, name, company_id, is_locked
      FROM "Cycles"
      ORDER BY id
    `);

    // Query chính
    const mainResult = await tx.$queryRawUnsafe(`
      SELECT 
        o.id,
        o.title,
        o.progress_percentage,
        c.id        AS cycle_id,
        c.name      AS cycle_name,
        c.is_locked AS cycle_is_locked
      FROM "Objectives" o
      LEFT JOIN "Cycles" c ON o.cycle_id = c.id
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `);

    return { allObjectives, allCyclesRaw, mainResult };
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  console.log("\n=== TẤT CẢ OBJECTIVES (raw SQL, trong transaction RLS) ===");
  console.table(result.allObjectives);

  console.log("\n=== TẤT CẢ CYCLES (raw SQL, trong transaction RLS) ===");
  console.table(result.allCyclesRaw);

  console.log("\n=== TẤT CẢ CYCLES (Prisma ORM, ngoài transaction) ===");
  console.table(allCyclesPrisma);

  console.log("\n=== SO SÁNH SỐ LƯỢNG CYCLES ===");
  const rawCount = (result.allCyclesRaw ).length;
  const prismaCount = allCyclesPrisma.length;
  console.log(`Raw SQL (trong RLS transaction) : ${rawCount} cycles`);
  console.log(`Prisma ORM (ngoài transaction)  : ${prismaCount} cycles`);

  if (prismaCount > rawCount) {
    console.log(`⚠️  Chênh lệch ${prismaCount - rawCount} cycle → RLS đang filter bớt Cycles trong transaction`);
  } else if (prismaCount === rawCount && prismaCount === 0) {
    console.log(`⚠️  Cả 2 đều = 0 → DB chưa có data Cycles`);
  } else {
    console.log(`✅  Số lượng khớp nhau → RLS không filter Cycles, vấn đề nằm ở cycle_id của Objectives`);
  }

  console.log("\n=== KẾT QUẢ CHÍNH (JOIN Objectives + Cycles) ===");
  console.table(result.mainResult);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());