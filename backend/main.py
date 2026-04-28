from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from groq import Groq
from sentence_transformers import SentenceTransformer
import os
import random
from dotenv import load_dotenv
import PyPDF2
import io
import json
from typing import List, Optional, Any
import math
from datetime import date

# ==========================================
# 1. SETUP & CONFIGURATIONS
# ==========================================
load_dotenv()

supabase: Client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

app = FastAPI(title="HireMap AI API")

# --- CORS BLOCK ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. LOCAL ML ENGINE (OPTIMIZED)
# ==========================================
print("Loading AI Model... Please wait ⏳")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("AI Model Loaded! 🚀")

def get_embedding(text: str):
    """Text ko vector numbers ki list mein convert karta hai"""
    vector = model.encode(text)
    return vector.tolist()

def parse_vector(v):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return None
    return v

def calculate_similarity(vec1, vec2):
    if not vec1 or not vec2:
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)

# ==========================================
# 3. DATA MODELS
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

class ChatRequest(BaseModel):
    email: str
    target_domain: str
    user_question: str

class UserProfileUpdate(BaseModel):
    email: str
    target_role: Optional[str] = None
    preferred_locations: Optional[List[str]] = None
    min_expected_salary: Optional[int] = None
    open_to_relocation: Optional[bool] = None
    remote_only: Optional[bool] = None

class RoadmapSaveRequest(BaseModel):
    email: str
    skill_name: str

class UpdateRoadmapRequest(BaseModel):
    updated_data: List[Any]
    new_progress: int

# ==========================================
# 4. API ROUTES
# ==========================================

@app.get("/")
def read_root():
    return {"message": "Welcome to HireMap API! System is running 🚀"}

@app.post("/add-job")
def add_new_job(job: JobData):
    try:
        job_text_for_ai = f"{job.title} at {job.company} in {job.domain} domain. Located in {job.city}."
        ai_vector = get_embedding(job_text_for_ai)

        response = supabase.table("jobs").insert({
            "job_title": job.title,
            "company_name": job.company,
            "city": job.city,
            "domain": job.domain,
            "job_embedding": ai_vector
        }).execute()
        
        return {"message": "Job saved successfully with ML Vector!"}
    except Exception as e:
        return {"error_message": "System error!", "exact_error": str(e)}

@app.post("/register-seeker")
async def register_seeker(
    email: str = Form(default="unknown"), 
    file: UploadFile = File(...)          
):
    print(f"--- 🚀 Starting AI Resume Parsing for {email} ---")
    try:
        content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        resume_text = "".join(page.extract_text() for page in pdf_reader.pages)
        print("✅ 1. PDF Read: Success")

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Extract skills and summary. Return ONLY a valid JSON with 'skills' (array of strings) and 'summary' (string)."},
                {"role": "user", "content": f"Resume Text: {resume_text}"}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )
        
        # 🚀 THE FIX: Clean Markdown before parsing
        raw_content = chat_completion.choices[0].message.content
        cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned_content)
        
        extracted_skills = data.get('skills', [])
        print(f"🧠 2. Groq AI: Success. Found {len(extracted_skills)} skills.")

        print("📤 3. Sending extracted data back to React Frontend...")
        return {
            "status": "Success", 
            "resume_text": resume_text,
            "extracted_skills": extracted_skills,
            "summary": data.get('summary', '')
        }

    except Exception as e:
        print("❌ CRITICAL ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete-onboarding")
def complete_onboarding(payload: OnboardingPayload):
    try:
        print(f"🚀 Processing Profile for: {payload.full_name} ({payload.email})")
        
        skills_text = ", ".join(payload.skills) if payload.skills else "Beginner"
        embedding = model.encode(skills_text).tolist()

        user_data = {
            "email": payload.email,
            "full_name": payload.full_name,
            "resume_text": payload.resume_text,
            "extracted_skills": payload.skills,
            "user_embedding": embedding,
            "target_role": payload.target_role,
            "min_expected_salary": payload.min_salary,
            "preferred_locations": payload.locations
        }

        existing_user = supabase.table("job_seekers").select("id").eq("email", payload.email).execute()
        if existing_user.data:
            supabase.table("job_seekers").update(user_data).eq("email", payload.email).execute()
        else:
            supabase.table("job_seekers").insert(user_data).execute()

        return {"status": "success", "message": "Profile Saved Perfectly! 🎯"}

    except Exception as e:
        print("❌ ERROR:", str(e))
        return {"status": "error", "message": str(e)}

