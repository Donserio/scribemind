import React, { useState, useEffect, useRef } from 'react';
import UploadZone from './components/UploadZone';
import PagePicker from './components/PagePicker';
import Customizer from './components/Customizer';
import NotePreview from './components/NotePreview';

import { loadPdfDoc, getPageText, getPageDataUrl } from './services/pdfParser';
import { generateCurriculumNotes, extractTopicsFromText, refineCurriculumNotes, generateQuizFromNotes } from './services/gemini';
import { 
  saveResource, 
  getAllResources, 
  deleteResource, 
  saveSessionState, 
  getSessionState, 
  clearSessionState,
  resetDatabase
} from './services/db';
import './App.css';

// Simple debounce utility for IndexedDB writes
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export default function App() {
  // Step Wizard State
  const [step, setStep] = useState(1);

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // PDF Files List State
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);

  // Workspace Panel Widths
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('workspace_left_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('workspace_right_width');
    return saved ? parseInt(saved, 10) : 450;
  });

  // Generator & Settings State
  const [settings, setSettings] = useState({
    gradeLevel: 'high',
    noteStyle: 'standard',
    depth: 'balanced',
    modules: {
      vocabulary: true,
      quiz: true,
      analogies: true
    },
    customPrompt: '',
    modelName: 'gemini-3.5-flash',
    generationMethod: 'single'
  });

  // Note Output States
  const [noteText, setNoteText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  // Quiz States
  const [quizData, setQuizData] = useState(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizProgress, setQuizProgress] = useState('');

  // Workspace Directory States
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [directoryName, setDirectoryName] = useState(
    localStorage.getItem('last_directory_name') || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Active File Helper
  const activeFile = files.find(f => f.id === activeFileId);

  // Debounced save notes text
  const debouncedSaveNoteText = useRef(
    debounce((text) => {
      saveSessionState('noteText', text);
    }, 1000)
  ).current;

  // Persist Sizing to Local Storage
  useEffect(() => {
    localStorage.setItem('workspace_left_width', leftWidth);
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem('workspace_right_width', rightWidth);
  }, [rightWidth]);

  // Restore files and session state from IndexedDB on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedResources = await getAllResources();
        
        // Hydrate PDF objects in background
        const hydratedFiles = await Promise.all(savedResources.map(async (fileObj) => {
          if (fileObj.type === 'pdf' && fileObj.file) {
            try {
              const doc = await loadPdfDoc(fileObj.file);
              return { ...fileObj, pdfDoc: doc };
            } catch (err) {
              console.error(`Failed to warm-up PDF doc for ${fileObj.name}:`, err);
              return fileObj;
            }
          }
          return fileObj;
        }));
        
        setFiles(hydratedFiles);
        
        // Restore session states
        const savedActiveId = await getSessionState('activeFileId');
        if (savedActiveId && hydratedFiles.some(f => f.id === savedActiveId)) {
          setActiveFileId(savedActiveId);
        } else if (hydratedFiles.length > 0) {
          setActiveFileId(hydratedFiles[0].id);
        }
        
        const savedStep = await getSessionState('step');
        if (savedStep) setStep(savedStep);
        
        const savedNoteText = await getSessionState('noteText');
        if (savedNoteText) setNoteText(savedNoteText);
        
        const savedQuizData = await getSessionState('quizData');
        if (savedQuizData) setQuizData(savedQuizData);
      } catch (err) {
        console.error("Error restoring ScribeMind session from IndexedDB:", err);
      }
    };
    
    restoreSession();
  }, []);

  // Save session state to IndexedDB when key states change
  useEffect(() => {
    if (activeFileId) {
      saveSessionState('activeFileId', activeFileId);
    }
  }, [activeFileId]);

  useEffect(() => {
    saveSessionState('step', step);
  }, [step]);

  useEffect(() => {
    saveSessionState('quizData', quizData);
  }, [quizData]);

  // Watch noteText and save debounced
  useEffect(() => {
    debouncedSaveNoteText(noteText);
  }, [noteText]);

  // Drag Handlers for Columns
  const handleLeftMouseDown = (e) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    const handleEl = e.currentTarget;
    handleEl.classList.add('active');

    const handleMouseMove = (moveEvent) => {
      const newWidth = Math.max(200, Math.min(moveEvent.clientX, 600));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      handleEl.classList.remove('active');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRightMouseDown = (e) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    const handleEl = e.currentTarget;
    handleEl.classList.add('active');

    const handleMouseMove = (moveEvent) => {
      const newWidth = Math.max(300, Math.min(window.innerWidth - moveEvent.clientX, 800));
      setRightWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      handleEl.classList.remove('active');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };


  // Sync Theme to HTML DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);



  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleNewSession = async () => {
    setFiles(prev => {
      const updated = prev.map(f => {
        const resetFile = { ...f, selectedPages: [] };
        saveResource(resetFile);
        return resetFile;
      });
      return updated;
    });
    setNoteText('');
    setQuizData(null);
    setStep(1);
    
    // Clear session database
    await saveSessionState('noteText', '');
    await saveSessionState('quizData', null);
    await saveSessionState('step', 1);
  };

  const handleFileLoaded = async (loadedFile) => {
    const ext = loadedFile.name.split('.').pop().toLowerCase();
    const isImage = loadedFile.type.startsWith('image/') || ["png", "jpg", "jpeg", "webp"].includes(ext);
    const isText = loadedFile.type.startsWith('text/') || ["txt", "md"].includes(ext);

    try {
      let newFileObj;
      if (isImage) {
        // Read image file as data URL
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(loadedFile);
        });

        newFileObj = {
          id: `${loadedFile.name}_${Date.now()}`,
          name: loadedFile.name,
          size: loadedFile.size,
          type: 'image',
          dataUrl: dataUrl,
          pageCount: 1,
          selectedPages: [1], // select by default
          topics: null,
          category: 'slides', // Default tag for images
          uploadedAt: Date.now(),
          isScanningTopics: false
        };
      } else if (isText) {
        // Read text file
        const textContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(loadedFile);
        });

        newFileObj = {
          id: `${loadedFile.name}_${Date.now()}`,
          name: loadedFile.name,
          size: loadedFile.size,
          type: 'text',
          textContent: textContent,
          pageCount: 1,
          selectedPages: [1], // select by default
          topics: null,
          category: 'notes', // Default tag for text files
          uploadedAt: Date.now(),
          isScanningTopics: false
        };
      } else {
        // PDF File
        const doc = await loadPdfDoc(loadedFile);
        newFileObj = {
          id: `${loadedFile.name}_${Date.now()}`,
          name: loadedFile.name,
          size: loadedFile.size,
          type: 'pdf',
          file: loadedFile, // Keep actual file for IndexedDB restoration
          pdfDoc: doc,
          pageCount: doc.numPages,
          selectedPages: [],
          topics: null,
          category: 'curriculum', // Default tag for PDFs
          uploadedAt: Date.now(),
          isScanningTopics: false
        };
      }

      // Save to IndexedDB
      await saveResource(newFileObj);

      setFiles(prev => [...prev, newFileObj]);
      setActiveFileId(newFileObj.id);
    } catch (err) {
      alert(`Error loading file: ${err.message}`);
    }
  };

  const handleRemoveFile = async (fileId) => {
    try {
      await deleteResource(fileId);
      setFiles(prev => {
        const updated = prev.filter(f => f.id !== fileId);
        if (activeFileId === fileId) {
          setActiveFileId(updated.length > 0 ? updated[0].id : null);
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to delete resource from database:", err);
    }
  };

  const handleRenameFile = async (fileId, newName) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        const updated = { ...f, name: newName };
        saveResource(updated);
        return updated;
      }
      return f;
    }));
  };

  const handleUpdateCategory = async (fileId, category) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        const updated = { ...f, category };
        saveResource(updated);
        return updated;
      }
      return f;
    }));
  };

  const handleSelectionChange = (newSelections) => {
    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        const updated = { ...f, selectedPages: newSelections };
        saveResource(updated);
        return updated;
      }
      return f;
    }));
  };

  const handleScanTopics = async () => {
    if (!activeFile) return;

    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return { ...f, isScanningTopics: true };
      }
      return f;
    }));

    try {
      const pagesToScan = Math.min(4, activeFile.pageCount);
      const textPromises = [];
      for (let p = 1; p <= pagesToScan; p++) {
        textPromises.push(getPageText(activeFile.pdfDoc, p));
      }
      const pageTexts = await Promise.all(textPromises);
      const tocText = pageTexts.join("\n");

      const topicsList = await extractTopicsFromText({
        modelName: settings.modelName,
        tocText
      });

      setFiles(prev => prev.map(f => {
        if (f.id === activeFileId) {
          const updated = { ...f, topics: topicsList, isScanningTopics: false };
          saveResource(updated);
          return updated;
        }
        return f;
      }));
    } catch (err) {
      console.error("Failed to scan topics:", err);
      alert(`Failed to scan topics: ${err.message}`);
      setFiles(prev => prev.map(f => {
        if (f.id === activeFileId) {
          return { ...f, isScanningTopics: false };
        }
        return f;
      }));
    }
  };

  // Connect Local Folder via File System Access API
  const handleConnectWorkspace = async () => {
    try {
      if (!window.showDirectoryPicker) {
        alert("Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera to save notes directly to folders. Fall back to standard downloads instead.");
        return;
      }
      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);
      setDirectoryName(handle.name);
      localStorage.setItem('last_directory_name', handle.name);
    } catch (err) {
      console.warn("Folder picker cancelled or failed", err);
    }
  };

  // Save generated note directly to the local connected directory
  const handleSaveToWorkspace = async (filename) => {
    if (!directoryHandle) {
      alert("Please connect a workspace directory first.");
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(noteText);
      await writable.close();

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving file to directory", err);
      alert(`Could not save file: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Generate Notes logic coordinating pdfParser + gemini
  const handleGenerateNotes = async () => {

    const filesWithSelections = files.filter(f => f.selectedPages && f.selectedPages.length > 0);
    if (filesWithSelections.length === 0) {
      alert("Please select at least one curriculum page from the left panel.");
      return;
    }

    setStep(3);
    setQuizData(null);
    setIsGenerating(true);
    setNoteText('');
    setGenerationProgress('Starting note creation...');

    try {
      if (settings.generationMethod === 'step') {
        let fullNotes = '';
        let stepCount = 0;
        
        const totalSteps = filesWithSelections.reduce((sum, f) => sum + f.selectedPages.length, 0);
        
        for (const fileObj of filesWithSelections) {
          for (let idx = 0; idx < fileObj.selectedPages.length; idx++) {
            const pageNum = fileObj.selectedPages[idx];
            stepCount++;
            
            let pageText = '';
            let pageImagesList = [];

            if (fileObj.type === 'image') {
              setGenerationProgress(`[${stepCount}/${totalSteps}] Preparing image source "${fileObj.name}"...`);
              pageText = `[Source Image: ${fileObj.name}]`;
              pageImagesList = [fileObj.dataUrl];
            } else if (fileObj.type === 'text') {
              setGenerationProgress(`[${stepCount}/${totalSteps}] Reading text source "${fileObj.name}"...`);
              pageText = `--- FILE: ${fileObj.name} ---\n${fileObj.textContent}`;
              pageImagesList = [];
            } else {
              // PDF
              setGenerationProgress(`[${stepCount}/${totalSteps}] Extracting page ${pageNum} from "${fileObj.name}"...`);
              pageText = await getPageText(fileObj.pdfDoc, pageNum);
              const pageImage = await getPageDataUrl(fileObj.pdfDoc, pageNum, 1.5);
              pageImagesList = [pageImage];
            }
            
            setGenerationProgress(`[${stepCount}/${totalSteps}] Synthesizing notes for "${fileObj.name}"...`);
            
            const chunkSettings = {
              ...settings,
              customPrompt: `${settings.customPrompt || ''}\n\nNOTE: You are generating notes corresponding specifically to "${fileObj.name}". Connect it logically with previous sections. Do not repeat the vocabulary list or quiz if they are toggled, they will be handled.`
            };

            const chunkResult = await generateCurriculumNotes({
              modelName: settings.modelName,
              pageText,
              pageImages: pageImagesList,
              settings: chunkSettings,
              onProgress: (stepText) => setGenerationProgress(`[${stepCount}/${totalSteps}] ${stepText}`)
            });

            fullNotes += (fullNotes ? "\n\n" : "") + chunkResult;
            setNoteText(fullNotes);
          }
        }
        
        setGenerationProgress('All sections compiled successfully!');
      } else {
        setGenerationProgress('Extracting content from selected files...');
        const allTextParts = [];
        const allImages = [];
        
        for (const fileObj of filesWithSelections) {
          if (fileObj.type === 'image') {
            allTextParts.push(`--- CURRICULUM IMAGE FILE: ${fileObj.name} ---`);
            allImages.push(fileObj.dataUrl);
          } else if (fileObj.type === 'text') {
            allTextParts.push(`--- CURRICULUM TEXT FILE: ${fileObj.name} ---\n` + fileObj.textContent);
          } else {
            // PDF
            const textPromises = fileObj.selectedPages.map(pageNum => getPageText(fileObj.pdfDoc, pageNum));
            const textContents = await Promise.all(textPromises);
            allTextParts.push(`--- CURRICULUM FILE: ${fileObj.name} ---\n` + textContents.join("\n\n--- PAGE BREAK ---\n\n"));
            
            const imagePromises = fileObj.selectedPages.map(pageNum => getPageDataUrl(fileObj.pdfDoc, pageNum, 1.5));
            const imageBase64s = await Promise.all(imagePromises);
            allImages.push(...imageBase64s);
          }
        }
        
        const combinedText = allTextParts.join("\n\n====================\n\n");

        setGenerationProgress('Rendering curriculum files for multimodal parsing...');
        
        const generatedResult = await generateCurriculumNotes({
          modelName: settings.modelName,
          pageText: combinedText,
          pageImages: allImages,
          settings: settings,
          onProgress: (stepText) => setGenerationProgress(stepText)
        });

        setNoteText(generatedResult);
      }
    } catch (err) {
      console.error("Note Generation Failed", err);
      alert(`Generation Failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Refine existing notes using Chat instructions
  const handleRefineNotes = async (userPrompt) => {
    setQuizData(null);
    setIsGenerating(true);
    setGenerationProgress('Analyzing notes and initializing refinement...');
    
    try {
      const filesWithSelections = files.filter(f => f.selectedPages && f.selectedPages.length > 0);
      const allTextParts = [];
      for (const fileObj of filesWithSelections) {
        const textPromises = fileObj.selectedPages.map(pageNum => getPageText(fileObj.pdfDoc, pageNum));
        const textContents = await Promise.all(textPromises);
        allTextParts.push(`--- FILE: ${fileObj.name} ---\n` + textContents.join("\n\n"));
      }
      const combinedContextText = allTextParts.join("\n\n");
      
      const refinedText = await refineCurriculumNotes({
        modelName: settings.modelName,
        originalNotes: noteText,
        userPrompt,
        curriculumContext: combinedContextText,
        onProgress: (stepText) => setGenerationProgress(stepText)
      });
      
      setNoteText(refinedText);
    } catch (err) {
      console.error("Refinement failed:", err);
      alert(`Refinement Failed: ${err.message}`);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate customized Practice Quiz / Exam Questions
  const handleGenerateQuiz = async (quizOptions = {}) => {
    if (!noteText) {
      alert("No study notes found. Please generate notes first before creating a practice quiz.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuizProgress("Starting assessment synthesis...");

    try {
      const quiz = await generateQuizFromNotes({
        modelName: settings.modelName,
        notesText: noteText,
        options: quizOptions,
        onProgress: (stepText) => setQuizProgress(stepText)
      });
      setQuizData(quiz);
    } catch (err) {
      console.error("Assessment synthesis failed:", err);
      alert(`Assessment Synthesis Failed: ${err.message}`);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };


  const totalSelectedPages = files.reduce((sum, f) => sum + (f.selectedPages?.length || 0), 0);

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">S</div>
          <div className="brand-text">
            <h1>ScribeMind</h1>
            <p>AI Curriculum Note Generator</p>
          </div>
        </div>

        {/* Stepper Header Navigation */}
        <div className="stepper-header">
          <button 
            type="button"
            className={`step-indicator-btn ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
            onClick={() => step > 1 && setStep(1)}
            disabled={step === 1}
          >
            <span className="step-badge">1</span>
            <span className="step-text">Source Materials</span>
          </button>
          
          <div className="step-connector-line"></div>
          
          <button 
            type="button"
            className={`step-indicator-btn ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
            onClick={() => step !== 2 && totalSelectedPages > 0 && setStep(2)}
            disabled={step === 2 || totalSelectedPages === 0}
          >
            <span className="step-badge">2</span>
            <span className="step-text">Configure Notes</span>
          </button>
          
          <div className="step-connector-line"></div>
          
          <button 
            type="button"
            className={`step-indicator-btn ${step === 3 ? 'active' : ''}`}
            onClick={() => step !== 3 && noteText && setStep(3)}
            disabled={step === 3 || !noteText}
          >
            <span className="step-badge">3</span>
            <span className="step-text">Study Suite</span>
          </button>
        </div>

        <div className="header-actions">
          {step === 3 && (
            <button
              type="button"
              className="btn btn-secondary new-session-btn"
              onClick={handleNewSession}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
            >
              ↺ New Session
            </button>
          )}
          {/* Theme Toggler */}
          <button 
            type="button" 
            className="icon-btn" 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="workspace">
        
        {/* Step 1: Source Materials */}
        {step === 1 && (
          <div className="step-1-container">
            <div className="step-1-content">
              {/* Left Panel: PDF Upload */}
              <section className="panel pdf-panel" style={{ height: '100%' }}>
                <div className="panel-header">
                  <h2>📚 Curriculum Source</h2>
                </div>
                <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <UploadZone 
                    files={files}
                    activeFileId={activeFileId}
                    onSetActiveFile={setActiveFileId}
                    onFileLoaded={handleFileLoaded}
                    onRemoveFile={handleRemoveFile}
                    onRenameFile={handleRenameFile}
                    onUpdateCategory={handleUpdateCategory}
                  />
                </div>
              </section>

              {/* Right Panel: Page Selection Grid */}
              <section className="panel picker-panel" style={{ height: '100%' }}>
                <div className="panel-header">
                  <h2>📄 Select Pages & Outline Topics</h2>
                </div>
                <div className="panel-content">
                  <PagePicker 
                    activeFile={activeFile}
                    selectedPages={activeFile?.selectedPages || []}
                    onSelectionChange={handleSelectionChange}
                    topics={activeFile?.topics}
                    onScanTopics={handleScanTopics}
                    isScanningTopics={activeFile?.isScanningTopics || false}
                    apiKeyEntered={true}
                  />
                </div>
              </section>
            </div>

            {/* Step 1 Footer */}
            <footer className="wizard-footer-bar">
              <span className="selected-count-badge">
                {totalSelectedPages} page{totalSelectedPages !== 1 ? 's' : ''} selected
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={totalSelectedPages === 0}
                onClick={() => setStep(2)}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Proceed to Customize ➔
              </button>
            </footer>
          </div>
        )}

        {/* Step 2: Configure Notes */}
        {step === 2 && (
          <div className="step-2-container">
            <div className="step-2-content">
              <div className="step-2-card">
                <div className="panel-header">
                  <h2>⚙️ Configure Notes & Style Settings</h2>
                </div>
                <div className="panel-content" style={{ padding: 0 }}>
                  <Customizer 
                    settings={settings}
                    onChange={setSettings}
                  />
                </div>
              </div>
            </div>

            {/* Step 2 Footer */}
            <footer className="wizard-footer-bar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(1)}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                ← Back to Upload
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateNotes}
                disabled={isGenerating || files.length === 0 || totalSelectedPages === 0}
                style={{ fontSize: '13px', padding: '8px 20px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', borderColor: 'transparent', boxShadow: 'var(--shadow-md)' }}
              >
                ⚡ Generate Student Notes
              </button>
            </footer>
          </div>
        )}

        {/* Step 3: Study Suite */}
        {step === 3 && (
          <div className="step-3-container">
            <NotePreview 
              noteText={noteText}
              onTextChange={setNoteText}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
              onConnectWorkspace={handleConnectWorkspace}
              directoryName={directoryName}
              onSaveToWorkspace={handleSaveToWorkspace}
              isSaving={isSaving}
              saveSuccess={saveSuccess}
              onRefineNotes={handleRefineNotes}
              // Quiz states
              quizData={quizData}
              isGeneratingQuiz={isGeneratingQuiz}
              quizProgress={quizProgress}
              onGenerateQuiz={handleGenerateQuiz}
              // Split workspace props
              splitLayout={true}
              rightWidth={rightWidth}
              onRightResizeMouseDown={handleRightMouseDown}
            />
          </div>
        )}

      </main>
    </div>
  );
}
