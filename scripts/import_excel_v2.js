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
      output.event_type = normalizeEventType(row.event_type);
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

const escapeSql = (value) => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
};

const validEventTypes = ['CREATED', 'UPDATED', 'DELETED', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'REPLIED', 'LOCKED', 'CLONED', 'REMINDER'];
const eventTypeMapping = {
  'UNLOCKED': 'LOCKED',
  'CLONED ': 'CLONED',
};

const normalizeEventType = (value) => {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  
  // Check if it's already valid
  if (validEventTypes.includes(upper)) {
    return upper;
  }
  
  // Check if we have a mapping for it
  if (eventTypeMapping[upper]) {
    return eventTypeMapping[upper];
  }
  
  // Default fallback
  return 'STATUS_CHANGED';
};

const tableMap = {
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
  Notification_Recipients: 'NotificationRecipients',
  AI_Usage_Logs: 'AIUsageLogs',
};

const getColumns = (sheetName) => {
  const columnMap = {
    Companies: ['id', 'name', 'slug', 'logo', 'is_active', 'ai_plan', 'token_usage', 'credit_cost', 'usage_limit', 'created_at'],
    Units: ['id', 'company_id', 'name', 'parent_id', 'manager_id', 'path', 'deleted_at', 'created_at'],
    Users: ['id', 'company_id', 'full_name', 'email', 'password', 'avatar_url', 'job_title', 'role', 'unit_id', 'is_active', 'deleted_at', 'created_at'],
    Cycles: ['id', 'company_id', 'name', 'start_date', 'end_date', 'is_locked'],
    KPI_Dictionaries: ['id', 'company_id', 'name', 'description', 'unit', 'evaluation_method', 'unit_id', 'deleted_at'],
    KPI_Assignments: ['id', 'company_id', 'parent_assignment_id', 'kpi_dictionary_id', 'cycle_id', 'owner_id', 'unit_id', 'visibility', 'access_path', 'start_value', 'target_value', 'current_value', 'progress_percentage', 'due_date', 'deleted_at', 'created_at'],
    KPI_Records: ['id', 'company_id', 'kpi_assignment_id', 'period_start', 'period_end', 'actual_value', 'progress_percentage', 'evidence_url', 'status', 'trend', 'created_at'],
    Objectives: ['id', 'company_id', 'title', 'description', 'cycle_id', 'unit_id', 'owner_id', 'parent_objective_id', 'visibility', 'access_path', 'status', 'approved_by', 'progress_percentage', 'deleted_at', 'created_at'],
    Key_Results: ['id', 'company_id', 'objective_id', 'title', 'start_value', 'target_value', 'current_value', 'unit', 'weight', 'due_date', 'progress_percentage', 'evaluation_method', 'deleted_at'],
    Check_Ins: ['id', 'company_id', 'key_result_id', 'user_id', 'achieved_value', 'progress_snapshot', 'evidence_url', 'comment', 'created_at'],
    Feedbacks: ['id', 'company_id', 'objective_id', 'kr_tag_id', 'user_id', 'parent_id', 'content', 'sentiment', 'status', 'created_at', 'updated_at'],
    Notifications: ['id', 'company_id', 'event_type', 'ref_type', 'ref_id', 'message', 'created_at'],
    Notification_Recipients: ['notification_id', 'recipient_id', 'read_at'],
    AI_Usage_Logs: ['company_id', 'user_id', 'feature_name', 'model_name', 'input_tokens', 'output_tokens', 'total_tokens', 'request_id', 'credit_cost', 'status', 'created_at'],
  };
  return columnMap[sheetName] || [];
};