# --- THE ULTIMATE MATCHMAKER ROUTE ---
@app.get("/match-jobs")
def get_matched_jobs(email: str = Query(...)):
    try:
        print(f"🔍 Fetching Jobs & Matching for: {email}")
        
        user_res = supabase.table("job_seekers").select("*").eq("email", email).execute()
        if not user_res.data:
            return {"status": "error", "message": "User not found"}
        
        user_data = user_res.data[0]
        user_vector = parse_vector(user_data.get("user_embedding"))

        jobs_res = supabase.table("jobs").select("*").execute() 
        all_jobs = jobs_res.data
        
        for job in all_jobs:
            job_vector = parse_vector(job.get("job_embedding")) 
            
            if user_vector and job_vector:
                similarity = calculate_similarity(user_vector, job_vector)
                
                # Fair AI Scaling Logic
                baseline = 0.25
                max_sim = 0.70
                
                if similarity <= baseline:
                    scaled_score = 0
                elif similarity >= max_sim:
                    scaled_score = 100
                else:
                    scaled_score = ((similarity - baseline) / (max_sim - baseline)) * 100
                
                job["matchScore"] = int(scaled_score)
            else:
                job["matchScore"] = 0 
                
        # Shuffle jobs so UI looks fresh and dynamic
        random.shuffle(all_jobs)

        return {"status": "success", "jobs": all_jobs}

    except Exception as e:
        print("❌ ERROR FETCHING JOBS:", str(e))
        return {"status": "error", "message": str(e)}

# --- THE AI CAREER COUNSELOR ROUTE ---
@app.get("/analyze-career")
def analyze_career(email: str, target_domain: str):
    try:
        print(f"🕵️‍♂️ Analyzing career for {email} targeting {target_domain}...")
        
        user_response = supabase.table("job_seekers").select("extracted_skills").eq("email", email).execute()
        
        if not user_response.data:
            return {"error": "User nahi mila. Pehle /register-seeker par jaakar resume upload karein."}
            
        current_skills = user_response.data[0].get('extracted_skills', [])
        
        if not current_skills:
            return {"error": "User ke paas koi skills nahi hain. Resume data missing hai."}

        skills_str = ", ".join(current_skills)
        print(f"Found {len(current_skills)} skills. Asking AI for analysis...")

        counselor_prompt = f"""
        You are an elite, brutally honest Tech Career Counselor and HR Expert. 
        A candidate has the exact following skills: {skills_str}.
        They want to get hired as a: {target_domain}.
        
        Analyze their profile strictly based on facts. DO NOT flatter the candidate. 
        If their current skills are completely unrelated to the target role, the score MUST be below 20.
        
        Return ONLY a valid JSON object with the exact following structure:
        {{

            "match_confidence_score": integer (0 to 100),

            "readiness_tier": string ("Not Ready", "Beginner", "Intermediate", "Interview-Ready"),

            "skill_gap_analysis": [

            {{

            "skill": "Name of missing skill",

            "importance": "High, Medium, or Low",

            "reason": "Short reason why they need this"

            }}

            ],

            "learning_resources": [

            {{

            "skill": "Name of the missing skill",

            "top_youtube_creators": ["Creator 1", "Creator 2"],

            "youtube_link": "https://www.youtube.com/results?search_query=Learn+Exact+Skill+Name",

            "coursera_link": "https://www.coursera.org/search?query=Exact+Skill+Name",

            "udemy_link": "https://www.udemy.com/courses/search/?q=Exact+Skill+Name"

            }}

            ],

            "recommended_projects": [

            {{

            "title": "Project Name",

            "description": "Short description"

            }}

            ],

            "alternative_roles": array of strings,

            "estimated_preparation_time": string,

            "expert_advice": string

            }}

            """

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a precise JSON-generating AI. Only output valid JSON."},
                {"role": "user", "content": counselor_prompt}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )

        # 🚀 THE FIX: Clean Markdown before parsing
        raw_content = chat_completion.choices[0].message.content
        cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
        analysis_result = json.loads(cleaned_content)

        return {
            "status": "Career Analysis Complete! 🎯",
            "target_role": target_domain,
            "analysis": analysis_result
        }

    except Exception as e:
        print("ERROR IN COUNSELING:", str(e))
        return {"error": str(e)}

