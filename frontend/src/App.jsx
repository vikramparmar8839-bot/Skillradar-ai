import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import "./index.css";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: "◈" },
  { id: "resume", label: "Resume", icon: "▣" },
  { id: "radar", label: "Industry Radar", icon: "⌁" },
  { id: "gap", label: "Curriculum Gap", icon: "◇" },
  { id: "roadmap", label: "Roadmap", icon: "↗" },
  { id: "dashboard", label: "Readiness", icon: "◉" },
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
  const [activeSection, setActiveSection] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("skillradar-theme");
    return savedTheme !== "light";
  });

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
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("skillradar-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

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
      name,
      education,
      current_skills: currentSkills,
      target_career: targetCareer,
    };

    fetch(`${API_URL}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    })
      .then((response) => response.json())
      .then(() => setStatusMessage("Profile saved successfully."))
      .catch(() => setStatusMessage("Error saving profile."));
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
      .catch(() => setUploadStatus("Error uploading resume."));
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
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const chartData = dashboardData
    ? [
        { name: "Covered", value: dashboardData.covered_count },
        { name: "Missing", value: dashboardData.missing_count },
      ]
    : [];

  const readiness = dashboardData?.readiness_score ?? 0;
  const totalSkills = dashboardData?.total_count ?? 0;
  const coveredSkills = dashboardData?.covered_count ?? 0;
  const missingSkills = dashboardData?.missing_count ?? 0;
  const readinessLabel =
    readiness >= 80 ? "Strong match" : readiness >= 60 ? "On track" : "Needs focus";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span>✦</span>
          </div>
          <div>
            <strong>SkillRadar</strong>
            <small>AI CAREER NAVIGATOR</small>
          </div>
        </div>

        <div className="sidebar-label">NAVIGATION</div>
        <nav className="side-nav">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`side-link ${activeSection === section.id ? "active" : ""}`}
              onClick={() => scrollToSection(section.id)}
            >
              <span className="side-icon">{section.icon}</span>
              <span>{section.label}</span>
              {section.id === "dashboard" && dashboardData && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-label sidebar-secondary">SYSTEM</div>
        <div className="system-card">
          <div className="live-dot" />
          <div>
            <strong>AI engine online</strong>
            <span>Personalization active</span>
          </div>
        </div>

        <div className="profile-mini">
          <div className="avatar">
            {(name || "A").trim().charAt(0).toUpperCase()}
          </div>
          <div className="profile-mini-copy">
            <strong>{name || "Your Profile"}</strong>
            <span>{targetCareer || "Career Explorer"}</span>
          </div>
          <span className="online-dot" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">REAL-TIME CAREER INTELLIGENCE</div>
            <h1>AI Career Navigator</h1>
          </div>
          <div className="topbar-actions">
            <div className="connection-status">
              <span className="live-dot" />
              AI ENGINE ONLINE
            </div>

            <button
              className="theme-toggle"
              onClick={() => setDarkMode((current) => !current)}
              title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
              aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            >
              <span className="theme-icon">{darkMode ? "☀" : "☾"}</span>
            </button>

            <button
              className="top-action"
              onClick={() => scrollToSection("profile")}
              title="Open profile"
            >
              ◌
            </button>
            <div className="top-avatar">
              {(name || "A").trim().charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="content">
          <section className="hero-strip">
            <div>
              <span className="hero-kicker">PERSONALIZED CAREER INTELLIGENCE</span>
              <h2>
                {targetCareer
                  ? `Your journey to ${targetCareer}`
                  : "Build your path to the career you want"}
              </h2>
              <p>
                Upload your resume, compare industry requirements, identify gaps,
                and follow an AI-generated learning roadmap.
              </p>
            </div>
            <div className="hero-score">
              <div className="score-ring small" style={{ "--score": `${readiness}%` }}>
                <span>{dashboardData ? `${Math.round(readiness)}%` : "--"}</span>
              </div>
              <div>
                <span>READINESS</span>
                <strong>{dashboardData ? readinessLabel : "Awaiting data"}</strong>
              </div>
            </div>
          </section>

          <section id="dashboard" className="dashboard-grid page-section">
            <div className="metric-card cyan">
              <span className="metric-label">SKILLS COVERED</span>
              <strong>{dashboardData ? coveredSkills : "--"}</strong>
              <small>{dashboardData ? `of ${totalSkills} required skills` : "Run a career comparison"}</small>
              <div className="metric-line"><span style={{ width: `${totalSkills ? (coveredSkills / totalSkills) * 100 : 0}%` }} /></div>
            </div>

            <div className="metric-card purple">
              <span className="metric-label">READINESS SCORE</span>
              <strong>{dashboardData ? `${Math.round(animatedScore)}%` : "--"}</strong>
              <small>{dashboardData ? readinessLabel : "Personalized after comparison"}</small>
              <div className="metric-line"><span style={{ width: `${readiness}%` }} /></div>
            </div>

            <div className="metric-card pink">
              <span className="metric-label">SKILL GAPS</span>
              <strong>{dashboardData ? missingSkills : "--"}</strong>
              <small>{dashboardData ? "Skills to prioritize" : "No gaps calculated yet"}</small>
              <div className="metric-line"><span style={{ width: `${totalSkills ? (missingSkills / totalSkills) * 100 : 0}%` }} /></div>
            </div>

            <div className="metric-card yellow">
              <span className="metric-label">NEXT SKILL</span>
              <strong className="metric-text">
                {dashboardData?.recommended_next_skill || "—"}
              </strong>
              <small>AI recommended priority</small>
              <div className="spark-bars">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>

            <section id="profile" className="panel-card profile-panel page-section">
              <div className="card-header">
                <div>
                  <span className="card-kicker">01 / PROFILE</span>
                  <h3>Student profile</h3>
                </div>
                <span className="status-pill">PERSONALIZE</span>
              </div>
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Kumar"
                  />
                </div>
                <div className="field">
                  <label>Education</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="B.Tech Computer Science"
                  />
                </div>
                <div className="field">
                  <label>Current skills</label>
                  <input
                    type="text"
                    value={currentSkills}
                    onChange={(e) => setCurrentSkills(e.target.value)}
                    placeholder="Python, SQL, React..."
                  />
                </div>
                <div className="field">
                  <label>Target career</label>
                  <input
                    type="text"
                    value={targetCareer}
                    onChange={(e) => setTargetCareer(e.target.value)}
                    placeholder="Data Scientist"
                  />
                </div>
                <button type="submit" className="primary-btn">Save profile <span>↗</span></button>
              </form>
              {statusMessage && <p className="status-text">{statusMessage}</p>}
            </section>

            <section id="resume" className="panel-card resume-panel page-section">
              <div className="card-header">
                <div>
                  <span className="card-kicker">02 / RESUME ANALYSIS</span>
                  <h3>Resume intelligence</h3>
                </div>
                <span className="icon-badge">▣</span>
              </div>
              <div className="upload-zone">
                <div className="document-icon">▤</div>
                <div>
                  <strong>{selectedFile ? selectedFile.name : "Upload your resume"}</strong>
                  <span>PDF document • AI skill extraction</span>
                </div>
                <label className="browse-btn">
                  Browse
                  <input type="file" accept=".pdf" onChange={handleFileChange} />
                </label>
              </div>
              <button onClick={handleUpload} className="secondary-btn">Analyze resume <span>✦</span></button>
              {uploadStatus && <p className="status-text">{uploadStatus}</p>}
              {extractedSkills.length > 0 && (
                <div className="skill-block">
                  <div className="mini-heading">IDENTIFIED SKILLS</div>
                  <ul className="chip-list">
                    {extractedSkills.map((skill, index) => (
                      <li key={index} className="chip covered">{skill}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section id="radar" className="panel-card radar-panel page-section">
              <div className="card-header">
                <div>
                  <span className="card-kicker">03 / INDUSTRY RADAR</span>
                  <h3>Market skill demand</h3>
                </div>
                <span className="status-pill cyan-pill">LIVE</span>
              </div>
              <div className="field compact-field">
                <label>Target career</label>
                <select value={selectedCareer} onChange={handleCareerChange}>
                  <option value="">Select a career</option>
                  {careers.map((career, index) => (
                    <option key={index} value={career}>{career}</option>
                  ))}
                </select>
              </div>
              {!industryData && (
                <div className="empty-state compact-empty">
                  <span>⌁</span>
                  Select a career to load current industry skills.
                </div>
              )}
              {industryData && (
                <div className="radar-layout">
                  <div className="radar-visual">
                    <div className="radar-grid">
                      <span /><span /><span /><span />
                      <div className="radar-sweep" />
                      <div className="radar-core">AI</div>
                    </div>
                  </div>
                  <div className="skill-demand">
                    <div className="mini-heading">CORE SKILLS</div>
                    {industryData.core_skills.slice(0, 5).map((skill, index) => (
                      <div className="demand-row" key={index}>
                        <span>{skill}</span>
                        <div className="demand-bar"><i style={{ width: `${92 - index * 7}%` }} /></div>
                      </div>
                    ))}
                    <div className="mini-heading emerging-title">EMERGING</div>
                    <div className="chip-list">
                      {industryData.emerging_skills.slice(0, 4).map((skill, index) => (
                        <span key={index} className="chip missing">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section id="gap" className="panel-card gap-panel page-section">
              <div className="card-header">
                <div>
                  <span className="card-kicker">04 / GAP ANALYSIS</span>
                  <h3>Curriculum vs industry</h3>
                </div>
                <span className="icon-badge orange">◇</span>
              </div>

              <div className="two-fields">
                <div className="field compact-field">
                  <label>Curriculum</label>
                  <select value={selectedCurriculum} onChange={handleCurriculumChange}>
                    <option value="">Select curriculum</option>
                    {curriculums.map((curriculum, index) => (
                      <option key={index} value={curriculum}>{curriculum}</option>
                    ))}
                  </select>
                </div>
                <div className="field compact-field">
                  <label>Career</label>
                  <select value={comparisonCareer} onChange={handleComparisonCareerChange}>
                    <option value="">Select career</option>
                    {careers.map((career, index) => (
                      <option key={index} value={career}>{career}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!comparisonResult && (
                <div className="gap-placeholder">
                  <div className="placeholder-ring">◎</div>
                  <div>
                    <strong>Waiting for comparison</strong>
                    <span>Select both fields to reveal covered and missing skills.</span>
                  </div>
                </div>
              )}

              {comparisonResult && (
                <div className="comparison-grid">
                  <div className="comparison-card covered-card">
                    <div className="comparison-title"><span>●</span> COVERED</div>
                    <strong>{comparisonResult.covered_skills.length}</strong>
                    <ul className="chip-list">
                      {comparisonResult.covered_skills.map((skill, index) => (
                        <li key={index} className="chip covered">{skill}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="comparison-card missing-card">
                    <div className="comparison-title"><span>●</span> MISSING</div>
                    <strong>{comparisonResult.missing_skills.length}</strong>
                    <ul className="chip-list">
                      {comparisonResult.missing_skills.map((skill, index) => (
                        <li key={index} className="chip missing">{skill}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section id="roadmap" className="panel-card roadmap-panel page-section">
              <div className="card-header">
                <div>
                  <span className="card-kicker">05 / LEARNING PATH</span>
                  <h3>Personalized roadmap</h3>
                </div>
                <span className="icon-badge purple">↗</span>
              </div>

              {!roadmapData && (
                <div className="empty-state roadmap-empty">
                  <div className="roadmap-empty-line" />
                  <strong>No roadmap yet</strong>
                  <span>Choose a curriculum and target career to generate your path.</span>
                </div>
              )}

              {roadmapData?.roadmap && (
                <div className="roadmap-track">
                  {roadmapData.roadmap.map((item, index) => {
                    const isOpen = expandedSkill === item.skill;
                    return (
                      <div
                        key={index}
                        className={`roadmap-node ${isOpen ? "open" : ""}`}
                        onClick={() => toggleSkill(item.skill)}
                      >
                        <div className="node-marker">{String(index + 1).padStart(2, "0")}</div>
                        <div className="node-content">
                          <div className="node-meta">PRIORITY {index + 1} • {item.duration}</div>
                          <h4>{item.skill}</h4>
                          <span>{isOpen ? "Collapse details" : "View learning plan"} {isOpen ? "↑" : "↓"}</span>
                          {isOpen && (
                            <div className="details">
                              <p><strong>Courses</strong></p>
                              <ul>
                                {item.courses.map((course, i) => <li key={i}>{course}</li>)}
                              </ul>
                              <p><strong>Project</strong> — {item.project}</p>
                              <p><strong>Why it matters</strong> — {item.why_it_matters}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel-card readiness-panel page-section">
              <div className="card-header">
                <div>
                  <span className="card-kicker">06 / READINESS</span>
                  <h3>Career readiness signal</h3>
                </div>
                <span className="status-pill">AI ANALYSIS</span>
              </div>

              {dashboardData ? (
                <div className="readiness-content">
                  <div className="large-score">
                    <div className="score-ring" style={{ "--score": `${readiness}%` }}>
                      <div>
                        <strong>{Math.round(readiness)}%</strong>
                        <span>READY</span>
                      </div>
                    </div>
                    <div className="score-copy">
                      <span className="card-kicker">CURRENT SIGNAL</span>
                      <h4>{readinessLabel}</h4>
                      <p>
                        {coveredSkills} of {totalSkills} required skills are covered.
                        Focus next on <strong>{dashboardData.recommended_next_skill || "your highest-priority gap"}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="chart-card">
                    <div className="mini-heading">SKILL COVERAGE</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke="#667080" />
                        <YAxis allowDecimals={false} stroke="#667080" />
                        <Tooltip
                          contentStyle={{
                            background: "#10131b",
                            border: "1px solid rgba(255,255,255,.1)",
                            borderRadius: "10px",
                            color: "#f5f7fb",
                          }}
                        />
                        <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                          <Cell fill="#16e0d0" />
                          <Cell fill="#e83f87" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="readiness-empty">
                  <div className="score-ring" style={{ "--score": "0%" }}>
                    <div><strong>--</strong><span>WAITING</span></div>
                  </div>
                  <div>
                    <h4>Generate your readiness report</h4>
                    <p>Complete the curriculum + career comparison above to activate your AI readiness dashboard.</p>
                  </div>
                </div>
              )}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
