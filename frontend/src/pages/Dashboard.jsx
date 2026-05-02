import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAppStore from '../store/useAppStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  FiBriefcase, FiTarget, FiMapPin, 
  FiArrowRight, FiRefreshCw, FiZap, FiAlertCircle,
  FiDollarSign, FiCpu, FiShield, FiPieChart
} from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { dashboardData, setDashboardData } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true); // Start with true

  const fetchDashboardStats = async (forceRefresh = false) => {
    if (!user?.email) return;
    
    // 🛡️ TRUST FIX: Check Zustand OR Browser LocalStorage first!
    if (!forceRefresh) {
      if (dashboardData) {
        setLoading(false);
        return;
      }
      const cachedData = localStorage.getItem(`hiremap_dash_${user.email}`);
      if (cachedData) {
        setDashboardData(JSON.parse(cachedData));
        setLoading(false);
        return;
      }
    }

    if(forceRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const [profileRes, jobsRes, roadmapRes] = await Promise.all([
        fetch(`http://127.0.0.1:8000/get-profile?email=${user.email}`),
        fetch(`http://127.0.0.1:8000/match-jobs?email=${user.email}`),
        fetch(`http://127.0.0.1:8000/get-user-roadmap?email=${user.email}`)
      ]);

      const profileData = await profileRes.json();
      const jobsData = await jobsRes.json();
      const roadmapData = await roadmapRes.json();

      let pData = profileData.status === 'success' ? profileData.data : {};
      let jData = jobsData.status === 'success' ? jobsData.jobs : [];
      let rData = roadmapData.status === 'success' ? roadmapData.data : [];

      // --- 🧠 DEEP ANALYTICS MATH ---
      const userSkills = (pData.extracted_skills || []).map(s => s.toLowerCase());
      const avgScore = jData.length > 0 ? Math.round(jData.reduce((acc, curr) => acc + (curr.matchScore || 0), 0) / jData.length) : 0;
      const avgRoadmap = rData.length > 0 ? Math.round(rData.reduce((acc, curr) => acc + (curr.progress || 0), 0) / rData.length) : 0;
      const readiness = Math.round((avgRoadmap * 0.6) + (avgScore * 0.4));

      // 1. Skill Matcher (Superpowers vs Gaps)
      const marketSkillsCount = {};
      jData.forEach(job => {
        let skills = [];
        try { skills = typeof job.skills_required === 'string' ? JSON.parse(job.skills_required) : (job.skills_required || []); } catch(e){}
        skills.forEach(s => { 
            const cleanSkill = s.trim();
            if(cleanSkill) marketSkillsCount[cleanSkill] = (marketSkillsCount[cleanSkill] || 0) + 1; 
        });
      });

      let superpowers = [];
      let gaps = [];

      Object.keys(marketSkillsCount).forEach(skill => {
        const isMatched = userSkills.some(us => us.includes(skill.toLowerCase()) || skill.toLowerCase().includes(us));
        if (isMatched) {
            superpowers.push({ name: skill, count: marketSkillsCount[skill] });
        } else {
            gaps.push({ name: skill, count: marketSkillsCount[skill] });
        }
      });

      superpowers = superpowers.sort((a,b) => b.count - a.count).slice(0, 8);
      gaps = gaps.sort((a,b) => b.count - a.count).slice(0, 8);

      // 🧹 2. CLEAN DATA FOR CHARTS (Fixes Overlapping Text)
      const cityCounts = {};
      const domainCounts = {};
      
      jData.forEach(job => {
        // Clean City: "Hybrid - Pune, Mumbai" -> "Pune"
        let rawCity = job.city || "Remote";
        rawCity = rawCity.replace(/hybrid|on-site|remote|-/ig, '').trim(); 
        let primaryCity = rawCity.split(',')[0].trim(); // Take only the first city
        if (primaryCity.toLowerCase().includes('bangalore')) primaryCity = 'Bengaluru';
        if (primaryCity.length > 2) {
           cityCounts[primaryCity] = (cityCounts[primaryCity] || 0) + 1;
        }

        // Clean Domain: Keep it to max 2 words
        let rawDomain = job.domain || "Technology";
        let primaryDomain = rawDomain.split(/[,\-/|]/)[0].trim(); // Split by comma or slash
        let shortDomain = primaryDomain.split(' ').slice(0, 2).join(' '); // Take max 2 words
        if(shortDomain.length > 2) {
           domainCounts[shortDomain] = (domainCounts[shortDomain] || 0) + 1;
        }
      });

      const cityChartData = Object.keys(cityCounts)
        .map(name => ({ name, jobs: cityCounts[name] }))
        .sort((a,b) => b.jobs - a.jobs)
        .slice(0, 5); 

      const domainChartData = Object.keys(domainCounts)
        .map(name => ({ name, jobs: domainCounts[name] }))
        .sort((a,b) => b.jobs - a.jobs)
        .slice(0, 5); 

      // 3. Salary Predictor
      let maxSalaryStr = "Not Disclosed";
      let highestNum = 0;
      jData.forEach(job => {
          if(job.salary && job.salary !== "Not Disclosed") {
              const nums = job.salary.match(/\d+(\.\d+)?/g);
              if (nums) {
                  const maxVal = Math.max(...nums.map(Number));
                  if (maxVal > highestNum) {
                      highestNum = maxVal;
                      maxSalaryStr = `Up to ${highestNum} LPA`; 
                  }
              }
          }
      });
      if(highestNum === 0 && jData.length > 0) maxSalaryStr = "Market Competitive";

      const finalData = {
        profile: pData,
        metrics: {
          totalJobs: jData.length,
          avgMatch: avgScore,
          roadmapProgress: avgRoadmap,
          readinessScore: readiness || avgScore || 0,
          strongMatches: jData.filter(j => j.matchScore >= 60).length,
        },
        topJobs: [...jData].sort((a, b) => b.matchScore - a.matchScore).slice(0, 2),
        superpowers,
        gaps,
        cityChartData,
        domainChartData,
        marketValue: maxSalaryStr
      };

      // 🛡️ TRUST FIX: Freeze data in Browser Storage
      localStorage.setItem(`hiremap_dash_${user.email}`, JSON.stringify(finalData));
      setDashboardData(finalData); 

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboardStats(); }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] w-full">
        <div className="w-16 h-16 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-white mb-2">Compiling Executive Summary...</h2>
        <p className="text-indigo-400 font-medium animate-pulse">Running market heuristics...</p>
      </div>
    );
  }

  if (!dashboardData) return null;
  const { profile, metrics, topJobs, superpowers, gaps, cityChartData, domainChartData, marketValue } = dashboardData;

  const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
  const CITY_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#064e3b'];

  // Helper to cleanly cut long labels on Y-Axis if they still somehow slip through
  const formatYAxis = (tickItem) => {
    if (typeof tickItem === 'string' && tickItem.length > 12) {
      return tickItem.substring(0, 12) + '...';
    }
    return tickItem;
  };

  return (
    <div className="p-6 md:p-10 max-w-[90rem] mx-auto w-full">
      
      {/* 🚀 HEADER WITH REFRESH BUTTON */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black mb-1 flex items-center gap-3">
             Command Center
          </h1>
          <p className="text-slate-400">Executive summary of your career data.</p>
        </div>
        <button 
          onClick={() => fetchDashboardStats(true)} disabled={isRefreshing}
          className="flex items-center gap-2 bg-[#121214] border border-white/10 hover:border-indigo-500/50 text-slate-300 px-4 py-2.5 rounded-xl transition-all font-bold text-sm shadow-lg"
        >
          <FiRefreshCw className={isRefreshing ? "animate-spin text-indigo-400" : ""} />
          {isRefreshing ? "Syncing..." : "Refresh Data"}
        </button>
      </div>

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
          <p className="text-slate-400 max-w-2xl text-lg">
            Your AI Readiness Score is <span className="text-emerald-400 font-bold">{metrics.readinessScore}%</span>. 
            We found <span className="text-white font-bold">{metrics.strongMatches}</span> strong job matches for <span className="text-white font-bold">{profile?.target_role || 'Tech Professional'}</span> out of {metrics.totalJobs} scanned opportunities.
          </p>
        </div>

        <div className="shrink-0 relative w-32 h-32 flex items-center justify-center z-10">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
            <motion.circle 
              initial={{ strokeDashoffset: 251 }} animate={{ strokeDashoffset: 251 - (251 * metrics.readinessScore) / 100 }} 
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

      {/* 📊 ROW 1: THE EXECUTIVE INSIGHT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Card 1: Estimated Market Value */}
        <div className="bg-gradient-to-br from-[#121214] to-emerald-900/10 border border-white/5 hover:border-emerald-500/30 rounded-3xl p-6 shadow-lg transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
              <FiDollarSign />
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/20">Market Insight</span>
          </div>
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Peak Earning Potential</p>
            <h3 className="text-3xl font-black text-white truncate">{marketValue}</h3>
            <p className="text-slate-500 text-xs mt-2">Based on top {metrics.strongMatches} matching companies.</p>
          </div>
        </div>

        {/* Card 2: Market Demand Level */}
        <div className="bg-gradient-to-br from-[#121214] to-indigo-900/10 border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 shadow-lg transition-all flex flex-col justify-between group">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
              <FiBriefcase />
            </div>
            <span className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/20">Hiring Velocity</span>
          </div>
          <div>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Total Active Roles</p>
            <h3 className="text-3xl font-black text-white">{metrics.totalJobs} <span className="text-lg font-medium text-slate-500">Jobs</span></h3>
            <p className="text-slate-500 text-xs mt-2">{metrics.totalJobs > 20 ? 'High demand in the current market.' : 'Niche or limited market demand.'}</p>
          </div>
        </div>

      </div>

      {/* 📈 ROW 2: ACTIONABLE CHARTS (Cities & Domains) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Chart 1: Top Hiring Cities */}
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-lg flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <FiMapPin className="text-emerald-400" /> Hotspots: Where are the jobs?
          </h3>
          <div className="w-full h-56">
            {cityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityChartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#e2e8f0" fontSize={13} fontWeight={600} tickLine={false} axisLine={false} width={120} tickFormatter={formatYAxis} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  <Bar dataKey="jobs" radius={[0, 6, 6, 0]} barSize={24}>
                    {cityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CITY_COLORS[index % CITY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Not enough location data</div>
            )}
          </div>
        </div>

        {/* Chart 2: Top Hiring Domains */}
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-lg flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <FiPieChart className="text-indigo-400" /> Industry: Who is hiring?
          </h3>
          <div className="w-full h-56">
            {domainChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainChartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#e2e8f0" fontSize={13} fontWeight={600} tickLine={false} axisLine={false} width={120} tickFormatter={formatYAxis} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  <Bar dataKey="jobs" radius={[0, 6, 6, 0]} barSize={24}>
                    {domainChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Not enough domain data</div>
            )}
          </div>
        </div>

      </div>

      {/* 🧠 ROW 3: AI SKILL AUDIT */}
      <div className="bg-[#121214] border border-white/5 rounded-3xl shadow-lg mb-8 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FiCpu className="text-indigo-400" /> AI Skill Audit
            </h3>
            <p className="text-slate-400 text-sm mt-1">We compared your resume against {metrics.totalJobs} live job descriptions.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
            
            {/* Left Pane: Superpowers */}
            <div className="p-6 md:p-8 bg-emerald-900/5">
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FiShield /> Your Superpowers (Matched)
                </h4>
                <div className="flex flex-wrap gap-3">
                    {superpowers.length > 0 ? superpowers.map((skill, i) => (
                        <div key={i} className="bg-[#0A0A0A] border border-emerald-500/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
                            <span className="text-white font-bold text-sm">{skill.name}</span>
                            <span className="text-emerald-500 text-xs font-black bg-emerald-500/10 px-2 py-0.5 rounded-md">High Demand</span>
                        </div>
                    )) : (
                        <p className="text-slate-500 text-sm italic">No major matching skills found yet.</p>
                    )}
                </div>
            </div>

            {/* Right Pane: Critical Gaps */}
            <div className="p-6 md:p-8 bg-red-900/5">
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FiAlertCircle /> Critical Gaps (Missing)
                </h4>
                <div className="flex flex-wrap gap-3">
                    {gaps.length > 0 ? gaps.map((skill, i) => (
                        <div key={i} className="bg-[#0A0A0A] border border-red-500/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm group">
                            <span className="text-slate-300 font-bold text-sm group-hover:text-white transition-colors">{skill.name}</span>
                            <span className="text-red-400 text-xs font-bold bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 group-hover:bg-red-500 group-hover:text-white transition-all cursor-help" title={`Appears in ${skill.count} jobs`}>
                                Missing
                            </span>
                        </div>
                    )) : (
                        <p className="text-emerald-400 font-bold text-sm flex items-center gap-2"><FiZap /> You possess all highly demanded skills!</p>
                    )}
                </div>
                {gaps.length > 0 && (
                    <button onClick={() => navigate('/roadmap')} className="mt-6 text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                        Build these skills in Learning Hub <FiArrowRight />
                    </button>
                )}
            </div>

        </div>
      </div>

      {/* 💼 TOP MATCHING JOBS */}
      <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-lg">
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><FiTarget className="text-indigo-400"/> Best Recommended Positions</h3>
          <button onClick={() => navigate('/jobs')} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors bg-indigo-500/10 px-4 py-2 rounded-lg">
            Explore All <FiArrowRight />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {topJobs.length > 0 ? topJobs.map((job, idx) => {
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
                    <FiZap /> {job.matchScore}%
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><FiMapPin className="text-slate-400"/> {job.city || 'Remote'}</span>
                  <span className="flex items-center gap-1"><FiDollarSign className="text-slate-400"/> {job.salary !== "Not Disclosed" ? job.salary : 'Confidential'}</span>
                </div>

                <div>
                  <div className="flex flex-wrap gap-2">
                    {parsedSkills.slice(0, 4).map((s, i) => (
                      <span key={i} className="bg-white/5 text-slate-300 px-2 py-1 rounded-md text-[11px] border border-white/10 font-medium tracking-wide">{s}</span>
                    ))}
                    {parsedSkills.length > 4 && <span className="text-[11px] text-slate-500 mt-1 font-bold">+{parsedSkills.length - 4}</span>}
                  </div>
                </div>
              </motion.div>
            )
          }) : (
            <div className="col-span-full text-center py-10 bg-[#0A0A0A] rounded-2xl border border-white/5 border-dashed">
              <p className="text-slate-500">No matching jobs found yet. Try updating your profile.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}