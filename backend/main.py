import os
import io
import json
import math
import hmac
import hashlib
from datetime import date, datetime, timedelta
from typing import List, Optional, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import PyPDF2
import pdfplumber
import razorpay
from supabase import create_client, Client
from groq import Groq
from sentence_transformers import SentenceTransformer

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# ==========================================
# 📂 SECTION 1: SETUP & GLOBAL CLIENTS
# ==========================================
load_dotenv()

# Initialize FastAPI App
app = FastAPI()

# Load Environment Variables securely
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Initialize External Clients
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
client = Groq(api_key=GROQ_API_KEY)

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        except Exception: return None
    return v

def calculate_similarity(vec1: list, vec2: list) -> float:
    """Cosine similarity between two vectors"""
    if not vec1 or not vec2: return 0.0
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    mag1, mag2 = math.sqrt(sum(a * a for a in vec1)), math.sqrt(sum(b * b for b in vec2)) #Formula for ca
    return 0.0 if mag1 == 0 or mag2 == 0 else dot_product / (mag1 * mag2)

def parse_ai_json(raw_content: str) -> dict:
    """Universal cleaner - handles markdown fences AND unexpected list-wrapped responses"""
    cleaned_content = raw_content.replace("```json", "").replace("```", "").strip()
    parsed = json.loads(cleaned_content)
    
    if isinstance(parsed, list):
        print("⚠️ WARNING: LLM returned a list instead of dict, extracting first element")
        return parsed[0] if parsed and isinstance(parsed[0], dict) else {}
    
    if not isinstance(parsed, dict):
        print("⚠️ WARNING: LLM returned unexpected type:", type(parsed))
        return {}
    
    return parsed


def extract_resume_text(file_bytes: bytes) -> str:
    """Better PDF extraction using pdfplumber - handles layouts better than PyPDF2"""
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


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

class AskMapRequest(BaseModel):
    email: str
    target_domain: str
    user_question: str
    chat_history: Optional[List[dict]] = []

class MockInterviewRequest(BaseModel):
    email: str
    job_title: str
    job_description: str
    user_answer: Optional[str] = ""
    chat_history: List[dict] = []

class EvaluateInterviewRequest(BaseModel):
    email: str
    job_title: str
    chat_history: List[dict]

class OrderRequest(BaseModel):
    amount: int  # Amount in Paisa (499 * 100)
    currency: str = "INR"

class VerifyRequest(BaseModel):
    email: str
    tier: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ==========================================
# 🚀 SECTION 4: SYSTEM & PAYMENT ROUTES
# ==========================================
@app.get("/api/health")
def read_root():
    return {"message": "Welcome to HireMap API! System is running 🚀"}

@app.post("/create-order")
async def create_order(req: OrderRequest):
    try:
        order_data = {
            "amount": req.amount,
            "currency": req.currency,
            "payment_capture": 1 # Auto-capture
        }
        razor_order = razorpay_client.order.create(data=order_data)
        return {"status": "success", "order": razor_order}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/verify-payment")
async def verify_payment(req: VerifyRequest):
    try:
        # Step 1: Verify Signature
        body = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
        expected_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            body.encode(),
            hashlib.sha256
        ).hexdigest()

        if expected_signature != req.razorpay_signature:
            return {"status": "error", "message": "Invalid Signature"}

        # Step 2: Update Supabase (job_seekers table)
        expiry_date = (datetime.now() + timedelta(days=30)).isoformat()
        
        # Profile Update Logic
        response = supabase.table("job_seekers").update({
            "subscription_tier": req.tier,
            "subscription_id": req.razorpay_payment_id,
            "subscription_expiry": expiry_date
        }).eq("email", req.email).execute()

        return {"status": "success", "message": f"Welcome to {req.tier.upper()}!"}

    except Exception as e:
        print("Payment Error:", e)
        return {"status": "error", "message": str(e)}


