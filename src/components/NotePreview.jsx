import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { generateGoogleFormsAppsScript, generateQuizMarkdown } from '../utils/quizUtils';

// Recursive HTML to Markdown DOM walker
const htmlToMarkdown = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue;
  }
  
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  
  let childrenContent = "";
  for (const child of node.childNodes) {
    childrenContent += htmlToMarkdown(child);
  }
  
  const tagName = node.tagName.toLowerCase();
  
  switch (tagName) {
    case 'h1':
      return `\n# ${childrenContent.trim()}\n`;
    case 'h2':
      return `\n## ${childrenContent.trim()}\n`;
    case 'h3':
      return `\n### ${childrenContent.trim()}\n`;
    case 'h4':
      return `\n#### ${childrenContent.trim()}\n`;
    case 'h5':
      return `\n##### ${childrenContent.trim()}\n`;
    case 'h6':
      return `\n###### ${childrenContent.trim()}\n`;
    case 'p':
      return `\n${childrenContent.trim()}\n`;
    case 'br':
      return `\n`;
    case 'strong':
    case 'b':
      return `**${childrenContent}**`;
    case 'em':
    case 'i':
      return `*${childrenContent}*`;
    case 'code':
      if (node.parentNode && node.parentNode.tagName.toLowerCase() === 'pre') {
        return childrenContent;
      }
      return `\`${childrenContent}\``;
    case 'pre':
      return `\n\`\`\`\n${childrenContent.trim()}\n\`\`\`\n`;
    case 'blockquote':
      return `\n> ${childrenContent.trim().replace(/\n/g, '\n> ')}\n`;
    case 'ul':
      return `\n${childrenContent}\n`;
    case 'ol':
      return `\n${childrenContent}\n`;
    case 'li': {
      const parentTag = node.parentNode ? node.parentNode.tagName.toLowerCase() : 'ul';
      if (parentTag === 'ol') {
        let index = 1;
        let prev = node.previousSibling;
        while (prev) {
          if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName.toLowerCase() === 'li') {
            index++;
          }
          prev = prev.previousSibling;
        }
        return `${index}. ${childrenContent.trim()}\n`;
      }
      return `- ${childrenContent.trim()}\n`;
    }
    case 'a': {
      const href = node.getAttribute('href') || '';
      return `[${childrenContent}](${href})`;
    }
    case 'img': {
      const src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      const cleanAlt = alt.replace(/^Illustration: /, '');
      return `\n\n![Illustration: ${cleanAlt}](${src})\n\n`;
    }
    case 'hr':
      return `\n---\n`;
    case 'div':
      if (node.classList.contains('rich-image-container')) {
        const img = node.querySelector('img');
        if (img) {
          const imgSrc = img.getAttribute('src') || '';
          const imgAlt = img.getAttribute('alt') || '';
          const cleanAlt = imgAlt.replace(/^Illustration: /, '');
          return `\n\n![Illustration: ${cleanAlt}](${imgSrc})\n\n`;
        }
      }
      return `\n${childrenContent}\n`;
    default:
      return childrenContent;
  }
};

