/*
  Warnings:

  - Changed the type of `status` on the `KPIRecords` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "KPIStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ObjectiveProgressStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'WARNING', 'DANGER', 'COMPLETED');

-- AlterTable
ALTER TABLE "KPIRecords" DROP COLUMN "status",
ADD COLUMN     "status" "KPIStatus" NOT NULL;
