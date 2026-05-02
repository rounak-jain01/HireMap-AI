import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiUploadCloud, FiEdit3, FiArrowRight, FiX, FiCheck, FiMapPin, FiBriefcase, FiDollarSign, FiUser } from 'react-icons/fi';

export default function Onboarding() {
  const [step, setStep] = useState('choice'); 
  
  const [file, setFile] = useState(null);
  const [manualSkills, setManualSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [extractedResumeText, setExtractedResumeText] = useState("Manual Profile Entry");
  
  // Naye Fields (Full Name etc. add kar diye)
  const [prefs, setPrefs] = useState({
    fullName: '',
    targetRole: '',
    minSalary: 12,
    locations: [],
    locationInput: '',
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // 🚀 BULLETPROOF AI RESUME UPLOAD 
  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setStep('uploading'); // Yeh loading animation dikhayega
    
    const formData = new FormData();
    formData.append("file", uploadedFile);
    formData.append("email", user?.email || "test@example.com");

    try {
      console.log("📤 Sending PDF to AI Parser (/register-seeker)...");
      
      const response = await fetch("http://127.0.0.1:8000/register-seeker", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      console.log("📥 AI Response:", data); 
      
      if (response.ok) {
        const rawSkills = data.extracted_skills || data.skills || [];
        
        // 🚀 THE BIG FIX: Flatten the array if AI over-categorized it into objects
        let flatSkills = [];
        rawSkills.forEach(item => {
          if (typeof item === 'string') {
            flatSkills.push(item); // Normal string hai toh direct daalo
          } else if (item && typeof item === 'object' && Array.isArray(item.skills)) {
            flatSkills.push(...item.skills); // Agar object hai, toh uske andar ka array nikal lo
          }
        });

        const parsedText = data.summary || data.resume_text || "PDF Parsed successfully";

        setManualSkills(flatSkills); // Ab state mein ekdum clean Array jayega
        setExtractedResumeText(parsedText);

        if (flatSkills.length === 0) {
          alert("AI Alert: PDF was read, but no technical skills were found!");
        }

        // Sab successful hone ke baad hi Preferences par bhejenge
        setStep('preferences'); 
      } else {
        console.error("Backend Rejected PDF:", data);
        alert(`AI Error: ${data.detail || data.message || "Failed to read PDF"}`);
        setStep('manual'); 
      }
    } catch (err) {
      console.error("❌ API Request Crashed:", err);
      alert("Error: Backend is not responding. Is FastAPI running?");
      setStep('manual');
    }
  };

  const handleAddSkill = (e) => {
    if (e.key === 'Enter' && skillInput.trim() !== '') {
      e.preventDefault();
      if (!manualSkills.includes(skillInput.trim())) {
        setManualSkills([...manualSkills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove) => setManualSkills(manualSkills.filter(s => s !== skillToRemove));

  const handleAddLocation = (e) => {
    if (e.key === 'Enter' && prefs.locationInput.trim() !== '') {
      e.preventDefault();
      if (!prefs.locations.includes(prefs.locationInput.trim())) {
        setPrefs({ ...prefs, locations: [...prefs.locations, prefs.locationInput.trim()], locationInput: '' });
      }
    }
  };

  const removeLocation = (locToRemove) => setPrefs({ ...prefs, locations: prefs.locations.filter(l => l !== locToRemove) });

  const submitFinalProfile = async () => {
    if(!prefs.fullName || !prefs.targetRole) {
      return alert("Please fill Full Name and Target Role!");
    }

    try {
      // 🚀 THE FIX: Yahan actual State Variables lagaye hain!
      const payload = {
        email: user?.email || "test@test.com", 
        full_name: prefs.fullName,                
        skills: manualSkills,    
        target_role: prefs.targetRole,        
        min_salary: parseInt(prefs.minSalary) || 0, 
        locations: prefs.locations.length > 0 ? prefs.locations : ["Remote"], 
        resume_text: extractedResumeText
      };

      console.log("📤 Sending Payload to Complete Onboarding:", payload);

      const response = await fetch("http://127.0.0.1:8000/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.status === "success") {
        navigate('/dashboard');
      } else {
        // 🚀 THE FIX: 422 error ki exact detail nikalne ke liye
        const errorDetail = data.detail ? JSON.stringify(data.detail) : data.message;
        alert("Backend Error: " + errorDetail);
        console.error("❌ 422 Detail:", data.detail);
      }
    } catch (error) {
      console.error("Network Error:", error);
      alert("Network Error! Is FastAPI running?");
    }
  };

  const slideVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    exit: { opacity: 0, x: -50, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-500 font-bold text-xl mb-4 border border-indigo-500/30">H</div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Build Your AI Profile</h1>
          <p className="text-slate-400">Let's set up your career control center.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' && (
            <motion.div key="choice" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
              <div onClick={() => fileInputRef.current.click()} className="border-2 border-dashed border-indigo-500/50 bg-[#121214] hover:bg-indigo-900/10 transition-colors rounded-3xl p-12 text-center cursor-pointer group">
                <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <FiUploadCloud size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Upload your Resume (PDF)</h3>
                <p className="text-slate-400 text-sm mb-6">Our AI will automatically extract your skills, experience, and projects.</p>
                <span className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold text-sm">Browse Files</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-white/10"></div>
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">OR</span>
                <div className="flex-1 border-t border-white/10"></div>
              </div>
              <button onClick={() => setStep('manual')} className="w-full bg-[#121214] border border-white/10 hover:border-white/20 text-slate-300 py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                <FiEdit3 size={18} /> Don't have a resume? Enter skills manually
              </button>
            </motion.div>
          )}

          {step === 'uploading' && (
            <motion.div key="uploading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-indigo-600/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-400 font-bold text-xs">AI</div>
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Scanning your resume...</h2>
              <p className="text-slate-400">Extracting vectors, mapping skills, and building your profile.</p>
            </motion.div>
          )}

          {step === 'manual' && (
            <motion.div key="manual" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="bg-[#121214] border border-white/10 p-8 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6">What are your top skills?</h3>
              <div className="mb-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {manualSkills.map((skill, idx) => (
                    <span key={idx} className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                      {skill} <FiX className="cursor-pointer hover:text-white" onClick={() => removeSkill(skill)} />
                    </span>
                  ))}
                </div>
                <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={handleAddSkill} placeholder="Type a skill and press Enter (e.g. React, Python)" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end mt-8">
                <button onClick={() => setStep('preferences')} disabled={manualSkills.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50">
                  Continue <FiArrowRight />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'preferences' && (
            <motion.div key="preferences" variants={slideVariants} initial="hidden" animate="visible" exit="exit" className="bg-[#121214] border border-white/10 p-8 rounded-3xl">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <FiCheck className="text-emerald-500" /> Almost Done
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><FiUser className="text-blue-400"/> Full Name</label>
                  <input 
                    type="text" 
                    value={prefs.fullName}
                    onChange={(e) => setPrefs({...prefs, fullName: e.target.value})}
                    placeholder="e.g. Sundar Pichai"
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><FiBriefcase className="text-indigo-400"/> Target Role</label>
                  <input type="text" value={prefs.targetRole} onChange={(e) => setPrefs({...prefs, targetRole: e.target.value})} placeholder="e.g. Machine Learning Engineer" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2"><FiDollarSign className="text-emerald-400"/> Minimum Expected Salary</span>
                    <span className="text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md text-xs">{prefs.minSalary} LPA</span>
                  </label>
                  <input type="range" min="3" max="50" step="1" value={prefs.minSalary} onChange={(e) => setPrefs({...prefs, minSalary: e.target.value})} className="w-full accent-indigo-600 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2 flex items-center gap-2"><FiMapPin className="text-orange-400"/> Preferred Locations</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {prefs.locations.map((loc, idx) => (
                      <span key={idx} className="bg-white/5 text-slate-300 border border-white/10 px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                        {loc} <FiX className="cursor-pointer hover:text-white" onClick={() => removeLocation(loc)} />
                      </span>
                    ))}
                  </div>
                  <input type="text" value={prefs.locationInput} onChange={(e) => setPrefs({...prefs, locationInput: e.target.value})} onKeyDown={handleAddLocation} placeholder="Type city and press Enter" className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="flex justify-end mt-10">
                <button onClick={submitFinalProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                  Save & Go to Dashboard <FiArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}