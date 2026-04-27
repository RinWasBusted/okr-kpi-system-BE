-- CreateEnum
CREATE TYPE "PerformanceRating" AS ENUM ('EXCELLENT', 'GOOD', 'ABOVE_AVERAGE', 'SATISFACTORY', 'NEEDS_IMPROVEMENT');

-- AlterEnum
ALTER TYPE "ReferenceType" ADD VALUE 'EVALUATION';

-- CreateTable
CREATE TABLE "Evaluations" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "evaluatee_id" INTEGER NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "okr_count" INTEGER NOT NULL DEFAULT 0,
    "kpi_count" INTEGER NOT NULL DEFAULT 0,
    "avg_okr_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_kpi_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "composite_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" "PerformanceRating" NOT NULL DEFAULT 'NEEDS_IMPROVEMENT',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evaluations_company_id_idx" ON "Evaluations"("company_id");

-- CreateIndex
CREATE INDEX "Evaluations_cycle_id_idx" ON "Evaluations"("cycle_id");

-- CreateIndex
CREATE INDEX "Evaluations_evaluatee_id_idx" ON "Evaluations"("evaluatee_id");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluations_company_id_evaluatee_id_cycle_id_key" ON "Evaluations"("company_id", "evaluatee_id", "cycle_id");

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "Cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_evaluatee_id_fkey" FOREIGN KEY ("evaluatee_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
