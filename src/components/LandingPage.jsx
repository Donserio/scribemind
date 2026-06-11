import React from 'react';

export default function LandingPage({ onEnterApp }) {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="logo-icon">🧠</span>
          <span className="logo-text">ScribeMind <span className="badge">Educator Suite</span></span>
        </div>
        <button className="btn btn-secondary" onClick={onEnterApp} style={{ fontSize: '12px', padding: '6px 14px' }}>
          Enter App
        </button>
      </nav>

      {/* Hero Section */}
      <header className="landing-hero">
        <div className="hero-content">
          <div className="promo-pill">✨ Tailored for Teachers & Curriculum Designers</div>
          <h1 className="hero-title">
            Transform Curriculum Standards into <span className="gradient-text">Premium Lesson Materials</span>
          </h1>
          <p className="hero-subtitle">
            ScribeMind helps educators turn complex syllabuses, textbooks, and guidelines into high-quality study guides, detailed lesson plans, and interactive assessments for their students.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-large" onClick={onEnterApp} style={{ padding: '12px 28px', fontSize: '15px' }}>
              Launch Educator Dashboard ⚡
            </button>
          </div>
        </div>

        {/* Hero Dashboard Preview Mockup */}
        <div className="hero-mockup">
          <div className="mockup-frame">
            <div className="mockup-header">
              <span className="dot dot-red"></span>
              <span className="dot dot-yellow"></span>
              <span className="dot dot-green"></span>
              <span className="mockup-url">scribemind.app/dashboard</span>
            </div>
            <div className="mockup-body">
              <div className="mockup-sidebar">
                <div className="sidebar-logo">🧠 ScribeMind</div>
                <div className="sidebar-item active">📚 Resource Library</div>
                <div className="sidebar-item">📊 Stats Overview</div>
                <div className="sidebar-item">📝 Quiz History</div>
              </div>
              <div className="mockup-main">
                <div className="mockup-stats">
                  <div className="stat-card">
                    <div className="stat-val">12</div>
                    <div className="stat-lbl">Syllabus Uploads</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">28</div>
                    <div className="stat-lbl">Lessons Created</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">14</div>
                    <div className="stat-lbl">Assessments Done</div>
                  </div>
                </div>
                <div className="mockup-table">
                  <div className="table-header">Recent Curriculum Materials</div>
                  <div className="table-row">
                    <span>Grade 10 Physics Syllabus.pdf</span>
                    <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Notes & Quiz Generated</span>
                  </div>
                  <div className="table-row">
                    <span>Chemistry Laboratory Rubrics.md</span>
                    <span className="badge badge-success" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Notes Generated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="landing-features">
        <h2 className="section-title">Designed Specifically for Educators</h2>
        <p className="section-subtitle">Streamline your classroom preparation with advanced AI tools.</p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📖</div>
            <h3>Syllabus Auto-Indexer</h3>
            <p>Scan a Table of Contents to instantly index chapters, page ranges, and descriptions. Select target pages with a single click.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">👩‍🏫</div>
            <h3>Professional Lesson Formats</h3>
            <p>Generate material in various formats: standard study notes, detailed textbook chapters, Q&A guides, Socratic dialogues, or lesson plans with learning outcomes.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Custom Assessments</h3>
            <p>Instantly synthesize multiple-choice or short-answer theory questions matching grade difficulty. Complete with sample answers and grading rubrics.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📤</div>
            <h3>Google Forms Exporter</h3>
            <p>Export practice quizzes directly into Google Forms with self-grading enabled using a one-click Google Apps Script generator.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Multimodal & Illustrations</h3>
            <p>Upload text files, images, or PDFs. Generate Stable Diffusion illustrations at precise cursor locations to clarify complex concepts visually.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>SaaS Security Architecture</h3>
            <p>Run models securely through a serverless backend. Hide API keys from client browsers and persist all course material locally inside IndexedDB.</p>
          </div>
        </div>
      </section>

      {/* Educator Focus Section */}
      <section className="educator-benefits">
        <div className="benefits-content">
          <h2>Save Hours of Classroom Prep Every Week</h2>
          <p>
            Instead of spending hours reading through curriculum booklets, writing lesson guides, and formatting quiz questions manually, let ScribeMind do the heavy lifting. Design student-facing material that aligns perfectly with syllabus standards in minutes.
          </p>
          <div className="stats-row">
            <div className="stat-box">
              <div className="num">10x</div>
              <div className="lbl">Faster Lesson Plan Creation</div>
            </div>
            <div className="stat-box">
              <div className="num">100%</div>
              <div className="lbl">Alignment with Syllabus Standards</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="landing-footer">
        <h2>Ready to upgrade your teaching workflow?</h2>
        <p>No credit card required. Free models available via OpenRouter.</p>
        <button className="btn btn-primary btn-large" onClick={onEnterApp} style={{ padding: '12px 28px', fontSize: '15px', marginTop: '16px' }}>
          Start Designing Lessons ➔
        </button>
        <div className="footer-credits" style={{ marginTop: '48px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <p>© 2026 ScribeMind. Developed for modern educators.</p>
        </div>
      </footer>
    </div>
  );
}
