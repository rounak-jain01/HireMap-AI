import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import Lenis from "lenis";
import Navbar from "../components/Navbar";
import { useAuth } from '../context/AuthContext'; // Yeh hum Supabase ke liye banayenge
import { 
  ArrowRight, Target, Database, BrainCircuit, 
  Sparkles, TrendingUp, BarChart3, MapPin, 
  PlaySquare, BookOpen, GraduationCap, Activity
} from "lucide-react";

/* =========================================
   HELPER COMPONENTS
   ========================================= */

const AnimatedCounter = ({ from = 0, to, duration = 2, suffix = "" }) => {
  const [count, setCount] = useState(from);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let startTime;
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
        setCount(Math.floor(progress * (to - from) + from));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, [isInView, from, to, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const SectionHeader = ({ badge, badgeIcon: BadgeIcon, title, desc }) => (
  <div className="text-center mb-16 max-w-3xl mx-auto">
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold text-xs mb-6 border border-indigo-200/50 dark:border-indigo-500/20 shadow-sm">
      <BadgeIcon size={14} /> {badge}
    </div>
    <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">{title}</h2>
    <p className="text-lg text-slate-600 dark:text-slate-400">{desc}</p>
  </div>
);

/* =========================================
   MAIN SECTIONS
   ========================================= */

const HeroSection = ({ user }) => (
  <section className="relative max-w-6xl mx-auto px-6 pt-32 pb-24 text-center">
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex flex-col items-center z-10 relative">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold text-xs mb-8 border border-indigo-200/50 dark:border-indigo-500/20 shadow-sm">
        <Sparkles size={14} /> The Ultimate Career Intelligence Platform
      </div>
      <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6 text-slate-900 dark:text-white max-w-5xl">
        Stop guessing. <br/>
        Let AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">engineer your career.</span>
      </h1>
      <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
        We aggregate jobs from LinkedIn & Naukri, analyze your resume using NLP, predict market trends, and generate custom roadmaps to bridge your skill gaps.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
        <Link to={user ? "/dashboard" : "/signup"} className="flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:-translate-y-1">
          {user ? "Go to Dashboard" : "Start Building Free"} <ArrowRight size={20} />
        </Link>
      </div>
    </motion.div>
  </section>
);

const StatsSection = () => (
  <section className="py-12 px-6 border-y border-slate-200/60 dark:border-white/5 bg-white/60 dark:bg-[#121214]/60 backdrop-blur-md">
    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      {[
        { label: "Active Jobs Scraped", value: 14500, suffix: "+" },
        { label: "Skills Indexed", value: 850, suffix: "+" },
        { label: "Resumes Analyzed", value: 2400, suffix: "+" },
        { label: "Data Accuracy", value: 99, suffix: "%" },
      ].map((stat, i) => (
        <div key={i}>
          <div className="text-3xl md:text-4xl font-black text-indigo-600 dark:text-indigo-400 mb-2">
            <AnimatedCounter to={stat.value} suffix={stat.suffix} />
          </div>
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</div>
        </div>
      ))}
    </div>
  </section>
);

const NLPDataSection = () => (
  <section className="py-24 px-6 bg-white dark:bg-[#0A0A0A]">
    <div className="max-w-6xl mx-auto">
      <SectionHeader 
        badge="Proprietary Technology" 
        badgeIcon={BrainCircuit}
        title="How our AI processes the job market."
        desc="We don't just show you links. Our custom Natural Language Processing (NLP) engine reads and understands the tech industry in real-time."
      />
      <div className="grid md:grid-cols-3 gap-8">
        {[
          { icon: <Database size={24}/>, step: "1. Data Aggregation", desc: "Our scrapers pull thousands of fresh job descriptions daily from LinkedIn, Naukri, and company career pages into our Supabase cluster." },
          { icon: <BrainCircuit size={24}/>, step: "2. NLP Extraction", desc: "Our AI reads the unstructured text, ignores the fluff, and extracts exact technical skills, experience requirements, and salary bands." },
          { icon: <Target size={24}/>, step: "3. Precision Matching", desc: "When you upload your resume, the same NLP engine parses your PDF and runs a highly accurate vector match against the required skills." }
        ].map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} className="bg-slate-50 dark:bg-[#121214] p-8 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-sm">
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
              {item.icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{item.step}</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const GraphsSection = () => (
  <section className="py-24 px-6 relative bg-slate-50 dark:bg-[#0A0A0A]">
    <div className="max-w-6xl mx-auto">
      <SectionHeader 
        badge="Market Predictions" 
        badgeIcon={TrendingUp}
        title="Stay ahead of the curve with Live Data."
        desc="We analyze millions of data points to predict which tech stacks are rising in demand before the market gets saturated."
      />
      
      <div className="grid lg:grid-cols-2 gap-12">
        <div className="bg-white dark:bg-[#121214] p-8 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Skill Demand Trajectory (2026)</h3>
              <p className="text-xs text-slate-500">AI/ML vs Traditional Web Dev</p>
            </div>
            <Activity className="text-indigo-500"/>
          </div>
          <div className="relative h-64 w-full border-l border-b border-slate-200 dark:border-slate-800">
            <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              <motion.path d="M0,80 Q25,75 50,70 T100,65" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" 
                initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeInOut" }} />
              <path d="M0,90 Q25,80 50,40 T100,10 L100,100 L0,100 Z" fill="url(#aiGradient)" opacity="0.3" />
              <motion.path d="M0,90 Q25,80 50,40 T100,10" fill="none" stroke="#4F46E5" strokeWidth="3"
                initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 2, ease: "easeOut" }} />
              <defs>
                <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5 }} className="absolute right-0 top-[10%] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 translate-x-1/2 -translate-y-1/2">
              +142% Surge
            </motion.div>
          </div>
          <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> AI & Data</div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"><div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-300"></div> Web Dev</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121214] p-8 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Avg. Fresher Salaries (LPA)</h3>
              <p className="text-xs text-slate-500">Based on parsed job listings</p>
            </div>
            <BarChart3 className="text-emerald-500"/>
          </div>
          <div className="flex flex-col gap-6 flex-1 justify-end">
            {[
              { label: "Data Scientist", value: "12 LPA", width: "90%", color: "bg-emerald-500" },
              { label: "Backend Dev", value: "8 LPA", width: "70%", color: "bg-blue-500" },
              { label: "Frontend Dev", value: "6 LPA", width: "55%", color: "bg-indigo-400" },
            ].map((bar, i) => (
              <div key={i} className="w-full">
                <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <span>{bar.label}</span><span>{bar.value}</span>
                </div>
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: bar.width }} transition={{ duration: 1.2, delay: i * 0.2 }} className={`h-full ${bar.color} rounded-full`}></motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

const IndiaMapSection = () => {
const cities = [
    { name: "Delhi NCR", jobs: "9,800", top: "28%", left: "28%" },     // Moved Right
    { name: "Indore", jobs: "2,800", top: "48%", left: "25%" },     // Moved Right
    { name: "Pune", jobs: "6,100", top: "56%", left: "28%" },      // Moved Down & Right
    { name: "Hyderabad", jobs: "8,200", top: "77%", left: "33%" },   // Moved Right & Slightly Down
    { name: "Bengaluru", jobs: "12,450", top: "75%", left: "20%" },  // Moved Down & Right
    { name: "Chennai", jobs: "4,500", top: "88%", left: "30%" }      // Moved Right towards the coast
  ];
  return (
    <section className="py-24 px-6 border-y border-slate-200/60 dark:border-white/5 bg-white/40 dark:bg-[#0A0A0A]/40 backdrop-blur-xl relative overflow-hidden">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16 relative z-10">
        <div className="md:w-1/2 w-full h-[450px] relative bg-white dark:bg-[#121214] rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-xl flex items-center justify-center p-6">
          <div className="absolute inset-0 opacity-[0.08] dark:opacity-20 pointer-events-none flex items-center justify-center">
            <img src="./in.svg" alt="India Map" className="h-[90%] object-contain dark:invert" />
          </div>
          
          <div className="relative w-[300px] h-[350px]">
            {cities.map((city, i) => (
              <motion.div key={i} className="absolute flex flex-col items-center group cursor-pointer" style={{ top: city.top, left: city.left }} initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: i * 0.2 }}>
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-10 h-10 bg-indigo-500/30 rounded-full animate-ping"></span>
                  <span className="relative w-4 h-4 bg-indigo-600 dark:bg-indigo-500 rounded-full border-2 border-white dark:border-[#121214] shadow-md"></span>
                </div>
                <div className="mt-2 bg-slate-900 dark:bg-white px-4 py-2 rounded-xl shadow-xl border border-slate-700 dark:border-slate-200 text-center opacity-0 group-hover:opacity-100 transition-all absolute top-6 z-20 w-max pointer-events-none transform scale-95 group-hover:scale-100">
                  <p className="text-xs font-bold text-white dark:text-slate-900">{city.name}</p>
                  <p className="text-[10px] text-indigo-300 dark:text-indigo-600 font-semibold">{city.jobs} Jobs</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        <div className="md:w-1/2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100/50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 font-semibold text-xs mb-6 border border-orange-200/50 dark:border-orange-500/20">
            <MapPin size={14} /> India-Specific Focus
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">Find jobs where they <br/> actually exist.</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            From Bengaluru's startup ecosystem to Delhi NCR's enterprise hubs. We map out real-time job availability so you know exactly where the demand for your skills is located geographically.
          </p>
        </div>
      </div>
    </section>
  );
};

const RoadmapsSection = () => (
  <section className="py-24 px-6 bg-slate-50 dark:bg-[#0A0A0A]">
    <div className="max-w-6xl mx-auto text-center mb-16">
      <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">Learn what matters. <br/> Ignore the rest.</h2>
      <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Once we find your skill gaps, we generate step-by-step roadmaps and recommend the best free and paid resources.</p>
    </div>
    
    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {[
        { icon: <PlaySquare className="text-red-500"/>, title: "YouTube Crash Courses", desc: "Curated free playlists from top Indian & global tech creators." },
        { icon: <BookOpen className="text-blue-500"/>, title: "Coursera Certifications", desc: "Links to professional certs from Google, IBM, and Meta." },
        { icon: <GraduationCap className="text-purple-500"/>, title: "Udemy Masterclasses", desc: "Highly-rated, budget-friendly courses for deep dives." }
      ].map((card, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white dark:bg-[#121214] p-8 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-sm text-center hover:-translate-y-2 transition-transform">
          <div className="w-16 h-16 mx-auto bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6">{card.icon}</div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{card.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{card.desc}</p>
        </motion.div>
      ))}
    </div>
  </section>
);

/* =========================================
   MAIN EXPORT
   ========================================= */
export default function Landing() {
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme ? savedTheme === "dark" : true; 
  });
  
  // Supabase Auth Context hook usage (We will build this context next)
  const { user } = useAuth() || { user: null }; 
  const navigate = useNavigate();

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden font-sans flex flex-col">
      <div className="absolute inset-0 bg-dot-pattern z-[-1] [mask-image:linear-gradient(to_bottom,white_5%,transparent_95%)]"></div>
      
      {/* Assuming Navbar accepts these props */}
      <Navbar isDark={isDark} setIsDark={setIsDark} user={user} />

      <main className="flex-grow pt-16">
        <HeroSection user={user} />
        <StatsSection />
        <NLPDataSection />
        <GraphsSection />
        <IndiaMapSection />
        <RoadmapsSection />

        {/* CTA */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600 dark:bg-indigo-950 z-[-2]"></div>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 z-[-1]"></div>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8">Ready to upgrade your career?</h2>
            <Link to={user ? "/dashboard" : "/signup"} className="bg-white text-indigo-900 px-10 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-2xl inline-flex items-center justify-center gap-2">
              Create Free Account <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-[#050505] pt-20 pb-10 px-6 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">H</div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">HireMap</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 HireMap. Developed with ❤️ for India.</p>
        </div>
      </footer>
    </div>
  );
}