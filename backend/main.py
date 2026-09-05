import csv
import io
import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

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


@app.on_event("startup")
def startup():
    os.makedirs(DATA_DIR, exist_ok=True)
    db().close()


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
        return {"error": "Career not found"}
    return result


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
    app_id = os.getenv("ADZUNA_APP_ID")
    app_key = os.getenv("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        raise HTTPException(
            400,
            "Set ADZUNA_APP_ID and ADZUNA_APP_KEY on the backend first.",
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
                raise HTTPException(
                    response.status_code,
                    f"Adzuna request failed: {response.text[:500]}",
                )
            for item in response.json().get("results", []):
                jobs.append(normalize_adzuna(item))

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


@app.get("/market/districts")
def market_districts(limit: int = Query(20, ge=1, le=50)):
    return {"districts": analyze_jobs(all_jobs())["districts_data"][:limit]}


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


@app.get("/market/course-health")
@app.get("/courses/health")
def course_health():
    conn = db()
    courses = [
        dict(row)
        for row in conn.execute("SELECT * FROM course_supply").fetchall()
    ]
    conn.close()

    analysis = analyze_jobs(all_jobs())
    demand = {
        item["name"].lower(): item["demand"]
        for item in analysis["skills_data"]
    }

    result = []
    for row in courses:
        d = demand.get(row["course"].lower(), 0)
        supply_index = min(100, row["trainees"] / 10)

        if d < 25 and supply_index > 50:
            status = "OVERSUPPLIED"
        elif d < 25 and row["placement_rate"] < 40:
            status = "REVIEW"
        elif d >= 60:
            status = "EXPAND / UPDATE"
        else:
            status = "MONITOR"

        result.append({
            **row,
            "demand": d,
            "supply": round(supply_index, 1),
            "placement": row["placement_rate"],
            "status": status,
        })

    return {"courses": result}


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
