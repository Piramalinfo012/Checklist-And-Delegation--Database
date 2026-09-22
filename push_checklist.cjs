const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fhbkzqgulnlyxubsnegl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmt6cWd1bG5seXh1YnNuZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjE1NzYsImV4cCI6MjEwNDY5NzU3Nn0.UqZmR7fD1lNCEVClx4BUQr9MZgO4-JNv0aqrB5dpIeI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BATCH_SIZE = 500;
const CSV_FILE = 'Checklist.csv';

function cleanValue(val) {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed === '' ? null : trimmed;
}

function cleanRow(row) {
  const taskId = parseInt(row['Task ID'], 10);
  if (isNaN(taskId)) return null;

  return {
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
  };
}

async function upsertBatchWithRetry(batch, batchNum, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase
        .from('Checklist')
        .upsert(batch, { onConflict: 'Task ID' });

      if (error) {
        throw error;
      }
      return true;
    } catch (err) {
      console.warn(`⚠️ Batch ${batchNum} attempt ${attempt} failed: ${err.message || err}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        throw new Error(`Batch ${batchNum} permanently failed after ${maxRetries} attempts: ${err.message || err}`);
      }
    }
  }
}

async function run() {
  console.log('🚀 Starting Checklist CSV import to Supabase...');
  const startTime = Date.now();

  const rows = [];
  let skipped = 0;

  console.log(`📖 Reading and parsing ${CSV_FILE}...`);
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (data) => {
        const cleaned = cleanRow(data);
        if (cleaned) {
          rows.push(cleaned);
        } else {
          skipped++;
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const totalRows = rows.length;
  console.log(`✅ Parsed ${totalRows} valid rows (Skipped invalid: ${skipped})`);

  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
  console.log(`📦 Total batches to push: ${totalBatches} (Batch Size: ${BATCH_SIZE})`);

  let pushedRows = 0;

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, totalRows);
    const batch = rows.slice(startIdx, endIdx);

    await upsertBatchWithRetry(batch, i + 1);
    pushedRows += batch.length;

    const progressPct = ((pushedRows / totalRows) * 100).toFixed(1);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Batch ${i + 1}/${totalBatches}] Pushed ${pushedRows}/${totalRows} (${progressPct}%) | Elapsed: ${elapsedSec}s`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 All ${pushedRows} rows successfully upserted into 'Checklist' in ${durationSec}s!`);

  // Verification
  console.log('\n🔍 Verifying Supabase Checklist table count...');
  const { count, error: countErr } = await supabase
    .from('Checklist')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Count check error:', countErr);
  } else {
    console.log(`📊 Current Total Count in 'Checklist' table: ${count}`);
  }
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
