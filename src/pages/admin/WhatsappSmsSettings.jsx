"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, AlertCircle, RefreshCw, Key, Shield, 
  Smartphone, Database, Sliders, ExternalLink, Copy, Check, Eye, EyeOff, 
  Trash2, Download, Search, Filter, Sparkles, Clock, User, Phone, CheckCircle, 
  AlertTriangle, FileText, Settings, ArrowRight, X, Play
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { 
  getMaytapiConfig, 
  saveMaytapiConfig, 
  sendMaytapiSMS, 
  getWhatsappLogs, 
  clearWhatsappLogs, 
  generateDelegationMessage,
  formatPhoneNumber
} from '../../utils/whatsappService';

const SQL_SETUP_SCRIPT = `-- ==============================================================================
-- SUPABASE SQL SETUP FOR WHATSAPP SMS & LOGS
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Create whatsapp_logs table to store full message delivery logs
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    task_id TEXT,
    recipient_name TEXT,
    recipient_phone TEXT,
    allocated_by TEXT,
    message TEXT,
    status TEXT DEFAULT 'Sent',
    response JSONB,
    error TEXT
);

-- Enable RLS and add public access policies
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for public on whatsapp_logs" ON public.whatsapp_logs;
CREATE POLICY "Allow all operations for public on whatsapp_logs" ON public.whatsapp_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. Create whatsapp_settings table to store Maytapi credentials centrally
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    product_id TEXT,
    phone_id TEXT,
    token TEXT,
    api_url TEXT DEFAULT 'https://api.maytapi.com/api',
    enabled BOOLEAN DEFAULT true,
    template TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add public access policies
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for public on whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Allow all operations for public on whatsapp_settings" ON public.whatsapp_settings FOR ALL USING (true) WITH CHECK (true);

-- Grant table privileges
GRANT ALL ON TABLE public.whatsapp_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.whatsapp_settings TO anon, authenticated, service_role;
`;

