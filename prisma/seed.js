import "dotenv/config";
import prisma from '../src/utils/prisma.js';
import { hashPassword } from "../src/utils/bcrypt.js";

const main = async () => {
  await prisma.$connect();

  console.log("Seeding database...");

  // Create a user
  const password = "admin123";
  const hashedPassword = await hashPassword(password);

  const user = await prisma.users.create({
    data: {
      full_name: "admin",
      email: "admin@phamhoangthai.site",
      password: hashedPassword,
      company_id: -1,
      role: "ADMIN",
    }
  });

  console.log("Database seeded successfully!");
};

main()
  .catch(async (error) => {
    console.error("Prisma seed failed:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
