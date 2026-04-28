from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup, NavigableString
from datetime import datetime
import time
import random
import re
import os
from dotenv import load_dotenv

# ── HIREMAP AI & DATABASE SETUP ──
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

load_dotenv()

# ══════════════════════════════════════════
#  DRIVER
# ══════════════════════════════════════════

def get_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()), options=options
    )
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return driver

def get_detail_soup(driver, url):
    driver.get(url)
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "[class*='job-desc'], [class*='jd-container'], [class*='description']")
            )
        )
    except Exception:
        pass
    time.sleep(random.uniform(3, 5))  # extra buffer for JS render
    return BeautifulSoup(driver.page_source, "html.parser")

# ══════════════════════════════════════════
#  SHARED UTILS
# ══════════════════════════════════════════

def clean_text(text: str) -> str:
    lines = [l.strip() for l in text.splitlines()]
    cleaned, prev_blank = [], False
    for line in lines:
        if line == "":
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(line)
            prev_blank = False
    return "\n".join(cleaned).strip()

def dedupe_list(lst: list) -> list:
    seen, out = set(), []
    for item in lst:
        key = item.lower().strip()
        if key and key not in seen:
            seen.add(key)
            out.append(item.strip())
    return out

_NOISE = [
    "popular categories", "jobs in delhi", "jobs in mumbai", "jobs in bangalore",
    "it jobs", "sales jobs", "hr jobs", "resume writing", "employer login",
    "naukri talent cloud", "fraud alert", "trust & safety", "about us", "sitemap",
    "privacy policy", "terms & conditions", "apply on the go", "google play",
    "roles you might be interested in", "send me jobs like this",
    "beware of imposters", "register to apply", "login to apply",
]

def _is_noise(text: str) -> bool:
    t = text.lower()
    return sum(1 for p in _NOISE if p in t) >= 2

# ══════════════════════════════════════════
#  1.  JOB DESCRIPTION  (clean structured text)
# ══════════════════════════════════════════

def _html_to_structured_text(tag) -> str:
    parts = []
    for node in tag.descendants:
        if not isinstance(node, NavigableString):
            continue
        text = str(node).strip()
        if not text:
            continue
        parent = node.parent
        pname  = parent.name if parent else ""
        if pname in ("h1","h2","h3","h4","h5","h6"):
            parts.append(f"\n{text}\n")
        elif pname in ("strong","b"):
            parts.append(f"\n{text}\n")
        elif pname == "li":
            parts.append(f"\n• {text}")
        elif pname in ("p","br"):
            parts.append(f"\n{text}")
        else:
            if parts and parts[-1] and parts[-1][-1] not in ("\n"," "):
                parts.append(f" {text}")
            else:
                parts.append(text)
    return clean_text("".join(parts))

def extract_jd(soup: BeautifulSoup) -> str:
    jd_div = None
    for div in soup.find_all("div"):
        classes = " ".join(div.get("class", []))
        if "JDC__dang-inner-html" in classes:
            jd_div = div
            break

    if not jd_div:
        section = soup.find("section", class_=lambda c: c and "job-desc-container" in " ".join(c))
        if section:
            jd_div = section.find("div", class_=lambda c: c and "dang-inner-html" in " ".join(c if c else []))

    if not jd_div:
        for h in soup.find_all("h2"):
            if "job description" in h.get_text(strip=True).lower():
                jd_div = h.find_parent("section") or h.find_parent("div")
                break

    if not jd_div:
        return "JD not found"

    structured = _html_to_structured_text(jd_div)

    _META_PAT = re.compile(
        r"^(Role|Industry Type|Department|Employment Type|Role Category|Education|UG:|PG:)\s*[:\-]?",
        re.IGNORECASE
    )
    lines = structured.splitlines()
    cut = len(lines)
    for i, line in enumerate(lines):
        if _META_PAT.match(line.strip()):
            cut = i
            break

    body = "\n".join(lines[:cut])
    return clean_text(body) if len(body) > 80 and not _is_noise(body) else "JD not found"

