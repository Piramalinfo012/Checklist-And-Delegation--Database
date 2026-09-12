import { supabase } from '../lib/supabaseClient.js';

/**
 * Parses DD/MM/YYYY or YYYY-MM-DD strings into a Date object (midnight local)
 */
export function parseDateString(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  
  const str = String(dateStr).trim();
  // Handle DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  // Handle YYYY-MM-DD
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

/**
 * Formats a Date object to DD/MM/YYYY
 */
export function formatDateToDDMMYYYY(date) {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
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
 * Main Task Generator Trigger function
 */
export async function runTaskGenerationTrigger(options = {}) {
  const {
    targetDate = new Date(),
    ignoreCalendarCheck = false,
    specificTemplateId = null,
    onProgress = () => {}
  } = options;

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

    // 3. Determine highest existing Task ID in Checklist table
    const { data: checklistData, error: checklistErr } = await supabase
      .from('Checklist')
      .select('Task ID')
      .order('Task ID', { ascending: false })
      .limit(1);

    let nextTaskId = 1;
    if (checklistData && checklistData.length > 0 && checklistData[0]['Task ID']) {
      const currentMax = parseInt(checklistData[0]['Task ID'], 10);
      if (!isNaN(currentMax)) {
        nextTaskId = currentMax + 1;
      }
    } else {
      // Alternatively count all rows
      const { count } = await supabase.from('Checklist').select('*', { count: 'exact', head: true });
      nextTaskId = (count || 0) + 1;
    }

    const tasksToInsert = [];
    const templateUpdates = [];
    const generatedTasksSummary = [];

    for (const template of templates) {
      const evalResult = isTemplateDue(template, targetDateObj);
      if (evalResult.isDue) {
        const taskId = nextTaskId++;
        const department = template.Department || '';
        const name = template.Name || '';
        const taskDesc = template['Task Description'] || template['Tast Descriptions'] || '';
        const freq = template.Frequency || template.Freq || 'daily';
        const givenBy = template['Give By'] || template['Given By'] || 'Admin';
        const reminder = template['Enable Reminder'] || template['Enable Reminders'] || 'Yes';
        const attachment = template['Require Attatchment'] || template['Require Attachment'] || 'No';

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
      addLog(`All templates are already up-to-date. 0 tasks generated.`, 'info');
      return {
        success: true,
        tasksGenerated: 0,
        generatedTasks: [],
        totalEvaluated: templates.length,
        logs
      };
    }

    addLog(`Generating ${tasksToInsert.length} new tasks in Checklist table...`);

    // 4. Batch Insert into Checklist
    // Insert in batches of 50 to avoid payload limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < tasksToInsert.length; i += BATCH_SIZE) {
      const batch = tasksToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('Checklist').insert(batch);
      if (insertErr) throw insertErr;
    }

    addLog(`Updating 'Last Date' on ${templateUpdates.length} templates in Unique table...`);

    // 5. Update templates Last Date in Unique
    for (const update of templateUpdates) {
      await supabase
        .from('Unique')
        .update({ 'Last Date': update.newLastDate })
        .eq('Task ID', update.id);
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
  }
}