# --- THE HIREMAP AI CHATBOT ROUTE ---
@app.post("/ask-hiremap-ai")
def ask_hiremap_ai(request: ChatRequest):
    try:
        user_response = supabase.table("job_seekers").select("extracted_skills").eq("email", request.email).execute()
        current_skills = user_response.data[0].get('extracted_skills', []) if user_response.data else []
        skills_str = ", ".join(current_skills) if current_skills else "Beginner"

        system_prompt = f"""
        You are 'HireMap AI', a friendly and expert career mentor. 
        You are talking to a user who has these skills: {skills_str}.
        They are aiming for a career in: {request.target_domain}.
        
        Answer their question directly, keeping their specific skills and goal in mind. 
        Keep the answer concise (2-3 short paragraphs), encouraging, and highly actionable.
        """

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.user_question}
            ],
            model="llama-3.1-8b-instant"
        )

        ai_response = chat_completion.choices[0].message.content

        return {
            "status": "success",
            "reply": ai_response
        }

    except Exception as e:
        print("ERROR IN CHATBOT:", str(e))
        return {"error": str(e)}

# --- THE PERSONALIZATION ROUTE ---
@app.post("/update-profile")
def update_user_profile(profile: UserProfileUpdate):
    try:
        print(f"⚙️ Updating preferences for: {profile.email}")
        
        update_data = {k: v for k, v in profile.dict().items() if v is not None and k != "email"}
        
        if not update_data:
            return {"status": "No data provided to update."}

        response = supabase.table("job_seekers").update(update_data).eq("email", profile.email).execute()

        if not response.data:
            return {"error": "User nahi mila. Pehle resume upload karein."}

        return {
            "status": "Profile Successfully Personalized! 🎛️",
            "updated_data": response.data[0]
        }

    except Exception as e:
        print("ERROR IN UPDATING PROFILE:", str(e))
        return {"error": str(e)}