# ══════════════════════════════════════════
#  2.  JOB META  (Role / Dept / Education block)
# ══════════════════════════════════════════

def extract_job_meta(soup: BeautifulSoup) -> dict:
    meta = {
        "role":            "N/A",
        "industry_type":   "N/A",
        "department":      "N/A",
        "employment_type": "N/A",
        "role_category":   "N/A",
        "education_ug":    "N/A",
        "education_pg":    "N/A",
    }

    jd_section = None
    for cls in ["dang-inner-html", "job-desc", "jd-desc", "job-description"]:
        jd_section = soup.find("div", class_=cls)
        if jd_section:
            break

    target = jd_section if jd_section else soup

    for label_tag in target.find_all(["label", "strong", "span", "div"]):
        label_txt = label_tag.get_text(strip=True).rstrip(":").lower()
        value_tag = label_tag.find_next_sibling(["span", "div", "a"])
        if not value_tag:
            continue
        val = value_tag.get_text(strip=True).rstrip(",").strip()

        if label_txt == "role":
            meta["role"] = val
        elif label_txt == "industry type":
            meta["industry_type"] = val
        elif label_txt == "department":
            meta["department"] = val
        elif label_txt == "employment type":
            meta["employment_type"] = val
        elif label_txt == "role category":
            meta["role_category"] = val
        elif label_txt == "ug":
            meta["education_ug"] = val
        elif label_txt == "pg":
            meta["education_pg"] = val

    full_text = soup.get_text(separator="\n")
    _map = {
        "Role":            "role",
        "Industry Type":   "industry_type",
        "Department":      "department",
        "Employment Type": "employment_type",
        "Role Category":   "role_category",
        "UG":              "education_ug",
        "PG":              "education_pg",
    }
    lines = full_text.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip().rstrip(":")
        for label, key in _map.items():
            if stripped.lower() == label.lower() and meta[key] == "N/A":
                for j in range(i + 1, min(i + 4, len(lines))):
                    val = lines[j].strip().rstrip(",")
                    if val:
                        meta[key] = val
                        break

    return meta

# ══════════════════════════════════════════
#  3.  JOB HIGHLIGHTS
# ══════════════════════════════════════════

def extract_job_highlights(soup: BeautifulSoup) -> list:
    for ul in soup.find_all("ul"):
        classes = " ".join(ul.get("class", []))
        if "job-highlight-list" in classes:
            items = [li.get_text(strip=True) for li in ul.find_all("li")
                     if len(li.get_text(strip=True)) > 10]
            if items:
                return items

    for span in soup.find_all("span"):
        if "job highlight" in span.get_text(strip=True).lower():
            parent = span.find_parent("div")
            if parent:
                next_ul = parent.find_next("ul")
                if next_ul:
                    items = [li.get_text(strip=True) for li in next_ul.find_all("li")
                             if len(li.get_text(strip=True)) > 10]
                    if items:
                        return items

    for div in soup.find_all("div"):
        classes = " ".join(div.get("class", []))
        if "JDC__match-score" in classes:
            ul = div.find("ul")
            if ul:
                items = [li.get_text(strip=True) for li in ul.find_all("li")
                         if len(li.get_text(strip=True)) > 10]
                if items:
                    return items
    return []

# ══════════════════════════════════════════
#  4.  SKILLS
# ══════════════════════════════════════════

def extract_skills(card=None, soup: BeautifulSoup = None) -> list:
    if card:
        for cls in ["tags-gt", "tags", "skill-tags"]:
            ul = card.find("ul", class_=cls)
            if ul:
                return dedupe_list([li.get_text(strip=True) for li in ul.find_all("li")])

    if soup:
        for cls in ["key-skill", "keyskills", "chip-lst", "key-skills"]:
            c = soup.find(["div","ul"], class_=lambda x: x and cls in x.lower())
            if c:
                items = [t.get_text(strip=True) for t in c.find_all(["li","a"])
                         if t.get_text(strip=True)]
                if items:
                    return dedupe_list(items)

        for h in soup.find_all(["h2","h3","h4","span","div"]):
            if h.get_text(strip=True).lower() in ("key skills", "skills required", "skills"):
                parent = h.find_parent(["section","div"])
                if parent:
                    items = [t.get_text(strip=True) for t in parent.find_all(["li","a","span"])
                             if 2 < len(t.get_text(strip=True)) < 50]
                    if items:
                        return dedupe_list(items)
    return []

