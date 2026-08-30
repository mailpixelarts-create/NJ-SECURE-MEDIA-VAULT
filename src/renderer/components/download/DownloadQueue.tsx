import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDownloadStore } from '../../store/downloadStore';
import { Progress } from '../common/Progress';
import { Button } from '../common/Button';

export const DownloadQueue: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const {
    activeDownloads,
    completedDownloads,
    failedDownloads,
    historyDownloads,
    historyLoaded,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    clearCompleted,
    retryDownload
  } = useDownloadStore();

  const hasAnyDownloads = activeDownloads.length > 0 ||
    completedDownloads.length > 0 ||
    failedDownloads.length > 0 ||
    historyDownloads.length > 0;

  if (!hasAnyDownloads) return null;

  const activeItems = [...activeDownloads];
  const historyItems = historyLoaded ? historyDownloads : [...completedDownloads, ...failedDownloads];

  return (
    <div className="download-queue">
      {/* ── Queue Header with Tabs ────────────────── */}
      <div className="queue-header">
        <div className="queue-tabs">
          <button
            className={`queue-tab ${tab === 'active' ? 'active' : ''}`}
            onClick={() => setTab('active')}
          >
            ⬇ Active
            {activeDownloads.length > 0 && (
              <span className="queue-badge">{activeDownloads.length}</span>
            )}
          </button>
          <button
            className={`queue-tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            📋 History
            {historyItems.length > 0 && (
              <span className="queue-badge">{historyItems.length}</span>
            )}
          </button>
        </div>

        <div className="queue-actions">
          {completedDownloads.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => clearCompleted()}>
              Clear Completed
            </Button>
          )}
        </div>
      </div>

      {/* ── Active Downloads ──────────────────────── */}
      {tab === 'active' && (
        <div className="queue-list">
          {activeDownloads.length === 0 ? (
            <div className="queue-empty">
              <span>No active downloads</span>
            </div>
          ) : (
            <AnimatePresence>
              {activeDownloads.map(download => (
                <motion.div
                  key={download.id}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`download-item download-${download.status}`}
                >
                  <div className="download-info">
                    <div className="download-header">
                      <span className="download-icon">
                        {download.status === 'downloading' ? '⬇' :
                         download.status === 'paused' ? '⏸' :
                         download.status === 'pending' ? '⏳' : '⬇'}
                      </span>
                      <span className="download-url" title={download.url}>
                        {download.metadata?.title || download.url}
                      </span>
                      <span className={`download-status status-${download.status}`}>
                        {download.status}
                      </span>
                    </div>

                    {download.status === 'downloading' && (
                      <div className="download-progress">
                        <Progress
                          value={download.progress || 0}
                          showPercentage
                          variant="primary"
                        />
                        <div className="download-speed">
                          {download.speed && <span>{download.speed}</span>}
                          {download.eta && <span>ETA: {download.eta}</span>}
                        </div>
                      </div>
                    )}

                    {download.error && (
                      <div className="download-error">⚠️ {download.error}</div>
                    )}
                  </div>

                  <div className="download-actions">
                    {download.status === 'downloading' && (
                      <Button variant="warning" size="sm" onClick={() => pauseDownload(download.id)}>⏸</Button>
                    )}
                    {download.status === 'paused' && (
                      <Button variant="primary" size="sm" onClick={() => resumeDownload(download.id)}>▶</Button>
                    )}
                    {(download.status === 'downloading' || download.status === 'paused' || download.status === 'pending') && (
                      <Button variant="danger" size="sm" onClick={() => cancelDownload(download.id)}>✕</Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ── Download History (persisted in SQLite) ── */}
      {tab === 'history' && (
        <div className="queue-list">
          {historyItems.length === 0 ? (
            <div className="queue-empty">
              <span>{historyLoaded ? 'No download history' : 'Loading history...'}</span>
            </div>
          ) : (
            <AnimatePresence>
              {historyItems.map(download => (
                <motion.div
                  key={download.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`download-item download-${download.status}`}
                >
                  <div className="download-info">
                    <div className="download-header">
                      <span className="download-icon">
                        {download.status === 'completed' ? '✅' :
                         download.status === 'failed' ? '❌' :
                         download.status === 'cancelled' ? '🚫' :
                         download.status === 'paused' ? '⏸' : '⏳'}
                      </span>
                      <span className="download-url" title={download.url}>
                        {download.metadata?.title || download.url}
                      </span>
                      <span className={`download-status status-${download.status}`}>
                        {download.status}
                      </span>
                    </div>

                    <div className="download-meta-row">
                      {download.metadata?.mediaType && (
                        <span className="download-meta-tag">{download.metadata.mediaType}</span>
                      )}
                      {download.metadata?.fileSize && (
                        <span className="download-meta-tag">{formatSize(download.metadata.fileSize)}</span>
                      )}
                      {download.created_at && (
                        <span className="download-meta-date">
                          {new Date(download.created_at).toLocaleDateString()} {new Date(download.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {download.error && (
                      <div className="download-error">⚠️ {download.error}</div>
                    )}
                  </div>

                  <div className="download-actions">
                    {download.status === 'failed' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => retryDownload(download.id, download.url)}
                      >
                        ↻ Retry
                      </Button>
                    )}
                    {download.status === 'completed' && download.fileId && (
                      <Button variant="ghost" size="sm">📁</Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
