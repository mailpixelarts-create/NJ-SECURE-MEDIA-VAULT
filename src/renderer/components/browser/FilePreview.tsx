import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Progress } from '../common/Progress';
import { useVaultStore } from '../../store/vaultStore';

interface FilePreviewProps {
  file: any;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  const [showMetadata, setShowMetadata] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [realMetadata, setRealMetadata] = useState<any>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const { selectFile } = useVaultStore();

  // Load real metadata when file changes and metadata tab is opened
  useEffect(() => {
    if (file && showMetadata) {
      loadRealMetadata();
    }
  }, [file, showMetadata]);

  const loadRealMetadata = async () => {
    if (!file) return;
    setIsLoadingMetadata(true);
    try {
      const filePath = await window.electronAPI.vault.getStream(file.id);
      if (filePath) {
        const metadata = await window.electronAPI.metadata.scan(filePath);
        setRealMetadata(metadata);
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
    setIsLoadingMetadata(false);
  };

  if (!file) return null;

  const handleDownload = async () => {
    try {
      const blob = await window.electronAPI.vault.getFile(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleScrubMetadata = async () => {
    setIsScrubbing(true);
    try {
      await window.electronAPI.metadata.scrub(file.id);
      // Reload metadata after scrubbing
      if (showMetadata) {
        await loadRealMetadata();
      }
    } catch (err) {
      console.error('Scrub failed:', err);
    }
    setIsScrubbing(false);
  };

  const handleSecureDelete = () => {
    selectFile(file.id);
    onClose();
  };

  return (
    <Modal
      isOpen={!!file}
      onClose={onClose}
      title={file.original_name}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={handleDownload} icon="⬇">
            Download
          </Button>
          <Button
            variant="warning"
            onClick={handleScrubMetadata}
            loading={isScrubbing}
            icon="🧹"
          >
            {isScrubbing ? 'Scrubbing...' : 'Scrub Metadata'}
          </Button>
          <Button variant="danger" onClick={handleSecureDelete} icon="🗑">
            Delete
          </Button>
        </>
      }
    >
      <div className="file-preview">
        <div className="preview-main">
          {file.media_type === 'image' ? (
            <div className="image-placeholder">🖼</div>
          ) : file.media_type === 'video' ? (
            <div className="video-placeholder">🎥</div>
          ) : (
            <div className="file-placeholder">{file.extension.toUpperCase()}</div>
          )}
        </div>

        <div className="preview-details">
          <div className="detail-row">
            <span className="detail-label">Name:</span>
            <span className="detail-value">{file.original_name}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Size:</span>
            <span className="detail-value">{formatFileSize(file.file_size)}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value">{file.media_type.toUpperCase()}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Format:</span>
            <span className="detail-value">{file.extension.toUpperCase()}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Source:</span>
            <span className="detail-value">{file.source_url || 'Unknown'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Downloaded:</span>
            <span className="detail-value">
              {new Date(file.downloaded_at).toLocaleString()}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Encryption:</span>
            <span className="detail-value">
              <span className="status-badge encrypted">✅ AES-256-GCM</span>
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Metadata:</span>
            <span className="detail-value">
              <button
                className="link-button"
                onClick={() => {
                  setShowMetadata(!showMetadata);
                  if (!showMetadata && !realMetadata) {
                    loadRealMetadata();
                  }
                }}
              >
                {showMetadata ? 'Hide' : 'View'} Metadata
              </button>
            </span>
          </div>

          {showMetadata && (
            <div className="metadata-preview">
              <h4>Metadata</h4>

              {isLoadingMetadata ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading metadata...
                </div>
              ) : realMetadata ? (
                <>
                  {/* GPS */}
                  {realMetadata.gps && (
                    <div className="metadata-item">
                      <span className="metadata-key">GPS Location:</span>
                      <span className="metadata-value">
                        {realMetadata.gps.latitude
                          ? `${realMetadata.gps.latitude}°, ${realMetadata.gps.longitude || ''}`
                          : 'Not present'}
                      </span>
                      <span className={`metadata-status ${realMetadata.gps.latitude ? 'warning' : ''}`}>
                        {realMetadata.gps.latitude ? '⚠️ Present' : '✅ Clean'}
                      </span>
                    </div>
                  )}

                  {/* Camera */}
                  {realMetadata.camera && (
                    <div className="metadata-item">
                      <span className="metadata-key">Camera:</span>
                      <span className="metadata-value">
                        {realMetadata.camera.make && realMetadata.camera.model
                          ? `${realMetadata.camera.make} ${realMetadata.camera.model}`
                          : 'Not present'}
                      </span>
                      <span className={`metadata-status ${realMetadata.camera.make ? 'warning' : ''}`}>
                        {realMetadata.camera.make ? '⚠️ Present' : '✅ Clean'}
                      </span>
                    </div>
                  )}

                  {/* Author */}
                  {realMetadata.author && (
                    <div className="metadata-item">
                      <span className="metadata-key">Author:</span>
                      <span className="metadata-value">
                        {realMetadata.author.name || 'Not present'}
                      </span>
                      <span className={`metadata-status ${realMetadata.author.name ? 'warning' : ''}`}>
                        {realMetadata.author.name ? '⚠️ Present' : '✅ Clean'}
                      </span>
                    </div>
                  )}

                  {/* Dates */}
                  {realMetadata.dates && (
                    <div className="metadata-item">
                      <span className="metadata-key">Date Taken:</span>
                      <span className="metadata-value">
                        {realMetadata.dates.created || 'Not present'}
                      </span>
                      <span className={`metadata-status ${realMetadata.dates.created ? 'warning' : ''}`}>
                        {realMetadata.dates.created ? '⚠️ Present' : '✅ Clean'}
                      </span>
                    </div>
                  )}

                  {/* Software */}
                  {realMetadata.software && (
                    <div className="metadata-item">
                      <span className="metadata-key">Software:</span>
                      <span className="metadata-value">
                        {realMetadata.software.editingSoftware || realMetadata.software.creationSoftware || 'Not present'}
                      </span>
                      <span className={`metadata-status ${(realMetadata.software.editingSoftware || realMetadata.software.creationSoftware) ? 'warning' : ''}`}>
                        {(realMetadata.software.editingSoftware || realMetadata.software.creationSoftware) ? '⚠️ Present' : '✅ Clean'}
                      </span>
                    </div>
                  )}

                  {/* Technical */}
                  {realMetadata.technical && (
                    <div className="metadata-item">
                      <span className="metadata-key">Resolution:</span>
                      <span className="metadata-value">
                        {realMetadata.technical.resolution || 'Unknown'}
                      </span>
                      <span className="metadata-status">ℹ️ Info</span>
                    </div>
                  )}

                  <div className="metadata-item">
                    <span className="metadata-key">File Type:</span>
                    <span className="metadata-value">
                      {realMetadata.fileType || 'Unknown'}
                    </span>
                    <span className="metadata-status">ℹ️ Info</span>
                  </div>
                </>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No metadata available. Click "View Metadata" to scan.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
