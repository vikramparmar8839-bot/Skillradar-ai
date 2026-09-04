import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import "./index.css";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "resume", label: "Resume" },
  { id: "radar", label: "Industry Radar" },
  { id: "gap", label: "Curriculum Gap" },
  { id: "roadmap", label: "Roadmap" },
  { id: "dashboard", label: "Readiness" },
];

function App() {
  const [name, setName] = useState("");
  const [education, setEducation] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [targetCareer, setTargetCareer] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");

  const [careers, setCareers] = useState([]);
  const [selectedCareer, setSelectedCareer] = useState("");
  const [industryData, setIndustryData] = useState(null);

  const [curriculums, setCurriculums] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [comparisonCareer, setComparisonCareer] = useState("");
  const [comparisonResult, setComparisonResult] = useState(null);

  const [roadmapData, setRoadmapData] = useState(null);
  const [expandedSkill, setExpandedSkill] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  const API_URL = "https://skillradar-ai.onrender.com";

  useEffect(() => {
    fetch(`${API_URL}/careers`)
      .then((response) => response.json())
      .then((data) => setCareers(data))
      .catch((error) => console.log("Error loading careers:", error));

    fetch(`${API_URL}/curriculums`)
      .then((response) => response.json())
      .then((data) => setCurriculums(data))
      .catch((error) => console.log("Error loading curriculums:", error));
  }, []);

  useEffect(() => {
    if (!dashboardData) {
      setAnimatedScore(0);
      return;
    }

    const target = dashboardData.readiness_score;
    setAnimatedScore(0);

    let current = 0;
    const step = Math.max(1, Math.round(target / 30));

    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        setAnimatedScore(target);
        clearInterval(interval);
      } else {
        setAnimatedScore(current);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [dashboardData]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const profileData = {
      name: name,
      education: education,
      current_skills: currentSkills,
      target_career: targetCareer,
    };

    fetch(`${API_URL}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    })
      .then((response) => response.json())
      .then((data) => setStatusMessage("Profile saved successfully."))
      .catch((error) => setStatusMessage("Error saving profile."));
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploadStatus("Uploading...");

    fetch(`${API_URL}/upload-resume`, {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        setExtractedSkills(data.extracted_skills);
        setUploadStatus("Resume analyzed successfully.");
      })
      .catch((error) => setUploadStatus("Error uploading resume."));
  };

  const handleCareerChange = (event) => {
    const career = event.target.value;
    setSelectedCareer(career);

    if (!career) {
      setIndustryData(null);
      return;
    }

    fetch(`${API_URL}/industry-skills/${career}`)
      .then((response) => response.json())
      .then((data) => setIndustryData(data))
      .catch((error) => console.log("Error loading skills:", error));
  };

  const runComparison = (curriculum, career) => {
    if (!curriculum || !career) {
      setComparisonResult(null);
      setRoadmapData(null);
      setDashboardData(null);
      return;
    }

    fetch(`${API_URL}/compare/${curriculum}/${career}`)
      .then((response) => response.json())
      .then((data) => setComparisonResult(data))
      .catch((error) => console.log("Error comparing:", error));

    fetch(`${API_URL}/roadmap/${curriculum}/${career}`)
      .then((response) => response.json())
      .then((data) => setRoadmapData(data))
      .catch((error) => console.log("Error loading roadmap:", error));

    fetch(`${API_URL}/dashboard/${curriculum}/${career}`)
      .then((response) => response.json())
      .then((data) => setDashboardData(data))
      .catch((error) => console.log("Error loading dashboard:", error));
  };

  const handleCurriculumChange = (event) => {
    const curriculum = event.target.value;
    setSelectedCurriculum(curriculum);
    runComparison(curriculum, comparisonCareer);
  };

  const handleComparisonCareerChange = (event) => {
    const career = event.target.value;
    setComparisonCareer(career);
    runComparison(selectedCurriculum, career);
  };

  const toggleSkill = (skillName) => {
    setExpandedSkill(expandedSkill === skillName ? null : skillName);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const chartData = dashboardData
    ? [
        { name: "Covered", value: dashboardData.covered_count },
        { name: "Missing", value: dashboardData.missing_count },
      ]
    : [];

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-brand">SkillRadar AI</div>
        <div className="navbar-links">
          {SECTIONS.map((section) => (
            <span
              key={section.id}
              className="navbar-link"
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </span>
          ))}
        </div>
      </nav>

      <div className="page-content">
        <section id="profile" className="page-section">
          <div className="section-header">
            <h2>Student profile</h2>
            <p>Tell us about yourself so we can personalize your roadmap.</p>
          </div>
          <div className="panel">
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Education</label>
                <input type="text" value={education} onChange={(e) => setEducation(e.target.value)} />
              </div>
              <div className="field">
                <label>Current skills</label>
                <input type="text" value={currentSkills} onChange={(e) => setCurrentSkills(e.target.value)} />
              </div>
              <div className="field">
                <label>Target career</label>
                <input type="text" value={targetCareer} onChange={(e) => setTargetCareer(e.target.value)} />
              </div>
              <button type="submit" className="btn">Save profile</button>
            </form>
            {statusMessage && <p className="status-text">{statusMessage}</p>}
          </div>
        </section>

        <hr className="section-divider" />

        <section id="resume" className="page-section">
          <div className="section-header">
            <h2>Resume analysis</h2>
            <p>Upload a PDF resume to detect skills automatically.</p>
          </div>
          <div className="panel">
            <input type="file" accept=".pdf" onChange={handleFileChange} />
            <br /><br />
            <button onClick={handleUpload} className="btn">Upload resume</button>
            {uploadStatus && <p className="status-text">{uploadStatus}</p>}
            {extractedSkills.length > 0 && (
              <ul className="chip-list">
                {extractedSkills.map((skill, index) => (
                  <li key={index} className="chip covered">{skill}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <hr className="section-divider" />

        <section id="radar" className="page-section">
          <div className="section-header">
            <h2>Industry skill radar</h2>
            <p>See what a target career currently demands.</p>
          </div>
          <div className="panel">
            <div className="field">
              <label>Career</label>
              <select value={selectedCareer} onChange={handleCareerChange}>
                <option value="">-- Select a career --</option>
                {careers.map((career, index) => (
                  <option key={index} value={career}>{career}</option>
                ))}
              </select>
            </div>
            {!industryData && <p className="empty-state">Select a career to see its skill radar.</p>}
            {industryData && (
              <div>
                <h3>Core skills</h3>
                <ul className="chip-list">
                  {industryData.core_skills.map((skill, index) => (
                    <li key={index} className="chip covered">{skill}</li>
                  ))}
                </ul>
                <h3 style={{ marginTop: "18px" }}>Emerging skills</h3>
                <ul className="chip-list">
                  {industryData.emerging_skills.map((skill, index) => (
                    <li key={index} className="chip missing">{skill}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <hr className="section-divider" />

        <section id="gap" className="page-section">
          <div className="section-header">
            <h2>Curriculum vs industry</h2>
            <p>Compare a sample curriculum against what industry needs.</p>
          </div>
          <div className="panel">
            <div className="field">
              <label>Curriculum</label>
              <select value={selectedCurriculum} onChange={handleCurriculumChange}>
                <option value="">-- Select a curriculum --</option>
                {curriculums.map((curriculum, index) => (
                  <option key={index} value={curriculum}>{curriculum}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Career</label>
              <select value={comparisonCareer} onChange={handleComparisonCareerChange}>
                <option value="">-- Select a career --</option>
                {careers.map((career, index) => (
                  <option key={index} value={career}>{career}</option>
                ))}
              </select>
            </div>

            {!comparisonResult && <p className="empty-state">Select both fields to see the comparison.</p>}

            {comparisonResult && (
              <div>
                <h3>Covered</h3>
                <ul className="chip-list">
                  {comparisonResult.covered_skills.map((skill, index) => (
                    <li key={index} className="chip covered">{skill}</li>
                  ))}
                </ul>
                <h3 style={{ marginTop: "18px" }}>Missing</h3>
                <ul className="chip-list">
                  {comparisonResult.missing_skills.map((skill, index) => (
                    <li key={index} className="chip missing">{skill}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <hr className="section-divider" />

        <section id="roadmap" className="page-section">
          <div className="section-header">
            <h2>Personalized roadmap</h2>
            <p>Click a skill to see the full plan. Set curriculum and career above first.</p>
          </div>

          {!roadmapData && <p className="empty-state">No roadmap yet. Pick a curriculum and career in the Curriculum Gap section.</p>}

          {roadmapData && roadmapData.roadmap && roadmapData.roadmap.map((item, index) => {
            const isOpen = expandedSkill === item.skill;
            return (
              <div key={index} className="roadmap-item" onClick={() => toggleSkill(item.skill)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="priority-tag">Priority {index + 1} — {item.duration}</span>
                    <h3>{item.skill}</h3>
                  </div>
                  <span className="chevron">{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="details">
                    <p><strong>Courses:</strong></p>
                    <ul>
                      {item.courses.map((course, i) => (
                        <li key={i}>{course}</li>
                      ))}
                    </ul>
                    <p><strong>Project:</strong> {item.project}</p>
                    <p><strong>Why it matters:</strong> {item.why_it_matters}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <hr className="section-divider" />

        <section id="dashboard" className="page-section">
          <div className="section-header">
            <h2>Career readiness</h2>
            <p>Set curriculum and career above to generate this.</p>
          </div>

          {!dashboardData && <p className="empty-state">No data yet. Pick a curriculum and career in the Curriculum Gap section.</p>}

          {dashboardData && (
            <div>
              <div className="readiness-hero">
                <div className="radar-sweep"></div>
                <div className="score">{animatedScore}%</div>
                <div className="label">Career readiness score</div>
              </div>

              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                Skills covered: {dashboardData.covered_count} / {dashboardData.total_count}
              </p>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#667085" />
                  <YAxis allowDecimals={false} stroke="#667085" />
                  <Tooltip />
                  <Bar dataKey="value" isAnimationActive={true} animationDuration={800}>
                    <Cell fill="#178A5D" />
                    <Cell fill="#D64550" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {dashboardData.recommended_next_skill && (
                <p style={{ marginTop: "16px" }}>
                  <strong>Recommended next skill:</strong> {dashboardData.recommended_next_skill}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;