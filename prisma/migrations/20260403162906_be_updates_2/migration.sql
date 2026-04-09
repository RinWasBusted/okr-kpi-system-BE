/*
  Migration: Convert KPIRecords.status from String to KPIStatus enum,
  preserving existing data by casting known values via USING clause.
*/
-- CreateEnum
CREATE TYPE "KPIStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ObjectiveProgressStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'WARNING', 'DANGER', 'COMPLETED');

-- AlterTable
ALTER TABLE "KPIRecords"
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" TYPE "KPIStatus"
USING (
  CASE "status"::text
    WHEN 'ON_TRACK' THEN 'ON_TRACK'::"KPIStatus"
    WHEN 'AT_RISK' THEN 'AT_RISK'::"KPIStatus"
    WHEN 'CRITICAL' THEN 'CRITICAL'::"KPIStatus"
    ELSE NULL
  END
),
ALTER COLUMN "status" SET NOT NULL;
