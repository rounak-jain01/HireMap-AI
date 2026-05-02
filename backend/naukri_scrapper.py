from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup, NavigableString
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime
import time, random, re, os

# ==========================================
# 📂 SECTION 1: SETUP & CONFIGURATIONS
# ==========================================
load_dotenv()

# Initialize Supabase
supabase: Client = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))

# Initialize ML Model (Loaded globally to save RAM and Time)
print("Loading AI Embedding Model... ⏳")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
print("AI Model Loaded! 🚀")


# ==========================================
# 🛠️ SECTION 2: WEBDRIVER & UTILS
# ==========================================
def get_driver():
    """Initializes a stealthy headless Chrome WebDriver"""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

def clean_text(text: str) -> str:
    """Removes extra blank lines and spaces"""
    lines = [l.strip() for l in text.splitlines()]
    return "\n".join([l for l in lines if l]).strip()

def dedupe_list(lst: list) -> list:
    """Removes duplicates from a list cleanly"""
    seen = set()
    return [x.strip() for x in lst if x.lower().strip() not in seen and not seen.add(x.lower().strip())]


# ==========================================
# 🧩 SECTION 3: DATA EXTRACTION PARSERS
# ==========================================
def extract_skills(card=None, soup=None) -> list:
    """Extracts required skills from job card or detail page"""
    if card:
        for cls in ["tags-gt", "tags", "skill-tags"]:
            if ul := card.find("ul", class_=cls):
                return dedupe_list([li.get_text(strip=True) for li in ul.find_all("li")])
    if soup:
        for cls in ["key-skill", "keyskills", "chip-lst", "key-skills"]:
            if c := soup.find(["div","ul"], class_=lambda x: x and cls in x.lower()):
                return dedupe_list([t.get_text(strip=True) for t in c.find_all(["li","a"]) if t.get_text(strip=True)])
    return []

def extract_job_meta(soup: BeautifulSoup) -> dict:
    """Extracts role, department, employment type, etc."""
    meta = {"role": "N/A", "industry_type": "N/A", "department": "N/A", "employment_type": "N/A", "education_ug": "N/A"}
    for label_tag in soup.find_all(["label", "strong", "span"]):
        label = label_tag.get_text(strip=True).lower().replace(":", "")
        if value_tag := label_tag.find_next_sibling(["span", "div", "a"]):
            val = value_tag.get_text(strip=True).rstrip(",")
            if "role" == label: meta["role"] = val
            elif "industry type" in label: meta["industry_type"] = val
            elif "employment type" in label: meta["employment_type"] = val
            elif "ug" in label: meta["education_ug"] = val
    return meta

def extract_jd(soup: BeautifulSoup) -> str:
    """Extracts main job description text safely"""
    try:
        jd_div = soup.find("div", class_=lambda c: c and "dang-inner-html" in c)
        if not jd_div: return "JD not found"
        return clean_text(jd_div.get_text(separator="\n"))[:1500] # Limit to 1500 chars to save DB space
    except:
        return "JD not found"


