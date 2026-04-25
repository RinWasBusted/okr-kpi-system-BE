// import "dotenv/config";
// import { PrismaClient } from "@prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { Pool } from "pg";
// import requestContext from "./context.js";

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// const basePrisma = new PrismaClient({ adapter });

// function getContextVars(store) {
//   return {
//     company_id: store?.company_id ?? '',
//     role: store?.role ?? '',
//     user_id: store?.user_id ? String(store.user_id) : '',
//     unit_path: store?.unit_path ?? '',
//   };
// }

// const prisma = basePrisma.$extends({
//   query: {
//     $allModels: {
//       async $allOperations({ args, query }){
//         const store = requestContext.getStore();
//         const { company_id, role, user_id, unit_path } = getContextVars(store);

//         const [_, result] = await basePrisma.$transaction([
//           basePrisma.$executeRaw`SELECT
//             set_config('app.current_company_id', ${company_id}, true),
//             set_config('app.user_role', ${role}, true),
//             set_config('app.current_user_id', ${user_id}, true),
//             set_config('app.current_user_unit_path', ${unit_path}, true),
//             -- Kích hoạt RLS filter cho locked cycles (local scope = true)
//             set_config('app.skip_locked_filter', 'false', true)`,
//           query(args)
//         ]);

//         return result;
//       }
//     }
//   },
//   client: {
//     async $queryRaw(...args) {
//       const store = requestContext.getStore();
//       const { company_id, role, user_id, unit_path } = getContextVars(store);
//       return basePrisma.$transaction(async (tx) => {
//         await tx.$executeRaw`SELECT
//           set_config('app.current_company_id', ${company_id}, true),
//           set_config('app.user_role', ${role}, true),
//           set_config('app.current_user_id', ${user_id}, true),
//           set_config('app.current_user_unit_path', ${unit_path}, true),
//           set_config('app.skip_locked_filter', 'false', true)`;
//         return tx.$queryRaw(...args);
//       });
//     },

//     async $queryRawUnsafe(...args) {
//       const store = requestContext.getStore();
//       const { company_id, role, user_id, unit_path } = getContextVars(store);
//       return basePrisma.$transaction(async (tx) => {
//         await tx.$executeRaw`SELECT
//           set_config('app.current_company_id', ${company_id}, true),
//           set_config('app.user_role', ${role}, true),
//           set_config('app.current_user_id', ${user_id}, true),
//           set_config('app.current_user_unit_path', ${unit_path}, true),
//           set_config('app.skip_locked_filter', 'false', true)`;
//         return tx.$queryRawUnsafe(...args);
//       });
//     },

//     async $executeRaw(...args) {
//       const store = requestContext.getStore();
//       const { company_id, role, user_id, unit_path } = getContextVars(store);
//       return basePrisma.$transaction(async (tx) => {
//         await tx.$executeRaw`SELECT
//           set_config('app.current_company_id', ${company_id}, true),
//           set_config('app.user_role', ${role}, true),
//           set_config('app.current_user_id', ${user_id}, true),
//           set_config('app.current_user_unit_path', ${unit_path}, true),
//           set_config('app.skip_locked_filter', 'false', true)`;
//         return tx.$executeRaw(...args);
//       });
//     },

//     async $executeRawUnsafe(...args) {
//       const store = requestContext.getStore();
//       const { company_id, role, user_id, unit_path } = getContextVars(store);
//       return basePrisma.$transaction(async (tx) => {
//         await tx.$executeRaw`SELECT
//           set_config('app.current_company_id', ${company_id}, true),
//           set_config('app.user_role', ${role}, true),
//           set_config('app.current_user_id', ${user_id}, true),
//           set_config('app.current_user_unit_path', ${unit_path}, true),
//           set_config('app.skip_locked_filter', 'false', true)`;
//         return tx.$executeRawUnsafe(...args);
//       });
//     },
//   },
// });

// export default prisma;

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

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }){
        const store = requestContext.getStore();
        const { company_id, role, user_id, unit_path } = getContextVars(store);

        const [_, result] = await basePrisma.$transaction([
          basePrisma.$executeRaw`SELECT
            set_config('app.current_company_id', '2', true),
            set_config('app.user_role', 'ADMIN_COMPANY', true),
            set_config('app.current_user_id', '11', true),
            set_config('app.current_user_unit_path', '', true),
            -- Kích hoạt RLS filter cho locked cycles (local scope = true)
            set_config('app.skip_locked_filter', 'false', true)`,
          query(args)
        ]);

        return result;
      }
    }
  },
  client: {
    async $queryRaw(...args) {
      const store = requestContext.getStore();
      const { company_id, role, user_id, unit_path } = getContextVars(store);
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.current_company_id', '2', true),
          set_config('app.user_role', 'ADMIN_COMPANY', true),
          set_config('app.current_user_id', '11', true),
          set_config('app.current_user_unit_path', '', true),
          set_config('app.skip_locked_filter', 'false', true)`;
        return tx.$queryRaw(...args);
      });
    },

    async $queryRawUnsafe(...args) {
      const store = requestContext.getStore();
      const { company_id, role, user_id, unit_path } = getContextVars(store);
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.current_company_id', '2', true),
          set_config('app.user_role', 'ADMIN_COMPANY', true),
          set_config('app.current_user_id', '11', true),
          set_config('app.current_user_unit_path', '', true),
          set_config('app.skip_locked_filter', 'false', true)`;
        return tx.$queryRawUnsafe(...args);
      });
    },

    async $executeRaw(...args) {
      const store = requestContext.getStore();
      const { company_id, role, user_id, unit_path } = getContextVars(store);
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.current_company_id', '2', true),
          set_config('app.user_role', 'ADMIN_COMPANY', true),
          set_config('app.current_user_id', '11', true),
          set_config('app.current_user_unit_path', '', true),
          set_config('app.skip_locked_filter', 'false', true)`;
        return tx.$executeRaw(...args);
      });
    },

    async $executeRawUnsafe(...args) {
      const store = requestContext.getStore();
      const { company_id, role, user_id, unit_path } = getContextVars(store);
      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.current_company_id', '2', true),
          set_config('app.user_role', 'ADMIN_COMPANY', true),
          set_config('app.current_user_id', '11', true),
          set_config('app.current_user_unit_path', '', true),
          set_config('app.skip_locked_filter', 'false', true)`;
        return tx.$executeRawUnsafe(...args);
      });
    },
  },
});

export default prisma;
