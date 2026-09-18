"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Upload,
  X,
  Search,
  History,
  ArrowLeft,
  Edit,
  Image,
  Camera,
  Image as ImageIcon,
  Clipboard,
  RefreshCw
} from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";
import { supabase } from "../lib/supabaseClient";
import { uploadImageToCloudinary } from "../lib/cloudinary";

const CONFIG = {
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec",

  DRIVE_FOLDER_ID: "1txwq9Rhrz5G7348qPtpNX0IGPdGlw6J7",


  SOURCE_SHEET_NAME: "DELEGATION",
  TARGET_SHEET_NAME: "DELEGATION DONE",

  PAGE_CONFIG: {
    title: "DELEGATION Tasks",
    historyTitle: "DELEGATION Task History",
    description: "Showing all pending tasks",
    historyDescription:
      "Read-only view of completed tasks with submission history",
  },
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function DelegationDataPage() {
  const [accountData, setAccountData] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [additionalData, setAdditionalData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarksData, setRemarksData] = useState({});
  // Tracks whether a successful load has ever completed, so a failed
  // background poll (see the 15s auto-refresh effect below) knows whether
  // it's safe to keep showing already-loaded data instead of surfacing an error.
  const hasLoadedOnceRef = useRef(false);
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [statusData, setStatusData] = useState({});
  const [nextTargetDate, setNextTargetDate] = useState({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userRole, setUserRole] = useState("");
  const [username, setUsername] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });

  const [selectedHistoryItems, setSelectedHistoryItems] = useState([]);
  const [markingAsDone, setMarkingAsDone] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    itemCount: 0,
  });
  const [delegationData, setDelegationData] = useState([]);

  const [statusCounts, setStatusCounts] = useState({
    Done: 0,
    Pending: 0,
    Planned: 0,
    "Verify Pending": 0,
  });

  const [editingRemarks, setEditingRemarks] = useState({});
  const [tempRemarks, setTempRemarks] = useState({});

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const formatDateToDDMMYYYY = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const isTaskDisabled = useCallback((status, userRole) => {
    if (userRole === "admin") {
      return status === "Done";
    } else {
      return status === "Done" || status === "Verify Pending";
    }
  }, []);

  const createGoogleSheetsDate = useCallback((date) => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, []);

  const formatDateForGoogleSheets = useCallback((date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    return {
      formatted: `${day}/${month}/${year}`,
      dateObject: new Date(year, date.getMonth(), date.getDate()),
      iso: date.toISOString().split("T")[0],
      googleSheetsValue: `=DATE(${year},${month},${day})`,
    };
  }, []);

  const convertToGoogleSheetsDate = useCallback(
    (dateString) => {
      if (!dateString || typeof dateString !== "string") return "";

      if (dateString.includes("/")) {
        const [day, month, year] = dateString.split("/");
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return formatDateForGoogleSheets(date);
        }
      }

      if (dateString.includes("-")) {
        const [year, month, day] = dateString.split("-");
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return formatDateForGoogleSheets(date);
        }
      }

      return {
        formatted: dateString,
        dateObject: null,
        iso: "",
        googleSheetsValue: dateString,
      };
    },
    [formatDateForGoogleSheets]
  );

  const isEmpty = useCallback((value) => {
    return (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    );
  }, []);

  useEffect(() => {
    if (accountData.length > 0) {
      const counts = {
        Done: 0,
        Pending: 0,
        Planned: 0,
        "Verify Pending": 0,
      };

      let filteredData = accountData;
      if (nameFilter) {
        filteredData = accountData.filter(
          (item) => item["col4"] === nameFilter
        );
      }

      filteredData.forEach((item) => {
        if (userRole !== "admin" && item["col4"] !== username) return;

        const status = item["col20"];
        if (status && counts.hasOwnProperty(status)) {
          counts[status]++;
        }
      });

      setStatusCounts(counts);
    }
  }, [accountData, userRole, username, nameFilter]);

  useEffect(() => {
    const role = sessionStorage.getItem("role");
    const user = sessionStorage.getItem("username");
    setUserRole(role || "");
    setUsername(user || "");
  }, []);

  const parseGoogleSheetsDate = useCallback(
    (dateStr) => {
      if (!dateStr) return "";

      if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
        return formatDateToDDMMYYYY(dateStr);
      }

      if (typeof dateStr !== "string") {
        dateStr = String(dateStr);
      }
      dateStr = dateStr.trim();
      if (!dateStr) return "";

      // Check DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY (with or without time like ", 12:38:12 pm")
      const dmyMatch = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, "0");
        const month = dmyMatch[2].padStart(2, "0");
        const year = dmyMatch[3];
        return `${day}/${month}/${year}`;
      }

      // Check YYYY-MM-DD (with or without time like "T12:38:12")
      const ymdMatch = dateStr.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, "0");
        const day = ymdMatch[3].padStart(2, "0");
        return `${day}/${month}/${year}`;
      }

      // Google Sheets Date(year,month,day)
      if (dateStr.startsWith("Date(")) {
        const match = /Date\((\d+),(\d+),(\d+)\)/.exec(dateStr);
        if (match) {
          const year = Number.parseInt(match[1], 10);
          const month = Number.parseInt(match[2], 10);
          const day = Number.parseInt(match[3], 10);
          return `${day.toString().padStart(2, "0")}/${(month + 1)
            .toString()
            .padStart(2, "0")}/${year}`;
        }
      }

      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return formatDateToDDMMYYYY(date);
        }
      } catch (error) {
        console.error("Error parsing date:", error);
      }

      return dateStr;
    },
    [formatDateToDDMMYYYY]
  );

  const formatDateForDisplay = useCallback(
    (dateStr) => {
      if (!dateStr) return "—";
      const formatted = parseGoogleSheetsDate(dateStr);
      return formatted || "—";
    },
    [parseGoogleSheetsDate]
  );

  const parseDateFromDDMMYYYY = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }, []);

  const sortDateWise = useCallback(
    (a, b) => {
      const dateStrA = a["col6"] || "";
      const dateStrB = b["col6"] || "";
      const dateA = parseDateFromDDMMYYYY(dateStrA);
      const dateB = parseDateFromDDMMYYYY(dateStrB);

      const statusA = a["col20"] || "";
      const statusB = b["col20"] || "";

      const isPendingA = statusA === "Pending";
      const isPendingB = statusB === "Pending";

      if (isPendingA && !isPendingB) return -1; // A (pending) comes first
      if (!isPendingA && isPendingB) return 1;  // B (pending) comes first
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB.getTime() - dateA.getTime();
    },
    [parseDateFromDDMMYYYY]
  );
  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  }, []);

  const getRowColor = useCallback((colorCode) => {
    if (!colorCode) return "bg-white";

    const code = colorCode.toString().toLowerCase();
    switch (code) {
      case "red":
        return "bg-red-50 border-l-4 border-red-400";
      case "yellow":
        return "bg-yellow-50 border-l-4 border-yellow-400";
      case "green":
        return "bg-green-50 border-l-4 border-green-400";
      case "blue":
        return "bg-blue-50 border-l-4 border-blue-400";
      default:
        return "bg-white";
    }
  }, []);

  const isItemAdminDone = useCallback(
    (historyItem) => {
      const adminDoneValue = historyItem["col15"];
      return (
        !isEmpty(adminDoneValue) &&
        (adminDoneValue.toString().trim() === "Done" ||
          adminDoneValue.toString().toLowerCase().includes("done"))
      );
    },
    [isEmpty]
  );

  const getSubmissionStatus = useCallback(
    (taskId) => {
      if (!taskId)
        return {
          status: "—",
          color: "bg-gray-100",
          textColor: "text-gray-800",
        };

      const delegationItem = delegationData.find(
        (item) => item["col1"] === taskId
      );
      if (!delegationItem)
        return {
          status: "—",
          color: "bg-gray-100",
          textColor: "text-gray-800",
        };

      const actualValue = delegationItem["col11"]; // Column L (Actual)
      const delayValue = delegationItem["col12"]; // Column M (Delay)

      const isActualNotNull = !isEmpty(actualValue);
      const isDelayNotNull = !isEmpty(delayValue);

      if (isActualNotNull && isDelayNotNull) {
        return {
          status: "Late Submitted",
          color: "bg-red-100",
          textColor: "text-red-800",
        };
      } else if (isActualNotNull && isEmpty(delayValue)) {
        return {
          status: "On time",
          color: "bg-green-100",
          textColor: "text-green-800",
        };
      }

      return { status: "—", color: "bg-gray-100", textColor: "text-gray-800" };
    },
    [delegationData, isEmpty]
  );

  const LoadingBuffer = () => (
    <div className="absolute top-full left-0 right-0 bg-blue-50 border-t border-blue-200 z-10">
      <div className="flex items-center justify-center py-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
        <span className="text-blue-600 text-sm">Loading data...</span>
      </div>
    </div>
  );


  const filteredAccountData = useMemo(() => {
    const filtered = debouncedSearchTerm
      ? accountData.filter(
        (account) =>
          Object.values(account).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(debouncedSearchTerm.toLowerCase())
          ) ||
          (account["col20"] &&
            account["col20"]
              .toString()
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase()))
      )
      : accountData;

    return filtered
      .filter((account) => {
        if (nameFilter && account["col4"].toLowerCase() !== nameFilter.toLowerCase()) {
          return false;
        }
        if (dateRange.start || dateRange.end) {
          const taskDate = parseDateFromDDMMYYYY(
            formatDateForDisplay(account["col6"])
          );
          if (!taskDate) return false;

          if (dateRange.start) {
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            if (taskDate < startDate) return false;
          }

          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            if (taskDate > endDate) return false;
          }
        }

        if (
          statusFilter &&
          statusFilter !== "All Status" &&
          account["col20"] !== statusFilter
        ) {
          return false;
        }

        return true;
      })
      .sort(sortDateWise);
  }, [
    accountData,
    debouncedSearchTerm,
    nameFilter,
    dateRange,
    statusFilter,
    formatDateForDisplay,
    parseDateFromDDMMYYYY,
    sortDateWise,
  ]);

  const uniqueNames = useMemo(() => {
    const names = new Set();
    const normalizedNames = new Map(); // To track normalized versions

    // Helper function to normalize names
    const normalizeName = (name) => {
      if (!name) return '';
      return name.toString().toLowerCase().trim();
    };

    // Add names from accountData (main table - col4)
    accountData.forEach((item) => {
      if (item["col4"]) {
        const originalName = item["col4"];
        const normalized = normalizeName(originalName);

        // If user is not admin, only add their own name
        if (userRole !== "admin" && originalName !== username) return;

        // Only add if we haven't seen this normalized name before
        if (!normalizedNames.has(normalized)) {
          normalizedNames.set(normalized, originalName);
          names.add(originalName); // Keep the original casing from first occurrence
        }
      }
    });

    // Add names from historyData (history table - col7)
    historyData.forEach((item) => {
      if (item["col7"]) {
        const originalName = item["col7"];
        const normalized = normalizeName(originalName);

        // If user is not admin, only add their own name
        if (userRole !== "admin" && originalName !== username) return;

        // Only add if we haven't seen this normalized name before
        if (!normalizedNames.has(normalized)) {
          normalizedNames.set(normalized, originalName);
          names.add(originalName); // Keep the original casing from first occurrence
        }
      }
    });

    return Array.from(names).sort();
  }, [accountData, historyData, userRole, username]);

  const uniqueDates = useMemo(() => {
    const dates = new Set();
    accountData.forEach((item) => {
      if (item["col6"]) dates.add(formatDateForDisplay(item["col6"]));
    });
    return Array.from(dates).sort((a, b) => {
      const dateA = parseDateFromDDMMYYYY(a);
      const dateB = parseDateFromDDMMYYYY(b);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });
  }, [accountData, formatDateForDisplay, parseDateFromDDMMYYYY]);

  // Updated filteredHistoryData useMemo with name filter
  const filteredHistoryData = useMemo(() => {
    return historyData
      .filter((item) => {
        // User filter: For non-admin users, check column H (col7) matches username
        const userMatch =
          userRole === "admin" ||
          (item["col7"] &&
            item["col7"].toLowerCase() === username.toLowerCase());

        if (!userMatch) return false;

        // Name filter - apply if a name is selected (check column H - col7)
        if (nameFilter && item["col7"].toLowerCase() !== nameFilter.toLowerCase()) {
          return false;
        }
        const matchesSearch = debouncedSearchTerm
          ? Object.values(item).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(debouncedSearchTerm.toLowerCase())
          )
          : true;

        let matchesDateRange = true;
        if (startDate || endDate) {
          const itemDate = parseDateFromDDMMYYYY(item["col0"]);
          if (!itemDate) return false;

          if (startDate) {
            const startDateObj = new Date(startDate);
            startDateObj.setHours(0, 0, 0, 0);
            if (itemDate < startDateObj) matchesDateRange = false;
          }

          if (endDate) {
            const endDateObj = new Date(endDate);
            endDateObj.setHours(23, 59, 59, 999);
            if (itemDate > endDateObj) matchesDateRange = false;
          }
        }

        return matchesSearch && matchesDateRange;
      })
      .sort((a, b) => {
        const dateStrA = a["col0"] || "";
        const dateStrB = b["col0"] || "";
        const dateA = parseDateFromDDMMYYYY(dateStrA);
        const dateB = parseDateFromDDMMYYYY(dateStrB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });
  }, [
    historyData,
    debouncedSearchTerm,
    startDate,
    endDate,
    parseDateFromDDMMYYYY,
    userRole,
    username,
    nameFilter,
  ]);

  const parseToDateObject = useCallback((val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val !== "string") return null;
    val = val.trim();
    if (!val) return null;

    // DD/MM/YYYY or DD-MM-YYYY format (with optional time)
    const dmyMatch = val.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?)?/i
    );
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
      const ampm = dmyMatch[7] ? dmyMatch[7].toLowerCase() : null;
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      return new Date(year, month, day, hours, minutes, seconds);
    }

    // YYYY-MM-DD format
    const ymdMatch = val.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      return new Date(year, month, day);
    }

    // Google Sheets Date(year,month,day)
    if (val.startsWith("Date(")) {
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(val);
      if (match) {
        return new Date(
          parseInt(match[1], 10),
          parseInt(match[2], 10),
          parseInt(match[3], 10)
        );
      }
    }

    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  }, []);

  // Optimized data fetching with parallel requests and exact formula computation
  // isBackground=true is used by the 15s poll below: it refetches silently
  // (no spinner) and, on failure, keeps whatever data is already on screen
  // instead of blanking it out over a transient network hiccup.
  const fetchSheetData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }

      // Parallel fetch both tables from Supabase
      const [mainResponse, historyResponse] = await Promise.all([
        supabase.from('Delegation').select('*').order('Task ID', { ascending: false }).limit(5000),
        supabase.from('DELEGATION DONE').select('*').order('id', { ascending: true }).limit(5000)
      ]);

      if (mainResponse.error) throw mainResponse.error;

      // Group DELEGATION DONE records by Task id
      const doneByTaskId = new Map();
      let processedHistoryData = [];

      if (historyResponse.data) {
        processedHistoryData = historyResponse.data.map((row, rowIndex) => {
          const rawTaskId = row['Task id'] ?? row['Task ID'] ?? row['taskId'] ?? '';
          const taskIdStr = String(rawTaskId).trim();
          if (taskIdStr) {
            if (!doneByTaskId.has(taskIdStr)) {
              doneByTaskId.set(taskIdStr, []);
            }
            doneByTaskId.get(taskIdStr).push(row);
          }

          return {
            _id: row['id'] ? `hist_${row['id']}` : `hist_row_${rowIndex}`,
            _rowIndex: rowIndex + 2,
            _dbId: row['id'],
            col0: row['Timestamp'] || "",
            col1: rawTaskId || "",
            col2: row['Status'] || "",
            col3: row['Next extend date'] || "",
            col4: row['Reason'] || "",
            col5: row['Upload Image'] || "",
            col6: row['Condition Date'] || "",
            col7: row['Name'] || "",
            col8: row['Task Description'] || "",
            col9: row['Given By'] || "",
            col10: row['Admin Done'] || "",
            col15: row['Admin Done'] || "" // Map Admin Done to col15 as expected by some components
          };
        });
      }
      setHistoryData(processedHistoryData);

      const allDelegationData = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (mainResponse.data) {
        mainResponse.data.forEach((row, rowIndex) => {
          const rawTaskId = row['Task ID'] ?? row['Task id'] ?? '';
          const taskIdStr = String(rawTaskId).trim();
          const stableId = taskIdStr ? `task_${taskIdStr}_${rowIndex}` : `row_${rowIndex}_${Math.random().toString(36).substring(2, 15)}`;

          const taskDoneList = taskIdStr ? (doneByTaskId.get(taskIdStr) || []) : [];
          const doneCount = taskDoneList.length;

          // Color Code For (Col R / col17): COUNTIF('DELEGATION DONE'!B2:B, B2:B)
          const col17_colorCodeFor = doneCount > 0 ? doneCount : (row['Color Code For'] || 1);

          // Color Code (Col S / col18): 1 -> Green, 2 -> Yellow, >=3 -> Red
          let col18_colorCode = "Green";
          if (col17_colorCodeFor === 2) {
            col18_colorCode = "Yellow";
          } else if (col17_colorCodeFor >= 3) {
            col18_colorCode = "Red";
          }

          // Latest record from DELEGATION DONE
          const latestDoneRecord = taskDoneList.length > 0 ? taskDoneList[taskDoneList.length - 1] : null;

          // Update Date (Col Q / col16): Latest "Next extend date" (SORT DELEGATION DONE by Next extend date descending)
          let maxExtendDateObj = null;
          let maxExtendDateStr = "";

          taskDoneList.forEach((doneItem) => {
            const rawExt = doneItem['Next extend date'];
            if (rawExt) {
              const dObj = parseToDateObject(rawExt);
              if (dObj) {
                if (!maxExtendDateObj || dObj.getTime() > maxExtendDateObj.getTime()) {
                  maxExtendDateObj = dObj;
                  maxExtendDateStr = formatDateToDDMMYYYY(dObj);
                }
              } else if (!maxExtendDateStr) {
                maxExtendDateStr = rawExt;
              }
            }
          });

          if (row['Update Date']) {
            const dObj = parseToDateObject(row['Update Date']);
            if (dObj) {
              if (!maxExtendDateObj || dObj.getTime() > maxExtendDateObj.getTime()) {
                maxExtendDateObj = dObj;
                maxExtendDateStr = formatDateToDDMMYYYY(dObj);
              }
            } else if (!maxExtendDateStr) {
              maxExtendDateStr = row['Update Date'];
            }
          }

          const col16_updateDate = maxExtendDateStr || "";

          // Planned Date (Col K / col10): =ARRAYFORMULA(TO_DATE(IF((G2:G="")*(Q2:Q=""), "", IF(G2:G>Q2:Q, G2:G, Q2:Q))))
          const rawStartDate = row['Task Start Date'] || "";
          const gDate = parseToDateObject(rawStartDate);
          const qDate = parseToDateObject(col16_updateDate);

          let col10_plannedDate = "";
          if (gDate && qDate) {
            col10_plannedDate = gDate.getTime() > qDate.getTime() ? formatDateToDDMMYYYY(gDate) : formatDateToDDMMYYYY(qDate);
          } else if (qDate) {
            col10_plannedDate = formatDateToDDMMYYYY(qDate);
          } else if (gDate) {
            col10_plannedDate = formatDateToDDMMYYYY(gDate);
          } else {
            col10_plannedDate = col16_updateDate || rawStartDate || "";
          }

          // Actual (Col L / col11): VLOOKUP(B&"Done", {'DELEGATION DONE'!B:B & 'DELEGATION DONE'!C:C, 'DELEGATION DONE'!A:A})
          // If the latest status is 'Extend date', Actual is blank so task returns to Pending/Planned
          let col11_actual = "";
          if (latestDoneRecord) {
            const latestSt = String(latestDoneRecord['Status'] || '').trim().toLowerCase();
            if (latestSt === 'done') {
              col11_actual = latestDoneRecord['Timestamp'] || "";
            } else {
              col11_actual = "";
            }
          } else {
            const rowSt = String(row['Status'] || '').trim().toLowerCase();
            if (rowSt === 'done') {
              col11_actual = row['Actual'] || "";
            } else {
              col11_actual = "";
            }
          }

          // Delay (Col M / col12): if(K, if(L<>"", if(L>K, L-K, ""), NOW()-K), "")
          let col12_delay = "";
          const plannedDateObj = parseToDateObject(col10_plannedDate);
          if (plannedDateObj) {
            if (col11_actual) {
              const actualDateObj = parseToDateObject(col11_actual);
              if (actualDateObj && actualDateObj.getTime() > plannedDateObj.getTime()) {
                const diffDays = (actualDateObj.getTime() - plannedDateObj.getTime()) / (1000 * 60 * 60 * 24);
                col12_delay = diffDays.toFixed(4);
              }
            } else {
              const now = new Date();
              if (now.getTime() > plannedDateObj.getTime()) {
                const diffDays = (now.getTime() - plannedDateObj.getTime()) / (1000 * 60 * 60 * 24);
                col12_delay = diffDays.toFixed(4);
              }
            }
          }

          // Status (Col N / col13): Latest Status from DELEGATION DONE
          // =BYROW(B1:B, LAMBDA(b, IFNA(INDEX('DELEGATION DONE'!B:F, MAX(FILTER(ROW('DELEGATION DONE'!B:B), 'DELEGATION DONE'!B:B = b)), 2))))
          const col13_status = latestDoneRecord ? (latestDoneRecord['Status'] || "") : (row['Status'] || "");

          // Remarks (Col O / col14): Latest Reason from DELEGATION DONE
          const col14_remarks = latestDoneRecord ? (latestDoneRecord['Reason'] || latestDoneRecord['Remarks'] || "") : (row['Remarks'] || "");

          // Upload Image (Col P / col15): Latest Upload Image
          let col15_uploadImage = "";
          if (latestDoneRecord && latestDoneRecord['Upload Image']) {
            col15_uploadImage = latestDoneRecord['Upload Image'];
          } else {
            col15_uploadImage = row['Upload Imgage'] || row['Upload Image'] || "";
          }

          // Admin Done (Col T / col19):
          // Condition: 'Delegation' sheet ke Admin Done me agar Done aa gya to ye task completed hai
          let col19_adminDone = "";
          const rowAdminDone = String(row['Admin Done'] || '').trim().toLowerCase();
          const rowFilterCond = String(row['Filter Condition'] || '').trim().toLowerCase();
          const latestDoneAdminDone = latestDoneRecord ? String(latestDoneRecord['Admin Done'] || '').trim().toLowerCase() : '';
          const hasAnyDoneAdmin = taskDoneList.some(d => String(d['Admin Done'] || '').trim().toLowerCase() === 'done');

          if (rowAdminDone === 'done' || rowFilterCond === 'done' || latestDoneAdminDone === 'done' || hasAnyDoneAdmin) {
            col19_adminDone = "Done";
          }

          // Filter Condition (Col U / col20):
          // IF(B=="","", IF(L=="", IF((K<>"")*(K>TODAY()), "Planned", "Pending"), IF(T=="", "Verify Pending", "Done")))
          let col20_filterCondition = "";
          if (!taskIdStr) {
            col20_filterCondition = "";
          } else if (col19_adminDone && col19_adminDone.toLowerCase() === "done") {
            col20_filterCondition = "Done";
          } else if (rowFilterCond === "done") {
            col20_filterCondition = "Done";
          } else if (!col11_actual) {
            if (plannedDateObj) {
              const pDay = new Date(plannedDateObj);
              pDay.setHours(0, 0, 0, 0);
              if (pDay.getTime() > today.getTime()) {
                col20_filterCondition = "Planned";
              } else {
                col20_filterCondition = "Pending";
              }
            } else {
              col20_filterCondition = "Pending";
            }
          } else {
            col20_filterCondition = "Verify Pending";
          }

          const rowData = {
            _id: stableId,
            _rowIndex: rowIndex + 2,
            _taskId: rawTaskId,
            col0: row['Timestamp'] || "",
            col1: rawTaskId || "",
            col2: row['Department'] || "",
            col3: row['Given By'] || "",
            col4: row['Name'] || "",
            col5: row['Task Description'] || "",
            col6: row['Task Start Date'] || "",
            col7: row['Freq'] || "",
            col8: row['Enable Reminders'] || "",
            col9: row['Require Attachment'] || "",
            col10: col10_plannedDate,
            col11: col11_actual,
            col12: col12_delay,
            col13: col13_status,
            col14: col14_remarks,
            col15: col15_uploadImage,
            col16: col16_updateDate,
            col17: col17_colorCodeFor,
            col18: col18_colorCode,
            col19: col19_adminDone,
            col20: col20_filterCondition
          };

          if (userRole !== "admin") {
            const taskAssignedTo = rowData["col4"];
            if (!taskAssignedTo || taskAssignedTo.toLowerCase().trim() !== username.toLowerCase().trim()) {
              return;
            }
          }

          const taskStatus = rowData["col20"];
          if (taskStatus && taskStatus.toString().trim().toLowerCase() === "done") {
            return;
          }

          allDelegationData.push(rowData);
        });
      }

      setAccountData((prev) => {
        const localImages = new Map();
        prev.forEach((item) => {
          if (item.image) localImages.set(item._id, item.image);
        });
        return localImages.size > 0
          ? allDelegationData.map((item) =>
              localImages.has(item._id) ? { ...item, image: localImages.get(item._id) } : item
            )
          : allDelegationData;
      });
      setDelegationData(allDelegationData);
      hasLoadedOnceRef.current = true;
      if (!isBackground) setLoading(false);
    } catch (error) {
      console.error("Error fetching sheet data:", error);
      if (!isBackground || !hasLoadedOnceRef.current) {
        setError("Failed to load account data: " + error.message);
      }
      if (!isBackground) setLoading(false);
    }
  }, [parseToDateObject, userRole, username]);

  useEffect(() => {
    // 100% Real-time direct fetch
    fetchSheetData(false);
  }, [fetchSheetData]);

  // Near-real-time refresh: silently re-fetch every 15s in the background so
  // updates made elsewhere in the sheet show up here without a manual reload.
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchSheetData(true);
    }, 15000);
    return () => clearInterval(intervalId);
  }, [fetchSheetData]);

  const handleSelectItem = useCallback((id, isChecked) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);

      if (isChecked) {
        newSelected.add(id);
        setStatusData((prevStatus) => ({ ...prevStatus, [id]: "Done" }));
      } else {
        newSelected.delete(id);
        setAdditionalData((prevData) => {
          const newAdditionalData = { ...prevData };
          delete newAdditionalData[id];
          return newAdditionalData;
        });
        setRemarksData((prevRemarks) => {
          const newRemarksData = { ...prevRemarks };
          delete newRemarksData[id];
          return newRemarksData;
        });
        setStatusData((prevStatus) => {
          const newStatusData = { ...prevStatus };
          delete newStatusData[id];
          return newStatusData;
        });
        setNextTargetDate((prevDate) => {
          const newDateData = { ...prevDate };
          delete newDateData[id];
          return newDateData;
        });
      }

      return newSelected;
    });
  }, []);

  const handleCheckboxClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      handleSelectItem(id, isChecked);
    },
    [handleSelectItem]
  );

  const handleSelectAllItems = useCallback(
    (e) => {
      e.stopPropagation();
      const checked = e.target.checked;

      if (checked) {
        // Create a new Set with currently selected items
        const newSelected = new Set(selectedItems);

        // Add only enabled items to the selection (based on user role)
        filteredAccountData.forEach((item) => {
          if (!isTaskDisabled(item["col20"], userRole)) {
            newSelected.add(item._id);
          }
        });

        setSelectedItems(newSelected);

        // Update status for enabled items only
        const newStatusData = {};
        newSelected.forEach((id) => {
          newStatusData[id] = "Done";
        });
        setStatusData((prev) => ({ ...prev, ...newStatusData }));
      } else {
        // Remove all items from selection
        setSelectedItems(new Set());
        setAdditionalData({});
        setRemarksData({});
        setStatusData({});
        setNextTargetDate({});
      }
    },
    [filteredAccountData, isTaskDisabled, selectedItems, userRole]
  );

  const handleImageUpload = useCallback(async (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAccountData((prev) =>
      prev.map((item) => (item._id === id ? { ...item, image: file } : item))
    );
  }, []);

  const handleStatusChange = useCallback((id, value) => {
    setStatusData((prev) => ({ ...prev, [id]: value }));
    if (value === "Done") {
      setNextTargetDate((prev) => {
        const newDates = { ...prev };
        delete newDates[id];
        return newDates;
      });
    }
  }, []);

  const handleNextTargetDateChange = useCallback((id, value) => {
    setNextTargetDate((prev) => ({ ...prev, [id]: value }));
  }, []);

  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case "Pending":
        return "bg-red-100 text-red-800";
      case "Verify Pending":
        return "bg-blue-100 text-blue-800";
      case "Planned":
        return "bg-yellow-100 text-yellow-800";
      case "Done":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
    resetFilters();
  }, [resetFilters]);

  const handleSubmit = async () => {
    const selectedItemsArray = Array.from(selectedItems);

    if (selectedItemsArray.length === 0) {
      alert("Please select at least one item to submit");
      return;
    }

    // Validation checks
    const missingStatus = selectedItemsArray.filter((id) => !statusData[id]);
    if (missingStatus.length > 0) {
      alert("Please select a status for all selected items");
      return;
    }

    const missingExtendDate = selectedItemsArray.filter(
      (id) => statusData[id] === "Extend date" && !nextTargetDate[id]
    );
    if (missingExtendDate.length > 0) {
      alert("Please select a next extend date for items marked as 'Extend date'");
      return;
    }

    const missingReason = selectedItemsArray.filter(
      (id) => statusData[id] === "Extend date" && (!remarksData[id] || remarksData[id].trim() === "")
    );
    if (missingReason.length > 0) {
      alert("Please provide a reason for all items marked as 'Extend date'");
      return;
    }

    setIsSubmitting(true);

    try {
      const username = sessionStorage.getItem("username") || "";
      const now = new Date();
      const currentTimestamp = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rowsToInsert = [];
      const delegationUpdates = [];

      for (const id of selectedItemsArray) {
        const item = accountData.find((account) => account._id === id);
        if (!item) continue;

        let imageUrl = "";
        if (item.image instanceof File) {
          try {
            imageUrl = await uploadImageToCloudinary(item.image);
          } catch (uploadErr) {
            console.error("Cloudinary upload error:", uploadErr);
          }
        }

        let formattedNextDate = "";
        if (nextTargetDate[id]) {
          const rawVal = String(nextTargetDate[id]).trim();
          if (rawVal.includes("/")) {
            const parts = rawVal.split("/");
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                formattedNextDate = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
              } else {
                formattedNextDate = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
              }
            } else {
              formattedNextDate = rawVal;
            }
          } else if (rawVal.includes("-")) {
            const parts = rawVal.split("-");
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                formattedNextDate = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
              } else {
                formattedNextDate = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
              }
            } else {
              formattedNextDate = rawVal;
            }
          } else {
            const d = parseToDateObject(rawVal);
            if (d && !isNaN(d.getTime())) {
              formattedNextDate = formatDateToDDMMYYYY(d);
            } else {
              formattedNextDate = rawVal;
            }
          }
        }

        const conditionDate = formattedNextDate || currentTimestamp;
        const currentSelectedStatus = statusData[id] || 'Done';
        const rawTaskId = parseInt(item['col1'] || '0', 10) || item['col1'];

        const activeRole = userRole || sessionStorage.getItem("role") || "";
        const isAdmin = activeRole.toLowerCase() === "admin";
        const isVerifyPendingItem = (item['col20'] === 'Verify Pending');
        const adminDoneVal = (isAdmin || isVerifyPendingItem) && currentSelectedStatus === 'Done' ? 'Done' : null;
        const filterCondVal = (isAdmin || isVerifyPendingItem) && currentSelectedStatus === 'Done' ? 'Done' : 'Verify Pending';

        rowsToInsert.push({
          Timestamp: currentTimestamp,
          'Task id': rawTaskId,
          Status: currentSelectedStatus,
          'Next extend date': formattedNextDate,
          Reason: remarksData[id] || '',
          'Upload Image': imageUrl,
          'Condition Date': conditionDate,
          Name: username || item['col4'] || '',
          'Task Description': item['col5'] || '',
          'Given By': item['col3'] || 'Admin',
          'Admin Done': adminDoneVal
        });

        // Compute direct Supabase Delegation table columns update
        if (rawTaskId) {
          if (currentSelectedStatus === 'Done') {
            const plannedDateObj = parseToDateObject(item['col10'] || item['col6']);
            let computedDelay = '';
            if (plannedDateObj && now.getTime() > plannedDateObj.getTime()) {
              const diffDays = (now.getTime() - plannedDateObj.getTime()) / (1000 * 60 * 60 * 24);
              computedDelay = diffDays.toFixed(4);
            }

            delegationUpdates.push(
              supabase.from('Delegation').update({
                'Actual': item['col11'] || currentTimestamp,
                'Status': 'Done',
                'Remarks': remarksData[id] || item['col14'] || '',
                'Upload Imgage': imageUrl || item['col15'] || '',
                'Delay': computedDelay,
                'Admin Done': adminDoneVal,
                'Filter Condition': filterCondVal
              }).eq('Task ID', rawTaskId)
            );

            if (adminDoneVal === 'Done') {
              delegationUpdates.push(
                supabase.from('DELEGATION DONE').update({
                  'Admin Done': 'Done'
                }).eq('Task id', rawTaskId)
              );
            }
          } else if (currentSelectedStatus === 'Extend date') {
            const nextDateObj = parseToDateObject(formattedNextDate);
            const isFuture = nextDateObj && nextDateObj.getTime() > today.getTime();
            const newCount = (parseInt(item['col17'] || 1, 10) || 1) + 1;
            const newColor = newCount === 2 ? 'Yellow' : newCount >= 3 ? 'Red' : 'Green';

            let computedDelay = '';
            if (nextDateObj && now.getTime() > nextDateObj.getTime()) {
              const diffDays = (now.getTime() - nextDateObj.getTime()) / (1000 * 60 * 60 * 24);
              computedDelay = diffDays.toFixed(4);
            }

            delegationUpdates.push(
              supabase.from('Delegation').update({
                'Actual': null,
                'Update Date': formattedNextDate,
                'Planned Date': formattedNextDate,
                'Status': 'Extend date',
                'Remarks': remarksData[id] || '',
                'Upload Imgage': imageUrl || item['col15'] || '',
                'Color Code For': newCount,
                'Color Code': newColor,
                'Delay': computedDelay,
                'Admin Done': null,
                'Filter Condition': isFuture ? 'Planned' : 'Pending'
              }).eq('Task ID', rawTaskId)
            );
          }
        }
      }

      if (rowsToInsert.length > 0) {
        const { error: insertErr } = await supabase.from('DELEGATION DONE').insert(rowsToInsert);
        if (insertErr) throw insertErr;
      }

      if (delegationUpdates.length > 0) {
        await Promise.all(delegationUpdates);
      }

      setSelectedItems(new Set());
      setStatusData({});
      setRemarksData({});
      setNextTargetDate({});
      setSuccessMessage(`Successfully submitted ${selectedItemsArray.length} task(s)!`);

      await fetchSheetData();
    } catch (error) {
      console.error("Delegation submission error:", error);
      alert("Failed to submit data: " + (error.message || error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRemarks = async (id, currentRemarks, historyItem) => {
    try {
      const newRemarks = tempRemarks[id] || currentRemarks || "";
      let error = null;

      if (historyItem._dbId) {
        const res = await supabase
          .from('DELEGATION DONE')
          .update({ Reason: newRemarks })
          .eq('id', historyItem._dbId);
        error = res.error;
      } else if (historyItem.col1) {
        const res = await supabase
          .from('DELEGATION DONE')
          .update({ Reason: newRemarks })
          .eq('Task id', historyItem.col1);
        error = res.error;
      }

      if (error) throw error;

      // Also persist edited remarks to Supabase Delegation table directly
      const rawTaskId = historyItem.col1 || historyItem['Task id'] || historyItem['Task ID'];
      if (rawTaskId) {
        await supabase
          .from('Delegation')
          .update({ Remarks: newRemarks })
          .eq('Task ID', rawTaskId);
      }

      setHistoryData((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, col4: newRemarks } : item
        )
      );
      setEditingRemarks((prev) => ({ ...prev, [id]: false }));
      setSuccessMessage("Remarks updated successfully!");

      setTempRemarks((prev) => {
        const newTemp = { ...prev };
        delete newTemp[id];
        return newTemp;
      });

      await fetchSheetData();
    } catch (error) {
      console.error("Error updating remarks:", error);
      setSuccessMessage(`Failed to update remarks: ${error.message}`);
    }
  };

  const selectedItemsCount = selectedItems.size;

  // Admin functions for history management
  const handleMarkMultipleDone = async () => {
    if (selectedHistoryItems.length === 0) {
      return;
    }
    if (markingAsDone) return;

    setConfirmationModal({
      isOpen: true,
      itemCount: selectedHistoryItems.length,
    });
  };

  // Confirmation modal component
  const ConfirmationModal = ({ isOpen, itemCount, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-yellow-100 text-yellow-600 rounded-full p-3 mr-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Mark Items as Admin Done
            </h2>
          </div>

          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to mark {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"} as Admin Done?
          </p>

          <div className="flex justify-center space-x-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  const confirmMarkDone = async () => {
    setConfirmationModal({ isOpen: false, itemCount: 0 });
    setMarkingAsDone(true);

    try {
      const updates = [];

      for (const historyItem of selectedHistoryItems) {
        if (historyItem._dbId) {
          updates.push(
            supabase
              .from('DELEGATION DONE')
              .update({ 'Admin Done': 'Done' })
              .eq('id', historyItem._dbId)
          );
        }

        const rawTaskId = historyItem.col1 || historyItem['Task id'] || historyItem['Task ID'];
        const numTaskId = parseInt(rawTaskId, 10);

        if (rawTaskId) {
          updates.push(
            supabase
              .from('DELEGATION DONE')
              .update({ 'Admin Done': 'Done' })
              .eq('Task id', numTaskId || rawTaskId)
          );

          updates.push(
            supabase
              .from('Delegation')
              .update({
                'Admin Done': 'Done',
                'Filter Condition': 'Done'
              })
              .eq('Task ID', numTaskId || rawTaskId)
          );
        }
      }

      const results = await Promise.all(updates);
      const hasError = results.find((r) => r && r.error);
      if (hasError) throw hasError.error;

      setHistoryData((prev) =>
        prev.map((item) => {
          if (
            selectedHistoryItems.some((selected) => selected._id === item._id)
          ) {
            return { ...item, col10: "Done", col15: "Done" };
          }
          return item;
        })
      );

      setSuccessMessage(
        `Successfully marked ${selectedHistoryItems.length} items as Admin Done!`
      );
      setSelectedHistoryItems([]);

      await fetchSheetData();
    } catch (error) {
      console.error("Error marking tasks as Admin Done:", error);
      setSuccessMessage(`Failed to mark tasks as Admin Done: ${error.message}`);
    } finally {
      setMarkingAsDone(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <ConfirmationModal
          isOpen={confirmationModal.isOpen}
          itemCount={confirmationModal.itemCount}
          onConfirm={confirmMarkDone}
          onCancel={() => setConfirmationModal({ isOpen: false, itemCount: 0 })}
        />
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-purple-700">
            {showHistory
              ? CONFIG.PAGE_CONFIG.historyTitle
              : CONFIG.PAGE_CONFIG.title}
          </h1>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500"
                size={18}
              />
              <input
                type="text"
                placeholder={
                  showHistory ? "Search by Task ID..." : "Search tasks..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 font-medium placeholder:text-slate-500 border-2 border-slate-300 hover:border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-full sm:w-auto transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 sm:flex-none sm:w-32 bg-white text-purple-700 border border-purple-200 py-2 px-4 rounded-md hover:bg-purple-50 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 text-sm font-medium flex items-center justify-center group shadow-sm"
                title="Hard Refresh"
              >
                <RefreshCw className="h-4 w-4 mr-1 group-hover:animate-spin" />
                <span>Refresh</span>
              </button>

              <button
                onClick={toggleHistory}
                className="flex-1 sm:flex-none sm:w-44 gradient-bg py-2 px-4 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium flex items-center justify-center"
              >
                {showHistory ? (
                  <div className="flex items-center justify-center">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    <span>Back to Tasks</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <History className="h-4 w-4 mr-1" />
                    <span>View History</span>
                  </div>
                )}
              </button>

              {!showHistory && (
                <button
                  onClick={handleSubmit}
                  disabled={selectedItemsCount === 0 || isSubmitting}
                  className="flex-1 sm:flex-none sm:w-52 gradient-bg py-2 px-4 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium flex items-center justify-center whitespace-nowrap"
                >
                  {isSubmitting
                    ? "Processing..."
                    : `Submit Selected (${selectedItemsCount})`}
                </button>
              )}
            </div>

            {/* NEW: Admin Submit Button for History View */}
            {showHistory &&
              userRole === "admin" &&
              selectedHistoryItems.length > 0 && (
                <div className="fixed top-40 right-10 z-50">
                  <button
                    onClick={handleMarkMultipleDone}
                    disabled={markingAsDone}
                    className="rounded-md bg-green-600 text-white px-4 py-2 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {markingAsDone
                      ? "Processing..."
                      : `Mark ${selectedHistoryItems.length} Items as Admin Done`}
                  </button>
                </div>
              )}
          </div>
        </div>

        <div className="w-full flex flex-wrap items-center gap-3 mt-4 mb-4">
          {/* Name Filter */}
          <div className="flex items-center w-full sm:w-auto">
            <input
              id="name-filter"
              list="name-options"
              placeholder="All Names..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 font-medium placeholder:text-slate-500 border-2 border-slate-300 hover:border-slate-400 rounded-xl px-4 py-2 text-sm w-full sm:w-[180px] focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-text shadow-sm"
              disabled={userRole !== "admin" && uniqueNames.length <= 1}
            />
            <datalist id="name-options">
              {uniqueNames.map((name) => (
                <option key={name} value={name} className="uppercase" />
              ))}
            </datalist>
          </div>

          {/* Date Filter */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1 flex-1 sm:flex-none min-w-[140px]">
              <label
                htmlFor="start-date"
                className="text-xs font-bold text-slate-700 shrink-0"
              >
                From:
              </label>
              <input
                type="date"
                id="start-date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 font-medium border-2 border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm w-full"
              />
            </div>
            <div className="flex items-center space-x-1 flex-1 sm:flex-none min-w-[140px]">
              <label
                htmlFor="end-date"
                className="text-xs font-bold text-slate-700 shrink-0"
              >
                To:
              </label>
              <input
                type="date"
                id="end-date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 font-medium border-2 border-slate-300 hover:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm w-full"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center w-full sm:w-auto">
            <input
              id="status-filter"
              list="status-options"
              placeholder="All Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 font-medium placeholder:text-slate-500 border-2 border-slate-300 hover:border-slate-400 rounded-xl px-4 py-2 text-sm w-full sm:w-[180px] focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-text shadow-sm"
            />
            <datalist id="status-options">
              <option value="">
                All Status ({filteredAccountData.length})
              </option>
              {/* <option value="Done" /> */}
              <option value="Pending" />
              <option value="Verify Pending" />
              <option value="Planned" />
            </datalist>
          </div>

          {/* Clear Filters Button */}
          {(nameFilter || statusFilter || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setNameFilter("");
                setDateRange({ start: "", end: "" });
                setStatusFilter("");
              }}
              className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear Filters
            </button>
          )}
        </div>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              {successMessage}
            </div>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-green-500 hover:text-green-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
            <h2 className="text-purple-700 font-medium">
              {showHistory
                ? `Completed ${CONFIG.SOURCE_SHEET_NAME} Tasks`
                : `Pending ${CONFIG.SOURCE_SHEET_NAME} Tasks`}
            </h2>
            <p className="text-purple-600 text-sm">
              {showHistory
                ? `${CONFIG.PAGE_CONFIG.historyDescription} for ${userRole === "admin" ? "all" : "your"
                } tasks`
                : CONFIG.PAGE_CONFIG.description}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12 flex justify-center">
              <div className="luxury-loader-card">
                <div className="luxury-spinner-box">
                  <div className="luxury-aura"></div>
                  <div className="luxury-track"></div>
                  <div className="luxury-ring-outer"></div>
                  <div className="luxury-ring-inner"></div>
                  <div className="luxury-core">
                    <div className="luxury-core-wave"></div>
                  </div>
                </div>
                <p className="luxury-text-title">Loading task data...</p>
                <p className="luxury-text-subtitle">Syncing with Google Sheets</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-800 text-center">
              {error}{" "}
              <button
                className="underline ml-2"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : showHistory ? (
            <>
              {/* Simplified History Filters - Only Date Range */}
              <div className="p-4 border-b border-purple-100 bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <div className="mb-2 flex items-center">
                      <span className="text-sm font-medium text-purple-700">
                        Filter by Date Range:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <label
                          htmlFor="start-date"
                          className="text-sm text-gray-700 mr-1"
                        >
                          From
                        </label>
                        <input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md p-1"
                        />
                      </div>
                      <div className="flex items-center">
                        <label
                          htmlFor="end-date"
                          className="text-sm text-gray-700 mr-1"
                        >
                          To
                        </label>
                        <input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md p-1"
                        />
                      </div>
                    </div>
                  </div>

                  {(startDate || endDate || searchTerm) && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>

              {/* History Table */}
              <div className="overflow-x-auto sticky top-0 max-h-[calc(100vh-300px)] overflow-y-auto">
                <div className="min-w-full">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {/* NEW: Submission Status Column Header */}
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px]">
                          Edit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submission Status
                        </th>
                        {/* Admin Select Column Header */}
                        {userRole === "admin" && (
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                            <div className="flex flex-col items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                checked={
                                  filteredHistoryData.filter(
                                    (item) => !isItemAdminDone(item)
                                  ).length > 0 &&
                                  selectedHistoryItems.length ===
                                  filteredHistoryData.filter(
                                    (item) => !isItemAdminDone(item)
                                  ).length
                                }
                                onChange={(e) => {
                                  const unprocessedItems =
                                    filteredHistoryData.filter(
                                      (item) => !isItemAdminDone(item)
                                    );
                                  if (e.target.checked) {
                                    setSelectedHistoryItems(unprocessedItems);
                                  } else {
                                    setSelectedHistoryItems([]);
                                  }
                                }}
                              />
                              <span className="text-xs text-gray-400 mt-1">
                                Admin
                              </span>
                            </div>
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Remarks
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Next Target Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Uploaded Image
                        </th>
                        {userRole === "admin" && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Given By
                        </th>
                        {userRole === "admin" && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[140px]">
                            Admin Done
                          </th>
                        )}
                      </tr>
                      {loading && <LoadingBuffer />}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredHistoryData.length > 0 ? (
                        filteredHistoryData.map((history) => {
                          const isAdminDone = isItemAdminDone(history);
                          const isSelected = selectedHistoryItems.some(
                            (item) => item._id === history._id
                          );
                          const submissionStatus = getSubmissionStatus(
                            history["col1"]
                          ); // NEW: Get submission status
                          console.log("submissionStatus", submissionStatus);

                          return (
                            <tr
                              key={history._id}
                              className={`hover:bg-gray-50 ${isAdminDone ? "opacity-70 bg-gray-100" : ""
                                }`}
                            >
                              <td className="px-3 py-4 min-w-[80px]">
                                {editingRemarks[history._id] ? (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() =>
                                        handleEditRemarks(
                                          history._id,
                                          history["col4"],
                                          history
                                        )
                                      }
                                      className="text-green-600 hover:text-green-800"
                                      title="Save"
                                    >
                                      <CheckCircle2 size={20} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEditingRemarks((prev) => ({
                                          ...prev,
                                          [history._id]: false,
                                        }))
                                      }
                                      className="text-red-600 hover:text-red-800"
                                      title="Cancel"
                                    >
                                      <X size={20} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingRemarks((prev) => ({
                                        ...prev,
                                        [history._id]: true,
                                      }))
                                    }
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Edit Remarks"
                                  >
                                    <Edit size={20} />
                                  </button>
                                )}
                              </td>
                              {/* NEW: Submission Status Column */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                {history["col5"] ? (
                                <div className="flex gap-2 flex-wrap">
                                  {history["col5"].split(',').map(url => url.trim()).filter(Boolean).map((url, index) => (
                                    <a
                                      key={index}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative group block w-14 h-14 rounded-xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-all flex-shrink-0"
                                    >
                                      <img
                                        src={url}
                                        alt={`Attachment ${index + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          if (url.match(/\.pdf|\.doc|\.xls|\.csv|\.txt|\.zip|\.rar/i)) {
                                            e.target.src = "https://img.icons8.com/color/48/document--v1.png";
                                          } else {
                                            e.target.src = "https://img.icons8.com/color/48/image.png";
                                          }
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                        <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                                        </div>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                  <span className="text-gray-400">
                                    No attachment
                                  </span>
                                )}
                              </td>
                              {userRole === "admin" && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {history["col7"] || "—"}
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {history["col9"] || "—"}
                                </div>
                              </td>
                              {userRole === "admin" && (
                                <td className="px-6 py-4 bg-gray-50 min-w-[140px]">
                                  {isAdminDone ? (
                                    <div className="text-sm text-gray-900 break-words">
                                      <div className="flex items-center">
                                        <div className="h-4 w-4 rounded border-gray-300 text-green-600 bg-green-100 mr-2 flex items-center justify-center">
                                          <span className="text-xs text-green-600">
                                            ✓
                                          </span>
                                        </div>
                                        <div className="flex flex-col">
                                          <div className="font-medium text-green-700 text-sm">
                                            Done
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center text-gray-400 text-sm">
                                      <div className="h-4 w-4 rounded border-gray-300 mr-2"></div>
                                      <span>Pending</span>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={userRole === "admin" ? 12 : 9}
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            {searchTerm || startDate || endDate
                              ? "No historical records matching your filters"
                              : "No completed records found"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Table View (Mobile & Desktop) */}
              <div className="overflow-x-auto sticky top-0 max-h-[calc(100vh-300px)] overflow-y-auto">
                <div className="min-w-full">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            checked={
                              // Check if all enabled items are selected
                              filteredAccountData.filter(
                                (item) => !isTaskDisabled(item["col20"], userRole)
                              ).length > 0 &&
                              filteredAccountData.filter(
                                (item) =>
                                  !isTaskDisabled(item["col20"], userRole) &&
                                  selectedItems.has(item._id)
                              ).length ===
                              filteredAccountData.filter(
                                (item) => !isTaskDisabled(item["col20"], userRole)
                              ).length
                            }
                            onChange={handleSelectAllItems}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task Start Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-purple-50" : ""
                            }`}
                        >
                          Remarks
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Given By
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Task Description
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-yellow-50" : ""
                            }`}
                        >
                          Old Deadline Date
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-green-50" : ""
                            }`}
                        >
                          New Deadline Date
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px] ${!accountData["col17"] ? "bg-blue-50" : ""
                            }`}
                        >
                          Status
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px] ${!accountData["col17"] ? "bg-indigo-50" : ""
                            }`}
                        >
                          Next Target Date
                        </th>
                        <th
                          className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${!accountData["col17"] ? "bg-orange-50" : ""
                            }`}
                        >
                          Upload Image
                          <span className="block normal-case text-[10px] font-normal text-gray-400">Max 10MB</span>
                        </th>
                      </tr>
                      {loading && <LoadingBuffer />}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAccountData.length > 0 ? (
                        filteredAccountData.map((account) => {
                          const isSelected = selectedItems.has(account._id);
                          const rowColorClass = getRowColor(account["col17"]);
                          return (
                            <tr
                              key={account._id}
                              className={`${isSelected ? "bg-purple-50" : ""
                                } hover:bg-gray-50 ${rowColorClass} ${isTaskDisabled(account["col20"], userRole)
                                  ? "opacity-50 bg-gray-100 cursor-not-allowed"
                                  : ""
                                }`}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                  checked={isSelected}
                                  onChange={(e) =>
                                    handleCheckboxClick(e, account._id)
                                  }
                                  disabled={isTaskDisabled(
                                    account["col20"],
                                    userRole
                                  )}
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                    account["col20"]
                                  )}`}
                                >
                                  {account["col20"] || "—"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {formatDateForDisplay(account["col0"])}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {account["col1"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {account["col2"] || "—"}
                                </div>
                              </td>
                              <td
                                className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-purple-50" : ""
                                  }`}
                              >
                                <input
                                  type="text"
                                  placeholder="Enter remarks"
                                  disabled={
                                    !isSelected ||
                                    isTaskDisabled(account["col20"], userRole)
                                  }
                                  value={remarksData[account._id] || ""}
                                  onChange={(e) =>
                                    setRemarksData((prev) => ({
                                      ...prev,
                                      [account._id]: e.target.value,
                                    }))
                                  }
                                  className="border rounded-md px-2 py-1 w-full border-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {account["col3"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {account["col4"] || "—"}
                                </div>
                              </td>
                              <td className="px-6 py-4 min-w-[250px]">
                                <div
                                  className="text-sm text-gray-900 max-w-md whitespace-normal break-words"
                                  title={account["col5"]}
                                >
                                  {account["col5"] || "—"}
                                </div>
                              </td>
                              <td
                                className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-yellow-50" : ""
                                  }`}
                              >
                                <div className="text-sm text-gray-900">
                                  {formatDateForDisplay(account["col6"])}
                                </div>
                              </td>
                              <td
                                className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-green-50" : ""
                                  }`}
                              >
                                <div className="text-sm text-gray-900">
                                  {formatDateForDisplay(account["col10"])}
                                </div>
                              </td>
                              <td
                                className={`px-6 py-4 whitespace-nowrap min-w-[140px] ${!account["col17"] ? "bg-blue-50" : ""
                                  }`}
                              >
                                <select
                                  disabled={
                                    !isSelected ||
                                    isTaskDisabled(account["col20"], userRole)
                                  }
                                  value={statusData[account._id] || ""}
                                  onChange={(e) =>
                                    handleStatusChange(account._id, e.target.value)
                                  }
                                  className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                  <option value="">Select</option>
                                  <option value="Done">Done</option>
                                  <option value="Extend date">Extend date</option>
                                </select>
                              </td>
                              <td
                                className={`px-6 py-4 whitespace-nowrap min-w-[160px] ${!account["col17"] ? "bg-indigo-50" : ""
                                  }`}
                              >
                                <input
                                  type="date"
                                  disabled={
                                    !isSelected ||
                                    statusData[account._id] !== "Extend date" ||
                                    isTaskDisabled(account["col20"], userRole)
                                  }
                                  value={
                                    nextTargetDate[account._id]
                                      ? (() => {
                                        const dateStr =
                                          nextTargetDate[account._id];
                                        if (dateStr && dateStr.includes("/")) {
                                          const [day, month, year] =
                                            dateStr.split("/");
                                          return `${year}-${month.padStart(
                                            2,
                                            "0"
                                          )}-${day.padStart(2, "0")}`;
                                        }
                                        return dateStr;
                                      })()
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const inputDate = e.target.value;
                                    if (inputDate) {
                                      const [year, month, day] =
                                        inputDate.split("-");
                                      const formattedDate = `${day}/${month}/${year}`;
                                      handleNextTargetDateChange(
                                        account._id,
                                        formattedDate
                                      );
                                    } else {
                                      handleNextTargetDateChange(account._id, "");
                                    }
                                  }}
                                  className="border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                              </td>

                              <td
                                className={`px-6 py-4 whitespace-nowrap ${!account["col17"] ? "bg-orange-50" : ""
                                  }`}
                              >
                                {account["col20"] === "Verify Pending" ? (
                                  <div className="flex items-center">
                                    {account["col15"] ? (
                                      <>
                                        <div className="flex flex-col">
                                          <a
                                            href={account["col15"]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-600 hover:text-purple-800 underline"
                                          >
                                            <Image size={24} />
                                          </a>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        No Proof
                                      </span>
                                    )}
                                  </div>
                                ) : account.image ? (
                                  <div className="flex items-center">
                                    <img
                                      src={
                                        typeof account.image === "string"
                                          ? account.image
                                          : URL.createObjectURL(account.image)
                                      }
                                      alt="Receipt"
                                      className="h-10 w-10 object-cover rounded-md mr-2"
                                    />
                                    <div className="flex flex-col">
                                      {/* <span className="text-xs text-gray-500"> */}
                                      {account.image instanceof File ? (
                                        <span className="text-xs text-green-600">
                                          Ready to upload
                                        </span>
                                      ) : (
                                        <button
                                          className="text-xs text-purple-600 hover:text-purple-800"
                                          onClick={() =>
                                            window.open(account.image, "_blank")
                                          }
                                        >
                                          View Full Image
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    {account["col9"]?.toUpperCase() === "YES" && (
                                      <span className="text-[10px] text-red-600 font-medium break-words">
                                        Required Upload *
                                      </span>
                                    )}
                                    <div className="flex gap-2">
                                      <label
                                        className={`flex flex-col items-center justify-center cursor-pointer p-1.5 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 border-red-200" : "text-purple-600"} ${isTaskDisabled(account["col20"], userRole) || !isSelected ? "opacity-50 pointer-events-none" : ""}`}
                                        title="Take Photo"
                                      >
                                        <Camera className="h-4 w-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Camera</span>
                                        <input
                                          type="file"
                                          className="hidden"
                                          accept="image/*"
                                          capture="environment"
                                          onChange={(e) => handleImageUpload(account._id, e)}
                                          disabled={!isSelected || isTaskDisabled(account["col20"], userRole)}
                                        />
                                      </label>
                                      <label
                                        className={`flex flex-col items-center justify-center cursor-pointer p-1.5 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 border-red-200" : "text-purple-600"} ${isTaskDisabled(account["col20"], userRole) || !isSelected ? "opacity-50 pointer-events-none" : ""}`}
                                        title="Choose from Gallery"
                                      >
                                        <ImageIcon className="h-4 w-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Gallery</span>
                                        <input
                                          type="file"
                                          className="hidden"
                                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                                          onChange={(e) => handleImageUpload(account._id, e)}
                                          disabled={!isSelected || isTaskDisabled(account["col20"], userRole)}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        title="Paste screenshot from clipboard"
                                        disabled={!isSelected || isTaskDisabled(account["col20"], userRole)}
                                        onClick={async () => {
                                          try {
                                            if (!navigator.clipboard || !navigator.clipboard.read) {
                                              alert("Clipboard paste is not supported in this browser. Please use Camera or Gallery.");
                                              return;
                                            }
                                            const clipboardItems = await navigator.clipboard.read();
                                            const files = [];
                                            for (const clipItem of clipboardItems) {
                                              const imageType = clipItem.types.find((t) => t.startsWith("image/"));
                                              if (imageType) {
                                                const blob = await clipItem.getType(imageType);
                                                const ext = imageType.split("/")[1] || "png";
                                                files.push(new File([blob], `screenshot_${Date.now()}.${ext}`, { type: imageType }));
                                              }
                                            }
                                            if (files.length === 0) {
                                              alert("No image found in clipboard. Take a screenshot first, then tap Paste.");
                                              return;
                                            }
                                            handleImageUpload(account._id, { target: { files } });
                                          } catch (err) {
                                            console.error("Paste failed:", err);
                                            alert("Could not paste image. Please allow clipboard access, or use Camera/Gallery.");
                                          }
                                        }}
                                        className={`flex flex-col items-center justify-center cursor-pointer p-1.5 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors ${account["col9"]?.toUpperCase() === "YES" ? "text-red-600 border-red-200" : "text-purple-600"} ${isTaskDisabled(account["col20"], userRole) || !isSelected ? "opacity-50 pointer-events-none" : ""}`}
                                      >
                                        <Clipboard className="h-4 w-4 mb-0.5" />
                                        <span className="text-[9px] font-medium">Paste</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={13}
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            {searchTerm
                              ? "No tasks matching your search"
                              : "No pending tasks found"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
        <ConfirmationModal
          isOpen={confirmationModal.isOpen}
          itemCount={confirmationModal.itemCount}
          onConfirm={confirmMarkDone}
          onCancel={() => setConfirmationModal({ isOpen: false, itemCount: 0 })}
        />
      </div>
    </AdminLayout>
  );
}

export default DelegationDataPage;
