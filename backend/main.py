from skills_data_source import (
    get_industry_skills,
    get_available_careers,
    get_curriculum_skills,
    get_available_curriculums,
    get_skill_recommendation,
)

from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to our JSON "database" file
PROFILES_FILE = os.path.join("data", "profiles.json")


@app.get("/health")
def health_check():
    return {"status": "SkillRadar backend is running"}


# This defines the "shape" of a Student Profile.
# FastAPI uses this to check that incoming data is valid.
class StudentProfile(BaseModel):
    name: str
    education: str
    current_skills: str
    target_career: str


@app.post("/profile")
def save_profile(profile: StudentProfile):
    # Step 1: Read existing profiles from the file
    with open(PROFILES_FILE, "r") as f:
        profiles = json.load(f)

    # Step 2: Add the new profile to the list
    profiles.append(profile.dict())

    # Step 3: Save the updated list back to the file
    with open(PROFILES_FILE, "w") as f:
        json.dump(profiles, f, indent=2)

    return {"message": "Profile saved successfully", "profile": profile}


@app.get("/profiles")
def get_profiles():
    # Just read and return everything currently saved
    with open(PROFILES_FILE, "r") as f:
        profiles = json.load(f)
    return profiles

from fastapi import File, UploadFile
import pdfplumber
import io

# Load our mock skills list once when the server starts
SKILLS_FILE = os.path.join("data", "skills_list.json")
with open(SKILLS_FILE, "r") as f:
    KNOWN_SKILLS = json.load(f)


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    # Step 1: Read the uploaded file's raw bytes
    contents = await file.read()

    # Step 2: Open it as a PDF using pdfplumber
    extracted_text = ""
    with pdfplumber.open(io.BytesIO(contents)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                extracted_text += page_text + "\n"

    # Step 3: Search the extracted text for any known skills
    found_skills = []
    text_lower = extracted_text.lower()
    for skill in KNOWN_SKILLS:
        if skill.lower() in text_lower:
            found_skills.append(skill)

    return {
        "filename": file.filename,
        "extracted_skills": found_skills,
        "text_preview": extracted_text[:300]  # just first 300 characters, for sanity checking
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

    # Combine core + emerging industry skills into one list to compare against
    all_industry_skills = industry["core_skills"] + industry["emerging_skills"]

    # Find skills the industry wants that AREN'T in the curriculum
    # (case-insensitive comparison, since wording might differ slightly)
    curriculum_lower = [skill.lower() for skill in curriculum]
    missing_skills = [
        skill for skill in all_industry_skills
        if skill.lower() not in curriculum_lower
    ]

    # Find skills that ARE covered
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
            # If we don't have detailed data for this skill yet, still show it simply
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

    # Calculate readiness as a percentage (avoid dividing by zero)
    if total_count > 0:
        readiness_score = round((covered_count / total_count) * 100)
    else:
        readiness_score = 0

    # The "recommended next skill" is simply the first missing skill
    # (our roadmap already orders missing skills by priority)
    recommended_next_skill = comparison["missing_skills"][0] if missing_count > 0 else None

    return {
        "curriculum": curriculum_name,
        "career": career_name,
        "readiness_score": readiness_score,
        "covered_count": covered_count,
        "missing_count": missing_count,
        "total_count": total_count,
        "covered_skills": comparison["covered_skills"],
        "missing_skills": comparison["missing_skills"],
        "recommended_next_skill": recommended_next_skill,
    }