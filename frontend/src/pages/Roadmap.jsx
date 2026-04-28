import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  FiCheckCircle, FiCircle, FiLoader, FiZap, 
  FiBookOpen, FiX, FiAward
} from 'react-icons/fi';

export default function Roadmap() {
  const { user } = useAuth();
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoadmap, setSelectedRoadmap] = useState(null); // Modal State

  useEffect(() => {
    if (user?.email) {
      fetchRoadmaps();
    }
  }, [user]);

  const fetchRoadmaps = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/get-user-roadmap?email=${user.email}`);
      const data = await res.json();
      if (data.status === "success") {
        setRoadmaps(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch roadmaps:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (rmId, sIdx, tIdx) => {
    // Deep copy roadmaps
    let updatedRoadmaps = [...roadmaps];
    let rmIndex = updatedRoadmaps.findIndex(r => r.id === rmId);
    let rm = updatedRoadmaps[rmIndex];
    let task = rm.roadmap_data[sIdx].tasks[tIdx];
    
    // Flip completed state
    task.completed = !task.completed;

    // Recalculate Progress
    let totalTasks = 0;
    let completedTasks = 0;
    
    rm.roadmap_data.forEach(step => {
      step.tasks?.forEach(t => {
        totalTasks++;
        if (t.completed) completedTasks++;
      });
    });
    
    let newProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    rm.progress = newProgress;

    // Update main state and modal state
    setRoadmaps(updatedRoadmaps);
    if (selectedRoadmap && selectedRoadmap.id === rmId) {
      setSelectedRoadmap({...rm});
    }

    // Silent DB Sync
    try {
      await fetch(`http://127.0.0.1:8000/update-roadmap-step?roadmap_id=${rm.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          updated_data: rm.roadmap_data, 
          new_progress: newProgress 
        })
      });
    } catch (error) {
      console.error("Failed to sync progress with DB:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] w-full">
        <FiLoader className="animate-spin text-5xl text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Loading your Roadmaps...</h2>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full relative">
      
      {/* HEADER */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
          <FiZap className="text-yellow-400" /> My Learning Hub
        </h1>
        <p className="text-slate-400">Your personalized, AI-generated curriculum. Click on any skill to track progress.</p>
      </div>

      {/* ROADMAPS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roadmaps.map((rm) => (
          <motion.div 
            key={rm.id} 
            whileHover={{ y: -5 }}
            onClick={() => setSelectedRoadmap(rm)}
            className="bg-[#121214] border border-white/5 rounded-3xl p-6 shadow-lg cursor-pointer hover:border-indigo-500/30 transition-all group flex flex-col h-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.2)] shrink-0 group-hover:scale-110 transition-transform">
                {rm.skill_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors line-clamp-1">{rm.skill_name}</h3>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold">Interactive Path</p>
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-slate-400">Mastery Level</span>
                <span className="text-lg font-black text-white">{rm.progress}%</span>
              </div>
              <div className="h-3 bg-[#0A0A0A] border border-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: `${rm.progress}%` }}
                  className={`h-full ${rm.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* EMPTY STATE */}
      {roadmaps.length === 0 && !loading && (
        <div className="text-center py-20 bg-[#121214] border border-white/5 rounded-3xl border-dashed">
          <FiBookOpen size={48} className="mx-auto mb-4 text-slate-600 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">Your Learning Hub is Empty</h2>
          <p className="text-slate-400 max-w-md mx-auto mb-6">Go to the "Market Trends" or "AI Analyzer" page and save a skill to generate a roadmap.</p>
        </div>
      )}

      {/* 🚀 THE SMART MODAL */}
      <AnimatePresence>
        {selectedRoadmap && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRoadmap(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 100, scale: 0.95 }} 
              className="fixed top-[5%] left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] bg-[#0A0A0A] border border-white/10 rounded-t-3xl md:rounded-3xl z-50 overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-8 bg-[#121214] border-b border-white/5 shrink-0 relative">
                <button onClick={() => setSelectedRoadmap(null)} className="absolute top-6 right-6 bg-white/5 hover:bg-white/10 text-white p-2 rounded-full transition-all"><FiX size={24}/></button>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pr-12">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg">
                      {selectedRoadmap.skill_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-white">{selectedRoadmap.skill_name}</h2>
                      <p className="text-indigo-400 font-bold flex items-center gap-2"><FiAward /> AI Personalized Curriculum</p>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-64">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-slate-400">Overall Progress</span>
                      <span className="text-xl font-black text-white">{selectedRoadmap.progress}%</span>
                    </div>
                    <div className="h-3 bg-black rounded-full overflow-hidden border border-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${selectedRoadmap.progress}%` }} className={`h-full ${selectedRoadmap.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Body (Checklist) */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                {Array.isArray(selectedRoadmap.roadmap_data) && selectedRoadmap.roadmap_data.length > 0 ? (
                  selectedRoadmap.roadmap_data.map((step, sIdx) => (
                    <div key={sIdx} className="relative pl-8 md:pl-10 border-l-2 border-indigo-500/20 pb-4">
                      <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-[#121214] border-2 border-indigo-500 flex items-center justify-center text-xs font-black text-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                        {sIdx + 1}
                      </div>
                      
                      <h4 className="text-xl font-bold text-white mb-4">{step.title}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {step.tasks?.map((task, tIdx) => (
                          <button 
                            key={tIdx} 
                            onClick={() => toggleTask(selectedRoadmap.id, sIdx, tIdx)}
                            className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left group ${
                              task.completed 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]' 
                              : 'bg-[#121214] border-white/5 text-slate-400 hover:border-indigo-500/30 hover:bg-indigo-500/5'
                            }`}
                          >
                            <div className={`mt-0.5 shrink-0 transition-transform ${task.completed ? 'scale-110' : 'group-hover:scale-110 group-hover:text-indigo-400'}`}>
                              {task.completed ? <FiCheckCircle size={20} /> : <FiCircle size={20} />}
                            </div>
                            <span className={`text-sm font-medium leading-relaxed ${task.completed ? 'line-through opacity-80' : ''}`}>
                              {task.task_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-red-400 text-center py-10 bg-red-500/10 rounded-xl border border-red-500/20">
                    Failed to parse roadmap steps. Delete this skill and re-add it from the AI Analyzer.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}