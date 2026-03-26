-- CreateEnum
CREATE TYPE "AIPlan" AS ENUM ('FREE', 'SUBSCRIPTION', 'PAY_AS_YOU_GO');

-- CreateEnum
CREATE TYPE "AIUsageStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'BILLED', 'EXCLUDED');

-- AlterTable
ALTER TABLE "Companies" ADD COLUMN     "ai_plan" "AIPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "credit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "token_usage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usage_limit" INTEGER NOT NULL DEFAULT 10000;

-- CreateTable
CREATE TABLE "AIUsageLogs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "user_id" INTEGER,
    "feature_name" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "request_id" TEXT,
    "credit_cost" DOUBLE PRECISION NOT NULL,
    "status" "AIUsageStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIUsageLogs_company_id_idx" ON "AIUsageLogs"("company_id");

-- AddForeignKey
ALTER TABLE "AIUsageLogs" ADD CONSTRAINT "AIUsageLogs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLogs" ADD CONSTRAINT "AIUsageLogs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
