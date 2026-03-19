import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import requestContext from "./context.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const basePrisma = new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }){
        const store = requestContext.getStore();
        const company_id = store?.company_id || '';
        const role = store?.role || ''; 

        const [_, result] = await basePrisma.$transaction([
          basePrisma.$executeRawUnsafe(`
            SET LOCAL app.current_company_id = '${company_id}';
            SET LOCAL app.user_role = '${role}';
          `),
          query(args)
        ]);

        return result;
      }
    }
  }
});

export { prisma, Prisma };
export default prisma;