# ==========================================
# 🧑‍💻 SECTION 5: USER & PROFILE ROUTES
# ==========================================
@app.post("/register-seeker")
async def register_seeker(email: str = Form(default="unknown"), file: UploadFile = File(...)):
    """Extracts text from PDF and generates a Rich Persona + Skills via Groq AI"""
    try:
        content = await file.read()
        # resume_text = "".join(page.extract_text() for page in PyPDF2.PdfReader(io.BytesIO(content)).pages)
        resume_text = extract_resume_text(content)

        prompt = f"""
Read the entire resume text carefully. Return ONLY a valid JSON OBJECT (not an array).

The response MUST be structured EXACTLY like this (a single JSON object at the root level):
{{
    "skills": ["skill1", "skill2", ...],
    "rich_persona": "detailed paragraph here..."
}}

DO NOT wrap this object inside an array. DO NOT return multiple objects.

Resume Text: {resume_text[:3000]} 
"""

        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an elite HR Profiler. Extract data into strictly valid JSON."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )
        
        data = parse_ai_json(chat.choices[0].message.content)
        
        return {
            "status": "Success", 
            "resume_text": resume_text,
            "extracted_skills": data.get('skills', []),
            "summary": data.get('rich_persona', '') 
        }
    except Exception as e:
        print("❌ CRITICAL ERROR IN PARSER:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/complete-onboarding")
