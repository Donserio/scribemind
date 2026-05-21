import React, { useState } from 'react';
import { marked } from 'marked';

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
  onRefineNotes
}) {
  const [activeTab, setActiveTab] = useState('preview');
  const [fileName, setFileName] = useState('student_notes.md');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [history, setHistory] = useState([]);

  const handleCopy = () => {
    navigator.clipboard.writeText(noteText);
    alert("Markdown copied to clipboard!");
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
        </div>

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
      </div>

      {/* Note view container */}
      <div className="note-view-container" style={{ flexGrow: 1, display: 'flex', minHeight: 0, flexDirection: 'column' }}>
        <div style={{ flexGrow: 1, display: 'flex', minHeight: 0 }}>
          {activeTab === 'preview' ? (
            <div 
              className="markdown-preview" 
              dangerouslySetInnerHTML={getHtmlContent()}
            />
          ) : (
            <textarea
              className="note-editor-textarea"
              value={noteText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Edit markdown notes here..."
            />
          )}
        </div>

        {/* Refine with AI Widget */}
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
      </div>
    </div>
  );
}
