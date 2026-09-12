"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

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
      <span className="ml-1 w-0.5 h-4 bg-white animate-pulse inline-block"></span>
    </span>
  );
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [masterData, setMasterData] = useState({
    userCredentials: {}, // Object where keys are usernames and values are passwords
    userRoles: {},
    userEmails: {}, // Object where keys are usernames and values are roles
  });
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState("");

  // Function to check if a role is any variation of "inactive"
  const isInactiveRole = (role) => {
    if (!role) return false;

    // Convert to lowercase
    const normalizedRole = String(role).toLowerCase().trim();

    // Check for different variations of "inactive" status
    return (
      normalizedRole === "inactive" ||
      normalizedRole === "in active" ||
      normalizedRole === "inactiv" ||
      normalizedRole === "in activ"
    );
  };

  // Fetch master data on component mount
  useEffect(() => {
    const fetchMasterData = async () => {
      const CACHE_TTL = 60 * 60 * 1000; // 1 Hour TTL

      // 1. Try to load from cache first for instant UI response
      const cachedDataStr = localStorage.getItem("masterDataCache");
      const cachedTimeStr = localStorage.getItem("masterDataCacheTime");
      let hasCache = false;
      let isCacheValid = false;

      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          setMasterData(cachedData);
          setIsDataLoading(false); // Enable login button immediately
          hasCache = true;

          const cachedTime = Number(cachedTimeStr || 0);
          if (cachedTime && Date.now() - cachedTime < CACHE_TTL) {
            isCacheValid = true;
          }
        } catch (e) {
          console.error("Failed to parse cache", e);
        }
      }

      // If cache is valid (within 1 hour), reuse cached data and avoid redundant API call
      if (isCacheValid) {
        return;
      }

      try {
        if (!hasCache) {
          setIsDataLoading(true); // Only show spinner if no cache exists
        }

        const { data, error } = await supabase.from('Whatsapp').select('*');
        if (error) throw error;

        // Create userCredentials and userRoles objects from the sheet data
        const userCredentials = {};
        const userRoles = {};
        const userEmails = {};

        if (data && data.length > 0) {
          data.forEach(row => {
            const username = (row['Username'] || row['User name']) ? String(row['Username'] || row['User name']).trim().toLowerCase() : "";
            const password = (row['password'] || row['Password']) ? String(row['password'] || row['Password']).trim() : "";
            const role = row['Role'] ? String(row['Role']).trim() : "user";
            const email = (row['Email'] || row['ID']) ? String(row['Email'] || row['ID']).trim() : "";

            if (username && password && password.trim() !== "") {
              if (isInactiveRole(role)) return;
              const normalizedRole = role.toLowerCase();
              userCredentials[username] = password;
              userRoles[username] = normalizedRole;
              userEmails[username] = email;
            }
          });
        }

        const newMasterData = { userCredentials, userRoles, userEmails };
        setMasterData(newMasterData);
        
        // Save to cache with timestamp for 1-hour refresh interval
        try {
          localStorage.setItem("masterDataCache", JSON.stringify(newMasterData));
          localStorage.setItem("masterDataCacheTime", Date.now().toString());
        } catch(e) {
          console.warn('Cache full');
        }

      } catch (error) {
        console.error("Error Fetching Master Data:", error);
        
        if (!hasCache) {
          showToast(
            `Network error: ${error.message}. Please try again later.`,
            "error"
          );
        }
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchMasterData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const logAttendance = async (username, role) => {
    try {
      // Find the user in Whatsapp sheet using Supabase to update Attendance
      // For now, we update 'Whatsapp' table or whichever is representing attendance login.
      // Assuming 'Whatsapp' has the attendance timestamp, or we just skip if not defined.
      // Based on original code, it searched "Attendance Login" sheet. 
      // Note: We might not have 'Attendance Login' migrated if they didn't provide it, 
      // but if we do, we use Supabase to update it.
      console.log('Skipping attendance log as table may not exist in Supabase yet.');
    } catch (error) {
      console.error("Error preparing attendance log:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoginLoading(true);

    try {
      const trimmedUsername = formData.username.trim().toLowerCase();
      const trimmedPassword = formData.password.trim();

      //console.log("Login Attempt Details:")
      //console.log("Entered Username:", trimmedUsername)
      //console.log("Entered Password:", trimmedPassword) // For debugging (remove in production)
      //console.log("Available Credentials Count:", Object.keys(masterData.userCredentials).length)
      //console.log("Current userCredentials:", masterData.userCredentials)
      //console.log("Current userRoles:", masterData.userRoles)

      // Check if the username exists in our credentials map
      if (trimmedUsername in masterData.userCredentials) {
        const correctPassword = masterData.userCredentials[trimmedUsername];
        const userRole = masterData.userRoles[trimmedUsername];
        const userEmail = masterData.userEmails[trimmedUsername] || "";

        //console.log("Found user in credentials map")
        //console.log("Expected Password:", correctPassword)
        //console.log("Password Match:", correctPassword === trimmedPassword)
        //console.log("User Role:", userRole)
        //console.log("User Email:", userEmail)

        // Check if password matches
        if (correctPassword === trimmedPassword) {
          // Store user info in sessionStorage
          sessionStorage.setItem("username", trimmedUsername);
          sessionStorage.setItem("email", userEmail);
          setLoggedInUsername(trimmedUsername); // Set the username for the popup

          // Check if user is admin - explicitly compare with the string "admin"
          const isAdmin = userRole === "admin";
          //console.log(`User ${trimmedUsername} is admin: ${isAdmin}`);

          // Set role based on the fetched role
          sessionStorage.setItem("role", isAdmin ? "admin" : "user");

          // For admin users, we don't want to restrict by department
          if (isAdmin) {
            sessionStorage.setItem("department", "all"); // Admin sees all departments
            sessionStorage.setItem("isAdmin", "true"); // Additional flag to ensure admin permissions
            //console.log("ADMIN LOGIN - Setting full access permissions");
          } else {
            sessionStorage.setItem("department", trimmedUsername);
            sessionStorage.setItem("isAdmin", "false");
            //console.log("USER LOGIN - Setting restricted access");
          }

          // Clear previous user's specific cache to prevent data leakage
          try {
            // Flush the global in-memory + app_cache_ sheet caches (main.jsx) so
            // no previously-logged-in user's fetched sheet data survives into this
            // session. The in-memory Map is not reachable via localStorage.
            if (typeof window !== 'undefined' && typeof window.clearAllSheetCaches === 'function') {
              window.clearAllSheetCaches();
            }
            const keysToKeep = ['masterDataCache', 'masterDataCacheTime', 'theme'];
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && !keysToKeep.includes(key)) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
          } catch(e) {
            console.error("Failed to clear cache on login", e);
          }

          // Log attendance to Google Sheet
          logAttendance(trimmedUsername, userRole);

          // Show success popup
          setShowSuccessPopup(true);

          // After 2 seconds, hide the success popup and go straight to the dashboard.
          // The "What's New" update popup is disabled — this used to gate navigation
          // behind the user closing it (setShowUpdatePopup(true)), so we navigate here instead.
          setTimeout(() => {
            setShowSuccessPopup(false);
            navigate("/dashboard/admin");
          }, 2000);

          showToast(
            `Login successful. Welcome, ${trimmedUsername}!`,
            "success"
          );
          return;
        } else {
          showToast(
            "Username or password is incorrect. Please try again.",
            "error"
          );
        }
      } else {
        showToast(
          "Username or password is incorrect. Please try again.",
          "error"
        );
      }

      // If we got here, login failed
      console.error("Login Failed", {
        usernameExists: trimmedUsername in masterData.userCredentials,
        passwordMatch:
          trimmedUsername in masterData.userCredentials
            ? "Password did not match"
            : "Username not found",
        userRole: masterData.userRoles[trimmedUsername] || "No role",
      });
    } catch (error) {
      console.error("Login Error:", error);
      showToast(`Login failed: ${error.message}. Please try again.`, "error");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 5000); // Toast duration
  };

  const togglePasswordVisibility = () => {
    setVisible(!visible);
  };

  // 3D tilt for the login card: rotates toward the cursor and moves a glass
  // "sheen" highlight with it, giving the flat card real depth.
  const cardRef = useRef(null);
  const sheenRef = useRef(null);

  const handleCardMouseMove = (e) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotY = (px - 0.5) * 14;
    const rotX = (0.5 - py) * 10;
    card.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    if (sheenRef.current) {
      sheenRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.55), transparent 45%)`;
      sheenRef.current.style.opacity = "1";
    }
  };

  const handleCardMouseLeave = () => {
    const card = cardRef.current;
    if (card) card.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)";
    if (sheenRef.current) sheenRef.current.style.opacity = "0";
  };

  // Close the "What's New" popup and continue to the dashboard.
  const handleCloseUpdatePopup = () => {
    setShowUpdatePopup(false);
    navigate("/dashboard/admin");
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 font-sans">
      {/* Left/Top Side - Image and Branding */}
      <div className="relative w-full md:w-5/12 lg:w-1/2 min-h-[35vh] md:min-h-screen flex flex-col justify-center items-center overflow-hidden bg-purple-900">
        <div className="absolute inset-0 z-0">
          <img src="/login-bg.png" alt="Abstract Background" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 to-blue-900/80 mix-blend-multiply"></div>
        </div>
        
        <div className="relative z-10 text-center text-white px-6 py-10 md:px-12 w-full max-w-lg mx-4 md:mx-0 rounded-3xl backdrop-blur-md bg-white/10 border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]">
          <div className="mx-auto w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner backdrop-blur-xl border border-white/30">
            <i className="fas fa-clipboard-check text-4xl text-white"></i>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 drop-shadow-md">
            TaskMaster
          </h1>
          <p className="text-lg md:text-xl text-purple-100 font-light tracking-wide mb-8">
            Checklist & Delegation System
          </p>
          
          <div className="pt-6 border-t border-white/20 inline-block px-8">
            <TypingText text="DEVELOPED BY DEEPAK SAHU" />
          </div>
        </div>
      </div>

      {/* Right/Bottom Side - Login Form */}
      <div
        className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #e8e0f0 0%, #d5cce0 25%, #c9c2d4 50%, #d0cad8 75%, #e2dce8 100%)" }}
      >
        {/* Soft glow centered behind the card, echoing the card's own 3D shadow */}
        <div className="absolute inset-0 [background:radial-gradient(42%_42%_at_50%_50%,rgba(255,255,255,0.35),transparent_70%)]"></div>

        {/* Decorative mesh blobs, toned to match the dashboard's lavender-grey theme */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" style={{ background: "#c9c2d4" }}></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" style={{ background: "#d5cce0", animationDelay: "2s" }}></div>
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{ background: "#e2dce8", animationDelay: "4s" }}></div>

        {/* Running light border: a bright arc sweeps continuously around the card's edge */}
        <div className="relative w-full max-w-md rounded-[2.05rem] p-[2px] overflow-hidden z-10">
          <div
            aria-hidden="true"
            className="absolute -inset-full animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, transparent 260deg, #9333EA 285deg, #DB2777 300deg, #9333EA 315deg, transparent 340deg, transparent 360deg)",
            }}
          ></div>

          <div
            ref={cardRef}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            className="relative w-full bg-white p-8 md:p-10 rounded-[2rem] border border-gray-100 transition-transform duration-200 ease-out will-change-transform"
            style={{
              boxShadow:
                "0 2px 0 rgba(255,255,255,0.7) inset, 0 45px 80px -30px rgba(88,28,135,0.35), 0 18px 34px -16px rgba(219,39,119,0.25)",
            }}
          >
          <div
            ref={sheenRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-0 transition-opacity duration-200 mix-blend-overlay"
          ></div>
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome Back</h2>
            <p className="text-gray-500 mt-3 text-sm">Please enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-semibold text-gray-700 block">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-purple-600 transition-colors">
                  <i className="fas fa-user"></i>
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:bg-white transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-gray-700 block">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-purple-600 transition-colors">
                  <i className="fas fa-lock"></i>
                </div>
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  placeholder="Enter your password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-11 pr-12 py-3.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 focus:bg-white transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-purple-600 transition-colors bg-transparent border-none outline-none focus:outline-none shadow-none"
                  style={{ border: 'none', background: 'transparent' }}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-8 py-3.5 px-4 gradient-bg text-white rounded-xl font-semibold tracking-wide shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5 border-none outline-none"
              style={{ border: 'none' }}
              disabled={isLoginLoading || isDataLoading}
            >
              {isLoginLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : isDataLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading Data...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in-down">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-sm border ${toast.type === "success"
              ? "bg-green-50/90 border-green-200 text-green-800"
              : "bg-red-50/90 border-red-200 text-red-800"
            }`}>
            {toast.type === "success" ? (
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600">
                <i className="fas fa-check"></i>
              </div>
            ) : (
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600">
                <i className="fas fa-exclamation"></i>
              </div>
            )}
            <p className="font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Success Popup Modal */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-md animate-fade-in">
          <style>{`
            @keyframes successPop { 0% { opacity: 0; transform: scale(0.92) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes checkRing { 0% { box-shadow: 0 0 0 0 rgba(147,51,234,0.35); } 70% { box-shadow: 0 0 0 16px rgba(147,51,234,0); } 100% { box-shadow: 0 0 0 0 rgba(147,51,234,0); } }
            @keyframes successBorderSpin { to { transform: rotate(360deg); } }
          `}</style>

          <div
            className="relative max-w-sm w-full mx-4 rounded-[1.75rem] p-[2px] overflow-hidden"
            style={{ animation: "successPop 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            {/* Running light border, matching the sign-in card */}
            <div
              aria-hidden="true"
              className="absolute -inset-full motion-reduce:animate-none"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, transparent 260deg, #9333EA 285deg, #DB2777 300deg, #9333EA 315deg, transparent 340deg, transparent 360deg)",
                animation: "successBorderSpin 3s linear infinite",
              }}
            ></div>

            <div
              className="relative bg-white rounded-[1.7rem] p-8 text-center overflow-hidden"
              style={{
                boxShadow:
                  "0 2px 0 rgba(255,255,255,0.7) inset, 0 40px 70px -28px rgba(88,28,135,0.35), 0 16px 30px -14px rgba(219,39,119,0.25)",
              }}
            >
              {/* Decorative background glow */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-10 w-40 h-40 bg-purple-400 rounded-full blur-3xl opacity-20"></div>

              <div
                className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-purple-50 to-pink-100 border-4 border-white mb-6 relative z-10"
                style={{
                  animation: "checkRing 2s ease-out infinite",
                  boxShadow: "0 8px 20px -8px rgba(147,51,234,0.5)",
                }}
              >
                <svg className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2 relative z-10 tracking-tight">
                Login Successful!
              </h3>

              <p className="text-gray-600 text-base mb-8 relative z-10">
                Welcome back, <span className="font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{loggedInUsername}</span>! We're redirecting you to your dashboard.
              </p>

              <div className="flex flex-col items-center justify-center relative z-10">
                <div className="relative h-9 w-9">
                  <div className="absolute inset-0 rounded-full border-2 border-purple-100"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-600 border-r-pink-600 animate-spin"></div>
                </div>
                <p className="text-xs text-gray-400 mt-3 font-semibold uppercase tracking-[0.2em]">
                  Redirecting
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* What's New / Update Popup */}
      {showUpdatePopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100 opacity-100 relative max-h-[92vh] overflow-y-auto">
            {/* Decorative background glow */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-10 w-32 h-32 bg-purple-400 rounded-full blur-3xl opacity-20"></div>

            {/* Cross / Close button */}
            <button
              type="button"
              onClick={handleCloseUpdatePopup}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 flex items-center justify-center h-9 w-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors bg-transparent border-none outline-none focus:outline-none"
              style={{ border: 'none' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-purple-50 border border-purple-100 mb-4 relative z-10">
              <i className="fas fa-bullhorn text-2xl text-purple-600"></i>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-1 text-center relative z-10">
              New Update
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center relative z-10">
              नया अपडेट
            </p>

            <ul className="space-y-3 relative z-10">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-purple-100 text-purple-600 text-sm font-bold">1</span>
                <div>
                  <p className="text-gray-800 font-medium">अब से आप फाइल अपलोड कर सकते हैं।</p>
                  <p className="text-gray-500 text-sm">You can now upload a file.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-purple-100 text-purple-600 text-sm font-bold">2</span>
                <div>
                  <p className="text-gray-800 font-medium">अब से आप एक साथ कई इमेज अपलोड कर सकते हैं।</p>
                  <p className="text-gray-500 text-sm">You can now upload multiple images.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-purple-100 text-purple-600 text-sm font-bold">3</span>
                <div>
                  <p className="text-gray-800 font-medium">अब से आप सीधे कैमरा से फोटो अपलोड कर सकते हैं।</p>
                  <p className="text-gray-500 text-sm">You can now upload a photo directly from the camera.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-purple-100 text-purple-600 text-sm font-bold">4</span>
                <div>
                  <p className="text-gray-800 font-medium">अब से आप स्क्रीनशॉट लेकर सीधे Paste बटन से इमेज पेस्ट कर सकते हैं।</p>
                  <p className="text-gray-500 text-sm">You can now take a screenshot and directly paste it as an image using the Paste button.</p>
                </div>
              </li>
            </ul>

            {/* Tutorial: screenshot-style mockup showing where to upload */}
            <div className="relative z-10 mt-6">
              <p className="text-sm font-semibold text-gray-700">कैसे अपलोड करें? / How to upload?</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                टास्क टेबल में <span className="font-semibold text-purple-600">Upload</span> बटन पर क्लिक करें।
                / Click the highlighted <span className="font-semibold text-purple-600">Upload</span> button in the tasks table.
              </p>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 shadow-inner">
                {/* Fake browser/app top bar to look like a screenshot */}
                <div className="flex items-center gap-1.5 px-1 pb-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400"></span>
                  <span className="ml-2 text-[10px] text-gray-400 font-medium">Checklist Tasks</span>
                </div>

                {/* Fake table */}
                <div className="rounded-lg overflow-hidden border border-gray-200 bg-white text-[11px]">
                  <div className="grid grid-cols-3 bg-gray-100 text-gray-500 font-semibold uppercase tracking-wide">
                    <div className="px-3 py-2">Task</div>
                    <div className="px-3 py-2">Status</div>
                    <div className="px-3 py-2">Upload Image</div>
                  </div>
                  <div className="grid grid-cols-3 items-center border-t border-gray-100">
                    <div className="px-3 py-3 text-gray-700">Daily Report</div>
                    <div className="px-3 py-3 text-gray-700">Yes</div>
                    <div className="px-2 py-3 bg-green-50 relative">
                      {/* Highlighted Upload button */}
                      <span className="relative inline-flex">
                        <span className="absolute -inset-1.5 rounded-lg ring-2 ring-purple-500 animate-pulse"></span>
                        <span className="relative inline-flex items-center gap-1 rounded-md bg-white border border-purple-300 px-2 py-1 text-purple-700 font-semibold shadow-sm">
                          <i className="fas fa-upload"></i> Upload
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow + callout pointing up to the Upload button */}
                <div className="flex items-start justify-end gap-2 mt-1.5 pr-3">
                  <div className="text-right pt-1">
                    <p className="text-[11px] font-bold text-purple-700">यहाँ से अपलोड करें</p>
                    <p className="text-[10px] text-gray-500">Tap here to upload</p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-9 w-9 text-purple-600 animate-bounce">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </div>

                {/* Options that appear on tapping Upload — each one individually highlighted with its own arrow + caption */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="flex flex-col items-center text-center">
                    <p className="text-[9px] font-bold text-purple-700 leading-tight">फोटो खींचें</p>
                    <p className="text-[8px] text-gray-500 leading-tight mb-0.5">Take photo</p>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 text-purple-500 animate-bounce">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                    <div className="mt-0.5 flex flex-col items-center justify-center rounded-lg bg-white border-2 border-purple-400 py-2 px-1 w-full">
                      <i className="fas fa-camera text-purple-500 text-base mb-1"></i>
                      <span className="text-[10px] font-medium text-gray-700 leading-tight">कैमरा<br />Camera</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <p className="text-[9px] font-bold text-purple-700 leading-tight">गैलरी से चुनें</p>
                    <p className="text-[8px] text-gray-500 leading-tight mb-0.5">Choose from gallery</p>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 text-purple-500 animate-bounce">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                    <div className="mt-0.5 flex flex-col items-center justify-center rounded-lg bg-white border-2 border-purple-400 py-2 px-1 w-full">
                      <i className="fas fa-images text-purple-500 text-base mb-1"></i>
                      <span className="text-[10px] font-medium text-gray-700 leading-tight">कई इमेज<br />Gallery</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <p className="text-[9px] font-bold text-purple-700 leading-tight">स्क्रीनशॉट पेस्ट करें</p>
                    <p className="text-[8px] text-gray-500 leading-tight mb-0.5">Paste screenshot</p>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 text-purple-500 animate-bounce">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                    <div className="mt-0.5 flex flex-col items-center justify-center rounded-lg bg-white border-2 border-purple-400 py-2 px-1 w-full">
                      <i className="fas fa-clipboard text-purple-500 text-base mb-1"></i>
                      <span className="text-[10px] font-medium text-gray-700 leading-tight">पेस्ट<br />Paste</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  स्क्रीनशॉट पहले कॉपी करें, फिर <span className="font-semibold text-purple-600">Paste</span> पर क्लिक करें।
                  / Copy a screenshot first, then click <span className="font-semibold text-purple-600">Paste</span> to attach it directly.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseUpdatePopup}
              className="w-full mt-8 py-3 px-4 gradient-bg text-white rounded-xl font-semibold tracking-wide shadow-md hover:shadow-lg focus:outline-none transition-all duration-300 relative z-10 border-none"
              style={{ border: 'none' }}
            >
              Got it / समझ गया
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
