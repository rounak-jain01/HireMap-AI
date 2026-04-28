import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  FiUser, FiMail, FiTarget, FiDollarSign, 
  FiMapPin, FiSave, FiCheckCircle, FiLoader, FiBriefcase, FiZap 
} from 'react-icons/fi';

export default function Profile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState({
    full_name: '',
    target_role: '',
    min_expected_salary: '',
    preferred_locations: [],
    extracted_skills: []
  });
  const [locationInput, setLocationInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 1. Fetch Profile Data on Load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/get-profile?email=${user?.email}`);
        const data = await res.json();
        
        if (data.status === 'success') {
          setProfileData({
            full_name: data.data.full_name || '',
            target_role: data.data.target_role || '',
            min_expected_salary: data.data.min_expected_salary || '',
            preferred_locations: data.data.preferred_locations || [],
            extracted_skills: data.data.extracted_skills || []
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.email) fetchProfile();
  }, [user]);

  // 2. Handle Inputs
  const handleLocationAdd = (e) => {
    if (e.key === 'Enter' && locationInput.trim()) {
      e.preventDefault();
      if (!profileData.preferred_locations.includes(locationInput.trim())) {
        setProfileData(prev => ({...prev, preferred_locations: [...prev.preferred_locations, locationInput.trim()]}));
      }
      setLocationInput('');
    }
  };

  const removeLocation = (loc) => {
    setProfileData(prev => ({...prev, preferred_locations: prev.preferred_locations.filter(l => l !== loc)}));
  };

  // 3. Save Profile
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const res = await fetch('http://127.0.0.1:8000/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          target_role: profileData.target_role,
          min_expected_salary: parseInt(profileData.min_expected_salary) || 0,
          preferred_locations: profileData.preferred_locations
          // Note: Hum full_name update ka route abhi use nahi kar rahe, par UI mein diya hai.
        })
      });

      const data = await res.json();
      if (data.status.includes('Successfully')) {
        setMessage('Profile updated successfully! 🚀');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Network error while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80vh] w-full">
        <FiLoader className="animate-spin text-5xl text-indigo-500 mb-4" />
        <h2 className="text-xl font-bold text-white">Loading Profile...</h2>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto w-full">
      
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
          <FiUser className="text-indigo-500" /> Account Settings
        </h1>
        <p className="text-slate-400">Manage your career preferences and AI-extracted data.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* PERSONAL INFO CARD */}
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
            <FiUser className="text-indigo-400"/> Personal Information
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name (Read Only)</label>
              <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 opacity-70">
                <FiUser className="text-slate-400 mr-3" />
                <input type="text" value={profileData.full_name} disabled className="bg-transparent text-white w-full focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Account</label>
              <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 opacity-70">
                <FiMail className="text-slate-400 mr-3" />
                <input type="text" value={user?.email} disabled className="bg-transparent text-white w-full focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* CAREER PREFERENCES CARD */}
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
            <FiBriefcase className="text-emerald-400"/> Career Preferences
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Role</label>
              <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 focus-within:border-indigo-500 transition-colors">
                <FiTarget className="text-indigo-400 mr-3" />
                <input 
                  type="text" 
                  value={profileData.target_role} 
                  onChange={(e) => setProfileData({...profileData, target_role: e.target.value})}
                  className="bg-transparent text-white w-full focus:outline-none" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Min. Expected Salary (LPA)</label>
              <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 focus-within:border-emerald-500 transition-colors">
                <FiDollarSign className="text-emerald-400 mr-3" />
                <input 
                  type="number" 
                  value={profileData.min_expected_salary} 
                  onChange={(e) => setProfileData({...profileData, min_expected_salary: e.target.value})}
                  className="bg-transparent text-white w-full focus:outline-none" 
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preferred Locations</label>
            <div className="flex items-center bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 focus-within:border-indigo-500 transition-colors mb-3">
              <FiMapPin className="text-slate-400 mr-3" />
              <input 
                type="text" 
                placeholder="Type a city and press Enter..."
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={handleLocationAdd}
                className="bg-transparent text-white w-full focus:outline-none" 
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {profileData.preferred_locations.map((loc, idx) => (
                <span key={idx} className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                  {loc} <button type="button" onClick={() => removeLocation(loc)} className="hover:text-red-400 transition-colors">&times;</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* AI EXTRACTED SKILLS (Read Only) */}
        <div className="bg-[#121214] border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
            <FiZap className="text-amber-400"/> AI Extracted Skills
          </h2>
          <p className="text-sm text-slate-400 mb-4">These skills were automatically extracted from your resume during onboarding.</p>
          <div className="flex flex-wrap gap-2">
            {profileData.extracted_skills.map((skill, idx) => (
              <span key={idx} className="bg-white/5 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg text-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between pt-4">
          <span className={`text-sm font-bold flex items-center gap-2 transition-opacity ${message ? 'opacity-100 text-emerald-400' : 'opacity-0'}`}>
            <FiCheckCircle /> {message}
          </span>
          <button 
            type="submit" 
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50"
          >
            {isSaving ? <FiLoader className="animate-spin" /> : <FiSave />} 
            Save Changes
          </button>
        </div>

      </form>
    </div>
  );
}