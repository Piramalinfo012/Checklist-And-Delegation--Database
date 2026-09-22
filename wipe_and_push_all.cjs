const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fhbkzqgulnlyxubsnegl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmt6cWd1bG5seXh1YnNuZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjE1NzYsImV4cCI6MjEwNDY5NzU3Nn0.UqZmR7fD1lNCEVClx4BUQr9MZgO4-JNv0aqrB5dpIeI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function cleanValue(val) {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed === '' ? null : trimmed;
}

// ----------------------------------------------------
// 1. Wipe all 3 tables
// ----------------------------------------------------
async function wipeTables() {
  console.log('🧹 [1/4] BLANKING ALL 3 TABLES IN SUPABASE...');
  
  // Wipe Checklist
  console.log('  -> Wiping Checklist table...');
  const { error: errC } = await supabase.from('Checklist').delete().neq('Task ID', -999999);
  if (errC) throw new Error('Failed to wipe Checklist: ' + errC.message);

  // Wipe Delegation
  console.log('  -> Wiping Delegation table...');
  const { error: errD } = await supabase.from('Delegation').delete().neq('Task ID', -999999);
  if (errD) throw new Error('Failed to wipe Delegation: ' + errD.message);

  // Wipe DELEGATION DONE
  console.log('  -> Wiping DELEGATION DONE table...');
  const { error: errDD } = await supabase.from('DELEGATION DONE').delete().neq('id', -999999);
  if (errDD) throw new Error('Failed to wipe DELEGATION DONE: ' + errDD.message);

  console.log('✅ All 3 tables are now completely BLANK (0 rows).\n');
}

