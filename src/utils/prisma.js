import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import requestContext from "./context.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const basePrisma = new PrismaClient({ adapter });

function getContextVars(store) {
  return {
    company_id: store?.company_id ?? '',
    role: store?.role ?? '',
    user_id: store?.user_id ? String(store.user_id) : '',
    unit_path: store?.unit_path ?? '',
  };
}

async function applyRequestContext(tx, { skipLockedFilter }) {
  const store = requestContext.getStore();
  const { company_id, role, user_id, unit_path } = getContextVars(store);

  await tx.$executeRaw`SELECT
    set_config('app.current_company_id', ${company_id}, true),
    set_config('app.user_role', ${role}, true),
    set_config('app.current_user_id', ${user_id}, true),
    set_config('app.current_user_unit_path', ${unit_path}, true),
    set_config('app.skip_locked_filter', ${skipLockedFilter ? "true" : "false"}, true)`;
}

async function withRequestContext(callback, { skipLockedFilter = false } = {}) {
  return basePrisma.$transaction(async (tx) => {
    await applyRequestContext(tx, { skipLockedFilter });
    return callback(tx);
  });
}

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }){
        const { company_id, role, user_id, unit_path } = getContextVars(requestContext.getStore());

        const [_, result] = await basePrisma.$transaction([
          basePrisma.$executeRaw`SELECT
            set_config('app.current_company_id', ${company_id}, true),
            set_config('app.user_role', ${role}, true),
            set_config('app.current_user_id', ${user_id}, true),
            set_config('app.current_user_unit_path', ${unit_path}, true),
            set_config('app.skip_locked_filter', 'false', true)`,
          query(args)
        ]);

        return result;
      }
    }
  },
  client: {
    async $withLockedCycleFilterBypassed(callback) {
      return withRequestContext(callback, { skipLockedFilter: true });
    },

    async $queryRaw(...args) {
      return withRequestContext(async (tx) => {
        return tx.$queryRaw(...args);
      });
    },

    async $queryRawUnsafe(...args) {
      return withRequestContext(async (tx) => {
        return tx.$queryRawUnsafe(...args);
      });
    },

    async $executeRaw(...args) {
      return withRequestContext(async (tx) => {
        return tx.$executeRaw(...args);
      });
    },

    async $executeRawUnsafe(...args) {
      return withRequestContext(async (tx) => {
        return tx.$executeRawUnsafe(...args);
      });
    },
  },
});

export default prisma;