def complete_onboarding(payload: OnboardingPayload):
    """Saves user profile and generates vector embeddings"""
    try:
        skills_text = ", ".join(payload.skills) if payload.skills else "Beginner"
        
        # Super Vector logic
        ai_text_for_vector = f"Target Role: {payload.target_role}. Core Skills: {skills_text}. Profile Summary: {payload.resume_text[:1500]}"
        embedding = get_embedding(ai_text_for_vector)

        # 🚀 SUBSCRIPTION ADDED: Default values for free user
        user_data = {
            "email": payload.email, "full_name": payload.full_name,
            "resume_text": payload.resume_text, "extracted_skills": payload.skills,
            "user_embedding": embedding, "target_role": payload.target_role,
            "min_expected_salary": payload.min_salary, "preferred_locations": payload.locations,
            "subscription_tier": "free", 
            "mock_interviews_done": 0, 
            "ai_chat_queries": 0
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
        user_data.pop("user_embedding", None)
        return {"status": "success", "data": user_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/update-profile")
def update_user_profile(profile: UserProfileUpdate):
    """Update specific user preferences AND automatically rebuild AI Vector if Role changes"""
    try:
        print(f"⚙️ Updating preferences for: {profile.email}")
        
        update_data = {k: v for k, v in profile.dict().items() if v is not None and k != "email"}
        if not update_data: return {"status": "No data provided"}

        if "target_role" in update_data:
            print("🔄 Target Role changed! Regenerating Super Vector...")
            user_res = supabase.table("job_seekers").select("extracted_skills, resume_text").eq("email", profile.email).execute()
            
            if user_res.data:
                old_data = user_res.data[0]
                skills_list = old_data.get("extracted_skills", [])
                skills_text = ", ".join(skills_list) if skills_list else "General"
                persona = old_data.get("resume_text", "")
                
                new_ai_text = f"Target Role: {update_data['target_role']}. Core Skills: {skills_text}. Profile Summary: {persona[:1500]}"
                
                update_data["user_embedding"] = get_embedding(new_ai_text)
                print("✅ New Super Vector generated successfully!")

        response = supabase.table("job_seekers").update(update_data).eq("email", profile.email).execute()
        
        return {"status": "Success", "updated_data": response.data[0] if response.data else None}
        
    except Exception as e:
        print("❌ ERROR IN UPDATING PROFILE:", str(e))
        return {"error": str(e)}


# ==========================================
# 💼 SECTION 6: JOB MATCHING ROUTES
# ==========================================
@app.get("/get-all-jobs")
def get_all_jobs(limit: int = 1000):
    """Fetches all latest jobs without AI matching"""
    try:
        response = supabase.table("jobs").select("*").order("created_at", desc=True).limit(limit).execute()
        jobs = response.data
        
        for job in jobs:
            job.pop("job_embedding", None)
            job["matchScore"] = None
            
        return {"status": "success", "jobs": jobs}
    except Exception as e:
        print("❌ ERROR FETCHING ALL JOBS:", str(e))
        return {"status": "error", "message": str(e)}

def format_jd_with_ai(raw_jd: str) -> str:
    """Uses Llama 3 to structure messy job descriptions into beautiful Markdown."""
    try:
        prompt = f"""
        You are an expert HR Copywriter. Take the following messy, unstructured job description and format it into clean, professional Markdown.
        
        RULES:
        1. Use headers like ### About the Role, ### Key Responsibilities, ### Requirements, etc.
        2. Use bullet points (-) for responsibilities and requirements.
        3. Highlight important keywords using bold (**keyword**).
        4. DO NOT make up any information. Keep the original meaning 100% intact.
        5. DO NOT return any intro text like "Here is the formatted JD". ONLY return the markdown.
        
        Raw Job Description:
        {raw_jd}
        """
        
        chat = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0
        )
        return chat.choices[0].message.content.strip()
    except Exception as e:
        print("AI Formatting Failed:", e)
        return raw_jd

@app.post("/add-job")
def add_new_job(job: JobData):
    """Admin route to add jobs with vectors AND auto-formatting"""
    try:
        clean_jd = format_jd_with_ai(job.job_description)
        job.job_description = clean_jd
        
        ai_vector = get_embedding(f"{job.title} at {job.company} in {job.domain} domain. Located in {job.city}.")
        
        supabase.table("jobs").insert({**job.dict(), "job_embedding": ai_vector}).execute()
        
        return {"message": "Job saved with ML Vector & Perfectly Structured JD!"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/match-jobs")
def get_matched_jobs(email: str = Query(...)):
    """The Hybrid AI Matchmaker: Smart Vector Search + Balanced LLM Reranking"""
    try:
        print(f"🔍 Fetching & Deep Evaluating Jobs for: {email}")
        
        # 🚀 SUBSCRIPTION CHECK: Get tier
        user_res = supabase.table("job_seekers").select("user_embedding, resume_text, target_role, subscription_tier").eq("email", email).execute()
        if not user_res.data: 
            return {"status": "error", "message": "User not found"}
        
        user_data = user_res.data[0]
        user_vector = parse_vector(user_data.get("user_embedding"))
        user_tier = user_data.get("subscription_tier", "free")

        all_jobs = supabase.table("jobs").select("*").limit(1000).execute().data
        
        # 🟢 STAGE 1: Balanced Vector Filtering (Math)
        for job in all_jobs:
            job_vector = parse_vector(job.get("job_embedding")) 
            if user_vector and job_vector:
                sim = calculate_similarity(user_vector, job_vector)
                job["matchScore"] = 0 if sim <= 0.28 else 100 if sim >= 0.75 else int(((sim - 0.28) / 0.47) * 100)
            else:
                job["matchScore"] = 0 
                
        top_jobs = sorted([j for j in all_jobs if j["matchScore"] >= 35], key=lambda x: x["matchScore"], reverse=True)[:15]

        if not top_jobs:
            return {"status": "success", "jobs": []}

        # 🚀 SUBSCRIPTION GATING: Limit jobs for free users
        if user_tier == "free":
            top_jobs = top_jobs[:3]

        # 🟢 STAGE 2: AI Cross-Examination
        print(f"🧠 Llama is analyzing WHY these {len(top_jobs)} jobs fit the user...")
        
        jobs_context = []
        for i, j in enumerate(top_jobs):
            jobs_context.append(f"Job ID {i}: {j['job_title']} at {j['company_name']}. Req: {', '.join(j.get('skills_required', []))}")
        
        prompt = f"""
        You are an Expert AI Career Matchmaker.
        Candidate Target Role: {user_data.get('target_role')}
        Candidate ACTUAL Profile: {str(user_data.get('resume_text'))[:1000]}...
        
        Jobs to evaluate:
        {json.dumps(jobs_context)}
        
        YOUR RULES:
        1. Evaluate if the candidate has the direct skills OR highly transferable skills.
        2. DO NOT hallucinate. 
        3. CRITICAL: Output ONLY a perfectly valid JSON object.
        
        Format exactly like this:
        {{
            "justifications": [
                {{"job_id": 0, "is_match": true, "reason": "Short reason here."}},
                {{"job_id": 1, "is_match": false, "reason": "Domain mismatch."}}
            ]
        }}
        """

        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a precise JSON-generating AI. Only output valid JSON."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"}
        )
        
        evaluation = parse_ai_json(chat.choices[0].message.content).get("justifications", [])
        
        # 🟢 STAGE 3: Final Assembly
        final_jobs = []
        for eval_data in evaluation:
            if eval_data.get("is_match") is True:
                idx = eval_data.get("job_id")
                if idx < len(top_jobs):
                    matched_job = top_jobs[idx]
                    matched_job["ai_recommendation_reason"] = eval_data.get("reason")
                    matched_job.pop("job_embedding", None)
                    final_jobs.append(matched_job)

        return {"status": "success", "jobs": final_jobs, "tier": user_tier}

    except Exception as e:
        print("❌ ERROR FETCHING JOBS:", str(e))
        return {"status": "error", "message": str(e)}


