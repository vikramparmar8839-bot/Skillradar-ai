import asyncio
import csv
import io
import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional, Any
from urllib.parse import urlparse

import httpx
import pdfplumber
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analyzer import analyze_jobs
from skills_data_source import (
    get_available_careers,
    get_available_curriculums,
    get_curriculum_skills,
    get_industry_skills,
    get_skill_recommendation,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PROFILES_FILE = os.path.join(DATA_DIR, "profiles.json")
SKILLS_FILE = os.path.join(DATA_DIR, "skills_list.json")

# SQLite is used by the market pipeline. Set SKILLRADAR_DB to a persistent
# absolute path (or a mounted Render disk path) in production.
DB = os.getenv("SKILLRADAR_DB", os.path.join(BASE_DIR, "skillradar_market.db"))

app = FastAPI(
    title="SkillRadar API",
    version="2.0.0",
    description="SkillRadar candidate intelligence + labour market intelligence API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            location TEXT,
            description TEXT,
            snippet TEXT,
            url TEXT,
            source TEXT,
            posted_at TEXT,
            updated TEXT,
            salary_min REAL,
            salary_max REAL,
            category TEXT,
            raw_json TEXT
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS course_supply (
            course TEXT PRIMARY KEY,
            district TEXT,
            trainees INTEGER,
            placement_rate REAL
        )"""
    )
    conn.commit()
    return conn


@app.get("/health")
def health_check():
    return {"status": "SkillRadar backend is running"}


# ---------------- Candidate / existing endpoints ----------------

class StudentProfile(BaseModel):
    name: str
    education: str
    current_skills: str
    target_career: str


@app.post("/profile")
def save_profile(profile: StudentProfile):
    with open(PROFILES_FILE, "r", encoding="utf-8") as f:
        profiles = json.load(f)
    profiles.append(profile.model_dump())
    with open(PROFILES_FILE, "w", encoding="utf-8") as f:
        json.dump(profiles, f, indent=2)
    return {"message": "Profile saved successfully", "profile": profile}


@app.get("/profiles")
def get_profiles():
    with open(PROFILES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


with open(SKILLS_FILE, "r", encoding="utf-8") as f:
    KNOWN_SKILLS = json.load(f)


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    contents = await file.read()
    extracted_text = ""
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                extracted_text += page_text + "\n"

    text_lower = extracted_text.lower()
    found_skills = [
        skill for skill in KNOWN_SKILLS
        if skill.lower() in text_lower
    ]
    return {
        "filename": file.filename,
        "extracted_skills": found_skills,
        "text_preview": extracted_text[:300],
    }


@app.get("/careers")
def list_careers():
    return get_available_careers()


@app.get("/industry-skills/{career_name}")
def industry_skills(career_name: str):
    result = get_industry_skills(career_name)
    if result is None:
        return {"error": "Career not found", "core_skills": [], "emerging_skills": []}
    return {
        "core_skills": result.get("core_skills", []),
        "emerging_skills": result.get("emerging_skills", []),
    }


@app.get("/industry-skills")
def industry_skills_query(career_name: str):
    """Query-string version of the industry endpoint.

    The frontend uses this form so spaces/special characters in career names
    cannot be misinterpreted by a hosting proxy.
    """
    result = get_industry_skills(career_name)
    if result is None:
        return {"error": "Career not found", "core_skills": [], "emerging_skills": []}
    return {
        "core_skills": result.get("core_skills", []),
        "emerging_skills": result.get("emerging_skills", []),
    }


@app.get("/curriculums")
def list_curriculums():
    return get_available_curriculums()


@app.get("/curriculum-skills/{curriculum_name}")
def curriculum_skills(curriculum_name: str):
    result = get_curriculum_skills(curriculum_name)
    if result is None:
        return {"error": "Curriculum not found"}
    return result


@app.get("/compare/{curriculum_name}/{career_name}")
def compare_curriculum_to_industry(curriculum_name: str, career_name: str):
    curriculum = get_curriculum_skills(curriculum_name)
    industry = get_industry_skills(career_name)
    if curriculum is None or industry is None:
        return {"error": "Curriculum or career not found"}

    all_industry_skills = industry["core_skills"] + industry["emerging_skills"]
    curriculum_lower = [skill.lower() for skill in curriculum]

    missing_skills = [
        skill for skill in all_industry_skills
        if skill.lower() not in curriculum_lower
    ]
    covered_skills = [
        skill for skill in all_industry_skills
        if skill.lower() in curriculum_lower
    ]

    return {
        "curriculum": curriculum_name,
        "career": career_name,
        "covered_skills": covered_skills,
        "missing_skills": missing_skills,
    }


@app.get("/roadmap/{curriculum_name}/{career_name}")
def get_roadmap(curriculum_name: str, career_name: str):
    comparison = compare_curriculum_to_industry(curriculum_name, career_name)
    if "error" in comparison:
        return comparison

    roadmap = []
    for skill in comparison["missing_skills"]:
        recommendation = get_skill_recommendation(skill)
        if recommendation:
            roadmap.append({
                "skill": skill,
                "duration": recommendation["duration"],
                "courses": recommendation["courses"],
                "project": recommendation["project"],
                "why_it_matters": recommendation["why_it_matters"],
            })
        else:
            roadmap.append({
                "skill": skill,
                "duration": "Not specified",
                "courses": [],
                "project": "Not specified",
                "why_it_matters": "This skill is required by the industry but not yet in our recommendation database.",
            })

    return {
        "curriculum": curriculum_name,
        "career": career_name,
        "roadmap": roadmap,
    }


@app.get("/dashboard/{curriculum_name}/{career_name}")
def get_dashboard(curriculum_name: str, career_name: str):
    comparison = compare_curriculum_to_industry(curriculum_name, career_name)
    if "error" in comparison:
        return comparison

    covered_count = len(comparison["covered_skills"])
    missing_count = len(comparison["missing_skills"])
    total_count = covered_count + missing_count
    readiness_score = round((covered_count / total_count) * 100) if total_count else 0

    return {
        "curriculum": curriculum_name,
        "career": career_name,
        "readiness_score": readiness_score,
        "covered_count": covered_count,
        "missing_count": missing_count,
        "total_count": total_count,
        "covered_skills": comparison["covered_skills"],
        "missing_skills": comparison["missing_skills"],
        "recommended_next_skill": comparison["missing_skills"][0] if missing_count else None,
    }



# ---------------- Real AI features (Gemini Free Tier) ----------------
# The API key stays on the backend. Never put GEMINI_API_KEY in the React app.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.7-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


class CoachRequest(BaseModel):
    message: str
    profile: dict[str, Any] = {}
    readiness: Optional[dict[str, Any]] = None
    resume_skills: list[str] = []
    roadmap: list[dict[str, Any]] = []


class PortfolioRequest(BaseModel):
    url: str
    target_career: str = ""
    skills: Any = ""


class InterviewRequest(BaseModel):
    question: str
    answer: str
    target_career: str = ""
    skills: Any = ""


def _require_ai():
    if not GEMINI_API_KEY:
        raise HTTPException(503, "Real AI is not configured. Set GEMINI_API_KEY on the backend.")


def _extract_gemini_text(payload: dict) -> str:
    candidates = payload.get("candidates") or []
    chunks = []
    for candidate in candidates:
        content = candidate.get("content") or {}
        for part in content.get("parts") or []:
            text = part.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks).strip()


async def _gemini_response(instructions: str, input_text: str, json_mode: bool = False) -> str:
    _require_ai()
    body = {
        "systemInstruction": {"parts": [{"text": instructions}]},
        "contents": [{"role": "user", "parts": [{"text": input_text}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 900,
        },
    }
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"

    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(GEMINI_URL, headers=headers, json=body)
    if response.is_error:
        detail = response.text[:500]
        raise HTTPException(502, f"Gemini AI provider error: {detail}")
    text = _extract_gemini_text(response.json())
    if not text:
        raise HTTPException(502, "Gemini returned an empty response.")
    return text


def _safe_public_url(value: str) -> str:
    parsed = urlparse(value if "://" in value else f"https://{value}")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(400, "Enter a valid public http(s) portfolio URL.")
    host = parsed.hostname or ""
    blocked = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
    if host.lower() in blocked or host.startswith("10.") or host.startswith("192.168.") or host.startswith("172."):
        raise HTTPException(400, "Private or local URLs are not supported.")
    return parsed.geturl()


@app.post("/ai/coach")
async def ai_coach(request: CoachRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(400, "Message is required.")
    context = {
        "profile": request.profile,
        "readiness": request.readiness,
        "resume_skills": request.resume_skills,
        "roadmap": request.roadmap[:8],
    }
    reply = await _gemini_response(
        "You are SkillRadar, an AI career coach for students and early-career candidates. Give practical, concise, evidence-aware career guidance. Use the supplied SkillRadar context when relevant. Do not invent resume facts, job-market statistics, or achievements. If context is missing, say what the user should provide. Prefer a short action plan with concrete next steps.",
        f"SkillRadar context:\n{json.dumps(context, ensure_ascii=False)}\n\nUser question:\n{message}",
    )
    return {"reply": reply, "model": GEMINI_MODEL}


@app.post("/ai/portfolio")
async def ai_portfolio(request: PortfolioRequest):
    url = _safe_public_url(request.url)
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": "SkillRadar-Portfolio-Analyzer/1.0"}) as client:
        response = await client.get(url)
    if response.is_error:
        raise HTTPException(502, "Could not read the portfolio URL. Check that it is public and accessible.")
    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type:
        raise HTTPException(400, "The portfolio URL must point to a public web page.")
    html = response.text[:60000]
    import re
    clean = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", html, flags=re.I)
    clean = re.sub(r"<[^>]+>", " ", clean)
    clean = re.sub(r"\s+", " ", clean).strip()[:12000]
    if not clean:
        raise HTTPException(400, "No readable portfolio content was found at that URL.")
    raw = await _gemini_response(
        "Analyze a student's public portfolio for job readiness. Return ONLY valid JSON with keys: score (integer 0-100), summary (string), strengths (array of strings), improvements (array of strings). Score only evidence visible in the supplied page text. Do not claim you inspected source code or private repositories.",
        f"Target career: {request.target_career or 'not specified'}\nCurrent skills: {request.skills}\nURL: {url}\nPage text:\n{clean}",
        json_mode=True,
    )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(502, "AI returned an invalid portfolio analysis. Please try again.")
    data["score"] = max(0, min(100, int(data.get("score", 0))))
    return {**data, "url": url, "model": GEMINI_MODEL}


@app.post("/ai/interview")
async def ai_interview(request: InterviewRequest):
    if not request.answer.strip():
        raise HTTPException(400, "Interview answer is required.")
    raw = await _gemini_response(
        "You are an AI interview coach. Evaluate the candidate answer for the stated career. Return ONLY valid JSON with keys: score (integer 0-100), feedback (string), strengths (array of strings), improvements (array of strings). Be constructive and focus on clarity, evidence, ownership, technical reasoning, and measurable impact. Do not invent facts about the candidate.",
        f"Target career: {request.target_career or 'not specified'}\nSkills: {request.skills}\nQuestion: {request.question}\nCandidate answer: {request.answer}",
        json_mode=True,
    )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(502, "AI returned an invalid interview review. Please try again.")
    data["score"] = max(0, min(100, int(data.get("score", 0))))
    return {**data, "model": GEMINI_MODEL}

# ---------------- Labour market intelligence pipeline ----------------

def normalize_adzuna(item):
    loc = item.get("location") or {}
    company = item.get("company") or {}
    category = item.get("category") or {}
    return {
        "id": f"adzuna:{item.get('id')}",
        "title": item.get("title", ""),
        "company": company.get("display_name", ""),
        "location": loc.get("display_name", ""),
        "description": item.get("description", ""),
        "snippet": item.get("description", "")[:500],
        "url": item.get("redirect_url", ""),
        "source": "Adzuna",
        "posted_at": item.get("created"),
        "updated": item.get("created"),
        "salary_min": item.get("salary_min"),
        "salary_max": item.get("salary_max"),
        "category": category.get("label", ""),
        "raw_json": json.dumps(item, ensure_ascii=False),
    }


def save_jobs(jobs):
    if not jobs:
        return
    conn = db()
    conn.executemany(
        """INSERT OR REPLACE INTO jobs
        (id,title,company,location,description,snippet,url,source,posted_at,
         updated,salary_min,salary_max,category,raw_json)
        VALUES
        (:id,:title,:company,:location,:description,:snippet,:url,:source,
         :posted_at,:updated,:salary_min,:salary_max,:category,:raw_json)""",
        jobs,
    )
    conn.commit()
    conn.close()


def all_jobs(limit=100000):
    conn = db()
    rows = conn.execute(
        "SELECT * FROM jobs ORDER BY updated DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


async def _fetch_adzuna_jobs(country="in", what="software developer", where="India", pages=2):
    """Fetch real jobs from Adzuna and return them in SkillRadar's DB format."""
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")

    if not app_id or not app_key:
        raise RuntimeError(
            "ADZUNA_APP_ID and ADZUNA_APP_KEY are not configured."
        )

    jobs = []
    async with httpx.AsyncClient(timeout=30) as client:
        for page in range(1, pages + 1):
            url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page}"
            params = {
                "app_id": app_id,
                "app_key": app_key,
                "results_per_page": 50,
                "what": what,
                "where": where,
                "content-type": "application/json",
            }
            response = await client.get(url, params=params)
            if response.is_error:
                raise RuntimeError(
                    f"Adzuna request failed ({response.status_code}): {response.text[:500]}"
                )

            for item in response.json().get("results", []):
                jobs.append(normalize_adzuna(item))

    return jobs


async def _auto_sync_adzuna_if_empty():
    """Populate the free Render instance when its ephemeral DB is empty."""
    try:
        if all_jobs(limit=1):
            return

        app_id = os.getenv("ADZUNA_APP_ID")
        app_key = os.getenv("ADZUNA_APP_KEY")
        if not app_id or not app_key:
            print("SkillRadar startup: Adzuna keys are not configured; skipping auto-sync.")
            return

        jobs = await _fetch_adzuna_jobs(
            country="in",
            what="software developer",
            where="India",
            pages=2,
        )

        if jobs:
            save_jobs(jobs)
            print(f"SkillRadar startup: automatically synced {len(jobs)} Adzuna jobs.")
        else:
            print("SkillRadar startup: Adzuna returned no jobs.")
    except Exception as exc:
        # Never prevent the API from starting if Adzuna is temporarily unavailable.
        print(f"SkillRadar startup: automatic Adzuna sync failed: {exc}")


@app.on_event("startup")
async def startup():
    os.makedirs(DATA_DIR, exist_ok=True)
    db().close()

    # Render Free has an ephemeral filesystem. If the SQLite DB is empty after
    # a fresh instance/redeploy, fetch fresh real Adzuna jobs automatically.
    await _auto_sync_adzuna_if_empty()


@app.get("/market/health")
def market_health():
    jobs = all_jobs()
    return {
        "ok": True,
        "jobs_loaded": len(jobs),
        "last_job": jobs[0] if jobs else None,
        "database": DB,
    }


@app.post("/market/ingest/csv")
async def ingest_csv(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    jobs = []

    for i, row in enumerate(reader):
        title = row.get("title") or row.get("job_title") or ""
        description = (
            row.get("description")
            or row.get("job_description")
            or row.get("snippet")
            or ""
        )
        stable_id = row.get("id") or f"csv:{i}:{hash(title + description)}"
        jobs.append({
            "id": stable_id,
            "title": title,
            "company": row.get("company") or row.get("company_name") or "",
            "location": row.get("location") or "",
            "description": description,
            "snippet": row.get("snippet") or description[:500],
            "url": row.get("url") or row.get("link") or "",
            "source": row.get("source") or "CSV",
            "posted_at": row.get("posted_at") or row.get("date") or row.get("created") or "",
            "updated": row.get("updated") or row.get("posted_at") or row.get("date") or "",
            "salary_min": None,
            "salary_max": None,
            "category": row.get("category") or "",
            "raw_json": json.dumps(row, ensure_ascii=False),
        })

    save_jobs(jobs)
    return {"ingested": len(jobs), "source": file.filename}


# Alias matching the cleaner public API name discussed for SIH.
@app.post("/jobs/ingest")
async def jobs_ingest(file: UploadFile = File(...)):
    return await ingest_csv(file)


@app.post("/market/sync/adzuna")
async def sync_adzuna(
    country: str = Query("in"),
    what: str = Query("software developer"),
    where: str = Query("India"),
    pages: int = Query(2, ge=1, le=20),
):
    try:
        jobs = await _fetch_adzuna_jobs(
            country=country,
            what=what,
            where=where,
            pages=pages,
        )
    except RuntimeError as exc:
        message = str(exc)
        if "not configured" in message:
            raise HTTPException(400, "Set ADZUNA_APP_ID and ADZUNA_APP_KEY on the backend first.")
        raise HTTPException(502, message)

    save_jobs(jobs)
    return {
        "synced": len(jobs),
        "provider": "Adzuna",
        "country": country,
        "query": what,
        "location": where,
    }


@app.get("/market/overview")
def market_overview():
    return analyze_jobs(all_jobs())


@app.post("/jobs/analyze")
def jobs_analyze():
    return analyze_jobs(all_jobs())


@app.get("/market/skills")
def market_skills(limit: int = Query(20, ge=1, le=50)):
    return {"skills": analyze_jobs(all_jobs())["skills_data"][:limit]}


@app.get("/market/trends")
def market_trends(limit: int = Query(20, ge=1, le=50)):
    rows = analyze_jobs(all_jobs())["skills_data"][:limit]
    return {
        "trends": [
            {
                "name": row["name"],
                "trend": row["trend"],
                "demand": row["demand"],
                "jobs": row["jobs"],
            }
            for row in rows
        ]
    }


# India-only Location Radar:
# SkillRadar compares job demand across Indian cities, so country-only and
# state-only buckets are intentionally excluded from the city list.
INDIAN_STATES = {
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya",
    "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim",
    "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand",
    "west bengal", "delhi", "jammu and kashmir", "ladakh",
    "puducherry", "chandigarh", "andaman and nicobar islands",
    "dadra and nagar haveli and daman and diu", "lakshadweep"
}

def _is_indian_city_location(name: str) -> bool:
    """Return True only for city/locality-level Indian location labels."""
    value = " ".join(str(name or "").strip().split())
    if not value:
        return False

    lower = value.lower()

    # Country-only bucket is not a city and should never appear in Location Radar.
    if lower in {"india", "in", "bharat"}:
        return False

    # State/UT-only buckets such as 'Maharashtra, India' are also excluded.
    parts = [part.strip().lower() for part in value.split(",") if part.strip()]
    if len(parts) <= 2:
        if parts and parts[0] in INDIAN_STATES:
            return False
        if len(parts) == 2 and parts[-1] in {"india", "in"} and parts[0] in INDIAN_STATES:
            return False

    # Remote/India is not a city-level location.
    if "remote" in lower and ("india" in lower or lower == "remote"):
        return False

    # The market pipeline is India-only. Keep city/locality labels that are
    # already returned by the analyzer.
    return True


@app.get("/market/districts")
def market_districts(limit: int = Query(20, ge=1, le=50)):
    districts = analyze_jobs(all_jobs())["districts_data"]

    # Do not show country-level or state-level job counts in the India-focused
    # Location Radar. The displayed ranking is city/locality based.
    city_locations = [
        item for item in districts
        if _is_indian_city_location(item.get("name", ""))
    ]

    return {"districts": city_locations[:limit]}


@app.get("/market/roles")
def market_roles(limit: int = Query(20, ge=1, le=50)):
    return {"roles": analyze_jobs(all_jobs())["roles_data"][:limit]}


@app.get("/market/skills/{skill}")
def skill_detail(skill: str):
    data = analyze_jobs(all_jobs())
    row = next(
        (item for item in data["skills_data"] if item["name"].lower() == skill.lower()),
        None,
    )
    if not row:
        raise HTTPException(404, "Skill not found")
    return row


@app.post("/market/course-supply/csv")
async def ingest_course_supply(file: UploadFile = File(...)):
    raw = await file.read()
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    conn = db()
    count = 0
    for row in reader:
        conn.execute(
            """INSERT OR REPLACE INTO course_supply
            (course,district,trainees,placement_rate)
            VALUES(?,?,?,?)""",
            (
                row.get("course", ""),
                row.get("district", ""),
                int(float(row.get("trainees") or 0)),
                float(row.get("placement_rate") or 0),
            ),
        )
        count += 1
    conn.commit()
    conn.close()
    return {"ingested": count}


def _skill_key(value):
    return " ".join(str(value or "").strip().lower().replace("-", " ").split())


def _curriculum_alignment_rows():
    """Compare stored curricula with observed job-market skills.

    Uses curriculum_skills.json and the current market analysis only; no
    invented trainee, supply, or placement figures are used.
    """
    analysis = analyze_jobs(all_jobs())
    market_rows = analysis.get("skills_data", [])
    demand = {_skill_key(item.get("name")): float(item.get("demand") or 0) for item in market_rows}

    benchmark = [
        item for item in market_rows
        if item.get("name") and float(item.get("demand") or 0) > 0
    ]
    benchmark = sorted(benchmark, key=lambda item: float(item.get("demand") or 0), reverse=True)[:20]
    benchmark_keys = {_skill_key(item.get("name")) for item in benchmark}

    rows = []
    for curriculum_name in get_available_curriculums():
        curriculum = get_curriculum_skills(curriculum_name) or []
        curriculum_keys = {_skill_key(skill) for skill in curriculum}
        covered = [skill for skill in curriculum if _skill_key(skill) in benchmark_keys]
        gaps = [
            item["name"] for item in benchmark
            if _skill_key(item["name"]) not in curriculum_keys
        ][:6]

        alignment = round((len(covered) / len(benchmark)) * 100) if benchmark else 0
        avg_demand = (
            round(sum(demand.get(_skill_key(skill), 0) for skill in covered) / len(covered), 1)
            if covered else 0
        )

        if alignment >= 75:
            status = "WELL ALIGNED"
        elif alignment >= 50:
            status = "UPDATE"
        else:
            status = "PRIORITIZE"

        rows.append({
            "curriculum": curriculum_name,
            "alignment": alignment,
            "covered_count": len(covered),
            "benchmark_count": len(benchmark),
            "gaps": gaps,
            "avg_demand": avg_demand,
            "status": status,
        })

    return rows


@app.get("/market/curriculum-alignment")
def curriculum_alignment():
    return {"curriculums": _curriculum_alignment_rows()}


@app.get("/market/course-health")
@app.get("/courses/health")
def course_health():
    # Backward-compatible endpoint. The UI now uses real curriculum-to-industry
    # alignment instead of the old course-supply CSV requirement.
    return {"courses": _curriculum_alignment_rows()}


def build_training_plan():
    overview = analyze_jobs(all_jobs())
    top = [item for item in overview["skills_data"] if item["demand"] >= 25][:10]

    plan = []
    for item in top[:6]:
        trainees = max(50, round(item["jobs"] * 0.15))
        trainers = max(1, round(trainees / 50))
        labs = max(1, round(trainers / 3))
        plan.append({
            "skill": item["name"],
            "trainees": trainees,
            "trainers": trainers,
            "labs": labs,
            "demand": item["demand"],
        })
    return plan


@app.get("/market/training-plan")
def training_plan():
    return {"plan": build_training_plan()}


@app.get("/districts/{district}/training-plan")
def district_training_plan(district: str):
    # Current implementation filters observed jobs by exact location text.
    # Staffing/lab numbers remain modelled estimates, not policy requirements.
    jobs = [
        job for job in all_jobs()
        if district.lower() in (job.get("location") or "").lower()
    ]
    analysis = analyze_jobs(jobs)
    top = [item for item in analysis["skills_data"] if item["demand"] >= 25][:6]

    plan = []
    for item in top:
        trainees = max(50, round(item["jobs"] * 0.15))
        trainers = max(1, round(trainees / 50))
        labs = max(1, round(trainers / 3))
        plan.append({
            "district": district,
            "skill": item["name"],
            "trainees": trainees,
            "trainers": trainers,
            "labs": labs,
            "demand": item["demand"],
        })

    return {
        "district": district,
        "observed_jobs": len(jobs),
        "plan": plan,
    }
