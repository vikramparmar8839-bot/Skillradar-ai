import json
import os

INDUSTRY_SKILLS_FILE = os.path.join("data", "industry_skills.json")


def get_industry_skills(career_name: str):
    """
    Returns core and emerging skills for a given career.

    IMPORTANT (scalability note):
    Right now, this reads from a local mock JSON file.
    In the future, this function is the ONLY place we'd change
    to pull real data instead — for example, calling a live
    job-postings API or a database. Nothing else in the app
    would need to know the difference.
    """
    with open(INDUSTRY_SKILLS_FILE, "r") as f:
        all_data = json.load(f)

    # Return the data for this specific career, or None if not found
    return all_data.get(career_name)


def get_available_careers():
    """Returns the list of all career names we have data for."""
    with open(INDUSTRY_SKILLS_FILE, "r") as f:
        all_data = json.load(f)
    return list(all_data.keys())

CURRICULUM_FILE = os.path.join("data", "curriculum_skills.json")


def get_curriculum_skills(curriculum_name: str):
    """
    Returns the list of skills taught in a given curriculum.

    Same scalability note as get_industry_skills():
    this reads from a mock JSON file today. Later, this could
    read from a real college's uploaded syllabus or a database -
    nothing else in the app would need to change.
    """
    with open(CURRICULUM_FILE, "r") as f:
        all_data = json.load(f)
    return all_data.get(curriculum_name)


def get_available_curriculums():
    """Returns the list of all curriculum names we have data for."""
    with open(CURRICULUM_FILE, "r") as f:
        all_data = json.load(f)
    return list(all_data.keys())

RECOMMENDATIONS_FILE = os.path.join("data", "skill_recommendations.json")


def get_skill_recommendation(skill_name: str):
    """
    Returns duration, courses, project, and reasoning for learning a given skill.
    Mock data today - could later pull from a real course-catalog API.
    """
    with open(RECOMMENDATIONS_FILE, "r") as f:
        all_data = json.load(f)
    return all_data.get(skill_name)