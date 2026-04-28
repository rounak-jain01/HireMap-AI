import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiBriefcase, FiTarget, FiActivity, FiTrendingUp, 
  FiMapPin, FiDollarSign, FiPercent, FiArrowRight, FiCheckCircle
} from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Real Data States
  const [profile, setProfile] = useState(null);
  const [topJobs, setTopJobs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalJobsScanned: 0,
    strongMatches: 0,
    avgMatchScore: 0,
    roadmapProgress: 0,
    readinessScore: 0
  });
  const [roadmaps, setRoadmaps] = useState([]);

  useEffect(() => {
    const fetchAllDashboardData = async () => {
      if (!user?.email) return;
      setLoading(true);

      try {
        // 1️⃣ Fetch Profile
        const profileRes = await fetch(`http://127.0.0.1:8000/get-profile?email=${user.email}`);
        const profileData = await profileRes.json();
        
        // 2️⃣ Fetch Jobs Match
        const jobsRes = await fetch(`http://127.0.0.1:8000/match-jobs?email=${user.email}`);
        const jobsData = await jobsRes.json();
        
        // 3️⃣ Fetch Roadmaps
        const roadmapRes = await fetch(`http://127.0.0.1:8000/get-user-roadmap?email=${user.email}`);
        const roadmapData = await roadmapRes.json();

        // --- 🧠 DATA PROCESSING & MATH ---
        let pData = profileData.status === 'success' ? profileData.data : {};
        let jData = jobsData.status === 'success' ? jobsData.jobs : [];
        let rData = roadmapData.status === 'success' ? roadmapData.data : [];

        setProfile(pData);
        setRoadmaps(rData);

        // Job Metrics
        const strong = jData.filter(j => j.matchScore >= 50);
        const sortedJobs = [...jData].sort((a, b) => b.matchScore - a.matchScore);
        const top3 = sortedJobs.slice(0, 2); // Show top 2 on dashboard
        
        const avgScore = jData.length > 0 
          ? Math.round(jData.reduce((acc, curr) => acc + (curr.matchScore || 0), 0) / jData.length) 
          : 0;

        // Roadmap Metrics
        const avgRoadmap = rData.length > 0 
          ? Math.round(rData.reduce((acc, curr) => acc + (curr.progress || 0), 0) / rData.length)
          : 0;

        // Ultimate Readiness Score (60% weight to roadmap, 40% to current job match)
        const readiness = Math.round((avgRoadmap * 0.6) + (avgScore * 0.4));

        setTopJobs(top3);
        setMetrics({
          totalJobsScanned: jData.length,
          strongMatches: strong.length,
          avgMatchScore: avgScore,
          roadmapProgress: avgRoadmap,
          readinessScore: readiness > 0 ? readiness : avgScore // Fallback
        });

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllDashboardData();
  }, [user]);

  // Helper for Chart Data
  const chartData = [
    { label: 'Avg Match', value: metrics.avgMatchScore, color: 'bg-indigo-500' },
    { label: 'Learning', value: metrics.roadmapProgress, color: 'bg-purple-500' },
    { label: 'Readiness', value: metrics.readinessScore, color: 'bg-emerald-500' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] w-full">
        <div className="w-16 h-16 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-white mb-2">Compiling your data...</h2>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
      
      {/* 🚀 AI READINESS BANNER */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#121214] to-indigo-900/20 border border-indigo-500/20 rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl"
      >
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>
        
        <div className="flex-1 z-10 text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-black mb-3">
            Welcome back, <span className="text-indigo-400">{profile?.full_name?.split(' ')[0] || 'Engineer'}</span>
          </h2>
          <p className="text-slate-400 max-w-xl text-lg">
            Your overall AI Readiness Score is <span className="text-emerald-400 font-bold">{metrics.readinessScore}%</span>. 
            We found <span className="text-white font-bold">{metrics.strongMatches}</span> strong job matches for your target role of <span className="text-white font-bold">{profile?.target_role || 'Tech Professional'}</span>.
          </p>
        </div>

        {/* Custom Radial Progress using SVG */}
        <div className="shrink-0 relative w-32 h-32 flex items-center justify-center z-10">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
            <motion.circle 
              initial={{ strokeDashoffset: 251 }} 
              animate={{ strokeDashoffset: 251 - (251 * metrics.readinessScore) / 100 }} 
              transition={{ duration: 1.5, ease: "easeOut" }}
              cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
              strokeDasharray="251" strokeLinecap="round" 
              className={`${metrics.readinessScore > 70 ? 'text-emerald-400' : 'text-amber-400'} drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">{metrics.readinessScore}</span>
          </div>
        </div>
      </motion.div>

      {/* 📊 METRICS & CHARTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Quick Stats */}
        <div className="col-span-1 grid grid-rows-2 gap-6">
          <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Total Scanned</p>
              <h3 className="text-3xl font-black text-white">{metrics.totalJobsScanned} <span className="text-sm font-medium text-slate-500">Jobs</span></h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl"><FiBriefcase /></div>
          </div>
          <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Skills Tracking</p>
              <h3 className="text-3xl font-black text-white">{roadmaps.length} <span className="text-sm font-medium text-slate-500">Active</span></h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-xl"><FiTarget /></div>
          </div>
        </div>

        {/* Custom Bar Chart Component */}
        <div className="col-span-1 md:col-span-2 bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
            <FiActivity className="text-indigo-400" /> Performance Analytics
          </h3>
          <div className="flex items-end justify-around h-40 gap-4 mt-8">
            {chartData.map((data, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3 w-full group">
                <div className="relative w-16 md:w-20 bg-[#0A0A0A] rounded-t-xl border border-b-0 border-white/5 flex items-end justify-center h-full overflow-hidden">
                  <motion.div 
                    initial={{ height: 0 }} animate={{ height: `${data.value}%` }} 
                    transition={{ duration: 1, delay: idx * 0.2 }}
                    className={`w-full ${data.color} opacity-80 group-hover:opacity-100 transition-opacity relative`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  </motion.div>
                </div>
                <div className="text-center">
                  <span className="block text-white font-bold">{data.value}%</span>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{data.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 💼 TOP MATCHING JOBS */}
      <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-lg">
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><FiTrendingUp className="text-emerald-400"/> Top AI Job Matches</h3>
          <button onClick={() => navigate('/jobs')} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
            View All <FiArrowRight />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topJobs.length > 0 ? topJobs.map((job, idx) => {
            // Safe JSON Parse logic same as Jobs page
            let parsedSkills = [];
            try { parsedSkills = typeof job.skills_required === 'string' ? JSON.parse(job.skills_required) : (job.skills_required || []); } catch(e){}
            
            return (
              <motion.div 
                key={job.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}
                onClick={() => navigate('/jobs')}
                className="bg-[#0A0A0A] border border-white/5 hover:border-indigo-500/30 rounded-2xl p-6 cursor-pointer group transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-xl text-indigo-400 shrink-0">
                      {(job.company_name || "H").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{job.job_title}</h4>
                      <p className="text-slate-400 text-sm font-medium">{job.company_name}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20 shrink-0">
                    <FiPercent /> {job.matchScore}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><FiMapPin className="text-slate-400"/> {job.city || 'Location N/A'}</span>
                  <span className="flex items-center gap-1"><FiDollarSign className="text-slate-400"/> {job.salary !== "Not Disclosed" ? job.salary : 'Confidential'}</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Top Required Skills:</span>
                  <div className="flex flex-wrap gap-2">
                    {parsedSkills.slice(0, 4).map((s, i) => (
                      <span key={i} className="bg-white/5 text-slate-300 px-2 py-1 rounded-md text-xs border border-white/10">{s}</span>
                    ))}
                    {parsedSkills.length > 4 && <span className="text-xs text-slate-500 mt-1">+{parsedSkills.length - 4} more</span>}
                  </div>
                </div>
              </motion.div>
            )
          }) : (
            <div className="col-span-full text-center py-10">
              <p className="text-slate-500">No matching jobs found yet. Update your profile or upload a better resume.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}