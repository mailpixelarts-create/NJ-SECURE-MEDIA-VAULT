import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageViewerImage {
  id: string;
  url: string;
  name: string;
  size?: number;
  mediaType?: string;
}

interface ImageViewerProps {
  images: ImageViewerImage[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (url: string) => void;
}

/**
 * Full-featured Picture Viewer with:
 * - Thumbnail strip with scroll
 * - Slideshow with configurable speed
 * - Zoom (click, buttons, keyboard)
 * - Drag-to-pan when zoomed
 * - Keyboard navigation (arrows, space, +/-, T, I, F, Esc)
 * - Fullscreen mode
 * - Info panel
 * - Streaming decryption via vault:// protocol
 */
export const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  initialIndex = 0,
  onClose,
  onDownload
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState(3000);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const slideshowRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentImage = images[currentIndex];

  // Reset zoom/pan on image change
  useEffect(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isSlideshow) setSlideshowSpeed(s => Math.max(s - 500, 500));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (isSlideshow) setSlideshowSpeed(s => Math.min(s + 500, 15000));
          break;
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          toggleSlideshow();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom(z => Math.min(z + 0.25, 5));
          break;
        case '-':
          e.preventDefault();
          setZoom(z => Math.max(z - 0.25, 0.1));
          break;
        case '0':
          setZoom(1);
          setPanX(0);
          setPanY(0);
          break;
        case 'i':
          setShowInfo(s => !s);
          break;
        case 't':
          setShowThumbnails(s => !s);
          break;
        case 'Home':
          setCurrentIndex(0);
          break;
        case 'End':
          setCurrentIndex(images.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isSlideshow, images.length, onClose]);

  // Slideshow timer
  useEffect(() => {
    if (isSlideshow) {
      slideshowRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % images.length);
      }, slideshowSpeed);
    } else if (slideshowRef.current) {
      clearInterval(slideshowRef.current);
      slideshowRef.current = null;
    }
    return () => {
      if (slideshowRef.current) {
        clearInterval(slideshowRef.current);
        slideshowRef.current = null;
      }
    };
  }, [isSlideshow, slideshowSpeed, images.length]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  const toggleSlideshow = useCallback(() => setIsSlideshow(s => !s), []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  // Drag-to-pan when zoomed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [zoom, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Click to zoom
  const handleMainClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPanX(0);
      setPanY(0);
    }
  }, [isDragging, zoom]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(z => Math.max(0.1, Math.min(5, z + delta)));
  }, []);

  // Scroll thumbnail strip to keep active thumbnail visible
  useEffect(() => {
    if (thumbnailStripRef.current) {
      const activeThumb = thumbnailStripRef.current.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getImageUrl = (img: ImageViewerImage): string => {
    // Use vault:// protocol for streaming decryption
    if (img.url.startsWith('vault://') || img.url.startsWith('http')) {
      return img.url;
    }
    return `vault://${img.id}/stream`;
  };

  if (!currentImage) return null;

  return (
    <div
      className="image-viewer-overlay"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* ═══ TOP BAR ═══ */}
      <div className="viewer-top-bar">
        <div className="viewer-info">
          <span className="viewer-filename">{currentImage.name}</span>
          <span className="viewer-counter">{currentIndex + 1} / {images.length}</span>
          {currentImage.size && <span className="viewer-size">{formatSize(currentImage.size)}</span>}
        </div>
        <div className="viewer-controls">
          <button className="viewer-btn" onClick={() => setShowThumbnails(s => !s)} title="Toggle thumbnails (T)">
            {showThumbnails ? '📋' : '📋'}
          </button>
          <button className="viewer-btn" onClick={() => setShowInfo(s => !s)} title="Info (I)">
            ℹ️
          </button>
          <button className="viewer-btn" onClick={toggleFullscreen} title="Fullscreen (F)">
            {isFullscreen ? '-windowed' : '🔲'}
          </button>
          {onDownload && (
            <button className="viewer-btn" onClick={() => onDownload(getImageUrl(currentImage))} title="Download">
            ⬇
          </button>
          )}
          <button className="viewer-btn close" onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>
      </div>

      {/* ═══ MAIN IMAGE AREA ═══ */}
      <div
        className="viewer-main"
        onClick={handleMainClick}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="viewer-image-wrapper"
            style={{
              transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
            }}
            onMouseDown={handleMouseDown}
          >
            <img
              src={getImageUrl(currentImage)}
              alt={currentImage.name}
              className="viewer-image"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button className="viewer-arrow prev" onClick={(e) => { e.stopPropagation(); goToPrev(); }}>
              ◀
            </button>
            <button className="viewer-arrow next" onClick={(e) => { e.stopPropagation(); goToNext(); }}>
              ▶
            </button>
          </>
        )}

        {/* Zoom indicator */}
        {zoom !== 1 && (
          <div className="viewer-zoom-badge">{Math.round(zoom * 100)}%</div>
        )}
      </div>

      {/* ═══ BOTTOM BAR ═══ */}
      <div className="viewer-bottom-bar">
        <div className="viewer-bottom-left">
          {/* Slideshow controls */}
          <button
            className={`viewer-btn ${isSlideshow ? 'active' : ''}`}
            onClick={toggleSlideshow}
            title="Slideshow (Space)"
          >
            {isSlideshow ? '⏸ Pause' : '▶ Play'}
          </button>
          {isSlideshow && (
            <select
              className="viewer-speed-select"
              value={slideshowSpeed}
              onChange={(e) => setSlideshowSpeed(parseInt(e.target.value))}
            >
              <option value={500}>0.5s</option>
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          )}
        </div>

        <div className="viewer-bottom-center">
          {/* Zoom controls */}
          <button className="viewer-btn" onClick={() => setZoom(z => Math.max(z - 0.25, 0.1))}>−</button>
          <span className="viewer-zoom-text">{Math.round(zoom * 100)}%</span>
          <button className="viewer-btn" onClick={() => setZoom(z => Math.min(z + 0.25, 5))}>+</button>
          <button className="viewer-btn" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}>Reset</button>
        </div>

        <div className="viewer-bottom-right">
          <span className="viewer-shortcuts">← → navigate | Space play | +/- zoom | T thumbs | I info | F fullscreen</span>
        </div>
      </div>

      {/* ═══ THUMBNAIL STRIP ═══ */}
      {showThumbnails && images.length > 1 && (
        <div className="viewer-thumbnails" ref={thumbnailStripRef}>
          {images.map((img, index) => (
            <div
              key={img.id}
              className={`viewer-thumb ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              <img src={getImageUrl(img)} alt={img.name} loading="lazy" />
              <span className="viewer-thumb-index">{index + 1}</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ INFO PANEL ═══ */}
      {showInfo && (
        <div className="viewer-info-panel">
          <h4>Image Details</h4>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">Name</span>
              <span className="info-value">{currentImage.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Size</span>
              <span className="info-value">{formatSize(currentImage.size)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Position</span>
              <span className="info-value">{currentIndex + 1} of {images.length}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Zoom</span>
              <span className="info-value">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="info-row">
              <span className="info-label">Slideshow</span>
              <span className="info-value">{isSlideshow ? `${slideshowSpeed / 1000}s interval` : 'Off'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
