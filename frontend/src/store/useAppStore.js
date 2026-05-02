import { create } from 'zustand';

const useAppStore = create((set) => ({
  
  // ==========================
  // 💼 JOBS PAGE STATE (Global)
  // ==========================
  
  // 1. Data States
  allJobs: [],
  setAllJobs: (jobs) => set({ allJobs: jobs }),

  matchedJobs: [],
  setMatchedJobs: (jobs) => set({ matchedJobs: jobs }),

  hasFetchedMatched: false,
  setHasFetchedMatched: (status) => set({ hasFetchedMatched: status }),

  isJobsLoading: true,
  setIsJobsLoading: (status) => set({ isJobsLoading: status }),

  // 2. Search & Toggles
  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),

  isPersonalized: false,
  setIsPersonalized: (status) => set({ isPersonalized: status }),

  // 3. Filters
  filterType: 'All',
  setFilterType: (type) => set({ filterType: type }),

  filterExperience: 'All',
  setFilterExperience: (exp) => set({ filterExperience: exp }),

  filterWorkMode: 'All',
  setFilterWorkMode: (mode) => set({ filterWorkMode: mode }),

  filterDomain: 'All',
  setFilterDomain: (domain) => set({ filterDomain: domain }),

  filterSalary: 'All',
  setFilterSalary: (salary) => set({ filterSalary: salary }),

  filterDate: 'All',
  setFilterDate: (date) => set({ filterDate: date }),

  quickFilter: 'None',
  setQuickFilter: (filter) => set({ quickFilter: filter }),

  showFilters: false,
  setShowFilters: (show) => set({ showFilters: show }),

  // 4. Pagination
  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),




  // ==========================
  // 🎯 AI RESUME ANALYZER STATE
  // ==========================
  
  userProfileData: null,
  setUserProfileData: (data) => set({ userProfileData: data }),

  analyzerTargetRole: '',
  setAnalyzerTargetRole: (role) => set({ analyzerTargetRole: role }),
  
  analyzerData: null,
  setAnalyzerData: (data) => set({ analyzerData: data }),

  analyzerSavedSkills: [],
  setAnalyzerSavedSkills: (skills) => set({ analyzerSavedSkills: skills }),


  // ==========================
  // 📚 LEARNING HUB (ROADMAP) STATE
  // ==========================
  userRoadmaps: [],
  setUserRoadmaps: (data) => set({ userRoadmaps: data }),


  // ==========================
  // 📊 DASHBOARD STATE
  // ==========================
  dashboardData: null,
  setDashboardData: (data) => set({ dashboardData: data }),

  // ==========================
  // 💬 AI COUNSELOR (CHAT) STATE
  // ==========================
  chatSessions: [
    { 
      id: Date.now(), 
      title: 'New Chat', 
      messages: [{ id: 1, role: 'ai', text: "Hi there! I'm HireMap AI. Tell me your target role, and ask me anything about interviews, projects, or career shifts!" }] 
    }
  ],
  setChatSessions: (sessions) => set({ chatSessions: sessions }),

  activeChatId: null, // Hum component mein isko handle kar lenge
  setActiveChatId: (id) => set({ activeChatId: id }),

}));





    

export default useAppStore;