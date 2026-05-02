import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiHome, FiBriefcase, FiTarget, FiMessageSquare, 
  FiLogOut, FiTrendingUp, FiMap, FiMenu, FiX, FiChevronRight
} from 'react-icons/fi';

export default function MainLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🚀 Fetch Basic User Info for Navbar
  useEffect(() => {
    if (user?.email) {
      fetch(`http://127.0.0.1:8000/get-profile?email=${user.email}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') setUserData(data.data);
        })
        .catch(err => console.error("Error fetching user data for navbar:", err));
    }
  }, [user]);

  // 🚀 Sidebar Links
  const navItems = [
    { id: 'dashboard', path: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
    { id: 'jobs', path: '/jobs', icon: <FiBriefcase />, label: 'Job Matches' },
    { id: 'roadmap', path: '/roadmap', icon: <FiTarget />, label: 'AI Resume Analyzer' },
    { id: 'trends', path: '/trends', icon: <FiTrendingUp />, label: 'Market Trends' }, 
    { id: 'skillroadmap', path: '/skillroadmap', icon: <FiMap />, label: 'Learning Hub' }, 
    { id: 'chat', path: '/chat', icon: <FiMessageSquare />, label: 'AI Counselor' },
  ];

  // Smart Page Title Generator for Header
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Command Center';
    if (path.includes('jobs')) return 'Job Matches';
    if (path.includes('roadmap')) return 'AI Resume Analyzer';
    if (path.includes('trends')) return 'Market Trends';
    if (path.includes('skillroadmap')) return 'Learning Hub';
    if (path.includes('chat')) return 'AI Counselor';
    if (path.includes('profile')) return 'Profile Settings';
    return 'Workspace';
  };

  const getInitials = (name) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.charAt(0).toUpperCase();
  };

  const handleSignOut = async () => {
    try {
      await signOut(); 
      navigate('/');   
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  // 🧩 Reusable Sidebar Component
  const SidebarContent = () => (
    <>
      <div>
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/dashboard" className="flex items-center gap-3 group" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] group-hover:scale-105 transition-transform">
              H
            </div>
            <span className="text-xl font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">HireMap</span>
          </Link>
        </div>

        <nav className="p-4 space-y-1 mt-2">
          <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Menu</p>
          {navItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive 
                    ? 'bg-indigo-500/10 text-indigo-400 shadow-[inset_3px_0_0_0_#6366f1]' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span className={`text-lg ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>{item.icon}</span> 
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/5">
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <FiLogOut className="text-lg text-slate-500 hover:text-red-400" /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    // ✨ Changed background to a premium deep dark with subtle radial gradient
    <div className="flex h-screen bg-[#050505] font-sans text-slate-300 overflow-hidden selection:bg-indigo-500/30">
      
      {/* 🌍 DESKTOP LEFT SIDEBAR */}
      <aside className="w-[260px] bg-[#0A0A0B] border-r border-white/5 flex-col justify-between hidden md:flex shrink-0 z-20 shadow-2xl">
        <SidebarContent />
      </aside>

      {/* 📱 MOBILE SIDEBAR (Drawer) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-[#0A0A0B] border-r border-white/5 flex flex-col justify-between z-50 shadow-2xl md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 🌍 GLOBAL MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#050505] to-[#050505]">
        
        {/* 👑 GLOBAL TOP HEADER */}
        <header className="h-20 shrink-0 flex items-center justify-between px-6 md:px-10 bg-[#050505]/60 backdrop-blur-xl sticky top-0 z-10 border-b border-white/5">
          
          {/* Mobile Menu Toggle & Dynamic Breadcrumb */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-400 hover:bg-white/10 md:hidden transition-colors"
            >
              <FiMenu size={24} />
            </button>
            
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>HireMap</span>
              <FiChevronRight size={14} />
              <span className="text-slate-200 font-bold">{getPageTitle()}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            
            {/* 🚀 PREMIUM CLICKABLE PROFILE WIDGET */}
            <div 
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-3 cursor-pointer p-1.5 pr-4 rounded-full transition-all duration-300 border ${
                location.pathname === '/profile' 
                ? 'bg-indigo-500/10 border-indigo-500/30 ring-2 ring-indigo-500/20' 
                : 'bg-[#0A0A0B] border-white/5 hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px] shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                <div className="w-full h-full bg-[#0A0A0B] rounded-full flex items-center justify-center font-bold text-xs text-white">
                  {getInitials(userData?.full_name)}
                </div>
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-bold text-slate-200 leading-tight truncate max-w-[120px]">
                  {userData?.full_name || 'Loading...'}
                </p>
                <p className="text-[11px] text-indigo-400 font-medium leading-tight truncate max-w-[120px]">
                  {userData?.target_role || 'User'}
                </p>
              </div>
            </div>

          </div>
        </header>

        {/* ✨ MAIN OUTLET CONTAINER */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-0">
          {/* Soft glow behind the content */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-indigo-500/5 blur-[100px] pointer-events-none rounded-full"></div>
          
          <div className="relative z-10 h-full">
            <Outlet />
          </div>
        </main>

      </div>
      
    </div>
  );
}