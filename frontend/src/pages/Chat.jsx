import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import { 
  FiSend, FiUser, FiMessageSquare, FiTarget, 
  FiZap, FiCpu, FiCornerDownLeft, FiLoader 
} from 'react-icons/fi';

export default function Chat() {
  const { user } = useAuth();
  
  // States
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'ai',
      text: "Hi there! I'm HireMap AI. I have access to your resume skills. Tell me your target role, and ask me anything about interviews, projects, or career shifts!"
    }
  ]);
  const [input, setInput] = useState('');
  const [targetDomain, setTargetDomain] = useState('Software Engineering'); // Backend ko target chahiye
  const [isLoading, setIsLoading] = useState(false);
  
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/ask-hiremap-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email,
          target_domain: targetDomain,
          user_question: userMessage.text
        })
      });

      const data = await res.json();

      if (data.status === "success") {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'ai',
          text: data.reply
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'ai',
          text: "Oops! My circuits got tangled. Could you ask that again?"
        }]);
      }
    } catch (error) {
      console.error("Chatbot Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        text: "I'm having trouble connecting to the server. Please check if the backend is running!"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action prompts
  const quickPrompts = [
    "What projects should I build?",
    "How to crack Google interviews?",
    "Review my current tech stack",
    "Prepare me for a behavioral round"
  ];

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] relative overflow-hidden">
      
      

      {/* 🟢 CHAT MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6 pb-4">
          
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* AI Avatar */}
                {msg.role === 'ai' && (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                    <FiZap />
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`max-w-[80%] md:max-w-[70%] p-4 rounded-2xl text-sm md:text-base leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    // 🚀 FIX: Markdown classes parent div mein shift kar di hain
                    : 'bg-[#121214] border border-white/5 text-slate-200 rounded-tl-none shadow-lg prose prose-invert prose-sm max-w-none' 
                }`}>
                  {msg.role === 'user' ? (
                    msg.text
                  ) : (
                    // 🚀 FIX: Yahan se className hata diya
                    <ReactMarkdown>
                      {msg.text}
                    </ReactMarkdown>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                    <FiUser />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                <FiZap />
              </div>
              <div className="bg-[#121214] border border-white/5 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </motion.div>
          )}
          
          {/* Dummy div for auto-scroll */}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* 🟢 BOTTOM INPUT AREA */}
      <div className="p-4 md:p-6 bg-gradient-to-t from-[#0A0A0A] to-transparent shrink-0">
        <div className="max-w-4xl mx-auto">
          
          {/* Quick Prompts (Only show if chat is relatively empty) */}
          {messages.length <= 2 && !isLoading && (
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {quickPrompts.map((prompt, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInput(prompt)}
                  className="bg-[#121214] border border-white/10 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-300 px-4 py-2 rounded-full text-xs font-bold transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* The Input Box */}
          <form 
            onSubmit={handleSendMessage}
            className="bg-[#121214] border border-white/10 p-2 rounded-3xl flex items-center gap-2 shadow-2xl focus-within:border-indigo-500/50 transition-colors"
          >
            <div className="p-3 text-slate-500 shrink-0">
              <FiMessageSquare />
            </div>
            
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask anything about ${targetDomain}...`}
              className="flex-1 bg-transparent text-white focus:outline-none placeholder-slate-600"
              disabled={isLoading}
            />
            
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-full transition-colors shrink-0 flex items-center justify-center"
            >
              {isLoading ? <FiLoader className="animate-spin" /> : <FiSend />}
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-600 mt-3 flex items-center justify-center gap-1">
            <FiCornerDownLeft /> Llama 3.1 may produce inaccurate information about people, places, or facts.
          </p>
        </div>
      </div>

    </div>
  );
}