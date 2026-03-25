import "dotenv/config";
import { PrismaClient } from "@prisma/client";
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
        console.log(`Setting context for company_id: ${company_id}, role: ${role}`);

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
  },
  client: {
    async $queryRaw(...args) {
      const store = requestContext.getStore();
      const company_id = store?.company_id || '';
      const role = store?.role || ''; 
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          SET LOCAL app.current_company_id = '${company_id}';
          SET LOCAL app.user_role = '${role}';
        `);
        return tx.$queryRaw(...args);
      });
    },

    async $queryRawUnsafe(...args) {
      const store = requestContext.getStore();
      const company_id = store?.company_id || '';
      const role = store?.role || ''; 
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          SET LOCAL app.current_company_id = '${company_id}';
          SET LOCAL app.user_role = '${role}';
        `);
        return tx.$queryRawUnsafe(...args);
      });
    },

    async $executeRaw(...args) {
      const store = requestContext.getStore();
      const company_id = store?.company_id || '';
      const role = store?.role || ''; 
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          SET LOCAL app.current_company_id = '${company_id}';
          SET LOCAL app.user_role = '${role}';
        `);
        return tx.$executeRaw(...args);
      });
    },

    async $executeRawUnsafe(...args) {
      const store = requestContext.getStore();
      const company_id = store?.company_id || '';
      const role = store?.role || ''; 
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          SET LOCAL app.current_company_id = '${company_id}';
          SET LOCAL app.user_role = '${role}';
        `);
        return tx.$executeRawUnsafe(...args);
      });
    },
  },
});

export default prisma;
