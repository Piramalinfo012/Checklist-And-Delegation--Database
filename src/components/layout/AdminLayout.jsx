"use client"

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { CheckSquare, ClipboardList, Home, LogOut, Menu, Database, ChevronDown, ChevronRight, Zap, FileText, X, Play, Pause, KeyRound, Video, Settings } from 'lucide-react'
import sbhLogo from '../../assets/logo.png'
import { motion, AnimatePresence } from "framer-motion"

const TypingText = ({ text }) => {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setDisplayed("");
        setIndex(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [index, text]);

  return (
    <span className="font-semibold inline-flex items-center">
      {displayed}
      <span className="ml-1 w-0.5 h-4 bg-slate-700 animate-pulse inline-block"></span>
    </span>
  );
};

export default function AdminLayout({ children, darkMode, toggleDarkMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDataSubmenuOpen, setIsDataSubmenuOpen] = useState(false)
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [userRole, setUserRole] = useState("")
  const [userEmail, setUserEmail] = useState("")


  // Check authentication on component mount
  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username')
    const storedRole = sessionStorage.getItem('role')
    const storedEmail = sessionStorage.getItem('email')

    if (!storedUsername) {
      // Redirect to login if not authenticated
      navigate("/login")
      return
    }

    setUsername(storedUsername)
    setUserRole(storedRole || "user")
    setUserEmail(storedEmail || "")

    // Background auto-trigger task generation if role is admin
    if (storedRole === 'admin' && localStorage.getItem('auto_trigger_on_login') !== 'false') {
      const todayStr = new Date().toISOString().split('T')[0];
      const lastAutoRun = localStorage.getItem('last_auto_trigger_date');
      if (lastAutoRun !== todayStr) {
        localStorage.setItem('last_auto_trigger_date', todayStr);
        import('../../utils/taskTriggerEngine.js').then(m => {
          m.runTaskGenerationTrigger({ targetDate: new Date(), ignoreCalendarCheck: false });
        }).catch(err => console.warn('Auto trigger error:', err));
      }
    }
  }, [navigate])



  // Handle logout
  const handleLogout = () => {
    sessionStorage.clear()
    localStorage.removeItem('checklist_page_cache_v1')
    localStorage.removeItem('delegation_page_cache_v1')
    localStorage.removeItem('dashboard_page_cache_checklist')
    localStorage.removeItem('dashboard_page_cache_delegation')
    navigate("/login")
  }


  // Filter dataCategories based on user role
  const dataCategories = [
    //{ id: "main", name: "PURAB", link: "/dashboard/data/main" },
    { id: "sales", name: "Checklist", link: "/dashboard/data/sales" },
    // { id: "service", name: "Service", link: "/dashboard/data/service" },
    //{ id: "account", name: "RKL", link: "/dashboard/data/account" },
    //{ id: "warehouse", name: "REFRASYNTH", link: "/dashboard/data/warehouse" },
    //{ id: "delegation", name: "Delegation", link: "/dashboard/data/delegation" },
    //{ id: "purchase", name: "Slag Crusher", link: "/dashboard/data/purchase" },
    //{ id: "director", name: "Hr", link: "/dashboard/data/director" },
    //{ id: "managing-director", name: "PURAB", link: "/dashboard/data/managing-director" },
    // { id: "coo", name: "COO", link: "/dashboard/data/coo" },
    // { id: "jockey", name: "Jockey", link: "/dashboard/data/jockey" },
  ]

  // Update the routes array based on user role
  const routes = [
    {
      href: "/dashboard/admin",
      label: "Dashboard",
      icon: Database,
      active: location.pathname === "/dashboard/admin",
      showFor: ["admin", "user"] // Show for both roles
    },
    {
      href: "/dashboard/assign-task",
      label: "Assign Task",
      icon: CheckSquare,
      active: location.pathname === "/dashboard/assign-task",
      showFor: ["admin"] // Only show for admin
    },
    {
      href: "/dashboard/delegation",
      label: "Delegation",
      icon: ClipboardList,
      active: location.pathname === "/dashboard/delegation",
      showFor: ["admin", "user"] // Only show for admin
    },
    {
      href: "/dashboard/data/sales",
      label: "Checklist",
      icon: Database,
      active: location.pathname === "/dashboard/data/sales",
      showFor: ["admin", "user"] // Show for both roles
    },
    {
      href: "/dashboard/quick-task",
      label: "Unique Task",
      icon: Zap,
      active: location.pathname === "/dashboard/quick-task",
      showFor: ["admin", "user"] // Only show for admin
    },
    {
      href: "/dashboard/traning-video",
      label: "Training Video",
      icon: Video,
      active: location.pathname === "/dashboard/traning-video",
      showFor: ["admin", "user"] //  show both
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: Settings,
      active: location.pathname === "/dashboard/settings",
      showFor: ["admin", "user"] // Show for admin and user
    },
  ]

  const getAccessibleDepartments = () => {
    const userRole = sessionStorage.getItem('role') || 'user'
    return dataCategories.filter(cat =>
      !cat.showFor || cat.showFor.includes(userRole)
    )
  }

  // Filter routes based on user role
  const getAccessibleRoutes = () => {
    const userRole = sessionStorage.getItem('role') || 'user'
    return routes.filter(route =>
      route.showFor.includes(userRole)
    )
  }

  // Check if the current path is a data category page
  const isDataPage = location.pathname.includes("/dashboard/data/")

  // If it's a data page, expand the submenu by default
  useEffect(() => {
    if (isDataPage && !isDataSubmenuOpen) {
      setIsDataSubmenuOpen(true)
    }
  }, [isDataPage, isDataSubmenuOpen])

  // Get accessible routes and departments
  const accessibleRoutes = getAccessibleRoutes()
  const accessibleDepartments = getAccessibleDepartments()

  // License Modal Component
  const LicenseModal = () => {
    // Function to convert YouTube URL to embed URL
    const getYouTubeEmbedUrl = (url) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11
        ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`
        : url;
    };


  }

  return (
    <div
      className={`flex h-screen overflow-hidden`}
      style={{ background: 'linear-gradient(135deg, #e8e0f0 0%, #d5cce0 25%, #c9c2d4 50%, #d0cad8 75%, #e2dce8 100%)' }}
    >
      {/* Sidebar for desktop */}
      <aside className="hidden w-64 flex-shrink-0 md:flex md:flex-col m-3 mr-0 rounded-2xl shadow-lg" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
        <div className="flex h-16 items-center justify-center px-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.4)' }}>
          <Link
            to="/dashboard/admin"
            className="flex items-center gap-2 font-semibold text-slate-700"
          >
            <img src={sbhLogo} alt="Checklist & Delegation" className="h-14 w-auto object-contain" />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1.5">
            {accessibleRoutes.map((route) => (
              <li key={route.label}>
                {route.submenu ? (
                  <div>
                    <button
                      onClick={() => setIsDataSubmenuOpen(!isDataSubmenuOpen)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${route.active
                        ? "bg-slate-800 text-white shadow-md"
                        : "text-slate-600 hover:bg-white/60"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <route.icon
                          className={`h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                            }`}
                        />
                        {route.label}
                      </div>
                      {isDataSubmenuOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {isDataSubmenuOpen && (
                      <ul className="mt-1.5 ml-4 space-y-1 border-l-2 border-slate-200/60 pl-3">
                        {accessibleDepartments.map((category) => (
                          <li key={category.id}>
                            <Link
                              to={
                                category.link ||
                                `/dashboard/data/${category.id}`
                              }
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${location.pathname ===
                                (category.link ||
                                  `/dashboard/data/${category.id}`)
                                ? "bg-slate-700 text-white font-medium shadow-sm"
                                : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                }`}
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {category.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    to={route.href}
                    className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${route.active
                      ? "text-white"
                      : "text-slate-600 hover:bg-white/60"
                      }`}
                  >
                    {route.active && (
                      <motion.div
                        layoutId="sidebar-active-pill-desktop"
                        className="absolute inset-0 rounded-xl bg-slate-800 shadow-md"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <route.icon
                      className={`relative z-10 h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                        }`}
                    />
                    <span className="relative z-10">{route.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>


          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center shadow-sm"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                <span className="text-sm font-semibold text-white">
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {username || "User"} {userRole === "admin" ? "(Admin)" : ""}
                </p>
                <p className="text-xs text-slate-400">
                  {userEmail ||
                    (username
                      ? `${username.toLowerCase()}@example.com`
                      : "user@example.com")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* <button
                onClick={() => setIsLicenseModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                title="License & Help"
              >
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium">License</span>
              </button> */}
              {toggleDarkMode && (
                <button
                  onClick={toggleDarkMode}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
                >
                  {darkMode ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  )}
                  <span className="sr-only">
                    {darkMode ? "Light mode" : "Dark mode"}
                  </span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden absolute left-4 top-3 z-50 text-slate-600 p-2 rounded-xl hover:bg-white/60 transition-all duration-200"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </button>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/30"
            style={{ backdropFilter: 'blur(4px)' }}
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-72 shadow-2xl rounded-r-2xl" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div className="flex h-16 items-center justify-center px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
              <Link
                to="/dashboard/admin"
                className="flex items-center gap-2 font-semibold text-slate-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <img src={sbhLogo} alt="Checklist & Delegation" className="h-14 w-auto object-contain" />
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1.5">
                {accessibleRoutes.map((route) => (
                  <li key={route.label}>
                    {route.submenu ? (
                      <div>
                        <button
                          onClick={() =>
                            setIsDataSubmenuOpen(!isDataSubmenuOpen)
                          }
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${route.active
                            ? "bg-slate-800 text-white shadow-md"
                            : "text-slate-600 hover:bg-white/60"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <route.icon
                              className={`h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                                }`}
                            />
                            {route.label}
                          </div>
                          {isDataSubmenuOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {isDataSubmenuOpen && (
                          <ul className="mt-1.5 ml-4 space-y-1 border-l-2 border-slate-200/60 pl-3">
                            {accessibleDepartments.map((category) => (
                              <li key={category.id}>
                                <Link
                                  to={
                                    category.link ||
                                    `/dashboard/data/${category.id}`
                                  }
                                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${location.pathname ===
                                    (category.link ||
                                      `/dashboard/data/${category.id}`)
                                    ? "bg-slate-700 text-white font-medium shadow-sm"
                                    : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
                                    }`}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                >
                                  {category.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={route.href}
                        className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${route.active
                          ? "text-white"
                          : "text-slate-600 hover:bg-white/60"
                          }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {route.active && (
                          <motion.div
                            layoutId="sidebar-active-pill-mobile"
                            className="absolute inset-0 rounded-xl bg-slate-800 shadow-md"
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          />
                        )}
                        <route.icon
                          className={`relative z-10 h-4 w-4 ${route.active ? "text-white" : "text-slate-400"
                            }`}
                        />
                        <span className="relative z-10">{route.label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>


              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                  >
                    <span className="text-sm font-semibold text-white">
                      {username ? username.charAt(0).toUpperCase() : "U"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {username || "User"}{" "}
                      {userRole === "admin" ? "(Admin)" : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      {userEmail ||
                        (username
                          ? `${username.toLowerCase()}@example.com`
                          : "user@example.com")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* <button
                    onClick={() => setIsLicenseModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1"
                    title="License & Help"
                  >
                    <FileText className="h-3 w-3" />
                    <span className="text-xs font-medium">License</span>
                  </button>
                  */}
                  {toggleDarkMode && (
                    <button
                      onClick={toggleDarkMode}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
                    >
                      {darkMode ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                      )}
                      <span className="sr-only">
                        {darkMode ? "Light mode" : "Dark mode"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/50 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="sr-only">Log out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* License Modal */}
      {isLicenseModalOpen && <LicenseModal />}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between px-4 md:px-6 m-3 mb-0 rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.5)' }}>
          <div className="flex md:hidden w-8"></div>
          <h1 className="text-sm md:text-lg font-bold flex items-center gap-2">
            <span className="text-slate-700">
              {(() => {
                const hour = new Date().getHours()
                let greeting = "Good Morning"
                if (hour >= 12 && hour < 18) greeting = "Good Afternoon"
                else if (hour >= 18) greeting = "Good Evening"

                return `${greeting}, ${username ? username.toUpperCase() : "USER"}! Welcome On Board`
              })()}
            </span>
            <span className="animate-bounce inline-block">👋</span>
          </h1>
          {/*<button
            onClick={() => setIsLicenseModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            title="License & Help"
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">License</span>
          </button>
          */}
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
          <style>{`
            @keyframes shine-text {
              0% { background-position: 200% center; }
              100% { background-position: -200% center; }
            }
          `}</style>
          <div className="fixed md:left-[280px] md:right-3 left-0 right-0 bottom-0 py-1.5 px-4 z-10 flex items-center justify-center rounded-t-2xl shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]" style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.8)', borderLeft: '1px solid rgba(255,255,255,0.5)', borderRight: '1px solid rgba(255,255,255,0.5)' }}>
            <div 
              className="text-[10px] sm:text-[11px] font-black tracking-[0.15em] text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #022c22 0%, #064e3b 35%, #10b981 50%, #064e3b 65%, #022c22 100%)',
                backgroundSize: '200% auto',
                animation: 'shine-text 3s linear infinite',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
              }}
            >
              <TypingText text="DEVELOPED BY DEEPAK SAHU" />
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}
