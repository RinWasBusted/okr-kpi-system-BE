-- CreateEnum
CREATE TYPE "KPIEvaluationType" AS ENUM ('MAXIMIZE', 'MINIMIZE', 'TARGET');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('Draft', 'Pending_Approval', 'Rejected', 'NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'CRITICAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "KPITrend" AS ENUM ('Upward', 'Downward', 'Stable');

-- AlterTable
ALTER TABLE "KPIAssignments" ADD COLUMN "due_date" TIMESTAMP(3);

-- AlterTable: convert evaluation_method from TEXT to KPIEvaluationType using value mapping
ALTER TABLE "KPIDictionaries"
ALTER COLUMN "evaluation_method" TYPE "KPIEvaluationType"
USING (
  CASE "evaluation_method"
    WHEN 'MAXIMIZE'    THEN 'MAXIMIZE'::"KPIEvaluationType"
    WHEN 'MINIMIZE'    THEN 'MINIMIZE'::"KPIEvaluationType"
    WHEN 'TARGET'      THEN 'TARGET'::"KPIEvaluationType"
    WHEN 'Positive'    THEN 'MAXIMIZE'::"KPIEvaluationType"
    WHEN 'Negative'    THEN 'MINIMIZE'::"KPIEvaluationType"
    WHEN 'Stabilizing' THEN 'TARGET'::"KPIEvaluationType"
    ELSE                    'MAXIMIZE'::"KPIEvaluationType"
  END
);

-- AlterTable: convert status from KPIStatus enum to ProgressStatus enum
ALTER TABLE "KPIRecords"
ALTER COLUMN "status" TYPE "ProgressStatus"
USING (
  CASE "status"::text
    WHEN 'ON_TRACK'  THEN 'ON_TRACK'::"ProgressStatus"
    WHEN 'AT_RISK'   THEN 'AT_RISK'::"ProgressStatus"
    WHEN 'CRITICAL'  THEN 'CRITICAL'::"ProgressStatus"
    ELSE                  'ON_TRACK'::"ProgressStatus"
  END
);

-- AlterTable: convert trend from TEXT to KPITrend enum
ALTER TABLE "KPIRecords"
ALTER COLUMN "trend" TYPE "KPITrend"
USING (
  CASE "trend"
    WHEN 'Upward'   THEN 'Upward'::"KPITrend"
    WHEN 'Downward' THEN 'Downward'::"KPITrend"
    WHEN 'Stable'   THEN 'Stable'::"KPITrend"
    ELSE                 'Stable'::"KPITrend"
  END
);

-- AlterTable: convert status from TEXT to ProgressStatus enum, mapping legacy values
ALTER TABLE "Objectives"
ALTER COLUMN "status" TYPE "ProgressStatus"
USING (
  CASE "status"
    WHEN 'Draft'            THEN 'Draft'::"ProgressStatus"
    WHEN 'Pending_Approval' THEN 'Pending_Approval'::"ProgressStatus"
    WHEN 'Rejected'         THEN 'Rejected'::"ProgressStatus"
    WHEN 'NOT_STARTED'      THEN 'NOT_STARTED'::"ProgressStatus"
    WHEN 'ON_TRACK'         THEN 'ON_TRACK'::"ProgressStatus"
    WHEN 'AT_RISK'          THEN 'AT_RISK'::"ProgressStatus"
    WHEN 'WARNING'          THEN 'AT_RISK'::"ProgressStatus"
    WHEN 'CRITICAL'         THEN 'CRITICAL'::"ProgressStatus"
    WHEN 'DANGER'           THEN 'CRITICAL'::"ProgressStatus"
    WHEN 'COMPLETED'        THEN 'COMPLETED'::"ProgressStatus"
    ELSE                         'Draft'::"ProgressStatus"
  END
);
ALTER TABLE "Objectives" ALTER COLUMN "status" SET DEFAULT 'Draft'::"ProgressStatus";

-- DropEnum
DROP TYPE "KPIStatus";

-- DropEnum
DROP TYPE "ObjectiveProgressStatus";
