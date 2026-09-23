"use client"
import { useCallback, useEffect, useState, useMemo } from "react";
import { format } from 'date-fns';
import { Search, ChevronDown, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export default function DelegationPage({
    searchTerm,
    nameFilter,
    freqFilter,
    setNameFilter,
    setFreqFilter,
    currentUser,
    userRole
}) {
    const [delegationTasks, setDelegationTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [dropdownOpen, setDropdownOpen] = useState({
        name: false,
        frequency: false
    });

    // Config should be memoized to prevent unnecessary re-renders
    const CONFIG = useMemo(() => ({
        APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyAy98t3XAyRP3pFE7XOoDiTDU3Yc9WOIFayRXELW2XnUAzl7yE9bnO94GvZV0wJkH_/exec",
        DELEGATION_SHEET: "Delegation"
    }), []);

    // Format date helper function
    const formatDate = useCallback((dateValue) => {
        if (!dateValue) return "";
        try {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? dateValue : format(date, 'dd/MM/yyyy HH:mm');
        } catch {
            return dateValue;
        }
    }, []);

    // Fetch data with role-based filtering
    const fetchData = useCallback(async () => {
        if (!currentUser || !userRole) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.DELEGATION_SHEET}&action=fetch`,
                { redirect: 'follow' }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data?.table?.rows) {
                const transformedData = data.table.rows.slice(1).map((row, rowIndex) => ({
                    _id: `row_${rowIndex}_${Date.now()}`,
                    _rowIndex: rowIndex + 2,
                    Timestamp: formatDate(row.c[0]?.v),
                    'Task ID': row.c[1]?.v || "",
                    Department: row.c[2]?.v || "",
                    'Given By': row.c[3]?.v || "",
                    Name: row.c[4]?.v || "",
                    'Task Description': row.c[5]?.v || "",
                    'Task Start Date': formatDate(row.c[6]?.v),
                    Freq: row.c[7]?.v || "",
                    'Enable Reminders': row.c[8]?.v || "",
                    'Require Attachment': row.c[9]?.v || "",
                }));

                // Apply role-based filtering
                let filteredData;
                if (userRole === 'admin') {
                    filteredData = transformedData;
                } else {
                    filteredData = transformedData.filter(task => {
                        const taskName = (task.Name || '').toString().toLowerCase().trim();
                        const taskGivenBy = (task['Given By'] || '').toString().toLowerCase().trim();
                        const currentUserLower = currentUser.toLowerCase().trim();

                        return taskName === currentUserLower || taskGivenBy === currentUserLower;
                    });
                }

                setDelegationTasks(filteredData);
            } else {
                throw new Error("Invalid data format");
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setError(err.message || "Failed to load delegation data");
        } finally {
            setLoading(false);
        }
    }, [CONFIG, currentUser, userRole, formatDate]);

    // Sort function
    const requestSort = useCallback((key) => {
        if (loading) return;
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, [loading]);

    // Dropdown toggle
    const toggleDropdown = useCallback((dropdown) => {
        setDropdownOpen(prev => ({
            ...prev,
            [dropdown]: !prev[dropdown]
        }));
    }, []);

    // Filter handlers
    const handleNameFilterSelect = useCallback((name) => {
        setNameFilter(name);
        setDropdownOpen(prev => ({ ...prev, name: false }));
    }, [setNameFilter]);

    const handleFrequencyFilterSelect = useCallback((freq) => {
        setFreqFilter(freq);
        setDropdownOpen(prev => ({ ...prev, frequency: false }));
    }, [setFreqFilter]);

    const clearNameFilter = useCallback(() => {
        setNameFilter('');
        setDropdownOpen(prev => ({ ...prev, name: false }));
    }, [setNameFilter]);

    const clearFrequencyFilter = useCallback(() => {
        setFreqFilter('');
        setDropdownOpen(prev => ({ ...prev, frequency: false }));
    }, [setFreqFilter]);

    // Memoized derived data
    const { allNames, allFrequencies, filteredTasks } = useMemo(() => {
        const names = [...new Set(delegationTasks.map(task => task.Name))]
            .filter(name => name?.trim());

        const freqs = [...new Set(delegationTasks.map(task => task.Freq))]
            .filter(freq => freq?.trim());

        const filtered = delegationTasks
            .filter(task => {
                const nameMatch = !nameFilter || task.Name === nameFilter;
                const freqMatch = !freqFilter || task.Freq === freqFilter;
                const searchMatch = !searchTerm || Object.values(task).some(
                    value => value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
                );
                return nameMatch && freqMatch && searchMatch;
            })
            .sort((a, b) => {
                if (!sortConfig.key) return 0;
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                return sortConfig.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            });

        return { allNames: names, allFrequencies: freqs, filteredTasks: filtered };
    }, [delegationTasks, nameFilter, freqFilter, searchTerm, sortConfig]);

    // Pagination reset
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, nameFilter, freqFilter, itemsPerPage]);

    const totalDelegationItems = filteredTasks.length;
    const totalDelegationPages = Math.ceil(totalDelegationItems / itemsPerPage) || 1;
    const validDelegationCurrentPage = Math.min(Math.max(1, currentPage), totalDelegationPages);
    const delegationStartIndex = (validDelegationCurrentPage - 1) * itemsPerPage;
    const delegationEndIndex = Math.min(delegationStartIndex + itemsPerPage, totalDelegationItems);
    const paginatedDelegationTasks = useMemo(() => {
        return filteredTasks.slice(delegationStartIndex, delegationStartIndex + itemsPerPage);
    }, [filteredTasks, delegationStartIndex, itemsPerPage]);

    const getPageNumbers = (current, total) => {
        const pages = [];
        const maxVisible = 5;
        if (total <= maxVisible) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            if (current <= 3) {
                pages.push(1, 2, 3, 4, '...', total);
            } else if (current >= total - 2) {
                pages.push(1, '...', total - 3, total - 2, total - 1, total);
            } else {
                pages.push(1, '...', current - 1, current, current + 1, '...', total);
            }
        }
        return pages;
    };

    // Table columns config
    const columns = useMemo(() => [
        { key: 'Timestamp', label: 'Timestamp' },
        { key: 'Task ID', label: 'Task ID' },
        { key: 'Department', label: 'Department' },
        { key: 'Given By', label: 'Given By' },
        { key: 'Name', label: 'Name' },
        { key: 'Task Description', label: 'Task Description', minWidth: 'min-w-[300px]' },
        { key: 'Task Start Date', label: 'Start Date', bg: 'bg-yellow-50' },
        { key: 'Freq', label: 'Frequency' },
        { key: 'Enable Reminders', label: 'Reminders' },
        { key: 'Require Attachment', label: 'Attachment' },
    ], []);

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!currentUser || !userRole) {
        return (
            <div className="mt-4 bg-yellow-50 p-4 rounded-md text-yellow-800 text-center">
                Loading delegation tasks...
            </div>
        );
    }

    return (
        <div className="mt-4 rounded-lg border border-purple-200 shadow-md bg-white overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 p-4">
                <h2 className="text-purple-700 font-medium">
                    {userRole === 'admin' ? 'All Delegation Tasks' : 'My Delegation Tasks'}
                </h2>
                <p className="text-purple-600 text-sm">
                    {userRole === 'admin'
                        ? `Showing ${filteredTasks.length} delegation tasks from all users`
                        : `Showing ${filteredTasks.length} delegation tasks for ${currentUser}`
                    }
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-800 text-center">
                    {error}{" "}
                    <button
                        onClick={fetchData}
                        className="underline ml-2 hover:text-red-600"
                    >
                        Try again
                    </button>
                </div>
            )}

            <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.label}
                                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.bg || ''} ${column.minWidth || ''} ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                    onClick={() => requestSort(column.key)}
                                >
                                    <div className="flex items-center">
                                        {column.label}
                                        {sortConfig.key === column.key && (
                                            <span className="ml-1">
                                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center">
                                    <div className="flex justify-center">
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
                                            <p className="luxury-text-title">Loading delegation data...</p>
                                            <p className="luxury-text-subtitle">Syncing with Google Sheets</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredTasks.length > 0 ? (
                            paginatedDelegationTasks.map((task) => (
                                <tr key={task._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task.Timestamp || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {task['Task ID'] || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task.Department || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task['Given By'] || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task.Name || "—"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 min-w-[300px] max-w-[400px]">
                                        <div className="whitespace-normal break-words">
                                            {task['Task Description'] || "—"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 bg-yellow-50">
                                        {task['Task Start Date'] || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 py-1 rounded-full text-xs ${task.Freq === 'Daily' ? 'bg-blue-100 text-blue-800' :
                                            task.Freq === 'Weekly' ? 'bg-green-100 text-green-800' :
                                                task.Freq === 'Monthly' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {task.Freq || "—"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task['Enable Reminders'] || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {task['Require Attachment'] || "—"}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
                                    {searchTerm || nameFilter || freqFilter
                                        ? "No delegation tasks matching your filters"
                                        : userRole === 'admin' ? "No delegation tasks available" : "No delegation tasks assigned to you"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!loading && filteredTasks.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-purple-100 text-sm">
                    <div className="flex flex-wrap items-center gap-3 text-gray-600">
                        <span>
                            Showing <strong className="font-semibold text-gray-800">{totalDelegationItems > 0 ? delegationStartIndex + 1 : 0}</strong> to{" "}
                            <strong className="font-semibold text-gray-800">{delegationEndIndex}</strong> of{" "}
                            <strong className="font-semibold text-gray-800">{totalDelegationItems}</strong> tasks
                        </span>
                        <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-gray-500 text-xs">Rows per page:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={validDelegationCurrentPage === 1}
                            title="First Page"
                            className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={validDelegationCurrentPage === 1}
                            title="Previous Page"
                            className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center gap-1 mx-1">
                            {getPageNumbers(validDelegationCurrentPage, totalDelegationPages).map((page, index) => (
                                page === '...' ? (
                                    <span key={`dots-${index}`} className="px-2 py-1 text-gray-400 text-xs select-none">...</span>
                                ) : (
                                    <button
                                        key={`page-${page}`}
                                        onClick={() => setCurrentPage(page)}
                                        className={`min-w-[32px] h-8 px-2 text-xs font-medium rounded transition-colors ${
                                            validDelegationCurrentPage === page
                                                ? "bg-purple-600 text-white shadow-sm"
                                                : "bg-white border border-gray-200 text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                                        }`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalDelegationPages))}
                            disabled={validDelegationCurrentPage === totalDelegationPages}
                            title="Next Page"
                            className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalDelegationPages)}
                            disabled={validDelegationCurrentPage === totalDelegationPages}
                            title="Last Page"
                            className="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}