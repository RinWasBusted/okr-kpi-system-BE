/*
  Warnings:

  - Added the required column `access_path` to the `KPIAssignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `access_path` to the `Objectives` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `Units` table without a default value. This is not possible if the table is not empty.

*/

CREATE EXTENSION IF NOT EXISTS ltree;

-- AlterTable
ALTER TABLE "KPIAssignments" ADD COLUMN     "access_path" ltree NOT NULL;

-- AlterTable
ALTER TABLE "Objectives" ADD COLUMN     "access_path" ltree NOT NULL;

-- AlterTable
ALTER TABLE "Units" ADD COLUMN     "path" ltree NOT NULL;
