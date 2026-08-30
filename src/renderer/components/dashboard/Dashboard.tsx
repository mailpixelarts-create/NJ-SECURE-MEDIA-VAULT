import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '../layout/Header';
import { Sidebar } from '../layout/Sidebar';
import { FuskerInput } from '../download/FuskerInput';
import { EmbeddedBrowser } from '../browser/EmbeddedBrowser';
import { DownloadQueue } from '../download/DownloadQueue';
import { MediaBrowser } from '../browser/MediaBrowser';
import { SecureDelete } from '../security/SecureDelete';
import { useVaultStore } from '../../store/vaultStore';
import { useDownloadStore } from '../../store/downloadStore';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'download' | 'browser'>('overview');
  const [showSecureDelete, setShowSecureDelete] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const { selectedFiles, files, folders } = useVaultStore();
  const { activeDownloads, completedDownloads, loadHistory, addBulkDownloads } = useDownloadStore();

  // Load download history from SQLite on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const stats = useMemo(() => {
    const images = files.filter(f => f.media_type === 'image').length;
    const videos = files.filter(f => f.media_type === 'video').length;
    const totalSize = files.reduce((sum, f) => sum + (f.file_size || 0), 0);

    const today = new Date().toISOString().split('T')[0];
    const allDownloads = [...activeDownloads, ...completedDownloads];
    const downloadsToday = allDownloads.filter((d: any) => d.created_at?.startsWith(today)).length;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const downloadsWeek = allDownloads.filter((d: any) => d.created_at > weekAgo).length;

    return {
      images,
      videos,
      folders: folders.length,
      totalSize: formatSize(totalSize),
      totalSizeBytes: totalSize,
      downloadsToday,
      downloadsWeek,
      totalFiles: files.length
    };
  }, [files, folders, activeDownloads, completedDownloads]);

  const handleFolderClick = (type: 'image' | 'video' | 'folder') => {
    setActiveTab('browser');
    // We can't directly set MediaBrowser state from here, but we can set the store
    if (type === 'image') {
      // In a real app, we might set a filter in the store
      // For now, we just switch tabs to show the browser
    }
  };

  return (
    <div className="dashboard">
      <Header />
      
      <div className="dashboard-body">
        <Sidebar />
        
        <main className="dashboard-content">
          <div className="dashboard-tabs">
            <button
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              🏠 Overview
            </button>
            <button
              className={`tab ${activeTab === 'download' ? 'active' : ''}`}
              onClick={() => setActiveTab('download')}
            >
              ⬇ Download
            </button>
            <button
              className={`tab ${activeTab === 'browser' ? 'active' : ''}`}
              onClick={() => setActiveTab('browser')}
            >
              📁 Vault Browser
            </button>
          </div>
          
          {selectedFiles.length > 0 && (
            <div className="selection-bar">
              <span>{selectedFiles.length} items selected</span>
              <button
                className="selection-action danger"
                onClick={() => setShowSecureDelete(true)}
              >
                🗑 Secure Delete
              </button>
            </div>
          )}
          
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="dashboard-overview"
            >
              <div className="folder-grid">
                <FolderCard
                  icon="🖼"
                  name="Images"
                  count={stats.images}
                  size={formatSize(files.filter(f => f.media_type === 'image').reduce((s, f) => s + (f.file_size || 0), 0))}
                  onClick={() => handleFolderClick('image')}
                />
                <FolderCard
                  icon="🎬"
                  name="Videos"
                  count={stats.videos}
                  size={formatSize(files.filter(f => f.media_type === 'video').reduce((s, f) => s + (f.file_size || 0), 0))}
                  onClick={() => handleFolderClick('video')}
                />
                <FolderCard
                  icon="📁"
                  name="Folders"
                  count={stats.folders}
                  size=""
                  onClick={() => handleFolderClick('folder')}
                />
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">💾</span>
                    <span className="stat-title">Total Files</span>
                  </div>
                  <div className="stat-value-large">{stats.totalFiles}</div>
                  <div className="stat-detail">{stats.totalSize} encrypted</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">⬇</span>
                    <span className="stat-title">Downloads Today</span>
                  </div>
                  <div className="stat-value-large">{stats.downloadsToday}</div>
                  <div className="stat-detail">files downloaded</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">📅</span>
                    <span className="stat-title">This Week</span>
                  </div>
                  <div className="stat-value-large">{stats.downloadsWeek}</div>
                  <div className="stat-detail">total downloads</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-icon">🔐</span>
                    <span className="stat-title">Encrypted Files</span>
                  </div>
                  <div className="stat-value-large">{stats.totalFiles}</div>
                  <div className="stat-detail">100% encrypted</div>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'download' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <FuskerInput onDownload={async (urls, opts) => { await addBulkDownloads(urls, opts); }} />
              <DownloadQueue />
            </motion.div>
          )}
          
          {activeTab === 'browser' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <MediaBrowser />
            </motion.div>
          )}
        </main>
      </div>


      {showBrowser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ height: '100%' }}
        >
          <EmbeddedBrowser
            onDownloadImages={async (urls) => { await addBulkDownloads(urls, { mediaType: 'image' }); }}
          />
        </motion.div>
      )}

      <SecureDelete
        isOpen={showSecureDelete}
        onClose={() => setShowSecureDelete(false)}
        files={selectedFiles}
      />
    </div>
  );
};

const FolderCard: React.FC<{
  icon: string;
  name: string;
  count: number;
  size: string;
  onClick: () => void;
}> = ({ icon, name, count, size, onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="folder-card"
    onClick={onClick}
  >
    <div className="folder-icon">{icon}</div>
    <div className="folder-info">
      <h3>{name}</h3>
      <p>{count} files</p>
      {size && <span>{size}</span>}
    </div>
  </motion.div>
);

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
