import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useVaultStore } from '../../store/vaultStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { FilePreview } from './FilePreview';
import { ImageViewer } from './ImageViewer';

/**
 * Media Browser — handles large file collections with CSS virtual scrolling.
 * Uses streaming decryption via vault:// protocol for images and video.
 */
export const MediaBrowser: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'audio' | 'other'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'name'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [viewerState, setViewerState] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const {
    files,
    selectedFiles,
    selectFile,
    deselectFile,
    selectAll,
    clearSelection
  } = useVaultStore();

  const filteredFiles = useMemo(() => {
    let filtered = [...files];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(file =>
        file.original_name.toLowerCase().includes(q) ||
        file.source_url?.toLowerCase().includes(q) ||
        file.extension?.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(file => file.media_type === filterType);
    }

    switch (sortBy) {
      case 'date':
        filtered.sort((a, b) => new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime());
        break;
      case 'size':
        filtered.sort((a, b) => b.file_size - a.file_size);
        break;
      case 'name':
        filtered.sort((a, b) => a.original_name.localeCompare(b.original_name));
        break;
    }

    return filtered;
  }, [files, searchQuery, filterType, sortBy]);

  const handleFileClick = useCallback((file: any, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (selectedFiles.includes(file.id)) {
        deselectFile(file.id);
      } else {
        selectFile(file.id);
      }
    } else if (e.shiftKey && selectedFiles.length > 0) {
      const lastSelected = selectedFiles[selectedFiles.length - 1];
      const lastIndex = filteredFiles.findIndex(f => f.id === lastSelected);
      const currentIndex = filteredFiles.findIndex(f => f.id === file.id);
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      clearSelection();
      filteredFiles.slice(start, end + 1).forEach(f => selectFile(f.id));
    } else {
      if (selectedFiles.length === 1 && selectedFiles[0] === file.id) {
        clearSelection();
      } else {
        clearSelection();
        selectFile(file.id);
      }
    }
  }, [selectedFiles, filteredFiles, selectFile, deselectFile, clearSelection]);

  const handleDoubleClick = useCallback((file: any) => {
    if (file.media_type === 'image') {
      // Open ImageViewer with all image files at the clicked index
      const imageFiles = filteredFiles.filter(f => f.media_type === 'image');
      const idx = imageFiles.findIndex(f => f.id === file.id);
      setViewerState({ open: true, index: idx >= 0 ? idx : 0 });
    } else {
      setPreviewFile(file);
    }
  }, [filteredFiles]);

  return (
    <div className="media-browser">
      <div className="browser-toolbar">
        <div className="toolbar-left">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search files..."
            icon="🔍"
          />

          <div className="filter-buttons">
            {(['all', 'image', 'video', 'audio', 'other'] as const).map(type => (
              <button
                key={type}
                className={`filter-btn ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type === 'all' ? 'All' : type === 'image' ? '🖼' : type === 'video' ? '🎥' : type === 'audio' ? '🎵' : '📄'}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-right">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="date">Sort by Date</option>
            <option value="size">Sort by Size</option>
            <option value="name">Sort by Name</option>
          </select>

          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >🔲</button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >📋</button>
          </div>

          {selectedFiles.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear ({selectedFiles.length})
            </Button>
          )}
        </div>
      </div>

      {/* SCROLLABLE CONTENT AREA */}
      <div className="media-scroll-container">
        {viewMode === 'grid' ? (
          <div className="media-grid">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`media-item ${selectedFiles.includes(file.id) ? 'selected' : ''}`}
                onClick={(e) => handleFileClick(file, e)}
                onDoubleClick={() => handleDoubleClick(file)}
              >
                <div className="media-thumbnail">
                  {file.media_type === 'image' ? (
                    <img
                      src={`vault://${file.id}/thumbnail`}
                      alt={file.original_name}
                      loading="lazy"
                      className="thumbnail-image"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className={file.media_type === 'video' ? 'video-placeholder' : 'file-placeholder'}>
                      {file.media_type === 'video' ? '🎥' : file.extension?.toUpperCase() || '📄'}
                    </div>
                  )}

                  {selectedFiles.includes(file.id) && (
                    <div className="selection-indicator">✓</div>
                  )}

                  {file.media_type === 'video' && (
                    <div className="video-badge">▶</div>
                  )}
                </div>

                <div className="media-info">
                  <div className="media-name" title={file.original_name}>
                    {file.original_name}
                  </div>
                  <div className="media-meta">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>•</span>
                    <span>{file.extension?.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="media-list">
            <div className="list-header">
              <span className="col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                />
              </span>
              <span className="col-name">Name</span>
              <span className="col-type">Type</span>
              <span className="col-size">Size</span>
              <span className="col-date">Downloaded</span>
            </div>

            {filteredFiles.map(file => (
              <div
                key={file.id}
                className={`list-item ${selectedFiles.includes(file.id) ? 'selected' : ''}`}
                onClick={(e) => handleFileClick(file, e)}
                onDoubleClick={() => handleDoubleClick(file)}
              >
                <span className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(file.id)}
                    readOnly
                  />
                </span>
                <span className="col-name">
                  <span className="file-icon">
                    {file.media_type === 'image' ? '🖼' : file.media_type === 'video' ? '🎥' : '📄'}
                  </span>
                  {file.original_name}
                </span>
                <span className="col-type">{file.extension?.toUpperCase()}</span>
                <span className="col-size">{formatFileSize(file.file_size)}</span>
                <span className="col-date">
                  {new Date(file.downloaded_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="browser-footer">
        <span>{filteredFiles.length} files</span>
        {selectedFiles.length > 0 && (
          <span>• {selectedFiles.length} selected</span>
        )}
      </div>

      {/* IMAGE VIEWER — thumbnails + slideshow */}
      {viewerState.open && (
        <ImageViewer
          images={filteredFiles
            .filter(f => f.media_type === 'image')
            .map(f => ({
              id: f.id,
              url: `vault://${f.id}/stream`,
              name: f.original_name,
              size: f.file_size,
              mediaType: f.media_type
            }))}
          initialIndex={viewerState.index}
          onClose={() => setViewerState({ open: false, index: 0 })}
        />
      )}

      {/* FILE PREVIEW — for non-image files */}
      <FilePreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
