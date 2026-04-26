-- CreateEnum
CREATE TYPE "KNNRiskLabel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('UNREAD', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "Companies" ALTER COLUMN "usage_limit" SET DEFAULT 1000000;

-- CreateTable
CREATE TABLE "EmployeeFeatures" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "kpi_completion_rate" DOUBLE PRECISION NOT NULL,
    "checkin_delay_days" DOUBLE PRECISION NOT NULL,
    "feedback_sentiment_score" DOUBLE PRECISION NOT NULL,
    "objective_participation_ratio" DOUBLE PRECISION NOT NULL,
    "checkin_frequency" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeFeatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScores" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score_date" DATE NOT NULL,
    "statistical_alert" BOOLEAN NOT NULL DEFAULT false,
    "knn_risk_label" "KNNRiskLabel" NOT NULL DEFAULT 'LOW',
    "risk_score" DOUBLE PRECISION NOT NULL,
    "triggered_features" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskScores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAlerts" (
    "id" TEXT NOT NULL,
    "company_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risk_score" DOUBLE PRECISION NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "triggered_features" JSONB NOT NULL,
    "action_items" JSONB NOT NULL,
    "retrieved_docs" JSONB NOT NULL,
    "llm_narrative" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'UNREAD',

    CONSTRAINT "AIAlerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeFeatures_company_id_user_id_idx" ON "EmployeeFeatures"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeFeatures_user_id_period_key" ON "EmployeeFeatures"("user_id", "period");

-- CreateIndex
CREATE INDEX "RiskScores_company_id_user_id_idx" ON "RiskScores"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "AIAlerts_company_id_user_id_idx" ON "AIAlerts"("company_id", "user_id");

-- AddForeignKey
ALTER TABLE "EmployeeFeatures" ADD CONSTRAINT "EmployeeFeatures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeFeatures" ADD CONSTRAINT "EmployeeFeatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScores" ADD CONSTRAINT "RiskScores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScores" ADD CONSTRAINT "RiskScores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAlerts" ADD CONSTRAINT "AIAlerts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAlerts" ADD CONSTRAINT "AIAlerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