# ==========================================
# 🎤 SECTION 7: THE INTERVIEWER AGENT
# ==========================================
@app.post("/start-mock-interview")
async def start_mock_interview(req: MockInterviewRequest):
    try:
        # 🚀 SUBSCRIPTION GATING START
        user_res = supabase.table("job_seekers").select("subscription_tier, mock_interviews_done").eq("email", req.email).execute()
        if not user_res.data:
            return {"status": "error", "message": "User not found"}
            
        user_data = user_res.data[0]
        tier = user_data.get("subscription_tier", "free")
        interviews_done = user_data.get("mock_interviews_done", 0)

        # Apply check ONLY on fresh interview start (empty chat history)
        if len(req.chat_history) == 0:
            if tier == "free" and interviews_done >= 1:
                return {"status": "limit_reached", "message": "Free plan allows only 1 Mock Interview. Please upgrade to Pro."}
            elif tier == "pro" and interviews_done >= 10:
                return {"status": "limit_reached", "message": "Pro plan allows 10 Mock Interviews. Please upgrade to Elite."}
            
            # Limit check pass, increment counter
            supabase.table("job_seekers").update({"mock_interviews_done": interviews_done + 1}).eq("email", req.email).execute()
        # 🚀 SUBSCRIPTION GATING END

        system_prompt = f"""You are a warm, professional, and highly realistic Technical Recruiter interviewing a candidate for the '{req.job_title}' role.
Here is the Job Description summary: {req.job_description}

RULES FOR YOU:
1. THE INTRO: If the user hasn't said anything yet (start of the interview), YOU MUST start by warmly introducing yourself as the Hiring Manager, giving a short 1-2 sentence exciting intro about the company and the role, and then asking the candidate to introduce themselves.
2. Ask ONLY ONE question at a time.
3. BE HUMAN: Acknowledge their answers naturally (e.g., "That makes sense," "I love that approach," "Interesting") before asking the next question.
4. Keep your responses conversational and brief. NO formatting, NO bullet points. Talk exactly like a human having a Zoom interview."""

        messages = [{"role": "system", "content": system_prompt}]
        
        # Pichli baatein add karo (Context)
        for msg in req.chat_history:
            messages.append(msg)
            
        # Naya user answer add karo (Agar hai toh)
        if req.user_answer:
            messages.append({"role": "user", "content": req.user_answer})

        # Calling Groq API
        chat_completion = client.chat.completions.create(
            messages=messages,
            model="llama-3.1-8b-instant", 
            temperature=0.6,
            max_tokens=200
        )

        ai_reply = chat_completion.choices[0].message.content

        return {"status": "success", "reply": ai_reply}

    except Exception as e:
        print("Interviewer Error:", e)
        return {"status": "error", "message": str(e)}


