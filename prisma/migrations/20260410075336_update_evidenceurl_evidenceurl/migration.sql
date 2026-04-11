-- AlterTable
ALTER TABLE "CheckIns" ALTER COLUMN "evidence_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "KPIRecords" ADD COLUMN     "evidence_url" TEXT;
