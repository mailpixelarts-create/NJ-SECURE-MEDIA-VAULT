import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useDownloadStore } from '../../store/downloadStore';

export const URLInput: React.FC = () => {
  const [urls, setUrls] = useState('');
  const [mediaType, setMediaType] = useState<'all' | 'image' | 'video'>('all');
  const [quality, setQuality] = useState<'maximum' | '4k' | '1080p' | '720p'>('maximum');
  const [options, setOptions] = useState({
    downloadPlaylist: true,
    useCookies: true,
    scrubMetadata: true,
    downloadSubtitles: false
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [destination, setDestination] = useState('/Vault/Downloads/2026-08-26');
  
  const { addBulkDownloads } = useDownloadStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    const clipboardText = await navigator.clipboard.readText();
    setUrls(prev => prev ? `${prev}\n${clipboardText}` : clipboardText);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setUrls(prev => prev ? `${prev}\n${content}` : content);
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    try {
      const urlList = urls.split('\n').filter(url => url.trim());
      const results = await window.electronAPI.download.analyze(urlList);
      setAnalysisResults(results);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysisResults(null);
    }
    
    setIsAnalyzing(false);
  };

  const handleDownload = async () => {
    const urlList = urls.split('\n').filter(url => url.trim());
    
    await addBulkDownloads(urlList, {
      mediaType,
      quality,
      ...options,
      destination
    });
    
    setUrls('');
    setAnalysisResults(null);
  };

  const urlCount = urls.split('\n').filter(url => url.trim()).length;

  return (
    <div className="url-input-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h2 className="card-title">📥 Download Media</h2>
        
        <div className="url-input-area">
          <label className="input-label">
            URL(s)
            <span className="url-count">{urlCount} URLs</span>
          </label>
          
          <textarea
            className="url-textarea"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={'Enter URLs (one per line)\nhttps://example.com/gallery\nhttps://youtube.com/watch?v=...\nhttps://twitter.com/user/status/...'}
            rows={5}
          />
          
          <div className="url-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              icon="📋"
            >
              Paste from Clipboard
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon="📁"
            >
              Import List
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.json"
              style={{ display: 'none' }}
              onChange={handleFileImport}
            />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUrls('')}
              icon="🗑"
            >
              Clear
            </Button>
          </div>
        </div>
        
        <div className="download-options">
          <div className="option-group">
            <label className="option-label">Media Type:</label>
            <div className="option-buttons">
              {(['all', 'image', 'video'] as const).map(type => (
                <button
                  key={type}
                  className={`option-button ${mediaType === type ? 'active' : ''}`}
                  onClick={() => setMediaType(type)}
                >
                  {type === 'all' ? '● All' : type === 'image' ? '○ Images' : '○ Videos'}
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
                  {q === 'maximum' ? '● Maximum' : q === '4k' ? '○ 4K' : q === '1080p' ? '○ 1080p' : '○ 720p'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="option-group">
            <label className="option-label">Options:</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.downloadPlaylist}
                  onChange={(e) => setOptions({ ...options, downloadPlaylist: e.target.checked })}
                />
                Download entire playlist when available
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.useCookies}
                  onChange={(e) => setOptions({ ...options, useCookies: e.target.checked })}
                />
                Use cookies from browser (Chrome)
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.scrubMetadata}
                  onChange={(e) => setOptions({ ...options, scrubMetadata: e.target.checked })}
                />
                Scrub metadata after download (ask first)
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.downloadSubtitles}
                  onChange={(e) => setOptions({ ...options, downloadSubtitles: e.target.checked })}
                />
                Download subtitles
              </label>
            </div>
          </div>
          
          <div className="option-group">
            <label className="option-label">Destination:</label>
            <div className="destination-input">
              <span className="destination-icon">📁</span>
              <input
                className="input-field"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="/Vault/Downloads"
              />
              <Button variant="ghost" size="sm" icon="📂">
                Browse
              </Button>
            </div>
          </div>
        </div>
        
        <div className="download-actions">
          <Button
            variant="secondary"
            onClick={handleAnalyze}
            disabled={!urls.trim() || isAnalyzing}
            loading={isAnalyzing}
            icon="🔍"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Only'}
          </Button>
          
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={!urls.trim()}
            icon="⬇"
          >
            Start Download
          </Button>
        </div>
      </motion.div>
      
      {analysisResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card analysis-results"
        >
          <h3 className="card-title">📊 Analysis Results</h3>
          
          <div className="analysis-stats">
            <div className="stat-item">
              <span className="stat-label">Images:</span>
              <span className="stat-value">{analysisResults.images} files</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Videos:</span>
              <span className="stat-value">{analysisResults.videos} files</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Size:</span>
              <span className="stat-value">{analysisResults.totalSize}</span>
            </div>
          </div>
          
          <div className="analysis-preview">
            {analysisResults.imageSizes.map((size: string, index: number) => (
              <div key={`img-${index}`} className="preview-thumbnail image">
                <span className="thumbnail-type">IMG</span>
                <span className="thumbnail-quality">{size}</span>
              </div>
            ))}
            {analysisResults.videoQualities.map((quality: string, index: number) => (
              <div key={`vid-${index}`} className="preview-thumbnail video">
                <span className="thumbnail-type">VID</span>
                <span className="thumbnail-quality">{quality}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};