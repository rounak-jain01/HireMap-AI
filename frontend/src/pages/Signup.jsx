// src/pages/Signup.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
// Naye icons import
import { FiUser, FiMail, FiLock, FiArrowRight, FiCheckCircle, FiAlertCircle, FiShield, FiEye, FiEyeOff } from 'react-icons/fi';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  // Eye toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0); 
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength === 0 && password.length > 0 ? 1 : strength);
  }, [password]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) return setError('Please fill in all fields.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (password.length < 8) return setError('Password must be at least 8 characters long.');
    if (!agreeTerms) return setError('You must agree to the Terms of Service.');

    try {
      setIsLoading(true);
      setError('');
      
      const { error: authError } = await signUp(email, password);
      if (authError) throw authError;

      navigate('/onboarding');
      
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] font-sans">
      {/* LEFT SIDE (Same as before) */}
      <div className="hidden lg:flex w-1/2 relative bg-[#050505] items-center justify-center overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-dot-pattern opacity-30"></div>
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>
        
        <div className="relative z-10 max-w-lg p-12">
          <Link to="/" className="flex items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">H</div>
            <span className="text-2xl font-bold tracking-tight text-white">HireMap</span>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-4xl font-black text-white mb-6 leading-tight">Start your journey to the top.</h1>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Create your free account today and unlock AI-powered resume analysis, predictive market insights, and personalized job roadmaps.
            </p>

            <div className="space-y-4">
              {['Free lifetime basic access', 'No credit card required', 'Secure & encrypted data'].map((text, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <FiCheckCircle size={14}/>
                  </div>
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        <Link to="/" className="absolute top-8 left-6 lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">H</div>
          <span className="text-xl font-bold text-white">HireMap</span>
        </Link>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md pt-16 lg:pt-0">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Create an account</h2>
            <p className="text-slate-400 font-medium">Join HireMap to accelerate your career.</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6">
              <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3.5 rounded-xl text-sm flex items-center gap-2 font-medium">
                <FiAlertCircle size={16} className="shrink-0" /> <span>{error}</span>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" required placeholder="e.g. Rohit Sharma" onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#121214] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300">Email address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" required placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-[#121214] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••" 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full pl-10 pr-10 py-3 bg-[#121214] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-300">Confirm</label>
                <div className="relative">
                  <FiShield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••" 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    className="w-full pl-10 pr-10 py-3 bg-[#121214] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {password.length > 0 && (
              <div className="pt-1">
                <div className="flex gap-1.5 h-1.5 w-full rounded-full overflow-hidden">
                  <div className={`h-full w-1/3 ${passwordStrength >= 1 ? (passwordStrength === 1 ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-800'}`}></div>
                  <div className={`h-full w-1/3 ${passwordStrength >= 2 ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                  <div className={`h-full w-1/3 ${passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded bg-[#121214] border-white/10 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#0A0A0A]" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
                <span className="text-xs text-slate-400">I agree to the Terms of Service and Privacy Policy.</span>
              </label>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-6 disabled:opacity-70 transition-all">
              {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <>Create Account <FiArrowRight size={18} /></>}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-slate-400 pb-8 lg:pb-0">
            Already have an account? <Link to="/login" className="text-indigo-400 font-bold hover:underline">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}