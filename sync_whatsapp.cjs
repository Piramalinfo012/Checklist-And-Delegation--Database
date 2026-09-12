const { execSync } = require('child_process');

async function sync() {
  console.log('1. Fetching live Whatsapp sheet data from Google Sheet...');
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec?sheet=Whatsapp';
  
  let jsonString;
  try {
    jsonString = execSync(`curl.exe -s -L "${SCRIPT_URL}"`, { maxBuffer: 10 * 1024 * 1024 }).toString('utf8');
  } catch (err) {
    console.error('Failed to curl Apps Script:', err.message);
    return;
  }

  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    const start = jsonString.indexOf('{');
    const end = jsonString.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      data = JSON.parse(jsonString.substring(start, end + 1));
    } else {
      console.error('Failed to parse JSON response.');
      return;
    }
  }

  const rawRows = data?.table?.rows || [];
  console.log(`Found ${rawRows.length} total rows in sheet.`);

  if (rawRows.length <= 1) {
    console.log('No data rows found.');
    return;
  }

  // Skip header row
  const rows = rawRows.slice(1);
  const seenNumbers = new Set();
  const records = [];

  rows.forEach((r, index) => {
    const c = r.c || [];
    const dept = c[0]?.v ? String(c[0].v).trim() : '';
    const givenBy = c[1]?.v ? String(c[1].v).trim() : '';
    const username = c[2]?.v ? String(c[2].v).trim() : '';
    const password = c[3]?.v ? String(c[3].v).trim() : '';
    const role = c[4]?.v ? String(c[4].v).trim() : 'user';
    const email = c[5]?.v ? String(c[5].v).trim() : '';
    let number = c[6]?.v ? String(c[6].v).trim() : '';
    const photo = c[7]?.v ? String(c[7].v).trim() : '';

    if (!username && !number) return; // Skip completely blank rows

    if (!number) {
      number = `NO_NUM_${username.replace(/\s+/g, '_') || index}`;
    }

    // If duplicate phone number exists in sheet (e.g. shared office phone), make it unique
    if (seenNumbers.has(number)) {
      console.log(`Note: Phone number ${number} is shared/duplicated by user "${username}". Suffixing username to preserve uniqueness.`);
      number = `${number}_${username.replace(/\s+/g, '_')}`;
    }
    seenNumbers.add(number);

    records.push({
      "Department": dept,
      "Given By": givenBy,
      "Username": username,
      "password": password,
      "Role": role,
      "Email": email,
      "Number": number,
      "Photo": photo
    });
  });

  console.log(`Prepared ${records.length} unique records for Supabase insertion.`);

  // Supabase Credentials
  const SUPABASE_URL = 'https://fhbkzqgulnlyxubsnegl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmt6cWd1bG5seXh1YnNuZWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjE1NzYsImV4cCI6MjEwNDY5NzU3Nn0.UqZmR7fD1lNCEVClx4BUQr9MZgO4-JNv0aqrB5dpIeI';

  console.log('2. Inserting records into Supabase "Whatsapp" table...');

  // First delete any existing to have a clean sync
  await fetch(`${SUPABASE_URL}/rest/v1/Whatsapp?Number=neq.DUMMY`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  // Batch insert
  const res = await fetch(`${SUPABASE_URL}/rest/v1/Whatsapp`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(records)
  });

  const resText = await res.text();
  console.log('Supabase Response Status:', res.status);
  
  if (res.ok) {
    let inserted;
    try { inserted = JSON.parse(resText); } catch(e){}
    console.log(`\n🎉 SUCCESS! All ${Array.isArray(inserted) ? inserted.length : records.length} records successfully synced to Supabase "Whatsapp" table!`);
  } else {
    console.error('Supabase Error Response:', resText);
  }
}

sync();
