import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { generateGoogleFormsAppsScript, generateQuizMarkdown } from '../utils/quizUtils';

export default function NotePreview({
  noteText,
  onTextChange,
  isGenerating,
  generationProgress,
  onConnectWorkspace,
  directoryName,
  onSaveToWorkspace,
  isSaving,
  saveSuccess,
  onRefineNotes,
  // Quiz specific props
  quizData = null,
  isGeneratingQuiz = false,
  quizProgress = '',
  onGenerateQuiz
}) {
  const [activeTab, setActiveTab] = useState('preview');
  const [fileName, setFileName] = useState('student_notes.md');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [history, setHistory] = useState([]);

  // Quiz local states
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [copiedScript, setCopiedScript] = useState(false);

  const previewRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'preview' && previewRef.current) {
      if (window.renderMathInElement) {
        try {
          window.renderMathInElement(previewRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        } catch (err) {
          console.error("Error auto-rendering KaTeX math:", err);
        }
      }
    }
  }, [noteText, activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(noteText);
    alert("Markdown copied to clipboard!");
  };

  const handleCopyQuizMd = () => {
    if (!quizData) return;
    navigator.clipboard.writeText(generateQuizMarkdown(quizData));
    alert("Quiz Markdown copied to clipboard!");
  };


  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([noteText], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadHtml = () => {
    try {
      const rawHtml = marked.parse(noteText || '');
      const cleanFileName = fileName.endsWith('.md') ? fileName.replace('.md', '') : fileName;
      
      const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanFileName}</title>
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
  <!-- KaTeX for LaTeX Math Rendering -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      if (window.renderMathInElement) {
        window.renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\\\(', right: '\\\\)', display: false },
            { left: '\\\\[', right: '\\\\]', display: true }
          ],
          throwOnError: false
        });
      }
    });
  </script>
  <style>
    :root {
      --primary: #7c3aed;
      --primary-light: rgba(124, 58, 237, 0.08);
      --text-main: #1e293b;
      --text-headings: #0f172a;
      --border: #e2e8f0;
      --bg-code: #f1f5f9;
    }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      line-height: 1.625;
      color: var(--text-main);
      max-width: 820px;
      margin: 48px auto;
      padding: 0 24px;
      background-color: #fff;
    }
    h1, h2, h3, h4 {
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      color: var(--text-headings);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    h1 {
      font-size: 2.25rem;
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
      margin-top: 0;
      margin-bottom: 24px;
    }
    h2 {
      font-size: 1.6rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      margin-top: 32px;
    }
    h3 {
      font-size: 1.25rem;
    }
    p {
      margin-bottom: 16px;
    }
    ul, ol {
      margin-bottom: 16px;
      padding-left: 24px;
    }
    li {
      margin-bottom: 6px;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      background-color: var(--bg-code);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--primary);
    }
    pre {
      background-color: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      color: inherit;
    }
    blockquote {
      border-left: 4px solid var(--primary);
      background-color: var(--primary-light);
      padding: 12px 20px;
      margin: 0 0 20px 0;
      border-radius: 0 8px 8px 0;
    }
    blockquote p {
      margin-bottom: 0;
      font-style: italic;
      color: #4c1d95;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 0.95em;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: var(--text-headings);
    }
    @media print {
      body {
        margin: 20px;
        max-width: 100%;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  ${rawHtml}
</body>
</html>`;

      const element = document.createElement("a");
      const file = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = `${cleanFileName}.html`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error("HTML Generation error", err);
      alert("Failed to export HTML.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const finalName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    onSaveToWorkspace(finalName);
  };

  // Convert markdown to HTML safely using marked
  const getHtmlContent = () => {
    try {
      marked.setOptions({
        gfm: true,
        breaks: true
      });
      return { __html: marked.parse(noteText || '') };
    } catch (err) {
      console.error("Markdown parsing error:", err);
      return { __html: "<p>Error parsing markdown format.</p>" };
    }
  };

  // Handle Refinement submission
  const handleRefineSubmit = async () => {
    if (!refinePrompt.trim()) return;
    setHistory(prev => [...prev, noteText]);
    const prompt = refinePrompt;
    setRefinePrompt('');
    try {
      await onRefineNotes(prompt);
    } catch (err) {
      // Revert history on error
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleUndoRefinement = () => {
    if (history.length === 0) return;
    const previousText = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    onTextChange(previousText);
  };

  // Render Loading / Generation State
  if (isGenerating) {
    const isRefiningMode = generationProgress.toLowerCase().includes('refin') || generationProgress.toLowerCase().includes('processing');
    const steps = isRefiningMode ? [
      { id: 'init', text: 'Initializing Gemini Refinement' },
      { id: 'process', text: 'Analyzing notes & processing instructions' },
      { id: 'complete', text: 'Stitching updated markdown sections' }
    ] : [
      { id: 'init', text: 'Initializing Gemini Client' },
      { id: 'prepare', text: 'Compressing selected curriculum pages' },
      { id: 'generate', text: 'Running LLM synthesis' }
    ];

    let activeIndex = 0;
    if (isRefiningMode) {
      if (generationProgress.toLowerCase().includes('process') || generationProgress.toLowerCase().includes('refining')) {
        activeIndex = 1;
      } else if (generationProgress.toLowerCase().includes('complete') || generationProgress.toLowerCase().includes('success')) {
        activeIndex = 2;
      }
    } else {
      if (generationProgress.toLowerCase().includes('compressing') || generationProgress.toLowerCase().includes('attaching')) {
        activeIndex = 1;
      } else if (generationProgress.toLowerCase().includes('generating') || generationProgress.toLowerCase().includes('synthesizing')) {
        activeIndex = 2;
      }
    }

    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <div className="loading-text">
          {isRefiningMode ? 'Refining Study Materials' : 'Generating Lesson Materials'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '280px', fontStyle: 'italic' }}>
          "{generationProgress}"
        </div>
        <div className="loading-steps">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive = idx === activeIndex;
            return (
              <div 
                key={step.id} 
                className={`loading-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
              >
                <span className="loading-step-dot"></span>
                <span>{step.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Empty State
  if (!noteText) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">✍️</div>
        <div className="empty-state-text" style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
          No study notes generated yet.
        </div>
        <div style={{ fontSize: '12px', maxWidth: '250px' }}>
          Select pages from the curriculum PDF on the left, customize your style options, and click "Generate".
        </div>
      </div>
    );
  }

  return (
    <div className="note-preview-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Workspace Saver Widget */}
      <div className="workspace-save-box">
        <div className="flex align-center justify-between" style={{ gap: '12px' }}>
          <div className="save-status-text">
            <span className={`save-status-dot ${directoryName ? 'connected' : ''}`}></span>
            <span>
              {directoryName 
                ? `Workspace: ${directoryName}` 
                : 'Workspace: Folder Not Connected'}
            </span>
          </div>
          
          {!directoryName ? (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={onConnectWorkspace}
            >
              Connect Folder
            </button>
          ) : (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12px', opacity: 0.7 }}
              onClick={onConnectWorkspace}
            >
              Change
            </button>
          )}
        </div>

        {directoryName && (
          <div className="flex" style={{ gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '13px', padding: '6px 10px', flexGrow: 1 }}
              placeholder="Filename (e.g. math_notes.md)"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved! ✓' : 'Save to Folder'}
            </button>
          </div>
        )}
      </div>

      {/* Tab controls */}
      <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border)', marginBottom: '12px', flexShrink: 0 }}>
        <div className="tab-controls" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview Note
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit Markdown
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            📝 Practice Quiz
          </button>
        </div>

        {activeTab !== 'quiz' ? (
          <div className="preview-actions" style={{ paddingBottom: '4px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              Copy
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleDownload}
              title="Download raw Markdown file"
            >
              .MD
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleDownloadHtml}
              title="Download styled HTML file"
            >
              .HTML
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 10px', fontSize: '12px', background: 'var(--accent)', borderColor: 'var(--accent)' }}
              onClick={handlePrint}
              title="Print or Save as PDF"
            >
              Print / PDF 🖨️
            </button>
          </div>
        ) : quizData ? (
          <div className="preview-actions" style={{ paddingBottom: '4px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleCopyQuizMd}
              title="Copy quiz markdown to clipboard"
            >
              Copy MCQ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 10px', fontSize: '12px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
              onClick={() => setShowScriptModal(true)}
              title="Get Google Forms Apps Script Code"
            >
              Google Form Code ⚙️
            </button>
          </div>
        ) : null}
      </div>

      {/* Note view container */}
      <div className="note-view-container" style={{ flexGrow: 1, display: 'flex', minHeight: 0, flexDirection: 'column' }}>
        <div style={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
          {activeTab === 'preview' && (
            <div 
              ref={previewRef}
              className="markdown-preview" 
              dangerouslySetInnerHTML={getHtmlContent()}
            />
          )}
          {activeTab === 'edit' && (
            <textarea
              className="note-editor-textarea"
              value={noteText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Edit markdown notes here..."
            />
          )}
          {activeTab === 'quiz' && (
            <div className="quiz-view-container" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto', width: '100%', height: '100%' }}>
              {isGeneratingQuiz ? (
                <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '32px 16px' }}>
                  <div className="spinner"></div>
                  <div className="empty-state-text" style={{ fontSize: '15px', fontWeight: 600 }}>Generating Practice Quiz...</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{quizProgress}"</div>
                </div>
              ) : !quizData ? (
                <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '40px 24px', textAlign: 'center' }}>
                  <div className="empty-state-icon" style={{ fontSize: '40px', marginBottom: '8px' }}>📝</div>
                  <div className="empty-state-text" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    No Quiz Generated Yet
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px', margin: '0 auto 16px auto', lineHeight: '1.4' }}>
                    Create a comprehensive, 20-question multiple-choice practice quiz based on the notes above to test students' mastery of the curriculum topic.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontSize: '14px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderColor: 'transparent', boxShadow: 'var(--shadow-md)' }}
                    onClick={onGenerateQuiz}
                  >
                    ⚡ Generate 20-Question Quiz
                  </button>
                </div>
              ) : (
                <div className="quiz-content-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="quiz-header-card" style={{ padding: '16px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>{quizData.title || "Practice Quiz"}</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Based on generated curriculum study notes • 20 Multiple Choice Questions</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        type="button"
                        className={`btn ${studyMode ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                        onClick={() => setStudyMode(!studyMode)}
                      >
                        👁️ Study Mode: {studyMode ? "ON" : "OFF"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                        onClick={() => setUserAnswers({})}
                        disabled={Object.keys(userAnswers).length === 0}
                      >
                        🔄 Reset Answers
                      </button>
                    </div>
                  </div>

                  <div className="quiz-questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {quizData.questions && quizData.questions.map((q, qIndex) => {
                      const selectedOption = userAnswers[qIndex];
                      const isAnswered = selectedOption !== undefined;
                      const showAnswers = studyMode || isAnswered;
                      
                      return (
                        <div key={qIndex} className="quiz-question-card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', position: 'relative' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question {qIndex + 1} of 20</span>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 12px 0', lineHeight: '1.4' }}>{q.question}</h4>
                          
                          <div className="quiz-options-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {q.options && q.options.map((opt, optIndex) => {
                              const isCorrect = opt === q.correctAnswer;
                              const isSelected = selectedOption === opt;
                              
                              let borderStyle = "1px solid var(--border)";
                              let backgroundStyle = "var(--bg-app)";
                              let colorStyle = "var(--text-primary)";
                              let icon = "";
                              
                              if (showAnswers) {
                                if (isCorrect) {
                                  borderStyle = "1px solid #10b981";
                                  backgroundStyle = "rgba(16, 185, 129, 0.08)";
                                  colorStyle = "#10b981";
                                  icon = " ✓ ";
                                } else if (isSelected) {
                                  borderStyle = "1px solid #ef4444";
                                  backgroundStyle = "rgba(239, 68, 68, 0.08)";
                                  colorStyle = "#ef4444";
                                  icon = " ✕ ";
                                }
                              } else if (isSelected) {
                                borderStyle = "1px solid var(--primary)";
                                backgroundStyle = "var(--primary-light)";
                              }

                              return (
                                <button
                                  key={optIndex}
                                  type="button"
                                  className="quiz-option-btn"
                                  onClick={() => {
                                    if (!studyMode) {
                                      setUserAnswers(prev => ({ ...prev, [qIndex]: opt }));
                                    }
                                  }}
                                  disabled={studyMode}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    border: borderStyle,
                                    background: backgroundStyle,
                                    color: colorStyle,
                                    borderRadius: '6px',
                                    textAlign: 'left',
                                    fontSize: '12px',
                                    cursor: studyMode ? 'default' : 'pointer',
                                    transition: 'all 0.2s',
                                    width: '100%',
                                    fontWeight: isSelected || (showAnswers && isCorrect) ? '600' : 'normal'
                                  }}
                                >
                                  <span style={{ marginRight: '8px', minWidth: '18px' }}>
                                    {icon || `${String.fromCharCode(65 + optIndex)}. `}
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {showAnswers && q.explanation && (
                            <div className="quiz-explanation-box" style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(124, 58, 237, 0.04)', borderLeft: '3px solid var(--primary)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                              <strong style={{ fontSize: '11px', color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>Explanation & Feedback:</strong>
                              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Refine with AI Widget */}
        {activeTab !== 'quiz' && (
          <div 
            className="refine-chat-box"
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '12px',
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0
            }}
          >
            <div className="flex justify-between align-center">
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ Refine notes with AI Assistant
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px' }}
                  onClick={handleUndoRefinement}
                >
                  ↩ Undo Last Edit ({history.length})
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                style={{ fontSize: '13px', padding: '10px 14px', flexGrow: 1 }}
                placeholder="Ask Gemini to modify notes... (e.g. 'translate to French', 'make vocabulary section longer')"
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRefineSubmit();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                onClick={handleRefineSubmit}
                disabled={!refinePrompt.trim()}
              >
                Refine
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Google Apps Script Exporter Modal */}
      {showScriptModal && quizData && (
        <div className="preview-modal-backdrop" onClick={() => { setShowScriptModal(false); setCopiedScript(false); }}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '90%' }}>
            <header className="preview-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>⚙️ Google Form Apps Script Exporter</h3>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => { setShowScriptModal(false); setCopiedScript(false); }}
                style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </header>

            <div className="preview-modal-body" style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                This script generates a Google Form quiz with your 20 practice questions, complete with point designations, correct answers, and explanations.
              </p>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <textarea
                  className="form-input"
                  readOnly
                  value={generateGoogleFormsAppsScript(quizData)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', height: '160px', width: '100%', whiteSpace: 'pre', overflowX: 'auto', background: 'var(--bg-app)', resize: 'none' }}
                  onClick={(e) => e.target.select()}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '12px' }}
                  onClick={() => { setShowScriptModal(false); setCopiedScript(false); }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: '12px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
                  onClick={() => {
                    navigator.clipboard.writeText(generateGoogleFormsAppsScript(quizData));
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                >
                  {copiedScript ? "Copied! ✓" : "📋 Copy Apps Script Code"}
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>📋 Step-by-Step Instructions:</h4>
                <ol style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, paddingLeft: '16px', lineHeight: '1.6' }}>
                  <li>Open <strong>Google Drive</strong> (<a href="https://drive.google.com" target="_blank" rel="noopener noreferrer">drive.google.com</a>).</li>
                  <li>Click <strong>New</strong> &gt; <strong>More</strong> &gt; <strong>Google Apps Script</strong> (or visit <a href="https://script.google.com" target="_blank" rel="noopener noreferrer">script.google.com</a>).</li>
                  <li>Delete any pre-populated code in the editor, and paste the code copied above.</li>
                  <li>Click the <strong>Save</strong> button (or press <code>Ctrl+S</code>).</li>
                  <li>Ensure <code>createFormQuiz</code> is selected in the run dropdown toolbar, and click <strong>Run</strong> (triangle icon).</li>
                  <li>Authorize the script permissions when prompted by Google (click <em>Advanced</em> &gt; <em>Go to Untitled project (unsafe)</em> to allow script to create the Form inside your Drive).</li>
                  <li>Check your Google Drive home page—your new Google Form quiz will be ready!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
