import React, { useState, useRef } from 'react';

export default function UploadZone({ 
  files = [], 
  activeFileId, 
  onSetActiveFile, 
  onFileLoaded, 
  onRemoveFile,
  onRenameFile,
  onUpdateCategory
}) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const isSupportedFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const isPdf = file.type === "application/pdf" || ext === "pdf";
    const isImg = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext);
    const isTxt = file.type.startsWith("text/") || ["txt", "md"].includes(ext);
    return isPdf || isImg || isTxt;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => {
        if (isSupportedFile(file)) {
          onFileLoaded(file);
        } else {
          alert(`"${file.name}" is not supported. Please upload PDFs, images, or text documents only.`);
        }
      });
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        if (isSupportedFile(file)) {
          onFileLoaded(file);
        } else {
          alert(`"${file.name}" is not supported. Please upload PDFs, images, or text documents only.`);
        }
      });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Compile stats
  const categoryCounts = files.reduce((acc, f) => {
    const cat = f.category || 'curriculum';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, { curriculum: 0, textbook: 0, slides: 0, notes: 0 });

  return (
    <div className="upload-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*,.txt,.md"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {/* Render Dropzone if empty or render compact add button if list exists */}
      {files.length === 0 ? (
        <div
          className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <div className="upload-icon">📤</div>
          <div className="upload-text">Drag & Drop Curriculum Sources</div>
          <div className="upload-subtext">or click to browse PDFs, images, or text documents</div>
        </div>
      ) : (
        <div className="files-list-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Persistence status banner */}
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--primary-light)', borderLeft: '3px solid var(--primary)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💾 Storage Persistent (IndexedDB Active)</span>
          </div>

          {/* Stat Dashboard Row */}
          <div className="library-stats-bar">
            <div>
              <span className="stat-count stat-curriculum">{categoryCounts.curriculum}</span>
              <span className="stat-label">Curriculum</span>
            </div>
            <div>
              <span className="stat-count stat-textbook">{categoryCounts.textbook}</span>
              <span className="stat-label">Textbook</span>
            </div>
            <div>
              <span className="stat-count stat-slides">{categoryCounts.slides}</span>
              <span className="stat-label">Slides</span>
            </div>
            <div>
              <span className="stat-count stat-notes">{categoryCounts.notes}</span>
              <span className="stat-label">Notes</span>
            </div>
          </div>

          <div className="flex justify-between align-center" style={{ marginTop: '4px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Source Library ({files.length})
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={triggerFileInput}
            >
              ➕ Add Source
            </button>
          </div>
          
          <div className="pdf-files-scroller" style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {files.map((fileObj) => {
              const isActive = fileObj.id === activeFileId;
              const selectionCount = fileObj.selectedPages?.length || 0;
              const cat = fileObj.category || 'curriculum';
              
              // Resolve category theme colors
              const catTheme = 
                cat === 'textbook' ? { border: 'rgba(59, 130, 246, 0.4)', bg: 'rgba(59, 130, 246, 0.05)' } :
                cat === 'slides' ? { border: 'rgba(245, 158, 11, 0.4)', bg: 'rgba(245, 158, 11, 0.05)' } :
                cat === 'notes' ? { border: 'rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.05)' } :
                { border: 'rgba(124, 58, 237, 0.4)', bg: 'rgba(124, 58, 237, 0.05)' }; // curriculum default
                
              return (
                <div 
                  key={fileObj.id} 
                  className={`pdf-info-card ${isActive ? 'active' : ''}`}
                  onClick={() => onSetActiveFile(fileObj.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px',
                    background: isActive ? 'var(--primary-light)' : 'var(--bg-card)',
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    position: 'relative',
                    boxShadow: isActive ? 'var(--shadow-glow)' : 'var(--shadow-sm)'
                  }}
                >
                  {/* File Type Icon */}
                  <div className="pdf-icon" style={{ fontSize: '20px', marginTop: '2px', color: fileObj.type === 'image' ? '#3b82f6' : fileObj.type === 'text' ? '#10b981' : '#ef4444', flexShrink: 0 }}>
                    {fileObj.type === 'image' ? '🖼️' : fileObj.type === 'text' ? '📝' : '📄'}
                  </div>

                  {/* Resource details */}
                  <div className="pdf-details" style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Inline Editable Rename Input */}
                    <input 
                      type="text" 
                      className="resource-name-input"
                      value={fileObj.name}
                      onClick={(e) => e.stopPropagation()} // Prevent activating card when selecting text
                      onChange={(e) => onRenameFile(fileObj.id, e.target.value)}
                      title="Click to rename document"
                    />

                    {/* Metadata line */}
                    <div className="pdf-meta" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', margin: '4px 0 6px 4px' }}>
                      <span>{formatBytes(fileObj.size)}</span>
                      <span>•</span>
                      <span>{fileObj.type === 'image' ? 'Image' : fileObj.type === 'text' ? 'Text File' : `${fileObj.pageCount} pages`}</span>
                      {selectionCount > 0 && (
                        <>
                          <span>•</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            ({selectionCount} selected)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Category Tag Selector Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Tag:</span>
                      <select
                        className="category-select"
                        value={cat}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateCategory(fileObj.id, e.target.value)}
                        style={{
                          border: `1px solid ${catTheme.border}`,
                          background: catTheme.bg
                        }}
                      >
                        <option value="curriculum">📚 Curriculum</option>
                        <option value="textbook">📖 Textbook</option>
                        <option value="slides">📽️ Slides</option>
                        <option value="notes">📝 Notes</option>
                      </select>
                    </div>
                  </div>

                  {/* Remove action button */}
                  <button 
                    type="button" 
                    className="clear-pdf" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(fileObj.id);
                    }} 
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px',
                      marginTop: '-4px',
                      marginRight: '-4px',
                      transition: 'color var(--transition-fast)'
                    }}
                    title="Delete document from database"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