# ══════════════════════════════════════════
#  5.  APPLICANTS
# ══════════════════════════════════════════

def extract_applicants(soup: BeautifulSoup) -> str:
    for tag in soup.find_all(["span","div","li"]):
        txt = tag.get_text(strip=True)
        if re.search(r"\d+\+?\s*applicants?", txt, re.I) and len(txt) < 60:
            return txt
    m = re.search(r"(\d+\+?\s*[Aa]pplicants?)", soup.get_text())
    return m.group(1) if m else "N/A"

# ══════════════════════════════════════════
#  6.  WORK MODE
# ══════════════════════════════════════════

def extract_work_mode(soup: BeautifulSoup) -> str:
    _VALID = {"hybrid", "remote", "work from home", "on-site", "wfh", "wfo", "in office"}
    for cls in ["job-header", "jd-header", "job-details", "exp-salary-container", "loc-salary"]:
        zone = soup.find(["div","section"], class_=lambda c: c and cls in c.lower())
        if zone:
            for tag in zone.find_all(["span","li","div"]):
                t = tag.get_text(strip=True).lower()
                if t in _VALID:
                    return tag.get_text(strip=True)

    for tag in soup.find_all(["span","li"]):
        t = tag.get_text(strip=True).lower()
        if t in _VALID:
            return tag.get_text(strip=True)
    return "N/A"

# ══════════════════════════════════════════
#  7.  SALARY INSIGHT
# ══════════════════════════════════════════

def extract_salary_insight(soup: BeautifulSoup) -> str:
    for tag in soup.find_all(["p","span","div"]):
        txt = tag.get_text(separator=" ", strip=True)
        if re.search(r"typically earns", txt, re.I) and len(txt) < 250:
            txt = re.sub(r"See detailed salary breakup.*$", "", txt, flags=re.I).strip()
            txt = re.sub(r"Salary insights?\s*", "", txt, flags=re.I).strip()
            return txt
    m = re.search(r"₹[\d.]+\s*[-–]\s*₹[\d.]+\s*L/yr", soup.get_text())
    return m.group(0) if m else "N/A"

# ══════════════════════════════════════════
#  8.  COMPANY INFO
# ══════════════════════════════════════════

_VALID_INDUSTRIES = {
    "industrial automation", "saas", "internet", "foreign mnc",
    "it services & consulting", "software product", "bfsi",
    "ecommerce", "healthcare", "fintech", "edtech",
    "manufacturing", "retail", "telecom", "logistics",
    "fortune global 500", "it services",
}

