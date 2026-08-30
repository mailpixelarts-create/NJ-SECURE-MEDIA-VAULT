import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '../layout/Header';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { useAuthStore } from '../../store/authStore';

interface SettingsSection {
  id: string;
  label: string;
  icon: string;
}

export const SettingsPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState('security');
  const [isSaving, setIsSaving] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [securitySettings, setSecuritySettings] = useState({
    masterPassword: '••••••••',
    twoFactorAuth: false,
    hardwareKey: false,
    autoLockTimeout: 5,
    failedAttempts: 5,
    panicMode: false,
    panicPassword: '',
    deleteOnTamper: false,
    logSecurityEvents: true,
    encryptMetadata: true,
    hideVaultLocation: true
  });

  const [downloadSettings, setDownloadSettings] = useState({
    defaultQuality: 'maximum',
    defaultFormat: 'mp4',
    concurrentDownloads: 30,
    speedLimit: 'unlimited',
    retryAttempts: 10,
    downloadSubtitles: false,
    embedMetadata: true,
    downloadThumbnail: true,
    downloadPlaylists: false,
    captchaProvider: '2captcha',
    captchaApiKey: '',
  });

  const [metadataSettings, setMetadataSettings] = useState({
    mode: 'ask_every_time',
    removeGPS: true,
    removeCameraInfo: true,
    removeAuthor: true,
    removeDates: false,
    removeSoftware: false,
    createBackup: false,
    backupEncrypted: true,
    autoDeleteBackup: '30_days'
  });

  const [deletionSettings, setDeletionSettings] = useState({
    defaultMethod: 'ultra',
    verifyAfterDelete: true,
    cleanNTFSJournal: true,
    wipeFreeSpace: false,
    useSSDTrim: false
  });

  // Load settings from DB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [sec, dl, meta, del] = await Promise.all([
          window.electronAPI.settings.get('security'),
          window.electronAPI.settings.get('download'),
          window.electronAPI.settings.get('metadata'),
          window.electronAPI.settings.get('deletion')
        ]);

        if (sec) setSecuritySettings(prev => ({ ...prev, ...sec }));
        if (dl) setDownloadSettings(prev => ({ ...prev, ...dl }));
        if (meta) setMetadataSettings(prev => ({ ...prev, ...meta }));
        if (del) setDeletionSettings(prev => ({ ...prev, ...del }));
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, []);

  const sections: SettingsSection[] = [
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'download', label: 'Downloads', icon: '⬇' },
    { id: 'metadata', label: 'Metadata', icon: '🧹' },
    { id: 'deletion', label: 'Deletion', icon: '🗑' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'advanced', label: 'Advanced', icon: '📊' }
  ];

  const handleSave = async () => {
    setIsSaving(true);

    // Save all settings to electron-store
    await window.electronAPI.settings.set('security', securitySettings);
    await window.electronAPI.settings.set('download', downloadSettings);
    await window.electronAPI.settings.set('metadata', metadataSettings);
    await window.electronAPI.settings.set('deletion', deletionSettings);

    // Configure CAPTCHA solver if API key is provided
    if (downloadSettings.captchaApiKey) {
      try {
        await window.electronAPI.captcha.configure({
          provider: downloadSettings.captchaProvider,
          apiKey: downloadSettings.captchaApiKey
        });
      } catch (err) {
        console.error('Failed to configure CAPTCHA solver:', err);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const handleGenerateRecoveryPhrase = async () => {
    const phrase = await window.electronAPI.recovery.generatePhrase();
    setRecoveryPhrase(phrase);
    setShowRecoveryPhrase(true);
  };

  return (
    <div className="settings-page">
      <Header />

      <div className="settings-layout">
        <div className="settings-sidebar">
          {sections.map(section => (
            <button
              key={section.id}
              className={`settings-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="settings-nav-icon">{section.icon}</span>
              <span className="settings-nav-label">{section.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {activeSection === 'security' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="settings-section"
            >
              <h2 className="settings-title">🔒 Security Settings</h2>

              <div className="settings-card">
                <h3 className="settings-card-title">Authentication</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Master Password</div>
                    <div className="setting-description">
                      Your master password is protected with Argon2id
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowChangePassword(true)}
                  >
                    Change
                  </Button>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Recovery Phrase</div>
                    <div className="setting-description">
                      Generate a 24-word recovery phrase for password recovery
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateRecoveryPhrase}
                  >
                    Generate
                  </Button>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Two-Factor Authentication</div>
                    <div className="setting-description">
                      Add an extra layer of security with TOTP
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={securitySettings.twoFactorAuth}
                      onChange={(e) => setSecuritySettings({
                        ...securitySettings,
                        twoFactorAuth: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Hardware Key</div>
                    <div className="setting-description">
                      Use YubiKey for hardware-based authentication
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Register
                  </Button>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Auto-Lock</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Auto-Lock Timeout</div>
                    <div className="setting-description">
                      Automatically lock vault after inactivity
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={securitySettings.autoLockTimeout}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      autoLockTimeout: parseInt(e.target.value)
                    })}
                  >
                    <option value={1}>1 minute</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Failed Attempts Before Lock</div>
                    <div className="setting-description">
                      Number of failed attempts before temporary lockout
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={securitySettings.failedAttempts}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      failedAttempts: parseInt(e.target.value)
                    })}
                  >
                    <option value={3}>3 attempts</option>
                    <option value={5}>5 attempts</option>
                    <option value={10}>10 attempts</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Panic Mode</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Enable Panic Mode</div>
                    <div className="setting-description">
                      Special password that triggers emergency actions
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={securitySettings.panicMode}
                      onChange={(e) => setSecuritySettings({
                        ...securitySettings,
                        panicMode: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {securitySettings.panicMode && (
                  <div className="setting-item">
                    <div className="setting-info">
                      <div className="setting-label">Panic Password</div>
                      <div className="setting-description">
                        This password will trigger secure deletion
                      </div>
                    </div>
                    <Input
                      type="password"
                      value={securitySettings.panicPassword}
                      onChange={(e) => setSecuritySettings({
                        ...securitySettings,
                        panicPassword: e.target.value
                      })}
                      placeholder="Set panic password"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeSection === 'download' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="settings-section"
            >
              <h2 className="settings-title">⬇ Download Settings</h2>

              <div className="settings-card">
                <h3 className="settings-card-title">Quality & Format</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Default Quality</div>
                    <div className="setting-description">
                      Preferred video quality for downloads
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={downloadSettings.defaultQuality}
                    onChange={(e) => setDownloadSettings({
                      ...downloadSettings,
                      defaultQuality: e.target.value
                    })}
                  >
                    <option value="maximum">Maximum Available</option>
                    <option value="8k">8K</option>
                    <option value="4k">4K</option>
                    <option value="1440p">1440p</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                  </select>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Default Format</div>
                    <div className="setting-description">
                      Preferred video format
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={downloadSettings.defaultFormat}
                    onChange={(e) => setDownloadSettings({
                      ...downloadSettings,
                      defaultFormat: e.target.value
                    })}
                  >
                    <option value="mp4">MP4</option>
                    <option value="mkv">MKV</option>
                    <option value="webm">WebM</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Network</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Concurrent Downloads</div>
                    <div className="setting-description">
                      Number of simultaneous downloads
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={downloadSettings.concurrentDownloads}
                    onChange={(e) => setDownloadSettings({
                      ...downloadSettings,
                      concurrentDownloads: parseInt(e.target.value)
                    })}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={30}>30 (Maximum)</option>
                  </select>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Speed Limit</div>
                    <div className="setting-description">
                      Maximum download speed
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={downloadSettings.speedLimit}
                    onChange={(e) => setDownloadSettings({
                      ...downloadSettings,
                      speedLimit: e.target.value
                    })}
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="1mb">1 MB/s</option>
                    <option value="5mb">5 MB/s</option>
                    <option value="10mb">10 MB/s</option>
                    <option value="50mb">50 MB/s</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">CAPTCHA Solving</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">CAPTCHA Provider</div>
                    <div className="setting-description">
                      Auto-solve CAPTCHAs on protected sites
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={downloadSettings.captchaProvider}
                    onChange={(e) => setDownloadSettings({
                      ...downloadSettings,
                      captchaProvider: e.target.value
                    })}
                  >
                    <option value="2captcha">2captcha</option>
                    <option value="anticaptcha">Anti-Captcha</option>
                    <option value="capmonster">CapMonster</option>
                  </select>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">API Key</div>
                    <div className="setting-description">
                      Your CAPTCHA solving service API key
                    </div>
                  </div>
                  <Input
                    type="password"
                    value={downloadSettings.captchaApiKey}
                    onChange={(e) => setDownloadSettings({
                      ...downloadSettings,
                      captchaApiKey: e.target.value
                    })}
                    placeholder="Enter API key"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'metadata' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="settings-section"
            >
              <h2 className="settings-title">🧹 Metadata Settings</h2>

              <div className="settings-card">
                <h3 className="settings-card-title">Scrubbing Mode</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Default Mode</div>
                    <div className="setting-description">
                      How to handle metadata in downloaded files
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={metadataSettings.mode}
                    onChange={(e) => setMetadataSettings({
                      ...metadataSettings,
                      mode: e.target.value
                    })}
                  >
                    <option value="ask_every_time">Ask every time</option>
                    <option value="always_scrub">Always scrub</option>
                    <option value="never_scrub">Never scrub</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Remove Metadata</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">GPS Location</div>
                    <div className="setting-description">
                      Remove GPS coordinates from images
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={metadataSettings.removeGPS}
                      onChange={(e) => setMetadataSettings({
                        ...metadataSettings,
                        removeGPS: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Camera Information</div>
                    <div className="setting-description">
                      Remove camera make, model, and serial number
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={metadataSettings.removeCameraInfo}
                      onChange={(e) => setMetadataSettings({
                        ...metadataSettings,
                        removeCameraInfo: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Author Information</div>
                    <div className="setting-description">
                      Remove author and creator names
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={metadataSettings.removeAuthor}
                      onChange={(e) => setMetadataSettings({
                        ...metadataSettings,
                        removeAuthor: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'deletion' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="settings-section"
            >
              <h2 className="settings-title">🗑 Deletion Settings</h2>

              <div className="settings-card">
                <h3 className="settings-card-title">Secure Deletion</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Default Method</div>
                    <div className="setting-description">
                      Default secure deletion method
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={deletionSettings.defaultMethod}
                    onChange={(e) => setDeletionSettings({
                      ...deletionSettings,
                      defaultMethod: e.target.value
                    })}
                  >
                    <option value="ultra">Ultra-Secure (35-pass)</option>
                    <option value="maximum">Maximum (35+ passes + wipe)</option>
                    <option value="standard">Standard (3-pass DoD)</option>
                    <option value="quick">Quick (1-pass)</option>
                  </select>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Verify After Delete</div>
                    <div className="setting-description">
                      Verify files are unrecoverable after deletion
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={deletionSettings.verifyAfterDelete}
                      onChange={(e) => setDeletionSettings({
                        ...deletionSettings,
                        verifyAfterDelete: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Clean NTFS Journal</div>
                    <div className="setting-description">
                      Remove file references from NTFS journal
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={deletionSettings.cleanNTFSJournal}
                      onChange={(e) => setDeletionSettings({
                        ...deletionSettings,
                        cleanNTFSJournal: e.target.checked
                      })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'appearance' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="settings-section"
            >
              <h2 className="settings-title">🎨 Appearance Settings</h2>

              <div className="settings-card">
                <h3 className="settings-card-title">Theme</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Dark Mode</div>
                    <div className="setting-description">
                      Use dark theme for the application
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Accent Color</div>
                    <div className="setting-description">
                      Choose your preferred accent color
                    </div>
                  </div>
                  <select className="settings-select" defaultValue="purple">
                    <option value="purple">Purple</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                    <option value="orange">Orange</option>
                  </select>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Display</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">File View</div>
                    <div className="setting-description">
                      Default file browser view
                    </div>
                  </div>
                  <select className="settings-select" defaultValue="grid">
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                  </select>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Show File Extensions</div>
                    <div className="setting-description">
                      Display file extensions in browser
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === 'advanced' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="settings-section"
            >
              <h2 className="settings-title">📊 Advanced Settings</h2>

              <div className="settings-card">
                <h3 className="settings-card-title">Storage</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Vault Location</div>
                    <div className="setting-description">
                      Where encrypted files are stored
                    </div>
                  </div>
                  <span className="setting-value">~/.secure-media-vault/vault</span>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Clear Cache</div>
                    <div className="setting-description">
                      Remove temporary files and thumbnails
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Clear</Button>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Database Backup</div>
                    <div className="setting-description">
                      Create a backup of your vault database
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Backup Now</Button>
                </div>
              </div>

              <div className="settings-card">
                <h3 className="settings-card-title">Logging</h3>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Enable Logging</div>
                    <div className="setting-description">
                      Log application activity for debugging
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">Export Logs</div>
                    <div className="setting-description">
                      Download application logs
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Export</Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="settings-footer">
        <Button variant="ghost" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Modal
        isOpen={showRecoveryPhrase}
        onClose={() => setShowRecoveryPhrase(false)}
        title="🔑 Your Recovery Phrase"
        size="md"
        footer={
          <Button variant="primary" onClick={() => setShowRecoveryPhrase(false)}>
            I've Saved It
          </Button>
        }
      >
        <div className="recovery-phrase-display">
          <div className="warning-box">
            <p className="warning-text">
              ⚠️ Write down this recovery phrase and store it in a safe place.
              You will need it to recover your vault if you forget your password.
            </p>
          </div>

          <div className="phrase-grid">
            {recoveryPhrase.split(' ').map((word, index) => (
              <div key={index} className="phrase-word">
                <span className="word-number">{index + 1}</span>
                <span className="word-text">{word}</span>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            fullWidth
            icon="📋"
            onClick={() => navigator.clipboard.writeText(recoveryPhrase)}
          >
            Copy to Clipboard
          </Button>
        </div>
      </Modal>
    </div>
  );
};
