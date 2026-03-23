/*
  Warnings:

  - A unique constraint covering the columns `[company_id,email]` on the table `Users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Users_company_id_email_key" ON "Users"("company_id", "email");
