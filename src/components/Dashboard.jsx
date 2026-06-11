import React, { useState, useEffect } from 'react';
import { getQuizHistory, deleteQuizAttempt } from '../services/db';

export const CATEGORY_LABELS = {
  curriculum: 'Syllabus / Curriculum',
  textbook: 'Textbook Reference',
  slides: 'Slide Presentations',
  notes: 'Lesson Notes'
};

export default function Dashboard({
  files = [],
  onStartNewSession,
  onResumeSession,
  onRemoveFile,
  onRenameFile,
  onUpdateCategory
}) {
  const [quizHistory, setQuizHistory] = useState([]);
  const [editingFileId, setEditingFileId] = useState(null);
  const [editName, setEditName] = useState('');

  // Fetch quiz history on mount
  const loadQuizHistory = async () => {
    try {
      const history = await getQuizHistory();
      setQuizHistory(history);
    } catch (err) {
      console.error("Failed to load quiz history:", err);
    }
  };

  useEffect(() => {
    loadQuizHistory();
  }, [files]);

  const handleDeleteQuiz = async (e, id) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this quiz record?")) {
      try {
        await deleteQuizAttempt(id);
        loadQuizHistory();
      } catch (err) {
        console.error("Failed to delete quiz record:", err);
      }
    }
  };

  const startEditing = (e, file) => {
    e.stopPropagation();
    setEditingFileId(file.id);
    setEditName(file.name);
  };

  const saveName = async (e, id) => {
    e.stopPropagation();
    if (editName.trim() && editName.trim() !== '') {
      await onRenameFile(id, editName.trim());
    }
    setEditingFileId(null);
  };

  const handleKeyPress = (e, id) => {
    if (e.key === 'Enter') {
      saveName(e, id);
    } else if (e.key === 'Escape') {
      setEditingFileId(null);
    }
  };

  // Compute Stats
  const totalUploads = files.length;
  const lessonsCreated = files.filter(f => f.notesText && f.notesText.trim() !== '').length;
  const quizzesGenerated = files.filter(f => f.quizData).length;
  const estimatedHoursSaved = (lessonsCreated * 3) + (quizzesGenerated * 1);

  // Category counts
  const counts = { curriculum: 0, textbook: 0, slides: 0, notes: 0 };
  files.forEach(f => {
    const cat = f.category || 'curriculum';
    if (counts[cat] !== undefined) {
      counts[cat]++;
    }
  });

  return (
    <div className="dashboard-container">
      {/* Welcome Header */}
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Welcome back, Educator! 📚</h1>
          <p>Design premium lesson guides, slides outlines, and interactive assessments for your classroom.</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={onStartNewSession}
          style={{ fontSize: '13px', padding: '10px 20px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', border: 'none', boxShadow: 'var(--shadow-md)' }}
        >
          ⚡ Create New Lesson Material
        </button>
      </header>

      {/* Stats Cards Row */}
      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="stat-lbl" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Curriculum Sources</span>
          <span className="stat-val" style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{totalUploads}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PDFs, Text, & Images uploaded</span>
        </div>
        <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="stat-lbl" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Lessons Designed</span>
          <span className="stat-val" style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)' }}>{lessonsCreated}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Guides & handout text generated</span>
        </div>
        <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="stat-lbl" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Practice Quizzes</span>
          <span className="stat-val" style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent)' }}>{quizzesGenerated}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Classroom assessments synthesized</span>
        </div>
        <div className="stat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="stat-lbl" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Teaching Hours Saved</span>
          <span className="stat-val" style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{estimatedHoursSaved}h</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Based on lesson planning metrics</span>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left column: Resources Library */}
        <section className="panel library-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>📚 ScribeMind Resource Library</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{totalUploads} items total</span>
          </div>
          
          <div className="panel-content" style={{ padding: '16px' }}>
            {files.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <span style={{ fontSize: '48px' }}>📂</span>
                <h3>No curriculum documents uploaded yet</h3>
                <p style={{ maxWidth: '320px', margin: '8px auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Upload a curriculum document, outline syllabus, or reference material to start generating lessons.
                </p>
                <button className="btn btn-secondary" onClick={onStartNewSession} style={{ marginTop: '12px' }}>
                  Upload First File
                </button>
              </div>
            ) : (
              <div className="dashboard-table-container" style={{ overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Document Name</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Category</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Outcomes</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(file => {
                      const hasNotes = file.notesText && file.notesText.trim() !== '';
                      const hasQuiz = !!file.quizData;

                      return (
                        <tr 
                          key={file.id} 
                          className="table-row-hover" 
                          style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                          onClick={() => onResumeSession(file)}
                        >
                          {/* File Name */}
                          <td style={{ padding: '12px 8px', maxWidth: '240px' }} onClick={(e) => e.stopPropagation()}>
                            {editingFileId === file.id ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => handleKeyPress(e, file.id)}
                                  autoFocus
                                  style={{ padding: '4px 8px', fontSize: '13px' }}
                                />
                                <button className="btn btn-primary" onClick={(e) => saveName(e, file.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>Save</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>
                                  {file.type === 'image' ? '🖼️' : file.type === 'text' ? '📝' : '📄'}
                                </span>
                                <span className="resource-name-text" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                                  {file.name}
                                </span>
                                <button 
                                  className="icon-btn edit-name-btn" 
                                  onClick={(e) => startEditing(e, file)} 
                                  title="Rename document"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Category Tag */}
                          <td style={{ padding: '12px 8px' }} onClick={(e) => e.stopPropagation()}>
                            <select
                              className="category-select"
                              value={file.category || 'curriculum'}
                              onChange={(e) => onUpdateCategory(file.id, e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                              <option value="curriculum">Syllabus</option>
                              <option value="textbook">Textbook</option>
                              <option value="slides">Slides</option>
                              <option value="notes">Notes</option>
                            </select>
                          </td>

                          {/* Pages Count */}
                          <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                            {file.selectedPages?.length || 0} pages selected
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {hasNotes && (
                                <span style={{ fontSize: '11px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  📝 Lesson Notes
                                </span>
                              )}
                              {hasQuiz && (
                                <span style={{ fontSize: '11px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  ❓ Assessment Quiz
                                </span>
                              )}
                              {!hasNotes && !hasQuiz && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  ⚪ Pending Generation
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 8px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ fontSize: '11px', padding: '4px 10px' }}
                                onClick={() => onResumeSession(file)}
                              >
                                Design ➔
                              </button>
                              <button 
                                className="icon-btn" 
                                style={{ color: 'var(--accent)', padding: '4px' }}
                                onClick={(e) => onRemoveFile(file.id)}
                                title="Delete document"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right column: Stats and Quiz Attempts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Syllabus Breakdown chart card */}
          <section className="panel stats-breakdown-panel">
            <div className="panel-header">
              <h2>📊 Syllabus Types</h2>
            </div>
            <div className="panel-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="breakdown-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Syllabus / Curriculum</span>
                  <span style={{ fontWeight: 'bold' }}>{counts.curriculum}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalUploads ? (counts.curriculum / totalUploads) * 100 : 0}%`, height: '100%', background: 'hsl(10, 80%, 65%)', borderRadius: '3px' }}></div>
                </div>
              </div>

              <div className="breakdown-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Textbook Reference</span>
                  <span style={{ fontWeight: 'bold' }}>{counts.textbook}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalUploads ? (counts.textbook / totalUploads) * 100 : 0}%`, height: '100%', background: 'hsl(220, 80%, 65%)', borderRadius: '3px' }}></div>
                </div>
              </div>

              <div className="breakdown-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Slide Presentations</span>
                  <span style={{ fontWeight: 'bold' }}>{counts.slides}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalUploads ? (counts.slides / totalUploads) * 100 : 0}%`, height: '100%', background: 'hsl(35, 90%, 60%)', borderRadius: '3px' }}></div>
                </div>
              </div>

              <div className="breakdown-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Lesson Notes</span>
                  <span style={{ fontWeight: 'bold' }}>{counts.notes}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalUploads ? (counts.notes / totalUploads) * 100 : 0}%`, height: '100%', background: 'hsl(160, 80%, 45%)', borderRadius: '3px' }}></div>
                </div>
              </div>

            </div>
          </section>

          {/* Assessment Quiz History */}
          <section className="panel quiz-history-panel">
            <div className="panel-header">
              <h2>✍️ Student Assessment Logs</h2>
            </div>
            
            <div className="panel-content" style={{ padding: '16px', maxHeight: '320px', overflowY: 'auto' }}>
              {quizHistory.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No quiz scores logged yet. Completing quiz evaluations inside the Study Suite will populate records here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {quizHistory.map(log => (
                    <div 
                      key={log.id} 
                      style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.title}>
                          {log.title}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {log.difficulty?.toUpperCase()} | {new Date(log.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '14px' }}>
                          {log.score}
                        </span>
                        <button 
                          className="icon-btn" 
                          style={{ color: 'var(--accent)', padding: '2px' }}
                          onClick={(e) => handleDeleteQuiz(e, log.id)}
                          title="Delete quiz entry"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
