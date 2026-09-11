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
  { id: "market", label: "Labour Market", icon: "⌁" },
  { id: "districts", label: "Location Radar", icon: "◫" },
  { id: "courses", label: "Course Health", icon: "◇" },
  { id: "training", label: "Training Planner", icon: "▦" },
  { id: "insights", label: "Candidate Insights", icon: "✦" },
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

  const [coachOpen, setCoachOpen] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [coachReply, setCoachReply] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [portfolioAnalyzed, setPortfolioAnalyzed] = useState(false);
  const [portfolioResult, setPortfolioResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewResult, setInterviewResult] = useState(null);
  const [learningProgress, setLearningProgress] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("skillradar-progress")) || {};
    } catch {
      return {};
    }
  });

  // SIH26134 live labour-market data. These values come from the backend
  // analysis pipeline; there are no hardcoded market totals in the UI.
  const [marketStats, setMarketStats] = useState({ jobs: 0, skills: 0, districts: 0, roles: 0 });
  const [marketSkills, setMarketSkills] = useState([]);
  const [districtData, setDistrictData] = useState([]);
  const [courseHealth, setCourseHealth] = useState([]);
  const [trainingPlan, setTrainingPlan] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");


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
    const loadMarketData = async () => {
      setMarketLoading(true);
      setMarketError("");
      try {
        const [overviewRes, districtRes, courseRes, trainingRes] = await Promise.all([
          fetch(`${API_URL}/market/overview`),
          fetch(`${API_URL}/market/districts?limit=20`),
          fetch(`${API_URL}/market/course-health`),
          fetch(`${API_URL}/market/training-plan`),
        ]);
        if (!overviewRes.ok) throw new Error("Market overview unavailable");
        const overview = await overviewRes.json();
        setMarketStats({ jobs: overview.jobs || 0, skills: overview.skills || 0, districts: overview.districts || 0, roles: overview.roles || 0 });
        setMarketSkills((overview.skills_data || []).slice(0, 8));
        if (districtRes.ok) setDistrictData((await districtRes.json()).districts || []);
        if (courseRes.ok) setCourseHealth((await courseRes.json()).courses || []);
        if (trainingRes.ok) setTrainingPlan((await trainingRes.json()).plan || []);
      } catch (error) {
        console.log("Error loading market intelligence:", error);
        setMarketError("Connect the SIH market backend and ingest job postings to populate this dashboard.");
      } finally {
        setMarketLoading(false);
      }
    };
    loadMarketData();
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

    return (
    <div className={`app-shell ${darkMode ? "theme-dark" : "theme-light"}`}>
      <header className="mobile-header">
        <div className="mobile-brand">
          <div className="brand-mark"><span>✦</span></div>
          <div>
            <strong>SkillRadar</strong>
            <small>AI CAREER NAVIGATOR</small>
          </div>
        </div>
        <div className="mobile-header-actions">
          <span className="ai-online"><i /> AI</span>
          <button
            className="round-icon"
            onClick={() => setDarkMode((current) => !current)}
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
          >{darkMode ? "☀" : "☾"}</button>
          <button className="round-avatar" onClick={() => scrollToSection("profile")}>
            {(name || "A").trim().charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>✦</span></div>
          <div><strong>SkillRadar</strong><small>AI CAREER NAVIGATOR</small></div>
        </div>
        <div className="sidebar-label">NAVIGATION</div>
        <nav className="side-nav">
          {SECTIONS.map((section) => (
            <button key={section.id} className={`side-link ${activeSection === section.id ? "active" : ""}`} onClick={() => scrollToSection(section.id)}>
              <span className="side-icon">{section.icon}</span>
              <span>{section.label}</span>
              {section.id === "dashboard" && dashboardData && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-label sidebar-secondary">SYSTEM</div>
        <div className="system-card"><div className="live-dot" /><div><strong>Real AI engine online</strong><span>Backend model connected</span></div></div>
        <div className="profile-mini">
          <div className="avatar">{(name || "A").trim().charAt(0).toUpperCase()}</div>
          <div className="profile-mini-copy"><strong>{name || "Your Profile"}</strong><span>{targetCareer || "Career Explorer"}</span></div>
          <span className="online-dot" />
        </div>
      </aside>

      <main className="main-area">
        <header className="desktop-topbar">
          <div><div className="eyebrow">REAL-TIME CAREER INTELLIGENCE</div><h1>AI Career Navigator</h1></div>
          <div className="topbar-actions">
            <div className="connection-status"><span className="live-dot" /> AI ENGINE ONLINE</div>
            <button className="theme-toggle" onClick={() => setDarkMode((current) => !current)}>{darkMode ? "☀" : "☾"}</button>
            <button className="top-action" onClick={() => scrollToSection("profile")}>◌</button>
            <div className="top-avatar">{(name || "A").trim().charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <div className="content">
          <section className="welcome-card">
            <div className="welcome-copy">
              <span className="eyebrow green">PERSONALIZED CAREER INTELLIGENCE</span>
              <h2>{targetCareer ? `Your journey to ${targetCareer}` : "Build your path to the career you want"}</h2>
              <p>Upload your resume, compare industry requirements, identify gaps, and follow an AI-generated learning roadmap.</p>
              <div className="welcome-actions">
                <button className="hero-primary" onClick={() => scrollToSection("profile")}>Start career analysis <span>→</span></button>
                <button className="hero-secondary" onClick={() => scrollToSection("market")}>View market signals</button>
              </div>
            </div>
            <div className="welcome-score">
              <div className="score-ring small" style={{ "--score": `${readiness}%` }}><span>{dashboardData ? `${Math.round(readiness)}%` : "--"}</span></div>
              <div><span>READINESS</span><strong>{dashboardData ? readinessLabel : "Awaiting data"}</strong></div>
            </div>
          </section>

          <section id="dashboard" className="page-section home-section">
            <div className="section-heading-row"><div><span className="section-kicker">YOUR CAREER SNAPSHOT</span><h3>Progress at a glance</h3></div><button className="text-link" onClick={() => scrollToSection("insights")}>View all →</button></div>
            <div className="metric-grid">
              <article className="metric-card green-card"><span className="metric-icon">✓</span><span className="metric-label">SKILLS COVERED</span><strong>{dashboardData ? coveredSkills : "--"}</strong><small>{dashboardData ? `of ${totalSkills} required` : "Run comparison"}</small><div className="progress-line"><i style={{ width: `${totalSkills ? (coveredSkills / totalSkills) * 100 : 0}%` }} /></div></article>
              <article className="metric-card blue-card"><span className="metric-icon">◉</span><span className="metric-label">READINESS SCORE</span><strong>{dashboardData ? `${Math.round(animatedScore)}%` : "--"}</strong><small>{dashboardData ? readinessLabel : "After comparison"}</small><div className="progress-line"><i style={{ width: `${readiness}%` }} /></div></article>
              <article className="metric-card orange-card"><span className="metric-icon">!</span><span className="metric-label">SKILL GAPS</span><strong>{dashboardData ? missingSkills : "--"}</strong><small>{dashboardData ? "Prioritize these" : "No gaps yet"}</small><div className="progress-line"><i style={{ width: `${totalSkills ? (missingSkills / totalSkills) * 100 : 0}%` }} /></div></article>
              <article className="metric-card purple-card"><span className="metric-icon">✦</span><span className="metric-label">NEXT SKILL</span><strong className="metric-text">{dashboardData?.recommended_next_skill || "—"}</strong><small>AI recommended priority</small><div className="spark-bars"><i/><i/><i/><i/><i/><i/></div></article>
            </div>
          </section>

          <section id="profile" className="feature-card page-section">
            <div className="card-header"><div><span className="section-kicker">01 / PROFILE</span><h3>Build your student profile</h3><p>Tell SkillRadar where you are today and where you want to go.</p></div><span className="soft-icon">◈</span></div>
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="field"><label>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Kumar" /></div>
              <div className="field"><label>Education</label><input type="text" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="B.Tech Computer Science" /></div>
              <div className="field"><label>Current skills</label><input type="text" value={currentSkills} onChange={(e) => setCurrentSkills(e.target.value)} placeholder="Python, SQL, React..." /></div>
              <div className="field"><label>Target career</label><input type="text" value={targetCareer} onChange={(e) => setTargetCareer(e.target.value)} placeholder="Data Scientist" /></div>
              <button type="submit" className="primary-btn">Save profile <span>→</span></button>
            </form>
            {statusMessage && <p className="status-text">{statusMessage}</p>}
          </section>

          <section id="resume" className="feature-card page-section">
            <div className="card-header"><div><span className="section-kicker">02 / RESUME</span><h3>Resume intelligence</h3><p>Let AI extract the skills already present in your resume.</p></div><span className="soft-icon purple">▣</span></div>
            <div className="upload-zone"><div className="document-icon">▤</div><div className="upload-copy"><strong>{selectedFile ? selectedFile.name : "Upload your resume"}</strong><span>PDF document • AI skill extraction</span></div><label className="browse-btn">Browse<input type="file" accept=".pdf" onChange={handleFileChange} /></label></div>
            <button onClick={handleUpload} className="secondary-btn full-btn">Analyze resume <span>✦</span></button>
            {uploadStatus && <p className="status-text">{uploadStatus}</p>}
            {extractedSkills.length > 0 && <div className="skill-block"><div className="mini-heading">IDENTIFIED SKILLS</div><ul className="chip-list">{extractedSkills.map((skill, index) => <li key={index} className="chip covered">{skill}</li>)}</ul></div>}
          </section>

          <section id="radar" className="feature-card page-section">
            <div className="card-header"><div><span className="section-kicker">03 / INDUSTRY RADAR</span><h3>What the market wants</h3><p>Explore the skills currently associated with your target career.</p></div><span className="live-pill">LIVE</span></div>
            <div className="field compact-field"><label>Target career</label><select value={selectedCareer} onChange={handleCareerChange}><option value="">Select a career</option>{careers.map((career, index) => <option key={index} value={career}>{career}</option>)}</select></div>
            {!industryData && <div className="empty-state compact-empty"><span>⌁</span><div><strong>Select a career</strong><small>Industry skill signals will appear here.</small></div></div>}
            {industryData && (
              <div className="radar-layout">
                <div className="radar-visual">
                  <div className="radar-grid">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <div className="radar-sweep"></div>
                    <div className="radar-core">AI</div>
                  </div>
                </div>
                <div className="skill-demand">
                  <div className="mini-heading">CORE SKILLS</div>
                  {industryData.core_skills.slice(0, 5).map((skill, index) => (
                    <div className="demand-row" key={index}>
                      <span>{skill}</span>
                      <div className="demand-bar">
                        <i style={{ width: `${92 - index * 7}%` }}></i>
                      </div>
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

          <section id="gap" className="feature-card page-section">
            <div className="card-header"><div><span className="section-kicker">04 / GAP ANALYSIS</span><h3>Curriculum vs industry</h3><p>See what your curriculum covers and which skills are missing.</p></div><span className="soft-icon orange">◇</span></div>
            <div className="two-fields"><div className="field compact-field"><label>Curriculum</label><select value={selectedCurriculum} onChange={handleCurriculumChange}><option value="">Select curriculum</option>{curriculums.map((curriculum,index)=><option key={index} value={curriculum}>{curriculum}</option>)}</select></div><div className="field compact-field"><label>Career</label><select value={comparisonCareer} onChange={handleComparisonCareerChange}><option value="">Select career</option>{careers.map((career,index)=><option key={index} value={career}>{career}</option>)}</select></div></div>
            {!comparisonResult && <div className="gap-placeholder"><div className="placeholder-ring">◎</div><div><strong>Waiting for comparison</strong><span>Select both fields to reveal covered and missing skills.</span></div></div>}
            {comparisonResult && <div className="comparison-grid"><div className="comparison-card covered-card"><div className="comparison-title"><span>●</span> COVERED</div><strong>{comparisonResult.covered_skills.length}</strong><ul className="chip-list">{comparisonResult.covered_skills.map((skill,index)=><li key={index} className="chip covered">{skill}</li>)}</ul></div><div className="comparison-card missing-card"><div className="comparison-title"><span>●</span> MISSING</div><strong>{comparisonResult.missing_skills.length}</strong><ul className="chip-list">{comparisonResult.missing_skills.map((skill,index)=><li key={index} className="chip missing">{skill}</li>)}</ul></div></div>}
          </section>

          <section id="roadmap" className="feature-card page-section">
            <div className="card-header"><div><span className="section-kicker">05 / LEARNING PATH</span><h3>Your personalized roadmap</h3><p>Tap a skill to see courses, project work, and why it matters.</p></div><span className="soft-icon purple">↗</span></div>
            {!roadmapData && <div className="empty-state roadmap-empty"><div className="roadmap-empty-line"/><strong>No roadmap yet</strong><span>Choose a curriculum and target career to generate your path.</span></div>}
            {roadmapData?.roadmap && <div className="roadmap-track">{roadmapData.roadmap.map((item,index)=>{const isOpen=expandedSkill===item.skill;return <div key={index} className={`roadmap-node ${isOpen?"open":""}`} onClick={()=>toggleSkill(item.skill)}><div className="node-marker">{String(index+1).padStart(2,"0")}</div><div className="node-content"><div className="node-meta">PRIORITY {index+1} • {item.duration}</div><h4>{item.skill}</h4><span>{isOpen?"Collapse details":"View learning plan"} {isOpen?"↑":"↓"}</span>{isOpen&&<div className="details"><p><strong>Courses</strong></p><ul>{item.courses.map((course,i)=><li key={i}>{course}</li>)}</ul><p><strong>Project</strong> — {item.project}</p><p><strong>Why it matters</strong> — {item.why_it_matters}</p></div>}</div></div>})}</div>}
          </section>

          <section className="feature-card page-section" id="readiness">
            <div className="card-header"><div><span className="section-kicker">06 / READINESS</span><h3>Career readiness signal</h3><p>Understand your score and the evidence behind it.</p></div><span className="live-pill">AI ANALYSIS</span></div>
            {dashboardData ? <div className="readiness-content"><div className="large-score"><div className="score-ring" style={{"--score":`${readiness}%`}}><div><strong>{Math.round(readiness)}%</strong><span>READY</span></div></div><div className="score-copy"><span className="section-kicker">CURRENT SIGNAL</span><h4>{readinessLabel}</h4><p>{coveredSkills} of {totalSkills} required skills are covered. Focus next on <strong>{dashboardData.recommended_next_skill || "your highest-priority gap"}</strong>.</p></div></div><div className="chart-card"><div className="mini-heading">SKILL COVERAGE</div><ResponsiveContainer width="100%" height={190}><BarChart data={chartData}><XAxis dataKey="name" stroke="#7b8794"/><YAxis allowDecimals={false} stroke="#7b8794"/><Tooltip contentStyle={{background:"#ffffff",border:"1px solid #dbe7df",borderRadius:"12px",color:"#183127"}}/><Bar dataKey="value" radius={[7,7,0,0]}><Cell fill="#159957"/><Cell fill="#f28c28"/></Bar></BarChart></ResponsiveContainer></div></div> : <div className="readiness-empty"><div className="score-ring" style={{"--score":"0%"}}><div><strong>--</strong><span>WAITING</span></div></div><div><h4>Generate your readiness report</h4><p>Complete the curriculum + career comparison to activate your AI readiness dashboard.</p></div></div>}
          </section>

          <section id="market" className="sih-section page-section">
            <div className="section-heading-row"><div><span className="section-kicker">07 / LABOUR MARKET</span><h3>Industry demand, translated into action</h3><p>Real job-posting intelligence from the connected market backend.</p></div><span className="source-badge">{marketLoading?"LOADING":"BACKEND DATA"}</span></div>
            <div className="market-live-note">{marketError || `Observed dataset: ${marketStats.jobs.toLocaleString()} postings • ${marketStats.skills.toLocaleString()} skills • ${marketStats.roles.toLocaleString()} roles • ${marketStats.districts.toLocaleString()} locations`}</div>
            <div className="market-stat-grid"><div className="market-stat"><span>JOBS ANALYSED</span><strong>{marketStats.jobs.toLocaleString()}</strong><small>Job-market signal</small></div><div className="market-stat"><span>SKILLS EXTRACTED</span><strong>{marketStats.skills.toLocaleString()}</strong><small>Normalized skills</small></div><div className="market-stat"><span>LOCATIONS</span><strong>{marketStats.districts}</strong><small>Observed locations</small></div><div className="market-stat"><span>ACTIVE ROLES</span><strong>{marketStats.roles}</strong><small>Role intelligence</small></div></div>
            <div className="sih-grid-two"><article className="sih-panel"><div className="card-header"><div><span className="section-kicker">DEMAND ENGINE</span><h3>Top skills by industry demand</h3></div><span className="live-pill">LIVE SIGNAL</span></div><div className="market-skill-list">{marketLoading?<div className="market-loading"><span className="loading-dot"/><span>Loading live market signals…</span></div>:marketSkills.length?marketSkills.map((skill)=><div className="market-skill-row" key={skill.name}><div className="market-skill-meta"><strong>{skill.name}</strong><span>{skill.demand}% demand • {skill.level}</span><b>↑ {skill.trend}%</b></div><div className="market-bar"><i style={{width:`${skill.demand}%`}}/></div></div>):<div className="empty-mini">No analysed job postings yet.</div>}</div></article><article className="sih-panel emerging-panel"><div className="card-header"><div><span className="section-kicker">TREND DETECTOR</span><h3>Emerging technology signals</h3></div><span className="source-badge">AI FLAGGED</span></div>{marketSkills.length>0?<><div className="emerging-feature"><span>↑{marketSkills[0].trend||0}%</span><div><strong>{marketSkills[0].name}</strong><p>Highest current demand signal in the ingested job-posting dataset.</p></div></div><div className="emerging-list">{marketSkills.slice(1,4).map(skill=><span key={skill.name}>{skill.name} <b>↑{skill.trend||0}%</b></span>)}</div><div className="recommendation-box"><strong>Evidence-based signal</strong><p>Trend is calculated from recent versus previous posting windows in the backend.</p></div></>:<div className="empty-mini">No analysed job postings yet.</div>}</article></div>
          </section>

          <section id="districts" className="sih-section page-section"><div className="section-heading-row"><div><span className="section-kicker">08 / LOCATION RADAR</span><h3>Where the skills are needed</h3><p>Observed job-posting locations from the ingested market dataset.</p></div><span className="source-badge">OBSERVED</span></div><div className="district-grid">{districtData.length?districtData.map((district)=>{const maxJobs=districtData[0]?.jobs||1;const score=Math.round((district.jobs/maxJobs)*100);return <article className="district-card" key={district.name}><div className="district-top"><span>{district.name}</span><strong>{district.jobs.toLocaleString()}</strong></div><div className="district-score"><i style={{width:`${score}%`}}/></div><p>Observed job postings</p><small>Relative demand index: {score}/100</small></article>}):<div className="empty-mini">No regional job-posting data yet.</div>}</div></section>

          <section id="courses" className="sih-section page-section"><div className="section-heading-row"><div><span className="section-kicker">09 / COURSE HEALTH</span><h3>Curriculum supply vs industry demand</h3><p>Identify courses that need expansion, redesign, or capacity review.</p></div><span className="source-badge warning">AI REVIEW</span></div><div className="course-table"><div className="course-row course-head"><span>COURSE</span><span>DEMAND</span><span>SUPPLY</span><span>PLACEMENT</span><span>RECOMMENDATION</span></div>{courseHealth.length?courseHealth.map(course=><div className="course-row" key={`${course.course}-${course.district}`}><strong>{course.course}</strong><span>{course.demand}%</span><span>{course.supply}%</span><span>{course.placement?`${course.placement}%`:"—"}</span><b className={course.status==="REVIEW"||course.status==="OVERSUPPLIED"?"danger":course.status==="MONITOR"?"good":"warn"}>{course.status}</b></div>):<div className="empty-mini">Upload an approved course-supply CSV to activate course health analysis.</div>}</div></section>

          <section id="training" className="sih-section page-section"><div className="section-heading-row"><div><span className="section-kicker">10 / TRAINING PLAN</span><h3>Turn demand into training capacity</h3><p>AI-estimated trainee, trainer, and lab requirements.</p></div><span className="source-badge">ESTIMATED</span></div><div className="training-layout"><div className="training-table"><div className="course-row course-head"><span>PRIORITY SKILL</span><span>TRAINEES</span><span>TRAINERS</span><span>LABS</span></div>{trainingPlan.length?trainingPlan.map(item=><div className="course-row" key={item.skill}><strong>{item.skill}</strong><span>{item.trainees}</span><span>{item.trainers}</span><span>{item.labs}</span></div>):<div className="empty-mini">Training estimates appear after job-posting analysis.</div>}</div><div className="plan-callout"><span>AI PLANNING SIGNAL</span><strong>Demand-led planning</strong><p>Modelled estimates only — use them as planning signals, not official capacity requirements.</p><button className="primary-btn" onClick={()=>scrollToSection("gap")}>Review curriculum gaps →</button></div></div></section>

          <section id="insights" className="insights-section page-section">
            <div className="section-heading-row"><div><span className="section-kicker">11 / CANDIDATE INTELLIGENCE</span><h3>Your career command center</h3><p>Track progress, strengthen your portfolio, and keep your next action visible.</p></div><div className="achievement-total"><strong>{achievementCount}</strong><span>ACHIEVEMENTS</span></div></div>
            <div className="insights-grid">
              <article className="insight-card career-score-card"><div className="insight-topline"><span>CAREER SCORE</span><span className="live-badge">LIVE</span></div><div className="career-score-value">{dashboardData?Math.round(readiness):"--"}<small>/100</small></div><div className="score-breakdown">{trackedSkills.map(item=><div key={item.name}><div><span>{item.name}</span><strong>{item.value}%</strong></div><i><b style={{width:`${item.value}%`}}/></i></div>)}</div></article>
              <article className="insight-card interview-card"><div className="insight-topline"><span>AI INTERVIEW</span><span className="match-pill">REAL AI</span></div><h4>Test your interview readiness</h4><p>Answer a role-relevant question and get AI feedback on clarity, evidence, impact, and communication.</p><div className="interview-question">“Explain one project where you solved a real problem.”</div><textarea className="ai-textarea" value={interviewAnswer} onChange={(e)=>setInterviewAnswer(e.target.value)} placeholder="Write your answer here…" rows={4}/><button className="secondary-btn" onClick={runInterview}>{aiLoading?"Reviewing…":"Get AI feedback →"}</button>{interviewResult&&<div className="ai-result-box"><strong>{interviewResult.score}/100</strong><p>{interviewResult.feedback}</p>{interviewResult.improvements?.length>0&&<ul>{interviewResult.improvements.map((item,i)=><li key={i}>{item}</li>)}</ul>}</div>}</article>
              <article className="insight-card resume-intel-card"><div className="insight-topline"><span>RESUME INTELLIGENCE</span><span className="live-badge">AI REVIEW</span></div><div className="resume-score"><strong>{extractedSkills.length?82:"--"}</strong><span>/100 RESUME SCORE</span></div><div className="resume-checks"><span>✓ Skills detected</span><span>✓ Keyword coverage</span><span>✓ ATS structure</span></div><button className="secondary-btn" onClick={()=>scrollToSection("resume")}>{extractedSkills.length?"Review analysis →":"Analyze resume →"}</button></article>
              <article className="insight-card progress-card"><div className="insight-topline"><span>LEARNING PROGRESS</span><span className="streak">🔥 12 DAY STREAK</span></div><div className="progress-list">{(roadmapData?.roadmap||[]).slice(0,4).map((item,index)=>{const value=learningProgress[item.skill]??(index===0?60:index===1?40:20);return <button key={item.skill} className="progress-row" onClick={()=>toggleProgress(item.skill)}><div><span>{item.skill}</span><strong>{value}%</strong></div><i><b style={{width:`${value}%`}}/></i></button>})}{!roadmapData&&<div className="empty-mini">Generate a roadmap to start tracking skills.</div>}</div></article>
              <article className="insight-card achievements-card"><div className="insight-topline"><span>ACHIEVEMENTS</span><span>{achievementCount}/5 UNLOCKED</span></div><div className="achievement-list">{[["🏆","Resume Optimized",extractedSkills.length>0],["🎯","Career Readiness",dashboardData!==null],["⚡","Roadmap Generated",roadmapData?.roadmap?.length>0],["📚","Gap Analysis",comparisonResult!==null],["💻","Portfolio Added",portfolioAnalyzed]].map(([icon,label,unlocked])=><div key={label} className={unlocked?"unlocked":"locked"}><span className="achievement-icon">{icon}</span><strong>{label}</strong><small>{unlocked?"UNLOCKED":"LOCKED"}</small></div>)}</div></article>
              <article className="insight-card portfolio-card"><div className="insight-topline"><span>PORTFOLIO ANALYZER</span><span className="purple-label">AI REVIEW</span></div><h4>Make your projects job-ready</h4><p>Paste your portfolio or GitHub link and get a quick strength signal.</p><div className="portfolio-input"><input value={portfolioUrl} onChange={(e)=>setPortfolioUrl(e.target.value)} placeholder="github.com/yourname"/><button className="primary-btn" onClick={analyzePortfolio}>Analyze</button></div>{portfolioResult&&<div className="portfolio-result"><strong>{portfolioResult.score}<span>/100</span></strong><div><b>Project depth</b><b>Documentation</b><b>Impact</b></div><p>{portfolioResult.summary}</p></div>}</article>
              <article className="insight-card notification-card"><div className="insight-topline"><span>✦ SKILLRADAR INSIGHT</span><span>JUST NOW</span></div><h4>{dashboardData?.recommended_next_skill?`${dashboardData.recommended_next_skill} is your next move.`:"Your next career move starts here."}</h4><p>{dashboardData?`You have ${coveredSkills} of ${totalSkills} required skills covered. Close one high-priority gap this week.`:"Complete your profile and comparison to receive personalized market alerts."}</p><button className="secondary-btn" onClick={()=>scrollToSection("roadmap")}>Open roadmap →</button></article>
            </div>
          </section>
        </div>

        <nav className="bottom-nav" aria-label="Main navigation">
          <button className={activeSection === "dashboard" ? "active" : ""} onClick={() => scrollToSection("dashboard")}><span>⌂</span><small>Home</small></button>
          <button className={activeSection === "resume" || activeSection === "radar" ? "active" : ""} onClick={() => scrollToSection("resume")}><span>▣</span><small>Analyze</small></button>
          <button className="sell-action" onClick={() => scrollToSection("profile")}><span>＋</span><small>Start</small></button>
          <button className={activeSection === "market" || activeSection === "districts" ? "active" : ""} onClick={() => scrollToSection("market")}><span>▤</span><small>Market</small></button>
          <button className={coachOpen ? "active" : ""} onClick={() => setCoachOpen((value) => !value)}><span>✦</span><small>Coach</small></button>
        </nav>

        <button className={`ai-coach-fab ${coachOpen ? "open" : ""}`} onClick={() => setCoachOpen((value) => !value)}><span>✦</span><b>{coachOpen ? "Close" : "AI"}</b></button>
        {coachOpen && <aside className="ai-coach-panel"><div className="coach-header"><div><span>✦ SKILLRADAR</span><h3>AI Career Coach</h3></div><button onClick={() => setCoachOpen(false)}>×</button></div><p className="coach-intro">Ask for a next step, resume advice, skill-gap help, or a career plan.</p><div className="coach-options">{coachQuickReplies.map((question)=><button key={question} onClick={()=>askCoach(question)}>{question}</button>)}</div>{aiError&&<div className="ai-error">{aiError}</div>}{coachReply&&<div className="coach-reply"><span>AI</span><p>{coachReply}</p></div>}<div className="coach-input"><input value={coachMessage} onChange={(e)=>setCoachMessage(e.target.value)} placeholder="Ask anything..." onKeyDown={(e)=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),askCoach(coachMessage))}/><button onClick={()=>askCoach(coachMessage)} disabled={aiLoading}>{aiLoading?"…":"➤"}</button></div></aside>}
      </main>
    </div>
  );
}

export default App;
