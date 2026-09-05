import re
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

# Practical seed taxonomy. Replace/extend from ESCO (recommended) or an approved
# institutional taxonomy. Aliases prevent ReactJS/React.js/React from becoming
# separate skills.
SKILL_ALIASES = {
    "python": ["python", "python3"], "sql": ["sql", "mysql", "postgresql", "postgres"],
    "javascript": ["javascript", "js", "ecmascript"], "typescript": ["typescript", "ts"],
    "react": ["react", "reactjs", "react.js"], "node.js": ["node.js", "nodejs", "node js"],
    "java": ["java"], "c++": ["c++", "cpp"], "c#": ["c#", "c sharp"],
    "aws": ["aws", "amazon web services"], "azure": ["azure", "microsoft azure"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "docker": ["docker"], "kubernetes": ["kubernetes", "k8s"], "terraform": ["terraform"],
    "git": ["git", "github", "gitlab"], "linux": ["linux"],
    "power bi": ["power bi", "powerbi"], "tableau": ["tableau"],
    "excel": ["excel", "microsoft excel"], "pandas": ["pandas"], "numpy": ["numpy"],
    "scikit-learn": ["scikit-learn", "sklearn"], "tensorflow": ["tensorflow"], "pytorch": ["pytorch"],
    "machine learning": ["machine learning", "machine-learning", "ml"],
    "deep learning": ["deep learning"], "nlp": ["natural language processing", "nlp"],
    "generative ai": ["generative ai", "genai", "generative artificial intelligence"],
    "llm": ["llm", "large language model", "large language models"],
    "cybersecurity": ["cybersecurity", "cyber security", "information security"],
    "devops": ["devops", "dev ops"], "data engineering": ["data engineering", "data engineer"],
    "system design": ["system design", "distributed systems"], "rest api": ["rest api", "restful api"],
    "agile": ["agile", "scrum"], "figma": ["figma"], "html": ["html", "html5"], "css": ["css", "css3"],
}

SKILL_PATTERNS = {
    skill: [re.compile(r"(?<![a-z0-9+#.-])" + re.escape(alias) + r"(?![a-z0-9+#.-])", re.I) for alias in aliases]
    for skill, aliases in SKILL_ALIASES.items()
}


def clean_text(text):
    return re.sub(r"\s+", " ", (text or "")).strip()


def extract_skills(text):
    text = clean_text(text)
    found = []
    for skill, patterns in SKILL_PATTERNS.items():
        if any(p.search(text) for p in patterns):
            found.append(skill)
    return found


def infer_proficiency(text, skill):
    t = text.lower()
    patterns = [
        ("advanced", r"advanced|expert|expertise|architect|lead|senior|deep knowledge|5\+\s*years|6\+\s*years|7\+\s*years"),
        ("intermediate", r"intermediate|proficient|strong|hands-on|2\+\s*years|3\+\s*years|4\+\s*years"),
        ("beginner", r"beginner|basic|familiar|knowledge of|exposure|0-1\s*years|1\+\s*years"),
    ]
    # Look for level language anywhere in the posting, with a slight boost if
    # the skill appears close to a proficiency phrase.
    for level, pat in patterns:
        if re.search(pat, t):
            return level
    return "unspecified"


def parse_date(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(s[:10], fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
    return None


def analyze_jobs(jobs, now=None):
    now = now or datetime.now(timezone.utc)
    total = len(jobs)
    skill_jobs = Counter()
    skill_recent = Counter()
    skill_previous = Counter()
    role_jobs = Counter()
    district_jobs = Counter()
    proficiency = defaultdict(Counter)
    skill_by_role = defaultdict(Counter)

    for job in jobs:
        text = clean_text(" ".join([job.get("title", ""), job.get("description", ""), job.get("snippet", "")]))
        skills = extract_skills(text)
        role = clean_text(job.get("title") or "Unknown role")
        location = clean_text(job.get("location") or "Unknown")
        dt = parse_date(job.get("updated") or job.get("posted_at"))
        if dt is None:
            dt = now
        age = now - dt
        role_jobs[role] += 1
        district_jobs[location] += 1
        for skill in skills:
            skill_jobs[skill] += 1
            skill_by_role[role][skill] += 1
            proficiency[skill][infer_proficiency(text, skill)] += 1
            if age <= timedelta(days=30):
                skill_recent[skill] += 1
            elif age <= timedelta(days=60):
                skill_previous[skill] += 1

    rows = []
    for skill, count in skill_jobs.most_common():
        recent = skill_recent[skill]
        previous = skill_previous[skill]
        trend = None if previous == 0 else round(((recent - previous) / previous) * 100, 1)
        level = proficiency[skill].most_common(1)[0][0] if proficiency[skill] else "unspecified"
        rows.append({
            "name": skill, "jobs": count,
            "demand": round((count / total) * 100, 1) if total else 0,
            "trend": trend or 0, "level": level,
            "proficiency": dict(proficiency[skill]),
        })

    return {
        "jobs": total,
        "skills": len(skill_jobs),
        "roles": len(role_jobs),
        "districts": len(district_jobs),
        "skills_data": rows[:50],
        "roles_data": [{"name": k, "jobs": v} for k, v in role_jobs.most_common(30)],
        "districts_data": [{"name": k, "jobs": v} for k, v in district_jobs.most_common(50)],
        "skill_by_role": {r: dict(c) for r, c in skill_by_role.items()},
        "generated_at": now.isoformat(),
        "data_window_days": 60,
    }