const buildInsertQuery = (sheetName, row) => {
  const tableName = tableMap[sheetName];
  const columns = getColumns(sheetName);
  
  // Filter columns based on whether values exist
  const actualColumns = [];
  const actualValues = [];
  
  for (const col of columns) {
    if (row[col] !== undefined) {
      // Skip foreign keys that reference tables we'll update later
      if ((sheetName === 'Users' && col === 'unit_id') ||
          (sheetName === 'Units' && col === 'manager_id')) {
        continue;
      }
      actualColumns.push(`"${col}"`);
      actualValues.push(escapeSql(row[col]));
    }
  }
  
  const columnsStr = actualColumns.join(', ');
  const valuesStr = actualValues.join(', ');
  
  return `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${valuesStr});`;
};

const buildUpdateQueries = (sheetName, rows) => {
  const tableName = tableMap[sheetName];
  const queries = [];
  
  if (sheetName === 'Users') {
    for (const row of rows) {
      if (row.unit_id !== null && row.unit_id !== undefined) {
        queries.push(`UPDATE "${tableName}" SET "unit_id" = ${escapeSql(row.unit_id)} WHERE "id" = ${escapeSql(row.id)};`);
      }
    }
  } else if (sheetName === 'Units') {
    for (const row of rows) {
      if (row.manager_id !== null && row.manager_id !== undefined) {
        queries.push(`UPDATE "${tableName}" SET "manager_id" = ${escapeSql(row.manager_id)} WHERE "id" = ${escapeSql(row.id)};`);
      }
    }
  }
  
  return queries;
};

const modelOrder = [
  'Companies',
  'Users',
  'Units',
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

  try {
    // Truncate tables
    console.log('Truncating tables...');
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE "NotificationRecipients", "Notifications", "Feedbacks", "CheckIns", 
      "KPIRecords", "KeyResults", "Objectives", "KPIAssignments", "KPIDictionaries", 
      "Cycles", "Users", "Units", "Companies" RESTART IDENTITY CASCADE;
    `);

    // Import data by executing raw SQL in batches
    for (const sheetName of modelOrder) {
      const sheetRows = rowsBySheet[sheetName];
      if (!sheetRows.length) {
        console.log(`No rows found for ${sheetName}`);
        continue;
      }

      console.log(`Inserting ${sheetRows.length} rows into ${sheetName}...`);
      
      // Batch insert: group every 100 rows and execute as one SQL statement
      const batchSize = 100;
      for (let i = 0; i < sheetRows.length; i += batchSize) {
        const batch = sheetRows.slice(i, i + batchSize);
        const queries = batch.map(row => buildInsertQuery(sheetName, row));
        const batchQuery = queries.join('\n');
        
        try {
          await prisma.$executeRawUnsafe(batchQuery);
        } catch (error) {
          console.error(`Error inserting batch into ${sheetName}:`, error.message);
          throw error;
        }
      }
    }

    // Update foreign key references that were skipped during insert
    console.log('Updating foreign key references...');
    for (const sheetName of ['Users', 'Units']) {
      const sheetRows = rowsBySheet[sheetName];
      const updateQueries = buildUpdateQueries(sheetName, sheetRows);
      
      // Batch update: group every 100 updates
      const batchSize = 100;
      for (let i = 0; i < updateQueries.length; i += batchSize) {
        const batch = updateQueries.slice(i, i + batchSize);
        const batchQuery = batch.join('\n');
        
        try {
          if (batchQuery.trim()) {
            await prisma.$executeRawUnsafe(batchQuery);
          }
        } catch (error) {
          console.error(`Error updating foreign keys in ${sheetName}:`, error.message);
          throw error;
        }
      }
    }

    // Reset sequences
    console.log('Resetting sequences...');
    for (const sheetName of modelOrder) {
      const tableName = tableMap[sheetName];
      if (tableName && sheetName !== 'Notification_Recipients' && sheetName !== 'AI_Usage_Logs') {
        try {
          await prisma.$executeRawUnsafe(sequenceResetSql(tableName));
        } catch (error) {
          // Sequence might not exist, that's ok
        }
      }
    }

    console.log('✅ Excel data import completed successfully!');
  } catch (error) {
    console.error('Excel import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

importData();
