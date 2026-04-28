from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from groq import Groq
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from typing import List, Optional, Any
from datetime import date
import os, random, PyPDF2, io, json, math

# ==========================================
# 📂 SECTION 1: SETUP & GLOBAL CLIENTS
# ==========================================
load_dotenv()

# Initialize FastAPI App
app = FastAPI(title="HireMap AI API", description="Modular Backend for HireMap")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize External Clients
supabase: Client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Initialize ML Engine (Sentence Transformer)
print("Loading AI Model... Please wait ⏳")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("AI Model Loaded! 🚀")


# ==========================================
# 🛠️ SECTION 2: HELPER FUNCTIONS (DRY Principle)
# ==========================================
def get_embedding(text: str) -> list:
    """Text to Vector conversion"""
    return model.encode(text).tolist()

def parse_vector(v: Any) -> list:
    """Safely parse vectors from Supabase"""
    if isinstance(v, str):
        try: return json.loads(v)
        except: return None
    return v

def calculate_similarity(vec1: list, vec2: list) -> float:
    """Cosine similarity between two vectors"""
    if not vec1 or not vec2: return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    mag1, mag2 = math.sqrt(sum(a * a for a in vec1)), math.sqrt(sum(b * b for b in vec2))
    return 0.0 if mag1 == 0 or mag2 == 0 else dot_product / (mag1 * mag2)

def parse_ai_json(raw_content: str) -> dict:
    """Universal cleaner for Llama 3.1 Markdown JSON output"""
    cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned_content)


# ==========================================
# 📦 SECTION 3: PYDANTIC SCHEMAS (Data Models)
# ==========================================
class JobData(BaseModel):
    title: str
    company: str
    city: str
    domain: str

class OnboardingPayload(BaseModel):
    email: str
    full_name: str
    skills: List[str]
    target_role: str
    min_salary: int
    locations: List[str]
    resume_text: Optional[str] = "Manual Profile Entry" 

class UserProfileUpdate(BaseModel):
    email: str
    target_role: Optional[str] = None
    preferred_locations: Optional[List[str]] = None
    min_expected_salary: Optional[int] = None

class ChatRequest(BaseModel):
    email: str
    target_domain: str
    user_question: str

class RoadmapSaveRequest(BaseModel):
    email: str
    skill_name: str

class UpdateRoadmapRequest(BaseModel):
    updated_data: List[Any]
    new_progress: int


# ==========================================
# 🧑‍💻 SECTION 4: USER & PROFILE ROUTES
# ==========================================
@app.get("/")
def read_root():
    return {"message": "Welcome to HireMap API! System is running 🚀"}

