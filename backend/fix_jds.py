import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

load_dotenv()

supabase: Client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def format_jd(raw_jd):
    prompt = f"""
    You are an expert HR Copywriter. Take the following messy job description and format it into clean Markdown.
    Use headers (###), bullet points (-), and bold (**text**) for readability.
    DO NOT make up information. NO intro text.
    
    Raw JD:
    {raw_jd}
    """
    chat = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.1-8b-instant",
        temperature=0.2
    )
    return chat.choices[0].message.content.strip()

def run_migration():
    print("🚀 Fetching all jobs from Database...")
    res = supabase.table("jobs").select("id, job_description").limit(1000).execute()
    jobs = res.data
    
    print(f"✅ Found {len(jobs)} jobs. Starting AI Formatting...")
    
    for i, job in enumerate(jobs):
        job_id = job["id"]
        raw_jd = job.get("job_description", "")
        
        # Skip if already formatted (if it contains '###')
        if not raw_jd or "###" in raw_jd:
            print(f"Skipping {job_id} (Already formatted or empty)")
            continue
            
        print(f"[{i+1}/{len(jobs)}] Formatting Job ID: {job_id}...")
        
        try:
            clean_jd = format_jd(raw_jd)
            supabase.table("jobs").update({"job_description": clean_jd}).eq("id", job_id).execute()
            print("   -> Success!")
            
            # API Rate Limit bachane ke liye chota pause (1 second)
            time.sleep(1) 
        except Exception as e:
            print(f"   -> ❌ Failed: {e}")

if __name__ == "__main__":
    run_migration()
    print("🎉 ALL JOBS FORMATTED SUCCESSFULLY!")