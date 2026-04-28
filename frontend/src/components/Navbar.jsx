import { Link } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi"; // Sun aur Moon hata diye

export default function Navbar({ user }) {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5 transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* BRANDING */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
            H
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Hire<span className="text-indigo-500">Map</span>
          </span>
        </Link>

        {/* ACTIONS */}
        <div className="flex items-center gap-4 md:gap-6">
          {user ? (
            <Link to="/dashboard" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              Dashboard <FiArrowRight size={16} />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Log in
              </Link>
              <Link to="/signup" className="flex items-center gap-2 bg-white hover:bg-slate-200 text-[#0A0A0A] px-4 py-2 rounded-full text-sm font-bold transition-transform hover:scale-105">
                Sign up
              </Link>
            </div>
          )}
        </div>
        
      </div>
    </nav>
  );
}