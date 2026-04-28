// src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
// Naye icons (FiEye, FiEyeOff) import kiye hain
import { FiMail, FiLock, FiArrowRight, FiCheckCircle, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Eye toggle state
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return setError('Please fill in all fields.');

    try {
      setError('');
      setIsLoading(true);
      const { error: authError } = await signIn(email, password);
      if (authError) throw authError;
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] font-sans">
      {/* LEFT SIDE (Same as before) */}
      <div className="hidden lg:flex w-1/2 relative bg-[#050505] items-center justify-center overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-dot-pattern opacity-30"></div>
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>

        <div className="relative z-10 max-w-lg p-12">
          <Link to="/" className="flex items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">H</div>
            <span className="text-2xl font-bold tracking-tight text-white">HireMap</span>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-4xl font-black text-white mb-6 leading-tight">Your career's unfair advantage.</h1>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Join thousands of tech professionals using AI to build perfect resumes, predict market trends, and land dream jobs.
            </p>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  <FiCheckCircle className="text-indigo-400" /> Trusted by developers
                </div>
              </div>
              <p className="text-sm text-slate-300 italic">"HireMap completely changed how I apply for jobs. The AI counselor helped me clear the ATS round at my dream company."</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <Link to="/" className="absolute top-8 left-6 lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">H</div>
          <span className="text-xl font-bold text-white">HireMap</span>
        </Link>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Welcome back</h2>
            <p className="text-slate-400 font-medium">Please enter your details to sign in.</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6">
              <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3.5 rounded-xl text-sm flex items-center gap-2 font-medium">
                <FiAlertCircle size={16} /> {error}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300">Email address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" required placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-[#121214] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-300">Password</label>
                <Link to="#" className="text-xs font-bold text-indigo-400 hover:text-indigo-300">Forgot password?</Link>
              </div>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••" 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-10 pr-12 py-3.5 bg-[#121214] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                />
                {/* The Eye Button */}
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-6 disabled:opacity-70 transition-all">
              {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <>Sign In <FiArrowRight size={18} /></>}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-slate-400">
            Don't have an account? <Link to="/signup" className="text-indigo-400 font-bold hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}