def extract_company_info(soup: BeautifulSoup) -> dict:
    info = {
        "rating":         "N/A",
        "reviews":        "N/A",
        "followers":      "N/A",
        "industries":     [],
        "overview":       "N/A",
        "website":        "N/A",
        "address":        "N/A",
        "key_highlights": [],
        "benefits":       [],
        "awards":         [],
        "verified_benefits": [],
    }

    for tag in soup.find_all(["span","div","a"]):
        txt = tag.get_text(strip=True)
        if re.fullmatch(r"\d\.\d", txt):
            info["rating"] = txt
            break

    for tag in soup.find_all(["span","div","a"]):
        txt = tag.get_text(strip=True)
        if re.search(r"[\d.]+[kK]?\s*(employee\s*)?reviews?", txt, re.I) and len(txt) < 35 and "company" not in txt.lower():
            info["reviews"] = txt
            break

    for tag in soup.find_all(["span","div"]):
        txt = tag.get_text(separator=" ", strip=True)
        m = re.search(r"([\d.]+[kKmM]?\s*followers?)", txt, re.I)
        if m and len(txt) < 30:
            info["followers"] = m.group(1).strip()
            break

    about_zone = None
    for h in soup.find_all(["h2","h3","h4","div","span"]):
        ht = h.get_text(strip=True).lower()
        if ht in ("about the company", "about company", "about"):
            about_zone = h.find_parent(["section","div"])
            break
    search_zone = about_zone if about_zone else soup

    found_industries = []
    zone_text = search_zone.get_text(" ", strip=True).lower()
    for ind in _VALID_INDUSTRIES:
        if ind in zone_text:
            found_industries.append(ind.title())
    info["industries"] = dedupe_list(found_industries)

    for h in soup.find_all(["h2","h3","h4","div","span"]):
        if h.get_text(strip=True).lower() == "overview":
            parent = h.find_parent(["section","div"])
            if parent:
                txt = parent.get_text(separator="\n").strip()
                lines = [l.strip() for l in txt.splitlines() if l.strip()]
                if lines and lines[0].lower() == "overview":
                    lines = lines[1:]
                candidate = clean_text("\n".join(lines))
                if len(candidate) > 40 and not _is_noise(candidate):
                    info["overview"] = candidate[:800]
                    break

    for a in soup.find_all("a", href=True):
        label = a.get_text(strip=True).lower()
        if "website" in label or "company site" in label:
            info["website"] = a["href"]
            break

    for line in soup.get_text(separator="\n").splitlines():
        l = line.strip()
        if re.match(r"^address\s*:", l, re.I) and len(l) < 120:
            info["address"] = re.sub(r"^address\s*:\s*", "", l, flags=re.I).strip()
            break

    for h in soup.find_all(["h2","h3","h4","div","span"]):
        ht = h.get_text(strip=True).lower()
        if "key highlights" in ht:
            parent = h.find_parent(["section","div"])
            if parent:
                items = []
                for child in parent.find_all(["li","div","span"]):
                    t = child.get_text(strip=True)
                    if 3 < len(t) < 60 and t.lower() not in ("key highlights",):
                        items.append(t)
                kh = dedupe_list(items)
                _KH_KEYWORDS = {"work life", "job security", "company culture", "salary", "skill development", "promotions", "highly rated", "rated"}
                info["key_highlights"] = [k for k in kh if any(kw in k.lower() for kw in _KH_KEYWORDS)]
                break

    for h in soup.find_all(["h2","h3","h4","div","span"]):
        ht = h.get_text(strip=True).lower()
        if "company verified benefit" in ht or "verified benefit" in ht:
            parent = h.find_parent(["section","div"])
            if parent:
                items = [t.get_text(strip=True) for t in parent.find_all(["li","span","div"]) if 3 < len(t.get_text(strip=True)) < 60]
                _BEN_KW = {"health", "insurance", "cafeteria", "meal", "cab", "shuttle", "training", "degree", "assistance", "wellness", "career", "development", "learning"}
                info["verified_benefits"] = dedupe_list([i for i in items if any(kw in i.lower() for kw in _BEN_KW)])
                break

    for h in soup.find_all(["h2","h3","h4","div","span"]):
        ht = h.get_text(strip=True).lower()
        if "benefits & perks" in ht or "benefits and perks" in ht:
            parent = h.find_parent(["section","div"])
            if parent:
                items = [li.get_text(strip=True) for li in parent.find_all("li") if 3 < len(li.get_text(strip=True)) < 60]
                info["benefits"] = dedupe_list(items)
                break

    for h in soup.find_all(["h2","h3","h4","div","span"]):
        ht = h.get_text(strip=True).lower()
        if "awards" in ht and "recogni" in ht:
            parent = h.find_parent(["section","div"])
            if parent:
                items = [li.get_text(strip=True) for li in parent.find_all("li") if li.get_text(strip=True)]
                info["awards"] = [a for a in dedupe_list(items) if len(a) > 5 and not _is_noise(a)]
                break

    return info

