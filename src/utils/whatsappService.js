import { supabase } from '../lib/supabaseClient';

const DEFAULT_TEMPLATE = `🔔 *REMINDER: DELEGATION TASK*
Dear $(Name),

You have been assigned a new task. Please find the details below:

📌 Task ID: $(Task ID)
🧑💼 Allocated By: $(Given By)
📝 Task Description: $(Task Description)
⏳ Deadline: $(Task Start Date)

Please make sure the task is completed before the deadline. For any assistance, feel free to reach out.

Best regards,
Piramal Petroleum Pvt.Ltd`;

const LOCAL_STORAGE_CONFIG_KEY = 'maytapi_whatsapp_config_v1';
const LOCAL_STORAGE_LOGS_KEY = 'maytapi_whatsapp_logs_v1';

/**
 * Retrieve Maytapi WhatsApp configuration
 */
export const getMaytapiConfig = async () => {
  let localConfig = {
    productId: '',
    phoneId: '',
    token: '',
    apiUrl: 'https://api.maytapi.com/api',
    enabled: true,
    template: DEFAULT_TEMPLATE,
  };

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (stored) {
      localConfig = { ...localConfig, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to parse local Maytapi config:', e);
  }

  // Try fetching from Supabase whatsapp_settings table
  try {
    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data) {
      localConfig = {
        productId: data.product_id || localConfig.productId,
        phoneId: data.phone_id || localConfig.phoneId,
        token: data.token || localConfig.token,
        apiUrl: data.api_url || localConfig.apiUrl,
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : localConfig.enabled,
        template: data.template || localConfig.template,
      };
      // Keep local storage in sync
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(localConfig));
    }
  } catch (e) {
    // Table may not exist yet; silently proceed with localConfig
  }

  return localConfig;
};

/**
 * Save Maytapi WhatsApp configuration
 */
export const saveMaytapiConfig = async (config) => {
  const merged = {
    productId: (config.productId || '').trim(),
    phoneId: (config.phoneId || '').trim(),
    token: (config.token || '').trim(),
    apiUrl: (config.apiUrl || 'https://api.maytapi.com/api').trim(),
    enabled: Boolean(config.enabled),
    template: config.template || DEFAULT_TEMPLATE,
  };

  // 1. Save to localStorage
  localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(merged));

  // 2. Try saving to Supabase whatsapp_settings table
  try {
    const { error } = await supabase
      .from('whatsapp_settings')
      .upsert({
        id: 'default',
        product_id: merged.productId,
        phone_id: merged.phoneId,
        token: merged.token,
        api_url: merged.apiUrl,
        enabled: merged.enabled,
        template: merged.template,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.warn('Could not sync config to Supabase whatsapp_settings table:', error.message);
    }
  } catch (e) {
    console.warn('Supabase whatsapp_settings table not available yet:', e);
  }

  return merged;
};

/**
 * Format raw phone number into standard 12-digit Indian number or international number
 */
