import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import xlsx from 'xlsx';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});
const EXCEL_PATH = 'C:/Users/phuoc/Downloads/kpi_okr_data_fixed.xlsx';

const normalizeNull = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
};

const parseBoolean = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  return text === 'true' || text === 't' || text === '1';
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const readSheet = (workbook, name) => {
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new Error(`Sheet not found: ${name}`);
  }
  return xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
};

const modelMap = {
  Companies: 'companies',
  Units: 'units',
  Users: 'users',
  Cycles: 'cycles',
  KPI_Dictionaries: 'kPIDictionaries',
  KPI_Assignments: 'kPIAssignments',
  KPI_Records: 'kPIRecords',
  Objectives: 'objectives',
  Key_Results: 'keyResults',
  Check_Ins: 'checkIns',
  Feedbacks: 'feedbacks',
  Notifications: 'notifications',
  Notification_Recipients: 'notificationRecipients',
  AI_Usage_Logs: 'aIUsageLogs',
};

const transformRow = (sheetName, row) => {
  const output = {};
  switch (sheetName) {
    case 'Companies':
      output.id = parseNumber(row.id);
      output.name = normalizeNull(row.name);
      output.slug = normalizeNull(row.slug);
      output.logo = normalizeNull(row.logo);
      output.is_active = parseBoolean(row.is_active);
      output.ai_plan = normalizeNull(row.ai_plan);
      output.token_usage = parseNumber(row.token_usage);
      output.credit_cost = parseNumber(row.credit_cost);
      output.usage_limit = parseNumber(row.usage_limit);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Units':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.name = normalizeNull(row.name);
      output.parent_id = parseNumber(row.parent_id);
      output.manager_id = parseNumber(row.manager_id);
      output.path = normalizeNull(row.path);
      output.deleted_at = parseDate(row.deleted_at);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Users':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.full_name = normalizeNull(row.full_name);
      output.email = normalizeNull(row.email);
      output.password = normalizeNull(row.password);
      output.avatar_url = normalizeNull(row.avatar_url);
      output.job_title = normalizeNull(row.job_title);
      output.role = normalizeNull(row.role);
      output.unit_id = parseNumber(row.unit_id);
      output.is_active = parseBoolean(row.is_active);
      output.deleted_at = parseDate(row.deleted_at);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Cycles':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.name = normalizeNull(row.name);
      output.start_date = parseDate(row.start_date);
      output.end_date = parseDate(row.end_date);
      output.is_locked = parseBoolean(row.is_locked);
      break;
    case 'KPI_Dictionaries':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.name = normalizeNull(row.name);
      output.description = normalizeNull(row.description);
      output.unit = normalizeNull(row.unit_measure ?? row.unit);
      output.evaluation_method = normalizeNull(row.evaluation_method);
      output.unit_id = parseNumber(row.unit_id);
      output.deleted_at = parseDate(row.deleted_at);
      break;
    case 'KPI_Assignments':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.parent_assignment_id = parseNumber(row.parent_assignment_id);
      output.kpi_dictionary_id = parseNumber(row.kpi_dictionary_id);
      output.cycle_id = parseNumber(row.cycle_id);
      output.owner_id = parseNumber(row.owner_id);
      output.unit_id = parseNumber(row.unit_id);
      output.visibility = normalizeNull(row.visibility);
      output.access_path = normalizeNull(row.access_path);
      output.start_value = parseNumber(row.start_value);
      output.target_value = parseNumber(row.target_value);
      output.current_value = parseNumber(row.current_value);
      output.progress_percentage = parseNumber(row.progress_percentage);
      output.due_date = parseDate(row.due_date);
      output.deleted_at = parseDate(row.deleted_at);
      output.created_at = parseDate(row.created_at);
      break;
    case 'KPI_Records':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.kpi_assignment_id = parseNumber(row.kpi_assignment_id);
      output.period_start = parseDate(row.period_start);
      output.period_end = parseDate(row.period_end);
      output.actual_value = parseNumber(row.actual_value);
      output.progress_percentage = parseNumber(row.progress_percentage);
      output.evidence_url = normalizeNull(row.evidence_url);
      output.status = normalizeNull(row.status);
      output.trend = normalizeNull(row.trend);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Objectives':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.title = normalizeNull(row.title);
      output.description = normalizeNull(row.description);
      output.cycle_id = parseNumber(row.cycle_id);
      output.unit_id = parseNumber(row.unit_id);
      output.owner_id = parseNumber(row.owner_id);
      output.parent_objective_id = parseNumber(row.parent_objective_id);
      output.visibility = normalizeNull(row.visibility);
      output.access_path = normalizeNull(row.access_path);
      output.status = normalizeNull(row.status);
      output.approved_by = parseNumber(row.approved_by);
      output.progress_percentage = parseNumber(row.progress_percentage);
      output.deleted_at = parseDate(row.deleted_at);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Key_Results':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.objective_id = parseNumber(row.objective_id);
      output.title = normalizeNull(row.title);
      output.start_value = parseNumber(row.start_value);
      output.target_value = parseNumber(row.target_value);
      output.current_value = parseNumber(row.current_value);
      output.unit = normalizeNull(row.unit);
      output.weight = parseNumber(row.weight);
      output.due_date = parseDate(row.due_date);
      output.progress_percentage = parseNumber(row.progress_percentage);
      output.evaluation_method = normalizeNull(row.evaluation_method);
      output.deleted_at = parseDate(row.deleted_at);
      break;
    case 'Check_Ins':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.key_result_id = parseNumber(row.key_result_id);
      output.user_id = parseNumber(row.user_id);
      output.achieved_value = parseNumber(row.achieved_value);
      output.progress_snapshot = parseNumber(row.progress_snapshot);
      output.evidence_url = normalizeNull(row.evidence_url);
      output.comment = normalizeNull(row.comment);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Feedbacks':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.objective_id = parseNumber(row.objective_id);
      output.kr_tag_id = parseNumber(row.kr_tag_id);
      output.user_id = parseNumber(row.user_id);
      output.parent_id = parseNumber(row.parent_id);
      output.content = normalizeNull(row.content);
      output.sentiment = normalizeNull(row.sentiment);
      output.status = normalizeNull(row.status);
      output.created_at = parseDate(row.created_at);
      output.updated_at = parseDate(row.updated_at);
      break;
    case 'Notifications':
      output.id = parseNumber(row.id);
      output.company_id = parseNumber(row.company_id);
      output.event_type = normalizeNull(row.event_type);
      output.ref_type = normalizeNull(row.ref_type);
      output.ref_id = parseNumber(row.ref_id);
      output.message = normalizeNull(row.message);
      output.created_at = parseDate(row.created_at);
      break;
    case 'Notification_Recipients':
      output.notification_id = parseNumber(row.notification_id);
      output.recipient_id = parseNumber(row.recipient_id);
      output.read_at = parseDate(row.read_at);
      break;
    case 'AI_Usage_Logs':
      output.id = normalizeNull(row.id) ? String(row.id) : null;
      output.company_id = parseNumber(row.company_id);
      output.user_id = parseNumber(row.user_id);
      output.feature_name = normalizeNull(row.feature_name);
      output.model_name = normalizeNull(row.model_name);
      output.input_tokens = parseNumber(row.input_tokens);
      output.output_tokens = parseNumber(row.output_tokens);
      output.total_tokens = parseNumber(row.total_tokens);
      output.request_id = normalizeNull(row.request_id);
      output.credit_cost = parseNumber(row.credit_cost);
      output.status = normalizeNull(row.status);
      output.created_at = parseDate(row.created_at);
      break;
    default:
      throw new Error(`Unknown sheet for transformation: ${sheetName}`);
  }
  return output;
};