# --- GET ALL JOBS ROUTE (FALLBACK) ---
@app.get("/get-all-jobs")
def get_jobs(
    user_email: str = None, 
    personalized: bool = False,
    location: str = None,
    min_salary: int = 0
):
    try:
        query = supabase.table("jobs").select("*")
        
        if location:
            query = query.ilike("location", f"%{location}%")
        if min_salary > 0:
            query = query.gte("min_salary", min_salary)
            
        jobs_data = query.execute().data

        if personalized and user_email:
            user = supabase.table("job_seekers").select("user_embedding").eq("email", user_email).single().execute()
            if user.data:
                user_vector = parse_vector(user.data['user_embedding'])
                for job in jobs_data:
                    job_vector = parse_vector(job.get('job_embedding'))
                    if job_vector and user_vector:
                        score = calculate_similarity(user_vector, job_vector)
                        job['match_percentage'] = round(score * 100)
                    else:
                        job['match_percentage'] = 0
                
                jobs_data = sorted(jobs_data, key=lambda x: x.get('match_percentage', 0), reverse=True)

        return {"status": "success", "jobs": jobs_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
# --- THE REAL-TIME (CACHED) MARKET TRENDS ROUTE ---
TRENDS_CACHE_FILE = "daily_trends_cache.json"

@app.get("/market-trends")
def get_market_trends():
    try:
        today_str = date.today().isoformat() # Aaj ki date (e.g. "2026-04-24")
        
        # 🟢 STEP 1: Check if today's cache already exists
        if os.path.exists(TRENDS_CACHE_FILE):
            try:
                with open(TRENDS_CACHE_FILE, "r") as f:
                    cache_data = json.load(f)
                    if cache_data.get("date") == today_str:
                        print("⚡ Returning instantly from CACHE! No AI call needed.")
                        return {"status": "success", "data": cache_data.get("data", [])}
            except Exception as e:
                print("Cache read error:", e)

        # 🟡 STEP 2: If no cache or date changed, call Llama 3.1
        print("📈 Generating NEW real-time market predictions via Llama 3.1...")
        prompt = """
        You are an elite Tech Market Analyst. Predict the top 5 technology career trends for the software/IT industry right now.
        2 MUST be categorized exactly as "Booming Now" and 3 MUST be "Future Tech".
        
        Return ONLY a valid JSON object with a "trends" array containing this exact structure:
        {
            "trends": [
                {
                    "id": 1,
                    "title": "Name of the Tech Trend",
                    "category": "Booming Now", 
                    "icon_name": "FiCpu", // Choose only from: FiCpu, FiCloud, FiShield, FiHexagon, FiMonitor, FiDatabase, FiCode
                    "color": "from-indigo-500 to-purple-500", // Use random tailwind gradients
                    "growth": "+120% YoY",
                    "description": "2 sentences on why this is blowing up.",
                    "skills": ["Skill 1", "Skill 2", "Skill 3"],
                    "courses": [
                        {"name": "Course Title", "platform": "Coursera/Udemy/etc", "type": "Video/Course", "link": "https://www.coursera.org"}
                    ]
                }
            ]
        }
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a precise JSON-generating AI. Only output valid JSON."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )

        # 🚀 THE FIX: Clean Markdown before parsing
        raw_content = chat_completion.choices[0].message.content
        cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
        extracted_data = json.loads(cleaned_content)
        
        trends_array = extracted_data.get("trends", [])

        # 🔵 STEP 3: Save the new data to today's Cache File
        try:
            with open(TRENDS_CACHE_FILE, "w") as f:
                json.dump({"date": today_str, "data": trends_array}, f)
            print("💾 New trends cached for today!")
        except Exception as e:
            print("Cache write error:", e)
        
        return {"status": "success", "data": trends_array}

    except Exception as e:
        print("❌ ERROR IN TRENDS:", str(e))
        return {"status": "error", "message": str(e)}

@app.post("/add-to-roadmap")
def add_to_roadmap(req: RoadmapSaveRequest):
    try:
        print(f"🛠️ Generating Interactive Roadmap for {req.skill_name}...")
        
        prompt = f"""
        Generate a professional, interactive 4-step learning roadmap to master the skill: {req.skill_name}.
        Each step must have exactly 3 sub-tasks.
        
        You MUST return ONLY a JSON object with a single key "steps".
        Example EXACT Format:
        {{
          "steps": [
            {{
              "title": "Step 1: Basics",
              "tasks": [
                {{"task_name": "Learn fundamental syntax", "completed": false}},
                {{"task_name": "Understand core concepts", "completed": false}}
              ]
            }}
          ]
        }}
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a strict JSON API. Output ONLY valid JSON, no markdown, no text."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )
        # AI se raw message lo
        raw_content = chat_completion.choices[0].message.content
        
        # 🚀 THE FIX: Markdown backticks ko saaf karo
        cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
        res_content = json.loads(cleaned_content)
        
        roadmap_json = res_content.get("steps", [])
        
        supabase.table("user_roadmaps").insert({
            "user_email": req.email,
            "skill_name": req.skill_name,
            "roadmap_data": roadmap_json,
            "progress": 0
        }).execute()
        
        return {"status": "success", "message": f"{req.skill_name} added to your Roadmap!"}
    except Exception as e:
        print("ERROR ADDING ROADMAP:", str(e))
        return {"error": str(e)}

# --- 2. GET ROADMAP ROUTE ---
@app.get("/get-user-roadmap")
def get_user_roadmap(email: str):
    try:
        res = supabase.table("user_roadmaps").select("*").eq("user_email", email).order("created_at", desc=True).execute()
        return {"status": "success", "data": res.data}
    except Exception as e:
        print("ERROR FETCHING ROADMAP:", str(e))
        return {"status": "error", "data": []}

# --- 3. UPDATE PROGRESS ROUTE (THE FIX) ---
@app.post("/update-roadmap-step")
def update_roadmap_step(roadmap_id: str, payload: UpdateRoadmapRequest):
    try:
        print(f"💾 Saving progress for roadmap {roadmap_id}: {payload.new_progress}%")
        
        supabase.table("user_roadmaps").update({
            "roadmap_data": payload.updated_data,
            "progress": payload.new_progress
        }).eq("id", roadmap_id).execute()
        
        return {"status": "success"}
    except Exception as e:
        print("❌ ERROR UPDATING PROGRESS:", str(e))
        return {"status": "error", "message": str(e)}
    
# --- GET USER PROFILE ROUTE ---
@app.get("/get-profile")
def get_user_profile(email: str = Query(...)):
    try:
        res = supabase.table("job_seekers").select("*").eq("email", email).execute()
        if not res.data:
            return {"status": "error", "message": "User profile not found"}
        
        user_data = res.data[0]
        # Hide internal embeddings before sending to frontend
        if "user_embedding" in user_data:
            del user_data["user_embedding"]
            
        return {"status": "success", "data": user_data}
    except Exception as e:
        print("❌ ERROR FETCHING PROFILE:", str(e))
        return {"status": "error", "message": str(e)}