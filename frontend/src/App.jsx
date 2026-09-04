import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import "./index.css";

const NAV_ITEMS = [
  { id: "profile", label: "Profile" },
  { id: "resume", label: "Resume" },
  { id: "radar", label: "Industry Radar" },
  { id: "gap", label: "Curriculum Gap" },
  { id: "roadmap", label: "Roadmap" },
  { id: "dashboard", label: "Readiness" },
];

// Radar-scope visualization for the readiness score.
// Renders concentric range rings, a rotating sweep, and a progress arc
// so the score reads as an instrument reading rather than a bare number.
function ReadinessRadar({ score }) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="radar-scope">
      <div className="radar-sweep" aria-hidden="true" />
      <svg viewBox="0 0 200 200" className="radar-rings" aria-hidden="true">
        <circle cx="100" cy="100" r="40" className="radar-ring" />
        <circle cx="100" cy="100" r="60" className="radar-ring" />
        <circle cx="100" cy="100" r="80" className="radar-ring" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          className="radar-progress"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="radar-score-text">
        <div className="score-num">{clamped}%</div>
        <div className="score-label">Career readiness</div>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form state (Day 2)
  const [name, setName] = useState("");
  const [education, setEducation] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [targetCareer, setTargetCareer] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Resume upload state (Day 3)
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedSkills, setExtractedSkills] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");

  // Industry Skill Radar state (Day 4)
  const [careers, setCareers] = useState([]);
  const [selectedCareer, setSelectedCareer] = useState("");
  const [industryData, setIndustryData] = useState(null);

  // Curriculum Comparison state (Day 5)
  const [curriculums, setCurriculums] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [comparisonCareer, setComparisonCareer] = useState("");
  const [comparisonResult, setComparisonResult] = useState(null);

  // Roadmap state (Day 6)
  const [roadmapData, setRoadmapData] = useState(null);

  // Dashboard state (Day 7)
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetch("https://skillradar-ai.onrender.com/careers")
      .then((response) => response.json())
      .then((data) => setCareers(data))
      .catch((error) => console.log("Error loading careers:", error));

    fetch("https://skillradar-ai.onrender.com/curriculums")
      .then((response) => response.json())
      .then((data) => setCurriculums(data))
      .catch((error) => console.log("Error loading curriculums:", error));
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    const profileData = {
      name: name,
      education: education,
      current_skills: currentSkills,
      target_career: targetCareer,
    };

    fetch("https://skillradar-ai.onrender.com/profile", {
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

    fetch("https://skillradar-ai.onrender.com/upload-resume", {
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

    fetch(`https://skillradar-ai.onrender.com/industry-skills/${career}`)
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

    fetch(`https://skillradar-ai.onrender.com/compare/${curriculum}/${career}`)
      .then((response) => response.json())
      .then((data) => setComparisonResult(data))
      .catch((error) => console.log("Error comparing:", error));

    fetch(`https://skillradar-ai.onrender.com/roadmap/${curriculum}/${career}`)
      .then((response) => response.json())
      .then((data) => setRoadmapData(data))
      .catch((error) => console.log("Error loading roadmap:", error));

    fetch(`https://skillradar-ai.onrender.com/dashboard/${curriculum}/${career}`)
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

  const chartData = dashboardData
    ? [
        { name: "Covered", value: dashboardData.covered_count },
        { name: "Missing", value: dashboardData.missing_count },
      ]
    : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
          </div>
          <div>
            <h1>SkillRadar</h1>
            <p>Skill-gap detection for students</p>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map((item, index) => (
            <div
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {activeTab === "profile" && (
          <div>
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
          </div>
        )}

        {activeTab === "resume" && (
          <div>
            <div className="section-header">
              <h2>Resume analysis</h2>
              <p>Upload a PDF resume to detect skills automatically.</p>
            </div>
            <div className="panel">
              <div className="file-drop">
                <input id="resume-file" type="file" accept=".pdf" onChange={handleFileChange} />
                <label htmlFor="resume-file" className="file-drop-label">
                  {selectedFile ? selectedFile.name : "Choose a PDF resume"}
                </label>
                <button onClick={handleUpload} className="btn">Analyze resume</button>
              </div>
              {uploadStatus && <p className="status-text">{uploadStatus}</p>}
              {extractedSkills.length > 0 && (
                <ul className="chip-list">
                  {extractedSkills.map((skill, index) => (
                    <li key={index} className="chip covered">{skill}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === "radar" && (
          <div>
            <div className="section-header">
              <h2>Industry skill radar</h2>
              <p>See what a target career currently demands.</p>
            </div>
            <div className="panel">
              <div className="field">
                <label>Career</label>
                <select value={selectedCareer} onChange={handleCareerChange}>
                  <option value="">Select a career</option>
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
                  <h3 style={{ marginTop: "24px" }}>Emerging skills</h3>
                  <ul className="chip-list">
                    {industryData.emerging_skills.map((skill, index) => (
                      <li key={index} className="chip missing">{skill}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "gap" && (
          <div>
            <div className="section-header">
              <h2>Curriculum vs industry</h2>
              <p>Compare a sample curriculum against what industry needs.</p>
            </div>
            <div className="panel">
              <div className="field-row">
                <div className="field">
                  <label>Curriculum</label>
                  <select value={selectedCurriculum} onChange={handleCurriculumChange}>
                    <option value="">Select a curriculum</option>
                    {curriculums.map((curriculum, index) => (
                      <option key={index} value={curriculum}>{curriculum}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Career</label>
                  <select value={comparisonCareer} onChange={handleComparisonCareerChange}>
                    <option value="">Select a career</option>
                    {careers.map((career, index) => (
                      <option key={index} value={career}>{career}</option>
                    ))}
                  </select>
                </div>
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
                  <h3 style={{ marginTop: "24px" }}>Missing</h3>
                  <ul className="chip-list">
                    {comparisonResult.missing_skills.map((skill, index) => (
                      <li key={index} className="chip missing">{skill}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "roadmap" && (
          <div>
            <div className="section-header">
              <h2>Personalized roadmap</h2>
              <p>Set curriculum and career on the Curriculum Gap tab to generate this.</p>
            </div>

            {!roadmapData && <p className="empty-state">No roadmap yet. Pick a curriculum and career on the Curriculum Gap tab.</p>}

            {roadmapData && roadmapData.roadmap && (
              <div className="timeline">
                {roadmapData.roadmap.map((item, index) => (
                  <div key={index} className="roadmap-item">
                    <span className="priority-tag">Step {index + 1}</span>
                    <h3>{item.skill}</h3>
                    <p><strong>Duration:</strong> {item.duration}</p>
                    <p><strong>Courses:</strong></p>
                    <ul>
                      {item.courses.map((course, i) => (
                        <li key={i}>{course}</li>
                      ))}
                    </ul>
                    <p><strong>Project:</strong> {item.project}</p>
                    <p><strong>Why it matters:</strong> {item.why_it_matters}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "dashboard" && (
          <div>
            <div className="section-header">
              <h2>Career readiness</h2>
              <p>Set curriculum and career on the Curriculum Gap tab to generate this.</p>
            </div>

            {!dashboardData && <p className="empty-state">No data yet. Pick a curriculum and career on the Curriculum Gap tab.</p>}

            {dashboardData && (
              <div className="panel">
                <div className="readiness-hero">
                  <ReadinessRadar score={dashboardData.readiness_score} />
                </div>

                <p className="readiness-subtext">
                  Skills covered: {dashboardData.covered_count} / {dashboardData.total_count}
                </p>

                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" stroke="#7C8AA8" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }} />
                    <YAxis allowDecimals={false} stroke="#7C8AA8" tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: "#121B2E", border: "1px solid #22304A", borderRadius: 8, fontFamily: "'IBM Plex Mono', monospace" }}
                      labelStyle={{ color: "#E8EDF5" }}
                    />
                    <Bar dataKey="value" isAnimationActive={true} animationDuration={800} radius={[4, 4, 0, 0]}>
                      <Cell fill="#5EEAD4" />
                      <Cell fill="#F5A623" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {dashboardData.recommended_next_skill && (
                  <p className="next-skill">
                    <strong>Recommended next skill:</strong> {dashboardData.recommended_next_skill}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