# ==========================================
# 🕸️ SECTION 4: THE CORE SCRAPER ENGINE
# ==========================================
def scrape_naukri(keyword: str, max_jobs: int = 15):
    """Scrapes Naukri for a specific domain across All India"""
    driver = get_driver()
    scraped_jobs = []
    
    # 🚀 THE FIX: Clean URL for All-India Search (No City Attached)
    # Example: "Data Scientist" -> "https://www.naukri.com/data-scientist-jobs"
    formatted_keyword = keyword.strip().replace(" ", "-").lower()
    url = f"https://www.naukri.com/{formatted_keyword}-jobs"
    
    try:
        # Step 1: Get Listing Page
        driver.get(url)
        time.sleep(random.uniform(4, 6))
        soup = BeautifulSoup(driver.page_source, "html.parser")
        job_cards = soup.find_all("div", class_="srp-jobtuple-wrapper") or soup.find_all("div", class_="jobTuple")

        if not job_cards:
            print(f"⚠️ No jobs found for URL: {url}")
            return []

        for card in job_cards[:max_jobs]:
            try:
                title = card.find("a", class_="title")
                comp = card.find("a", class_="comp-name")
                
                date_tag = card.find("span", class_="job-post-day") or card.find("span", class_="date")
                date_posted = date_tag.get_text(strip=True) if date_tag else "Recently"
                
                # Yeh location exactly us job card se aayegi (jaise 'Pune', 'Remote', etc.)
                job_location = (card.find("span", class_="locWdth") or card.find("span", class_="location")).get_text(strip=True)
                
                scraped_jobs.append({
                    "title": title.get_text(strip=True) if title else "N/A",
                    "company": comp.get_text(strip=True) if comp else "N/A",
                    "location": job_location, # 👈 Yahan se location DB mein jayegi
                    "experience": (card.find("span", class_="expwdth") or card.find("span", class_="experience")).get_text(strip=True),
                    "salary": (card.find("span", class_="sal-wrap") or card.find("span", class_="salary")).get_text(strip=True),
                    "job_url": title["href"] if title and title.has_attr("href") else "N/A",
                    "date_posted": date_posted, 
                    "skills": extract_skills(card=card)
                })
            except Exception: continue

        # Step 2: Fetch Details for each job
        for i, job in enumerate(scraped_jobs):
            if job["job_url"] == "N/A": continue
            driver.get(job["job_url"])
            time.sleep(random.uniform(3, 5))
            ds = BeautifulSoup(driver.page_source, "html.parser")
            
            job["job_description"] = extract_jd(ds)
            job["job_meta"] = extract_job_meta(ds)
            
            detail_skills = extract_skills(soup=ds)
            if detail_skills: job["skills"] = detail_skills

        return scraped_jobs

    finally:
        driver.quit()


# ==========================================
# 💾 SECTION 5: AI VECTORS & SUPABASE DB
# ==========================================
def save_jobs_to_db(jobs: list, keyword: str):
    """Converts jobs to Vectors and saves to Supabase"""
    if not jobs: return
    saved = 0
    
    for job in jobs:
        try:
            skills_str = ", ".join(job["skills"]) if job["skills"] else "General"
            ai_text = f"{job['title']} at {job['company']} in {job['location']}. Skills: {skills_str}. {job['job_description'][:300]}"
            
            # Generate AI Vector
            ai_vector = embedding_model.encode(ai_text).tolist()

            # Insert into Supabase
            supabase.table("jobs").insert({
                "job_title": job["title"],
                "company_name": job["company"],
                "city": job["location"],
                "domain": skills_str,
                "job_description": job["job_description"],
                "skills_required": job["skills"],
                "experience": job["experience"],
                "salary": job["salary"] if job["salary"] else "Not Disclosed",
                "job_url": job["job_url"],
                "date_posted": job["date_posted"],
                "job_meta": job["job_meta"],
                "job_embedding": ai_vector 
            }).execute()
            saved += 1
        except Exception as e:
            print(f"  ⚠️ Error saving {job['title']}: {str(e)[:50]}")
            
    print(f"✅ Saved {saved}/{len(jobs)} jobs for '{keyword}' to Supabase!")


# ==========================================
# 🚀 THE MEGA MATRIX EXECUTION
# ==========================================
if __name__ == "__main__":
    
    # The "Universal Coverage" Domain List
    target_domains = [
        "Machine Learning", "Data Analyst" , "AI Engineer", "Data Engineer", "Data Scientist", "Cybersecurity",
        "UI UX Designer", "Data Analyst", "Business Analyst",
    ]

    print(f"🚀 Starting Mega Matrix Scraper for ALL INDIA ({len(target_domains)} domains)...")

    for domain in target_domains:
        # 🚀 THE FIX: Humne cities array hata diya hai, ab sirf domain search hoga
        print(f"\n🔍 Searching: '{domain}' (All India)")
        
        try:
            # Scrape 15 jobs per domain
            scraped_data = scrape_naukri(domain, max_jobs=15)
            
            # Process & Save (DB mein original job location hi save hogi)
            save_jobs_to_db(scraped_data, domain)
            
        except Exception as e:
            print(f"❌ Failed to process {domain}: {e}")
        
        # Mandatory delay to prevent IP Ban from Naukri
        delay = random.uniform(10, 20)
        print(f"⏳ Resting for {int(delay)} seconds...")
        time.sleep(delay)
        
    print("\n🎉 MEGA MATRIX SCRAPE COMPLETE!")