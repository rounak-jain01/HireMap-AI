import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { 
  FiHome, FiBriefcase, FiTarget, FiMessageSquare, 
  FiLogOut, FiSearch, FiBell, FiTrendingUp, FiMap 
} from 'react-icons/fi';

export default function MainLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);

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

  // 🚀 Sidebar Links (Removed Profile)
  const navItems = [
    { id: 'dashboard', path: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
    { id: 'jobs', path: '/jobs', icon: <FiBriefcase />, label: 'Job Matches' },
    { id: 'roadmap', path: '/roadmap', icon: <FiTarget />, label: 'AI Resume Analyzer' },
    { id: 'trends', path: '/trends', icon: <FiTrendingUp />, label: 'Market Trends' }, 
    { id: 'skillroadmap', path: '/skillroadmap', icon: <FiMap />, label: 'Learning Hub' }, 
    { id: 'chat', path: '/chat', icon: <FiMessageSquare />, label: 'AI Counselor' },
  ];

  // Helper to get initials (e.g., "Rounak Jain" -> "RJ")
  const getInitials = (name) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.charAt(0).toUpperCase();
  };

  const handleSignOut = async () => {
    try {
      await signOut(); // Firebase/Supabase se logout karega
      navigate('/');   // 👈 Logout hote hi seedha Landing page par fekega!
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A] font-sans text-white overflow-hidden">
      
      {/* 🌍 GLOBAL LEFT SIDEBAR */}
      <aside className="w-64 bg-[#121214] border-r border-white/5 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          <div className="h-20 flex items-center px-8 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(79,70,229,0.3)]">H</div>
              <span className="text-xl font-black tracking-tight">HireMap</span>
            </div>
          </div>

          <nav className="p-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const isActive = location.pathname.includes(item.path);
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive 
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all"
          >
            <FiLogOut className="text-lg" /> Sign Out
          </button>
        </div>
      </aside>

      {/* 🌍 GLOBAL MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* GLOBAL TOP HEADER */}
        <header className="h-20 shrink-0 flex items-center justify-between px-8 bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-10 border-b border-white/5">
          <h1 className="text-xl font-bold text-slate-200">
            {location.pathname === '/dashboard' ? 'Welcome back, Engineer 🚀' : 
             location.pathname === '/profile' ? 'Profile Settings ⚙️' : 'HireMap Workspace'}
          </h1>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Quick search..." 
                className="bg-[#121214] border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors w-64 text-white"
              />
            </div>
            
            <button className="relative text-slate-400 hover:text-white transition-colors">
              <FiBell className="text-xl" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-[#0A0A0A]"></span>
            </button>
            
            {/* 🚀 THE NEW CLICKABLE PROFILE SECTION */}
            <div 
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-3 cursor-pointer p-1.5 pr-4 rounded-full transition-all border ${
                location.pathname === '/profile' 
                ? 'bg-indigo-500/10 border-indigo-500/30' 
                : 'hover:bg-white/5 border-transparent'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-[0_0_15px_rgba(79,70,229,0.2)]">
                <div className="w-full h-full bg-[#121214] rounded-full flex items-center justify-center font-bold text-sm text-white">
                  {getInitials(userData?.full_name)}
                </div>
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-bold text-white leading-tight">{userData?.full_name || 'Loading...'}</p>
                <p className="text-xs text-slate-400 leading-tight">{userData?.target_role || 'User'}</p>
              </div>
            </div>

          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <Outlet />
        </main>
      </div>
      
    </div>
  );
}