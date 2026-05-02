import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// 🟢 Public Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// 🛡️ Protected Layout & Pages
import MainLayout from './layouts/MainLayout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard'; 
import Jobs from './pages/Jobs';
import Resume from './pages/Resume';    // AI Resume Analyzer
import Trends from './pages/Trends';    // Market Predictor
import Roadmap from './pages/Roadmap';  // Interactive Learning Hub
import Chat from './pages/Chat';        // AI Counselor
import Profile from './pages/Profile';  // User Settings
import InterviewHub from './pages/InterviewHub';

// 🛡️ The Bouncer (Protected Route Logic)
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Jab tak Supabase check kar raha hai, ek mast dark theme spinner dikhao
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Waking up AI...</p>
        </div>
      </div>
    );
  }

  // Agar user hai toh andar aane do, warna signup par phek do
  return user ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          
          {/* 🟢 PUBLIC ROUTES */}
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          
          {/* 🟡 ONBOARDING (Protected but No Sidebar Layout) */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />   

          {/* 🌍 GLOBAL LAYOUT WRAPPER (Sidebar + Navbar) */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/roadmap" element={<Resume />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/skillroadmap" element={<Roadmap />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/interview" element={<InterviewHub />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;