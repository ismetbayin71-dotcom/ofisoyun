import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Tv,
  Play,
  Pause,
  SkipForward,
  Plus,
  Trash2,
  ListMusic,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  X,
  GripHorizontal,
  RotateCcw
} from 'lucide-react';

import { extractYouTubeVideoId } from '../../utils/mediaUtils.js';

export { extractYouTubeVideoId };

const PRESET_WIDTHS = [220, 340, 520];

export const YouTubeTvWidget = ({
  mediaState = { currentTrack: null, queue: [], isPlaying: true },
  onAddTrack,
  onSkipTrack,
  onRemoveTrack,
  onTogglePlay,
  playerName = 'Oyuncu'
}) => {
  const [minimized, setMinimized] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputTitle, setInputTitle] = useState('');
  const [inputError, setInputError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Drag and Resize States
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('okey_tv_width_v2');
      if (saved) return Math.max(210, Math.min(680, parseInt(saved, 10)));
    } catch (e) {}
    return 320;
  });

  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('okey_tv_pos_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    const defaultX = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 340 - 24) : 900;
    return { x: defaultX, y: 56 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef({ mouseX: 0, startWidth: 320 });
  const iframeRef = useRef(null);

  const { currentTrack, queue = [], isPlaying = true } = mediaState || {};

  // YouTube IFrame API: Send pause/play commands whenever isPlaying changes
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    const cmd = isPlaying ? 'playVideo' : 'pauseVideo';
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: cmd, args: [] }),
        '*'
      );
    } catch (err) {
      // Cross-origin safe catch
    }
  }, [isPlaying, currentTrack?.videoId]);

  // Auto-skip when track ends via YouTube Iframe API postMessage
  useEffect(() => {
    const handleMessage = (e) => {
      try {
        if (!e.data || typeof e.data !== 'string') return;
        const parsed = JSON.parse(e.data);
        // YouTube iframe API onStateChange: 0 = ENDED
        if (parsed.event === 'onStateChange' && parsed.info === 0) {
          if (onSkipTrack) onSkipTrack();
        }
      } catch (err) {
        // Ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSkipTrack]);

  // Global mouse handlers for Dragging & Resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartRef.current.mouseX;
        const deltaY = e.clientY - dragStartRef.current.mouseY;
        const rawX = dragStartRef.current.posX + deltaX;
        const rawY = dragStartRef.current.posY + deltaY;

        const maxX = Math.max(10, window.innerWidth - width - 10);
        const maxY = Math.max(10, window.innerHeight - 80);
        const clampedX = Math.max(10, Math.min(rawX, maxX));
        const clampedY = Math.max(10, Math.min(rawY, maxY));

        setPosition({ x: clampedX, y: clampedY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStartRef.current.mouseX;
        const rawW = resizeStartRef.current.startWidth + deltaX;
        const maxAllowed = Math.min(680, window.innerWidth - 30);
        const clampedW = Math.max(210, Math.min(rawW, maxAllowed));

        setWidth(clampedW);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setPosition((curr) => {
          try {
            localStorage.setItem('okey_tv_pos_v2', JSON.stringify(curr));
          } catch (e) {}
          return curr;
        });
      }
      if (isResizing) {
        setIsResizing(false);
        setWidth((curr) => {
          try {
            localStorage.setItem('okey_tv_width_v2', String(curr));
          } catch (e) {}
          return curr;
        });
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, width]);

  // Start dragging from TV header
  const handleDragStart = (e) => {
    // Ignore clicks on buttons inside header
    if (e.target.closest('button') || e.target.closest('input')) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  // Start resizing from bottom-right corner grip
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      startWidth: width
    };
  };

  // Cycle preset sizes (Small -> Medium -> Large -> Small)
  const handleCycleSize = () => {
    const currentIdx = PRESET_WIDTHS.findIndex((w) => Math.abs(w - width) < 35);
    const nextIdx = (currentIdx + 1) % PRESET_WIDTHS.length;
    const nextW = PRESET_WIDTHS[nextIdx];
    setWidth(nextW);
    try {
      localStorage.setItem('okey_tv_width_v2', String(nextW));
    } catch (e) {}
  };

  // Reset to default top-right position
  const handleResetPosition = (e) => {
    e.stopPropagation();
    const defaultX = Math.max(10, window.innerWidth - width - 24);
    const resetPos = { x: defaultX, y: 56 };
    setPosition(resetPos);
    try {
      localStorage.setItem('okey_tv_pos_v2', JSON.stringify(resetPos));
    } catch (e) {}
  };

  // Toggle synchronized play/pause across the room
  const handleTogglePlayClick = () => {
    if (onTogglePlay) {
      onTogglePlay(!isPlaying);
    }
  };

  // Handle adding new song to queue
  const handleAddSubmit = (e) => {
    e.preventDefault();
    setInputError('');

    const videoId = extractYouTubeVideoId(inputUrl);
    if (!videoId) {
      setInputError('Geçersiz YouTube linki! Örnek: https://youtu.be/...');
      return;
    }

    const title = inputTitle.trim() || `YouTube Şarkı (${videoId.slice(0, 6)}...)`;
    const newTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      videoId,
      title,
      url: inputUrl.trim(),
      addedBy: playerName,
      addedAt: Date.now()
    };

    if (onAddTrack) {
      onAddTrack(newTrack);
    }

    setInputUrl('');
    setInputTitle('');
    setShowAddForm(false);
  };

  const getSizeLabel = () => {
    if (width <= 250) return 'Küçük';
    if (width <= 380) return 'Orta';
    return 'Büyük';
  };

  // Minimized TV Pill View
  if (minimized) {
    return (
      <div
        className="okey-tv-minimized"
        style={{
          position: 'fixed',
          left: Math.min(position.x, window.innerWidth - 130),
          top: Math.min(position.y, window.innerHeight - 50),
          zIndex: 95
        }}
        onClick={() => setMinimized(false)}
        title="Okey TV'yi Aç"
      >
        <div className="tv-mini-antenna">
          <div className="antenna-rod left"></div>
          <div className="antenna-rod right"></div>
        </div>
        <div className="tv-mini-body">
          <Tv size={16} color="#e5b94c" />
          <span className="tv-mini-label">OKEY TV</span>
          {currentTrack && (
            <span className={`tv-live-dot ${!isPlaying ? 'paused' : ''}`} />
          )}
          {queue.length > 0 && <span className="tv-queue-badge">{queue.length}</span>}
          <Maximize2 size={13} style={{ marginLeft: 4, opacity: 0.7 }} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Interaction shield prevents iframe mouse interception during drag / resize */}
      {(isDragging || isResizing) && (
        <div
          className="tv-interaction-shield"
          style={{ cursor: isDragging ? 'grabbing' : 'nwse-resize' }}
        />
      )}

      <div
        className={`okey-tv-floating-container ${isDragging ? 'is-dragging' : ''} ${isResizing ? 'is-resizing' : ''}`}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${width}px`,
          zIndex: 95
        }}
      >
        {/* Retro TV Antenna */}
        <div className="tv-antenna-wrapper">
          <div className="tv-antenna-rod left"></div>
          <div className="tv-antenna-base"></div>
          <div className="tv-antenna-rod right"></div>
        </div>

        {/* TV Main Cabinet */}
        <div className="tv-cabinet">
          {/* Draggable TV Header Bar */}
          <div
            className="tv-header-bar tv-drag-handle"
            onMouseDown={handleDragStart}
            title="Başlıktan tutarak ekran üzerinde istediğiniz yere sürükleyebilirsiniz"
          >
            <div className="tv-branding">
              <GripHorizontal size={14} className="tv-grip-icon" />
              <Tv size={14} color="#e5b94c" />
              <span className="tv-brand-name">OKEY TV</span>
              <span
                className={`tv-status-led ${currentTrack ? (isPlaying ? 'active' : 'paused') : 'idle'}`}
                title={currentTrack ? (isPlaying ? 'Yayın Canlı' : 'Yayın Duraklatıldı') : 'Yayın Bekleniyor'}
              />
            </div>

            <div className="tv-header-actions" onMouseDown={(e) => e.stopPropagation()}>
              {/* Reset position button */}
              <button
                type="button"
                className="tv-icon-btn"
                onClick={handleResetPosition}
                title="Sağ Üst Varsayılan Konuma Sıfırla"
              >
                <RotateCcw size={12} />
              </button>

              {/* Cycle size button (Küçük / Orta / Büyük) */}
              <button
                type="button"
                className="tv-icon-btn tv-size-toggle-btn"
                onClick={handleCycleSize}
                title={`Boyut Değiştir (${getSizeLabel()})`}
              >
                <Maximize2 size={12} />
                <span className="tv-size-pill">{getSizeLabel()}</span>
              </button>

              {/* Audio Mute toggle */}
              <button
                type="button"
                className="tv-icon-btn"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'TV Sesini Aç' : 'TV Sesini Kıs'}
              >
                {isMuted ? <VolumeX size={13} color="#f87171" /> : <Volume2 size={13} color="#38ef7d" />}
              </button>

              {/* Minimize widget */}
              <button
                type="button"
                className="tv-icon-btn"
                onClick={() => setMinimized(true)}
                title="TV'yi Küçült"
              >
                <Minimize2 size={13} />
              </button>
            </div>
          </div>

          {/* TV Screen Viewport */}
          <div className="tv-screen-bezel">
            <div className="tv-screen">
              {currentTrack ? (
                <div className="tv-iframe-container">
                  <iframe
                    ref={iframeRef}
                    key={currentTrack.videoId}
                    className="tv-iframe"
                    src={`https://www.youtube-nocookie.com/embed/${currentTrack.videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(
                      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
                    )}${isMuted ? '&mute=1' : ''}`}
                    title={currentTrack.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />

                  {/* CRT Screen Scanline Overlay */}
                  <div className="tv-scanlines" />

                  {/* Synchronized Room Pause Overlay */}
                  {!isPlaying && (
                    <div
                      className="tv-paused-screen-overlay"
                      onClick={handleTogglePlayClick}
                      title="Tüm masada oynatmak için tıklayın"
                    >
                      <div className="tv-paused-content">
                        <Pause size={28} color="#e5b94c" fill="#e5b94c" />
                        <span className="tv-paused-title">DURAKLATILDI</span>
                        <span className="tv-paused-sub">Masa genelinde durduruldu</span>
                        <button type="button" className="tv-resume-badge-btn">
                          <Play size={12} style={{ marginRight: 4 }} fill="#38ef7d" color="#38ef7d" />
                          Devam Et
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="tv-standby-screen">
                  <div className="tv-static-effect" />
                  <div className="tv-standby-content">
                    <span style={{ fontSize: '1.4rem' }}>📺</span>
                    <div className="tv-standby-text">Şarkı veya Video Yok</div>
                    <button
                      className="btn-primary tv-add-first-btn"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus size={13} style={{ marginRight: 4 }} />
                      Link Ekle
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* TV Status & Track Info Bar */}
          <div className="tv-info-strip">
            {currentTrack ? (
              <div className="tv-track-marquee-wrapper" title={currentTrack.title}>
                <div className="tv-equalizer">
                  <span className={`eq-bar bar-1 ${!isPlaying ? 'paused' : ''}`}></span>
                  <span className={`eq-bar bar-2 ${!isPlaying ? 'paused' : ''}`}></span>
                  <span className={`eq-bar bar-3 ${!isPlaying ? 'paused' : ''}`}></span>
                </div>
                <div className="tv-track-title-scroller">
                  <span className="tv-track-title">{currentTrack.title}</span>
                  <span className="tv-track-author">• {currentTrack.addedBy} ekledi</span>
                  {!isPlaying && <span className="tv-track-paused-tag">(DURAKLATILDI)</span>}
                </div>
              </div>
            ) : (
              <div className="tv-idle-text">Müzik açmak için link ekleyin</div>
            )}
          </div>

          {/* TV Control Buttons Panel */}
          <div className="tv-controls-panel">
            {/* Synchronized Play / Pause Button */}
            <button
              className={`tv-ctrl-btn tv-play-pause-btn ${!isPlaying ? 'is-paused' : ''}`}
              disabled={!currentTrack}
              onClick={handleTogglePlayClick}
              title={isPlaying ? 'Tüm Masa İçin Duraklat (Pause)' : 'Tüm Masa İçin Oynat (Play)'}
            >
              {isPlaying ? (
                <>
                  <Pause size={13} color="#f59e0b" fill="#f59e0b" />
                  <span>Durdur</span>
                </>
              ) : (
                <>
                  <Play size={13} color="#38ef7d" fill="#38ef7d" />
                  <span>Oynat</span>
                </>
              )}
            </button>

            {/* Add Link Button */}
            <button
              className={`tv-ctrl-btn ${showAddForm ? 'active' : ''}`}
              onClick={() => {
                setShowAddForm(!showAddForm);
                setShowQueue(false);
              }}
              title="Yeni YouTube Şarkı Linki Ekle"
            >
              <Plus size={13} />
              <span>Link Ekle</span>
            </button>

            {/* Queue Button */}
            <button
              className={`tv-ctrl-btn ${showQueue ? 'active' : ''}`}
              onClick={() => {
                setShowQueue(!showQueue);
                setShowAddForm(false);
              }}
              title="Sıradaki Şarkıları Görüntüle"
            >
              <ListMusic size={13} />
              <span>Sıra ({queue.length})</span>
            </button>

            {/* Skip Track Button */}
            <button
              className="tv-ctrl-btn skip-btn"
              disabled={!currentTrack}
              onClick={() => onSkipTrack && onSkipTrack()}
              title="Sıradaki Şarkıya Geç (Skip)"
            >
              <SkipForward size={13} />
              <span>Sonraki</span>
            </button>
          </div>

          {/* Expandable: Add YouTube Link Drawer */}
          {showAddForm && (
            <form className="tv-add-drawer" onSubmit={handleAddSubmit}>
              <div className="tv-drawer-header">
                <strong>YouTube Linki Ekle</strong>
                <button
                  type="button"
                  className="tv-close-drawer-btn"
                  onClick={() => setShowAddForm(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <input
                type="text"
                className="tv-input"
                placeholder="https://youtu.be/... veya video linki"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  setInputError('');
                }}
                autoFocus
              />

              <input
                type="text"
                className="tv-input"
                style={{ marginTop: 6 }}
                placeholder="Şarkı Adı (isteğe bağlı)"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
              />

              {inputError && <div className="tv-error-text">{inputError}</div>}

              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                >
                  <Plus size={13} style={{ marginRight: 4 }} />
                  {currentTrack ? 'Sıraya Ekle' : 'Şimdi Çal'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => setShowAddForm(false)}
                >
                  İptal
                </button>
              </div>
            </form>
          )}

          {/* Expandable: Playlist Queue Drawer */}
          {showQueue && (
            <div className="tv-queue-drawer">
              <div className="tv-drawer-header">
                <strong>Sıradaki Şarkılar ({queue.length})</strong>
                <button
                  type="button"
                  className="tv-close-drawer-btn"
                  onClick={() => setShowQueue(false)}
                >
                  <X size={14} />
                </button>
              </div>

              {queue.length === 0 ? (
                <div className="tv-queue-empty">
                  Sırada şarkı yok. Yeni link eklediğinizde otomatik sıraya alınır!
                </div>
              ) : (
                <div className="tv-queue-list">
                  {queue.map((track, idx) => (
                    <div key={track.id || idx} className="tv-queue-item">
                      <span className="tv-queue-idx">{idx + 1}.</span>
                      <div className="tv-queue-info">
                        <div className="tv-queue-title">{track.title}</div>
                        <div className="tv-queue-meta">{track.addedBy} ekledi</div>
                      </div>
                      <button
                        className="tv-queue-remove-btn"
                        onClick={() => onRemoveTrack && onRemoveTrack(track.id)}
                        title="Sıradan Kaldır"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom-Right Corner Resize Grip Handle */}
          <div
            className="tv-resize-handle"
            onMouseDown={handleResizeStart}
            title="Boyutlandırmak için çekin (Büyüt / Küçült)"
          >
            <div className="tv-resize-lines">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
