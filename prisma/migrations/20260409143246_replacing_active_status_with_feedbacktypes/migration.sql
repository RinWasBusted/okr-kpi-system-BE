/*
  Warnings:

  - The values [ACTIVE] on the enum `FeedbackStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `type` on the `Feedbacks` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FeedbackStatus_new" AS ENUM ('PRAISE', 'CONCERN', 'SUGGESTION', 'QUESTION', 'BLOCKER', 'RESOLVED', 'FLAGGED');
ALTER TABLE "public"."Feedbacks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Feedbacks" ALTER COLUMN "status" TYPE "FeedbackStatus_new" USING ("status"::text::"FeedbackStatus_new");
ALTER TYPE "FeedbackStatus" RENAME TO "FeedbackStatus_old";
ALTER TYPE "FeedbackStatus_new" RENAME TO "FeedbackStatus";
DROP TYPE "public"."FeedbackStatus_old";
ALTER TABLE "Feedbacks" ALTER COLUMN "status" SET DEFAULT 'SUGGESTION';
COMMIT;

-- AlterTable
ALTER TABLE "Feedbacks" DROP COLUMN "type",
ALTER COLUMN "status" SET DEFAULT 'SUGGESTION';

-- DropEnum
DROP TYPE "FeedbackType";