// ----------------------------------------------------
// 2. Push Checklist Table
// ----------------------------------------------------
async function pushChecklist() {
  console.log('🚀 [2/4] Pushing Checklist.csv -> Checklist table...');
  const startTime = Date.now();
  const rows = [];
  let skipped = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream('Checklist.csv')
      .pipe(csv())
      .on('data', (row) => {
        const taskId = parseInt(row['Task ID'], 10);
        if (isNaN(taskId)) {
          skipped++;
          return;
        }
        rows.push({
          'Task ID': taskId,
          'Timestamp': cleanValue(row['Timestamp']),
          'Department': cleanValue(row['Department']),
          'Given By': cleanValue(row['Given By']),
          'Name': cleanValue(row['Name']),
          'Tast Descriptions': cleanValue(row['Tast Descriptions']),
          'Task Start Date': cleanValue(row['Task Start Date']),
          'Freq': cleanValue(row['Freq']),
          'Enable Reminders': cleanValue(row['Enable Reminders']),
          'Require Attachment': cleanValue(row['Require Attachment']),
          'Actual': cleanValue(row['Actual']),
          'Delay': cleanValue(row['Delay']),
          'Status': cleanValue(row['Status']),
          'Remarks': cleanValue(row['Remarks']),
          'Uploaded Image': cleanValue(row['Uploaded Image'])
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const totalRows = rows.length;
  console.log(`  Parsed ${totalRows} valid Checklist rows (Skipped: ${skipped})`);

  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    
    // Insert with retry
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.from('Checklist').insert(batch);
      if (!error) {
        success = true;
        break;
      }
      console.warn(`  ⚠️ Checklist batch ${i + 1} attempt ${attempt} failed: ${error.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
    if (!success) throw new Error(`Checklist batch ${i + 1} failed permanently.`);

    if ((i + 1) % 20 === 0 || i + 1 === totalBatches) {
      const pct = (((i + 1) / totalBatches) * 100).toFixed(0);
      console.log(`  [Batch ${i + 1}/${totalBatches}] ${pct}% completed (${Math.min((i + 1) * BATCH_SIZE, totalRows)}/${totalRows})`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Checklist pushed: ${totalRows} rows in ${duration}s.\n`);
}

// ----------------------------------------------------
// 3. Push Delegation Table
// ----------------------------------------------------
async function pushDelegation() {
  console.log('🚀 [3/4] Pushing Delegation.csv -> Delegation table...');
  const startTime = Date.now();
  const rawRows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream('Delegation.csv')
      .pipe(csv())
      .on('data', d => rawRows.push(d))
      .on('end', resolve)
      .on('error', reject);
  });

  const rowsToInsert = [];
  const seenIds = new Set();

  for (const row of rawRows) {
    const desc = cleanValue(row['Task Description']);
    if (!desc) continue;

    let tid = parseInt(row['Task ID'], 10);
    if (isNaN(tid)) continue;

    // Resolve duplicate Task IDs from Excel to unique DB IDs
    if (tid === 106 && desc.includes('blue bottle oil')) {
      tid = 152;
    } else if (tid === 122 && desc.includes('Rice bran waste')) {
      tid = 153;
    } else if (tid === 125 && desc.includes('Expo of Bharat recycling')) {
      tid = 154;
    }

    if (seenIds.has(tid)) continue;
    seenIds.add(tid);

    rowsToInsert.push({
      'Task ID': tid,
      'Timestamp': cleanValue(row['Timestamp']),
      'Department': cleanValue(row['Department']),
      'Given By': cleanValue(row['Given By']),
      'Name': cleanValue(row['Name']),
      'Task Description': desc,
      'Task Start Date': cleanValue(row['Task Start Date']),
      'Freq': cleanValue(row['Freq']),
      'Enable Reminders': cleanValue(row['Enable Reminders']),
      'Require Attachment': cleanValue(row['Require Attachment']),
      'Planned Date': cleanValue(row['Planned Date']),
      'Actual': cleanValue(row['Actual']),
      'Delay': cleanValue(row['Delay']),
      'Status': cleanValue(row['Status']),
      'Remarks': cleanValue(row['Remarks']),
      'Upload Imgage': cleanValue(row['Upload Imgage']),
      'Update Date': cleanValue(row['Update Date']),
      'Color Code For': cleanValue(row['Color Code For']),
      'Color Code': cleanValue(row['Color Code']),
      'Admin Done': cleanValue(row['Admin Done']),
      'Filter Condition': cleanValue(row['Filter Condition'])
    });
  }

  // Insert Delegation
  const { error } = await supabase.from('Delegation').insert(rowsToInsert);
  if (error) throw new Error('Failed to insert Delegation rows: ' + error.message);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Delegation pushed: ${rowsToInsert.length} rows in ${duration}s.\n`);
}

// ----------------------------------------------------
// 4. Push DELEGATION DONE Table
// ----------------------------------------------------
async function pushDelegationDone() {
  console.log('🚀 [4/4] Pushing DELEGATION DONE.csv -> DELEGATION DONE table...');
  const startTime = Date.now();
  const validCsvRows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream('DELEGATION DONE.csv')
      .pipe(csv())
      .on('data', (data) => {
        const tid = parseInt(data['Task id'], 10);
        const ts = cleanValue(data['Timestamp']);
        const desc = cleanValue(data['Task Description']);
        const status = cleanValue(data['Status']);

        if (!isNaN(tid) && (ts || desc || status)) {
          validCsvRows.push(data);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const rowsToInsert = [];
  const STARTING_ID = 1081;

  for (let i = 0; i < validCsvRows.length; i++) {
    const row = validCsvRows[i];
    const tid = parseInt(row['Task id'], 10);
    const id = STARTING_ID + i;

    rowsToInsert.push({
      id: id,
      'Timestamp': cleanValue(row['Timestamp']),
      'Task id': tid,
      'Status': cleanValue(row['Status']),
      'Next extend date': cleanValue(row['Next extend date']),
      'Reason': cleanValue(row['Reason']),
      'Upload Image': cleanValue(row['Upload Image']),
      'Condition Date': cleanValue(row['Condition Date']),
      'Name': cleanValue(row['Name']),
      'Task Description': cleanValue(row['Task Description']),
      'Given By': cleanValue(row['Given By']),
      'Admin Done': cleanValue(row['Admin Done'])
    });
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('DELEGATION DONE').insert(batch);
    if (error) throw new Error('Failed to insert DELEGATION DONE batch: ' + error.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ DELEGATION DONE pushed: ${rowsToInsert.length} rows in ${duration}s.\n`);
}

// ----------------------------------------------------
// Main Execution
// ----------------------------------------------------
async function main() {
  const overallStart = Date.now();
  console.log('========================================');
  console.log('  FULL DATABASE RESET & RE-IMPORT');
  console.log('========================================\n');

  await wipeTables();
  await pushChecklist();
  await pushDelegation();
  await pushDelegationDone();

  console.log('========================================');
  console.log('  FINAL VERIFICATION');
  console.log('========================================');

  const { count: cCount } = await supabase.from('Checklist').select('*', { count: 'exact', head: true });
  const { count: dCount } = await supabase.from('Delegation').select('*', { count: 'exact', head: true });
  const { count: ddCount } = await supabase.from('DELEGATION DONE').select('*', { count: 'exact', head: true });

  console.log(`📊 Checklist Total Rows:       ${cCount}`);
  console.log(`📊 Delegation Total Rows:      ${dCount}`);
  console.log(`📊 DELEGATION DONE Total Rows: ${ddCount}`);
  
  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log(`\n🎉 ALL 3 TABLES SUCCESSFULLY WIPED AND RE-POPULATED IN ${totalDuration}s!`);
}

main().catch(err => {
  console.error('❌ Migration Failed:', err);
  process.exit(1);
});
