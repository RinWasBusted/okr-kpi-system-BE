/*
  Warnings:

  - You are about to drop the `Evaluations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Evaluations" DROP CONSTRAINT "Evaluations_company_id_fkey";

-- DropForeignKey
ALTER TABLE "Evaluations" DROP CONSTRAINT "Evaluations_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "Evaluations" DROP CONSTRAINT "Evaluations_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "Evaluations" DROP CONSTRAINT "Evaluations_unit_id_fkey";

-- AlterTable
ALTER TABLE "Feedbacks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "Evaluations";
