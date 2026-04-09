-- DropForeignKey
ALTER TABLE "KPIAssignments" DROP CONSTRAINT "KPIAssignments_unit_id_fkey";

-- AlterTable
ALTER TABLE "KPIAssignments" ALTER COLUMN "unit_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
