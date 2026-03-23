-- DropIndex
DROP INDEX "Users_company_id_email_key";

-- AlterTable
ALTER TABLE "Users" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
