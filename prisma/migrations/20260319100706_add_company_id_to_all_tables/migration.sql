/*
  Warnings:

  - Added the required column `company_id` to the `CheckIns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Evaluations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Feedbacks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `KPIAssignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `KPIRecords` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `KeyResults` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Objectives` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CheckIns" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Evaluations" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Feedbacks" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "KPIAssignments" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "KPIRecords" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "KeyResults" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Objectives" ADD COLUMN     "company_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "CheckIns_company_id_idx" ON "CheckIns"("company_id");

-- CreateIndex
CREATE INDEX "Cycles_company_id_idx" ON "Cycles"("company_id");

-- CreateIndex
CREATE INDEX "Evaluations_company_id_idx" ON "Evaluations"("company_id");

-- CreateIndex
CREATE INDEX "Feedbacks_company_id_idx" ON "Feedbacks"("company_id");

-- CreateIndex
CREATE INDEX "KPIAssignments_company_id_idx" ON "KPIAssignments"("company_id");

-- CreateIndex
CREATE INDEX "KPIDictionaries_company_id_idx" ON "KPIDictionaries"("company_id");

-- CreateIndex
CREATE INDEX "KPIRecords_company_id_idx" ON "KPIRecords"("company_id");

-- CreateIndex
CREATE INDEX "KeyResults_company_id_idx" ON "KeyResults"("company_id");

-- CreateIndex
CREATE INDEX "Notifications_company_id_idx" ON "Notifications"("company_id");

-- CreateIndex
CREATE INDEX "Objectives_company_id_idx" ON "Objectives"("company_id");

-- CreateIndex
CREATE INDEX "Units_company_id_idx" ON "Units"("company_id");

-- CreateIndex
CREATE INDEX "Users_company_id_idx" ON "Users"("company_id");

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIRecords" ADD CONSTRAINT "KPIRecords_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResults" ADD CONSTRAINT "KeyResults_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIns" ADD CONSTRAINT "CheckIns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedbacks" ADD CONSTRAINT "Feedbacks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