@app.post("/register-seeker")
async def register_seeker(email: str = Form(default="unknown"), file: UploadFile = File(...)):
    """Extracts text from PDF and gets skills via Groq AI"""
    try:
        content = await file.read()
        resume_text = "".join(page.extract_text() for page in PyPDF2.PdfReader(io.BytesIO(content)).pages)

        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Extract skills and summary. Return valid JSON with 'skills' (array) and 'summary' (string)."},
                {"role": "user", "content": f"Resume Text: {resume_text}"}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )
        
        data = parse_ai_json(chat.choices[0].message.content)
        
        return {
            "status": "Success", 
            "resume_text": resume_text,
            "extracted_skills": data.get('skills', []),
            "summary": data.get('summary', '')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete-onboarding")
def complete_onboarding(payload: OnboardingPayload):
    """Saves user profile and generates vector embeddings"""
    try:
        skills_text = ", ".join(payload.skills) if payload.skills else "Beginner"
        user_data = {
            "email": payload.email, "full_name": payload.full_name,
            "resume_text": payload.resume_text, "extracted_skills": payload.skills,
            "user_embedding": get_embedding(skills_text), "target_role": payload.target_role,
            "min_expected_salary": payload.min_salary, "preferred_locations": payload.locations
        }

        if supabase.table("job_seekers").select("id").eq("email", payload.email).execute().data:
            supabase.table("job_seekers").update(user_data).eq("email", payload.email).execute()
        else:
            supabase.table("job_seekers").insert(user_data).execute()
        return {"status": "success", "message": "Profile Saved Perfectly! 🎯"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/get-profile")
def get_user_profile(email: str = Query(...)):
    """Fetch user profile without sensitive embeddings"""
    try:
        res = supabase.table("job_seekers").select("*").eq("email", email).execute()
        if not res.data: return {"status": "error", "message": "User profile not found"}
        
        user_data = res.data[0]
        user_data.pop("user_embedding", None) # Hide embedding from frontend
        return {"status": "success", "data": user_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/update-profile")
def update_user_profile(profile: UserProfileUpdate):
    """Update specific user preferences"""
    try:
        update_data = {k: v for k, v in profile.dict().items() if v is not None and k != "email"}
        if not update_data: return {"status": "No data provided"}
        response = supabase.table("job_seekers").update(update_data).eq("email", profile.email).execute()
        return {"status": "Success", "updated_data": response.data[0] if response.data else None}
    except Exception as e:
        return {"error": str(e)}


# ==========================================
# 💼 SECTION 5: JOB MATCHING ROUTES
# ==========================================
@app.post("/add-job")
def add_new_job(job: JobData):
    """Admin route to add jobs with vectors"""
    try:
        ai_vector = get_embedding(f"{job.title} at {job.company} in {job.domain} domain. Located in {job.city}.")
        supabase.table("jobs").insert({**job.dict(), "job_embedding": ai_vector}).execute()
        return {"message": "Job saved with ML Vector!"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/match-jobs")
def get_matched_jobs(email: str = Query(...)):
    """The Ultimate AI Matchmaker logic"""
    try:
        user_res = supabase.table("job_seekers").select("user_embedding").eq("email", email).execute()
        if not user_res.data: return {"status": "error", "message": "User not found"}
        
        user_vector = parse_vector(user_res.data[0].get("user_embedding"))
        all_jobs = supabase.table("jobs").select("*").execute().data
        
        for job in all_jobs:
            job_vector = parse_vector(job.get("job_embedding")) 
            if user_vector and job_vector:
                sim = calculate_similarity(user_vector, job_vector)
                # Fair Scaling (0.25 to 0.70 threshold)
                job["matchScore"] = 0 if sim <= 0.25 else 100 if sim >= 0.70 else int(((sim - 0.25) / 0.45) * 100)
            else:
                job["matchScore"] = 0 
                
        random.shuffle(all_jobs) # Fresh UI feel
        return {"status": "success", "jobs": all_jobs}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==========================================
# 🤖 SECTION 6: AI FEATURES (Chat, Trends, Analysis)
# ==========================================
@app.get("/analyze-career")
def analyze_career(email: str, target_domain: str):
    """AI Resume Auditor"""
    try:
        user_data = supabase.table("job_seekers").select("extracted_skills").eq("email", email).execute()
        skills_str = ", ".join(user_data.data[0].get('extracted_skills', [])) if user_data.data else "None"

        prompt = f"""You are a Career Counselor. Candidate skills: {skills_str}. Target: {target_domain}.
        Return ONLY valid JSON with keys: match_confidence_score (int), readiness_tier (string), skill_gap_analysis (array of objects), learning_resources (array of objects), recommended_projects (array of objects), alternative_roles (array), estimated_preparation_time (string), expert_advice (string)."""

        chat = client.chat.completions.create(
            messages=[{"role": "system", "content": "Strict JSON API."}, {"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant", response_format={"type": "json_object"}
        )
        return {"status": "Success", "target_role": target_domain, "analysis": parse_ai_json(chat.choices[0].message.content)}
    except Exception as e:
        return {"error": str(e)}

@app.post("/ask-hiremap-ai")
def ask_hiremap_ai(request: ChatRequest):
    """Context-aware Career Chatbot"""
    try:
        user_data = supabase.table("job_seekers").select("extracted_skills").eq("email", request.email).execute()
        skills = ", ".join(user_data.data[0].get('extracted_skills', [])) if user_data.data else "Beginner"

        prompt = f"You are HireMap AI. User skills: {skills}. Goal: {request.target_domain}. Answer their question concisely and highly actionably."
        chat = client.chat.completions.create(
            messages=[{"role": "system", "content": prompt}, {"role": "user", "content": request.user_question}],
            model="llama-3.1-8b-instant"
        )
        return {"status": "success", "reply": chat.choices[0].message.content}
    except Exception as e:
        return {"error": str(e)}

TRENDS_CACHE_FILE = "daily_trends_cache.json"
@app.get("/market-trends")
def get_market_trends():
    """Daily Cached Market Predictor"""
    try:
        today_str = date.today().isoformat()
        if os.path.exists(TRENDS_CACHE_FILE):
            try:
                with open(TRENDS_CACHE_FILE, "r") as f:
                    cache = json.load(f)
                    if cache.get("date") == today_str: return {"status": "success", "data": cache.get("data", [])}
            except: pass

        prompt = 'Predict top 5 tech trends. 2 "Booming Now", 3 "Future Tech". Return valid JSON with "trends" array containing id, title, category, icon_name, color, growth, description, skills (array), courses (array).'
        chat = client.chat.completions.create(
            messages=[{"role": "system", "content": "Strict JSON API."}, {"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant", response_format={"type": "json_object"}
        )
        
        trends = parse_ai_json(chat.choices[0].message.content).get("trends", [])
        with open(TRENDS_CACHE_FILE, "w") as f: json.dump({"date": today_str, "data": trends}, f)
        return {"status": "success", "data": trends}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ==========================================
# 🗺️ SECTION 7: INTERACTIVE ROADMAP ROUTES
# ==========================================
@app.post("/add-to-roadmap")
def add_to_roadmap(req: RoadmapSaveRequest):
    """Generates a 6-step project-based roadmap"""
    try:
        prompt = f"""Generate a 6-step roadmap for: {req.skill_name}.
        Steps 1-5 MUST have exactly 4 tasks (3 learning, 1 '🛠️ Project:').
        Step 6 MUST be '🏆 Final Capstone Project' with 3-4 project execution tasks.
        Return ONLY valid JSON with a single key 'steps'."""
        
        chat = client.chat.completions.create(
            messages=[{"role": "system", "content": "Strict JSON API."}, {"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant", response_format={"type": "json_object"}
        )
        
        roadmap_json = parse_ai_json(chat.choices[0].message.content).get("steps", [])
        
        supabase.table("user_roadmaps").insert({
            "user_email": req.email, "skill_name": req.skill_name,
            "roadmap_data": roadmap_json, "progress": 0
        }).execute()
        return {"status": "success", "message": f"{req.skill_name} added to your Roadmap!"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/get-user-roadmap")
def get_user_roadmap(email: str):
    """Fetch saved roadmaps for a user"""
    try:
        res = supabase.table("user_roadmaps").select("*").eq("user_email", email).order("created_at", desc=True).execute()
        return {"status": "success", "data": res.data}
    except Exception as e:
        return {"status": "error", "data": []}

@app.post("/update-roadmap-step")
def update_roadmap_step(roadmap_id: str, payload: UpdateRoadmapRequest):
    """Silently sync roadmap progress"""
    try:
        supabase.table("user_roadmaps").update({
            "roadmap_data": payload.updated_data, "progress": payload.new_progress
        }).eq("id", roadmap_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}