export const formatPhoneNumber = (rawNumber) => {
  if (!rawNumber) return null;
  const str = String(rawNumber).trim();

  // Strip non-digit characters except leading plus if any
  let digits = str.replace(/\D/g, '');
  if (!digits) return null;

  // If 10 digits, assume India (+91)
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.substring(1)}`;
  }

  return digits;
};

/**
 * Look up a user's phone number by username in the Whatsapp table data
 */
export const getUserPhone = (username, usersList = []) => {
  if (!username) return null;
  const target = String(username).trim().toLowerCase();

  const matchedUser = (usersList || []).find((u) => {
    const uName = (u.Username || u['User name'] || '').trim().toLowerCase();
    return uName === target;
  });

  if (matchedUser && matchedUser.Number) {
    return matchedUser.Number;
  }
  return null;
};

/**
 * Generate formatted WhatsApp message based on template
 */
export const generateDelegationMessage = (taskData, templateString = DEFAULT_TEMPLATE) => {
  const template = templateString || DEFAULT_TEMPLATE;

  const name = taskData.Name || taskData.doer || 'Team Member';
  const taskId = taskData['Task ID'] || taskData.taskId || taskData.id || '-';
  const givenBy = taskData['Given By'] || taskData.givenBy || taskData['Give By'] || 'Management';
  const description = taskData['Task Description'] || taskData.description || taskData['Tast Descriptions'] || '-';
  const startDate = taskData['Task Start Date'] || taskData.startDate || taskData['Task Start date'] || taskData['Planned Date'] || '-';

  return template
    .replace(/\$\(Name\)/g, name)
    .replace(/\$\(Task ID\)/g, String(taskId))
    .replace(/\$\(Given By\)/g, givenBy)
    .replace(/\$\(Task Description\)/g, description)
    .replace(/\$\(Task Start Date\)/g, startDate);
};

/**
 * Record a WhatsApp log in Supabase whatsapp_logs table and localStorage
 */
export const recordWhatsappLog = async (logEntry) => {
  const newLog = {
    id: logEntry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    created_at: logEntry.created_at || new Date().toISOString(),
    task_id: String(logEntry.task_id || logEntry.taskId || ''),
    recipient_name: logEntry.recipient_name || logEntry.recipientName || '',
    recipient_phone: logEntry.recipient_phone || logEntry.recipientPhone || '',
    allocated_by: logEntry.allocated_by || logEntry.allocatedBy || '',
    message: logEntry.message || '',
    status: logEntry.status || 'Sent', // 'Sent' | 'Failed' | 'Delivered'
    response: logEntry.response || null,
    error: logEntry.error || null,
  };

  // 1. Save to localStorage cache (keeps last 200 logs)
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
    const updated = [newLog, ...existing].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save log to localStorage:', e);
  }

  // 2. Try inserting into Supabase whatsapp_logs table or whatsapp_log table
  try {
    const { error: insErr } = await supabase
      .from('whatsapp_logs')
      .insert([{
        task_id: newLog.task_id,
        recipient_name: newLog.recipient_name,
        recipient_phone: newLog.recipient_phone,
        allocated_by: newLog.allocated_by,
        message: newLog.message,
        status: newLog.status,
        response: newLog.response,
        error: newLog.error,
        created_at: newLog.created_at,
      }]);

    if (insErr) {
      // Try fallback table name 'whatsapp_log'
      await supabase
        .from('whatsapp_log')
        .insert([{
          task_id: newLog.task_id,
          recipient_name: newLog.recipient_name,
          recipient_phone: newLog.recipient_phone,
          allocated_by: newLog.allocated_by,
          message: newLog.message,
          status: newLog.status,
          response: newLog.response,
          error: newLog.error,
          created_at: newLog.created_at,
        }]);
    }
  } catch (e) {
    console.warn('Could not insert to Supabase whatsapp_logs table:', e);
  }

  return newLog;
};

/**
 * Fetch all WhatsApp logs from Supabase or localStorage
 */
export const getWhatsappLogs = async () => {
  // 1. Attempt fetching from Supabase
  try {
    const { data, error } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    // Try fallback table name
    const { data: d2, error: e2 } = await supabase
      .from('whatsapp_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (!e2 && Array.isArray(d2) && d2.length > 0) {
      return d2;
    }
  } catch (e) {
    console.warn('Could not fetch logs from Supabase:', e);
  }

  // 2. Fallback to localStorage
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Clear WhatsApp logs
 */
export const clearWhatsappLogs = async () => {
  localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
  try {
    await supabase.from('whatsapp_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {}
  try {
    await supabase.from('whatsapp_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch (e) {}
};

/**
 * Send WhatsApp SMS via Maytapi API
 */
export const sendMaytapiSMS = async ({
  toNumber,
  message,
  taskId = '',
  recipientName = '',
  allocatedBy = '',
  configOverride = null,
}) => {
  const config = configOverride || (await getMaytapiConfig());

  if (!config.enabled) {
    console.log('Maytapi WhatsApp SMS is currently disabled in Settings.');
    return { success: false, skipped: true, error: 'WhatsApp SMS is disabled in Settings' };
  }

  const { productId, phoneId, token, apiUrl } = config;

  if (!productId || !phoneId || !token) {
    const err = 'Maytapi credentials missing (Product ID, Phone ID or Token). Please configure in Settings > Whatsapp SMS.';
    console.warn(err);
    await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: toNumber || 'N/A',
      allocated_by: allocatedBy,
      message,
      status: 'Failed',
      error: err,
    });
    return { success: false, error: err };
  }

  const formattedNumber = formatPhoneNumber(toNumber);
  if (!formattedNumber) {
    const err = `Invalid phone number for user "${recipientName}": ${toNumber}`;
    console.warn(err);
    await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: toNumber || 'Invalid',
      allocated_by: allocatedBy,
      message,
      status: 'Failed',
      error: err,
    });
    return { success: false, error: err };
  }

  const baseUrl = (apiUrl || 'https://api.maytapi.com/api').replace(/\/+$/, '');
  const endpoint = `${baseUrl}/${productId}/${phoneId}/sendMessage`;

  const payload = {
    to_number: `${formattedNumber}@c.us`,
    type: 'text',
    message: message,
  };

  try {
    console.log(`Sending WhatsApp SMS via Maytapi to ${formattedNumber}...`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-maytapi-key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json().catch(() => null);

    if (response.ok && (resJson?.success !== false)) {
      console.log(`WhatsApp SMS sent successfully to ${recipientName} (${formattedNumber})!`);
      const log = await recordWhatsappLog({
        task_id: taskId,
        recipient_name: recipientName,
        recipient_phone: formattedNumber,
        allocated_by: allocatedBy,
        message,
        status: 'Sent',
        response: resJson,
      });
      return { success: true, log, data: resJson };
    } else {
      const errMsg = resJson?.message || resJson?.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error('Maytapi API Error:', errMsg, resJson);
      const log = await recordWhatsappLog({
        task_id: taskId,
        recipient_name: recipientName,
        recipient_phone: formattedNumber,
        allocated_by: allocatedBy,
        message,
        status: 'Failed',
        response: resJson,
        error: errMsg,
      });
      return { success: false, error: errMsg, log, data: resJson };
    }
  } catch (error) {
    console.error('Network error calling Maytapi API:', error);
    const log = await recordWhatsappLog({
      task_id: taskId,
      recipient_name: recipientName,
      recipient_phone: formattedNumber,
      allocated_by: allocatedBy,
      message,
      status: 'Failed',
      error: error.message || String(error),
    });
    return { success: false, error: error.message || String(error), log };
  }
};

/**
 * Send WhatsApp SMS specifically when a new Delegation Task is created
 */
export const sendDelegationTaskSMS = async (taskData, usersList = []) => {
  try {
    const config = await getMaytapiConfig();
    if (!config.enabled) return { success: false, skipped: true };

    const recipientName = taskData.Name || taskData.doer || '';
    let phoneNumber = taskData.Number || taskData.phone || null;

    // If phone number not present in taskData, search in Whatsapp table usersList or Supabase
    if (!phoneNumber && recipientName) {
      phoneNumber = getUserPhone(recipientName, usersList);

      if (!phoneNumber) {
        // Query Supabase Whatsapp table directly
        try {
          const { data: uData } = await supabase
            .from('Whatsapp')
            .select('Number, Username')
            .ilike('Username', recipientName.trim())
            .maybeSingle();

          if (uData && uData.Number) {
            phoneNumber = uData.Number;
          }
        } catch (e) {
          console.warn('Could not query user phone from Supabase:', e);
        }
      }
    }

    const message = generateDelegationMessage(taskData, config.template);
    const taskId = taskData['Task ID'] || taskData.taskId || taskData.id || '';
    const allocatedBy = taskData['Given By'] || taskData.givenBy || taskData['Give By'] || 'Admin';

    return await sendMaytapiSMS({
      toNumber: phoneNumber,
      message,
      taskId,
      recipientName,
      allocatedBy,
      configOverride: config,
    });
  } catch (error) {
    console.error('Error in sendDelegationTaskSMS:', error);
    return { success: false, error: error.message || error };
  }
};
