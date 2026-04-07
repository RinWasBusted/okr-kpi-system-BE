import { execSync } from "child_process";
import { config } from "dotenv";

config({ path: ".env" });

execSync("npx prisma studio", {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_ADMIN_URL,
  },
});