const modelOrder = [
  'Companies',
  'Units',
  'Users',
  'Cycles',
  'KPI_Dictionaries',
  'KPI_Assignments',
  'Objectives',
  'Key_Results',
  'KPI_Records',
  'Check_Ins',
  'Feedbacks',
  'Notifications',
  'Notification_Recipients',
  'AI_Usage_Logs',
];

const getMaxIdQueries = {
  Companies: 'Companies',
  Units: 'Units',
  Users: 'Users',
  Cycles: 'Cycles',
  KPI_Dictionaries: 'KPIDictionaries',
  KPI_Assignments: 'KPIAssignments',
  KPI_Records: 'KPIRecords',
  Objectives: 'Objectives',
  Key_Results: 'KeyResults',
  Check_Ins: 'CheckIns',
  Feedbacks: 'Feedbacks',
  Notifications: 'Notifications',
  AI_Usage_Logs: 'AIUsageLogs',
};

const sequenceResetSql = (tableName) => {
  return `SELECT setval(pg_get_serial_sequence('"${tableName}"','id'), (SELECT COALESCE(MAX(id), 0) FROM "${tableName}"));`;
};

const importData = async () => {
  const workbook = xlsx.readFile(EXCEL_PATH, { cellDates: true });
  const rowsBySheet = {};
  for (const sheetName of modelOrder) {
    const rows = readSheet(workbook, sheetName).map((row) => transformRow(sheetName, row));
    rowsBySheet[sheetName] = rows.sort((a, b) => {
      if (a.id == null || b.id == null) return 0;
      return Number(a.id) - Number(b.id);
    });
  }

  await prisma.$connect();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.user_role','ADMIN', true), set_config('app.current_company_id','', true)`);
    await tx.$executeRawUnsafe('TRUNCATE TABLE "NotificationRecipients", "Notifications", "Feedbacks", "CheckIns", "KPIRecords", "KeyResults", "Objectives", "KPIAssignments", "KPIDictionaries", "Cycles", "Users", "Units", "Companies" RESTART IDENTITY CASCADE');

    for (const sheetName of modelOrder) {
      const modelKey = modelMap[sheetName];
      const sheetRows = rowsBySheet[sheetName];
      if (!sheetRows.length) {
        console.log(`No rows found for ${sheetName}`);
        continue;
      }
      const data = sheetRows.map((row) => {
        const obj = { ...row };
        if (sheetName === 'AI_Usage_Logs') {
          if (obj.id === null) {
            delete obj.id;
          }
        }
        return obj;
      });
      console.log(`Inserting ${sheetRows.length} rows into ${sheetName}`);
      for (const row of data) {
        await tx[modelKey].create({ data: row });
      }
    }

    for (const sheetName of modelOrder) {
      const tableName = getMaxIdQueries[sheetName];
      if (tableName) {
        await tx.$executeRawUnsafe(sequenceResetSql(tableName));
      }
    }
  });

  console.log('Excel data import completed successfully.');
};

importData()
  .catch((error) => {
    console.error('Excel import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
