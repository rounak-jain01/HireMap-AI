import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  FiSearch, FiFilter, FiMapPin, FiDollarSign, FiBriefcase, 
  FiClock, FiZap, FiX, FiCheckCircle, FiStar, FiArrowRight, FiExternalLink, FiAward
} from 'react-icons/fi';

export default function Jobs() {
  const { user } = useAuth();
  const [jobsDB, setJobsDB] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [isMatchingUI, setIsMatchingUI] = useState(false); 
  const [selectedJob, setSelectedJob] = useState(null); 

  // 🚀 Fetch Real Jobs from DB
  useEffect(() => {
    const fetchJobsFromDB = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/match-jobs?email=${user?.email}`);
        const data = await res.json();
        
        if (data.status === "success") {
          const formattedJobs = data.jobs.map(job => {
            
            let parsedSkills = [];
            try {
              parsedSkills = typeof job.skills_required === 'string' ? JSON.parse(job.skills_required) : (job.skills_required || []);
              if (!Array.isArray(parsedSkills)) parsedSkills = [parsedSkills];
            } catch (e) {
              parsedSkills = job.skills_required ? job.skills_required.split(',') : [];
            }

            let empType = "Full-Time";
            try {
              const metaObj = typeof job.job_meta === 'string' ? JSON.parse(job.job_meta) : (job.job_meta || {});
              if (metaObj.employment_type) empType = metaObj.employment_type.split(',')[0]; 
            } catch (e) {}

            return {
              id: job.id,
              title: job.job_title || "Role Not Specified",
              company: job.company_name || "Confidential",
              logo: (job.company_name || "H").charAt(0).toUpperCase(),
              location: job.city || "India",
              type: empType,
              experience: job.experience || "Entry Level",
              salary: job.salary !== "Not Disclosed" ? job.salary : "Salary not disclosed",
              postedAt: job.date_posted || "Recently Posted",
              jobUrl: job.job_url || "#", 
              matchScore: job.matchScore || 0,
              aboutRole: job.job_description || "No detailed description provided by the recruiter.",
              requirements: parsedSkills,
            };
          });
          
          setJobsDB(formattedJobs);
        }
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.email) {
      fetchJobsFromDB();
    }
  }, [user]);

  const handleTogglePersonalized = () => {
    if (!isPersonalized) {
      setIsMatchingUI(true);
      setTimeout(() => {
        setIsPersonalized(true);
        setIsMatchingUI(false);
      }, 1200); 
    } else {
      setIsPersonalized(false);
    }
  };

  // 🎯 THE FIX: Smart Universal Search & Filter Logic
  const MIN_MATCH_SCORE = 50;

  const filteredJobs = jobsDB.filter(job => {
    const searchLower = searchTerm.toLowerCase();
    
    // Ab search Title, Company, Location, AND Skills mein bhi dhoondega!
    const matchesSearch = 
      job.title.toLowerCase().includes(searchLower) || 
      job.company.toLowerCase().includes(searchLower) ||
      job.location.toLowerCase().includes(searchLower) ||
      job.requirements.some(skill => skill.toLowerCase().includes(searchLower));
    
    const matchesPersonalized = isPersonalized ? job.matchScore >= MIN_MATCH_SCORE : true; 
    
    return matchesSearch && matchesPersonalized;
  });

  if (isPersonalized) {
    filteredJobs.sort((a, b) => b.matchScore - a.matchScore);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-white p-6 md:p-10 relative">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-2">Explore Opportunities</h1>
        <p className="text-slate-400 mb-8">Jobs pulled directly from our real-time database.</p>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#121214] p-4 rounded-2xl border border-white/5 shadow-lg">
          
          {/* 🚀 UPGRADED SEARCH BAR */}
          <div className="relative w-full md:w-[28rem]">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search role, company, location, or skill..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl py-3 pl-12 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            {/* Clear Button */}
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <label className="flex items-center gap-3 cursor-pointer bg-[#0A0A0A] border border-white/10 px-4 py-3 rounded-xl hover:border-indigo-500/50 transition-all">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={isPersonalized} 
                  onChange={handleTogglePersonalized} 
                  disabled={isMatchingUI}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${isPersonalized || isMatchingUI ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isPersonalized || isMatchingUI ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="text-sm font-bold flex items-center gap-2">
                <FiZap className={isPersonalized ? "text-amber-400" : "text-slate-400"} /> 
                For You
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-16 h-16 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-medium animate-pulse">Fetching Database Entries...</p>
          </div>
        ) : isMatchingUI ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-400 font-black text-xs">AI</div>
            </div>
            <p className="text-indigo-300 font-bold text-lg animate-pulse">Aligning Vectors with your Profile...</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredJobs.map((job) => (
                <motion.div 
                  key={job.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-[#121214] border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-xl text-indigo-400 shrink-0">
                        {job.logo}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{job.title}</h3>
                        <p className="text-slate-400 font-medium text-sm line-clamp-1">{job.company}</p>
                      </div>
                    </div>
                    {isPersonalized && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shrink-0">
                        <FiStar /> {job.matchScore}% Match
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mb-6">
                    <span className="bg-[#0A0A0A] border border-white/5 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"><FiMapPin className="text-slate-500 shrink-0"/> <span className="truncate max-w-[150px]">{job.location}</span></span>
                    <span className="bg-[#0A0A0A] border border-white/5 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"><FiAward className="text-slate-500 shrink-0"/> {job.experience}</span>
                    <span className="bg-[#0A0A0A] border border-white/5 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"><FiDollarSign className="text-slate-500 shrink-0"/> <span className="truncate max-w-[120px]">{job.salary}</span></span>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><FiClock /> {job.postedAt}</span>
                    <button onClick={() => setSelectedJob(job)} className="text-sm font-bold text-indigo-400 hover:text-white flex items-center gap-1 bg-indigo-500/10 px-4 py-2 rounded-lg hover:bg-indigo-600 transition-all">
                      View Details <FiArrowRight />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredJobs.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-500">
                <FiSearch size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-xl font-bold text-white mb-2">No jobs matched your query</p>
                <p>Try adjusting your search terms or turning off the "For You" toggle.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAILED VIEW (THE SMART MODAL) */}
      <AnimatePresence>
        {selectedJob && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedJob(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, y: 100, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 100, scale: 0.95 }} className="fixed top-[5%] left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl h-[90vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl md:rounded-3xl z-50 overflow-hidden flex flex-col shadow-2xl">
              
              <div className="flex justify-between items-start p-6 md:p-8 bg-[#121214] border-b border-white/5">
                <div className="flex gap-5 items-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 flex items-center justify-center font-black text-3xl text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.2)] shrink-0">
                    {selectedJob.logo}
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{selectedJob.title}</h2>
                    <p className="text-slate-400 text-lg font-medium">{selectedJob.company}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedJob(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><FiX size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                    <span className="text-xs text-slate-500 uppercase font-bold">Location</span>
                    <span className="font-bold flex items-center gap-2"><FiMapPin className="text-indigo-400 shrink-0"/> <span className="truncate">{selectedJob.location}</span></span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                    <span className="text-xs text-slate-500 uppercase font-bold">Experience</span>
                    <span className="font-bold flex items-center gap-2"><FiAward className="text-yellow-500 shrink-0"/> {selectedJob.experience}</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                    <span className="text-xs text-slate-500 uppercase font-bold">Salary</span>
                    <span className="font-bold flex items-center gap-2"><FiDollarSign className="text-emerald-400 shrink-0"/> <span className="truncate">{selectedJob.salary}</span></span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                    <span className="text-xs text-slate-500 uppercase font-bold">Job Type</span>
                    <span className="font-bold flex items-center gap-2"><FiBriefcase className="text-orange-400 shrink-0"/> <span className="truncate">{selectedJob.type}</span></span>
                  </div>
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

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-bold mb-4 text-white border-b border-white/10 pb-2">About the Role</h4>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedJob.aboutRole}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#121214] border-t border-white/5 p-6 flex items-center justify-between shrink-0">
                <span className="text-sm text-slate-500 font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Actively Hiring
                </span>
                
                <a 
                  href={selectedJob.jobUrl !== "#" ? selectedJob.jobUrl : null} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`px-8 md:px-10 py-3 md:py-3.5 rounded-xl font-black transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center gap-2 ${
                    selectedJob.jobUrl !== "#" 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer" 
                      : "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
                  }`}
                  onClick={(e) => {
                    if (selectedJob.jobUrl === "#") {
                      e.preventDefault();
                      alert("Apply link is not available for this job.");
                    }
                  }}
                >
                  Apply Now <FiExternalLink />
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}