import React, { useState, useRef } from 'react';

export default function UploadZone({ files = [], activeFileId, onSetActiveFile, onFileLoaded, onRemoveFile }) {
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
          <div className="flex justify-between align-center" style={{ marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Uploaded Documents ({files.length})
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
          
          <div className="pdf-files-scroller" style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {files.map((fileObj) => {
              const isActive = fileObj.id === activeFileId;
              const selectionCount = fileObj.selectedPages?.length || 0;
              return (
                <div 
                  key={fileObj.id} 
                  className={`pdf-info-card ${isActive ? 'active' : ''}`}
                  onClick={() => onSetActiveFile(fileObj.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: isActive ? 'var(--primary-light)' : 'var(--bg-card)',
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    position: 'relative'
                  }}
                >
                  <div className="pdf-icon" style={{ fontSize: '20px', color: fileObj.type === 'image' ? '#3b82f6' : fileObj.type === 'text' ? '#10b981' : '#ef4444' }}>
                    {fileObj.type === 'image' ? '🖼️' : fileObj.type === 'text' ? '📝' : '📄'}
                  </div>
                  <div className="pdf-details" style={{ flexGrow: 1, minWidth: 0 }}>
                    <div 
                      className="pdf-name" 
                      title={fileObj.name}
                      style={{ 
                        fontSize: '12px', 
                        fontWeight: isActive ? 600 : 500, 
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {fileObj.name}
                    </div>
                    <div className="pdf-meta" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {formatBytes(fileObj.size)} • {fileObj.type === 'image' ? 'Image' : fileObj.type === 'text' ? 'Text File' : `${fileObj.pageCount} pages`} 
                      {selectionCount > 0 && (
                        <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: '6px' }}>
                          ({selectionCount} selected)
                        </span>
                      )}
                    </div>
                  </div>
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
                      fontSize: '13px',
                      padding: '4px',
                      transition: 'color var(--transition-fast)'
                    }}
                    title="Remove file"
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