export default function WhatsappSmsSettings() {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'logs'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Maytapi Config State
  const [config, setConfig] = useState({
    productId: '',
    phoneId: '',
    token: '',
    apiUrl: 'https://api.maytapi.com/api',
    enabled: true,
    template: '',
  });

  const [showToken, setShowToken] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Test SMS State
  const [testNumber, setTestNumber] = useState('');
  const [testRecipientName, setTestRecipientName] = useState('Test User');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // WhatsApp Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('ALL'); // 'ALL' | 'Sent' | 'Failed'
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);

  // Load initial config and logs
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const currentConfig = await getMaytapiConfig();
        setConfig(currentConfig);
        const logData = await getWhatsappLogs();
        setLogs(logData);
      } catch (err) {
        console.error('Error initializing WhatsApp settings:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      if (!config.productId || !config.phoneId || !config.token) {
        if (config.enabled) {
          throw new Error('Please fill in Product ID, Phone ID, and Secret Token before enabling.');
        }
      }

      await saveMaytapiConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Save configuration error:', err);
      setSaveError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestSMS = async () => {
    if (!testNumber) {
      alert('Please enter a valid phone number for testing!');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    const dummyTask = {
      'Task ID': 'TEST-999',
      'Given By': 'System Admin',
      Name: testRecipientName || 'Test User',
      'Task Description': 'Test automated WhatsApp message from Maytapi Integration',
      'Task Start Date': new Date().toLocaleDateString('en-GB'),
    };

    const previewMsg = generateDelegationMessage(dummyTask, config.template);

    try {
      const res = await sendMaytapiSMS({
        toNumber: testNumber,
        message: previewMsg,
        taskId: 'TEST-999',
        recipientName: testRecipientName,
        allocatedBy: 'Admin (Test)',
        configOverride: config,
      });

      setTestResult(res);

      // Refresh logs
      const updatedLogs = await getWhatsappLogs();
      setLogs(updatedLogs);
    } catch (err) {
      setTestResult({ success: false, error: err.message || String(err) });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRefreshLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await getWhatsappLogs();
      setLogs(data);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all WhatsApp SMS logs?')) return;
    await clearWhatsappLogs();
    setLogs([]);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadCsv = () => {
    if (logs.length === 0) {
      alert('No logs available to export');
      return;
    }

    const headers = ['Time (UTC/IST)', 'Task ID', 'Recipient', 'Phone Number', 'Allocated By', 'Status', 'Message', 'Error Details'];
    const rows = logs.map(l => [
      `"${l.created_at || ''}"`,
      `"${l.task_id || ''}"`,
      `"${(l.recipient_name || '').replace(/"/g, '""')}"`,
      `"${l.recipient_phone || ''}"`,
      `"${(l.allocated_by || '').replace(/"/g, '""')}"`,
      `"${l.status || ''}"`,
      `"${(l.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(l.error || (l.response ? JSON.stringify(l.response) : '')).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WhatsApp_SMS_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = logSearchQuery.toLowerCase();
      const matchSearch = !q || 
        (l.task_id && String(l.task_id).toLowerCase().includes(q)) ||
        (l.recipient_name && l.recipient_name.toLowerCase().includes(q)) ||
        (l.recipient_phone && l.recipient_phone.includes(q)) ||
        (l.allocated_by && l.allocated_by.toLowerCase().includes(q)) ||
        (l.message && l.message.toLowerCase().includes(q));

      const matchStatus = logStatusFilter === 'ALL' || (l.status || '').toLowerCase() === logStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [logs, logSearchQuery, logStatusFilter]);

  // Sample live template preview
  const sampleTask = {
    'Task ID': '1042',
    'Given By': 'Piramal Director',
    Name: 'Rajesh Kumar',
    'Task Description': 'Complete GST Reconciliation and upload invoice verification sheet',
    'Task Start Date': '15/10/2026',
  };
  const livePreviewText = generateDelegationMessage(sampleTask, config.template);

  const isConfigured = Boolean(config.productId && config.phoneId && config.token);

  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-8 space-y-8 bg-slate-50/50">
        
        {/* Top Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 md:p-8 text-white shadow-2xl border border-emerald-900/30">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                <MessageSquare className="h-3.5 w-3.5" />
                Maytapi WhatsApp SMS Automation
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <span>WhatsApp SMS & Logs</span>
                {isConfigured && config.enabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active & Connected
                  </span>
                ) : !isConfigured ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <AlertTriangle className="h-3.5 w-3.5" /> Unconfigured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    ⛔ Disabled
                  </span>
                )}
              </h1>
              <p className="text-slate-300 text-sm max-w-2xl">
                Automatically send instant WhatsApp notifications to assignees whenever a new Delegation Task is created, and monitor real-time delivery logs.
              </p>
            </div>

            {/* Quick Links & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dashboard/settings#user-management"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <User className="h-3.5 w-3.5 text-emerald-300" />
                <span>User Directory</span>
              </Link>
              <Link
                to="/dashboard/settings#manual-data-dump"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5 text-cyan-300" />
                <span>Data Dump</span>
              </Link>
              <Link
                to="/dashboard/settings#trigger-console"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-300" />
                <span>Trigger Console</span>
              </Link>
              <Link
                to="/dashboard/settings#recurring-templates"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all border border-white/10 whitespace-nowrap"
              >
                <Settings className="h-3.5 w-3.5 text-indigo-300" />
                <span>Templates Inspector</span>
              </Link>
              <button
                onClick={() => setShowSqlModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-200 font-bold text-xs backdrop-blur-md transition-all border border-emerald-500/40 whitespace-nowrap"
              >
                <Database className="h-3.5 w-3.5 text-emerald-400" />
                <span>Database SQL</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="relative z-10 flex items-center gap-2 mt-8 pt-6 border-t border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Key className="h-4 w-4" />
              <span>Maytapi Credentials & Template</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>WhatsApp Delivery Logs</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'logs' ? 'bg-slate-950 text-emerald-300' : 'bg-white/20 text-white'
              }`}>
                {logs.length}
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CREDENTIALS & TEMPLATE CONFIGURATION                               */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Credentials Form */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Form Alert */}
              {saveSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Maytapi WhatsApp credentials & template saved successfully!</span>
                </div>
              )}
              {saveError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2 shadow-sm">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Card: Maytapi API Credentials */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800">
                        Maytapi API Credentials
                      </h2>
                      <p className="text-xs text-slate-400">
                        Enter your Maytapi WhatsApp API Product ID, Phone ID & Secret Token
                      </p>
                    </div>
                  </div>

                  {/* Master Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-2.5 text-xs font-bold text-slate-700">
                      {config.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Product ID */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Product ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 5xxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={config.productId}
                        onChange={(e) => setConfig(prev => ({ ...prev, productId: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                        required={config.enabled}
                      />
                    </div>

                    {/* Phone ID */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Phone ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 12345"
                        value={config.phoneId}
                        onChange={(e) => setConfig(prev => ({ ...prev, phoneId: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                        required={config.enabled}
                      />
                    </div>
                  </div>

                  {/* Secret Token */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Secret Token (x-maytapi-key) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        placeholder="Enter Maytapi Secret Token..."
                        value={config.token}
                        onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
                        className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                        required={config.enabled}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* API Base URL (Advanced) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      API Base URL
                    </label>
                    <input
                      type="text"
                      value={config.apiUrl || 'https://api.maytapi.com/api'}
                      onChange={(e) => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Message Template */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Delegation Task Message Template</span>
                      </label>
                    </div>
                    <textarea
                      rows={9}
                      value={config.template}
                      onChange={(e) => setConfig(prev => ({ ...prev, template: e.target.value }))}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all leading-relaxed"
                      placeholder="Enter WhatsApp message template..."
                    />
                    
                    {/* Placeholder badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 mr-1">Available Tags:</span>
                      {['$(Name)', '$(Task ID)', '$(Given By)', '$(Task Description)', '$(Task Start Date)'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, template: `${prev.template} ${tag}` }))}
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 font-mono text-[10px] font-bold transition-all cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Saving Maytapi Credentials...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Save WhatsApp SMS Credentials & Template</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Card: Test SMS Sender */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="p-2.5 rounded-2xl bg-teal-50 text-teal-600">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">
                      Send Test WhatsApp Message
                    </h3>
                    <p className="text-xs text-slate-400">
                      Verify your Maytapi connection by sending a live test message to your phone
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Recipient Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 (10 digits)"
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Recipient Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Amit Sharma"
                      value={testRecipientName}
                      onChange={(e) => setTestRecipientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendTestSMS}
                  disabled={isSendingTest || !isConfigured}
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Sending Test WhatsApp Message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send Live Test WhatsApp SMS</span>
                    </>
                  )}
                </button>

                {/* Test Feedback */}
                {testResult && (
                  <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 border ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 overflow-hidden">
                      <p className="font-extrabold">
                        {testResult.success ? '🎉 Test Message Sent Successfully!' : '❌ Failed to Send Test Message'}
                      </p>
                      {testResult.error && (
                        <p className="font-mono text-[11px] text-rose-700 font-normal break-all">
                          {testResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Phone Mockup & Template Preview */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* WhatsApp Message Preview Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span>Live WhatsApp Notification Preview</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                    Sample Task
                  </span>
                </div>

                {/* WhatsApp Chat Bubble Mockup */}
                <div className="p-4 rounded-3xl bg-[#e5ddd5] border border-slate-300/60 shadow-inner relative overflow-hidden">
                  <div className="max-w-[92%] bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-slate-800 space-y-1 border border-black/5">
                    <p className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap font-sans text-slate-900">
                      {livePreviewText}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-medium pt-1">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <Check className="h-3 w-3 text-sky-500 stroke-[2.5]" />
                    </div>
                  </div>
                </div>

                {/* Instruction Notes */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs space-y-2 leading-relaxed">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>How Automated SMS Works:</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px]">
                    <li>When an Admin assigns a new <strong>Delegation Task</strong> in Assign Task, the system automatically finds the user's phone number in the <code>Whatsapp</code> users table.</li>
                    <li>It fills the placeholders with task data and triggers Maytapi WhatsApp API.</li>
                    <li>Delivery status & API responses are automatically logged to the <strong>WhatsApp Log</strong> table below.</li>
                  </ul>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WHATSAPP DELIVERY LOGS                                             */}
        {/* ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            
            {/* Logs Toolbar */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Task ID, Recipient Name, Phone Number, or Message..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setLogStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logStatusFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({logs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogStatusFilter('Sent')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logStatusFilter === 'Sent' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Sent ({logs.filter(l => (l.status || '').toLowerCase() === 'sent').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogStatusFilter('Failed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logStatusFilter === 'Failed' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Failed ({logs.filter(l => (l.status || '').toLowerCase() === 'failed').length})
                  </button>
                </div>

                {/* Actions */}
                <button
                  type="button"
                  onClick={handleRefreshLogs}
                  disabled={loadingLogs}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
                
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/60 transition-all cursor-pointer"
                  title="Export Logs to CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer border border-rose-200/60"
                  title="Clear All Logs"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Task ID</th>
                      <th className="py-3.5 px-4">Recipient</th>
                      <th className="py-3.5 px-4">Phone Number</th>
                      <th className="py-3.5 px-4">Allocated By</th>
                      <th className="py-3.5 px-4">Message Content</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                          <MessageSquare className="h-8 w-8 mx-auto text-slate-300" />
                          <p className="font-bold text-slate-500">No WhatsApp SMS logs found</p>
                          <p className="text-xs text-slate-400">
                            {logSearchQuery ? 'Try adjusting your search criteria.' : 'Logs will appear here automatically when delegation tasks are assigned.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log, idx) => {
                        const isSuccess = (log.status || '').toLowerCase() === 'sent';
                        const createdDate = log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-';

                        return (
                          <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            
                            {/* Status */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isSuccess
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {isSuccess ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-rose-600" />
                                )}
                                <span>{log.status || (isSuccess ? 'Sent' : 'Failed')}</span>
                              </span>
                            </td>

                            {/* Timestamp */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {createdDate}
                            </td>

                            {/* Task ID */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] border border-indigo-200/50">
                                #{log.task_id || '-'}
                              </span>
                            </td>

                            {/* Recipient */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-800">
                              {log.recipient_name || '-'}
                            </td>

                            {/* Phone */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                              {log.recipient_phone ? (
                                <a
                                  href={`https://wa.me/${log.recipient_phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold hover:underline"
                                >
                                  <Phone className="h-3 w-3" />
                                  <span>{log.recipient_phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            {/* Allocated By */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                              {log.allocated_by || 'Admin'}
                            </td>

                            {/* Message Preview */}
                            <td className="py-3.5 px-4 max-w-[280px]">
                              <p className="truncate text-slate-500 font-mono text-[11px]" title={log.message}>
                                {log.message || '-'}
                              </p>
                            </td>

                            {/* Action / View */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedLogForModal(log)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Details</span>
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
        )}

        {/* ========================================================================= */}
        {/* MODAL: LOG DETAILS POPUP                                                  */}
        {/* ========================================================================= */}
        {selectedLogForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-4 p-6 md:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    WhatsApp Message Log Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLogForModal(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Task ID</span>
                    <span className="font-mono font-extrabold text-indigo-700">#{selectedLogForModal.task_id || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Status</span>
                    <span className={`font-bold ${selectedLogForModal.status === 'Sent' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {selectedLogForModal.status || 'Sent'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Recipient</span>
                    <span className="font-bold text-slate-800">{selectedLogForModal.recipient_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-bold">Phone</span>
                    <span className="font-mono font-bold text-emerald-700">{selectedLogForModal.recipient_phone || '-'}</span>
                  </div>
                </div>

                {/* Message Body */}
                <div className="space-y-1">
                  <span className="font-bold text-slate-700">Message Content:</span>
                  <div className="p-3.5 rounded-2xl bg-[#e5ddd5] text-slate-900 border border-slate-300/80 font-sans text-xs whitespace-pre-wrap leading-relaxed shadow-inner">
                    {selectedLogForModal.message}
                  </div>
                </div>

                {/* Error details if failed */}
                {selectedLogForModal.error && (
                  <div className="space-y-1">
                    <span className="font-bold text-rose-700">Error / Response:</span>
                    <pre className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 font-mono text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {selectedLogForModal.error}
                    </pre>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLogForModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: SUPABASE SQL SCHEMA SETUP                                          */}
        {/* ========================================================================= */}
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-4 p-6 md:p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Supabase SQL Setup for WhatsApp Logs
                    </h3>
                    <p className="text-xs text-slate-400">
                      Create `whatsapp_logs` & `whatsapp_settings` tables in your Supabase project
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">SQL Commands:</span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 transition-all cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative max-h-72 overflow-y-auto rounded-2xl bg-slate-900 p-4 border border-slate-800">
                  <pre className="font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap">
                    {SQL_SETUP_SCRIPT}
                  </pre>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-bold">Instructions:</span> Open your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-0.5">Supabase SQL Editor <ExternalLink className="h-3 w-3" /></a>, paste the SQL above and click <strong>Run</strong>.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
