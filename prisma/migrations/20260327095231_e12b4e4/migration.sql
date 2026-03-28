-- DropForeignKey
ALTER TABLE "Objectives" DROP CONSTRAINT "Objectives_unit_id_fkey";

-- AlterTable
ALTER TABLE "Objectives" ALTER COLUMN "unit_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
