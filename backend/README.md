# SkillRadar SIH26134 backend - integrated

This keeps the original candidate APIs and adds the labour-market pipeline.

## Existing APIs preserved
/health
/profile
/profiles
/upload-resume
/careers
/industry-skills/{career_name}
/curriculums
/curriculum-skills/{curriculum_name}
/compare/{curriculum_name}/{career_name}
/roadmap/{curriculum_name}/{career_name}
/dashboard/{curriculum_name}/{career_name}

## New market APIs
GET /market/health
POST /market/ingest/csv
POST /jobs/ingest
POST /market/sync/adzuna
GET /market/overview
POST /jobs/analyze
GET /market/skills
GET /market/trends
GET /market/roles
GET /market/districts
GET /market/skills/{skill}
POST /market/course-supply/csv
GET /market/course-health
GET /courses/health
GET /market/training-plan
GET /districts/{district}/training-plan

## Run
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

## Adzuna
Set ADZUNA_APP_ID and ADZUNA_APP_KEY on the server, never in the React frontend.

The market pipeline labels observed posting counts and derived skill analytics separately from modelled course/training estimates. Course-health and training numbers are heuristics, not government policy requirements.
