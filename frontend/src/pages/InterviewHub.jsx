import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAppStore from '../store/useAppStore';
import { 
  FiBriefcase, FiTrash2, FiPlayCircle, FiMic, 
  FiMicOff, FiStopCircle, FiArrowLeft, FiActivity, 
  FiCheckCircle, FiXCircle, FiAward, FiStar, FiRefreshCw, FiPieChart
} from 'react-icons/fi';

export default function InterviewHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // 🚀 Pulling the new saveInterviewReport function
  const { savedInterviews, removeInterviewPrep, saveInterviewReport } = useAppStore();
  
  const [activeInterview, setActiveInterview] = useState(null); 
  const [isListening, setIsListening] = useState(false);
  const [interviewStatus, setInterviewStatus] = useState('idle'); 
  const [chatHistory, setChatHistory] = useState([]);
  const [reportCard, setReportCard] = useState(null);
  
  const recognitionRef = useRef(null); 
  const currentTranscriptRef = useRef('');

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // 🚀 Start or Retake Interview
  const handleStartInterview = (job) => {
    setActiveInterview(job);
    setChatHistory([]);
    setReportCard(null);
    setInterviewStatus('idle'); // Force reset status
    askAI("", job); 
  };

  // 🚀 View Saved Result Directly
  const handleViewResult = (job) => {
    setActiveInterview(job);
    setReportCard(job.reportCard);
    setInterviewStatus('report');
  };

  const handleLeaveRoom = () => {
    window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
    setActiveInterview(null);
    setIsListening(false);
    setInterviewStatus('idle');
    setChatHistory([]);
    setReportCard(null);
  };

  const askAI = async (userAnswer, job = activeInterview) => {
    setInterviewStatus('processing');
    try {
      const res = await fetch("http://127.0.0.1:8000/start-mock-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email,
          job_title: job.title,
          job_description: job.aboutRole,
          user_answer: userAnswer,
          chat_history: chatHistory
        })
      });
      const data = await res.json();
      
      if (data.status === "success") {
        const aiMessage = data.reply;
        setChatHistory(prev => [
          ...prev, 
          ...(userAnswer ? [{ role: "user", content: userAnswer }] : []), 
          { role: "assistant", content: aiMessage }
        ]);
        playAIAudio(aiMessage);
      }
    } catch (error) {
      console.error("AI Communication Error:", error);
      setInterviewStatus('idle');
    }
  };

  const playAIAudio = (text) => {
    setInterviewStatus('asking');
    window.speechSynthesis.cancel(); 

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium')) && v.lang.includes('en')
    ) || voices.find(v => v.lang === 'en-IN') || voices[0];
    
    if (naturalVoice) utterance.voice = naturalVoice;
    utterance.lang = 'en-US';
    utterance.rate = 1.05; 
    
    utterance.onend = () => setInterviewStatus('idle');
    utterance.onerror = () => setInterviewStatus('idle');

    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    if (isListening) {
      setIsListening(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      
      const finalAnswer = currentTranscriptRef.current.trim();
      console.log("🗣️ You Spoke (Final):", finalAnswer || "[No audio detected]"); 
      
      if (finalAnswer) askAI(finalAnswer);
      else setInterviewStatus('idle');
      
      currentTranscriptRef.current = ""; 
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser doesn't support voice input.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; 
    recognition.interimResults = true; 
    recognition.continuous = true; 
    recognitionRef.current = recognition; 

    recognition.onstart = () => {
      window.speechSynthesis.cancel(); 
      setIsListening(true);
      setInterviewStatus('listening');
      currentTranscriptRef.current = "";
    };
    
    recognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      currentTranscriptRef.current = fullTranscript;
    };

    recognition.onerror = (e) => {
      if(e.error !== 'no-speech') {
         setIsListening(false);
         setInterviewStatus('idle');
      }
    };

    recognition.onend = () => {
      if(isListening) { 
        try { recognition.start(); } 
        catch(err) {
           setIsListening(false);
           const finalAnswer = currentTranscriptRef.current.trim();
           if (finalAnswer) askAI(finalAnswer);
           else setInterviewStatus('idle');
           currentTranscriptRef.current = "";
        }
      }
    };
    recognition.start();
  };

  const endInterviewAndEvaluate = async () => {
    window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setInterviewStatus('finished');

    try {
      const res = await fetch("http://127.0.0.1:8000/evaluate-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email,
          job_title: activeInterview.title,
          chat_history: chatHistory
        })
      });
      const data = await res.json();
      
      if (data.status === "success") {
        setReportCard(data.evaluation);
        // 🚀 PERMANENTLY SAVE REPORT TO ZUSTAND & LOCALSTORAGE
        saveInterviewReport(activeInterview.id, data.evaluation);
        setInterviewStatus('report');
      } else {
        alert("Failed to generate report.");
        handleLeaveRoom();
      }
    } catch (error) {
      console.error("Evaluation Error:", error);
      handleLeaveRoom();
    }
  };

  // ==========================================
  // VIEW 1.5: THE REPORT CARD
  // ==========================================
  if (activeInterview && interviewStatus === 'report' && reportCard) {
    const scoreColor = reportCard.score >= 80 ? 'text-emerald-400' : reportCard.score >= 60 ? 'text-amber-400' : 'text-red-400';
    
    return (
      <div className="flex flex-col h-full bg-[#050505] overflow-y-auto custom-scrollbar p-6 md:p-10">
        <div className="max-w-4xl mx-auto w-full">
          
          <div className="flex items-center justify-between mb-8">
            <button onClick={handleLeaveRoom} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold">
              <FiArrowLeft /> Back to Hub
            </button>
            
            {/* 🚀 RETAKE INTERVIEW BUTTON */}
            <button onClick={() => handleStartInterview(activeInterview)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all">
              <FiRefreshCw /> Retake Interview
            </button>
          </div>

          <div className="bg-[#121214] border border-white/5 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-96 h-96 opacity-10 rounded-full blur-[100px] pointer-events-none ${reportCard.score >= 80 ? 'bg-emerald-500' : reportCard.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}></div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 relative z-10">
              <div>
                <h1 className="text-3xl font-black text-white mb-2">Performance Report</h1>
                <p className="text-slate-400 font-medium text-lg">For {activeInterview.title} at {activeInterview.company}</p>
                <div className="inline-flex items-center gap-2 mt-4 bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-white font-bold">
                  Decision: 
                  <span className={reportCard.decision.toLowerCase().includes('hire') ? 'text-emerald-400' : 'text-red-400'}>
                    {reportCard.decision.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                  <motion.circle 
                    initial={{ strokeDashoffset: 251 }} animate={{ strokeDashoffset: 251 - (251 * reportCard.score) / 100 }} transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251" strokeLinecap="round" 
                    className={scoreColor}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-black ${scoreColor}`}>{reportCard.score}</span>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Score</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
                <h3 className="text-emerald-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 mb-4">
                  <FiCheckCircle size={18}/> Key Strengths
                </h3>
                <ul className="space-y-3">
                  {reportCard.strengths?.map((str, i) => (
                    <li key={i} className="text-slate-300 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">✦</span> {str}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
                <h3 className="text-red-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 mb-4">
                  <FiXCircle size={18}/> Areas to Improve
                </h3>
                <ul className="space-y-3">
                  {reportCard.weaknesses?.map((weak, i) => (
                    <li key={i} className="text-slate-300 text-sm leading-relaxed flex items-start gap-2">
                      <span className="text-red-500 mt-1">✦</span> {weak}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-8 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 relative z-10">
              <h3 className="text-indigo-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2 mb-4">
                <FiAward size={18}/> Manager's Feedback
              </h3>
              <p className="text-slate-300 leading-relaxed">
                {reportCard.feedback}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: THE INTERVIEW ROOM (FOCUS MODE)
  // ==========================================
  if (activeInterview) {
    return (
      <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
        
        <div className="h-20 shrink-0 flex items-center justify-between px-8 border-b border-white/5 relative z-10">
          <button onClick={handleLeaveRoom} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold">
            <FiArrowLeft /> Leave Room
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 mb-1 animate-pulse">
              Live Session
            </span>
            <h2 className="text-white font-bold">{activeInterview.title}</h2>
          </div>
          
          <button 
            onClick={endInterviewAndEvaluate}
            disabled={interviewStatus === 'finished'}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors text-sm font-bold border border-red-500/20 disabled:opacity-50"
          >
            {interviewStatus === 'finished' ? <span className="animate-pulse flex items-center gap-2">Analyzing...</span> : <><FiStopCircle /> End & Get Score</>}
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 ${
            interviewStatus === 'listening' ? 'bg-emerald-500/10' : 
            interviewStatus === 'asking' ? 'bg-indigo-500/20' : 'bg-transparent'
          }`}></div>

          <motion.div 
            animate={
              interviewStatus === 'asking' ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 1.5 } } : 
              interviewStatus === 'listening' ? { scale: 0.95, opacity: 0.8 } : { scale: 1 }
            }
            className={`w-32 h-32 rounded-full p-1 shadow-[0_0_40px_rgba(79,70,229,0.4)] relative z-10 flex items-center justify-center transition-colors duration-500 ${
              interviewStatus === 'listening' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
            }`}
          >
            <div className="w-full h-full bg-[#050505] rounded-full flex items-center justify-center">
              {interviewStatus === 'processing' || interviewStatus === 'finished' ? (
                 <div className="flex gap-1">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                 </div>
              ) : (
                <FiActivity className={`text-4xl ${interviewStatus === 'asking' ? 'text-indigo-400 animate-pulse' : interviewStatus === 'listening' ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
              )}
            </div>
          </motion.div>

          <h3 className="text-2xl font-black text-white mt-8 tracking-tight text-center">
            {interviewStatus === 'idle' && "Your turn."}
            {interviewStatus === 'asking' && "Interviewer is speaking..."}
            {interviewStatus === 'listening' && "Listening to your answer..."}
            {interviewStatus === 'processing' && "Thinking..."}
            {interviewStatus === 'finished' && "Evaluating your interview..."}
          </h3>
          <p className="text-slate-500 mt-2 text-sm max-w-md text-center px-4">
            {interviewStatus === 'idle' ? "Click the mic below to record your response." : 
             interviewStatus === 'listening' ? "Speak clearly. Click the mic again when you are done." : 
             "Please wait..."}
          </p>

        </div>

        <div className="h-32 shrink-0 flex items-center justify-center bg-gradient-to-t from-[#0A0A0B] to-transparent relative z-10 pb-8">
          <button
            onClick={toggleMic}
            disabled={interviewStatus === 'finished' || interviewStatus === 'asking' || interviewStatus === 'processing'}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl transition-all duration-300 shadow-2xl disabled:opacity-20 disabled:cursor-not-allowed ${
              isListening 
                ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110' 
                : 'bg-white text-indigo-900 hover:bg-slate-200 hover:scale-105'
            }`}
          >
            {isListening ? <FiStopCircle /> : <FiMic />}
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: THE PREPARATION BOARD (LIST VIEW)
  // ==========================================
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full h-full">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3 text-white">
          Interview Hub
        </h1>
        <p className="text-slate-400">Your shortlisted jobs. Practice AI mock interviews before the real deal.</p>
      </div>

      {savedInterviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-[#121214] border border-white/5 rounded-3xl p-12 text-center h-[50vh] shadow-xl">
          <div className="w-20 h-20 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-4xl mb-6">
            <FiBriefcase />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Your board is empty</h2>
          <p className="text-slate-400 max-w-md mb-8">
            Go to your Job Matches, find a role you like, and click "Add to Prep" to start practicing mock interviews.
          </p>
          <button 
            onClick={() => navigate('/jobs')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg"
          >
            Explore Job Matches
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {savedInterviews.map((job) => (
              <motion.div 
                key={job.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#121214] border border-white/5 hover:border-indigo-500/30 rounded-3xl p-6 flex flex-col justify-between group transition-all shadow-lg relative overflow-hidden"
              >
                {/* 🚀 SCORE BANNER ON CARD IF INTERVIEWED */}
                {job.reportCard && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-black px-4 py-1.5 rounded-bl-xl shadow-lg flex items-center gap-1">
                    <FiAward /> Score: {job.reportCard.score}/100
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-xl text-indigo-400 shrink-0 mt-2">
                      {job.logo}
                    </div>
                    <button 
                      onClick={() => removeInterviewPrep(job.id)}
                      className="text-slate-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 mt-2"
                      title="Remove from board"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-2">{job.title}</h3>
                  <p className="text-slate-400 text-sm font-medium mb-4">{job.company}</p>
                  
                  <div className="flex items-center gap-2 mb-6">
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1">
                      <FiCheckCircle /> {job.matchScore || 0}% Match
                    </span>
                    <span className="bg-white/5 text-slate-300 text-xs font-bold px-2 py-1 rounded-md border border-white/10 truncate">
                      {job.domain || 'Technology'}
                    </span>
                  </div>
                </div>

                {/* 🚀 TOGGLE BUTTON BASED ON REPORT EXISTANCE */}
                {job.reportCard ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleViewResult(job)}
                      className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-4 py-3 rounded-xl font-bold transition-all border border-indigo-500/20"
                    >
                      <FiPieChart /> Result
                    </button>
                    <button 
                      onClick={() => handleStartInterview(job)}
                      className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-indigo-50 text-[#050505] px-4 py-3 rounded-xl font-bold transition-all shadow-lg"
                    >
                      <FiRefreshCw /> Retake
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleStartInterview(job)}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-indigo-50 text-[#050505] hover:text-indigo-600 px-4 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                  >
                    <FiPlayCircle className="text-lg" /> Start Mock Interview
                  </button>
                )}

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}