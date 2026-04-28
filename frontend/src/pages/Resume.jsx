import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  FiTarget, FiZap, FiAlertCircle, FiCheckCircle, 
  FiBookOpen, FiCode, FiTrendingUp, FiYoutube, 
  FiExternalLink, FiBriefcase, FiClock, FiPlus, FiLoader, FiUploadCloud, FiFileText
} from 'react-icons/fi';

export default function Roadmap() {
  const { user } = useAuth();
  
  // Base States
  const [targetRole, setTargetRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  
  // Roadmap States
  const [savedSkills, setSavedSkills] = useState([]);
  const [savingSkill, setSavingSkill] = useState(null);

  // 🚀 New States for Resume Upload
  const fileInputRef = useRef(null);
  const [profileData, setProfileData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // 1. Fetch current profile silently on load (needed to safely update DB without losing other data)
  useEffect(() => {
    if (user?.email) {
      fetch(`http://127.0.0.1:8000/get-profile?email=${user.email}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setProfileData(data.data);
            if (data.data.target_role) setTargetRole(data.data.target_role);
          }
        })
        .catch(err => console.error("Profile fetch error:", err));
    }
  }, [user]);

  // 2. 🛠️ The Smart Resume Upload Function
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF document.');
      return;
    }

    setIsUploading(true);
    setUploadMsg('');
    setError('');
    setAnalysis(null);

    try {
      // Step A: Read and Parse new PDF via AI
      const formData = new FormData();
      formData.append('file', file);
      formData.append('email', user?.email);

      const parseRes = await fetch('http://127.0.0.1:8000/register-seeker', {
        method: 'POST',
        body: formData
      });
      const parseData = await parseRes.json();

      if (parseData.status !== 'Success') throw new Error('AI failed to parse the resume.');

      // Step B: Save new data securely to Supabase
      const updatePayload = {
        email: user?.email,
        full_name: profileData?.full_name || 'User',
        skills: parseData.extracted_skills,
        target_role: profileData?.target_role || 'Software Engineer',
        min_salary: profileData?.min_expected_salary || 0,
        locations: profileData?.preferred_locations || [],
        resume_text: parseData.resume_text
      };

      const saveRes = await fetch('http://127.0.0.1:8000/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      const saveData = await saveRes.json();
      if (saveData.status === 'success') {
        setUploadMsg('Resume updated! AI has extracted your new skills. 🚀');
        setTimeout(() => setUploadMsg(''), 5000);
      } else {
        throw new Error('Failed to save to database');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process the new resume.');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input so user can upload same file again if needed
    }
  };

  // 3. The Core Analysis Function
  const handleAnalyze = async () => {
    if (!targetRole.trim()) return alert("Please enter a target role first!");
    
    setIsLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const res = await fetch(`http://127.0.0.1:8000/analyze-career?email=${user?.email}&target_domain=${targetRole}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.analysis) {
        setAnalysis(data.analysis);
      } else {
        setError("Something went wrong with the AI Engine.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  // The Roadmap Save Function
  const handleSaveToRoadmap = async (skillName) => {
    if (savedSkills.includes(skillName) || savingSkill === skillName) return;
    setSavingSkill(skillName); 

    try {
      const res = await fetch('http://127.0.0.1:8000/add-to-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, skill_name: skillName })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setSavedSkills(prev => [...prev, skillName]);
      } else {
        alert(data.error || "Failed to save skill to roadmap.");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Network error while saving.");
    } finally {
      setSavingSkill(null); 
    }
  };

  const getTierColor = (tier) => {
    const t = tier?.toLowerCase() || '';
    if (t.includes('interview')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (t.includes('intermediate')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (t.includes('beginner')) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
      
      {/* 🚀 HIDDEN FILE INPUT */}
      <input 
        type="file" 
        accept=".pdf" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* HEADER SECTION */}
      <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
            <FiTarget className="text-indigo-500" /> AI Resume Analyzer
          </h1>
          <p className="text-slate-400">Discover your skill gaps and get a personalized path to your dream job.</p>
        </div>

        {/* 🚀 FIXED ACTION CONTROLS (Perfect Alignment) */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          
          {/* Upload Resume Button */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isLoading}
            className="flex items-center justify-center gap-2 px-6 h-13 rounded-2xl font-bold bg-[#121214] border border-white/10 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-50 whitespace-nowrap shrink-0 w-full sm:w-auto"
          >
            {isUploading ? <FiLoader className="animate-spin text-indigo-400 text-lg" /> : <FiUploadCloud className="text-indigo-400 text-lg" />}
            {isUploading ? 'Updating...' : 'Upload Resume'}
          </button>

          {/* Analyze Input & Button */}
          <div className="flex items-center w-full sm:w-auto bg-[#121214] border border-white/10 p-1 rounded-2xl shadow-lg focus-within:border-indigo-500/50 transition-all h-13">
            <input 
              type="text" 
              placeholder="Target Role (e.g. SDE)" 
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              className="bg-transparent text-white px-4 h-full w-full sm:w-48 focus:outline-none placeholder-slate-600"
            />
            <button 
              onClick={handleAnalyze}
              disabled={isLoading || isUploading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 h-full rounded-xl font-bold transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
            >
              {isLoading ? <FiZap className="animate-pulse" /> : <FiZap />} 
              Analyze
            </button>
          </div>
        </div>
      </div>

      {/* MESSAGES (Errors & Success) */}
      <AnimatePresence>
        {uploadMsg && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
              <FiCheckCircle size={20} /> {uploadMsg}
            </div>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8">
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
              <FiAlertCircle size={20} /> {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOADING STATE */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-indigo-900 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            <FiFileText className="absolute inset-0 m-auto text-indigo-400 text-2xl animate-pulse" />
          </div>
          <p className="text-indigo-300 font-medium animate-pulse">Llama 3.1 is auditing your resume...</p>
        </div>
      )}

      {/* RESULTS DASHBOARD */}
      <AnimatePresence>
        {analysis && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
            className="space-y-8"
          >
            {/* TOP ROW: SCORE & TIER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-linear-to-br from-[#121214] to-indigo-900/10 border border-indigo-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full"></div>
                <h3 className="text-slate-400 font-bold mb-4 uppercase tracking-wider text-sm">Match Confidence</h3>
                <div className="text-6xl font-black text-white flex items-baseline gap-1">
                  {analysis.match_confidence_score}<span className="text-2xl text-indigo-400">%</span>
                </div>
              </div>

              <div className="md:col-span-2 bg-[#121214] border border-white/5 p-8 rounded-3xl flex flex-col justify-center">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-2">Current Readiness</h3>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-black border ${getTierColor(analysis.readiness_tier)}`}>
                      <FiTrendingUp /> {analysis.readiness_tier}
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-2">Est. Prep Time</h3>
                    <div className="text-xl font-bold text-white flex items-center gap-2">
                      <FiClock className="text-indigo-400"/> {analysis.estimated_preparation_time}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-slate-300 italic flex gap-3">
                  <FiAlertCircle className="shrink-0 text-amber-400 mt-1" />
                  <p>"{analysis.expert_advice}"</p>
                </div>
              </div>
            </div>

            {/* SECOND ROW: SKILL GAPS & RESOURCES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Skill Gaps with Save Buttons */}
              <div className="bg-[#121214] border border-white/5 p-6 md:p-8 rounded-3xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FiAlertCircle className="text-red-400"/> Critical Skill Gaps
                </h3>
                <div className="space-y-4">
                  {analysis.skill_gap_analysis?.map((gap, i) => (
                    <div key={i} className="p-4 bg-[#0A0A0A] border border-white/5 rounded-2xl border-l-4 border-l-red-500">
                      <div className="flex justify-between items-start mb-2">
                        
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-white">{gap.skill}</h4>
                          
                          {/* 🪄 The Animated Save Button */}
                          <button
                            onClick={() => handleSaveToRoadmap(gap.skill)}
                            disabled={savedSkills.includes(gap.skill) || savingSkill === gap.skill}
                            title={savedSkills.includes(gap.skill) ? "Saved to Roadmap" : "Add to Roadmap"}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                              savedSkills.includes(gap.skill) 
                                ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white'
                            }`}
                          >
                            <AnimatePresence mode="wait">
                              {savingSkill === gap.skill ? (
                                <motion.div key="loading" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5 }}>
                                  <FiLoader className="animate-spin" />
                                </motion.div>
                              ) : savedSkills.includes(gap.skill) ? (
                                <motion.div key="saved" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                                  <FiCheckCircle />
                                </motion.div>
                              ) : (
                                <motion.div key="add" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                                  <FiPlus />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>
                        </div>

                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                          gap.importance === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {gap.importance} Priority
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{gap.reason}</p>
                    </div>
                  ))}
                  {analysis.skill_gap_analysis?.length === 0 && (
                    <p className="text-emerald-400 flex items-center gap-2"><FiCheckCircle /> You have all the required skills!</p>
                  )}
                </div>
              </div>

              {/* Learning Resources */}
              <div className="bg-[#121214] border border-white/5 p-6 md:p-8 rounded-3xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FiBookOpen className="text-blue-400"/> Learning Blueprint
                </h3>
                <div className="space-y-4">
                  {analysis.learning_resources?.map((res, i) => (
                    <div key={i} className="p-4 bg-[#0A0A0A] border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="font-bold text-white text-lg">{res.skill}</h4>
                        
                        {/* 🪄 Same Animated Save Button here for consistency */}
                        <button
                            onClick={() => handleSaveToRoadmap(res.skill)}
                            disabled={savedSkills.includes(res.skill) || savingSkill === res.skill}
                            title={savedSkills.includes(res.skill) ? "Saved to Roadmap" : "Add to Roadmap"}
                            className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                              savedSkills.includes(res.skill) 
                                ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white'
                            }`}
                          >
                            <AnimatePresence mode="wait">
                              {savingSkill === res.skill ? (
                                <motion.div key="loading" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5 }}>
                                  <FiLoader className="animate-spin" />
                                </motion.div>
                              ) : savedSkills.includes(res.skill) ? (
                                <motion.div key="saved" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                                  <FiCheckCircle />
                                </motion.div>
                              ) : (
                                <motion.div key="add" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                                  <FiPlus />
                                </motion.div>
                              )}
                            </AnimatePresence>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {res.top_youtube_creators?.map((creator, idx) => (
                          <span key={idx} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded flex items-center gap-1">
                            <FiYoutube /> {creator}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-4">
                        <a href={res.youtube_link} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
                          YouTube Search <FiExternalLink />
                        </a>
                        <a href={res.coursera_link} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
                          Coursera <FiExternalLink />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* THIRD ROW: PROJECTS & ALTERNATIVES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#121214] border border-white/5 p-6 md:p-8 rounded-3xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FiCode className="text-emerald-400"/> Recommended Projects to Build
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {analysis.recommended_projects?.map((proj, i) => (
                    <div key={i} className="p-5 bg-linear-to-br from-[#0A0A0A] to-emerald-900/5 border border-white/5 hover:border-emerald-500/30 transition-colors rounded-2xl">
                      <h4 className="font-bold text-emerald-300 mb-2">{proj.title}</h4>
                      <p className="text-sm text-slate-400">{proj.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pivot / Alternative Roles */}
              <div className="bg-linear-to-b from-[#121214] to-purple-900/10 border border-white/5 p-6 md:p-8 rounded-3xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <FiBriefcase className="text-purple-400"/> Best Pivot Roles
                </h3>
                <p className="text-sm text-slate-400 mb-4">Based on your current resume, you could easily pivot to:</p>
                <div className="flex flex-col gap-3">
                  {analysis.alternative_roles?.map((roleItem, i) => {
                    // 🚀 THE FIX: Handle both string and object formats safely
                    let roleName = "";
                    
                    if (typeof roleItem === 'string') {
                        roleName = roleItem;
                    } else if (typeof roleItem === 'object' && roleItem !== null) {
                        // Agar AI ne object bheja (e.g. {role: "Data Scientist", description: "..."})
                        roleName = roleItem.role || roleItem.title || roleItem.name || "Alternative Role";
                    }

                    if (!roleName) return null; // Safety check

                    return (
                    <button 
                      key={i}
                      onClick={() => setTargetRole(roleName)}
                      className="text-left w-full p-3 bg-[#0A0A0A] border border-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-500/10 transition-colors text-sm font-bold flex justify-between items-center group"
                    >
                      <span>{roleName}</span> 
                      <FiTarget className="text-purple-500/50 group-hover:text-purple-400 transition-colors" />
                    </button>
                  )})}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}