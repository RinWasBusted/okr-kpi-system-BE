/*
  Warnings:

  - You are about to drop the column `is_read` on the `Notifications` table. All the data in the column will be lost.
  - You are about to drop the column `recipient_id` on the `Notifications` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Notifications` table. All the data in the column will be lost.
  - Added the required column `event_type` to the `Notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `Notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ref_type` to the `Notifications` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('KPI', 'OBJECTIVE', 'CYCLE', 'UNIT', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'REMINDER');

-- DropForeignKey
ALTER TABLE "Notifications" DROP CONSTRAINT "Notifications_recipient_id_fkey";

-- DropIndex
DROP INDEX "Notifications_company_id_idx";

-- AlterTable
ALTER TABLE "Notifications" DROP COLUMN "is_read",
DROP COLUMN "recipient_id",
DROP COLUMN "type",
ADD COLUMN     "event_type" "EventType" NOT NULL,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
DROP COLUMN "ref_type",
ADD COLUMN     "ref_type" "ReferenceType" NOT NULL;

-- CreateTable
CREATE TABLE "NotificationRecipients" (
    "notification_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "NotificationRecipients_pkey" PRIMARY KEY ("notification_id","recipient_id")
);

-- CreateIndex
CREATE INDEX "NotificationRecipients_recipient_id_read_at_idx" ON "NotificationRecipients"("recipient_id", "read_at");

-- AddForeignKey
ALTER TABLE "NotificationRecipients" ADD CONSTRAINT "NotificationRecipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "Notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipients" ADD CONSTRAINT "NotificationRecipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
