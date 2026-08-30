import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { TemplateSelector } from '../templates/TemplateSelector';

interface FuskerInputProps {
  onDownload: (urls: string[], options: any) => void;
}

export const FuskerInput: React.FC<FuskerInputProps> = ({ onDownload }) => {
  const [urls, setUrls] = useState('');
  const [expandedUrls, setExpandedUrls] = useState<string[]>([]);
  const [showExpanded, setShowExpanded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [detectedPatterns, setDetectedPatterns] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [quality, setQuality] = useState('maximum');
  const [options, setOptions] = useState({
    downloadSubtitles: false,
    embedMetadata: true,
    scrubMetadata: true,
    useCookies: false,
    username: '',
    password: '',
    cookieFilePath: '',
  });
  const [isExpanding, setIsExpanding] = useState(false);

  // Detect fusker patterns as user types
  useEffect(() => {
    const lines = urls.split('\n').filter(u => u.trim());
    const patterns: string[] = [];
    for (const line of lines) {
      if (/\[[\d]+-[\d]+\]|\{[\d]+\.\.[\d]+\}/.test(line)) {
        patterns.push(line);
      }
    }
    setDetectedPatterns(patterns);
  }, [urls]);

  const handleExpandPatterns = async () => {
    setIsExpanding(true);
    try {
      const lines = urls.split('\n').filter(u => u.trim());
      const expanded = await window.electronAPI.fusker.expandAll(lines);
      setExpandedUrls(expanded);
      setShowExpanded(true);
    } catch (err) {
      console.error('Failed to expand patterns:', err);
    }
    setIsExpanding(false);
  };

  const handleDownload = () => {
    const urlList = showExpanded ? expandedUrls : urls.split('\n').filter(u => u.trim());
    if (urlList.length === 0) return;

    // Parse Netscape cookie file content into a Cookie header string
    let importedCookieHeader: string | undefined;
    if (options.cookieFilePath) {
      try {
        const lines = options.cookieFilePath.split('\n').filter((l: string) => l.trim() && !l.startsWith('#'));
        const cookies = lines.map((line: string) => {
          const parts = line.split('\t');
          if (parts.length >= 7) {
            return `${parts[5]}=${parts[6]}`;
          }
          return null;
        }).filter(Boolean);
        if (cookies.length > 0) {
          importedCookieHeader = cookies.join('; ');
        }
      } catch {}
    }

    onDownload(urlList, {
      mediaType,
      quality,
      templateId: selectedTemplate?.id,
      ...options,
      username: options.username || undefined,
      password: options.password || undefined,
      cookiesFromBrowser: options.useCookies ? 'chrome' : undefined,
      headers: importedCookieHeader ? { Cookie: importedCookieHeader } : undefined,
    });

    setUrls('');
    setExpandedUrls([]);
    setShowExpanded(false);
  };

  const urlCount = (showExpanded ? expandedUrls : urls.split('\n').filter(u => u.trim())).length;

  return (
    <div className="fusker-input-container">
      {/* URL Input */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📥 Download Media</h2>
          <div className="card-actions">
            <Button variant="ghost" size="sm" onClick={() => setShowTemplates(true)}>
              📋 Templates
            </Button>
            {detectedPatterns.length > 0 && (
              <Button
                variant="warning"
                size="sm"
                onClick={handleExpandPatterns}
                loading={isExpanding}
              >
                🔢 Expand {detectedPatterns.length} pattern(s)
              </Button>
            )}
          </div>
        </div>

        {selectedTemplate && (
          <div className="selected-template-banner">
            <span>📋 Template: {selectedTemplate.name}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>✕</Button>
          </div>
        )}

        <div className="url-input-area">
          <label className="input-label">
            URL(s) — supports fusker patterns like <code>img[001-100].jpg</code>
            <span className="url-count">{urlCount} URLs</span>
          </label>

          <textarea
            className="url-textarea"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={`Enter URLs (one per line)\nhttps://example.com/gallery\nhttps://youtube.com/watch?v=...\n\nFusker patterns:\nhttps://site.com/img[001-100].jpg\nhttps://site.com/photo{1..50}.png`}
            rows={6}
          />

          {detectedPatterns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="pattern-warning"
            >
              ⚠️ Detected {detectedPatterns.length} fusker pattern(s). Click "Expand" to generate all URLs.
            </motion.div>
          )}
        </div>

        {/* Download Options */}
        <div className="download-options">
          <div className="option-group">
            <label className="option-label">Media Type:</label>
            <div className="option-buttons">
              {(['all', 'image', 'video', 'audio'] as const).map(type => (
                <button
                  key={type}
                  className={`option-button ${mediaType === type ? 'active' : ''}`}
                  onClick={() => setMediaType(type)}
                >
                  {type === 'all' ? '● All' : type === 'image' ? '🖼 Images' : type === 'video' ? '🎥 Videos' : '🎵 Audio'}
                </button>
              ))}
            </div>
          </div>

          <div className="option-group">
            <label className="option-label">Quality:</label>
            <div className="option-buttons">
              {(['maximum', '4k', '1080p', '720p'] as const).map(q => (
                <button
                  key={q}
                  className={`option-button ${quality === q ? 'active' : ''}`}
                  onClick={() => setQuality(q)}
                >
                  {q === 'maximum' ? '● Max' : q.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={options.useCookies} onChange={(e) => setOptions({ ...options, useCookies: e.target.checked })} />
              Use cookies from browser (Chrome)
            </label>
            <label className="checkbox-label">
              <input type="file" accept=".txt" style={{ display: 'none' }} id="cookie-file-input" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setOptions({ ...options, cookieFilePath: ev.target?.result as string });
                  };
                  reader.readAsText(file);
                }
              }} />
              <button type="button" className="link-button" onClick={() => document.getElementById('cookie-file-input')?.click()}>
                📄 Import cookies from file (.txt)
              </button>
            </label>
            <label className="checkbox-label">
              🔐 Site requires login?
            </label>
            <div className="auth-inputs" style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                type="text"
                className="input-field"
                placeholder="Username"
                value={options.username}
                onChange={(e) => setOptions({ ...options, username: e.target.value })}
                style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
              />
              <input
                type="password"
                className="input-field"
                placeholder="Password"
                value={options.password}
                onChange={(e) => setOptions({ ...options, password: e.target.value })}
                style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
              />
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={options.scrubMetadata} onChange={(e) => setOptions({ ...options, scrubMetadata: e.target.checked })} />
              Scrub metadata after download
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={options.embedMetadata} onChange={(e) => setOptions({ ...options, embedMetadata: e.target.checked })} />
              Embed metadata in files
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={options.downloadSubtitles} onChange={(e) => setOptions({ ...options, downloadSubtitles: e.target.checked })} />
              Download subtitles
            </label>
          </div>
        </div>

        <div className="download-actions">
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={urlCount === 0}
            icon="⬇"
          >
            Start Download ({urlCount} URLs)
          </Button>
        </div>
      </div>

      {/* Expanded URLs Preview */}
      {showExpanded && expandedUrls.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card expanded-preview"
        >
          <h3 className="card-title">🔢 Expanded URLs ({expandedUrls.length})</h3>
          <div className="expanded-list">
            {expandedUrls.slice(0, 20).map((url, i) => (
              <div key={i} className="expanded-item">{url}</div>
            ))}
            {expandedUrls.length > 20 && (
              <div className="expanded-more">
                ... and {expandedUrls.length - 20} more URLs
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowExpanded(false)}>
            Hide Preview
          </Button>
        </motion.div>
      )}

      {/* Template Selector Modal */}
      {showTemplates && (
        <TemplateSelector
          selectedTemplateId={selectedTemplate?.id}
          onSelect={(t) => { setSelectedTemplate(t); setShowTemplates(false); }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
};
