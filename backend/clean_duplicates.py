import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Setup Supabase
supabase: Client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))

def remove_duplicates():
    print("🚀 Fetching jobs to identify duplicates...")
    
    # saari jobs fetch karo (Limit 1000 ya jitni tumhari total jobs hain)
    res = supabase.table("jobs").select("id, job_title, company_name, city").limit(1000).execute()
    jobs = res.data
    
    if not jobs:
        print("❌ No jobs found in DB.")
        return

    seen_jobs = {} # Dictionary to track unique jobs
    ids_to_delete = []

    for job in jobs:
        # Unique identifier banao (Title + Company + City)
        # Hum lower case aur strip use kar rahe hain taaki "Google" aur "google" duplicate mane jayein
        identifier = f"{str(job['job_title']).lower().strip()}|{str(job['company_name']).lower().strip()}|{str(job['city']).lower().strip()}"
        
        if identifier in seen_jobs:
            # Agar identifier pehle mil chuka hai, toh is ID ko delete list mein daalo
            ids_to_delete.append(job['id'])
        else:
            # Agar naya hai, toh track karo
            seen_jobs[identifier] = job['id']

    total_duplicates = len(ids_to_delete)
    
    if total_duplicates == 0:
        print("✅ No duplicates found! Your DB is clean.")
        return

    print(f"⚠️ Found {total_duplicates} duplicate jobs. Starting deletion...")

    # Supabase mein bulk delete (IDs ke basis par)
    for i, job_id in enumerate(ids_to_delete):
        try:
            supabase.table("jobs").delete().eq("id", job_id).execute()
            print(f"[{i+1}/{total_duplicates}] Deleted Job ID: {job_id}")
        except Exception as e:
            print(f"❌ Failed to delete {job_id}: {e}")

    print(f"🎉 Cleanup complete! {total_duplicates} duplicates removed.")

if __name__ == "__main__":
    remove_duplicates()