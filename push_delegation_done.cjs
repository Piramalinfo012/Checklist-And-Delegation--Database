const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fhbkzqgulnlyxubsnegl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmt6cWd1bG5seXh1YnNuZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjE1NzYsImV4cCI6MjEwNDY5NzU3Nn0.UqZmR7fD1lNCEVClx4BUQr9MZgO4-JNv0aqrB5dpIeI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CSV_FILE = 'DELEGATION DONE.csv';

function cleanValue(val) {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed === '' ? null : trimmed;
}

async function run() {
  console.log('🚀 Starting DELEGATION DONE CSV import to Supabase...');
  const startTime = Date.now();

  const validCsvRows = [];
  let skipped = 0;

  console.log(`📖 Reading and parsing ${CSV_FILE}...`);
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (data) => {
        const tid = parseInt(data['Task id'], 10);
        const ts = cleanValue(data['Timestamp']);
        const desc = cleanValue(data['Task Description']);
        const status = cleanValue(data['Status']);

        if (!isNaN(tid) && (ts || desc || status)) {
          validCsvRows.push(data);
        } else {
          skipped++;
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const totalRows = validCsvRows.length;
  console.log(`✅ Parsed ${totalRows} valid rows (Skipped empty/header: ${skipped})`);

  const rowsToUpsert = [];
  const STARTING_ID = 1081;

  for (let i = 0; i < totalRows; i++) {
    const row = validCsvRows[i];
    const tid = parseInt(row['Task id'], 10);
    const id = STARTING_ID + i;

    const formattedRow = {
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
    };

    rowsToUpsert.push(formattedRow);
  }

  console.log(`📦 Pushing ${rowsToUpsert.length} records in batches of 100...`);

  // Batch Upsert
  const BATCH_SIZE = 100;
  for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
    const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
    const { error: upsertErr } = await supabase
      .from('DELEGATION DONE')
      .upsert(batch, { onConflict: 'id' });

    if (upsertErr) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, upsertErr);
      process.exit(1);
    }
    console.log(`Pushed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rowsToUpsert.length / BATCH_SIZE)} (${batch.length} rows)`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 All ${rowsToUpsert.length} DELEGATION DONE records successfully updated in Supabase in ${durationSec}s!`);

  // Verification
  console.log('\n🔍 Verifying Supabase DELEGATION DONE table count...');
  const { count, error: countErr } = await supabase
    .from('DELEGATION DONE')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Count error:', countErr);
  } else {
    console.log(`📊 Current Total Count in 'DELEGATION DONE' table: ${count}`);
  }
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
