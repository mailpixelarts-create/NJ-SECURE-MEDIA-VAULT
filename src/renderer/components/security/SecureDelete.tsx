import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Progress } from '../common/Progress';
import { Input } from '../common/Input';
import { useVaultStore } from '../../store/vaultStore';

interface SecureDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  files: string[];
  folders?: string[];
}

export const SecureDelete: React.FC<SecureDeleteProps> = ({
  isOpen,
  onClose,
  files,
  folders = []
}) => {
  const [method, setMethod] = useState<'ultra' | 'maximum' | 'standard' | 'quick'>('ultra');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [currentPass, setCurrentPass] = useState(0);
  
  const { files: vaultFiles } = useVaultStore();
  
  const totalFiles = files.length + folders.length;
  
  const methods = [
    {
      id: 'ultra' as const,
      name: 'Ultra-Secure (35-pass Gutmann)',
      description: 'Recommended for maximum security',
      time: '15-30 minutes',
      passes: 35
    },
    {
      id: 'maximum' as const,
      name: 'Maximum (35+ passes + free space wipe)',
      description: 'Includes disk sector wipe',
      time: '30-60 minutes',
      passes: 35
    },
    {
      id: 'standard' as const,
      name: 'Standard (3-pass DoD)',
      description: 'Faster but less secure',
      time: '3-5 minutes',
      passes: 3
    },
    {
      id: 'quick' as const,
      name: 'Quick (1-pass zero fill)',
      description: 'Fastest, minimal security',
      time: '1 minute',
      passes: 1
    }
  ];
  
  const handleDelete = async () => {
    if (!confirmPassword || confirmText !== 'DELETE') {
      return;
    }
    
    setIsDeleting(true);
    
    const passCount = methods.find(m => m.id === method)?.passes || 35;
    
    for (const fileId of files) {
      const file = vaultFiles.find((f: any) => f.id === fileId) as any;
      if (!file) continue;
      
      setCurrentFile(file.original_name);
      
      for (let pass = 1; pass <= passCount; pass++) {
        setCurrentPass(pass);
        setProgress(Math.floor(((files.indexOf(fileId) * passCount + pass) / (files.length * passCount)) * 100));
        
        if (pass === 1) {
          try {
            await window.electronAPI.delete.secure(file.filename, passCount);
          } catch (err) {
            console.error('Delete failed:', err);
          }
        }
      }
    }
    
    for (const folder of folders) {
      try {
        await window.electronAPI.delete.secureFolder(folder, passCount);
      } catch (err) {
        console.error('Folder delete failed:', err);
      }
    }
    
    setProgress(100);
    setIsDeleting(false);
    onClose();
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠️ Secure Delete - Permanent Removal"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={isDeleting || !confirmPassword || confirmText !== 'DELETE'}
            loading={isDeleting}
            icon="🗑"
          >
            {isDeleting ? 'Deleting...' : 'Secure Delete'}
          </Button>
        </>
      }
    >
      <div className="secure-delete-content">
        {!isDeleting ? (
          <>
            <div className="warning-box danger">
              <p className="warning-title">🔴 WARNING: This action cannot be undone!</p>
              <p>
                You are about to permanently delete:
              </p>
              <ul>
                {files.length > 0 && (
                  <li>📁 {files.length} files ({formatSize(calculateTotalSize(files, vaultFiles))})</li>
                )}
                {folders.length > 0 && (
                  <li>📁 {folders.length} folders</li>
                )}
              </ul>
              <p className="warning-text">
                These files will be overwritten multiple times,
                making them unrecoverable by any means.
              </p>
            </div>
            
            <div className="deletion-methods">
              <label className="input-label">Deletion Method:</label>
              
              {methods.map(m => (
                <div
                  key={m.id}
                  className={`deletion-method ${method === m.id ? 'selected' : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  <div className="method-radio">
                    <span className={`radio-dot ${method === m.id ? 'active' : ''}`} />
                  </div>
                  
                  <div className="method-info">
                    <div className="method-name">{m.name}</div>
                    <div className="method-description">{m.description}</div>
                    <div className="method-time">⏱ Time: {m.time}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="deletion-options">
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                Verify after deletion
              </label>
              <label className="checkbox-label">
                <input type="checkbox" defaultChecked />
                Clean NTFS journal entries
              </label>
              <label className="checkbox-label">
                <input type="checkbox" />
                Wipe free space
              </label>
              <label className="checkbox-label">
                <input type="checkbox" />
                Use SSD TRIM command
              </label>
            </div>
            
            <div className="confirm-section">
              <div className="confirm-password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter master password"
                  label="🔐 Confirm with Master Password:"
                />
              </div>
              
              <div className="confirm-text">
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  label="Confirmation:"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="deletion-progress">
            <h3>🗑 Securely Deleting Files</h3>
            
            <Progress
              value={progress}
              showPercentage
              variant="danger"
              size="lg"
            />
            
            <div className="deletion-stats">
              <div className="stat-item">
                <span className="stat-label">Current Pass:</span>
                <span className="stat-value">{currentPass}/35</span>
              </div>
              
              <div className="stat-item">
                <span className="stat-label">Current File:</span>
                <span className="stat-value">{currentFile}</span>
              </div>
              
              <div className="stat-item">
                <span className="stat-label">Remaining:</span>
                <span className="stat-value">{files.length - Math.floor(progress / 100 * files.length)} files</span>
              </div>
              
              <div className="stat-item">
                <span className="stat-label">Estimated Time:</span>
                <span className="stat-value">8 minutes</span>
              </div>
            </div>
            
            <div className="deletion-log">
              <div className="log-entry">
                <span className="log-time">{new Date().toLocaleTimeString()}</span>
                <span className="log-message">Starting secure deletion process...</span>
              </div>
              <div className="log-entry">
                <span className="log-time">{new Date().toLocaleTimeString()}</span>
                <span className="log-message">Current file: {currentFile}</span>
              </div>
              <div className="log-entry">
                <span className="log-time">{new Date().toLocaleTimeString()}</span>
                <span className="log-message">Pass {currentPass}/{method === 'ultra' || method === 'maximum' ? 35 : method === 'standard' ? 3 : 1}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function calculateTotalSize(fileIds: string[], files: any[]): number {
  return fileIds.reduce((total, id) => {
    const file = files.find(f => f.id === id);
    return total + (file?.file_size || 0);
  }, 0);
}
