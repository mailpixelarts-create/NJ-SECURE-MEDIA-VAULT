import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface ExtractedImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  isLazy: boolean;
}

interface EmbeddedBrowserProps {
  onDownloadImages?: (urls: string[]) => void;
}

export const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({
  onDownloadImages
}) => {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [galleryInfo, setGalleryInfo] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Create initial tab
  useEffect(() => {
    handleNewTab();
  }, []);

  const handleNewTab = async (url?: string) => {
    try {
      // If we already have too many tabs, don't open more (optional limit)
      if (tabs.length >= 10) return;
      
      const page = await window.electronAPI.browser.createPage(url);
      setTabs(prev => [...prev, page]);
      setActiveTabId(page.id);
      if (url) setAddressInput(url);
    } catch (err) {
      console.error('Failed to create tab:', err);
    }
  };

  const handleCloseTab = async (id: string) => {
    try {
      await window.electronAPI.browser.closePage(id);
      setTabs(prev => {
        const filtered = prev.filter(t => t.id !== id);
        if (activeTabId === id) {
          setActiveTabId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
        }
        return filtered;
      });
    } catch (err) {
      console.error('Failed to close tab:', err);
    }
  };

  const handleNavigate = async (url?: string) => {
    const targetUrl = url || addressInput;
    if (!targetUrl || !activeTabId) return;

    try {
      const page = await window.electronAPI.browser.navigate(activeTabId, targetUrl);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...page } : t));
      setAddressInput(page.url);
      setImages([]);
      setSelectedImages(new Set());
      setGalleryInfo(null);
    } catch (err) {
      console.error('Failed to navigate:', err);
    }
  };

  const handleBack = async () => {
    if (!activeTabId) return;
    try {
      const page = await window.electronAPI.browser.goBack(activeTabId);
      if (page) {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...page } : t));
        setAddressInput(page.url);
      }
    } catch (err) {
      console.error('Failed to go back:', err);
    }
  };

  const handleForward = async () => {
    if (!activeTabId) return;
    try {
      const page = await window.electronAPI.browser.goForward(activeTabId);
      if (page) {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...page } : t));
        setAddressInput(page.url);
      }
    } catch (err) {
      console.error('Failed to go forward:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const handleExtractImages = async () => {
    if (!activeTab?.url || activeTab.url === 'about:blank') return;
    setIsExtracting(true);
    try {
      const extracted = await window.electronAPI.browser.extractImages(activeTab.url);
      setImages(extracted);
      setShowImagePanel(true);

      // Also detect gallery
      const gallery = await window.electronAPI.browser.detectGallery(activeTab.url);
      setGalleryInfo(gallery);
    } catch (err) {
      console.error('Failed to extract images:', err);
    }
    setIsExtracting(false);
  };

  const toggleImageSelection = (src: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  const selectAllImages = () => {
    setSelectedImages(new Set(images.map(img => img.src)));
  };

  const handleDownloadSelected = () => {
    if (selectedImages.size === 0 || !onDownloadImages) return;
    onDownloadImages(Array.from(selectedImages));
    setSelectedImages(new Set());
  };

  const formatSize = (w: number, h: number) => {
    if (!w || !h) return '';
    return `${w}×${h}`;
  };

  return (
    <div className="embedded-browser">
      {/* Tab Bar */}
      <div className="browser-tab-bar">
        <div className="browser-tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`browser-tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => { setActiveTabId(tab.id); setAddressInput(tab.url); }}
            >
              <span className="tab-title">
                {tab.isLoading ? '⏳' : '🌐'} {tab.title || 'New Tab'}
              </span>
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="tab-new" onClick={() => handleNewTab()}>+</button>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="browser-nav-bar">
        <div className="browser-nav-buttons">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={!activeTab?.canGoBack}
          >
            ◀
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForward}
            disabled={!activeTab?.canGoForward}
          >
            ▶
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigate(activeTab?.url)}
            disabled={!activeTab}
          >
            🔄
          </Button>
        </div>

        <div className="browser-address-bar">
          <input
            className="browser-address-input"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter URL and press Enter..."
          />
          <Button variant="primary" size="sm" onClick={() => handleNavigate()}>
            Go
          </Button>
        </div>

        <div className="browser-action-buttons">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExtractImages}
            loading={isExtracting}
            disabled={!activeTab || activeTab.url === 'about:blank'}
          >
            🖼 Extract Images
          </Button>
          {images.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImagePanel(s => !s)}
            >
              {showImagePanel ? 'Hide' : `Show`} ({images.length})
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="browser-content">
        {!activeTab || activeTab.url === 'about:blank' ? (
          <div className="browser-home">
            <div className="browser-home-content">
              <h2>🔒 Secure Media Vault Browser</h2>
              <p>Navigate to any website to browse and download media</p>
              <div className="browser-home-links">
                <Button variant="ghost" onClick={() => handleNavigate('https://www.instagram.com')}>
                  📷 Instagram
                </Button>
                <Button variant="ghost" onClick={() => handleNavigate('https://www.twitter.com')}>
                  🐦 Twitter
                </Button>
                <Button variant="ghost" onClick={() => handleNavigate('https://www.reddit.com')}>
                  📱 Reddit
                </Button>
                <Button variant="ghost" onClick={() => handleNavigate('https://www.pinterest.com')}>
                  📌 Pinterest
                </Button>
                <Button variant="ghost" onClick={() => handleNavigate('https://www.tumblr.com')}>
                  📝 Tumblr
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="browser-page-view" style={{ position: 'relative', flex: 1 }}>
            {/* Actual rendered page via webview for visual browsing */}
            <webview
              src={activeTab.url}
              style={{ width: '100%', height: '100%', border: 'none' }} 
              partition="persist:browser"
              allowpopups
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              ref={(ref) => {
                if (ref) {
                  ref.addEventListener('new-window', (e: any) => {
                    const url = e.url;
                    if (url) handleNavigate(url);
                  });
                }
              }}
              did-navigate-in-page={(e: any) => {
                if (activeTabId && e.url) {
                  setAddressInput(e.url);
                  setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url: e.url } : t));
                }
              }}
              did-navigate={(e: any) => {
                const url = typeof e === 'string' ? e : e?.url;
                if (activeTabId && url) {
                  setAddressInput(url);
                  setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url } : t));
                }
              }}
            />
            {galleryInfo && galleryInfo.type !== 'none' && (
              <div className="gallery-detected" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: 4, fontSize: 12, color: '#fff', zIndex: 10 }}>
                🖼 Gallery: {galleryInfo.type} ({galleryInfo.imageCount} images)
              </div>
            )}
          </div>
        )}

        {/* Image Side Panel */}
        <AnimatePresence>
          {showImagePanel && images.length > 0 && (
            <motion.div
              className="browser-image-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
            >
              <div className="image-panel-header">
                <h4>🖼 Images ({images.length})</h4>
                <div className="image-panel-actions">
                  <Button variant="ghost" size="sm" onClick={selectAllImages}>
                    Select All
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleDownloadSelected}
                    disabled={selectedImages.size === 0}
                  >
                    ⬇ Download ({selectedImages.size})
                  </Button>
                </div>
              </div>
              <div className="image-panel-list">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`image-panel-item ${selectedImages.has(img.src) ? 'selected' : ''}`}
                    onClick={() => toggleImageSelection(img.src)}
                  >
                    <div className="image-panel-thumb">
                      <img
                        src={img.src}
                        alt={img.alt}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="image-panel-info">
                      <span className="image-panel-alt">{img.alt || 'No alt text'}</span>
                      {img.width > 0 && (
                        <span className="image-panel-size">{formatSize(img.width, img.height)}</span>
                      )}
                      {img.isLazy && <span className="image-panel-lazy">lazy</span>}
                    </div>
                    {selectedImages.has(img.src) && (
                      <div className="image-panel-check">✓</div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
