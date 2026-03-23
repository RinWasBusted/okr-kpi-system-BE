/*
  Warnings:

  - A unique constraint covering the columns `[email,company_id]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Users_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_company_id_key" ON "Users"("email", "company_id");
