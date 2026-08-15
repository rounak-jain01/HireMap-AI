import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom'; 
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAppStore from '../store/useAppStore'; 
import { 
  FiSearch, FiFilter, FiMapPin, FiDollarSign, FiBriefcase, 
  FiClock, FiX, FiCheckCircle, FiStar, FiArrowRight, 
  FiExternalLink, FiAward, FiChevronLeft, FiChevronRight, FiMic
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2'; 
import ReactMarkdown from 'react-markdown';

// ─── Moved OUTSIDE component so it never changes reference ───────────────────
const parseJobData = (job) => {
  let parsedSkills = [];
  try {
    parsedSkills = typeof job.skills_required === 'string'
      ? JSON.parse(job.skills_required)
      : (job.skills_required || []);
    if (!Array.isArray(parsedSkills)) parsedSkills = [parsedSkills];
  } catch {
    parsedSkills = job.skills_required ? job.skills_required.split(',') : [];
  }

  let empType = "Full-Time";
  try {
    const metaObj = typeof job.job_meta === 'string'
      ? JSON.parse(job.job_meta)
      : (job.job_meta || {});
    if (metaObj.employment_type) empType = metaObj.employment_type.split(',')[0].trim();
  } catch {}

  const loc = job.city || "India";
  let workMode = "On-site";
  if (loc.toLowerCase().includes('remote')) workMode = "Remote";
  else if (loc.toLowerCase().includes('hybrid')) workMode = "Hybrid";

  const t = (job.job_title || "").toLowerCase();
  let domain = "Other";
  if (t.includes('engineer') || t.includes('developer') || t.includes('sde') || t.includes('programmer') || t.includes('backend') || t.includes('frontend') || t.includes('full stack')) domain = "Software Engineering";
  else if (t.includes('data') || t.includes('analyst') || t.includes('scientist') || t.includes('ml') || t.includes('ai') || t.includes('machine learning')) domain = "Data & AI";
  else if (t.includes('sales') || t.includes('business') || t.includes('bdo') || t.includes('account') || t.includes('executive')) domain = "Sales & Business";
  else if (t.includes('market') || t.includes('seo') || t.includes('growth') || t.includes('content')) domain = "Marketing";
  else if (t.includes('design') || t.includes('ui') || t.includes('ux') || t.includes('product')) domain = "Design & Product";
  else if (t.includes('hr') || t.includes('human resource') || t.includes('talent') || t.includes('recruiter')) domain = "HR & Recruiting";
  else if (t.includes('manager') || t.includes('management') || t.includes('lead')) domain = "Management";

  let parsedSalaryRaw = NaN;
  if (job.salary && job.salary !== "Not Disclosed") {
    const numMatch = job.salary.toString().match(/[\d.]+/);
    if (numMatch) parsedSalaryRaw = parseFloat(numMatch[0]);
  }

  let expRaw = -1;
  const expStr = (job.experience || "").toLowerCase();
  if (expStr.includes('fresher') || expStr.includes('entry') || expStr.includes('0') || expStr.includes('intern')) expRaw = 0;
  else {
    const expMatch = expStr.match(/\d+/);
    if (expMatch) expRaw = parseInt(expMatch[0]);
  }

  let dateParsed = new Date(0);
  const dateStr = (job.date_posted || "").toLowerCase();
  if (dateStr) {
    if (dateStr.includes('hour') || dateStr.includes('hr'))
      dateParsed = new Date(Date.now() - parseInt(dateStr.match(/\d+/)?.[0] || 1) * 3_600_000);
    else if (dateStr.includes('day') || dateStr.includes('d ago'))
      dateParsed = new Date(Date.now() - parseInt(dateStr.match(/\d+/)?.[0] || 1) * 86_400_000);
    else if (dateStr.includes('week') || dateStr.includes('wk'))
      dateParsed = new Date(Date.now() - parseInt(dateStr.match(/\d+/)?.[0] || 1) * 7 * 86_400_000);
    else if (dateStr.includes('month') || dateStr.includes('mo'))
      dateParsed = new Date(Date.now() - parseInt(dateStr.match(/\d+/)?.[0] || 1) * 30 * 86_400_000);
    else if (['just now', 'today', 'recently'].includes(dateStr))
      dateParsed = new Date();
    else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) dateParsed = parsed;
    }
  }

  return {
    id: job.id,
    title: job.job_title || "Role Not Specified",
    company: job.company_name || "Confidential",
    logo: (job.company_name || "H").charAt(0).toUpperCase(),
    location: loc,
    workMode,
    domain,
    type: empType,
    experience: job.experience || "Entry Level",
    expRaw,
    salary: job.salary !== "Not Disclosed" ? job.salary : "Salary not disclosed",
    salaryRaw: parsedSalaryRaw,
    postedAt: job.date_posted || "Recently",
    dateParsed,
    jobUrl: job.job_url || "#",
    matchScore: job.matchScore || 0,
    aboutRole: job.job_description || "No detailed description provided by the recruiter.",
    requirements: parsedSkills,
    aiReason: job.ai_recommendation_reason || null,
  };
};

