-- AlterTable
ALTER TABLE "KPIAssignments" ADD COLUMN     "start_value" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "KeyResults" ADD COLUMN     "evaluation_method" "KPIEvaluationType" NOT NULL DEFAULT 'MAXIMIZE',
ADD COLUMN     "start_value" DOUBLE PRECISION NOT NULL DEFAULT 0;
