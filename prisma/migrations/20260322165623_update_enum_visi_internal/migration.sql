/*
  Warnings:

  - The values [COMPANY] on the enum `Visibility` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Visibility_new" AS ENUM ('PUBLIC', 'PRIVATE', 'INTERNAL');
ALTER TABLE "KPIAssignments" ALTER COLUMN "visibility" TYPE "Visibility_new" USING ("visibility"::text::"Visibility_new");
ALTER TABLE "Objectives" ALTER COLUMN "visibility" TYPE "Visibility_new" USING ("visibility"::text::"Visibility_new");
ALTER TYPE "Visibility" RENAME TO "Visibility_old";
ALTER TYPE "Visibility_new" RENAME TO "Visibility";
DROP TYPE "public"."Visibility_old";
COMMIT;
