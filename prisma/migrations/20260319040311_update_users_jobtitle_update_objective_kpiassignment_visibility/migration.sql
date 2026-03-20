/*
  Warnings:

  - Added the required column `visibility` to the `KPIAssignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visibility` to the `Objectives` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'COMPANY');

-- AlterTable
ALTER TABLE "KPIAssignments" ADD COLUMN     "visibility" "Visibility" NOT NULL;

-- AlterTable
ALTER TABLE "Objectives" ADD COLUMN     "visibility" "Visibility" NOT NULL;

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "job_title" TEXT;
