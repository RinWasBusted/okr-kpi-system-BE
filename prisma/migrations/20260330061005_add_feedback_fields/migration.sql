/*
  Warnings:

  - Changed the type of `type` on the `Feedbacks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('PRAISE', 'CONCERN', 'SUGGESTION', 'QUESTION', 'BLOCKER');

-- CreateEnum
CREATE TYPE "FeedbackSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'FLAGGED');

-- AlterTable
ALTER TABLE "Feedbacks" ADD COLUMN     "kr_tag_id" INTEGER,
ADD COLUMN     "parent_id" INTEGER,
ADD COLUMN     "sentiment" "FeedbackSentiment" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "status" "FeedbackStatus" NOT NULL DEFAULT 'ACTIVE',
DROP COLUMN "type",
ADD COLUMN     "type" "FeedbackType" NOT NULL;

-- CreateIndex
CREATE INDEX "Feedbacks_objective_id_idx" ON "Feedbacks"("objective_id");

-- AddForeignKey
ALTER TABLE "Feedbacks" ADD CONSTRAINT "Feedbacks_kr_tag_id_fkey" FOREIGN KEY ("kr_tag_id") REFERENCES "KeyResults"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedbacks" ADD CONSTRAINT "Feedbacks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Feedbacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
