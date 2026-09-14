import { supabase } from '../lib/supabaseClient.js';

// Concurrency mutex to prevent parallel overlapping task generation triggers
let isTriggerExecuting = false;

/**
 * Parses DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, or YYYY/MM/DD strings into a Date object (midnight local)
 */
export function parseDateString(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  
  const str = String(dateStr).trim();
  
  // Handle slashes: DD/MM/YYYY or YYYY/MM/DD
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d);
      } else {
        // DD/MM/YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d);
      }
    }
  }
  
  // Handle dashes: YYYY-MM-DD or DD-MM-YYYY (including ISO datetime)
  if (str.includes('-')) {
    const datePart = str.split('T')[0].trim();
    const parts = datePart.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        return new Date(y, m, d);
      } else {
        // DD-MM-YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d);
      }
    }
  }
  
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

/**
 * Formats a Date object or date string to DD/MM/YYYY
 */
export function formatDateToDDMMYYYY(date) {
  if (!date) return '';
  let dObj = date;
  if (typeof date === 'string') {
    const parsed = parseDateString(date);
    if (parsed) dObj = parsed;
    else return date;
  }
  const d = String(dObj.getDate()).padStart(2, '0');
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const y = dObj.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Reliably computes the next numeric Task ID for any Supabase table (Unique, Checklist, Delegation)
 */
export async function getNextTaskId(tableName) {
  try {
    // 1. Try ordering by quoted column '"Task ID"'
    const { data: orderedData, error: orderErr } = await supabase
      .from(tableName)
      .select('"Task ID"')
      .order('"Task ID"', { ascending: false })
      .limit(10);

    if (!orderErr && orderedData && orderedData.length > 0) {
      const maxId = orderedData.reduce((max, r) => {
        const raw = r['Task ID'] ?? r.id ?? 0;
        const num = parseInt(String(raw).replace(/\D/g, ''), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      if (maxId > 0) return maxId + 1;
    }

    // 2. Fallback to scanning all Task IDs
    const { data: allRows } = await supabase
      .from(tableName)
      .select('"Task ID"');

    if (allRows && allRows.length > 0) {
      const maxId = allRows.reduce((max, r) => {
        const raw = r['Task ID'] ?? r.id ?? 0;
        const num = parseInt(String(raw).replace(/\D/g, ''), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      if (maxId > 0) return maxId + 1;
    }

    return 1;
  } catch (err) {
    console.error(`Error calculating next Task ID for ${tableName}:`, err);
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Checks if two dates have the same Day, Month, and Year
 */
export function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

/**
 * Evaluates whether a Unique template is due to generate a task on targetDate
 */
export function isTemplateDue(template, targetDate = new Date()) {
  const freq = (template.Frequency || template.Freq || 'daily').toLowerCase().trim();
  const lastDateStr = template['Last Date'] || template.lastGeneratedDate;
  const startDateStr = template['Task Start date'] || template['Task Start Date'];

  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  if (startDateStr) {
    const startDate = parseDateString(startDateStr);
    if (startDate && target < startDate) {
      return { isDue: false, reason: `Start date is in future (${startDateStr})` };
    }
  }

  if (!lastDateStr) {
    return { isDue: true, reason: 'Never generated before' };
  }

  const lastDate = parseDateString(lastDateStr);
  if (!lastDate) {
    return { isDue: true, reason: 'Invalid last date, generation required' };
  }

  // If already generated today
  if (isSameDay(target, lastDate)) {
    return { isDue: false, reason: `Already generated for today (${lastDateStr})` };
  }

  // If target is before last generated date
  if (target < lastDate) {
    return { isDue: false, reason: `Last generated date (${lastDateStr}) is after target date` };
  }

  switch (freq) {
    case 'daily': {
      return { isDue: true, reason: 'Daily task due today' };
    }
    case 'weekly': {
      const diffTime = target.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 7) {
        return { isDue: true, reason: `Weekly task due (${diffDays} days since last: ${lastDateStr})` };
      }
      return { isDue: false, reason: `Weekly task not due yet (${diffDays}/7 days passed)` };
    }
    case 'monthly': {
      // Check if 1 month has elapsed or same day of subsequent month
      const monthsDiff = (target.getFullYear() - lastDate.getFullYear()) * 12 + (target.getMonth() - lastDate.getMonth());
      if (monthsDiff >= 1 && target.getDate() >= lastDate.getDate()) {
        return { isDue: true, reason: `Monthly task due (${monthsDiff} month(s) passed)` };
      }
      return { isDue: false, reason: `Monthly task not due yet` };
    }
    case 'yearly': {
      const yearDiff = target.getFullYear() - lastDate.getFullYear();
      if (yearDiff >= 1) {
        return { isDue: true, reason: `Yearly task due (${yearDiff} year(s) passed)` };
      }
      return { isDue: false, reason: `Yearly task not due yet` };
    }
    default: {
      return { isDue: true, reason: `Default frequency '${freq}' evaluated as due` };
    }
  }
}

/**
 * Main Task Generator Trigger function with duplicate prevention
 */
export async function runTaskGenerationTrigger(options = {}) {
  const {
    targetDate = new Date(),
    ignoreCalendarCheck = false,
    specificTemplateId = null,
    onProgress = () => {}
  } = options;

  if (isTriggerExecuting) {
    console.warn('Task generation trigger is already executing. Ignoring concurrent call.');
    return {
      success: true,
      skipped: true,
      reason: 'Task generation is already running',
      tasksGenerated: 0,
      generatedTasks: [],
      logs: [{ time: new Date().toLocaleTimeString(), message: 'Trigger already running in background', type: 'info' }]
    };
  }

  isTriggerExecuting = true;

  const targetDateObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayDDMMYYYY = formatDateToDDMMYYYY(targetDateObj);
  const nowTimestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const logs = [];
  const addLog = (msg, type = 'info') => {
    const entry = { time: new Date().toLocaleTimeString(), message: msg, type };
    logs.push(entry);
    onProgress(entry, logs);
  };

  addLog(`Starting task generation process for date: ${todayDDMMYYYY}...`);

  try {
    // 1. Check Working Day Calendar & Holiday List if not ignored
    let isWorkingDay = true;
    let holidayInfo = null;

    if (!ignoreCalendarCheck) {
      addLog(`Checking working day calendar and holiday schedule...`);
      const [calRes, holRes] = await Promise.all([
        supabase.from('Working Day Calendar').select('*'),
        supabase.from('Holiday List').select('*')
      ]);

      if (holRes.data && holRes.data.length > 0) {
        const foundHoliday = holRes.data.find(h => {
          const hDate = parseDateString(h.Date);
          return hDate && isSameDay(hDate, targetDateObj);
        });
        if (foundHoliday) {
          isWorkingDay = false;
          holidayInfo = foundHoliday.Holiday || 'Holiday';
          addLog(`Target date ${todayDDMMYYYY} is a holiday: "${holidayInfo}"`, 'warning');
        }
      }

      if (isWorkingDay && calRes.data && calRes.data.length > 0) {
        const foundInCalendar = calRes.data.some(c => {
          const cDate = parseDateString(c.Date);
          return cDate && isSameDay(cDate, targetDateObj);
        });
        if (!foundInCalendar) {
          // If calendar is present and date is not in working day calendar
          isWorkingDay = false;
          addLog(`Target date ${todayDDMMYYYY} is marked as non-working day in calendar`, 'warning');
        }
      }

      if (!isWorkingDay) {
        addLog(`Task generation skipped because ${todayDDMMYYYY} is not a working day. (You can toggle 'Ignore Calendar Check' to force generation).`, 'warning');
        return {
          success: true,
          skipped: true,
          reason: holidayInfo ? `Holiday: ${holidayInfo}` : 'Non-working day',
          tasksGenerated: 0,
          generatedTasks: [],
          logs
        };
      }
    }

    // 2. Fetch Unique Templates
    addLog(`Fetching recurring task templates from 'Unique' table...`);
    let query = supabase.from('Unique').select('*');
    if (specificTemplateId) {
      query = query.eq('Task ID', specificTemplateId);
    }
    const { data: templates, error: templateError } = await query;
    if (templateError) throw templateError;

    if (!templates || templates.length === 0) {
      addLog(`No templates found in 'Unique' table to process.`, 'warning');
      return { success: true, tasksGenerated: 0, generatedTasks: [], logs };
    }

    addLog(`Found ${templates.length} templates. Checking eligibility for ${todayDDMMYYYY}...`);

    // 3. Fetch existing Checklist tasks to check for duplicate prevention
    const { data: existingChecklistRows, error: cErr } = await supabase
      .from('Checklist')
      .select('"Task ID", "Name", "Tast Descriptions", "Task Description", "Task Start Date"')
      .order('Task ID', { ascending: false })
      .limit(3000);

    if (cErr) {
      console.warn('Could not fetch existing Checklist rows for deduplication:', cErr);
    }

    const makeTaskKey = (name, desc, dateVal) => {
      const normName = (name || '').toString().trim().toLowerCase();
      const normDesc = (desc || '').toString().trim().toLowerCase();
      const parsed = parseDateString(dateVal);
      const normDate = parsed ? formatDateToDDMMYYYY(parsed) : (dateVal || '').toString().trim();
      return `${normName}:::${normDesc}:::${normDate}`;
    };

    const existingTaskKeys = new Set();
    if (existingChecklistRows && existingChecklistRows.length > 0) {
      for (const row of existingChecklistRows) {
        const d = row['Tast Descriptions'] || row['Task Description'] || '';
        const n = row['Name'] || '';
        const dt = row['Task Start Date'] || '';
        if (n && d && dt) {
          existingTaskKeys.add(makeTaskKey(n, d, dt));
        }
      }
    }

    const seenInThisRun = new Set();

    // 4. Determine highest existing Task ID in Checklist table
    let nextTaskId = await getNextTaskId('Checklist');

    const tasksToInsert = [];
    const templateUpdates = [];
    const generatedTasksSummary = [];

    for (const template of templates) {
      const evalResult = isTemplateDue(template, targetDateObj);
      const department = template.Department || '';
      const name = template.Name || '';
      const taskDesc = template['Task Description'] || template['Tast Descriptions'] || '';
      const freq = template.Frequency || template.Freq || 'daily';
      const givenBy = template['Give By'] || template['Given By'] || 'Admin';
      const reminder = template['Enable Reminder'] || template['Enable Reminders'] || 'Yes';
      const attachment = template['Require Attatchment'] || template['Require Attachment'] || 'No';

      const taskKey = makeTaskKey(name, taskDesc, todayDDMMYYYY);

      // Strict duplicate check: if task already exists in Checklist for today or was already generated in this run
      if (existingTaskKeys.has(taskKey) || seenInThisRun.has(taskKey)) {
        // Ensure template Last Date is synced to today in Unique table
        templateUpdates.push({
          id: template['Task ID'],
          newLastDate: todayDDMMYYYY
        });
        continue;
      }

      if (evalResult.isDue) {
        seenInThisRun.add(taskKey);
        const taskId = nextTaskId++;

        const newTask = {
          'Task ID': taskId,
          'Timestamp': nowTimestamp,
          'Department': department,
          'Given By': givenBy,
          'Name': name,
          'Tast Descriptions': taskDesc,
          'Task Start Date': todayDDMMYYYY,
          'Freq': freq,
          'Enable Reminders': reminder,
          'Require Attachment': attachment,
          'Actual': null,
          'Delay': null,
          'Status': null,
          'Remarks': null,
          'Uploaded Image': null
        };

        tasksToInsert.push(newTask);
        templateUpdates.push({
          id: template['Task ID'],
          newLastDate: todayDDMMYYYY
        });

        generatedTasksSummary.push({
          taskId,
          templateId: template['Task ID'],
          department,
          name,
          taskDesc,
          freq,
          date: todayDDMMYYYY
        });
      }
    }

    if (tasksToInsert.length === 0) {
      addLog(`All templates are already up-to-date and generated for ${todayDDMMYYYY}. 0 tasks generated.`, 'info');
      
      // Update template Last Dates if any were out of sync
      if (templateUpdates.length > 0) {
        for (const update of templateUpdates) {
          try {
            await supabase
              .from('Unique')
              .update({ 'Last Date': update.newLastDate })
              .eq('Task ID', update.id);
          } catch (err) {
            console.warn(`Could not sync template ${update.id}:`, err);
          }
        }
      }

      return {
        success: true,
        tasksGenerated: 0,
        generatedTasks: [],
        totalEvaluated: templates.length,
        logs
      };
    }

    addLog(`Generating ${tasksToInsert.length} new tasks in Checklist table...`);

    // 5. Batch Insert into Checklist
    // Insert in batches of 50 to avoid payload limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < tasksToInsert.length; i += BATCH_SIZE) {
      const batch = tasksToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('Checklist').insert(batch);
      if (insertErr) throw insertErr;
    }

    addLog(`Updating 'Last Date' on ${templateUpdates.length} templates in Unique table...`);

    // 6. Update templates Last Date in Unique
    for (const update of templateUpdates) {
      try {
        await supabase
          .from('Unique')
          .update({ 'Last Date': update.newLastDate })
          .eq('Task ID', update.id);
      } catch (err) {
        console.warn(`Could not update Last Date for template ${update.id}:`, err);
      }
    }

    // Save trigger log in localStorage for quick display in UI
    try {
      const historyItem = {
        timestamp: new Date().toISOString(),
        date: todayDDMMYYYY,
        count: tasksToInsert.length,
        tasks: generatedTasksSummary
      };
      const existingHistory = JSON.parse(localStorage.getItem('task_trigger_history') || '[]');
      existingHistory.unshift(historyItem);
      localStorage.setItem('task_trigger_history', JSON.stringify(existingHistory.slice(0, 30)));
    } catch (e) {
      console.warn('Failed to save trigger history to localStorage:', e);
    }

    addLog(`✅ Successfully generated ${tasksToInsert.length} tasks for date ${todayDDMMYYYY}!`, 'success');

    return {
      success: true,
      tasksGenerated: tasksToInsert.length,
      generatedTasks: generatedTasksSummary,
      totalEvaluated: templates.length,
      logs
    };
  } catch (error) {
    console.error('Error during task generation trigger:', error);
    addLog(`❌ Error running task trigger: ${error.message || error}`, 'error');
    return {
      success: false,
      error: error.message || error.toString(),
      tasksGenerated: 0,
      generatedTasks: [],
      logs
    };
  } finally {
    isTriggerExecuting = false;
  }
}
