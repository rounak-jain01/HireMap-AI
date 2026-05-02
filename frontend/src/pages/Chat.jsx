import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import useAppStore from '../store/useAppStore';
import { 
  FiSend, FiUser, FiMessageSquare, 
  FiZap, FiCornerDownLeft, FiLoader, 
  FiMic, FiMicOff, FiVolume2, FiVolumeX, FiPlus, FiTrash2, FiClock, FiX
} from 'react-icons/fi';

export default function Chat() {
  const { user } = useAuth();
  
  // 🚀 ZUSTAND STATE
  const { chatSessions, setChatSessions, activeChatId, setActiveChatId } = useAppStore();
  
  const [input, setInput] = useState('');
  const [targetDomain, setTargetDomain] = useState('Software Engineering'); 
  const [isLoading, setIsLoading] = useState(false);
  
  // 🚀 NEW STATES: Right Sidebar & Voice Control
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null); 

  // Pre-load voices for Natural Speech
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Set active chat on first load
  useEffect(() => {
    if (!activeChatId && chatSessions.length > 0) {
      setActiveChatId(chatSessions[0].id);
    }
  }, [chatSessions, activeChatId, setActiveChatId]);

  const currentChat = chatSessions.find(c => c.id === activeChatId) || chatSessions[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages, isLoading]);

  // 🎙️ VOICE INPUT (TOGGLE: START/STOP)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support voice input. Try Google Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; 
    recognition.interimResults = true; 
    
    recognitionRef.current = recognition; 

    recognition.onstart = () => setIsListening(true);
    
    let finalTranscript = input; 
    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          setInput(finalTranscript);
        } else {
          currentTranscript += transcript;
          setInput(finalTranscript + currentTranscript);
        }
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech error", e);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  // 🔊 TEXT TO SPEECH (NATURAL HUMAN VOICE)
  const toggleSpeech = (text, messageId) => {
    if (!('speechSynthesis' in window)) {
      alert("Your browser doesn't support Text-to-Speech.");
      return;
    }

    window.speechSynthesis.cancel(); 

    if (speakingId === messageId) {
      setSpeakingId(null); 
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium')) && v.lang.includes('en')
    ) || voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (naturalVoice) utterance.voice = naturalVoice;
    utterance.lang = 'en-US';
    utterance.rate = 1.0; 
    utterance.pitch = 1.05; 
    
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // 💬 CHAT MANAGEMENT
  const createNewChat = () => {
    const newId = Date.now();
    const newSession = {
      id: newId,
      title: 'New Chat',
      messages: [{ id: 1, role: 'ai', text: "Hi there! Ready for a new topic. What's on your mind?" }]
    };
    setChatSessions([newSession, ...chatSessions]);
    setActiveChatId(newId);
    setIsHistoryOpen(false); 
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    const filtered = chatSessions.filter(c => c.id !== id);
    if (filtered.length === 0) {
      createNewChat(); 
    } else {
      setChatSessions(filtered);
      if (activeChatId === id) setActiveChatId(filtered[0].id);
    }
  };

  const handleSendMessage = async (e, promptText = null) => {
    e?.preventDefault();
    const finalInput = promptText || input;
    if (!finalInput.trim()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage = { id: Date.now(), role: 'user', text: finalInput };
    
    let updatedSessions = chatSessions.map(session => {
      if (session.id === activeChatId) {
        let newTitle = session.title;
        if (session.messages.length <= 2) {
          newTitle = finalInput.substring(0, 25) + "..."; 
        }
        return { ...session, title: newTitle, messages: [...session.messages, userMessage] };
      }
      return session;
    });
    
    setChatSessions(updatedSessions);
    setInput('');
    setIsLoading(true);

    try {
      const activeSession = updatedSessions.find(c => c.id === activeChatId);
      const chatHistory = activeSession.messages
        .filter(m => m.id !== 1) 
        .map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text
        }));

      const res = await fetch("http://127.0.0.1:8000/ask-hiremap-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email,
          target_domain: targetDomain,
          user_question: finalInput,
          chat_history: chatHistory
        })
      });

      const data = await res.json();
      const replyText = data.status === "success" ? data.reply : "Oops! My circuits got tangled. Try again.";

      setChatSessions(updatedSessions.map(session => {
        if (session.id === activeChatId) {
          return { ...session, messages: [...session.messages, { id: Date.now(), role: 'ai', text: replyText }] };
        }
        return session;
      }));

    } catch (error) {
      console.error("Chatbot Error:", error);
      setChatSessions(updatedSessions.map(session => {
        if (session.id === activeChatId) {
          return { ...session, messages: [...session.messages, { id: Date.now(), role: 'ai', text: "Server connection failed." }] };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = ["What projects should I build?", "How to crack Google interviews?", "Review my current tech stack"];

  if (!currentChat) return null;

  return (
    <div className="flex h-full bg-transparent relative overflow-hidden">
      
      {/* 🟢 MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full relative z-10 w-full">
        
        {/* 🚀 NEW: Floating History Button (Replaced bulky header) */}
        <div className="absolute top-4 right-4 md:right-6 z-20">
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#121214]/80 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white hover:border-white/20 shadow-lg transition-all"
          >
            <FiClock size={14} /> History
          </button>
        </div>

        {/* Added pt-16 to ensure messages don't hide behind the floating button */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-16 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            
            <AnimatePresence initial={false}>
              {currentChat.messages.map((msg) => (
                <motion.div 
                  key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg mt-1">
                      <FiZap size={16} />
                    </div>
                  )}

                  <div className={`relative max-w-[85%] md:max-w-[75%] p-4 md:p-5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-[0_0_15px_rgba(79,70,229,0.2)]' 
                      : 'bg-[#121214] border border-white/5 text-slate-200 rounded-tl-none shadow-lg prose prose-invert prose-sm max-w-none' 
                  }`}>
                    {msg.role === 'user' ? (
                      msg.text
                    ) : (
                      <>
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                        {/* 🔊 Text-to-Speech Button */}
                        <button 
                          onClick={() => toggleSpeech(msg.text, msg.id)}
                          className={`absolute -right-10 top-2 p-1.5 rounded-full transition-all ${
                            speakingId === msg.id ? 'bg-indigo-500/20 text-indigo-400 animate-pulse ring-2 ring-indigo-500/50' : 'bg-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300 opacity-0 group-hover:opacity-100'
                          }`}
                          title="Listen to response"
                        >
                          {speakingId === msg.id ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
                        </button>
                      </>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-9 h-9 rounded-xl bg-[#121214] border border-white/10 flex items-center justify-center text-slate-400 shrink-0 mt-1">
                      <FiUser size={16} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg mt-1">
                  <FiZap size={16} />
                </div>
                <div className="bg-[#121214] border border-white/5 p-4 rounded-2xl rounded-tl-none flex items-center gap-2 h-[52px]">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </motion.div>
            )}
            
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 🟢 BOTTOM INPUT AREA */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent shrink-0 relative z-10">
          <div className="max-w-4xl mx-auto">
            
            {currentChat.messages.length <= 1 && !isLoading && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {quickPrompts.map((prompt, idx) => (
                  <button 
                    key={idx} onClick={(e) => handleSendMessage(e, prompt)}
                    className="bg-[#121214] border border-white/10 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-300 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form 
              onSubmit={handleSendMessage}
              className={`bg-[#0A0A0B] border p-2 rounded-3xl flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-colors ${
                isListening ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'border-white/10 focus-within:border-indigo-500/50'
              }`}
            >
              {/* 🎙️ Voice Input Button */}
              <button 
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-full shrink-0 transition-all flex items-center gap-2 ${
                  isListening ? 'bg-red-500/20 text-red-400 animate-pulse ring-2 ring-red-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
                title="Use Voice Typing"
              >
                {isListening ? <FiMicOff size={20} /> : <FiMic size={20} />}
                {isListening && <span className="text-xs font-bold md:hidden">Listening...</span>}
              </button>
              
              <input 
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening... (Click mic to stop)" : `Ask anything...`}
                className="flex-1 bg-transparent text-white focus:outline-none placeholder-slate-600 text-sm md:text-base px-2"
                disabled={isLoading}
              />
              
              <button 
                type="submit" disabled={!input.trim() || isLoading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-full transition-colors shrink-0 flex items-center justify-center shadow-lg"
              >
                {isLoading ? <FiLoader className="animate-spin" /> : <FiSend />}
              </button>
            </form>
            <p className="text-center text-[10px] text-slate-600 mt-4 flex items-center justify-center gap-1">
              <FiCornerDownLeft /> AI can make mistakes. Consider verifying important information.
            </p>
          </div>
        </div>
      </div>

      {/* 📚 RIGHT SIDEBAR: SLIDE-IN CHAT HISTORY */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-72 bg-[#121214] border-l border-white/5 flex flex-col z-50 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0A0A0B]/50">
                <span className="text-sm font-bold text-white flex items-center gap-2"><FiMessageSquare className="text-indigo-400"/> Chat History</span>
                <button onClick={() => setIsHistoryOpen(false)} className="text-slate-500 hover:text-white bg-white/5 p-1.5 rounded-md"><FiX size={16}/></button>
              </div>

              <div className="p-4 border-b border-white/5">
                <button 
                  onClick={createNewChat}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors shadow-lg"
                >
                  <FiPlus /> New Conversation
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-2 mt-2">Saved Sessions</p>
                {chatSessions.map(chat => (
                  <div 
                    key={chat.id}
                    onClick={() => { setActiveChatId(chat.id); setIsHistoryOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all cursor-pointer group border ${
                      activeChatId === chat.id ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold' : 'border-transparent text-slate-400 hover:bg-white/5 hover:border-white/10 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <FiMessageSquare className={`shrink-0 ${activeChatId === chat.id ? 'opacity-100' : 'opacity-50'}`} /> 
                      {chat.title}
                    </span>
                    <button onClick={(e) => deleteChat(chat.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-1 bg-black/20 rounded-md">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}