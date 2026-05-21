import React, { useEffect, useState, useRef } from 'react';
import { renderPageToCanvas } from '../services/pdfParser';

export default function PagePicker({ 
  pdfDoc, 
  selectedPages = [], 
  onSelectionChange,
  topics = null,
  onScanTopics,
  isScanningTopics = false,
  apiKeyEntered = false
}) {
  const [activeTab, setActiveTab] = useState('thumbnails'); // 'thumbnails' | 'outline'
  const [pageCount, setPageCount] = useState(0);
  const [renderedPages, setRenderedPages] = useState({});
  const [topicSearch, setTopicSearch] = useState('');
  const canvasRefs = useRef({});
  
  // Page Preview Modal States
  const [previewPage, setPreviewPage] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewCanvasRef = useRef(null);

  useEffect(() => {
    if (pdfDoc) {
      setPageCount(pdfDoc.numPages);
      setRenderedPages({});
      setPreviewPage(null);
    } else {
      setPageCount(0);
      setPreviewPage(null);
    }
  }, [pdfDoc]);

  // Sequentially render canvas thumbnails so we don't freeze the page
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return;

    let isSubscribed = true;

    const renderAllPages = async () => {
      for (let i = 1; i <= pageCount; i++) {
        if (!isSubscribed) break;

        const canvas = canvasRefs.current[i];
        if (canvas && !renderedPages[i]) {
          try {
            await renderPageToCanvas(pdfDoc, i, canvas, 0.22);
            if (isSubscribed) {
              setRenderedPages(prev => ({ ...prev, [i]: true }));
            }
          } catch (err) {
            console.error(`Failed to render thumbnail for page ${i}`, err);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    };

    renderAllPages();

    return () => {
      isSubscribed = false;
    };
  }, [pdfDoc, pageCount, renderedPages]);

  // Render high-res preview page to modal canvas
  useEffect(() => {
    if (!previewPage || !pdfDoc) return;

    let isSubscribed = true;
    setIsPreviewLoading(true);

    const renderPreview = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      const canvas = previewCanvasRef.current;
      if (canvas && isSubscribed) {
        try {
          await renderPageToCanvas(pdfDoc, previewPage, canvas, 1.4);
          if (isSubscribed) {
            setIsPreviewLoading(false);
          }
        } catch (err) {
          console.error("Error rendering preview canvas:", err);
          if (isSubscribed) {
            setIsPreviewLoading(false);
          }
        }
      }
    };

    renderPreview();

    return () => {
      isSubscribed = false;
    };
  }, [previewPage, pdfDoc]);

  // Escape key and Arrow key page navigation for preview modal
  useEffect(() => {
    if (!previewPage) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewPage(null);
      } else if (e.key === 'ArrowLeft') {
        if (previewPage > 1) {
          setPreviewPage(previewPage - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (previewPage < pageCount) {
          setPreviewPage(previewPage + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewPage, pageCount]);

  const togglePageSelection = (pageNum) => {
    if (selectedPages.includes(pageNum)) {
      onSelectionChange(selectedPages.filter(p => p !== pageNum));
    } else {
      onSelectionChange([...selectedPages, pageNum].sort((a, b) => a - b));
    }
  };

  const selectAll = () => {
    const all = Array.from({ length: pageCount }, (_, i) => i + 1);
    onSelectionChange(all);
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  // Helper to determine selection status for a topic's page range
  const getTopicSelectionStatus = (startPage, endPage) => {
    const pages = [];
    // Ensure valid page ranges
    const start = Math.max(1, Math.min(startPage, pageCount));
    const end = Math.max(1, Math.min(endPage, pageCount));
    
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    const selectedCount = pages.filter(p => selectedPages.includes(p)).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === pages.length) return 'all';
    return 'partial';
  };

  // Handle toggling of a topic's range
  const handleToggleTopic = (startPage, endPage) => {
    const start = Math.max(1, Math.min(startPage, pageCount));
    const end = Math.max(1, Math.min(endPage, pageCount));
    const topicPages = [];
    for (let p = start; p <= end; p++) {
      topicPages.push(p);
    }

    const status = getTopicSelectionStatus(start, end);
    let updated;
    
    if (status === 'all') {
      // Remove all pages in topic range
      updated = selectedPages.filter(p => !topicPages.includes(p));
    } else {
      // Add all pages in topic range
      updated = Array.from(new Set([...selectedPages, ...topicPages]));
    }
    
    onSelectionChange(updated.sort((a, b) => a - b));
  };

  if (!pdfDoc) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <div className="empty-state-text">
          Upload a curriculum PDF to view and select topic pages.
        </div>
      </div>
    );
  }

  // Filter topics based on search query
  const filteredTopics = topics?.filter(t => 
    t.title.toLowerCase().includes(topicSearch.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(topicSearch.toLowerCase()))
  ) || [];

  return (
    <div className="page-picker-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Picker Tab Controls */}
      <div className="tab-controls" style={{ margin: '12px 0 8px 0', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'thumbnails' ? 'active' : ''}`}
          onClick={() => setActiveTab('thumbnails')}
          style={{ flexGrow: 1, textAlign: 'center', fontSize: '12px', padding: '8px 4px' }}
        >
          🖼️ Thumbnails
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'outline' ? 'active' : ''}`}
          onClick={() => setActiveTab('outline')}
          style={{ flexGrow: 1, textAlign: 'center', fontSize: '12px', padding: '8px 4px' }}
        >
          🔍 Syllabus Outline
        </button>
      </div>

      {activeTab === 'thumbnails' ? (
        <>
          <div className="flex align-center justify-between mb-4" style={{ gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {selectedPages.length} of {pageCount} Selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }} 
                onClick={selectAll}
              >
                All
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }} 
                onClick={selectNone}
              >
                None
              </button>
            </div>
          </div>

          <div className="thumbnail-grid" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
              const isSelected = selectedPages.includes(pageNum);
              return (
                <div 
                  key={pageNum}
                  className={`thumbnail-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => togglePageSelection(pageNum)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setPreviewPage(pageNum);
                  }}
                  title="Double click to preview page details"
                >
                  <div className="thumbnail-preview-overlay">
                    <button
                      type="button"
                      className="card-preview-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewPage(pageNum);
                      }}
                      title={`Preview Page ${pageNum}`}
                    >
                      👁️
                    </button>
                  </div>

                  <div className="thumbnail-checkbox">
                    ✓
                  </div>
                  <div className="thumbnail-canvas-container">
                    <canvas 
                      ref={el => canvasRefs.current[pageNum] = el}
                      style={{ opacity: renderedPages[pageNum] ? 1 : 0.3, transition: 'opacity 0.2s' }}
                    />
                    {!renderedPages[pageNum] && (
                      <div style={{ position: 'absolute', fontSize: '10px', color: 'var(--text-muted)' }}>
                        Loading...
                      </div>
                    )}
                  </div>
                  <div className="thumbnail-number">
                    Page {pageNum}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Syllabus Topics Outline Indexer Tab */
        <div className="outline-indexer-view" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
          {isScanningTopics ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="spinner" style={{ marginBottom: '12px' }}></div>
              <div className="empty-state-text" style={{ fontSize: '14px' }}>Scanning PDF Table of Contents...</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Running lightweight Gemini semantic indexer.</div>
            </div>
          ) : !topics ? (
            <div className="empty-state" style={{ padding: '24px 16px', gap: '8px' }}>
              <div style={{ fontSize: '32px' }}>✨</div>
              <div className="empty-state-text" style={{ fontSize: '14px', fontWeight: 600 }}>Topic Auto-Indexer</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4', maxWidth: '220px' }}>
                Let Gemini scan the first few pages of this PDF to extract curriculum chapters and pages.
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '8px 16px', marginTop: '8px' }}
                onClick={onScanTopics}
                disabled={!apiKeyEntered}
              >
                Scan PDF Outline
              </button>
              {!apiKeyEntered && (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  *Requires Gemini API key first
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
              {/* Search topics */}
              <div className="form-group" style={{ marginBottom: '12px', flexShrink: 0 }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  placeholder="🔍 Search topics..."
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                />
              </div>

              {/* Topics list */}
              <div className="topics-list" style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {filteredTopics.length === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', padding: '16px' }}>
                    No matching topics found.
                  </div>
                ) : (
                  filteredTopics.map((topic, idx) => {
                    const status = getTopicSelectionStatus(topic.startPage, topic.endPage);
                    return (
                      <div 
                        key={idx}
                        className={`topic-list-item ${status !== 'none' ? 'selected-item' : ''}`}
                        onClick={() => handleToggleTopic(topic.startPage, topic.endPage)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          background: status === 'all' ? 'var(--primary-light)' : 'var(--bg-card)',
                          border: `1px solid ${status === 'all' ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', height: '18px', marginTop: '2px' }}>
                          <input
                            type="checkbox"
                            style={{ cursor: 'pointer' }}
                            checked={status === 'all'}
                            ref={el => {
                              if (el) el.indeterminate = (status === 'partial');
                            }}
                            onChange={() => {}} // handled by div click
                          />
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div className="flex align-center justify-between" style={{ gap: '8px' }}>
                            <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {topic.title}
                            </h4>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                              p.{topic.startPage === topic.endPage ? topic.startPage : `${topic.startPage}-${topic.endPage}`}
                            </span>
                          </div>
                          {topic.description && (
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0', lineHeight: '1.3' }}>
                              {topic.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="card-preview-btn"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '2px 4px',
                            color: 'var(--text-muted)'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPage(topic.startPage);
                          }}
                          title={`Preview page ${topic.startPage}`}
                        >
                          👁️
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* High-Resolution Preview Modal */}
      {previewPage && (
        <div className="preview-modal-backdrop" onClick={() => setPreviewPage(null)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="preview-modal-header">
              <h3>Page {previewPage} Preview</h3>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => setPreviewPage(null)}
                title="Close (Esc)"
              >
                ✕
              </button>
            </header>
            
            <div className="preview-modal-body">
              {isPreviewLoading && (
                <div className="preview-modal-loading">
                  <div className="spinner"></div>
                  <span>Rendering page details...</span>
                </div>
              )}
              <div 
                className="preview-canvas-wrapper" 
                style={{ display: isPreviewLoading ? 'none' : 'flex' }}
              >
                <canvas ref={previewCanvasRef} />
              </div>
            </div>

            <footer className="preview-modal-footer">
              <div className="modal-nav-buttons">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage(previewPage - 1)}
                  title="Previous Page (Left Arrow)"
                >
                  ◀ Prev
                </button>
                <span className="modal-page-indicator">
                  {previewPage} / {pageCount}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={previewPage >= pageCount}
                  onClick={() => setPreviewPage(previewPage + 1)}
                  title="Next Page (Right Arrow)"
                >
                  Next ▶
                </button>
              </div>

              <label className="modal-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedPages.includes(previewPage)}
                  onChange={() => togglePageSelection(previewPage)}
                />
                <span>Include in Note Generation</span>
              </label>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