@app.post("/evaluate-interview")
async def evaluate_interview(req: EvaluateInterviewRequest):
    try:
        # Extracting just the text from the chat history
        transcript = ""
        for msg in req.chat_history:
            role = "Interviewer" if msg["role"] == "assistant" else "Candidate"
            transcript += f"{role}: {msg['content']}\n\n"

        system_prompt = f"""You are a Senior Hiring Manager evaluating a candidate for the '{req.job_title}' role. 
Review the following interview transcript and provide a brutal, honest, and constructive evaluation.

You MUST return the output ONLY as a valid JSON object with the following structure:
{{
    "score": <number between 0 and 100>,
    "strengths": ["point 1", "point 2"],
    "weaknesses": ["point 1", "point 2"],
    "feedback": "<A short paragraph of overall advice>",
    "decision": "<Hire, Strong Hire, or Reject>"
}}

TRANSCRIPT:
{transcript}
"""

        # Call Groq API with JSON mode
        chat_completion = client.chat.completions.create(
            messages=[{"role": "system", "content": system_prompt}],
            model="llama-3.1-8b-instant",
            temperature=0, # Low temp for factual JSON
            response_format={"type": "json_object"}
        )

        evaluation_json_str = chat_completion.choices[0].message.content
        evaluation_data = json.loads(evaluation_json_str)

        return {"status": "success", "evaluation": evaluation_data}

    except Exception as e:
        print("Evaluation Error:", e)
        return {"status": "error", "message": str(e)}


# ==========================================
# 🤖 SECTION 8: AI FEATURES (Chat, Trends, Analysis)
# ==========================================
@app.get("/analyze-career")
def analyze_career(email: str, target_domain: str):
    """AI Resume Auditor - STRICT & DETERMINISTIC"""
    try:
        user_data = supabase.table("job_seekers").select("extracted_skills, resume_text").eq("email", email).execute()
        
        if not user_data.data: 
            return {"status": "error", "message": "User not found"}
            
        skills_list = user_data.data[0].get('extracted_skills', [])
        skills_str = ", ".join(skills_list) if skills_list else "None"
        resume_text = user_data.data[0].get('resume_text', 'No background provided.')

        prompt = f"""
        You are a STRICT, BRUTALLY HONEST, AND CONSISTENT Tech Auditor.
        Candidate Profile: {str(resume_text)[:1500]}
        Target Role: {target_domain}
        
        RULES:
        1. DO NOT HALLUCINATE. Base your score ONLY on exact matching skills.
        2. A completely unrelated transition (e.g. Sales to Data Science) MUST have a score below 20%.
        
        Return ONLY valid JSON with EXACTLY these keys:
        - "match_confidence_score" (int)
        - "readiness_tier" (string)
        - "skill_gap_analysis" (array of objects: {{"skill": "Name", "importance": "High/Med/Low"}})
        - "learning_resources" (array of objects: {{"name": "Course Title", "platform": "Coursera/YouTube"}}) 
        - "recommended_projects" (array of objects: {{"title": "Project Name", "description": "Details"}})
        - "alternative_roles" (array of strings)
        - "estimated_preparation_time" (string)
        - "expert_advice" (string)
        """

        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a precise JSON API. Only output valid JSON."}, 
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile", 
            response_format={"type": "json_object"},
            temperature=0.0,
            seed=42 # Seed ensures deterministic logic
        )
        
        return {
            "status": "Success", 
            "target_role": target_domain, 
            "analysis": parse_ai_json(chat.choices[0].message.content)
        }
        
    except Exception as e:
        print("❌ ERROR IN ANALYZER:", str(e))
        return {"error": str(e)}

