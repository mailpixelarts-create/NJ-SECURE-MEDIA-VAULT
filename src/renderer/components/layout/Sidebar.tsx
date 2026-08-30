import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore } from '../../store/vaultStore';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPassword, setNewFolderPassword] = useState('');
  const [unlockFolderId, setUnlockFolderId] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  
  const {
    folders,
    files,
    currentFolder,
    setCurrentFolder,
    createFolder,
    unlockFolder,
    lockFolder
  } = useVaultStore();

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(
        newFolderName,
        newFolderPassword || undefined
      );
      setNewFolderName('');
      setNewFolderPassword('');
      setShowNewFolder(false);
    }
  };

  const handleUnlockFolder = async () => {
    if (unlockFolderId && unlockPassword) {
      const success = await unlockFolder(unlockFolderId, unlockPassword);
      if (success) {
        setUnlockFolderId(null);
        setUnlockPassword('');
      }
    }
  };

  const handleLockFolder = async (folderId: string) => {
    await lockFolder(folderId);
  };

  return (
    <>
      <motion.aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
        animate={{ width: isCollapsed ? 60 : 240 }}
        transition={{ duration: 0.3 }}
      >
        <div className="sidebar-header">
          {!isCollapsed && <h3>Folders</h3>}
          <button
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>

        <div className="sidebar-content">
          <div
            className={`folder-item ${!currentFolder ? 'active' : ''}`}
            onClick={() => setCurrentFolder(null)}
          >
            <span className="folder-icon">📁</span>
            {!isCollapsed && (
              <>
                <span className="folder-name">All Files</span>
                <span className="folder-count">{files.length}</span>
              </>
            )}
          </div>

          {folders.map(folder => (
            <div
              key={folder.id}
              className={`folder-item ${currentFolder === folder.id ? 'active' : ''}`}
              onClick={() => {
                if (folder.password_protected) {
                  setUnlockFolderId(folder.id);
                } else {
                  setCurrentFolder(folder.id);
                }
              }}
            >
              <span className="folder-icon">
                {folder.password_protected ? '🔒' : '📁'}
              </span>
              
              {!isCollapsed && (
                <>
                  <span className="folder-name">{folder.name}</span>
                  <div className="folder-actions">
                    {folder.password_protected ? (
                      <button
                        className="folder-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnlockFolderId(folder.id);
                        }}
                        title="Unlock folder"
                      >
                        🔓
                      </button>
                    ) : (
                      <button
                        className="folder-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLockFolder(folder.id);
                        }}
                        title="Lock folder"
                      >
                        🔒
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => setShowNewFolder(true)}
            icon="➕"
          >
            {!isCollapsed && 'New Folder'}
          </Button>
        </div>

        {!isCollapsed && (
          <div className="sidebar-footer">
            <div className="storage-info">
              <div className="storage-label">Storage Used</div>
              <div className="storage-bar">
                <div
                  className="storage-fill"
                  style={{
                    width: `${Math.min(100, (files.reduce((s, f) => s + (f.file_size || 0), 0) / (100 * 1024 * 1024 * 1024)) * 100)}%`
                  }}
                />
              </div>
              <div className="storage-text">
                {formatSize(files.reduce((s, f) => s + (f.file_size || 0), 0))} / 100 GB
              </div>
            </div>
          </div>
        )}
      </motion.aside>

      <Modal
        isOpen={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        title="Create New Folder"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              Create Folder
            </Button>
          </>
        }
      >
        <div className="new-folder-form">
          <Input
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter folder name"
            autoFocus
            required
          />
          
          <Input
            label="Folder Password (Optional)"
            type="password"
            value={newFolderPassword}
            onChange={(e) => setNewFolderPassword(e.target.value)}
            placeholder="Leave empty for no password"
          />
          
          {newFolderPassword && (
            <div className="password-strength">
              <span>Password Strength:</span>
              <div className="strength-meter">
                <div className={`strength-fill strength-${getPasswordStrength(newFolderPassword)}`} />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!unlockFolderId}
        onClose={() => setUnlockFolderId(null)}
        title="Unlock Folder"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnlockFolderId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUnlockFolder}
              disabled={!unlockPassword}
            >
              Unlock
            </Button>
          </>
        }
      >
        <div className="unlock-folder-form">
          <p className="unlock-message">
            This folder is password protected. Enter the folder password to unlock it.
          </p>
          
          <Input
            label="Folder Password"
            type="password"
            value={unlockPassword}
            onChange={(e) => setUnlockPassword(e.target.value)}
            placeholder="Enter folder password"
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
};

function getPasswordStrength(password: string): string {
  if (password.length < 6) return 'weak';
  if (password.length < 10) return 'medium';
  if (password.length < 14) return 'strong';
  return 'very-strong';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}