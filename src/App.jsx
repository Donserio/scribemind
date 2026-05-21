import React, { useState, useEffect } from 'react';
import UploadZone from './components/UploadZone';
import PagePicker from './components/PagePicker';
import Customizer from './components/Customizer';
import NotePreview from './components/NotePreview';

import { loadPdfDoc, getPageText, getPageDataUrl } from './services/pdfParser';
import { generateCurriculumNotes, extractTopicsFromText, refineCurriculumNotes } from './services/gemini';
import './App.css';

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // PDF Files List State
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);

  // Active File Helper
  const activeFile = files.find(f => f.id === activeFileId);

  // Workspace Panel Widths
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('workspace_left_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('workspace_right_width');
    return saved ? parseInt(saved, 10) : 450;
  });

  // Persist Sizing to Local Storage
  useEffect(() => {
    localStorage.setItem('workspace_left_width', leftWidth);
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem('workspace_right_width', rightWidth);
  }, [rightWidth]);

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
    apiKey: localStorage.getItem('gemini_api_key') || '',
    modelName: 'gemini-3.5-flash',
    generationMethod: 'single'
  });

  // Note Output States
  const [noteText, setNoteText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');

  // Workspace Directory States
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [directoryName, setDirectoryName] = useState(
    localStorage.getItem('last_directory_name') || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync Theme to HTML DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist API Key changes to localStorage
  useEffect(() => {
    if (settings.apiKey) {
      localStorage.setItem('gemini_api_key', settings.apiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }, [settings.apiKey]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleFileLoaded = async (loadedFile) => {
    try {
      const doc = await loadPdfDoc(loadedFile);
      const newFileObj = {
        id: `${loadedFile.name}_${Date.now()}`,
        name: loadedFile.name,
        size: loadedFile.size,
        pdfDoc: doc,
        pageCount: doc.numPages,
        selectedPages: [],
        topics: null,
        isScanningTopics: false
      };
      setFiles(prev => [...prev, newFileObj]);
      setActiveFileId(newFileObj.id);
    } catch (err) {
      alert(`Error loading PDF: ${err.message}`);
    }
  };

  const handleRemoveFile = (fileId) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      if (activeFileId === fileId) {
        setActiveFileId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const handleSelectionChange = (newSelections) => {
    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return { ...f, selectedPages: newSelections };
      }
      return f;
    }));
  };

  const handleScanTopics = async () => {
    if (!activeFile) return;
    if (!settings.apiKey) {
      alert("Please enter a Gemini API Key under API Credentials in the middle panel.");
      return;
    }

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
        apiKey: settings.apiKey,
        modelName: settings.modelName,
        tocText
      });

      setFiles(prev => prev.map(f => {
        if (f.id === activeFileId) {
          return { ...f, topics: topicsList, isScanningTopics: false };
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
    if (!settings.apiKey) {
      alert("Please enter a Gemini API Key under API Credentials in the middle panel.");
      return;
    }

    const filesWithSelections = files.filter(f => f.selectedPages && f.selectedPages.length > 0);
    if (filesWithSelections.length === 0) {
      alert("Please select at least one curriculum page from the left panel.");
      return;
    }

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
            
            setGenerationProgress(`[${stepCount}/${totalSteps}] Extracting page ${pageNum} from "${fileObj.name}"...`);
            const pageText = await getPageText(fileObj.pdfDoc, pageNum);
            const pageImage = await getPageDataUrl(fileObj.pdfDoc, pageNum, 1.5);
            
            setGenerationProgress(`[${stepCount}/${totalSteps}] Synthesizing notes for "${fileObj.name}" (Page ${pageNum})...`);
            
            const chunkSettings = {
              ...settings,
              customPrompt: `${settings.customPrompt || ''}\n\nNOTE: You are generating the section of study notes corresponding specifically to Page ${pageNum} of the curriculum document named "${fileObj.name}". Connect it logically with previous sections. Do not repeat the vocabulary list or quiz if they are toggled, they will be handled.`
            };

            const chunkResult = await generateCurriculumNotes({
              apiKey: settings.apiKey,
              modelName: settings.modelName,
              pageText,
              pageImages: [pageImage],
              settings: chunkSettings,
              onProgress: (stepText) => setGenerationProgress(`[${stepCount}/${totalSteps}] ${stepText}`)
            });

            fullNotes += (fullNotes ? "\n\n" : "") + chunkResult;
            setNoteText(fullNotes);
          }
        }
        
        setGenerationProgress('All sections compiled successfully!');
      } else {
        setGenerationProgress('Extracting text content from selected pages...');
        const allTextParts = [];
        const allImages = [];
        
        for (const fileObj of filesWithSelections) {
          const textPromises = fileObj.selectedPages.map(pageNum => getPageText(fileObj.pdfDoc, pageNum));
          const textContents = await Promise.all(textPromises);
          allTextParts.push(`--- CURRICULUM FILE: ${fileObj.name} ---\n` + textContents.join("\n\n--- PAGE BREAK ---\n\n"));
          
          const imagePromises = fileObj.selectedPages.map(pageNum => getPageDataUrl(fileObj.pdfDoc, pageNum, 1.5));
          const imageBase64s = await Promise.all(imagePromises);
          allImages.push(...imageBase64s);
        }
        
        const combinedText = allTextParts.join("\n\n====================\n\n");

        setGenerationProgress('Rendering page canvas snapshots for visual analysis...');
        
        const generatedResult = await generateCurriculumNotes({
          apiKey: settings.apiKey,
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
    if (!settings.apiKey) {
      alert("Please enter a Gemini API Key.");
      return;
    }
    
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
        apiKey: settings.apiKey,
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

        <div className="header-actions">
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
      <main 
        className="workspace"
        style={{
          '--left-width': `${leftWidth}px`,
          '--right-width': `${rightWidth}px`
        }}
      >
        
        {/* Left Panel: PDF Upload & Page Selector */}
        <section className="panel pdf-panel">
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
            />
            
            <PagePicker 
              pdfDoc={activeFile?.pdfDoc}
              selectedPages={activeFile?.selectedPages || []}
              onSelectionChange={handleSelectionChange}
              topics={activeFile?.topics}
              onScanTopics={handleScanTopics}
              isScanningTopics={activeFile?.isScanningTopics || false}
              apiKeyEntered={!!settings.apiKey}
            />
          </div>
        </section>

        {/* Left Resizer Handle */}
        <div className="resizer-handle" onMouseDown={handleLeftMouseDown} />

        {/* Center Panel: Configuration Control Form */}
        <section className="panel control-panel">
          <div className="panel-header">
            <h2>⚙️ Generator Parameters</h2>
          </div>
          <div className="panel-content">
            <Customizer 
              settings={settings}
              onChange={setSettings}
              onGenerate={handleGenerateNotes}
              isGenerating={isGenerating}
              disabled={files.length === 0 || !files.some(f => f.selectedPages?.length > 0)}
            />
          </div>
        </section>

        {/* Right Resizer Handle */}
        <div className="resizer-handle" onMouseDown={handleRightMouseDown} />

        {/* Right Panel: Output Notes View & Editor */}
        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>📝 Output Notebook</h2>
          </div>
          <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
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
            />
          </div>
        </section>

      </main>
    </div>
  );
}
