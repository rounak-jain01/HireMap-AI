import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 🚀 1. Portal Import
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext'; 
import { 
  FiTrendingUp, FiCpu, FiShield, FiCloud, FiHexagon, 
  FiMonitor, FiX, FiExternalLink, FiPlayCircle, FiBookOpen, FiArrowRight, FiDatabase, FiCode,
  FiPlus, FiLoader, FiCheckCircle 
} from 'react-icons/fi';

const iconMap = {
  FiCpu: <FiCpu />,
  FiCloud: <FiCloud />,
  FiShield: <FiShield />,
  FiHexagon: <FiHexagon />,
  FiMonitor: <FiMonitor />,
  FiDatabase: <FiDatabase />,
  FiCode: <FiCode />
};

export default function Trends() {
  const { user } = useAuth(); 
  const [trends, setTrends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState(null);

  const [savedSkills, setSavedSkills] = useState([]);
  const [savingSkill, setSavingSkill] = useState(null);

  useEffect(() => {
    const fetchLiveTrends = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/market-trends");
        const json = await res.json();
        
        if (json.status === "success" && json.data) {
          setTrends(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch live trends:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveTrends();
  }, []);

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
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSavingSkill(null); 
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] w-full">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-4 border-indigo-900 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
          <FiTrendingUp className="absolute inset-0 m-auto text-indigo-400 text-2xl animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Analyzing Global Market...</h2>
        <p className="text-indigo-400 font-medium animate-pulse">HireMap 3.1 is predicting future career trends</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
      
      {/* HEADER */}
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
          <FiTrendingUp className="text-indigo-500" /> Live Market Predictor
        </h1>
        <p className="text-slate-400">AI-generated real-time predictions of what's booming today and what will dominate tomorrow.</p>
      </div>

      {/* BOOMING NOW */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
          🔥 Booming Right Now
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trends.filter(t => t.category === "Booming Now").map((domain) => (
            <motion.div 
              key={domain.id} whileHover={{ y: -5 }} onClick={() => setSelectedDomain(domain)}
              className="bg-[#121214] border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 cursor-pointer group transition-all shadow-lg flex flex-col h-full"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${domain.color} flex items-center justify-center text-white text-2xl mb-6 shadow-lg`}>
                {iconMap[domain.icon_name] || <FiCpu />}
              </div>
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{domain.title}</h3>
              <p className="text-sm text-slate-400 mb-6 line-clamp-3">{domain.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">{domain.growth}</span>
                <span className="text-indigo-500 group-hover:translate-x-2 transition-transform"><FiArrowRight /></span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FUTURE TECH */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
          🚀 The Next Big Thing (3-5 Years)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trends.filter(t => t.category === "Future Tech").map((domain) => (
            <motion.div 
              key={domain.id} whileHover={{ y: -5 }} onClick={() => setSelectedDomain(domain)}
              className="bg-gradient-to-r from-[#121214] to-[#1a1a24] border border-white/5 hover:border-fuchsia-500/30 rounded-3xl p-6 cursor-pointer group transition-all"
            >
              <div className="flex gap-6 items-start">
                <div className={`w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br ${domain.color} flex items-center justify-center text-white text-3xl shadow-[0_0_20px_rgba(217,70,239,0.2)]`}>
                  {iconMap[domain.icon_name] || <FiHexagon />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-fuchsia-400 transition-colors">{domain.title}</h3>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2">{domain.description}</p>
                  <span className="text-xs font-bold text-fuchsia-400 bg-fuchsia-500/10 px-3 py-1 rounded-full">{domain.growth}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 🚀 2. MODAL PORTAL (Fixed Z-Index Trap) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedDomain && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                onClick={() => setSelectedDomain(null)} 
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999]" 
              />
              
              <motion.div 
                initial={{ opacity: 0, y: 100, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 100, scale: 0.95 }} 
                className="fixed top-[5%] left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl h-[90vh] md:h-auto md:max-h-[85vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl md:rounded-3xl z-[1000] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className={`p-8 bg-gradient-to-br ${selectedDomain.color} relative overflow-hidden shrink-0`}>
                  <div className="absolute top-0 right-0 p-4 z-10">
                    <button onClick={() => setSelectedDomain(null)} className="bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-md transition-all"><FiX size={24}/></button>
                  </div>
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="text-5xl text-white/90 drop-shadow-md">{iconMap[selectedDomain.icon_name] || <FiCpu />}</div>
                    <div>
                      <span className="bg-black/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full mb-2 inline-block uppercase tracking-wider">{selectedDomain.category}</span>
                      <h2 className="text-3xl font-black text-white">{selectedDomain.title}</h2>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <p className="text-slate-300 text-lg mb-8 leading-relaxed">{selectedDomain.description}</p>

                  <div className="mb-10">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><FiTrendingUp /> Skills you must master</h3>
                    <div className="flex flex-wrap gap-3">
                      {selectedDomain.skills?.map((skill, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-[#121214] border border-white/5 px-3 py-2 rounded-xl shadow-sm">
                          <span className="text-white text-sm font-bold">{skill}</span>
                          <button
                              onClick={() => handleSaveToRoadmap(skill)}
                              disabled={savedSkills.includes(skill) || savingSkill === skill}
                              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                                savedSkills.includes(skill) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white'
                              }`}
                            >
                              <AnimatePresence mode="wait">
                                {savingSkill === skill ? (
                                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                    <FiLoader className="animate-spin" />
                                  </motion.div>
                                ) : savedSkills.includes(skill) ? (
                                  <motion.div key="saved" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
                                    <FiCheckCircle />
                                  </motion.div>
                                ) : (
                                  <motion.div key="add" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
                                    <FiPlus />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><FiBookOpen /> Top Recommended Resources</h3>
                    <div className="space-y-4">
                      {selectedDomain.courses?.map((courseItem, idx) => {
                        const isString = typeof courseItem === 'string';
                        const courseName = isString ? courseItem : (courseItem.name || courseItem.title || "Recommended Tutorial");
                        const coursePlatform = isString ? "YouTube / Web" : (courseItem.platform || "Online Resource");
                        const courseType = isString ? "Video" : (courseItem.type || "Course");
                        const courseLink = (!isString && courseItem.link && courseItem.link !== "#") 
                            ? courseItem.link 
                            : `https://www.youtube.com/results?search_query=${encodeURIComponent(courseName + ' full course tutorial')}`;

                        return (
                          <a key={idx} href={courseLink} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-[#121214] hover:bg-[#1a1a24] border border-white/5 hover:border-indigo-500/30 rounded-2xl transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                                {courseType.toLowerCase().includes('video') || coursePlatform.toLowerCase().includes('youtube') ? <FiPlayCircle /> : <FiBookOpen />}
                              </div>
                              <div>
                                <h4 className="font-bold text-white group-hover:text-indigo-300 transition-colors">{courseName}</h4>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{coursePlatform} • {courseType}</span>
                              </div>
                            </div>
                            <FiExternalLink className="text-slate-600 group-hover:text-indigo-400" />
                          </a>
                        );
                      })}
                    </div>
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