// ─── Deduplicate by job id ────────────────────────────────────────────────────
const deduplicateById = (jobs) => {
  const seen = new Set();
  return jobs.filter((job) => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });
};

// ─── Constants outside component (stable references, no realloc on re-render) ─
const EXP_RANGES    = ["All", "Fresher (0 Years)", "1-3 Years", "4-7 Years", "8-12 Years", "12+ Years"];
const SALARY_RANGES = ["All", "0-5 LPA", "5-10 LPA", "10-20 LPA", "20-40 LPA", "40+ LPA"];
const DATE_RANGES   = ["All", "Past 24 Hours", "Past Week", "Past Month"];
const WORK_MODES    = ["All", "Remote", "Hybrid", "On-site"];
const JOBS_PER_PAGE = 8;
const MIN_MATCH_SCORE = 40;

export default function Jobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const {
    allJobs, setAllJobs,
    matchedJobs, setMatchedJobs,
    hasFetchedMatched, setHasFetchedMatched,
    isJobsLoading, setIsJobsLoading,
    searchTerm, setSearchTerm,
    isPersonalized, setIsPersonalized,
    filterType, setFilterType,
    filterExperience, setFilterExperience,
    filterWorkMode, setFilterWorkMode,
    filterDomain, setFilterDomain,
    filterSalary, setFilterSalary,
    filterDate, setFilterDate,
    quickFilter, setQuickFilter,
    showFilters, setShowFilters,
    currentPage, setCurrentPage,
    savedInterviews, addInterviewPrep,
  } = useAppStore();

  const [isMatchingUI, setIsMatchingUI] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [userTier, setUserTier] = useState('free');

  // ── Prevent double-fetch in StrictMode / concurrent renders ─────────────────
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // Already have data OR fetch already in-flight → skip
    if (allJobs.length > 0 || isFetchingRef.current) return;

    const fetchAllJobs = async () => {
      isFetchingRef.current = true;
      try {
        setIsJobsLoading(true);
        const res  = await fetch(`http://127.0.0.1:8000/get-all-jobs`);
        const data = await res.json();
        if (data.status === "success") {
          // Parse then deduplicate before storing
          const parsed = deduplicateById(data.jobs.map(parseJobData));
          setAllJobs(parsed);
        }
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setIsJobsLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchAllJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only run once on mount

  // ── Reset page whenever any filter changes ───────────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterExperience, filterWorkMode, filterDomain, filterSalary, filterDate, quickFilter, isPersonalized, setCurrentPage]);

  // ── Toggle personalised view ─────────────────────────────────────────────────
  const handleTogglePersonalized = useCallback(async () => {
    if (!isPersonalized) {
      setIsMatchingUI(true);
      if (!hasFetchedMatched && user?.email) {
        try {
          const res  = await fetch(`http://127.0.0.1:8000/match-jobs?email=${user.email}`);
          const data = await res.json();
          if (data.status === "success") {
            const parsed = deduplicateById(data.jobs.map(parseJobData));
            setMatchedJobs(parsed);
            if (data.tier) setUserTier(data.tier);
            setHasFetchedMatched(true);
          }
        } catch (error) {
          console.error("Match error:", error);
        }
      }
      setTimeout(() => {
        setIsPersonalized(true);
        setIsMatchingUI(false);
      }, 800);
    } else {
      setIsPersonalized(false);
    }
  }, [isPersonalized, hasFetchedMatched, user?.email, setMatchedJobs, setHasFetchedMatched, setIsPersonalized]);

  // ── Stable filter helpers ────────────────────────────────────────────────────
  const handleQuickFilter = useCallback(
    (type) => setQuickFilter(quickFilter === type ? 'None' : type),
    [quickFilter, setQuickFilter]
  );

  const clearAllFilters = useCallback(() => {
    setFilterType('All');
    setFilterExperience('All');
    setFilterWorkMode('All');
    setFilterDomain('All');
    setFilterSalary('All');
    setFilterDate('All');
    setQuickFilter('None');
    setSearchTerm('');
  }, [setFilterType, setFilterExperience, setFilterWorkMode, setFilterDomain, setFilterSalary, setFilterDate, setQuickFilter, setSearchTerm]);

  // ── Derived values (memoized) ────────────────────────────────────────────────
  const uniqueTypes   = useMemo(() => ["All", ...new Set(allJobs.map(j => j.type).filter(Boolean))],   [allJobs]);
  const uniqueDomains = useMemo(() => ["All", ...new Set(allJobs.map(j => j.domain).filter(Boolean))], [allJobs]);

  const isAnyFilterActive = useMemo(() =>
    filterType !== 'All' || filterExperience !== 'All' || filterWorkMode !== 'All' ||
    filterDomain !== 'All' || filterSalary !== 'All' || filterDate !== 'All' || quickFilter !== 'None',
    [filterType, filterExperience, filterWorkMode, filterDomain, filterSalary, filterDate, quickFilter]
  );

  // ── Main filtered + sorted list (memoized) ───────────────────────────────────
  const filteredJobs = useMemo(() => {
    const sourceJobs = isPersonalized ? matchedJobs : allJobs;
    const searchLower = searchTerm.toLowerCase();
    const now = Date.now();

    const result = sourceJobs.filter((job) => {
      if (searchTerm && !job.title.toLowerCase().includes(searchLower)) return false;
      if (isPersonalized && job.matchScore < MIN_MATCH_SCORE)           return false;
      if (filterType !== 'All'     && job.type    !== filterType)        return false;
      if (filterWorkMode !== 'All' && job.workMode !== filterWorkMode)   return false;
      if (filterDomain !== 'All'   && job.domain  !== filterDomain)      return false;

      if (filterExperience !== 'All') {
        const e = job.expRaw;
        if (e === -1) return false;
        if (filterExperience === 'Fresher (0 Years)' && e !== 0)          return false;
        if (filterExperience === '1-3 Years'  && !(e >= 1 && e <= 3))    return false;
        if (filterExperience === '4-7 Years'  && !(e >= 4 && e <= 7))    return false;
        if (filterExperience === '8-12 Years' && !(e >= 8 && e <= 12))   return false;
        if (filterExperience === '12+ Years'  && e <= 12)                 return false;
      }

      if (filterSalary !== 'All') {
        if (isNaN(job.salaryRaw)) return false;
        const s = job.salaryRaw;
        if (filterSalary === '0-5 LPA'   && !(s >= 0  && s <= 5))  return false;
        if (filterSalary === '5-10 LPA'  && !(s > 5   && s <= 10)) return false;
        if (filterSalary === '10-20 LPA' && !(s > 10  && s <= 20)) return false;
        if (filterSalary === '20-40 LPA' && !(s > 20  && s <= 40)) return false;
        if (filterSalary === '40+ LPA'   && s <= 40)                return false;
      }

      if (filterDate !== 'All') {
        const diffDays = Math.ceil(Math.abs(now - job.dateParsed) / 86_400_000);
        if (filterDate === 'Past 24 Hours' && diffDays > 1)  return false;
        if (filterDate === 'Past Week'     && diffDays > 7)  return false;
        if (filterDate === 'Past Month'    && diffDays > 30) return false;
      }

      if (quickFilter === 'Remote Only'       && job.workMode !== 'Remote') return false;
      if (quickFilter === 'Fresher Friendly'  && job.expRaw   !== 0)        return false;
      if (quickFilter === 'Top Match (>80%)' && job.matchScore < 80)        return false;

      return true;
    });

    // Sort: personalised → by match score desc; otherwise alphabetical
    result.sort((a, b) =>
      isPersonalized ? b.matchScore - a.matchScore : a.title.localeCompare(b.title)
    );

    return result;
  }, [
    isPersonalized, matchedJobs, allJobs, searchTerm,
    filterType, filterWorkMode, filterDomain, filterExperience,
    filterSalary, filterDate, quickFilter,
  ]);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const totalPages          = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const currentDisplayedJobs = useMemo(() =>
    filteredJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE),
    [filteredJobs, currentPage]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-transparent font-sans text-white p-6 md:p-10 relative">
      
      {/* HEADER & CONTROLS */}
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Explore Opportunities</h1>
        <p className="text-slate-400 mb-6">Real-time jobs pulled directly from our database.</p>

        <div className="bg-[#121214]/80 backdrop-blur-md rounded-2xl border border-white/5 shadow-lg transition-all">
          <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between relative z-10">
            {/* Search */}
            <div className="relative w-full md:w-[28rem]">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search specifically by Job Title..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-white/10 rounded-xl py-3 pl-12 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  <FiX size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              {/* Filter toggle */}
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-bold ${
                  showFilters || isAnyFilterActive
                    ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400'
                    : 'bg-[#0A0A0B] border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <FiFilter /> Filters {isAnyFilterActive && <span className="w-2 h-2 rounded-full bg-indigo-500 ml-1" />}
              </button>

              {/* Personalised toggle */}
              <label className="flex items-center gap-3 cursor-pointer bg-[#0A0A0B] border border-white/10 px-4 py-3 rounded-xl hover:border-indigo-500/50 transition-all relative overflow-hidden group">
                {isPersonalized && <div className="absolute inset-0 bg-indigo-500/10 opacity-50" />}
                <div className="relative z-10 flex items-center gap-3">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isPersonalized} onChange={handleTogglePersonalized} disabled={isMatchingUI} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isPersonalized || isMatchingUI ? 'bg-indigo-600' : 'bg-slate-700'}`} />
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isPersonalized || isMatchingUI ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm font-bold flex items-center gap-2 whitespace-nowrap">
                    <HiSparkles className={isPersonalized ? "text-amber-400" : "text-slate-400"} size={18} /> 
                    For You
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-[#0A0A0A]/50 border-t border-white/5 p-4 overflow-hidden"
              >
                {/* Quick filters */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Filters</h4>
                  <div className="flex flex-wrap gap-3">
                    {['Remote Only', 'Fresher Friendly', 'Top Match (>80%)'].map((qf) => {
                      if (qf === 'Top Match (>80%)' && !isPersonalized) return null;
                      return (
                        <button
                          key={qf}
                          onClick={() => handleQuickFilter(qf)}
                          className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                            quickFilter === qf
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)]'
                              : 'bg-[#121214] text-slate-400 border-white/10 hover:border-white/30'
                          }`}
                        >
                          {qf}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dropdown filters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end border-t border-white/5 pt-4">
                  {[
                    { label: "Date Posted",   value: filterDate,       setter: setFilterDate,       options: DATE_RANGES   },
                    { label: "Domain",        value: filterDomain,     setter: setFilterDomain,     options: uniqueDomains  },
                    { label: "Job Type",      value: filterType,       setter: setFilterType,       options: uniqueTypes    },
                    { label: "Experience",    value: filterExperience, setter: setFilterExperience, options: EXP_RANGES     },
                    { label: "Salary Range",  value: filterSalary,     setter: setFilterSalary,     options: SALARY_RANGES  },
                    { label: "Work Mode",     value: filterWorkMode,   setter: setFilterWorkMode,   options: WORK_MODES     },
                  ].map(({ label, value, setter, options }) => (
                    <div key={label} className="flex flex-col gap-1 w-full">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
                      <select
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="bg-[#121214] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
                      >
                        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  ))}

                  {isAnyFilterActive && (
                    <div className="col-span-full mt-2 flex justify-end">
                      <button
                        onClick={clearAllFilters}
                        className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex items-center justify-center gap-1 py-2.5 px-6 bg-red-500/10 rounded-xl"
                      >
                        <FiX size={16} /> Clear All Filters
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-7xl mx-auto">

        {!isJobsLoading && !isMatchingUI && (
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-white/5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {isPersonalized
                ? <><HiSparkles className="text-amber-400" /> Recommended for you</>
                : "All Available Positions"
              }
            </h3>
            <span className="text-sm font-medium text-slate-400 bg-[#121214] px-3 py-1 rounded-full border border-white/5">
              Showing <span className="text-white">{filteredJobs.length}</span> of{' '}
              <span className="text-white">{isPersonalized ? matchedJobs.length : allJobs.length}</span> jobs
            </span>
          </div>
        )}

        {isJobsLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-16 h-16 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium animate-pulse">Fetching Database Entries...</p>
          </div>
        ) : isMatchingUI ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-indigo-900 rounded-full" />
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
              <HiSparkles className="absolute inset-0 m-auto text-indigo-400 text-3xl animate-pulse" />
            </div>
            <p className="text-indigo-300 font-bold text-lg animate-pulse">HireMap 3.1 is reading your resume...</p>
            <p className="text-slate-500 text-sm mt-2">Finding the perfect role for you</p>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {currentDisplayedJobs.map((job) => {
                  const isSaved = savedInterviews.some(s => s.id === job.id);
                  return (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[#121214] border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group flex flex-col h-full relative overflow-hidden"
                    >
                      {job.workMode === 'Remote' && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 to-transparent" />
                      )}

                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-xl text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                            {job.logo}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{job.title}</h3>
                            <p className="text-slate-400 font-medium text-sm line-clamp-1">{job.company}</p>
                          </div>
                        </div>
                        {isPersonalized && (
                          <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shrink-0 ${
                            job.matchScore >= 80
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                              : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                          }`}>
                            <FiStar /> {job.matchScore}% Match
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6">
                        <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg text-xs font-bold">{job.domain}</span>
                        <span className="bg-[#0A0A0A] border border-white/5 text-slate-300 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5">
                          <FiMapPin className={job.workMode === 'Remote' ? 'text-emerald-400' : 'text-slate-500'} /> {job.location}
                        </span>
                        <span className="bg-[#0A0A0A] border border-white/5 text-slate-300 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5">
                          <FiAward className="text-slate-500" /> {job.experience}
                        </span>
                      </div>

                      {isPersonalized && job.aiReason && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1 mb-2">
                            <HiSparkles size={14} /> Why you're a match
                          </span>
                          <p className="text-sm text-indigo-100/80 leading-relaxed italic">"{job.aiReason}"</p>
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                        <span className="text-xs text-slate-500 flex items-center gap-1"><FiClock /> {job.postedAt}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); addInterviewPrep(job); }}
                            disabled={isSaved}
                            className={`text-sm font-bold flex items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                              isSaved
                                ? 'bg-emerald-500/10 text-emerald-400 cursor-not-allowed border border-emerald-500/20'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-transparent'
                            }`}
                          >
                            {isSaved ? <><FiCheckCircle /> Added</> : <><FiMic /> Prep</>}
                          </button>
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="text-sm font-bold text-indigo-400 hover:text-white flex items-center gap-1 bg-indigo-500/10 px-4 py-2 rounded-lg hover:bg-indigo-600 transition-all"
                          >
                            Details <FiArrowRight />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredJobs.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-500 bg-[#121214] border border-white/5 rounded-3xl">
                  <FiFilter size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-xl font-bold text-white mb-2">No jobs found</p>
                  <p className="text-slate-400">Try clearing some filters or adjusting your search terms.</p>
                  {isAnyFilterActive && (
                    <button onClick={clearAllFilters} className="mt-6 bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-lg font-bold transition-all">
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Paywall banner */}
            {isPersonalized && userTier === 'free' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-10 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="relative z-10">
                  <h4 className="text-xl font-black text-white flex items-center gap-2 mb-2">
                    <HiSparkles className="text-amber-400" /> Unlock Unlimited Matches
                  </h4>
                  <p className="text-indigo-200/80 font-medium text-sm md:text-base max-w-xl">
                    You are on the <span className="text-white font-bold">Learner Plan</span>, showing your top 3 AI matches.
                    Upgrade to Pro to see all highly relevant roles perfectly suited for your profile.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-black transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] whitespace-nowrap relative z-10"
                >
                  Upgrade to Pro <FiArrowRight className="inline ml-1" />
                </button>
              </motion.div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12 mb-4">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-3 bg-[#121214] border border-white/10 rounded-xl text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <FiChevronLeft size={20} />
                </button>
                <span className="text-sm font-bold text-slate-400 bg-[#121214] border border-white/5 px-6 py-2.5 rounded-xl">
                  Page <span className="text-white">{currentPage}</span> of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-3 bg-[#121214] border border-white/10 rounded-xl text-slate-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <FiChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* DETAIL MODAL (via Portal) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedJob && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSelectedJob(null)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999]"
              />
              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                className="fixed top-[5%] left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl h-[90vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl md:rounded-3xl z-[1000] overflow-hidden flex flex-col shadow-2xl"
              >
                {/* Modal header */}
                <div className="flex justify-between items-start p-6 md:p-8 bg-[#121214] border-b border-white/5 relative overflow-hidden">
                  {selectedJob.workMode === 'Remote' && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}
                  <div className="flex gap-5 items-center z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 flex items-center justify-center font-black text-3xl text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.2)] shrink-0">
                      {selectedJob.logo}
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-1">{selectedJob.title}</h2>
                      <p className="text-slate-400 text-lg font-medium">{selectedJob.company}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedJob(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10">
                    <FiX size={24} />
                  </button>
                </div>

                {/* Modal body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  {isPersonalized && selectedJob.aiReason && (
                    <div className="mb-8 p-5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]">
                      <span className="text-sm font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2 mb-2">
                        <HiSparkles size={18} /> AI Match Analysis
                      </span>
                      <p className="text-base text-indigo-100/90 leading-relaxed italic">"{selectedJob.aiReason}"</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: "Location", value: selectedJob.location, icon: <FiMapPin className={selectedJob.workMode === 'Remote' ? 'text-emerald-400 shrink-0' : 'text-indigo-400 shrink-0'} /> },
                      { label: "Experience", value: selectedJob.experience, icon: <FiAward className="text-yellow-500 shrink-0" /> },
                      { label: "Salary", value: selectedJob.salary, icon: <FiDollarSign className="text-emerald-400 shrink-0" /> },
                      { label: "Job Type", value: selectedJob.type, icon: <FiBriefcase className="text-orange-400 shrink-0" /> },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                        <span className="text-xs text-slate-500 uppercase font-bold">{label}</span>
                        <span className="font-bold flex items-center gap-2">{icon}<span className="truncate">{value}</span></span>
                      </div>
                    ))}
                  </div>

                  {selectedJob.requirements.length > 0 && (
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.requirements.map((skill, i) => (
                          <span key={i} className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-md text-xs font-bold">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-2">About the Role</h4>
                    <ReactMarkdown
                      components={{
                        h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-white mt-6 mb-3 border-l-4 border-indigo-500 pl-3" {...props} />,
                        h4: ({ node, ...props }) => <h4 className="text-base font-bold text-white mt-4 mb-2" {...props} />,
                        p:  ({ node, ...props }) => <p className="text-slate-300 leading-relaxed mb-4" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-none mb-4 space-y-2" {...props} />,
                        li: ({ node, ...props }) => (
                          <li className="flex items-start gap-2 text-slate-300">
                            <span className="text-indigo-500 mt-1">✦</span>
                            <span>{props.children}</span>
                          </li>
                        ),
                        strong: ({ node, ...props }) => <strong className="font-bold text-indigo-300" {...props} />,
                      }}
                    >
                      {selectedJob.aboutRole}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="bg-[#121214] border-t border-white/5 p-6 flex flex-col md:flex-row items-center justify-between shrink-0 gap-4">
                  <span className="text-sm text-slate-500 font-medium hidden md:flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Actively Hiring
                  </span>
                  <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => addInterviewPrep(selectedJob)}
                      disabled={savedInterviews.some(s => s.id === selectedJob.id)}
                      className="w-full md:w-auto px-6 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 bg-[#121214] border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savedInterviews.some(s => s.id === selectedJob.id)
                        ? <><FiCheckCircle className="text-emerald-400" /> Added to Prep</>
                        : <><FiMic /> Practice Interview</>
                      }
                    </button>
                    <a
                      href={selectedJob.jobUrl !== "#" ? selectedJob.jobUrl : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (selectedJob.jobUrl === "#") { e.preventDefault(); alert("Apply link is not available for this job."); } }}
                      className={`w-full md:w-auto px-8 py-3.5 rounded-xl font-black transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2 ${
                        selectedJob.jobUrl !== "#"
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
                      }`}
                    >
                      Apply Now <FiExternalLink />
                    </a>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}