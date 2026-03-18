/*
  Warnings:

  - Changed the type of `role` on the `Users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ADMIN_COMPANY', 'EMPLOYEE');

-- DropForeignKey
ALTER TABLE "Users" DROP CONSTRAINT "Users_company_id_fkey";

-- AlterTable
ALTER TABLE "Users" ALTER COLUMN "company_id" DROP NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL;

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
