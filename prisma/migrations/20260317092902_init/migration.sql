-- CreateTable
CREATE TABLE "Companies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Units" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "manager_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "unit_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cycles" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIDictionaries" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "evaluation_method" TEXT NOT NULL,
    "unit_id" INTEGER,

    CONSTRAINT "KPIDictionaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIAssignments" (
    "id" SERIAL NOT NULL,
    "parent_assignment_id" INTEGER,
    "kpi_dictionary_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "owner_id" INTEGER,
    "unit_id" INTEGER NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KPIAssignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIRecords" (
    "id" SERIAL NOT NULL,
    "kpi_assignment_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "actual_value" DOUBLE PRECISION NOT NULL,
    "progress_percentage" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KPIRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objectives" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "owner_id" INTEGER,
    "parent_objective_id" INTEGER,
    "status" TEXT NOT NULL,
    "approved_by" INTEGER,
    "progress_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResults" (
    "id" SERIAL NOT NULL,
    "objective_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "due_date" DATE NOT NULL,
    "progress_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "KeyResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIns" (
    "id" SERIAL NOT NULL,
    "key_result_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "achieved_value" DOUBLE PRECISION NOT NULL,
    "progress_snapshot" DOUBLE PRECISION NOT NULL,
    "evidence_url" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedbacks" (
    "id" SERIAL NOT NULL,
    "objective_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluations" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "rank" TEXT NOT NULL,
    "comment" TEXT,

    CONSTRAINT "Evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Companies_slug_key" ON "Companies"("slug");

-- AddForeignKey
ALTER TABLE "Units" ADD CONSTRAINT "Units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Units" ADD CONSTRAINT "Units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Units" ADD CONSTRAINT "Units_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cycles" ADD CONSTRAINT "Cycles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIDictionaries" ADD CONSTRAINT "KPIDictionaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIDictionaries" ADD CONSTRAINT "KPIDictionaries_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_parent_assignment_id_fkey" FOREIGN KEY ("parent_assignment_id") REFERENCES "KPIAssignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_kpi_dictionary_id_fkey" FOREIGN KEY ("kpi_dictionary_id") REFERENCES "KPIDictionaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "Cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIAssignments" ADD CONSTRAINT "KPIAssignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIRecords" ADD CONSTRAINT "KPIRecords_kpi_assignment_id_fkey" FOREIGN KEY ("kpi_assignment_id") REFERENCES "KPIAssignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "Cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objectives" ADD CONSTRAINT "Objectives_parent_objective_id_fkey" FOREIGN KEY ("parent_objective_id") REFERENCES "Objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResults" ADD CONSTRAINT "KeyResults_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "Objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIns" ADD CONSTRAINT "CheckIns_key_result_id_fkey" FOREIGN KEY ("key_result_id") REFERENCES "KeyResults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIns" ADD CONSTRAINT "CheckIns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedbacks" ADD CONSTRAINT "Feedbacks_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "Objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedbacks" ADD CONSTRAINT "Feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluations" ADD CONSTRAINT "Evaluations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "Cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
