# 🗺️ HireMap AI

**An AI-powered job hunting platform built for the Indian job market** — resume parsing, smart job matching, mock interviews, skill roadmaps, and career analytics, all in one place.

> Live Demo: [hire-map-ai.vercel.app](https://hire-map-ai.vercel.app)

---

## 📌 Table of Contents

- [About the Project](#about-the-project)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Subscription Tiers](#subscription-tiers)
- [Automated Scraper](#automated-scraper)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🧠 About the Project

HireMap AI is a full-stack career platform that helps job seekers in India find relevant opportunities, prepare for interviews, and plan their learning journey — all powered by AI.

The core idea is simple: upload your resume, tell HireMap your target role, and it handles the rest. It scrapes live jobs from Naukri.com daily, matches them to your profile using vector embeddings, prepares you for interviews with an AI recruiter, and generates personalized skill roadmaps.

---

## ✨ Key Features

### 🤖 AI Job Matching (Hybrid Engine)
- **Stage 1 — Vector Search**: User profile and job descriptions are both converted to 384-dimensional embeddings using `sentence-transformers/all-MiniLM-L6-v2`. Cosine similarity is calculated, and jobs scoring below 35% are filtered out.
- **Stage 2 — LLM Re-ranking**: The shortlisted jobs are sent to `llama-3.1-8b-instant` (via Groq) for a second opinion — it checks for transferable skills and domain fit, and adds a human-readable recommendation reason to each match.

### 📄 Resume Parser & Onboarding
- Upload a PDF resume → `PyPDF2` extracts raw text → Groq AI generates a rich candidate persona and extracts skills in JSON format.
- User sets target role, preferred cities, and minimum salary → a "Super Vector" is computed and stored in Supabase for matching.

### 🎤 Mock Interview Agent
- A conversational AI interviewer powered by `llama-3.1-8b-instant` conducts a realistic mock interview for any job role.
- Full chat history is maintained per session.
- After the session, a separate `/evaluate-interview` endpoint scores the candidate (0–100), lists strengths and weaknesses, gives feedback, and returns a hire/reject decision.

### 🗺️ Interactive Skill Roadmap
- Input any skill (e.g., "Machine Learning", "React") → AI generates a 6-phase, project-based learning roadmap.
- Each phase includes 3 learning tasks + 1 hands-on mini project.
- Phase 6 is always a capstone project with a creative name.
- Progress is tracked per user and synced to Supabase.

### 📊 AI Career Analyzer
- Analyzes your resume against any target domain.
- Returns: match confidence score, readiness tier, skill gaps (with High/Med/Low importance), recommended courses, project ideas, alternative roles, and estimated prep time.
- Uses `llama-3.3-70b-versatile` with `temperature=0.0` and `seed=42` for deterministic, consistent output.

### 💬 AI Career Counselor (Chat)
- A context-aware chatbot that knows your skills and target role.
- Answers questions about career transitions, interview prep, projects, and more.
- Chat history is managed per session in the frontend using Zustand.

### 📈 Market Trends
- Fetches daily AI-predicted tech trends (Booming Now + Future Tech).
- Results are cached to a local JSON file for 24 hours to avoid redundant API calls.

### 💳 Subscription & Payments
- Integrated with **Razorpay** for INR payments.
- Payment signature is verified server-side using HMAC-SHA256.
- On successful payment, user tier and subscription expiry are updated in Supabase.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Framer Motion, Zustand |
| **Routing** | React Router v7 |
| **UI Components** | Lucide React, React Icons, Recharts, React Simple Maps |
| **Backend** | FastAPI (Python), Pydantic, Uvicorn |
| **AI / LLM** | Groq API (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`) |
| **Embeddings** | `sentence-transformers` (`all-MiniLM-L6-v2`) |
| **Database & Auth** | Supabase (PostgreSQL + Auth) |
| **Payments** | Razorpay |
| **Web Scraping** | Selenium, BeautifulSoup4, webdriver-manager |
| **PDF Parsing** | PyPDF2 |
| **Automation** | GitHub Actions (daily cron job) |
| **Deployment** | Vercel (Frontend) |

---

## 📁 Project Structure

```
HireMap-AI/
│
├── .github/
│   └── workflows/
│       └── scraper.yml          # Daily automated Naukri scraper (runs 2 AM IST)
│
├── backend/
│   ├── main.py                  # FastAPI app — all API routes (9 sections)
│   ├── naukri_scrapper.py       # Selenium scraper for Naukri.com
│   ├── clean_duplicates.py      # Utility to deduplicate jobs in Supabase
│   ├── fix_jds.py               # Utility to reformat existing job descriptions
│   └── requirements.txt         # Python dependencies
│
├── frontend/
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── assets/              # Images (hero.png, etc.)
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Supabase auth (signIn, signUp, signOut)
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx   # Sidebar + Navbar wrapper
│   │   ├── pages/
│   │   │   ├── Landing.jsx      # Public homepage
│   │   │   ├── Login.jsx        # Auth page
│   │   │   ├── Signup.jsx       # Auth page
│   │   │   ├── Onboarding.jsx   # Resume upload + profile setup
│   │   │   ├── Dashboard.jsx    # User dashboard
│   │   │   ├── Jobs.jsx         # Job listings + AI matching
│   │   │   ├── Resume.jsx       # AI Career Analyzer
│   │   │   ├── Roadmap.jsx      # Interactive skill roadmap
│   │   │   ├── Trends.jsx       # Market trends
│   │   │   ├── Chat.jsx         # AI counselor chat
│   │   │   ├── InterviewHub.jsx # Mock interview agent
│   │   │   ├── Profile.jsx      # User profile settings
│   │   │   └── Pricing.jsx      # Subscription plans + Razorpay
│   │   ├── services/
│   │   │   └── supabase.js      # Supabase client initialization
│   │   ├── store/
│   │   │   └── useAppStore.js   # Zustand global state
│   │   ├── App.jsx              # Routes + ProtectedRoute logic
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # Global styles
│   ├── package.json
│   └── vite.config.js
│
├── package.json                 # Root-level (Zustand only)
├── requirements.txt             # Root-level Python deps (for GitHub Actions)
└── .gitignore
```

---

## 🏗️ Architecture Overview

```
User Browser (React + Vite)
        │
        ├── Supabase Auth  ──────────────────────────────┐
        │                                                 │
        └── FastAPI Backend                              Supabase DB
                │                                   (job_seekers, jobs,
                ├── /register-seeker ──► PyPDF2 + Groq    user_roadmaps)
                ├── /complete-onboarding ─► SentenceTransformer
                ├── /match-jobs ─────────► Vector Search + Groq LLM
                ├── /start-mock-interview ► Groq (llama-3.1-8b)
                ├── /evaluate-interview ──► Groq (llama-3.1-8b)
                ├── /analyze-career ──────► Groq (llama-3.3-70b)
                ├── /market-trends ───────► Groq + Local File Cache
                ├── /add-to-roadmap ──────► Groq (llama-3.1-8b)
                └── /create-order ────────► Razorpay API
                    /verify-payment ──────► HMAC Verification

GitHub Actions (Daily 2 AM IST)
        └── naukri_scrapper.py
                └── Selenium → Naukri.com → BeautifulSoup → SentenceTransformer → Supabase
```

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **Google Chrome** (for Selenium scraper)
- A **Supabase** project
- A **Groq** API key (free tier available at console.groq.com)
- A **Razorpay** account (test mode works fine)

---

### Backend Setup

```bash
# 1. Clone the repo
git clone https://github.com/rounak-jain01/HireMap-AI.git
cd HireMap-AI

# 2. Create a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Also install FastAPI and server dependencies
pip install fastapi uvicorn PyPDF2 razorpay python-multipart

# 5. Create your .env file in the root directory (see Environment Variables below)

# 6. Start the backend server
uvicorn backend.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

---

### Frontend Setup

```bash
# From the project root
cd frontend

# Install dependencies
npm install

# Create .env file (see Environment Variables below)

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

### Environment Variables

**Backend** — create a `.env` file in the project root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GROQ_API_KEY=your_groq_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

**Frontend** — create a `.env` file inside the `frontend/` folder:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
VITE_BACKEND_URL=http://localhost:8000
```

> ⚠️ **Important**: Use the **Service Role Key** for the backend (full DB access) and the **Anon Key** for the frontend (public, row-level security applies).

---

## 📡 API Reference

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |

### User & Profile

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register-seeker` | Upload PDF resume → extract skills & persona via Groq |
| `POST` | `/complete-onboarding` | Save full user profile + generate vector embedding |
| `GET` | `/get-profile?email=` | Fetch user profile (embedding excluded) |
| `POST` | `/update-profile` | Update preferences; auto-regenerates vector if role changes |

### Jobs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/get-all-jobs` | Fetch all jobs (no AI matching, up to 1000) |
| `POST` | `/add-job` | Admin: add a job with auto-formatted JD + vector |
| `GET` | `/match-jobs?email=` | Hybrid AI job matching (vector + LLM re-rank) |

### AI Features

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analyze-career?email=&target_domain=` | AI career gap analysis |
| `POST` | `/ask-hiremap-ai` | Conversational career chatbot |
| `GET` | `/market-trends` | Daily cached AI-predicted tech trends |

### Mock Interview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/start-mock-interview` | Conduct a mock interview turn (multi-turn) |
| `POST` | `/evaluate-interview` | Get full evaluation report for completed interview |

### Roadmap

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/add-to-roadmap` | Generate a 6-phase skill roadmap + save to DB |
| `GET` | `/get-user-roadmap?email=` | Fetch all saved roadmaps for a user |
| `POST` | `/update-roadmap-step?roadmap_id=` | Sync roadmap progress |

### Payments

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/create-order` | Create a Razorpay order |
| `POST` | `/verify-payment` | Verify signature + upgrade user tier in DB |

---

## 🗃️ Database Schema

Two main tables are used in Supabase:

**`job_seekers`**
```
id, email, full_name, resume_text, extracted_skills (array),
user_embedding (vector), target_role, min_expected_salary,
preferred_locations (array), subscription_tier (free/pro/elite),
subscription_id, subscription_expiry, mock_interviews_done,
ai_chat_queries, created_at
```

**`jobs`**
```
id, job_title, company_name, city, domain, job_description,
skills_required (array), experience, salary, job_url,
date_posted, job_meta (json), job_embedding (vector), created_at
```

**`user_roadmaps`**
```
id, user_email, skill_name, roadmap_data (json), progress (int), created_at
```

> The `user_embedding` and `job_embedding` columns store 384-dimensional float vectors from `all-MiniLM-L6-v2`. You may need to enable the `pgvector` extension in Supabase if you want native vector search in the future.

---

## 💰 Subscription Tiers

| Feature | Free | Pro | Elite |
|---|---|---|---|
| AI Job Matches | 3 jobs | Unlimited | Unlimited |
| Mock Interviews | 1 | 10 | Unlimited |
| AI Chat Queries | 5 | Unlimited | Unlimited |
| Career Analyzer | ✅ | ✅ | ✅ |
| Skill Roadmap | ✅ | ✅ | ✅ |
| Market Trends | ✅ | ✅ | ✅ |

Subscription upgrades are processed via Razorpay and stored in the `job_seekers` table with a 30-day expiry.

---

## 🤖 Automated Scraper

The `naukri_scrapper.py` runs automatically every day at **2:00 AM IST** via GitHub Actions (`.github/workflows/scraper.yml`).

**What it does:**
1. Launches a headless Chrome browser with anti-detection settings.
2. Searches Naukri.com for 9 pre-defined domains (ML, Data Analyst, AI Engineer, etc.).
3. Scrapes up to 15 jobs per domain — title, company, location, salary, experience, skills.
4. Visits each individual job page to extract the full job description and metadata.
5. Generates a vector embedding for each job using `all-MiniLM-L6-v2`.
6. Saves everything to the `jobs` table in Supabase.

**To run manually:**
```bash
python backend/naukri_scrapper.py
```

**To trigger via GitHub Actions manually:** Go to Actions tab → `HireMap Daily Scraper` → `Run workflow`.

**Required GitHub Secrets** (set in repo Settings → Secrets):
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
GROQ_API_KEY
```

---

## 🌐 Deployment

### Frontend (Vercel)

```bash
# From the frontend/ directory
npm run build
# Deploy the dist/ folder to Vercel
```

Or connect the GitHub repo to Vercel directly. Set the root directory to `frontend` and add your `VITE_*` environment variables in the Vercel dashboard.

### Backend

The FastAPI backend can be deployed to any Python-compatible platform:

- **Railway** / **Render**: Connect repo, set root to project root, start command: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- **AWS EC2 / DigitalOcean**: Run with `gunicorn` + `uvicorn` workers behind Nginx.

> Note: The `SentenceTransformer` model (`all-MiniLM-L6-v2`, ~90MB) is downloaded on first startup. Make sure the deployment environment has enough RAM (512MB minimum, 1GB recommended).

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request.

Please keep backend routes organized within the existing section comments in `main.py`, and keep frontend pages self-contained with their own local state where possible (use Zustand only for cross-page state).

---

## 📄 License

This project is open source. Feel free to use, modify, and distribute.

---

<p align="center">Built with ❤️ by <a href="https://github.com/rounak-jain01">Rounak Jain</a>, Priyani Rathod, Shivam Kahar</p>