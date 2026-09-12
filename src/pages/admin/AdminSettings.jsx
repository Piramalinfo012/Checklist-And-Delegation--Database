"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, Zap, Play, CheckCircle2, AlertCircle, Clock, Calendar, 
  RefreshCw, Sliders, Search, Filter, ShieldCheck, Layers, ListChecks,
  CheckCircle, ArrowRight, Activity, Terminal, AlertTriangle, Eye, Sparkles,
  Download, UploadCloud, FileSpreadsheet, Database, ArrowDownToLine, Check,
  FileText, ExternalLink, UserPlus, Users, Key, Lock, Phone, Mail,
  UserCheck, UserX, Trash2, Edit3, Shield, Building2, User, X, Camera, Moon
} from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { uploadImageToCloudinary } from '../../lib/cloudinary';
import { 
  runTaskGenerationTrigger, 
  formatDateToDDMMYYYY, 
  parseDateString, 
  isTemplateDue,
  isSameDay
} from '../../utils/taskTriggerEngine';

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec";

export default function AdminSettings() {
  // Stats & Main State
  const [loading, setLoading] = useState(true);
  const [isRunningTrigger, setIsRunningTrigger] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [checklistCount, setChecklistCount] = useState(0);
  const [delegationCount, setDelegationCount] = useState(0);
  const [calendarDates, setCalendarDates] = useState([]);
  const [holidays, setHolidays] = useState([]);
  
  // Nightly Cloud Trigger State (2:00 AM Cron)
  const [isSettingUpNightlyTrigger, setIsSettingUpNightlyTrigger] = useState(false);
  const [nightlyTriggerStatus, setNightlyTriggerStatus] = useState('');
  const [isRunningNightlyTest, setIsRunningNightlyTest] = useState(false);

  // Users State (Whatsapp table)
  const [users, setUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userDeptFilter, setUserDeptFilter] = useState('ALL');
  
  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [userFormError, setUserFormError] = useState('');
  const [userPhotoFile, setUserPhotoFile] = useState(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState('');
  
  const initialUserForm = {
    originalUsername: '',
    Username: '',
    password: '',
    Role: 'user',
    Email: '',
    Number: '',
    Photo: ''
  };
  const [userFormData, setUserFormData] = useState(initialUserForm);

  // Trigger Configuration
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD for input
  });
  const [ignoreCalendarCheck, setIgnoreCalendarCheck] = useState(false);
  const [autoTriggerOnLogin, setAutoTriggerOnLogin] = useState(() => {
    return localStorage.getItem('auto_trigger_on_login') !== 'false';
  });
  const [autoScheduleInterval, setAutoScheduleInterval] = useState(() => {
    return localStorage.getItem('auto_trigger_interval') || '60'; // minutes
  });

  // Logs & History
  const [executionLogs, setExecutionLogs] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [triggerHistory, setTriggerHistory] = useState([]);

  // Data Dump to Google Sheet State
  const [isDumping, setIsDumping] = useState(false);
  const [dumpProgress, setDumpProgress] = useState(0);
  const [dumpStatusMsg, setDumpStatusMsg] = useState('');
  const [dumpLogs, setDumpLogs] = useState([]);
  const [clearBeforeDump, setClearBeforeDump] = useState(true);

  // Table Filters for Unique Templates
  const [searchTerm, setSearchTerm] = useState('');
  const [freqFilter, setFreqFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Load all initial data from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, cCountRes, dCountRes, calRes, holRes, wRes] = await Promise.all([
        supabase.from('Unique').select('*'),
        supabase.from('Checklist').select('*', { count: 'exact', head: true }),
        supabase.from('Delegation').select('*', { count: 'exact', head: true }),
        supabase.from('Working Day Calendar').select('*'),
        supabase.from('Holiday List').select('*'),
        supabase.from('Whatsapp').select('*').order('Username', { ascending: true })
      ]);

      if (uRes.data) setTemplates(uRes.data);
      if (cCountRes.count !== null) setChecklistCount(cCountRes.count);
      if (dCountRes.count !== null) setDelegationCount(dCountRes.count);
      if (calRes.data) setCalendarDates(calRes.data);
      if (holRes.data) setHolidays(holRes.data);
      if (wRes.data) setUsers(wRes.data);

      const savedHistory = JSON.parse(localStorage.getItem('task_trigger_history') || '[]');
      setTriggerHistory(savedHistory);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save preferences
  const handleToggleAutoLogin = (val) => {
    setAutoTriggerOnLogin(val);
    localStorage.setItem('auto_trigger_on_login', String(val));
  };

  const handleChangeInterval = (val) => {
    setAutoScheduleInterval(val);
    localStorage.setItem('auto_trigger_interval', String(val));
  };

  // Setup 2:00 AM Nightly Cloud Trigger on Google Apps Script
  const handleSetupNightlyTrigger = async () => {
    setIsSettingUpNightlyTrigger(true);
    setNightlyTriggerStatus('');
    try {
      const formData = new FormData();
      formData.append('action', 'setupNightlyTrigger');
      const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        setNightlyTriggerStatus('✅ 2:00 AM Nightly Cloud Trigger is active!');
        alert('🌙 SUCCESS: Automated Nightly 2:00 AM Task Generator Trigger is configured in Google Apps Script! Every night at 2:00 AM IST, upcoming tasks will generate automatically.');
      } else {
        throw new Error(json.error || 'Failed to setup trigger');
      }
    } catch (err) {
      console.error('Trigger setup error:', err);
      alert(`Trigger notice: ${err.message || err}`);
    } finally {
      setIsSettingUpNightlyTrigger(false);
    }
  };

  // Test Run Nightly Cloud Trigger Now
  const handleRunNightlyCloudTest = async () => {
    setIsRunningNightlyTest(true);
    try {
      const formData = new FormData();
      formData.append('action', 'runNightlyTriggerNow');
      const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        alert(`🎉 Cloud Trigger executed! Result: ${json.message || 'Success'} (Generated ${json.tasksGenerated || 0} tasks)`);
        loadData();
      } else {
        alert(`Cloud execution notice: ${json.error || json.message}`);
      }
    } catch (err) {
      alert(`Cloud test error: ${err.message || err}`);
    } finally {
      setIsRunningNightlyTest(false);
    }
  };

  // =========================================================================
  // USER MANAGEMENT (WHATSAPP TABLE)
  // =========================================================================

  // Open Create User Modal
  const handleOpenCreateUserModal = () => {
    setIsEditingUser(false);
    setUserFormData(initialUserForm);
    setUserPhotoFile(null);
    setUserPhotoPreview('');
    setUserFormError('');
    setUserFormSuccess('');
    setIsUserModalOpen(true);
  };

  // Open Edit User Modal
  const handleOpenEditUserModal = (user) => {
    setIsEditingUser(true);
    setUserFormData({
      originalUsername: user.Username || '',
      Username: user.Username || '',
      password: user.password || '',
      Role: user.Role || 'user',
      Email: user.Email || '',
      Number: user.Number || '',
      Photo: user.Photo || ''
    });
    setUserPhotoFile(null);
    setUserPhotoPreview(user.Photo || '');
    setUserFormError('');
    setUserFormSuccess('');
    setIsUserModalOpen(true);
  };

  // Handle Photo selection
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUserPhotoFile(file);
      setUserPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Save User (Create or Update)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');
    setUserFormSubmitting(true);

    try {
      const trimmedUsername = userFormData.Username.trim();
      const trimmedPassword = userFormData.password.trim();

      if (!trimmedUsername) {
        throw new Error('Username is required.');
      }
      if (!trimmedPassword) {
        throw new Error('Password is required.');
      }

      // Check for duplicate username on creation
      if (!isEditingUser) {
        const isDuplicate = users.some(
          u => (u.Username || '').trim().toLowerCase() === trimmedUsername.toLowerCase()
        );
        if (isDuplicate) {
          throw new Error(`Username "${trimmedUsername}" already exists! Please choose a unique name.`);
        }
      }

      // Upload Photo if new file selected
      let photoUrl = userFormData.Photo;
      if (userPhotoFile) {
        try {
          photoUrl = await uploadImageToCloudinary(userPhotoFile);
        } catch (uploadErr) {
          console.warn('Cloudinary upload warning, using placeholder fallback:', uploadErr);
          photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedUsername)}&background=6366f1&color=fff&bold=true`;
        }
      } else if (!photoUrl) {
        photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedUsername)}&background=6366f1&color=fff&bold=true`;
      }

      const rowToSave = {
        'Username': trimmedUsername,
        'password': trimmedPassword,
        'Role': userFormData.Role || 'user',
        'Department': '',
        'Given By': '',
        'Email': userFormData.Email ? userFormData.Email.trim() : '',
        'Number': userFormData.Number ? userFormData.Number.trim() : '',
        'Photo': photoUrl
      };

      if (isEditingUser) {
        // Update user in Whatsapp table
        const { error: updateErr } = await supabase
          .from('Whatsapp')
          .update(rowToSave)
          .eq('Username', userFormData.originalUsername);

        if (updateErr) throw updateErr;
        setUserFormSuccess(`User "${trimmedUsername}" updated successfully!`);
      } else {
        // Insert new user into Whatsapp table
        const { error: insertErr } = await supabase
          .from('Whatsapp')
          .insert([rowToSave]);

        if (insertErr) throw insertErr;
        setUserFormSuccess(`New User ID "${trimmedUsername}" created successfully in Whatsapp table!`);
      }

      // Clear local master data cache so new user can log in immediately
      try {
        localStorage.removeItem('masterDataCache');
        localStorage.removeItem('masterDataCacheTime');
        localStorage.removeItem(`whatsapp_user_cache_${trimmedUsername.toLowerCase()}`);
      } catch (e) {}

      // Refresh users list
      const { data: updatedUsers } = await supabase
        .from('Whatsapp')
        .select('*')
        .order('Username', { ascending: true });
      if (updatedUsers) setUsers(updatedUsers);

      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserFormSuccess('');
      }, 1000);

    } catch (err) {
      console.error('Error saving user:', err);
      setUserFormError(err.message || 'Failed to save user. Please check your connection.');
    } finally {
      setUserFormSubmitting(false);
    }
  };

  // Toggle user Active / Inactive
  const handleToggleUserStatus = async (user) => {
    try {
      const isCurrentlyInactive = (user.Role || '').toLowerCase() === 'in active' || (user.Role || '').toLowerCase() === 'inactive';
      const newRole = isCurrentlyInactive ? 'user' : 'In Active';

      const { error } = await supabase
        .from('Whatsapp')
        .update({ 'Role': newRole })
        .eq('Username', user.Username);

      if (error) throw error;

      // Clear local cache
      try {
        localStorage.removeItem('masterDataCache');
      } catch (e) {}

      setUsers(prev => prev.map(u => u.Username === user.Username ? { ...u, Role: newRole } : u));
    } catch (err) {
      alert(`Failed to update status: ${err.message || err}`);
    }
  };

  // Delete user from Whatsapp table
  const handleDeleteUser = async (user) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete user ID "${user.Username}" from Whatsapp table? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('Whatsapp')
        .delete()
        .eq('Username', user.Username);

      if (error) throw error;

      // Clear cache
      try {
        localStorage.removeItem('masterDataCache');
        localStorage.removeItem(`whatsapp_user_cache_${(user.Username || '').toLowerCase()}`);
      } catch (e) {}

      setUsers(prev => prev.filter(u => u.Username !== user.Username));
    } catch (err) {
      alert(`Failed to delete user: ${err.message || err}`);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearchTerm.toLowerCase();
      const username = (u.Username || '').toLowerCase();
      const number = (u.Number || '').toLowerCase();
      const role = (u.Role || '').toLowerCase();

      const matchesSearch = !q || username.includes(q) || number.includes(q);
      
      let matchesRole = true;
      if (userRoleFilter === 'ADMIN') matchesRole = role === 'admin';
      if (userRoleFilter === 'USER') matchesRole = role === 'user';
      if (userRoleFilter === 'INACTIVE') matchesRole = role === 'in active' || role === 'inactive';

      return matchesSearch && matchesRole;
    });
  }, [users, userSearchTerm, userRoleFilter]);

  // Run Task Generation Trigger
  const handleExecuteTrigger = async (specificId = null) => {
    if (isRunningTrigger) return;
    setIsRunningTrigger(true);
    setExecutionLogs([]);
    setLastResult(null);

    const targetDateObj = selectedDate ? new Date(selectedDate) : new Date();

    const result = await runTaskGenerationTrigger({
      targetDate: targetDateObj,
      ignoreCalendarCheck,
      specificTemplateId: specificId,
      onProgress: (logEntry, allLogs) => {
        setExecutionLogs([...allLogs]);
      }
    });

    setLastResult(result);
    setIsRunningTrigger(false);

    // Refresh templates data to show updated Last Date
    const { data: uData } = await supabase.from('Unique').select('*');
    if (uData) setTemplates(uData);

    const savedHistory = JSON.parse(localStorage.getItem('task_trigger_history') || '[]');
    setTriggerHistory(savedHistory);
  };

  // =========================================================================
  // MANUAL DATA DUMP TO GOOGLE SHEET
  // =========================================================================
  const addDumpLog = (msg, type = 'info') => {
    setDumpLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: msg, type }]);
  };

  const handleDumpToSheet = async (dumpType = 'all') => {
    if (isDumping) return;
    setIsDumping(true);
    setDumpProgress(5);
    setDumpLogs([]);
    setDumpStatusMsg('Starting data dump to Google Sheet...');
    addDumpLog(`Starting ${dumpType.toUpperCase()} data dump process...`);

    try {
      // 1. DUMP CHECKLIST DATA
      if (dumpType === 'checklist' || dumpType === 'all') {
        addDumpLog('Fetching Checklist table data from Supabase...');
        setDumpStatusMsg('Reading Checklist data from Supabase...');
        
        const { data: checklistRows, error: cErr } = await supabase
          .from('Checklist')
          .select('*')
          .order('Task ID', { ascending: true })
          .limit(4000); // Recent 4000 rows for sheet sync

        if (cErr) throw cErr;
        addDumpLog(`Fetched ${checklistRows.length} rows from Checklist table.`);
        setDumpProgress(30);

        const formattedChecklistData = checklistRows.map(r => [
          r['Timestamp'] || '',
          r['Task ID'] || '',
          r['Department'] || r['Firm'] || '',
          r['Given By'] || '',
          r['Name'] || '',
          r['Tast Descriptions'] || r['Task Description'] || '',
          r['Task Start Date'] || '',
          r['Freq'] || '',
          r['Enable Reminders'] || '',
          r['Require Attachment'] || '',
          r['Actual'] || '',
          r['Delay'] || '',
          r['Status'] || '',
          r['Remarks'] || '',
          r['Uploaded Image'] || '',
          r['Admin Done'] || '',
          r['Leave'] || ''
        ]);

        addDumpLog(`Sending Checklist data to Google Sheet (Batch of ${formattedChecklistData.length} rows)...`);
        setDumpStatusMsg('Writing Checklist data to Google Sheet...');

        const BATCH_SIZE = 500;
        for (let i = 0; i < formattedChecklistData.length; i += BATCH_SIZE) {
          const chunk = formattedChecklistData.slice(i, i + BATCH_SIZE);
          const formData = new FormData();
          formData.append('action', 'dumpSheet');
          formData.append('sheetName', 'Checklist');
          formData.append('clearExisting', i === 0 && clearBeforeDump ? 'true' : 'false');
          formData.append('rowData', JSON.stringify(chunk));

          const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
          if (!res.ok) console.warn('Google Sheet batch push response warning');
          
          const pct = Math.round(30 + ((i + chunk.length) / formattedChecklistData.length) * 35);
          setDumpProgress(pct);
          addDumpLog(`Dumped Checklist rows ${i + 1} to ${i + chunk.length}...`);
        }

        addDumpLog(`✅ Checklist sheet dump finished successfully!`, 'success');
      }

      // 2. DUMP DELEGATION DATA
      if (dumpType === 'delegation' || dumpType === 'all') {
        addDumpLog('Fetching Delegation & DELEGATION DONE from Supabase...');
        setDumpStatusMsg('Reading Delegation data from Supabase...');
        setDumpProgress(70);

        const [delRes, doneRes] = await Promise.all([
          supabase.from('Delegation').select('*').order('Task ID', { ascending: true }),
          supabase.from('DELEGATION DONE').select('*').order('id', { ascending: true })
        ]);

        if (delRes.data && delRes.data.length > 0) {
          const formattedDelegation = delRes.data.map(r => [
            r['Timestamp'] || '',
            r['Task ID'] || '',
            r['Department'] || '',
            r['Given By'] || '',
            r['Name'] || '',
            r['Task Description'] || '',
            r['Task Start Date'] || '',
            r['Freq'] || '',
            r['Enable Reminders'] || '',
            r['Require Attachment'] || '',
            r['End Date'] || ''
          ]);

          const formData = new FormData();
          formData.append('action', 'dumpSheet');
          formData.append('sheetName', 'DELEGATION');
          formData.append('clearExisting', clearBeforeDump ? 'true' : 'false');
          formData.append('rowData', JSON.stringify(formattedDelegation));

          addDumpLog(`Writing ${formattedDelegation.length} rows to DELEGATION Google Sheet...`);
          await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
          addDumpLog(`✅ DELEGATION sheet dump finished!`, 'success');
        }

        if (doneRes.data && doneRes.data.length > 0) {
          const formattedDone = doneRes.data.map(r => [
            r['Timestamp'] || '',
            r['Task id'] || '',
            r['Status'] || '',
            r['Next extend date'] || '',
            r['Reason'] || '',
            r['Upload Image'] || '',
            r['Condition Date'] || '',
            r['Name'] || '',
            r['Task Description'] || '',
            r['Given By'] || '',
            r['Admin Done'] || ''
          ]);

          const formDone = new FormData();
          formDone.append('action', 'dumpSheet');
          formDone.append('sheetName', 'DELEGATION DONE');
          formDone.append('clearExisting', clearBeforeDump ? 'true' : 'false');
          formDone.append('rowData', JSON.stringify(formattedDone));

          addDumpLog(`Writing ${formattedDone.length} rows to DELEGATION DONE Google Sheet...`);
          await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formDone });
          addDumpLog(`✅ DELEGATION DONE sheet dump finished!`, 'success');
        }
      }

      // 3. DUMP WHATSAPP USERS DATA
      if (dumpType === 'whatsapp' || dumpType === 'all') {
        addDumpLog('Fetching Whatsapp Users from Supabase...');
        const { data: whatsappRows } = await supabase.from('Whatsapp').select('*');
        if (whatsappRows && whatsappRows.length > 0) {
          const formattedWhatsapp = whatsappRows.map(r => [
            r['Department'] || '',
            r['Given By'] || '',
            r['Username'] || '',
            r['password'] || '',
            r['Role'] || '',
            r['Email'] || '',
            r['Number'] || '',
            r['Photo'] || ''
          ]);

          const formW = new FormData();
          formW.append('action', 'dumpSheet');
          formW.append('sheetName', 'Whatsapp');
          formW.append('clearExisting', clearBeforeDump ? 'true' : 'false');
          formW.append('rowData', JSON.stringify(formattedWhatsapp));

          addDumpLog(`Writing ${formattedWhatsapp.length} rows to Whatsapp Google Sheet...`);
          await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formW });
          addDumpLog(`✅ Whatsapp Users sheet dump finished!`, 'success');
        }
      }

      setDumpProgress(100);
      setDumpStatusMsg('🎉 Data Dump completed successfully!');
      addDumpLog('🎉 All selected sheets have been fully synchronized to Google Sheet!', 'success');
    } catch (err) {
      console.error('Data dump error:', err);
      setDumpStatusMsg(`Dump Failed: ${err.message || err}`);
      addDumpLog(`❌ Error dumping data: ${err.message || err}`, 'error');
    } finally {
      setIsDumping(false);
    }
  };

  // Download Instant CSV Backup
  const handleDownloadCSV = async (tableName) => {
    try {
      addDumpLog(`Exporting ${tableName} table to CSV file...`);
      const { data, error } = await supabase.from(tableName).select('*').limit(5000);
      if (error) throw error;

      if (!data || data.length === 0) {
        alert(`No data found in ${tableName} to export.`);
        return;
      }

      const headers = Object.keys(data[0]);
      const csvRows = [];
      csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

      data.forEach(row => {
        const values = headers.map(header => {
          const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${tableName}_Backup_${todayFormatted.replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addDumpLog(`✅ Downloaded ${tableName} CSV file successfully!`, 'success');
    } catch (err) {
      console.error('CSV Export Error:', err);
      alert(`Export failed: ${err.message || err}`);
    }
  };

  // Computed Values
  const todayObj = new Date();
  const todayFormatted = formatDateToDDMMYYYY(todayObj);

  const isTodayHoliday = useMemo(() => {
    return holidays.find(h => {
      const hd = parseDateString(h.Date);
      return hd && isSameDay(hd, todayObj);
    });
  }, [holidays, todayObj]);

  const isTodayInCalendar = useMemo(() => {
    if (calendarDates.length === 0) return true;
    return calendarDates.some(c => {
      const cd = parseDateString(c.Date);
      return cd && isSameDay(cd, todayObj);
    });
  }, [calendarDates, todayObj]);

  const isWorkingDayToday = !isTodayHoliday && isTodayInCalendar;

  const dueTemplatesCount = useMemo(() => {
    const target = selectedDate ? new Date(selectedDate) : todayObj;
    return templates.filter(t => isTemplateDue(t, target).isDue).length;
  }, [templates, selectedDate, todayObj]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    const target = selectedDate ? new Date(selectedDate) : todayObj;
    return templates.filter(t => {
      const taskDesc = (t['Task Description'] || t['Tast Descriptions'] || '').toLowerCase();
      const name = (t.Name || '').toLowerCase();
      const dept = (t.Department || '').toLowerCase();
      const freq = (t.Frequency || t.Freq || '').toLowerCase();
      const q = searchTerm.toLowerCase();

      const matchesSearch = !q || taskDesc.includes(q) || name.includes(q) || dept.includes(q);
      const matchesFreq = freqFilter === 'ALL' || freq === freqFilter.toLowerCase();
      
      const dueInfo = isTemplateDue(t, target);
      let matchesStatus = true;
      if (statusFilter === 'DUE') matchesStatus = dueInfo.isDue;
      if (statusFilter === 'UP_TO_DATE') matchesStatus = !dueInfo.isDue;

      return matchesSearch && matchesFreq && matchesStatus;
    });
  }, [templates, searchTerm, freqFilter, statusFilter, selectedDate, todayObj]);

  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-8 space-y-8 bg-slate-50/50">
        
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                Admin Settings & User ID Management
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                ⚙️ User Management, Task Generator & Sheet Dump
              </h1>
              <p className="text-slate-300 text-sm md:text-base max-w-2xl">
                Create & manage new User IDs in the Whatsapp table, configure automated recurring task generators, and manually dump live Supabase data to Google Sheets.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleOpenCreateUserModal}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-white shadow-lg transition-all duration-300 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-emerald-500/25 active:scale-95"
              >
                <UserPlus className="h-5 w-5" />
                <span>+ Create New User ID</span>
              </button>

              <button
                onClick={() => handleExecuteTrigger()}
                disabled={isRunningTrigger || loading}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-white shadow-lg transition-all duration-300 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 hover:shadow-indigo-500/25 active:scale-95 disabled:opacity-50"
              >
                <Zap className={`h-5 w-5 ${isRunningTrigger ? 'animate-bounce text-amber-300' : 'text-amber-300 fill-amber-300'}`} />
                <span>{isRunningTrigger ? 'Generating Tasks...' : '⚡ Run Task Generator'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Users Count */}
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active User IDs</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-700">{users.length} Users</div>
              <p className="text-xs text-slate-500 mt-0.5">Stored in Supabase 'Whatsapp' table</p>
            </div>
          </div>

          {/* Card 2: Checklist Count */}
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Checklist Table</span>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <ListChecks className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-800">{checklistCount.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-0.5">Total Checklist rows in Supabase</p>
            </div>
          </div>

          {/* Card 3: Delegation Count */}
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Delegation Table</span>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-purple-700">{delegationCount.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-0.5">Total Delegation rows in Supabase</p>
            </div>
          </div>

          {/* Card 4: Working Day Calendar */}
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Working Calendar</span>
              <div className={`p-2.5 rounded-xl ${isWorkingDayToday ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isWorkingDayToday ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isWorkingDayToday ? '🟢 Working Day' : isTodayHoliday ? `🔴 Holiday (${isTodayHoliday.Holiday})` : '🟡 Off Day'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Today: {todayFormatted}</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NEW DEDICATED SECTION 1: USER ID MANAGEMENT & CREATION (WHATSAPP TABLE)   */}
        {/* ========================================================================= */}
        <div className="bg-white/90 backdrop-blur-xl border-2 border-emerald-200/80 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <span>👤 User ID Directory & Management</span>
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Whatsapp Table ({users.length} Users)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Naye user IDs create karein, passwords reset karein aur roles (Admin / User) manage karein.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => handleDownloadCSV('Whatsapp')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                title="Download all users to CSV"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>Export Users CSV</span>
              </button>

              <button
                onClick={handleOpenCreateUserModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Create New User ID</span>
              </button>
            </div>
          </div>

          {/* User Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 md:w-72">
                <Search className="h-3.5 w-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user name, phone, dept..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">🛡️ Admin Only</option>
                <option value="USER">👤 User Only</option>
                <option value="INACTIVE">⛔ Inactive Only</option>
              </select>
            </div>

            <span className="text-xs font-medium text-slate-500">
              Showing {filteredUsers.length} of {users.length} users
            </span>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/90 backdrop-blur sticky top-0 z-10 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">WhatsApp Mobile Number</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400 italic">
                      No matching users found in Whatsapp table. Click "+ Create New User ID" to add one.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => {
                    const role = (user.Role || 'user').toLowerCase();
                    const isInactive = role === 'in active' || role === 'inactive';
                    const isAdmin = role === 'admin';
                    const avatarUrl = user.Photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.Username || 'U')}&background=6366f1&color=fff&bold=true`;

                    return (
                      <tr key={user.Username || idx} className={`hover:bg-slate-50/80 transition-colors ${isInactive ? 'opacity-60 bg-slate-50/50' : ''}`}>
                        
                        {/* User & Avatar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={avatarUrl}
                              alt={user.Username}
                              className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-sm"
                              onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.Username || 'U')}&background=6366f1&color=fff&bold=true`;
                              }}
                            />
                            <div>
                              <span className="font-bold text-slate-800 block">{user.Username}</span>
                              {user.Email && <span className="text-[10px] text-slate-400 block">{user.Email}</span>}
                            </div>
                          </div>
                        </td>

                        {/* Number */}
                        <td className="py-3 px-4 font-mono">
                          {user.Number ? (
                            <a
                              href={`https://wa.me/91${user.Number.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold"
                            >
                              <Phone className="h-3 w-3 text-emerald-600" />
                              <span>{user.Number}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isAdmin ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                            isInactive ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isAdmin && <Shield className="h-3 w-3" />}
                            {isInactive ? '⛔ Inactive' : isAdmin ? '🛡️ Admin' : '👤 User'}
                          </span>
                        </td>

                        {/* Password */}
                        <td className="py-3 px-4 font-mono text-slate-600">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold">
                            {user.password || '••••••'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Toggle Active / Inactive */}
                            <button
                              onClick={() => handleToggleUserStatus(user)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isInactive 
                                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                              }`}
                              title={isInactive ? 'Activate User' : 'Deactivate User'}
                            >
                              {isInactive ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                            </button>

                            {/* Edit User */}
                            <button
                              onClick={() => handleOpenEditUserModal(user)}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                              title="Edit User ID & Password"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete User */}
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                              title="Delete User ID permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL: CREATE / EDIT USER ID                                              */}
        {/* ========================================================================= */}
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-5 p-6 md:p-8">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800">
                      {isEditingUser ? `Edit User: ${userFormData.originalUsername}` : 'Create New User ID'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Stores user credentials directly in Supabase 'Whatsapp' table
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Feedback Alerts */}
              {userFormError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{userFormError}</span>
                </div>
              )}

              {userFormSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{userFormSuccess}</span>
                </div>
              )}

              {/* Form Inputs */}
              <form onSubmit={handleSaveUser} className="space-y-4">
                
                {/* Photo & Name Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 transition-colors">
                    <div className="relative group cursor-pointer">
                      <img
                        src={userPhotoPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(userFormData.Username || 'U')}&background=6366f1&color=fff&bold=true`}
                        alt="Preview"
                        className="h-16 w-16 rounded-full object-cover border-2 border-emerald-500/30"
                      />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="h-5 w-5 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1.5 font-medium">Photo (Optional)</span>
                  </div>

                  {/* Username & Password */}
                  <div className="sm:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Username <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rohan Sharma"
                        value={userFormData.Username}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, Username: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rohan@123"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <Key className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    User Role <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setUserFormData(prev => ({ ...prev, Role: 'user' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        userFormData.Role === 'user'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Standard User</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserFormData(prev => ({ ...prev, Role: 'admin' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        userFormData.Role === 'admin'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserFormData(prev => ({ ...prev, Role: 'In Active' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        userFormData.Role === 'In Active'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      <span>In Active</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Number & Email (Optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      WhatsApp Mobile Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={userFormData.Number}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, Number: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Email Address (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="e.g. user@company.com"
                        value={userFormData.Email}
                        onChange={(e) => setUserFormData(prev => ({ ...prev, Email: e.target.value }))}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    disabled={userFormSubmitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={userFormSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {userFormSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Saving User...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{isEditingUser ? 'Update User ID' : 'Save New User ID'}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* NEW DEDICATED SECTION 2: MANUAL DATA DUMP TO GOOGLE SHEET & BACKUP        */}
        {/* ========================================================================= */}
        <div className="bg-white/90 backdrop-blur-xl border-2 border-indigo-200/80 rounded-3xl p-6 md:p-8 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <span>📤 Manual Data Dump to Google Sheet</span>
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Live Sheet Sync
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Checklist, Delegation aur Whatsapp users ka live Supabase data ek click me Google Sheet par dump / sync karein.
                </p>
              </div>
            </div>

            {/* Overwrite Toggle */}
            <label className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={clearBeforeDump}
                onChange={(e) => setClearBeforeDump(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-700">Overwrite / Replace Sheet Content</span>
            </label>
          </div>

          {/* Dump Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* 1. Checklist Dump Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/50 border border-indigo-100 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-indigo-600" />
                    Checklist Sheet Dump
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/60 font-bold text-indigo-800">
                    {checklistCount.toLocaleString()} Rows
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supabase `Checklist` table ka saara data Google Sheet ke `Checklist` tab me dump karta hai.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleDumpToSheet('checklist')}
                  disabled={isDumping}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <UploadCloud className={`h-4 w-4 ${isDumping ? 'animate-bounce' : ''}`} />
                  <span>Dump Checklist to Google Sheet</span>
                </button>
                <button
                  onClick={() => handleDownloadCSV('Checklist')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-semibold text-[11px] text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Checklist CSV</span>
                </button>
              </div>
            </div>

            {/* 2. Delegation Dump Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/80 to-pink-50/50 border border-purple-100 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-purple-950 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-600" />
                    Delegation Sheet Dump
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/60 font-bold text-purple-800">
                    {delegationCount.toLocaleString()} Rows
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Supabase `Delegation` aur `DELEGATION DONE` tables ka data Google Sheet me sync karta hai.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleDumpToSheet('delegation')}
                  disabled={isDumping}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <UploadCloud className={`h-4 w-4 ${isDumping ? 'animate-bounce' : ''}`} />
                  <span>Dump Delegation to Google Sheet</span>
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleDownloadCSV('Delegation')}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl font-semibold text-[10px] text-purple-700 bg-white border border-purple-200 hover:bg-purple-50"
                  >
                    <Download className="h-3 w-3" />
                    <span>Delegation CSV</span>
                  </button>
                  <button
                    onClick={() => handleDownloadCSV('DELEGATION DONE')}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl font-semibold text-[10px] text-purple-700 bg-white border border-purple-200 hover:bg-purple-50"
                  >
                    <Download className="h-3 w-3" />
                    <span>Done CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Full Combined Dump Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white space-y-4 flex flex-col justify-between shadow-lg shadow-emerald-500/20">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    Full Sync (All Sheets)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                    Checklist + Delegation + Users
                  </span>
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed">
                  Ek sath Checklist + Delegation + Whatsapp Users ka poora data live Google Sheet par dump karein.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleDumpToSheet('all')}
                  disabled={isDumping}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs text-slate-900 bg-white hover:bg-emerald-50 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Zap className={`h-4 w-4 text-emerald-600 ${isDumping ? 'animate-spin' : ''}`} />
                  <span>{isDumping ? 'Dumping in Progress...' : '🚀 Dump All to Google Sheet'}</span>
                </button>
                <a
                  href="https://docs.google.com/spreadsheets/d/1r3YHyjqv24gZXBI9IofAhodnlBuDTA3sgyzU_PNCaQg/edit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl font-semibold text-[11px] text-white/90 hover:text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Target Google Sheet</span>
                </a>
              </div>
            </div>

          </div>

          {/* Progress Bar & Live Dump Status (when running) */}
          {(isDumping || dumpProgress > 0) && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-emerald-400 font-mono">
                  <RefreshCw className={`h-3.5 w-3.5 ${isDumping ? 'animate-spin' : ''}`} />
                  {dumpStatusMsg}
                </span>
                <span className="font-bold font-mono text-emerald-400">{dumpProgress}%</span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300 rounded-full"
                  style={{ width: `${dumpProgress}%` }}
                />
              </div>

              {/* Logs terminal */}
              <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] pt-2 border-t border-slate-800">
                {dumpLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-500">[{log.time}]</span>
                    <span className={
                      log.type === 'error' ? 'text-rose-400 font-bold' :
                      log.type === 'success' ? 'text-emerald-400 font-bold' :
                      'text-slate-300'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Grid: Trigger Console + Automation Rules */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left 2 Cols: Interactive Trigger Console */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-7 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Task Generation Trigger Console</h2>
                    <p className="text-xs text-slate-500">Run or simulate task generation from Unique templates</p>
                  </div>
                </div>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Sync Data
                </button>
              </div>

              {/* Trigger Settings Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Target Execution Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Tasks will be dated for this day</p>
                </div>

                <div className="flex flex-col justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Calendar Policy
                  </label>
                  <label className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                    <input
                      type="checkbox"
                      checked={ignoreCalendarCheck}
                      onChange={(e) => setIgnoreCalendarCheck(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-700 block">Ignore Holiday / Calendar Check</span>
                      <span className="text-slate-400 text-[10px]">Force run even if marked non-working day</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Trigger Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/70 to-pink-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-indigo-600" />
                    <span>Trigger Ready: {dueTemplatesCount} template(s) due to generate</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Evaluates frequencies (Daily, Weekly, Monthly, Yearly) and automatically prevents duplicate generation.
                  </p>
                </div>
                <button
                  onClick={() => handleExecuteTrigger()}
                  disabled={isRunningTrigger || loading}
                  className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isRunningTrigger ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      <span>Execute Trigger</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Execution Output Terminal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" />
                    Live Trigger Terminal Logs
                  </span>
                  {executionLogs.length > 0 && (
                    <button
                      onClick={() => setExecutionLogs([])}
                      className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-1.5 border border-slate-800 shadow-inner">
                  {executionLogs.length === 0 ? (
                    <div className="text-slate-500 italic py-3 text-center">
                      Click 'Execute Trigger' or 'Run Task Generator' to initiate live task generation logs.
                    </div>
                  ) : (
                    executionLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-500 select-none">[{log.time}]</span>
                        <span className={
                          log.type === 'error' ? 'text-rose-400 font-semibold' :
                          log.type === 'warning' ? 'text-amber-300' :
                          log.type === 'success' ? 'text-emerald-400 font-semibold' :
                          'text-slate-300'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Result Notification Card if triggered */}
              {lastResult && (
                <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-3 ${
                  lastResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {lastResult.success ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">{lastResult.message}</div>
                    <div className="text-[11px] opacity-80 mt-1">
                      Inserted {lastResult.tasksGenerated || 0} tasks into Checklist table in Supabase.
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right 1 Col: Automation & Schedule Settings */}
          <div className="space-y-6">
            
            {/* 🌙 Nightly 2:00 AM Cloud Cron Generator Card */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white border border-indigo-500/30 rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-indigo-800/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600/80 text-white shadow-lg shadow-indigo-500/30">
                    <Moon className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>Nightly 2:00 AM Task Generator</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                        Active
                      </span>
                    </h3>
                    <p className="text-[11px] text-indigo-300">Serverless Google Cloud Cron</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-white">🕒 Schedule:</strong> Every night at <span className="text-amber-300 font-bold">02:00 AM IST</span>.
                </p>
                <p className="text-[11px] text-slate-400">
                  Google Apps Script automatically evaluates the <span className="text-indigo-300 font-semibold">Working Calendar</span> &amp; <span className="text-indigo-300 font-semibold">Unique Templates</span> and inserts the new day's tasks directly into Supabase &amp; Sheets without needing any browser open.
                </p>
              </div>

              {nightlyTriggerStatus && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{nightlyTriggerStatus}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleSetupNightlyTrigger}
                  disabled={isSettingUpNightlyTrigger}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Zap className={`h-3.5 w-3.5 ${isSettingUpNightlyTrigger ? 'animate-spin' : ''}`} />
                  <span>{isSettingUpNightlyTrigger ? 'Configuring Cloud...' : '🌙 Setup / Refresh 2 AM Trigger'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRunNightlyCloudTest}
                  disabled={isRunningNightlyTest}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play className={`h-3.5 w-3.5 fill-current ${isRunningNightlyTest ? 'animate-spin' : ''}`} />
                  <span>{isRunningNightlyTest ? 'Testing...' : 'Test Cloud Run'}</span>
                </button>
              </div>
            </div>

            {/* Automated Schedule Card */}
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Background Automation</h3>
                  <p className="text-[11px] text-slate-500">Auto-generation preferences</p>
                </div>
              </div>

              {/* Toggle 1: Auto run on login */}
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-700 block">Auto-Check on Admin Login</span>
                  <span className="text-slate-400 text-[11px] leading-tight block">
                    Silently triggers pending daily tasks whenever an Admin logs into the dashboard.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAutoLogin(!autoTriggerOnLogin)}
                  className={`w-11 h-6 shrink-0 rounded-full transition-colors relative ${
                    autoTriggerOnLogin ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform absolute top-1 ${
                      autoTriggerOnLogin ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Select: Background polling interval */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Active Session Trigger Check
                </label>
                <select
                  value={autoScheduleInterval}
                  onChange={(e) => handleChangeInterval(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="15">Every 15 Minutes</option>
                  <option value="30">Every 30 Minutes</option>
                  <option value="60">Every 1 Hour (Recommended)</option>
                  <option value="120">Every 2 Hours</option>
                  <option value="0">Disabled (Manual Only)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Automatically runs in the background while dashboard remains open.
                </p>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-800 space-y-4">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Trigger Engine Rules
              </div>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Daily:</strong> Evaluates once per working day.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Weekly:</strong> Triggers 7 days after last date.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Monthly:</strong> Triggers on the corresponding day next month.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Duplicate Safe:</strong> Automatically updates `Last Date` in `Unique` table to prevent re-inserts.</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM SECTION: RECURRING CHECKLIST TEMPLATES INSPECTOR                    */}
        {/* ========================================================================= */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-indigo-600" />
                <span>Recurring Checklist Templates Inspector</span>
              </h2>
              <p className="text-xs text-slate-500">
                Inspect all recurring task definitions from 'Unique' table and their current generation status
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search template / assignee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <select
                value={freqFilter}
                onChange={(e) => setFreqFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none"
              >
                <option value="ALL">All Frequencies</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DUE">⚡ Due Today</option>
                <option value="UP_TO_DATE">✅ Up to Date</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Task ID</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Task Description</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Last Generated</th>
                  <th className="py-3 px-4">Status for Selected Date</th>
                  <th className="py-3 px-4 text-right">Instant Trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400 italic">
                      No matching recurring templates found
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((t) => {
                    const target = selectedDate ? new Date(selectedDate) : todayObj;
                    const dueInfo = isTemplateDue(t, target);
                    const freq = (t.Frequency || t.Freq || 'daily').toUpperCase();

                    return (
                      <tr key={t['Task ID']} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">#{t['Task ID']}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {t.Department || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{t.Name || '-'}</td>
                        <td className="py-3 px-4 max-w-xs truncate" title={t['Task Description'] || t['Tast Descriptions']}>
                          {t['Task Description'] || t['Tast Descriptions'] || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            freq === 'DAILY' ? 'bg-blue-100 text-blue-700' :
                            freq === 'WEEKLY' ? 'bg-purple-100 text-purple-700' :
                            freq === 'MONTHLY' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {freq}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {t['Last Date'] || <span className="text-slate-400 italic">Never</span>}
                        </td>
                        <td className="py-3 px-4">
                          {dueInfo.isDue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              <Zap className="h-3 w-3" /> Due Now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> Up to Date
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleExecuteTrigger(t['Task ID'])}
                            disabled={isRunningTrigger}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                            title="Generate a task right now for this template"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Run</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
