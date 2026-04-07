/*
  Warnings:

  - The `status` column on the `Objectives` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `evaluation_method` on the `KPIDictionaries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `KPIRecords` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `trend` on the `KPIRecords` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "KPIEvaluationType" AS ENUM ('MAXIMIZE', 'MINIMIZE', 'TARGET', 'RANGE');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('Draft', 'Pending_Approval', 'Rejected', 'NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'CRITICAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "KPITrend" AS ENUM ('Upward', 'Downward', 'Stable');

-- AlterTable
ALTER TABLE "KPIAssignments" ADD COLUMN     "due_date" DATE;

-- AlterTable
ALTER TABLE "KPIDictionaries" DROP COLUMN "evaluation_method",
ADD COLUMN     "evaluation_method" "KPIEvaluationType" NOT NULL;

-- AlterTable
ALTER TABLE "KPIRecords" DROP COLUMN "status",
ADD COLUMN     "status" "ProgressStatus" NOT NULL,
DROP COLUMN "trend",
ADD COLUMN     "trend" "KPITrend" NOT NULL;

-- AlterTable
ALTER TABLE "Objectives" DROP COLUMN "status",
ADD COLUMN     "status" "ProgressStatus" NOT NULL DEFAULT 'Draft';

-- DropEnum
DROP TYPE "KPIStatus";

-- DropEnum
DROP TYPE "ObjectiveProgressStatus";