const convertHtmlToMarkdown = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let markdown = htmlToMarkdown(doc.body);
  
  // Clean up consecutive line breaks
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .trim();
    
  return markdown;
};

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
  onGenerateQuiz,
  onSaveQuizScore,
  splitLayout = false,
  rightWidth = 450,
  onRightResizeMouseDown
}) {
  const [activeTab, setActiveTab] = useState('preview');
  const [leftTab, setLeftTab] = useState('preview');
  const [rightTab, setRightTab] = useState('refine');
  const [fileName, setFileName] = useState('student_notes.md');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [history, setHistory] = useState([]);

  // Quiz local states
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [copiedScript, setCopiedScript] = useState(false);
  const [quizPurpose, setQuizPurpose] = useState('quiz'); // 'quiz' | 'exam' | 'homework'
  const [quizDifficulty, setQuizDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard' | 'exam-level'
  const [quizType, setQuizType] = useState('mixed'); // 'mcq' | 'theory' | 'mixed'
  const [quizLength, setQuizLength] = useState(10); // 5, 10, 15, 20, 30, 40
  const [quizCustomPrompt, setQuizCustomPrompt] = useState('');
  const [theoryAnswers, setTheoryAnswers] = useState({});
  const [showTheoryExplanations, setShowTheoryExplanations] = useState({});


  // Floating Highlight Rephraser states
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState(null);

  // AI Illustration states
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');

  // Unified Chat Logs state
  const [chatLogs, setChatLogs] = useState([]);

  // WYSIWYG Editor refs
  const richEditorRef = useRef(null);
  const lastHtmlRef = useRef('');
  const savedRangeRef = useRef(null);

  const previewRef = useRef(null);

  useEffect(() => {
    const isPreviewActive = splitLayout ? leftTab === 'preview' : activeTab === 'preview';
    if (isPreviewActive && previewRef.current) {
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
  }, [noteText, activeTab, leftTab, splitLayout]);

  const renderQuizConfigurator = () => {
    return (
      <div className="quiz-config-card" style={{ padding: '20px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '16px', margin: '8px 0', textAlign: 'left' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎯 Assessments & Exams Suite
        </h3>
        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
          Generate customized practice quizzes, comprehensive exams, or homework assignments based directly on the student study notes.
        </p>

        {/* Purpose selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Format & Purpose</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            <button
              type="button"
              className={`btn ${quizPurpose === 'quiz' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px', fontSize: '10.5px', borderRadius: '4px' }}
              onClick={() => setQuizPurpose('quiz')}
            >
              ⚡ Practice Quiz
            </button>
            <button
              type="button"
              className={`btn ${quizPurpose === 'exam' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px', fontSize: '10.5px', borderRadius: '4px' }}
              onClick={() => setQuizPurpose('exam')}
            >
              🎓 Exam Prep
            </button>
            <button
              type="button"
              className={`btn ${quizPurpose === 'homework' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px', fontSize: '10.5px', borderRadius: '4px' }}
              onClick={() => setQuizPurpose('homework')}
            >
              📝 Homework
            </button>
          </div>
        </div>

        {/* Question Type and Difficulty */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Question Mode</label>
            <select
              value={quizType}
              onChange={(e) => setQuizType(e.target.value)}
              style={{ padding: '6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}
            >
              <option value="mcq">Objective (MCQ)</option>
              <option value="theory">Theory (Short Answer)</option>
              <option value="mixed">Mixed (MCQ & Theory)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Difficulty Level</label>
            <select
              value={quizDifficulty}
              onChange={(e) => setQuizDifficulty(e.target.value)}
              style={{ padding: '6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none' }}
            >
              <option value="easy">Easy / Basic</option>
              <option value="medium">Medium / Standard</option>
              <option value="hard">Hard / Advanced</option>
              <option value="exam-level">Exam Challenge</option>
            </select>
          </div>
        </div>

        {/* Length selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Assessment Length</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{quizLength} Questions</span>
          </label>
          <input
            type="range"
            min="5"
            max="40"
            step="5"
            value={quizLength}
            onChange={(e) => setQuizLength(parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
            <span>5 Qs</span>
            <span>10 Qs</span>
            <span>20 Qs</span>
            <span>30 Qs</span>
            <span>40 Qs</span>
          </div>
        </div>

        {/* Focus Topics / Custom Prompt */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Topic Focus / Custom Guidelines (Optional)</label>
          <textarea
            placeholder="e.g. Focus on electromagnetism, or use specific textbook terms..."
            value={quizCustomPrompt}
            onChange={(e) => setQuizCustomPrompt(e.target.value)}
            style={{ width: '100%', height: '50px', padding: '6px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
          />
        </div>

        {/* Generate Button */}
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '12px', fontWeight: 600, background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderColor: 'transparent', boxShadow: 'var(--shadow-md)', width: '100%', marginTop: '4px' }}
          onClick={() => {
            onGenerateQuiz({
              numQuestions: quizLength,
              difficulty: quizDifficulty,
              questionType: quizType,
              purpose: quizPurpose,
              customInstructions: quizCustomPrompt
            });
          }}
        >
          ⚡ Generate Custom {quizPurpose === 'quiz' ? 'Quiz' : quizPurpose === 'exam' ? 'Exam' : 'Assignment'}
        </button>
      </div>
    );
  };

  const renderQuestionCard = (q, qIndex) => {
    if (q.type === 'theory') {
      return (
        <div key={qIndex} className="quiz-question-card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', position: 'relative', textAlign: 'left' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theory Question {qIndex + 1} of {quizData.questions.length}</span>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 12px 0', lineHeight: '1.4' }}>{q.question}</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              placeholder="Type your response here to practice writing..."
              value={theoryAnswers[qIndex] || ''}
              onChange={(e) => setTheoryAnswers(prev => ({ ...prev, [qIndex]: e.target.value }))}
              style={{ width: '100%', height: '80px', padding: '10px', fontSize: '11.5px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-app)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setShowTheoryExplanations(prev => ({ ...prev, [qIndex]: !prev[qIndex] }))}
              >
                {showTheoryExplanations[qIndex] ? '🙈 Hide Model Answer' : '👁️ Show Model Answer & Rubric'}
              </button>
            </div>
          </div>

          {showTheoryExplanations[qIndex] && (
            <div className="quiz-explanation-box" style={{ marginTop: '12px', padding: '12px', background: 'rgba(124, 58, 237, 0.03)', borderLeft: '3px solid var(--accent)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '10.5px', color: 'var(--accent)', display: 'block', marginBottom: '2px' }}>Model Sample Answer:</strong>
                <p style={{ fontSize: '11.5px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4', fontStyle: 'italic' }}>
                  "{q.sampleAnswer || 'No sample answer provided.'}"
                </p>
              </div>
              {q.gradingRubric && (
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                  <strong style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Grading Criteria & Rubric:</strong>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                    {q.gradingRubric}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Default MCQ
    const selectedOption = userAnswers[qIndex];
    const isAnswered = selectedOption !== undefined;
    const showAnswers = studyMode || isAnswered;

    return (
      <div key={qIndex} className="quiz-question-card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', position: 'relative', textAlign: 'left' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question {qIndex + 1} of {quizData.questions.length}</span>
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
  };

  const handleGradeQuiz = () => {
    if (!quizData) return;
    const mcqQuestions = quizData.questions.filter(q => q.type !== 'theory');
    if (mcqQuestions.length === 0) {
      alert("This assessment only contains short answer questions and cannot be auto-graded.");
      return;
    }
    
    let correctCount = 0;
    mcqQuestions.forEach((q) => {
      const fullIndex = quizData.questions.indexOf(q);
      const userAns = userAnswers[fullIndex];
      if (userAns === q.correctAnswer) {
        correctCount++;
      }
    });

    const scoreString = `${correctCount}/${mcqQuestions.length}`;
    alert(`Assessment evaluated! Correct answers: ${scoreString}`);

    if (onSaveQuizScore) {
      onSaveQuizScore(quizData.title || "Curriculum Assessment", scoreString, quizData.difficulty || "medium");
    }
  };

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

  // Save cursor range inside contentEditable editor
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (richEditorRef.current && richEditorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  const handlePreviewMouseUp = (e) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    // Save selection range for rich text caret insertion
    if (richEditorRef.current && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (richEditorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
    
    if (text) {
      setSelectedText(text);
      
      // Calculate coordinates for floating button
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Find parent container offset
        const container = e.currentTarget;
        const containerRect = container.getBoundingClientRect();
        
        setSelectionCoords({
          top: rect.top - containerRect.top + container.scrollTop - 40,
          left: rect.left - containerRect.left + container.scrollLeft + (rect.width / 2) - 60
        });
      } catch (err) {
        setSelectionCoords({
          top: e.clientY - 40,
          left: e.clientX - 60
        });
      }
    } else {
      setSelectedText('');
      setSelectionCoords(null);
    }
  };

  // Sync WYSIWYG input back to raw markdown
  const handleRichInput = () => {
    if (!richEditorRef.current) return;
    const currentHtml = richEditorRef.current.innerHTML;
    lastHtmlRef.current = currentHtml;
    
    const markdown = convertHtmlToMarkdown(currentHtml);
    onTextChange(markdown);
  };

  // Populate WYSIWYG editor innerHTML on external changes
  useEffect(() => {
    const isRichActive = splitLayout ? leftTab === 'rich' : activeTab === 'rich';
    if (isRichActive && richEditorRef.current) {
      const parsedHtml = marked.parse(noteText || '');
      if (parsedHtml !== lastHtmlRef.current) {
        richEditorRef.current.innerHTML = parsedHtml;
        lastHtmlRef.current = parsedHtml;
      }
    }
  }, [noteText, leftTab, activeTab, splitLayout]);

  const handleInsertImage = () => {
    if (!imagePrompt.trim()) return;
    
    const cleanPrompt = imagePrompt.trim();
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=800&height=600&nologo=true`;
    
    const isRichActive = splitLayout ? leftTab === 'rich' : activeTab === 'rich';
    let inserted = false;
    
    if (isRichActive && richEditorRef.current) {
      // Focus the editor
      richEditorRef.current.focus();
      
      // Retrieve range
      let range = null;
      if (savedRangeRef.current) {
        range = savedRangeRef.current;
      } else {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
        }
      }
      
      if (range && richEditorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        
        // Create the image illustration wrapper elements
        const containerDiv = document.createElement('div');
        containerDiv.className = 'rich-image-container';
        containerDiv.contentEditable = 'false';
        containerDiv.style.margin = '20px 0';
        containerDiv.style.textAlign = 'center';
        containerDiv.style.border = '1px dashed var(--border)';
        containerDiv.style.borderRadius = 'var(--radius-md)';
        containerDiv.style.padding = '12px';
        containerDiv.style.background = 'var(--bg-app)';
        containerDiv.style.display = 'block';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Illustration: ${cleanPrompt}`;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = 'var(--radius-sm)';
        img.style.boxShadow = 'var(--shadow-md)';
        
        const caption = document.createElement('p');
        caption.className = 'rich-image-caption';
        caption.textContent = `Illustration: ${cleanPrompt}`;
        caption.style.marginTop = '8px';
        caption.style.fontSize = '12px';
        caption.style.color = 'var(--text-muted)';
        caption.style.textAlign = 'center';
        caption.style.fontStyle = 'italic';
        caption.style.margin = '8px 0 0 0';
        
        containerDiv.appendChild(img);
        containerDiv.appendChild(caption);
        
        range.insertNode(containerDiv);
        
        // Move cursor after the illustration block
        range.setStartAfter(containerDiv);
        range.setEndAfter(containerDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Sync HTML content back to notes text state
        handleRichInput();
        inserted = true;
      }
    }
    
    if (!inserted) {
      // Fallback: append to raw markdown
      const markdownString = `\n\n![Illustration: ${cleanPrompt}](${imageUrl})\n\n`;
      onTextChange(noteText + markdownString);
      
      if (splitLayout) {
        setLeftTab('preview');
      } else {
        setActiveTab('preview');
      }
    }
    
    // Log image creation
    const imageLogId = Date.now();
    setChatLogs(prev => [...prev, { id: imageLogId, type: 'image', text: cleanPrompt, status: 'success' }]);
    
    setImagePrompt('');
    setShowImagePromptModal(false);
  };

  const handleRephraseHighlight = async (targetText) => {
    if (!targetText) return;
    const promptText = `Rephrase the following selected text: "${targetText}"`;
    setSelectedText('');
    setSelectionCoords(null);
    setRightTab('refine');
    
    setHistory(prev => [...prev, noteText]);
    
    const rephraseLogId = Date.now();
    const responseLogId = rephraseLogId + 1;
    
    setChatLogs(prev => [
      ...prev,
      { id: rephraseLogId, type: 'rephrase', text: targetText, status: 'success' },
      { id: responseLogId, type: 'response', text: 'Rephrasing highlighted selection...', status: 'pending' }
    ]);
    
    try {
      await onRefineNotes(promptText);
      setChatLogs(prev => prev.map(log => 
        log.id === responseLogId 
          ? { ...log, text: 'Rephrasing applied successfully!', status: 'success' } 
          : log
      ));
    } catch (err) {
      setHistory(prev => prev.slice(0, -1));
      setChatLogs(prev => prev.map(log => 
        log.id === responseLogId 
          ? { ...log, text: `Failed to rephrase highlight: ${err.message}`, status: 'error', errorMsg: err.message } 
          : log
      ));
    }
  };

  const handleRefineSubmit = async () => {
    if (!refinePrompt.trim()) return;
    setHistory(prev => [...prev, noteText]);
    const prompt = refinePrompt;
    setRefinePrompt('');
    
    const promptLogId = Date.now();
    const responseLogId = promptLogId + 1;
    
    setChatLogs(prev => [
      ...prev, 
      { id: promptLogId, type: 'prompt', text: prompt, status: 'success' },
      { id: responseLogId, type: 'response', text: 'Refining notes based on your instruction...', status: 'pending' }
    ]);
    
    try {
      await onRefineNotes(prompt);
      setChatLogs(prev => prev.map(log => 
        log.id === responseLogId 
          ? { ...log, text: 'Note refinement applied successfully!', status: 'success' } 
          : log
      ));
    } catch (err) {
      setHistory(prev => prev.slice(0, -1));
      setChatLogs(prev => prev.map(log => 
        log.id === responseLogId 
          ? { ...log, text: `Failed to refine notes: ${err.message}`, status: 'error', errorMsg: err.message } 
          : log
      ));
    }
  };

  const handleUndoRefinement = () => {
    if (history.length === 0) return;
    const previousText = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    onTextChange(previousText);
    
    // Pop last prompt-response logs pair
    setChatLogs(prev => {
      if (prev.length >= 2) {
        return prev.slice(0, -2);
      }
      return prev.slice(0, -1);
    });
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

  if (splitLayout) {
    return (
      <div className="split-workspace-container" style={{ '--right-width': `${rightWidth}px` }}>
        {/* Left Column: Output Notes Previewer & Editor */}
        <div className="split-workspace-left">
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

          {/* Left Column Tabs & Export Actions */}
          <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border)', marginBottom: '12px', flexShrink: 0 }}>
            <div className="tab-controls" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button
                type="button"
                className={`tab-btn ${leftTab === 'preview' ? 'active' : ''}`}
                onClick={() => setLeftTab('preview')}
              >
                👁️ Preview
              </button>
              <button
                type="button"
                className={`tab-btn ${leftTab === 'rich' ? 'active' : ''}`}
                onClick={() => {
                  setLeftTab('rich');
                  setTimeout(() => {
                    if (richEditorRef.current) {
                      const parsedHtml = marked.parse(noteText || '');
                      richEditorRef.current.innerHTML = parsedHtml;
                      lastHtmlRef.current = parsedHtml;
                    }
                  }, 50);
                }}
              >
                ✍️ Rich Text
              </button>
              <button
                type="button"
                className={`tab-btn ${leftTab === 'edit' ? 'active' : ''}`}
                onClick={() => setLeftTab('edit')}
              >
                📝 Edit Markdown
              </button>
            </div>

            <div className="preview-actions" style={{ paddingBottom: '4px', display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                onClick={() => setShowImagePromptModal(true)}
                title="Insert generated AI illustration diagram"
              >
                🖼️ Add Image
              </button>
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

          {/* Content Pane */}
          <div className="note-view-container" style={{ flexGrow: 1, display: 'flex', minHeight: 0, flexDirection: 'column' }}>
            {leftTab === 'preview' && (
              <div 
                ref={previewRef}
                className="markdown-preview" 
                style={{ position: 'relative' }}
                onMouseUp={handlePreviewMouseUp}
                onKeyUp={handlePreviewMouseUp}
              >
                <div dangerouslySetInnerHTML={getHtmlContent()} />
                {selectedText && selectionCoords && (
                  <button
                    type="button"
                    className="btn btn-primary floating-rephrase-btn"
                    style={{
                      position: 'absolute',
                      top: `${selectionCoords.top}px`,
                      left: `${selectionCoords.left}px`,
                      zIndex: 100,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '20px',
                      boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                      background: 'var(--primary)',
                      borderColor: 'transparent',
                      animation: 'fadeIn 0.2s ease-out',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRephraseHighlight(selectedText);
                    }}
                  >
                    ✨ Rephrase Highlight
                  </button>
                )}
              </div>
            )}

            {leftTab === 'rich' && (
              <div 
                ref={richEditorRef}
                className="markdown-preview rich-text-editor" 
                contentEditable
                style={{ position: 'relative', overflowY: 'auto' }}
                onMouseUp={handlePreviewMouseUp}
                onKeyUp={(e) => { handlePreviewMouseUp(e); saveSelection(); }}
                onInput={handleRichInput}
                onBlur={saveSelection}
              >
                {selectedText && selectionCoords && (
                  <button
                    type="button"
                    className="btn btn-primary floating-rephrase-btn"
                    style={{
                      position: 'absolute',
                      top: `${selectionCoords.top}px`,
                      left: `${selectionCoords.left}px`,
                      zIndex: 100,
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '20px',
                      boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                      background: 'var(--primary)',
                      borderColor: 'transparent',
                      animation: 'fadeIn 0.2s ease-out',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRephraseHighlight(selectedText);
                    }}
                    contentEditable={false}
                  >
                    ✨ Rephrase Highlight
                  </button>
                )}
              </div>
            )}

            {leftTab === 'edit' && (
              <textarea
                className="note-editor-textarea"
                value={noteText}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Edit markdown notes here..."
              />
            )}
          </div>
        </div>

        {/* Resizer Handle */}
        <div className="resizer-handle" onMouseDown={onRightResizeMouseDown} />

        {/* Right Column: Companion Tools (Refine Notes and Practice Quiz) */}
        <div className="split-workspace-right">
          {/* Tabs for Right Column */}
          <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border)', marginBottom: '12px', flexShrink: 0 }}>
            <div className="tab-controls" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button
                type="button"
                className={`tab-btn ${rightTab === 'refine' ? 'active' : ''}`}
                onClick={() => setRightTab('refine')}
              >
                💬 Refine Notes
              </button>
              <button
                type="button"
                className={`tab-btn ${rightTab === 'quiz' ? 'active' : ''}`}
                onClick={() => setRightTab('quiz')}
              >
                📝 Practice Quiz
              </button>
            </div>

            {rightTab === 'quiz' && quizData && (
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
            )}
          </div>

          {/* Right Column Content Panel */}
          <div className="note-view-container" style={{ flexGrow: 1, display: 'flex', minHeight: 0, flexDirection: 'column', border: 'none', background: 'transparent' }}>
            {rightTab === 'refine' ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                {/* Visual Chat History Area */}
                <div style={{ flexGrow: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>S</div>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0 var(--radius-sm) var(--radius-sm) var(--radius-sm)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Hi there! I am your AI Curriculum Companion. Ask me to refine, expand, summarize, translate or customize these notes.
                    </div>
                  </div>
                  {chatLogs.map((log) => {
                    const isUser = log.type === 'prompt' || log.type === 'rephrase';
                    const isImage = log.type === 'image';
                    
                    return (
                      <div 
                        key={log.id} 
                        style={{ 
                          display: 'flex', 
                          gap: '8px', 
                          alignSelf: isUser ? 'flex-end' : 'flex-start', 
                          maxWidth: '85%' 
                        }}
                      >
                        {!isUser && (
                          <div style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '50%', 
                            background: 'var(--primary)', 
                            color: '#fff', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '12px', 
                            fontWeight: 'bold', 
                            flexShrink: 0 
                          }}>
                            AI
                          </div>
                        )}
                        <div 
                          style={{ 
                            padding: '10px 14px', 
                            background: isUser ? 'var(--primary-light)' : 'var(--bg-card)', 
                            border: isUser ? '1px solid var(--primary)' : '1px solid var(--border)', 
                            borderRadius: isUser 
                              ? 'var(--radius-sm) var(--radius-sm) 0 var(--radius-sm)' 
                              : '0 var(--radius-sm) var(--radius-sm) var(--radius-sm)', 
                            fontSize: '12px', 
                            color: 'var(--text-primary)' 
                          }}
                        >
                          {log.type === 'rephrase' && (
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px', fontSize: '10px', color: 'var(--primary)' }}>
                              ✨ Rephrase Highlight
                            </span>
                          )}
                          {log.type === 'image' && (
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '4px', fontSize: '10px', color: 'var(--accent)' }}>
                              🖼️ Textbook Illustration Added
                            </span>
                          )}
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {log.type === 'rephrase' ? `"${log.text}"` : log.text}
                          </p>
                          
                          {log.status === 'pending' && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                              ⚡ Refining note contents...
                            </span>
                          )}
                          {log.status === 'error' && (
                            <span style={{ fontSize: '10px', color: '#ef4444', display: 'block', marginTop: '4px' }}>
                              ⚠️ Error: {log.errorMsg || 'Failed to refine notes'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Refinement input */}
                <div 
                  className="refine-chat-box"
                  style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    flexShrink: 0
                  }}
                >
                  <div className="flex justify-between align-center">
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      ✨ Ask Gemini to refine or edit notes:
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
                      placeholder="e.g. 'translate to Spanish', 'add a vocabulary glossary'..."
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
            ) : (
              /* Quiz View Content */
              <div className="quiz-view-container" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                {isGeneratingQuiz ? (
                  <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '32px 16px' }}>
                    <div className="spinner"></div>
                    <div className="empty-state-text" style={{ fontSize: '15px', fontWeight: 600 }}>Generating Practice Quiz...</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{quizProgress}"</div>
                  </div>
                ) : !quizData ? (
                  renderQuizConfigurator()
                ) : (
                  <div className="quiz-content-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="quiz-header-card" style={{ padding: '16px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>{quizData.title || "Practice Quiz"}</h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        Type: {quizData.purpose === 'exam' ? 'Exam Prep' : quizData.purpose === 'homework' ? 'Homework Sheet' : 'Practice Quiz'} • {quizData.questions?.length || 0} Questions • Difficulty: {quizData.difficulty || 'medium'}
                      </p>
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
                          onClick={() => {
                            setUserAnswers({});
                            setTheoryAnswers({});
                          }}
                          disabled={Object.keys(userAnswers).length === 0 && Object.keys(theoryAnswers).length === 0}
                        >
                          🔄 Reset Answers
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', border: 'none', color: '#fff' }}
                          onClick={handleGradeQuiz}
                          disabled={Object.keys(userAnswers).length === 0}
                        >
                          ✅ Submit Score
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                          onClick={() => {
                            setQuizData(null);
                            setUserAnswers({});
                            setTheoryAnswers({});
                            setShowTheoryExplanations({});
                          }}
                        >
                          ⚙️ New Config
                        </button>
                      </div>
                    </div>

                    <div className="quiz-questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {quizData.questions && quizData.questions.map((q, qIndex) => renderQuestionCard(q, qIndex))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Apps Script Exporter Modal */}
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
                  This script generates a Google Form quiz with your 20 practice questions, complete with student details, correct answers, and explanations.
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
        {showImagePromptModal && (
          <div className="preview-modal-backdrop" onClick={() => setShowImagePromptModal(false)}>
            <div className="preview-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
              <header className="preview-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>🎨 Textbook Illustration Generator</h3>
                <button type="button" className="close-modal-btn" onClick={() => setShowImagePromptModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </header>
              <div className="preview-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>Describe the educational diagram, graph, sketch, or textbook illustration you want to generate. It will be embedded directly in your notes.</p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <textarea className="form-textarea" rows="3" placeholder="e.g. '3D diagram of water cycle showing evaporation, condensation, precipitation, labeled arrows, textbook science style'" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} style={{ fontSize: '13px', padding: '10px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => setShowImagePromptModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '12px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderColor: 'transparent' }} onClick={handleInsertImage} disabled={!imagePrompt.trim()}>Generate & Insert</button>
                </div>
              </div>
            </div>
          </div>
        )}
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
            👁️ Preview
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'rich' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('rich');
              setTimeout(() => {
                if (richEditorRef.current) {
                  const parsedHtml = marked.parse(noteText || '');
                  richEditorRef.current.innerHTML = parsedHtml;
                  lastHtmlRef.current = parsedHtml;
                }
              }, 50);
            }}
          >
            ✍️ Rich Text
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            📝 Edit Markdown
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => setActiveTab('quiz')}
          >
            📊 Quiz
          </button>
        </div>

        {activeTab !== 'quiz' ? (
          <div className="preview-actions" style={{ paddingBottom: '4px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={() => setShowImagePromptModal(true)}
              title="Insert generated AI illustration diagram"
            >
              🖼️ Add Image
            </button>
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
              style={{ position: 'relative' }}
              onMouseUp={handlePreviewMouseUp}
              onKeyUp={handlePreviewMouseUp}
            >
              <div dangerouslySetInnerHTML={getHtmlContent()} />
              {selectedText && selectionCoords && (
                <button
                  type="button"
                  className="btn btn-primary floating-rephrase-btn"
                  style={{
                    position: 'absolute',
                    top: `${selectionCoords.top}px`,
                    left: `${selectionCoords.left}px`,
                    zIndex: 100,
                    padding: '6px 12px',
                    fontSize: '11px',
                    borderRadius: '20px',
                    boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                    background: 'var(--primary)',
                    borderColor: 'transparent',
                    animation: 'fadeIn 0.2s ease-out',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRephraseHighlight(selectedText);
                  }}
                >
                  ✨ Rephrase Highlight
                </button>
              )}
            </div>
          )}

          {activeTab === 'rich' && (
            <div 
              ref={richEditorRef}
              className="markdown-preview rich-text-editor" 
              contentEditable
              style={{ position: 'relative', overflowY: 'auto' }}
              onMouseUp={handlePreviewMouseUp}
              onKeyUp={(e) => { handlePreviewMouseUp(e); saveSelection(); }}
              onInput={handleRichInput}
              onBlur={saveSelection}
            >
              {selectedText && selectionCoords && (
                <button
                  type="button"
                  className="btn btn-primary floating-rephrase-btn"
                  style={{
                    position: 'absolute',
                    top: `${selectionCoords.top}px`,
                    left: `${selectionCoords.left}px`,
                    zIndex: 100,
                    padding: '6px 12px',
                    fontSize: '11px',
                    borderRadius: '20px',
                    boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                    background: 'var(--primary)',
                    borderColor: 'transparent',
                    animation: 'fadeIn 0.2s ease-out',
                    whiteSpace: 'nowrap'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRephraseHighlight(selectedText);
                  }}
                  contentEditable={false}
                >
                  ✨ Rephrase Highlight
                </button>
              )}
            </div>
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
                renderQuizConfigurator()
              ) : (
                <div className="quiz-content-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="quiz-header-card" style={{ padding: '16px', background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>{quizData.title || "Practice Quiz"}</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      Type: {quizData.purpose === 'exam' ? 'Exam Prep' : quizData.purpose === 'homework' ? 'Homework Sheet' : 'Practice Quiz'} • {quizData.questions?.length || 0} Questions • Difficulty: {quizData.difficulty || 'medium'}
                    </p>
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
                        onClick={() => {
                          setUserAnswers({});
                          setTheoryAnswers({});
                        }}
                        disabled={Object.keys(userAnswers).length === 0 && Object.keys(theoryAnswers).length === 0}
                      >
                        🔄 Reset Answers
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', border: 'none', color: '#fff' }}
                        onClick={handleGradeQuiz}
                        disabled={Object.keys(userAnswers).length === 0}
                      >
                        ✅ Submit Score
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                        onClick={() => {
                          setQuizData(null);
                          setUserAnswers({});
                          setTheoryAnswers({});
                          setShowTheoryExplanations({});
                        }}
                      >
                        ⚙️ New Config
                      </button>
                    </div>
                  </div>

                  <div className="quiz-questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {quizData.questions && quizData.questions.map((q, qIndex) => renderQuestionCard(q, qIndex))}
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
      {showImagePromptModal && (
        <div className="preview-modal-backdrop" onClick={() => setShowImagePromptModal(false)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <header className="preview-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>🎨 Textbook Illustration Generator</h3>
              <button type="button" className="close-modal-btn" onClick={() => setShowImagePromptModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </header>
            <div className="preview-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>Describe the educational diagram, graph, sketch, or textbook illustration you want to generate. It will be embedded directly in your notes.</p>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea className="form-textarea" rows="3" placeholder="e.g. '3D diagram of water cycle showing evaporation, condensation, precipitation, labeled arrows, textbook science style'" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} style={{ fontSize: '13px', padding: '10px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => setShowImagePromptModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '12px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderColor: 'transparent' }} onClick={handleInsertImage} disabled={!imagePrompt.trim()}>Generate & Insert</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