@app.post("/ask-hiremap-ai")
def ask_hiremap_ai(request: ChatRequest):
    """Context-aware Career Chatbot"""
    try:
        # 🚀 SUBSCRIPTION GATING START
        user_res = supabase.table("job_seekers").select("extracted_skills, subscription_tier, ai_chat_queries").eq("email", request.email).execute()
        if not user_res.data:
            return {"status": "error", "message": "User not found"}
            
        user_data = user_res.data[0]
        tier = user_data.get("subscription_tier", "free")
        queries_done = user_data.get("ai_chat_queries", 0)

        if tier == "free" and queries_done >= 5:
            return {"status": "limit_reached", "message": "Free plan allows only 5 AI queries. Please upgrade to Pro."}
        # 🚀 SUBSCRIPTION GATING END

        skills = ", ".join(user_data.get('extracted_skills', [])) if user_data.get('extracted_skills') else "Beginner"

        prompt = f"You are HireMap AI. User skills: {skills}. Goal: {request.target_domain}. Answer their question concisely and highly actionably."
        chat = client.chat.completions.create(
            messages=[{"role": "system", "content": prompt}, {"role": "user", "content": request.user_question}],
            model="llama-3.1-8b-instant"
        )

        # 🚀 Update Chat Counter
        supabase.table("job_seekers").update({"ai_chat_queries": queries_done + 1}).eq("email", request.email).execute()

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
# 🗺️ SECTION 9: INTERACTIVE ROADMAP ROUTES
# ==========================================
@app.post("/add-to-roadmap")
def add_to_roadmap(req: RoadmapSaveRequest):
    """Generates a 6-step project-based roadmap"""
    try:
        # 🚀 THE FIX: Naya Strict Prompt for Actual Projects!
        prompt = f"""Generate a 6-step learning roadmap for the skill: {req.skill_name}.
        
        RULES FOR JSON OUTPUT:
        - Return ONLY a valid JSON with a single key 'steps' containing an array of 6 step objects.
        - Each step must have a 'title' (string) and 'tasks' (array of strings).
        
        PHASE 1 to 5 (Mini Projects):
        - The 'title' should be the topic name (e.g., 'Phase 1: Basics of Python').
        - Exactly 4 tasks per phase. The first 3 tasks must be learning tasks. 
        - The 4th task MUST be a hands-on project and MUST start exactly with this prefix: "🛠️ Mini Project: [Name of Project]".
        
        PHASE 6 (The Capstone):
        - The 'title' MUST NOT be 'Phase 6'. It MUST be the actual creative name of the final project using this format: "🏆 Capstone: [Creative Project Name]". (e.g., "🏆 Capstone: Bus Reservation System").
        - The 'tasks' in Phase 6 must be the 3-4 step-by-step instructions to build this capstone project.
        """
        
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
    

# ==========================================
# 🖥️ SECTION 10: SERVE REACT FRONTEND (for EXE)
# ==========================================
import sys

def resource_path(relative_path):
    """PyInstaller ke andar bundled files ka correct path dega"""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

frontend_dist = resource_path("frontend_dist")
assets_dir = os.path.join(frontend_dist, "assets")

# ✅ Safe check for local development mode
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    print("⚠️ Running in Pure API Development Mode (Frontend handled separately by Vite)")


# ==========================================
# 🚀 SECTION 11: ENTRY POINT (for EXE)
# ==========================================
if __name__ == "__main__":
    import uvicorn
    import webbrowser
    import threading

    def open_browser():
        webbrowser.open_new("http://127.0.0.1:8000/")

    threading.Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)