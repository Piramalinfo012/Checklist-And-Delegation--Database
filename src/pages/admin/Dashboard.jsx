"use client"

import { useState, useEffect, useRef } from "react"
import { BarChart3, CheckCircle2, Clock, ListTodo, Users, AlertTriangle, Filter, User, Edit3, Upload, X, ChevronDown, Check, Search } from 'lucide-react'
import AdminLayout from "../../components/layout/AdminLayout.jsx"
import { supabase } from "../../lib/supabaseClient"
import { uploadImageToCloudinary } from "../../lib/cloudinary"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"


// Custom Styled Dropdown Component
const CustomDropdown = ({ options, value, onChange, placeholder, icon: Icon, className, searchable = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = searchable 
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200/70 text-slate-800 font-semibold py-3 px-5 rounded-2xl shadow-sm hover:shadow-md border-2 border-slate-300 hover:border-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/20"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-purple-600" />}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
          {searchable && (
            <div className="p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  autoFocus
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-slate-500" />
                </div>
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors flex items-center justify-between
                    ${value === option.value ? 'bg-pink-50 text-pink-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 text-pink-500" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminDashboard() {
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec";
  const [dashboardType, setDashboardType] = useState("checklist")
  const [taskView, setTaskView] = useState("recent")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterStaff, setFilterStaff] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [userProfileImage, setUserProfileImage] = useState(null)
  const [userEmail, setUserEmail] = useState("")
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showLinkInputModal, setShowLinkInputModal] = useState(false);

  // State for department data
  const [departmentData, setDepartmentData] = useState({
    allTasks: [],
    staffMembers: [],
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    barChartData: [],
    pieChartData: [],
    // Add new counters for delegation mode
    completedRatingOne: 0,
    completedRatingTwo: 0,
    completedRatingThreePlus: 0
  })

  // Tracks whether the last department data fetch failed, so we can show a small
  // "retrying" indicator and keep automatically retrying in the background instead of
  // leaving the dashboard stuck at 0 until the user manually reloads the page.
  const [dataLoadError, setDataLoadError] = useState(false);
  const retryTimeoutRef = useRef(null);

  // Store the current date for overdue calculation
  const [currentDate, setCurrentDate] = useState(new Date())

  // New state for date range filtering
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
    filtered: false
  });

  // State to store filtered statistics
  const [filteredDateStats, setFilteredDateStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0
  });

  const getUserRole = () => {
    return sessionStorage.getItem('role') || 'user'; // Default to 'user' if not set
  };

  const isAdminUser = () => {
    return getUserRole() === 'admin';
  };

  const isRegularUser = () => {
    return getUserRole() === 'user';
  };

  const fetchUserProfileFromSheets = async (username) => {
    try {
      const { data, error } = await supabase.from('Whatsapp').select('*');
      if (error) throw error;
      const userRow = (data || []).find(r => (r['User name'] || r.Username || '').toLowerCase() === (username || '').toLowerCase());
      if (userRow) {
        if (userRow['ID'] || userRow.Email) setUserEmail(userRow['ID'] || userRow.Email);
        const photo = userRow.Photo || userRow.Image;
        if (photo) setUserProfileImage(getDisplayableImageUrl(photo));
      }
    } catch (error) {
      console.error("Error fetching profile from Supabase:", error);
    }
  };

  const getDisplayableImageUrl = (url) => {
    if (!url) return null;

    // Directly return standard web/Cloudinary/data/blob image URLs
    if (
      url.includes("cloudinary.com") ||
      url.includes("ui-avatars.com") ||
      url.startsWith("blob:") ||
      url.startsWith("data:") ||
      (!url.includes("drive.google.com") && (url.startsWith("http://") || url.startsWith("https://")))
    ) {
      return url;
    }

    try {
      const ucExportMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucExportMatch && ucExportMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${ucExportMatch[1]}&sz=w150`;
      }

      const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (directMatch && directMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w150`;
      }

      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
      if (openMatch && openMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w150`;
      }

      if (url.includes("thumbnail?id=")) {
        return url;
      }

      const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
      if (anyIdMatch && anyIdMatch[1]) {
        return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w150`;
      }

      const cacheBuster = Date.now();
      return url.includes("?") ? `${url}&cb=${cacheBuster}` : `${url}?cb=${cacheBuster}`;
    } catch (e) {
      console.error("Error processing image URL:", url, e);
      return url;
    }
  };

  useEffect(() => {
    const username = sessionStorage.getItem('username');
    if (username) {
      fetchUserProfileFromSheets(username);
    }
  }, []);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const uploadImageAndUpdateWhatsApp = async () => {
    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    try {
      setUploadingImage(true);
      const username = sessionStorage.getItem('username');

      if (!username) {
        throw new Error('Username not found in session');
      }

      // 1. Upload photo directly to Cloudinary
      const uploadedUrl = await uploadImageToCloudinary(selectedFile);
      if (!uploadedUrl) {
        throw new Error('Could not get image URL from Cloudinary upload');
      }

      // 2. Update Photo in Supabase Whatsapp table
      const { error: updateErr } = await supabase
        .from('Whatsapp')
        .update({ Photo: uploadedUrl })
        .ilike('Username', username.trim());

      if (updateErr) throw updateErr;

      // 3. Update local state with the new image
      setUserProfileImage(uploadedUrl);

      // 4. Close modal and reset
      setShowImageUploadModal(false);
      setSelectedFile(null);

      alert('Profile photo (DP) uploaded and updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload profile photo: ' + (error.message || error));
    } finally {
      setUploadingImage(false);
    }
  };

  const formatLocalDate = (isoDate) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    return formatDateToDDMMYYYY(date);
  };

  const filterTasksByDateRange = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      alert("Please select both start and end dates");
      return;
    }

    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (startDate > endDate) {
      alert("Start date must be before end date");
      return;
    }

    // Filter tasks within the date range
    const filteredTasks = departmentData.allTasks.filter(task => {
      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate);
      if (!taskStartDate) return false;

      return taskStartDate >= startDate && taskStartDate <= endDate;
    });

    // Count statistics
    let totalTasks = filteredTasks.length;
    let completedTasks = 0;
    let pendingTasks = 0;
    let overdueTasks = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredTasks.forEach(task => {
      if (task.status === 'completed') {
        completedTasks++;
      } else {
        // Task is not completed
        pendingTasks++; // All incomplete tasks count as pending

        if (task.status === 'overdue') {
          overdueTasks++; // Only past dates (excluding today) count as overdue
        }
      }
    });

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    // Update filtered stats
    setFilteredDateStats({
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate
    });

    // Set filtered flag to true
    setDateRange(prev => ({ ...prev, filtered: true }));
  };

  // Format date as DD/MM/YYYY
  // Format date as DD/MM/YYYY
  const formatDateToDDMMYYYY = (date) => {
    if (!date || isNaN(date.getTime())) return ''
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Parse DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD or date with time to Date object
  const parseDateFromDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null
    const cleanStr = dateStr.trim()
    const datePart = cleanStr.includes(' ') ? cleanStr.split(' ')[0] : (cleanStr.includes('T') ? cleanStr.split('T')[0] : cleanStr)
    const delimiter = datePart.includes('-') ? '-' : '/'
    const parts = datePart.split(delimiter)
    if (parts.length !== 3) return null
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      return isNaN(d.getTime()) ? null : d
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d
  }

  // Function to check if a date is in the past (excluding today)
  const isDateInPast = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date || isNaN(date.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() < today.getTime()
  }

  // Function to check if a date is today
  const isDateToday = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date || isNaN(date.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === today.getTime()
  }

  // Function to check if a date is tomorrow
  const isDateTomorrow = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date || isNaN(date.getTime())) return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() === tomorrow.getTime()
  }

  // Function to check if a date is in the future (from tomorrow onwards)
  const isDateFuture = (dateStr) => {
    const date = parseDateFromDDMMYYYY(dateStr)
    if (!date || isNaN(date.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    return date.getTime() > today.getTime()
  }

  // Safe access to cell value
  const getCellValue = (row, index) => {
    if (!row || !row.c || index >= row.c.length) return null;
    const cell = row.c[index];
    return cell && 'v' in cell ? cell.v : null;
  };

  // Parse Google Sheets Date format into a proper date string
  const parseGoogleSheetsDate = (dateStr) => {
    if (!dateStr) return ''

    if (typeof dateStr === 'string' && dateStr.startsWith('Date(')) {
      // Handle Google Sheets Date(year,month,day) format
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateStr)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10) // 0-indexed in Google's format
        const day = parseInt(match[3], 10)

        // Format as DD/MM/YYYY
        return `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
      }
    }

    // If it contains a date in DD/MM/YYYY format
    if (typeof dateStr === 'string') {
      const cleanStr = dateStr.trim();
      const datePart = cleanStr.includes(' ') ? cleanStr.split(' ')[0] : (cleanStr.includes('T') ? cleanStr.split('T')[0] : cleanStr);
      if (datePart.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = datePart.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${day}/${month}/${year}`;
      }
      if (datePart.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        const parts = datePart.split('-');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${day}/${month}/${year}`;
      }
    }

    // Handle Date objects
    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
      return formatDateToDDMMYYYY(dateStr);
    }

    // If we get here, try to parse as a date and format
    try {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return formatDateToDDMMYYYY(date);
      }
    } catch (e) {
      console.error("Error parsing date:", e)
    }

    // Return original if parsing fails
    return dateStr
  }

  // Modified fetch function to support both checklist and delegation
  const fetchDepartmentData = async () => {
    const isDelegation = dashboardType === "delegation";
    const userRole = getUserRole();
    const username = sessionStorage.getItem('username');

    try {
      let supabaseRows = [];
      let whatsappUsers = [];

      // Always fetch whatsapp users list so all staff members show in filters
      try {
        const { data: uData } = await supabase.from('Whatsapp').select('*');
        if (uData) whatsappUsers = uData;
      } catch (uErr) {
        console.warn('Error fetching whatsapp users:', uErr);
      }

      if (isDelegation) {
        let query = supabase.from('Delegation').select('*');
        if (userRole !== "admin" && username) {
          query = query.ilike('Name', username.trim());
        }
        const { data: dData, error: dError } = await query.order('Task ID', { ascending: false }).limit(2500);
        if (dError) throw dError;

        supabaseRows = (dData || []).map(r => ({
          c: [
            { v: r['Timestamp'] || '' },
            { v: r['Task ID'] || '' },
            { v: r['Department'] || '' },
            { v: r['Given By'] || '' },
            { v: r['Name'] || '' },
            { v: r['Task Description'] || '' },
            { v: r['Task Start Date'] || '' },
            { v: r['Freq'] || '' },
            { v: r['Enable Reminders'] || '' },
            { v: r['Require Attachment'] || '' },
            { v: r['Status'] || '' },
            { v: r['Actual'] || '' },
            { v: r['Delay'] || '' },
            { v: r['Remarks'] || '' },
            { v: r['Uploaded Image'] || '' },
          ]
        }));
      } else {
        // For CHECKLIST: Fetch all pending/incomplete tasks in parallel (up to 7000)
        // so that past overdue tasks from previous dates are NOT cut off by the 1000-row limit
        const batchSize = 1000;
        const pendingPromises = [];
        const isUserScoped = userRole !== "admin" && username;

        if (isUserScoped) {
          pendingPromises.push(
            supabase.from('Checklist')
              .select('*')
              .is('Actual', null)
              .ilike('Name', username.trim())
              .order('Task ID', { ascending: false })
              .limit(2000)
          );
        } else {
          for (let i = 0; i < 7; i++) {
            pendingPromises.push(
              supabase.from('Checklist')
                .select('*')
                .is('Actual', null)
                .order('Task ID', { ascending: false })
                .range(i * batchSize, (i + 1) * batchSize - 1)
            );
          }
        }

        let completedQuery = supabase.from('Checklist')
          .select('*')
          .not('Actual', 'is', null)
          .order('Task ID', { ascending: false })
          .limit(1000);

        if (isUserScoped) {
          completedQuery = completedQuery.ilike('Name', username.trim());
        }

        const [pendingResults, completedResult] = await Promise.all([
          Promise.all(pendingPromises),
          completedQuery
        ]);

        let allPendingRows = [];
        pendingResults.forEach(res => {
          if (res && res.data) {
            allPendingRows.push(...res.data);
          }
        });

        const allCompletedRows = (completedResult && completedResult.data) || [];
        const combinedChecklistData = [...allPendingRows, ...allCompletedRows];

        supabaseRows = combinedChecklistData.map(r => ({
          c: [
            { v: r['Timestamp'] || '' },
            { v: r['Task ID'] || '' },
            { v: r['Department'] || r['Firm'] || '' },
            { v: r['Given By'] || '' },
            { v: r['Name'] || '' },
            { v: r['Tast Descriptions'] || r['Task Description'] || '' },
            { v: r['Task Start Date'] || '' },
            { v: r['Freq'] || '' },
            { v: r['Enable Reminders'] || '' },
            { v: r['Require Attachment'] || '' },
            { v: r['Actual'] || '' },
            { v: r['Delay'] || '' },
            { v: r['Status'] || '' },
            { v: r['Remarks'] || '' },
            { v: r['Uploaded Image'] || '' },
            { v: r['Admin Done'] || '' },
            { v: r['Leave'] || '' },
          ]
        }));
      }

      const data = { table: { rows: [{ c: [] }, ...supabaseRows] } };

      // Initialize counters
      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let overdueTasks = 0;
      let completedRatingOne = 0;
      let completedRatingTwo = 0;
      let completedRatingThreePlus = 0;

      // Monthly data for bar chart
      const monthlyData = {
        Jan: { completed: 0, pending: 0 },
        Feb: { completed: 0, pending: 0 },
        Mar: { completed: 0, pending: 0 },
        Apr: { completed: 0, pending: 0 },
        May: { completed: 0, pending: 0 },
        Jun: { completed: 0, pending: 0 },
        Jul: { completed: 0, pending: 0 },
        Aug: { completed: 0, pending: 0 },
        Sep: { completed: 0, pending: 0 },
        Oct: { completed: 0, pending: 0 },
        Nov: { completed: 0, pending: 0 },
        Dec: { completed: 0, pending: 0 }
      };

      const statusData = { Completed: 0, Pending: 0, Overdue: 0 };
      const staffTrackingMap = new Map();

      if (Array.isArray(whatsappUsers)) {
        whatsappUsers.forEach(u => {
          const name = (u['User name'] || u.Username || u.name || '').trim();
          if (name && !name.startsWith('DELETED_')) {
            staffTrackingMap.set(name, {
              name,
              photo: u.Photo || u.Image || '',
              email: u.Email || '',
              totalTasks: 0,
              completedTasks: 0,
              pendingTasks: 0,
              progress: 0,
            });
          }
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const processedRows = data.table.rows
        .map((row, rowIndex) => {
          if (rowIndex === 0) return null;

          const assignedTo = getCellValue(row, 4) || "Unassigned";
          const taskId = getCellValue(row, 1);
          const leaveVal = getCellValue(row, 16);
          const isLeave = leaveVal && String(leaveVal).trim().toLowerCase() === "leave";

          if (isLeave) {
            return null; // Skip leave tasks entirely from dashboard metrics
          }

          if (
            isRegularUser() &&
            assignedTo.toLowerCase() !== username.toLowerCase()
          ) {
            return null; // Skip this task entirely for regular users
          }

          // Debug: Log row processing for first few rows
          if (rowIndex <= 5) {
            //console.log(`Processing row ${rowIndex + 1} (sheet row ${rowIndex + 1}):`, row);
          }
          const isUserMatch =
            userRole === "admin" ||
            assignedTo.toLowerCase() === username.toLowerCase();

          // Debug: Log user matching for first few rows
          if (rowIndex <= 5) {
            //console.log(`Row ${rowIndex + 1}: assignedTo="${assignedTo}", username="${username}", userRole="${userRole}", isMatch=${isUserMatch}`);
          }

          // If not a match and not admin, skip this row
          if (!isUserMatch) {
            if (rowIndex <= 5)
              //console.log(`Row ${rowIndex + 1}: Skipped due to user mismatch`);
              return null;
          }

          // Debug: Log task ID for first few rows
          if (rowIndex <= 5) {
            //console.log(`Row ${rowIndex + 1}: taskId="${taskId}" (type: ${typeof taskId})`);
          }

          // More lenient validation - allow any non-empty value as task ID
          if (
            taskId === null ||
            taskId === undefined ||
            taskId === "" ||
            (typeof taskId === "string" && taskId.trim() === "")
          ) {
            if (rowIndex <= 5)
              //console.log(`Row ${rowIndex + 1}: Skipped due to empty/null task ID`);
              return null;
          }

          // Convert task ID to string for consistency
          const taskIdStr = String(taskId).trim();

          // Get task start date from Column G (index 6) - "Task Start Date"
          let taskStartDateValue = getCellValue(row, 6);
          const taskStartDate = taskStartDateValue
            ? parseGoogleSheetsDate(String(taskStartDateValue))
            : "";

          // Debug: Log task start date for first few rows
          if (rowIndex <= 5) {
            //console.log(`Row ${rowIndex + 1}: taskStartDateValue="${taskStartDateValue}", parsed="${taskStartDate}"`);
          }

          // UPDATED: Different date filtering logic for delegation vs checklist
          if (dashboardType === "delegation") {
            // For DELEGATION mode: Process ALL tasks with valid task IDs, no date filtering
            if (
              !taskId ||
              taskId === null ||
              taskId === undefined ||
              taskId === "" ||
              (typeof taskId === "string" && taskId.trim() === "")
            ) {
              if (rowIndex <= 5)
                //console.log(`Row ${rowIndex + 1}: Skipped due to invalid task ID in delegation mode`);
                return null;
            }
          } else {
            // For CHECKLIST mode: Keep existing date filtering logic
            const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate);

            if (rowIndex <= 5) {
              //console.log(`Row ${rowIndex + 1}: taskStartDateObj=${taskStartDateObj}, today=${today}, tomorrow=${tomorrow}, isValid=${!!taskStartDateObj}`);
            }

            // Process tasks that have a valid start date and are due up to tomorrow (include tomorrow's tasks)
            if (!taskStartDateObj || taskStartDateObj > tomorrow) {
              if (rowIndex <= 5)
                //console.log(`Row ${rowIndex + 1}: Skipped due to invalid/far future date (beyond tomorrow)`);
                return null; // Skip tasks beyond tomorrow
            }
          }

          // Get completion data based on dashboard type
          let completionDateValue, completionDate;
          if (dashboardType === "delegation") {
            // For delegation: Column L (index 11) - "Actual"
            completionDateValue = getCellValue(row, 11);
          } else {
            // For checklist: Column K (index 10) - "Actual"
            completionDateValue = getCellValue(row, 10);
          }

          completionDate = completionDateValue
            ? parseGoogleSheetsDate(String(completionDateValue))
            : "";

          // Debug: Log completion date for first few rows
          if (rowIndex <= 5) {
            //console.log(`Row ${rowIndex + 1}: completionDateValue="${completionDateValue}", parsed="${completionDate}"`);
          }

          // NEW: Get status from Column U (index 20) and rating from Column R (index 17) for delegation mode
          const statusColumnU = dashboardType === "delegation" ? getCellValue(row, 20) : null;
          const ratingColumnR = dashboardType === "delegation" ? getCellValue(row, 17) : null;

          // Track staff details
          if (!staffTrackingMap.has(assignedTo)) {
            staffTrackingMap.set(assignedTo, {
              name: assignedTo,
              totalTasks: 0,
              completedTasks: 0,
              pendingTasks: 0,
              progress: 0,
            });
          }

          // Get additional task details
          const taskDescription = getCellValue(row, 5) || "Untitled Task"; // Column F - "Task Description"
          const frequency = getCellValue(row, 7) || "one-time"; // Column H - "Freq"

          // UPDATED: Determine task status for display purposes - restored overdue logic for delegation
          let status = "pending";

          if (completionDate && completionDate !== "") {
            status = "completed";
          } else if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
            // For both modes: past dates (excluding today) = overdue
            status = "overdue";
          } else {
            // For both modes: today or future dates = pending
            status = "pending";
          }

          // Debug: Log status determination for first few rows
          if (rowIndex <= 5) {
            //console.log(`Row ${rowIndex + 1}: status="${status}", completionDate="${completionDate}", dashboardType="${dashboardType}"`);
          }

          // Create the task object
          const taskObj = {
            id: taskIdStr,
            title: taskDescription,
            assignedTo,
            taskStartDate,
            dueDate: taskStartDate, // Keep for compatibility
            status,
            frequency,
          };

          // Debug: Log task object for first few rows
          if (rowIndex <= 5) {
            //console.log(`Row ${rowIndex + 1}: Created task object:`, taskObj);
          }

          // Update staff member totals
          const staffData = staffTrackingMap.get(assignedTo);
          staffData.totalTasks++;

          // UPDATED: Count for dashboard cards - different logic for delegation vs checklist
          if (dashboardType === "delegation") {
            // For DELEGATION mode: Count ALL valid tasks, no date restrictions
            totalTasks++;

            // NEW LOGIC: Count based on Column U status and Column R rating
            if (statusColumnU === "Done") {
              completedTasks++;
              staffData.completedTasks++;
              statusData.Completed++;

              // Count by rating from Column R
              if (ratingColumnR === 1) {
                completedRatingOne++;
              } else if (ratingColumnR === 2) {
                completedRatingTwo++;
              } else if (ratingColumnR >= 3) {
                completedRatingThreePlus++;
              }

              // Update monthly data for completed tasks
              const completedMonth = parseDateFromDDMMYYYY(completionDate);
              if (completedMonth) {
                const monthName = completedMonth.toLocaleString("default", {
                  month: "short",
                });
                if (monthlyData[monthName]) {
                  monthlyData[monthName].completed++;
                }
              }
            } else {
              // Task is not completed - apply counting logic for both modes
              staffData.pendingTasks++;

              if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
                // Past dates (excluding today) = overdue
                overdueTasks++;
                statusData.Overdue++;
              }

              // All incomplete tasks (including overdue + today) = pending
              pendingTasks++;
              statusData.Pending++;

              // Update monthly data for pending tasks
              const monthName = (
                dashboardType === "delegation" ? new Date() : today
              ).toLocaleString("default", { month: "short" });
              if (monthlyData[monthName]) {
                monthlyData[monthName].pending++;
              }
            }
          } else {
            // For CHECKLIST mode: Keep existing logic with date restrictions
            const taskStartDateObj = parseDateFromDDMMYYYY(taskStartDate);
            const shouldCountInStats = taskStartDateObj <= today;

            if (shouldCountInStats) {
              totalTasks++;

              if (status === "completed") {
                completedTasks++;
                staffData.completedTasks++;
                statusData.Completed++;

                // Update monthly data for completed tasks
                const completedMonth = parseDateFromDDMMYYYY(completionDate);
                if (completedMonth) {
                  const monthName = completedMonth.toLocaleString("default", {
                    month: "short",
                  });
                  if (monthlyData[monthName]) {
                    monthlyData[monthName].completed++;
                  }
                }
              } else {
                staffData.pendingTasks++;

                if (isDateInPast(taskStartDate) && !isDateToday(taskStartDate)) {
                  // Past dates (excluding today) = overdue
                  overdueTasks++;
                  statusData.Overdue++;
                }

                // All incomplete tasks (including overdue + today) = pending
                pendingTasks++;
                statusData.Pending++;

                // Update monthly data for pending tasks
                const monthName = today.toLocaleString("default", {
                  month: "short",
                });
                if (monthlyData[monthName]) {
                  monthlyData[monthName].pending++;
                }
              }
            }
          }
          const hasAccess = isAdminUser() || assignedTo.toLowerCase() === username.toLowerCase();

          return taskObj;
        })
        .filter((task) => task !== null);

      // Debug: Log processing summary
      //console.log(`Processing summary for ${sheetName}:`);
      //console.log(`  Dashboard type: ${dashboardType}`);
      //console.log(`  Total rows in sheet: ${data.table.rows.length}`);
      //console.log(`  Rows after filtering: ${processedRows.length}`);
      //console.log(`  Total tasks counted: ${totalTasks}`);
      //console.log(`  Completed tasks: ${completedTasks}`);
      //console.log(`  Pending tasks: ${pendingTasks}`);
      //console.log(`  Overdue tasks: ${overdueTasks}`);
      //console.log(`  Completed Rating 1: ${completedRatingOne}`);
      //console.log(`  Completed Rating 2: ${completedRatingTwo}`);
      //console.log(`  Completed Rating 3+: ${completedRatingThreePlus}`);


      // Fetch accurate global counts from Supabase directly
      let exactTotalTasks = totalTasks;
      let exactCompletedTasks = completedTasks;
      let exactPendingTasks = pendingTasks;

      try {
        if (isDelegation) {
          let qTotal = supabase.from('Delegation').select('*', { count: 'exact', head: true });
          let qDone = supabase.from('DELEGATION DONE').select('*', { count: 'exact', head: true });
          if (userRole !== "admin" && username) {
            qTotal = qTotal.ilike('Name', username.trim());
            qDone = qDone.ilike('Name', username.trim());
          }
          const [tRes, dRes] = await Promise.all([qTotal, qDone]);
          exactTotalTasks = tRes.count || 0;
          exactCompletedTasks = dRes.count || 0;
          exactPendingTasks = Math.max(0, exactTotalTasks - exactCompletedTasks);
        } else {
          let qTotal = supabase.from('Checklist').select('*', { count: 'exact', head: true });
          let qPending = supabase.from('Checklist').select('*', { count: 'exact', head: true }).is('Actual', null);
          if (userRole !== "admin" && username) {
            qTotal = qTotal.ilike('Name', username.trim());
            qPending = qPending.ilike('Name', username.trim());
          }
          const [tRes, pRes] = await Promise.all([qTotal, qPending]);
          exactTotalTasks = tRes.count || 0;
          exactPendingTasks = pRes.count || 0;
          exactCompletedTasks = Math.max(0, exactTotalTasks - exactPendingTasks);
        }
      } catch (cntErr) {
        console.warn('Count fetch error:', cntErr);
      }

      totalTasks = exactTotalTasks;
      completedTasks = exactCompletedTasks;
      pendingTasks = exactPendingTasks;

      // Calculate completion rate
      const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0;

      // Convert monthly data to chart format
      const barChartData = Object.entries(monthlyData).map(([name, data]) => ({
        name,
        completed: data.completed,
        pending: data.pending
      }));

      // Convert status data to pie chart format
      const pieChartData = [
        { name: "Completed", value: statusData.Completed, color: "#22c55e" },
        { name: "Pending", value: statusData.Pending, color: "#facc15" },
        { name: "Overdue", value: statusData.Overdue, color: "#ef4444" }
      ];

      const filteredStaffMembers = isAdminUser()
        ? Array.from(staffTrackingMap.values()) // Admin sees all staff
        : Array.from(staffTrackingMap.values()).filter(staff =>
          staff.name.toLowerCase() === username.toLowerCase()
        ); // Regular users see only themselves

      // Update the staff members processing:
      const staffMembers = filteredStaffMembers.map((staff) => {
        const progress =
          staff.totalTasks > 0
            ? Math.round((staff.completedTasks / staff.totalTasks) * 100)
            : 0;

        const matchingUser = (whatsappUsers || []).find(
          u => (u['User name'] || u.Username || '').trim().toLowerCase() === staff.name.trim().toLowerCase()
        );

        const photo = staff.photo || matchingUser?.Photo || matchingUser?.Image || '';
        const email = staff.email || matchingUser?.Email || `${staff.name.toLowerCase().replace(/\s+/g, ".")}@example.com`;

        return {
          id: staff.name.replace(/\s+/g, "-").toLowerCase(),
          name: staff.name,
          email: email,
          photo: photo,
          totalTasks: staff.totalTasks,
          completedTasks: staff.completedTasks,
          pendingTasks: staff.pendingTasks,
          progress,
        };
      });

      // Update department data state
      const newDepartmentData = {
        allTasks: processedRows,
        staffMembers,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate,
        barChartData,
        pieChartData,
        completedRatingOne,
        completedRatingTwo,
        completedRatingThreePlus
      };
      setDepartmentData(newDepartmentData);

      // Success — clear any error indicator and cancel a pending retry, if one was scheduled.
      setDataLoadError(false);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

    } catch (error) {
      console.error(`Error fetching ${sheetName} sheet data:`, error);
      // The backend occasionally fails intermittently (a known, accepted limitation we can't
      // fix from the frontend). Rather than leaving the dashboard stuck at 0 until the user
      // manually reloads, keep quietly retrying in the background until it succeeds.
      setDataLoadError(true);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        fetchDepartmentData();
      }, 25000);
    }
  };

  useEffect(() => {
    // Show cached data from the last visit instantly (no blank/zeroed dashboard
    // flash) when switching tabs or navigating back, then quietly refresh it.
    try {
      const cached = localStorage.getItem(`dashboard_page_cache_${dashboardType}`);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        if (parsedCache && Array.isArray(parsedCache.allTasks)) {
          setDepartmentData(parsedCache);
        }
      }
    } catch (e) { /* ignore corrupt cache */ }

    fetchDepartmentData();
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [dashboardType]);

  // Near-real-time refresh: silently re-fetch every 15s in the background so
  // updates made elsewhere in the sheet show up here without a manual reload.
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchDepartmentData();
    }, 15000);
    return () => clearInterval(intervalId);
  }, [dashboardType]);

  // When dashboard loads, set current date
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  // Filter tasks based on the filter criteria
  const filteredTasks = departmentData.allTasks.filter((task) => {
    // Filter by status
    if (filterStatus !== "all" && task.status !== filterStatus) return false;

    // Filter by staff
    if (filterStaff !== "all" && task.assignedTo !== filterStaff) return false;

    // Filter by search query
    if (searchQuery && searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();

      if (typeof task.title === 'string' && task.title.toLowerCase().includes(query)) {
        return true;
      }

      if ((typeof task.id === 'string' && task.id.toLowerCase().includes(query)) ||
        (typeof task.id === 'number' && task.id.toString().includes(query))) {
        return true;
      }

      if (typeof task.assignedTo === 'string' && task.assignedTo.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    }

    return true;
  });

  // UPDATED: Get tasks by view with updated delegation logic
  const getTasksByView = (view) => {
    const viewFilteredTasks = filteredTasks.filter((task) => {
      // Skip completed tasks in all views
      if (task.status === "completed") return false;

      // Apply date-based filtering
      const taskStartDate = parseDateFromDDMMYYYY(task.taskStartDate);
      if (!taskStartDate) return false;

      switch (view) {
        case "recent":
          if (dashboardType === "delegation") {
            // For DELEGATION: Show only today's tasks (pending only)
            return isDateToday(task.taskStartDate);
          } else {
            // For CHECKLIST: Show tasks due today (pending only)
            return isDateToday(task.taskStartDate);
          }
        case "upcoming":
          if (dashboardType === "delegation") {
            // For DELEGATION: Show all future tasks (from tomorrow onwards, excluding today)
            return isDateFuture(task.taskStartDate);
          } else {
            // For CHECKLIST: Show tasks due tomorrow only
            return isDateTomorrow(task.taskStartDate);
          }
        case "overdue":
          if (dashboardType === "delegation") {
            // For DELEGATION: Show all past date pending tasks (excluding today)
            return isDateInPast(task.taskStartDate) && !isDateToday(task.taskStartDate);
          } else {
            // For CHECKLIST: Show tasks with start dates in the past (excluding today)
            return isDateInPast(task.taskStartDate) && !isDateToday(task.taskStartDate);
          }
        default:
          return true;
      }
    });

    return viewFilteredTasks;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500 hover:bg-green-600 text-white"
      case "pending":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "overdue":
        return "bg-red-500 hover:bg-red-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  const getFrequencyColor = (frequency) => {
    switch (frequency) {
      case "one-time":
        return "bg-gray-500 hover:bg-gray-600 text-white"
      case "daily":
        return "bg-blue-500 hover:bg-blue-600 text-white"
      case "weekly":
        return "bg-purple-500 hover:bg-purple-600 text-white"
      case "fortnightly":
        return "bg-indigo-500 hover:bg-indigo-600 text-white"
      case "monthly":
        return "bg-orange-500 hover:bg-orange-600 text-white"
      case "quarterly":
        return "bg-amber-500 hover:bg-amber-600 text-white"
      case "yearly":
        return "bg-emerald-500 hover:bg-emerald-600 text-white"
      default:
        return "bg-gray-500 hover:bg-gray-600 text-white"
    }
  }

  // Tasks Overview Chart Component
  const TasksOverviewChart = () => {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={departmentData.barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} dy={10} />
          <YAxis fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} dx={-10} tickFormatter={(value) => `${value}`} />
          <Tooltip 
            cursor={{fill: 'rgba(0,0,0,0.02)'}}
            contentStyle={{ 
              borderRadius: '16px', 
              border: '1px solid rgba(255,255,255,0.6)', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              padding: '12px'
            }} 
            itemStyle={{ fontWeight: 500 }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
          <Bar dataKey="completed" stackId="a" fill="#10b981" barSize={16} radius={[0, 0, 4, 4]} />
          <Bar dataKey="pending" stackId="a" fill="#f59e0b" barSize={16} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Tasks Completion Chart Component
  const TasksCompletionChart = () => {
    const COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#6366f1'];
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie 
            data={departmentData.pieChartData} 
            cx="50%" 
            cy="50%" 
            innerRadius={80} 
            outerRadius={105} 
            paddingAngle={6} 
            dataKey="value"
            stroke="none"
            cornerRadius={8}
          >
            {departmentData.pieChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              borderRadius: '16px', 
              border: '1px solid rgba(255,255,255,0.6)', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              padding: '12px'
            }} 
            itemStyle={{ fontWeight: 500, color: '#334155' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // Staff Tasks Table Component
  const StaffTasksTable = () => {
    return (
      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Tasks
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {departmentData.staffMembers.map((staff) => {
              const avatarSrc = staff.photo
                ? getDisplayableImageUrl(staff.photo)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name || 'U')}&background=6366f1&color=fff&bold=true`;

              return (
                <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img
                        src={avatarSrc}
                        alt={staff.name}
                        className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-sm flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name || 'U')}&background=6366f1&color=fff&bold=true`;
                        }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{staff.name}</div>
                        <div className="text-xs text-gray-500">{staff.email}</div>
                      </div>
                    </div>
                  </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.totalTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.completedTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.pendingTasks}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-[100px] bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${staff.progress}%` }}></div>
                    </div>
                    <span className="text-xs text-gray-500">{staff.progress}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {staff.progress >= 80 ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Excellent
                    </span>
                  ) : staff.progress >= 60 ? (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Good
                    </span>
                  ) : (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Needs Improvement
                    </span>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* MODIFIED: Updated header section to include profile image */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-700">
              CHECKLIST & DELEGATION
            </h2>
            {dataLoadError && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                डेटा लोड करने में समस्या, दोबारा कोशिश जारी है... / Having trouble loading data, retrying automatically...
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              {userProfileImage ? (
                <div className="relative">
                  <img
                    src={userProfileImage}
                    alt="Profile"
                    className="w-15 h-15 rounded-full object-cover border-2 border-gray-50 cursor-pointer transition-all duration-200 group-hover:brightness-75 shadow-md"
                    style={{
                      width: "60px",
                      height: "60px",
                      backgroundColor: "#f3f4f6",
                      objectPosition: "center",
                    }}
                    onClick={() => setShowImageUploadModal(true)}
                    onError={(e) => {
                      const originalUrl = userProfileImage
                        .replace("thumbnail?", "uc?export=view&")
                        .replace("&sz=w150", "");
                      e.target.src = originalUrl;
                    }}
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-30 rounded-full cursor-pointer"
                    onClick={() => setShowImageUploadModal(true)}
                  >
                    <Edit3 className="h-5 w-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <div
                    className="w-15 h-15 rounded-full bg-purple-500 flex items-center justify-center border-2 border-purple-600 cursor-pointer transition-all duration-200 group-hover:brightness-75"
                    style={{ width: "60px", height: "60px" }}
                    onClick={() => setShowLinkInputModal(true)}
                  >
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-30 rounded-full cursor-pointer"
                    onClick={() => setShowLinkInputModal(true)}
                  >
                    <Edit3 className="h-5 w-5 text-white" />
                  </div>
                </div>
              )}
            </div>

            <div className="w-[180px]">
              <CustomDropdown
                value={dashboardType}
                onChange={setDashboardType}
                options={[
                  { value: "checklist", label: "Checklist" },
                  { value: "delegation", label: "Delegation" }
                ]}
                icon={ListTodo}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="card-3d-wrapper card-3d-blue">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-blue-600 tracking-wider uppercase">
                Total Tasks
              </h3>
              <div className="crystal-orb-3d crystal-orb-blue">
                <ListTodo className="h-5 w-5" />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-3xl font-extrabold text-slate-800 number-3d-text">
                {departmentData.totalTasks}
              </div>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">
                {dashboardType === "delegation"
                  ? `${isAdminUser()
                    ? "All tasks in delegation sheet"
                    : "Your tasks in delegation sheet"
                  }`
                  : `${isAdminUser()
                    ? "Total tasks in checklist (up to today)"
                    : "Your tasks in checklist (up to today)"
                  }`}
              </p>
            </div>
          </div>

          <div className="card-3d-wrapper card-3d-emerald">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-emerald-600 tracking-wider uppercase">
                {dashboardType === "delegation"
                  ? "Completed Once"
                  : "Completed Tasks"}
              </h3>
              <div className="crystal-orb-3d crystal-orb-emerald">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="pt-1">
              <div className="text-3xl font-extrabold text-slate-800 number-3d-text">
                {dashboardType === "delegation"
                  ? departmentData.completedRatingOne
                  : departmentData.completedTasks}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">
                {dashboardType === "delegation"
                  ? "Tasks completed once"
                  : "Total completed till date"}
              </p>
            </div>
          </div>

          <div className="card-3d-wrapper card-3d-amber">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-amber-600 tracking-wider uppercase">
                {dashboardType === "delegation"
                  ? "Completed Twice"
                  : "Pending Tasks"}
              </h3>
              <div className="crystal-orb-3d crystal-orb-amber">
                {dashboardType === "delegation" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
            </div>
            <div className="pt-1">
              <div className="text-3xl font-extrabold text-slate-800 number-3d-text">
                {dashboardType === "delegation"
                  ? departmentData.completedRatingTwo
                  : departmentData.pendingTasks}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">
                {dashboardType === "delegation"
                  ? "Tasks completed twice"
                  : "Including today + overdue"}
              </p>
            </div>
          </div>

          <div className="card-3d-wrapper card-3d-rose">
            <div className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-rose-600 tracking-wider uppercase">
                {dashboardType === "delegation"
                  ? "Completed 3+ Times"
                  : "Overdue Tasks"}
              </h3>
              <div className="crystal-orb-3d crystal-orb-rose">
                {dashboardType === "delegation" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
            </div>
            <div className="pt-1">
              <div className="text-3xl font-extrabold text-slate-800 number-3d-text">
                {dashboardType === "delegation"
                  ? departmentData.completedRatingThreePlus
                  : departmentData.overdueTasks}
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">
                {dashboardType === "delegation"
                  ? "Tasks completed 3+ times"
                  : "Past due (excluding today)"}
              </p>
            </div>
          </div>
        </div>

        {/* Task Navigation Tabs - Restored to 3 tabs for both modes */}
        <div className="w-full overflow-hidden rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="grid grid-cols-3 p-1.5 gap-1" style={{ background: 'rgba(255,255,255,0.3)' }}>
            <button
              className={`py-2.5 text-center text-sm font-medium rounded-xl transition-all duration-200 ${taskView === "recent"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-500 hover:bg-white/60"
                }`}
              onClick={() => setTaskView("recent")}
            >
              {dashboardType === "delegation" ? "Today Tasks" : "Recent Tasks"}
            </button>
            <button
              className={`py-2.5 text-center text-sm font-medium rounded-xl transition-all duration-200 ${taskView === "upcoming"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-500 hover:bg-white/60"
                }`}
              onClick={() => setTaskView("upcoming")}
            >
              {dashboardType === "delegation"
                ? "Future Tasks"
                : "Upcoming Tasks"}
            </button>
            <button
              className={`py-2.5 text-center text-sm font-medium rounded-xl transition-all duration-200 ${taskView === "overdue"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-500 hover:bg-white/60"
                }`}
              onClick={() => setTaskView("overdue")}
            >
              Overdue Tasks
            </button>
          </div>

          <div className="p-4">
            <div className="flex flex-col gap-4 md:flex-row mb-4">
              <div className="flex-1 space-y-2">
                <label
                  htmlFor="search"
                  className="flex items-center text-purple-700 font-semibold text-sm"
                >
                  <Search className="h-4 w-4 mr-2 text-purple-600" />
                  Search Tasks
                </label>
                <div className="relative">
                  <input
                    id="search"
                    placeholder="Search by task title or ID"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-full bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-slate-800 font-medium placeholder:text-slate-500 border-2 border-slate-300 hover:border-slate-400 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-500" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 md:w-[200px]">
                <label
                  htmlFor="staff-filter"
                  className="flex items-center text-purple-700 font-semibold text-sm"
                >
                  <Filter className="h-4 w-4 mr-2 text-purple-600" />
                  Filter by Staff
                </label>
                <CustomDropdown
                  value={filterStaff}
                  onChange={setFilterStaff}
                  options={[
                    { value: "all", label: "All Staff" },
                    ...departmentData.staffMembers
                      .filter(
                        (staff) =>
                          isAdminUser() ||
                          staff.name.toLowerCase() ===
                          sessionStorage.getItem("username")?.toLowerCase()
                      )
                      .map((staff) => ({ value: staff.name, label: staff.name }))
                  ]}
                  placeholder="Filter by Staff"
                  className="w-full"
                  searchable={true}
                />
              </div>
            </div>

            {getTasksByView(taskView).length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                <p>No tasks found matching your filters.</p>
              </div>
            ) : (
              <div
                className="overflow-x-auto"
                style={{ maxHeight: "400px", overflowY: "auto" }}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Task ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Task Description
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Assigned To
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Task Start Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Frequency
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getTasksByView(taskView).map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {task.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.assignedTo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.taskStartDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getFrequencyColor(
                              task.frequency
                            )}`}
                          >
                            {task.frequency.charAt(0).toUpperCase() +
                              task.frequency.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <div className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}>
            <div className="flex flex-row items-center justify-between p-4 pb-2">
              <h3 className="text-sm font-medium text-indigo-600">
                Task Completion Rate
              </h3>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <BarChart3 className="h-4 w-4 text-indigo-500" />
              </div>
            </div>
            <div className="p-4 pt-1">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-slate-800">
                  {departmentData.completionRate}%
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full"></span>
                  <span className="text-xs text-slate-500">
                    Completed: {departmentData.completedTasks}
                  </span>
                  <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
                  <span className="text-xs text-slate-500">
                    Total: {departmentData.totalTasks}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full mt-2" style={{ background: 'rgba(0,0,0,0.06)' }}>
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${departmentData.completionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-4">
          <div className="rounded-2xl p-1.5 flex space-x-1" style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === "overview"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-500 hover:bg-white/60"
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("mis")}
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === "mis"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-500 hover:bg-white/60"
                }`}
            >
              MIS Report
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`flex-1 py-2.5 text-center text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === "staff"
                ? "bg-slate-800 text-white shadow-md"
                : "text-slate-500 hover:bg-white/60"
                }`}
            >
              Staff Performance
            </button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-4 rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}>
                  <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                    <h3 className="text-slate-700 font-semibold">
                      Tasks Overview
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Task completion rate over time
                    </p>
                  </div>
                  <div className="p-4 pl-2">
                    <TasksOverviewChart />
                  </div>
                </div>
                <div className="lg:col-span-3 rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}>
                  <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                    <h3 className="text-slate-700 font-semibold">
                      Task Status
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Distribution of tasks by status
                    </p>
                  </div>
                  <div className="p-4">
                    <TasksCompletionChart />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                  <h3 className="text-slate-700 font-semibold">
                    Staff Task Summary
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Overview of tasks assigned to each staff member
                  </p>
                </div>
                <div className="p-4">
                  <StaffTasksTable />
                </div>
              </div>
            </div>
          )}

          {/* UPDATED: Modified MIS Report section for delegation mode */}
          {activeTab === "mis" && (
            <div className="rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}>
              <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                <h3 className="text-slate-700 font-semibold">MIS Report</h3>
                <p className="text-slate-400 text-sm">
                  {dashboardType === "delegation"
                    ? `${isAdminUser()
                      ? "Detailed delegation analytics - all tasks from sheet data"
                      : "Detailed delegation analytics - your tasks only"}`
                    : `${isAdminUser()
                      ? "Detailed task analytics and performance metrics"
                      : "Your task analytics and performance metrics"}`
                  }
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {/* UPDATED: Only show date range selection for checklist mode */}
                  {dashboardType !== "delegation" && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="space-y-2 lg:col-span-1">
                        <label
                          htmlFor="start-date"
                          className="flex items-center text-purple-700 text-sm font-medium"
                        >
                          Start Date
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={dateRange.startDate}
                          onChange={(e) =>
                            setDateRange((prev) => ({
                              ...prev,
                              startDate: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-1">
                        <label
                          htmlFor="end-date"
                          className="flex items-center text-purple-700 text-sm font-medium"
                        >
                          End Date
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={dateRange.endDate}
                          onChange={(e) =>
                            setDateRange((prev) => ({
                              ...prev,
                              endDate: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-purple-200 p-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-2 flex items-end">
                        <button
                          onClick={filterTasksByDateRange}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors"
                        >
                          Apply Filter
                        </button>
                      </div>
                    </div>
                  )}

                  {/* UPDATED: Overall stats with different displays for delegation vs checklist */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">
                        Total Tasks Assigned
                      </div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.totalTasks
                          : dateRange.filtered
                            ? filteredDateStats.totalTasks
                            : departmentData.totalTasks}
                      </div>
                      {dashboardType === "delegation" ? (
                        <p className="text-xs text-purple-600">
                          All tasks from delegation sheet
                        </p>
                      ) : (
                        dateRange.filtered && (
                          <p className="text-xs text-purple-600">
                            For period: {formatLocalDate(dateRange.startDate)}{" "}
                            - {formatLocalDate(dateRange.endDate)}
                          </p>
                        )
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">
                        Tasks Completed
                      </div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.completedTasks
                          : dateRange.filtered
                            ? filteredDateStats.completedTasks
                            : departmentData.completedTasks}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-purple-600">
                        {dashboardType === "delegation"
                          ? "Tasks Pending"
                          : "Tasks Pending/Overdue"}
                      </div>
                      <div className="text-3xl font-bold text-purple-700">
                        {dashboardType === "delegation"
                          ? departmentData.pendingTasks
                          : dateRange.filtered
                            ? `${filteredDateStats.pendingTasks} / ${filteredDateStats.overdueTasks}`
                            : `${departmentData.pendingTasks} / ${departmentData.overdueTasks}`}
                      </div>
                      <div className="text-xs text-purple-600">
                        {dashboardType === "delegation"
                          ? "All incomplete tasks"
                          : "Pending (all incomplete) / Overdue (past dates only)"}
                      </div>
                    </div>
                  </div>

                  {/* UPDATED: Additional breakdown - only for checklist with date filtering */}
                  {dashboardType !== "delegation" && dateRange.filtered && (
                    <div className="rounded-lg border border-purple-100 p-4 bg-gray-50">
                      <h4 className="text-lg font-medium text-purple-700 mb-4">
                        Detailed Date Range Breakdown
                      </h4>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-sm font-medium text-amber-700">
                            Pending Tasks
                          </div>
                          <div className="text-2xl font-bold text-amber-600">
                            {filteredDateStats.pendingTasks}
                          </div>
                          <div className="text-xs text-amber-600 mt-1">
                            All incomplete tasks (including overdue + today)
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">
                            Overdue Tasks
                          </div>
                          <div className="text-2xl font-bold text-red-600">
                            {filteredDateStats.overdueTasks}
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            Past due dates only (excluding today)
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-green-200">
                          <div className="text-sm font-medium text-green-700">
                            Completed Once
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {departmentData.completedRatingOne}
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            Tasks with rating 1
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-200">
                          <div className="text-sm font-medium text-amber-700">
                            Completed Twice
                          </div>
                          <div className="text-2xl font-bold text-amber-600">
                            {departmentData.completedRatingTwo}
                          </div>
                          <div className="text-xs text-amber-600 mt-1">
                            Tasks with rating 2
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                          <div className="text-sm font-medium text-red-700">
                            Completed 3+ Times
                          </div>
                          <div className="text-2xl font-bold text-red-600">
                            {departmentData.completedRatingThreePlus}
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            Tasks with rating 3 or higher
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-purple-700">
                      Department Performance
                    </h3>
                    <div className="grid gap-4 md:grid-cols-1">
                      <div className="rounded-lg border border-purple-200 bg-white p-4">
                        <h4 className="text-sm font-medium text-purple-700 mb-2">
                          Completion Rate
                        </h4>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-purple-700">
                            {dashboardType === "delegation"
                              ? departmentData.completionRate
                              : dateRange.filtered
                                ? filteredDateStats.completionRate
                                : departmentData.completionRate}
                            %
                          </div>
                          <div className="flex-1">
                            <div className="w-full h-6 bg-gray-200 rounded-full">
                              <div
                                className="h-full rounded-full flex items-center justify-end px-3 text-xs font-medium text-white"
                                style={{
                                  width: `${dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : dateRange.filtered
                                      ? filteredDateStats.completionRate
                                      : departmentData.completionRate
                                    }%`,
                                  background: `linear-gradient(to right, #10b981 ${(dashboardType === "delegation"
                                    ? departmentData.completionRate
                                    : dateRange.filtered
                                      ? filteredDateStats.completionRate
                                      : departmentData.completionRate) * 0.8
                                    }%, #f59e0b ${(dashboardType === "delegation"
                                      ? departmentData.completionRate
                                      : dateRange.filtered
                                        ? filteredDateStats.completionRate
                                        : departmentData.completionRate) * 0.8
                                    }%)`,
                                }}
                              >
                                {dashboardType === "delegation"
                                  ? departmentData.completionRate
                                  : dateRange.filtered
                                    ? filteredDateStats.completionRate
                                    : departmentData.completionRate}
                                %
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-purple-600 mt-2">
                          {dashboardType === "delegation"
                            ? `${departmentData.completedTasks} of ${departmentData.totalTasks} tasks completed in delegation mode (all sheet data)`
                            : `${dateRange.filtered
                              ? filteredDateStats.completedTasks
                              : departmentData.completedTasks
                            } of ${dateRange.filtered
                              ? filteredDateStats.totalTasks
                              : departmentData.totalTasks
                            } tasks completed in checklist mode`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "staff" && (
            <div className="rounded-lg border border-purple-200 shadow-md bg-white">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h3 className="text-purple-700 font-medium">
                  Staff Performance
                </h3>
                <p className="text-purple-600 text-sm">
                  {dashboardType === "delegation"
                    ? `${isAdminUser()
                      ? "Task completion rates by staff member (all delegation sheet data)"
                      : "Your task completion rate (delegation sheet data)"}`
                    : `${isAdminUser()
                      ? "Task completion rates by staff member (tasks up to today only)"
                      : "Your task completion rate (tasks up to today only)"}`
                  }
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-8">
                  {departmentData.staffMembers.length > 0 ? (
                    <>
                      {(() => {
                        // Sort staff members by performance (high to low)
                        const sortedStaffMembers = [
                          ...departmentData.staffMembers,
                        ]
                          .filter((staff) => staff.totalTasks > 0)
                          .sort((a, b) => b.progress - a.progress);

                        return (
                          <>
                            {/* High performers section (70% or above) */}
                            <div className="rounded-md border border-green-200">
                              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
                                <h3 className="text-lg font-medium text-green-700">
                                  Top Performers
                                </h3>
                                <p className="text-sm text-green-600">
                                  {dashboardType === "delegation"
                                    ? "Staff with high task completion rates (all delegation data)"
                                    : "Staff with high task completion rates (tasks up to today only)"}
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter((staff) => staff.progress >= 70)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-green-100 rounded-md bg-green-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">
                                              {staff.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-green-700">
                                              {staff.name}
                                            </p>
                                            <p className="text-xs text-green-600">
                                              {staff.completedTasks} of{" "}
                                              {staff.totalTasks} tasks
                                              completed
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-green-600">
                                          {staff.progress}%
                                        </div>
                                      </div>
                                    ))}
                                  {sortedStaffMembers.filter(
                                    (staff) => staff.progress >= 70
                                  ).length === 0 && (
                                      <div className="text-center p-4 text-gray-500">
                                        <p>
                                          No staff members with high completion
                                          rates found.
                                        </p>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Mid performers section (40-69%) */}
                            <div className="rounded-md border border-yellow-200">
                              <div className="p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200">
                                <h3 className="text-lg font-medium text-yellow-700">
                                  Average Performers
                                </h3>
                                <p className="text-sm text-yellow-600">
                                  {dashboardType === "delegation"
                                    ? "Staff with moderate task completion rates (all delegation data)"
                                    : "Staff with moderate task completion rates (tasks up to today only)"}
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter(
                                      (staff) =>
                                        staff.progress >= 40 &&
                                        staff.progress < 70
                                    )
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-yellow-100 rounded-md bg-yellow-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">
                                              {staff.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-yellow-700">
                                              {staff.name}
                                            </p>
                                            <p className="text-xs text-yellow-600">
                                              {staff.completedTasks} of{" "}
                                              {staff.totalTasks} tasks
                                              completed
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-yellow-600">
                                          {staff.progress}%
                                        </div>
                                      </div>
                                    ))}
                                  {sortedStaffMembers.filter(
                                    (staff) =>
                                      staff.progress >= 40 &&
                                      staff.progress < 70
                                  ).length === 0 && (
                                      <div className="text-center p-4 text-gray-500">
                                        <p>
                                          No staff members with moderate
                                          completion rates found.
                                        </p>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Low performers section (below 40%) */}
                            <div className="rounded-md border border-red-200">
                              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                                <h3 className="text-lg font-medium text-red-700">
                                  Needs Improvement
                                </h3>
                                <p className="text-sm text-red-600">
                                  {dashboardType === "delegation"
                                    ? "Staff with lower task completion rates (all delegation data)"
                                    : "Staff with lower task completion rates (tasks up to today only)"}
                                </p>
                              </div>
                              <div className="p-4">
                                <div className="space-y-4">
                                  {sortedStaffMembers
                                    .filter((staff) => staff.progress < 40)
                                    .map((staff) => (
                                      <div
                                        key={staff.id}
                                        className="flex items-center justify-between p-3 border border-red-100 rounded-md bg-red-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center">
                                            <span className="text-sm font-medium text-white">
                                              {staff.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-red-700">
                                              {staff.name}
                                            </p>
                                            <p className="text-xs text-red-600">
                                              {staff.completedTasks} of{" "}
                                              {staff.totalTasks} tasks
                                              completed
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-lg font-bold text-red-600">
                                          {staff.progress}%
                                        </div>
                                      </div>
                                    ))}
                                  {sortedStaffMembers.filter(
                                    (staff) => staff.progress < 40
                                  ).length === 0 && (
                                      <div className="text-center p-4 text-gray-500">
                                        <p>
                                          No staff members with low completion
                                          rates found.
                                        </p>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* No assigned tasks section */}
                            {departmentData.staffMembers.filter(
                              (staff) => staff.totalTasks === 0
                            ).length > 0 && (
                                <div className="rounded-md border border-gray-200">
                                  <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                    <h3 className="text-lg font-medium text-gray-700">
                                      No Tasks Assigned
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      {dashboardType === "delegation"
                                        ? "Staff with no tasks in delegation sheet"
                                        : "Staff with no tasks assigned for current period"}
                                    </p>
                                  </div>
                                  <div className="p-4">
                                    <div className="space-y-4">
                                      {departmentData.staffMembers
                                        .filter(
                                          (staff) => staff.totalTasks === 0
                                        )
                                        .map((staff) => (
                                          <div
                                            key={staff.id}
                                            className="flex items-center justify-between p-3 border border-gray-100 rounded-md bg-gray-50"
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center">
                                                <span className="text-sm font-medium text-white">
                                                  {staff.name.charAt(0)}
                                                </span>
                                              </div>
                                              <div>
                                                <p className="font-medium text-gray-700">
                                                  {staff.name}
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                  {dashboardType === "delegation"
                                                    ? "No tasks in delegation sheet"
                                                    : "No tasks assigned up to today"}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-lg font-bold text-gray-600">
                                              N/A
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      <p>
                        {dashboardType === "delegation"
                          ? "No delegation data available."
                          : "Loading staff data..."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showImageUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Profile Image
              </h3>
              <button
                onClick={() => {
                  setShowImageUploadModal(false);
                  setSelectedFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image File
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: JPG, PNG, GIF (Max 10MB)
                </p>
              </div>

              {selectedFile && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Upload className="h-5 w-5 text-purple-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowImageUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadImageAndUpdateWhatsApp}
                  disabled={!selectedFile || uploadingImage}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    "Upload Image"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}