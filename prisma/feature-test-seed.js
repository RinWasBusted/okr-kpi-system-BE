import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function splitSqlList(listText) {
  const items = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < listText.length; i++) {
    const char = listText[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '(' && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
    } else if (char === ')' && !inSingleQuote && !inDoubleQuote) {
      parenDepth--;
    }

    if (char === ',' && !inSingleQuote && !inDoubleQuote && parenDepth === 0) {
      items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    items.push(current.trim());
  }

  return items;
}

function getInsertTableName(statement) {
  const match = statement.match(/INSERT\s+INTO\s+(?:(?:"[^"]+"|\w+)\.)?(?:"([^"]+)"|(\w+))/i);
  return match ? (match[1] || match[2]) : null;
}

async function main() {
  try {
    console.log('Starting feature test seed...');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'Testdata', 'seed_all_excellent.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Define the correct insert order
    const tableOrder = [
      'Companies',
      'Users',  // Insert Users before Units because Units.manager_id references Users
      'Units',
      'Cycles',
      'KPIDictionaries',
      'KPIAssignments',
      'KPIRecords',
      'Objectives',
      'KeyResults',
      'CheckIns',
      'Feedbacks',
      'Notifications',
      'NotificationRecipients',
      'AIUsageLogs'
    ];
    const skippedTables = new Set(['Evaluations']);

    // Split SQL into statements and strip comments from each chunk
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.replace(/--.*$/gm, '').trim())
      .filter(stmt => stmt.length > 0); 

    // Group statements by table
    const tableStatements = {};
    const userUnitUpdates = [];
    const extraTables = new Set();
    const skippedTableCounts = {};
    for (const table of tableOrder) {
      tableStatements[table] = [];
    }

    for (const statement of statements) {
      if (statement.toUpperCase().includes('INSERT INTO')) {
        const tableName = getInsertTableName(statement);
        if (!tableName) {
          console.warn('Unable to parse INSERT target from statement:', statement.slice(0, 120));
          continue;
        }

        if (skippedTables.has(tableName)) {
          skippedTableCounts[tableName] = (skippedTableCounts[tableName] || 0) + 1;
          continue;
        }

        const normalizedTableName = tableName;
        if (!tableStatements[normalizedTableName]) {
          tableStatements[normalizedTableName] = [];
          extraTables.add(normalizedTableName);
        }

        if (normalizedTableName === 'Users') {
          const insertMatch = statement.match(/INSERT\s+INTO\s+(?:(?:"[^"]+"|\w+)\.)?"Users"\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
          if (insertMatch) {
            const columns = splitSqlList(insertMatch[1]);
            const values = splitSqlList(insertMatch[2]);
            const idIndex = columns.findIndex(col => col.replace(/['"\s]/g, '') === 'id');
            const unitIndex = columns.findIndex(col => col.replace(/['"\s]/g, '') === 'unit_id');

            if (idIndex !== -1 && unitIndex !== -1) {
              const originalUnitValue = values[unitIndex].trim();
              if (originalUnitValue.toUpperCase() !== 'NULL') {
                userUnitUpdates.push({
                  id: values[idIndex].trim(),
                  unitId: originalUnitValue,
                });
              }
              values[unitIndex] = 'NULL';
              const modifiedStatement = `INSERT INTO "Users" (${columns.join(', ')}) VALUES (${values.join(', ')})`;
              tableStatements[normalizedTableName].push(modifiedStatement + ';');
              continue;
            }
          }
        }

        tableStatements[normalizedTableName].push(statement + ';');
      }
    }

    // Clean existing feature test data and reset identities
    console.log('Truncating feature test tables...');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "NotificationRecipients", "Notifications", "AIUsageLogs", "Feedbacks", "CheckIns", "KeyResults", "Objectives", "KPIRecords", "KPIAssignments", "KPIDictionaries", "Cycles", "Units", "Users", "Companies" RESTART IDENTITY CASCADE;`);

    // Execute in correct order, then any extra parsed tables
    const executionOrder = [...tableOrder];
    for (const tableName of Object.keys(tableStatements)) {
      if (!executionOrder.includes(tableName)) {
        executionOrder.push(tableName);
      }
    }

    for (const table of executionOrder) {
      if (tableStatements[table]?.length > 0) {
        console.log(`Inserting into ${table}... (${tableStatements[table].length} statements)`);
        let successCount = 0;
        for (let idx = 0; idx < tableStatements[table].length; idx++) {
          const stmt = tableStatements[table][idx];
          try {
            await prisma.$executeRawUnsafe(stmt);
            successCount++;
          } catch (error) {
            console.error(`Error in ${table} statement ${idx + 1}/${tableStatements[table].length}:`, stmt);
            throw error;
          }
        }
        console.log(`Completed ${table}: ${successCount} inserted`);
      }
    }

    for (const [tableName, count] of Object.entries(skippedTableCounts)) {
      console.warn(`Skipped ${count} INSERT statements for ${tableName} because the table does not exist in the current database schema.`);
    }

    // Restore unit_id values after Units are inserted
    if (userUnitUpdates.length > 0) {
      console.log(`Updating ${userUnitUpdates.length} Users unit_id values...`);
      for (const update of userUnitUpdates) {
        await prisma.$executeRawUnsafe(`UPDATE "Users" SET unit_id = ${update.unitId} WHERE id = ${update.id};`);
      }
      console.log('Users unit_id restore complete.');
    }

    console.log('Feature test seed completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });