const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fhbkzqgulnlyxubsnegl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmt6cWd1bG5seXh1YnNuZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjE1NzYsImV4cCI6MjEwNDY5NzU3Nn0.UqZmR7fD1lNCEVClx4BUQr9MZgO4-JNv0aqrB5dpIeI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CSV_FILE = 'Delegation.csv';

function cleanValue(val) {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed === '' ? null : trimmed;
}

async function run() {
  console.log('🚀 Starting Delegation CSV import to Supabase...');
  const startTime = Date.now();

  const rawCsvRows = [];
  console.log(`📖 Reading and parsing ${CSV_FILE}...`);
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (data) => rawCsvRows.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  const rowsToUpsert = [];
  const seenIds = new Set();

  for (const row of rawCsvRows) {
    const desc = cleanValue(row['Task Description']);
    if (!desc) continue; // Skip empty rows

    let tid = parseInt(row['Task ID'], 10);
    if (isNaN(tid)) continue;

    // Resolve duplicate Task IDs from Excel to their respective Supabase IDs
    if (tid === 106 && desc.includes('blue bottle oil')) {
      tid = 152;
    } else if (tid === 122 && desc.includes('Rice bran waste')) {
      tid = 153;
    } else if (tid === 125 && desc.includes('Expo of Bharat recycling')) {
      tid = 154;
    }

    if (seenIds.has(tid)) {
      console.warn(`⚠️ Skipping unexpected duplicate Task ID: ${tid}`);
      continue;
    }
    seenIds.add(tid);

    const formattedRow = {
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
    };

    rowsToUpsert.push(formattedRow);
  }

  console.log(`✅ Prepared ${rowsToUpsert.length} unique records for upsert.`);

  // Push to Supabase in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
    const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
    const { error: upsertErr } = await supabase
      .from('Delegation')
      .upsert(batch, { onConflict: 'Task ID' });

    if (upsertErr) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, upsertErr);
      process.exit(1);
    }
    console.log(`Pushed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rowsToUpsert.length / BATCH_SIZE)} (${batch.length} rows)`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 All ${rowsToUpsert.length} Delegation records successfully updated in Supabase in ${durationSec}s!`);

  // Verification
  console.log('\n🔍 Verifying Supabase Delegation table count...');
  const { count, error: countErr } = await supabase
    .from('Delegation')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Count error:', countErr);
  } else {
    console.log(`📊 Current Total Count in 'Delegation' table: ${count}`);
  }
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