# ══════════════════════════════════════════
#  MAIN SCRAPER
# ══════════════════════════════════════════

def scrape_naukri(keyword: str, max_jobs: int = 20) -> list:
    print(f"\n🔍 Scraping Naukri for: '{keyword}'")
    formatted = keyword.strip().replace(" ", "-").lower()
    url = f"https://www.naukri.com/{formatted}-jobs"

    driver = get_driver()
    scraped_jobs = []

    try:
        # ── STEP 1: Listing page ──
        print("📄 Loading listing page...")
        driver.get(url)
        time.sleep(random.uniform(5, 8))
        soup = BeautifulSoup(driver.page_source, "html.parser")

        job_cards = (
            soup.find_all("div", class_="srp-jobtuple-wrapper") or
            soup.find_all("div", class_="jobTuple") or
            soup.find_all("article", class_=lambda c: c and "job" in c.lower())
        )

        if not job_cards:
            print("⚠️  No job cards found")
            return []

        print(f"✅ Found {len(job_cards)} job cards")

        for card in job_cards[:max_jobs]:
            try:
                def _txt(tag): return tag.get_text(strip=True) if tag else "N/A"
                def _href(tag): return tag["href"] if tag and tag.has_attr("href") else "N/A"

                title_tag = (card.find("a", class_="title") or card.find("a", class_="jobTitle") or card.find("a", attrs={"data-ga-track": True}))
                comp_tag  = (card.find("a", class_="comp-name") or card.find("span", class_="comp-name") or card.find("a", class_="company-name"))
                loc_tag   = (card.find("span", class_="locWdth") or card.find("span", class_="location") or card.find("li", class_="location"))
                exp_tag   = (card.find("span", class_="expwdth") or card.find("span", class_="experience") or card.find("li", class_="experience"))
                sal_tag   = (card.find("span", class_="sal-wrap") or card.find("span", class_="salary") or card.find("li", class_="salary"))
                date_tag  = (card.find("span", class_="job-post-day") or card.find("span", class_="date") or card.find("time"))

                scraped_jobs.append({
                    "platform":    "Naukri",
                    "keyword":     keyword,
                    "title":       _txt(title_tag),
                    "company":     _txt(comp_tag),
                    "location":    _txt(loc_tag),
                    "experience":  _txt(exp_tag),
                    "salary":      _txt(sal_tag) if sal_tag else "Not Disclosed",
                    "date_posted": _txt(date_tag),
                    "job_url":     _href(title_tag),
                    "scraped_at":  datetime.now().isoformat(),
                    "job_description": "",
                    "job_highlights":  [],
                    "skills":          extract_skills(card=card),
                    "job_meta": {
                        "role":            "N/A",
                        "industry_type":   "N/A",
                        "department":      "N/A",
                        "employment_type": "N/A",
                        "role_category":   "N/A",
                        "education_ug":    "N/A",
                        "education_pg":    "N/A",
                    },
                    "applicants":     "N/A",
                    "work_mode":      "N/A",
                    "salary_insight": "N/A",
                    "company_info": {
                        "rating":            "N/A",
                        "reviews":           "N/A",
                        "followers":         "N/A",
                        "industries":        [],
                        "overview":          "N/A",
                        "website":           "N/A",
                        "address":           "N/A",
                        "key_highlights":    [],
                        "verified_benefits": [],
                        "benefits":          [],
                        "awards":            [],
                    },
                })
            except Exception:
                continue

        print(f"📋 Basic info extracted for {len(scraped_jobs)} jobs")

        # ── STEP 2: Detail pages ──
        print(f"\n📖 Fetching full details...")

        for i, job in enumerate(scraped_jobs):
            if job["job_url"] == "N/A":
                continue
            print(f"\n  [{i+1}/{len(scraped_jobs)}] {job['title']} @ {job['company']}")

            try:
                ds = get_detail_soup(driver, job["job_url"])
                
                job["job_description"] = extract_jd(ds)
                job["job_highlights"]  = extract_job_highlights(ds)
                job["job_meta"]        = extract_job_meta(ds)
                job["applicants"]      = extract_applicants(ds)
                job["work_mode"]       = extract_work_mode(ds)
                job["salary_insight"]  = extract_salary_insight(ds)
                job["company_info"]    = extract_company_info(ds)

                detail_skills = extract_skills(soup=ds)
                if detail_skills:
                    job["skills"] = detail_skills

            except Exception as e:
                print(f"  ⚠️ Error: {e}")
                job["job_description"] = "Error fetching detail"

            delay = random.uniform(3, 7)
            print(f"  ⏳ Waiting {delay:.1f}s...")
            time.sleep(delay)

        # ── STEP 3: HIREMAP AI VECTOR & SUPABASE SAVE ──
        print("\n🧠 Loading AI Model to generate Vectors...")
        try:
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            
            supabase_url = os.environ.get("SUPABASE_URL")
            supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
            supabase: Client = create_client(supabase_url, supabase_key)

            if scraped_jobs:
                saved = 0
                for job in scraped_jobs:
                    try:
                        # 1. AI ko samajhne ke liye ek string banana
                        skills_str = ", ".join(job["skills"]) if job["skills"] else job["job_meta"]["role"]
                        
                        # Hum Title, Company, aur Skills ko combine kar rahe hain vector banane ke liye
                        job_text_for_ai = f"{job['title']} at {job['company']} in {job['location']}. Skills required: {skills_str}. Description: {job['job_description'][:300]}"
                        
                        # 2. AI se 384 numbers (Vector) generate karwana
                        ai_vector = embedding_model.encode(job_text_for_ai).tolist()

                        # 3. Supabase ki 'jobs' table mein daalna
                        # 3. Supabase ki 'jobs' table mein daalna
                        # 3. Supabase ki 'jobs' table mein pura data daalna
                        supabase.table("jobs").insert({
                            "job_title": job["title"],
                            "company_name": job["company"],
                            "city": job["location"],
                            "domain": skills_str,
                            "job_description": job["job_description"],
                            "skills_required": job["skills"],
                            
                            # 👇 NAYA DATA JO UI PAR DIKHEGA 👇
                            "experience": job["experience"],
                            "salary": job["salary"],
                            "work_mode": job["work_mode"],
                            "applicants": job["applicants"],
                            "job_url": job["job_url"],
                            "date_posted": job["date_posted"],
                            "job_highlights": job["job_highlights"],  # Array/JSON
                            "job_meta": job["job_meta"],              # Dictionary/JSON
                            "company_info": job["company_info"],      # Dictionary/JSON
                            
                            "job_embedding": ai_vector 
                        }).execute()
                        
                        saved += 1
                        print(f"✅ AI Vector Saved: {job['title']} @ {job['company']}")
                    
                    except Exception as db_err:
                        print(f"⚠️ Error saving to Supabase: {db_err}")

                print(f"\n💾 {saved} new jobs with AI Vectors saved to Supabase!")
            else:
                print("\n⚠️  No jobs to save.")
        except Exception as setup_err:
            print(f"❌ Error setting up AI/Database: {setup_err}")

        return scraped_jobs

    except Exception as e:
        print(f"❌ Scraper failed: {e}")
        return []

    finally:
        driver.quit()

if __name__ == "__main__":
    # 1. Domains ki list banaiye
    target_domains = ["Machine Learning", "Frontend Developer", "Data Analyst", "Backend Engineer", "HR Manager"]
    
    # 2. Loop chalaiye har domain ke liye
    for domain in target_domains:
        print(f"🚀 Starting scrape for {domain}...")
        try:
            scrape_naukri(domain, max_jobs=10) # Har domain ki 10-10 jobs
        except Exception as e:
            print(f"❌ Error scraping {domain}: {e}")
        
        # Thoda gap rakhein taaki Naukri block na kare
        time.sleep(10)